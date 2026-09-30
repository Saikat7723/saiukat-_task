"""Authenticated camera frames -> server-side matching -> durable attendance."""
import secrets
import time
from datetime import datetime, timezone
from threading import RLock
from zoneinfo import ZoneInfo
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from sqlalchemy.orm import Session, joinedload
from app.core.config import settings
from app.core.security import get_current_user
from app.database.session import get_db
from app.face_recognition.engine import face_engine, ModelUnavailable, get_match_threshold
from app.models.student import Student, StudentFaceProfile
from app.models.attendance import AttendanceSession, AttendanceEvent

router = APIRouter(prefix="/recognition", tags=["Face recognition"])
# One backend worker for SQLite; MySQL also locks the student row for cross-worker writes.
processing_lock = RLock()
observations = {}
# A checkout is only eligible after the same camera has observed the verified
# student leave its view. This prevents a continuous camera scan from toggling
# a check-in straight into a check-out.
active_presence = {}
departed_students = set()


def camera_principal(authorization: Optional[str] = Header(None), x_face_service_token: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if x_face_service_token is not None:
        if settings.FACE_SERVICE_TOKEN and secrets.compare_digest(x_face_service_token, settings.FACE_SERVICE_TOKEN):
            return "camera-service"
        raise HTTPException(401, "Invalid camera service token")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Sign in to use the attendance camera")
    user = get_current_user(authorization.split(" ", 1)[1], db)
    return f"admin:{user.id}"


@router.get("/status")
def recognition_status(db: Session = Depends(get_db), principal=Depends(camera_principal)):
    try:
        face_engine.load()
        ready, message = True, "Face recognition ready"
    except ModelUnavailable as exc:
        ready, message = False, str(exc)
    profiles = db.query(StudentFaceProfile).join(Student).filter(Student.status == "Active").all()
    enrolled = sum(face_engine.valid_profile(profile) for profile in profiles)
    return {"ready": ready, "message": message, "enrolled_students": enrolled,
            "needs_enrollment": len(profiles) - enrolled, "camera_id": settings.CAMERA_ID,
            "confirm_frames": settings.FACE_CONFIRM_FRAMES}


def record_daily_attendance(db, student_id, score, camera_id, checkout_authorized=False):
    """Create a check-in, or close the active session after a verified departure/re-entry."""
    if db.bind.dialect.name == "sqlite":
        db.rollback()
        db.connection().exec_driver_sql("BEGIN IMMEDIATE")
    student = db.query(Student).filter(Student.id == student_id, Student.status == "Active").with_for_update().first()
    if student is None:
        db.rollback()
        return {"action": "INACTIVE_STUDENT", "success": False}
    now = datetime.now(timezone.utc)
    today = now.astimezone(ZoneInfo(settings.ATTENDANCE_TIMEZONE)).date()
    existing = db.query(AttendanceSession).filter(
        AttendanceSession.student_id == student.id,
        AttendanceSession.session_date == today,
        AttendanceSession.check_out_time.is_(None)
    ).order_by(AttendanceSession.check_in_time.desc()).first()
    action = "CHECK_IN"
    if existing is None:
        existing = AttendanceSession(student_id=student.id, session_date=today,
            check_in_time=now.replace(tzinfo=None), status="Present", confidence=score,
            camera_id=camera_id, duration_minutes=0)
        db.add(existing)
        db.add(AttendanceEvent(student_id=student.id, event_type="CHECK_IN",
            timestamp=now.replace(tzinfo=None), confidence=score, camera_id=camera_id,
            raw_info="Verified camera face; daily automatic attendance"))
        db.flush()
    elif checkout_authorized:
        action = "CHECK_OUT"
        checked_out_at = now.replace(tzinfo=None)
        existing.check_out_time = checked_out_at
        existing.duration_minutes = max(0, int((checked_out_at - existing.check_in_time).total_seconds() // 60))
        db.add(AttendanceEvent(student_id=student.id, event_type="CHECK_OUT",
            timestamp=checked_out_at, confidence=score, camera_id=camera_id,
            raw_info=f"Verified camera face after departure; automatic check-out for session {existing.id}"))
    else:
        action = "ALREADY_RECORDED"
    result = {"success": True, "action": action, "session_id": existing.id,
        "timestamp": (existing.check_out_time or existing.check_in_time).replace(tzinfo=timezone.utc).isoformat(),
        "check_in_time": existing.check_in_time.replace(tzinfo=timezone.utc).isoformat(),
        "check_out_time": existing.check_out_time.replace(tzinfo=timezone.utc).isoformat() if existing.check_out_time else None,
        "duration_minutes": existing.duration_minutes,
        "similarity": round(score, 4), "student": {"id": student.id, "student_id": student.student_id,
        "full_name": student.full_name, "email": student.email,
        "profile_photo_path": student.profile_photo_path,
        "department_name": student.department.name if student.department else None,
        "course_name": student.course.name if student.course else None}}
    db.commit()
    return result


def process_frame(data, db, principal, camera_id):
    with processing_lock:
        now = time.monotonic()
        for key in list(observations):
            if now - observations[key][2] > 10:
                del observations[key]
        key = (principal, camera_id)

        def mark_departure():
            active_student = active_presence.pop(key, None)
            if active_student is not None:
                departed_students.add((key, active_student))

        image, faces = face_engine.analyze(data)
        response = {"width": image.shape[1], "height": image.shape[0], "faces": [], "attendance": None,
                    "state": "NO_FACE", "message": "Waiting for a face"}
        for face in faces:
            response["faces"].append({"bbox": face["bbox"], "label": "Face detected"})
        if len(faces) != 1:
            observations.pop(key, None)
            if len(faces) == 0:
                mark_departure()
            if len(faces) > 1:
                response.update(state="MULTIPLE_FACES", message="One person at a time, please")
            return response
        face = faces[0]
        if face["embedding"] is None:
            observations.pop(key, None)
            response.update(state="LOW_QUALITY", message=face["quality"])
            return response
        profiles = db.query(StudentFaceProfile).join(Student).options(joinedload(StudentFaceProfile.student)).filter(
            Student.status == "Active", StudentFaceProfile.is_active.is_(True)).all()
        scores = sorted([(face_engine.compare_embeddings(face["embedding"], p.embedding_vector["vector"]), p.student_id)
                         for p in profiles if face_engine.valid_profile(p)], reverse=True)
        if not scores:
            observations.pop(key, None)
            response.update(state="NO_PROFILES", message="No enrolled faces. Capture a photo in a student profile first.")
            return response
        score, student_id = scores[0]
        # SFace cosine similarity is a score, not a calibrated probability.
        if score < get_match_threshold(db) or (len(scores) > 1 and score - scores[1][0] < settings.FACE_MATCH_MARGIN):
            observations.pop(key, None)
            response["faces"][0]["label"] = "Unknown face"
            response.update(state="UNKNOWN", message="Face not matched. Please check enrollment and lighting.")
            return response
        previous_id, count, last_time = observations.get(key, (None, 0, 0))
        count = count + 1 if previous_id == student_id and now - last_time < 5 else 1
        observations[key] = (student_id, count, now)
        if count < settings.FACE_CONFIRM_FRAMES:
            response.update(state="VERIFYING", message="Verifying face — hold still")
            response["faces"][0]["label"] = "Verifying…"
            return response
        checkout_authorized = (key, student_id) in departed_students
        result = record_daily_attendance(db, student_id, score, camera_id, checkout_authorized=checkout_authorized)
        response["attendance"] = result
        if result["success"]:
            active_presence[key] = student_id
            departed_students.discard((key, student_id))
            message = {
                "CHECK_IN": "Check-in recorded successfully",
                "CHECK_OUT": "Check-out recorded successfully",
                "ALREADY_RECORDED": "Student is already checked in; waiting for departure before check-out",
            }.get(result["action"], "Attendance updated")
            response.update(state="MATCHED", message=message)
            response["faces"][0].update(label=result["student"]["full_name"], similarity=round(score, 4))
        return response


@router.post("/frame")
def recognize_frame(file: UploadFile = File(...), camera_id: str = Form(..., min_length=1, max_length=50),
                    db: Session = Depends(get_db), principal=Depends(camera_principal)):
    data = file.file.read(5 * 1024 * 1024 + 1)
    try:
        return process_frame(data, db, principal, camera_id)
    except ModelUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

