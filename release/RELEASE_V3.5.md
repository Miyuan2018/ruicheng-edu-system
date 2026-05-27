# 睿承教育平台 V3.5 发布说明

**发布日期：** 2026-05-27
**代码基准：** V2.4 代码库（基于 Git 最新提交）
**迁移版本：** Alembic 011

---

## 本次发布内容

### 新增文件

| 文件 | 说明 |
|------|------|
| `backend/demo_data.py` | 演示数据脚本（含清除+导入，覆盖全部26张业务表） |
| `release/RELEASE_V3.5.md` | 本发布说明 |
| `release/release.sh` | 一键打包脚本 |

### 更新文件

| 文件 | 变更内容 |
|------|----------|
| `docker-compose.yml` | 从旧 SQLite 配置升级为 PostgreSQL 16，增加 healthcheck、环境变量支持 |

---

## 演示账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 系统管理员 | SYSAdmin | SYSPass |
| 教师（数学） | t_math | Demo1234 |
| 教师（语文） | t_chinese | Demo1234 |
| 教师（英语） | t_english | Demo1234 |
| 题目管理员 | tk_zhao | Demo1234 |
| 学生（八年级） | zhang_ming | Demo1234 |
| 学生（八年级） | li_hua | Demo1234 |
| 学生（七年级） | wang_fang | Demo1234 |
| 学生（九年级） | chen_qiang | Demo1234 |
| 学生（八年级） | liu_li | Demo1234 |
| 家长 | p_zhang_fu | Demo1234 |
| 家长 | p_li_mu | Demo1234 |

> 所有登录均需图形验证码 + 短信验证码，开发模式下短信验证码固定为 `111111`

---

## 演示数据概览

| 模块 | 数据 |
|------|------|
| 科目 | 数学、语文、英语、物理（4科） |
| 班级 | 八年级A班/七年级B班/九年级A班（含学生关联） |
| 题目 | 50道（数学25/语文11/英语14，四种题型，含典型题标记） |
| 试卷 | 4份（期中/单元测/语文期中/英语模拟，均已发布） |
| 答题记录 | 5条（含答题明细、自动评分、评分记录） |
| 错题本 | 2本（含错题条目及推荐练习题） |
| 课纲/知识点 | 数学+语文课纲，9个树形知识点节点 |
| 讲解板 | 3个步骤式讲解会话（数学2个/英语1个） |
| 自学任务 | 5条（覆盖不同状态） |
| 通知 | 5条（批改完成/错题本就绪/考试提醒） |
| 家长模块 | 庆典事件/激励消息/奖励目标完整数据 |
| 题目推荐 | 4条（教师向学生推荐典型题） |

---

## 启动方式

### 方式一：本地开发（推荐）

```bash
./start.sh
```

### 方式二：导入演示数据

```bash
# 启动后执行
cd backend
~/conda_workspace/bin/python demo_data.py
```

### 方式三：Docker 容器化部署

```bash
docker-compose up -d
# 等待服务就绪后导入演示数据
docker-compose exec backend python demo_data.py
```

---

## 访问地址

| 端 | 地址 |
|----|------|
| 学生端 | http://localhost:3000/login |
| 管理/教师端 | http://localhost:3000/admin/login |
| API 文档 | http://localhost:8000/docs |

---

## 已知问题（V2.4 遗留）

| 优先级 | 问题 |
|--------|------|
| P0 | 试卷导出（Word/PDF）端点为空壳，功能不可用 |
| P0 | 学生仪表盘部分统计数据为 Mock |
| P1 | OCR 拍照录入为占位符，功能不可用 |
| P2 | 知识树版本化逻辑未实现 |

---

## 打包说明

使用 `release/release.sh` 可将项目打包为 `.tar.gz` 归档文件：

```bash
cd release
bash release.sh
```

输出：`ruicheng-edu-v3.5-YYYYMMDD.tar.gz`
