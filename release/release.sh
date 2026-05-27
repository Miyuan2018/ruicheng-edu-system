#!/bin/bash
# ============================================================
#  睿承教育平台 — 发布打包脚本
#  用途：将项目源码打包为可分发归档文件
#  用法：bash release/release.sh [版本号]
#        bash release/release.sh v3.5
# ============================================================
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-v3.5}"
DATE="$(date +%Y%m%d)"
ARCHIVE_NAME="ruicheng-edu-${VERSION}-${DATE}"
OUTPUT_DIR="$PROJECT_DIR/release"
ARCHIVE_PATH="$OUTPUT_DIR/${ARCHIVE_NAME}.tar.gz"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   睿承教育平台 — 发布打包 ${VERSION}${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
info "项目目录: $PROJECT_DIR"
info "输出文件: $ARCHIVE_PATH"
echo ""

EXCLUDES=(
    "--exclude=*/__pycache__"
    "--exclude=*/.pytest_cache"
    "--exclude=*/*.pyc"
    "--exclude=*/node_modules"
    "--exclude=*/dist"
    "--exclude=*/.vite"
    "--exclude=*/.env"
    "--exclude=*/.env.local"
    "--exclude=*.db"
    "--exclude=*.sqlite"
    "--exclude=*/.cache"
    "--exclude=*/.git"
    "--exclude=*/.gitignore"
    "--exclude=*/.idea"
    "--exclude=*/.vscode"
    "--exclude=*.bak"
    "--exclude=*.orig"
    "--exclude=release/*.tar.gz"
    "--exclude=release/*.zip"
)

info "开始打包..."
tar -czf "$ARCHIVE_PATH" \
    "${EXCLUDES[@]}" \
    -C "$(dirname "$PROJECT_DIR")" \
    "$(basename "$PROJECT_DIR")"

SIZE=$(du -sh "$ARCHIVE_PATH" | cut -f1)
FILE_COUNT=$(tar -tzf "$ARCHIVE_PATH" | wc -l)

echo ""
log "打包完成！"
echo -e "  文件:    ${BLUE}${ARCHIVE_PATH}${NC}"
echo -e "  大小:    ${BLUE}${SIZE}${NC}"
echo -e "  文件数:  ${BLUE}${FILE_COUNT}${NC}"
echo ""

sha256sum "$ARCHIVE_PATH" > "${ARCHIVE_PATH%.tar.gz}.sha256"
log "SHA256 校验和已生成"

echo ""
info "验证打包内容（前20条）："
tar -tzf "$ARCHIVE_PATH" | head -20
echo "  ..."
echo ""
echo -e "${GREEN}发布包准备完成：${ARCHIVE_NAME}.tar.gz${NC}"
echo ""
echo "部署说明："
echo "  1. 解压:  tar -xzf ${ARCHIVE_NAME}.tar.gz"
echo "  2. 进入:  cd ruicheng-edu-system"
echo "  3. 启动:  ./start.sh              # 本地部署"
echo "            docker-compose up -d    # Docker 部署"
echo "  4. 演示:  cd backend && python demo_data.py"
echo ""
