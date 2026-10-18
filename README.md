# 🇲🇲 SG4DMyanmar - Singapore 4D Lottery Agent Platform

Production-ready, full-stack lottery agent and financial verification platform built for the Myanmar market with international user support (Thailand, Singapore, South Korea, Japan). Features a dark mode UI with electric purple accents, mandatory agent referral codes, 30% agent commission/cashback, Monday 11:00 AM 10% weekly bonuses, 4:30 PM MMT draw cutoffs, smart payment auto-verification with a 15-minute expiry rule, official Singapore 4D multipliers, and automated 3-month cold storage data archiving.

---

## 🏛️ System Architecture & Expanded Features

```
SG4DMyanmar/
├── backend/                       # Python FastAPI Backend
│   ├── app/
│   │   ├── config.py              # 30% commission, Monday 11AM bonus, 4:30PM cutoff, 50-10,000 MMK limits
│   │   ├── database.py            # SQLAlchemy SQLite/PostgreSQL engine & session
│   │   ├── main.py                # FastAPI app, CORS, APScheduler (Monday 11AM, 3:30PM cutoff, 2AM archiving)
│   │   ├── models/                # User, AgentCommissionLog, WeeklyBonus, BetSlip, LotteryDraw, Ledger, Archives
│   │   │   ├── user.py            # Referral code enforcement & Agent commissions
│   │   │   ├── bonus.py           # 10% Weekly Active Player Bonus model
│   │   │   ├── bet.py             # 4D tickets, BetItems, BetArchive, VOID status
│   │   │   ├── lottery.py         # Singapore 4D draws & official prize tiers
│   │   │   ├── transaction.py     # KPay, WavePay, AYA Pay audit trail & archives
│   │   │   └── ledger.py          # Financial ledger (AGENT_COMMISSION & WEEKLY_BONUS entries)
│   │   ├── schemas/               # Pydantic request/response schemas
│   │   ├── core/
│   │   │   ├── timezone_utils.py  # MMT (UTC+6:30), 4:30PM cutoff check, 8AM-8PM operating hours, 15m window
│   │   │   ├── bet_calculator.py  # 4D Ordinary, Permutation/Box, Roll engine (50 - 10,000 MMK limits)
│   │   │   ├── bonus_engine.py    # Monday 11:00 AM MMT 10% Weekly Bonus distribution engine
│   │   │   ├── payment_verifier.py# Gateway parser, 8AM-8PM check, duplicate check, 15m auto-approval
│   │   │   ├── notifications.py   # Cutoff reminders (3:30PM), bonus alerts, payout announcements
│   │   │   ├── security.py        # Bcrypt password hashing & JWT authentication
│   │   │   └── archiver.py        # 90-day cold storage archiving to compressed JSON.gz
│   │   ├── api/                   # Auth, Bets, Payments, Lottery, Admin, Notifications API routers
│   │   └── seeds/                 # Demo Admin (ADM001), Master Agent (AGT8899), Player (250k MMK)
│   ├── cron_weekly_bonus.py       # Standalone CLI / system cron script for Monday 11:00 AM bonus settlement
│   ├── tests/test_core.py         # 10 comprehensive unit test suites
│   ├── requirements.txt           # Python dependencies
│   └── Dockerfile                 # Containerized backend with Asia/Yangon timezone
│
├── frontend/                      # React (Vite) + Tailwind CSS (Dark Mode & Electric Purple)
│   ├── src/
│   │   ├── components/            # BettingForm, LiveSlip, DepositModal, ResultsBoard, AdminLedger, AuthModal
│   │   ├── context/AuthContext.jsx# Authentication, agent code binding, wallet balance
│   │   ├── api/client.js          # API client with agent verification & notifications
│   │   ├── App.jsx                # Layout orchestrator and mobile navigation bar
│   │   └── index.css              # Electric purple glow effects and glassmorphism styling
│   ├── package.json
│   └── tailwind.config.js         # Custom electric purple palette
│
└── mobile/                        # Android App APK Export Package
    ├── android/                   # Native Android Gradle configuration (SDK 34)
    │   ├── app/src/main/          # MainActivity.java (WebView, camera/file chooser for receipts)
    │   └── app/build.gradle       # Clean APK packaging rules (SG4DMyanmar-v1.0.0-release.apk)
    ├── scripts/                   # Automated build scripts (build_apk.ps1, build_apk.sh)
    └── README.md                  # Step-by-step APK compilation and signing guide
```

---

## ⚡ Core Rules & Business Logic

### 1. User Registration, Authentication & Referral/Agent System
- **Referral Code Enforcement**: Every user signup requires a valid, active **Agent Code** (e.g. `AGT8899`). Users cannot register without an authorized agent code.
- **30% Agent Commission / Cashback**:
  * Whenever a player places a 4D bet, the system automatically calculates **30% of the total stake** (`settings.AGENT_COMMISSION_RATE = 0.30`).
  * The 30% commission is **instantly credited into the referring Agent's wallet balance**.
  * Recorded in `agent_commission_logs` and the Financial Ledger under `AGENT_COMMISSION`.
  * The agent receives an instant in-app notification: *"💰 30% Commission Received: +X MMK from Player Y's bet!"*

### 2. Active Player 10% Weekly Bonus System
- **Draw Days**: Wednesday, Saturday, and Sunday (Wed, Sat, Sun).
- **Qualification Rule**: Any player who wagers a minimum total bet of **$\ge$ 10,000 MMK** on at least ONE draw day within the calendar week qualifies for a **10% Weekly Bonus**.
- **Settlement Schedule**: Automated batch job runs **EVERY MONDAY AT 11:00 AM (MMT - Myanmar Standard Time, UTC+6:30)**.
- **Distribution**: Calculates 10% of the user's total qualifying bets for the previous week (Monday to Sunday) and credits the bonus directly to their wallet balance.
- **Batch Cron Script**: Available via automated APScheduler job or standalone script:
  ```powershell
  python backend/cron_weekly_bonus.py
  ```

### 3. Lottery Game Rules, Payout Structure & Betting Limits
- **Draw Days & 4:30 PM (MMT) Cut-off Time**:
  * Singapore 4D Draws take place on **Wednesday, Saturday, and Sunday**.
  * Bets **strictly close at 4:30 PM (16:30 MMT)** on draw days. Any bets submitted past 4:30 PM are rejected immediately. Any post-cutoff bets permitted by system clock drift are flagged as `VOID`.
  * An automated Cutoff Reminder is broadcast at **3:30 PM MMT** (1 hour prior to cutoff).
- **Betting Limits**:
  * Minimum bet per number: **50 MMK**.
  * Maximum bet per number: **10,000 MMK**.
  * Players can re-bet multiple times until wallet balance is exhausted.
- **Official Singapore 4D Payout Multipliers**:
  * 1st Prize (ပထမဆု): **2,000x**
  * 2nd Prize (ဒုတိယဆု): **1,000x**
  * 3rd Prize (တတိယဆု): **500x**
  * Starter Prize (ဆုကြီး): **100x**
  * Consolation Prize (ဆုသေး): **30x**
  * Permutation / Box Roll (ဆုကြီး ၃ ဆု၏ ပတ်လည်): **10x**
- **Automated Payout System (6:00 PM MMT)**:
  * Official Singapore 4D results are drawn between 6:00 PM and 6:20 PM+ (MMT).
  * Automated Payout System evaluates winning tickets and credits winnings instantly to user wallets for immediate withdrawal.

### 4. Financial Management & Smart Payment Verification
- **Deposit & Withdrawal Channels**: KPay, WavePay, AYA Pay.
- **Operating Hours**: **8:00 AM to 8:00 PM MMT** (08:00 - 20:00). Requests outside this window are flagged/rejected.
- **International Timezone Normalization**: Normalizes all foreign timestamps (Thailand ICT UTC+7, Singapore SGT UTC+8, Korea KST UTC+9, Japan JST UTC+9) into MMT (UTC+6:30).
- **15-Minute Expiry Rule**: Transactions older than 15 minutes from submission time are rejected/flagged as `FLAGGED_EXPIRED`.
- **Instant Auto-Approval**: When TxID, Receiver ID, operating hours, and 15-minute window match, the deposit is auto-approved and credited immediately.

### 5. Financial Ledger & Automated 3-Month Archiving
- **Ledger Entries**: Tracks `DEPOSIT`, `WITHDRAWAL`, `BET_REVENUE`, `PAYOUT_EXPENSE`, `AGENT_COMMISSION` (30%), `WEEKLY_BONUS` (10%), and running balances.
- **Net Profit / Loss Formula**:
  $$\text{Net Profit} = \text{Total Bet Volume} - (\text{Total Payouts} + \text{Agent Commissions} + \text{Weekly Bonuses})$$
- **Automated Archiving**: Nightly cron job at 02:00 AM MMT archives settled bets and transactions older than 90 days (3 months) into `bet_archives`, `transaction_archives`, and compressed `.json.gz` cold backups in `backend/archives/`.

---

## 🔑 Demo Access Accounts

| Role | Phone | Password | Agent / Referral Code | Permissions & Balance |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `09999999999` | `Admin123!` | `ADM001` | Full Financial Ledger, Draw Settlement, Archiving, Bonus Trigger (10M MMK) |
| **Master Agent**| `09777777777` | `Agent123!` | `AGT8899` | 30% Instant Commission Receiver, Referral Management (1.5M MMK) |
| **Player** | `09888888888` | `Player123!` | `AGT8899` | 4D Betting (50-10,000 MMK), 10% Weekly Bonus, Deposit (250k MMK) |

*(Use the 1-Click Demo buttons on the login modal to switch between roles effortlessly)*

---

## 🚀 Running the Platform

### 1. Run Backend (FastAPI)
```powershell
cd d:\SG4DMyanmar
.\venv\Scripts\Activate.ps1

cd backend
python run.py
```
- API Base: `http://localhost:8000`
- Swagger Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/api/health`

### 2. Run Frontend (React + Vite)
```powershell
cd d:\SG4DMyanmar\frontend
npm run dev
```
- Web Application: `http://localhost:3000`

### 3. Run Unit Tests (10 Test Suites)
```powershell
cd d:\SG4DMyanmar\backend
..\venv\Scripts\python tests/test_core.py
```

### 4. Trigger Monday 11:00 AM Bonus Job
```powershell
cd d:\SG4DMyanmar\backend
..\venv\Scripts\python cron_weekly_bonus.py
```

---

## 📱 Exporting the Android APK

1. Navigate to the mobile scripts directory:
   ```powershell
   cd d:\SG4DMyanmar\mobile\scripts
   .\build_apk.ps1 -BuildType release
   ```
2. The output APK will be placed at:
   `mobile/android/app/build/outputs/apk/release/SG4DMyanmar-v1.0.0-release.apk`
