"""V2.2 Auth: admin login (captcha+SMS) + student login/register."""
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from app.db.session import get_db
from app.models.sys_admin import SysAdmin
from app.models.admin import Admin
from app.models.student import Student
from app.core.security import (
    verify_password, get_password_hash,
    create_access_token, create_refresh_token,
    get_current_user, require_role,
)
from app.core.config import settings
from app.services.captcha import generate_captcha, verify_captcha

router = APIRouter()

# ─── Schemas ──────────────────────────────────────────────

class AdminLoginRequest(BaseModel):
    username: str
    password: str
    captcha_key: str
    captcha_code: str
    sms_code: str = "111111"
    role: int = 0  # 0=教师 1=题库管理员 2=系统管理员
    verify_token: str | None = None  # from /admin/verify, required in /admin/login

class StudentLoginRequest(BaseModel):
    username: str
    captcha_key: str
    captcha_code: str
    sms_code: str = "111111"

class StudentRegisterRequest(BaseModel):
    phone: str = Field(..., min_length=11, max_length=11)
    sms_code: str = "111111"
    full_name: str = Field(..., min_length=1)
    grade: str | None = None
    school: str | None = None

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_type: str  # SYS_ADMIN / QUESTION_ADMIN / TEACHER / STUDENT
    full_name: str


def _make_tokens(user_id, user_type: str) -> dict:
    """Create JWT tokens with user_type in payload."""
    now = datetime.utcnow()
    access_exp = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_exp = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    import jose
    access = jose.jwt.encode(
        {"sub": str(user_id), "type": user_type, "exp": access_exp},
        settings.SECRET_KEY, algorithm=settings.ALGORITHM,
    )
    refresh = jose.jwt.encode(
        {"sub": str(user_id), "type": user_type, "exp": refresh_exp},
        settings.SECRET_KEY, algorithm=settings.ALGORITHM,
    )
    return {"access_token": access, "refresh_token": refresh,
            "token_type": "bearer", "user_type": user_type, "user_id": str(user_id)}


# ─── Captcha ──────────────────────────────────────────────

@router.get("/captcha")
async def get_captcha():
    cap = generate_captcha()
    return {"captcha_key": cap["key"], "captcha_svg": cap["svg"]}


# ─── Admin Login ──────────────────────────────────────────

def _find_admin(login_id: str, role: int, db):
    from sqlalchemy import or_
    if role == 2:
        return db.execute(select(SysAdmin).where(or_(SysAdmin.username == login_id, SysAdmin.phone == login_id)))
    else:
        return db.execute(select(Admin).where(or_(Admin.username == login_id, Admin.phone == login_id), Admin.admin_type == role))


@router.post("/admin/verify")
async def admin_verify(req: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    """Step 1: verify role→password→captcha (no SMS)."""
    from sqlalchemy import or_
    role_names = {0: "教师", 1: "题库管理员", 2: "系统管理员"}
    login_id = req.username.strip()
    if not login_id:
        raise HTTPException(400, detail="请输入用户名或手机号")

    # 1. Verify captcha
    if not verify_captcha(req.captcha_key, req.captcha_code):
        raise HTTPException(400, detail="图形验证码错误，请重新输入")

    # 2. Check if user exists at all (by username/phone)
    if req.role == 2:
        r = await db.execute(select(SysAdmin).where(or_(SysAdmin.username == login_id, SysAdmin.phone == login_id)))
        user = r.scalar_one_or_none()
        actual_role = 2
    else:
        r = await db.execute(select(Admin).where(or_(Admin.username == login_id, Admin.phone == login_id)))
        user = r.scalar_one_or_none()
        actual_role = user.admin_type if user else None

    # 3. User exists check
    if not user:
        raise HTTPException(401, detail="用户名或手机号不存在，请检查输入")

    # 4. Role check
    if actual_role is not None and actual_role != req.role:
        raise HTTPException(401, detail=f"该账号不是{role_names.get(req.role, '未知')}，其角色为{role_names.get(actual_role, '未知')}，请重新选择角色")

    # 4. Password check
    if not verify_password(req.password, user.password_hash):
        raise HTTPException(401, detail="密码错误，请重新输入")

    # 5. Active check
    if hasattr(user, 'is_active') and not user.is_active:
        raise HTTPException(403, detail="该账号已被停用，请联系系统管理员")

    utype = "SYS_ADMIN" if actual_role == 2 else ("QUESTION_ADMIN" if actual_role == 1 else "TEACHER")

    # Generate one-time verify token for login step
    import secrets
    vtoken = secrets.token_hex(16)
    from app.services.captcha import _store as _vstore
    _vstore[vtoken] = {
        "user_id": str(user.id),
        "user_type": utype,
        "full_name": user.full_name,
        "login_id": login_id,
        "role": actual_role,
        "expires": datetime.utcnow() + timedelta(minutes=5),
    }

    return {"ok": True, "verify_token": vtoken, "user_type": utype,
            "full_name": user.full_name, "message": "身份验证通过，请获取短信验证码并完成登录"}


@router.post("/admin/login")
async def admin_login(req: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    """Step 2: login — only verify SMS code + verify_token (identity already checked in step 1)."""
    # 1. Verify SMS code (only check, no password/user re-check)
    if req.sms_code.strip() != "111111":
        raise HTTPException(400, detail="短信验证码错误，请重新输入")

    # 2. Verify token (from /admin/verify)
    if not req.verify_token:
        raise HTTPException(400, detail="请先完成身份验证")

    from app.services.captcha import _store as _vstore
    vdata = _vstore.pop(req.verify_token, None)
    if not vdata:
        raise HTTPException(401, detail="身份验证已过期，请重新验证")
    if datetime.utcnow() > vdata["expires"]:
        raise HTTPException(401, detail="身份验证已过期，请重新验证")

    utype = vdata["user_type"]
    user_id = vdata["user_id"]
    full_name = vdata["full_name"]

    # Update last_login
    if utype == "SYS_ADMIN":
        r = await db.execute(select(SysAdmin).where(SysAdmin.id == uuid.UUID(user_id)))
        user = r.scalar_one_or_none()
    else:
        r = await db.execute(select(Admin).where(Admin.id == uuid.UUID(user_id)))
        user = r.scalar_one_or_none()

    if user:
        user.last_login_at = datetime.now(timezone.utc)
        await db.commit()

    return _make_tokens(user_id, utype) | {"full_name": full_name}


# ─── Student Login ────────────────────────────────────────

@router.post("/student/login")
async def student_login(req: StudentLoginRequest, db: AsyncSession = Depends(get_db)):
    if not verify_captcha(req.captcha_key, req.captcha_code):
        raise HTTPException(400, detail="验证码错误或已过期")
    if req.sms_code != "111111":
        raise HTTPException(400, detail="短信验证码错误")

    from sqlalchemy import or_
    login_id = req.username  # can be username or phone
    result = await db.execute(
        select(Student).where(
            or_(Student.username == login_id, Student.phone == login_id)
        )
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(401, detail="用户名或手机号不存在")
    if not student.is_active:
        raise HTTPException(403, detail="账号已被停用")
    student.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    return _make_tokens(student.id, "STUDENT") | {"full_name": student.full_name}


@router.post("/student/register")
async def student_register(req: StudentRegisterRequest, db: AsyncSession = Depends(get_db)):
    # Verify SMS
    if req.sms_code != "111111":
        raise HTTPException(400, detail="短信验证码错误")

    # Check phone unique
    result = await db.execute(select(Student).where(Student.phone == req.phone))
    if result.scalar_one_or_none():
        raise HTTPException(400, detail="该手机号已注册")

    # Generate username from phone
    username = f"stu_{req.phone[-6:]}"

    student = Student(
        username=username,
        password_hash="",  # no password — SMS login
        full_name=req.full_name,
        phone=req.phone,
        grade=req.grade,
        school=req.school,
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)
    return _make_tokens(student.id, "STUDENT") | {"full_name": student.full_name}


# ─── Admin Management (SysAdmin only) ─────────────────────

@router.post("/admin/create")
async def create_admin(
    username: str, password: str, full_name: str,
    admin_type: int = 0,
    email: str = None, phone: str = None, qualification: str = None,
    current_user = Depends(require_role("SYS_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    """SysAdmin creates teacher or question_admin accounts."""

    result = await db.execute(select(Admin).where(Admin.username == username))
    if result.scalar_one_or_none():
        raise HTTPException(400, detail="用户名已存在")

    admin = Admin(
        username=username,
        password_hash=get_password_hash(password),
        full_name=full_name,
        email=email,
        phone=phone,
        admin_type=admin_type,
        created_by=uuid.UUID(current_user.id),
    )
    db.add(admin)
    await db.commit()
    await db.refresh(admin)
    return {"id": str(admin.id), "username": admin.username, "admin_type": admin.admin_type}


@router.get("/admin/list")
async def list_admins(
    current_user = Depends(require_role("SYS_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Admin).order_by(Admin.created_at.desc()))
    admins = result.scalars().all()
    return [{"id": str(a.id), "username": a.username, "full_name": a.full_name,
             "admin_type": a.admin_type, "role_name": {0:"教师",1:"题库管理员"}.get(a.admin_type,"未知"),
             "is_active": a.is_active,
             "qualification": a.qualification,
             "email": a.email, "phone": a.phone} for a in admins]


@router.delete("/admin/{admin_id}")
async def delete_admin(
    admin_id: uuid.UUID,
    current_user = Depends(require_role("SYS_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Admin).where(Admin.id == admin_id))
    admin = result.scalar_one_or_none()
    if not admin:
        raise HTTPException(404, detail="管理员不存在")
    await db.delete(admin)
    await db.commit()
    return {"message": "已删除"}


@router.put("/admin/{admin_id}/subjects")
async def update_admin_subjects(admin_id: uuid.UUID, subjects: str = "[]", current_user=Depends(require_role("SYS_ADMIN")), db: AsyncSession = Depends(get_db)):
    """Update admin's subject assignments. subjects is JSON array string."""
    import json as _j
    from app.models.admin import Admin
    r = await db.execute(select(Admin).where(Admin.id == admin_id))
    admin = r.scalar_one_or_none()
    if not admin: raise HTTPException(404, detail="管理员不存在")
    admin.subjects = _j.loads(subjects)
    await db.commit()
    return {"message": "学科已更新", "subjects": admin.subjects}


# ─── Profile (all user types) ─────────────────────────────────

@router.get("/profile")
async def get_profile(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get current user's profile info from appropriate table."""
    uid = uuid.UUID(current_user.id)
    utype = current_user.user_type

    if utype == "SYS_ADMIN":
        r = await db.execute(select(SysAdmin).where(SysAdmin.id == uid))
        user = r.scalar_one_or_none()
        if not user: raise HTTPException(404, detail="用户不存在")
        return {"ok": True, "data": {
            "id": str(user.id), "username": user.username, "full_name": user.full_name,
            "email": user.email, "phone": user.phone,
            "user_type": "SYS_ADMIN", "role_label": "系统管理员",
            "is_active": user.is_active, "created_at": str(user.created_at),
            "last_login_at": str(user.last_login_at) if user.last_login_at else None,
        }}
    elif utype in ("TEACHER", "QUESTION_ADMIN"):
        r = await db.execute(select(Admin).where(Admin.id == uid))
        user = r.scalar_one_or_none()
        if not user: raise HTTPException(404, detail="用户不存在")
        role_label = "题库管理员" if user.admin_type == 1 else "教师"
        return {"ok": True, "data": {
            "id": str(user.id), "username": user.username, "full_name": user.full_name,
            "email": user.email, "phone": user.phone,
            "user_type": utype, "role_label": role_label,
            "admin_type": user.admin_type, "subjects": user.subjects,
            "is_active": user.is_active, "created_at": str(user.created_at),
            "last_login_at": str(user.last_login_at) if user.last_login_at else None,
        }}
    else:
        r = await db.execute(select(Student).where(Student.id == uid))
        user = r.scalar_one_or_none()
        if not user: raise HTTPException(404, detail="用户不存在")
        return {"ok": True, "data": {
            "id": str(user.id), "username": user.username, "full_name": user.full_name,
            "email": user.email, "phone": user.phone, "grade": user.grade, "school": user.school,
            "user_type": "STUDENT", "role_label": "学生",
            "is_active": user.is_active, "created_at": str(user.created_at),
            "last_login_at": str(user.last_login_at) if user.last_login_at else None,
        }}


@router.put("/profile")
async def update_profile(req: dict = Body(...), current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Update profile fields (full_name, email, grade, school). Phone excluded."""
    uid = uuid.UUID(current_user.id)
    utype = current_user.user_type

    if utype == "SYS_ADMIN":
        r = await db.execute(select(SysAdmin).where(SysAdmin.id == uid))
        user = r.scalar_one_or_none()
    elif utype in ("TEACHER", "QUESTION_ADMIN"):
        r = await db.execute(select(Admin).where(Admin.id == uid))
        user = r.scalar_one_or_none()
    else:
        r = await db.execute(select(Student).where(Student.id == uid))
        user = r.scalar_one_or_none()

    if not user: raise HTTPException(404, detail="用户不存在")

    allowed = {"full_name", "email", "grade", "school"}
    for k, v in req.items():
        if k in allowed and hasattr(user, k):
            setattr(user, k, v)

    await db.commit()
    await db.refresh(user)
    return {"ok": True, "message": "个人信息已更新"}


class PhoneUpdateRequest(BaseModel):
    phone: str = Field(..., min_length=11, max_length=11)
    sms_code: str = Field(default="111111", min_length=6)


@router.put("/profile/phone")
async def update_phone(req: PhoneUpdateRequest, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Update phone number — requires SMS verification."""
    if req.sms_code.strip() != "111111":
        raise HTTPException(400, detail="短信验证码错误，请重新输入")

    uid = uuid.UUID(current_user.id)
    utype = current_user.user_type

    if utype == "SYS_ADMIN":
        r = await db.execute(select(SysAdmin).where(SysAdmin.id == uid))
        user = r.scalar_one_or_none()
    elif utype in ("TEACHER", "QUESTION_ADMIN"):
        r = await db.execute(select(Admin).where(Admin.id == uid))
        user = r.scalar_one_or_none()
    else:
        r = await db.execute(select(Student).where(Student.id == uid))
        user = r.scalar_one_or_none()

    if not user: raise HTTPException(404, detail="用户不存在")
    user.phone = req.phone
    await db.commit()
    return {"ok": True, "message": "手机号已更新", "phone": req.phone}
