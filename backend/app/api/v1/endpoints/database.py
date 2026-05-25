"""Database status and config endpoint — sysadmin only."""
import sys, time
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.security import get_current_user, require_role
from app.core.config import settings
from app.services.config_service import load_config, save_config
from app.models.question import Question
from app.models.exam_paper import ExamPaper
from app.models.school_class import SchoolClass
from app.models.admin import Admin
from app.models.student import Student
from app.models.sys_admin import SysAdmin

router = APIRouter()

_start_time = time.time()


@router.get("/admin/dashboard/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_role("SYS_ADMIN")(current_user)

    from sqlalchemy import select, func as f

    r = await db.execute(select(f.count()).select_from(SysAdmin))
    sys_count = r.scalar() or 0
    r = await db.execute(select(f.count()).select_from(Admin))
    admin_count = r.scalar() or 0
    r = await db.execute(select(f.count()).select_from(Student))
    stu_count = r.scalar() or 0
    users = sys_count + admin_count + stu_count
    r = await db.execute(select(f.count()).select_from(Question))
    questions = r.scalar() or 0
    r = await db.execute(select(f.count()).select_from(ExamPaper))
    papers = r.scalar() or 0
    r = await db.execute(select(f.count()).select_from(SchoolClass))
    classes = r.scalar() or 0

    r = await db.execute(text("SELECT pg_database_size(current_database())"))
    db_size = r.scalar() or 0

    r = await db.execute(text("SELECT count(*) FROM pg_tables WHERE schemaname='public'"))
    table_count = r.scalar() or 0

    cfg = load_config()
    llm_cfg = cfg.get("llm", {})
    current_provider = llm_cfg.get("current", "ollama")
    current_model = ""
    if current_provider == "ollama":
        current_model = llm_cfg.get("ollama", {}).get("model", "")
    else:
        current_model = llm_cfg.get("deepseek", {}).get("model", "")

    uptime_seconds = int(time.time() - _start_time)

    return {
        "stats": {
            "users": users,
            "questions": questions,
            "papers": papers,
            "classes": classes,
        },
        "database": {
            "version": "PostgreSQL 16",
            "size_mb": round(db_size / (1024 * 1024), 2),
            "table_count": table_count,
            "total_rows": users + questions + papers + classes,
        },
        "llm": {
            "current": current_provider,
            "model": current_model,
        },
        "server": {
            "python": f"{sys.version_info.major}.{sys.version_info.minor}",
            "version": settings.VERSION,
            "uptime_seconds": uptime_seconds,
        },
    }


class DatabaseConfigRequest(BaseModel):
    server: str = "localhost"
    port: str = "5432"
    database: str = "edu_system"
    user: str = "postgres"
    password: str = ""


@router.get("/admin/database/status")
async def get_database_status(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_role("SYS_ADMIN")(current_user)

    version_result = await db.execute(text("SELECT version()"))
    pg_version = version_result.scalar()

    size_result = await db.execute(
        text("SELECT pg_database_size(current_database())")
    )
    db_size_bytes = size_result.scalar()

    tables_result = await db.execute(text("""
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
    """))
    tables = [row[1] for row in tables_result.fetchall()]

    table_stats = {}
    for tbl in tables:
        try:
            r = await db.execute(text(f'SELECT count(*) FROM "{tbl}"'))
            count = r.scalar()
            table_stats[tbl] = count
        except Exception:
            table_stats[tbl] = 0

    cfg = load_config()
    db_cfg = cfg.get("database", {})

    return {
        "connection": {
            "server": db_cfg.get("server", settings.POSTGRES_SERVER),
            "port": db_cfg.get("port", settings.POSTGRES_PORT),
            "database": db_cfg.get("database", settings.POSTGRES_DB),
            "user": db_cfg.get("user", settings.POSTGRES_USER),
        },
        "version": pg_version,
        "size_bytes": db_size_bytes,
        "size_mb": round(db_size_bytes / (1024 * 1024), 2) if db_size_bytes else 0,
        "table_count": len(tables),
        "table_stats": table_stats,
        "total_rows": sum(table_stats.values()),
    }


@router.post("/admin/database/config")
async def update_database_config(
    req: DatabaseConfigRequest,
    current_user=Depends(get_current_user),
):
    """Update database connection parameters in sysconfig.json."""
    require_role("SYS_ADMIN")(current_user)

    cfg = load_config()
    db_cfg = cfg.get("database", {})
    db_cfg["server"] = req.server
    db_cfg["port"] = req.port
    db_cfg["database"] = req.database
    db_cfg["user"] = req.user
    if req.password:
        db_cfg["password"] = req.password
    cfg["database"] = db_cfg
    save_config(cfg)

    return {"message": "数据库配置已保存，重启后端服务后生效"}
