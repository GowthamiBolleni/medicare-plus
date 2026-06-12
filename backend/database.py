import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Database Configuration
# Fall back to SQLite if PostgreSQL connection is not set or fails
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Use standard SQLite local database in the current folder
    db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "medicare.db"))
    DATABASE_URL = f"sqlite:///{db_path}"
    print(f"[Database] Using local SQLite database at {db_path}")
else:
    print("[Database] Using PostgreSQL database from DATABASE_URL")

# Create Engine
# Note: connect_args={"check_same_thread": False} is only needed for SQLite
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
