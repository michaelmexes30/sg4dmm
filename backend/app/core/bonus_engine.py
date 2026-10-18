from datetime import datetime, timedelta
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.config import settings
from app.database import SessionLocal
from app.models.user import User, UserRole, Notification, AgentCommissionLog
from app.models.bet import BetSlip, BetSlipStatus
from app.models.lottery import LotteryDraw
from app.models.bonus import WeeklyBonus
from app.models.settings import SystemSetting
from app.models.ledger import FinancialLedger, LedgerEntryType, DailyLedgerSummary
from app.core.timezone_utils import (
    now_mmt, 
    get_tuesday_settlement_dates, 
    format_mmt
)

def calculate_and_distribute_weekly_bonus(db: Session = None) -> Dict[str, Any]:
    """
    Automated Batch Job: Runs EVERY TUESDAY AT 11:00 AM (MMT).
    
    1. Identifies the previous calendar week (Previous Monday 00:00 to Previous Sunday 23:59:59 MMT).
    2. Applicable STRICTLY to Normal Real Players (UserRole.USER, is_simulated == False, is_active == True).
       Agents, Admins, CS, and Bot Profiles are completely excluded.
    3. Checks qualifying condition: Bet >= 10,000 MMK on AT LEAST ONE draw day (Wed, Sat, Sun).
    4. If qualified: Calculates 10% Weekly Bonus on their total week's bets.
    5. Credits the 10% bonus directly to user's wallet balance.
    6. Records in WeeklyBonus table, FinancialLedger (WEEKLY_BONUS), and dispatches user notification.
    """
    close_db_at_end = False
    if db is None:
        db = SessionLocal()
        close_db_at_end = True

    try:
        current_time = now_mmt()
        prev_monday_str, prev_sunday_str, settle_tuesday_str = get_tuesday_settlement_dates(current_time)

        # Check if bonus already calculated for this week to prevent double-crediting
        existing_batch = db.query(WeeklyBonus).filter(
            WeeklyBonus.week_start_date == prev_monday_str,
            WeeklyBonus.week_end_date == prev_sunday_str
        ).first()

        if existing_batch and existing_batch.is_credited:
            return {
                "status": "already_processed",
                "message": f"Weekly bonus for {prev_monday_str} to {prev_sunday_str} was already settled on {existing_batch.settlement_date}.",
                "settlement_date": settle_tuesday_str,
                "qualified_players_count": 0,
                "total_bonus_distributed": 0.0
            }

        # Query all active REAL players only (Exclude Agents, Admins, CS, and Bot Simulators)
        players = db.query(User).filter(
            User.is_active == True,
            User.role == UserRole.USER,
            User.is_simulated == False,
            User.is_suspended == False
        ).all()
        
        # Load dynamic SystemSetting for rates & min qualifying bet
        sys_setting = db.query(SystemSetting).first()
        bonus_rate = (sys_setting.weekly_bonus_rate / 100.0) if sys_setting and sys_setting.weekly_bonus_rate is not None else settings.WEEKLY_BONUS_RATE
        min_qualifying_bet = float(sys_setting.weekly_bonus_min_bet) if sys_setting and sys_setting.weekly_bonus_min_bet is not None else settings.WEEKLY_BONUS_QUALIFYING_MIN_BET

        # The 3 official Singapore 4D draw dates in that calendar week (Monday to Sunday):
        # Wednesday is day 2, Saturday is day 5, Sunday is day 6
        monday_dt = datetime.strptime(prev_monday_str, "%Y-%m-%d")
        wed_date_str = (monday_dt + timedelta(days=2)).strftime("%Y-%m-%d")
        sat_date_str = (monday_dt + timedelta(days=5)).strftime("%Y-%m-%d")
        sun_date_str = (monday_dt + timedelta(days=6)).strftime("%Y-%m-%d")

        qualified_records: List[WeeklyBonus] = []
        total_bonus_distributed = 0.0

        for player in players:
            # Query bets placed by player for draws in previous week
            # Slips must not be VOID or CANCELLED
            slips = db.query(BetSlip).join(LotteryDraw).filter(
                BetSlip.user_id == player.id,
                BetSlip.status != BetSlipStatus.VOID,
                BetSlip.status != BetSlipStatus.CANCELLED,
                LotteryDraw.draw_date >= prev_monday_str,
                LotteryDraw.draw_date <= prev_sunday_str
            ).all()

            if not slips:
                continue

            # Group bets by draw day of week
            daily_bets = {}
            total_week_bets = 0.0

            for slip in slips:
                draw_date = slip.draw.draw_date
                daily_bets[draw_date] = daily_bets.get(draw_date, 0.0) + slip.total_stake
                total_week_bets += slip.total_stake

            # Strict Rule: Must play on Wednesday, Saturday, and Sunday without missing ANY day,
            # and MUST bet at least min_qualifying_bet (10,000 MMK) on EACH of those 3 days!
            wed_stake = float(daily_bets.get(wed_date_str, 0.0))
            sat_stake = float(daily_bets.get(sat_date_str, 0.0))
            sun_stake = float(daily_bets.get(sun_date_str, 0.0))

            wed_qualifies = wed_stake >= min_qualifying_bet
            sat_qualifies = sat_stake >= min_qualifying_bet
            sun_qualifies = sun_stake >= min_qualifying_bet

            is_qualified = (wed_qualifies and sat_qualifies and sun_qualifies)
            qualifying_days_count = (1 if wed_qualifies else 0) + (1 if sat_qualifies else 0) + (1 if sun_qualifies else 0)

            if is_qualified:
                total_qualifying_bets = wed_stake + sat_stake + sun_stake
                bonus_amount = round(total_qualifying_bets * bonus_rate, 2)
                
                # Credit to player balance
                player.balance += bonus_amount
                total_bonus_distributed += bonus_amount

                bonus_record = WeeklyBonus(
                    user_id=player.id,
                    week_start_date=prev_monday_str,
                    week_end_date=prev_sunday_str,
                    settlement_date=settle_tuesday_str,
                    wednesday_bet_total=wed_stake,
                    saturday_bet_total=sat_stake,
                    sunday_bet_total=sun_stake,
                    total_qualifying_bets=total_qualifying_bets,
                    qualifying_draw_days_count=3,
                    is_qualified=True,
                    bonus_rate=bonus_rate,
                    bonus_amount=bonus_amount,
                    is_credited=True,
                    credited_at=current_time,
                    user_balance_after=player.balance,
                    notes=(
                        f"Qualified for 10% Weekly Bonus! "
                        f"Wed: {wed_stake:,.0f} Ks, Sat: {sat_stake:,.0f} Ks, Sun: {sun_stake:,.0f} Ks "
                        f"(Total: {total_qualifying_bets:,.0f} Ks, Bonus: {bonus_amount:,.0f} Ks)"
                    )
                )
                db.add(bonus_record)
                qualified_records.append(bonus_record)

                # Financial Ledger Entry
                ledger = FinancialLedger(
                    entry_type=LedgerEntryType.WEEKLY_BONUS,
                    amount=-bonus_amount, # expense
                    running_balance=player.balance,
                    reference_id=f"BONUS-{settle_tuesday_str}-{player.id}",
                    reference_type="BONUS",
                    description=f"10% Weekly Regular Player Bonus credited ({bonus_amount:,.0f} MMK for Wed/Sat/Sun 3-day active play)",
                    logged_at_mmt=current_time,
                    date_str=settle_tuesday_str
                )
                db.add(ledger)

                # Send In-App / Push Notification
                notif = Notification(
                    user_id=player.id,
                    title="🎉 ၁၀% အပတ်စဉ် ပုံမှန်ကစားသူ အပိုဆုကြေး ထည့်သွင်းပြီးပါပြီ!",
                    message=(
                        f"ဂုဏ်ယူပါသည်! ပြီးခဲ့သည့်တစ်ပတ်အတွင်း ဗုဒ္ဓဟူး၊ စနေ၊ တနင်္ဂနွေ (Wed, Sat, Sun) "
                        f"၃ ရက်စလုံး တစ်ရက်မှမပျက်ဘဲ တစ်ရက်လျှင် အနည်းဆုံး {min_qualifying_bet:,.0f} ကျပ်ပြည့်မီအောင် ပုံမှန်ကစားခဲ့သဖြင့် "
                        f"စုစုပေါင်းထိုးကြေး {total_qualifying_bets:,.0f} ကျပ်၏ {bonus_rate * 100:.0f}% ဖြစ်သော "
                        f"{bonus_amount:,.0f} ကျပ်အား သင်၏ လက်ကျန်ငွေထဲသို့ ပြန်အမ်းဆုငွေအဖြစ် ထည့်သွင်းပေးလိုက်ပါပြီ ခင်ဗျာ။"
                    ),
                    notif_type="WEEKLY_BONUS",
                    is_read=False
                )
                db.add(notif)

        # Update Daily Ledger Summary
        if total_bonus_distributed > 0:
            today_str = current_time.strftime("%Y-%m-%d")
            summary = db.query(DailyLedgerSummary).filter(DailyLedgerSummary.date_str == today_str).first()
            if summary:
                summary.total_weekly_bonuses += total_bonus_distributed
                summary.net_profit -= total_bonus_distributed
                summary.updated_at_mmt = current_time
            else:
                summary = DailyLedgerSummary(
                    date_str=today_str,
                    total_weekly_bonuses=total_bonus_distributed,
                    net_profit=-total_bonus_distributed,
                    updated_at_mmt=current_time
                )
                db.add(summary)

        db.commit()

        return {
            "status": "success",
            "settlement_date": settle_tuesday_str,
            "period": f"{prev_monday_str} to {prev_sunday_str}",
            "qualified_players_count": len(qualified_records),
            "total_bonus_distributed": total_bonus_distributed,
            "timestamp_mmt": format_mmt(current_time)
        }

    except Exception as e:
        db.rollback()
        return {
            "status": "error",
            "error": str(e)
        }
    finally:
        if close_db_at_end:
            db.close()


def settle_weekly_agent_commissions(db: Session = None) -> Dict[str, Any]:
    """
    Automated Batch Job: Runs EVERY TUESDAY AT 11:00 AM (MMT) (9:00 AM - 11:00 AM window).
    
    Rules:
    1. Evaluates all agents (role == AGENT).
    2. Sums all pending commission logs (is_settled == False).
    3. If Agent has outstanding debt (used_credit > 0 and settlement_status != 'PAID'):
       - Commission is WITHHELD / kept PENDING.
       - Agent's account is LOCKED from betting (is_betting_locked = True, settlement_status = 'OVERDUE').
       - Send warning notification.
    4. If Agent has cleared debt (used_credit == 0 or settlement_status == 'PAID'):
       - Commission is credited to agent.balance.
       - is_settled set to True, settlement_status = 'SETTLED'.
       - Account unlocked (is_betting_locked = False).
       - Record in FinancialLedger and notify agent.
    """
    close_db_at_end = False
    if db is None:
        db = SessionLocal()
        close_db_at_end = True

    try:
        current_time = now_mmt()
        prev_monday_str, prev_sunday_str, settle_tuesday_str = get_tuesday_settlement_dates(current_time)
        today_str = current_time.strftime("%Y-%m-%d")

        agents = db.query(User).filter(User.role == UserRole.AGENT, User.is_active == True).all()

        total_settled_commission = 0.0
        total_withheld_commission = 0.0
        settled_agents_count = 0
        locked_agents_count = 0
        details = []

        for agent in agents:
            # Query all un-settled commissions
            pending_logs = db.query(AgentCommissionLog).filter(
                AgentCommissionLog.agent_id == agent.id,
                AgentCommissionLog.is_settled == False
            ).all()

            pending_sum = sum(c.commission_amount for c in pending_logs)

            # Check if agent has unpaid debt
            has_unpaid_debt = (agent.used_credit or 0.0) > 0 and agent.settlement_status != "PAID"

            if has_unpaid_debt:
                # Debt unpaid -> Lock betting and withhold commission
                agent.is_betting_locked = True
                agent.settlement_status = "OVERDUE"
                locked_agents_count += 1
                total_withheld_commission += pending_sum

                for log in pending_logs:
                    log.settlement_status = "WITHHELD"
                    log.settlement_batch = f"WITHHELD-{settle_tuesday_str}"

                notif = Notification(
                    user_id=agent.id,
                    title="⚠️ အပတ်စဉ် စာရင်းရှင်းရန် ကျန်ရှိနေပါသည် (Weekly Settlement Overdue)",
                    message=(
                        f"သင်၏ မရှင်းရသေးသော အကြွေးကျန်ငွေ {agent.used_credit:,.0f} ကျပ် ကျန်ရှိနေပါသဖြင့် "
                        f"30% ကော်မရှင် {pending_sum:,.0f} ကျပ်ကို ထိန်းသိမ်းထားပြီး ထိုးခွင့်ယာယီပိတ်ထားပါသည် (Betting Locked)။ "
                        f"Admin ထံ စာရင်းရှင်းလင်းပြီးပါက ကော်မရှင်ချက်ချင်းထုတ်ပေးပြီး ထိုးခွင့်ပြန်ဖွင့်ပေးပါမည်။"
                    ),
                    notif_type="COMMISSION_WITHHELD",
                    is_read=False
                )
                db.add(notif)

                details.append({
                    "agent_id": agent.id,
                    "agent_name": agent.full_name,
                    "status": "LOCKED_WITHHELD",
                    "used_credit": agent.used_credit,
                    "withheld_commission": pending_sum
                })

            else:
                # Debt is clear or 0 -> Settle and credit commission
                if pending_sum > 0:
                    agent.balance += pending_sum
                    agent.total_commission_earned = (agent.total_commission_earned or 0.0) + pending_sum
                    total_settled_commission += pending_sum

                    for log in pending_logs:
                        log.is_settled = True
                        log.settled_at = current_time
                        log.settlement_batch = f"SETTLE-{settle_tuesday_str}"
                        log.settlement_status = "SETTLED"
                        log.agent_balance_after = agent.balance

                    # Record in Financial Ledger
                    comm_ledger = FinancialLedger(
                        entry_type=LedgerEntryType.AGENT_COMMISSION,
                        amount=-pending_sum,
                        running_balance=agent.balance,
                        reference_id=f"COMM-{settle_tuesday_str}-{agent.id}",
                        reference_type="AGENT_COMMISSION_SETTLEMENT",
                        description=f"30% Weekly Agent Commission settled for {agent.full_name} ({agent.agent_code})",
                        logged_at_mmt=current_time,
                        date_str=today_str
                    )
                    db.add(comm_ledger)

                    notif = Notification(
                        user_id=agent.id,
                        title="💰 အပတ်စဉ် 30% ကော်မရှင် ထုတ်ပေးပြီးပါပြီ!",
                        message=(
                            f"ဂုဏ်ယူပါသည်! ပြီးခဲ့သည့်တစ်ပတ်အတွက် 30% ကော်မရှင် {pending_sum:,.0f} ကျပ်အား "
                            f"အောင်မြင်စွာ ထုတ်ပေးလိုက်ပါပြီ။ လက်ကျန်ငွေထဲသို့ ထည့်သွင်းပေးပြီးဖြစ်ပါသည်။"
                        ),
                        notif_type="COMMISSION_SETTLED",
                        is_read=False
                    )
                    db.add(notif)

                agent.is_betting_locked = False
                agent.settlement_status = "SETTLED"
                agent.used_credit = 0.0
                settled_agents_count += 1

                details.append({
                    "agent_id": agent.id,
                    "agent_name": agent.full_name,
                    "status": "SETTLED",
                    "credited_commission": pending_sum,
                    "new_balance": agent.balance
                })

        db.commit()

        return {
            "status": "success",
            "settlement_date": settle_tuesday_str,
            "settled_agents_count": settled_agents_count,
            "locked_agents_count": locked_agents_count,
            "total_settled_commission": total_settled_commission,
            "total_withheld_commission": total_withheld_commission,
            "agents_summary": details,
            "timestamp_mmt": format_mmt(current_time)
        }

    except Exception as e:
        db.rollback()
        return {
            "status": "error",
            "error": str(e)
        }
    finally:
        if close_db_at_end:
            db.close()


def run_tuesday_weekly_settlement(db: Session = None) -> Dict[str, Any]:
    """
    Unified Tuesday 11:00 AM Settlement Pipeline:
    1. Distributes Player Weekly Bonus (Normal Players Only).
    2. Settles Agent Commissions & Enforces Debt Lock / Release.
    """
    bonus_result = calculate_and_distribute_weekly_bonus(db=db)
    agent_result = settle_weekly_agent_commissions(db=db)

    return {
        "status": "completed",
        "pipeline": "Tuesday 11:00 AM Weekly Settlement",
        "player_bonus": bonus_result,
        "agent_commission": agent_result
    }


def clear_agent_settlement_manually(agent_id: int, db: Session = None, admin_note: str = "") -> Dict[str, Any]:
    """
    Admin action: Called when an agent settles their cash/debt.
    - Clears agent.used_credit to 0.
    - Sets agent.is_betting_locked to False.
    - Sets agent.settlement_status to 'SETTLED'.
    - Releases any pending/withheld commission immediately to agent's balance.
    """
    close_db_at_end = False
    if db is None:
        db = SessionLocal()
        close_db_at_end = True

    try:
        agent = db.query(User).filter(User.id == agent_id, User.role == UserRole.AGENT).first()
        if not agent:
            return {"status": "error", "message": f"Agent ID {agent_id} not found."}

        current_time = now_mmt()
        today_str = current_time.strftime("%Y-%m-%d")

        # Find any pending or withheld commissions
        pending_logs = db.query(AgentCommissionLog).filter(
            AgentCommissionLog.agent_id == agent.id,
            AgentCommissionLog.is_settled == False
        ).all()

        released_comm = sum(c.commission_amount for c in pending_logs)
        old_debt = agent.used_credit or 0.0

        if released_comm > 0:
            agent.balance += released_comm
            agent.total_commission_earned = (agent.total_commission_earned or 0.0) + released_comm

            for log in pending_logs:
                log.is_settled = True
                log.settled_at = current_time
                log.settlement_status = "SETTLED"
                log.agent_balance_after = agent.balance
                log.settlement_batch = f"MANUAL-CLEAR-{today_str}"

            # Ledger entry
            comm_ledger = FinancialLedger(
                entry_type=LedgerEntryType.AGENT_COMMISSION,
                amount=-released_comm,
                running_balance=agent.balance,
                reference_id=f"COMM-MANUAL-{today_str}-{agent.id}",
                reference_type="AGENT_COMMISSION_SETTLEMENT",
                description=f"30% Agent Commission released upon manual debt clearance ({admin_note})",
                logged_at_mmt=current_time,
                date_str=today_str
            )
            db.add(comm_ledger)

        # Clear debt and unlock
        agent.used_credit = 0.0
        agent.is_betting_locked = False
        agent.settlement_status = "SETTLED"

        # Notify Agent
        notif = Notification(
            user_id=agent.id,
            title="✅ စာရင်းရှင်းလင်းပြီးဖြစ်၍ ထိုးခွင့်ပြန်ဖွင့်ပေးလိုက်ပါပြီ",
            message=(
                f"သင်၏ အပတ်စဉ် စာရင်း ({old_debt:,.0f} ကျပ်) အား Admin မှ အောင်မြင်စွာ ရှင်းလင်းပေးလိုက်ပါပြီ။ "
                f"ထိုးခွင့်ပြန်လည်ရရှိပြီဖြစ်ပြီး ဆိုင်းငံ့ကော်မရှင် {released_comm:,.0f} ကျပ်အား လက်ကျန်ငွေထဲသို့ ထည့်သွင်းပေးလိုက်ပါပြီ။"
            ),
            notif_type="SETTLEMENT_CLEARED",
            is_read=False
        )
        db.add(notif)

        db.commit()

        return {
            "status": "success",
            "agent_id": agent.id,
            "agent_name": agent.full_name,
            "cleared_debt": old_debt,
            "released_commission": released_comm,
            "new_balance": agent.balance,
            "is_betting_locked": agent.is_betting_locked,
            "settlement_status": agent.settlement_status
        }
    except Exception as e:
        db.rollback()
        return {"status": "error", "error": str(e)}
    finally:
        if close_db_at_end:
            db.close()
