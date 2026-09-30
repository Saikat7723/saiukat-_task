"""Persistent engineering and technology academic catalog."""

from sqlalchemy.orm import Session

from app.models.academic import Course, Department


ENGINEERING_PROGRAMMES = (
    ("CSE", "Computer Science & Engineering"),
    ("IT", "Information Technology"),
    ("ECE", "Electronics & Communication Engineering"),
    ("EEE", "Electrical & Electronics Engineering"),
    ("EE", "Electrical Engineering"),
    ("ME", "Mechanical Engineering"),
    ("CE", "Civil Engineering"),
    ("CHE", "Chemical Engineering"),
    ("BT", "Biotechnology Engineering"),
    ("TE", "Textile Engineering"),
    ("IPE", "Industrial & Production Engineering"),
    ("AE", "Aerospace Engineering"),
    ("ARCH", "Architecture"),
)


def ensure_academic_catalog(db: Session) -> None:
    """Create missing department and B.Tech course records without overwriting data."""
    for code, name in ENGINEERING_PROGRAMMES:
        department = db.query(Department).filter(Department.code == code).first()
        if department is None:
            department = Department(code=code, name=name, description="Institution academic programme")
            db.add(department)
            db.flush()
        course_code = f"BTECH-{code}"
        if not db.query(Course).filter(Course.code == course_code).first():
            db.add(Course(
                code=course_code,
                name=f"B.Tech in {name}",
                department_id=department.id,
                duration_years=4,
            ))
    db.commit()
