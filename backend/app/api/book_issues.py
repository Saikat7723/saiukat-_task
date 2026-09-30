from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.database.session import get_db
from app.models.book import Book, BookIssue
from app.models.attendance import AttendanceSetting
from app.models.student import Student
from app.models.system import AuditLog
from app.schemas.book import BookIssueCreate, BookReturnRequest, BookIssueResponse
from app.core.security import get_current_user, Admin
from app.core.config import settings

router = APIRouter(prefix="/book-issues", tags=["Book Issues"])

@router.get("/eligible-students")
def list_eligible_students(
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    """Provide the minimal student identity data needed to issue a library book."""
    students = db.query(Student).filter(Student.status == "Active").order_by(Student.full_name).all()
    return [{"id": student.id, "full_name": student.full_name, "student_id": student.student_id} for student in students]

@router.get("", response_model=List[BookIssueResponse])
def list_book_issues(
    student_id: Optional[int] = Query(None),
    book_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user)
):
    query = db.query(BookIssue)

    if student_id:
        query = query.filter(BookIssue.student_id == student_id)
    if book_id:
        query = query.filter(BookIssue.book_id == book_id)
    if status_filter == "ACTIVE":
        query = query.filter(BookIssue.status.in_(["ISSUED", "OVERDUE"]), BookIssue.return_date.is_(None))
    elif status_filter:
        query = query.filter(BookIssue.status == status_filter)

    issues = query.order_by(BookIssue.created_at.desc()).offset(skip).limit(limit).all()

    # Enrich response with student name & code
    results = []
    for issue in issues:
        resp = BookIssueResponse.model_validate(issue)
        if issue.student:
            resp.student_name = issue.student.full_name
            resp.student_code = issue.student.student_id
        results.append(resp)

    return results

@router.post("", response_model=BookIssueResponse, status_code=status.HTTP_201_CREATED)
def issue_book(
    issue_in: BookIssueCreate,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user)
):
    student = db.query(Student).filter(Student.id == issue_in.student_id, Student.status == "Active").first()
    if not student:
        raise HTTPException(status_code=400, detail="Student not found or inactive")

    book = db.query(Book).filter(Book.id == issue_in.book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    issue_date = issue_in.issue_date or date.today()
    if issue_in.due_date < issue_date:
        raise HTTPException(status_code=400, detail="Due date must be on or after the issue date.")

    if book.available_copies <= 0:
        raise HTTPException(status_code=400, detail=f"Book '{book.title}' is currently out of stock (0 available copies)")

    # Check if student already has an active issue of the SAME book
    active_issue = db.query(BookIssue).filter(
        BookIssue.student_id == student.id,
        BookIssue.book_id == book.id,
        BookIssue.status == "ISSUED"
    ).first()
    if active_issue:
        raise HTTPException(status_code=400, detail=f"Student {student.full_name} already has an active issue of '{book.title}'")

    # Issue book & decrease available copies
    book.available_copies -= 1
    if book.available_copies == 0:
        book.status = "Out of Stock"

    new_issue = BookIssue(
        student_id=student.id,
        book_id=book.id,
        issue_date=issue_date,
        due_date=issue_in.due_date,
        status="ISSUED",
        notes=issue_in.notes,
        issued_by_admin_id=current_user.id
    )

    db.add(book)
    db.add(new_issue)
    db.flush()

    audit = AuditLog(
        admin_id=current_user.id,
        admin_email=current_user.email,
        action="BOOK_ISSUE",
        target_type="BookIssue",
        target_id=str(new_issue.id),
        details=f"Issued '{book.title}' to {student.full_name} ({student.student_id})"
    )
    db.add(audit)
    db.commit()
    db.refresh(new_issue)

    resp = BookIssueResponse.model_validate(new_issue)
    resp.student_name = student.full_name
    resp.student_code = student.student_id
    return resp

@router.post("/{id}/return", response_model=BookIssueResponse)
def return_book(
    id: int,
    return_in: BookReturnRequest,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user)
):
    issue = db.query(BookIssue).filter(BookIssue.id == id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Book issue record not found")

    if issue.status == "RETURNED":
        raise HTTPException(status_code=400, detail="Book has already been returned")

    ret_date = return_in.return_date or date.today()

    # Calculate the configured fine per overdue day. A blank setting means fines are disabled.
    calculated_fine = return_in.fine_amount or 0.0
    if ret_date > issue.due_date:
        overdue_days = (ret_date - issue.due_date).days
        fine_setting = db.query(AttendanceSetting).filter(
            AttendanceSetting.setting_key == "OVERDUE_FINE_PER_DAY"
        ).first()
        try:
            rate = float(fine_setting.setting_value) if fine_setting and fine_setting.setting_value else settings.OVERDUE_FINE_PER_DAY
        except (TypeError, ValueError):
            rate = settings.OVERDUE_FINE_PER_DAY
        calculated_fine = round(overdue_days * max(0.0, rate), 2)

    issue.return_date = ret_date
    issue.fine_amount = calculated_fine
    issue.status = "RETURNED"
    if return_in.notes:
        issue.notes = f"{issue.notes or ''} | Return note: {return_in.notes}"

    # Increase available copies of book
    book = issue.book
    if book:
        book.available_copies += 1
        if book.status == "Out of Stock" and book.available_copies > 0:
            book.status = "Available"
        db.add(book)

    db.add(issue)

    audit = AuditLog(
        admin_id=current_user.id,
        admin_email=current_user.email,
        action="BOOK_RETURN",
        target_type="BookIssue",
        target_id=str(issue.id),
        details=f"Returned book '{book.title if book else ''}' (Fine: ${calculated_fine:.2f})"
    )
    db.add(audit)
    db.commit()
    db.refresh(issue)

    resp = BookIssueResponse.model_validate(issue)
    if issue.student:
        resp.student_name = issue.student.full_name
        resp.student_code = issue.student.student_id
    return resp

@router.get("/overdue", response_model=List[BookIssueResponse])
def get_overdue_books(
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user)
):
    today = date.today()
    overdue_issues = db.query(BookIssue).filter(
        BookIssue.status == "ISSUED",
        BookIssue.due_date < today
    ).order_by(BookIssue.due_date.asc()).all()

    # Update status to OVERDUE dynamically
    results = []
    for issue in overdue_issues:
        if issue.status != "OVERDUE":
            issue.status = "OVERDUE"
            db.add(issue)
        resp = BookIssueResponse.model_validate(issue)
        if issue.student:
            resp.student_name = issue.student.full_name
            resp.student_code = issue.student.student_id
        results.append(resp)

    db.commit()
    return results
