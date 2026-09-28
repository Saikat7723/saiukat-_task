import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import get_password_hash
from app.database.session import Base, get_db
from app.main import app
from app.models.academic import Course, Department
from app.models.student import Student


def test_student_can_login_and_read_only_own_portal(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'student.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as db:
        department = Department(code="REAL", name="Real Department")
        db.add(department)
        db.flush()
        course = Course(code="REAL-COURSE", name="Real Course", department_id=department.id)
        db.add(course)
        db.flush()
        student = Student(
            student_id="2026001", full_name="Portal Student", email="portal@example.edu",
            hashed_password=get_password_hash("a-real-password"), department_id=department.id,
            course_id=course.id, status="Active",
        )
        db.add(student)
        db.commit()

    def override_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    try:
        with TestClient(app) as client:
            login = client.post("/api/auth/login", json={"username_or_email": "2026001", "password": "a-real-password"})
            assert login.status_code == 200
            assert login.json()["user"]["role"] == "student"
            headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
            dashboard = client.get("/api/student/dashboard", headers=headers)
            assert dashboard.status_code == 200
            assert dashboard.json()["student"]["student_id"] == "2026001"
            # Student tokens cannot access admin records.
            assert client.get("/api/students", headers=headers).status_code == 401
    finally:
        app.dependency_overrides.clear()
        engine.dispose()
