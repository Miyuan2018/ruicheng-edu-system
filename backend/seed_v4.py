"""V4 种子数据 — 丰富题库，确保组卷测试有足够的题目"""
import asyncio, uuid, sys
sys.path.insert(0, '.')

from app.db.session import AsyncSessionLocal
from app.models.question import Question
from app.models.admin import Admin

QUESTIONS = [
    # ═══ 单选题 EASY ═══
    ("实数 0 属于（）", "SINGLE_CHOICE", "EASY", "数学",
     '{"options":[{"label":"A","text":"正整数"},{"label":"B","text":"负整数"},{"label":"C","text":"整数"},{"label":"D","text":"无理数"}],"correct_answer":"C"}'),
    ("-5 的绝对值是（）", "SINGLE_CHOICE", "EASY", "数学",
     '{"options":[{"label":"A","text":"-5"},{"label":"B","text":"5"},{"label":"C","text":"0"},{"label":"D","text":"-1/5"}],"correct_answer":"B"}'),
    ("和 3+(-3) 的结果是（）", "SINGLE_CHOICE", "EASY", "数学",
     '{"options":[{"label":"A","text":"6"},{"label":"B","text":"-6"},{"label":"C","text":"0"},{"label":"D","text":"1"}],"correct_answer":"C"}'),
    ("若 x=2，则 3x+1 的值是（）", "SINGLE_CHOICE", "EASY", "数学",
     '{"options":[{"label":"A","text":"5"},{"label":"B","text":"6"},{"label":"C","text":"7"},{"label":"D","text":"8"}],"correct_answer":"C"}'),
    ("点 A(3,4) 到原点的距离等于（）", "SINGLE_CHOICE", "EASY", "数学",
     '{"options":[{"label":"A","text":"3"},{"label":"B","text":"4"},{"label":"C","text":"5"},{"label":"D","text":"7"}],"correct_answer":"C"}'),
    # ═══ 单选题 MEDIUM ═══
    ("不等式 2x-3>5 的解集是（）", "SINGLE_CHOICE", "MEDIUM", "数学",
     '{"options":[{"label":"A","text":"x>1"},{"label":"B","text":"x>4"},{"label":"C","text":"x>5"},{"label":"D","text":"x>8"}],"correct_answer":"B"}'),
    ("若一个三角形三边长分别为3,4,5，则它是（）", "SINGLE_CHOICE", "MEDIUM", "数学",
     '{"options":[{"label":"A","text":"锐角三角形"},{"label":"B","text":"直角三角形"},{"label":"C","text":"钝角三角形"},{"label":"D","text":"等边三角形"}],"correct_answer":"B"}'),
    ("函数 y=x²-4x+3 的顶点坐标是（）", "SINGLE_CHOICE", "MEDIUM", "数学",
     '{"options":[{"label":"A","text":"(1,0)"},{"label":"B","text":"(2,-1)"},{"label":"C","text":"(2,3)"},{"label":"D","text":"(3,0)"}],"correct_answer":"B"}'),
    ("已知等比数列首项为2，公比为3，则第4项等于（）", "SINGLE_CHOICE", "MEDIUM", "数学",
     '{"options":[{"label":"A","text":"24"},{"label":"B","text":"54"},{"label":"C","text":"48"},{"label":"D","text":"162"}],"correct_answer":"B"}'),
    # ═══ 单选题 HARD ═══
    ("已知函数 f(x)=|x-a|+|x-2a|，若 f(x)≥a² 对所有 x∈R 成立，则 a 的取值范围是（）", "SINGLE_CHOICE", "HARD", "数学",
     '{"options":[{"label":"A","text":"[-1,1]"},{"label":"B","text":"[-2,2]"},{"label":"C","text":"[-1,0]"},{"label":"D","text":"[0,1]"}],"correct_answer":"B"}'),
    ("△ABC 中，a=√3, b=1, B=30°，则 A 等于（）", "SINGLE_CHOICE", "HARD", "数学",
     '{"options":[{"label":"A","text":"60°"},{"label":"B","text":"60°或120°"},{"label":"C","text":"120°"},{"label":"D","text":"150°"}],"correct_answer":"B"}'),
    ("已知椭圆 x²/a²+y²/b²=1 (a>b>0) 的离心率为 √3/2，且过点(1,√3/2)，则椭圆方程为（）", "SINGLE_CHOICE", "HARD", "数学",
     '{"options":[{"label":"A","text":"x²/4+y²/3=1"},{"label":"B","text":"x²/4+y²=1"},{"label":"C","text":"x²/2+y²=1"},{"label":"D","text":"x²/3+y²/4=1"}],"correct_answer":"B"}'),

    # ═══ 填空题 EASY ═══
    ("2² × 3² = ________", "FILL_BLANK", "EASY", "数学", '{"correct_answer":["36"]}'),
    ("若 a+2=7，则 a = ________", "FILL_BLANK", "EASY", "数学", '{"correct_answer":["5"]}'),
    ("2/3 + 1/3 = ________", "FILL_BLANK", "EASY", "数学", '{"correct_answer":["1"]}'),
    ("正方体的棱长为2cm，则体积为 ________ cm³", "FILL_BLANK", "EASY", "数学", '{"correct_answer":["8"]}'),
    # ═══ 填空题 MEDIUM ═══
    ("若二次函数 y=ax²+bx+c 的对称轴为 x=2，且过点(0,3)和(4,3)，则 c = ________", "FILL_BLANK", "MEDIUM", "数学",
     '{"correct_answer":["3"]}'),
    ("等差数列首项 a₁=3，a₄=12，则公差 d = ________", "FILL_BLANK", "MEDIUM", "数学",
     '{"correct_answer":["3"]}'),
    ("若 log₂(x+2)=3，则 x = ________", "FILL_BLANK", "MEDIUM", "数学",
     '{"correct_answer":["6"]}'),
    # ═══ 填空题 HARD ═══
    ("若函数 f(x) 满足 f(x+1)+f(x-1)=2x²，且 f(0)=0，则 f(3)= ________", "FILL_BLANK", "HARD", "数学",
     '{"correct_answer":["6"]}'),
    ("已知向量 a=(1,2), b=(x,1)，若 a⊥b，则 x = ________", "FILL_BLANK", "HARD", "数学",
     '{"correct_answer":["-2"]}'),

    # ═══ 多选题 EASY ═══
    ("下列属于有理数的有（）", "MULTIPLE_CHOICE", "EASY", "数学",
     '{"options":[{"label":"A","text":"1/2"},{"label":"B","text":"√4"},{"label":"C","text":"√2"},{"label":"D","text":"3.14"}],"correct_answer":["A","B","D"]}'),
    ("下列图形中是轴对称图形的有（）", "MULTIPLE_CHOICE", "EASY", "数学",
     '{"options":[{"label":"A","text":"正方形"},{"label":"B","text":"平行四边形"},{"label":"C","text":"等腰三角形"},{"label":"D","text":"圆"}],"correct_answer":["A","C","D"]}'),
    # ═══ 多选题 MEDIUM ═══
    ("下列关于二次函数 y=x²-4x+3 的说法正确的有（）", "MULTIPLE_CHOICE", "MEDIUM", "数学",
     '{"options":[{"label":"A","text":"开口向上"},{"label":"B","text":"与x轴有两个交点"},{"label":"C","text":"顶点在x轴下方"},{"label":"D","text":"对称轴为x=2"}],"correct_answer":["A","B","D"]}'),
    ("下列不等式恒成立的有（）", "MULTIPLE_CHOICE", "MEDIUM", "数学",
     '{"options":[{"label":"A","text":"x²+1≥2x（x∈R）"},{"label":"B","text":"a²+b²≥2ab"},{"label":"C","text":"√x≥x（x≥0）"},{"label":"D","text":"sinx≤1"}],"correct_answer":["A","B","D"]}'),
    # ═══ 多选题 HARD ═══
    ("已知{an}是等比数列，下列命题正确的有（）", "MULTIPLE_CHOICE", "HARD", "数学",
     '{"options":[{"label":"A","text":"若q>1，则an递增"},{"label":"B","text":"{a2n}也是等比数列"},{"label":"C","text":"{1/an}也是等比数列（an≠0）"},{"label":"D","text":"若a1>0，q>1，则an递增"}],"correct_answer":["B","C","D"]}'),
    ("关于函数 f(x)=x³-3x，下列说法正确的有（）", "MULTIPLE_CHOICE", "HARD", "数学",
     '{"options":[{"label":"A","text":"f(x)是奇函数"},{"label":"B","text":"f(x)有两个极值点"},{"label":"C","text":"f(x)在R上单调递增"},{"label":"D","text":"f(x)过原点"}],"correct_answer":["A","B","D"]}'),

    # ═══ 解答题 EASY ═══
    ("解方程：2x - 5 = 3x + 2", "SUBJECTIVE", "EASY", "数学",
     '{"correct_answer":{"keywords":["x=-7","-7","移项","合并同类项"],"max_score":8}}'),
    ("已知一次函数 y=2x+1，求当 x=3 时 y 的值。", "SUBJECTIVE", "EASY", "数学",
     '{"correct_answer":{"keywords":["y=7","7","代入"],"max_score":6}}'),
    # ═══ 解答题 MEDIUM ═══
    ("证明：对角线相等的平行四边形是矩形。", "SUBJECTIVE", "MEDIUM", "数学",
     '{"correct_answer":{"keywords":["平行四边形","对角线相等","直角三角形","全等","矩形"],"max_score":12}}'),
    ("已知函数 f(x)=ln(x+1)，求 f(x) 的定义域，并判断其奇偶性。", "SUBJECTIVE", "MEDIUM", "数学",
     '{"correct_answer":{"keywords":["x>-1","定义域","(-1,+∞)","非奇非偶","奇偶性"],"max_score":10}}'),
    # ═══ 解答题 HARD ═══
    ("已知椭圆 C: x²/4+y²=1，过点 P(2,0) 的直线与 C 交于 A、B 两点，求 △OAB 面积的最大值。", "SUBJECTIVE", "HARD", "数学",
     '{"correct_answer":{"keywords":["椭圆","弦长","点到直线距离","面积","最值","1"],"max_score":15}}'),
    ("设数列 {an} 满足 a₁=1，a_{n+1}=2a_n+1 (n≥1)。(1) 求 a_n；(2) 求 S_n=a₁+a₂+...+a_n。",
     "SUBJECTIVE", "HARD", "数学",
     '{"correct_answer":{"keywords":["a_n=2^n-1","等比数列","通项","求和","S_n=2^{n+1}-n-2"],"max_score":14}}'),
]


async def seed():
    async with AsyncSessionLocal() as db:
        # Get or create a teacher to use as created_by
        from sqlalchemy import select
        from app.core.security import get_password_hash
        from app.models.sys_admin import SysAdmin
        r = await db.execute(select(Admin).where(Admin.admin_type == 0).limit(1))
        teacher = r.scalar_one_or_none()
        if not teacher:
            # Create sys_admin first (required FK)
            r2 = await db.execute(select(SysAdmin).limit(1))
            sysadmin = r2.scalar_one_or_none()
            if not sysadmin:
                sysadmin = SysAdmin(id=uuid.uuid4(), username='SYSAdmin', full_name='系统管理员',
                                    password_hash=get_password_hash('SYSPass'), is_active=True)
                db.add(sysadmin)
                await db.flush()
            teacher = Admin(
                id=uuid.uuid4(), username='th01',
                password_hash=get_password_hash('th0001'),
                admin_type=0, full_name='王老师', is_active=True,
                created_by=sysadmin.id,
            )
            db.add(teacher)
            await db.flush()
        teacher_id = teacher.id

        added = 0
        for title, qtype, diff, subject, answer in QUESTIONS:
            # Check if already exists
            r = await db.execute(
                select(Question).where(
                    Question.title == title,
                    Question.question_type == qtype,
                    Question.subject == subject,
                )
            )
            if r.scalar_one_or_none():
                continue

            q = Question(
                title=title,
                question_type=qtype,
                difficulty=diff,
                subject=subject,
                score=5,
                correct_answer=answer,
                source="MANUAL",
                review_status="APPROVED",
                is_active=True,
                created_by=teacher_id,
            )
            db.add(q)
            added += 1

        if added > 0:
            await db.commit()
            print(f"Added {added} new questions")
        else:
            print("All questions already exist")

        # Show distribution
        for qt in ['SINGLE_CHOICE','MULTIPLE_CHOICE','FILL_BLANK','SUBJECTIVE']:
            for diff in ['EASY','MEDIUM','HARD']:
                from sqlalchemy import func
                r = await db.execute(
                    select(func.count()).where(
                        Question.is_active==True,
                        Question.review_status=='APPROVED',
                        Question.question_type==qt,
                        Question.difficulty==diff,
                        Question.subject=='数学',
                    )
                )
                print(f'  {qt} {diff}: {r.scalar()}')


if __name__ == '__main__':
    asyncio.run(seed())
