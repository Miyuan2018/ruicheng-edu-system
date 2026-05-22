# 快速启动指南

## 前置条件

- Python 3.12+ (Conda 环境 `myenv`)
- Node.js 22+
- 系统: Linux (DGX Spark / 任意 x86/ARM)

## 1. 克隆/解压

```bash
cd release/2.1.1
```

## 2. 一键启动

```bash
chmod +x start.sh
./start.sh
```

脚本自动完成:
1. 检查 Conda 环境
2. 安装后端依赖
3. 数据库迁移
4. 安装前端依赖
5. 启动后端 (8000) + 前端 (3000)
6. 健康检查

## 3. 访问

| 地址 | 说明 |
|------|------|
| http://localhost:3000 | 前端应用 |
| http://localhost:8000/docs | API 文档 (Swagger) |
| http://localhost:8000/api/v1/openapi.json | OpenAPI 规范 |

## 4. 默认账号

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 教师 | teacher@example.com | testpass123 |
| 学生 | 注册新账号 | - |
| 题库管理员 | 注册时选 QUESTION_ADMIN | - |

## 5. 运行测试

```bash
cd backend
conda run -n myenv python tests/smoke_test.py
```

预期输出: `TOTAL: 27/27 passed, 0 failed`

## 6. 停止

```
Ctrl+C
```

或者:

```bash
fuser -k 8000/tcp
fuser -k 3000/tcp
```

## 手动启动（分步）

```bash
# 后端
cd backend
conda run -n myenv uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 前端（另一个终端）
cd frontend
npm install
npm run dev
```
