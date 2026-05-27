#!/bin/bash
set -e

# ============================================================
#  睿承教育平台 — 一键启动脚本
# ============================================================

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
CONDA_ENV="$HOME/conda_workspace"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${BLUE}[i]${NC} $1"; }
die()  { err "$1"; exit 1; }

# ---- 从 sysconfig.json 读取数据库配置 ----
read_db_config() {
    local cfg="$BACKEND_DIR/sysconfig.json"
    if [ ! -f "$cfg" ]; then
        return 1
    fi
    # 用 Python 解析 JSON，避免依赖 jq
    "$CONDA_ENV/bin/python" -c "
import json, sys
with open('$cfg') as f:
    cfg = json.load(f)
db = cfg.get('database', {})
print(db.get('server','localhost'))
print(db.get('port','5432'))
print(db.get('database','edu_system'))
print(db.get('user','postgres'))
print(db.get('password','postgres'))
" 2>/dev/null
}

# ---- 清理函数 ----
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

# ---- 0. 初始化 Conda ----
info "初始化 Python 环境..."
CONDA_BASE="${CONDA_PREFIX:-$HOME/miniconda3}"
if [ ! -d "$CONDA_BASE" ]; then
    for loc in "$HOME/miniconda3" "$HOME/anaconda3" "/opt/conda"; do
        if [ -d "$loc" ]; then CONDA_BASE="$loc"; break; fi
    done
fi
if [ -f "$CONDA_BASE/etc/profile.d/conda.sh" ]; then
    source "$CONDA_BASE/etc/profile.d/conda.sh"
fi
export PATH="$CONDA_BASE/bin:$PATH"

# 优先用直接路径，避免 conda run 的开销
PYTHON="$CONDA_ENV/bin/python"
PIP="$CONDA_ENV/bin/pip"

# ---- 1. 检查/创建 Conda 环境 ----
info "检查 Python 环境..."
if [ ! -d "$CONDA_ENV" ] || [ ! -f "$PYTHON" ]; then
    warn "Conda 环境 '$CONDA_ENV' 未找到，正在创建..."
    conda create -p "$CONDA_ENV" python=3.12 -y
    PYTHON="$CONDA_ENV/bin/python"
    PIP="$CONDA_ENV/bin/pip"
    log "环境创建完成"
fi
log "Python: $($PYTHON --version 2>&1)"

# ---- 2. 确保配置文件 ----
info "检查配置文件..."
if [ ! -f "$BACKEND_DIR/sysconfig.json" ]; then
    cat > "$BACKEND_DIR/sysconfig.json" << 'JSONEOF'
{
  "secret_key": "ruicheng-edu-secret-key-change-in-production",
  "database": {
    "server": "localhost",
    "port": "5432",
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

# ---- 3. 读取数据库配置 ----
info "读取数据库配置..."
DB_CONFIG=$(read_db_config) || {
    warn "无法解析 sysconfig.json，使用默认值"
    DB_CONFIG="localhost
5432
edu_system
postgres
postgres"
}
DB_HOST=$(echo "$DB_CONFIG" | sed -n '1p')
DB_PORT=$(echo "$DB_CONFIG" | sed -n '2p')
DB_NAME=$(echo "$DB_CONFIG" | sed -n '3p')
DB_USER=$(echo "$DB_CONFIG" | sed -n '4p')
DB_PASS=$(echo "$DB_CONFIG" | sed -n '5p')

info "数据库配置: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# 定义 PGPASSWORD 供后续 psql 使用
export PGPASSWORD="$DB_PASS"

# ---- 4. 清理残留端口 ----
info "清理残留进程..."
for port in 8000 3000; do
    if command -v fuser &>/dev/null; then
        for pid in $(fuser $port/tcp 2>/dev/null); do
            kill $pid 2>/dev/null || true
        done
    fi
done
sleep 1
log "端口检查完成"

# ---- 5. 检查后端依赖 ----
info "检查后端依赖..."
MISSING=""
for pkg in fastapi uvicorn sqlalchemy alembic pydantic asyncpg; do
    if ! $PIP show "$pkg" &>/dev/null; then
        MISSING=1
        break
    fi
done
if [ -n "$MISSING" ]; then
    warn "缺少依赖，正在安装..."
    $PIP install -r "$BACKEND_DIR/requirements.txt" -q
    $PIP install asyncpg email-validator "bcrypt<5" -q
    log "后端依赖安装完成"
fi

# ---- 6. 检查 PostgreSQL ----
info "检查 PostgreSQL..."
if ! psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -c "SELECT 1" &>/dev/null; then
    err "无法连接 PostgreSQL (${DB_USER}@${DB_HOST}:${DB_PORT})"
    err "请确保 PostgreSQL 已启动: sudo systemctl start postgresql"
    err "或检查 sysconfig.json 中 database 配置是否正确"
    exit 1
fi
psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -c "CREATE DATABASE $DB_NAME" 2>/dev/null || true
log "PostgreSQL 连接正常"

# ---- 7. 数据库迁移 ----
info "运行数据库迁移..."
cd "$BACKEND_DIR"
if ! $PYTHON -m alembic upgrade head; then
    warn "Alembic 迁移失败，尝试直接建表..."
    $PYTHON -c "
from app.db.base import Base
from app.db.session import engine
from app.models import *
import asyncio
async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('done')
asyncio.run(init())
" || die "数据库初始化失败，请检查数据库连接配置"
    log "数据库表已创建"
else
    log "数据库迁移完成"
fi

# ---- 8. 种子数据 ----
info "检查参考数据..."
$PYTHON -c "
import asyncio
from app.db.session import AsyncSessionLocal
from app.seed_reference import seed_reference_data
async def run():
    async with AsyncSessionLocal() as db:
        await seed_reference_data(db)
asyncio.run(run())
" 2>/dev/null || warn "参考数据种子可能已存在"

info "检查系统管理员..."
HAS_ADMIN=$($PYTHON -c "
import asyncio
from sqlalchemy import select, func
from app.db.session import AsyncSessionLocal
from app.models import SysAdmin
async def check():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(func.count()).select_from(SysAdmin).where(SysAdmin.username=='SYSAdmin'))
        count = result.scalar()
        print(count)
asyncio.run(check())
" 2>/dev/null || echo "0")

if [ "${HAS_ADMIN:-0}" != "1" ]; then
    warn "创建系统管理员..."
    $PYTHON -c "
from app.models import SysAdmin
from app.db.session import AsyncSessionLocal
from app.core.security import get_password_hash
import asyncio, uuid
async def seed():
    async with AsyncSessionLocal() as db:
        sid = uuid.uuid4()
        hash_sys = get_password_hash('SYSPass')
        db.add(SysAdmin(id=sid, username='SYSAdmin', password_hash=hash_sys, full_name='系统管理员', is_active=True))
        await db.commit()
        print('done')
asyncio.run(seed())
" || warn "系统管理员可能已存在"
    log "系统管理员已创建"
else
    log "系统管理员已存在"
fi

# ---- 9. 检查前端依赖 ----
info "检查前端依赖..."
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    warn "前端依赖未安装，正在安装..."
    cd "$FRONTEND_DIR"
    npm install
    log "前端依赖安装完成"
fi

# ---- 10. 启动后端 ----
info "启动后端服务 (端口 8000)..."
cd "$BACKEND_DIR"
$PYTHON -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
sleep 2

if ! kill -0 $BACKEND_PID 2>/dev/null; then
    err "后端启动失败"
    err "请检查上方错误日志"
    exit 1
fi

info "等待后端就绪..."
for i in $(seq 1 20); do
    if curl -s http://localhost:8000/health >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    log "后端服务已启动 → http://localhost:8000"
else
    err "后端服务启动超时 (20s)"
    err "请检查 http://localhost:8000/docs 是否可访问"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# ---- 11. 启动前端 ----
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

# 前端需要编译，给更多时间
FRONTEND_READY=false
for i in $(seq 1 15); do
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
        FRONTEND_READY=true
        break
    fi
    sleep 2
done

if [ "$FRONTEND_READY" = true ]; then
    log "前端服务已启动 → http://localhost:3000"
else
    warn "前端可能还在编译中，稍后访问 http://localhost:3000"
fi

# ---- 12. 汇总 ----
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   睿承教育平台启动成功！${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "  数据库:    ${BLUE}PostgreSQL (${DB_HOST}:${DB_PORT}/${DB_NAME})${NC}"
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
