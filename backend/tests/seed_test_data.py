"""
V2.3 测试数据：学生、试卷、答题记录、错题本
用法: cd backend && conda run -p /home/zhanglijun/conda_workspace python tests/seed_test_data.py
"""
import sys, asyncio, json as _json, uuid as _uuid, os
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.db.session import AsyncSessionLocal
from app.models.student import Student
from app.models.admin import Admin
from app.models.sys_admin import SysAdmin
from app.models.question import Question
from app.models.exam_paper import ExamPaper, exam_paper_questions
from app.models.answer_submission import AnswerSubmission
from app.models.answer_detail import AnswerDetail
from app.models.error_notebook import ErrorNotebook
from app.models.error_notebook_question import ErrorNotebookQuestion
from app.core.security import get_password_hash
from sqlalchemy import select, text


async def seed():
    async with AsyncSessionLocal() as db:
        # Enable FK support in SQLite
        await db.execute(text("PRAGMA foreign_keys = ON"))

        # ══════════════════════════════════════════════
        # 1. Admin accounts
        # ══════════════════════════════════════════════
        r = await db.execute(select(SysAdmin).where(SysAdmin.username == "SYSAdmin"))
        sys_admin = r.scalar_one_or_none()
        if not sys_admin:
            sys_admin = SysAdmin(username="SYSAdmin", password_hash=get_password_hash("SYSPass"),
                                 full_name="系统管理员")
            db.add(sys_admin); await db.flush()
            print("[OK] SYSAdmin created")

        r = await db.execute(select(Admin).where(Admin.username == "t01"))
        teacher = r.scalar_one_or_none()
        if not teacher:
            teacher = Admin(username="t01", password_hash=get_password_hash("th0001"),
                            full_name="王老师", admin_type=0, phone="13800001111",
                            qualification="T20240001", created_by=sys_admin.id)
            db.add(teacher); await db.flush()
            print("[OK] Teacher t01 created")

        r = await db.execute(select(Admin).where(Admin.username == "tk01"))
        qadmin = r.scalar_one_or_none()
        if not qadmin:
            qadmin = Admin(username="tk01", password_hash=get_password_hash("tk0001"),
                           full_name="题库管理员", admin_type=1, phone="13800002222",
                           qualification="Q20240001", created_by=sys_admin.id)
            db.add(qadmin); await db.flush()
            print("[OK] QuestionAdmin tk01 created")

        # ══════════════════════════════════════════════
        # 2. Student accounts
        # ══════════════════════════════════════════════
        r = await db.execute(select(Student).where(Student.username == "stu_111111"))
        stu_zhang = r.scalar_one_or_none()
        if not stu_zhang:
            stu_zhang = Student(username="stu_111111", password_hash=get_password_hash("123456"),
                                full_name="张三", phone="13900001111", grade="八年级", school="上海第一中学")
            db.add(stu_zhang); await db.flush()
            print("[OK] Student 张三 (stu_111111/123456)")

        r = await db.execute(select(Student).where(Student.username == "stu_222222"))
        stu_li = r.scalar_one_or_none()
        if not stu_li:
            stu_li = Student(username="stu_222222", password_hash=get_password_hash("123456"),
                             full_name="李四", phone="13900002222", grade="八年级", school="上海第一中学")
            db.add(stu_li); await db.flush()
            print("[OK] Student 李四 (stu_222222/123456)")

        # ══════════════════════════════════════════════
        # 3. Fetch existing questions
        # ══════════════════════════════════════════════
        r = await db.execute(select(Question).where(Question.is_active == True))
        all_qs = r.scalars().all()
        if not all_qs:
            print("[SKIP] No questions in DB — run seed_data.py first")
            await db.commit()
            return
        print(f"[INFO] Found {len(all_qs)} questions")

        # Build lookup by title prefix
        def find_q(title_prefix):
            for q in all_qs:
                if q.title and q.title.startswith(title_prefix):
                    return q
            return None

        # ══════════════════════════════════════════════
        # 4. Exam Papers (PUBLISHED)
        # ══════════════════════════════════════════════
        now = datetime.now(timezone.utc)

        r = await db.execute(select(ExamPaper).where(ExamPaper.title == "八年级数学单元测试一（一元二次方程）"))
        paper1 = r.scalar_one_or_none()
        if not paper1:
            paper1 = ExamPaper(title="八年级数学单元测试一（一元二次方程）",
                               description="一元二次方程章节单元测试，含选择、填空和解答题",
                               subject="数学", grade_level="八年级", status="PUBLISHED",
                               total_score=34, duration_minutes=40, created_by=teacher.id)
            db.add(paper1); await db.flush()

            # Assign questions: 一元二次方程(7 questions, select 5)
            q_map = [
                ("方程2x²+3x-2=0的判别式Δ=?", 5, 1),
                ("解方程 x²-5x+6=0", 10, 2),
                ("解不等式 2x-3>5", 3, 3),
                ("关于x的方程(k-1)x²+2x+1=0有实根,求k范围", 15, 4),
                ("方程x²-4x=0的解是?", 5, 5),
            ]
            for title_prefix, score, pos in q_map:
                q = find_q(title_prefix)
                if q:
                    await db.execute(
                        exam_paper_questions.insert().values(
                            id=_uuid.uuid4(), exam_paper_id=paper1.id,
                            question_id=q.id, position=pos, score=score))
            print("[OK] Paper 1: " + paper1.title)

        r = await db.execute(select(ExamPaper).where(ExamPaper.title == "八年级数学单元测试二（二次函数）"))
        paper2 = r.scalar_one_or_none()
        if not paper2:
            paper2 = ExamPaper(title="八年级数学单元测试二（二次函数）",
                               description="二次函数章节测试",
                               subject="数学", grade_level="八年级", status="PUBLISHED",
                               total_score=26, duration_minutes=30, created_by=teacher.id)
            db.add(paper2); await db.flush()
            q_map = [
                ("y=x²-4x+3的顶点坐标?", 5, 1),
                ("y=-2(x+1)²+3开口方向?", 3, 2),
                ("y=x²+2x-3与x轴交点个数?", 5, 3),
                ("y=x²向右平移2个单位?", 3, 4),
                ("判断y=ax²+bx+c中a的正负", 10, 5),
            ]
            for title_prefix, score, pos in q_map:
                q = find_q(title_prefix)
                if q:
                    await db.execute(
                        exam_paper_questions.insert().values(
                            id=_uuid.uuid4(), exam_paper_id=paper2.id,
                            question_id=q.id, position=pos, score=score))
            print("[OK] Paper 2: " + paper2.title)

        r = await db.execute(select(ExamPaper).where(ExamPaper.title == "八年级数学期中测试"))
        paper3 = r.scalar_one_or_none()
        if not paper3:
            paper3 = ExamPaper(title="八年级数学期中测试",
                               description="八年级上学期期中综合测试，覆盖数与代数、图形与几何",
                               subject="数学", grade_level="八年级", status="PUBLISHED",
                               total_score=64, duration_minutes=60, created_by=teacher.id)
            db.add(paper3); await db.flush()
            q_map = [
                ("方程2x²+3x-2=0的判别式Δ=?", 5, 1),
                ("解方程 x²-5x+6=0", 10, 2),
                ("y=x²-4x+3的顶点坐标?", 5, 3),
                ("化简√8+√18", 5, 4),
                ("Rt△ABC,∠C=90°,AC=3,BC=4,AB=?", 5, 5),
                ("▱ABCD中AB=CD依据?", 3, 6),
                ("面积比4:9,相似比?", 5, 7),
                ("2,3,5,7,8中位数?", 3, 8),
                ("骰子偶数概率?", 3, 9),
                ("关于x的方程(k-1)x²+2x+1=0有实根,求k范围", 15, 10),
            ]
            for title_prefix, score, pos in q_map:
                q = find_q(title_prefix)
                if q:
                    await db.execute(
                        exam_paper_questions.insert().values(
                            id=_uuid.uuid4(), exam_paper_id=paper3.id,
                            question_id=q.id, position=pos, score=score))
            print("[OK] Paper 3: " + paper3.title)

        r = await db.execute(select(ExamPaper).where(ExamPaper.title == "八年级数学综合练习（勾股定理+平行四边形）"))
        paper4 = r.scalar_one_or_none()
        if not paper4:
            paper4 = ExamPaper(title="八年级数学综合练习（勾股定理+平行四边形）",
                               description="几何综合练习",
                               subject="数学", grade_level="八年级", status="PUBLISHED",
                               total_score=41, duration_minutes=45, created_by=teacher.id)
            db.add(paper4); await db.flush()
            q_map = [
                ("Rt△ABC,∠C=90°,AC=3,BC=4,AB=?", 5, 1),
                ("哪组能构成直角三角形?", 5, 2),
                ("旗杆折断问题,原高?", 10, 3),
                ("▱ABCD中AB=CD依据?", 3, 4),
                ("▱对角线互相平分?", 3, 5),
                ("矩形与▱最主要区别?", 3, 6),
                ("菱形AC=8,BD=6,面积?", 10, 7),
                ("直角边5和12,斜边高?", 15, 8),
            ]
            for title_prefix, score, pos in q_map:
                q = find_q(title_prefix)
                if q:
                    await db.execute(
                        exam_paper_questions.insert().values(
                            id=_uuid.uuid4(), exam_paper_id=paper4.id,
                            question_id=q.id, position=pos, score=score))
            print("[OK] Paper 4: " + paper4.title)

        await db.flush()

        # ══════════════════════════════════════════════
        # 5. Answer Submissions (some with mistakes)
        # ══════════════════════════════════════════════

        async def create_submission(student, paper, answer_map):
            """answer_map: {q_title_prefix: (student_answer, is_correct, score_obtained)}"""
            # Check if already exists
            r = await db.execute(
                select(AnswerSubmission).where(
                    AnswerSubmission.student_id == student.id,
                    AnswerSubmission.exam_paper_id == paper.id))
            if r.scalar_one_or_none():
                return None

            sub = AnswerSubmission(
                student_id=student.id, exam_paper_id=paper.id,
                submission_type="ONLINE", status="GRADED",
                started_at=now - timedelta(minutes=35),
                submitted_at=now - timedelta(days=1),
                graded_at=now - timedelta(days=1, hours=-1))
            db.add(sub); await db.flush()

            total_score = 0
            correct_count = 0
            total_qs = 0
            for q_title_prefix, (stu_ans, is_correct, score) in answer_map.items():
                q = find_q(q_title_prefix)
                if not q:
                    continue
                detail = AnswerDetail(
                    answer_submission_id=sub.id,
                    question_id=q.id,
                    student_answer=stu_ans,
                    is_correct=is_correct,
                    score_obtained=score if is_correct else 0,
                    feedback="回答正确" if is_correct else "答案错误，请复习相关知识点")
                db.add(detail)
                total_score += score if is_correct else 0
                if is_correct:
                    correct_count += 1
                total_qs += 1

            sub.total_score = total_score
            sub.percentage = round(total_score / paper.total_score * 100, 1) if paper.total_score else 0
            return sub

        # 张三 — 单元测试一（3错2对）
        if stu_zhang:
            sub1 = await create_submission(stu_zhang, paper1, {
                "方程2x²+3x-2=0的判别式Δ=?": ("A", False, 5),      # wrong: answered A, correct is C
                "解方程 x²-5x+6=0": ("x=2或x=3", True, 10),        # correct
                "解不等式 2x-3>5": ("x>8", False, 3),               # wrong: answered x>8, correct x>4
                "关于x的方程(k-1)x²+2x+1=0有实根,求k范围": ("k≥0", False, 15),  # wrong
                "方程x²-4x=0的解是?": ("A", True, 5),              # correct (answered A and B, correct is A,B)
            })
            if sub1: print(f"[OK] 张三 → {paper1.title}: {sub1.total_score}分 ({sub1.percentage}%)")

            # 张三 — 单元测试二（1错4对）
            sub2 = await create_submission(stu_zhang, paper2, {
                "y=x²-4x+3的顶点坐标?": ("B", True, 5),
                "y=-2(x+1)²+3开口方向?": ("B", False, 3),          # wrong: answered B(向上), correct A(向下)
                "y=x²+2x-3与x轴交点个数?": ("C", True, 5),
                "y=x²向右平移2个单位?": ("y=(x-2)²", True, 3),
                "判断y=ax²+bx+c中a的正负": ("开口向上a>0", True, 10),
            })
            if sub2: print(f"[OK] 张三 → {paper2.title}: {sub2.total_score}分 ({sub2.percentage}%)")

            # 张三 — 期中测试（3错7对）
            sub3 = await create_submission(stu_zhang, paper3, {
                "方程2x²+3x-2=0的判别式Δ=?": ("C", True, 5),
                "解方程 x²-5x+6=0": ("x=2或x=3", True, 10),
                "y=x²-4x+3的顶点坐标?": ("A", False, 5),           # wrong
                "化简√8+√18": ("5√2", True, 5),
                "Rt△ABC,∠C=90°,AC=3,BC=4,AB=?": ("6", False, 5),  # wrong: answered 6, correct 5
                "▱ABCD中AB=CD依据?": ("A", True, 3),
                "面积比4:9,相似比?": ("A", False, 5),              # wrong: answered 4:9, correct 2:3
                "2,3,5,7,8中位数?": ("5", True, 3),
                "骰子偶数概率?": ("C", True, 3),
                "关于x的方程(k-1)x²+2x+1=0有实根,求k范围": ("k≤2且k≠1，需分类讨论", True, 15),
            })
            if sub3: print(f"[OK] 张三 → {paper3.title}: {sub3.total_score}分 ({sub3.percentage}%)")

        # 李四 — 单元测试一（4错1对）
        if stu_li:
            sub4 = await create_submission(stu_li, paper1, {
                "方程2x²+3x-2=0的判别式Δ=?": ("B", False, 5),
                "解方程 x²-5x+6=0": ("x=1或x=6", False, 10),
                "解不等式 2x-3>5": ("x>4", True, 3),
                "关于x的方程(k-1)x²+2x+1=0有实根,求k范围": ("k=1", False, 15),
                "方程x²-4x=0的解是?": ("C", False, 5),
            })
            if sub4: print(f"[OK] 李四 → {paper1.title}: {sub4.total_score}分 ({sub4.percentage}%)")

            # 李四 — 综合练习
            sub5 = await create_submission(stu_li, paper4, {
                "Rt△ABC,∠C=90°,AC=3,BC=4,AB=?": ("5", True, 5),
                "哪组能构成直角三角形?": ("D", True, 5),
                "旗杆折断问题,原高?": ("16", True, 10),
                "▱ABCD中AB=CD依据?": ("A", True, 3),
                "▱对角线互相平分?": ("A", True, 3),
                "矩形与▱最主要区别?": ("B", True, 3),
                "菱形AC=8,BD=6,面积?": ("48", False, 10),           # wrong: answered 48, correct 24
                "直角边5和12,斜边高?": ("13", False, 15),          # wrong: answered 13, correct 60/13
            })
            if sub5: print(f"[OK] 李四 → {paper4.title}: {sub5.total_score}分 ({sub5.percentage}%)")

        await db.flush()

        # ══════════════════════════════════════════════
        # 6. Error Notebooks (from wrong answers)
        # ══════════════════════════════════════════════
        async def create_notebook(student, paper, submission, days_ago=2):
            """Create error notebook from a submission's wrong answers."""
            r = await db.execute(
                select(ErrorNotebook).where(
                    ErrorNotebook.student_id == student.id,
                    ErrorNotebook.exam_paper_id == paper.id))
            if r.scalar_one_or_none():
                return None

            # Get wrong answer details
            r = await db.execute(
                select(AnswerDetail).where(
                    AnswerDetail.answer_submission_id == submission.id,
                    AnswerDetail.is_correct == False))
            wrong_details = r.scalars().all()

            if not wrong_details:
                return None

            nb = ErrorNotebook(
                student_id=student.id, exam_paper_id=paper.id,
                title=f"{paper.title} 错题本",
                description=f"从{paper.title}中生成的错题本",
                generated_at=now - timedelta(days=days_ago),
                question_count=len(wrong_details),
                status="GENERATED")
            db.add(nb); await db.flush()

            for detail in wrong_details:
                nbq = ErrorNotebookQuestion(
                    error_notebook_id=nb.id,
                    original_question_id=detail.question_id,
                    error_type="概念错误" if "概念" in (detail.feedback or "") else "理解偏差",
                    explanation=detail.feedback or "需要加强复习")
                db.add(nbq)

            return nb

        if stu_zhang:
            # Submissions exist — get them
            r = await db.execute(select(AnswerSubmission).where(
                AnswerSubmission.student_id == stu_zhang.id))
            subs = {str(s.exam_paper_id): s for s in r.scalars().all()}

            for paper, days_ago in [(paper1, 3), (paper2, 2), (paper3, 1)]:
                sub = subs.get(str(paper.id))
                if sub:
                    nb = await create_notebook(stu_zhang, paper, sub, days_ago)
                    if nb:
                        print(f"[OK] 错题本: {nb.title} ({nb.question_count}题)")

        if stu_li:
            r = await db.execute(select(AnswerSubmission).where(
                AnswerSubmission.student_id == stu_li.id))
            subs = {str(s.exam_paper_id): s for s in r.scalars().all()}

            for paper, days_ago in [(paper1, 4), (paper4, 2)]:
                sub = subs.get(str(paper.id))
                if sub:
                    nb = await create_notebook(stu_li, paper, sub, days_ago)
                    if nb:
                        print(f"[OK] 错题本: {nb.title} ({nb.question_count}题)")

        await db.commit()
        print("\n══════════════════════════════════════════════")
        print("  V2.3 测试数据初始化完成！")
        print("══════════════════════════════════════════════")
        print("")
        print("  学生账号：")
        print("    张三: stu_111111 / 123456")
        print("    李四: stu_222222 / 123456")
        print("")
        print("  教师账号：")
        print("    t01 / th0001")
        print("")
        print("  试卷（已发布）：")
        print(f"    1. {paper1.title} ({paper1.total_score}分)")
        print(f"    2. {paper2.title} ({paper2.total_score}分)")
        print(f"    3. {paper3.title} ({paper3.total_score}分)")
        print(f"    4. {paper4.title} ({paper4.total_score}分)")
        print("")


if __name__ == "__main__":
    asyncio.run(seed())
