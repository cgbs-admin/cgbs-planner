from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Replace YOUR_PASSWORD_HERE with the password you set for cgb_user
DATABASE_URL = "postgresql://cgb_user:2h2mAb$d8aFLmx7uq@localhost:5432/cgb_events"

engine = create_engine(DATABASE_URL, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# Dependency for FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

