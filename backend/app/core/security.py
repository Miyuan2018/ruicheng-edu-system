import uuid
from datetime import datetime, timedelta
from typing import Any, Union
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.db.session import get_db
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(
    subject: Union[str, Any], expires_delta: timedelta = None
) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {"exp": expire, "sub": str(subject)}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: Union[str, Any]) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {"exp": expire, "sub": str(subject)}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return {}


oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)


class CurrentUser:
    """Unified user object from JWT token — works across sys_admins/admins/students."""
    def __init__(self, id: str, user_type: str):
        self.id = id
        self.user_type = user_type
        self.role = user_type  # for backward compat

    @property
    def is_active(self): return True


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    payload = decode_token(token)
    user_id = payload.get("sub")
    user_type = payload.get("type", "STUDENT")
    if user_id is None:
        raise credentials_exception

    # Verify user exists in appropriate table
    if user_type == "SYS_ADMIN":
        from app.models.sys_admin import SysAdmin
        result = await db.execute(select(SysAdmin).where(SysAdmin.id == user_id))
        if not result.scalar_one_or_none(): raise credentials_exception
    elif user_type in ("TEACHER", "QUESTION_ADMIN"):
        from app.models.admin import Admin
        result = await db.execute(select(Admin).where(Admin.id == user_id))
        if not result.scalar_one_or_none(): raise credentials_exception
    elif user_type == "PARENT":
        from app.models.parent import Parent
        result = await db.execute(select(Parent).where(Parent.id == user_id))
        if not result.scalar_one_or_none(): raise credentials_exception
    elif user_type == "STUDENT":
        from app.models.student import Student
        result = await db.execute(select(Student).where(Student.id == user_id))
        if not result.scalar_one_or_none(): raise credentials_exception
    else:
        raise credentials_exception

    return CurrentUser(user_id, user_type)


def require_role(*roles: str):
    async def role_checker(current_user: CurrentUser = Depends(get_current_user)):
        if current_user.user_type not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="权限不足")
        return current_user
    return role_checker
