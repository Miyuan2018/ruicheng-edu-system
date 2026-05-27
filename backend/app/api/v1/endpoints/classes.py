"""Class management endpoints — CRUD + student management."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.db.session import get_db
from app.models.school_class import SchoolClass, class_students
from app.models.student import Student
from app.core.security import get_current_user

router = APIRouter()


# ─── Class CRUD ──────────────────────────────────────────────

@router.post("")
async def create_class(
    name: str = Body(...), subject: str = Body(...), grade_level: str = Body(None),
    description: str = Body(None), is_active: bool = Body(True),
    current_user = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("TEACHER", "SYS_ADMIN"):
        raise HTTPException(status_code=403, detail="权限不足")
    cls = SchoolClass(
        name=name, subject=subject, grade_level=grade_level,
        description=description, is_active=is_active,
        teacher_id=current_user.id,
    )
    db.add(cls)
    await db.commit()
    await db.refresh(cls)
    return {"ok": True, "id": str(cls.id), "name": cls.name,
            "message": "班级创建成功"}


@router.get("")
async def list_classes(
    search: str = None, current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(SchoolClass)
    if current_user.user_type == "TEACHER":
        query = query.where(SchoolClass.teacher_id == current_user.id)
    if search:
        query = query.where(SchoolClass.name.ilike(f"%{search}%"))
    query = query.order_by(SchoolClass.created_at.desc())
    result = await db.execute(query)
    classes = result.scalars().all()

    out = []
    for c in classes:
        cnt_r = await db.execute(
            select(class_students).where(class_students.c.class_id == c.id)
        )
        student_count = len(cnt_r.all())
        out.append({
            "id": str(c.id), "name": c.name, "subject": c.subject,
            "grade_level": c.grade_level, "description": c.description,
            "is_active": c.is_active, "student_count": student_count,
            "created_at": str(c.created_at) if c.created_at else None,
        })
    return out


@router.put("/{class_id}")
async def update_class(
    class_id: uuid.UUID,
    name: str = Body(None), subject: str = Body(None),
    grade_level: str = Body(None), description: str = Body(None),
    is_active: bool = Body(None),
    current_user = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("TEACHER", "SYS_ADMIN"):
        raise HTTPException(status_code=403, detail="权限不足")
    r = await db.execute(select(SchoolClass).where(SchoolClass.id == class_id))
    cls = r.scalar_one_or_none()
    if not cls: raise HTTPException(404, detail="班级不存在")
    if name is not None: cls.name = name
    if subject is not None: cls.subject = subject
    if grade_level is not None: cls.grade_level = grade_level
    if description is not None: cls.description = description
    if is_active is not None: cls.is_active = is_active
    await db.commit()
    return {"ok": True, "message": "班级已更新"}


@router.delete("/{class_id}")
async def delete_class(
    class_id: uuid.UUID,
    current_user = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("TEACHER", "SYS_ADMIN"):
        raise HTTPException(status_code=403, detail="权限不足")
    r = await db.execute(select(SchoolClass).where(SchoolClass.id == class_id))
    if not r.scalar_one_or_none(): raise HTTPException(404, detail="班级不存在")
    await db.execute(delete(class_students).where(class_students.c.class_id == class_id))
    await db.execute(delete(SchoolClass).where(SchoolClass.id == class_id))
    await db.commit()
    return {"ok": True, "message": "已删除"}


# ─── Student Management ───────────────────────────────────────

@router.get("/{class_id}/students")
async def list_class_students(
    class_id: uuid.UUID,
    current_user = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(SchoolClass).where(SchoolClass.id == class_id))
    if not r.scalar_one_or_none(): raise HTTPException(404, detail="班级不存在")
    result = await db.execute(
        select(Student).join(class_students, class_students.c.student_id == Student.id)
        .where(class_students.c.class_id == class_id)
    )
    students = result.scalars().all()
    return [{"id": str(s.id), "username": s.username, "full_name": s.full_name,
             "email": s.email, "phone": s.phone, "grade": s.grade, "school": s.school}
            for s in students]


@router.get("/{class_id}/available-students")
async def list_available_students(
    class_id: uuid.UUID,
    search: str = None,
    current_user = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    """Students NOT in this class, available to add."""
    from sqlalchemy import text as sa_text
    result = await db.execute(
        sa_text("SELECT s.* FROM students s WHERE s.id NOT IN ("
                "SELECT cs.student_id FROM class_students cs WHERE cs.class_id = :cid)"
                + (" AND (s.full_name LIKE :q OR s.username LIKE :q)" if search else "") +
                " ORDER BY s.full_name LIMIT 100"),
        {"cid": class_id.hex, "q": f"%{search}%" if search else None} if search
        else {"cid": class_id.hex}
    )
    rows = result.fetchall()
    return [{"id": row[0], "username": row[1], "full_name": row[3],
             "email": row[4], "phone": row[5], "grade": row[6]}
            for row in rows]


@router.post("/{class_id}/students")
async def add_student_to_class(
    class_id: uuid.UUID,
    student_id: uuid.UUID = Body(None),
    full_name: str = Body(None), phone: str = Body(None),
    grade: str = Body(None), school: str = Body(None),
    current_user = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    """Add student to class. If student_id given, use existing student.
    Otherwise create a new student with the given info."""
    if current_user.user_type not in ("TEACHER", "SYS_ADMIN"):
        raise HTTPException(status_code=403, detail="权限不足")

    r = await db.execute(select(SchoolClass).where(SchoolClass.id == class_id))
    if not r.scalar_one_or_none(): raise HTTPException(404, detail="班级不存在")

    sid = student_id
    if not sid:
        # Create new student
        if not full_name:
            raise HTTPException(400, detail="请提供学生姓名")
        username = "stu_" + uuid.uuid4().hex[:8]
        from app.core.security import get_password_hash
        student = Student(
            username=username, full_name=full_name,
            phone=phone, grade=grade, school=school,
            password_hash=get_password_hash("111111"),
        )
        db.add(student)
        await db.flush()
        sid = student.id

    # Check not already in class
    existing = await db.execute(
        select(class_students).where(
            class_students.c.class_id == class_id,
            class_students.c.student_id == sid,
        )
    )
    if existing.first():
        raise HTTPException(400, detail="该学生已在班级中")

    await db.execute(class_students.insert().values(
        id=uuid.uuid4(), class_id=class_id, student_id=sid,
    ))
    await db.commit()
    return {"ok": True, "message": "学生已添加"}


@router.delete("/{class_id}/students/{student_id}")
async def remove_student_from_class(
    class_id: uuid.UUID, student_id: uuid.UUID,
    current_user = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    if current_user.user_type not in ("TEACHER", "SYS_ADMIN"):
        raise HTTPException(status_code=403, detail="权限不足")
    await db.execute(
        delete(class_students).where(
            class_students.c.class_id == class_id,
            class_students.c.student_id == student_id,
        )
    )
    await db.commit()
    return {"ok": True, "message": "已移除"}


# ─── Single Student Update (by teacher, no phone) ────────────

@router.put("/{class_id}/students/{student_id}")
async def update_student_in_class(
    class_id: uuid.UUID, student_id: uuid.UUID,
    full_name: str = Body(None), email: str = Body(None),
    grade: str = Body(None), school: str = Body(None),
    current_user = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    """Update student info (not phone)."""
    if current_user.user_type not in ("TEACHER", "SYS_ADMIN"):
        raise HTTPException(status_code=403, detail="权限不足")
    r = await db.execute(select(Student).where(Student.id == student_id))
    student = r.scalar_one_or_none()
    if not student: raise HTTPException(404, detail="学生不存在")
    if full_name is not None: student.full_name = full_name
    if email is not None: student.email = email
    if grade is not None: student.grade = grade
    if school is not None: student.school = school
    await db.commit()
    return {"ok": True, "message": "学生信息已更新"}


@router.get("/{class_id}/students/{student_id}")
async def get_student_detail(
    class_id: uuid.UUID, student_id: uuid.UUID,
    current_user = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Student).where(Student.id == student_id))
    student = r.scalar_one_or_none()
    if not student: raise HTTPException(404, detail="学生不存在")
    return {"id": str(student.id), "username": student.username,
            "full_name": student.full_name, "email": student.email,
            "phone": student.phone, "grade": student.grade, "school": student.school}
