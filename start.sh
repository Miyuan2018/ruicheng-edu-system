#!/bin/bash
set -e

# ============================================================
#  睿承教育平台 — 一键启动脚本
# ============================================================

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
CONDA_ENV="/home/zhanglijun/conda_workspace"

# 初始化 conda
CONDA_BASE="/home/zhanglijun/miniconda3"
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
for pkg in fastapi uvicorn sqlalchemy alembic pydantic; do
    if ! conda run -p "$CONDA_ENV" pip show "$pkg" &>/dev/null; then
        MISSING=1
        break
    fi
done
if [ -n "$MISSING" ]; then
    warn "缺少依赖，正在安装..."
    conda run -p "$CONDA_ENV" pip install -r "$BACKEND_DIR/requirements.txt" -q
    conda run -p "$CONDA_ENV" pip install aiosqlite email-validator "bcrypt<5" -q
    log "后端依赖安装完成"
fi

# ---- 3. 数据库迁移 ----
info "检查数据库..."
if [ ! -f "$BACKEND_DIR/edu_system.db" ]; then
    warn "数据库不存在，执行迁移..."
    cd "$BACKEND_DIR"
    conda run -p "$CONDA_ENV" alembic upgrade head
    log "数据库初始化完成"
else
    cd "$BACKEND_DIR"
    conda run -p "$CONDA_ENV" alembic upgrade head 2>/dev/null
    log "数据库已就绪"
fi

# ---- 3.1 种子数据 ----
info "检查系统管理员..."
cd "$BACKEND_DIR"
conda run -p "$CONDA_ENV" python -c "
from app.core.security import get_password_hash
from app.db.session import AsyncSessionLocal
from app.models.sys_admin import SysAdmin
from sqlalchemy import select
import asyncio
async def seed():
    async with AsyncSessionLocal() as db:
        r = await db.execute(select(SysAdmin).where(SysAdmin.username == 'SYSAdmin'))
        if not r.scalar_one_or_none():
            db.add(SysAdmin(username='SYSAdmin', password_hash=get_password_hash('SYSPass'), full_name='系统管理员'))
            await db.commit()
            print('SYSAdmin 已创建')
asyncio.run(seed())
" 2>/dev/null
log "系统管理员就绪"

# ---- 4. 检查前端依赖 ----
info "检查前端依赖..."
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    warn "前端依赖未安装，正在安装..."
    cd "$FRONTEND_DIR"
    conda run -p "$CONDA_ENV" npm install --silent
    log "前端依赖安装完成"
fi

# ---- 5. 启动后端 ----
info "启动后端服务 (端口 8000)..."
cd "$BACKEND_DIR"
conda run -p "$CONDA_ENV" uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
sleep 2

if ! kill -0 $BACKEND_PID 2>/dev/null; then
    err "后端启动失败"
    exit 1
fi

# 等后端就绪
for i in $(seq 1 15); do
    if curl -s http://localhost:8000/health >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    log "后端服务已启动 → http://localhost:8000"
else
    err "后端服务启动超时，请检查日志"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# ---- 6. 启动前端 ----
info "启动前端服务 (端口 3000)..."
cd "$FRONTEND_DIR"
conda run -p "$CONDA_ENV" npm run dev -- --host 0.0.0.0 &
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

# ---- 7. 汇总 ----
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   🚀 睿承教育平台启动成功！${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "  ${BLUE}【学生端】${NC}"
echo -e "    地址:     ${BLUE}http://localhost:3000/login${NC}"
echo -e "    登录方式:  手机号/用户名 → 图形验证码 → 短信(111111)"
echo -e "    注册方式:  手机号 → 验证码 → 填写信息 → 完成"
echo ""
echo -e "  ${BLUE}【管理端】${NC}"
echo -e "    地址:     ${BLUE}http://localhost:3000/admin/login${NC}"
echo -e "    登录方式:  用户名+密码 → 图形验证码 → 短信(111111)"
echo ""
echo -e "  ${YELLOW}【系统管理员 SYSAdmin】${NC}"
echo -e "    用户名:   ${YELLOW}SYSAdmin${NC}    密码: ${YELLOW}SYSPass${NC}"
echo ""
echo -e "  ${YELLOW}【教师测试帐号】${NC}"
echo -e "    用户名:   ${YELLOW}t01${NC}           密码: ${YELLOW}th0001${NC}    角色: 教师(数学)"
echo ""
echo -e "  ${YELLOW}【题库管理员测试帐号】${NC}"
echo -e "    用户名:   ${YELLOW}tk01${NC}          密码: ${YELLOW}tk0001${NC}    角色: 题库管理员(全学科)"
echo ""
echo -e "  API 文档:  ${BLUE}http://localhost:8000/docs${NC}"
echo ""
echo -e "  ${YELLOW}按 Ctrl+C 停止所有服务${NC}"
echo ""

wait
