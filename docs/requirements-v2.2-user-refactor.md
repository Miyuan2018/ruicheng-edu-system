# 用户体系重构 — V2.2

## 1. 目标

将单一 `users` 表拆分为角色分表，区分管理员入口和学生入口。

## 2. 数据模型

### 2.1 表结构

```
sys_admins                    admins                        students
─────────────                 ──────────                    ──────────
id (UUID PK)                  id (UUID PK)                  id (UUID PK)
username (UNIQUE)             username (UNIQUE)             username (UNIQUE)
password_hash                 password_hash                 password_hash
full_name                     full_name                     full_name
phone                         phone                         phone
email                         email                         email
avatar_url                    admin_type                    grade (年级)
is_active                     ├─ QUESTION_ADMIN             school (学校)
created_at                    └─ TEACHER                    created_at
updated_at                    created_by → sys_admins.id    updated_at
last_login_at                 is_active                     last_login_at
                              created_at
                              updated_at
                              last_login_at
```

### 2.2 角色与权限

| 角色 | 存储表 | 登录入口 | 创建方式 |
|------|--------|----------|----------|
| 系统管理员 | sys_admins | /admin/login | 内置(数据库初始化) |
| 题库管理员 | admins | /admin/login | 系统管理员创建 |
| 教师 | admins | /admin/login | 系统管理员创建 |
| 学生 | students | /login | 自主注册 |

### 2.3 内置账号

```sql
INSERT INTO sys_admins (username, password_hash, full_name, role)
VALUES ('SYSAdmin', '<bcrypt_hash_of_SYSPass>', '系统管理员', 'SYS_ADMIN');
```

## 3. 登录流程

### 3.1 学生登录 (默认页面 /login)
```
GET  /api/v1/auth/captcha      → 生成验证码(可选)
POST /api/v1/auth/student/login → 学生登录，返回 JWT
POST /api/v1/auth/student/register → 学生注册
```

### 3.2 管理员登录 (新页面 /admin/login)
```
GET  /api/v1/auth/captcha       → 生成图形验证码(SVG)
POST /api/v1/auth/admin/login   → 管理员登录(username+password+captcha)
  请求体: { username, password, captcha_key, captcha_code }
  响应: { access_token, refresh_token, admin_type, full_name }
```

### 3.3 验证码机制
- 生成 4 位字母数字验证码
- 返回 SVG 图片 + captcha_key
- captcha_key 存入 Redis(或内存) 5 分钟有效
- 登录时校验 captcha_key + captcha_code

## 4. API 变更

### 4.1 新增 API

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /api/v1/auth/captcha | 获取验证码(SVG) |
| POST | /api/v1/auth/admin/login | 管理员登录 |
| POST | /api/v1/auth/student/login | 学生登录 |
| POST | /api/v1/auth/student/register | 学生注册 |
| POST | /api/v1/admin/create-admin | 系统管理员创建题库管理员/教师 |
| GET | /api/v1/admin/admins | 管理员列表 |
| PUT | /api/v1/admin/admins/{id} | 编辑管理员 |
| DELETE | /api/v1/admin/admins/{id} | 删除管理员 |

### 4.2 废弃 API

旧 `/api/v1/auth/register` 和 `/api/v1/auth/login` 替换为上述新端点。

## 5. 前端变更

### 5.1 页面变化

| 页面 | 路由 | 用户 |
|------|------|------|
| 学生登录/注册 | /login | 学生 |
| 管理员登录 | /admin/login | 系统管理员/题库管理员/教师 |

### 5.2 管理员登录页布局

```
┌──────────────────────────────┐
│                              │
│     睿承教育平台 - 管理端     │
│                              │
│   [用户名_______________]    │
│   [密码_________________]    │
│   [验证码____] [SVG图片]     │
│   [    登  录    ]          │
│                              │
└──────────────────────────────┘
```

## 6. 实施步骤

| 步骤 | 内容 |
|------|------|
| 1 | 创建 sys_admins / admins / students 模型 |
| 2 | 数据库迁移 + 内置 SYSAdmin |
| 3 | 验证码生成服务 |
| 4 | 管理员登录 API (含验证码校验) |
| 5 | 学生登录/注册 API |
| 6 | 系统管理员创建教师/题库管理员 API |
| 7 | 前端学生登录页 (更新) |
| 8 | 前端管理员登录页 (新建，含验证码) |
| 9 | 更新 AuthGuard/路由 (区分学生/管理员) |
| 10 | 废弃旧 users 表/API |
