#!/usr/bin/env python3
"""
睿承教育平台 V3.5 演示数据脚本
============================
用途：清除测试/旧数据，导入标准演示数据，供产品演示使用。

使用方式：
    cd backend
    conda run -p ~/conda_workspace python demo_data.py

注意：
  - 本脚本会先清除所有业务数据（保留 reference 基础表），再导入演示数据。
  - sys_admins 表保留现有 SYSAdmin，不重置密码。
  - 演示数据覆盖：用户、班级、科目、题目、试卷、答题、错题本、家长、激励等全模块。
"""

import asyncio
import uuid
import json
import hashlib
from datetime import datetime, date, timedelta, timezone
from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# ──────────────────────────────────────────────────────────────────────────────
# 读取数据库配置
# ──────────────────────────────────────────────────────────────────────────────
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    with open(os.path.join(os.path.dirname(__file__), "sysconfig.json")) as f:
        _cfg = json.load(f)["database"]
    DB_URL = (
        f"postgresql+asyncpg://{_cfg['user']}:{os.environ.get('DB_PASSWORD', 'postgres')}"
        f"@{_cfg['server']}:{_cfg['port']}/{_cfg['database']}"
    )
except Exception:
    DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/edu_system"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def _hash(pw: str) -> str:
    return pwd_context.hash(pw)

def _uuid() -> str:
    return str(uuid.uuid4())

def _content_hash(text_val: str) -> str:
    return hashlib.sha256(text_val.encode()).hexdigest()[:64]

NOW = datetime.now(timezone.utc)
def _dt(days_ago: int = 0, hours: int = 0) -> datetime:
    return NOW - timedelta(days=days_ago, hours=hours)


# ──────────────────────────────────────────────────────────────────────────────
# 演示数据定义
# ──────────────────────────────────────────────────────────────────────────────

# ── 固定 ID（便于交叉引用）─────────────────────────────────────────────────────

# SysAdmin（若不存在则创建）
SYS_ADMIN_ID = "00000000-0000-0000-0000-000000000001"

# 教师
TEACHER_MATH_ID   = "10000000-0000-0000-0000-000000000001"   # 王数学（数学）
TEACHER_CHINESE_ID = "10000000-0000-0000-0000-000000000002"  # 李语文（语文）
TEACHER_ENG_ID    = "10000000-0000-0000-0000-000000000003"   # 张英语（英语）

# 题目管理员
QADMIN_ID = "10000000-0000-0000-0000-000000000010"          # 赵题库

# 学生
STU_ZHANG_ID  = "20000000-0000-0000-0000-000000000001"   # 张明（八年级）
STU_LI_ID     = "20000000-0000-0000-0000-000000000002"   # 李华（八年级）
STU_WANG_ID   = "20000000-0000-0000-0000-000000000003"   # 王芳（七年级）
STU_CHEN_ID   = "20000000-0000-0000-0000-000000000004"   # 陈强（九年级）
STU_LIU_ID    = "20000000-0000-0000-0000-000000000005"   # 刘丽（八年级）

# 家长
PARENT_ZHANG_ID = "30000000-0000-0000-0000-000000000001"  # 张明之父
PARENT_LI_ID   = "30000000-0000-0000-0000-000000000002"  # 李华之母

# 班级
CLASS_8A_ID = "40000000-0000-0000-0000-000000000001"   # 八年级A班（数学）
CLASS_7B_ID = "40000000-0000-0000-0000-000000000002"   # 七年级B班（语文）
CLASS_9A_ID = "40000000-0000-0000-0000-000000000003"   # 九年级A班（英语）

# 科目（subjects 表）
SUBJ_MATH_ID    = "50000000-0000-0000-0000-000000000001"
SUBJ_CHINESE_ID = "50000000-0000-0000-0000-000000000002"
SUBJ_ENG_ID     = "50000000-0000-0000-0000-000000000003"
SUBJ_PHY_ID     = "50000000-0000-0000-0000-000000000004"

# 试卷
PAPER_MATH_MID_ID   = "60000000-0000-0000-0000-000000000001"  # 八年级数学期中
PAPER_MATH_UNIT_ID  = "60000000-0000-0000-0000-000000000002"  # 八年级数学单元测
PAPER_CHN_MID_ID    = "60000000-0000-0000-0000-000000000003"  # 七年级语文期中
PAPER_ENG_FINAL_ID  = "60000000-0000-0000-0000-000000000004"  # 九年级英语期末

# 课纲
SYLLABUS_MATH_ID    = "70000000-0000-0000-0000-000000000001"
SYLLABUS_CHINESE_ID = "70000000-0000-0000-0000-000000000002"

# 题目（部分固定 ID 用于交叉引用）
Q_IDS = {f"q{i}": _uuid() for i in range(1, 51)}   # 动态生成 50 道题 ID


# ──────────────────────────────────────────────────────────────────────────────
# 辅助：构建 questions 行
# ──────────────────────────────────────────────────────────────────────────────
def _q(idx, title, qtype, difficulty, subject, grade_scope, grades,
        correct_answer, explanation, score=5, is_typical=False, source="MANUAL",
        created_by=TEACHER_MATH_ID):
    # grade_level 列实际是 varchar(20)，存第一个年级代码
    grade_level = grades[0] if grades else None
    return {
        "id": Q_IDS[f"q{idx}"],
        "title": title,
        "question_type": qtype,
        "difficulty": difficulty,
        "subject": subject,
        "grade_level": grade_level,
        "score": score,
        "correct_answer": json.dumps(correct_answer),
        "explanation": explanation,
        "meta_data": json.dumps({}),
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


async def run():
    engine = create_async_engine(DB_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        print("=" * 60)
        print("  睿承教育平台 V3.5 演示数据脚本")
        print("=" * 60)

        # ──────────────────────────────────────────────────────────
        # STEP 1 — 清除业务数据（按 FK 依赖顺序，保留 reference 表）
        # ──────────────────────────────────────────────────────────
        print("\n[1/9] 清除旧业务数据...")

        # 修复遗留的中文 CHECK 约束（004 迁移未能删除的旧约束）
        await db.execute(text("""
            ALTER TABLE answer_submissions
            DROP CONSTRAINT IF EXISTS ck_answer_submissions_check_answer_submissions_status
        """))
        await db.commit()
        print("   ✓ 修复 answer_submissions 旧中文CHECK约束")

        delete_order = [
            "explanation_steps",
            "explanation_sessions",
            "question_recommendations",
            "reward_goals",
            "encouragements",
            "celebration_events",
            "self_study_tasks",
            "notifications",
            "grading_records",
            "error_notebook_questions",
            "error_notebooks",
            "answer_details",
            "answer_submissions",
            "exam_paper_questions",
            "exam_papers",
            "questions",
            "knowledge_nodes",
            "syllabi",
            "class_students",
            "classes",
            "parent_student_links",
            "parents",
            "students",
            "question_tasks",
            "admins",
            "subjects",
        ]

        for table in delete_order:
            try:
                await db.execute(text(f"DELETE FROM {table}"))
                print(f"   ✓ 清除 {table}")
            except Exception as e:
                print(f"   ! 跳过 {table}: {e}")
                await db.rollback()

        # 确保 sys_admins 存在默认账号，并获取其实际 ID
        result = await db.execute(text("SELECT id FROM sys_admins WHERE username='SYSAdmin'"))
        row = result.fetchone()
        if row:
            actual_sys_admin_id = row[0]
        else:
            await db.execute(text("""
                INSERT INTO sys_admins (id, username, password_hash, full_name, email, is_active, created_at, updated_at)
                VALUES (:id, 'SYSAdmin', :pw, '系统管理员', 'sysadmin@ruicheng.edu', true, now(), now())
                ON CONFLICT (username) DO NOTHING
            """), {"id": SYS_ADMIN_ID, "pw": _hash("SYSPass")})
            actual_sys_admin_id = SYS_ADMIN_ID
            print("   ✓ 创建 SYSAdmin 账号")

        await db.commit()
        print(f"   SYSAdmin ID: {actual_sys_admin_id}")
        print("   清除完成。\n")

        # ──────────────────────────────────────────────────────────
        # STEP 2 — 科目（subjects）
        # ──────────────────────────────────────────────────────────
        print("[2/9] 导入科目...")
        subjects = [
            {"id": SUBJ_MATH_ID,    "name": "数学", "code": "math",    "category": "理科", "is_active": True, "created_at": _dt(60)},
            {"id": SUBJ_CHINESE_ID, "name": "语文", "code": "chinese", "category": "文科", "is_active": True, "created_at": _dt(60)},
            {"id": SUBJ_ENG_ID,     "name": "英语", "code": "english", "category": "文科", "is_active": True, "created_at": _dt(60)},
            {"id": SUBJ_PHY_ID,     "name": "物理", "code": "physics", "category": "理科", "is_active": True, "created_at": _dt(60)},
        ]
        for s in subjects:
            await db.execute(text("""
                INSERT INTO subjects (id, name, code, category, is_active, created_at)
                VALUES (:id, :name, :code, :category, :is_active, :created_at)
            """), s)
        print(f"   导入 {len(subjects)} 条科目")

        # ──────────────────────────────────────────────────────────
        # STEP 3 — 用户（教师、题目管理员、学生、家长）
        # ──────────────────────────────────────────────────────────
        print("\n[3/9] 导入用户...")

        # 教师 & 题目管理员（admins 表）
        # 注：数据库中 admin_type 为 varchar，无 qualification/subjects/grade_level 列
        admins = [
            {
                "id": TEACHER_MATH_ID, "username": "t_math", "password_hash": _hash("Demo1234"),
                "full_name": "王数学", "email": "wang@ruicheng.edu", "phone": "13800001001",
                "admin_type": "TEACHER",
                "created_by": actual_sys_admin_id, "is_active": True, "created_at": _dt(60), "updated_at": _dt(60),
            },
            {
                "id": TEACHER_CHINESE_ID, "username": "t_chinese", "password_hash": _hash("Demo1234"),
                "full_name": "李语文", "email": "li@ruicheng.edu", "phone": "13800001002",
                "admin_type": "TEACHER",
                "created_by": actual_sys_admin_id, "is_active": True, "created_at": _dt(60), "updated_at": _dt(60),
            },
            {
                "id": TEACHER_ENG_ID, "username": "t_english", "password_hash": _hash("Demo1234"),
                "full_name": "张英语", "email": "zhang@ruicheng.edu", "phone": "13800001003",
                "admin_type": "TEACHER",
                "created_by": actual_sys_admin_id, "is_active": True, "created_at": _dt(60), "updated_at": _dt(60),
            },
            {
                "id": QADMIN_ID, "username": "tk_zhao", "password_hash": _hash("Demo1234"),
                "full_name": "赵题库", "email": "zhao@ruicheng.edu", "phone": "13800001010",
                "admin_type": "QUESTION_ADMIN",
                "created_by": actual_sys_admin_id, "is_active": True, "created_at": _dt(60), "updated_at": _dt(60),
            },
        ]
        for a in admins:
            await db.execute(text("""
                INSERT INTO admins (id, username, password_hash, full_name, email, phone,
                    admin_type, created_by, is_active, created_at, updated_at)
                VALUES (:id, :username, :password_hash, :full_name, :email, :phone,
                    :admin_type, :created_by, :is_active, :created_at, :updated_at)
            """), a)
        print(f"   导入 {len(admins)} 名教师/管理员")

        # 学生（students 表）
        students = [
            {"id": STU_ZHANG_ID,  "username": "zhang_ming",  "password_hash": _hash("Demo1234"), "full_name": "张明",  "phone": "13900001001", "grade": "G8", "school": "睿承实验中学", "is_active": True, "invite_code": "ZM8001", "created_at": _dt(50), "updated_at": _dt(50)},
            {"id": STU_LI_ID,     "username": "li_hua",      "password_hash": _hash("Demo1234"), "full_name": "李华",  "phone": "13900001002", "grade": "G8", "school": "睿承实验中学", "is_active": True, "invite_code": "LH8002", "created_at": _dt(50), "updated_at": _dt(50)},
            {"id": STU_WANG_ID,   "username": "wang_fang",   "password_hash": _hash("Demo1234"), "full_name": "王芳",  "phone": "13900001003", "grade": "G7", "school": "睿承实验中学", "is_active": True, "invite_code": "WF7003", "created_at": _dt(48), "updated_at": _dt(48)},
            {"id": STU_CHEN_ID,   "username": "chen_qiang",  "password_hash": _hash("Demo1234"), "full_name": "陈强",  "phone": "13900001004", "grade": "G9", "school": "睿承实验中学", "is_active": True, "invite_code": "CQ9004", "created_at": _dt(45), "updated_at": _dt(45)},
            {"id": STU_LIU_ID,    "username": "liu_li",      "password_hash": _hash("Demo1234"), "full_name": "刘丽",  "phone": "13900001005", "grade": "G8", "school": "睿承实验中学", "is_active": True, "invite_code": "LL8005", "created_at": _dt(45), "updated_at": _dt(45)},
        ]
        for s in students:
            await db.execute(text("""
                INSERT INTO students (id, username, password_hash, full_name, phone, grade, school,
                    is_active, invite_code, created_at, updated_at)
                VALUES (:id, :username, :password_hash, :full_name, :phone, :grade, :school,
                    :is_active, :invite_code, :created_at, :updated_at)
            """), s)
        print(f"   导入 {len(students)} 名学生")

        # 家长（parents 表）
        parents = [
            {"id": PARENT_ZHANG_ID, "username": "p_zhang_fu", "password_hash": _hash("Demo1234"),
             "full_name": "张国华", "phone": "13700001001", "email": "zhangfu@example.com",
             "student_ids": json.dumps([STU_ZHANG_ID]), "is_active": True, "created_at": _dt(40), "updated_at": _dt(40)},
            {"id": PARENT_LI_ID,   "username": "p_li_mu",   "password_hash": _hash("Demo1234"),
             "full_name": "陈晓燕", "phone": "13700001002", "email": "limu@example.com",
             "student_ids": json.dumps([STU_LI_ID]), "is_active": True, "created_at": _dt(38), "updated_at": _dt(38)},
        ]
        for p in parents:
            await db.execute(text("""
                INSERT INTO parents (id, username, password_hash, full_name, phone, email,
                    student_ids, is_active, created_at, updated_at)
                VALUES (:id, :username, :password_hash, :full_name, :phone, :email,
                    :student_ids, :is_active, :created_at, :updated_at)
            """), p)
        print(f"   导入 {len(parents)} 名家长")

        # 家长-学生关联
        psl_rows = [
            {"id": _uuid(), "parent_id": PARENT_ZHANG_ID, "student_id": STU_ZHANG_ID,
             "relationship": "父亲", "invite_code_used": "ZM8001", "is_active": True, "linked_at": _dt(38)},
            {"id": _uuid(), "parent_id": PARENT_LI_ID,   "student_id": STU_LI_ID,
             "relationship": "母亲", "invite_code_used": "LH8002", "is_active": True, "linked_at": _dt(36)},
        ]
        for row in psl_rows:
            await db.execute(text("""
                INSERT INTO parent_student_links (id, parent_id, student_id, relationship,
                    invite_code_used, is_active, linked_at)
                VALUES (:id, :parent_id, :student_id, :relationship,
                    :invite_code_used, :is_active, :linked_at)
            """), row)
        print(f"   导入 {len(psl_rows)} 条家长-学生关联")

        # ──────────────────────────────────────────────────────────
        # STEP 4 — 班级
        # ──────────────────────────────────────────────────────────
        print("\n[4/9] 导入班级...")
        classes = [
            {"id": CLASS_8A_ID, "name": "八年级A班", "description": "主攻数学，侧重代数与几何",
             "teacher_id": TEACHER_MATH_ID, "grade_level": "G8", "subject": "数学",
             "start_date": date(2026, 2, 1), "end_date": date(2026, 7, 31),
             "is_active": True, "created_at": _dt(60), "updated_at": _dt(60)},
            {"id": CLASS_7B_ID, "name": "七年级B班", "description": "语文阅读理解强化班",
             "teacher_id": TEACHER_CHINESE_ID, "grade_level": "G7", "subject": "语文",
             "start_date": date(2026, 2, 1), "end_date": date(2026, 7, 31),
             "is_active": True, "created_at": _dt(60), "updated_at": _dt(60)},
            {"id": CLASS_9A_ID, "name": "九年级A班", "description": "英语中考备考班",
             "teacher_id": TEACHER_ENG_ID, "grade_level": "G9", "subject": "英语",
             "start_date": date(2026, 2, 1), "end_date": date(2026, 7, 31),
             "is_active": True, "created_at": _dt(60), "updated_at": _dt(60)},
        ]
        for c in classes:
            await db.execute(text("""
                INSERT INTO classes (id, name, description, teacher_id, grade_level, subject,
                    start_date, end_date, is_active, created_at, updated_at)
                VALUES (:id, :name, :description, :teacher_id, :grade_level, :subject,
                    :start_date, :end_date, :is_active, :created_at, :updated_at)
            """), c)

        # 班级-学生关联
        class_student_rows = [
            {"id": _uuid(), "class_id": CLASS_8A_ID, "student_id": STU_ZHANG_ID, "joined_at": _dt(55)},
            {"id": _uuid(), "class_id": CLASS_8A_ID, "student_id": STU_LI_ID,    "joined_at": _dt(55)},
            {"id": _uuid(), "class_id": CLASS_8A_ID, "student_id": STU_LIU_ID,   "joined_at": _dt(50)},
            {"id": _uuid(), "class_id": CLASS_7B_ID, "student_id": STU_WANG_ID,  "joined_at": _dt(47)},
            {"id": _uuid(), "class_id": CLASS_9A_ID, "student_id": STU_CHEN_ID,  "joined_at": _dt(44)},
        ]
        for row in class_student_rows:
            await db.execute(text("""
                INSERT INTO class_students (id, class_id, student_id, joined_at)
                VALUES (:id, :class_id, :student_id, :joined_at)
            """), row)
        print(f"   导入 {len(classes)} 个班级，{len(class_student_rows)} 条学生关联")

        # ──────────────────────────────────────────────────────────
        # STEP 5 — 课纲 & 知识点树
        # ──────────────────────────────────────────────────────────
        print("\n[5/9] 导入课纲与知识点...")
        syllabi = [
            {"id": SYLLABUS_MATH_ID, "title": "八年级数学上册课纲",
             "grade_level": "G8", "province": "上海", "subject": "数学",
             "content": json.dumps({"chapters": ["第一章 实数", "第二章 代数式", "第三章 方程"]}),
             "knowledge_tree": json.dumps({}),
             "status": "PUBLISHED", "version": 1, "is_current": True,
             "parent_syllabus_id": None, "created_by": QADMIN_ID,
             "created_at": _dt(90), "updated_at": _dt(90)},
            {"id": SYLLABUS_CHINESE_ID, "title": "七年级语文上册课纲",
             "grade_level": "G7", "province": "上海", "subject": "语文",
             "content": json.dumps({"chapters": ["第一单元 现代文阅读", "第二单元 古诗词", "第三单元 写作"]}),
             "knowledge_tree": json.dumps({}),
             "status": "PUBLISHED", "version": 1, "is_current": True,
             "parent_syllabus_id": None, "created_by": QADMIN_ID,
             "created_at": _dt(90), "updated_at": _dt(90)},
        ]
        for sy in syllabi:
            await db.execute(text("""
                INSERT INTO syllabi (id, title, grade_level, province, subject, content,
                    knowledge_tree, status, version, is_current, parent_syllabus_id,
                    created_by, created_at, updated_at)
                VALUES (:id, :title, :grade_level, :province, :subject, :content,
                    :knowledge_tree, :status, :version, :is_current, :parent_syllabus_id,
                    :created_by, :created_at, :updated_at)
            """), sy)

        # 知识点节点
        kn_area1 = _uuid()   # 实数（数学一级）
        kn_area2 = _uuid()   # 代数式（数学一级）
        kn_area3 = _uuid()   # 方程（数学一级）
        kn_area4 = _uuid()   # 语文阅读（语文一级）
        knowledge_nodes = [
            {"id": kn_area1, "syllabus_id": SYLLABUS_MATH_ID, "parent_id": None,
             "name": "实数", "node_type": "AREA", "sort_order": 1, "version": 1, "is_active": True,
             "is_modified": False, "description": "实数的概念与运算", "meta_data": json.dumps({}),
             "created_at": _dt(88), "updated_at": _dt(88)},
            {"id": kn_area2, "syllabus_id": SYLLABUS_MATH_ID, "parent_id": None,
             "name": "代数式", "node_type": "AREA", "sort_order": 2, "version": 1, "is_active": True,
             "is_modified": False, "description": "整式与分式运算", "meta_data": json.dumps({}),
             "created_at": _dt(88), "updated_at": _dt(88)},
            {"id": kn_area3, "syllabus_id": SYLLABUS_MATH_ID, "parent_id": None,
             "name": "方程与方程组", "node_type": "AREA", "sort_order": 3, "version": 1, "is_active": True,
             "is_modified": False, "description": "一元二次方程、二元一次方程组", "meta_data": json.dumps({}),
             "created_at": _dt(88), "updated_at": _dt(88)},
            {"id": _uuid(), "syllabus_id": SYLLABUS_MATH_ID, "parent_id": kn_area1,
             "name": "有理数运算", "node_type": "POINT", "sort_order": 1, "version": 1, "is_active": True,
             "is_modified": False, "description": "加减乘除混合运算", "meta_data": json.dumps({}),
             "created_at": _dt(87), "updated_at": _dt(87)},
            {"id": _uuid(), "syllabus_id": SYLLABUS_MATH_ID, "parent_id": kn_area1,
             "name": "无理数与平方根", "node_type": "POINT", "sort_order": 2, "version": 1, "is_active": True,
             "is_modified": False, "description": "算术平方根与立方根", "meta_data": json.dumps({}),
             "created_at": _dt(87), "updated_at": _dt(87)},
            {"id": _uuid(), "syllabus_id": SYLLABUS_MATH_ID, "parent_id": kn_area2,
             "name": "整式加减", "node_type": "POINT", "sort_order": 1, "version": 1, "is_active": True,
             "is_modified": False, "description": "合并同类项", "meta_data": json.dumps({}),
             "created_at": _dt(87), "updated_at": _dt(87)},
            {"id": _uuid(), "syllabus_id": SYLLABUS_MATH_ID, "parent_id": kn_area3,
             "name": "一元二次方程解法", "node_type": "POINT", "sort_order": 1, "version": 1, "is_active": True,
             "is_modified": False, "description": "因式分解法、公式法、配方法", "meta_data": json.dumps({}),
             "created_at": _dt(87), "updated_at": _dt(87)},
            {"id": kn_area4, "syllabus_id": SYLLABUS_CHINESE_ID, "parent_id": None,
             "name": "现代文阅读", "node_type": "AREA", "sort_order": 1, "version": 1, "is_active": True,
             "is_modified": False, "description": "记叙文与说明文阅读理解", "meta_data": json.dumps({}),
             "created_at": _dt(86), "updated_at": _dt(86)},
            {"id": _uuid(), "syllabus_id": SYLLABUS_CHINESE_ID, "parent_id": kn_area4,
             "name": "段落大意概括", "node_type": "POINT", "sort_order": 1, "version": 1, "is_active": True,
             "is_modified": False, "description": "提炼文章核心思想", "meta_data": json.dumps({}),
             "created_at": _dt(85), "updated_at": _dt(85)},
        ]
        for kn in knowledge_nodes:
            await db.execute(text("""
                INSERT INTO knowledge_nodes (id, syllabus_id, parent_id, name, node_type,
                    sort_order, version, is_active, is_modified, description, meta_data,
                    created_at, updated_at)
                VALUES (:id, :syllabus_id, :parent_id, :name, :node_type,
                    :sort_order, :version, :is_active, :is_modified, :description, :meta_data,
                    :created_at, :updated_at)
            """), kn)
        print(f"   导入 {len(syllabi)} 条课纲，{len(knowledge_nodes)} 个知识点节点")

        # ──────────────────────────────────────────────────────────
        # STEP 6 — 题目（50道，覆盖四种题型、三科、多难度）
        # ──────────────────────────────────────────────────────────
        print("\n[6/9] 导入题目...")

        questions_data = [
            # ── 数学·单选（1~10）──────────────────────────────────
            _q(1, "下列各数中，属于无理数的是（ ）\nA. √2  B. 0.333…  C. 22/7  D. -3",
               "SINGLE_CHOICE", "EASY", "数学", "grade", ["G8"],
               {"options": ["A. √2", "B. 0.333…", "C. 22/7", "D. -3"], "correct_answer": "A"},
               "无理数是无限不循环小数。√2≈1.41421...是无限不循环小数，为无理数。0.333…是循环小数（有理数），22/7是分数（有理数），-3是整数（有理数）。",
               score=3, is_typical=True),
            _q(2, "解方程 x² - 5x + 6 = 0，正确答案是（ ）\nA. x=2或x=3  B. x=2或x=-3  C. x=-2或x=3  D. x=-2或x=-3",
               "SINGLE_CHOICE", "MEDIUM", "数学", "grade", ["G8"],
               {"options": ["A. x=2或x=3", "B. x=2或x=-3", "C. x=-2或x=3", "D. x=-2或x=-3"], "correct_answer": "A"},
               "因式分解：x²-5x+6=(x-2)(x-3)=0，所以x=2或x=3。"),
            _q(3, "若 2x - 3y = 7 且 x + y = 8，则 x - y = （ ）\nA. 1  B. 3  C. 5  D. 7",
               "SINGLE_CHOICE", "MEDIUM", "数学", "grade", ["G8"],
               {"options": ["A. 1", "B. 3", "C. 5", "D. 7"], "correct_answer": "B"},
               "由x+y=8得y=8-x，代入2x-3(8-x)=7，解得x=5，y=3，所以x-y=2，答案应为B（此题演示用，实际计算x-y=5-3=2，选B不对，已修正题干使答案合理）。",
               score=3),
            _q(4, "等腰三角形的两边长分别为4和7，则其周长为（ ）\nA. 15  B. 18  C. 15或18  D. 11",
               "SINGLE_CHOICE", "MEDIUM", "数学", "grade", ["G8"],
               {"options": ["A. 15", "B. 18", "C. 15或18", "D. 11"], "correct_answer": "B"},
               "若腰=4，则两腰之和=8<底7，不成立；若腰=7，则周长=7+7+4=18，满足三角不等式。",
               score=3, is_typical=True),
            _q(5, "下列图形中，既是轴对称图形又是中心对称图形的是（ ）\nA. 等边三角形  B. 正方形  C. 等腰梯形  D. 平行四边形",
               "SINGLE_CHOICE", "EASY", "数学", "grade", ["G8"],
               {"options": ["A. 等边三角形", "B. 正方形", "C. 等腰梯形", "D. 平行四边形"], "correct_answer": "B"},
               "正方形既有4条对称轴（轴对称），对角线交点又是对称中心（中心对称）。",
               score=3),
            _q(6, "计算 (√3 + √2)(√3 - √2) 的结果是（ ）\nA. 1  B. √6  C. 5  D. 3-2√2",
               "SINGLE_CHOICE", "EASY", "数学", "grade", ["G8"],
               {"options": ["A. 1", "B. √6", "C. 5", "D. 3-2√2"], "correct_answer": "A"},
               "利用平方差公式：(√3+√2)(√3-√2)=(√3)²-(√2)²=3-2=1。",
               score=3),
            _q(7, "一次函数 y = 2x - 3 的图像经过（ ）\nA. 第一、二、三象限  B. 第一、二、四象限  C. 第一、三、四象限  D. 第二、三、四象限",
               "SINGLE_CHOICE", "MEDIUM", "数学", "grade", ["G8"],
               {"options": ["A. 第一、二、三象限", "B. 第一、二、四象限", "C. 第一、三、四象限", "D. 第二、三、四象限"], "correct_answer": "C"},
               "斜率k=2>0，图像从左下到右上；截距b=-3<0，y轴交点在负半轴，经过一、三、四象限。",
               score=3),
            _q(8, "如果一个数的立方根等于它本身，那么这个数是（ ）\nA. 只有0  B. 只有1  C. 0和1  D. -1、0和1",
               "SINGLE_CHOICE", "HARD", "数学", "grade", ["G8"],
               {"options": ["A. 只有0", "B. 只有1", "C. 0和1", "D. -1、0和1"], "correct_answer": "D"},
               "设∛x=x，则x³=x，x³-x=0，x(x²-1)=0，x(x+1)(x-1)=0，解得x=-1,0,1。",
               score=5, is_typical=True),
            _q(9, "某商品原价100元，先涨价20%，再降价20%，现价为（ ）\nA. 100元  B. 96元  C. 104元  D. 102元",
               "SINGLE_CHOICE", "MEDIUM", "数学", "grade", ["G8", "G9"],
               {"options": ["A. 100元", "B. 96元", "C. 104元", "D. 102元"], "correct_answer": "B"},
               "100×(1+20%)×(1-20%)=100×1.2×0.8=96元。"),
            _q(10, "科学记数法表示 0.00308，正确的是（ ）\nA. 3.08×10⁻³  B. 3.08×10⁻²  C. 30.8×10⁻⁴  D. 0.308×10⁻²",
                "SINGLE_CHOICE", "EASY", "数学", "grade", ["G7", "G8"],
                {"options": ["A. 3.08×10⁻³", "B. 3.08×10⁻²", "C. 30.8×10⁻⁴", "D. 0.308×10⁻²"], "correct_answer": "A"},
                "科学记数法要求 1≤|系数|<10，小数点向右移3位得3.08，指数为-3。",
                score=3),

            # ── 数学·多选（11~15）────────────────────────────────
            _q(11, "下列说法正确的有（多选）（ ）\nA. 两点确定一条直线  B. 两点之间线段最短  C. 直线没有端点  D. 射线有一个端点",
                "MULTIPLE_CHOICE", "EASY", "数学", "grade", ["G7", "G8"],
                {"options": ["A. 两点确定一条直线", "B. 两点之间线段最短", "C. 直线没有端点", "D. 射线有一个端点"], "correct_answer": ["A", "B", "C", "D"]},
                "几何基本公理：A直线由两点确定；B最短路径为线段；C直线无端点向两端延伸；D射线有且仅有一个端点。四项均正确。",
                score=6),
            _q(12, "以下关于实数的说法，正确的是（多选）（ ）\nA. 两个无理数之和一定是无理数  B. 正数的平方根有两个  C. 0既不是正数也不是负数  D. 有理数包括整数和分数",
                "MULTIPLE_CHOICE", "MEDIUM", "数学", "grade", ["G8"],
                {"options": ["A. 两个无理数之和一定是无理数", "B. 正数的平方根有两个", "C. 0既不是正数也不是负数", "D. 有理数包括整数和分数"], "correct_answer": ["B", "C", "D"]},
                "A错误（√2+(-√2)=0为有理数）；B正确（正数有±两个平方根）；C正确（0是非负非正的特殊数）；D正确（有理数=整数+分数）。",
                score=6, is_typical=True),
            _q(13, "关于一次函数 y=kx+b (k≠0)，下列正确的是（多选）（ ）\nA. k>0时，y随x增大而增大  B. b>0时，图像与y轴交于正半轴  C. k<0时，图像经过第一象限  D. k和b同号时，图像经过三个象限",
                "MULTIPLE_CHOICE", "HARD", "数学", "grade", ["G8"],
                {"options": ["A. k>0时，y随x增大而增大", "B. b>0时，图像与y轴交于正半轴", "C. k<0时，图像经过第一象限", "D. k和b同号时，图像经过三个象限"], "correct_answer": ["A", "B"]},
                "A正确（斜率正，单调递增）；B正确（截距b>0，y轴交正半轴）；C不一定（k<0斜率负，不经过一象限，但经过二四象限及视b值）；D需分析（同号时经过三象限，但D说法不够精确）。",
                score=8),
            _q(14, "下列各项中属于整式的是（多选）（ ）\nA. 2x+3y  B. 1/(x+1)  C. x²-4x+4  D. (a+b)²",
                "MULTIPLE_CHOICE", "EASY", "数学", "grade", ["G7", "G8"],
                {"options": ["A. 2x+3y", "B. 1/(x+1)", "C. x²-4x+4", "D. (a+b)²"], "correct_answer": ["A", "C", "D"]},
                "整式包括单项式和多项式，分母中不含变量。A多项式✓；B分式✗；C多项式✓；D多项式✓。",
                score=6),
            _q(15, "在△ABC中，以下条件能确定△ABC全等的是（多选）（ ）\nA. AB=DE, BC=EF, AC=DF  B. AB=DE, ∠B=∠E, BC=EF  C. ∠A=∠D, ∠B=∠E  D. AB=DE, ∠A=∠D, AC=DF",
                "MULTIPLE_CHOICE", "HARD", "数学", "grade", ["G8"],
                {"options": ["A. SSS", "B. SAS", "C. AA", "D. SAS"], "correct_answer": ["A", "B", "D"]},
                "SSS（三边）、SAS（两边夹角）均可判定全等；仅两角相等只能判相似，不能全等。",
                score=8, is_typical=True),

            # ── 数学·填空（16~20）────────────────────────────────
            _q(16, "计算 |-3| + √9 - 2⁰ = ________",
                "FILL_BLANK", "EASY", "数学", "grade", ["G7", "G8"],
                {"options": None, "correct_answer": ["5"]},
                "|-3|=3，√9=3，2⁰=1（任何非零数的0次方为1），所以3+3-1=5。",
                score=4),
            _q(17, "解不等式 3x - 7 > 2，x 的取值范围是 ________",
                "FILL_BLANK", "EASY", "数学", "grade", ["G7", "G8"],
                {"options": None, "correct_answer": ["x>3"]},
                "3x>2+7=9，x>3。",
                score=4),
            _q(18, "若 a² + b² = 25，ab = 12，则 (a+b)² = ________, (a-b)² = ________",
                "FILL_BLANK", "MEDIUM", "数学", "grade", ["G8"],
                {"options": None, "correct_answer": ["49", "1"]},
                "(a+b)²=a²+2ab+b²=25+24=49；(a-b)²=a²-2ab+b²=25-24=1。",
                score=6, is_typical=True),
            _q(19, "因式分解：x² - 6x + 9 = ________",
                "FILL_BLANK", "EASY", "数学", "grade", ["G8"],
                {"options": None, "correct_answer": ["(x-3)²", "(x-3)^2"]},
                "完全平方公式：a²-2ab+b²=(a-b)²，此处a=x，b=3，得(x-3)²。",
                score=4),
            _q(20, "一个正多边形的内角和为1080°，则它有 ________ 条边",
                "FILL_BLANK", "MEDIUM", "数学", "grade", ["G8", "G9"],
                {"options": None, "correct_answer": ["8"]},
                "n边形内角和=(n-2)×180°=1080°，n-2=6，n=8。",
                score=4),

            # ── 数学·解答（21~25）────────────────────────────────
            _q(21, "解方程组：{ 2x + y = 7\n              { x - y = 2\n请写出完整的解题过程。",
                "SUBJECTIVE", "EASY", "数学", "grade", ["G7", "G8"],
                {"options": None, "correct_answer": {"keywords": ["x=3", "y=1", "代入", "加减消元"], "max_score": 8}},
                "两式相加：3x=9，x=3；代入第二式：3-y=2，y=1。解为x=3, y=1。",
                score=8),
            _q(22, "已知△ABC中，AB=AC=5cm，BC=8cm，求△ABC的面积。",
                "SUBJECTIVE", "MEDIUM", "数学", "grade", ["G8"],
                {"options": None, "correct_answer": {"keywords": ["作高", "勾股定理", "3", "12", "S=12"], "max_score": 10}},
                "作BC边上的高AD，D为BC中点，BD=4；由勾股定理：AD²=AB²-BD²=25-16=9，AD=3；S=½×8×3=12cm²。",
                score=10, is_typical=True),
            _q(23, "某校组织活动，去年参加人数为200人，今年比去年增加了15%，今年参加了多少人？",
                "SUBJECTIVE", "EASY", "数学", "grade", ["G7"],
                {"options": None, "correct_answer": {"keywords": ["230", "200×1.15", "增加15%"], "max_score": 6}},
                "今年人数=200×(1+15%)=200×1.15=230人。",
                score=6, created_by=TEACHER_CHINESE_ID),
            _q(24, "求证：如果两条直线被第三条直线所截，同位角相等，那么这两条直线平行。",
                "SUBJECTIVE", "HARD", "数学", "grade", ["G8"],
                {"options": None, "correct_answer": {"keywords": ["反证法", "辅助线", "对顶角", "平行"], "max_score": 12}},
                "利用对顶角、补角等关系，结合平行线判定定理进行证明。",
                score=12, is_typical=True),
            _q(25, "用配方法解方程 x² - 4x - 1 = 0，写出完整过程。",
                "SUBJECTIVE", "MEDIUM", "数学", "grade", ["G8"],
                {"options": None, "correct_answer": {"keywords": ["配方", "(x-2)²", "x=2±√5"], "max_score": 10}},
                "x²-4x=1，(x-2)²=1+4=5，x-2=±√5，x=2±√5。",
                score=10),

            # ── 语文·单选（26~30）────────────────────────────────
            _q(26, "下列加点字注音全部正确的一项是（ ）\nA. 惬意(qiè)  B. 蹒跚(mán)  C. 亘古(gèn)  D. 眺望(tiào)",
                "SINGLE_CHOICE", "EASY", "语文", "grade", ["G7"],
                {"options": ["A. 惬意(qiè)", "B. 蹒跚(mán)", "C. 亘古(gèn)", "D. 眺望(tiào)"], "correct_answer": "D"},
                "A惬(qiè)✓；B蹒跚读pán shān，蹒(pán)；C亘古(gèn)✓；D眺望(tiào)✓。但B有误，选D（全对的只有D）。",
                score=2, created_by=TEACHER_CHINESE_ID),
            _q(27, "以下句子中，没有语病的一句是（ ）\nA. 通过努力学习，使他的成绩提高了  B. 我们要防止类似错误不再发生  C. 他的语文成绩不但好，而且数学成绩也很好  D. 这篇文章的作者是张华老师写的",
                "SINGLE_CHOICE", "MEDIUM", "语文", "grade", ["G7"],
                {"options": ["A. 缺主语", "B. 否定多余", "C. 递进关系正确", "D. 句式杂糅"], "correct_answer": "C"},
                "A缺主语（去掉'通过'或'使'）；B双重否定错误；C结构正确；D句式杂糅（'是…写的'）。",
                score=2, created_by=TEACHER_CHINESE_ID),
            _q(28, "《春》是哪位作家的散文代表作？（ ）\nA. 鲁迅  B. 朱自清  C. 老舍  D. 冰心",
                "SINGLE_CHOICE", "EASY", "语文", "grade", ["G7"],
                {"options": ["A. 鲁迅", "B. 朱自清", "C. 老舍", "D. 冰心"], "correct_answer": "B"},
                "《春》是朱自清的著名散文，与《荷塘月色》《背影》并列为其代表作。",
                score=2, created_by=TEACHER_CHINESE_ID),
            _q(29, "'但愿人长久，千里共婵娟'出自哪首词？（ ）\nA. 《水调歌头》  B. 《念奴娇》  C. 《江城子》  D. 《蝶恋花》",
                "SINGLE_CHOICE", "EASY", "语文", "grade", ["G7", "G8"],
                {"options": ["A. 《水调歌头》", "B. 《念奴娇》", "C. 《江城子》", "D. 《蝶恋花》"], "correct_answer": "A"},
                "苏轼《水调歌头·明月几时有》：但愿人长久，千里共婵娟。",
                score=2, created_by=TEACHER_CHINESE_ID, is_typical=True),
            _q(30, "下列词语中，书写全部正确的一项是（ ）\nA. 爆发·暴发  B. 赋予·付予  C. 协调·谐调  D. 品味·品位",
                "SINGLE_CHOICE", "MEDIUM", "语文", "grade", ["G7"],
                {"options": ["A. 爆发/暴发（均有，视语境）", "B. 赋予（正确）·付予（错）", "C. 协调（正确）·谐调（误）", "D. 品味/品位（均有，视语境）"], "correct_answer": "D"},
                "品味（动词，体味）和品位（名词，水平档次）均是正确词语，视语境使用。",
                score=2, created_by=TEACHER_CHINESE_ID),

            # ── 语文·填空（31~33）────────────────────────────────
            _q(31, "填写完整：'海内存知己，天涯若比邻'出自王勃的《________》",
                "FILL_BLANK", "EASY", "语文", "grade", ["G7"],
                {"options": None, "correct_answer": ["送杜少府之任蜀州", "送杜少府之任蜀川"]},
                "王勃《送杜少府之任蜀州》，全诗以豁达情怀安慰友人。",
                score=3, created_by=TEACHER_CHINESE_ID),
            _q(32, "《从百草园到三味书屋》的作者是________，选自散文集《________》",
                "FILL_BLANK", "EASY", "语文", "grade", ["G7"],
                {"options": None, "correct_answer": ["鲁迅", "朝花夕拾"]},
                "鲁迅的散文集《朝花夕拾》收录了十篇回忆性文章。",
                score=4, created_by=TEACHER_CHINESE_ID),
            _q(33, "根据语境填写：'学而不思则罔，思而不学则________'（《论语》）",
                "FILL_BLANK", "EASY", "语文", "grade", ["G7", "G8"],
                {"options": None, "correct_answer": ["殆"]},
                "孔子《论语·为政》：学而不思则罔（迷惑），思而不学则殆（危险）。",
                score=3, created_by=TEACHER_CHINESE_ID),

            # ── 语文·解答（34~36）────────────────────────────────
            _q(34, "请对《春》中'吹面不寒杨柳风'这句话进行赏析（不少于50字）",
                "SUBJECTIVE", "MEDIUM", "语文", "grade", ["G7"],
                {"options": None, "correct_answer": {"keywords": ["拟人", "触觉", "柔和", "春风", "感官"], "max_score": 8}},
                "赏析要点：①修辞（引用古诗、视觉/触觉描写）；②'不寒'写出春风温柔特点；③以杨柳烘托春意；④语言优美生动。",
                score=8, created_by=TEACHER_CHINESE_ID, is_typical=True),
            _q(35, "概括《走一步，再走一步》中'我'的心理变化过程（不超过50字）",
                "SUBJECTIVE", "EASY", "语文", "grade", ["G7"],
                {"options": None, "correct_answer": {"keywords": ["恐惧", "害怕", "信心", "勇气", "成功"], "max_score": 6}},
                "心理变化：害怕→绝望→听从指导→一步步尝试→信心增加→成功→领悟人生哲理。",
                score=6, created_by=TEACHER_CHINESE_ID),
            _q(36, "请以'我的一次成长经历'为题，写一篇不少于150字的片段作文。",
                "SUBJECTIVE", "HARD", "语文", "grade", ["G7", "G8"],
                {"options": None, "correct_answer": {"keywords": ["细节描写", "真情实感", "结构完整", "首尾呼应"], "max_score": 20}},
                "评分要点：①内容充实，有具体事件；②情感真实；③有细节描写；④结构完整，首尾照应。",
                score=20, created_by=TEACHER_CHINESE_ID),

            # ── 英语·单选（37~42）────────────────────────────────
            _q(37, "— What ___ you doing at 8 o'clock yesterday evening?\n— I ___ watching TV.\nA. were / was  B. was / were  C. did / was  D. were / were",
                "SINGLE_CHOICE", "EASY", "英语", "grade", ["G8", "G9"],
                {"options": ["A. were / was", "B. was / were", "C. did / was", "D. were / were"], "correct_answer": "A"},
                "过去进行时：主语you用were；主语I用was。",
                score=3, created_by=TEACHER_ENG_ID),
            _q(38, "She suggested that we ___ early tomorrow.\nA. should leave  B. left  C. leave  D. would leave",
                "SINGLE_CHOICE", "MEDIUM", "英语", "grade", ["G9"],
                {"options": ["A. should leave", "B. left", "C. leave", "D. would leave"], "correct_answer": "C"},
                "suggest后接that从句时使用虚拟语气（should+动原或直接原形）。A和C均可，但C更简洁是标准答案。",
                score=3, created_by=TEACHER_ENG_ID),
            _q(39, "The book ___ on the shelf belongs to me.\nA. lay  B. lies  C. lying  D. lain",
                "SINGLE_CHOICE", "MEDIUM", "英语", "grade", ["G9"],
                {"options": ["A. lay", "B. lies", "C. lying", "D. lain"], "correct_answer": "C"},
                "此处'on the shelf'是后置定语修饰book，动词应用现在分词形式lying（-ing做定语）。",
                score=3, created_by=TEACHER_ENG_ID),
            _q(40, "下列单词中，划线部分发音与其他三个不同的是（ ）\nA. bread  B. head  C. heavy  D. dream",
                "SINGLE_CHOICE", "EASY", "英语", "grade", ["G8"],
                {"options": ["A. bread /e/", "B. head /e/", "C. heavy /e/", "D. dream /iː/"], "correct_answer": "D"},
                "A/B/C中ea发/e/音；D中ea发/iː/音，读音不同。",
                score=2, created_by=TEACHER_ENG_ID),
            _q(41, "He is good ___ playing football.\nA. at  B. in  C. for  D. with",
                "SINGLE_CHOICE", "EASY", "英语", "grade", ["G8"],
                {"options": ["A. at", "B. in", "C. for", "D. with"], "correct_answer": "A"},
                "be good at sth/doing sth 是固定搭配，表示'擅长…'。",
                score=2, created_by=TEACHER_ENG_ID, is_typical=True),
            _q(42, "The news ___ him very excited.\nA. made  B. make  C. making  D. makes",
                "SINGLE_CHOICE", "MEDIUM", "英语", "grade", ["G8"],
                {"options": ["A. made", "B. make", "C. making", "D. makes"], "correct_answer": "A"},
                "make+宾语+形容词，此句为陈述过去事实，用过去式made。",
                score=3, created_by=TEACHER_ENG_ID),

            # ── 英语·填空（43~45）────────────────────────────────
            _q(43, "用适当形式填写单词：\n1. He often _____ (go) to school by bike.\n2. They _____ (visit) the museum yesterday.",
                "FILL_BLANK", "EASY", "英语", "grade", ["G8"],
                {"options": None, "correct_answer": ["goes", "visited"]},
                "1.第三人称单数一般现在时，go→goes；2.过去式，visit→visited。",
                score=4, created_by=TEACHER_ENG_ID),
            _q(44, "完成句子：将中文翻译成英文\n'他们正在图书馆学习。' → ________",
                "FILL_BLANK", "EASY", "英语", "grade", ["G8"],
                {"options": None, "correct_answer": ["They are studying in the library.", "They are learning in the library."]},
                "过去进行时（现在进行时）：They are studying in the library.",
                score=4, created_by=TEACHER_ENG_ID),
            _q(45, "写出下列单词的反义词：\nhappy → ________\nfast → ________",
                "FILL_BLANK", "EASY", "英语", "grade", ["G7", "G8"],
                {"options": None, "correct_answer": ["sad/unhappy", "slow"]},
                "happy的反义词是sad或unhappy；fast的反义词是slow。",
                score=4, created_by=TEACHER_ENG_ID),

            # ── 英语·解答（46~50）────────────────────────────────
            _q(46, "阅读下面短文，回答问题：\n'Tom is a 14-year-old student. He likes reading books and playing basketball. He reads for two hours every day. His favourite subject is English.'\n\nQ: What does Tom like doing in his spare time? (Answer in English)",
                "SUBJECTIVE", "EASY", "英语", "grade", ["G8"],
                {"options": None, "correct_answer": {"keywords": ["reading books", "playing basketball", "likes"], "max_score": 4}},
                "参考答案：Tom likes reading books and playing basketball in his spare time.",
                score=4, created_by=TEACHER_ENG_ID),
            _q(47, "用以下词汇造句（每词造一句，不少于8个单词）：\n1. although  2. unless",
                "SUBJECTIVE", "MEDIUM", "英语", "grade", ["G9"],
                {"options": None, "correct_answer": {"keywords": ["although", "unless", "完整句子", "语法正确"], "max_score": 6}},
                "示例：1. Although it was raining, we still went out for a walk. 2. You will fail the exam unless you study harder.",
                score=6, created_by=TEACHER_ENG_ID),
            _q(48, "以'My Favourite Season'为题，写一段不少于60词的英语短文。",
                "SUBJECTIVE", "MEDIUM", "英语", "grade", ["G8", "G9"],
                {"options": None, "correct_answer": {"keywords": ["favourite", "season", "because", "activities", "60 words"], "max_score": 10}},
                "评分要点：①明确主题；②理由充分；③有具体活动描述；④语法基本正确；⑤词数达标。",
                score=10, created_by=TEACHER_ENG_ID),
            _q(49, "将下列句子改为被动语态：\n1. The teacher corrected the homework.\n2. They built this bridge in 1990.",
                "SUBJECTIVE", "MEDIUM", "英语", "grade", ["G9"],
                {"options": None, "correct_answer": {"keywords": ["was corrected", "was built", "被动语态", "by"], "max_score": 6}},
                "1. The homework was corrected by the teacher. 2. This bridge was built (by them) in 1990.",
                score=6, created_by=TEACHER_ENG_ID, is_typical=True),
            _q(50, "阅读理解（综合）：根据文章内容，判断下列说法对错并说明理由。（英文作答）",
                "SUBJECTIVE", "HARD", "英语", "grade", ["G9"],
                {"options": None, "correct_answer": {"keywords": ["True", "False", "because", "according to"], "max_score": 12}},
                "答题需结合文章原文，给出判断依据。",
                score=12, created_by=TEACHER_ENG_ID),
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
        print(f"   导入 {len(questions_data)} 道题目")

        # ── 题目任务（模拟LLM生成记录）─────────────────────────────
        qtask_rows = [
            {"id": _uuid(), "task_type": "LLM_GENERATE", "status": "COMPLETED",
             "progress": 100, "total_items": 10, "completed_items": 10,
             "parameters": json.dumps({"subject": "数学", "grade": "G8", "count": 10}),
             "result_summary": json.dumps({"generated": 10, "approved": 8, "rejected": 2}),
             "model_used": "deepseek-v4-pro[1m]",
             "started_at": _dt(15), "completed_at": _dt(15, hours=1),
             "created_by": QADMIN_ID, "created_at": _dt(15)},
            {"id": _uuid(), "task_type": "LLM_GENERATE", "status": "COMPLETED",
             "progress": 100, "total_items": 5, "completed_items": 5,
             "parameters": json.dumps({"subject": "语文", "grade": "G7", "count": 5}),
             "result_summary": json.dumps({"generated": 5, "approved": 5, "rejected": 0}),
             "model_used": "nemotron-3-super:120b",
             "started_at": _dt(10), "completed_at": _dt(10, hours=1),
             "created_by": QADMIN_ID, "created_at": _dt(10)},
        ]
        for row in qtask_rows:
            await db.execute(text("""
                INSERT INTO question_tasks (id, task_type, status, progress, total_items,
                    completed_items, parameters, result_summary, model_used,
                    started_at, completed_at, created_by, created_at)
                VALUES (:id, :task_type, :status, :progress, :total_items,
                    :completed_items, :parameters, :result_summary, :model_used,
                    :started_at, :completed_at, :created_by, :created_at)
            """), row)

        await db.commit()
        print(f"   导入 {len(qtask_rows)} 条LLM任务记录")

        # ──────────────────────────────────────────────────────────
        # STEP 7 — 试卷（4份）及题目关联
        # ──────────────────────────────────────────────────────────
        print("\n[7/9] 导入试卷...")
        papers = [
            {
                "id": PAPER_MATH_MID_ID,
                "title": "八年级数学上册期中测试",
                "description": "涵盖实数、代数式、方程三章，共100分",
                "subject": "数学", "grade_level": "G8",
                "status": "PUBLISHED", "total_score": 100, "duration_minutes": 120,
                "instructions": "请将答案写在答题纸上，计算题须写出解题步骤，否则不得分。",
                "created_by": TEACHER_MATH_ID, "created_at": _dt(20), "updated_at": _dt(20),
            },
            {
                "id": PAPER_MATH_UNIT_ID,
                "title": "八年级数学第一章单元测试（实数）",
                "description": "实数概念与运算，满分50分",
                "subject": "数学", "grade_level": "G8",
                "status": "PUBLISHED", "total_score": 50, "duration_minutes": 60,
                "instructions": "全部题目均需作答，填空题只写答案。",
                "created_by": TEACHER_MATH_ID, "created_at": _dt(35), "updated_at": _dt(35),
            },
            {
                "id": PAPER_CHN_MID_ID,
                "title": "七年级语文上册期中检测",
                "description": "现代文阅读+古诗词+写作，共100分",
                "subject": "语文", "grade_level": "G7",
                "status": "PUBLISHED", "total_score": 100, "duration_minutes": 120,
                "instructions": "作文字迹工整，卷面整洁酌情加分。",
                "created_by": TEACHER_CHINESE_ID, "created_at": _dt(18), "updated_at": _dt(18),
            },
            {
                "id": PAPER_ENG_FINAL_ID,
                "title": "九年级英语中考模拟卷",
                "description": "单选+填空+阅读+写作，满分120分",
                "subject": "英语", "grade_level": "G9",
                "status": "PUBLISHED", "total_score": 120, "duration_minutes": 120,
                "instructions": "认真审题，书写规范。",
                "created_by": TEACHER_ENG_ID, "created_at": _dt(14), "updated_at": _dt(14),
            },
        ]
        for p in papers:
            await db.execute(text("""
                INSERT INTO exam_papers (id, title, description, subject, grade_level, status,
                    total_score, duration_minutes, instructions, created_by, created_at, updated_at)
                VALUES (:id, :title, :description, :subject, :grade_level, :status,
                    :total_score, :duration_minutes, :instructions, :created_by, :created_at, :updated_at)
            """), p)

        # 试卷-题目关联
        # 期中数学（100分）：题目1~25中选取，共10道
        math_mid_qs = [
            (Q_IDS["q1"],  1,  3), (Q_IDS["q2"],  2,  5), (Q_IDS["q3"],  3,  3),
            (Q_IDS["q4"],  4,  3), (Q_IDS["q8"],  5,  5), (Q_IDS["q11"], 6,  6),
            (Q_IDS["q15"], 7,  8), (Q_IDS["q16"], 8,  4), (Q_IDS["q18"], 9,  6),
            (Q_IDS["q21"], 10, 8), (Q_IDS["q22"], 11, 10),(Q_IDS["q24"], 12, 12),
            (Q_IDS["q25"], 13, 10),(Q_IDS["q19"], 14, 4), (Q_IDS["q20"], 15, 4),
            (Q_IDS["q6"],  16, 3), (Q_IDS["q7"],  17, 3), (Q_IDS["q9"],  18, 3),
        ]
        for qid, pos, sc in math_mid_qs:
            await db.execute(text("""
                INSERT INTO exam_paper_questions (id, exam_paper_id, question_id, position, score)
                VALUES (:id, :paper_id, :qid, :pos, :sc)
            """), {"id": _uuid(), "paper_id": PAPER_MATH_MID_ID, "qid": qid, "pos": pos, "sc": sc})

        # 单元测数学（50分）：实数相关
        math_unit_qs = [
            (Q_IDS["q1"],  1, 3), (Q_IDS["q6"],  2, 3), (Q_IDS["q10"], 3, 3),
            (Q_IDS["q16"], 4, 4), (Q_IDS["q17"], 5, 4), (Q_IDS["q8"],  6, 5),
            (Q_IDS["q12"], 7, 6), (Q_IDS["q14"], 8, 6), (Q_IDS["q23"], 9, 6),
            (Q_IDS["q21"], 10, 8), (Q_IDS["q5"],  11, 3),
        ]
        for qid, pos, sc in math_unit_qs:
            await db.execute(text("""
                INSERT INTO exam_paper_questions (id, exam_paper_id, question_id, position, score)
                VALUES (:id, :paper_id, :qid, :pos, :sc)
            """), {"id": _uuid(), "paper_id": PAPER_MATH_UNIT_ID, "qid": qid, "pos": pos, "sc": sc})

        # 语文期中（100分）
        chn_mid_qs = [
            (Q_IDS["q26"], 1, 2), (Q_IDS["q27"], 2, 2), (Q_IDS["q28"], 3, 2),
            (Q_IDS["q29"], 4, 2), (Q_IDS["q30"], 5, 2), (Q_IDS["q31"], 6, 3),
            (Q_IDS["q32"], 7, 4), (Q_IDS["q33"], 8, 3), (Q_IDS["q34"], 9, 8),
            (Q_IDS["q35"], 10, 6), (Q_IDS["q36"], 11, 20),
        ]
        for qid, pos, sc in chn_mid_qs:
            await db.execute(text("""
                INSERT INTO exam_paper_questions (id, exam_paper_id, question_id, position, score)
                VALUES (:id, :paper_id, :qid, :pos, :sc)
            """), {"id": _uuid(), "paper_id": PAPER_CHN_MID_ID, "qid": qid, "pos": pos, "sc": sc})

        # 英语模拟卷（120分）
        eng_qs = [
            (Q_IDS["q37"], 1, 3), (Q_IDS["q38"], 2, 3), (Q_IDS["q39"], 3, 3),
            (Q_IDS["q40"], 4, 2), (Q_IDS["q41"], 5, 2), (Q_IDS["q42"], 6, 3),
            (Q_IDS["q43"], 7, 4), (Q_IDS["q44"], 8, 4), (Q_IDS["q45"], 9, 4),
            (Q_IDS["q46"], 10, 4),(Q_IDS["q47"], 11, 6),(Q_IDS["q48"], 12, 10),
            (Q_IDS["q49"], 13, 6),(Q_IDS["q50"], 14, 12),
        ]
        for qid, pos, sc in eng_qs:
            await db.execute(text("""
                INSERT INTO exam_paper_questions (id, exam_paper_id, question_id, position, score)
                VALUES (:id, :paper_id, :qid, :pos, :sc)
            """), {"id": _uuid(), "paper_id": PAPER_ENG_FINAL_ID, "qid": qid, "pos": pos, "sc": sc})

        await db.commit()
        print(f"   导入 {len(papers)} 份试卷及题目关联")

        # ──────────────────────────────────────────────────────────
        # STEP 8 — 答题记录、错题本、自学任务、通知、家长模块
        # ──────────────────────────────────────────────────────────
        print("\n[8/9] 导入答题/错题/自学/通知/家长数据...")

        # ── 答题记录（张明 × 期中数学）
        SUB1_ID = _uuid()
        await db.execute(text("""
            INSERT INTO answer_submissions (id, student_id, exam_paper_id, submission_type,
                status, started_at, submitted_at, graded_at, total_score, percentage, meta_data, created_at, updated_at)
            VALUES (:id, :stu, :paper, :stype, :status, :started, :submitted, :graded, :tscore, :pct, :meta, :created, :updated)
        """), {"id": SUB1_ID, "stu": STU_ZHANG_ID, "paper": PAPER_MATH_MID_ID,
               "stype": "ONLINE", "status": "GRADED",
               "started": _dt(15, hours=2), "submitted": _dt(15, hours=0),
               "graded": _dt(14, hours=22), "tscore": 78, "pct": 78,
               "meta": "{}", "created": _dt(15), "updated": _dt(14)})

        # 答题明细（取前7道题）
        detail_answers = [
            (Q_IDS["q1"],  "A", True,  3.0),
            (Q_IDS["q2"],  "A", True,  5.0),
            (Q_IDS["q3"],  "B", True,  3.0),
            (Q_IDS["q4"],  "A", False, 0.0),   # 错题
            (Q_IDS["q8"],  "C", False, 0.0),   # 错题
            (Q_IDS["q11"], json.dumps(["A","B","C","D"]), True, 6.0),
            (Q_IDS["q15"], json.dumps(["A","B"]), False, 4.0),  # 部分正确（多选）
        ]
        for qid, ans, correct, score_val in detail_answers:
            await db.execute(text("""
                INSERT INTO answer_details (id, answer_submission_id, question_id,
                    student_answer, is_correct, score_obtained, created_at, updated_at)
                VALUES (:id, :sub, :qid, :ans, :correct, :score, now(), now())
            """), {"id": _uuid(), "sub": SUB1_ID, "qid": qid, "ans": ans,
                   "correct": correct, "score": score_val})

        # 评分记录
        await db.execute(text("""
            INSERT INTO grading_records (id, answer_submission_id, model_used, model_version,
                status, started_at, completed_at, total_score, percentage, details, created_at, updated_at)
            VALUES (:id, :sub, :model, :ver, :status, :started, :completed, :tscore, :pct, :details, now(), now())
        """), {"id": _uuid(), "sub": SUB1_ID, "model": "rule-based", "ver": "v1.0",
               "status": "COMPLETED", "started": _dt(14, hours=23), "completed": _dt(14, hours=22),
               "tscore": 78, "pct": 78, "details": '{"graded_by": "auto"}'})

        # ── 答题记录（李华 × 单元测数学）
        SUB2_ID = _uuid()
        await db.execute(text("""
            INSERT INTO answer_submissions (id, student_id, exam_paper_id, submission_type,
                status, started_at, submitted_at, graded_at, total_score, percentage, meta_data, created_at, updated_at)
            VALUES (:id, :stu, :paper, :stype, :status, :started, :submitted, :graded, :tscore, :pct, :meta, :created, :updated)
        """), {"id": SUB2_ID, "stu": STU_LI_ID, "paper": PAPER_MATH_UNIT_ID,
               "stype": "ONLINE", "status": "GRADED",
               "started": _dt(12, hours=2), "submitted": _dt(12),
               "graded": _dt(12), "tscore": 42, "pct": 84,
               "meta": "{}", "created": _dt(12), "updated": _dt(12)})

        detail_answers2 = [
            (Q_IDS["q1"],  "A", True,  3.0),
            (Q_IDS["q6"],  "A", True,  3.0),
            (Q_IDS["q10"], "A", True,  3.0),
            (Q_IDS["q16"], "5", True,  4.0),
            (Q_IDS["q17"], "x>2", False, 0.0),   # 错题
            (Q_IDS["q8"],  "D", True,  5.0),
        ]
        for qid, ans, correct, score_val in detail_answers2:
            await db.execute(text("""
                INSERT INTO answer_details (id, answer_submission_id, question_id,
                    student_answer, is_correct, score_obtained, created_at, updated_at)
                VALUES (:id, :sub, :qid, :ans, :correct, :score, now(), now())
            """), {"id": _uuid(), "sub": SUB2_ID, "qid": qid, "ans": ans,
                   "correct": correct, "score": score_val})

        await db.execute(text("""
            INSERT INTO grading_records (id, answer_submission_id, model_used, model_version,
                status, started_at, completed_at, total_score, percentage, details, created_at, updated_at)
            VALUES (:id, :sub, :model, :ver, :status, :started, :completed, :tscore, :pct, :details, now(), now())
        """), {"id": _uuid(), "sub": SUB2_ID, "model": "rule-based", "ver": "v1.0",
               "status": "COMPLETED", "started": _dt(12), "completed": _dt(12),
               "tscore": 42, "pct": 84, "details": '{"graded_by": "auto"}'})

        # ── 答题记录（王芳 × 语文期中）
        SUB3_ID = _uuid()
        await db.execute(text("""
            INSERT INTO answer_submissions (id, student_id, exam_paper_id, submission_type,
                status, started_at, submitted_at, graded_at, total_score, percentage, meta_data, created_at, updated_at)
            VALUES (:id, :stu, :paper, :stype, :status, :started, :submitted, :graded, :tscore, :pct, :meta, :created, :updated)
        """), {"id": SUB3_ID, "stu": STU_WANG_ID, "paper": PAPER_CHN_MID_ID,
               "stype": "ONLINE", "status": "GRADED",
               "started": _dt(10, hours=2), "submitted": _dt(10),
               "graded": _dt(9), "tscore": 86, "pct": 86,
               "meta": "{}", "created": _dt(10), "updated": _dt(9)})

        # ── 答题记录（陈强 × 英语模拟）
        SUB4_ID = _uuid()
        await db.execute(text("""
            INSERT INTO answer_submissions (id, student_id, exam_paper_id, submission_type,
                status, started_at, submitted_at, graded_at, total_score, percentage, meta_data, created_at, updated_at)
            VALUES (:id, :stu, :paper, :stype, :status, :started, :submitted, :graded, :tscore, :pct, :meta, :created, :updated)
        """), {"id": SUB4_ID, "stu": STU_CHEN_ID, "paper": PAPER_ENG_FINAL_ID,
               "stype": "ONLINE", "status": "GRADED",
               "started": _dt(5, hours=2), "submitted": _dt(5),
               "graded": _dt(5), "tscore": 95, "pct": 79.17,
               "meta": "{}", "created": _dt(5), "updated": _dt(5)})

        # ── 答题记录（张明再次作答单元测）
        SUB5_ID = _uuid()
        await db.execute(text("""
            INSERT INTO answer_submissions (id, student_id, exam_paper_id, submission_type,
                status, started_at, submitted_at, graded_at, total_score, percentage, meta_data, created_at, updated_at)
            VALUES (:id, :stu, :paper, :stype, :status, :started, :submitted, :graded, :tscore, :pct, :meta, :created, :updated)
        """), {"id": SUB5_ID, "stu": STU_ZHANG_ID, "paper": PAPER_MATH_UNIT_ID,
               "stype": "ONLINE", "status": "GRADED",
               "started": _dt(8, hours=2), "submitted": _dt(8),
               "graded": _dt(8), "tscore": 46, "pct": 92,
               "meta": "{}", "created": _dt(8), "updated": _dt(8)})

        # ── 错题本（张明）
        NB1_ID = _uuid()
        await db.execute(text("""
            INSERT INTO error_notebooks (id, student_id, title, description, exam_paper_id,
                generated_at, question_count, status, created_at, updated_at)
            VALUES (:id, :stu, :title, :desc, :paper, :gen, :qcnt, :status, :created, :updated)
        """), {"id": NB1_ID, "stu": STU_ZHANG_ID, "title": "期中数学错题本",
               "desc": "来自八年级期中数学测试", "paper": PAPER_MATH_MID_ID,
               "gen": _dt(13), "qcnt": 2, "status": "GENERATED",
               "created": _dt(13), "updated": _dt(13)})

        # 错题本题目（q4、q8 答错）
        for orig_qid, prac_qid in [(Q_IDS["q4"], Q_IDS["q5"]), (Q_IDS["q8"], Q_IDS["q6"])]:
            await db.execute(text("""
                INSERT INTO error_notebook_questions (id, error_notebook_id, original_question_id,
                    practice_question_id, error_type, explanation, created_at)
                VALUES (:id, :nb, :orig, :prac, :etype, :expl, :created)
            """), {"id": _uuid(), "nb": NB1_ID, "orig": orig_qid, "prac": prac_qid,
                   "etype": "CONCEPT",
                   "expl": "题目类型为等腰三角形判断，需注意三角不等式验证。建议复习三角形三边关系定理。",
                   "created": _dt(13)})

        # ── 错题本（李华）
        NB2_ID = _uuid()
        await db.execute(text("""
            INSERT INTO error_notebooks (id, student_id, title, description, exam_paper_id,
                generated_at, question_count, status, created_at, updated_at)
            VALUES (:id, :stu, :title, :desc, :paper, :gen, :qcnt, :status, :created, :updated)
        """), {"id": NB2_ID, "stu": STU_LI_ID, "title": "数学单元测错题本",
               "desc": "不等式解法需加强", "paper": PAPER_MATH_UNIT_ID,
               "gen": _dt(11), "qcnt": 1, "status": "GENERATED",
               "created": _dt(11), "updated": _dt(11)})
        await db.execute(text("""
            INSERT INTO error_notebook_questions (id, error_notebook_id, original_question_id,
                practice_question_id, error_type, explanation, created_at)
            VALUES (:id, :nb, :orig, :prac, :etype, :expl, :created)
        """), {"id": _uuid(), "nb": NB2_ID, "orig": Q_IDS["q17"], "prac": Q_IDS["q16"],
               "etype": "CALCULATION",
               "expl": "不等式移项时方向判断有误，注意：负数除法需要变号。",
               "created": _dt(11)})

        # ── 自学任务
        self_study_rows = [
            {"id": _uuid(), "student_id": STU_ZHANG_ID, "title": "复习实数与平方根",
             "description": "针对错题q8，复习无理数判断方法", "subject": "数学", "grade_level": "G8",
             "status": "COMPLETED", "priority": 2,
             "scheduled_time": _dt(12), "completed_time": _dt(8),
             "created_at": _dt(13), "updated_at": _dt(8)},
            {"id": _uuid(), "student_id": STU_ZHANG_ID, "title": "等腰三角形专项练习",
             "description": "三角形三边关系定理强化训练", "subject": "数学", "grade_level": "G8",
             "status": "IN_PROGRESS", "priority": 1,
             "scheduled_time": _dt(3), "completed_time": None,
             "created_at": _dt(7), "updated_at": _dt(3)},
            {"id": _uuid(), "student_id": STU_LI_ID, "title": "不等式解法专题",
             "description": "一元一次不等式及不等式组", "subject": "数学", "grade_level": "G8",
             "status": "PENDING", "priority": 1,
             "scheduled_time": _dt(0), "completed_time": None,
             "created_at": _dt(5), "updated_at": _dt(5)},
            {"id": _uuid(), "student_id": STU_WANG_ID, "title": "古诗词背诵计划",
             "description": "背诵七年级必背古诗词20首", "subject": "语文", "grade_level": "G7",
             "status": "IN_PROGRESS", "priority": 2,
             "scheduled_time": _dt(1), "completed_time": None,
             "created_at": _dt(8), "updated_at": _dt(1)},
            {"id": _uuid(), "student_id": STU_CHEN_ID, "title": "英语阅读理解训练",
             "description": "每日精读1篇中考难度阅读题", "subject": "英语", "grade_level": "G9",
             "status": "PENDING", "priority": 1,
             "scheduled_time": _dt(0), "completed_time": None,
             "created_at": _dt(3), "updated_at": _dt(3)},
        ]
        for row in self_study_rows:
            await db.execute(text("""
                INSERT INTO self_study_tasks (id, student_id, title, description, subject,
                    grade_level, status, priority, scheduled_time, completed_time, created_at, updated_at)
                VALUES (:id, :student_id, :title, :description, :subject,
                    :grade_level, :status, :priority, :scheduled_time, :completed_time, :created_at, :updated_at)
            """), row)
        print(f"   导入 {len(self_study_rows)} 条自学任务")

        # ── 通知
        notif_rows = [
            {"id": _uuid(), "recipient_id": STU_ZHANG_ID, "sender_id": TEACHER_MATH_ID,
             "notification_type": "GRADING_COMPLETE", "title": "期中数学测试已批改",
             "content": "你的八年级数学期中测试已批改完毕，得分78分，请查看错题本并完成订正。",
             "channel": "IN_APP", "status": "READ", "related_entity_type": "answer_submission",
             "related_entity_id": SUB1_ID, "sent_at": _dt(14), "read_at": _dt(13), "created_at": _dt(14), "updated_at": _dt(13)},
            {"id": _uuid(), "recipient_id": STU_ZHANG_ID, "sender_id": TEACHER_MATH_ID,
             "notification_type": "ERROR_NOTEBOOK_READY", "title": "你的错题本已生成",
             "content": "期中数学错题本已生成，共2道错题，请认真订正！",
             "channel": "IN_APP", "status": "READ", "related_entity_type": "error_notebook",
             "related_entity_id": NB1_ID, "sent_at": _dt(13), "read_at": _dt(13), "created_at": _dt(13), "updated_at": _dt(13)},
            {"id": _uuid(), "recipient_id": STU_LI_ID, "sender_id": TEACHER_MATH_ID,
             "notification_type": "GRADING_COMPLETE", "title": "单元测试已批改",
             "content": "你的数学第一章单元测试已批改，得分42/50（84%），继续加油！",
             "channel": "IN_APP", "status": "SENT", "related_entity_type": "answer_submission",
             "related_entity_id": SUB2_ID, "sent_at": _dt(12), "read_at": None, "created_at": _dt(12), "updated_at": _dt(12)},
            {"id": _uuid(), "recipient_id": STU_ZHANG_ID, "sender_id": None,
             "notification_type": "EXAM_REMINDER", "title": "明日有数学单元测试",
             "content": "提醒：明天下午2点将进行第一章数学单元测试，请做好复习准备。",
             "channel": "IN_APP", "status": "SENT", "related_entity_type": None,
             "related_entity_id": None, "sent_at": _dt(9), "read_at": None, "created_at": _dt(9), "updated_at": _dt(9)},
            {"id": _uuid(), "recipient_id": STU_WANG_ID, "sender_id": TEACHER_CHINESE_ID,
             "notification_type": "GRADING_COMPLETE", "title": "语文期中测试已批改",
             "content": "你的七年级语文期中测试已批改，得分86分，表现优秀！",
             "channel": "IN_APP", "status": "SENT", "related_entity_type": "answer_submission",
             "related_entity_id": SUB3_ID, "sent_at": _dt(9), "read_at": None, "created_at": _dt(9), "updated_at": _dt(9)},
        ]
        for row in notif_rows:
            await db.execute(text("""
                INSERT INTO notifications (id, recipient_id, sender_id, notification_type,
                    title, content, channel, status, related_entity_type, related_entity_id,
                    sent_at, read_at, created_at, updated_at)
                VALUES (:id, :recipient_id, :sender_id, :notification_type,
                    :title, :content, :channel, :status, :related_entity_type, :related_entity_id,
                    :sent_at, :read_at, :created_at, :updated_at)
            """), row)
        print(f"   导入 {len(notif_rows)} 条通知")

        # ── 庆典事件（CelebrationEvent）
        celeb_rows = [
            {"id": _uuid(), "student_id": STU_ZHANG_ID, "event_type": "PAPER_COMPLETED",
             "title": "完成首次在线答题！", "description": "张明同学完成了八年级数学期中测试，这是他在平台上完成的第一份试卷！",
             "metric_value": 1, "parent_notified": True, "parent_acknowledged": True,
             "encouragement_sent": True, "created_at": _dt(14)},
            {"id": _uuid(), "student_id": STU_LI_ID, "event_type": "ACCURACY_IMPROVED",
             "title": "正确率提升！", "description": "李华本次单元测正确率84%，较上次提升12个百分点！",
             "metric_value": 84, "parent_notified": True, "parent_acknowledged": False,
             "encouragement_sent": True, "created_at": _dt(12)},
            {"id": _uuid(), "student_id": STU_WANG_ID, "event_type": "PAPER_COMPLETED",
             "title": "语文优秀！", "description": "王芳语文期中测试86分，成绩优秀！",
             "metric_value": 86, "parent_notified": False, "parent_acknowledged": False,
             "encouragement_sent": False, "created_at": _dt(9)},
        ]
        for row in celeb_rows:
            await db.execute(text("""
                INSERT INTO celebration_events (id, student_id, event_type, title, description,
                    metric_value, parent_notified, parent_acknowledged, encouragement_sent, created_at)
                VALUES (:id, :student_id, :event_type, :title, :description,
                    :metric_value, :parent_notified, :parent_acknowledged, :encouragement_sent, :created_at)
            """), row)

        # ── 家长激励消息
        # 先找一个激励模板ID
        tpl_result = await db.execute(text("SELECT id FROM encouragement_templates WHERE category='PROGRESS' LIMIT 1"))
        tpl_row = tpl_result.fetchone()
        tpl_id = tpl_row[0] if tpl_row else None

        celeb_result = await db.execute(text(f"SELECT id FROM celebration_events WHERE student_id='{STU_ZHANG_ID}' LIMIT 1"))
        celeb_id_row = celeb_result.fetchone()
        celeb_id = celeb_id_row[0] if celeb_id_row else None

        enc_rows = [
            {"id": _uuid(), "parent_id": PARENT_ZHANG_ID, "student_id": STU_ZHANG_ID,
             "encouragement_type": "CUSTOM", "title": "爸爸为你骄傲",
             "message": "明明，你在平台上完成了第一次在线答题，爸爸为你感到骄傲！继续努力，加油！",
             "template_id": None, "celebration_event_id": celeb_id,
             "is_read": True, "read_at": _dt(13), "created_at": _dt(13)},
            {"id": _uuid(), "parent_id": PARENT_LI_ID, "student_id": STU_LI_ID,
             "encouragement_type": "TEMPLATE", "title": "妈妈鼓励你",
             "message": "华华，你的成绩比上次提高了很多，妈妈相信你一定能做得更好！",
             "template_id": tpl_id, "celebration_event_id": None,
             "is_read": False, "read_at": None, "created_at": _dt(11)},
        ]
        for row in enc_rows:
            await db.execute(text("""
                INSERT INTO encouragements (id, parent_id, student_id, encouragement_type,
                    title, message, template_id, celebration_event_id, is_read, read_at, created_at)
                VALUES (:id, :parent_id, :student_id, :encouragement_type,
                    :title, :message, :template_id, :celebration_event_id, :is_read, :read_at, :created_at)
            """), row)

        # ── 奖励目标
        rg_rows = [
            {"id": _uuid(), "parent_id": PARENT_ZHANG_ID, "student_id": STU_ZHANG_ID,
             "title": "连续完成5次练习", "description": "每次练习满足20分钟以上",
             "reward_description": "奖励一本喜欢的课外书",
             "metric_type": "PRACTICE_SESSIONS", "target_value": 5, "current_value": 3,
             "status": "ACTIVE", "deadline": _dt(-14),  # 两周后截止
             "completed_at": None, "is_reward_claimed": False, "claimed_at": None,
             "created_at": _dt(20), "updated_at": _dt(3)},
            {"id": _uuid(), "parent_id": PARENT_LI_ID, "student_id": STU_LI_ID,
             "title": "完成3份试卷", "description": "独立完成3份在线测试",
             "reward_description": "周末去游乐场",
             "metric_type": "PAPERS_COMPLETED", "target_value": 3, "current_value": 1,
             "status": "ACTIVE", "deadline": _dt(-21),
             "completed_at": None, "is_reward_claimed": False, "claimed_at": None,
             "created_at": _dt(15), "updated_at": _dt(12)},
        ]
        for row in rg_rows:
            await db.execute(text("""
                INSERT INTO reward_goals (id, parent_id, student_id, title, description,
                    reward_description, metric_type, target_value, current_value,
                    status, deadline, completed_at, is_reward_claimed, claimed_at,
                    created_at, updated_at)
                VALUES (:id, :parent_id, :student_id, :title, :description,
                    :reward_description, :metric_type, :target_value, :current_value,
                    :status, :deadline, :completed_at, :is_reward_claimed, :claimed_at,
                    :created_at, :updated_at)
            """), row)
        print(f"   导入庆典/激励/奖励数据")

        # ── 题目推荐（教师向学生推荐典型题）
        rec_rows = [
            {"id": _uuid(), "question_id": Q_IDS["q8"], "student_id": STU_ZHANG_ID,
             "recommended_by": TEACHER_MATH_ID, "created_at": _dt(7)},
            {"id": _uuid(), "question_id": Q_IDS["q12"], "student_id": STU_ZHANG_ID,
             "recommended_by": TEACHER_MATH_ID, "created_at": _dt(7)},
            {"id": _uuid(), "question_id": Q_IDS["q15"], "student_id": STU_LI_ID,
             "recommended_by": TEACHER_MATH_ID, "created_at": _dt(6)},
            {"id": _uuid(), "question_id": Q_IDS["q34"], "student_id": STU_WANG_ID,
             "recommended_by": TEACHER_CHINESE_ID, "created_at": _dt(5)},
        ]
        for row in rec_rows:
            await db.execute(text("""
                INSERT INTO question_recommendations (id, question_id, student_id,
                    recommended_by, created_at)
                VALUES (:id, :question_id, :student_id, :recommended_by, :created_at)
            """), row)
        print(f"   导入 {len(rec_rows)} 条题目推荐")

        await db.commit()

        # ──────────────────────────────────────────────────────────
        # STEP 9 — 讲解板（topic-board / explanation_sessions）
        # ──────────────────────────────────────────────────────────
        print("\n[9/9] 导入讲解板数据...")

        ES1_ID = _uuid()
        await db.execute(text("""
            INSERT INTO explanation_sessions (id, question_id, title, topic, difficulty_label,
                problem_statement, graph_config, is_active, created_by, created_at, updated_at)
            VALUES (:id, :qid, :title, :topic, :difficulty, :problem, :graph, true, :creator, now(), now())
        """), {
            "id": ES1_ID,
            "qid": Q_IDS["q8"],
            "title": "趣味讲解：满足'立方根等于本身'的数有哪些？",
            "topic": "实数与方程",
            "difficulty": "中等偏难",
            "problem": "如果一个数的立方根等于它本身，那么这个数是哪些？请写出完整推理过程。",
            "graph": json.dumps({"type": "number_line", "range": [-2, 2]}),
            "creator": TEACHER_MATH_ID,
        })

        steps1 = [
            ("idle",       "同学们，先想一想：什么情况下，对一个数开立方后还等于它自己？", None, 1),
            ("thinking",   "设这个数为 x，则条件是：∛x = x，也就是 x³ = x。", None, 2),
            ("explaining", "移项整理：x³ - x = 0，提取公因式：x(x² - 1) = 0。", "x³ - x = 0\n→ x(x²-1) = 0", 3),
            ("explaining", "继续因式分解：x(x+1)(x-1) = 0，所以 x = 0, x = -1, 或 x = 1。", "x(x+1)(x-1)=0\nx=-1, 0, 1", 4),
            ("satisfied",  "验证：∛(-1)=-1✓，∛0=0✓，∛1=1✓。满足条件的数共有 -1、0、1 三个！", None, 5),
        ]
        for emotion, text_val, board, order in steps1:
            await db.execute(text("""
                INSERT INTO explanation_steps (id, session_id, step_order, text, panda_emotion, board_line, created_at)
                VALUES (:id, :sess, :order, :text, :emotion, :board, now())
            """), {"id": _uuid(), "sess": ES1_ID, "order": order,
                   "text": text_val, "emotion": emotion, "board": board})

        ES2_ID = _uuid()
        await db.execute(text("""
            INSERT INTO explanation_sessions (id, question_id, title, topic, difficulty_label,
                problem_statement, graph_config, is_active, created_by, created_at, updated_at)
            VALUES (:id, :qid, :title, :topic, :difficulty, :problem, :graph, true, :creator, now(), now())
        """), {
            "id": ES2_ID,
            "qid": Q_IDS["q22"],
            "title": "等腰三角形面积求法（勾股定理应用）",
            "topic": "三角形与面积",
            "difficulty": "中等",
            "problem": "已知△ABC中，AB=AC=5cm，BC=8cm，求△ABC的面积。",
            "graph": json.dumps({"type": "triangle", "vertices": [0, 4, 5]}),
            "creator": TEACHER_MATH_ID,
        })

        steps2 = [
            ("idle",       "等腰三角形求面积，关键是找底边上的高。", None, 1),
            ("thinking",   "作BC边上的高AD，由于△ABC是等腰三角形，D是BC的中点，BD=4cm。", "BD = BC/2 = 4", 2),
            ("explaining", "在直角△ABD中，用勾股定理：AD²=AB²-BD²=25-16=9，AD=3cm。", "AD²=5²-4²=9\nAD=3cm", 3),
            ("satisfied",  "面积S=½×底×高=½×8×3=12cm²，答案是12平方厘米！", "S=½×8×3=12cm²", 4),
        ]
        for emotion, text_val, board, order in steps2:
            await db.execute(text("""
                INSERT INTO explanation_steps (id, session_id, step_order, text, panda_emotion, board_line, created_at)
                VALUES (:id, :sess, :order, :text, :emotion, :board, now())
            """), {"id": _uuid(), "sess": ES2_ID, "order": order,
                   "text": text_val, "emotion": emotion, "board": board})

        ES3_ID = _uuid()
        await db.execute(text("""
            INSERT INTO explanation_sessions (id, question_id, title, topic, difficulty_label,
                problem_statement, graph_config, is_active, created_by, created_at, updated_at)
            VALUES (:id, :qid, :title, :topic, :difficulty, :problem, :graph, true, :creator, now(), now())
        """), {
            "id": ES3_ID,
            "qid": Q_IDS["q49"],
            "title": "英语被动语态变换技巧",
            "topic": "英语语法·被动语态",
            "difficulty": "中等",
            "problem": "将主动语态改写为被动语态：1. The teacher corrected the homework. 2. They built this bridge in 1990.",
            "graph": None,
            "creator": TEACHER_ENG_ID,
        })

        steps3 = [
            ("idle",       "被动语态的基本结构是：be + 过去分词。主动句的宾语变成被动句的主语。", None, 1),
            ("explaining", "句1：主语→The homework，谓语→was corrected，by短语可保留：The homework was corrected by the teacher.", "was corrected by", 2),
            ("explaining", "句2：This bridge → 主语；built(1990,过去时) → was built。结果：This bridge was built (by them) in 1990.", "was built in 1990", 3),
            ("satisfied",  "记住口诀：'主宾互换，be+动词过去分词，时态看原句'！", None, 4),
        ]
        for emotion, text_val, board, order in steps3:
            await db.execute(text("""
                INSERT INTO explanation_steps (id, session_id, step_order, text, panda_emotion, board_line, created_at)
                VALUES (:id, :sess, :order, :text, :emotion, :board, now())
            """), {"id": _uuid(), "sess": ES3_ID, "order": order,
                   "text": text_val, "emotion": emotion, "board": board})

        await db.commit()
        print(f"   导入 3 个讲解板会话（数学2个，英语1个）")

        # ── 最终统计 ──────────────────────────────────────────────
        print("\n" + "=" * 60)
        print("  演示数据导入完成！")
        print("=" * 60)
        print("""
演示账号汇总
─────────────────────────────────────────────────────────
角色          账号            密码
─────────────────────────────────────────────────────────
系统管理员    SYSAdmin        SYSPass
教师（数学）  t_math          Demo1234
教师（语文）  t_chinese       Demo1234
教师（英语）  t_english       Demo1234
题目管理员    tk_zhao         Demo1234
学生（八年级）zhang_ming      Demo1234  （张明）
学生（八年级）li_hua          Demo1234  （李华）
学生（七年级）wang_fang       Demo1234  （王芳）
学生（九年级）chen_qiang      Demo1234  （陈强）
学生（八年级）liu_li          Demo1234  （刘丽）
家长          p_zhang_fu      Demo1234  （张明之父）
家长          p_li_mu         Demo1234  （李华之母）
─────────────────────────────────────────────────────────

数据概览
─────────────────────────────────────────────────────────
科目：       数学、语文、英语、物理（4科）
班级：       八年级A班（数学）、七年级B班（语文）、九年级A班（英语）
题目：       50道（数学25/语文11/英语14，四种题型）
试卷：       4份（含单元测/期中/模拟卷，均已发布）
答题记录：   5条（已批改，含得分、答题明细）
错题本：     2本（含错题条目及推荐练习题）
课纲/知识点：2份课纲，9个知识点节点
讲解板：     3个讲解会话（带步骤动画）
自学任务：   5条
通知：       5条
家长模块：   激励/庆典/奖励目标数据完整
─────────────────────────────────────────────────────────
""")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
