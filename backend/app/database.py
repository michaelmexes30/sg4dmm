from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

db_url = settings.DATABASE_URL
# Render provides URLs starting with 'postgres://', which SQLAlchemy 2.0 requires to be 'postgresql://'
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# SQLite multi-threaded support vs PostgreSQL connection pooling
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(db_url, connect_args=connect_args, echo=False)
else:
    # PostgreSQL configuration on Render
    engine = create_engine(
        db_url,
        pool_pre_ping=True,      # Automatically reconnects dropped connections
        pool_recycle=300,        # Recycles connections every 5 minutes
        echo=False
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
