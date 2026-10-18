import sys
import json
import uuid
from app.database import SessionLocal
from app.models.user import User, AgentCommissionLog, Notification
from app.models.bet import BetSlip, BetItem, BetSlipStatus
from app.models.lottery import LotteryDraw, DrawStatus
from app.models.ledger import FinancialLedger, LedgerEntryType, DailyLedgerSummary
from app.models.transaction import Transaction, TransactionType, TransactionStatus
from app.core.timezone_utils import now_mmt

def place_10000_bets():
    db = SessionLocal()

    user = db.query(User).filter(User.phone == '0943105959').first()
    if not user:
        print('User 0943105959 not found!')
        db.close()
        return

    draw = db.query(LotteryDraw).filter(LotteryDraw.draw_date == '2026-10-17').first()
    if not draw:
        print('Draw for 2026-10-17 not found!')
        db.close()
        return

    agent = db.query(User).filter(User.id == user.agent_id).first()

    current_time = now_mmt()
    today_str = current_time.strftime('%Y-%m-%d')

    # Step 1: Top up user balance by 5,000,000 MMK for testing
    topup_amount = 5000000.0
    user.balance += topup_amount

    tx = Transaction(
        user_id=user.id,
        tx_type=TransactionType.DEPOSIT,
        gateway="wavepay",
        transaction_id=f"TEST{uuid.uuid4().hex[:8].upper()}",
        receiver_id="09798888888",
        amount=topup_amount,
        status=TransactionStatus.COMPLETED,
        tx_timestamp_mmt=current_time,
        submission_timestamp_mmt=current_time,
        is_time_valid=True,
        is_receiver_valid=True,
        is_tx_unique=True,
        verification_notes="Automated test deposit for 10,000 numbers betting test",
        created_at=current_time
    )
    db.add(tx)

    ledger_topup = FinancialLedger(
        entry_type=LedgerEntryType.DEPOSIT,
        amount=topup_amount,
        running_balance=user.balance,
        reference_id=tx.transaction_id,
        reference_type="TRANSACTION",
        description=f"Test Deposit Topup for {user.full_name}",
        logged_at_mmt=current_time,
        date_str=today_str
    )
    db.add(ledger_topup)

    # Step 2: Prepare 10,000 combinations (0000 to 9999) with 200, 300, 400, 500 MMK
    stake_cycle = [200, 300, 400, 500]
    total_stake = 0
    items_to_create = []

    for i in range(10000):
        num_str = f"{i:04d}"
        stake = stake_cycle[i % 4]
        total_stake += stake
        items_to_create.append((num_str, stake))

    # Deduct stake
    user.balance -= total_stake

    agent_commission = round(total_stake * 0.30, 2)
    slip_code = f"SLIP-{current_time.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    slip = BetSlip(
        slip_code=slip_code,
        user_id=user.id,
        agent_id=agent.id if agent else None,
        agent_commission=agent_commission,
        draw_id=draw.id,
        total_stake=total_stake,
        total_payout=0.0,
        status=BetSlipStatus.PENDING,
        created_at=current_time
    )
    db.add(slip)
    db.flush()

    # Bulk insert bet items
    bet_items = [
        BetItem(
            slip_id=slip.id,
            number=num,
            bet_type="ordinary",
            big_amount=stake,
            small_amount=0,
            combination_count=1,
            combinations_json=f'["{num}"]',
            item_stake=stake,
            item_payout=0.0,
            is_won=0,
            win_details_json="[]"
        )
        for num, stake in items_to_create
    ]
    db.bulk_save_objects(bet_items)

    # Credit agent 30% commission
    if agent:
        agent.balance += agent_commission
        agent.total_commission_earned = (agent.total_commission_earned or 0.0) + agent_commission
        
        comm_log = AgentCommissionLog(
            agent_id=agent.id,
            player_id=user.id,
            bet_slip_id=slip.id,
            bet_total_stake=total_stake,
            commission_rate=0.30,
            commission_amount=agent_commission,
            agent_balance_after=agent.balance,
            created_at=current_time
        )
        db.add(comm_log)
        
        comm_ledger = FinancialLedger(
            entry_type=LedgerEntryType.AGENT_COMMISSION,
            amount=-agent_commission,
            running_balance=agent.balance,
            reference_id=slip.slip_code,
            reference_type="COMMISSION",
            description=f"30% Agent Commission to {agent.full_name} for Slip {slip.slip_code}",
            logged_at_mmt=current_time,
            date_str=today_str
        )
        db.add(comm_ledger)

    # Bet Revenue Ledger
    bet_ledger = FinancialLedger(
        entry_type=LedgerEntryType.BET_REVENUE,
        amount=total_stake,
        running_balance=user.balance,
        reference_id=slip.slip_code,
        reference_type="BET_SLIP",
        description=f"4D Bet Placed ({slip.slip_code}) - 10,000 Numbers on Draw {draw.draw_date}",
        logged_at_mmt=current_time,
        date_str=today_str
    )
    db.add(bet_ledger)

    # Update draw total pool
    draw.total_pool_stake = (draw.total_pool_stake or 0.0) + total_stake

    # Update Daily summary
    daily_summary = db.query(DailyLedgerSummary).filter(DailyLedgerSummary.date_str == today_str).first()
    if daily_summary:
        daily_summary.total_bet_volume += total_stake
        daily_summary.total_agent_commissions += agent_commission
        daily_summary.net_profit += (total_stake - agent_commission)
        daily_summary.total_bets_count += 1
        daily_summary.updated_at_mmt = current_time
    else:
        daily_summary = DailyLedgerSummary(
            date_str=today_str,
            total_bet_volume=total_stake,
            total_agent_commissions=agent_commission,
            net_profit=(total_stake - agent_commission),
            total_bets_count=1,
            updated_at_mmt=current_time
        )
        db.add(daily_summary)

    db.commit()

    print(f"SUCCESS: Placed 10,000 combinations for {user.full_name} ({user.phone})!")
    print(f"Slip Code: {slip.slip_code}")
    print(f"Draw Date: {draw.draw_date} (Draw #{draw.draw_number})")
    print(f"Combinations Count: 10,000 items (0000 to 9999)")
    print(f"Total Stake: {total_stake:,.0f} MMK")
    print(f"Agent 30% Commission: {agent_commission:,.0f} MMK credited to {agent.full_name if agent else 'N/A'}")
    print(f"User Balance Remaining: {user.balance:,.0f} MMK")
    db.close()

if __name__ == "__main__":
    place_10000_bets()
