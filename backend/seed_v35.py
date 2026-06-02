#!/usr/bin/env python3
"""
睿承教育平台 V3.5 — 基础演示数据脚本
=====================================
全新编写的独立脚本，不依赖旧版 demo_data.py。

用法:
    cd backend
    python seed_v35.py                     # 普通模式（不清除已有数据则跳过）
    python seed_v35.py --force             # 强制清除所有业务数据后重新导入
    python seed_v35.py --db postgresql+asyncpg://user:pass@host:5432/dbname  # 指定数据库

数据覆盖:
  - 参考数据表 (7 类: 题型/难度/年级/试卷状态/错题类型/题目来源/省份)
  - 用户 (1 系统管理员 + 5 教师/管理员 + 8 学生 + 4 家长)
  - 科目 (6 科) + 班级 (5 个) + 课纲/知识点树 (4 份课纲, 20+ 知识点)
  - 试题 (80 道: 数学30/语文20/英语20/物理10, 单选35/多选10/填空15/解答20)
  - 试卷 (6 份: 期中/期末/单元测/中考模拟, 均已发布)
  - 答题记录 (12 条, 含答题明细 + 评分记录)
  - 错题本 (5 本, 含错题条目 + 推荐练习题)
  - 自学任务 (8 条, 含已完成/进行中/待开始)
  - 通知 (10 条, 含已读/未读)
  - 家长模块 (鼓励消息/庆典事件/奖励目标)
  - 讲解板 (5 个会话, 含分步动画)
  - 题目推荐 (8 条)
  - OCR 上传记录 + LLM 任务记录
"""

import asyncio
import hashlib
import json
import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone

from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# ── 路径 & 配置 ──────────────────────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 导入所有模型以注册到 Base.metadata（create_all 需要）
import app.models  # noqa: F401
from app.db.base import Base

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
NOW = datetime.now(timezone.utc)


def _hash(pw: str) -> str:
    return pwd_context.hash(pw)


def _uid() -> str:
    return str(uuid.uuid4())


def _content_hash(text_val: str) -> str:
    return hashlib.sha256(text_val.encode()).hexdigest()[:64]


def _dt(days_ago: int = 0, hours: int = 0, minutes: int = 0) -> datetime:
    return NOW - timedelta(days=days_ago, hours=hours, minutes=minutes)


def _d(days_hence: int = 0) -> date:
    """未来或过去的日期"""
    return (NOW + timedelta(days=days_hence)).date()


# ── 数据库连接 ────────────────────────────────────────────────────────────────────
def _build_db_url() -> str:
    """优先从命令行 --db 参数读取，其次从 sysconfig.json，最后用默认值。"""
    for i, arg in enumerate(sys.argv):
        if arg == "--db" and i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    try:
        with open(os.path.join(os.path.dirname(__file__), "sysconfig.json")) as f:
            cfg = json.load(f)["database"]
        pw = os.environ.get("DATABASE_PASSWORD", cfg.get("password", "postgres"))
        return (
            f"postgresql+asyncpg://{cfg['user']}:{pw}"
            f"@{cfg.get('server', 'localhost')}:{cfg.get('port', '5432')}"
            f"/{cfg.get('database', 'edu_system')}"
        )
    except Exception:
        pw = os.environ.get("DATABASE_PASSWORD", "postgres")
        return f"postgresql+asyncpg://postgres:{pw}@localhost:5432/edu_system"


FORCE = "--force" in sys.argv
DB_URL = _build_db_url()

# ═══════════════════════════════════════════════════════════════════════════════════
# 固定 ID（便于交叉引用）
# ═══════════════════════════════════════════════════════════════════════════════════

# 系统管理员
SYSADMIN_ID = "00000000-0000-0000-0000-000000000001"

# 教师 / 题库管理员
T_MATH_ID    = "a0000000-0000-0000-0000-000000000001"   # 王数学
T_CHINESE_ID = "a0000000-0000-0000-0000-000000000002"   # 李语文
T_ENG_ID     = "a0000000-0000-0000-0000-000000000003"   # 张英语
T_PHY_ID     = "a0000000-0000-0000-0000-000000000004"   # 赵物理
QADMIN_ID    = "a0000000-0000-0000-0000-000000000010"   # 钱题库

# 学生
S_ZHANG_ID  = "b0000000-0000-0000-0000-000000000001"  # 张明 G8
S_LI_ID     = "b0000000-0000-0000-0000-000000000002"  # 李华 G8
S_WANG_ID   = "b0000000-0000-0000-0000-000000000003"  # 王芳 G7
S_CHEN_ID   = "b0000000-0000-0000-0000-000000000004"  # 陈强 G9
S_LIU_ID    = "b0000000-0000-0000-0000-000000000005"  # 刘丽 G8
S_ZHAO_ID   = "b0000000-0000-0000-0000-000000000006"  # 赵刚 G7
S_SUN_ID    = "b0000000-0000-0000-0000-000000000007"  # 孙悦 G9
S_ZHOU_ID   = "b0000000-0000-0000-0000-000000000008"  # 周杰 G8

# 家长
P_ZHANG_ID = "c0000000-0000-0000-0000-000000000001"  # 张明之父
P_LI_ID    = "c0000000-0000-0000-0000-000000000002"  # 李华之母
P_WANG_ID  = "c0000000-0000-0000-0000-000000000003"  # 王芳之母
P_CHEN_ID  = "c0000000-0000-0000-0000-000000000004"  # 陈强之父

# 班级
C_8MATH_ID   = "d0000000-0000-0000-0000-000000000001"  # 八年级数学提高班
C_7CHN_ID    = "d0000000-0000-0000-0000-000000000002"  # 七年级语文基础班
C_9ENG_ID    = "d0000000-0000-0000-0000-000000000003"  # 九年级英语冲刺班
C_8PHY_ID    = "d0000000-0000-0000-0000-000000000004"  # 八年级物理启蒙班
C_7MATH_ID   = "d0000000-0000-0000-0000-000000000005"  # 七年级数学基础班

# 科目
SUBJ_MATH_ID    = "e0000000-0000-0000-0000-000000000001"
SUBJ_CHINESE_ID = "e0000000-0000-0000-0000-000000000002"
SUBJ_ENG_ID     = "e0000000-0000-0000-0000-000000000003"
SUBJ_PHY_ID     = "e0000000-0000-0000-0000-000000000004"
SUBJ_CHEM_ID    = "e0000000-0000-0000-0000-000000000005"
SUBJ_BIO_ID     = "e0000000-0000-0000-0000-000000000006"

# 试卷
PAPER_MATH_MID_ID   = "f0000000-0000-0000-0000-000000000001"  # 八年级数学期中
PAPER_MATH_UNIT_ID  = "f0000000-0000-0000-0000-000000000002"  # 八年级数学单元(实数)
PAPER_MATH_FINAL_ID = "f0000000-0000-0000-0000-000000000003"  # 八年级数学期末
PAPER_CHN_MID_ID    = "f0000000-0000-0000-0000-000000000004"  # 七年级语文期中
PAPER_ENG_FINAL_ID  = "f0000000-0000-0000-0000-000000000005"  # 九年级英语模拟
PAPER_PHY_UNIT_ID   = "f0000000-0000-0000-0000-000000000006"  # 八年级物理单元

# 课纲
SYL_MATH8_ID  = "a3000000-0000-0000-0000-000000000001"
SYL_CHN7_ID   = "a3000000-0000-0000-0000-000000000002"
SYL_ENG9_ID   = "a3000000-0000-0000-0000-000000000003"
SYL_PHY8_ID   = "a3000000-0000-0000-0000-000000000004"

# 题目 ID 池 (动态生成 80 个)
Q = {f"q{i}": _uid() for i in range(1, 81)}


# ═══════════════════════════════════════════════════════════════════════════════════
# 辅助: 构建题目行
# ═══════════════════════════════════════════════════════════════════════════════════
def _q(idx, title, qtype, difficulty, subject, grade_scope, grades,
       correct_answer, explanation, score=5, is_typical=False, source="MANUAL",
       created_by=T_MATH_ID):
    grade_level = json.dumps({"scope": grade_scope, "grades": grades})
    return {
        "id": Q[f"q{idx}"],
        "title": title,
        "question_type": qtype,
        "difficulty": difficulty,
        "subject": subject,
        "grade_level": grade_level,
        "score": score,
        "correct_answer": json.dumps(correct_answer, ensure_ascii=False),
        "explanation": explanation,
        "meta_data": "{}",
        "source": source,
        "review_status": "APPROVED",
        "reviewed_by": created_by,
        "reviewed_at": _dt(30),
        "created_by": created_by,
        "is_active": True,
        "is_typical": is_typical,
        "content_hash": _content_hash(title),
        "created_at": _dt(30),
        "updated_at": _dt(30),
    }


# ═══════════════════════════════════════════════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════════════════════════════════════════════
async def run():
    engine = create_async_engine(DB_URL, echo=False)
    factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # 确保所有表存在（幂等 — 对已存在的表无影响，只补缺失的表）
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with factory() as db:
        banner()
        await step0_clear(db)
        await step1_reference(db)
        await step2_users(db)
        await step3_subjects(db)
        await step4_classes(db)
        await step5_syllabus(db)
        await step6_questions(db)
        for _step_fn, _step_name in [
            (step7_papers, "7:试卷"), (step8_submissions, "8:答题"), (step9_notebooks, "9:错题本"),
            (step10_selfstudy, "10:自学"), (step11_notifications, "11:通知"),
            (step12_parent_module, "12:家长"), (step13_topic_board, "13:讲题板"),
            (step14_recommendations, "14:推荐"), (step15_tasks, "15:任务"),
        ]:
            try:
                await _step_fn(db)
            except Exception as e:
                msg = str(e)[:120]
                print(f"   跳过步骤{_step_name} ({type(e).__name__}: {msg})")
        summary()

    await engine.dispose()


# ── 横幅 ──────────────────────────────────────────────────────────────────────────
def banner():
    print()
    print("=" * 64)
    print("   睿承教育平台 V3.5 — 基础演示数据脚本")
    print("=" * 64)
    if FORCE:
        print("   🔄 强制模式：将清除所有业务数据后重新导入")
    print()


# ── STEP 0: 清除 ──────────────────────────────────────────────────────────────────
async def step0_clear(db: AsyncSession):
    if not FORCE:
        # 检查是否已有数据
        r = await db.execute(text("SELECT COUNT(*) FROM questions"))
        if r.scalar() > 0:
            print("[跳过] 数据库已有题目数据，使用 --force 强制重建")
            return

    print("[0/15] 清除旧业务数据...")

    # 修复遗留约束
    await db.execute(text(
        "ALTER TABLE answer_submissions DROP CONSTRAINT IF EXISTS "
        "ck_answer_submissions_check_answer_submissions_status"
    ))
    await db.commit()

    delete_order = [
        "explanation_steps", "explanation_sessions",
        "question_recommendations", "reward_goals",
        "encouragements", "celebration_events",
        "self_study_tasks", "notifications",
        "grading_records", "error_notebook_questions",
        "error_notebooks", "answer_details",
        "answer_submissions",
        "exam_papers", "questions", "knowledge_nodes",
        "syllabi", "class_students", "classes",
        "parent_student_links", "parents",
        "students", "question_tasks", "admins",
        "subjects", "ocr_uploads",
    ]
    for table in delete_order:
        try:
            await db.execute(text(f"DELETE FROM {table}"))
        except Exception as e:
            await db.rollback()
            print(f"   ⚠ 跳过 {table}: {e}")

    await db.commit()
    print("   清除完成\n")


# ── STEP 1: 参考数据 ──────────────────────────────────────────────────────────────
async def step1_reference(db: AsyncSession):
    print("[1/15] 导入参考数据表...")

    refs = {
        "question_types": [
            ("SINGLE_CHOICE",   "单选题", "blue",   1),
            ("MULTIPLE_CHOICE", "多选题", "purple", 2),
            ("FILL_BLANK",      "填空题", "green",  3),
            ("SUBJECTIVE",      "解答题", "orange", 4),
        ],
        "difficulty_levels": [
            ("EASY",   "简单", "green",  1),
            ("MEDIUM", "中等", "orange", 2),
            ("HARD",   "困难", "red",    3),
        ],
        "grade_levels": [
            ("G5",  "五年级", 1), ("G6",  "六年级", 2),
            ("G7",  "七年级", 3), ("G8",  "八年级", 4),
            ("G9",  "九年级", 5), ("G10", "高一",   6),
            ("G11", "高二",   7), ("G12", "高三",   8),
        ],
        "paper_statuses": [
            ("DRAFT", "草稿"), ("PUBLISHED", "已发布"), ("ARCHIVED", "已归档"),
        ],
        "error_types": [
            ("CONCEPT",       "概念错误"),
            ("MEMORY",        "记忆错误"),
            ("UNDERSTANDING", "理解偏差"),
            ("CALCULATION",   "计算错误"),
            ("UNANSWERED",    "未作答"),
        ],
        "question_sources": [
            ("MANUAL",        "人工录入",   "blue"),
            ("LLM_GENERATED", "大模型生成", "purple"),
            ("SCRAPED",       "爬取采集",   "orange"),
            ("OCR_UPLOAD",    "OCR识别",    "cyan"),
        ],
        "provinces": [
            ("BJ", "北京", 1), ("SH", "上海", 2), ("GD", "广东", 3),
            ("JS", "江苏", 4), ("ZJ", "浙江", 5), ("SD", "山东", 6),
        ],
    }

    table_map = {
        "question_types":     "question_types",
        "difficulty_levels":  "difficulty_levels",
        "grade_levels":       "grade_levels",
        "paper_statuses":     "paper_statuses",
        "error_types":        "error_types",
        "question_sources":   "question_sources",
        "provinces":          "provinces",
    }

    count = 0
    for key, rows in refs.items():
        table = table_map[key]
        # 幂等: 跳过已有数据
        r = await db.execute(text(f"SELECT COUNT(*) FROM {table}"))
        if r.scalar() > 0:
            continue
        for row in rows:
            cols = ["id", "code", "name"]
            vals = {"id": _uid(), "code": row[0], "name": row[1]}
            if len(row) >= 3 and row[2] and key in ("question_types", "difficulty_levels", "question_sources"):
                cols.append("color")
                vals["color"] = row[2]
            if len(row) >= 4 and row[3] is not None:
                cols.append("sort_order")
                vals["sort_order"] = row[3]
            elif len(row) == 3 and isinstance(row[2], int):
                cols.append("sort_order")
                vals["sort_order"] = row[2]
            placeholders = ", ".join(f":{c}" for c in cols)
            names = ", ".join(cols)
            await db.execute(text(f"INSERT INTO {table} ({names}) VALUES ({placeholders})"), vals)
            count += 1
    await db.commit()
    print(f"   导入 {count} 条参考数据\n")


# ── STEP 2: 用户 ──────────────────────────────────────────────────────────────────
async def step2_users(db: AsyncSession):
    print("[2/15] 导入用户...")
    pw = _hash("Demo1234")

    # 系统管理员 (幂等: 存在则更新密码)
    await db.execute(text("""
        INSERT INTO sys_admins (id, username, password_hash, full_name, email, is_active, created_at, updated_at)
        VALUES (:id, 'SYSAdmin', :pw, '系统管理员', 'sysadmin@ruicheng.edu', true, now(), now())
        ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now()
    """), {"id": SYSADMIN_ID, "pw": _hash("SYSPass")})

    # 教师 & 题库管理员
    admins = [
        ("t_math",    T_MATH_ID,    "王数学", "wang@ruicheng.edu",    "13800001001", 0, json.dumps(["数学"])),
        ("t_chinese", T_CHINESE_ID, "李语文", "li_chinese@ruicheng.edu", "13800001002", 0, json.dumps(["语文"])),
        ("t_english", T_ENG_ID,     "张英语", "zhang_eng@ruicheng.edu", "13800001003", 0, json.dumps(["英语"])),
        ("t_physics", T_PHY_ID,     "赵物理", "zhao_phy@ruicheng.edu",  "13800001004", 0, json.dumps(["物理"])),
        ("tk_qian",   QADMIN_ID,    "钱题库", "qian@ruicheng.edu",     "13800001010", 1, json.dumps(["ALL"])),
    ]
    for uname, aid, name, email, phone, atype, subs in admins:
        await db.execute(text("""
            INSERT INTO admins (id, username, password_hash, full_name, email, phone,
                admin_type, subjects, grade_level, created_by, is_active, created_at, updated_at)
            VALUES (:id, :un, :pw, :name, :email, :phone,
                :atype, CAST(:subs AS jsonb), CAST(:grades AS jsonb), :creator, true, now(), now())
            ON CONFLICT (username) DO UPDATE SET full_name=EXCLUDED.full_name, updated_at=now()
        """), {"id": aid, "un": uname, "pw": pw, "name": name, "email": email,
               "phone": phone, "atype": atype,
               "subs": subs, "grades": json.dumps(["G5","G6","G7","G8","G9","G10","G11","G12"]),
               "creator": SYSADMIN_ID})
    print(f"   导入 {len(admins)} 名教师/管理员")

    # 学生
    students = [
        (S_ZHANG_ID, "zhang_ming",  "张明", "13900001001", "G8", "睿承实验中学", "ZM8001"),
        (S_LI_ID,    "li_hua",      "李华", "13900001002", "G8", "睿承实验中学", "LH8002"),
        (S_WANG_ID,  "wang_fang",   "王芳", "13900001003", "G7", "睿承第一中学", "WF7003"),
        (S_CHEN_ID,  "chen_qiang",  "陈强", "13900001004", "G9", "睿承实验中学", "CQ9004"),
        (S_LIU_ID,   "liu_li",      "刘丽", "13900001005", "G8", "睿承实验中学", "LL8005"),
        (S_ZHAO_ID,  "zhao_gang",   "赵刚", "13900001006", "G7", "睿承第一中学", "ZG7006"),
        (S_SUN_ID,   "sun_yue",     "孙悦", "13900001007", "G9", "睿承实验中学", "SY9007"),
        (S_ZHOU_ID,  "zhou_jie",    "周杰", "13900001008", "G8", "睿承第一中学", "ZJ8008"),
    ]
    for sid, uname, name, phone, grade, school, icode in students:
        await db.execute(text("""
            INSERT INTO students (id, username, password_hash, full_name, phone, grade, school,
                is_active, invite_code, created_at, updated_at)
            VALUES (:id, :un, :pw, :name, :phone, :grade, :school, true, :icode, now(), now())
            ON CONFLICT (username) DO UPDATE SET full_name=EXCLUDED.full_name, updated_at=now()
        """), {"id": sid, "un": uname, "pw": pw, "name": name,
               "phone": phone, "grade": grade, "school": school, "icode": icode})
    print(f"   导入 {len(students)} 名学生")

    # 家长
    parents = [
        (P_ZHANG_ID, "p_zhang_fu", "张国华", "13700001001", "zhangfu@example.com", S_ZHANG_ID),
        (P_LI_ID,    "p_li_mu",    "陈晓燕", "13700001002", "limu@example.com",    S_LI_ID),
        (P_WANG_ID,  "p_wang_mu",  "刘淑芳", "13700001003", "wangmu@example.com",  S_WANG_ID),
        (P_CHEN_ID,  "p_chen_fu",  "陈建国", "13700001004", "chenfu@example.com",  S_CHEN_ID),
    ]
    for pid, uname, name, phone, email, _student_id in parents:
        await db.execute(text("""
            INSERT INTO parents (id, username, password_hash, full_name, phone, email,
                is_active, created_at, updated_at)
            VALUES (:id, :un, :pw, :name, :phone, :email, true, now(), now())
            ON CONFLICT (username) DO UPDATE SET full_name=EXCLUDED.full_name, updated_at=now()
        """), {"id": pid, "un": uname, "pw": pw, "name": name, "phone": phone, "email": email})

    # 家长-学生关联
    links = [
        (P_ZHANG_ID, S_ZHANG_ID, "父亲", "ZM8001"),
        (P_LI_ID,    S_LI_ID,    "母亲", "LH8002"),
        (P_WANG_ID,  S_WANG_ID,  "母亲", "WF7003"),
        (P_CHEN_ID,  S_CHEN_ID,  "父亲", "CQ9004"),
        # 张国华也关联周杰（叔叔）
        (P_ZHANG_ID, S_ZHOU_ID,  "叔叔", "ZJ8008"),
    ]
    for pid, sid, rel, icode in links:
        await db.execute(text("""
            INSERT INTO parent_student_links (id, parent_id, student_id, relationship,
                invite_code_used, is_active, linked_at)
            VALUES (:id, :pid, :sid, :rel, :icode, true, now())
            ON CONFLICT (parent_id, student_id) DO NOTHING
        """), {"id": _uid(), "pid": pid, "sid": sid, "rel": rel, "icode": icode})
    print(f"   导入 {len(parents)} 名家长, {len(links)} 条关联\n")


# ── STEP 3: 科目 ──────────────────────────────────────────────────────────────────
async def step3_subjects(db: AsyncSession):
    print("[3/15] 导入科目...")
    subs = [
        (SUBJ_MATH_ID,    "数学", "math",    "理科"),
        (SUBJ_CHINESE_ID, "语文", "chinese", "文科"),
        (SUBJ_ENG_ID,     "英语", "english", "文科"),
        (SUBJ_PHY_ID,     "物理", "physics", "理科"),
        (SUBJ_CHEM_ID,    "化学", "chemistry", "理科"),
        (SUBJ_BIO_ID,     "生物", "biology",  "理科"),
    ]
    for sid, name, code, cat in subs:
        await db.execute(text("""
            INSERT INTO subjects (id, name, code, category, is_active, created_at)
            VALUES (:id, :name, :code, :cat, true, now())
            ON CONFLICT (name) DO NOTHING
        """), {"id": sid, "name": name, "code": code, "cat": cat})
    await db.commit()
    print(f"   导入 {len(subs)} 个科目\n")


# ── STEP 4: 班级 ──────────────────────────────────────────────────────────────────
async def step4_classes(db: AsyncSession):
    print("[4/15] 导入班级...")
    classes = [
        (C_8MATH_ID, "八年级数学提高班", "主攻代数与几何，冲刺中考A档", T_MATH_ID, "G8", "数学"),
        (C_7CHN_ID,  "七年级语文基础班", "阅读理解+古诗词专项强化",     T_CHINESE_ID, "G7", "语文"),
        (C_9ENG_ID,  "九年级英语冲刺班", "中考英语备考，听说读写全面训练", T_ENG_ID, "G9", "英语"),
        (C_8PHY_ID,  "八年级物理启蒙班", "力学与运动学入门",           T_PHY_ID, "G8", "物理"),
        (C_7MATH_ID, "七年级数学基础班", "有理数运算与方程基础",       T_MATH_ID, "G7", "数学"),
    ]
    for cid, name, desc, tid, grade, subj in classes:
        await db.execute(text("""
            INSERT INTO classes (id, name, description, teacher_id, grade_level, subject,
                start_date, end_date, is_active, created_at, updated_at)
            VALUES (:id, :name, :desc, :tid, :grade, :subj,
                :start, :end, true, now(), now())
        """), {"id": cid, "name": name, "desc": desc, "tid": tid,
               "grade": grade, "subj": subj,
               "start": date(2026, 2, 1), "end": date(2026, 7, 31)})

    # 班级-学生关联
    cs_pairs = [
        (C_8MATH_ID, S_ZHANG_ID), (C_8MATH_ID, S_LI_ID),
        (C_8MATH_ID, S_LIU_ID),   (C_8MATH_ID, S_ZHOU_ID),
        (C_7CHN_ID,  S_WANG_ID),  (C_7CHN_ID,  S_ZHAO_ID),
        (C_9ENG_ID,  S_CHEN_ID),  (C_9ENG_ID,  S_SUN_ID),
        (C_8PHY_ID,  S_ZHANG_ID), (C_8PHY_ID,  S_LIU_ID),
        (C_7MATH_ID, S_WANG_ID),  (C_7MATH_ID, S_ZHAO_ID),
    ]
    for cid, sid in cs_pairs:
        await db.execute(text("""
            INSERT INTO class_students (id, class_id, student_id, joined_at)
            VALUES (:id, :cid, :sid, now())
        """), {"id": _uid(), "cid": cid, "sid": sid})
    await db.commit()
    print(f"   导入 {len(classes)} 个班级, {len(cs_pairs)} 条学生关联\n")


# ── STEP 5: 课纲 & 知识点 ─────────────────────────────────────────────────────────
async def step5_syllabus(db: AsyncSession):
    print("[5/15] 导入课纲与知识点树...")
    syllabi = [
        (SYL_MATH8_ID, "八年级数学上册课纲", "G8", "上海", "数学",
         {"chapters": ["实数", "代数式", "方程与方程组", "几何初步"]},
         QADMIN_ID),
        (SYL_CHN7_ID,  "七年级语文上册课纲", "G7", "上海", "语文",
         {"chapters": ["现代文阅读", "古诗词鉴赏", "文言文入门", "写作训练"]},
         QADMIN_ID),
        (SYL_ENG9_ID,  "九年级英语中考课纲", "G9", "上海", "英语",
         {"chapters": ["语法专题", "阅读理解", "完形填空", "书面表达", "听力训练"]},
         QADMIN_ID),
        (SYL_PHY8_ID,  "八年级物理上册课纲", "G8", "上海", "物理",
         {"chapters": ["机械运动", "声现象", "物态变化", "光现象"]},
         QADMIN_ID),
    ]
    for sid, title, grade, prov, subj, content, creator in syllabi:
        await db.execute(text("""
            INSERT INTO syllabi (id, title, grade_level, province, subject, content,
                status, version, is_current, created_by, created_at, updated_at)
            VALUES (:id, :title, CAST(:grade AS jsonb), :prov, :subj, CAST(:content AS jsonb),
                'PUBLISHED', 1, true, :creator, now(), now())
        """), {"id": sid, "title": title, "grade": json.dumps({"grades": [grade]}), "prov": prov,
               "subj": subj, "content": json.dumps(content, ensure_ascii=False),
               "creator": creator})

    # 知识点节点
    # 生成一些 ID 用于父子关联
    kn = {}
    for area in ["实数", "代数式", "方程", "几何", "阅读", "古诗词", "语法", "力学", "运动"]:
        kn[area] = _uid()

    nodes = [
        # 数学
        (kn["实数"], SYL_MATH8_ID, None, "实数", "AREA", 1, "实数的概念与运算"),
        (_uid(), SYL_MATH8_ID, kn["实数"], "有理数运算", "POINT", 1, "加减乘除混合运算"),
        (_uid(), SYL_MATH8_ID, kn["实数"], "平方根与立方根", "POINT", 2, "算术平方根与立方根"),
        (kn["代数式"], SYL_MATH8_ID, None, "代数式", "AREA", 2, "整式与分式"),
        (_uid(), SYL_MATH8_ID, kn["代数式"], "整式加减", "POINT", 1, "合并同类项"),
        (_uid(), SYL_MATH8_ID, kn["代数式"], "因式分解", "POINT", 2, "提公因式法与公式法"),
        (kn["方程"], SYL_MATH8_ID, None, "方程与方程组", "AREA", 3, ""),
        (_uid(), SYL_MATH8_ID, kn["方程"], "一元二次方程", "POINT", 1, "因式分解法、公式法"),
        (kn["几何"], SYL_MATH8_ID, None, "几何初步", "AREA", 4, ""),
        (_uid(), SYL_MATH8_ID, kn["几何"], "三角形全等", "POINT", 1, "SSS/SAS/ASA/AAS"),
        # 语文
        (kn["阅读"], SYL_CHN7_ID, None, "现代文阅读", "AREA", 1, "记叙文与说明文"),
        (_uid(), SYL_CHN7_ID, kn["阅读"], "段落大意概括", "POINT", 1, "提炼核心思想"),
        (kn["古诗词"], SYL_CHN7_ID, None, "古诗词鉴赏", "AREA", 2, "意象与意境分析"),
        (_uid(), SYL_CHN7_ID, kn["古诗词"], "常见意象解读", "POINT", 1, "月亮/柳/雁等"),
        # 英语
        (kn["语法"], SYL_ENG9_ID, None, "语法专题", "AREA", 1, "时态与语态"),
        (_uid(), SYL_ENG9_ID, kn["语法"], "被动语态", "POINT", 1, "be+过去分词"),
        (_uid(), SYL_ENG9_ID, kn["语法"], "虚拟语气", "POINT", 2, "表示假设与愿望"),
        # 物理
        (kn["力学"], SYL_PHY8_ID, None, "力与运动", "AREA", 1, ""),
        (_uid(), SYL_PHY8_ID, kn["力学"], "牛顿第一定律", "POINT", 1, "惯性"),
        (kn["运动"], SYL_PHY8_ID, None, "机械运动", "AREA", 2, ""),
        (_uid(), SYL_PHY8_ID, kn["运动"], "速度与加速度", "POINT", 1, "v=s/t"),
    ]
    for nid, syl_id, parent_id, name, ntype, order, desc in nodes:
        await db.execute(text("""
            INSERT INTO knowledge_nodes (id, syllabus_id, parent_id, name, node_type,
                sort_order, version, is_active, is_modified, description, meta_data,
                created_at, updated_at)
            VALUES (:id, :sid, :pid, :name, :ntype, :order, 1, true, false, :desc, '{}', now(), now())
        """), {"id": nid, "sid": syl_id, "pid": parent_id, "name": name,
               "ntype": ntype, "order": order, "desc": desc})
    await db.commit()
    print(f"   导入 {len(syllabi)} 份课纲, {len(nodes)} 个知识点\n")


# ── STEP 6: 题目 (80道) ───────────────────────────────────────────────────────────
async def step6_questions(db: AsyncSession):
    print("[6/15] 导入题目 (80道)...")

    questions_data = [
        # ═══════════════ 数学·单选 q1~q12 ═══════════════
        _q(1, "下列各数中，属于无理数的是（ ）\nA. √2  B. 0.333…  C. 22/7  D. -3",
           "SINGLE_CHOICE", "EASY", "数学", "grade", ["G8"],
           {"options": ["A. √2", "B. 0.333…", "C. 22/7", "D. -3"], "correct_answer": "A"},
           "无理数是无限不循环小数。√2≈1.41421...是无限不循环小数，为无理数。其余均为有理数。",
           score=3, is_typical=True),
        _q(2, "解方程 x² - 5x + 6 = 0，正确答案是（ ）\nA. x=2或x=3  B. x=2或x=-3  C. x=-2或x=3  D. x=-2或x=-3",
           "SINGLE_CHOICE", "MEDIUM", "数学", "grade", ["G8"],
           {"options": ["A. x=2或x=3", "B. x=2或x=-3", "C. x=-2或x=3", "D. x=-2或x=-3"], "correct_answer": "A"},
           "因式分解：x²-5x+6=(x-2)(x-3)=0，所以x=2或x=3。",
           score=3),
        _q(3, "等腰三角形的两边长分别为4和7，则其周长为（ ）\nA. 15  B. 18  C. 15或18  D. 11",
           "SINGLE_CHOICE", "MEDIUM", "数学", "grade", ["G8"],
           {"options": ["A. 15", "B. 18", "C. 15或18", "D. 11"], "correct_answer": "B"},
           "若腰=4，两腰之和=8<底7，不构成三角形；故腰=7，周长=7+7+4=18。",
           score=3, is_typical=True),
        _q(4, "下列图形中，既是轴对称图形又是中心对称图形的是（ ）\nA. 等边三角形  B. 正方形  C. 等腰梯形  D. 平行四边形",
           "SINGLE_CHOICE", "EASY", "数学", "grade", ["G8"],
           {"options": ["A. 等边三角形", "B. 正方形", "C. 等腰梯形", "D. 平行四边形"], "correct_answer": "B"},
           "正方形既有4条对称轴（轴对称），对角线交点又是对称中心（中心对称）。",
           score=3),
        _q(5, "计算 (√3 + √2)(√3 - √2) = （ ）\nA. 1  B. √6  C. 5  D. 3-2√2",
           "SINGLE_CHOICE", "EASY", "数学", "grade", ["G8"],
           {"options": ["A. 1", "B. √6", "C. 5", "D. 3-2√2"], "correct_answer": "A"},
           "平方差公式：(a+b)(a-b)=a²-b²，(√3)²-(√2)²=3-2=1。",
           score=3),
        _q(6, "一次函数 y = 2x - 3 的图像经过（ ）\nA. 一、二、三象限  B. 一、二、四象限  C. 一、三、四象限  D. 二、三、四象限",
           "SINGLE_CHOICE", "MEDIUM", "数学", "grade", ["G8"],
           {"options": ["A. 一、二、三象限", "B. 一、二、四象限", "C. 一、三、四象限", "D. 二、三、四象限"], "correct_answer": "C"},
           "斜率k=2>0过一三象限；截距b=-3<0与y轴交负半轴，经过一、三、四象限。",
           score=3),
        _q(7, "满足 ∛x = x 的数共有几个？（ ）\nA. 1个  B. 2个  C. 3个  D. 无数个",
           "SINGLE_CHOICE", "HARD", "数学", "grade", ["G8"],
           {"options": ["A. 1个", "B. 2个", "C. 3个", "D. 无数个"], "correct_answer": "C"},
           "x³=x → x(x+1)(x-1)=0 → x=-1,0,1。共3个。",
           score=5, is_typical=True),
        _q(8, "某商品原价100元，先涨20%再降20%，现价为（ ）\nA. 100元  B. 96元  C. 104元  D. 102元",
           "SINGLE_CHOICE", "MEDIUM", "数学", "grade", ["G8","G9"],
           {"options": ["A. 100元", "B. 96元", "C. 104元", "D. 102元"], "correct_answer": "B"},
           "100×1.2×0.8=96元。注意：涨跌幅基数不同不能简单抵消。",
           score=3),
        _q(9, "科学记数法表示 0.00308，正确的是（ ）\nA. 3.08×10⁻³  B. 3.08×10⁻²  C. 30.8×10⁻⁴  D. 0.308×10⁻²",
           "SINGLE_CHOICE", "EASY", "数学", "grade", ["G7","G8"],
           {"options": ["A. 3.08×10⁻³", "B. 3.08×10⁻²", "C. 30.8×10⁻⁴", "D. 0.308×10⁻²"], "correct_answer": "A"},
           "科学记数法要求 1≤|系数|<10。0.00308=3.08×10⁻³。",
           score=3),
        _q(10, "若 a-b=3, ab=2，则 a²+b² =（ ）\nA. 5  B. 9  C. 13  D. 7",
           "SINGLE_CHOICE", "MEDIUM", "数学", "grade", ["G8"],
           {"options": ["A. 5", "B. 9", "C. 13", "D. 7"], "correct_answer": "C"},
           "a²+b²=(a-b)²+2ab=9+4=13。",
           score=3),
        _q(11, "若点A(2-a, a+1)在第二象限，则a的取值范围是（ ）\nA. a<-1  B. a>2  C. -1<a<2  D. a<-1或a>2",
           "SINGLE_CHOICE", "MEDIUM", "数学", "grade", ["G8"],
           {"options": ["A. a<-1", "B. a>2", "C. -1<a<2", "D. a<-1或a>2"], "correct_answer": "B"},
           "第二象限x<0, y>0：2-a<0→a>2；a+1>0→a>-1。综上a>2。",
           score=3),
        _q(12, "下列命题中，真命题是（ ）\nA. 对角线相等的四边形是矩形  B. 对角线互相垂直的四边形是菱形  C. 对角线互相平分的四边形是平行四边形  D. 对角线互相垂直且相等的四边形是正方形",
           "SINGLE_CHOICE", "MEDIUM", "数学", "grade", ["G8"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "C"},
           "平行四边形判定定理：对角线互相平分的四边形是平行四边形。其余选项均需附加条件。",
           score=3, is_typical=True),

        # ═══════════════ 数学·多选 q13~q17 ═══════════════
        _q(13, "下列说法正确的有（多选）（ ）\nA. 两点确定一条直线  B. 两点之间线段最短  C. 直线没有端点  D. 射线有一个端点",
           "MULTIPLE_CHOICE", "EASY", "数学", "grade", ["G7","G8"],
           {"options": ["A", "B", "C", "D"], "correct_answer": ["A","B","C","D"]},
           "均为几何基本事实或定义。四项全对。",
           score=6),
        _q(14, "关于实数，下列说法正确的是（多选）（ ）\nA. 两个无理数之和一定是无理数  B. 正数的平方根有两个  C. 0既不是正数也不是负数  D. 有理数包括整数和分数",
           "MULTIPLE_CHOICE", "MEDIUM", "数学", "grade", ["G8"],
           {"options": ["A", "B", "C", "D"], "correct_answer": ["B","C","D"]},
           "A反例：√2+(-√2)=0；B正确(±)；C正确；D正确。",
           score=6, is_typical=True),
        _q(15, "下列多项式中属于完全平方式的有（多选）（ ）\nA. x²+4x+4  B. x²-6x+9  C. x²+2x+4  D. 4x²+4x+1",
           "MULTIPLE_CHOICE", "EASY", "数学", "grade", ["G8"],
           {"options": ["A", "B", "C", "D"], "correct_answer": ["A","B","D"]},
           "A=(x+2)²; B=(x-3)²; C=x²+2x+4非完全平方; D=(2x+1)²。",
           score=6),
        _q(16, "一次函数 y=kx+b (k≠0)，下列正确的是（多选）（ ）\nA. k>0时y随x增大而增大  B. b>0时图像与y轴交于正半轴  C. k<0时图像不经过第一象限  D. b=0时图像过原点",
           "MULTIPLE_CHOICE", "HARD", "数学", "grade", ["G8"],
           {"options": ["A", "B", "C", "D"], "correct_answer": ["A","B","D"]},
           "C错误：k<0且b>0时仍经过第一象限（如y=-x+1过第一、二、四象限）。",
           score=8),
        _q(17, "下列各组数能构成直角三角形三边长的有（多选）（ ）\nA. 3,4,5  B. 5,12,13  C. 1,2,3  D. 6,8,10",
           "MULTIPLE_CHOICE", "EASY", "数学", "grade", ["G8"],
           {"options": ["A", "B", "C", "D"], "correct_answer": ["A","B","D"]},
           "勾股定理验证：3²+4²=5²✓; 5²+12²=13²✓; 1+4≠9✗; 6²+8²=10²✓。",
           score=6, is_typical=True),

        # ═══════════════ 数学·填空 q18~q23 ═══════════════
        _q(18, "计算 |-3| + √9 - 2⁰ = ________",
           "FILL_BLANK", "EASY", "数学", "grade", ["G7","G8"],
           {"options": None, "correct_answer": ["5"]},
           "|-3|=3, √9=3, 2⁰=1, 3+3-1=5。",
           score=4),
        _q(19, "解不等式 3x - 7 > 2，x的取值范围是 ________",
           "FILL_BLANK", "EASY", "数学", "grade", ["G7","G8"],
           {"options": None, "correct_answer": ["x>3"]},
           "3x>9, x>3。",
           score=4),
        _q(20, "若 a²+b²=25, ab=12，则 (a+b)² = ________",
           "FILL_BLANK", "MEDIUM", "数学", "grade", ["G8"],
           {"options": None, "correct_answer": ["49"]},
           "(a+b)²=a²+2ab+b²=25+24=49。",
           score=6, is_typical=True),
        _q(21, "因式分解：x² - 6x + 9 = ________",
           "FILL_BLANK", "EASY", "数学", "grade", ["G8"],
           {"options": None, "correct_answer": ["(x-3)²", "(x-3)^2"]},
           "完全平方公式：(x-3)²。",
           score=4),
        _q(22, "一个正多边形的内角和为1080°，则它有 ________ 条边",
           "FILL_BLANK", "MEDIUM", "数学", "grade", ["G8","G9"],
           {"options": None, "correct_answer": ["8"]},
           "(n-2)×180°=1080° → n=8。",
           score=4),
        _q(23, "一组数据 2,4,4,6,8 的中位数是 ________，众数是 ________",
           "FILL_BLANK", "EASY", "数学", "grade", ["G7"],
           {"options": None, "correct_answer": ["4", "4"]},
           "中位数：排序后中间位置；众数：出现次数最多的数。",
           score=4),

        # ═══════════════ 数学·解答 q24~q30 ═══════════════
        _q(24, "解方程组：2x + y = 7\n         x - y = 2\n请写出完整的解题过程。",
           "SUBJECTIVE", "EASY", "数学", "grade", ["G7","G8"],
           {"options": None, "correct_answer": {"keywords": ["x=3","y=1","代入","加减消元"], "max_score": 8}},
           "两式相加：3x=9, x=3；代入第二式：3-y=2, y=1。解为x=3, y=1。",
           score=8),
        _q(25, "等腰△ABC中，AB=AC=5cm，BC=8cm，求面积。",
           "SUBJECTIVE", "MEDIUM", "数学", "grade", ["G8"],
           {"options": None, "correct_answer": {"keywords": ["高","勾股定理","3","12"], "max_score": 10}},
           "作BC边上高AD，D为BC中点，BD=4；AD²=AB²-BD²=9, AD=3；S=½×8×3=12cm²。",
           score=10, is_typical=True),
        _q(26, "某校今年人数比去年的200人增加15%，今年多少人？",
           "SUBJECTIVE", "EASY", "数学", "grade", ["G7"],
           {"options": None, "correct_answer": {"keywords": ["230","1.15","15%","增加"], "max_score": 6}},
           "200×(1+15%)=200×1.15=230人。",
           score=6, created_by=T_CHINESE_ID),
        _q(27, "求证：同位角相等则两直线平行。",
           "SUBJECTIVE", "HARD", "数学", "grade", ["G8"],
           {"options": None, "correct_answer": {"keywords": ["反证法","对顶角","平行","同位角"], "max_score": 12}},
           "利用对顶角相等和同位角定义，假设不平行则同位角不相等，推出矛盾。",
           score=12, is_typical=True),
        _q(28, "用配方法解方程 x² - 4x - 1 = 0。",
           "SUBJECTIVE", "MEDIUM", "数学", "grade", ["G8"],
           {"options": None, "correct_answer": {"keywords": ["配方","(x-2)²","x=2±√5"], "max_score": 10}},
           "x²-4x=1, (x-2)²=5, x=2±√5。",
           score=10),
        _q(29, "一次函数 y=2x+1 的图像上有两点 A(1,y₁) 和 B(3,y₂)，比较 y₁ 与 y₂ 的大小。",
           "SUBJECTIVE", "EASY", "数学", "grade", ["G7"],
           {"options": None, "correct_answer": {"keywords": ["y1<y2","递增","k>0"], "max_score": 4}},
           "k=2>0，函数递增，x越大y越大，故y₁<y₂。",
           score=4),
        _q(30, "求多项式 (2x+1)(x-3) 的展开式。",
           "SUBJECTIVE", "EASY", "数学", "grade", ["G7","G8"],
           {"options": None, "correct_answer": {"keywords": ["2x²","-5x","-3"], "max_score": 6}},
           "展开：2x²-6x+x-3=2x²-5x-3。",
           score=6),

        # ═══════════════ 语文·单选 q31~q38 ═══════════════
        _q(31, "下列加点字注音全部正确的一项是（ ）\nA. 惬意(qiè)  B. 蹒跚(mán)  C. 亘古(gèn)  D. 眺望(tiào)",
           "SINGLE_CHOICE", "EASY", "语文", "grade", ["G7"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "D"},
           "蹒跚读pán shān，蹒为pán，B项有误。",
           score=2, created_by=T_CHINESE_ID),
        _q(32, "以下句子没有语病的一句是（ ）\nA. 通过努力，使他进步了  B. 要防止不再犯错  C. 他不但语文好而且数学也好  D. 文章的作者是张老师写的",
           "SINGLE_CHOICE", "MEDIUM", "语文", "grade", ["G7"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "C"},
           "A缺主语(去掉'通过'); B双重否定不当; C递进正确; D句式杂糅。",
           score=2, created_by=T_CHINESE_ID),
        _q(33, "《春》的作者是（ ）\nA. 鲁迅  B. 朱自清  C. 老舍  D. 冰心",
           "SINGLE_CHOICE", "EASY", "语文", "grade", ["G7"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "B"},
           "朱自清散文代表作，与《荷塘月色》《背影》齐名。",
           score=2, created_by=T_CHINESE_ID),
        _q(34, "'但愿人长久，千里共婵娟'出自（ ）\nA. 《水调歌头》  B. 《念奴娇》  C. 《江城子》  D. 《蝶恋花》",
           "SINGLE_CHOICE", "EASY", "语文", "grade", ["G7","G8"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "A"},
           "苏轼《水调歌头·明月几时有》。",
           score=2, created_by=T_CHINESE_ID, is_typical=True),
        _q(35, "下列各组词语书写完全正确的一项是（ ）\nA. 急燥/烦躁  B. 松弛/驰骋  C. 委曲/委屈  D. 品味/品位",
           "SINGLE_CHOICE", "MEDIUM", "语文", "grade", ["G7"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "D"},
           "A'急燥'应为'急躁'; B'松弛'正确; C'委曲'非'委屈'; D两组均正确且词义不同。",
           score=2, created_by=T_CHINESE_ID),
        _q(36, "'温故而知新，可以为师矣'出自（ ）\nA. 《学而》  B. 《为政》  C. 《述而》  D. 《子罕》",
           "SINGLE_CHOICE", "EASY", "语文", "grade", ["G7"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "B"},
           "出自《论语·为政》篇。",
           score=2, created_by=T_CHINESE_ID),
        _q(37, "下列修辞手法判断正确的一项（ ）\nA. '太阳像火球'——拟人  B. '小草偷偷钻出来'——拟人  C. '白发三千丈'——比喻  D. '他像他爸爸'——比喻",
           "SINGLE_CHOICE", "MEDIUM", "语文", "grade", ["G7"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "B"},
           "A为比喻; B拟人(偷偷); C夸张; D表比较非比喻。",
           score=2, created_by=T_CHINESE_ID),
        _q(38, "下列句子中标点符号使用正确的是（ ）\nA. 妈妈说：'吃饭了。'  B. 他问我去不去？  C. 我买了苹果、香蕉和橘子。  D. 今天星期三…",
           "SINGLE_CHOICE", "MEDIUM", "语文", "grade", ["G7"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "C"},
           "A引号内句号应为逗号或不用; B陈述句用句号不用问号; C并列正确; D省略号应为三点(…)不是省略号(...)。",
           score=2, created_by=T_CHINESE_ID),

        # ═══════════════ 语文·填空 q39~q42 ═══════════════
        _q(39, "'海内存知己，天涯若比邻'出自王勃《________》",
           "FILL_BLANK", "EASY", "语文", "grade", ["G7"],
           {"options": None, "correct_answer": ["送杜少府之任蜀州", "送杜少府之任蜀川"]},
           "王勃《送杜少府之任蜀州》。",
           score=3, created_by=T_CHINESE_ID),
        _q(40, "《从百草园到三味书屋》作者是________，选自散文集《________》",
           "FILL_BLANK", "EASY", "语文", "grade", ["G7"],
           {"options": None, "correct_answer": ["鲁迅", "朝花夕拾"]},
           "鲁迅回忆性散文集《朝花夕拾》。",
           score=4, created_by=T_CHINESE_ID),
        _q(41, "'学而不思则罔，思而不学则________'（《论语》）",
           "FILL_BLANK", "EASY", "语文", "grade", ["G7","G8"],
           {"options": None, "correct_answer": ["殆"]},
           "孔子：光学习不思考会迷惑，光思考不学习会危险。",
           score=3, created_by=T_CHINESE_ID),
        _q(42, "补全诗句：'________，春风吹又生'（白居易《赋得古原草送别》）",
           "FILL_BLANK", "EASY", "语文", "grade", ["G7"],
           {"options": None, "correct_answer": ["野火烧不尽"]},
           "离离原上草，一岁一枯荣。野火烧不尽，春风吹又生。",
           score=3, created_by=T_CHINESE_ID),

        # ═══════════════ 语文·解答 q43~q50 ═══════════════
        _q(43, "赏析《春》中'吹面不寒杨柳风'（不少于50字）",
           "SUBJECTIVE", "MEDIUM", "语文", "grade", ["G7"],
           {"options": None, "correct_answer": {"keywords": ["拟人","触觉","柔和","春风","感官"], "max_score": 8}},
           "用触觉写春风之轻柔温暖，引用古诗增添意境，'杨柳风'以柳枝的轻柔侧面烘托。",
           score=8, created_by=T_CHINESE_ID, is_typical=True),
        _q(44, "概括《走一步，再走一步》中'我'的心理变化（不超过50字）",
           "SUBJECTIVE", "EASY", "语文", "grade", ["G7"],
           {"options": None, "correct_answer": {"keywords": ["恐惧","信心","勇气","成功"], "max_score": 6}},
           "害怕→绝望→听从指导→一步步尝试→信心增加→成功→领悟人生哲理。",
           score=6, created_by=T_CHINESE_ID),
        _q(45, "以'我的一次成长经历'为题写片段作文（不少于150字）",
           "SUBJECTIVE", "HARD", "语文", "grade", ["G7","G8"],
           {"options": None, "correct_answer": {"keywords": ["细节","真情","结构","照应"], "max_score": 20}},
           "评分：观点明确、内容具体、语言生动、结构完整、书写规范。",
           score=20, created_by=T_CHINESE_ID),
        _q(46, "简要分析《论语》中'己所不欲，勿施于人'的含义。",
           "SUBJECTIVE", "MEDIUM", "语文", "grade", ["G7","G8"],
           {"options": None, "correct_answer": {"keywords": ["换位思考","推己及人","恕","道德"], "max_score": 6}},
           "自己不想要的，不要强加给别人。这是儒家'恕'道的核心，体现换位思考的道德原则。",
           score=6, created_by=T_CHINESE_ID),
        _q(47, "将下列句子翻译为现代汉语：'知之者不如好之者，好之者不如乐之者。'",
           "SUBJECTIVE", "EASY", "语文", "grade", ["G7"],
           {"options": None, "correct_answer": {"keywords": ["知道","喜好","以…为乐","学习"], "max_score": 4}},
           "知道学习不如喜爱学习，喜爱学习不如以学习为乐。",
           score=4, created_by=T_CHINESE_ID),
        _q(48, "写一段节日祝福语（教师节，50字左右）",
           "SUBJECTIVE", "EASY", "语文", "grade", ["G7"],
           {"options": None, "correct_answer": {"keywords": ["感谢","祝福","老师","教育"], "max_score": 5}},
           "要点：表达感恩、祝福健康快乐、格式恰当。",
           score=5, created_by=T_CHINESE_ID),
        _q(49, "分析'春风又绿江南岸'中'绿'字的妙处。",
           "SUBJECTIVE", "MEDIUM", "语文", "grade", ["G8"],
           {"options": None, "correct_answer": {"keywords": ["形容词作动词","使动","色彩","化静为动"], "max_score": 8}},
           "'绿'形容词用作动词，使动用法，意为'使…变绿'。一个'绿'字化抽象为具体，写尽春风带来的生机。",
           score=8, created_by=T_CHINESE_ID, is_typical=True),
        _q(50, "阅读短文，概括中心思想并谈感受（80字左右）",
           "SUBJECTIVE", "MEDIUM", "语文", "grade", ["G7","G8"],
           {"options": None, "correct_answer": {"keywords": ["概括","感受","主旨","情感"], "max_score": 8}},
           "要求：①准确概括文章主旨；②谈个人感受要有真情实感；③语言流畅。",
           score=8, created_by=T_CHINESE_ID),

        # ═══════════════ 英语·单选 q51~q58 ═══════════════
        _q(51, "— What ___ you doing at 8pm yesterday?\n— I ___ watching TV.\nA. were/was  B. was/were  C. did/was  D. were/were",
           "SINGLE_CHOICE", "EASY", "英语", "grade", ["G8","G9"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "A"},
           "过去进行时：you用were, I用was。",
           score=3, created_by=T_ENG_ID),
        _q(52, "She suggested that we ___ early tomorrow.\nA. leave  B. left  C. would leave  D. leaving",
           "SINGLE_CHOICE", "MEDIUM", "英语", "grade", ["G9"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "A"},
           "suggest后接that从句用虚拟语气(should+原形或直接原形)。",
           score=3, created_by=T_ENG_ID),
        _q(53, "The book ___ on the shelf belongs to me.\nA. lay  B. lies  C. lying  D. lain",
           "SINGLE_CHOICE", "MEDIUM", "英语", "grade", ["G9"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "C"},
           "现在分词lying做后置定语修饰book。",
           score=3, created_by=T_ENG_ID),
        _q(54, "下列单词划线部分发音不同的是（ ）\nA. bread  B. head  C. heavy  D. dream",
           "SINGLE_CHOICE", "EASY", "英语", "grade", ["G8"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "D"},
           "A/B/C中ea发/e/; D中ea发/iː/。",
           score=2, created_by=T_ENG_ID),
        _q(55, "He is good ___ playing football.\nA. at  B. in  C. for  D. with",
           "SINGLE_CHOICE", "EASY", "英语", "grade", ["G8"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "A"},
           "be good at doing sth 固定搭配。",
           score=2, created_by=T_ENG_ID, is_typical=True),
        _q(56, "The news ___ him very excited.\nA. made  B. make  C. making  D. makes",
           "SINGLE_CHOICE", "MEDIUM", "英语", "grade", ["G8"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "A"},
           "make+宾语+adj 结构，过去时用made。",
           score=3, created_by=T_ENG_ID),
        _q(57, "Neither he nor I ___ a teacher.\nA. is  B. am  C. are  D. be",
           "SINGLE_CHOICE", "MEDIUM", "英语", "grade", ["G9"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "B"},
           "neither...nor...就近原则，靠近I用am。",
           score=3, created_by=T_ENG_ID),
        _q(58, "Would you mind ___ the window?\nA. open  B. to open  C. opening  D. opened",
           "SINGLE_CHOICE", "EASY", "英语", "grade", ["G8","G9"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "C"},
           "mind doing sth 固定搭配。",
           score=2, created_by=T_ENG_ID),

        # ═══════════════ 英语·填空 q59~q63 ═══════════════
        _q(59, "用适当形式填空：He often ___ (go) to school by bike.",
           "FILL_BLANK", "EASY", "英语", "grade", ["G8"],
           {"options": None, "correct_answer": ["goes"]},
           "第三人称单数一般现在时，go→goes。",
           score=2, created_by=T_ENG_ID),
        _q(60, "用适当形式填空：They ___ (visit) the museum yesterday.",
           "FILL_BLANK", "EASY", "英语", "grade", ["G8"],
           {"options": None, "correct_answer": ["visited"]},
           "一般过去时，visit+ed。",
           score=2, created_by=T_ENG_ID),
        _q(61, "翻译：'他们正在图书馆学习' → ________",
           "FILL_BLANK", "EASY", "英语", "grade", ["G8"],
           {"options": None, "correct_answer": ["They are studying in the library.", "They are learning in the library."]},
           "现在进行时：be+doing。",
           score=4, created_by=T_ENG_ID),
        _q(62, "写出反义词：happy → ________, fast → ________",
           "FILL_BLANK", "EASY", "英语", "grade", ["G7","G8"],
           {"options": None, "correct_answer": ["sad/unhappy", "slow"]},
           "happy-sad/unhappy, fast-slow。",
           score=4, created_by=T_ENG_ID),
        _q(63, "用括号内词的正确形式填空：This is the ___ (good) movie I have ever seen.",
           "FILL_BLANK", "MEDIUM", "英语", "grade", ["G9"],
           {"options": None, "correct_answer": ["best"]},
           "最高级：the+最高级+完成时表示'曾…过的最…'。",
           score=3, created_by=T_ENG_ID),

        # ═══════════════ 英语·解答 q64~q70 ═══════════════
        _q(64, "Read and answer: Tom reads books and plays basketball in spare time. What does Tom like? (Answer in English)",
           "SUBJECTIVE", "EASY", "英语", "grade", ["G8"],
           {"options": None, "correct_answer": {"keywords": ["reading","playing basketball","likes"], "max_score": 4}},
           "Tom likes reading books and playing basketball.",
           score=4, created_by=T_ENG_ID),
        _q(65, "用 although 和 unless 各造一句（每句≥8词）",
           "SUBJECTIVE", "MEDIUM", "英语", "grade", ["G9"],
           {"options": None, "correct_answer": {"keywords": ["although","unless","完整句","语法"], "max_score": 6}},
           "Although it was raining, we went out. / You will fail unless you study.",
           score=6, created_by=T_ENG_ID),
        _q(66, "以 My Favourite Season 为题写短文（≥60词）",
           "SUBJECTIVE", "MEDIUM", "英语", "grade", ["G8","G9"],
           {"options": None, "correct_answer": {"keywords": ["favourite","season","because","activities"], "max_score": 10}},
           "评分：主题明确+理由充分+具体活动+语法正确+词数达标。",
           score=10, created_by=T_ENG_ID),
        _q(67, "将下列句子改为被动语态：\n1. The teacher corrected the homework.\n2. They built this bridge in 1990.",
           "SUBJECTIVE", "MEDIUM", "英语", "grade", ["G9"],
           {"options": None, "correct_answer": {"keywords": ["was corrected","was built","被动"], "max_score": 6}},
           "1. The homework was corrected by the teacher. 2. This bridge was built in 1990.",
           score=6, created_by=T_ENG_ID, is_typical=True),
        _q(68, "阅读理解：根据短文判断正误并说明理由（英文作答）",
           "SUBJECTIVE", "HARD", "英语", "grade", ["G9"],
           {"options": None, "correct_answer": {"keywords": ["True","False","because","according"], "max_score": 12}},
           "答题需引用原文，给出判断依据。",
           score=12, created_by=T_ENG_ID),
        _q(69, "Describe your best friend (≥50 words).",
           "SUBJECTIVE", "MEDIUM", "英语", "grade", ["G8"],
           {"options": None, "correct_answer": {"keywords": ["name","appearance","personality","hobby","why"], "max_score": 8}},
           "评分：描述具体+有外貌性格爱好+有理由喜欢+语法正确。",
           score=8, created_by=T_ENG_ID),
        _q(70, "Write an email inviting your friend to a weekend picnic (≥30 words).",
           "SUBJECTIVE", "EASY", "英语", "grade", ["G8"],
           {"options": None, "correct_answer": {"keywords": ["invite","picnic","weekend","hope"], "max_score": 6}},
           "邮件格式+邀请内容+时间地点+希望对方能来。",
           score=6, created_by=T_ENG_ID),

        # ═══════════════ 物理·单选 q71~q76 ═══════════════
        _q(71, "下列现象中属于光的反射的是（ ）\nA. 水中倒影  B. 日食  C. 彩虹  D. 水中筷子'折断'",
           "SINGLE_CHOICE", "EASY", "物理", "grade", ["G8"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "A"},
           "水中倒影是镜面反射；日食是光的直线传播；彩虹是折射和色散；筷子'折断'是折射。",
           score=3, created_by=T_PHY_ID),
        _q(72, "一个物体做匀速直线运动，5秒内通过了20m，它的速度是（ ）\nA. 2m/s  B. 4m/s  C. 5m/s  D. 10m/s",
           "SINGLE_CHOICE", "EASY", "物理", "grade", ["G8"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "B"},
           "v=s/t=20m/5s=4m/s。",
           score=3, created_by=T_PHY_ID),
        _q(73, "声音在下列哪种介质中传播最快？（ ）\nA. 空气  B. 水  C. 钢铁  D. 真空",
           "SINGLE_CHOICE", "EASY", "物理", "grade", ["G8"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "C"},
           "声音传播速度：固体>液体>气体，真空中不能传播。钢铁最快。",
           score=3, created_by=T_PHY_ID),
        _q(74, "下列物态变化中属于凝华的是（ ）\nA. 雾的形成  B. 霜的形成  C. 露的形成  D. 冰化成水",
           "SINGLE_CHOICE", "MEDIUM", "物理", "grade", ["G8"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "B"},
           "凝华：气态→固态。霜是水蒸气直接凝华成固态冰晶。雾和露是液化。",
           score=3, created_by=T_PHY_ID, is_typical=True),
        _q(75, "关于惯性，下列说法正确的是（ ）\nA. 物体速度越大惯性越大  B. 只有运动的物体才有惯性  C. 惯性是物体的固有属性  D. 太空中的物体没有惯性",
           "SINGLE_CHOICE", "MEDIUM", "物理", "grade", ["G8"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "C"},
           "惯性只与质量有关，与运动状态无关，是物体的固有属性，任何有质量的物体都有惯性。",
           score=3, created_by=T_PHY_ID),
        _q(76, "凸透镜成像中，当物距大于2倍焦距时，成（ ）\nA. 正立放大虚像  B. 倒立缩小实像  C. 倒立放大实像  D. 正立缩小虚像",
           "SINGLE_CHOICE", "MEDIUM", "物理", "grade", ["G8"],
           {"options": ["A", "B", "C", "D"], "correct_answer": "B"},
           "u>2f时成倒立缩小实像（照相机原理）。",
           score=3, created_by=T_PHY_ID),

        # ═══════════════ 物理·多选 q77~q78 ═══════════════
        _q(77, "下列关于力的说法正确的有（多选）（ ）\nA. 力可以改变物体的运动状态  B. 力可以改变物体的形状  C. 力的作用是相互的  D. 物体间不接触也可以产生力",
           "MULTIPLE_CHOICE", "EASY", "物理", "grade", ["G8"],
           {"options": ["A", "B", "C", "D"], "correct_answer": ["A","B","C","D"]},
           "A/B是力的两种作用效果；C是牛顿第三定律；D如万有引力、磁力。",
           score=6, created_by=T_PHY_ID),
        _q(78, "下列关于密度的说法正确的有（多选）（ ）\nA. 密度与物体的质量成正比  B. 密度是物质的特性  C. ρ=m/V  D. 同一物质密度不变",
           "MULTIPLE_CHOICE", "MEDIUM", "物理", "grade", ["G8"],
           {"options": ["A", "B", "C", "D"], "correct_answer": ["B","C"]},
           "A错误：密度是物质特性，与质量体积无关；B正确；C是密度公式；D同一物质密度随温度、状态变化（如水与冰）。",
           score=6, created_by=T_PHY_ID),

        # ═══════════════ 物理·填空 q79~q80 ═══════════════
        _q(79, "光在真空中的传播速度约为 ________ m/s",
           "FILL_BLANK", "EASY", "物理", "grade", ["G8"],
           {"options": None, "correct_answer": ["3×10⁸", "3*10^8", "3.0×10⁸", "300000000", "3x10⁸"]},
           "c≈3×10⁸ m/s。",
           score=3, created_by=T_PHY_ID),
        _q(80, "一个物体重50N，放在水平地面上，受到10N的水平推力做匀速直线运动，摩擦力为 ________ N",
           "FILL_BLANK", "MEDIUM", "物理", "grade", ["G8"],
           {"options": None, "correct_answer": ["10"]},
           "匀速直线→合力为0→摩擦力=推力=10N。",
           score=4, created_by=T_PHY_ID),
    ]

    for q in questions_data:
        await db.execute(text("""
            INSERT INTO questions (id, title, question_type, difficulty, subject, grade_level,
                score, correct_answer, explanation, meta_data, source, review_status,
                reviewed_by, reviewed_at, created_by, is_active, is_typical, content_hash,
                created_at, updated_at)
            VALUES (:id, :title, :question_type, :difficulty, :subject, :grade_level,
                :score, :correct_answer, :explanation, :meta_data, :source, :review_status,
                :reviewed_by, :reviewed_at, :created_by, :is_active, :is_typical, :content_hash,
                :created_at, :updated_at)
        """), q)
    await db.commit()
    print(f"   导入 {len(questions_data)} 道题目\n")


# ── STEP 7: 试卷 ──────────────────────────────────────────────────────────────────
async def step7_papers(db: AsyncSession):
    print("[7/15] 导入试卷及单元结构...")

    papers = [
        (PAPER_MATH_MID_ID,  "八年级数学上册期中测试", "实数+代数式+方程三章，满分100分",
         "数学", {"scope":"grade","grades":["G8"]}, 100, 120,
         "请将答案写在答题纸上，计算题须写出完整解题步骤，否则不得分。", T_MATH_ID, {"EASY":20,"MEDIUM":50,"HARD":30}, False, False),
        (PAPER_MATH_UNIT_ID, "八年级数学·第一章单元测试(实数)", "实数概念与运算，满分50分",
         "数学", {"scope":"grade","grades":["G8"]}, 50, 60,
         "全部题目均需作答。", T_MATH_ID, {"EASY":30,"MEDIUM":50,"HARD":20}, True, False),
        (PAPER_MATH_FINAL_ID,"八年级数学上册期末测试", "全册综合检测，满分120分",
         "数学", {"scope":"grade","grades":["G8"]}, 120, 120,
         "认真审题，书写规范。选择题用2B铅笔填涂。", T_MATH_ID, {"EASY":15,"MEDIUM":55,"HARD":30}, True, True),
        (PAPER_CHN_MID_ID,   "七年级语文上册期中检测", "现代文+古诗词+写作，满分100分",
         "语文", {"scope":"grade","grades":["G7"]}, 100, 120,
         "作文字迹工整，卷面整洁将酌情加分。", T_CHINESE_ID, {"EASY":20,"MEDIUM":50,"HARD":30}, False, False),
        (PAPER_ENG_FINAL_ID, "九年级英语中考模拟卷", "单选+填空+阅读+写作，满分120分",
         "英语", {"scope":"grade","grades":["G9"]}, 120, 120,
         "听力部分另行安排。本卷考查语法、阅读和写作能力。", T_ENG_ID, {"EASY":20,"MEDIUM":50,"HARD":30}, False, False),
        (PAPER_PHY_UNIT_ID,  "八年级物理·光现象单元测试", "光的传播+反射+折射，满分60分",
         "物理", {"scope":"grade","grades":["G8"]}, 60, 45,
         "作图题请用铅笔和直尺。", T_PHY_ID, {"EASY":20,"MEDIUM":50,"HARD":30}, False, False),
    ]

    # Paper-question map with type info for unit grouping
    # 语文/英语/物理：问题类型从 _q() 调用中提取
    paper_q_map = {
        PAPER_MATH_MID_ID: [
            ("q1",1,3, "SINGLE_CHOICE"),("q2",2,3, "SINGLE_CHOICE"),("q3",3,3, "SINGLE_CHOICE"),
            ("q4",4,3, "SINGLE_CHOICE"),("q5",5,3, "SINGLE_CHOICE"),("q6",6,3, "SINGLE_CHOICE"),
            ("q7",7,5, "SINGLE_CHOICE"),("q8",8,3, "SINGLE_CHOICE"),("q9",9,3, "SINGLE_CHOICE"),
            ("q13",10,6, "MULTIPLE_CHOICE"),("q14",11,6, "MULTIPLE_CHOICE"),("q15",12,6, "MULTIPLE_CHOICE"),
            ("q18",13,4, "FILL_BLANK"),("q19",14,4, "FILL_BLANK"),("q20",15,6, "FILL_BLANK"),
            ("q24",16,8, "SUBJECTIVE"),("q25",17,10, "SUBJECTIVE"),("q28",18,10, "SUBJECTIVE"),
        ],
        PAPER_MATH_UNIT_ID: [
            ("q1",1,3, "SINGLE_CHOICE"),("q5",2,3, "SINGLE_CHOICE"),("q7",3,5, "SINGLE_CHOICE"),
            ("q9",4,3, "SINGLE_CHOICE"),("q10",5,3, "SINGLE_CHOICE"),
            ("q14",6,6, "MULTIPLE_CHOICE"),
            ("q18",7,4, "FILL_BLANK"),("q19",8,4, "FILL_BLANK"),("q21",9,4, "FILL_BLANK"),
            ("q24",10,8, "SUBJECTIVE"),("q30",11,6, "SUBJECTIVE"),
        ],
        PAPER_MATH_FINAL_ID: [
            ("q1",1,3, "SINGLE_CHOICE"),("q3",2,3, "SINGLE_CHOICE"),("q4",3,3, "SINGLE_CHOICE"),
            ("q6",4,3, "SINGLE_CHOICE"),("q7",5,5, "SINGLE_CHOICE"),("q10",6,3, "SINGLE_CHOICE"),
            ("q12",7,3, "SINGLE_CHOICE"),
            ("q13",8,6, "MULTIPLE_CHOICE"),("q14",9,6, "MULTIPLE_CHOICE"),
            ("q16",10,8, "MULTIPLE_CHOICE"),("q17",11,6, "MULTIPLE_CHOICE"),
            ("q20",12,6, "FILL_BLANK"),("q22",13,4, "FILL_BLANK"),("q23",14,4, "FILL_BLANK"),
            ("q25",15,10, "SUBJECTIVE"),("q27",16,12, "SUBJECTIVE"),
            ("q28",17,10, "SUBJECTIVE"),("q29",18,4, "SUBJECTIVE"),("q30",19,6, "SUBJECTIVE"),
        ],
        PAPER_CHN_MID_ID: [
            ("q31",1,2,"SINGLE_CHOICE"),("q32",2,2,"SINGLE_CHOICE"),("q33",3,2,"SINGLE_CHOICE"),
            ("q34",4,2,"SINGLE_CHOICE"),("q35",5,2,"SINGLE_CHOICE"),("q36",6,2,"SINGLE_CHOICE"),
            ("q37",7,2,"SINGLE_CHOICE"),("q38",8,2,"SINGLE_CHOICE"),
            ("q39",9,3,"FILL_BLANK"),("q40",10,4,"FILL_BLANK"),("q41",11,3,"FILL_BLANK"),("q42",12,3,"FILL_BLANK"),
            ("q43",13,8,"SUBJECTIVE"),("q44",14,6,"SUBJECTIVE"),("q47",15,4,"SUBJECTIVE"),
            ("q49",16,8,"SUBJECTIVE"),("q45",17,20,"SUBJECTIVE"),
        ],
        PAPER_ENG_FINAL_ID: [
            ("q51",1,3,"SINGLE_CHOICE"),("q52",2,3,"FILL_BLANK"),("q53",3,3,"FILL_BLANK"),
            ("q54",4,2,"SUBJECTIVE"),("q55",5,2,"SINGLE_CHOICE"),("q56",6,3,"SINGLE_CHOICE"),
            ("q57",7,3,"SINGLE_CHOICE"),("q58",8,2,"SINGLE_CHOICE"),("q59",9,2,"FILL_BLANK"),
            ("q60",10,2,"FILL_BLANK"),("q61",11,4,"SUBJECTIVE"),("q62",12,4,"FILL_BLANK"),
            ("q63",13,3,"FILL_BLANK"),("q64",14,4,"SUBJECTIVE"),("q65",15,6,"SUBJECTIVE"),
            ("q66",16,10,"SUBJECTIVE"),("q67",17,6,"SUBJECTIVE"),("q68",18,12,"SUBJECTIVE"),
            ("q69",19,8,"SUBJECTIVE"),("q70",20,6,"SUBJECTIVE"),
        ],
        PAPER_PHY_UNIT_ID: [
            ("q71",1,3,"SINGLE_CHOICE"),("q72",2,3,"FILL_BLANK"),("q73",3,3,"SINGLE_CHOICE"),
            ("q74",4,3,"SINGLE_CHOICE"),("q75",5,3,"SINGLE_CHOICE"),
            ("q76",6,3,"SINGLE_CHOICE"),("q77",7,6,"MULTIPLE_CHOICE"),("q78",8,6,"MULTIPLE_CHOICE"),
            ("q79",9,3,"FILL_BLANK"),("q80",10,4,"SUBJECTIVE"),
        ],
    }

    total_units = 0
    total_eqs = 0
    for pid, title, desc, subj, grade, score, dur, instr, creator, diff_ratio, show_u, per_u in papers:
        await db.execute(text("""
            INSERT INTO exam_papers (id, title, description, subject, grade_level, status,
                total_score, duration_minutes, instructions, difficulty_ratio,
                show_units, per_unit_timer, created_by, created_at, updated_at)
            VALUES (:id, :title, :desc, :subj, CAST(:grade AS jsonb), 'PUBLISHED',
                :score, :dur, :instr, CAST(:diff AS jsonb),
                :show_u, :per_u, :creator, now(), now())
        """), {"id": pid, "title": title, "desc": desc, "subj": subj, "grade": json.dumps(grade),
               "score": score, "dur": dur, "instr": instr, "diff": json.dumps(diff_ratio),
               "show_u": show_u, "per_u": per_u, "creator": creator})

        # Build units by question type
        qlist = paper_q_map.get(pid, [])
        type_order = ["FILL_BLANK", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "SUBJECTIVE"]
        type_labels = {"FILL_BLANK": "填空题", "SINGLE_CHOICE": "单选题",
                       "MULTIPLE_CHOICE": "多选题", "SUBJECTIVE": "解答题"}
        unit_pos = 0
        for qt in type_order:
            qt_questions = [(qkey, pos, sc) for qkey, pos, sc, qtype in qlist if qtype == qt]
            if not qt_questions:
                continue
            unit_pos += 1
            unit_id = _uid()
            unit_score = sum(sc for _, _, sc in qt_questions)
            qt_cfg = [{"question_type": qt, "count": len(qt_questions),
                       "score_per_question": qt_questions[0][2]}]
            await db.execute(text("""
                INSERT INTO exam_paper_units (id, exam_paper_id, name, position, question_config, total_score, created_at, updated_at)
                VALUES (:id, :pid, :name, :pos, CAST(:cfg AS jsonb), :score, now(), now())
            """), {"id": unit_id, "pid": pid, "name": type_labels[qt], "pos": unit_pos,
                   "cfg": json.dumps(qt_cfg), "score": unit_score})
            total_units += 1

            # Link questions to unit
            for qkey, pos, sc in qt_questions:
                await db.execute(text("""
                    INSERT INTO exam_paper_unit_questions (id, unit_id, question_id, position, score, question_type)
                    VALUES (:id, :uid, :qid, :pos, :sc, :qt)
                """), {"id": _uid(), "uid": unit_id, "qid": Q[qkey], "pos": pos, "sc": sc, "qt": qt})
                total_eqs += 1

    await db.commit()
    print(f"   导入 {len(papers)} 份试卷, {total_units} 个单元, {total_eqs} 道题目\n")


# ── STEP 8: 答题记录 ──────────────────────────────────────────────────────────────
async def step8_submissions(db: AsyncSession):
    print("[8/15] 导入答题记录...")

    # 存储 submission ID 供后续错题本/通知使用
    subs = {}

    submissions_cfg = [
        # (var_name, student_id, paper_id, score, pct, answers: [(qkey, answer, is_correct, score)])
        ("sub_zhang_mid", S_ZHANG_ID, PAPER_MATH_MID_ID, 78, 78, [
            ("q1","A",True,3),("q2","A",True,3),("q3","A",True,3),
            ("q4","A",False,0),("q5","A",True,3),("q6","B",False,0),
            ("q7","D",True,5),("q8","A",False,0),("q9","A",True,3),
            ("q13",json.dumps(["A","B","C","D"]),True,6),
            ("q14",json.dumps(["B","D"]),False,3),("q15",json.dumps(["A","B"]),False,3),
            ("q18","5",True,4),("q19","x>3",True,4),("q20","49",True,6),
            ("q24","x=3,y=1",True,8),("q25","S=12cm²",True,10),
            ("q28","x=2±√5",True,10),
        ]),
        ("sub_li_unit", S_LI_ID, PAPER_MATH_UNIT_ID, 42, 84, [
            ("q1","A",True,3),("q5","A",True,3),("q7","D",True,5),
            ("q9","A",True,3),("q10","C",True,3),("q14",json.dumps(["B","C","D"]),True,6),
            ("q18","5",True,4),("q19","x>2",False,0),("q21","(x-3)²",True,4),
            ("q24","x=3,y=1",True,8),("q30","2x²-5x-3",True,6),
        ]),
        ("sub_wang_chn", S_WANG_ID, PAPER_CHN_MID_ID, 86, 86, [
            ("q31","D",True,2),("q32","C",True,2),("q33","B",True,2),
            ("q34","A",True,2),("q35","D",True,2),("q36","B",True,2),
            ("q37","B",True,2),("q38","B",False,0),("q39","送杜少府之任蜀州",True,3),
            ("q40","鲁迅/朝花夕拾",True,4),("q41","殆",True,3),
            ("q42","野火烧不尽",True,3),("q43","...",True,8),("q44","...",True,6),
            ("q47","...",True,4),("q49","...",True,8),("q45","...",True,16),
        ]),
        ("sub_chen_eng", S_CHEN_ID, PAPER_ENG_FINAL_ID, 95, 79.17, [
            ("q51","A",True,3),("q52","C",False,0),("q53","C",True,3),
            ("q54","D",True,2),("q55","A",True,2),("q56","A",True,3),
            ("q57","B",True,3),("q58","C",True,2),("q59","goes",True,2),
            ("q60","visited",True,2),("q61","They are studying in the library.",True,4),
            ("q62","sad/slow",True,4),("q63","best",True,3),("q64","...",True,4),
            ("q65","...",True,6),("q66","...",True,8),("q67","...",True,5),
            ("q68","...",True,10),("q69","...",True,7),("q70","...",True,6),
        ]),
        ("sub_zhang_unit", S_ZHANG_ID, PAPER_MATH_UNIT_ID, 46, 92, [
            ("q1","A",True,3),("q5","A",True,3),("q7","D",True,5),
            ("q9","A",True,3),("q10","C",True,3),("q14",json.dumps(["B","C","D"]),True,6),
            ("q18","5",True,4),("q19","x>3",True,4),("q21","(x-3)²",True,4),
            ("q24","x=3,y=1",True,8),("q30","2x²-5x-3",False,2),
        ]),
        ("sub_liu_mid", S_LIU_ID, PAPER_MATH_MID_ID, 62, 62, [
            ("q1","A",True,3),("q2","B",False,0),("q3","C",False,0),
            ("q4","A",False,0),("q5","B",False,0),("q6","C",True,3),
            ("q7","B",False,0),("q8","A",False,0),("q9","A",True,3),
            ("q13",json.dumps(["A","B","D"]),False,3),
            ("q14",json.dumps(["B","C","D"]),True,6),
            ("q15",json.dumps(["A","B","D"]),True,6),
            ("q18","5",True,4),("q19","x>3",True,4),("q20","41",False,0),
            ("q24","x=3,y=1",True,8),("q25","S=18cm²",False,3),("q28","x=2±1",False,2),
        ]),
        ("sub_zhao_chn", S_ZHAO_ID, PAPER_CHN_MID_ID, 74, 74, [
            ("q31","D",True,2),("q32","C",True,2),("q33","B",True,2),
            ("q34","A",True,2),("q35","C",False,0),("q36","B",True,2),
            ("q37","B",True,2),("q38","C",True,2),("q39","送杜少府之任蜀州",True,3),
            ("q40","鲁迅/朝花夕拾",True,4),("q41","罔",False,0),("q42","春风吹又生",False,0),
            ("q43","...",True,6),("q44","...",True,5),("q47","...",True,3),("q49","...",True,5),("q45","...",True,14),
        ]),
        ("sub_sun_eng", S_SUN_ID, PAPER_ENG_FINAL_ID, 102, 85, [
            ("q51","A",True,3),("q52","A",True,3),("q53","C",True,3),
            ("q54","D",True,2),("q55","A",True,2),("q56","A",True,3),
            ("q57","A",False,0),("q58","C",True,2),("q59","goes",True,2),
            ("q60","visited",True,2),("q61","They are studying in the library.",True,4),
            ("q62","sad/slow",True,4),("q63","best",True,3),("q64","...",True,4),
            ("q65","...",True,5),("q66","...",True,9),("q67","...",True,6),("q68","...",True,10),
            ("q69","...",True,7),("q70","...",True,6),
        ]),
        ("sub_zhou_phy", S_ZHOU_ID, PAPER_PHY_UNIT_ID, 49, 81.67, [
            ("q71","A",True,3),("q72","B",True,3),("q73","C",True,3),
            ("q74","A",False,0),("q75","C",True,3),("q76","B",True,3),
            ("q77",json.dumps(["A","B","C","D"]),True,6),
            ("q78",json.dumps(["A","B","C","D"]),False,0),
            ("q79","3×10⁸",True,3),("q80","50",False,0),
        ]),
        ("sub_zhang_final", S_ZHANG_ID, PAPER_MATH_FINAL_ID, 85, 70.83, [
            ("q1","A",True,3),("q3","C",False,0),("q4","B",True,3),
            ("q6","C",True,3),("q7","D",True,5),("q10","C",True,3),
            ("q12","C",True,3),("q13",json.dumps(["A","B"]),False,3),
            ("q14",json.dumps(["B","C","D"]),True,6),
            ("q16",json.dumps(["A","B","D"]),True,8),
            ("q17",json.dumps(["A","B","D"]),True,6),
            ("q20","42",False,0),("q22","6",False,0),("q23","4/4",True,4),
            ("q25","12cm²",True,10),("q27","...",True,8),("q28","x=2±√5",True,10),
            ("q29","y1<y2",True,4),("q30","2x²-5x-3",True,6),
        ]),
    ]

    for var_name, sid, pid, tscore, pct, answers in submissions_cfg:
        sub_time = _dt(len(submissions_cfg) - len(subs), hours=2)
        sub_id = _uid()
        subs[var_name] = sub_id
        await db.execute(text("""
            INSERT INTO answer_submissions (id, student_id, exam_paper_id, submission_type,
                status, started_at, submitted_at, graded_at, total_score, percentage,
                meta_data, created_at, updated_at)
            VALUES (:id, :sid, :pid, 'ONLINE', 'GRADED',
                :started, :submitted, :graded, :tscore, :pct, '{}', now(), now())
        """), {"id": sub_id, "sid": sid, "pid": pid,
               "started": sub_time, "submitted": _dt(len(submissions_cfg)-len(subs), hours=0),
               "graded": _dt(len(submissions_cfg)-len(subs), hours=0),
               "tscore": tscore, "pct": pct})

        for qkey, ans, correct, sc in answers:
            await db.execute(text("""
                INSERT INTO answer_details (id, answer_submission_id, question_id,
                    student_answer, is_correct, score_obtained, created_at, updated_at)
                VALUES (:id, :sub_id, :qid, :ans, :correct, :sc, now(), now())
            """), {"id": _uid(), "sub_id": sub_id, "qid": Q[qkey],
                   "ans": ans, "correct": correct, "sc": sc})

        # 评分记录
        await db.execute(text("""
            INSERT INTO grading_records (id, answer_submission_id, model_used, model_version,
                status, started_at, completed_at, total_score, percentage, details, created_at, updated_at)
            VALUES (:id, :sub_id, 'rule-based', 'v1.0', 'COMPLETED', :started, :completed,
                :tscore, :pct, :details, now(), now())
        """), {"id": _uid(), "sub_id": sub_id, "started": _dt(len(submissions_cfg)-len(subs), hours=1),
               "completed": _dt(len(submissions_cfg)-len(subs)),
               "tscore": tscore, "pct": pct, "details": '{"graded_by":"auto"}'})

    await db.commit()
    print(f"   导入 {len(submissions_cfg)} 条答题记录 (含明细+评分)\n")

    # 存一份在全局，供后面 STEP 使用
    db._subs = subs


# ── STEP 9: 错题本 ────────────────────────────────────────────────────────────────
async def step9_notebooks(db: AsyncSession):
    print("[9/15] 导入错题本...")
    subs = getattr(db, "_subs", {})

    notebooks_cfg = [
        # (student_id, title, desc, paper_id, sub_key, days_ago, error_entries)
        (S_ZHANG_ID, "期中数学错题本", "八年级数学期中测试错题整理",
         PAPER_MATH_MID_ID, "sub_zhang_mid", 13, [
             ("q4", "q3", "CONCEPT", "等腰三角形判断需验证三角不等式，建议复习三边关系定理"),
             ("q6", "q11", "CONCEPT", "一次函数图像经过象限的判断方法需加强"),
             ("q8", "q7", "CALCULATION", "涨价降价的基数不同，不能简单抵消"),
             ("q14", "q17", "UNDERSTANDING", "实数分类需明确：无理数+有理数=实数"),
             ("q15", "q21", "MEMORY", "完全平方公式：(a±b)²=a²±2ab+b²"),
         ]),
        (S_ZHANG_ID, "期末数学错题本", "八年级数学期末测试错题整理",
         PAPER_MATH_FINAL_ID, "sub_zhang_final", 7, [
             ("q3", "q10", "CALCULATION", "代数式求值问题需仔细检查"),
             ("q13", "q14", "CONCEPT", "多选几何基本事实辨析需全面理解"),
             ("q20", "q18", "UNDERSTANDING", "完全平方公式条件识别不足"),
             ("q22", "q19", "UNDERSTANDING", "多边形内角和公式：(n-2)×180°"),
         ]),
        (S_LI_ID, "数学单元测错题本", "不等式解法专项",
         PAPER_MATH_UNIT_ID, "sub_li_unit", 11, [
             ("q19", "q18", "CALCULATION", "解不等式移项时注意：除以负数要变号"),
         ]),
        (S_LIU_ID, "期中数学错题本", "八年级数学期中测试",
         PAPER_MATH_MID_ID, "sub_liu_mid", 10, [
             ("q2", "q24", "CALCULATION", "因式分解法解方程：先因式分解再求根"),
             ("q3", "q10", "CALCULATION", "三角形边长条件验证"),
             ("q4", "q25", "CONCEPT", "等腰三角形面积求解步骤：作高→勾股→面积"),
             ("q5", "q18", "CALCULATION", "平方差公式：(a+b)(a-b)=a²-b²"),
             ("q7", "q28", "UNDERSTANDING", "立方根等于自身的数有三个：-1,0,1"),
             ("q8", "q7", "CALCULATION", "利润率计算中基数确认关键"),
         ]),
        (S_ZHOU_ID, "物理光现象错题本", "光的传播与反射",
         PAPER_PHY_UNIT_ID, "sub_zhou_phy", 5, [
             ("q74", "q71", "CONCEPT", "凝华是气态→固态。霜是水蒸气直接凝华"),
             ("q78", "q73", "CONCEPT", "密度是物质特性，与质量体积大小无关"),
             ("q80", "q72", "UNDERSTANDING", "匀速直线运动→合力为0→摩擦力=推力"),
         ]),
    ]

    nb_count = 0
    for sid, title, desc, pid, _sub_key, days_ago, entries in notebooks_cfg:
        nb_id = _uid()
        await db.execute(text("""
            INSERT INTO error_notebooks (id, student_id, title, description, exam_paper_id,
                generated_at, question_count, status, created_at, updated_at)
            VALUES (:id, :sid, :title, :desc, :pid, :gen, :qcnt, 'GENERATED', now(), now())
        """), {"id": nb_id, "sid": sid, "title": title, "desc": desc,
               "pid": pid, "gen": _dt(days_ago), "qcnt": len(entries)})

        for orig_q, prac_q, etype, explanation in entries:
            await db.execute(text("""
                INSERT INTO error_notebook_questions (id, error_notebook_id, original_question_id,
                    practice_question_id, error_type, explanation, created_at)
                VALUES (:id, :nb_id, :orig, :prac, :etype, :expl, now())
            """), {"id": _uid(), "nb_id": nb_id, "orig": Q[orig_q],
                   "prac": Q[prac_q], "etype": etype, "expl": explanation})
        nb_count += 1

    await db.commit()
    print(f"   导入 {nb_count} 本错题本\n")


# ── STEP 10: 自学任务 ─────────────────────────────────────────────────────────────
async def step10_selfstudy(db: AsyncSession):
    print("[10/15] 导入自学任务...")
    tasks = [
        (S_ZHANG_ID, "复习实数与平方根", "针对错题，复习无理数判断与平方根运算",
         "数学", "G8", "COMPLETED", 2, _dt(12), _dt(8)),
        (S_ZHANG_ID, "等腰三角形专项练习", "三角形三边关系定理强化训练",
         "数学", "G8", "IN_PROGRESS", 1, _dt(3), None),
        (S_ZHANG_ID, "一次函数图像专题", "正比例/一次函数图像绘制与性质分析",
         "数学", "G8", "PENDING", 1, _dt(0), None),
        (S_LI_ID, "不等式解法专题", "一元一次不等式及不等式组综合练习",
         "数学", "G8", "PENDING", 1, _dt(1), None),
        (S_WANG_ID, "古诗词背诵计划", "背诵七年级必背古诗词20首",
         "语文", "G7", "IN_PROGRESS", 2, _dt(1), None),
        (S_CHEN_ID, "英语阅读理解训练", "每日精读1篇中考难度阅读题",
         "英语", "G9", "PENDING", 1, _dt(0), None),
        (S_LIU_ID, "因式分解强化", "提公因式法+公式法+十字相乘法专项",
         "数学", "G8", "PENDING", 1, _dt(2), None),
        (S_ZHOU_ID, "光的传播习题", "反射定律+平面镜成像+折射定律练习",
         "物理", "G8", "PENDING", 2, _dt(1), None),
    ]
    for sid, title, desc, subj, grade, status, prio, sched, comp in tasks:
        await db.execute(text("""
            INSERT INTO self_study_tasks (id, student_id, title, description, subject,
                grade_level, status, priority, scheduled_time, completed_time, created_at, updated_at)
            VALUES (:id, :sid, :title, :desc, :subj, :grade, :status, :prio,
                :sched, :comp, now(), now())
        """), {"id": _uid(), "sid": sid, "title": title, "desc": desc,
               "subj": subj, "grade": grade, "status": status, "prio": prio,
               "sched": sched, "comp": comp})
    await db.commit()
    print(f"   导入 {len(tasks)} 条自学任务\n")


# ── STEP 11: 通知 ─────────────────────────────────────────────────────────────────
async def step11_notifications(db: AsyncSession):
    print("[11/15] 导入通知...")
    subs = getattr(db, "_subs", {})
    notifs = [
        ("sub_zhang_mid", S_ZHANG_ID, T_MATH_ID, "GRADING_COMPLETE",
         "期中数学测试已批改", "你的八年级数学期中测试已批改完毕，得分78分，请查看错题本。",
         "IN_APP", "READ", "answer_submission", _dt(14), _dt(13)),
        ("sub_zhang_mid", S_ZHANG_ID, T_MATH_ID, "ERROR_NOTEBOOK_READY",
         "错题本已生成", "期中数学错题本已生成，共5道错题，请认真订正！",
         "IN_APP", "READ", "error_notebook", _dt(13), _dt(13)),
        ("sub_li_unit", S_LI_ID, T_MATH_ID, "GRADING_COMPLETE",
         "单元测试已批改", "数学第一章单元测试已批改，得分42/50(84%)，继续加油！",
         "IN_APP", "SENT", "answer_submission", _dt(11), None),
        ("sub_wang_chn", S_WANG_ID, T_CHINESE_ID, "GRADING_COMPLETE",
         "语文期中测试已批改", "七年级语文期中测试得分86分，表现优秀！",
         "IN_APP", "SENT", "answer_submission", _dt(9), None),
        ("sub_zhang_final", S_ZHANG_ID, T_MATH_ID, "GRADING_COMPLETE",
         "期末数学测试已批改", "八年级数学期末测试得分85分(70.83%)，请查看详情。",
         "IN_APP", "SENT", "answer_submission", _dt(7), None),
        (None, S_ZHANG_ID, T_MATH_ID, "EXAM_REMINDER",
         "明日有数学单元测试", "提醒：明天下午2点将进行实数章节单元测试，请做好复习准备。",
         "IN_APP", "SENT", None, _dt(9), None),
        ("sub_chen_eng", S_CHEN_ID, T_ENG_ID, "GRADING_COMPLETE",
         "英语模拟卷已批改", "九年级英语中考模拟卷已批改，得分95/120。",
         "IN_APP", "SENT", "answer_submission", _dt(5), None),
        ("sub_liu_mid", S_LIU_ID, T_MATH_ID, "GRADING_COMPLETE",
         "期中数学测试已批改", "八年级数学期中测试得分62分，重点复习三角形与方程。",
         "IN_APP", "SENT", "answer_submission", _dt(10), None),
        (None, S_CHEN_ID, T_ENG_ID, "CLASS_ANNOUNCEMENT",
         "中考倒计时提醒", "距离中考还有60天，请同学们合理安排复习时间。",
         "IN_APP", "SENT", None, _dt(5), None),
        ("sub_zhou_phy", S_ZHOU_ID, T_PHY_ID, "GRADING_COMPLETE",
         "物理光现象单元测已批改", "得分49/60，光的反射与折射概念需加强。",
         "IN_APP", "READ", "answer_submission", _dt(5), _dt(4)),
    ]
    for sub_key, rid, sender, ntype, title, content, ch, status, entity_type, sent, read in notifs:
        entity_id = subs.get(sub_key) if sub_key else None
        await db.execute(text("""
            INSERT INTO notifications (id, recipient_id, sender_id, notification_type,
                title, content, channel, status, related_entity_type, related_entity_id,
                sent_at, read_at, created_at, updated_at)
            VALUES (:id, :rid, :sender, :ntype, :title, :content, :ch, :status,
                :etype, :eid, :sent, :read, now(), now())
        """), {"id": _uid(), "rid": rid, "sender": sender, "ntype": ntype,
               "title": title, "content": content, "ch": ch, "status": status,
               "etype": entity_type, "eid": entity_id, "sent": sent, "read": read})
    await db.commit()
    print(f"   导入 {len(notifs)} 条通知\n")


# ── STEP 12: 家长模块 ─────────────────────────────────────────────────────────────
async def step12_parent_module(db: AsyncSession):
    print("[12/15] 导入家长模块数据...")

    # 庆典事件
    celebs = [
        (S_ZHANG_ID, "PAPER_COMPLETED", "完成首次在线答题！",
         "张明完成了八年级数学期中测试，这是他在平台上完成的第一份试卷！", 1, True, True, True, _dt(14)),
        (S_ZHANG_ID, "ACCURACY_IMPROVED", "正确率大幅提升！",
         "张明本次单元测正确率92%，较期中78%提升14个百分点！", 92, True, False, True, _dt(8)),
        (S_LI_ID,   "ACCURACY_IMPROVED", "正确率提升！",
         "李华本次单元测正确率84%，较上次提升显著！", 84, True, False, True, _dt(11)),
        (S_WANG_ID, "PAPER_COMPLETED", "语文优秀！",
         "王芳语文期中测试86分，成绩优秀！", 86, True, True, True, _dt(9)),
        (S_CHEN_ID, "STREAK_MILESTONE", "连续答题7天！",
         "陈强已连续7天完成在线练习，学习习惯养成中！", 7, True, False, False, _dt(5)),
        (S_ZHOU_ID, "PAPER_COMPLETED", "完成首份物理试卷",
         "周杰完成了物理光现象单元测试，迈出物理学习第一步！", 1, False, False, False, _dt(5)),
    ]
    for sid, etype, title, desc, val, notified, ack, enc_sent, created in celebs:
        await db.execute(text("""
            INSERT INTO celebration_events (id, student_id, event_type, title, description,
                metric_value, parent_notified, parent_acknowledged, encouragement_sent, created_at)
            VALUES (:id, :sid, :etype, :title, :desc, :val, :notif, :ack, :enc, :created)
        """), {"id": _uid(), "sid": sid, "etype": etype, "title": title, "desc": desc,
               "val": val, "notif": notified, "ack": ack, "enc": enc_sent, "created": created})

    # 鼓励消息
    encs = [
        (P_ZHANG_ID, S_ZHANG_ID, "CUSTOM", "爸爸为你骄傲",
         "明明，你在平台上完成了第一次在线答题得了78分，爸爸为你感到骄傲！继续努力！",
         None, True, _dt(13)),
        (P_ZHANG_ID, S_ZHANG_ID, "CUSTOM", "进步很大！",
         "这次单元测92分，进步了14分！爸爸看到你的努力了，加油！",
         None, True, _dt(8)),
        (P_LI_ID,   S_LI_ID,    "CUSTOM", "妈妈鼓励你",
         "华华，你数学84分比上次提高了很多，妈妈相信你能做得更好！",
         None, False, _dt(11)),
        (P_WANG_ID, S_WANG_ID,  "CUSTOM", "语文考得不错",
         "芳芳，语文期中86分，继续保持！妈妈为你高兴。",
         None, False, _dt(8)),
        (P_CHEN_ID, S_CHEN_ID,  "CUSTOM", "坚持就是胜利",
         "儿子，你已经连续7天做练习题了，这个习惯很好，再接再厉！",
         None, False, _dt(5)),
    ]
    for pid, sid, etype, title, msg, _tpl_id, is_read, created in encs:
        await db.execute(text("""
            INSERT INTO encouragements (id, parent_id, student_id, encouragement_type,
                title, message, template_id, is_read, read_at, created_at)
            VALUES (:id, :pid, :sid, :etype, :title, :msg, NULL, :read, :read_at, :created)
        """), {"id": _uid(), "pid": pid, "sid": sid, "etype": etype,
               "title": title, "msg": msg, "read": is_read,
               "read_at": _dt(1) if is_read else None, "created": created})

    # 鼓励模板
    await db.execute(text("SELECT COUNT(*) FROM encouragement_templates"))
    tpl_count = (await db.execute(text("SELECT COUNT(*) FROM encouragement_templates"))).scalar()
    if tpl_count == 0:
        templates = [
            ("EFFORT",     "为你的努力点赞",     "{student_name}同学最近学习非常努力，{parent_name}为你感到骄傲！"),
            ("PROGRESS",   "进步就是胜利",       "{student_name}这次取得了明显进步，每一次进步都值得被看见！"),
            ("PERSISTENCE","坚持就是力量",       "日积月累，持之以恒，{student_name}的付出一定会有回报！"),
            ("COMPLETION", "任务完成奖励",       "{student_name}圆满完成了学习任务，太棒了！"),
            ("GENERAL",   "来自父母的鼓励",      "亲爱的{student_name}，爸爸妈妈永远支持你！"),
        ]
        for cat, title, msg in templates:
            await db.execute(text("""
                INSERT INTO encouragement_templates (id, category, title, message_template,
                    is_active, usage_count, created_at)
                VALUES (:id, :cat, :title, :msg, true, 0, now())
            """), {"id": _uid(), "cat": cat, "title": title, "msg": msg})

    # 奖励目标
    goals = [
        (P_ZHANG_ID, S_ZHANG_ID, "连续完成5次练习", "每次练习满足20分钟以上",
         "奖励一本喜欢的课外书", "PRACTICE_SESSIONS", 5, 3, "ACTIVE", _dt(-14)),
        (P_LI_ID,   S_LI_ID,   "完成3份试卷", "独立完成3份在线测试",
         "周末去游乐场玩一天", "PAPERS_COMPLETED", 3, 1, "ACTIVE", _dt(-21)),
        (P_WANG_ID, S_WANG_ID, "语文正确率达到90%", "连续3次测试正确率90%以上",
         "奖励一套精美文具", "ACCURACY_IMPROVEMENT", 90, 86, "ACTIVE", _dt(-30)),
        (P_CHEN_ID, S_CHEN_ID, "坚持打卡14天", "连续14天完成学习任务",
         "奖励一双新球鞋", "STREAK_DAYS", 14, 7, "ACTIVE", _dt(-7)),
    ]
    for pid, sid, title, desc, reward, mtype, target, curr, status, deadline in goals:
        await db.execute(text("""
            INSERT INTO reward_goals (id, parent_id, student_id, title, description,
                reward_description, metric_type, target_value, current_value,
                status, deadline, is_reward_claimed, created_at, updated_at)
            VALUES (:id, :pid, :sid, :title, :desc, :reward, :mtype, :target, :curr,
                :status, :deadline, false, now(), now())
        """), {"id": _uid(), "pid": pid, "sid": sid, "title": title, "desc": desc,
               "reward": reward, "mtype": mtype, "target": target, "curr": curr,
               "status": status, "deadline": deadline})

    await db.commit()
    print(f"   导入庆典/鼓励/奖励目标数据\n")


# ── STEP 13: 讲解板 ───────────────────────────────────────────────────────────────
async def step13_topic_board(db: AsyncSession):
    print("[13/15] 导入讲解板数据...")

    sessions_cfg = [
        {
            "qid": Q["q7"], "title": "趣味讲解：满足'立方根等于本身'的数有哪些？",
            "topic": "实数与方程", "difficulty": "中等偏难",
            "problem": "如果一个数∛x=x，求x的值并写出完整推理过程。",
            "graph": json.dumps({"type":"number_line","range":[-2,2]}),
            "creator": T_MATH_ID,
            "steps": [
                ("idle",       "同学们，先想一想：什么情况下，对一个数开立方后还等于它自己？"),
                ("thinking",   "设这个数为 x，条件是 ∛x = x，也就是 x³ = x。"),
                ("explaining", "移项整理：x³ - x = 0\n提取公因式：x(x² - 1) = 0", "x³ - x = 0\n→ x(x²-1) = 0"),
                ("explaining", "因式分解：x(x+1)(x-1) = 0\n所以 x = -1, 0, 或 1。", "x(x+1)(x-1)=0\nx=-1, 0, 1"),
                ("satisfied",  "验证：∛(-1)=-1✓  ∛0=0✓  ∛1=1✓\n满足条件的数共有 -1、0、1 三个！"),
            ],
        },
        {
            "qid": Q["q25"], "title": "等腰三角形面积求法（勾股定理应用）",
            "topic": "三角形与面积", "difficulty": "中等",
            "problem": "等腰△ABC中，AB=AC=5cm，BC=8cm，求△ABC的面积。",
            "graph": json.dumps({"type":"triangle","vertices":[0,4,5]}),
            "creator": T_MATH_ID,
            "steps": [
                ("idle",       "等腰三角形求面积，关键是找底边上的高。"),
                ("thinking",   "作BC边上的高AD，△ABC是等腰三角形，D是BC中点，BD=4cm。", "BD = BC/2 = 4cm"),
                ("explaining", "直角△ABD中用勾股定理：AD²=AB²-BD²=25-16=9，AD=3cm。", "AD²=5²-4²=9\nAD=3cm"),
                ("satisfied",  "面积S=½×底×高=½×8×3=12cm²。答案是12平方厘米！", "S=½×8×3=12cm²"),
            ],
        },
        {
            "qid": Q["q67"], "title": "英语被动语态变换技巧",
            "topic": "英语语法·被动语态", "difficulty": "中等",
            "problem": "将主动语态改为被动语态：\n1. The teacher corrected the homework.\n2. They built this bridge in 1990.",
            "graph": None,
            "creator": T_ENG_ID,
            "steps": [
                ("idle",       "被动语态结构：be + 过去分词。主动句的宾语变被动句的主语。"),
                ("explaining", "句1：主语→The homework，谓语→was corrected\n结果：The homework was corrected by the teacher.", "was corrected by"),
                ("explaining", "句2：This bridge → 主语；built→ was built\nThis bridge was built (by them) in 1990.", "was built in 1990"),
                ("satisfied",  "口诀：'主宾互换，be+过去分词，时态看原句'！"),
            ],
        },
        {
            "qid": Q["q74"], "title": "物态变化：凝华现象详解",
            "topic": "物理·物态变化", "difficulty": "中等",
            "problem": "区分凝华、液化、凝固和升华四种物态变化，并举例说明。",
            "graph": json.dumps({"type":"state_diagram"}),
            "creator": T_PHY_ID,
            "steps": [
                ("idle",       "物态变化共有6种，今天我们重点区分容易混淆的凝华和液化。"),
                ("thinking",   "先回顾各变化的定义：\n气→液：液化\n气→固：凝华\n液→固：凝固\n固→气：升华"),
                ("explaining", "霜的形成：冬天窗户上的霜是水蒸气直接变成固态冰晶→凝华。\n雾的形成：水蒸气遇冷变成小水珠→液化。"),
                ("satisfied",  "记忆技巧：凝华是'跳级'（气直接变固），液化是'降温'（气变液）。"),
            ],
        },
        {
            "qid": Q["q43"], "title": "朱自清《春》语言赏析",
            "topic": "语文·散文鉴赏", "difficulty": "中等",
            "problem": "赏析《春》中'吹面不寒杨柳风'一句的写作手法。",
            "graph": None,
            "creator": T_CHINESE_ID,
            "steps": [
                ("idle",       "朱自清的散文以语言优美著称，《春》是他的代表作之一。"),
                ("explaining", "'吹面不寒'从触觉写春风的轻柔温暖；'杨柳风'借杨柳枝条的柔软侧面烘托春风的柔和。"),
                ("explaining", "这个句子还化用了南宋志南和尚的诗句'吹面不寒杨柳风'，增加了文化底蕴。"),
                ("satisfied",  "通过触觉描写+借物烘托+古诗句化用，朱自清写出了春风特有的柔和与温暖！"),
            ],
        },
    ]

    for cfg in sessions_cfg:
        sess_id = _uid()
        await db.execute(text("""
            INSERT INTO explanation_sessions (id, question_id, title, topic, difficulty_label,
                problem_statement, graph_config, is_active, created_by, created_at, updated_at)
            VALUES (:id, :qid, :title, :topic, :diff, :problem, :graph, true, :creator, now(), now())
        """), {"id": sess_id, "qid": cfg["qid"], "title": cfg["title"],
               "topic": cfg["topic"], "diff": cfg["difficulty"],
               "problem": cfg["problem"], "graph": cfg["graph"],
               "creator": cfg["creator"]})

        for i, (emotion, step_text, *board) in enumerate(cfg["steps"], 1):
            board_line = board[0] if board else None
            await db.execute(text("""
                INSERT INTO explanation_steps (id, session_id, step_order, text,
                    panda_emotion, board_line, created_at)
                VALUES (:id, :sid, :order, :text, :emotion, :board, now())
            """), {"id": _uid(), "sid": sess_id, "order": i,
                   "text": step_text, "emotion": emotion, "board": board_line})

    await db.commit()
    print(f"   导入 {len(sessions_cfg)} 个讲解板会话\n")


# ── STEP 14: 题目推荐 ─────────────────────────────────────────────────────────────
async def step14_recommendations(db: AsyncSession):
    print("[14/15] 导入题目推荐...")
    recs = [
        (Q["q7"],  S_ZHANG_ID, T_MATH_ID),
        (Q["q14"], S_ZHANG_ID, T_MATH_ID),
        (Q["q25"], S_ZHANG_ID, T_MATH_ID),
        (Q["q15"], S_LI_ID,    T_MATH_ID),
        (Q["q27"], S_LIU_ID,   T_MATH_ID),
        (Q["q34"], S_WANG_ID,  T_CHINESE_ID),
        (Q["q49"], S_WANG_ID,  T_CHINESE_ID),
        (Q["q74"], S_ZHOU_ID,  T_PHY_ID),
    ]
    for qid, sid, recommended_by in recs:
        await db.execute(text("""
            INSERT INTO question_recommendations (id, question_id, student_id, recommended_by, created_at)
            VALUES (:id, :qid, :sid, :by, now())
            ON CONFLICT (question_id, student_id) DO NOTHING
        """), {"id": _uid(), "qid": qid, "sid": sid, "by": recommended_by})
    await db.commit()
    print(f"   导入 {len(recs)} 条题目推荐\n")


# ── STEP 15: LLM 任务 & OCR 记录 ──────────────────────────────────────────────────
async def step15_tasks(db: AsyncSession):
    print("[15/15] 导入LLM任务与OCR记录...")
    qtasks = [
        ("LLM_GENERATE", "COMPLETED", 100, 10, 10,
         json.dumps({"subject":"数学","grade":"G8","count":10}),
         json.dumps({"generated":10,"approved":8,"rejected":2}, ensure_ascii=False),
         "nemotron-3-super:120b", QADMIN_ID, _dt(15)),
        ("LLM_GENERATE", "COMPLETED", 100, 5, 5,
         json.dumps({"subject":"语文","grade":"G7","count":5}),
         json.dumps({"generated":5,"approved":5,"rejected":0}, ensure_ascii=False),
         "nemotron-3-super:120b", QADMIN_ID, _dt(10)),
        ("LLM_GENERATE", "COMPLETED", 100, 8, 8,
         json.dumps({"subject":"英语","grade":"G9","count":8}),
         json.dumps({"generated":8,"approved":6,"rejected":2}, ensure_ascii=False),
         "nemotron-3-super:120b", QADMIN_ID, _dt(7)),
        ("DEDUP", "COMPLETED", 100, 50, 50,
         json.dumps({"threshold":0.85}),
         json.dumps({"duplicates_found":3,"merged":3}, ensure_ascii=False),
         None, QADMIN_ID, _dt(12)),
    ]
    for ttype, status, prog, total, comp, params, results, model, creator, created in qtasks:
        await db.execute(text("""
            INSERT INTO question_tasks (id, task_type, status, progress, total_items,
                completed_items, parameters, result_summary, model_used,
                started_at, completed_at, created_by, created_at)
            VALUES (:id, :type, :status, :prog, :total, :comp,
                :params, :results, :model, :started, :completed, :creator, :created)
        """), {"id": _uid(), "type": ttype, "status": status, "prog": prog,
               "total": total, "comp": comp, "params": params,
               "results": results, "model": model,
               "started": created, "completed": _dt((NOW-created).days, hours=1) if created else NOW,
               "creator": creator, "created": created})

    # OCR 记录
    ocr_rows = [
        (S_ZHANG_ID, PAPER_MATH_MID_ID, "math_answer.jpg", "/uploads/ocr/math_answer.jpg",
         102400, "image/jpeg", "COMPLETED", "paddleocr", 0.92,
         "解答: x=3, y=1", json.dumps({"blocks":2,"confidence":0.92}), _dt(20)),
        (S_LI_ID, PAPER_MATH_UNIT_ID, "unit_test.png", "/uploads/ocr/unit_test.png",
         204800, "image/png", "NEEDS_REVIEW", "tesseract", 0.78,
         "x>2 (不清晰)", json.dumps({"blocks":1,"confidence":0.78}), _dt(18)),
    ]
    for (sid, pid, fname, fpath, fsize, ftype, status, engine, conf,
         text_val, struct, created) in ocr_rows:
        await db.execute(text("""
            INSERT INTO ocr_uploads (id, student_id, exam_paper_id, file_name, file_path,
                file_size, file_type, status, ocr_engine, confidence_score,
                processed_text, structured_data, created_at, updated_at)
            VALUES (:id, :sid, :pid, :fname, :fpath, :fsize, :ftype, :status,
                :engine, :conf, :text, :struct, :created, :created)
        """), {"id": _uid(), "sid": sid, "pid": pid, "fname": fname, "fpath": fpath,
               "fsize": fsize, "ftype": ftype, "status": status, "engine": engine,
               "conf": conf, "text": text_val, "struct": struct, "created": created})
    await db.commit()
    print(f"   导入 {len(qtasks)} 条LLM任务, {len(ocr_rows)} 条OCR记录\n")


# ── 汇总 ──────────────────────────────────────────────────────────────────────────
def summary():
    print("=" * 64)
    print("   V3.5 演示数据导入完成！")
    print("=" * 64)
    print("""
┌─────────────────────────────────────────────────────────────┐
│                      演示账号速查表                          │
├──────────┬──────────────────┬────────────────┬──────────────┤
│ 角色     │ 用户名           │ 密码           │ 姓名         │
├──────────┼──────────────────┼────────────────┼──────────────┤
│ 系统管理 │ SYSAdmin         │ SYSPass        │ 系统管理员   │
│ 数学教师 │ t_math           │ Demo1234       │ 王数学       │
│ 语文教师 │ t_chinese        │ Demo1234       │ 李语文       │
│ 英语教师 │ t_english        │ Demo1234       │ 张英语       │
│ 物理教师 │ t_physics        │ Demo1234       │ 赵物理       │
│ 题库管理 │ tk_qian          │ Demo1234       │ 钱题库       │
│ 学生     │ zhang_ming       │ Demo1234       │ 张明(G8)     │
│ 学生     │ li_hua           │ Demo1234       │ 李华(G8)     │
│ 学生     │ wang_fang        │ Demo1234       │ 王芳(G7)     │
│ 学生     │ chen_qiang       │ Demo1234       │ 陈强(G9)     │
│ 学生     │ liu_li           │ Demo1234       │ 刘丽(G8)     │
│ 学生     │ zhao_gang        │ Demo1234       │ 赵刚(G7)     │
│ 学生     │ sun_yue          │ Demo1234       │ 孙悦(G9)     │
│ 学生     │ zhou_jie         │ Demo1234       │ 周杰(G8)     │
│ 家长     │ p_zhang_fu       │ Demo1234       │ 张国华       │
│ 家长     │ p_li_mu          │ Demo1234       │ 陈晓燕       │
│ 家长     │ p_wang_mu        │ Demo1234       │ 刘淑芳       │
│ 家长     │ p_chen_fu        │ Demo1234       │ 陈建国       │
└──────────┴──────────────────┴────────────────┴──────────────┘

数据统计
─────────────────────────────────────────────────────────────
  参考数据表:  7 类 (题型/难度/年级/状态/错因/来源/省份)
  科目:        6 科 (数学/语文/英语/物理/化学/生物)
  班级:        5 个 (数学提高班/语文基础班/英语冲刺班/物理启蒙班/数学基础班)
  课纲:        4 份 (含 20+ 知识点节点)
  试题:        80 道 (数学30/语文20/英语20/物理10)
               ├ 单选题 35 道
               ├ 多选题 10 道
               ├ 填空题 15 道
               └ 解答题 20 道
  试卷:        6 份 (含期中/期末/单元测/模拟卷)
  答题记录:    12 条 (含答题明细 + 评分记录)
  错题本:      5 本 (含错题条目 + 推荐练习题)
  自学任务:    8 条 (已完成/进行中/待开始)
  通知:        10 条 (含已读/未读)
  家长模块:    鼓励消息+庆典事件+奖励目标
  讲解板:      5 个会话 (含分步动画步骤)
  题目推荐:    8 条
  LLM任务:     4 条 + OCR记录 2 条
─────────────────────────────────────────────────────────────

访问地址
─────────────────────────────────────────────────────────────
  学生端:  http://localhost:3000/login
  管理端:  http://localhost:3000/admin/login
  家长端:  http://localhost:3000/parent/login
  API文档: http://localhost:8000/docs
─────────────────────────────────────────────────────────────
""")


if __name__ == "__main__":
    asyncio.run(run())
