"""Shared daily attendance policy. All creation paths use the server clock."""
from datetime import datetime, timezone, time
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.models.student import Student
from app.models.attendance import AttendanceSession, AttendanceEvent, AttendanceSetting


class AttendanceEngine:
    DEFAULTS = {"attendance_start_time": "00:00", "attendance_cutoff_time": "14:00"}

    @staticmethod
    def server_now():
        return datetime.now(timezone.utc)

    @staticmethod
    def get_setting(db, key, default_val):
        setting = db.query(AttendanceSetting).filter_by(setting_key=key).first()
        return type(default_val)(setting.setting_value) if setting else default_val

    @classmethod
    def ensure_settings(cls, db):
        for key, value in cls.DEFAULTS.items():
            if not db.query(AttendanceSetting).filter_by(setting_key=key).first():
                db.add(AttendanceSetting(setting_key=key, setting_value=value))
        db.commit()

    @classmethod
    def process_recognition_event(cls, db, student_id, confidence, camera_id, timestamp=None):
        # Legacy callers cannot backdate attendance with a supplied timestamp.
        if confidence < cls.get_setting(db, "FACE_RECOGNITION_THRESHOLD", settings.FACE_RECOGNITION_THRESHOLD):
            return {"success": False, "action": "IGNORED_LOW_CONFIDENCE"}
        return cls.record_daily_attendance(db, student_id, confidence, camera_id)

    @classmethod
    def record_daily_attendance(cls, db, student_id, score, camera_id):
        # Serialize duplicate checks and inserts across SQLite connections / MySQL workers.
        if db.bind.dialect.name == "sqlite":
            db.rollback()
            db.connection().exec_driver_sql("BEGIN IMMEDIATE")
        student = db.query(Student).filter_by(id=student_id, status="Active").with_for_update().first()
        if student is None:
            db.rollback()
            return {"success": False, "action": "INACTIVE_STUDENT", "message": "Student is inactive or deleted"}
        now = cls.server_now()
        local = now.astimezone(ZoneInfo(settings.ATTENDANCE_TIMEZONE))
        result = {"currentTime": local.isoformat(), "timezone": settings.ATTENDANCE_TIMEZONE,
                  "session_date": local.date().isoformat(), "similarity": round(score, 4),
                  "student": {"id": student.id, "student_id": student.student_id,
                              "full_name": student.full_name, "email": student.email,
                              "profile_photo_path": student.profile_photo_path,
                              "department_name": student.department.name if student.department else None,
                              "course_name": student.course.name if student.course else None}}
        existing = db.query(AttendanceSession).filter_by(student_id=student.id, session_date=local.date()).order_by(AttendanceSession.check_in_time.asc()).first()
        action = "ALREADY_RECORDED"
        if existing is None:
            cutoff = time.fromisoformat(cls.get_setting(db, "attendance_cutoff_time", cls.DEFAULTS["attendance_cutoff_time"]))
            start = time.fromisoformat(cls.get_setting(db, "attendance_start_time", cls.DEFAULTS["attendance_start_time"]))
            cutoff_label = cutoff.strftime("%I:%M %p").lstrip("0")
            if local.time() >= cutoff:
                db.rollback()
                return dict(result, success=False, action="ATTENDANCE_CUTOFF_PASSED",
                            code="ATTENDANCE_CUTOFF_PASSED", status="Missed Cutoff",
                            message=f"Attendance must be completed before {cutoff_label}.", cutoffTime=cutoff_label)
            if local.time() < start:
                db.rollback()
                return dict(result, success=False, action="ATTENDANCE_NOT_STARTED", code="ATTENDANCE_NOT_STARTED",
                            status="Not Started", message=f"Attendance starts at {start.strftime('%I:%M %p').lstrip('0')}.")
            action = "CHECK_IN"
            existing = AttendanceSession(student_id=student.id, session_date=local.date(),
                check_in_time=now.astimezone(timezone.utc).replace(tzinfo=None), status="Present",
                confidence=score, camera_id=camera_id, duration_minutes=0)
            db.add(existing)
            db.add(AttendanceEvent(student_id=student.id, event_type="CHECK_IN",
                timestamp=existing.check_in_time, confidence=score, camera_id=camera_id,
                raw_info="Server-validated daily attendance"))
            db.flush()
        result.update(success=True, action=action, status="Present", session_id=existing.id,
                      timestamp=existing.check_in_time.replace(tzinfo=timezone.utc).isoformat(),
                      check_in_time=existing.check_in_time.replace(tzinfo=timezone.utc).isoformat(),
                      check_out_time=existing.check_out_time.replace(tzinfo=timezone.utc).isoformat() if existing.check_out_time else None,
                      duration_minutes=existing.duration_minutes)
        db.commit()
        return result
