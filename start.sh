#!/bin/bash
set -e

# ============================================================
#  睿承教育平台 — 一键启动脚本
# ============================================================

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
CONDA_ENV="$HOME/conda_workspace"

# 初始化 conda
CONDA_BASE="${CONDA_PREFIX:-$HOME/miniconda3}"
if [ ! -d "$CONDA_BASE" ]; then
    for loc in "$HOME/miniconda3" "$HOME/anaconda3" "/opt/conda"; do
        if [ -d "$loc" ]; then CONDA_BASE="$loc"; break; fi
    done
fi
if [ -f "$CONDA_BASE/etc/profile.d/conda.sh" ]; then
    source "$CONDA_BASE/etc/profile.d/conda.sh"
else
    export PATH="$CONDA_BASE/bin:$PATH"
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

cleanup() {
    echo ""
    info "正在关闭服务..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    log "服务已关闭"
    exit 0
}
trap cleanup SIGINT SIGTERM

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   睿承教育平台 — 一键启动${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# ---- 0. 清理残留端口 ----
info "清理残留进程..."
for port in 8000 3000; do
    for pid in $(fuser $port/tcp 2>/dev/null); do
        kill $pid 2>/dev/null
    done
done
sleep 2
log "端口已释放"

# ---- 1. 检查 Conda 环境 ----
info "检查 Python 环境..."
if [ ! -d "$CONDA_ENV" ] || [ ! -f "$CONDA_ENV/bin/python" ]; then
    err "Conda 环境 '$CONDA_ENV' 未找到，正在创建..."
    conda create -p "$CONDA_ENV" python=3.12 -y
    log "环境创建完成"
fi

# ---- 2. 检查后端依赖 ----
info "检查后端依赖..."
MISSING=""
for pkg in fastapi uvicorn sqlalchemy alembic pydantic asyncpg; do
    if ! conda run -p "$CONDA_ENV" pip show "$pkg" &>/dev/null; then
        MISSING=1
        break
    fi
done
if [ -n "$MISSING" ]; then
    warn "缺少依赖，正在安装..."
    conda run -p "$CONDA_ENV" pip install -r "$BACKEND_DIR/requirements.txt" -q
    conda run -p "$CONDA_ENV" pip install asyncpg email-validator "bcrypt<5" -q
    log "后端依赖安装完成"
fi

# ---- 3. 确保配置文件 ----
info "检查配置文件..."
if [ ! -f "$BACKEND_DIR/sysconfig.json" ]; then
    cat > "$BACKEND_DIR/sysconfig.json" << 'JSONEOF'
{
  "secret_key": "ruicheng-edu-secret-key-change-in-production",
  "database": {
    "server": "localhost",
    "port": "5433",
    "database": "edu_system",
    "user": "postgres",
    "password": "postgres"
  },
  "llm": {
    "current": "ollama",
    "ollama": {
      "endpoint": "http://127.0.0.1:11434/v1",
      "model": "",
      "available_models": []
    },
    "deepseek": {
      "api_key": "",
      "model": "deepseek-chat"
    }
  },
  "grading": {
    "max_concurrent_grading": 1,
    "grading_model": "rule"
  },
  "ocr": {
    "engine": "paddleocr",
    "max_concurrent_ocr": 5,
    "confidence_threshold": 0.8
  },
  "mistake_book": {
    "practice_question_count": 5
  },
  "export_max": 200,
  "system": {
    "log_level": "INFO",
    "backup_enabled": false
  }
}
JSONEOF
    log "sysconfig.json 已创建"
fi

# ---- 4. 检查 PostgreSQL ----
info "检查 PostgreSQL..."
if ! PGPASSWORD=postgres psql -U postgres -h localhost -p 5433 -c "SELECT 1" &>/dev/null; then
    err "无法连接 PostgreSQL (postgres/postgres@localhost:5433)"
    err "请确保 PostgreSQL 已启动: sudo systemctl start postgresql"
    exit 1
fi
PGPASSWORD=postgres psql -U postgres -h localhost -p 5433 -c "CREATE DATABASE edu_system" 2>/dev/null || true
log "PostgreSQL 连接正常"

# ---- 5. 数据库初始化 ----
info "运行数据库迁移..."
cd "$BACKEND_DIR"
conda run -p "$CONDA_ENV" alembic upgrade head 2>/dev/null || true
log "数据库迁移完成"
info "检查数据库表..."
TABLES=$(PGPASSWORD=postgres psql -U postgres -d edu_system -h localhost -p 5433 -t \
    -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null | tr -d ' ' || echo "0")
if [ "${TABLES:-0}" -lt 5 ]; then
    warn "创建数据库表..."
    conda run -p "$CONDA_ENV" python -c "
from app.db.base import Base
from app.db.session import engine
from app.models import *
import asyncio
async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('done')
asyncio.run(init())
" 2>/dev/null
    log "数据库表创建完成"
else
    log "数据库表已就绪"
fi

# ---- 6. 种子管理员 ----
info "检查系统管理员..."
HAS_DATA=$(PGPASSWORD=postgres psql -U postgres -d edu_system -h localhost -p 5433 -t \
    -c "SELECT count(*) FROM sys_admins WHERE username='SYSAdmin'" 2>/dev/null | tr -d ' ' || echo "0")
if [ "${HAS_DATA:-0}" != "1" ]; then
    warn "创建系统管理员..."
    cd "$BACKEND_DIR"
    conda run -p "$CONDA_ENV" python -c "
from app.models import *
from app.db.session import AsyncSessionLocal
from app.core.security import get_password_hash
from sqlalchemy import select
import asyncio, uuid
async def seed():
    async with AsyncSessionLocal() as db:
        sid = uuid.uuid4()
        hash_sys = get_password_hash('SYSPass')
        db.add(SysAdmin(id=sid, username='SYSAdmin', password_hash=hash_sys, full_name='系统管理员', is_active=True))
        await db.commit()
        print('SYSAdmin created')
asyncio.run(seed())
" 2>/dev/null
    log "系统管理员已创建"
else
    log "系统管理员已存在"
fi

# ---- 7. 检查前端依赖 ----
info "检查前端依赖..."
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    warn "前端依赖未安装，正在安装..."
    cd "$FRONTEND_DIR"
    npm install --silent
    log "前端依赖安装完成"
fi

# ---- 8. 启动后端 ----
info "启动后端服务 (端口 8000)..."
cd "$BACKEND_DIR"
conda run -p "$CONDA_ENV" uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
sleep 2

if ! kill -0 $BACKEND_PID 2>/dev/null; then
    err "后端启动失败"
    exit 1
fi

for i in $(seq 1 15); do
    if curl -s http://localhost:8000/health >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    log "后端服务已启动 → http://localhost:8000"
else
    err "后端服务启动超时"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# ---- 9. 启动前端 ----
info "启动前端服务 (端口 3000)..."
cd "$FRONTEND_DIR"
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!
sleep 3

if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    err "前端启动失败"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

if curl -s http://localhost:3000 >/dev/null 2>&1; then
    log "前端服务已启动 → http://localhost:3000"
else
    warn "前端可能还在编译中，稍等片刻..."
    sleep 3
fi

# ---- 10. 汇总 ----
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   睿承教育平台启动成功！${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "  数据库:    ${BLUE}PostgreSQL 16 (localhost:5433/edu_system)${NC}"
echo ""
echo -e "  ${BLUE}【学生端】${NC}"
echo -e "    地址:     ${BLUE}http://localhost:3000/login${NC}"
echo -e "    登录:     手机号/用户名 → 图形验证码 → 短信(111111)"
echo ""
echo -e "  ${BLUE}【管理端】${NC}"
echo -e "    地址:     ${BLUE}http://localhost:3000/admin/login${NC}"
echo -e "    登录:     用户名+密码 → 图形验证码 → 短信(111111)"
echo ""
echo -e "  ${YELLOW}【系统管理员】${NC}"
echo -e "    SYSAdmin / SYSPass"
echo ""
echo -e "  API 文档:  ${BLUE}http://localhost:8000/docs${NC}"
echo ""
echo -e "  ${YELLOW}按 Ctrl+C 停止所有服务${NC}"
echo ""

wait
