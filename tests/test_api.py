import sys
import os
import pytest
from datetime import date, datetime, timedelta
from urllib.parse import parse_qs, urlparse

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database.session import Base, get_db
from app.core.security import get_password_hash
from app.models.user import Admin, UserRole
from app.models.academic import Department, Course
from app.models.student import Student
from app.models.book import Book, BookCategory, BookAuthor, BookIssue
from app.models.attendance import AttendanceSession, AttendanceSetting

# Setup isolated SQLite test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    
    # Seed default test admin
    admin = Admin(
        full_name="Test Admin",
        email="admin@test.com",
        hashed_password=get_password_hash("password123"),
        role=UserRole.ADMIN,
        is_active=True
    )
    session.add(admin)
    
    # Seed department & course
    dept = Department(code="CS", name="Computer Science")
    session.add(dept)
    session.flush()

    course = Course(code="BSCS", name="B.S. CS", department_id=dept.id)
    session.add(course)
    session.flush()

    # Seed book category & author & book
    cat = BookCategory(name="CS", code="CS")
    author = BookAuthor(name="Robert Martin")
    session.add(cat)
    session.add(author)
    session.flush()

    book = Book(
        isbn="1234567890",
        title="Test Driven Development",
        author_id=author.id,
        category_id=cat.id,
        total_copies=3,
        available_copies=3
    )
    session.add(book)
    session.commit()

    yield session

    session.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="module")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def test_login_success(client):
    response = client.post("/api/auth/login", json={
        "username_or_email": "admin@test.com",
        "password": "password123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_login_failure(client):
    response = client.post("/api/auth/login", json={
        "username_or_email": "admin@test.com",
        "password": "wrongpassword"
    })
    assert response.status_code == 401

def test_student_crud(client):
    # Obtain Auth Token
    login_res = client.post("/api/auth/login", json={
        "username_or_email": "admin@test.com",
        "password": "password123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create Student
    payload = {
        "student_id": "STU999",
        "full_name": "Test Student",
        "email": "test.student@univ.edu",
        "phone": "9998887770",
        "password": "student-pass-123",
        "department_id": 1,
        "course_id": 1,
        "status": "Active"
    }
    create_res = client.post("/api/students", json=payload, headers=headers)
    assert create_res.status_code == 201
    stu_data = create_res.json()
    assert stu_data["student_id"] == "STU999"

    # List Students
    list_res = client.get("/api/students", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

def test_book_issue_and_return(client):
    login_res = client.post("/api/auth/login", json={
        "username_or_email": "admin@test.com",
        "password": "password123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Issue Book to Student ID 1
    issue_payload = {
        "student_id": 1,
        "book_id": 1,
        "due_date": (date.today() + timedelta(days=14)).isoformat()
    }
    issue_res = client.post("/api/book-issues", json=issue_payload, headers=headers)
    assert issue_res.status_code == 201
    issue_data = issue_res.json()
    assert issue_data["status"] == "ISSUED"

    # Return Book
    issue_id = issue_data["id"]
    return_res = client.post(f"/api/book-issues/{issue_id}/return", json={
        "return_date": date.today().isoformat(),
        "fine_amount": 0.0
    }, headers=headers)
    assert return_res.status_code == 200
    assert return_res.json()["status"] == "RETURNED"


def test_book_issue_rejects_past_due_date(client):
    login_res = client.post("/api/auth/login", json={
        "username_or_email": "admin@test.com",
        "password": "password123"
    })
    headers = {"Authorization": f"Bearer {login_res.json()['access_token']}"}
    response = client.post("/api/book-issues", json={
        "student_id": 1,
        "book_id": 1,
        "issue_date": date.today().isoformat(),
        "due_date": (date.today() - timedelta(days=1)).isoformat(),
    }, headers=headers)
    assert response.status_code == 400
    assert "Due date" in response.json()["detail"]

def test_dashboard_summary(client):
    login_res = client.post("/api/auth/login", json={
        "username_or_email": "admin@test.com",
        "password": "password123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/dashboard/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_students" in data
    assert "total_books" in data


def test_password_reset_is_single_use(client):
    request = client.post("/api/auth/forgot-password", json={
        "email": "admin@test.com",
        "account_type": "admin",
    })
    assert request.status_code == 200
    reset_url = request.json()["reset_url"]
    token = parse_qs(urlparse(reset_url).query)["token"][0]

    reset = client.post("/api/auth/reset-password", json={
        "token": token,
        "new_password": "new-password-456",
    })
    assert reset.status_code == 200
    assert client.post("/api/auth/login", json={
        "username_or_email": "admin@test.com",
        "password": "new-password-456",
    }).status_code == 200

    reused = client.post("/api/auth/reset-password", json={
        "token": token,
        "new_password": "another-password-789",
    })
    assert reused.status_code == 400
