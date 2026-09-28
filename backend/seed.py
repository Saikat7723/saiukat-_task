import sys
import os
from datetime import datetime, date, timedelta
import json
import numpy as np

# Add parent directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.session import engine, SessionLocal, Base
from app.models.user import Admin, UserRole
from app.models.academic import Department, Course
from app.models.student import Student, StudentFaceProfile
from app.models.attendance import Camera, AttendanceSetting, AttendanceSession, AttendanceEvent, Holiday
from app.models.book import BookCategory, BookAuthor, Book, BookIssue
from app.core.security import get_password_hash
from app.face_recognition.engine import face_engine

def seed_database():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("Seeding Admins...")
        admin = db.query(Admin).filter(Admin.email == "admin@library.com").first()
        if not admin:
            admin = Admin(
                full_name="System Administrator",
                email="admin@library.com",
                hashed_password=get_password_hash("admin123"),
                role=UserRole.ADMIN,
                is_active=True
            )
            db.add(admin)

        librarian = db.query(Admin).filter(Admin.email == "librarian@library.com").first()
        if not librarian:
            librarian = Admin(
                full_name="Chief Librarian",
                email="librarian@library.com",
                hashed_password=get_password_hash("lib123"),
                role=UserRole.LIBRARIAN,
                is_active=True
            )
            db.add(librarian)

        db.commit()

        print("Seeding Attendance Settings & Camera...")
        settings_defaults = [
            ("FACE_RECOGNITION_THRESHOLD", "0.60", "Minimum confidence required for automatic attendance matching"),
            ("ATTENDANCE_COOLDOWN_SECONDS", "300", "Cooldown period in seconds to prevent duplicate attendance"),
            ("AUTO_CHECKOUT_HOURS", "8", "Automatic check-out after N hours if unclosed"),
            ("OVERDUE_FINE_PER_DAY", os.getenv("OVERDUE_FINE_PER_DAY", "").strip(), "Optional overdue fine per day; leave blank to disable fines")
        ]
        for key, val, desc in settings_defaults:
            st = db.query(AttendanceSetting).filter(AttendanceSetting.setting_key == key).first()
            if not st:
                db.add(AttendanceSetting(setting_key=key, setting_value=val, description=desc))
        db.commit()

        camera_id = os.getenv("CAMERA_ID", "").strip()
        if camera_id:
            camera = db.query(Camera).filter(Camera.camera_code == camera_id).first()
            if not camera:
                camera = Camera(
                    camera_code=camera_id,
                    name=os.getenv("CAMERA_NAME", camera_id).strip() or camera_id,
                    location=os.getenv("CAMERA_LOCATION", "").strip() or "Unspecified location",
                    stream_url_or_index=os.getenv("CAMERA_SOURCE", os.getenv("CAMERA_INDEX", "")).strip(),
                    status="Active"
                )
                db.add(camera)
                db.commit()
        else:
            print("No persistent camera configured; browser Live Attendance will use its authenticated webcam.")

        db.commit()
        print("Base setup complete. No students, books, attendance, or sample records were created.")
        print("Default Credentials:")
        print("  Admin:     admin@library.com / admin123")
        print("  Librarian: librarian@library.com / lib123")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
