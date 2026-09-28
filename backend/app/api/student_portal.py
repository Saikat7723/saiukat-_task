from datetime import date, datetime, timedelta
from typing import Any
import os
import uuid
import cv2
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import get_current_student, get_password_hash, verify_password
from app.database.session import get_db
from app.models.attendance import AttendanceSession
from app.models.book import BookIssue
from app.models.student import Student, StudentFaceProfile
from app.models.academic import Department, Course
from app.core.config import settings
from app.face_recognition.engine import face_engine, ModelUnavailable, MODEL_VERSION, get_match_threshold

router = APIRouter(prefix="/student", tags=["Student portal"])


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=20)
    department_id: int | None = None
    course_id: int | None = None
    date_of_joining: date | None = None
    dob: date | None = None
    gender: str | None = Field(default=None, max_length=20)
    address: str | None = None


def _student_payload(student: Student) -> dict[str, Any]:
    return {
        "id": student.id,
        "student_id": student.student_id,
        "full_name": student.full_name,
        "email": student.email,
        "phone": student.phone,
        "dob": student.dob.isoformat() if student.dob else None,
        "gender": student.gender,
        "date_of_joining": student.date_of_joining.isoformat() if student.date_of_joining else None,
        "enrollment_year": student.date_of_joining.year if student.date_of_joining else None,
        "address": student.address,
        "status": student.status,
        "profile_photo_path": student.profile_photo_path,
        "has_face_profile": bool(student.face_profile and student.face_profile.is_active),
        "department": {"id": student.department.id, "code": student.department.code, "name": student.department.name}
        if student.department else None,
        "course": {"id": student.course.id, "code": student.course.code, "name": student.course.name}
        if student.course else None,
    }


def _attendance_payload(session: AttendanceSession) -> dict[str, Any]:
    return {
        "id": session.id,
        "session_date": session.session_date.isoformat(),
        "check_in_time": session.check_in_time.isoformat(),
        "check_out_time": session.check_out_time.isoformat() if session.check_out_time else None,
        "duration_minutes": session.duration_minutes,
        "status": session.status,
        "confidence": session.confidence,
        "camera_id": session.camera_id,
    }


def _book_payload(issue: BookIssue) -> dict[str, Any]:
    book = issue.book
    return {
        "id": issue.id,
        "status": issue.status,
        "issue_date": issue.issue_date.isoformat(),
        "due_date": issue.due_date.isoformat(),
        "return_date": issue.return_date.isoformat() if issue.return_date else None,
        "fine_amount": issue.fine_amount,
        "book": {"id": book.id, "title": book.title, "isbn": book.isbn,
                 "author": book.author.name if book.author else None}
        if book else None,
    }


def _working_days(start: date, end: date) -> int:
    if end < start:
        return 0
    return sum(1 for offset in range((end - start).days + 1) if (start + timedelta(days=offset)).weekday() < 5)


@router.get("/dashboard")
def get_student_dashboard(current_student: Student = Depends(get_current_student), db: Session = Depends(get_db)):
    sessions = db.query(AttendanceSession).filter(
        AttendanceSession.student_id == current_student.id
    ).order_by(AttendanceSession.session_date.desc(), AttendanceSession.check_in_time.desc()).all()
    issues = db.query(BookIssue).filter(BookIssue.student_id == current_student.id).order_by(BookIssue.created_at.desc()).all()
    present_days = len({s.session_date for s in sessions if s.status in ("Present", "Late")})
    start = current_student.date_of_joining or min((session.session_date for session in sessions), default=None)
    total_working_days = _working_days(start, date.today()) if start else 0
    absent_days = max(0, total_working_days - present_days)
    today = date.today()
    today_session = next((s for s in sessions if s.session_date == today), None)
    active_books = [i for i in issues if i.return_date is None and i.status in ("ISSUED", "OVERDUE")]
    month_start = date(today.year, 1, 1)
    month_data = []
    for month in range(1, 13):
        start_of_month = date(today.year, month, 1)
        end_of_month = date(today.year + (month == 12), 1 if month == 12 else month + 1, 1) - timedelta(days=1)
        effective_end = min(today, end_of_month)
        effective_start = max(start, start_of_month) if start else None
        present = len({s.session_date for s in sessions if s.session_date.year == today.year and s.session_date.month == month and s.status in ("Present", "Late")})
        working = _working_days(effective_start, effective_end) if effective_start and effective_end >= effective_start else 0
        month_data.append({"month": start_of_month.strftime("%b"), "present": present, "absent": max(0, working - present), "working_days": working})
    return {
        "student": _student_payload(current_student),
        "attendance": {
            "total_working_days": total_working_days,
            "present_days": present_days,
            "absent_days": absent_days,
            "attendance_percentage": round(present_days / total_working_days * 100, 1) if total_working_days else 0.0,
            "today_check_in": today_session.check_in_time.isoformat() if today_session else None,
            "today_check_out": today_session.check_out_time.isoformat() if today_session and today_session.check_out_time else None,
        },
        "recent_attendance": [_attendance_payload(s) for s in sessions[:10]],
        "library": {
            "issued_count": len(active_books),
            "active_books": [_book_payload(i) for i in active_books],
            "history": [_book_payload(i) for i in issues[:20]],
        },
        "monthly_attendance": month_data,
        "server_date": today.isoformat(),
    }


@router.get("/profile")
def get_student_profile(current_student: Student = Depends(get_current_student)):
    return _student_payload(current_student)


@router.get("/academic-options")
def get_academic_options(db: Session = Depends(get_db), current_student: Student = Depends(get_current_student)):
    return {
        "departments": [{"id": item.id, "code": item.code, "name": item.name} for item in db.query(Department).order_by(Department.name).all()],
        "courses": [{"id": item.id, "code": item.code, "name": item.name, "department_id": item.department_id} for item in db.query(Course).order_by(Course.name).all()],
    }


@router.put("/profile")
def update_student_profile(payload: ProfileUpdate, current_student: Student = Depends(get_current_student), db: Session = Depends(get_db)):
    if not payload.full_name.strip():
        raise HTTPException(status_code=400, detail="Full name cannot be empty.")
    if payload.department_id:
        department = db.query(Department).filter(Department.id == payload.department_id).first()
        if not department:
            raise HTTPException(status_code=400, detail="Selected department does not exist.")
    if payload.course_id:
        course = db.query(Course).filter(Course.id == payload.course_id).first()
        if not course:
            raise HTTPException(status_code=400, detail="Selected course does not exist.")
        if payload.department_id and course.department_id != payload.department_id:
            raise HTTPException(status_code=400, detail="Selected course does not belong to the selected department.")

    for field, value in payload.model_dump().items():
        if field == "full_name":
            value = value.strip()
        setattr(current_student, field, value)
    db.commit()
    db.refresh(current_student)
    return _student_payload(current_student)


@router.post("/photo")
def update_student_photo(file: UploadFile = File(...), current_student: Student = Depends(get_current_student), db: Session = Depends(get_db)):
    image_bytes = file.file.read(5 * 1024 * 1024 + 1)
    try:
        image, faces = face_engine.analyze(image_bytes)
        if len(faces) != 1:
            raise ValueError("Exactly one visible face is required. No face or multiple faces detected.")
        face = faces[0]
        if face["embedding"] is None:
            raise ValueError(face["quality"])
        bbox = face["bbox"]
        embedding = {"model": MODEL_VERSION, "vector": face["embedding"]}
        others = db.query(StudentFaceProfile).join(Student).filter(
            StudentFaceProfile.student_id != current_student.id, Student.status == "Active"
        ).all()
        for other in others:
            if face_engine.valid_profile(other) and face_engine.compare_embeddings(
                face["embedding"], other.embedding_vector["vector"]
            ) >= get_match_threshold(db):
                raise HTTPException(status_code=409, detail="This face is already enrolled for another student.")
        ok, encoded = cv2.imencode(".jpg", image)
        if not ok:
            raise ValueError("Could not save the photo.")
        image_bytes = encoded.tobytes()
    except ModelUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    os.makedirs(settings.PROFILES_DIR, exist_ok=True)
    filename = f"student_{current_student.id}_{uuid.uuid4().hex}.jpg"
    filepath = os.path.join(settings.PROFILES_DIR, filename)
    with open(filepath, "wb") as output:
        output.write(image_bytes)
    relative_path = f"/uploads/profiles/{filename}"
    current_student.profile_photo_path = relative_path
    face_profile = db.query(StudentFaceProfile).filter(StudentFaceProfile.student_id == current_student.id).first()
    if face_profile:
        face_profile.embedding_vector = embedding
        face_profile.face_bounding_box = {"x": bbox[0], "y": bbox[1], "w": bbox[2], "h": bbox[3]}
        face_profile.reference_image_path = relative_path
        face_profile.is_active = True
    else:
        db.add(StudentFaceProfile(
            student_id=current_student.id,
            embedding_vector=embedding,
            face_bounding_box={"x": bbox[0], "y": bbox[1], "w": bbox[2], "h": bbox[3]},
            reference_image_path=relative_path,
            is_active=True,
        ))
    db.commit()
    db.refresh(current_student)
    return _student_payload(current_student)


@router.get("/attendance")
def get_student_attendance(current_student: Student = Depends(get_current_student), db: Session = Depends(get_db)):
    return [_attendance_payload(s) for s in db.query(AttendanceSession).filter(
        AttendanceSession.student_id == current_student.id
    ).order_by(AttendanceSession.session_date.desc(), AttendanceSession.check_in_time.desc()).all()]


@router.get("/library")
def get_student_library(current_student: Student = Depends(get_current_student), db: Session = Depends(get_db)):
    return [_book_payload(i) for i in db.query(BookIssue).filter(
        BookIssue.student_id == current_student.id
    ).order_by(BookIssue.created_at.desc()).all()]


@router.put("/password")
def change_student_password(payload: PasswordChange, current_student: Student = Depends(get_current_student), db: Session = Depends(get_db)):
    if not current_student.hashed_password or not verify_password(payload.current_password, current_student.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_student.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"success": True, "message": "Password updated successfully"}
