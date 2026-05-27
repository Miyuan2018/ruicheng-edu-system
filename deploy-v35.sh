#!/usr/bin/env bash
# =============================================================================
#  睿承教育平台 V3.5 — 一键部署脚本
# =============================================================================
#
#  用法:
#    ./deploy-v35.sh              交互式部署（推荐）
#    ./deploy-v35.sh -y           非交互，全部自动确认
#    ./deploy-v35.sh -d           重建数据库 + 重新导入演示数据
#    ./deploy-v35.sh -s           仅启动服务（跳过环境初始化）
#    ./deploy-v35.sh --docker     使用 Docker Compose 部署
#    ./deploy-v35.sh -h           显示帮助
#
#  环境要求:
#    Linux / macOS | PostgreSQL 16+ | Node.js 20+
#    Conda 不存在时自动安装 Miniconda3
# =============================================================================

set -euo pipefail

# ── 路径 ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
CONDA_ENV_DIR="$HOME/conda_workspace"
LOG_FILE="$SCRIPT_DIR/deploy-v35-$(date '+%Y%m%d-%H%M%S').log"

# ── 颜色 ──────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ── 全局状态 ──────────────────────────────────────────────────────────────────
OPT_AUTO_YES=false; OPT_REBUILD_DB=false; OPT_SKIP_SETUP=false; OPT_DOCKER=false
BACKEND_PID=""; FRONTEND_PID=""
PYTHON=""; PIP=""          # 由 setup_python 设置
DB_HOST=""; DB_PORT=""; DB_NAME=""; DB_USER=""; DB_PASS=""

# ═══════════════════════════════════════════════════════════════════════════════
# 工具函数
# ═══════════════════════════════════════════════════════════════════════════════
log()   { echo -e "${GREEN}[OK]${NC} $1" | tee -a "$LOG_FILE"; }
warn()  { echo -e "${YELLOW}[!!]${NC} $1" | tee -a "$LOG_FILE"; }
err()   { echo -e "${RED}[XX]${NC} $1" | tee -a "$LOG_FILE"; }
info()  { echo -e "${BLUE}[..]${NC} $1" | tee -a "$LOG_FILE"; }
step()  { echo -e "\n${CYAN}${BOLD}▶ $1${NC}" | tee -a "$LOG_FILE"; }
die()   { err "$1"; exit 1; }

confirm() {
    $OPT_AUTO_YES && return 0
    local prompt="$1"
    read -r -p "$(echo -e "${YELLOW}[?]${NC} $prompt [Y/n]: ")" answer
    [[ -z "$answer" || "$answer" =~ ^[Yy] ]]
}

cleanup() {
    echo ""
    info "正在关闭服务..."
    [ -n "$BACKEND_PID" ]  && kill "$BACKEND_PID"  2>/dev/null || true
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
    log "服务已关闭。日志: $LOG_FILE"
    exit 0
}
trap cleanup SIGINT SIGTERM

check_cmd() { command -v "$1" &>/dev/null || die "未找到 '$1'，请先安装"; }

port_free() {
    local p=$1
    { command -v ss      &>/dev/null && ss -tlnp 2>/dev/null      | grep -q ":$p " ; } \
     || { command -v netstat &>/dev/null && netstat -tlnp 2>/dev/null | grep -q ":$p " ; } \
     || { command -v lsof    &>/dev/null && lsof -i ":$p" &>/dev/null ; } \
     && return 1 || return 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# 参数解析
# ═══════════════════════════════════════════════════════════════════════════════
usage() {
    sed -n '2,16p' "$0"
    exit 0
}
while [[ $# -gt 0 ]]; do
    case "$1" in
        -y) OPT_AUTO_YES=true ;;
        -d) OPT_REBUILD_DB=true ;;
        -s) OPT_SKIP_SETUP=true ;;
        --docker) OPT_DOCKER=true ;;
        -h|--help) usage ;;
        *) echo -e "${RED}未知选项: $1${NC}"; usage ;;
    esac
    shift
done

# ═══════════════════════════════════════════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════════════════════════════════════════
main() {
    clear 2>/dev/null || true
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║       ${BOLD}睿承教育平台 V3.5 — 一键部署${NC}${BLUE}                       ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
    echo -e "  日志: ${CYAN}$LOG_FILE${NC}"
    echo ""

    $OPT_DOCKER && { deploy_docker; return; }

    step "1/7  环境检查";    preflight_check

    if ! $OPT_SKIP_SETUP; then
        step "2/7  Python 环境"; setup_python
        step "3/7  配置文件";   setup_config
        _read_db_config            # 统一解析 DB 配置到全局变量
        step "4/7  数据库";      setup_database
        step "5/7  演示数据";    setup_demo_data
        step "6/7  前端依赖";    setup_frontend
    else
        info "跳过环境初始化 (-s)"
        # -s 模式下仍需确保 PYTHON/PIP 可用
        PYTHON="$CONDA_ENV_DIR/bin/python"; PIP="$CONDA_ENV_DIR/bin/pip"
        _read_db_config
    fi

    step "7/7  启动服务"
    start_backend
    start_frontend
    print_summary
    wait
}

# ═══════════════════════════════════════════════════════════════════════════════
# 1. 环境检查
# ═══════════════════════════════════════════════════════════════════════════════
preflight_check() {
    info "操作系统: $(uname -s)"
    info "可用磁盘: $(df -h "$SCRIPT_DIR" | tail -1 | awk '{print $4}')"
    command -v free &>/dev/null && info "系统内存: $(free -h | awk '/Mem:/{print $2}')"

    # Conda — 只检测，不报错（由 setup_python 负责安装）
    _find_conda && log "Conda: $(conda --version 2>&1)" || warn "Conda 未找到，稍后自动安装"

    # Node
    if command -v node &>/dev/null; then
        local nv; nv=$(node --version | sed 's/v//' | cut -d. -f1)
        [ "$nv" -lt 18 ] && warn "Node.js $nv < 18，建议升级"
        log "Node.js: $(node --version)"
    else
        die "未找到 Node.js，请安装: https://nodejs.org"
    fi
    check_cmd npm; log "npm: $(npm --version)"

    # PostgreSQL 客户端 (可选)
    command -v psql &>/dev/null && log "psql: $(psql --version 2>&1 | head -1)" || warn "psql 未安装，使用 Python 连接"
}

# ═══════════════════════════════════════════════════════════════════════════════
# 2. Python 环境 (含 conda 自动安装)
# ═══════════════════════════════════════════════════════════════════════════════
_find_conda() {
    command -v conda &>/dev/null && return 0
    for loc in "$HOME/miniconda3" "$HOME/anaconda3" "/opt/conda"; do
        [ -f "$loc/etc/profile.d/conda.sh" ] && { source "$loc/etc/profile.d/conda.sh"; return 0; }
    done
    return 1
}

_install_conda() {
    local dir="$HOME/miniconda3" os arch url tmp
    os=$(uname -s); arch=$(uname -m)
    case "$os" in
        Linux)  url="https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-${arch}.sh" ;;
        Darwin) url="https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-${arch}.sh" ;;
        *)      die "不支持的操作系统: $os" ;;
    esac
    tmp=$(mktemp /tmp/miniconda-XXXXXX.sh)
    info "下载 Miniconda3..."
    curl -fsSL# "$url" -o "$tmp" 2>/dev/null || wget -q --show-progress "$url" -O "$tmp" 2>/dev/null || {
        rm -f "$tmp"; die "下载失败，请手动安装: https://docs.conda.io/en/latest/miniconda.html"
    }
    info "安装 Miniconda3 → $dir ..."
    bash "$tmp" -b -p "$dir" >> "$LOG_FILE" 2>&1 || { rm -f "$tmp"; die "安装失败"; }
    rm -f "$tmp"
    source "$dir/etc/profile.d/conda.sh"
    conda init bash 2>/dev/null || true
    log "Miniconda3 安装完成"
}

setup_python() {
    _find_conda || { warn "安装 Miniconda3..."; _install_conda; _find_conda || die "加载失败"; }
    log "Conda: $(conda --version 2>&1)"

    PYTHON="$CONDA_ENV_DIR/bin/python"
    PIP="$CONDA_ENV_DIR/bin/pip"
    local need_create=false

    if [ -f "$PYTHON" ]; then
        local ver
        ver=$("$PYTHON" -c "import sys;print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null || echo "0")
        if [ "$ver" = "3.12" ]; then
            log "Python 3.12 环境已就绪"
        else
            warn "Python $ver → 重建 3.12 环境..."
            rm -rf "$CONDA_ENV_DIR"
            need_create=true
        fi
    else
        warn "创建 Python 3.12 环境..."
        need_create=true
    fi

    if $need_create; then
        conda create -p "$CONDA_ENV_DIR" python=3.12 -y >> "$LOG_FILE" 2>&1
        log "Python 3.12 环境创建完成"
    fi

    # 安装依赖
    local missing=false
    for pkg in fastapi uvicorn sqlalchemy alembic pydantic asyncpg passlib; do
        "$PIP" show "$pkg" &>/dev/null || { missing=true; break; }
    done
    if $missing || $need_create; then
        info "安装后端依赖..."
        cd "$BACKEND_DIR"
        "$PIP" install -r requirements.txt -q 2>>"$LOG_FILE" || \
        "$PIP" install -r requirements.txt -q -i https://mirrors.aliyun.com/pypi/simple/ 2>>"$LOG_FILE"
        "$PIP" install asyncpg email-validator "bcrypt==3.2.2" -q 2>>"$LOG_FILE" || \
        "$PIP" install asyncpg email-validator "bcrypt==3.2.2" -q -i https://mirrors.aliyun.com/pypi/simple/ 2>>"$LOG_FILE"
        log "后端依赖安装完成"
    else
        log "后端依赖已就绪"
    fi
    log "Python: $("$PYTHON" --version 2>&1)"
}

# ═══════════════════════════════════════════════════════════════════════════════
# 3. 配置文件
# ═══════════════════════════════════════════════════════════════════════════════
setup_config() {
    [ -f "$BACKEND_DIR/.env" ] && log ".env 已存在" || {
        cat > "$BACKEND_DIR/.env" << 'EOF'
SECRET_KEY=ruicheng-edu-v35-secret-change-in-production
DATABASE_PASSWORD=postgres
DEEPSEEK_API_KEY=
EOF
        log ".env 已创建"
    }

    [ -f "$BACKEND_DIR/sysconfig.json" ] && log "sysconfig.json 已存在" || {
        cat > "$BACKEND_DIR/sysconfig.json" << 'JSONEOF'
{
  "database": {"server":"localhost","port":"5432","database":"edu_system","user":"postgres","password":"postgres"},
  "llm": {"current":"ollama","ollama":{"endpoint":"http://127.0.0.1:11434/v1","model":"","available_models":[]},"deepseek":{"api_key":"","model":"deepseek-chat"}},
  "grading": {"max_concurrent_grading":1,"grading_model":"rule"},
  "ocr": {"engine":"paddleocr","max_concurrent_ocr":5,"confidence_threshold":0.8},
  "mistake_book": {"practice_question_count":5},
  "export_max": 200,
  "system": {"log_level":"INFO","backup_enabled":false}
}
JSONEOF
        log "sysconfig.json 已创建"
    }
}

# ── 统一解析 DB 配置 (写入全局变量) ───────────────────────────────────────────
_read_db_config() {
    local f="$BACKEND_DIR/sysconfig.json"
    DB_HOST=$("$PYTHON" -c "import json;print(json.load(open('$f'))['database'].get('server','localhost'))" 2>/dev/null || echo "localhost")
    DB_PORT=$("$PYTHON" -c "import json;print(json.load(open('$f'))['database'].get('port','5432'))" 2>/dev/null || echo "5432")
    DB_NAME=$("$PYTHON" -c "import json;print(json.load(open('$f'))['database'].get('database','edu_system'))" 2>/dev/null || echo "edu_system")
    DB_USER=$("$PYTHON" -c "import json;print(json.load(open('$f'))['database'].get('user','postgres'))" 2>/dev/null || echo "postgres")
    DB_PASS=$("$PYTHON" -c "import json;print(json.load(open('$f'))['database'].get('password','postgres'))" 2>/dev/null || echo "postgres")
    export PGPASSWORD="$DB_PASS"
    info "数据库: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
}

# ═══════════════════════════════════════════════════════════════════════════════
# 4. 数据库初始化
# ═══════════════════════════════════════════════════════════════════════════════
setup_database() {
    # 测试连接
    info "测试 PostgreSQL..."
    if command -v psql &>/dev/null; then
        psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -c "SELECT 1" &>/dev/null \
            || die "无法连接 PostgreSQL (${DB_USER}@${DB_HOST}:${DB_PORT})"
        log "PostgreSQL 连接正常"
    else
        "$PYTHON" -c "
import asyncio,asyncpg
async def t():
    c=await asyncpg.connect(user='$DB_USER',password='$DB_PASS',host='$DB_HOST',port=$DB_PORT,database='postgres')
    await c.close()
asyncio.run(t())
" 2>/dev/null || die "PostgreSQL 连接失败"
        log "PostgreSQL 连接正常 (asyncpg)"
    fi

    # 重建模式
    if $OPT_REBUILD_DB; then
        warn "重建数据库 $DB_NAME ..."
        _db_drop_create
        log "数据库已重建"
    else
        # 确保库存在
        if command -v psql &>/dev/null; then
            psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -c "CREATE DATABASE $DB_NAME" 2>/dev/null || true
        fi
        log "数据库就绪"
    fi

    # 运行迁移 (仅 001_v35_initial)
    info "运行数据库迁移..."
    cd "$BACKEND_DIR"

    # 检查是否需要版本对齐 (旧数据库可能有已删除的 002-011 版本记录)
    _align_alembic_version

    env DATABASE_PASSWORD="$DB_PASS" "$PYTHON" -m alembic upgrade head 2>&1 | tee -a "$LOG_FILE" \
        || die "数据库迁移失败"
    log "迁移完成"
}

# ── 将对齐 alembic 版本号 (处理 002-011 已被合并到 001 的情况) ────────────────
_align_alembic_version() {
    local current_rev
    current_rev=$("$PYTHON" -c "
import asyncio
from sqlalchemy import text
from app.db.session import AsyncSessionLocal
async def c():
    async with AsyncSessionLocal() as db:
        r = await db.execute(text(\"SELECT version_num FROM alembic_version\"))
        row = r.fetchone()
        print(row[0] if row else 'none')
asyncio.run(c())
" 2>/dev/null || echo "error")

    case "$current_rev" in
        none|error)
            # 新数据库或表不存在 — 正常执行 upgrade head
            ;;
        001_v22_initial)
            # 已对齐，无需处理
            ;;
        *)
            # 旧版本 (002/003/.../011 等) — 这些迁移的内容已合并入 001
            info "检测到旧迁移版本 ($current_rev)，修正为 001_v22_initial..."
            "$PYTHON" -c "
import asyncio
from sqlalchemy import text
from app.db.session import AsyncSessionLocal
async def c():
    async with AsyncSessionLocal() as db:
        await db.execute(text(\"DELETE FROM alembic_version\"))
        await db.execute(text(\"INSERT INTO alembic_version (version_num) VALUES ('001_v22_initial')\"))
        await db.commit()
asyncio.run(c())
" 2>/dev/null || warn "版本对齐失败，尝试继续..."
            log "版本已对齐到 001_v22_initial"
            ;;
    esac
}

_db_drop_create() {
    if command -v psql &>/dev/null; then
        psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" \
            -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid <> pg_backend_pid()" 2>/dev/null || true
        psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -c "DROP DATABASE IF EXISTS $DB_NAME" 2>/dev/null || true
        psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -c "CREATE DATABASE $DB_NAME" || die "创建数据库失败"
    else
        "$PYTHON" -c "
import asyncio,asyncpg
async def r():
    c=await asyncpg.connect(user='$DB_USER',password='$DB_PASS',host='$DB_HOST',port=$DB_PORT,database='postgres')
    await c.execute('DROP DATABASE IF EXISTS $DB_NAME')
    await c.execute('CREATE DATABASE $DB_NAME')
    await c.close()
asyncio.run(r())
" || die "创建数据库失败"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# 5. 演示数据
# ═══════════════════════════════════════════════════════════════════════════════
setup_demo_data() {
    cd "$BACKEND_DIR"

    if $OPT_REBUILD_DB; then
        _run_seed "--force"
        return
    fi

    # 检测是否已有数据
    local has
    has=$("$PYTHON" -c "
import asyncio
from sqlalchemy import text
from app.db.session import AsyncSessionLocal
async def c():
    async with AsyncSessionLocal() as db:
        r=await db.execute(text('SELECT COUNT(*) FROM questions'))
        print(r.scalar())
asyncio.run(c())
" 2>/dev/null || echo "0")

    if [ "${has:-0}" = "0" ]; then
        info "数据库为空，导入演示数据..."
        _run_seed ""
    else
        log "数据库已有 $has 道题目，跳过"
        if confirm "强制重建数据库并导入演示数据?"; then
            _db_drop_create
            env DATABASE_PASSWORD="$DB_PASS" "$PYTHON" -m alembic upgrade head 2>>"$LOG_FILE"
            _run_seed "--force"
        fi
    fi
}

_run_seed() {
    local flag="$1"
    info "导入 V3.5 演示数据..."
    env DATABASE_PASSWORD="$DB_PASS" "$PYTHON" seed_v35.py $flag 2>&1 | tee -a "$LOG_FILE" \
        || die "演示数据导入失败"
    log "演示数据导入完成"
}

# ═══════════════════════════════════════════════════════════════════════════════
# 6. 前端依赖
# ═══════════════════════════════════════════════════════════════════════════════
setup_frontend() {
    cd "$FRONTEND_DIR"
    if [ -d "node_modules" ]; then
        log "前端依赖已就绪"
    else
        info "安装前端依赖..."
        npm install 2>&1 | tee -a "$LOG_FILE" || die "前端依赖安装失败"
        log "前端依赖安装完成"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# 7. 启动服务
# ═══════════════════════════════════════════════════════════════════════════════
start_backend() {
    # 清理占用端口
    port_free 8000 || { warn "端口 8000 被占用，清理中..."; fuser -k 8000/tcp 2>/dev/null || true; sleep 1; }

    cd "$BACKEND_DIR"
    info "启动后端 (8000)..."
    "$PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!
    sleep 2

    kill -0 "$BACKEND_PID" 2>/dev/null || die "后端进程启动失败"

    info "等待后端就绪..."
    for i in $(seq 1 30); do
        curl -sf http://localhost:8000/health >/dev/null 2>&1 && { log "后端就绪 → http://localhost:8000"; log "API 文档 → http://localhost:8000/docs"; return 0; }
        sleep 1
    done
    kill "$BACKEND_PID" 2>/dev/null || true
    die "后端启动超时 (30s)"
}

start_frontend() {
    port_free 3000 || { warn "端口 3000 被占用，清理中..."; fuser -k 3000/tcp 2>/dev/null || true; sleep 1; }

    cd "$FRONTEND_DIR"
    info "启动前端 (3000)..."
    npm run dev -- --host 0.0.0.0 &
    FRONTEND_PID=$!
    sleep 3

    kill -0 "$FRONTEND_PID" 2>/dev/null || { kill "$BACKEND_PID" 2>/dev/null || true; die "前端进程启动失败"; }

    info "等待前端编译..."
    for i in $(seq 1 30); do
        curl -sf http://localhost:3000 >/dev/null 2>&1 && { log "前端就绪 → http://localhost:3000"; return 0; }
        sleep 2
    done
    warn "前端编译较慢，稍后访问 http://localhost:3000"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Docker Compose
# ═══════════════════════════════════════════════════════════════════════════════
deploy_docker() {
    check_cmd docker
    docker compose version &>/dev/null || docker-compose version &>/dev/null || die "需要 Docker Compose"

    # 检测端口冲突
    if ! port_free 5432; then
        warn "端口 5432 已被占用 (本地 PostgreSQL?)"
        if confirm "使用 5433 端口启动 Docker PostgreSQL?"; then
            export POSTGRES_PORT=5433
        else
            die "请先释放端口 5432 或设置 POSTGRES_PORT 环境变量"
        fi
    fi
    ! port_free 8000 && { warn "端口 8000 被占用"; export BACKEND_PORT=8001; }
    ! port_free 3000 && { warn "端口 3000 被占用"; export FRONTEND_PORT=3001; }

    step "Docker Compose 部署"
    docker compose up -d --build 2>&1 | tee -a "$LOG_FILE" || die "启动失败"

    info "等待服务就绪..."
    sleep 10
    curl -sf http://localhost:8000/health >/dev/null 2>&1 && log "后端就绪" || warn "后端可能还在启动"

    if confirm "导入 V3.5 演示数据?"; then
        docker compose exec -T backend python seed_v35.py --force 2>&1 | tee -a "$LOG_FILE" || warn "导入失败"
    fi

    echo ""
    echo -e "${GREEN}  Docker 部署完成！${NC}"
    echo -e "  前端: ${BLUE}http://localhost:3000${NC}"
    echo -e "  API:  ${BLUE}http://localhost:8000/docs${NC}"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# 汇总
# ═══════════════════════════════════════════════════════════════════════════════
print_summary() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║         睿承教育平台 V3.5 — 部署成功！                   ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${BOLD}地址${NC}"
    echo -e "  学生端:  ${BLUE}http://localhost:3000/login${NC}"
    echo -e "  管理端:  ${BLUE}http://localhost:3000/admin/login${NC}"
    echo -e "  家长端:  ${BLUE}http://localhost:3000/parent/login${NC}"
    echo -e "  API:     ${BLUE}http://localhost:8000/docs${NC}"
    echo ""

    cat << 'EOF'
  演示账号 (密码: Demo1234, SYSAdmin: SYSPass)
  ────────────────────────────────────────────
  系统管理员   SYSAdmin / SYSPass
  数学教师     t_math         王数学
  语文教师     t_chinese      李语文
  英语教师     t_english      张英语
  物理教师     t_physics      赵物理
  题库管理     tk_qian        钱题库
  学生         zhang_ming     张明 (G8)
  学生         li_hua         李华 (G8)
  学生         wang_fang      王芳 (G7)
  学生         chen_qiang     陈强 (G9)
  家长         p_zhang_fu     张国华
  家长         p_li_mu        陈晓燕
  ────────────────────────────────────────────
EOF
    echo ""
    echo -e "  ${YELLOW}Ctrl+C 停止服务  |  日志: $LOG_FILE${NC}"
    echo ""
}

main
