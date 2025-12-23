from getpass import getpass

from database import SessionLocal
from models import User
from main import get_password_hash


def main():
    db = SessionLocal()

    username = input("Admin username: ").strip()
    password = getpass("Admin password: ").strip()

    existing = db.query(User).filter(User.username == username).first()
    if existing:
        print("User already exists.")
        return

    user = User(
        username=username,
        password_hash=get_password_hash(password),
        role="admin",
        is_active=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    print(f"Admin user created with ID: {user.id}")

    db.close()


if __name__ == "__main__":
    main()
