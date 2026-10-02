"""Authenticated camera frames -> server-side matching -> durable attendance."""
import secrets
import time
from threading import RLock
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from sqlalchemy.orm import Session, joinedload
from app.core.config import settings
from app.attendance.engine import AttendanceEngine
from app.core.security import get_current_user
from app.database.session import get_db
from app.face_recognition.engine import face_engine, ModelUnavailable, get_match_threshold
from app.models.student import Student, StudentFaceProfile

router = APIRouter(prefix="/recognition", tags=["Face recognition"])
# One backend worker for SQLite; MySQL also locks the student row for cross-worker writes.
processing_lock = RLock()
observations = {}


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
            "confirm_frames": settings.FACE_CONFIRM_FRAMES, "timezone": settings.ATTENDANCE_TIMEZONE,
            "currentTime": AttendanceEngine.server_now().isoformat()}


def record_daily_attendance(db, student_id, score, camera_id):
    return AttendanceEngine.record_daily_attendance(db, student_id, score, camera_id)


def process_frame(data, db, principal, camera_id):
    with processing_lock:
        now = time.monotonic()
        for key in list(observations):
            if now - observations[key][2] > 10:
                del observations[key]
        key = (principal, camera_id)

        image, faces = face_engine.analyze(data)
        response = {"width": image.shape[1], "height": image.shape[0], "faces": [], "attendance": None,
                    "state": "NO_FACE", "message": "Waiting for a face"}
        for face in faces:
            response["faces"].append({"bbox": face["bbox"], "label": "Face detected"})
        if len(faces) != 1:
            observations.pop(key, None)
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
        result = record_daily_attendance(db, student_id, score, camera_id)
        response["attendance"] = result
        if result["success"]:
            message = {
                "CHECK_IN": "Check-in recorded successfully",
                "ALREADY_RECORDED": "Attendance Already Recorded",
            }.get(result["action"], "Attendance updated")
            response.update(state="MATCHED", message=message)
            response["faces"][0].update(label=result["student"]["full_name"], similarity=round(score, 4))
        elif result.get("code") in {"ATTENDANCE_CUTOFF_PASSED", "ATTENDANCE_NOT_STARTED"}:
            response.update(state=result["code"], message=result["message"])
            response["faces"][0].update(
                label="Student verified — attendance deadline passed" if result["code"] == "ATTENDANCE_CUTOFF_PASSED" else "Student verified — attendance not started",
                similarity=round(score, 4))
        else:
            response.update(state=result["action"], message=result.get("message", "Attendance unavailable"))
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

