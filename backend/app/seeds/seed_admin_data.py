from app.database import SessionLocal
from app.models.user import User, UserRole, Notification
from app.models.settings import SystemSetting, ApplicationRelease
from app.models.transaction import Transaction, TransactionType, TransactionStatus
from app.core.security import hash_password
from app.core.timezone_utils import now_mmt
from datetime import datetime, timedelta

def seed_admin_and_system_data():
    db = SessionLocal()
    default_pw = hash_password("admin123")

    # 1. System Users from Screenshot 6
    # #16 mglikko (Admin)
    # #19 mgnitoot (Admin)
    # #21 mgkoye (Admin)
    # #23 mgpu (Admin)
    # #86 rlu (Agent, Suspended=Yes)
    # #2186 CS1 (Customer Service)
    # #2305 CS2 (Customer Service)
    system_users_data = [
        {"username": "mglikko", "nickname": "mglikko", "role": UserRole.ADMIN, "phone": "09790000016", "is_suspended": False},
        {"username": "mgnitoot", "nickname": "mgnitoot", "role": UserRole.ADMIN, "phone": "09790000019", "is_suspended": False},
        {"username": "mgkoye", "nickname": "mgkoye", "role": UserRole.ADMIN, "phone": "09790000021", "is_suspended": False},
        {"username": "mgpu", "nickname": "mgpu", "role": UserRole.ADMIN, "phone": "09790000023", "is_suspended": False},
        {"username": "rlu", "nickname": "rlu", "role": UserRole.AGENT, "phone": "09790000086", "is_suspended": True},
        {"username": "CS1", "nickname": "CS1", "role": UserRole.CUSTOMER_SERVICE, "phone": "09790002186", "is_suspended": False},
        {"username": "CS2", "nickname": "CS2", "role": UserRole.CUSTOMER_SERVICE, "phone": "09790002305", "is_suspended": False},
    ]

    for su in system_users_data:
        existing = db.query(User).filter(User.username == su["username"]).first()
        if not existing:
            u = User(
                username=su["username"],
                nickname=su["nickname"],
                full_name=su["username"].capitalize(),
                phone=su["phone"],
                hashed_password=default_pw,
                role=su["role"],
                balance=100000.0,
                is_active=True,
                is_suspended=su["is_suspended"],
                is_verified=True,
                is_simulated=False
            )
            db.add(u)
        else:
            existing.nickname = su["nickname"]
            existing.role = su["role"]
            existing.is_suspended = su["is_suspended"]

    # 2. System Settings with 4-Tier Agent Commission
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(db.bind)
        cols = [c['name'] for c in inspector.get_columns('system_settings')]
        new_cols = [
            ("agent_tier1_turnover", "FLOAT DEFAULT 3000000.0"),
            ("agent_tier1_commission", "FLOAT DEFAULT 15.0"),
            ("agent_tier2_turnover", "FLOAT DEFAULT 6000000.0"),
            ("agent_tier2_commission", "FLOAT DEFAULT 20.0"),
            ("agent_tier3_turnover", "FLOAT DEFAULT 10000000.0"),
            ("agent_tier3_commission", "FLOAT DEFAULT 25.0"),
            ("agent_tier4_turnover", "FLOAT DEFAULT 15000000.0"),
            ("agent_tier4_commission", "FLOAT DEFAULT 30.0"),
            ("telegram_finance_group_id", "VARCHAR(50)"),
            ("auto_approve_max_amount", "FLOAT DEFAULT 50000.0"),
        ]
        for col_name, col_type in new_cols:
            if col_name not in cols:
                try:
                    db.execute(text(f"ALTER TABLE system_settings ADD COLUMN {col_name} {col_type}"))
                    db.commit()
                except Exception as ex:
                    print(f"Notice adding {col_name}: {ex}")

        # Check transactions table for slip_hash
        tx_cols = [c['name'] for c in inspector.get_columns('transactions')]
        if 'slip_hash' not in tx_cols:
            try:
                db.execute(text("ALTER TABLE transactions ADD COLUMN slip_hash VARCHAR(64)"))
                db.commit()
            except Exception as ex:
                print(f"Notice adding slip_hash to transactions: {ex}")
    except Exception as e:
        print(f"System settings inspection notice: {e}")

    setting = db.query(SystemSetting).first()
    if not setting:
        setting = SystemSetting(
            wave_phone="09894169717",
            wave_name="Ye Win Htut",
            wave_qr_url="/assets/wave_qr_sample.png",
            kpay_phone="09795007441",
            kpay_name="Daw Myo Thiri Khin",
            kpay_qr_url="/assets/kpay_qr_sample.png",
            bet_end_time="04:30 PM",
            result_confirm_time="06:00 PM",
            consecutive_reward_percent=20.0,
            min_amount_per_bet=50.0,
            max_amount_per_bet=10000.0,
            max_amount_per_slip=100000.0,
            max_amount_per_number=11000.0,
            default_bet_amount=100.0,
            company_balance_oct=4198200.0,
            agent_tier1_turnover=3000000.0,
            agent_tier1_commission=15.0,
            agent_tier2_turnover=6000000.0,
            agent_tier2_commission=20.0,
            agent_tier3_turnover=10000000.0,
            agent_tier3_commission=25.0,
            agent_tier4_turnover=15000000.0,
            agent_tier4_commission=30.0,
            agent_lvl2_target_turnover=6000000.0,
            agent_lvl3_target_turnover=10000000.0,
            agent_lvl4_target_turnover=15000000.0
        )
        db.add(setting)
    else:
        # Strictly ensure official company receiver accounts are synchronized
        setting.kpay_phone = "09795007441"
        setting.kpay_name = "Daw Myo Thiri Khin"
        setting.wave_phone = "09894169717"
        setting.wave_name = "Ye Win Htut"
        # Update 4-Tier Commission & Turnover Settings
        setting.agent_tier1_turnover = 3000000.0
        setting.agent_tier1_commission = 15.0
        setting.agent_tier2_turnover = 6000000.0
        setting.agent_tier2_commission = 20.0
        setting.agent_tier3_turnover = 10000000.0
        setting.agent_tier3_commission = 25.0
        setting.agent_tier4_turnover = 15000000.0
        setting.agent_tier4_commission = 30.0
        setting.agent_lvl2_target_turnover = 6000000.0
        setting.agent_lvl3_target_turnover = 10000000.0
        setting.agent_lvl4_target_turnover = 15000000.0

    # 3. Application Releases from Screenshot 14
    app_releases = [
        {"name": "Salone4D_V1.0.1", "build_number": 2, "version": "1.0.1"},
        {"name": "Salone4D_V1.0.2", "build_number": 3, "version": "1.0.2"},
        {"name": "Salone4D_V1.0.3", "build_number": 4, "version": "1.0.3"},
        {"name": "Salone4D_V1.0.4", "build_number": 5, "version": "1.0.4"},
        {"name": "Salone4D_V1.0.5", "build_number": 6, "version": "1.0.5"},
        {"name": "Salone4D_V1.0.6", "build_number": 7, "version": "1.0.6"},
        {"name": "Salone4D_V1.0.8", "build_number": 9, "version": "1.0.8"},
        {"name": "Salone4D_V1.0.12", "build_number": 21, "version": "1.0.12"},
        {"name": "Salone4D_V1.0.13", "build_number": 22, "version": "1.0.13"},
        {"name": "Salone4D_V1.0.15", "build_number": 24, "version": "1.0.15"}
    ]
    for rel in app_releases:
        existing_rel = db.query(ApplicationRelease).filter(ApplicationRelease.name == rel["name"]).first()
        if not existing_rel:
            ar = ApplicationRelease(
                name=rel["name"],
                build_number=rel["build_number"],
                version=rel["version"]
            )
            db.add(ar)

    # 4. Pending & Historical Withdrawals matching Screenshot 3, 4, 5
    # e.g. Phone 09444012884, May, Kpay, Daw May War Soe, Amount 8,000, Pending / Success
    sample_withdraw_user = db.query(User).filter(User.phone == "09444012884").first()
    if not sample_withdraw_user:
        sample_withdraw_user = User(
            username="may44",
            nickname="May",
            full_name="Daw May War Soe",
            phone="09444012884",
            hashed_password=default_pw,
            role=UserRole.USER,
            balance=10000.0,
            is_active=True,
            is_verified=True
        )
        db.add(sample_withdraw_user)
        db.flush()

    # Create a pending withdrawal for testing modal approval
    existing_pending = db.query(Transaction).filter(
        Transaction.user_id == sample_withdraw_user.id,
        Transaction.tx_type == TransactionType.WITHDRAWAL,
        Transaction.status == TransactionStatus.MANUAL_REVIEW
    ).first()
    if not existing_pending:
        tx_pending = Transaction(
            user_id=sample_withdraw_user.id,
            tx_type=TransactionType.WITHDRAWAL,
            gateway="kpay",
            transaction_id="WD2297",
            receiver_id="09444012884",
            amount=8000.0,
            status=TransactionStatus.MANUAL_REVIEW,
            tx_timestamp_mmt=now_mmt(),
            submission_timestamp_mmt=now_mmt(),
            is_time_valid=True,
            is_receiver_valid=True,
            verification_notes="KPay Account: Daw May War Soe (09444012884)",
            created_at=now_mmt()
        )
        db.add(tx_pending)

    # 5. Broadcast Announcement from Screenshot 16
    existing_notif = db.query(Notification).filter(Notification.category == "Announcement").first()
    if not existing_notif:
        ann = Notification(
            user_id=None,
            title="(4D congratulation)",
            message="ဒီနေ့ ပေါက်သွားတဲ့သူတွေအကုန်လုံး congratulations ပါ။ စနေနေ့မှာထပ်တွေ့ကြမယ်နော် အားလုံးကံထူးကြပါစေရှင့် 🙏",
            category="Announcement",
            notif_type="ANNOUNCEMENT",
            is_read=False,
            created_at=now_mmt()
        )
        db.add(ann)

    # 6. Sanitize existing payout notifications: remove winning ticket counts & payout sums
    try:
        import re
        payout_notifs = db.query(Notification).filter(Notification.message.like("%winning tickets%")).all()
        for pn in payout_notifs:
            pn.message = re.sub(r'\s*\(\d+\s+winning tickets[^\)]*\)', '', pn.message)
    except Exception as e:
        print(f"Error sanitizing notifications: {e}")

    db.commit()
    print("Admin & system seed data populated successfully!")
    db.close()

if __name__ == "__main__":
    seed_admin_and_system_data()
