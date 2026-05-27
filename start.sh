#!/bin/bash
set -e

# ============================================================
#  睿承教育平台 — 一键启动脚本
#
#  用法：
#    ./start.sh          普通启动（复用已有环境和数据库）
#    ./start.sh -c       重建 conda 环境后启动
#    ./start.sh -d       重建数据库（drop→建表→导入演示数据）后启动
#    ./start.sh -c -d    同时重建环境和数据库
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

# ---- 解析参数 ----
OPT_CONDA=0
OPT_DB=0
while getopts "cd" opt; do
    case $opt in
        c) OPT_CONDA=1 ;;
        d) OPT_DB=1 ;;
        *) echo "用法: $0 [-c] [-d]"; exit 1 ;;
    esac
done

# ---- 从 sysconfig.json 读取数据库配置 ----
read_db_config() {
    local cfg="$BACKEND_DIR/sysconfig.json"
    [ -f "$cfg" ] || return 1
    "$CONDA_ENV/bin/python" -c "
import json
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
[ "$OPT_CONDA" = "1" ] && echo -e "${YELLOW}   模式: 重建 conda 环境${NC}"
[ "$OPT_DB"    = "1" ] && echo -e "${YELLOW}   模式: 重建数据库${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# ---- 0. 初始化 Conda ----
info "初始化 Python 环境..."
CONDA_BASE="${CONDA_PREFIX:-$HOME/miniconda3}"
if [ ! -d "$CONDA_BASE" ]; then
    for loc in "$HOME/miniconda3" "$HOME/anaconda3" "/opt/conda"; do
        [ -d "$loc" ] && { CONDA_BASE="$loc"; break; }
    done
fi
[ -f "$CONDA_BASE/etc/profile.d/conda.sh" ] && source "$CONDA_BASE/etc/profile.d/conda.sh"
export PATH="$CONDA_BASE/bin:$PATH"

PYTHON="$CONDA_ENV/bin/python"
PIP="$CONDA_ENV/bin/pip"

# ---- 1. 检查/创建 Conda 环境 ----
info "检查 Python 环境..."
NEED_CREATE=0

if [ "$OPT_CONDA" = "1" ]; then
    # -c 参数：强制重建
    warn "强制重建 conda 环境..."
    conda env remove -p "$CONDA_ENV" -y 2>/dev/null || rm -rf "$CONDA_ENV"
    NEED_CREATE=1
elif [ ! -d "$CONDA_ENV" ] || [ ! -f "$PYTHON" ]; then
    # 环境不存在：创建
    warn "Conda 环境未找到，正在创建..."
    NEED_CREATE=1
else
    # 环境存在：检查版本
    PY_VER=$("$PYTHON" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null || echo "0.0")
    if [ "$PY_VER" != "3.12" ]; then
        warn "当前 Python 版本为 $PY_VER，需要 3.12，正在重建环境..."
        conda env remove -p "$CONDA_ENV" -y 2>/dev/null || rm -rf "$CONDA_ENV"
        NEED_CREATE=1
    else
        log "Python 版本符合要求: $PY_VER"
    fi
fi

if [ "$NEED_CREATE" = "1" ]; then
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
    $PIP show "$pkg" &>/dev/null || { MISSING=1; break; }
done
if [ -n "$MISSING" ] || [ "$NEED_CREATE" = "1" ]; then
    warn "安装后端依赖..."
    $PIP install -r "$BACKEND_DIR/requirements.txt" -q
    $PIP install asyncpg email-validator "bcrypt==3.2.2" -q
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
log "PostgreSQL 连接正常"

# ---- 7. 数据库初始化 ----
cd "$BACKEND_DIR"

if [ "$OPT_DB" = "1" ]; then
    # -d 参数：删库重建
    warn "重建数据库 $DB_NAME ..."
    psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" \
        -c "DROP DATABASE IF EXISTS $DB_NAME" 2>/dev/null || true
    psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" \
        -c "CREATE DATABASE $DB_NAME" || die "创建数据库失败"
    log "数据库已重建"
else
    # 普通启动：确保数据库存在
    psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" \
        -c "CREATE DATABASE $DB_NAME" 2>/dev/null || true
fi

info "初始化数据库表结构..."
$PYTHON -c "
from app.db.base import Base
from app.db.session import engine
from app.models import *
import asyncio
async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
asyncio.run(init())
" || die "数据库建表失败，请检查 PostgreSQL 连接配置"
log "数据库表结构已就绪"

# ---- 8. 演示数据 ----
if [ "$OPT_DB" = "1" ]; then
    # -d 参数：强制重新导入
    info "导入 V3.5 演示数据..."
    $PYTHON demo_data.py || warn "演示数据导入失败，可手动执行: cd backend && python demo_data.py"
else
    # 普通启动：仅首次（表为空）时导入
    HAS_DATA=$($PYTHON -c "
import asyncio
from sqlalchemy import text
from app.db.session import AsyncSessionLocal
async def check():
    async with AsyncSessionLocal() as db:
        r = await db.execute(text('SELECT COUNT(*) FROM students'))
        print(r.scalar())
asyncio.run(check())
" 2>/dev/null || echo "0")
    if [ "${HAS_DATA:-0}" = "0" ]; then
        info "数据库为空，导入 V3.5 演示数据..."
        $PYTHON demo_data.py || warn "演示数据导入失败，可手动执行: cd backend && python demo_data.py"
    else
        log "数据库已有数据（students: $HAS_DATA），跳过演示数据导入"
    fi
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
    die "后端启动失败，请检查上方错误日志"
fi

info "等待后端就绪..."
for i in $(seq 1 20); do
    curl -s http://localhost:8000/health >/dev/null 2>&1 && break
    sleep 1
done

if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    log "后端服务已启动 → http://localhost:8000"
else
    err "后端服务启动超时 (20s)"
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

FRONTEND_READY=false
for i in $(seq 1 15); do
    curl -s http://localhost:3000 >/dev/null 2>&1 && { FRONTEND_READY=true; break; }
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
echo -e "  ${BLUE}【学生端】${NC}    http://localhost:3000/login"
echo -e "    登录:     手机号/用户名 → 图形验证码 → 短信(111111)"
echo ""
echo -e "  ${BLUE}【管理端】${NC}    http://localhost:3000/admin/login"
echo -e "    登录:     用户名+密码 → 图形验证码 → 短信(111111)"
echo ""
echo -e "  ${YELLOW}【系统管理员】${NC} SYSAdmin / SYSPass"
echo ""
echo -e "  API 文档:  ${BLUE}http://localhost:8000/docs${NC}"
echo ""
echo -e "  ${YELLOW}按 Ctrl+C 停止所有服务${NC}"
echo ""

wait
