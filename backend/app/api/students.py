import os
import uuid
import cv2
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database.session import get_db
from app.models.student import Student, StudentFaceProfile
from app.models.academic import Department, Course
from app.models.system import AuditLog
from app.schemas.student import StudentCreate, StudentUpdate, StudentResponse
from app.core.security import get_current_user, Admin, get_password_hash
from app.core.config import settings
from app.face_recognition.engine import face_engine, ModelUnavailable, MODEL_VERSION, get_match_threshold

router = APIRouter(prefix="/students", tags=["Students"])
logger = logging.getLogger("api.students")

@router.get("", response_model=List[StudentResponse])
def list_students(
    search: Optional[str] = Query(None),
    department_id: Optional[int] = Query(None),
    course_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user)
):
    query = db.query(Student)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Student.full_name.ilike(search_term),
                Student.student_id.ilike(search_term),
                Student.email.ilike(search_term)
            )
        )

    if department_id:
        query = query.filter(Student.department_id == department_id)
    if course_id:
        query = query.filter(Student.course_id == course_id)
    if status_filter:
        query = query.filter(Student.status == status_filter)

    students = query.order_by(Student.created_at.desc()).offset(skip).limit(limit).all()

    # Annotate has_face_profile
    result = []
    for s in students:
        resp = StudentResponse.model_validate(s)
        resp.has_face_profile = face_engine.valid_profile(s.face_profile)
        result.append(resp)

    return result

@router.post("", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
def create_student(
    student_in: StudentCreate,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user)
):
    # Check duplicate student_id or email
    existing_id = db.query(Student).filter(Student.student_id == student_in.student_id).first()
    if existing_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Student ID / Roll Number '{student_in.student_id}' already exists."
        )

    existing_email = db.query(Student).filter(Student.email == student_in.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Student Email '{student_in.email}' already exists."
        )

    if student_in.department_id:
        if not db.query(Department).filter(Department.id == student_in.department_id).first():
            raise HTTPException(status_code=400, detail="Selected department does not exist.")
    if student_in.course_id:
        course = db.query(Course).filter(Course.id == student_in.course_id).first()
        if not course:
            raise HTTPException(status_code=400, detail="Selected course does not exist.")
        if student_in.department_id and course.department_id != student_in.department_id:
            raise HTTPException(status_code=400, detail="Selected course does not belong to the selected department.")

    student_data = student_in.model_dump(exclude={"password"})
    student = Student(**student_data)
    if student_in.password:
        if len(student_in.password) < 8:
            raise HTTPException(status_code=400, detail="Student password must contain at least 8 characters")
        student.hashed_password = get_password_hash(student_in.password)
    db.add(student)
    db.commit()
    db.refresh(student)

    # Log action
    audit = AuditLog(
        admin_id=current_user.id,
        admin_email=current_user.email,
        action="STUDENT_CREATE",
        target_type="Student",
        target_id=str(student.id),
        details=f"Created student {student.full_name} ({student.student_id})"
    )
    db.add(audit)
    db.commit()

    resp = StudentResponse.model_validate(student)
    resp.has_face_profile = False
    return resp

@router.get("/{id}", response_model=StudentResponse)
def get_student(id: int, db: Session = Depends(get_db), current_user: Admin = Depends(get_current_user)):
    student = db.query(Student).filter(Student.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    resp = StudentResponse.model_validate(student)
    resp.has_face_profile = face_engine.valid_profile(student.face_profile)
    return resp

@router.put("/{id}", response_model=StudentResponse)
def update_student(
    id: int,
    student_in: StudentUpdate,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user)
):
    student = db.query(Student).filter(Student.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    update_data = student_in.model_dump(exclude_unset=True)
    if "email" in update_data and update_data["email"] != student.email:
        duplicate = db.query(Student).filter(Student.email == update_data["email"], Student.id != student.id).first()
        if duplicate:
            raise HTTPException(status_code=400, detail=f"Student Email '{update_data['email']}' already exists.")
    if "status" in update_data and update_data["status"] not in {"Active", "Inactive"}:
        raise HTTPException(status_code=400, detail="Student status must be Active or Inactive.")
    department_id = update_data.get("department_id", student.department_id)
    course_id = update_data.get("course_id", student.course_id)
    if department_id:
        if not db.query(Department).filter(Department.id == department_id).first():
            raise HTTPException(status_code=400, detail="Selected department does not exist.")
    if course_id:
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            raise HTTPException(status_code=400, detail="Selected course does not exist.")
        if department_id and course.department_id != department_id:
            raise HTTPException(status_code=400, detail="Selected course does not belong to the selected department.")
    for field, val in update_data.items():
        setattr(student, field, val)

    db.add(student)
    db.commit()
    db.refresh(student)

    audit = AuditLog(
        admin_id=current_user.id,
        admin_email=current_user.email,
        action="STUDENT_UPDATE",
        target_type="Student",
        target_id=str(student.id),
        details=f"Updated student {student.full_name}"
    )
    db.add(audit)
    db.commit()

    resp = StudentResponse.model_validate(student)
    resp.has_face_profile = face_engine.valid_profile(student.face_profile)
    return resp

@router.delete("/{id}")
def delete_student(id: int, db: Session = Depends(get_db), current_user: Admin = Depends(get_current_user)):
    student = db.query(Student).filter(Student.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Soft delete / set status to Inactive
    student.status = "Inactive"
    if student.face_profile:
        student.face_profile.is_active = False

    db.add(student)
    db.commit()

    audit = AuditLog(
        admin_id=current_user.id,
        admin_email=current_user.email,
        action="STUDENT_DEACTIVATE",
        target_type="Student",
        target_id=str(student.id),
        details=f"Deactivated student {student.full_name}"
    )
    db.add(audit)
    db.commit()

    return {"success": True, "message": f"Student {student.full_name} deactivated successfully"}

@router.post("/{id}/photo", response_model=StudentResponse)
def upload_student_photo(
    id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user)
):
    """
    Upload and validate student profile photo.
    Validates face visibility: rejects images with no detectable face or multiple faces.
    Extracts face embedding vector and updates StudentFaceProfile.
    """
    student = db.query(Student).filter(Student.id == id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

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
        # Prevent the same enrolled face being assigned to multiple students.
        others = db.query(StudentFaceProfile).join(Student).filter(
            StudentFaceProfile.student_id != id, Student.status == "Active").all()
        for other in others:
            if face_engine.valid_profile(other) and face_engine.compare_embeddings(
                face["embedding"], other.embedding_vector["vector"]) >= get_match_threshold(db):
                raise HTTPException(409, "This face matches another active student. Review the existing profile.")
        ok, encoded = cv2.imencode(".jpg", image)
        if not ok:
            raise ValueError("Could not save the photo")
        image_bytes = encoded.tobytes()
    except ModelUnavailable as exc:
        raise HTTPException(503, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    # 3. Save profile image to external storage directory
    os.makedirs(settings.PROFILES_DIR, exist_ok=True)
    filename = f"student_{student.id}_{uuid.uuid4().hex}.jpg"
    filepath = os.path.join(settings.PROFILES_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(image_bytes)

    # Normalize relative image path URL
    rel_path = f"/uploads/profiles/{filename}"

    # 4. Update Student and StudentFaceProfile in MySQL
    student.profile_photo_path = rel_path
    db.add(student)

    # Upsert StudentFaceProfile
    face_profile = db.query(StudentFaceProfile).filter(StudentFaceProfile.student_id == student.id).first()
    if face_profile:
        face_profile.embedding_vector = embedding
        face_profile.face_bounding_box = {"x": bbox[0], "y": bbox[1], "w": bbox[2], "h": bbox[3]}
        face_profile.reference_image_path = rel_path
        face_profile.is_active = True
    else:
        face_profile = StudentFaceProfile(
            student_id=student.id,
            embedding_vector=embedding,
            face_bounding_box={"x": bbox[0], "y": bbox[1], "w": bbox[2], "h": bbox[3]},
            reference_image_path=rel_path,
            is_active=True
        )
        db.add(face_profile)

    db.commit()
    db.refresh(student)

    audit = AuditLog(
        admin_id=current_user.id,
        admin_email=current_user.email,
        action="STUDENT_FACE_REGISTER",
        target_type="Student",
        target_id=str(student.id),
        details=f"Registered face embedding & photo for {student.full_name}"
    )
    db.add(audit)
    db.commit()

    resp = StudentResponse.model_validate(student)
    resp.has_face_profile = True
    return resp
