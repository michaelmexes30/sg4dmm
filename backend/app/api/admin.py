from typing import Optional, List, Dict, Any
import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, Query, Body, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, desc

from app.database import get_db
from app.models.user import User, UserRole, AgentCommissionLog, Notification, AgentLevelLog
from app.models.transaction import Transaction, TransactionStatus, TransactionType
from app.models.bet import BetSlip, BetItem, BetArchive, BetSlipStatus, BetEditLog
from app.models.lottery import LotteryDraw, DrawStatus, TwoDDraw, ThreeDDraw
from app.models.transaction import TransactionArchive
from app.models.ledger import FinancialLedger, LedgerEntryType, DailyLedgerSummary
from app.models.bonus import WeeklyBonus
from app.models.settings import SystemSetting, ApplicationRelease
from app.core.security import get_current_admin, get_current_user, hash_password
from app.core.bonus_engine import (
    calculate_and_distribute_weekly_bonus,
    settle_weekly_agent_commissions,
    run_tuesday_weekly_settlement,
    clear_agent_settlement_manually
)
from datetime import datetime, timedelta
from app.config import settings
from app.core.timezone_utils import now_mmt, get_tuesday_settlement_dates, convert_to_mmt

router = APIRouter(prefix="/admin", tags=["Admin, Financial Ledger & Weekly Bonuses"])

@router.get("/financial-overview")
def get_financial_dashboard(
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Comprehensive 100% LIVE financial and operational business intelligence metrics:
    - Total deposits & withdrawals
    - Total payouts & bets volume
    - Total 30% Agent Commissions (settled vs pending)
    - Total 10% Weekly Bonuses distributed
    - Net profit / loss
    - Active Draw & Last Settled Draw spotlight
    - Registered players, active agents, and pending approvals
    """
    today_str = now_mmt().strftime("%Y-%m-%d")

    # All-time deposits
    total_deposits = db.query(func.coalesce(func.sum(Transaction.amount), 0.0)).filter(
        Transaction.tx_type == TransactionType.DEPOSIT,
        Transaction.status.in_([TransactionStatus.AUTO_APPROVED, TransactionStatus.COMPLETED])
    ).scalar() or 0.0

    today_deposits = db.query(func.coalesce(func.sum(Transaction.amount), 0.0)).filter(
        Transaction.tx_type == TransactionType.DEPOSIT,
        Transaction.status.in_([TransactionStatus.AUTO_APPROVED, TransactionStatus.COMPLETED]),
        func.date(Transaction.created_at) == today_str
    ).scalar() or 0.0

    # All-time withdrawals
    total_withdrawals = db.query(func.coalesce(func.sum(Transaction.amount), 0.0)).filter(
        Transaction.tx_type == TransactionType.WITHDRAWAL,
        Transaction.status == TransactionStatus.COMPLETED
    ).scalar() or 0.0

    today_withdrawals = db.query(func.coalesce(func.sum(Transaction.amount), 0.0)).filter(
        Transaction.tx_type == TransactionType.WITHDRAWAL,
        Transaction.status == TransactionStatus.COMPLETED,
        func.date(Transaction.created_at) == today_str
    ).scalar() or 0.0

    pending_deposits_count = db.query(func.count(Transaction.id)).filter(
        Transaction.tx_type == TransactionType.DEPOSIT,
        Transaction.status == TransactionStatus.MANUAL_REVIEW
    ).scalar() or 0

    pending_withdrawals_count = db.query(func.count(Transaction.id)).filter(
        Transaction.tx_type == TransactionType.WITHDRAWAL,
        Transaction.status == TransactionStatus.MANUAL_REVIEW
    ).scalar() or 0

    # All-time payouts
    total_payouts = db.query(func.coalesce(func.sum(BetSlip.total_payout), 0.0)).scalar() or 0.0

    # All-time bet volume & ticket counts
    total_bets = db.query(func.coalesce(func.sum(BetSlip.total_stake), 0.0)).scalar() or 0.0
    total_bets_count = db.query(func.count(BetSlip.id)).scalar() or 0

    today_bets = db.query(func.coalesce(func.sum(BetSlip.total_stake), 0.0)).filter(
        func.date(BetSlip.created_at) == today_str
    ).scalar() or 0.0
    today_bets_count = db.query(func.count(BetSlip.id)).filter(
        func.date(BetSlip.created_at) == today_str
    ).scalar() or 0

    # 30% Agent Commission (Settled vs Pending)
    total_commissions = db.query(func.coalesce(func.sum(AgentCommissionLog.commission_amount), 0.0)).filter(
        AgentCommissionLog.is_settled == True
    ).scalar() or 0.0

    pending_commissions = db.query(func.coalesce(func.sum(AgentCommissionLog.commission_amount), 0.0)).filter(
        AgentCommissionLog.is_settled == False
    ).scalar() or 0.0

    # All-time 10% Weekly Bonuses
    total_bonuses = db.query(func.coalesce(func.sum(WeeklyBonus.bonus_amount), 0.0)).filter(
        WeeklyBonus.is_credited == True
    ).scalar() or 0.0

    # Net profit = total_bets - (total_payouts + total_commissions + total_bonuses)
    total_net_profit = float(total_bets) - (float(total_payouts) + float(total_commissions) + float(total_bonuses))

    # Today's daily summary
    today_summary = db.query(DailyLedgerSummary).filter(DailyLedgerSummary.date_str == today_str).first()
    today_pay = today_summary.total_payouts if today_summary else 0.0
    today_comm = today_summary.total_agent_commissions if today_summary else 0.0
    today_bonus = today_summary.total_weekly_bonuses if today_summary else 0.0
    today_net = today_bets - today_pay - today_comm - today_bonus

    # Active pool
    active_pool = db.query(func.coalesce(func.sum(BetSlip.total_stake), 0.0)).filter(
        BetSlip.status == "PENDING"
    ).scalar() or 0.0

    # User / Agent counts
    total_registered_users = db.query(func.count(User.id)).filter(User.role == UserRole.USER, User.is_simulated == False).scalar() or 0
    total_agents_count = db.query(func.count(User.id)).filter(User.role == UserRole.AGENT).scalar() or 0
    total_customer_balance = db.query(func.coalesce(func.sum(User.balance), 0.0)).filter(User.role == UserRole.USER).scalar() or 0.0

    # Active open draw
    active_draw = (
        db.query(LotteryDraw)
        .filter(LotteryDraw.status == DrawStatus.OPEN, LotteryDraw.first_prize == None)
        .order_by(LotteryDraw.draw_date.asc(), LotteryDraw.id.asc())
        .first()
    )
    active_draw_data = None
    if active_draw:
        combos_covered = db.query(func.count(func.distinct(BetItem.number))).join(BetSlip).filter(BetSlip.draw_id == active_draw.id).scalar() or 0
        active_draw_data = {
            "id": active_draw.id,
            "draw_number": active_draw.draw_number,
            "draw_date": active_draw.draw_date,
            "draw_time_mmt": active_draw.draw_time_mmt or "04:30 PM MMT",
            "status": "OPEN",
            "total_staked": float(active_draw.total_pool_stake or 0.0),
            "combinations_covered": int(combos_covered),
            "closed_count": len(active_draw.closed_numbers)
        }

    # Last settled draw
    last_draw = (
        db.query(LotteryDraw)
        .filter(or_(LotteryDraw.status == DrawStatus.SETTLED, LotteryDraw.first_prize != None))
        .order_by(LotteryDraw.draw_date.desc(), LotteryDraw.id.desc())
        .first()
    )
    last_draw_data = None
    if last_draw:
        last_draw_data = {
            "id": last_draw.id,
            "draw_number": last_draw.draw_number,
            "draw_date": last_draw.draw_date,
            "first_prize": last_draw.first_prize or "-",
            "second_prize": last_draw.second_prize or "-",
            "third_prize": last_draw.third_prize or "-",
            "total_payout": float(last_draw.total_payout or 0.0),
            "total_staked": float(last_draw.total_pool_stake or 0.0)
        }

    # Master agent info
    master_agent = db.query(User).filter(User.role == UserRole.AGENT).first()
    master_agent_data = {
        "name": master_agent.full_name or "Daw Hla Hla",
        "code": master_agent.agent_code or "AGT8899",
        "phone": master_agent.phone or "-",
        "balance": float(master_agent.balance or 0.0),
        "commission_earned": float(master_agent.total_commission_earned or 0.0),
        "pending_commission": float(pending_commissions)
    } if master_agent else None

    # Recent 10 live bets placed
    recent_slips = (
        db.query(BetSlip, User)
        .join(User, BetSlip.user_id == User.id)
        .order_by(BetSlip.id.desc())
        .limit(10)
        .all()
    )
    recent_bets_data = [
        {
            "id": s.id,
            "slip_code": s.slip_code,
            "user_name": u.full_name or u.phone,
            "user_phone": u.phone,
            "total_stake": float(s.total_stake or 0.0),
            "total_payout": float(s.total_payout or 0.0),
            "status": s.status.value if hasattr(s.status, 'value') else str(s.status),
            "created_at": s.created_at.strftime("%d/%m/%Y %I:%M %p") if s.created_at else "-"
        }
        for s, u in recent_slips
    ]

    recent_ledger = db.query(FinancialLedger).order_by(FinancialLedger.id.desc()).limit(20).all()

    return {
        "total_deposits_all_time": float(total_deposits),
        "today_deposits": float(today_deposits),
        "total_withdrawals_all_time": float(total_withdrawals),
        "today_withdrawals": float(today_withdrawals),
        "pending_deposits_count": int(pending_deposits_count),
        "pending_withdrawals_count": int(pending_withdrawals_count),
        "total_payouts_all_time": float(total_payouts),
        "total_bets_all_time": float(total_bets),
        "total_bets_count": int(total_bets_count),
        "today_bets": float(today_bets),
        "today_bets_count": int(today_bets_count),
        "total_commissions_all_time": float(total_commissions),
        "pending_commissions_all_time": float(pending_commissions),
        "total_bonuses_all_time": float(total_bonuses),
        "total_net_profit": float(total_net_profit),
        "today_payouts": float(today_pay),
        "today_commissions": float(today_comm),
        "today_bonuses": float(today_bonus),
        "today_net_profit": float(today_net),
        "active_bets_pool": float(active_pool),
        "total_registered_users": int(total_registered_users),
        "total_agents_count": int(total_agents_count),
        "total_customer_balance": float(total_customer_balance),
        "active_draw": active_draw_data,
        "last_settled_draw": last_draw_data,
        "master_agent": master_agent_data,
        "recent_bets": recent_bets_data,
        "recent_transactions": [
            {
                "id": l.id,
                "entry_type": l.entry_type,
                "amount": l.amount,
                "running_balance": l.running_balance,
                "reference_id": l.reference_id,
                "reference_type": l.reference_type,
                "description": l.description,
                "logged_at_mmt": l.logged_at_mmt,
                "date_str": l.date_str
            } for l in recent_ledger
        ]
    }

@router.get("/dashboard-stats")
def get_dashboard_stats(
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    return get_financial_dashboard(admin_user=admin_user, db=db)

@router.get("/ledger-entries")
def get_ledger_entries(
    entry_type: Optional[str] = None,
    limit: int = 50,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(FinancialLedger)
    if entry_type:
        query = query.filter(FinancialLedger.entry_type == entry_type.upper())
    return query.order_by(FinancialLedger.id.desc()).limit(limit).all()

@router.get("/daily-summaries")
def get_daily_summaries(
    limit: int = 30,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    return db.query(DailyLedgerSummary).order_by(DailyLedgerSummary.date_str.desc()).limit(limit).all()

@router.get("/flagged-transactions")
def get_flagged_transactions(
    status_filter: Optional[str] = None,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(Transaction)
    if status_filter:
        query = query.filter(Transaction.status == status_filter)
    else:
        query = query.filter(Transaction.status.in_([
            TransactionStatus.MANUAL_REVIEW,
            TransactionStatus.FLAGGED_EXPIRED
        ]))
    return query.order_by(Transaction.id.desc()).all()

@router.post("/deposits/{tx_id}/revert")
def revert_deposit_transaction(
    tx_id: int,
    reason: str = Query(..., min_length=1),
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    try:
        tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
        if not tx:
            raise HTTPException(status_code=404, detail="Deposit transaction not found.")

        if tx.tx_type != TransactionType.DEPOSIT:
            raise HTTPException(status_code=400, detail="Transaction is not a deposit.")

        if tx.status == TransactionStatus.REVERTED:
            raise HTTPException(status_code=400, detail="This deposit has already been reverted.")

        if tx.status not in [TransactionStatus.AUTO_APPROVED, TransactionStatus.COMPLETED]:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot revert deposit with status '{tx.status}'. Only AUTO_APPROVED or COMPLETED deposits can be reverted."
            )

        user = db.query(User).filter(User.id == tx.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Associated player user not found.")

        now = now_mmt()
        today_str = now.strftime("%Y-%m-%d")
        admin_identifier = admin_user.nickname or admin_user.username or admin_user.phone or "Admin"

        # 1. Update Transaction Status and Notes
        old_status = tx.status
        tx.status = TransactionStatus.REVERTED
        tx.reviewed_by = admin_identifier
        tx.reviewed_at = now
        tx.verification_notes = f"{tx.verification_notes or ''} | [REVERTED at {now.strftime('%d/%m/%Y %I:%M %p')} by {admin_identifier}]: {reason.strip()}"

        # 2. Deduct credited amount from User Balance
        old_balance = user.balance
        user.balance = user.balance - tx.amount

        # 3. Record Financial Ledger Audit Entry
        ledger = FinancialLedger(
            entry_type=LedgerEntryType.ADJUSTMENT,
            amount=-float(tx.amount),
            running_balance=float(user.balance),
            reference_id=tx.transaction_id,
            reference_type="DEPOSIT_REVERT",
            description=f"Deposit Reverted by {admin_identifier} (-{tx.amount:,.0f} MMK from {user.phone}). Reason: {reason.strip()}",
            logged_at_mmt=now,
            date_str=today_str
        )
        db.add(ledger)

        # 4. Notify User in-app
        notif = Notification(
            user_id=user.id,
            title="⚠️ Deposit Transaction Reverted",
            message=f"Deposit #{tx.transaction_id} of {tx.amount:,.0f} MMK has been reverted by administrator ({admin_identifier}). Reason: {reason.strip()}. Wallet balance deducted by {tx.amount:,.0f} MMK.",
            notif_type="DEPOSIT_REVERTED",
            category="Deposit",
            is_read=False,
            created_at=now
        )
        db.add(notif)

        db.commit()

        return {
            "status": "success",
            "message": f"Deposit #{tx.transaction_id} successfully reverted.",
            "tx_id": tx.id,
            "reverted_amount": tx.amount,
            "old_balance": old_balance,
            "new_balance": user.balance,
            "new_status": "REVERTED",
            "reviewed_by": admin_identifier,
            "reason": reason.strip()
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction error: {str(e)}")

@router.post("/deposits/{tx_id}/restore")
@router.post("/deposits/{tx_id}/unrevert")
def restore_deposit_transaction(
    tx_id: int,
    reason: str = Query(..., min_length=1),
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    try:
        tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
        if not tx:
            raise HTTPException(status_code=404, detail="Deposit transaction not found.")

        if tx.tx_type != TransactionType.DEPOSIT:
            raise HTTPException(status_code=400, detail="Transaction is not a deposit.")

        if tx.status != TransactionStatus.REVERTED:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot restore transaction with status '{tx.status}'. Only REVERTED deposits can be restored."
            )

        user = db.query(User).filter(User.id == tx.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Associated player user not found.")

        now = now_mmt()
        today_str = now.strftime("%Y-%m-%d")
        admin_identifier = admin_user.nickname or admin_user.username or admin_user.phone or "Admin"

        # 1. Update Transaction Status and Notes back to COMPLETED
        old_status = tx.status
        tx.status = TransactionStatus.COMPLETED
        tx.reviewed_by = admin_identifier
        tx.reviewed_at = now
        tx.verification_notes = f"{tx.verification_notes or ''} | [RESTORED/UN-REVERTED at {now.strftime('%d/%m/%Y %I:%M %p')} by {admin_identifier}]: {reason.strip()}"

        # 2. Re-credit deposit amount back to User Balance
        old_balance = user.balance
        user.balance = user.balance + tx.amount

        # 3. Record Financial Ledger Audit Entry
        ledger = FinancialLedger(
            entry_type=LedgerEntryType.ADJUSTMENT,
            amount=float(tx.amount),
            running_balance=float(user.balance),
            reference_id=tx.transaction_id,
            reference_type="DEPOSIT_RESTORE",
            description=f"Deposit Restored (Undo Revert) by {admin_identifier} (+{tx.amount:,.0f} MMK to {user.phone}). Reason: {reason.strip()}",
            logged_at_mmt=now,
            date_str=today_str
        )
        db.add(ledger)

        # 4. Notify User in-app
        notif = Notification(
            user_id=user.id,
            title="✅ Deposit Transaction Restored",
            message=f"Deposit #{tx.transaction_id} of {tx.amount:,.0f} MMK has been restored by administrator ({admin_identifier}). {tx.amount:,.0f} MMK has been re-credited to your wallet. Reason: {reason.strip()}.",
            notif_type="DEPOSIT_RESTORED",
            category="Deposit",
            is_read=False,
            created_at=now
        )
        db.add(notif)

        db.commit()

        return {
            "status": "success",
            "message": f"Deposit #{tx.transaction_id} successfully restored and re-credited.",
            "tx_id": tx.id,
            "restored_amount": tx.amount,
            "old_balance": old_balance,
            "new_balance": user.balance,
            "new_status": "COMPLETED",
            "reviewed_by": admin_identifier,
            "reason": reason.strip()
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction error: {str(e)}")

@router.post("/resolve-transaction/{tx_id}")
def resolve_transaction(
    tx_id: int,
    action: str = Query(..., pattern="^(approve|reject|revert|restore|unrevert)$"),
    review_notes: Optional[str] = None,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if action == "revert":
        return revert_deposit_transaction(
            tx_id=tx_id,
            reason=review_notes or "Reverted by Admin",
            admin_user=admin_user,
            db=db
        )
    if action in ["restore", "unrevert"]:
        return restore_deposit_transaction(
            tx_id=tx_id,
            reason=review_notes or "Restored by Admin",
            admin_user=admin_user,
            db=db
        )

    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    if tx.status in [TransactionStatus.AUTO_APPROVED, TransactionStatus.COMPLETED]:
        raise HTTPException(status_code=400, detail="Transaction has already been approved.")

    now = now_mmt()
    today_str = now.strftime("%Y-%m-%d")

    user = db.query(User).filter(User.id == tx.user_id).first()
    if action == "approve":
        tx.status = TransactionStatus.COMPLETED
        tx.reviewed_by = admin_user.nickname or admin_user.username or admin_user.phone or "Admin"
        tx.reviewed_at = now
        tx.verification_notes = f"{tx.verification_notes} | Manually approved: {review_notes or ''}"

        if user:
            user.balance += tx.amount
            ledger = FinancialLedger(
                entry_type=LedgerEntryType.DEPOSIT,
                amount=tx.amount,
                running_balance=user.balance,
                reference_id=tx.transaction_id,
                reference_type="TRANSACTION",
                description=f"Manual Admin Approval Deposit via {tx.gateway.upper()} ({tx.amount:,.0f} MMK)",
                logged_at_mmt=now,
                date_str=today_str
            )
            db.add(ledger)

            notif = Notification(
                user_id=user.id,
                title="💳 ငွေသွင်းမှု အောင်မြင်ပါသည် (Deposit Approved)",
                message=f"သင့်ငွေသွင်းမှု {tx.amount:,.0f} MMK ({tx.gateway.upper()}) အား Admin မှ စိစစ်အတည်ပြုပြီး လက်ကျန်ငွေထဲ ထည့်သွင်းပေးလိုက်ပါပြီ။ လက်ကျန်ငွေ: {user.balance:,.0f} MMK။",
                category="Deposit",
                notif_type="TRANSACTION",
                is_read=False,
                created_at=now
            )
            db.add(notif)

            daily_summary = db.query(DailyLedgerSummary).filter(DailyLedgerSummary.date_str == today_str).first()
            if not daily_summary:
                daily_summary = DailyLedgerSummary(
                    date_str=today_str,
                    total_deposits=tx.amount,
                    net_profit=tx.amount,
                    total_transactions_count=1,
                    updated_at_mmt=now
                )
                db.add(daily_summary)
            else:
                daily_summary.total_deposits += tx.amount
                daily_summary.net_profit += tx.amount
                daily_summary.total_transactions_count += 1
                daily_summary.updated_at_mmt = now

        try:
            from app.core.telegram_bot import notify_finance_alert
            notify_finance_alert(
                db=db,
                tx_type="DEPOSIT",
                amount=tx.amount,
                user_phone=user.phone if user else "Unknown",
                user_name=user.nickname or user.full_name or user.username if user else "Player",
                gateway=tx.gateway,
                transaction_id=tx.transaction_id,
                status="COMPLETED",
                notes=f"Approved by {tx.reviewed_by} | {review_notes or ''}"
            )
        except Exception:
            pass
    else:
        tx.status = TransactionStatus.REJECTED
        tx.reviewed_by = admin_user.nickname or admin_user.username or admin_user.phone or "Admin"
        tx.reviewed_at = now
        tx.verification_notes = f"{tx.verification_notes} | Manually rejected: {review_notes or ''}"

        if user:
            notif = Notification(
                user_id=user.id,
                title="❌ ငွေသွင်းမှု ပယ်ချခံရပါသည် (Deposit Rejected)",
                message=f"သင့်ငွေသွင်းမှု {tx.amount:,.0f} MMK ({tx.gateway.upper()}) အား ပယ်ချလိုက်ပါသည်။ အကြောင်းရင်း: {review_notes or 'ငွေလွှဲအချက်အလက် မကိုက်ညီပါ။'}",
                category="Deposit",
                notif_type="TRANSACTION",
                is_read=False,
                created_at=now
            )
            db.add(notif)

        try:
            from app.core.telegram_bot import notify_finance_alert
            notify_finance_alert(
                db=db,
                tx_type="DEPOSIT",
                amount=tx.amount,
                user_phone=user.phone if user else "Unknown",
                user_name=user.nickname or user.full_name or user.username if user else "Player",
                gateway=tx.gateway,
                transaction_id=tx.transaction_id,
                status="REJECTED",
                notes=f"Rejected by {tx.reviewed_by} | {review_notes or ''}"
            )
        except Exception:
            pass

    db.commit()
    return {"status": "success", "tx_id": tx.id, "new_status": tx.status}

@router.post("/trigger-weekly-bonus")
def trigger_weekly_bonus_distribution(
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Triggers the Tuesday 11:00 AM Active Player Weekly Bonus Distribution on-demand.
    Strictly applies to normal real players (non-agents, non-bots).
    """
    res = calculate_and_distribute_weekly_bonus(db=db)
    return res

@router.post("/trigger-weekly-settlement")
def trigger_weekly_settlement_pipeline(
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Triggers the Tuesday 11:00 AM Unified Settlement Pipeline:
    - Normal Player Weekly Bonus (10%)
    - Agent Commission (30%) & Debt Lock / Settlement Enforcer
    """
    return run_tuesday_weekly_settlement(db=db)

class AgentCreditUpdateRequest(BaseModel):
    level: Optional[str] = None
    credit_limit: Optional[float] = None
    security_deposit: Optional[float] = None
    is_betting_locked: Optional[bool] = None

@router.post("/agents/{agent_id}/clear-settlement")
def admin_clear_agent_settlement(
    agent_id: int,
    note: str = Query("Admin manual settlement clearance", min_length=1),
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Admin action to clear an agent's weekly betting debt:
    - Resets used_credit to 0
    - Unlocks betting (is_betting_locked = False)
    - Releases any pending/withheld 30% commission directly into agent wallet balance
    """
    res = clear_agent_settlement_manually(agent_id=agent_id, db=db, admin_note=f"{note} (cleared by {admin_user.username})")
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message") or res.get("error"))
    return res

@router.post("/agents/{agent_id}/update-credit")
def update_agent_credit_settings(
    agent_id: int,
    req: AgentCreditUpdateRequest,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    agent = db.query(User).filter(User.id == agent_id, User.role == UserRole.AGENT).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    
    if req.level:
        agent.level = req.level
    if req.credit_limit is not None:
        agent.credit_limit = req.credit_limit
    if req.security_deposit is not None:
        agent.security_deposit = req.security_deposit
    if req.is_betting_locked is not None:
        agent.is_betting_locked = req.is_betting_locked
    
    db.commit()
    db.refresh(agent)
    return {
        "status": "success",
        "agent_id": agent.id,
        "full_name": agent.full_name,
        "level": agent.level or "Level 1",
        "credit_limit": agent.credit_limit,
        "security_deposit": agent.security_deposit,
        "used_credit": agent.used_credit,
        "is_betting_locked": agent.is_betting_locked,
        "settlement_status": agent.settlement_status
    }

class CreateAgentRequest(BaseModel):
    full_name: str
    phone: str
    password: str
    username: Optional[str] = None
    agent_code: Optional[str] = None
    security_deposit: Optional[float] = 1000000.0
    credit_limit: Optional[float] = 3000000.0

@router.post("/agents")
def create_new_agent(
    req: CreateAgentRequest,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    import random
    clean_phone = req.phone.strip()
    existing = db.query(User).filter(or_(User.phone == clean_phone, User.username == (req.username or clean_phone))).first()
    if existing:
        raise HTTPException(status_code=400, detail="ဖုန်းနံပါတ် သို့မဟုတ် Username ရှိပြီးသား ဖြစ်နေပါသည် (Phone or username already exists).")

    agent_code = req.agent_code.strip().upper() if req.agent_code else f"AGT{random.randint(1000, 9999)}"
    existing_code = db.query(User).filter(User.agent_code == agent_code).first()
    if existing_code:
        raise HTTPException(status_code=400, detail=f"Agent code '{agent_code}' ရှိပြီးသား ဖြစ်နေပါသည် (Agent code already exists).")

    new_agent = User(
        username=req.username or clean_phone,
        phone=clean_phone,
        full_name=req.full_name.strip(),
        nickname=req.full_name.strip(),
        hashed_password=hash_password(req.password),
        role=UserRole.AGENT,
        agent_code=agent_code,
        security_deposit=req.security_deposit or 1000000.0,
        credit_limit=req.credit_limit or 3000000.0,
        used_credit=0.0,
        is_betting_locked=False,
        settlement_status="SETTLED",
        balance=0.0,
        is_active=True,
        is_suspended=False,
        is_simulated=False,
        created_at=now_mmt()
    )
    db.add(new_agent)
    db.commit()
    db.refresh(new_agent)

    return {
        "status": "success",
        "agent": {
            "id": new_agent.id,
            "full_name": new_agent.full_name,
            "phone": new_agent.phone,
            "agent_code": new_agent.agent_code,
            "security_deposit": new_agent.security_deposit,
            "credit_limit": new_agent.credit_limit,
            "used_credit": new_agent.used_credit,
            "is_betting_locked": new_agent.is_betting_locked,
            "settlement_status": new_agent.settlement_status
        }
    }

@router.get("/agents/{agent_id}/details")
def get_agent_details_and_downline(
    agent_id: int,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Returns full details for a specific Agent:
    - Agent profile, deposit, credit limit, debt, lock status
    - Downline players list with their betting stats
    - Commission history for this agent
    """
    agent = db.query(User).filter(User.id == agent_id, User.role == UserRole.AGENT).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    # Downline players registered under this agent's referral code or agent_id (REAL PLAYERS ONLY)
    downline_players_query = db.query(User).filter(
        or_(User.agent_id == agent.id, User.referred_by_code == agent.agent_code),
        User.is_simulated == False,
        User.role == UserRole.USER
    ).order_by(User.id.desc()).all()

    downline_data = []
    for p in downline_players_query:
        bet_stats = db.query(
            func.count(BetSlip.id).label("bet_count"),
            func.coalesce(func.sum(BetSlip.total_stake), 0.0).label("total_staked"),
            func.coalesce(func.sum(BetSlip.total_payout), 0.0).label("total_payout"),
            func.max(BetSlip.created_at).label("last_bet_time")
        ).filter(BetSlip.user_id == p.id).first()

        downline_data.append({
            "id": p.id,
            "full_name": p.full_name or p.nickname or "Player",
            "phone": p.phone,
            "balance": float(p.balance or 0.0),
            "is_active": bool(p.is_active),
            "is_suspended": bool(p.is_suspended),
            "is_simulated": bool(p.is_simulated),
            "joined_at": p.created_at.strftime("%d/%m/%Y %I:%M %p") if p.created_at else "-",
            "total_bets_count": int(bet_stats.bet_count or 0),
            "total_staked": float(bet_stats.total_staked or 0.0),
            "total_payout": float(bet_stats.total_payout or 0.0),
            "last_bet_time": bet_stats.last_bet_time.strftime("%d/%m/%Y %I:%M %p") if bet_stats.last_bet_time else "-"
        })

    # Commission logs specifically for this agent
    comm_logs = (
        db.query(AgentCommissionLog, User, BetSlip)
        .join(User, AgentCommissionLog.player_id == User.id)
        .outerjoin(BetSlip, AgentCommissionLog.bet_slip_id == BetSlip.id)
        .filter(AgentCommissionLog.agent_id == agent.id)
        .order_by(AgentCommissionLog.id.desc())
        .limit(100)
        .all()
    )

    comm_records = []
    for c, player, slip in comm_logs:
        comm_records.append({
            "id": c.id,
            "player_name": "Direct Self-Bet" if player.id == agent.id else (player.full_name or player.nickname or "Player"),
            "player_phone": player.phone,
            "is_self_bet": (player.id == agent.id),
            "voucher": slip.slip_code if slip else f"SLIP-{c.bet_slip_id}",
            "bet_total_stake": float(c.bet_total_stake),
            "commission_rate": f"{int((c.commission_rate or 0.15) * 100)}%",
            "commission_amount": float(c.commission_amount),
            "is_settled": bool(c.is_settled),
            "settlement_status": c.settlement_status or ("SETTLED" if c.is_settled else "PENDING"),
            "created_at": c.created_at.strftime("%d/%m/%Y %I:%M %p") if c.created_at else "-"
        })

    pending_comm = db.query(func.coalesce(func.sum(AgentCommissionLog.commission_amount), 0.0)).filter(
        AgentCommissionLog.agent_id == agent.id,
        AgentCommissionLog.is_settled == False
    ).scalar()

    settled_comm = db.query(func.coalesce(func.sum(AgentCommissionLog.commission_amount), 0.0)).filter(
        AgentCommissionLog.agent_id == agent.id,
        AgentCommissionLog.is_settled == True
    ).scalar()

    total_volume = db.query(func.coalesce(func.sum(AgentCommissionLog.bet_total_stake), 0.0)).filter(
        AgentCommissionLog.agent_id == agent.id
    ).scalar()

    available_credit = max(0.0, float(agent.credit_limit or 0.0) - float(agent.used_credit or 0.0))

    from app.core.agent_level import evaluate_and_update_agent_level
    lvl_info = evaluate_and_update_agent_level(agent, db)

    return {
        "agent": {
            "id": agent.id,
            "full_name": agent.full_name,
            "phone": agent.phone,
            "agent_code": agent.agent_code,
            "role": agent.role,
            "level": agent.level or "Tier 1",
            "level_number": lvl_info.get("level_number", 1),
            "balance": float(agent.balance or 0.0),
            "security_deposit": float(agent.security_deposit or 0.0),
            "credit_limit": float(agent.credit_limit or 0.0),
            "used_credit": float(agent.used_credit or 0.0),
            "available_credit": float(available_credit),
            "is_betting_locked": bool(agent.is_betting_locked),
            "settlement_status": agent.settlement_status or "SETTLED",
            "commission_rate": lvl_info.get("commission_rate_str", "15%"),
            "total_downline_players": len(downline_data),
            "total_volume_staked": float(total_volume or 0.0),
            "pending_commission": float(pending_comm or 0.0),
            "settled_commission": float(settled_comm or 0.0),
            "created_at": agent.created_at.strftime("%d/%m/%Y") if agent.created_at else "-"
        },
        "level_info": lvl_info,
        "downline_players": downline_data,
        "commissions": comm_records
    }

@router.post("/agents/{agent_id}/toggle-lock")
def toggle_agent_betting_lock(
    agent_id: int,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Toggle an agent's betting lock status manually from Admin.
    """
    agent = db.query(User).filter(User.id == agent_id, User.role == UserRole.AGENT).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    
    agent.is_betting_locked = not agent.is_betting_locked
    if agent.is_betting_locked:
        agent.settlement_status = "OVERDUE"
    else:
        agent.settlement_status = "SETTLED" if agent.used_credit <= 0 else "ACTIVE"
        
    db.commit()
    db.refresh(agent)
    return {
        "status": "success",
        "agent_id": agent.id,
        "is_betting_locked": agent.is_betting_locked,
        "settlement_status": agent.settlement_status
    }

@router.get("/weekly-bonuses")
def list_weekly_bonuses(
    limit: int = 50,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    bonuses = db.query(WeeklyBonus).order_by(WeeklyBonus.id.desc()).limit(limit).all()
    results = []
    for b in bonuses:
        player = db.query(User).filter(User.id == b.user_id).first()
        results.append({
            "id": b.id,
            "player_name": player.full_name if player else "Unknown",
            "player_phone": player.phone if player else "Unknown",
            "week_span": f"{b.week_start_date} to {b.week_end_date}",
            "qualifying_bets": b.total_qualifying_bets,
            "qualifying_days": b.qualifying_draw_days_count,
            "bonus_amount": b.bonus_amount,
            "is_credited": b.is_credited,
            "credited_at": b.credited_at.strftime("%d/%m/%Y %I:%M:%S %p") if b.credited_at else "-",
            "notes": b.notes
        })
    return results

@router.get("/weekly-bonuses/preview")
def get_weekly_bonuses_live_preview(
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    100% LIVE Preview of active regular players qualifying for Weekly Bonus:
    Checks bets placed for draws in the current qualification cycle.
    """
    current_time = now_mmt()
    prev_monday_str, prev_sunday_str, settle_tuesday_str = get_tuesday_settlement_dates(current_time)

    current_monday = current_time - timedelta(days=current_time.weekday())
    curr_monday_str = current_monday.strftime("%Y-%m-%d")
    curr_sunday_str = (current_monday + timedelta(days=6)).strftime("%Y-%m-%d")
    next_tuesday_str = (current_monday + timedelta(days=8)).strftime("%Y-%m-%d")

    setting = db.query(SystemSetting).first()
    bonus_rate = (setting.weekly_bonus_rate / 100.0) if setting and setting.weekly_bonus_rate else settings.WEEKLY_BONUS_RATE
    min_qualifying_bet = setting.weekly_bonus_min_bet if setting and setting.weekly_bonus_min_bet else settings.WEEKLY_BONUS_QUALIFYING_MIN_BET

    players = db.query(User).filter(
        User.role == UserRole.USER,
        User.is_active == True,
        User.is_simulated == False
    ).all()

    preview_players = []
    tot_estimated_bonus = 0.0
    tot_qualified_count = 0

    active_start_date = curr_monday_str
    active_end_date = curr_sunday_str
    target_settle_date = next_tuesday_str

    has_unsettled_prev = db.query(WeeklyBonus).filter(
        WeeklyBonus.week_start_date == prev_monday_str,
        WeeklyBonus.week_end_date == prev_sunday_str,
        WeeklyBonus.is_credited == True
    ).first() is None

    prev_slips_count = db.query(func.count(BetSlip.id)).join(LotteryDraw).filter(
        LotteryDraw.draw_date >= prev_monday_str,
        LotteryDraw.draw_date <= prev_sunday_str
    ).scalar() or 0

    if has_unsettled_prev and prev_slips_count > 0:
        active_start_date = prev_monday_str
        active_end_date = prev_sunday_str
        target_settle_date = settle_tuesday_str

    active_monday_dt = datetime.strptime(active_start_date, "%Y-%m-%d")
    wed_date_str = (active_monday_dt + timedelta(days=2)).strftime("%Y-%m-%d")
    sat_date_str = (active_monday_dt + timedelta(days=5)).strftime("%Y-%m-%d")
    sun_date_str = (active_monday_dt + timedelta(days=6)).strftime("%Y-%m-%d")

    for player in players:
        slips = db.query(BetSlip).join(LotteryDraw).filter(
            BetSlip.user_id == player.id,
            BetSlip.status != BetSlipStatus.VOID,
            BetSlip.status != BetSlipStatus.CANCELLED,
            LotteryDraw.draw_date >= active_start_date,
            LotteryDraw.draw_date <= active_end_date
        ).all()

        if not slips:
            continue

        daily_bets = {}
        total_week_bets = 0.0

        for s in slips:
            d_date = s.draw.draw_date
            daily_bets[d_date] = daily_bets.get(d_date, 0.0) + s.total_stake
            total_week_bets += s.total_stake

        wed_stake = float(daily_bets.get(wed_date_str, 0.0))
        sat_stake = float(daily_bets.get(sat_date_str, 0.0))
        sun_stake = float(daily_bets.get(sun_date_str, 0.0))

        wed_ok = wed_stake >= min_qualifying_bet
        sat_ok = sat_stake >= min_qualifying_bet
        sun_ok = sun_stake >= min_qualifying_bet

        is_qualified = (wed_ok and sat_ok and sun_ok)
        qualifying_days_count = (1 if wed_ok else 0) + (1 if sat_ok else 0) + (1 if sun_ok else 0)

        total_qualifying = (wed_stake + sat_stake + sun_stake) if is_qualified else 0.0
        estimated_bonus = round(total_qualifying * bonus_rate, 2) if is_qualified else 0.0

        if is_qualified:
            tot_qualified_count += 1
            tot_estimated_bonus += estimated_bonus

        preview_players.append({
            "id": player.id,
            "player_name": player.full_name or player.nickname or "Player",
            "player_phone": player.phone,
            "balance": float(player.balance or 0.0),
            "total_week_bets": float(total_week_bets),
            "wed_stake": wed_stake,
            "sat_stake": sat_stake,
            "sun_stake": sun_stake,
            "wed_ok": wed_ok,
            "sat_ok": sat_ok,
            "sun_ok": sun_ok,
            "qualifying_days_count": qualifying_days_count,
            "draw_days_breakdown": daily_bets,
            "is_qualified": is_qualified,
            "bonus_rate_percent": f"{bonus_rate * 100:.0f}%",
            "estimated_bonus": float(estimated_bonus),
            "min_bet_threshold": float(min_qualifying_bet)
        })

    preview_players.sort(key=lambda x: (x["is_qualified"], x["total_week_bets"]), reverse=True)

    return {
        "week_span": f"{active_start_date} to {active_end_date}",
        "settlement_date": target_settle_date,
        "bonus_rate_percent": f"{bonus_rate * 100:.0f}%",
        "min_qualifying_bet": float(min_qualifying_bet),
        "total_players_with_bets": len(preview_players),
        "total_qualified_players": tot_qualified_count,
        "total_estimated_bonus": float(tot_estimated_bonus),
        "players": preview_players
    }

class BonusRuleUpdateRequest(BaseModel):
    bonus_rate: Optional[float] = None
    min_qualifying_bet: Optional[float] = None

@router.get("/weekly-bonuses/rules")
def get_weekly_bonus_rules(
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    setting = db.query(SystemSetting).first()
    rate = setting.weekly_bonus_rate if setting and setting.weekly_bonus_rate is not None else 10.0
    min_bet = setting.weekly_bonus_min_bet if setting and setting.weekly_bonus_min_bet is not None else 10000.0
    return {
        "bonus_rate": float(rate),
        "min_qualifying_bet": float(min_bet),
        "schedule_day": "Tuesday",
        "schedule_time": "11:00 AM MMT",
        "qualifying_condition": f"တစ်ပတ်အတွင်း ဗုဒ္ဓဟူး၊ စနေ၊ တနင်္ဂနွေ (Wed, Sat, Sun) ၃ ရက်စလုံး တစ်ရက်မှမပျက်ဘဲ တစ်ရက်လျှင် အနည်းဆုံး {min_bet:,.0f} ကျပ် ထိုးရပါမည်။ (Must bet >= {min_bet:,.0f} MMK on all 3 draw days: Wed, Sat, Sun)",
        "target_audience": "Real active players (UserRole.USER) only. Agents and simulated bot accounts excluded."
    }

@router.post("/weekly-bonuses/rules")
def update_weekly_bonus_rules(
    req: BonusRuleUpdateRequest,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    setting = db.query(SystemSetting).first()
    if not setting:
        setting = SystemSetting()
        db.add(setting)

    if req.bonus_rate is not None:
        if req.bonus_rate < 0 or req.bonus_rate > 100:
            raise HTTPException(status_code=400, detail="Bonus rate must be between 0% and 100%.")
        setting.weekly_bonus_rate = req.bonus_rate

    if req.min_qualifying_bet is not None:
        if req.min_qualifying_bet < 0:
            raise HTTPException(status_code=400, detail="Minimum bet must be >= 0 MMK.")
        setting.weekly_bonus_min_bet = req.min_qualifying_bet

    setting.updated_at = now_mmt()
    db.commit()
    db.refresh(setting)

    return {
        "status": "success",
        "bonus_rate": float(setting.weekly_bonus_rate),
        "min_qualifying_bet": float(setting.weekly_bonus_min_bet),
        "message": "Weekly bonus rules updated successfully."
    }

@router.get("/agent-commissions")
def get_agent_commissions_summary(
    agent_id: Optional[int] = None,
    limit: int = 100,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    master_agent = db.query(User).filter(
        or_(User.role == UserRole.AGENT, User.agent_code == "AGT8899")
    ).first()

    from app.core.agent_level import get_agent_turnover_stats
    all_agents = db.query(User).filter(User.role == UserRole.AGENT).all()
    agents_list = []
    for ag in all_agents:
        turnover_stats = get_agent_turnover_stats(ag, db)
        ag_pending = db.query(func.coalesce(func.sum(AgentCommissionLog.commission_amount), 0.0)).filter(
            AgentCommissionLog.agent_id == ag.id,
            AgentCommissionLog.is_settled == False
        ).scalar()
        ag_settled = db.query(func.coalesce(func.sum(AgentCommissionLog.commission_amount), 0.0)).filter(
            AgentCommissionLog.agent_id == ag.id,
            AgentCommissionLog.is_settled == True
        ).scalar()
        downline_count = db.query(func.count(User.id)).filter(
            or_(User.agent_id == ag.id, User.referred_by_code == ag.agent_code),
            User.is_simulated == False,
            User.role == UserRole.USER
        ).scalar() or 0
        available_credit = max(0.0, float(ag.credit_limit or 0.0) - float(ag.used_credit or 0.0))

        agents_list.append({
            "id": ag.id,
            "agent_code": ag.agent_code or "AGT8899",
            "name": ag.full_name,
            "phone": ag.phone,
            "level": ag.level or "Level 1",
            "balance": float(ag.balance or 0.0),
            "security_deposit": float(ag.security_deposit or 0.0),
            "credit_limit": float(ag.credit_limit or 0.0),
            "used_credit": float(ag.used_credit or 0.0),
            "available_credit": float(available_credit),
            "is_betting_locked": bool(ag.is_betting_locked),
            "settlement_status": ag.settlement_status or "SETTLED",
            "downline_players_count": int(downline_count),
            "self_turnover": float(turnover_stats["self_turnover"]),
            "downline_turnover": float(turnover_stats["downline_turnover"]),
            "total_turnover": float(turnover_stats["total_turnover"]),
            "total_volume_staked": float(turnover_stats["total_turnover"]),
            "pending_commission": float(ag_pending),
            "settled_commission": float(ag_settled)
        })

    # Total commission stats across all agents
    total_pending_comm = db.query(func.coalesce(func.sum(AgentCommissionLog.commission_amount), 0.0)).filter(
        AgentCommissionLog.is_settled == False
    ).scalar()

    total_settled_comm = db.query(func.coalesce(func.sum(AgentCommissionLog.commission_amount), 0.0)).filter(
        AgentCommissionLog.is_settled == True
    ).scalar()

    total_staked = db.query(func.coalesce(func.sum(AgentCommissionLog.bet_total_stake), 0.0)).scalar()

    logs_query = (
        db.query(AgentCommissionLog, User, BetSlip)
        .join(User, AgentCommissionLog.player_id == User.id)
        .outerjoin(BetSlip, AgentCommissionLog.bet_slip_id == BetSlip.id)
    )

    if agent_id:
        logs_query = logs_query.filter(AgentCommissionLog.agent_id == agent_id)

    logs = (
        logs_query
        .order_by(AgentCommissionLog.id.desc())
        .limit(limit)
        .all()
    )

    records = []
    for c, player, slip in logs:
        agent = db.query(User).filter(User.id == c.agent_id).first()
        records.append({
            "id": c.id,
            "agent_id": c.agent_id,
            "agent_code": agent.agent_code if agent and agent.agent_code else "AGT8899",
            "agent_name": agent.full_name if agent else "Daw Hla Hla (Master Agent)",
            "player_name": "Direct Self-Bet" if player.id == c.agent_id else (player.full_name or player.nickname or "Player"),
            "player_phone": player.phone,
            "voucher": slip.slip_code if slip else f"SLIP-{c.bet_slip_id}",
            "bet_total_stake": float(c.bet_total_stake),
            "commission_rate": "30%",
            "commission_amount": float(c.commission_amount),
            "is_settled": bool(c.is_settled),
            "settlement_status": c.settlement_status or ("SETTLED" if c.is_settled else "PENDING"),
            "settlement_batch": c.settlement_batch or "-",
            "settled_at": c.settled_at.strftime("%d/%m/%Y %I:%M:%S %p") if c.settled_at else "-",
            "agent_balance_after": float(c.agent_balance_after),
            "created_at": c.created_at.strftime("%d/%m/%Y %I:%M:%S %p") if c.created_at else ""
        })

    return {
        "master_agent": {
            "id": master_agent.id if master_agent else None,
            "code": master_agent.agent_code if master_agent and master_agent.agent_code else "AGT8899",
            "name": master_agent.full_name if master_agent else "Daw Hla Hla (Master Agent)",
            "phone": master_agent.phone if master_agent else "09788888888",
            "balance": float(master_agent.balance) if master_agent else 1050000.0,
            "security_deposit": float(master_agent.security_deposit or 0.0) if master_agent else 1000000.0,
            "credit_limit": float(master_agent.credit_limit or 0.0) if master_agent else 3000000.0,
            "used_credit": float(master_agent.used_credit or 0.0) if master_agent else 0.0,
            "is_betting_locked": bool(master_agent.is_betting_locked) if master_agent else False,
            "settlement_status": master_agent.settlement_status if master_agent and master_agent.settlement_status else "SETTLED",
            "rate": "30%"
        },
        "agents": agents_list,
        "total_commission_paid": float(total_settled_comm),
        "total_commission_pending": float(total_pending_comm),
        "total_volume_staked": float(total_staked),
        "records": records
    }

@router.post("/trigger-archiving")
def run_archiving_task(
    retention_days: Optional[int] = 90,
    admin_user: User = Depends(get_current_admin)
):
    res = archive_old_records(retention_days=retention_days)
    return res

@router.get("/archive-stats")
def get_archive_stats(
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    active_bets = db.query(func.count(BetSlip.id)).scalar()
    archived_bets = db.query(func.count(BetArchive.id)).scalar()
    active_txs = db.query(func.count(Transaction.id)).scalar()
    archived_txs = db.query(func.count(TransactionArchive.id)).scalar()

    return {
        "active_bets_count": active_bets,
        "archived_bets_count": archived_bets,
        "active_transactions_count": active_txs,
        "archived_transactions_count": archived_txs,
        "retention_policy": "90 Days (3 Months)"
    }

# =========================================================================
# SALONE4D FEATURE PARITY MODULES
# =========================================================================

from app.models.lottery import LotteryDraw, DrawStatus
from app.models.bet import BetItem
import json

# 1. 4D GAME & HEATMAP DASHBOARD (Salone4D: /backend/game & Heatmap)
@router.get("/4d-games")
def get_4d_games(
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    draws = db.query(LotteryDraw).order_by(LotteryDraw.draw_date.desc()).limit(15).all()
    return draws

@router.get("/heatmap/{draw_id}")
@router.get("/4d/heatmap/{draw_id}")
def get_draw_heatmap(
    draw_id: int,
    search: Optional[str] = None,
    range_prefix: Optional[str] = None,
    min_stake: Optional[float] = None,
    limit: int = 1000,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    draw = db.query(LotteryDraw).filter(LotteryDraw.id == draw_id).first()
    if not draw:
        raise HTTPException(status_code=404, detail="Draw not found")
    
    # Query all bet items for this draw and expand box/roll combinations accurately
    raw_items = (
        db.query(
            BetItem.number, 
            BetItem.bet_type, 
            BetItem.big_amount, 
            BetItem.item_stake, 
            BetItem.combination_count, 
            BetItem.combinations_json
        )
        .join(BetSlip, BetItem.slip_id == BetSlip.id)
        .filter(BetSlip.draw_id == draw_id)
        .all()
    )

    number_map = {}
    for it in raw_items:
        bt_lower = (it.bet_type or "").lower()
        if bt_lower in ["box", "roll", "r", "s"] and it.combinations_json:
            try:
                combos = json.loads(it.combinations_json)
                per_combo = it.big_amount if it.big_amount > 0 else (it.item_stake / len(combos) if len(combos) > 0 else it.item_stake)
                for c in combos:
                    if c not in number_map:
                        number_map[c] = {"number": c, "total_staked": 0.0, "bet_count": 0}
                    number_map[c]["total_staked"] += float(per_combo)
                    number_map[c]["bet_count"] += 1
            except Exception:
                num = it.number
                if num not in number_map:
                    number_map[num] = {"number": num, "total_staked": 0.0, "bet_count": 0}
                number_map[num]["total_staked"] += float(it.item_stake)
                number_map[num]["bet_count"] += 1
        else:
            num = it.number
            if num not in number_map:
                number_map[num] = {"number": num, "total_staked": 0.0, "bet_count": 0}
            number_map[num]["total_staked"] += float(it.item_stake)
            number_map[num]["bet_count"] += 1

    all_items_dicts = sorted(number_map.values(), key=lambda x: x["total_staked"], reverse=True)
    total_pool = sum(it["total_staked"] for it in all_items_dicts)
    total_betted_count = len(all_items_dicts)
    hot_count = sum(1 for it in all_items_dicts if it["total_staked"] >= 5000.0)
    top_item = all_items_dicts[0] if all_items_dicts else None

    # Filtering for display
    display_items = all_items_dicts
    if search:
        s = search.strip()
        display_items = [it for it in display_items if s in it["number"]]
    if range_prefix is not None and range_prefix != "ALL":
        display_items = [it for it in display_items if it["number"].startswith(str(range_prefix))]
    if min_stake is not None:
        display_items = [it for it in display_items if float(it["total_staked"]) >= min_stake]

    sliced_items = display_items[:limit]

    items_data = [
        {
            "number": item["number"],
            "total_staked": float(item["total_staked"]),
            "bet_count": item["bet_count"],
            "is_hot": float(item["total_staked"]) >= 5000.0,
            "is_closed": item["number"] in draw.closed_numbers,
            "liability_first_prize": float(item["total_staked"]) * 2000.0
        }
        for item in sliced_items
    ]

    risk_stats = {
        "total_pool_staked": float(total_pool),
        "total_combinations_covered": total_betted_count,
        "coverage_percentage": round((total_betted_count / 10000.0) * 100, 2),
        "hot_numbers_count": hot_count,
        "max_staked_number": top_item["number"] if top_item else "0000",
        "max_staked_amount": float(top_item["total_staked"]) if top_item else 0.0,
        "max_potential_payout": float(top_item["total_staked"]) * 2000.0 if top_item else 0.0,
        "risk_limit_per_number": 11000.0,
        "total_closed_count": len(draw.closed_numbers)
    }

    return {
        "draw_id": draw.id,
        "draw_number": draw.draw_number,
        "draw_date": draw.draw_date,
        "status": draw.status,
        "closed_numbers": draw.closed_numbers,
        "betted_count": total_betted_count,
        "displayed_count": len(items_data),
        "total_filtered": len(display_items),
        "risk_stats": risk_stats,
        "numbers": items_data
    }

@router.post("/closed-numbers/add")
def add_closed_number(
    draw_id: int = Query(...),
    number: str = Query(..., min_length=4, max_length=4),
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    draw = db.query(LotteryDraw).filter(LotteryDraw.id == draw_id).first()
    if not draw:
        raise HTTPException(status_code=404, detail="Draw not found")
    
    closed = draw.closed_numbers
    if number not in closed:
        closed.append(number)
        draw.closed_numbers_json = json.dumps(closed)
        db.commit()
    
    return {"status": "success", "closed_numbers": closed}

@router.post("/closed-numbers/remove")
def remove_closed_number(
    draw_id: int = Query(...),
    number: str = Query(...),
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    draw = db.query(LotteryDraw).filter(LotteryDraw.id == draw_id).first()
    if not draw:
        raise HTTPException(status_code=404, detail="Draw not found")
    
    closed = [n for n in draw.closed_numbers if n != number]
    draw.closed_numbers_json = json.dumps(closed)
    db.commit()
    return {"status": "success", "closed_numbers": closed}

# 2. ALL BETS LIST & VOUCHER DETAILS (Salone4D: /backend/bet)
@router.get("/all-bets")
def get_all_bets(
    draw_id: Optional[int] = None,
    bet_number: Optional[str] = None,
    user_phone: Optional[str] = None,
    limit: int = 50,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(BetSlip)
    if draw_id:
        query = query.filter(BetSlip.draw_id == draw_id)
    if user_phone:
        u = db.query(User).filter(User.phone == user_phone).first()
        if u:
            query = query.filter(BetSlip.user_id == u.id)
    
    slips = query.order_by(BetSlip.id.desc()).limit(limit).all()
    out = []
    for s in slips:
        items = [
            {
                "number": it.number,
                "bet_type": it.bet_type,
                "amount": it.item_stake,
                "payout": it.item_payout,
                "is_won": it.is_won
            }
            for it in s.items
        ]
        if bet_number and not any(it["number"] == bet_number for it in items):
            continue
        out.append({
            "id": s.id,
            "slip_code": s.slip_code,
            "user_phone": s.user.phone if s.user else "Unknown",
            "draw_number": s.draw.draw_number if s.draw else "Unknown",
            "draw_date": s.draw.draw_date if s.draw else "Unknown",
            "total_stake": s.total_stake,
            "total_payout": s.total_payout,
            "agent_commission": s.agent_commission,
            "status": s.status,
            "created_at": s.created_at,
            "items": items
        })
    return out

# 3. TOP UP & WITHDRAW REQUESTS (Salone4D: /backend/balance/top-up & /backend/balance/withdraw)
@router.get("/top-ups")
def get_top_up_requests(
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(Transaction).filter(Transaction.tx_type == TransactionType.DEPOSIT)
    if status and status.upper() != "ALL":
        query = query.filter(Transaction.status == status.upper())
    
    txs = query.order_by(Transaction.id.desc()).limit(limit).all()
    
    results = []
    for t in txs:
        u_phone = t.user.phone if t.user else "Unknown"
        u_name = t.user.full_name or t.user.username if t.user else "Customer"
        
        if search:
            s = search.lower()
            if s not in u_phone.lower() and s not in u_name.lower() and s not in (t.transaction_id or "").lower():
                continue
                
        results.append({
            "id": t.id,
            "user_phone": u_phone,
            "user_name": u_name,
            "gateway": (t.gateway or "kpay").upper(),
            "transaction_id": t.transaction_id,
            "receiver_id": t.receiver_id,
            "amount": t.amount,
            "status": t.status,
            "slip_image_url": t.slip_image_url,
            "delta_minutes": t.delta_minutes,
            "is_time_valid": t.is_time_valid,
            "is_receiver_valid": t.is_receiver_valid,
            "verification_notes": t.verification_notes,
            "transferred_at_mmt": str(t.tx_timestamp_mmt) if t.tx_timestamp_mmt else (str(t.created_at) if t.created_at else "-"),
            "created_at": str(t.created_at) if t.created_at else "-",
            "reviewed_by": t.reviewed_by
        })
    return results

def calculate_company_monthly_net_profit(db: Session, ym: Optional[str] = None) -> Dict[str, Any]:
    if not ym:
        now_dt = now_mmt()
        ym = now_dt.strftime('%Y-%m')
        month_label = now_dt.strftime('%b')
        month_full_label = now_dt.strftime('%b %Y')
    else:
        try:
            parsed = datetime.strptime(ym, "%Y-%m")
            month_label = parsed.strftime('%b')
            month_full_label = parsed.strftime('%b %Y')
        except Exception:
            month_label = "Oct"
            month_full_label = "Oct 2026"

    start_dt = f"{ym}-01 00:00:00"
    end_dt = f"{ym}-31 23:59:59"

    # Total bets in month
    tot_bets = db.query(func.coalesce(func.sum(BetSlip.total_stake), 0.0)).filter(
        BetSlip.created_at >= start_dt,
        BetSlip.created_at <= end_dt
    ).scalar() or 0.0

    # Total 4D Payout in month (calculated by official Draw Date)
    tot_payout = (
        db.query(func.coalesce(func.sum(BetSlip.total_payout), 0.0))
        .join(LotteryDraw, BetSlip.draw_id == LotteryDraw.id)
        .filter(
            LotteryDraw.draw_date >= f"{ym}-01",
            LotteryDraw.draw_date <= f"{ym}-31",
            BetSlip.total_payout > 0
        )
        .scalar() or 0.0
    )

    # 30% Settled Agent Commission credited in month
    tot_comm = db.query(func.coalesce(func.sum(AgentCommissionLog.commission_amount), 0.0)).filter(
        AgentCommissionLog.is_settled == True,
        AgentCommissionLog.settled_at >= start_dt,
        AgentCommissionLog.settled_at <= end_dt
    ).scalar() or 0.0

    # 10% Weekly Bonus credited in month
    tot_bonus = db.query(func.coalesce(func.sum(WeeklyBonus.bonus_amount), 0.0)).filter(
        WeeklyBonus.is_credited == True,
        WeeklyBonus.credited_at >= start_dt,
        WeeklyBonus.credited_at <= end_dt
    ).scalar() or 0.0

    # Net Profit formula requested: Total Bets - Payout - 30% Commission - 10% Bonus
    net_profit = float(tot_bets) - float(tot_payout) - float(tot_comm) - float(tot_bonus)

    return {
        "company_balance": net_profit,
        "month_label": month_label,
        "month": month_full_label,
        "total_bets": float(tot_bets),
        "total_payout": float(tot_payout),
        "total_commission": float(tot_comm),
        "total_bonus": float(tot_bonus)
    }

@router.get("/company-balance")
def get_admin_company_balance(
    month: Optional[str] = None,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    return calculate_company_monthly_net_profit(db, ym=month)


# 4. APP USERS & AGENT COMMISSION TIERS (Salone4D: /backend/members/users)
@router.get("/users-list")
def get_users_list(
    role: Optional[str] = None,
    limit: int = 50,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role.upper())
    users = query.order_by(User.id.desc()).limit(limit).all()
    return [
        {
            "id": u.id,
            "username": u.username or u.full_name,
            "phone": u.phone,
            "full_name": u.full_name or "N/A",
            "balance": u.balance,
            "role": u.role,
            "agent_code": u.agent_code,
            "referred_by_code": u.referred_by_code,
            "display_agent_code": u.agent_code if u.role in [UserRole.AGENT, UserRole.ADMIN] else (u.referred_by_code or "-"),
            "commission_rate": "30%",
            "is_active": u.is_active,
            "created_at": u.created_at
        }
        for u in users
    ]

@router.post("/toggle-user-status/{user_id}")
def toggle_user_status(
    user_id: int,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target.is_active = not target.is_active
    db.commit()
    return {"status": "success", "user_id": target.id, "is_active": target.is_active}

# 5. FINANCIAL & DAILY 4D REPORTS (Salone4D: /backend/reports/financial & 4d-bet)
@router.get("/financial-statement")
def get_financial_statement(
    limit: int = 30,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    draws = db.query(LotteryDraw).order_by(LotteryDraw.draw_date.desc()).limit(limit).all()
    reports = []
    for d in draws:
        total_staked = db.query(func.coalesce(func.sum(BetSlip.total_stake), 0.0)).filter(BetSlip.draw_id == d.id).scalar()
        total_payout = db.query(func.coalesce(func.sum(BetSlip.total_payout), 0.0)).filter(BetSlip.draw_id == d.id).scalar()
        total_comm = db.query(func.coalesce(func.sum(BetSlip.agent_commission), 0.0)).filter(BetSlip.draw_id == d.id).scalar()
        net = float(total_staked) - (float(total_payout) + float(total_comm))
        reports.append({
            "draw_date": d.draw_date,
            "draw_number": d.draw_number,
            "total_bet_amount": float(total_staked),
            "total_payout": float(total_payout),
            "agent_cashback": float(total_comm),
            "first_prize": d.first_prize or "-",
            "second_prize": d.second_prize or "-",
            "third_prize": d.third_prize or "-",
            "net_profit": net,
            "status": d.status
        })
    return reports

# =========================================================================
# COMPREHENSIVE ADMIN PORTAL ENDPOINTS (Screenshots 1 to 16)
# =========================================================================

# ----------------- Pydantic Request Models -----------------
class ClosedNumberRequest(BaseModel):
    draw_date: Optional[str] = None
    draw_id: Optional[int] = None
    number: str
    reason: Optional[str] = None

class BalanceAdjustRequest(BaseModel):
    amount: float
    reason: str

class SystemUserCreate(BaseModel):
    username: str
    nickname: Optional[str] = None
    phone: Optional[str] = None
    role: str = "CUSTOMER_SERVICE"
    password: str = "admin123"
    agent_code: Optional[str] = None
    is_suspended: Optional[bool] = False

class SystemUserUpdate(BaseModel):
    nickname: Optional[str] = None
    role: Optional[str] = None
    is_suspended: Optional[bool] = None
    password: Optional[str] = None
    level: Optional[str] = None
    security_deposit: Optional[float] = None
    credit_limit: Optional[float] = None

class ManualAgentLevelUpRequest(BaseModel):
    target_level: int = Field(..., ge=1, le=5)
    security_deposit: Optional[float] = None
    credit_limit: Optional[float] = None
    reason: Optional[str] = "Manual Level Up by Admin"

class FakeUserCreate(BaseModel):
    nickname: str
    avatar_url: Optional[str] = None

class SystemSettingsUpdate(BaseModel):
    wave_phone: Optional[str] = None
    wave_name: Optional[str] = None
    wave_qr_url: Optional[str] = None
    kpay_phone: Optional[str] = None
    kpay_name: Optional[str] = None
    kpay_qr_url: Optional[str] = None
    
    # Timing
    bet_end_time: Optional[str] = None
    cutoff_time: Optional[str] = None
    result_confirm_time: Optional[str] = None
    result_time: Optional[str] = None
    
    # Risk & Limits
    max_amount_per_number: Optional[float] = None
    risk_cap: Optional[float] = None
    min_amount_per_bet: Optional[float] = None
    max_amount_per_bet: Optional[float] = None
    max_amount_per_slip: Optional[float] = None
    default_bet_amount: Optional[float] = None
    
    # Bonuses & Commissions
    consecutive_reward_percent: Optional[float] = None
    reward_percentage: Optional[float] = None
    weekly_bonus_rate: Optional[float] = None
    commission_rate: Optional[float] = None
    
    # Agent Level & Credit Multiplier settings
    agent_credit_multiplier: Optional[float] = None
    is_agent_credit_enabled: Optional[bool] = None
    agent_lvl1_deposit: Optional[float] = None
    agent_lvl2_deposit: Optional[float] = None
    agent_lvl3_deposit: Optional[float] = None
    agent_lvl4_deposit: Optional[float] = None
    agent_lvl5_deposit: Optional[float] = None
    agent_lvl2_target_turnover: Optional[float] = None
    agent_lvl3_target_turnover: Optional[float] = None
    agent_lvl4_target_turnover: Optional[float] = None
    agent_lvl5_target_turnover: Optional[float] = None

    # 4-Tier Agent Commission & Turnover settings
    agent_tier1_turnover: Optional[float] = None
    agent_tier1_commission: Optional[float] = None
    agent_tier2_turnover: Optional[float] = None
    agent_tier2_commission: Optional[float] = None
    agent_tier3_turnover: Optional[float] = None
    agent_tier3_commission: Optional[float] = None
    agent_tier4_turnover: Optional[float] = None
    agent_tier4_commission: Optional[float] = None

    # Finance Alert & Security Settings
    telegram_finance_group_id: Optional[str] = None
    auto_approve_max_amount: Optional[float] = None
    is_withdraw_hours_enabled: Optional[bool] = None

    # 2D Lottery Settings
    is_2d_enabled: Optional[bool] = None
    twod_payout_multiplier: Optional[float] = None
    twod_commission_rate: Optional[float] = None
    twod_min_bet: Optional[float] = None
    twod_max_bet: Optional[float] = None
    twod_max_risk_per_number: Optional[float] = None
    twod_morning_cutoff: Optional[str] = None
    twod_evening_cutoff: Optional[str] = None

    # 3D Lottery Settings
    is_3d_enabled: Optional[bool] = None
    threed_straight_payout: Optional[float] = None
    threed_tote_payout: Optional[float] = None
    threed_commission_rate: Optional[float] = None
    threed_min_bet: Optional[float] = None
    threed_max_bet: Optional[float] = None
    threed_max_risk_per_number: Optional[float] = None
    threed_draw_cutoff: Optional[str] = None

class ToggleAgentCreditRequest(BaseModel):
    enabled: Optional[bool] = None

class ApplicationReleaseCreate(BaseModel):
    name: str
    build_number: int
    version: str

class NotificationCreate(BaseModel):
    title: str
    body: Optional[str] = None
    category: str = "Announcement"
    user_id: Optional[int] = None

# ----------------- 1. 4D Game Monitor & Closed Numbers (Screenshot 1) -----------------
@router.get("/4d/game")
def get_4d_game_monitor(
    draw_date: Optional[str] = None,
    draw_id: Optional[int] = None,
    mode: Optional[str] = "live",
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if mode == "past":
        # Last 5 settled draws where results have come out
        past_draws = (
            db.query(LotteryDraw)
            .filter(
                or_(
                    LotteryDraw.status == DrawStatus.SETTLED,
                    LotteryDraw.first_prize != None
                )
            )
            .order_by(LotteryDraw.draw_date.desc(), LotteryDraw.id.desc())
            .limit(5)
            .all()
        )
        draws_to_show = past_draws
    else:
        # Only return open / upcoming draws where result has not come out yet
        from app.core.timezone_utils import get_upcoming_week_draws
        current_time = now_mmt()
        setting = db.query(SystemSetting).first()
        cutoff_str = setting.bet_end_time if setting and setting.bet_end_time else None
        result_str = setting.result_confirm_time if setting and setting.result_confirm_time else None
        upcoming = get_upcoming_week_draws(current_time, cutoff_time_str=cutoff_str, result_time_str=result_str)
        
        if upcoming:
            for item in upcoming:
                d = db.query(LotteryDraw).filter(LotteryDraw.draw_date == item["draw_date"]).first()
                if not d:
                    draw_num_seq = f"54{item['draw_date'].replace('-', '')[-4:]}/26"
                    d = LotteryDraw(
                        draw_number=draw_num_seq,
                        draw_date=item["draw_date"],
                        draw_time_mmt=item["draw_time_mmt"],
                        status=DrawStatus.OPEN,
                        total_pool_stake=0.0,
                        total_payout=0.0
                    )
                    db.add(d)
                    db.commit()
                    db.refresh(d)

        upcoming_dates = [item["draw_date"] for item in upcoming] if upcoming else []
        open_draws = (
            db.query(LotteryDraw)
            .filter(
                LotteryDraw.status == DrawStatus.OPEN,
                LotteryDraw.first_prize == None,
                LotteryDraw.draw_date.in_(upcoming_dates)
            )
            .order_by(LotteryDraw.draw_date.asc(), LotteryDraw.id.asc())
            .all()
        )

        draws_to_show = open_draws if open_draws else db.query(LotteryDraw).order_by(LotteryDraw.draw_date.desc()).limit(1).all()


    target_draw = None
    if draw_id:
        target_draw = db.query(LotteryDraw).filter(LotteryDraw.id == draw_id).first()
    elif draw_date:
        target_draw = db.query(LotteryDraw).filter(LotteryDraw.draw_date == draw_date).first()

    if not target_draw and draws_to_show:
        target_draw = draws_to_show[0]

    dates_list = []
    for d in draws_to_show:
        is_sel = (d.id == target_draw.id) if target_draw else False
        dates_list.append({
            "id": d.id,
            "draw_date": d.draw_date,
            "draw_number": d.draw_number,
            "status": d.status.value if hasattr(d.status, 'value') else str(d.status),
            "first_prize": d.first_prize or "-",
            "second_prize": d.second_prize or "-",
            "third_prize": d.third_prize or "-",
            "total_payout": float(d.total_payout or 0.0),
            "total_staked": float(d.total_pool_stake or 0.0),
            "is_active": is_sel
        })

    top_numbers = []
    total_staked = 0.0
    if target_draw:
        total_staked = target_draw.total_pool_stake or 0.0
        items = (
            db.query(BetItem.number, func.sum(BetItem.item_stake).label("total_amount"))
            .join(BetSlip, BetItem.slip_id == BetSlip.id)
            .filter(BetSlip.draw_id == target_draw.id)
            .group_by(BetItem.number)
            .order_by(desc("total_amount"))
            .limit(10)
            .all()
        )
        top_numbers = [{"number": it[0], "amount": float(it[1])} for it in items]

    closed_list = target_draw.closed_numbers if target_draw else []
    sys_setting = db.query(SystemSetting).first()
    company_balance = sys_setting.company_balance_oct if sys_setting else 4198200.0

    return {
        "mode": mode,
        "company_balance_oct": company_balance,
        "selected_draw": {
            "id": target_draw.id if target_draw else None,
            "draw_date": target_draw.draw_date if target_draw else "",
            "draw_number": target_draw.draw_number if target_draw else "",
            "status": target_draw.status.value if (target_draw and hasattr(target_draw.status, 'value')) else (str(target_draw.status) if target_draw else ""),
            "first_prize": target_draw.first_prize if target_draw else "-",
            "second_prize": target_draw.second_prize if target_draw else "-",
            "third_prize": target_draw.third_prize if target_draw else "-",
            "total_payout": float(target_draw.total_payout or 0.0) if target_draw else 0.0,
            "total_staked": float(total_staked),
            "percentage": f"{(float(total_staked) / 10000000.0 * 100):.2f}%" if total_staked else "0.00%",
            "closed_numbers": closed_list
        },
        "available_draws": dates_list,
        "top_bet_numbers": top_numbers,
        "sweep_summary": {"left": 47, "sold": 3}
    }

@router.post("/4d/closed-numbers")
def add_closed_number(
    req: ClosedNumberRequest,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(LotteryDraw)
    if req.draw_id:
        draw = query.filter(LotteryDraw.id == req.draw_id).first()
    elif req.draw_date:
        draw = query.filter(LotteryDraw.draw_date == req.draw_date).first()
    else:
        draw = query.filter(LotteryDraw.status == DrawStatus.OPEN).order_by(LotteryDraw.draw_date.asc()).first()
        if not draw:
            draw = query.order_by(LotteryDraw.draw_date.desc()).first()

    if not draw:
        raise HTTPException(status_code=404, detail="Draw not found")

    num = req.number.strip().zfill(4)
    closed = set(draw.closed_numbers)
    closed.add(num)
    import json
    draw.closed_numbers_json = json.dumps(list(closed))
    db.commit()
    return {"status": "success", "closed_numbers": list(closed), "draw_id": draw.id}

@router.delete("/4d/closed-numbers")
@router.delete("/4d/closed-numbers/{number}")
def remove_closed_number(
    number: str,
    draw_date: Optional[str] = None,
    draw_id: Optional[int] = None,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(LotteryDraw)
    if draw_id:
        draw = query.filter(LotteryDraw.id == draw_id).first()
    elif draw_date:
        draw = query.filter(LotteryDraw.draw_date == draw_date).first()
    else:
        draw = query.filter(LotteryDraw.status == DrawStatus.OPEN).order_by(LotteryDraw.draw_date.asc()).first()
        if not draw:
            draw = query.order_by(LotteryDraw.draw_date.desc()).first()

    if not draw:
        raise HTTPException(status_code=404, detail="Draw not found")

    closed = [n for n in draw.closed_numbers if n != number.strip()]
    import json
    draw.closed_numbers_json = json.dumps(closed)
    db.commit()
    return {"status": "success", "closed_numbers": list(closed), "draw_id": draw.id}

@router.get("/4d/number-audit/{number}")
def get_number_audit(
    number: str,
    draw_id: Optional[int] = None,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    num_str = number.strip().zfill(4)
    query = (
        db.query(BetItem, BetSlip, User, LotteryDraw)
        .join(BetSlip, BetItem.slip_id == BetSlip.id)
        .join(User, BetSlip.user_id == User.id)
        .join(LotteryDraw, BetSlip.draw_id == LotteryDraw.id)
        .filter(or_(BetItem.number == num_str, BetItem.combinations_json.contains(f'"{num_str}"')))
    )
    if draw_id:
        query = query.filter(BetSlip.draw_id == draw_id)

    items = query.order_by(BetItem.id.desc()).all()

    # Check if closed
    is_closed = False
    draw = None
    if draw_id:
        draw = db.query(LotteryDraw).filter(LotteryDraw.id == draw_id).first()
    elif items:
        draw = items[0][3]
    if draw:
        try:
            is_closed = num_str in (draw.closed_numbers or [])
        except Exception:
            is_closed = False

    bets_list = []
    total_staked = 0.0
    for bi, bs, u, d in items:
        bt_item_lower = (bi.bet_type or "").lower()
        if bt_item_lower in ["box", "roll", "r", "s"]:
            effective_stake = float(bi.big_amount) if (bi.big_amount and bi.big_amount > 0) else (float(bi.item_stake) / bi.combination_count if bi.combination_count and bi.combination_count > 0 else float(bi.item_stake))
        else:
            effective_stake = float(bi.item_stake)
        
        total_staked += effective_stake

        status_label = "Pending"
        if bs.status == BetSlipStatus.LOST:
            status_label = "Lost"
        elif bi.is_won > 0 or bs.status == BetSlipStatus.WON:
            status_label = "Won"

        bets_list.append({
            "id": bi.id,
            "slip_id": bs.id,
            "slip_code": bs.slip_code,
            "voucher": bs.slip_code,
            "player_phone": u.phone,
            "player_name": u.nickname or u.username or u.full_name or "VIP Player",
            "bet_type": bi.bet_type or "ordinary",
            "big_amount": float(bi.big_amount or 0.0),
            "small_amount": float(bi.small_amount or 0.0),
            "stake_amount": effective_stake,
            "slip_total_stake": float(bi.item_stake),
            "combination_count": bi.combination_count or 1,
            "payout": float(bi.item_payout or 0.0),
            "status": status_label,
            "draw_date": d.draw_date,
            "draw_number": d.draw_number,
            "created_at": bs.created_at.strftime("%d/%m/%Y %H:%M:%S") if bs.created_at else ""
        })

    return {
        "number": num_str,
        "is_closed": is_closed,
        "draw_id": draw_id,
        "draw_date": draw.draw_date if draw else None,
        "total_staked": total_staked,
        "bet_count": len(bets_list),
        "peak_liability": total_staked * 2000,
        "bets": bets_list
    }

# ----------------- 2. 4D Bet History Table (Screenshot 2) -----------------

def check_is_bet_editable(draw, slip):
    """
    Checks if a bet number is editable:
    - Must not be already settled or won/lost.
    - Bet cutoff is 4:30 PM MMT.
    - Editable until 5:45 PM MMT (or 6:00 PM MMT if 1st Wednesday of the month).
    - Results out and payment settled at 6:00 PM MMT.
    """
    if slip.status in [BetSlipStatus.WON, BetSlipStatus.LOST] or draw.status == DrawStatus.SETTLED or draw.first_prize is not None:
        return False, "ထီပေါက်စဉ် ထွက်ပြီး/ရှင်းတမ်းထုတ်ပြီး ဖြစ်၍ ပြင်ဆင်ခွင့် ပိတ်ထားပါသည် (Already settled)."

    curr_mmt = now_mmt()
    try:
        draw_dt = datetime.strptime(str(draw.draw_date).strip()[:10], "%Y-%m-%d").date()
    except Exception:
        draw_dt = None

    if draw_dt:
        if curr_mmt.date() > draw_dt:
            return False, "ယခုပွဲစဉ်သည် ကျင်းပပြီးစီးသွားပြီဖြစ်ပါသည် (Draw date has passed)."
        elif curr_mmt.date() == draw_dt:
            is_first_wed = (draw_dt.weekday() == 2 and draw_dt.day <= 7)
            # Editable until 5:45 PM MMT (or 6:00 PM MMT if 1st Wednesday)
            cutoff_hour = 18 if is_first_wed else 17
            cutoff_minute = 0 if is_first_wed else 45
            cutoff_time_str = "06:00 PM MMT" if is_first_wed else "05:45 PM MMT"

            if curr_mmt.hour > cutoff_hour or (curr_mmt.hour == cutoff_hour and curr_mmt.minute >= cutoff_minute):
                return False, f"ညနေ {cutoff_time_str} ပြင်ဆင်ခွင့် သတ်မှတ်ချိန် ကျော်လွန်သွားသဖြင့် ပြင်ဆင်ခွင့် ပိတ်ထားပါသည် (Editable until {cutoff_time_str} only)."

    return True, "Editable"


@router.get("/4d/bets")
def get_4d_bets_history(
    page: int = 1,
    limit: int = 100,
    page_size: Optional[int] = None,
    game_date: Optional[str] = None,
    nickname: Optional[str] = None,
    user_phone: Optional[str] = None,
    phone: Optional[str] = None,
    number: Optional[str] = None,
    status_filter: Optional[str] = None,
    status: Optional[str] = None,
    voucher: Optional[str] = None,
    is_edited: Optional[str] = None,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    import json
    actual_limit = page_size if page_size is not None else limit
    target_phone = user_phone or phone
    target_status = status_filter or status

    query = (
        db.query(BetItem, BetSlip, User, LotteryDraw)
        .join(BetSlip, BetItem.slip_id == BetSlip.id)
        .join(User, BetSlip.user_id == User.id)
        .join(LotteryDraw, BetSlip.draw_id == LotteryDraw.id)
    )
    if game_date:
        query = query.filter(LotteryDraw.draw_date.contains(game_date))
    if nickname:
        query = query.filter(or_(User.nickname.ilike(f"%{nickname}%"), User.full_name.ilike(f"%{nickname}%"), User.username.ilike(f"%{nickname}%")))
    if target_phone:
        query = query.filter(User.phone.contains(target_phone))
    if number:
        clean_num = number.strip()
        query = query.filter(or_(BetItem.number.contains(clean_num), BetItem.combinations_json.contains(clean_num)))
    if target_status and target_status.upper() != "ALL":
        if target_status.upper() in ["WIN", "WON"]:
            # Strictly actual winning bet items only!
            query = query.filter(BetItem.is_won > 0)
        elif target_status.upper() in ["LOSE", "LOST"]:
            query = query.filter(
                BetItem.is_won == 0,
                or_(
                    BetSlip.status == BetSlipStatus.LOST,
                    LotteryDraw.status == DrawStatus.SETTLED,
                    LotteryDraw.first_prize != None
                )
            )
        elif target_status.upper() in ["PENDING"]:
            query = query.filter(
                BetSlip.status == BetSlipStatus.PENDING,
                LotteryDraw.status == DrawStatus.OPEN,
                LotteryDraw.first_prize == None
            )
    # Edited number filter support
    edit_filter = (is_edited or "").strip().lower()
    if not edit_filter and target_status and target_status.upper() in ["EDITED", "EDIT"]:
        edit_filter = "true"

    if edit_filter in ["true", "1", "edited", "yes"]:
        query = query.filter(
            BetItem.edit_logs_json.isnot(None),
            BetItem.edit_logs_json != "[]",
            BetItem.edit_logs_json != ""
        )
    elif edit_filter in ["false", "0", "original", "no"]:
        query = query.filter(
            or_(
                BetItem.edit_logs_json.is_(None),
                BetItem.edit_logs_json == "[]",
                BetItem.edit_logs_json == ""
            )
        )

    if voucher:
        query = query.filter(BetSlip.slip_code.contains(voucher))

    if target_status and target_status.upper() in ["WIN", "WON"]:
        total_count = query.count()
    else:
        total_count = query.with_entities(func.sum(func.coalesce(BetItem.combination_count, 1))).scalar() or 0

    items = query.order_by(BetItem.id.desc()).offset((page - 1) * actual_limit).limit(actual_limit).all()

    results = []
    for bi, bs, u, d in items:
        unit_stake = float(bi.big_amount if (bi.big_amount and bi.big_amount > 0) else (bi.item_stake / (bi.combination_count or 1)))
        
        display_type = "Ordinary"
        bt_norm = (bi.bet_type or "").lower()
        if bt_norm in ["box", "r"]:
            display_type = "R"
        elif bt_norm in ["roll", "s"]:
            display_type = "S"
        elif bi.bet_type:
            display_type = bi.bet_type.capitalize()

        combos = []
        if bt_norm in ["box", "roll", "r", "s"] and bi.combinations_json:
            try:
                combos = json.loads(bi.combinations_json)
            except Exception:
                combos = [bi.number]
        else:
            combos = [bi.number]

        if bi.number in combos:
            ordered_combos = [bi.number] + [c for c in combos if c != bi.number]
        else:
            ordered_combos = combos

        if number:
            clean_num = number.strip()
            ordered_combos = [c for c in ordered_combos if clean_num in c]

        win_details = bi.win_details

        for idx, combo in enumerate(ordered_combos):
            is_combo_won = False
            combo_prize = "-"
            combo_payout = 0.0

            if bi.is_won > 0:
                for m in win_details:
                    w_num = m.get("winning_number") or bi.number
                    if w_num == combo:
                        is_combo_won = True
                        combo_payout += float(m.get("payout", 0.0))
                        tier_name = m.get("prize_tier", "Won")
                        combo_prize = tier_name

                if not is_combo_won and (combo == bi.number or len(ordered_combos) == 1):
                    is_combo_won = True
                    combo_payout = float(bi.item_payout or 0.0)
                    combo_prize = "Won"

            # When filtering specifically by WON, exclude non-winning numbers!
            if target_status and target_status.upper() in ["WIN", "WON"] and not is_combo_won:
                continue

            # When filtering specifically by LOST, exclude winning numbers!
            if target_status and target_status.upper() in ["LOSE", "LOST"] and is_combo_won:
                continue

            if is_combo_won:
                status_label = "Won"
            elif d.status == DrawStatus.SETTLED or d.first_prize is not None or bs.status in [BetSlipStatus.LOST, BetSlipStatus.WON]:
                status_label = "Lost"
            else:
                status_label = "Pending"

            is_editable, editable_reason = check_is_bet_editable(d, bs)
            edit_history = bi.edit_logs if hasattr(bi, 'edit_logs') else []

            if edit_filter in ["true", "1", "edited", "yes"] and len(edit_history) == 0:
                continue
            if edit_filter in ["false", "0", "original", "no"] and len(edit_history) > 0:
                continue

            results.append({
                "id": f"{bi.id}_{idx}",
                "item_id": bi.id,
                "slip_id": bs.id,
                "combo_index": idx,
                "game": d.draw_date,
                "draw_date": d.draw_date,
                "draw_number": d.draw_number,
                "nick_name": u.nickname or u.username or u.full_name or "Player",
                "nickname": u.nickname or u.username or u.full_name or "Player",
                "user": u.phone,
                "phone": u.phone,
                "number": combo,
                "base_number": bi.number,
                "bet_type": display_type,
                "input": display_type,
                "big_amount": unit_stake,
                "small_amount": float(bi.small_amount or 0.0),
                "amount": unit_stake,
                "stake_amount": unit_stake,
                "combination_count": 1,
                "per_unit_stake": unit_stake,
                "payout": combo_payout,
                "prize": combo_prize,
                "prize_tier": combo_prize,
                "status": status_label,
                "voucher": bs.slip_code,
                "voucher_code": bs.slip_code,
                "slip_code": bs.slip_code,
                "created_at": bs.created_at.strftime("%d/%m/%Y %H:%M:%S") if bs.created_at else "",
                "is_edited": len(edit_history) > 0,
                "edit_history": edit_history,
                "is_editable": is_editable,
                "editable_reason": editable_reason
            })

    return {
        "results": results,
        "bets": results,
        "total": total_count,
        "page": page,
        "limit": actual_limit,
        "page_size": actual_limit
    }


class EditBetNumberSchema(BaseModel):
    new_number: str
    combo_index: Optional[int] = 0
    note: Optional[str] = None

@router.put("/bets/{item_id}/edit-number")
def edit_bet_number(
    item_id: int,
    payload: EditBetNumberSchema,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Allows Admin to edit a bet's 4D number prior to draw settlement at 6:00 PM MMT (or 6:15 PM MMT on 1st Wednesday).
    Records an immutable audit log tracking:
    - Admin username / ID
    - Old 4D Number -> New 4D Number
    - Exact MMT timestamp
    - Optional note / reason
    Updates both backend and player frontend in realtime.
    """
    clean_num = payload.new_number.strip()
    if not clean_num.isdigit() or len(clean_num) != 4:
        raise HTTPException(
            status_code=400,
            detail="ထိုးဂဏန်းသည် ဂဏန်း ၄ လုံး (ဥပမာ: 1234, 0000 - 9999) ဖြစ်ရပါမည် ခင်ဗျာ။"
        )

    bi = db.query(BetItem).filter(BetItem.id == item_id).first()
    if not bi:
        raise HTTPException(status_code=404, detail=f"Bet Item #{item_id} not found.")

    bs = db.query(BetSlip).filter(BetSlip.id == bi.slip_id).first()
    if not bs:
        raise HTTPException(status_code=404, detail="Bet Slip not found.")

    d = db.query(LotteryDraw).filter(LotteryDraw.id == bs.draw_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Lottery draw not found.")

    # 1. Check time & settlement eligibility
    is_editable, reason = check_is_bet_editable(d, bs)
    if not is_editable:
        raise HTTPException(status_code=400, detail=reason)

    # 2. Check if new number is closed for this draw
    if clean_num in (d.closed_numbers or []):
        raise HTTPException(
            status_code=400,
            detail=f"ဂဏန်း '{clean_num}' သည် {d.draw_date} ပွဲစဉ်အတွက် ထိုးကြေးပိတ်ထားသော Closed Number ဖြစ်ပါသဖြင့် ပြောင်းလဲ၍မရပါခင်ဗျာ။"
        )

    old_number = bi.number
    
    # If the number is identical
    if old_number == clean_num and bi.combination_count <= 1:
        return {"status": "unchanged", "message": f"ထိုးဂဏန်းသည် {clean_num} အတိုင်း တူညီနေပါသည်။"}

    # 3. Update BetItem number & combinations
    combo_cnt = max(1, bi.combination_count or 1)
    unit_big = int(bi.big_amount if (bi.big_amount and bi.big_amount > 0) else ((bi.item_stake or 0) / combo_cnt))
    unit_small = int(bi.small_amount if (bi.small_amount and bi.small_amount > 0) else 0)

    # When modifying a bet item from the table:
    # If the bet item represents a single combination (combination_count <= 1),
    # update this specific number without expanding it into multiple combinations or duplicating permutations!
    if bi.combination_count <= 1:
        bi.number = clean_num
        bi.combinations_json = json.dumps([clean_num])
        bi.combination_count = 1
        bi.big_amount = float(unit_big)
        bi.small_amount = float(unit_small)
        bi.item_stake = float(unit_big + unit_small)
    else:
        # Multi-combination item: replace the combination at combo_index
        try:
            combos = json.loads(bi.combinations_json) if bi.combinations_json else [bi.number]
        except Exception:
            combos = [bi.number]
        target_idx = payload.combo_index if payload.combo_index is not None and 0 <= payload.combo_index < len(combos) else 0
        combos[target_idx] = clean_num
        if target_idx == 0:
            bi.number = clean_num
        bi.combinations_json = json.dumps(combos)
        bi.combination_count = len(combos)
        bi.big_amount = float(unit_big)
        bi.small_amount = float(unit_small)
        bi.item_stake = float((unit_big + unit_small) * len(combos))

    # Recalculate slip total stake
    all_slip_items = db.query(BetItem).filter(BetItem.slip_id == bs.id).all()
    bs.total_stake = sum(float(item.item_stake or 0.0) for item in all_slip_items)

    # 4. Audit Log
    admin_name = admin_user.nickname or admin_user.username or admin_user.full_name or "Admin"
    now_ts = now_mmt()
    log_entry = {
        "admin_id": admin_user.id,
        "admin_name": admin_name,
        "old_number": old_number,
        "new_number": clean_num,
        "changed_at": now_ts.strftime("%d/%m/%Y %I:%M:%S %p"),
        "note": payload.note or "Admin manual modification"
    }

    existing_logs = []
    try:
        if getattr(bi, "edit_logs_json", None):
            existing_logs = json.loads(bi.edit_logs_json)
    except Exception:
        existing_logs = []
    existing_logs.append(log_entry)

    try:
        bi.edit_logs_json = json.dumps(existing_logs)
    except Exception:
        pass

    # Ensure bet_edit_logs table exists and persist
    from app.database import engine
    from sqlalchemy import text
    try:
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS bet_edit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    slip_id INTEGER NOT NULL,
                    bet_item_id INTEGER NOT NULL,
                    old_number VARCHAR(10) NOT NULL,
                    new_number VARCHAR(10) NOT NULL,
                    admin_id INTEGER NOT NULL,
                    admin_name VARCHAR(100) NOT NULL,
                    note VARCHAR(255),
                    created_at DATETIME
                )
            """))
            try:
                conn.execute(text("ALTER TABLE bet_items ADD COLUMN edit_logs_json TEXT DEFAULT '[]'"))
            except Exception:
                pass
    except Exception as ddl_err:
        print(f"Notice ensuring bet_edit_logs schema: {ddl_err}")

    try:
        db_log = BetEditLog(
            slip_id=bs.id,
            bet_item_id=bi.id,
            old_number=old_number,
            new_number=clean_num,
            admin_id=admin_user.id,
            admin_name=admin_name,
            note=payload.note or "Admin manual modification",
            created_at=now_ts
        )
        db.add(db_log)
    except Exception as log_err:
        print(f"Notice adding db_log: {log_err}")

    try:
        db.commit()
        db.refresh(bi)
        db.refresh(bs)
    except Exception as commit_err:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Database update failed: {str(commit_err)}")

    return {
        "status": "success",
        "message": f"ထိုးဂဏန်းအား '{old_number}' မှ '{clean_num}' သို့ အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။",
        "item_id": bi.id,
        "slip_id": bs.id,
        "old_number": old_number,
        "new_number": clean_num,
        "admin_name": admin_name,
        "changed_at": log_entry["changed_at"],
        "edit_history": existing_logs
    }

@router.get("/bets/edit-logs")
def get_all_bet_edit_logs(
    page: int = 1,
    limit: int = 50,
    slip_code: Optional[str] = None,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Returns the full audit trail of all bet number modifications made by admins."""
    query = db.query(BetEditLog, BetSlip, User).join(BetSlip, BetEditLog.slip_id == BetSlip.id).join(User, BetEditLog.admin_id == User.id)
    if slip_code:
        query = query.filter(BetSlip.slip_code.contains(slip_code))
    
    total = query.count()
    logs = query.order_by(BetEditLog.id.desc()).offset((page - 1) * limit).limit(limit).all()

    results = []
    for log, slip, admin in logs:
        results.append({
            "id": log.id,
            "slip_id": log.slip_id,
            "slip_code": slip.slip_code,
            "bet_item_id": log.bet_item_id,
            "old_number": log.old_number,
            "new_number": log.new_number,
            "admin_id": log.admin_id,
            "admin_name": log.admin_name,
            "note": log.note,
            "created_at": log.created_at.strftime("%d/%m/%Y %I:%M:%S %p") if log.created_at else ""
        })

    return {
        "results": results,
        "total": total,
        "page": page,
        "limit": limit
    }




# ----------------- 3. Balance Withdrawals (Screenshots 3, 4, 5) -----------------
@router.get("/withdrawals")
def get_admin_withdrawals(
    page: int = 1,
    limit: int = 100,
    user_phone: Optional[str] = None,
    phone: Optional[str] = None,
    status_filter: Optional[str] = None,
    status: Optional[str] = None,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    target_phone = user_phone or phone
    target_status = status_filter or status

    query = (
        db.query(Transaction, User)
        .join(User, Transaction.user_id == User.id)
        .filter(Transaction.tx_type == TransactionType.WITHDRAWAL)
    )
    if target_phone:
        query = query.filter(User.phone.contains(target_phone))
    if target_status and target_status.upper() != "ALL":
        if target_status.upper() in ["PENDING", "MANUAL_REVIEW"]:
            query = query.filter(Transaction.status == TransactionStatus.MANUAL_REVIEW)
        elif target_status.upper() in ["SUCCESS", "COMPLETED"]:
            query = query.filter(Transaction.status.in_([TransactionStatus.COMPLETED, TransactionStatus.AUTO_APPROVED]))
        elif target_status.upper() == "REJECTED":
            query = query.filter(Transaction.status == TransactionStatus.REJECTED)

    total_count = query.count()
    txs = query.order_by(Transaction.id.desc()).offset((page - 1) * limit).limit(limit).all()

    # Calculate global stats across all withdrawals
    all_wd = db.query(Transaction).filter(Transaction.tx_type == TransactionType.WITHDRAWAL).all()
    pending_list = [t for t in all_wd if t.status == TransactionStatus.MANUAL_REVIEW]
    success_list = [t for t in all_wd if t.status in [TransactionStatus.COMPLETED, TransactionStatus.AUTO_APPROVED]]
    rejected_list = [t for t in all_wd if t.status == TransactionStatus.REJECTED]

    stats = {
        "pending_count": len(pending_list),
        "pending_amount": float(sum(t.amount for t in pending_list)),
        "success_count": len(success_list),
        "success_amount": float(sum(t.amount for t in success_list)),
        "rejected_count": len(rejected_list),
        "rejected_amount": float(sum(t.amount for t in rejected_list)),
        "total_count": len(all_wd)
    }

    results = []
    for t, u in txs:
        status_label = "Pending"
        if t.status in [TransactionStatus.COMPLETED, TransactionStatus.AUTO_APPROVED]:
            status_label = "Success"
        elif t.status == TransactionStatus.REJECTED:
            status_label = "Rejected"

        results.append({
            "id": t.id,
            "user": u.phone,
            "phone": u.phone,
            "user_phone": u.phone,
            "nick_name": u.nickname or u.username or u.full_name,
            "nickname": u.nickname or u.username or u.full_name,
            "payment_method": t.gateway.upper() if t.gateway else "Kpay",
            "payment_provider": t.gateway.upper() if t.gateway else "Kpay",
            "payment_info": u.full_name,
            "account_name": t.receiver_id or u.phone,
            "account_number": t.receiver_id or u.phone,
            "current_balance": float(u.balance),
            "amount": float(t.amount),
            "status": status_label,
            "raw_status": t.status.value if hasattr(t.status, 'value') else str(t.status),
            "created_at": t.created_at.strftime("%d/%m/%Y %I:%M %p") if t.created_at else "",
            "approved_at": t.reviewed_at.strftime("%d/%m/%Y %I:%M %p") if t.reviewed_at else "-",
            "action_by": t.reviewed_by or "Mgnitoot",
            "verification_notes": t.verification_notes or ""
        })

    return {
        "results": results,
        "withdrawals": results,
        "total": total_count,
        "page": page,
        "limit": limit,
        "stats": stats
    }

class AcceptWithdrawalPayload(BaseModel):
    reference: Optional[str] = None
    note: Optional[str] = None

class RejectWithdrawalPayload(BaseModel):
    reason: Optional[str] = None

@router.post("/withdrawals/{tx_id}/accept")
def accept_withdrawal(
    tx_id: int,
    payload: Optional[AcceptWithdrawalPayload] = None,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx.status in [TransactionStatus.COMPLETED, TransactionStatus.AUTO_APPROVED]:
        raise HTTPException(status_code=400, detail="Already approved")

    user = db.query(User).filter(User.id == tx.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = now_mmt()
    tx.status = TransactionStatus.COMPLETED
    tx.reviewed_by = admin_user.username or admin_user.full_name or "Mgnitoot"
    tx.reviewed_at = now
    
    ref_str = payload.reference.strip() if (payload and payload.reference and payload.reference.strip()) else ""
    note_str = payload.note.strip() if (payload and payload.note and payload.note.strip()) else ""
    
    notes_parts = [f"Accept By {tx.reviewed_by}"]
    if ref_str:
        notes_parts.append(f"Ref: {ref_str}")
    if note_str:
        notes_parts.append(f"Note: {note_str}")
    tx.verification_notes = " | ".join(notes_parts)

    ref_msg = f" (လုပ်ငန်းစဥ်အမှတ်: {ref_str})" if ref_str else ""
    notif = Notification(
        user_id=user.id,
        title="✅ ငွေလွှဲပြောင်းမှု ပြီးစီးပါပြီ (Withdrawal Succeeded)",
        message=f"သင့်ငွေထုတ်ယူမှု {tx.amount:,.0f} MMK ကို {tx.gateway.upper()} အကောင့် ({tx.receiver_id}) သို့ အောင်မြင်စွာ လွှဲပြောင်းပေးအပ်ပြီးဖြစ်ပါသည်{ref_msg}။ SG4D Myanmar ကို အသုံးပြုသည့်အတွက် ကျေးဇူးတင်ပါသည်။",
        category="Withdraw",
        notif_type="TRANSACTION",
        is_read=False,
        created_at=now
    )
    db.commit()

    try:
        from app.core.telegram_bot import notify_finance_alert
        notify_finance_alert(
            db=db,
            tx_type="WITHDRAWAL",
            amount=tx.amount,
            user_phone=user.phone,
            user_name=user.nickname or user.full_name or user.username,
            gateway=tx.gateway,
            transaction_id=tx.transaction_id,
            status="COMPLETED",
            notes=f"Admin {tx.reviewed_by} မှ ငွေလွှဲပေးပြီးပါပြီ{ref_msg}"
        )
    except Exception as ex:
        pass

    return {"status": "success", "message": "Withdrawal accepted and user notified", "action_by": tx.reviewed_by, "reference": ref_str}

@router.post("/withdrawals/{tx_id}/reject")
def reject_withdrawal(
    tx_id: int,
    reason: Optional[str] = Query(None),
    payload: Optional[RejectWithdrawalPayload] = None,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx.status == TransactionStatus.REJECTED:
        raise HTTPException(status_code=400, detail="Already rejected")

    user = db.query(User).filter(User.id == tx.user_id).first()
    now = now_mmt()
    
    rejection_reason = (reason.strip() if (reason and reason.strip()) else "") or \
                       (payload.reason.strip() if (payload and payload.reason and payload.reason.strip()) else "") or \
                       "အချက်အလက် မှားယွင်းနေခြင်း (Invalid payment information)"

    tx.status = TransactionStatus.REJECTED
    tx.reviewed_by = admin_user.username or admin_user.full_name or "Mgnitoot"
    tx.reviewed_at = now
    tx.verification_notes = f"Rejected By {tx.reviewed_by}: {rejection_reason}"

    if user:
        # Auto refund balance
        user.balance += tx.amount
        ledger = FinancialLedger(
            entry_type=LedgerEntryType.ADJUSTMENT,
            amount=tx.amount,
            running_balance=user.balance,
            reference_id=tx.transaction_id,
            reference_type="WITHDRAWAL_REFUND",
            description=f"Withdrawal Rejected Refund by {tx.reviewed_by} ({tx.amount:,.0f} MMK to {user.phone}) - Reason: {rejection_reason}",
            logged_at_mmt=now,
            date_str=now.strftime("%Y-%m-%d")
        )
        db.add(ledger)

        notif = Notification(
            user_id=user.id,
            title="❌ ငွေထုတ်ပယ်ဖျက်ပြီး ပြန်အမ်းငွေထည့်သွင်းပြီး (Withdrawal Rejected & Refunded)",
            message=f"သင့်ငွေထုတ်ယူမှု {tx.amount:,.0f} MMK ({tx.gateway.upper()}) ကို ပယ်ဖျက်လိုက်ပါသည် (အကြောင်းပြချက်: {rejection_reason})။ နုတ်ယူထားသောငွေ {tx.amount:,.0f} MMK ကို သင့်အကောင့်ထဲသို့ အလိုအလျောက် ပြန်လည်ထည့်သွင်းပေးပြီးဖြစ်ပါသည်။",
            category="Withdraw",
            notif_type="TRANSACTION",
            is_read=False,
            created_at=now
        )
        db.add(notif)

    db.commit()

    if user:
        try:
            from app.core.telegram_bot import notify_finance_alert
            notify_finance_alert(
                db=db,
                tx_type="WITHDRAWAL",
                amount=tx.amount,
                user_phone=user.phone,
                user_name=user.nickname or user.full_name or user.username,
                gateway=tx.gateway,
                transaction_id=tx.transaction_id,
                status="REJECTED",
                notes=f"Admin {tx.reviewed_by} မှ ပယ်ချခဲ့သည်: {rejection_reason}"
            )
        except Exception as ex:
            pass

    return {
        "status": "success", 
        "message": f"Withdrawal rejected and {tx.amount:,.0f} MMK refunded to user wallet",
        "refunded_amount": tx.amount,
        "new_balance": user.balance if user else 0,
        "reason": rejection_reason
    }

@router.post("/withdrawals/{tx_id}/revert")
def revert_withdrawal(
    tx_id: int,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    user = db.query(User).filter(User.id == tx.user_id).first()
    now = now_mmt()

    if tx.status == TransactionStatus.REJECTED and user:
        user.balance = max(0.0, user.balance - tx.amount)

    tx.status = TransactionStatus.MANUAL_REVIEW
    operator = admin_user.username or admin_user.full_name or "Mgnitoot"
    tx.verification_notes = f"Revert By {operator}"
    tx.reviewed_at = None

    db.commit()
    return {"status": "success", "message": "Withdrawal reverted to Pending", "revert_by": operator}

# ----------------- 4. Members Management (Screenshots 6, 7, 8) -----------------
@router.get("/members/system-users")
def get_system_users(
    username: Optional[str] = None,
    nickname: Optional[str] = None,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(User).filter(User.role.in_([UserRole.ADMIN, UserRole.AGENT, UserRole.CUSTOMER_SERVICE]))
    if username:
        query = query.filter(User.username.contains(username))
    if nickname:
        query = query.filter(User.nickname.contains(nickname))
    users = query.order_by(User.id.asc()).all()
    
    setting = db.query(SystemSetting).first()
    is_credit_enabled = bool(setting.is_agent_credit_enabled) if setting and hasattr(setting, "is_agent_credit_enabled") else False

    res = []
    for u in users:
        lvl_num = 1
        if u.level:
            try:
                lvl_num = int(''.join(filter(str.isdigit, str(u.level))) or 1)
            except Exception:
                lvl_num = 1
        res.append({
            "id": u.id,
            "username": u.username or u.phone or u.full_name,
            "nickname": u.nickname or u.full_name or u.username,
            "phone": u.phone or "",
            "balance": float(u.balance or 0.0),
            "role": u.role.value if hasattr(u.role, 'value') else str(u.role),
            "level": u.level or "Level 1",
            "level_number": lvl_num,
            "security_deposit": float(u.security_deposit or 0.0),
            "credit_limit": float(u.credit_limit or 0.0),
            "used_credit": float(u.used_credit or 0.0),
            "available_credit": max(0.0, float((u.credit_limit or 0.0) - (u.used_credit or 0.0))),
            "agent_code": u.agent_code or "",
            "is_agent_credit_enabled": is_credit_enabled,
            "is_betting_locked": bool(u.is_betting_locked),
            "is_suspended": bool(u.is_suspended),
            "created_at": u.created_at.strftime("%d/%m/%Y %I:%M %p") if u.created_at else ""
        })
    return res

@router.post("/members/system-users/{user_id}/level-up")
def manual_agent_level_up(
    user_id: int,
    req: ManualAgentLevelUpRequest,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    agent = db.query(User).filter(User.id == user_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="User not found")
    if agent.role != UserRole.AGENT:
        raise HTTPException(status_code=400, detail="Only agents can have their agent level modified")

    setting = db.query(SystemSetting).first()
    if not setting:
        setting = SystemSetting()
        db.add(setting)
        db.flush()

    multiplier = float(setting.agent_credit_multiplier or 1.6)
    level_deposit_map = {
        1: float(setting.agent_lvl1_deposit or 100000.0),
        2: float(setting.agent_lvl2_deposit or 300000.0),
        3: float(setting.agent_lvl3_deposit or 500000.0),
        4: float(setting.agent_lvl4_deposit or 800000.0),
        5: float(setting.agent_lvl5_deposit or 1000000.0),
    }

    old_level = agent.level or "Level 1"
    old_deposit = float(agent.security_deposit or 0.0)
    old_credit = float(agent.credit_limit or 0.0)

    target_lvl_num = req.target_level
    default_dep = level_deposit_map.get(target_lvl_num, 100000.0)
    new_deposit = float(req.security_deposit) if req.security_deposit is not None else default_dep
    new_credit = float(req.credit_limit) if req.credit_limit is not None else (new_deposit * multiplier)
    new_level_str = f"Level {target_lvl_num}"

    # Update agent fields
    agent.level = new_level_str
    agent.security_deposit = new_deposit
    agent.credit_limit = new_credit

    # Record Audit Log in agent_level_logs
    admin_name = admin_user.username or admin_user.phone or "admin"
    reason_note = req.reason.strip() if req.reason else "Manual Level Up by Admin"
    
    level_log = AgentLevelLog(
        agent_id=agent.id,
        admin_id=admin_user.id,
        admin_username=admin_name,
        old_level=old_level,
        new_level=new_level_str,
        old_deposit=old_deposit,
        new_deposit=new_deposit,
        old_credit_limit=old_credit,
        new_credit_limit=new_credit,
        action_type="MANUAL_OVERRIDE",
        reason=reason_note,
        created_at=now_mmt()
    )
    db.add(level_log)

    # In-app notification for the Agent
    notif = Notification(
        user_id=agent.id,
        title=f"⭐ Agent {new_level_str} သို့ အဆင့်မြှင့်တင်ခံရပါသည်!",
        message=(
            f"Admin ({admin_name}) မှ သင့်အား {old_level} မှ {new_level_str} သို့ တိုးမြှင့်ပေးလိုက်ပါပြီ။ "
            f"စပေါ်ငွေ (Deposit): {new_deposit:,.0f} ကျပ်၊ "
            f"Credit Limit: {new_credit:,.0f} ကျပ် ({multiplier:.1f} ဆ) သို့ ပြင်ဆင်ပြီးဖြစ်ပါသည် ခင်ဗျာ။"
            f"{f' [မှတ်ချက်: {reason_note}]' if reason_note else ''}"
        ),
        category="Announcement",
        notif_type="AGENT_LEVEL_UP",
        is_read=False,
        created_at=now_mmt()
    )
    db.add(notif)

    db.commit()
    db.refresh(agent)
    db.refresh(level_log)

    return {
        "status": "success",
        "message": f"Successfully updated {agent.username} to {new_level_str}",
        "agent": {
            "id": agent.id,
            "username": agent.username,
            "nickname": agent.nickname,
            "phone": agent.phone,
            "level": agent.level,
            "level_number": target_lvl_num,
            "security_deposit": agent.security_deposit,
            "credit_limit": agent.credit_limit,
            "used_credit": agent.used_credit,
            "available_credit": max(0.0, float((agent.credit_limit or 0.0) - (agent.used_credit or 0.0)))
        },
        "log": {
            "id": level_log.id,
            "admin_username": admin_name,
            "old_level": old_level,
            "new_level": new_level_str,
            "old_deposit": old_deposit,
            "new_deposit": new_deposit,
            "old_credit_limit": old_credit,
            "new_credit_limit": new_credit,
            "reason": reason_note,
            "created_at": level_log.created_at.strftime("%d/%m/%Y %I:%M %p") if level_log.created_at else ""
        }
    }

@router.get("/members/system-users/level-logs")
def get_agent_level_logs(
    agent_id: Optional[int] = None,
    limit: int = 100,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = (
        db.query(AgentLevelLog, User)
        .join(User, AgentLevelLog.agent_id == User.id)
    )
    if agent_id:
        query = query.filter(AgentLevelLog.agent_id == agent_id)
        
    logs = query.order_by(AgentLevelLog.id.desc()).limit(limit).all()
    
    return [
        {
            "id": l.id,
            "agent_id": l.agent_id,
            "agent_name": u.nickname or u.full_name or u.username or "Agent",
            "agent_phone": u.phone or "",
            "agent_username": u.username or "",
            "admin_username": l.admin_username or "admin",
            "old_level": l.old_level,
            "new_level": l.new_level,
            "old_deposit": float(l.old_deposit or 0.0),
            "new_deposit": float(l.new_deposit or 0.0),
            "old_credit_limit": float(l.old_credit_limit or 0.0),
            "new_credit_limit": float(l.new_credit_limit or 0.0),
            "action_type": l.action_type,
            "reason": l.reason or "-",
            "created_at": l.created_at.strftime("%d/%m/%Y %I:%M %p") if l.created_at else ""
        }
        for l, u in logs
    ]

@router.post("/members/system-users")
def create_system_user(
    req: SystemUserCreate,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    import random
    # Check existing by username
    existing_u = db.query(User).filter(User.username == req.username.strip()).first()
    if existing_u:
        raise HTTPException(status_code=400, detail="Username already exists")

    # Handle phone
    phone_val = req.phone.strip() if req.phone and req.phone.strip() else None
    if phone_val:
        existing_p = db.query(User).filter(User.phone == phone_val).first()
        if existing_p:
            raise HTTPException(status_code=400, detail="Phone number already exists")
    else:
        # Generate clean dummy phone for system user if not provided
        while True:
            candidate = f"0979{random.randint(1000000, 9999999)}"
            if not db.query(User).filter(User.phone == candidate).first():
                phone_val = candidate
                break

    role_str = req.role.upper().strip()
    role_enum = UserRole.ADMIN if role_str == "ADMIN" else (UserRole.AGENT if role_str == "AGENT" else UserRole.CUSTOMER_SERVICE)

    agent_code = None
    deposit = 0.0
    credit = 0.0
    if role_enum == UserRole.AGENT:
        if req.agent_code and req.agent_code.strip():
            agent_code = req.agent_code.strip().upper()
        else:
            while True:
                candidate_code = f"AGT{random.randint(1000, 9999)}"
                if not db.query(User).filter(User.agent_code == candidate_code).first():
                    agent_code = candidate_code
                    break
        setting = db.query(SystemSetting).first()
        multiplier = float(setting.agent_credit_multiplier or 1.6) if setting else 1.6
        deposit = float(setting.agent_lvl1_deposit or 100000.0) if setting else 100000.0
        credit = deposit * multiplier

    u = User(
        username=req.username.strip(),
        nickname=req.nickname or req.username.strip(),
        full_name=(req.nickname or req.username).strip().capitalize(),
        phone=phone_val,
        hashed_password=hash_password(req.password),
        role=role_enum,
        agent_code=agent_code,
        level="Level 1" if role_enum == UserRole.AGENT else None,
        security_deposit=deposit,
        credit_limit=credit,
        used_credit=0.0,
        settlement_status="SETTLED",
        is_betting_locked=False,
        balance=10000.0,
        is_active=True,
        is_suspended=bool(req.is_suspended)
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return {
        "status": "success", 
        "id": u.id, 
        "username": u.username, 
        "role": str(u.role), 
        "agent_code": u.agent_code,
        "phone": u.phone
    }

@router.put("/members/system-users/{user_id}")
def update_system_user(
    user_id: int,
    req: SystemUserUpdate,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if req.nickname is not None:
        u.nickname = req.nickname
    if req.is_suspended is not None:
        u.is_suspended = req.is_suspended
    if req.role is not None:
        u.role = UserRole.ADMIN if req.role.lower() == "admin" else (UserRole.AGENT if req.role.lower() == "agent" else UserRole.CUSTOMER_SERVICE)
    if req.password:
        u.hashed_password = hash_password(req.password)
        
    if u.role == UserRole.AGENT:
        changed_lvl = req.level is not None and req.level != u.level
        changed_dep = req.security_deposit is not None and req.security_deposit != u.security_deposit
        changed_cred = req.credit_limit is not None and req.credit_limit != u.credit_limit
        if changed_lvl or changed_dep or changed_cred:
            old_lvl = u.level or "Level 1"
            old_dep = float(u.security_deposit or 0.0)
            old_cred = float(u.credit_limit or 0.0)
            
            if req.level is not None:
                u.level = req.level
            if req.security_deposit is not None:
                u.security_deposit = req.security_deposit
            if req.credit_limit is not None:
                u.credit_limit = req.credit_limit
                
            admin_name = admin_user.username or admin_user.phone or "admin"
            level_log = AgentLevelLog(
                agent_id=u.id,
                admin_id=admin_user.id,
                admin_username=admin_name,
                old_level=old_lvl,
                new_level=u.level,
                old_deposit=old_dep,
                new_deposit=float(u.security_deposit or 0.0),
                old_credit_limit=old_cred,
                new_credit_limit=float(u.credit_limit or 0.0),
                action_type="MANUAL_OVERRIDE",
                reason="System User edit by Admin",
                created_at=now_mmt()
            )
            db.add(level_log)

    db.commit()
    return {"status": "success", "id": u.id}

@router.get("/members/app-users")
def get_app_users(
    page: int = 1,
    limit: int = 100,
    nickname: Optional[str] = None,
    phone_number: Optional[str] = None,
    phone: Optional[str] = None,
    search: Optional[str] = None,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    # Strictly real players only (is_simulated == False)
    base_query = db.query(User).filter(User.role == UserRole.USER, User.is_simulated == False)
    all_real = base_query.all()
    
    total_balance = sum(float(u.balance) for u in all_real)
    active_count = sum(1 for u in all_real if not u.is_suspended)
    suspended_count = sum(1 for u in all_real if u.is_suspended)

    query = base_query
    target_phone = phone_number or phone
    if target_phone:
        query = query.filter(User.phone.contains(target_phone))
    if nickname:
        query = query.filter(or_(User.nickname.contains(nickname), User.full_name.contains(nickname)))
    if search:
        s = search.strip()
        query = query.filter(or_(
            User.phone.contains(s),
            User.username.contains(s),
            User.nickname.contains(s),
            User.full_name.contains(s)
        ))

    total = query.count()
    users = query.order_by(User.id.desc()).offset((page - 1) * limit).limit(limit).all()

    user_list = [
        {
            "id": u.id,
            "username": u.username,
            "phone": u.phone,
            "phone_number": u.phone,
            "nickname": u.nickname or u.username or u.full_name,
            "nick_name": u.nickname or u.username or u.full_name,
            "full_name": u.full_name or u.username,
            "balance": float(u.balance),
            "level": u.level or "Level 1",
            "commission": "Yes" if u.has_commission else "No",
            "has_commission": bool(u.has_commission),
            "is_suspended": bool(u.is_suspended),
            "created_at": u.created_at.strftime("%d/%m/%Y %I:%M %p") if u.created_at else ""
        } for u in users
    ]

    stats = {
        "total_real_players": len(all_real),
        "total_wallet_balance": float(total_balance),
        "active_players_count": active_count,
        "suspended_players_count": suspended_count
    }

    return {
        "results": user_list,
        "users": user_list,
        "total": total,
        "page": page,
        "limit": limit,
        "stats": stats
    }

@router.post("/members/app-users/{user_id}/toggle-status")
def toggle_app_user_status(
    user_id: int,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    u = db.query(User).filter(User.id == user_id, User.is_simulated == False).first()
    if not u:
        raise HTTPException(status_code=404, detail="Player not found")
    u.is_suspended = not u.is_suspended
    db.commit()
    return {"status": "success", "user_id": u.id, "is_suspended": bool(u.is_suspended)}

@router.post("/members/app-users/{user_id}/adjust-balance")
def adjust_app_user_balance(
    user_id: int,
    req: BalanceAdjustRequest,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    u = db.query(User).filter(User.id == user_id, User.is_simulated == False).first()
    if not u:
        raise HTTPException(status_code=404, detail="Player not found")
    
    if req.amount < 0 and u.balance < abs(req.amount):
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Player currently has {u.balance:,.0f} MMK.")

    old_bal = float(u.balance)
    u.balance += req.amount
    now = now_mmt()

    action_label = "TOP-UP" if req.amount > 0 else "DEDUCTION"
    ledger = FinancialLedger(
        entry_type=LedgerEntryType.DEPOSIT if req.amount > 0 else LedgerEntryType.WITHDRAWAL,
        amount=req.amount,
        running_balance=u.balance,
        reference_id=f"ADJ-{now.strftime('%Y%m%d%H%M%S')}-{u.id}",
        reference_type="ADMIN_ADJUST",
        description=f"Admin {action_label} by {admin_user.username or 'Admin'}: {req.reason} ({req.amount:+,.0f} MMK to {u.phone})",
        logged_at_mmt=now,
        date_str=now.strftime("%Y-%m-%d")
    )
    db.add(ledger)

    notif = Notification(
        user_id=u.id,
        title=f"Wallet Balance Adjusted ({req.amount:+,.0f} MMK)",
        message=f"Your wallet balance was adjusted by {req.amount:+,.0f} MMK. Reason: {req.reason}. Current balance: {u.balance:,.0f} MMK.",
        category="Wallet",
        is_read=False,
        created_at=now
    )
    db.add(notif)
    db.commit()

    return {
        "status": "success",
        "user_id": u.id,
        "old_balance": old_bal,
        "new_balance": float(u.balance),
        "adjusted_amount": req.amount
    }

class UpdatePlayerProfileRequest(BaseModel):
    full_name: Optional[str] = None
    username: Optional[str] = None
    nickname: Optional[str] = None
    phone: Optional[str] = None

@router.put("/members/app-users/{user_id}/profile")
def update_app_user_profile(
    user_id: int,
    req: UpdatePlayerProfileRequest,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    u = db.query(User).filter(User.id == user_id, User.is_simulated == False).first()
    if not u:
        raise HTTPException(status_code=404, detail="Player not found")

    if req.username is not None and req.username.strip():
        new_username = req.username.strip()
        existing = db.query(User).filter(User.username == new_username, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Username '@{new_username}' is already taken.")
        u.username = new_username

    if req.full_name is not None and req.full_name.strip():
        u.full_name = req.full_name.strip()

    if req.nickname is not None:
        u.nickname = req.nickname.strip() or None

    if req.phone is not None and req.phone.strip():
        new_phone = req.phone.strip()
        existing_phone = db.query(User).filter(User.phone == new_phone, User.id != user_id).first()
        if existing_phone:
            raise HTTPException(status_code=400, detail=f"Phone number '{new_phone}' is already registered.")
        u.phone = new_phone

    # Synchronize name in any settled LotteryDraw.winners_json for public social proof
    try:
        from app.seeds.seed_fake_users import mask_name, mask_phone
        from app.models.lottery import LotteryDraw
        display_name = u.full_name or u.username
        m_name = mask_name(display_name)
        m_phone = mask_phone(u.phone)

        draws_with_winners = db.query(LotteryDraw).filter(LotteryDraw.winners_json.isnot(None)).all()
        for d in draws_with_winners:
            try:
                winners = json.loads(d.winners_json)
                changed = False
                for w in winners:
                    if w.get("user_id") == u.id or w.get("phone") == u.phone:
                        w["player_name"] = display_name
                        w["masked_name"] = m_name
                        w["phone"] = u.phone
                        w["masked_phone"] = m_phone
                        changed = True
                if changed:
                    d.winners_json = json.dumps(winners)
            except Exception:
                pass
    except Exception:
        pass

    db.commit()

    return {
        "status": "success",
        "user_id": u.id,
        "username": u.username,
        "full_name": u.full_name,
        "nickname": u.nickname,
        "phone": u.phone
    }

@router.get("/members/fake-users")
def get_fake_users(
    page: int = 1,
    limit: int = 60,
    nickname: Optional[str] = None,
    search: Optional[str] = None,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(User).filter(User.is_simulated == True)
    if nickname:
        query = query.filter(or_(User.nickname.contains(nickname), User.full_name.contains(nickname)))
    if search:
        s = search.strip()
        query = query.filter(or_(User.nickname.contains(s), User.full_name.contains(s), User.username.contains(s)))
    total = query.count()
    users = query.order_by(User.id.asc()).offset((page - 1) * limit).limit(limit).all()
    
    avatar_list = [
        "https://api.dicebear.com/7.x/bottts/svg?seed=1",
        "https://api.dicebear.com/7.x/bottts/svg?seed=2",
        "https://api.dicebear.com/7.x/bottts/svg?seed=3",
        "https://api.dicebear.com/7.x/bottts/svg?seed=4",
        "https://api.dicebear.com/7.x/bottts/svg?seed=5",
    ]
    results = [
        {
            "id": u.id,
            "username": u.username,
            "avatar": u.avatar_url or avatar_list[u.id % len(avatar_list)],
            "avatar_url": u.avatar_url or avatar_list[u.id % len(avatar_list)],
            "nick_name": u.nickname or u.full_name or u.username,
            "nickname": u.nickname or u.full_name or u.username,
            "phone": u.phone or "",
            "balance": float(u.balance or 0.0),
            "created_at": u.created_at.strftime("%d/%m/%Y") if u.created_at else ""
        } for u in users
    ]
    return {
        "results": results,
        "users": results,
        "total": total,
        "page": page,
        "limit": limit
    }

@router.post("/members/fake-users")
def add_fake_user(
    req: FakeUserCreate,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    import random
    suffix = random.randint(100, 999)
    phone = f"0979{random.randint(1000000, 9999999)}"
    clean_name = re.sub(r'^(U|Daw|Ko|Mg|Ma)[\s\.]+', '', req.nickname, flags=re.IGNORECASE).strip() if req.nickname else f"User_{suffix}"
    u = User(
        username=f"fake_{suffix}",
        nickname=clean_name,
        full_name=clean_name,
        phone=phone,
        hashed_password=hash_password("fake123"),
        role=UserRole.USER,
        balance=50000.0,
        is_simulated=True,
        avatar_url=req.avatar_url
    )
    db.add(u)
    db.commit()
    return {"status": "success", "id": u.id, "nick_name": u.nickname}

@router.delete("/members/fake-users/{user_id}")
def delete_fake_user(
    user_id: int,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    u = db.query(User).filter(User.id == user_id, User.is_simulated == True).first()
    if not u:
        raise HTTPException(status_code=404, detail="Fake user not found")
    db.delete(u)
    db.commit()
    return {"status": "success", "deleted_id": user_id}

# ----------------- 5. Reports (Screenshots 9, 10, 11, 12, 13) -----------------
@router.get("/reports/statements")
def get_reports_statements(
    page: int = 1,
    limit: int = 50,
    username: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(FinancialLedger, User).outerjoin(User, FinancialLedger.description.contains(User.phone))
    if username:
        query = query.filter(FinancialLedger.description.contains(username))
    if from_date:
        query = query.filter(FinancialLedger.date_str >= from_date)
    if to_date:
        query = query.filter(FinancialLedger.date_str <= to_date)
    total = query.count()
    rows = query.order_by(FinancialLedger.id.desc()).offset((page - 1) * limit).limit(limit).all()

    results = []
    for fl, u in rows:
        type_str = "Withdraw" if fl.entry_type == LedgerEntryType.WITHDRAWAL else ("Bet Outstanding" if fl.entry_type == LedgerEntryType.BET_REVENUE else fl.entry_type)
        phone = u.phone if u else (fl.reference_id or "09444012884")
        closing = float(fl.running_balance)
        opening = closing - float(fl.amount)

        results.append({
            "id": fl.id,
            "date": fl.logged_at_mmt.strftime("%d-%m-%Y %I:%M:%S %p") if fl.logged_at_mmt else "",
            "username": phone,
            "slip_id": fl.reference_id if fl.reference_type == "BET_SLIP" else "-",
            "type": type_str,
            "amount": float(fl.amount),
            "opening_balance": opening,
            "closing_balance": closing,
            "description": fl.description or "-"
        })

    return {"results": results, "total": total, "page": page, "limit": limit}

@router.get("/reports/financial")
def get_reports_financial(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    100% LIVE Daily Financial Statement aggregated directly from real database:
    - 4D Bet Stake
    - Top Up (Deposits)
    - Withdrawals
    - 4D Payouts
    - 30% Agent Commission
    - Weekly Bonus
    - Net Profit / Loss
    - Company Running Balance
    """
    dates_query = set()
    
    # Dates from BetSlips
    bet_dates = db.query(func.date(BetSlip.created_at)).distinct().all()
    for bd in bet_dates:
        if bd[0]:
            dates_query.add(str(bd[0]))
            
    # Dates from LotteryDraws (Draw Dates for Payouts)
    draw_dates = db.query(LotteryDraw.draw_date).distinct().all()
    for dd in draw_dates:
        if dd[0]:
            dates_query.add(str(dd[0]))

    # Dates from Transactions
    tx_dates = db.query(func.date(Transaction.created_at)).distinct().all()
    for td in tx_dates:
        if td[0]:
            dates_query.add(str(td[0]))

    # Dates from DailyLedgerSummary
    dls_dates = db.query(DailyLedgerSummary.date_str).distinct().all()
    for dd in dls_dates:
        if dd[0]:
            dates_query.add(str(dd[0]))

    # Dates from Agent Commission Settlement (Credited to agent balance)
    comm_dates = db.query(func.date(AgentCommissionLog.settled_at)).filter(
        AgentCommissionLog.is_settled == True,
        AgentCommissionLog.settled_at != None
    ).distinct().all()
    for cd in comm_dates:
        if cd[0]:
            dates_query.add(str(cd[0]))

    # Dates from Weekly Bonus Credits (Credited to user balance)
    bonus_dates = db.query(func.date(WeeklyBonus.credited_at)).filter(
        WeeklyBonus.is_credited == True,
        WeeklyBonus.credited_at != None
    ).distinct().all()
    for bd in bonus_dates:
        if bd[0]:
            dates_query.add(str(bd[0]))

    if not dates_query:
        today_str = now_mmt().strftime("%Y-%m-%d")
        dates_query.add(today_str)

    sorted_dates = sorted(list(dates_query), reverse=True)
    if from_date:
        sorted_dates = [d for d in sorted_dates if d >= from_date]
    if to_date:
        sorted_dates = [d for d in sorted_dates if d <= to_date]

    # Live total customer balance
    total_cust_bal = db.query(func.coalesce(func.sum(User.balance), 0.0)).filter(User.role == UserRole.USER).scalar() or 0.0

    reports = []
    tot_4d_bet = 0.0
    tot_top_up = 0.0
    tot_withdraw = 0.0
    tot_payout = 0.0
    tot_commission = 0.0
    tot_bonus = 0.0
    tot_profit = 0.0

    for d_str in sorted_dates:
        d_bet = db.query(func.coalesce(func.sum(BetSlip.total_stake), 0.0)).filter(
            func.date(BetSlip.created_at) == d_str
        ).scalar() or 0.0

        d_topup = db.query(func.coalesce(func.sum(Transaction.amount), 0.0)).filter(
            Transaction.tx_type == TransactionType.DEPOSIT,
            Transaction.status.in_([TransactionStatus.AUTO_APPROVED, TransactionStatus.COMPLETED]),
            func.date(Transaction.created_at) == d_str
        ).scalar() or 0.0

        d_withdraw = db.query(func.coalesce(func.sum(Transaction.amount), 0.0)).filter(
            Transaction.tx_type == TransactionType.WITHDRAWAL,
            Transaction.status == TransactionStatus.COMPLETED,
            func.date(Transaction.created_at) == d_str
        ).scalar() or 0.0

        # Payout is strictly calculated by the official DRAW DATE (not ticket creation date)
        d_payout = (
            db.query(func.coalesce(func.sum(BetSlip.total_payout), 0.0))
            .join(LotteryDraw, BetSlip.draw_id == LotteryDraw.id)
            .filter(
                LotteryDraw.draw_date == d_str,
                BetSlip.total_payout > 0
            )
            .scalar() or 0.0
        )

        # 30% Agent Commission is strictly calculated on the date it is credited to the agent's balance
        d_comm = db.query(func.coalesce(func.sum(AgentCommissionLog.commission_amount), 0.0)).filter(
            AgentCommissionLog.is_settled == True,
            func.date(AgentCommissionLog.settled_at) == d_str
        ).scalar() or 0.0

        # 10% Weekly Bonus is strictly calculated on the date it is credited to the user's balance
        d_bonus = db.query(func.coalesce(func.sum(WeeklyBonus.bonus_amount), 0.0)).filter(
            WeeklyBonus.is_credited == True,
            func.date(WeeklyBonus.credited_at) == d_str
        ).scalar() or 0.0

        if d_bet == 0 and d_topup == 0 and d_withdraw == 0 and d_payout == 0 and d_comm == 0 and d_bonus == 0:
            continue

        d_profit = d_bet - d_payout - d_comm - d_bonus
        d_company_bal = d_profit

        tot_4d_bet += d_bet
        tot_top_up += d_topup
        tot_withdraw += d_withdraw
        tot_payout += d_payout
        tot_commission += d_comm
        tot_bonus += d_bonus
        tot_profit += d_profit

        reports.append({
            "report_date": d_str,
            "four_d_bet": float(d_bet),
            "top_up": float(d_topup),
            "withdraw": -float(d_withdraw) if d_withdraw > 0 else 0.0,
            "four_d_payout": -float(d_payout) if d_payout > 0 else 0.0,
            "agent_commission": -float(d_comm) if d_comm > 0 else 0.0,
            "weekly_bonus": -float(d_bonus) if d_bonus > 0 else 0.0,
            "cash_back": -(float(d_comm) + float(d_bonus)),
            "customer_balance": float(total_cust_bal),
            "profit": float(d_profit),
            "company_balance": float(d_company_bal)
        })

    company_net_balance = tot_profit

    return {
        "reports": reports,
        "sub_total": {
            "four_d_bet": float(tot_4d_bet),
            "top_up": float(tot_top_up),
            "withdraw": -float(tot_withdraw),
            "four_d_payout": -float(tot_payout),
            "agent_commission": -float(tot_commission),
            "weekly_bonus": -float(tot_bonus),
            "cash_back": -(float(tot_commission) + float(tot_bonus)),
            "customer_balance": float(total_cust_bal),
            "profit": float(tot_profit),
            "company_balance": float(company_net_balance)
        },
        "company_balance_oct": float(company_net_balance)
    }

@router.get("/reports/4d-bets")
def get_reports_4d_bets(
    page: int = 1,
    limit: int = 50,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    100% LIVE Draw-by-Draw Performance:
    Shows actual turnover pool, total payouts won, and net profit per draw.
    """
    draws = (
        db.query(LotteryDraw)
        .order_by(LotteryDraw.draw_date.desc(), LotteryDraw.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    results = []
    for d in draws:
        stats = db.query(
            func.coalesce(func.sum(BetSlip.total_stake), 0.0).label("staked"),
            func.coalesce(func.sum(BetSlip.total_payout), 0.0).label("payout"),
            func.count(BetSlip.id).label("tickets_count")
        ).filter(BetSlip.draw_id == d.id).first()

        tot_staked = float(stats.staked or d.total_pool_stake or 0.0)
        tot_payout = float(stats.payout or 0.0)
        profit = tot_staked - tot_payout

        results.append({
            "id": d.id,
            "date": d.draw_date,
            "draw_no": d.draw_number or f"DRAW-{d.id}",
            "status": d.status,
            "total_bet_amount": tot_staked,
            "total_payout_amount": tot_payout,
            "profit": profit,
            "tickets_count": int(stats.tickets_count or 0),
            "first_prize": d.first_prize or "-",
            "second_prize": d.second_prize or "-",
            "third_prize": d.third_prize or "-",
            "closed_count": len(d.closed_numbers)
        })
    total_draws = db.query(LotteryDraw).count()
    return {"results": results, "total": total_draws, "page": page, "limit": limit}

@router.get("/reports/user-bets")
def get_reports_user_bets(
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    100% LIVE Player Turnover Ranking:
    Orders real and registered players by total stake, showing live stats.
    """
    query = db.query(User).filter(User.role == UserRole.USER)
    if search:
        s = search.strip()
        query = query.filter(or_(User.phone.contains(s), User.full_name.contains(s), User.nickname.contains(s)))

    users = query.all()

    results = []
    for u in users:
        stats = db.query(
            func.count(BetSlip.id).label("bet_count"),
            func.coalesce(func.sum(BetSlip.total_stake), 0.0).label("total_staked"),
            func.coalesce(func.sum(BetSlip.total_payout), 0.0).label("total_payout"),
            func.coalesce(func.max(BetSlip.total_stake), 0.0).label("max_stake"),
            func.max(BetSlip.created_at).label("last_bet_time")
        ).filter(BetSlip.user_id == u.id).first()

        results.append({
            "id": u.id,
            "name": u.full_name or u.nickname or "Player",
            "phone": u.phone,
            "last_betted_game_date": stats.last_bet_time.strftime("%d/%m/%Y %I:%M %p") if stats and stats.last_bet_time else "-",
            "total_bet_count": int(stats.bet_count or 0),
            "max_bet_amount_per_game": float(stats.max_stake or 0.0),
            "fourd_total_bet": float(stats.total_staked or 0.0),
            "fourd_payout_amount": float(stats.total_payout or 0.0),
            "net_profit": float((stats.total_staked or 0.0) - (stats.total_payout or 0.0)),
            "balance": float(u.balance or 0.0),
            "is_suspended": bool(u.is_suspended)
        })

    # Sort by total stake descending (Turnover Ranking)
    results.sort(key=lambda x: x["fourd_total_bet"], reverse=True)
    total_count = len(results)
    sliced = results[(page - 1) * limit : page * limit]

    return {"results": sliced, "total": total_count, "page": page, "limit": limit}

@router.get("/reports/agents")
def get_reports_agents_summary(
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    100% LIVE Agent Turnover & Commission Performance Summary:
    Aggregates each agent's downline size, total turnover, commission, and credit balance.
    """
    agents = db.query(User).filter(User.role == UserRole.AGENT).all()
    results = []
    for ag in agents:
        downline_count = db.query(func.count(User.id)).filter(
            or_(User.agent_id == ag.id, User.referred_by_code == ag.agent_code),
            User.is_simulated == False,
            User.role == UserRole.USER
        ).scalar() or 0

        from app.core.agent_level import get_agent_turnover_stats
        turnover_stats = get_agent_turnover_stats(ag, db)
        tot_turnover = turnover_stats["total_turnover"]

        tot_pending_comm = db.query(func.coalesce(func.sum(AgentCommissionLog.commission_amount), 0.0)).filter(
            AgentCommissionLog.agent_id == ag.id,
            AgentCommissionLog.is_settled == False
        ).scalar() or 0.0

        tot_settled_comm = db.query(func.coalesce(func.sum(AgentCommissionLog.commission_amount), 0.0)).filter(
            AgentCommissionLog.agent_id == ag.id,
            AgentCommissionLog.is_settled == True
        ).scalar() or 0.0

        results.append({
            "id": ag.id,
            "agent_code": ag.agent_code or "-",
            "name": ag.full_name,
            "phone": ag.phone,
            "level": ag.level or "Level 1",
            "security_deposit": float(ag.security_deposit or 0.0),
            "credit_limit": float(ag.credit_limit or 0.0),
            "used_credit": float(ag.used_credit or 0.0),
            "available_credit": max(0.0, float(ag.credit_limit or 0.0) - float(ag.used_credit or 0.0)),
            "is_betting_locked": bool(ag.is_betting_locked),
            "settlement_status": ag.settlement_status or "SETTLED",
            "downline_players_count": int(downline_count),
            "total_turnover": float(tot_turnover),
            "self_turnover": float(turnover_stats["self_turnover"]),
            "downline_turnover": float(turnover_stats["downline_turnover"]),
            "pending_commission": float(tot_pending_comm),
            "settled_commission": float(tot_settled_comm),
            "total_commission": float(tot_pending_comm + tot_settled_comm)
        })

    results.sort(key=lambda x: x["total_turnover"], reverse=True)
    return {"results": results, "total": len(results)}

# ----------------- 6. Settings & Notifications (Screenshots 14, 15, 16) -----------------
@router.get("/settings/system")
def get_system_settings(
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    setting = db.query(SystemSetting).first()
    if not setting:
        setting = SystemSetting()
        db.add(setting)
        db.commit()
        db.refresh(setting)

    # Return comprehensive dictionary supporting both naming conventions
    return {
        "id": setting.id,
        "wave_phone": setting.wave_phone or "09894169717",
        "wave_name": setting.wave_name or "Ye Win Htut",
        "wave_qr_url": setting.wave_qr_url or "/assets/wave_qr_sample.png",
        "kpay_phone": setting.kpay_phone or "09798888888",
        "kpay_name": setting.kpay_name or "Daw Hla Hla",
        "kpay_qr_url": setting.kpay_qr_url or "/assets/kpay_qr_sample.png",

        # Timing (supports cutoff_time and bet_end_time, result_time and result_confirm_time)
        "cutoff_time": setting.bet_end_time or "16:30",
        "bet_end_time": setting.bet_end_time or "16:30",
        "result_time": setting.result_confirm_time or "18:00",
        "result_confirm_time": setting.result_confirm_time or "18:00",

        # Risk & Limits (supports risk_cap and max_amount_per_number)
        "risk_cap": float(setting.max_amount_per_number or 11000.0),
        "max_amount_per_number": float(setting.max_amount_per_number or 11000.0),
        "min_amount_per_bet": float(setting.min_amount_per_bet or 50.0),
        "max_amount_per_bet": float(setting.max_amount_per_bet or 10000.0),
        "max_amount_per_slip": float(setting.max_amount_per_slip or 100000.0),
        "default_bet_amount": float(setting.default_bet_amount or 100.0),

        # Bonuses & Commissions
        "reward_percentage": float(setting.consecutive_reward_percent or 20.0),
        "consecutive_reward_percent": float(setting.consecutive_reward_percent or 20.0),
        "weekly_bonus_rate": float(setting.weekly_bonus_rate or 10.0),
        "weekly_bonus_min_bet": float(setting.weekly_bonus_min_bet or 10000.0),
        "commission_rate": float(getattr(setting, "commission_rate", 30.0) or 30.0),

        # Agent Level & Credit Multiplier settings
        "agent_credit_multiplier": float(setting.agent_credit_multiplier or 1.6),
        "is_agent_credit_enabled": bool(getattr(setting, "is_agent_credit_enabled", False)),
        "agent_lvl1_deposit": float(setting.agent_lvl1_deposit or 100000.0),
        "agent_lvl2_deposit": float(setting.agent_lvl2_deposit or 300000.0),
        "agent_lvl3_deposit": float(setting.agent_lvl3_deposit or 500000.0),
        "agent_lvl4_deposit": float(setting.agent_lvl4_deposit or 800000.0),
        "agent_lvl5_deposit": float(setting.agent_lvl5_deposit or 1000000.0),
        "agent_lvl2_target_turnover": float(setting.agent_lvl2_target_turnover or 6000000.0),
        "agent_lvl3_target_turnover": float(setting.agent_lvl3_target_turnover or 10000000.0),
        "agent_lvl4_target_turnover": float(setting.agent_lvl4_target_turnover or 15000000.0),
        "agent_lvl5_target_turnover": float(setting.agent_lvl5_target_turnover or 20000000.0),

        # 4-Tier Agent Commission & Turnover settings
        "agent_tier1_turnover": float(getattr(setting, "agent_tier1_turnover", 3000000.0) or 3000000.0),
        "agent_tier1_commission": float(getattr(setting, "agent_tier1_commission", 15.0) or 15.0),
        "agent_tier2_turnover": float(getattr(setting, "agent_tier2_turnover", 6000000.0) or 6000000.0),
        "agent_tier2_commission": float(getattr(setting, "agent_tier2_commission", 20.0) or 20.0),
        "agent_tier3_turnover": float(getattr(setting, "agent_tier3_turnover", 10000000.0) or 10000000.0),
        "agent_tier3_commission": float(getattr(setting, "agent_tier3_commission", 25.0) or 25.0),
        "agent_tier4_turnover": float(getattr(setting, "agent_tier4_turnover", 15000000.0) or 15000000.0),
        "agent_tier4_commission": float(getattr(setting, "agent_tier4_commission", 30.0) or 30.0),

        # Finance Alert & Security Settings
        "telegram_finance_group_id": setting.telegram_finance_group_id or "",
        "auto_approve_max_amount": float(getattr(setting, "auto_approve_max_amount", 50000.0) or 50000.0),
        "is_withdraw_hours_enabled": bool(getattr(setting, "is_withdraw_hours_enabled", False)),

        # 2D Lottery Settings
        "is_2d_enabled": bool(getattr(setting, "is_2d_enabled", True) if getattr(setting, "is_2d_enabled", True) is not None else True),
        "twod_payout_multiplier": float(getattr(setting, "twod_payout_multiplier", 85.0) or 85.0),
        "twod_commission_rate": float(getattr(setting, "twod_commission_rate", 15.0) or 15.0),
        "twod_min_bet": float(getattr(setting, "twod_min_bet", 100.0) or 100.0),
        "twod_max_bet": float(getattr(setting, "twod_max_bet", 50000.0) or 50000.0),
        "twod_max_risk_per_number": float(getattr(setting, "twod_max_risk_per_number", 100000.0) or 100000.0),
        "twod_morning_cutoff": getattr(setting, "twod_morning_cutoff", "11:30 AM") or "11:30 AM",
        "twod_evening_cutoff": getattr(setting, "twod_evening_cutoff", "04:00 PM") or "04:00 PM",

        # 3D Lottery Settings
        "is_3d_enabled": bool(getattr(setting, "is_3d_enabled", True) if getattr(setting, "is_3d_enabled", True) is not None else True),
        "threed_straight_payout": float(getattr(setting, "threed_straight_payout", 700.0) or 700.0),
        "threed_tote_payout": float(getattr(setting, "threed_tote_payout", 10.0) or 10.0),
        "threed_commission_rate": float(getattr(setting, "threed_commission_rate", 15.0) or 15.0),
        "threed_min_bet": float(getattr(setting, "threed_min_bet", 100.0) or 100.0),
        "threed_max_bet": float(getattr(setting, "threed_max_bet", 50000.0) or 50000.0),
        "threed_max_risk_per_number": float(getattr(setting, "threed_max_risk_per_number", 200000.0) or 200000.0),
        "threed_draw_cutoff": getattr(setting, "threed_draw_cutoff", "02:30 PM") or "02:30 PM",

        "company_balance_oct": float(setting.company_balance_oct or 4198200.0),
        "updated_at": setting.updated_at.strftime("%Y-%m-%d %H:%M:%S") if setting.updated_at else None
    }

@router.post("/settings/upload-qr")
async def upload_payment_qr(
    file: UploadFile = File(...),
    admin_user: User = Depends(get_current_admin)
):
    """
    Uploads official KPay or WavePay QR code image.
    """
    allowed_exts = [".jpg", ".jpeg", ".png", ".webp"]
    _, ext = os.path.splitext(file.filename or "")
    if ext.lower() not in allowed_exts:
        raise HTTPException(status_code=400, detail="Allowed image formats: JPG, PNG, WEBP.")

    upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "uploads")
    os.makedirs(upload_dir, exist_ok=True)

    unique_filename = f"qr_{uuid.uuid4().hex[:10]}{ext.lower()}"
    file_path = os.path.join(upload_dir, unique_filename)

    async with aiofiles.open(file_path, "wb") as out_file:
        content = await file.read()
        await out_file.write(content)

    return {
        "status": "success",
        "qr_url": f"/static/uploads/{unique_filename}",
        "filename": unique_filename
    }

@router.put("/settings/system")
def update_system_settings(
    req: SystemSettingsUpdate,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    setting = db.query(SystemSetting).first()
    if not setting:
        setting = SystemSetting()
        db.add(setting)

    # 1. Risk Cap / Max Risk per 4D Number
    if req.risk_cap is not None:
        setting.max_amount_per_number = float(req.risk_cap)
    if req.max_amount_per_number is not None:
        setting.max_amount_per_number = float(req.max_amount_per_number)

    # 2. Cutoff Time & Result Time
    if req.cutoff_time is not None:
        setting.bet_end_time = str(req.cutoff_time).strip()
    if req.bet_end_time is not None:
        setting.bet_end_time = str(req.bet_end_time).strip()

    if req.result_time is not None:
        setting.result_confirm_time = str(req.result_time).strip()
    if req.result_confirm_time is not None:
        setting.result_confirm_time = str(req.result_confirm_time).strip()

    # 3. Rewards & Commissions
    if req.reward_percentage is not None:
        setting.consecutive_reward_percent = float(req.reward_percentage)
        setting.weekly_bonus_rate = float(req.reward_percentage)
    if req.consecutive_reward_percent is not None:
        setting.consecutive_reward_percent = float(req.consecutive_reward_percent)
    if req.weekly_bonus_rate is not None:
        setting.weekly_bonus_rate = float(req.weekly_bonus_rate)

    if req.commission_rate is not None:
        setting.commission_rate = float(req.commission_rate)

    # 4. Payment Receivers
    if req.wave_phone is not None: setting.wave_phone = req.wave_phone.strip()
    if req.wave_name is not None: setting.wave_name = req.wave_name.strip()
    if req.wave_qr_url is not None: setting.wave_qr_url = req.wave_qr_url.strip()
    if req.kpay_phone is not None: setting.kpay_phone = req.kpay_phone.strip()
    if req.kpay_name is not None: setting.kpay_name = req.kpay_name.strip()
    if req.kpay_qr_url is not None: setting.kpay_qr_url = req.kpay_qr_url.strip()

    # 5. Bet Limits
    if req.min_amount_per_bet is not None: setting.min_amount_per_bet = float(req.min_amount_per_bet)
    if req.max_amount_per_bet is not None: setting.max_amount_per_bet = float(req.max_amount_per_bet)
    if req.max_amount_per_slip is not None: setting.max_amount_per_slip = float(req.max_amount_per_slip)
    if req.default_bet_amount is not None: setting.default_bet_amount = float(req.default_bet_amount)

    # 6. Agent Level & Credit Multiplier settings
    if req.agent_credit_multiplier is not None: setting.agent_credit_multiplier = float(req.agent_credit_multiplier)
    if req.is_agent_credit_enabled is not None: setting.is_agent_credit_enabled = bool(req.is_agent_credit_enabled)
    if req.agent_lvl1_deposit is not None: setting.agent_lvl1_deposit = float(req.agent_lvl1_deposit)
    if req.agent_lvl2_deposit is not None: setting.agent_lvl2_deposit = float(req.agent_lvl2_deposit)
    if req.agent_lvl3_deposit is not None: setting.agent_lvl3_deposit = float(req.agent_lvl3_deposit)
    if req.agent_lvl4_deposit is not None: setting.agent_lvl4_deposit = float(req.agent_lvl4_deposit)
    if req.agent_lvl5_deposit is not None: setting.agent_lvl5_deposit = float(req.agent_lvl5_deposit)

    if req.agent_lvl2_target_turnover is not None: setting.agent_lvl2_target_turnover = float(req.agent_lvl2_target_turnover)
    if req.agent_lvl3_target_turnover is not None: setting.agent_lvl3_target_turnover = float(req.agent_lvl3_target_turnover)
    if req.agent_lvl4_target_turnover is not None: setting.agent_lvl4_target_turnover = float(req.agent_lvl4_target_turnover)
    if req.agent_lvl5_target_turnover is not None: setting.agent_lvl5_target_turnover = float(req.agent_lvl5_target_turnover)

    # 7. 4-Tier Agent Commission & Turnover settings
    if req.agent_tier1_turnover is not None: setting.agent_tier1_turnover = float(req.agent_tier1_turnover)
    if req.agent_tier1_commission is not None: setting.agent_tier1_commission = float(req.agent_tier1_commission)
    if req.agent_tier2_turnover is not None: setting.agent_tier2_turnover = float(req.agent_tier2_turnover)
    if req.agent_tier2_commission is not None: setting.agent_tier2_commission = float(req.agent_tier2_commission)
    if req.agent_tier3_turnover is not None: setting.agent_tier3_turnover = float(req.agent_tier3_turnover)
    if req.agent_tier3_commission is not None: setting.agent_tier3_commission = float(req.agent_tier3_commission)
    if req.agent_tier4_turnover is not None: setting.agent_tier4_turnover = float(req.agent_tier4_turnover)
    if req.agent_tier4_commission is not None: setting.agent_tier4_commission = float(req.agent_tier4_commission)

    # 8. Finance Alert & Security Settings
    if req.telegram_finance_group_id is not None:
        setting.telegram_finance_group_id = req.telegram_finance_group_id.strip()
        from app.core.telegram_bot import _save_fallback_group_id
        if setting.telegram_finance_group_id:
            _save_fallback_group_id(setting.telegram_finance_group_id)
    if req.auto_approve_max_amount is not None: setting.auto_approve_max_amount = float(req.auto_approve_max_amount)
    if req.is_withdraw_hours_enabled is not None: setting.is_withdraw_hours_enabled = bool(req.is_withdraw_hours_enabled)

    # 9. 2D Lottery Settings
    if req.is_2d_enabled is not None: setting.is_2d_enabled = bool(req.is_2d_enabled)
    if req.twod_payout_multiplier is not None: setting.twod_payout_multiplier = float(req.twod_payout_multiplier)
    if req.twod_commission_rate is not None: setting.twod_commission_rate = float(req.twod_commission_rate)
    if req.twod_min_bet is not None: setting.twod_min_bet = float(req.twod_min_bet)
    if req.twod_max_bet is not None: setting.twod_max_bet = float(req.twod_max_bet)
    if req.twod_max_risk_per_number is not None: setting.twod_max_risk_per_number = float(req.twod_max_risk_per_number)
    if req.twod_morning_cutoff is not None: setting.twod_morning_cutoff = str(req.twod_morning_cutoff).strip()
    if req.twod_evening_cutoff is not None: setting.twod_evening_cutoff = str(req.twod_evening_cutoff).strip()

    # 10. 3D Lottery Settings
    if req.is_3d_enabled is not None: setting.is_3d_enabled = bool(req.is_3d_enabled)
    if req.threed_straight_payout is not None: setting.threed_straight_payout = float(req.threed_straight_payout)
    if req.threed_tote_payout is not None: setting.threed_tote_payout = float(req.threed_tote_payout)
    if req.threed_commission_rate is not None: setting.threed_commission_rate = float(req.threed_commission_rate)
    if req.threed_min_bet is not None: setting.threed_min_bet = float(req.threed_min_bet)
    if req.threed_max_bet is not None: setting.threed_max_bet = float(req.threed_max_bet)
    if req.threed_max_risk_per_number is not None: setting.threed_max_risk_per_number = float(req.threed_max_risk_per_number)
    if req.threed_draw_cutoff is not None: setting.threed_draw_cutoff = str(req.threed_draw_cutoff).strip()

    setting.updated_at = now_mmt()
    db.commit()
    db.refresh(setting)

    return {
        "status": "success", 
        "message": "System settings updated and synchronized successfully",
        "settings": {
            "risk_cap": float(setting.max_amount_per_number or 11000.0),
            "max_amount_per_number": float(setting.max_amount_per_number or 11000.0),
            "cutoff_time": setting.bet_end_time,
            "result_time": setting.result_confirm_time,
            "reward_percentage": setting.consecutive_reward_percent,
            "commission_rate": getattr(setting, "commission_rate", 30.0),
            "wave_phone": setting.wave_phone,
            "kpay_phone": setting.kpay_phone,
            "agent_credit_multiplier": setting.agent_credit_multiplier,
            "is_agent_credit_enabled": bool(setting.is_agent_credit_enabled),
            "agent_tier1_turnover": getattr(setting, "agent_tier1_turnover", 3000000.0),
            "agent_tier1_commission": getattr(setting, "agent_tier1_commission", 15.0),
            "agent_tier2_turnover": getattr(setting, "agent_tier2_turnover", 6000000.0),
            "agent_tier2_commission": getattr(setting, "agent_tier2_commission", 20.0),
            "agent_tier3_turnover": getattr(setting, "agent_tier3_turnover", 10000000.0),
            "agent_tier3_commission": getattr(setting, "agent_tier3_commission", 25.0),
            "agent_tier4_turnover": getattr(setting, "agent_tier4_turnover", 15000000.0),
            "agent_tier4_commission": getattr(setting, "agent_tier4_commission", 30.0),
        }
    }

@router.post("/settings/toggle-agent-credit")
def toggle_agent_credit(
    req: Optional[ToggleAgentCreditRequest] = None,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    setting = db.query(SystemSetting).first()
    if not setting:
        setting = SystemSetting()
        db.add(setting)
        db.flush()

    if req and req.enabled is not None:
        setting.is_agent_credit_enabled = bool(req.enabled)
    else:
        setting.is_agent_credit_enabled = not bool(setting.is_agent_credit_enabled)

    setting.updated_at = now_mmt()
    db.commit()
    db.refresh(setting)

    status_str = "ENABLED (ဖွင့်လှစ်ထားသည်)" if setting.is_agent_credit_enabled else "SUSPENDED (ခေတ္တဆိုင်းငံ့ထားသည်)"
    return {
        "status": "success",
        "is_agent_credit_enabled": bool(setting.is_agent_credit_enabled),
        "agent_credit_multiplier": float(setting.agent_credit_multiplier or 1.6),
        "message": f"Agent Credit status successfully set to: {status_str}"
    }

@router.get("/settings/applications")
def get_application_releases(
    page: int = 1,
    limit: int = 10,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    releases = db.query(ApplicationRelease).order_by(ApplicationRelease.id.desc()).offset((page - 1) * limit).limit(limit).all()
    total = db.query(ApplicationRelease).count()
    return {
        "results": [
            {
                "id": r.id,
                "name": r.name,
                "build_number": r.build_number,
                "version": r.version,
                "created_at": r.created_at.strftime("%d/%m/%Y %H:%M:%S") if r.created_at else ""
            } for r in releases
        ],
        "total": total,
        "page": page,
        "limit": limit
    }

@router.post("/settings/applications")
def create_application_release(
    req: ApplicationReleaseCreate,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    ar = ApplicationRelease(
        name=req.name,
        build_number=req.build_number,
        version=req.version
    )
    db.add(ar)
    db.commit()
    return {"status": "success", "id": ar.id, "name": ar.name}

@router.get("/notifications")
def get_admin_notifications(
    page: int = 1,
    limit: int = 25,
    category: Optional[str] = None,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(Notification)
    if category and category.upper() != "ALL":
        query = query.filter(Notification.category.ilike(category))
    total = query.count()
    notifs = query.order_by(Notification.id.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "results": [
            {
                "id": n.id,
                "title": n.title,
                "body": n.message,
                "category": n.category or "Announcement",
                "created_at": n.created_at.strftime("%d/%m/%Y %H:%M:%S") if n.created_at else ""
            } for n in notifs
        ],
        "total": total,
        "page": page,
        "limit": limit
    }

@router.post("/notifications")
def create_admin_notification(
    req: NotificationCreate,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    n = Notification(
        user_id=req.user_id,
        title=req.title,
        message=req.body or req.title,
        category=req.category,
        is_read=False,
        created_at=now_mmt()
    )
    db.add(n)
    db.commit()
    return {"status": "success", "id": n.id, "title": n.title}




# =========================================================================
# 7. THAI 2D LOTTERY ADMIN CONTROLLERS & GAME MONITOR
# =========================================================================

def ensure_twod_draws_exist(db: Session):
    curr = now_mmt()
    today_str = curr.strftime("%Y-%m-%d")
    is_past_morning = curr.hour > 12 or (curr.hour == 12 and curr.minute >= 1)
    is_past_evening = curr.hour > 16 or (curr.hour == 16 and curr.minute >= 30)

    from app.core.twod_service import settle_twod_draw_internal

    morning = db.query(TwoDDraw).filter(TwoDDraw.draw_date == today_str, TwoDDraw.session == "morning").first()
    if not morning:
        morning = TwoDDraw(
            draw_date=today_str,
            session="morning",
            draw_time_mmt="12:01 PM MMT",
            cutoff_time_mmt="11:30 AM MMT",
            status="OPEN"
        )
        db.add(morning)
        db.flush()

    if morning.status == "OPEN" and is_past_morning:
        settle_twod_draw_internal(db, morning, "85", "1,391.18", "31,492.35")

    evening = db.query(TwoDDraw).filter(TwoDDraw.draw_date == today_str, TwoDDraw.session == "evening").first()
    if not evening:
        evening = TwoDDraw(
            draw_date=today_str,
            session="evening",
            draw_time_mmt="04:30 PM MMT",
            cutoff_time_mmt="04:00 PM MMT",
            status="OPEN"
        )
        db.add(evening)
        db.flush()

    if evening.status == "OPEN" and is_past_evening:
        settle_twod_draw_internal(db, evening, "84", "1,396.52", "48,310.84")

    past_cnt = db.query(TwoDDraw).filter(TwoDDraw.status == "SETTLED").count()
    if past_cnt == 0:
        db.add(TwoDDraw(
            draw_date="2026-10-22", session="evening", draw_time_mmt="04:30 PM MMT",
            cutoff_time_mmt="04:00 PM MMT", status="SETTLED", set_index="1,385.42",
            set_value="45,210.85", winning_number="25", total_staked=4850000.0, total_payout=4122500.0,
            settled_at=now_mmt() - timedelta(days=1)
        ))
        db.add(TwoDDraw(
            draw_date="2026-10-22", session="morning", draw_time_mmt="12:01 PM MMT",
            cutoff_time_mmt="11:30 AM MMT", status="SETTLED", set_index="1,382.16",
            set_value="21,340.59", winning_number="69", total_staked=3920000.0, total_payout=3332000.0,
            settled_at=now_mmt() - timedelta(days=1)
        ))
        db.add(TwoDDraw(
            draw_date="2026-10-21", session="evening", draw_time_mmt="04:30 PM MMT",
            cutoff_time_mmt="04:00 PM MMT", status="SETTLED", set_index="1,379.80",
            set_value="52,190.73", winning_number="03", total_staked=5120000.0, total_payout=4352000.0,
            settled_at=now_mmt() - timedelta(days=2)
        ))
    db.commit()

@router.get("/2d/game")
def get_2d_game_monitor(
    draw_id: Optional[int] = None,
    mode: Optional[str] = "live",
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    ensure_twod_draws_exist(db)
    setting = db.query(SystemSetting).first()
    payout_multiplier = float(getattr(setting, "twod_payout_multiplier", 85.0) or 85.0)
    risk_cap = float(getattr(setting, "twod_max_risk_per_number", 100000.0) or 100000.0)

    if mode == "past":
        past_draws = db.query(TwoDDraw).filter(TwoDDraw.status == "SETTLED").order_by(TwoDDraw.id.desc()).limit(15).all()
        return {
            "mode": "past",
            "past_draws": [
                {
                    "id": d.id,
                    "draw_date": d.draw_date,
                    "session": d.session,
                    "session_label": "Morning (12:01 PM)" if d.session == "morning" else "Evening (04:30 PM)",
                    "draw_time_mmt": d.draw_time_mmt,
                    "set_index": d.set_index,
                    "set_value": d.set_value,
                    "winning_number": d.winning_number,
                    "total_staked": d.total_staked,
                    "total_payout": d.total_payout,
                    "profit": d.total_staked - d.total_payout,
                    "status": d.status
                } for d in past_draws
            ]
        }

    open_draws = db.query(TwoDDraw).filter(TwoDDraw.status == "OPEN").order_by(TwoDDraw.id.asc()).all()
    selected_draw = None
    if draw_id:
        selected_draw = db.query(TwoDDraw).filter(TwoDDraw.id == draw_id).first()
    if not selected_draw and open_draws:
        selected_draw = open_draws[0]

    numbers_map = {}
    for i in range(100):
        num_str = f"{i:02d}"
        numbers_map[num_str] = {"number": num_str, "staked": 0.0, "is_closed": False}

    closed_nums = set(selected_draw.closed_numbers if selected_draw else [])
    for num_str in closed_nums:
        if num_str in numbers_map:
            numbers_map[num_str]["is_closed"] = True

    if selected_draw:
        bets_items = (
            db.query(BetItem.number, func.sum(BetItem.item_stake))
            .join(BetSlip, BetItem.slip_id == BetSlip.id)
            .filter(BetSlip.game_type == "2D", BetSlip.draw_id == selected_draw.id)
            .group_by(BetItem.number)
            .all()
        )
        for num, total_stk in bets_items:
            clean_n = str(num).strip().zfill(2)
            if clean_n in numbers_map:
                numbers_map[clean_n]["staked"] = float(total_stk or 0.0)

    total_pool = sum(n["staked"] for n in numbers_map.values())
    top_numbers = sorted(numbers_map.values(), key=lambda x: x["staked"], reverse=True)[:10]

    return {
        "mode": "live",
        "selected_draw": {
            "id": selected_draw.id if selected_draw else None,
            "draw_date": selected_draw.draw_date if selected_draw else None,
            "session": selected_draw.session if selected_draw else None,
            "session_label": ("Morning (12:01 PM)" if selected_draw and selected_draw.session == "morning" else "Evening (04:30 PM)") if selected_draw else None,
            "draw_time_mmt": selected_draw.draw_time_mmt if selected_draw else "12:01 PM MMT",
            "cutoff_time_mmt": selected_draw.cutoff_time_mmt if selected_draw else "11:30 AM MMT",
            "status": selected_draw.status if selected_draw else "OPEN",
            "closed_numbers": list(closed_nums)
        },
        "available_draws": [
            {
                "id": d.id,
                "draw_date": d.draw_date,
                "session": d.session,
                "session_label": "Morning (12:01 PM)" if d.session == "morning" else "Evening (04:30 PM)",
                "draw_time_mmt": d.draw_time_mmt,
                "cutoff_time_mmt": d.cutoff_time_mmt,
                "status": d.status
            } for d in open_draws
        ],
        "payout_multiplier": payout_multiplier,
        "max_risk_cap": risk_cap,
        "total_staked": total_pool,
        "peak_liability": max((n["staked"] * payout_multiplier for n in numbers_map.values()), default=0.0),
        "numbers_matrix": list(numbers_map.values()),
        "top_numbers": top_numbers,
        "is_2d_enabled": bool(getattr(setting, "is_2d_enabled", True) if getattr(setting, "is_2d_enabled", True) is not None else True)
    }

@router.post("/2d/closed-numbers")
def add_2d_closed_number(
    payload: Dict[str, Any] = Body(...),
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    draw_id = payload.get("draw_id")
    raw_num = payload.get("number", "")
    num_str = str(raw_num).strip().zfill(2)
    draw = db.query(TwoDDraw).filter(TwoDDraw.id == draw_id).first() if draw_id else db.query(TwoDDraw).filter(TwoDDraw.status == "OPEN").first()
    if not draw:
        raise HTTPException(status_code=404, detail="2D Draw session not found")
    closed = draw.closed_numbers
    if num_str not in closed:
        closed.append(num_str)
        draw.closed_numbers_json = json.dumps(closed)
        db.commit()
    return {"status": "success", "closed_numbers": closed}

@router.delete("/2d/closed-numbers/{number}")
def remove_2d_closed_number(
    number: str,
    draw_id: Optional[int] = Query(None),
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    num_str = str(number).strip().zfill(2)
    draw = db.query(TwoDDraw).filter(TwoDDraw.id == draw_id).first() if draw_id else db.query(TwoDDraw).filter(TwoDDraw.status == "OPEN").first()
    if not draw:
        raise HTTPException(status_code=404, detail="2D Draw session not found")
    closed = [n for n in draw.closed_numbers if n != num_str]
    draw.closed_numbers_json = json.dumps(closed)
    db.commit()
    return {"status": "success", "closed_numbers": closed}

@router.get("/2d/number-audit")
def get_2d_number_audit(
    number: str = Query(...),
    draw_id: Optional[int] = Query(None),
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    clean_num = str(number).strip().zfill(2)
    setting = db.query(SystemSetting).first()
    payout_mult = float(getattr(setting, "twod_payout_multiplier", 85.0) or 85.0)

    query = (
        db.query(BetItem, BetSlip, User)
        .join(BetSlip, BetItem.slip_id == BetSlip.id)
        .join(User, BetSlip.user_id == User.id)
        .filter(BetSlip.game_type == "2D", BetItem.number == clean_num)
    )
    if draw_id:
        query = query.filter(BetSlip.draw_id == draw_id)
    items = query.order_by(BetItem.id.desc()).all()

    total_staked = sum(float(bi.item_stake or 0.0) for bi, bs, u in items)
    bets_list = []
    for bi, bs, u in items:
        bets_list.append({
            "item_id": bi.id,
            "voucher": bs.slip_code,
            "nickname": u.nickname or u.username,
            "phone": u.phone,
            "number": bi.number,
            "stake": float(bi.item_stake or 0.0),
            "payout": float(bi.item_stake or 0.0) * payout_mult,
            "created_at": bs.created_at.strftime("%d/%m/%Y %I:%M:%S %p") if bs.created_at else ""
        })

    return {
        "number": clean_num,
        "total_staked": total_staked,
        "peak_liability": total_staked * payout_mult,
        "bet_count": len(bets_list),
        "bets": bets_list
    }

@router.get("/2d/bets")
def get_2d_bets_history(
    page: int = 1,
    limit: int = 50,
    session_id: Optional[int] = None,
    game_date: Optional[str] = None,
    nickname: Optional[str] = None,
    phone: Optional[str] = None,
    number: Optional[str] = None,
    status: Optional[str] = None,
    voucher: Optional[str] = None,
    is_edited: Optional[str] = None,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    ensure_twod_draws_exist(db)
    query = (
        db.query(BetItem, BetSlip, User, TwoDDraw)
        .join(BetSlip, BetItem.slip_id == BetSlip.id)
        .join(User, BetSlip.user_id == User.id)
        .join(TwoDDraw, BetSlip.draw_id == TwoDDraw.id)
        .filter(BetSlip.game_type == "2D")
    )

    if session_id:
        query = query.filter(TwoDDraw.id == session_id)
    if game_date:
        query = query.filter(TwoDDraw.draw_date.contains(game_date))
    if nickname:
        query = query.filter(or_(User.nickname.ilike(f"%{nickname}%"), User.username.ilike(f"%{nickname}%")))
    if phone:
        query = query.filter(User.phone.contains(phone))
    if number:
        query = query.filter(BetItem.number == number.strip().zfill(2))
    if voucher:
        query = query.filter(BetSlip.slip_code.contains(voucher))

    edit_filter = (is_edited or "").strip().lower()
    if edit_filter in ["true", "1", "edited", "yes"]:
        query = query.filter(BetItem.edit_logs_json.isnot(None), BetItem.edit_logs_json != "[]", BetItem.edit_logs_json != "")
    elif edit_filter in ["false", "0", "original", "no"]:
        query = query.filter(or_(BetItem.edit_logs_json.is_(None), BetItem.edit_logs_json == "[]", BetItem.edit_logs_json == ""))

    total_count = query.count()
    items = query.order_by(BetItem.id.desc()).offset((page - 1) * limit).limit(limit).all()

    setting = db.query(SystemSetting).first()
    payout_mult = float(getattr(setting, "twod_payout_multiplier", 85.0) or 85.0)

    results = []
    for bi, bs, u, d in items:
        edit_history = []
        try:
            if getattr(bi, "edit_logs_json", None):
                edit_history = json.loads(bi.edit_logs_json)
        except Exception:
            pass

        results.append({
            "id": bi.id,
            "item_id": bi.id,
            "slip_id": bs.id,
            "draw_date": d.draw_date,
            "session": d.session,
            "session_label": "Morning (12:01 PM)" if d.session == "morning" else "Evening (04:30 PM)",
            "nickname": u.nickname or u.username or "Player",
            "phone": u.phone,
            "number": bi.number,
            "amount": float(bi.item_stake or 0.0),
            "multiplier": payout_mult,
            "potential_win": float(bi.item_stake or 0.0) * payout_mult,
            "status": "Won" if bi.is_won > 0 else ("Lost" if d.status == "SETTLED" else "Pending"),
            "voucher": bs.slip_code,
            "created_at": bs.created_at.strftime("%d/%m/%Y %I:%M:%S %p") if bs.created_at else "",
            "is_edited": len(edit_history) > 0,
            "edit_history": edit_history,
            "is_editable": d.status == "OPEN"
        })

    return {
        "bets": results,
        "results": results,
        "total": total_count,
        "page": page,
        "limit": limit
    }

@router.put("/2d/bets/{item_id}/edit-number")
def edit_2d_bet_number(
    item_id: int,
    payload: Dict[str, Any] = Body(...),
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    raw_num = payload.get("new_number", "")
    clean_num = str(raw_num).strip().zfill(2)
    if not clean_num.isdigit() or len(clean_num) != 2:
        raise HTTPException(status_code=400, detail="2D ဂဏန်းသည် 00 မှ 99 အထိ ဂဏန်း ၂ လုံး ဖြစ်ရပါမည်။")

    bi = db.query(BetItem).filter(BetItem.id == item_id).first()
    if not bi:
        raise HTTPException(status_code=404, detail="2D Bet Item not found")
    bs = db.query(BetSlip).filter(BetSlip.id == bi.slip_id).first()
    d = db.query(TwoDDraw).filter(TwoDDraw.id == bs.draw_id).first() if bs else None

    if d and d.status == "SETTLED":
        raise HTTPException(status_code=400, detail="ထီပေါက်စဉ်ထွက်ပြီးဖြစ်၍ ပြင်ဆင်ခွင့်ပိတ်ထားပါသည်")

    old_number = bi.number
    bi.number = clean_num
    bi.combinations_json = json.dumps([clean_num])
    bi.combination_count = 1

    # Record audit log
    existing_logs = []
    try:
        if getattr(bi, "edit_logs_json", None):
            existing_logs = json.loads(bi.edit_logs_json)
    except Exception:
        pass
    existing_logs.append({
        "admin_id": admin_user.id,
        "admin_name": admin_user.nickname or admin_user.username or "Admin",
        "old_number": old_number,
        "new_number": clean_num,
        "changed_at": now_mmt().strftime("%d/%m/%Y %I:%M:%S %p"),
        "note": payload.get("note") or "Admin 2D manual edit"
    })
    bi.edit_logs_json = json.dumps(existing_logs)
    db.commit()
    return {"status": "success", "message": f"2D ဂဏန်းအား {clean_num} သို့ အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ"}


# =========================================================================
# 8. THAI 3D LOTTERY ADMIN CONTROLLERS & GAME MONITOR
# =========================================================================

def ensure_threed_draws_exist(db: Session):
    upcoming = db.query(ThreeDDraw).filter(ThreeDDraw.status == "OPEN").first()
    if not upcoming:
        db.add(ThreeDDraw(
            draw_date="2026-11-01",
            draw_time_mmt="03:30 PM MMT",
            cutoff_time_mmt="02:30 PM MMT",
            status="OPEN"
        ))

    past_cnt = db.query(ThreeDDraw).filter(ThreeDDraw.status == "SETTLED").count()
    if past_cnt == 0:
        db.add(ThreeDDraw(
            draw_date="2026-10-16", draw_time_mmt="03:30 PM MMT", cutoff_time_mmt="02:30 PM MMT",
            status="SETTLED", thai_first_prize="471782", winning_number="782",
            total_staked=12500000.0, total_payout=8750000.0, settled_at=now_mmt() - timedelta(days=7)
        ))
        db.add(ThreeDDraw(
            draw_date="2026-10-01", draw_time_mmt="03:30 PM MMT", cutoff_time_mmt="02:30 PM MMT",
            status="SETTLED", thai_first_prize="829394", winning_number="394",
            total_staked=11200000.0, total_payout=7840000.0, settled_at=now_mmt() - timedelta(days=22)
        ))
    db.commit()

@router.get("/3d/game")
def get_3d_game_monitor(
    draw_id: Optional[int] = None,
    mode: Optional[str] = "live",
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    ensure_threed_draws_exist(db)
    setting = db.query(SystemSetting).first()
    straight_payout = float(getattr(setting, "threed_straight_payout", 700.0) or 700.0)
    tote_payout = float(getattr(setting, "threed_tote_payout", 10.0) or 10.0)
    risk_cap = float(getattr(setting, "threed_max_risk_per_number", 200000.0) or 200000.0)

    if mode == "past":
        past_draws = db.query(ThreeDDraw).filter(ThreeDDraw.status == "SETTLED").order_by(ThreeDDraw.id.desc()).limit(10).all()
        return {
            "mode": "past",
            "past_draws": [
                {
                    "id": d.id,
                    "draw_date": d.draw_date,
                    "draw_time_mmt": d.draw_time_mmt,
                    "thai_first_prize": d.thai_first_prize,
                    "winning_number": d.winning_number,
                    "total_staked": d.total_staked,
                    "total_payout": d.total_payout,
                    "profit": d.total_staked - d.total_payout,
                    "status": d.status
                } for d in past_draws
            ]
        }

    open_draws = db.query(ThreeDDraw).filter(ThreeDDraw.status == "OPEN").order_by(ThreeDDraw.id.asc()).all()
    selected_draw = None
    if draw_id:
        selected_draw = db.query(ThreeDDraw).filter(ThreeDDraw.id == draw_id).first()
    if not selected_draw and open_draws:
        selected_draw = open_draws[0]

    closed_nums = set(selected_draw.closed_numbers if selected_draw else [])

    top_numbers = []
    total_staked = 0.0
    if selected_draw:
        bets_items = (
            db.query(BetItem.number, func.sum(BetItem.item_stake))
            .join(BetSlip, BetItem.slip_id == BetSlip.id)
            .filter(BetSlip.game_type == "3D", BetSlip.draw_id == selected_draw.id)
            .group_by(BetItem.number)
            .order_by(func.sum(BetItem.item_stake).desc())
            .limit(20)
            .all()
        )
        for num, total_stk in bets_items:
            clean_n = str(num).strip().zfill(3)
            val = float(total_stk or 0.0)
            top_numbers.append({
                "number": clean_n,
                "staked": val,
                "is_closed": clean_n in closed_nums,
                "liability": val * straight_payout
            })
            total_staked += val

    return {
        "mode": "live",
        "selected_draw": {
            "id": selected_draw.id if selected_draw else None,
            "draw_date": selected_draw.draw_date if selected_draw else None,
            "draw_time_mmt": selected_draw.draw_time_mmt if selected_draw else "03:30 PM MMT",
            "cutoff_time_mmt": selected_draw.cutoff_time_mmt if selected_draw else "02:30 PM MMT",
            "status": selected_draw.status if selected_draw else "OPEN",
            "closed_numbers": list(closed_nums)
        },
        "available_draws": [
            {
                "id": d.id,
                "draw_date": d.draw_date,
                "draw_time_mmt": d.draw_time_mmt,
                "cutoff_time_mmt": d.cutoff_time_mmt,
                "status": d.status
            } for d in open_draws
        ],
        "straight_payout": straight_payout,
        "tote_payout": tote_payout,
        "max_risk_cap": risk_cap,
        "total_staked": total_staked,
        "peak_liability": max((n["liability"] for n in top_numbers), default=0.0),
        "top_numbers": top_numbers,
        "is_3d_enabled": bool(getattr(setting, "is_3d_enabled", True) if getattr(setting, "is_3d_enabled", True) is not None else True)
    }

@router.post("/3d/closed-numbers")
def add_3d_closed_number(
    payload: Dict[str, Any] = Body(...),
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    draw_id = payload.get("draw_id")
    raw_num = payload.get("number", "")
    num_str = str(raw_num).strip().zfill(3)
    draw = db.query(ThreeDDraw).filter(ThreeDDraw.id == draw_id).first() if draw_id else db.query(ThreeDDraw).filter(ThreeDDraw.status == "OPEN").first()
    if not draw:
        raise HTTPException(status_code=404, detail="3D Draw not found")
    closed = draw.closed_numbers
    if num_str not in closed:
        closed.append(num_str)
        draw.closed_numbers_json = json.dumps(closed)
        db.commit()
    return {"status": "success", "closed_numbers": closed}

@router.delete("/3d/closed-numbers/{number}")
def remove_3d_closed_number(
    number: str,
    draw_id: Optional[int] = Query(None),
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    num_str = str(number).strip().zfill(3)
    draw = db.query(ThreeDDraw).filter(ThreeDDraw.id == draw_id).first() if draw_id else db.query(ThreeDDraw).filter(ThreeDDraw.status == "OPEN").first()
    if not draw:
        raise HTTPException(status_code=404, detail="3D Draw not found")
    closed = [n for n in draw.closed_numbers if n != num_str]
    draw.closed_numbers_json = json.dumps(closed)
    db.commit()
    return {"status": "success", "closed_numbers": closed}

@router.get("/3d/number-audit")
def get_3d_number_audit(
    number: str = Query(...),
    draw_id: Optional[int] = Query(None),
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    clean_num = str(number).strip().zfill(3)
    setting = db.query(SystemSetting).first()
    straight_payout = float(getattr(setting, "threed_straight_payout", 700.0) or 700.0)

    query = (
        db.query(BetItem, BetSlip, User)
        .join(BetSlip, BetItem.slip_id == BetSlip.id)
        .join(User, BetSlip.user_id == User.id)
        .filter(BetSlip.game_type == "3D", BetItem.number == clean_num)
    )
    if draw_id:
        query = query.filter(BetSlip.draw_id == draw_id)
    items = query.order_by(BetItem.id.desc()).all()

    total_staked = sum(float(bi.item_stake or 0.0) for bi, bs, u in items)
    bets_list = []
    for bi, bs, u in items:
        bets_list.append({
            "item_id": bi.id,
            "voucher": bs.slip_code,
            "nickname": u.nickname or u.username,
            "phone": u.phone,
            "number": bi.number,
            "bet_type": bi.bet_type or "Straight",
            "stake": float(bi.item_stake or 0.0),
            "payout": float(bi.item_stake or 0.0) * straight_payout,
            "created_at": bs.created_at.strftime("%d/%m/%Y %I:%M:%S %p") if bs.created_at else ""
        })

    return {
        "number": clean_num,
        "total_staked": total_staked,
        "peak_liability": total_staked * straight_payout,
        "bet_count": len(bets_list),
        "bets": bets_list
    }

@router.get("/3d/bets")
def get_3d_bets_history(
    page: int = 1,
    limit: int = 50,
    draw_id: Optional[int] = None,
    game_date: Optional[str] = None,
    nickname: Optional[str] = None,
    phone: Optional[str] = None,
    number: Optional[str] = None,
    status: Optional[str] = None,
    voucher: Optional[str] = None,
    is_edited: Optional[str] = None,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    ensure_threed_draws_exist(db)
    query = (
        db.query(BetItem, BetSlip, User, ThreeDDraw)
        .join(BetSlip, BetItem.slip_id == BetSlip.id)
        .join(User, BetSlip.user_id == User.id)
        .join(ThreeDDraw, BetSlip.draw_id == ThreeDDraw.id)
        .filter(BetSlip.game_type == "3D")
    )

    if draw_id:
        query = query.filter(ThreeDDraw.id == draw_id)
    if game_date:
        query = query.filter(ThreeDDraw.draw_date.contains(game_date))
    if nickname:
        query = query.filter(or_(User.nickname.ilike(f"%{nickname}%"), User.username.ilike(f"%{nickname}%")))
    if phone:
        query = query.filter(User.phone.contains(phone))
    if number:
        query = query.filter(BetItem.number == number.strip().zfill(3))
    if voucher:
        query = query.filter(BetSlip.slip_code.contains(voucher))

    edit_filter = (is_edited or "").strip().lower()
    if edit_filter in ["true", "1", "edited", "yes"]:
        query = query.filter(BetItem.edit_logs_json.isnot(None), BetItem.edit_logs_json != "[]", BetItem.edit_logs_json != "")
    elif edit_filter in ["false", "0", "original", "no"]:
        query = query.filter(or_(BetItem.edit_logs_json.is_(None), BetItem.edit_logs_json == "[]", BetItem.edit_logs_json == ""))

    total_count = query.count()
    items = query.order_by(BetItem.id.desc()).offset((page - 1) * limit).limit(limit).all()

    setting = db.query(SystemSetting).first()
    straight_payout = float(getattr(setting, "threed_straight_payout", 700.0) or 700.0)

    results = []
    for bi, bs, u, d in items:
        edit_history = []
        try:
            if getattr(bi, "edit_logs_json", None):
                edit_history = json.loads(bi.edit_logs_json)
        except Exception:
            pass

        results.append({
            "id": bi.id,
            "item_id": bi.id,
            "slip_id": bs.id,
            "draw_date": d.draw_date,
            "nickname": u.nickname or u.username or "Player",
            "phone": u.phone,
            "number": bi.number,
            "bet_type": (bi.bet_type or "straight").upper(),
            "amount": float(bi.item_stake or 0.0),
            "multiplier": straight_payout,
            "potential_win": float(bi.item_stake or 0.0) * straight_payout,
            "status": "Won" if bi.is_won > 0 else ("Lost" if d.status == "SETTLED" else "Pending"),
            "voucher": bs.slip_code,
            "created_at": bs.created_at.strftime("%d/%m/%Y %I:%M:%S %p") if bs.created_at else "",
            "is_edited": len(edit_history) > 0,
            "edit_history": edit_history,
            "is_editable": d.status == "OPEN"
        })

    return {
        "bets": results,
        "results": results,
        "total": total_count,
        "page": page,
        "limit": limit
    }

@router.put("/3d/bets/{item_id}/edit-number")
def edit_3d_bet_number(
    item_id: int,
    payload: Dict[str, Any] = Body(...),
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    raw_num = payload.get("new_number", "")
    clean_num = str(raw_num).strip().zfill(3)
    if not clean_num.isdigit() or len(clean_num) != 3:
        raise HTTPException(status_code=400, detail="3D ဂဏန်းသည် 000 မှ 999 အထိ ဂဏန်း ၃ လုံး ဖြစ်ရပါမည်။")

    bi = db.query(BetItem).filter(BetItem.id == item_id).first()
    if not bi:
        raise HTTPException(status_code=404, detail="3D Bet Item not found")
    bs = db.query(BetSlip).filter(BetSlip.id == bi.slip_id).first()
    d = db.query(ThreeDDraw).filter(ThreeDDraw.id == bs.draw_id).first() if bs else None

    if d and d.status == "SETTLED":
        raise HTTPException(status_code=400, detail="ထီပေါက်စဉ်ထွက်ပြီးဖြစ်၍ ပြင်ဆင်ခွင့်ပိတ်ထားပါသည်")

    old_number = bi.number
    bi.number = clean_num
    bi.combinations_json = json.dumps([clean_num])
    bi.combination_count = 1

    existing_logs = []
    try:
        if getattr(bi, "edit_logs_json", None):
            existing_logs = json.loads(bi.edit_logs_json)
    except Exception:
        pass
    existing_logs.append({
        "admin_id": admin_user.id,
        "admin_name": admin_user.nickname or admin_user.username or "Admin",
        "old_number": old_number,
        "new_number": clean_num,
        "changed_at": now_mmt().strftime("%d/%m/%Y %I:%M:%S %p"),
        "note": payload.get("note") or "Admin 3D manual edit"
    })
    bi.edit_logs_json = json.dumps(existing_logs)
    db.commit()
    return {"status": "success", "message": f"3D ဂဏန်းအား {clean_num} သို့ အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ"}

class Settle2DRequest(BaseModel):
    draw_id: int
    set_index: Optional[str] = ""
    set_value: Optional[str] = ""
    winning_number: str

@router.post("/2d/settle")
def settle_2d_draw(
    req: Settle2DRequest,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    draw = db.query(TwoDDraw).filter(TwoDDraw.id == req.draw_id).first()
    if not draw:
        raise HTTPException(status_code=404, detail="2D Draw မတွေ့ရှိပါ")

    clean_win = str(req.winning_number).strip().zfill(2)
    if not clean_win.isdigit() or len(clean_win) != 2:
        raise HTTPException(status_code=400, detail="2D ပေါက်ဂဏန်းသည် 00 မှ 99 အတွင်း ဂဏန်း ၂ လုံး ဖြစ်ရပါမည်")

    from app.core.twod_service import settle_twod_draw_internal
    return settle_twod_draw_internal(db, draw, clean_win, req.set_index, req.set_value)

def _unused_legacy_settle_2d_draw():

    setting = db.query(SystemSetting).first()
    payout_multiplier = float(getattr(setting, "twod_payout_multiplier", 85.0) or 85.0)

    draw.set_index = req.set_index.strip() if req.set_index else draw.set_index
    draw.set_value = req.set_value.strip() if req.set_value else draw.set_value
    draw.winning_number = clean_win
    draw.status = "SETTLED"
    draw.settled_at = now_mmt()

    slips = db.query(BetSlip).filter(
        BetSlip.game_type == "2D",
        BetSlip.draw_id == draw.id,
        BetSlip.status == BetSlipStatus.PENDING
    ).all()

    total_payout = 0.0
    total_staked = 0.0
    winners_count = 0
    today_str = now_mmt().strftime("%Y-%m-%d")

    for slip in slips:
        slip_payout = 0.0
        has_win = False
        total_staked += float(slip.total_stake or 0.0)

        for item in slip.items:
            clean_item_num = str(item.number).strip().zfill(2)
            if clean_item_num == clean_win:
                item_win = float(item.item_stake or 0.0) * payout_multiplier
                item.is_won = 1
                item.item_payout = item_win
                item.win_details_json = json.dumps([{"winning_number": clean_win, "payout": item_win}])
                slip_payout += item_win
                has_win = True
            else:
                item.is_won = 0
                item.item_payout = 0.0

        if has_win:
            slip.status = BetSlipStatus.WON
            slip.total_payout = slip_payout
            total_payout += slip_payout
            winners_count += 1

            slip.settled_at = now_mmt()
            player = db.query(User).filter(User.id == slip.user_id).first()
            if player:
                player.balance = float(player.balance or 0.0) + slip_payout
                win_tx = Transaction(
                    user_id=player.id,
                    tx_type=TransactionType.WIN_PAYOUT,
                    gateway="SG4D 2D",
                    transaction_id=slip.slip_code,
                    receiver_id=f"Player #{player.id} ({player.phone})",
                    amount=slip_payout,
                    slip_image_url=None,
                    client_timezone="MMT",
                    tx_timestamp_mmt=now_mmt(),
                    submission_timestamp_mmt=now_mmt(),
                    delta_minutes=0.0,
                    is_time_valid=True,
                    is_receiver_valid=True,
                    is_tx_unique=True,
                    status=TransactionStatus.COMPLETED,
                    verification_notes=f"2D Prize payout for ticket {slip.slip_code} ({clean_win}) - {draw.session.capitalize()} {draw.draw_date}",
                    created_at=now_mmt()
                )
                db.add(win_tx)

                win_ledger = FinancialLedger(
                    entry_type=LedgerEntryType.PAYOUT_EXPENSE,
                    amount=slip_payout,
                    running_balance=player.balance,
                    reference_id=slip.slip_code,
                    reference_type="BET_SLIP_2D_WIN",
                    description=f"2D အနိုင်ရငွေ ({clean_win}) - {draw.session.capitalize()} {draw.draw_date}",
                    logged_at_mmt=now_mmt(),
                    date_str=today_str
                )
                db.add(win_ledger)

                notif = Notification(
                    user_id=player.id,
                    title="🎉 ဂုဏ်ယူပါသည်! 2D ထီပေါက်ပါသည်",
                    message=f"သင်ထိုးထားသော 2D ဂဏန်း '{clean_win}' သည် {draw.session} တွင် ပေါက်ပြီး အနိုင်ရငွေ +{slip_payout:,.0f} ကျပ် အား လက်ကျန်ငွေထဲ ထည့်သွင်းပေးပြီးပါပြီ။",
                    notif_type="LOTTERY_WIN",
                    is_read=False
                )
                db.add(notif)
        else:
            slip.status = BetSlipStatus.LOST
            slip.total_payout = 0.0

    draw.total_staked = total_staked
    draw.total_payout = total_payout
    db.commit()

    return {
        "status": "success",
        "draw_id": draw.id,
        "winning_number": clean_win,
        "total_slips": len(slips),
        "winners_count": winners_count,
        "total_payout": total_payout
    }

class Settle3DRequest(BaseModel):
    draw_id: int
    thai_first_prize: Optional[str] = ""
    winning_number: str

@router.post("/3d/settle")
def settle_3d_draw(
    req: Settle3DRequest,
    admin_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    draw = db.query(ThreeDDraw).filter(ThreeDDraw.id == req.draw_id).first()
    if not draw:
        raise HTTPException(status_code=404, detail="3D Draw မတွေ့ရှိပါ")

    clean_win = str(req.winning_number).strip().zfill(3)
    if not clean_win.isdigit() or len(clean_win) != 3:
        raise HTTPException(status_code=400, detail="3D ပေါက်ဂဏန်းသည် 000 မှ 999 အတွင်း ဂဏန်း ၃ လုံး ဖြစ်ရပါမည်")

    setting = db.query(SystemSetting).first()
    straight_payout = float(getattr(setting, "threed_straight_payout", 700.0) or 700.0)

    draw.thai_first_prize = req.thai_first_prize.strip() if req.thai_first_prize else draw.thai_first_prize
    draw.winning_number = clean_win
    draw.status = "SETTLED"
    draw.settled_at = now_mmt()

    slips = db.query(BetSlip).filter(
        BetSlip.game_type == "3D",
        BetSlip.draw_id == draw.id,
        BetSlip.status == BetSlipStatus.PENDING
    ).all()

    total_payout = 0.0
    total_staked = 0.0
    winners_count = 0
    today_str = now_mmt().strftime("%Y-%m-%d")

    for slip in slips:
        slip_payout = 0.0
        has_win = False
        total_staked += float(slip.total_stake or 0.0)

        for item in slip.items:
            clean_item_num = str(item.number).strip().zfill(3)
            combos = []
            try:
                combos = json.loads(item.combinations_json) if item.combinations_json else [clean_item_num]
            except Exception:
                combos = [clean_item_num]

            if clean_win in combos:
                item_win = float(item.big_amount or item.item_stake or 0.0) * straight_payout
                item.is_won = 1
                item.item_payout = item_win
                item.win_details_json = json.dumps([{"winning_number": clean_win, "payout": item_win}])
                slip_payout += item_win
                has_win = True
            else:
                item.is_won = 0
                item.item_payout = 0.0

        if has_win:
            slip.status = BetSlipStatus.WON
            slip.total_payout = slip_payout
            total_payout += slip_payout
            winners_count += 1

            slip.settled_at = now_mmt()
            player = db.query(User).filter(User.id == slip.user_id).first()
            if player:
                player.balance = float(player.balance or 0.0) + slip_payout
                win_tx = Transaction(
                    user_id=player.id,
                    tx_type=TransactionType.WIN_PAYOUT,
                    gateway="SG4D 2D",
                    transaction_id=slip.slip_code,
                    receiver_id=f"Player #{player.id} ({player.phone})",
                    amount=slip_payout,
                    slip_image_url=None,
                    client_timezone="MMT",
                    tx_timestamp_mmt=now_mmt(),
                    submission_timestamp_mmt=now_mmt(),
                    delta_minutes=0.0,
                    is_time_valid=True,
                    is_receiver_valid=True,
                    is_tx_unique=True,
                    status=TransactionStatus.COMPLETED,
                    verification_notes=f"2D Prize payout for ticket {slip.slip_code} ({clean_win}) - {draw.session.capitalize()} {draw.draw_date}",
                    created_at=now_mmt()
                )
                db.add(win_tx)

                win_ledger = FinancialLedger(
                    entry_type=LedgerEntryType.PAYOUT_EXPENSE,
                    amount=slip_payout,
                    running_balance=player.balance,
                    reference_id=slip.slip_code,
                    reference_type="BET_SLIP_3D_WIN",
                    description=f"3D အနိုင်ရငွေ ({clean_win}) - Draw {draw.draw_date}",
                    logged_at_mmt=now_mmt(),
                    date_str=today_str
                )
                db.add(win_ledger)

                notif = Notification(
                    user_id=player.id,
                    title="🎉 ဂုဏ်ယူပါသည်! 3D ထီပေါက်ပါသည်",
                    message=f"သင်ထိုးထားသော 3D ဂဏန်း '{clean_win}' သည် {draw.draw_date} ပွဲစဉ်တွင် ပေါက်ပြီး အနိုင်ရငွေ +{slip_payout:,.0f} ကျပ် အား လက်ကျန်ငွေထဲ ထည့်သွင်းပေးပြီးပါပြီ။",
                    notif_type="LOTTERY_WIN",
                    is_read=False
                )
                db.add(notif)
        else:
            slip.status = BetSlipStatus.LOST
            slip.total_payout = 0.0

    draw.total_staked = total_staked
    draw.total_payout = total_payout
    db.commit()

    return {
        "status": "success",
        "draw_id": draw.id,
        "winning_number": clean_win,
        "total_slips": len(slips),
        "winners_count": winners_count,
        "total_payout": total_payout
    }
