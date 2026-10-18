import os
import json
import gzip
from datetime import datetime, timedelta
from typing import Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.config import settings
from app.database import SessionLocal
from app.models.bet import BetSlip, BetArchive, BetSlipStatus
from app.models.transaction import Transaction, TransactionArchive, TransactionStatus
from app.core.timezone_utils import now_mmt

ARCHIVE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "archives")

def ensure_archive_dir():
    if not os.path.exists(ARCHIVE_DIR):
        os.makedirs(ARCHIVE_DIR, exist_ok=True)

def archive_old_records(retention_days: int = None) -> Dict[str, Any]:
    """
    Archives settled bets and completed transactions older than `retention_days` (default 90 days / 3 months).
    1. Copies records to BetArchive and TransactionArchive tables.
    2. Writes a compressed JSON backup to disks `archives/archive_YYYYMMDD.json.gz`.
    3. Safely deletes them from active primary tables to keep indexes lightweight.
    """
    ensure_archive_dir()
    if retention_days is None:
        retention_days = settings.ARCHIVE_RETENTION_DAYS

    cutoff_date = now_mmt() - timedelta(days=retention_days)
    db: Session = SessionLocal()

    archived_bets_count = 0
    archived_tx_count = 0
    exported_data = {"bets": [], "transactions": [], "cutoff_date": cutoff_date.isoformat()}

    try:
        # 1. Query settled bets older than cutoff
        old_slips = db.query(BetSlip).filter(
            BetSlip.created_at < cutoff_date,
            BetSlip.status.in_([BetSlipStatus.WON, BetSlipStatus.LOST, BetSlipStatus.CANCELLED])
        ).all()

        for slip in old_slips:
            # Prepare items snapshot
            items_snapshot = [
                {
                    "number": item.number,
                    "bet_type": item.bet_type,
                    "big_amount": item.big_amount,
                    "small_amount": item.small_amount,
                    "item_stake": item.item_stake,
                    "item_payout": item.item_payout,
                    "is_won": item.is_won
                }
                for item in slip.items
            ]

            archive_entry = BetArchive(
                original_slip_id=slip.id,
                slip_code=slip.slip_code,
                user_id=slip.user_id,
                draw_id=slip.draw_id,
                total_stake=slip.total_stake,
                total_payout=slip.total_payout,
                status=str(slip.status.value),
                items_data_json=json.dumps(items_snapshot),
                bet_created_at=slip.created_at,
                archived_at=now_mmt()
            )
            db.add(archive_entry)
            
            exported_data["bets"].append({
                "slip_code": slip.slip_code,
                "user_id": slip.user_id,
                "stake": slip.total_stake,
                "payout": slip.total_payout,
                "status": str(slip.status.value),
                "created_at": slip.created_at.isoformat(),
                "items": items_snapshot
            })

            # Delete active slip (cascade deletes items)
            db.delete(slip)
            archived_bets_count += 1

        # 2. Query completed / expired transactions older than cutoff
        old_txs = db.query(Transaction).filter(
            Transaction.created_at < cutoff_date,
            Transaction.status.in_([
                TransactionStatus.AUTO_APPROVED,
                TransactionStatus.COMPLETED,
                TransactionStatus.REJECTED,
                TransactionStatus.FLAGGED_EXPIRED
            ])
        ).all()

        for tx in old_txs:
            archive_tx = TransactionArchive(
                original_tx_id=tx.id,
                user_id=tx.user_id,
                tx_type=str(tx.tx_type.value),
                gateway=tx.gateway,
                transaction_id=tx.transaction_id,
                receiver_id=tx.receiver_id,
                amount=tx.amount,
                status=str(tx.status.value),
                tx_timestamp_mmt=tx.tx_timestamp_mmt,
                submission_timestamp_mmt=tx.submission_timestamp_mmt,
                verification_notes=tx.verification_notes,
                created_at=tx.created_at,
                archived_at=now_mmt()
            )
            db.add(archive_tx)

            exported_data["transactions"].append({
                "transaction_id": tx.transaction_id,
                "user_id": tx.user_id,
                "gateway": tx.gateway,
                "amount": tx.amount,
                "status": str(tx.status.value),
                "created_at": tx.created_at.isoformat()
            })

            # Delete from active table
            db.delete(tx)
            archived_tx_count += 1

        # 3. Write compressed backup if any records archived
        if archived_bets_count > 0 or archived_tx_count > 0:
            timestamp_str = now_mmt().strftime("%Y%m%d_%H%M%S")
            backup_filename = os.path.join(ARCHIVE_DIR, f"archive_{timestamp_str}.json.gz")
            with gzip.open(backup_filename, "wt", encoding="utf-8") as f:
                json.dump(exported_data, f, ensure_ascii=False)

        db.commit()

        return {
            "status": "success",
            "archived_bets_count": archived_bets_count,
            "archived_transactions_count": archived_tx_count,
            "cutoff_date_mmt": cutoff_date.strftime("%Y-%m-%d %H:%M:%S MMT"),
            "retention_days": retention_days
        }

    except Exception as e:
        db.rollback()
        return {
            "status": "error",
            "error": str(e)
        }
    finally:
        db.close()
