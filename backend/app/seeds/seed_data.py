import json
from datetime import datetime, timedelta
from app.database import SessionLocal, Base, engine
from app.models.user import User, UserRole, Notification
from app.models.lottery import LotteryDraw, DrawStatus
from app.models.bet import BetSlip, BetItem, BetSlipStatus
from app.models.transaction import Transaction, TransactionStatus, TransactionType
from app.models.ledger import FinancialLedger, LedgerEntryType, DailyLedgerSummary
from app.core.security import hash_password
from app.core.timezone_utils import now_mmt

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Check if already seeded
    if db.query(User).filter(User.phone == "09777777777").first():
        print("Database already contains up-to-date agent seed data.")
        db.close()
        return

    print("Seeding updated SG4DMyanmar v2.0 data with Referral & Agent codes...")

    # 1. Chief Administrator (Admin Code ADM001)
    admin = db.query(User).filter(User.phone == "09999999999").first()
    if not admin:
        admin = User(
            phone="09999999999",
            full_name="Chief Administrator",
            hashed_password=hash_password("Admin123!"),
            role=UserRole.ADMIN,
            balance=10000000.0,
            country_code="+95",
            agent_code="ADM001"
        )
        db.add(admin)
    else:
        admin.agent_code = "ADM001"

    # 2. Master Agent (Agent Code AGT8899)
    agent = db.query(User).filter(User.phone == "09777777777").first()
    if not agent:
        agent = User(
            username="dawhlahla",
            nickname="Daw Hla Hla",
            phone="09777777777",
            full_name="Daw Hla Hla (Master Agent)",
            hashed_password=hash_password("Agent123!"),
            role=UserRole.AGENT,
            balance=1500000.0,
            country_code="+95",
            agent_code="AGT8899",
            commission_rate=0.30,
            total_commission_earned=45000.0
        )
        db.add(agent)
    db.flush()

    # 3. Demo Player (Referred by AGT8899)
    player = db.query(User).filter(User.phone == "09888888888").first()
    if not player:
        player = User(
            phone="09888888888",
            full_name="Ko Aung Min",
            hashed_password=hash_password("Player123!"),
            role=UserRole.USER,
            balance=350000.0,
            country_code="+95",
            referred_by_code="AGT8899",
            agent_id=agent.id
        )
        db.add(player)
    else:
        player.referred_by_code = "AGT8899"
        player.agent_id = agent.id

    db.flush()

    # 4. Singapore 4D Draws
    # Settled Draw in previous week (e.g., Saturday 2026-10-10)
    settled_draw = db.query(LotteryDraw).filter(LotteryDraw.draw_number == "5421/26").first()
    if not settled_draw:
        settled_draw = LotteryDraw(
            draw_number="5421/26",
            draw_date="2026-10-10",
            draw_time_mmt="06:00 PM MMT",
            status=DrawStatus.SETTLED,
            first_prize="7194",
            second_prize="4820",
            third_prize="1538",
            starter_prizes_json=json.dumps([
                "0492", "3810", "6491", "2840", "9912",
                "5319", "7402", "1184", "8492", "3028"
            ]),
            consolidation_prizes_json=json.dumps([
                "4410", "9102", "3748", "6192", "8823",
                "1038", "5591", "2948", "7710", "0194"
            ]),
            total_pool_stake=4500000.0,
            total_payout=3200000.0,
            settled_at=now_mmt() - timedelta(days=3)
        )
        db.add(settled_draw)
        db.flush()

        # Seed a qualifying bet of 20,000 MMK for player on this draw day to demonstrate 10% Weekly Bonus!
        demo_slip = db.query(BetSlip).filter(BetSlip.slip_code == "SLIP-QUALIFY-20261010").first()
        if not demo_slip:
            demo_slip = BetSlip(
                slip_code="SLIP-QUALIFY-20261010",
                user_id=player.id,
                agent_id=agent.id,
                agent_commission=6000.0, # 30% of 20,000
                draw_id=settled_draw.id,
                total_stake=20000.0,
                total_payout=0.0,
                status=BetSlipStatus.LOST,
                created_at=now_mmt() - timedelta(days=3)
            )
            db.add(demo_slip)

    # Active OPEN Draw
    active_draw = db.query(LotteryDraw).filter(LotteryDraw.draw_number == "5422/26").first()
    if not active_draw:
        active_draw = LotteryDraw(
            draw_number="5422/26",
            draw_date="2026-10-14",
            draw_time_mmt="06:00 PM MMT (Singapore 4D Wed)",
            status=DrawStatus.OPEN,
            total_pool_stake=1250000.0,
            total_payout=0.0
        )
        db.add(active_draw)

    # Notification
    welcome_notif = db.query(Notification).filter(Notification.user_id == player.id, Notification.title == "🌟 Welcome to SG4D Myanmar").first()
    if not welcome_notif:
        welcome_notif = Notification(
            user_id=player.id,
            title="🌟 Welcome to SG4D Myanmar",
            message="Your account is active under Agent AGT8899. Minimum bet is 50 MMK. Remember: Bets strictly close at 4:30 PM MMT on draw days!",
            notif_type="SYSTEM",
            is_read=False
        )
        db.add(welcome_notif)

    db.commit()
    db.close()
    print("Seed data successfully updated!")

if __name__ == "__main__":
    seed_database()
