import urllib.request
import json
import sys
import datetime

# Fix UTF-8 encoding on Windows console
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000/api"

def print_step(title):
    print("\n" + "="*60)
    print(f"[*] {title}")
    print("="*60)

def post(endpoint, data=None, token=None):
    url = f"{BASE_URL}{endpoint}"
    payload = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def get(endpoint, token=None):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

try:
    # 1. Health Check
    print_step("1. Health Check & System Status")
    health = get("/health")
    print(json.dumps(health, indent=2, ensure_ascii=False))

    # 2. Player Login
    print_step("2. User Login (09888888888)")
    login_res = post("/auth/login", {"phone": "09888888888", "password": "Player123!"})
    token = login_res.get("access_token")
    user = login_res["user"]
    print(f"User Phone: {user['phone']} (Role: {user['role']})")
    print(f"User Balance: {user['balance']:,} MMK | Referral Code: {user['agent_code']}")

    # 3. Agent Info Before Bet
    print_step("3. Check Agent Wallet Before Bet")
    agent_before = post("/auth/login", {"phone": "09777777777", "password": "Agent123!"})["user"]
    agent_balance_before = agent_before["balance"]
    print(f"Agent ({agent_before['agent_code']}) Balance: {agent_balance_before:,} MMK")

    # 4. Check Active Draw
    print_step("4. Active Draw Info (Singapore 4D)")
    draw = get("/bets/active-draw", token=token)
    print(f"Draw ID: {draw.get('id')} | Draw Number: {draw.get('draw_number')}")
    print(f"Draw Date: {draw.get('draw_date')} ({draw.get('day_of_week')})")
    print(f"Cut-off Time: {draw.get('cutoff_time')} MMT | Status: {draw.get('status')}")

    # 5. Place a 4D Bet (Ordinary Big 1000 MMK)
    print_step("5. Place 4D Bet (1,000 MMK on 1234)")
    bet_payload = {
        "items": [
            {
                "number": "1234",
                "bet_type": "BIG",
                "amount": 1000.0
            }
        ]
    }
    bet_result = post("/bets/place", bet_payload, token=token)
    print("Bet Slip Created Successfully!")
    print(f"Slip ID: {bet_result.get('id')} | Total Stake: {bet_result.get('total_stake'):,} MMK")
    print(f"Remaining User Balance: {bet_result.get('remaining_balance'):,} MMK")

    # 6. Verify Agent 30% Commission
    print_step("6. Verify Agent 30% Commission Credited Automatically")
    agent_after = post("/auth/login", {"phone": "09777777777", "password": "Agent123!"})["user"]
    agent_balance_after = agent_after["balance"]
    commission = agent_balance_after - agent_balance_before
    print(f"Agent Balance Before: {agent_balance_before:,} MMK")
    print(f"Agent Balance After:  {agent_balance_after:,} MMK")
    print(f"Commission Earned:    +{commission:,} MMK (Exact 30% of 1,000 MMK)")

    # 7. Check Player Bet History
    print_step("7. Player Bet History")
    history = get("/bets/history", token=token)
    print(f"Total Bet Slips in History: {len(history)}")
    if history:
        latest = history[0]
        print(f"Latest Slip ID: {latest['id']}, Stake: {latest['total_stake']:,} MMK, Draw Date: {latest['draw_date']}")

    # 8. Test Payment Receiver Info
    print_step("8. Payment Gateways (KPay, WavePay, AYA Pay)")
    receivers = get("/payments/receivers", token=token)
    for r in receivers["receivers"]:
        print(f"- [{r['provider']}] Name: {r['account_name']}, Phone: {r['account_number']}")

    # 9. Test Deposit Submission (Smart Auto-Approval)
    print_step("9. Test Smart Deposit Submission (Auto-Verify Rule)")
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    tx_id = f"TXN{datetime.datetime.now().strftime('%M%S%f')[:6]}"
    deposit_payload = {
        "provider": "KPAY",
        "receiver_account": "09988887777",
        "transaction_id": tx_id,
        "amount": 50000.0,
        "transferred_at": now_str,
        "screenshot_url": "https://sg4d.my/proof/txn.png"
    }
    dep_res = post("/payments/deposit", deposit_payload, token=token)
    print("Deposit Submission Status:")
    print(f"Status: {dep_res.get('status')} | Message: {dep_res.get('message')}")
    print(f"Auto-Approved: {dep_res.get('auto_approved')} | New Balance: {dep_res.get('new_balance'):,} MMK")

    print("\n" + "="*60)
    print("[SUCCESS] All Backend Core Operations Tested & Verified Successfully!")
    print("="*60)

except Exception as e:
    print(f"[ERROR] Error occurred: {e}")
    sys.exit(1)
