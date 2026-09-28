import sys
import os
from sqlalchemy import text

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.session import engine, SessionLocal, Base
from app.models.user import Admin, UserRole
from app.models.attendance import Camera, AttendanceSetting
from app.core.security import get_password_hash

def reset_db_minimal():
    print("Recreating database tables from scratch...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("1. Creating System Admins...")
        admin = Admin(
            full_name="System Administrator",
            email="admin@library.com",
            hashed_password=get_password_hash("admin123"),
            role=UserRole.ADMIN,
            is_active=True
        )
        librarian = Admin(
            full_name="Chief Librarian",
            email="librarian@library.com",
            hashed_password=get_password_hash("lib123"),
            role=UserRole.LIBRARIAN,
            is_active=True
        )
        db.add_all([admin, librarian])
        db.commit()

        print("2. Creating Attendance Settings...")
        settings_defaults = [
            ("FACE_RECOGNITION_THRESHOLD", "0.60", "Minimum confidence required for automatic attendance matching"),
            ("ATTENDANCE_COOLDOWN_SECONDS", "300", "Cooldown period in seconds to prevent duplicate attendance"),
            ("AUTO_CHECKOUT_HOURS", "8", "Automatic check-out after N hours if unclosed"),
            ("OVERDUE_FINE_PER_DAY", os.getenv("OVERDUE_FINE_PER_DAY", "").strip(), "Optional overdue fine per day; leave blank to disable fines")
        ]
        for key, val, desc in settings_defaults:
            db.add(AttendanceSetting(setting_key=key, setting_value=val, description=desc))
        
        camera_id = os.getenv("CAMERA_ID", "").strip()
        if camera_id:
            db.add(Camera(
                camera_code=camera_id,
                name=os.getenv("CAMERA_NAME", camera_id).strip() or camera_id,
                location=os.getenv("CAMERA_LOCATION", "").strip() or "Unspecified location",
                stream_url_or_index=os.getenv("CAMERA_SOURCE", os.getenv("CAMERA_INDEX", "")).strip(),
                status="Active"
            ))
        else:
            print("No persistent camera configured; browser Live Attendance will use its authenticated webcam.")
        db.commit()

        print("Database successfully reset!")
        print("No demo students, departments, courses, books, attendance, or sample records were created.")
        print("Ready for real student registration and book addition.")
        print("\nLogin Credentials:")
        print("  Admin:     admin@library.com / admin123")
        print("  Librarian: librarian@library.com / lib123")

    except Exception as e:
        db.rollback()
        print(f"Error resetting database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    reset_db_minimal()
