from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

db_url = settings.DATABASE_URL

if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(db_url, connect_args=connect_args, echo=False)
else:
    # Render provides URLs starting with 'postgres://', which SQLAlchemy 2.0 requires to be 'postgresql://'
    clean_url = db_url
    if clean_url.startswith("postgres://"):
        clean_url = clean_url.replace("postgres://", "postgresql://", 1)

    try:
        # 1. Try psycopg2 (rock-solid, standard PostgreSQL driver for SQLAlchemy)
        psycopg2_url = clean_url.replace("postgresql://", "postgresql+psycopg2://", 1)
        engine = create_engine(psycopg2_url, pool_pre_ping=True, pool_recycle=300, pool_size=10, max_overflow=20, connect_args={"options": "-c statement_timeout=15000"}, echo=False)
    except Exception:
        try:
            # 2. Try psycopg 3
            psycopg3_url = clean_url.replace("postgresql://", "postgresql+psycopg://", 1)
            engine = create_engine(psycopg3_url, pool_pre_ping=True, pool_recycle=300, pool_size=10, max_overflow=20, connect_args={"options": "-c statement_timeout=15000"}, echo=False)
        except Exception:
            # 3. Fallback to standard postgresql://
            engine = create_engine(clean_url, pool_pre_ping=True, pool_recycle=300, pool_size=10, max_overflow=20, connect_args={"options": "-c statement_timeout=15000"}, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
