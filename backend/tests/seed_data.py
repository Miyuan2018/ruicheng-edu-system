"""Seed test data: syllabus + knowledge_nodes + questions with JSON options."""
import sys, asyncio, json as _json
sys.path.insert(0, ".")
from app.db.session import AsyncSessionLocal
from app.models.syllabus import Syllabus
from app.models.knowledge_node import KnowledgeNode
from app.models.question import Question
from app.models.admin import Admin
from app.models.sys_admin import SysAdmin
from app.core.security import get_password_hash
from sqlalchemy import select


Q = lambda o,c: _json.dumps({"options":o,"correct_answer":c}, ensure_ascii=False)
OPT = lambda *args: [{"label":a,"text":b} for a,b in args]


async def seed():
    async with AsyncSessionLocal() as db:
        # ── SYSAdmin ──
        r = await db.execute(select(SysAdmin).where(SysAdmin.username == "SYSAdmin"))
        sys_admin = r.scalar_one_or_none()
        if not sys_admin:
            sys_admin = SysAdmin(username="SYSAdmin", password_hash=get_password_hash("SYSPass"), full_name="系统管理员")
            db.add(sys_admin); await db.flush()

        # ── Teacher ──
        r = await db.execute(select(Admin).where(Admin.username == "teacher1"))
        teacher = r.scalar_one_or_none()
        if not teacher:
            teacher = Admin(username="teacher1", password_hash=get_password_hash("Teacher123"),
                full_name="王老师", admin_type=0, phone="13800001111",
                qualification="T20240001", created_by=sys_admin.id)
            db.add(teacher); await db.flush()

        # ── Syllabus ──
        r = await db.execute(select(Syllabus).where(Syllabus.title == "八年级数学(上海)"))
        syllabus = r.scalar_one_or_none()
        if not syllabus:
            syllabus = Syllabus(title="八年级数学(上海)", grade_level="八年级", province="上海",
                subject="数学", version=1, is_current=True, status="ACTIVE", created_by=teacher.id,
                knowledge_tree={"name":"八年级数学","children":[
                    {"name":"数与代数","children":[{"name":"一元二次方程"},{"name":"二次函数"},{"name":"分式与根式"}]},
                    {"name":"图形与几何","children":[{"name":"勾股定理"},{"name":"平行四边形"},{"name":"相似三角形"}]},
                    {"name":"统计与概率","children":[{"name":"数据分析"},{"name":"概率初步"}]}]})
            db.add(syllabus); await db.flush()

        # ── Knowledge Nodes ──
        r = await db.execute(select(KnowledgeNode).where(KnowledgeNode.syllabus_id == syllabus.id))
        if not r.scalars().all():
            nodes = [("数与代数","AREA",None,1),("一元二次方程","POINT","数与代数",1),("二次函数","POINT","数与代数",2),("分式与根式","POINT","数与代数",3),
                     ("图形与几何","AREA",None,2),("勾股定理","POINT","图形与几何",1),("平行四边形","POINT","图形与几何",2),("相似三角形","POINT","图形与几何",3),
                     ("统计与概率","AREA",None,3),("数据分析","POINT","统计与概率",1),("概率初步","POINT","统计与概率",2)]
            nm = {}
            for name,nt,parent,sort in nodes:
                node = KnowledgeNode(syllabus_id=syllabus.id, parent_id=nm.get(parent), name=name, node_type=nt, sort_order=sort, version=1, is_active=True)
                db.add(node); nm[name] = node.id
            await db.flush()

        # ── Questions (43题, JSON options) ──
        r = await db.execute(select(Question).limit(1))
        if not r.scalar_one_or_none():
            QS = [
                # ═══ 一元二次方程(7) ═══
                ("方程2x²+3x-2=0的判别式Δ=?", "SINGLE_CHOICE", "EASY", 5,
                 Q(OPT(("A","25"),("B","17"),("C","1"),("D","-7")), "C"),
                 "Δ=b²-4ac=9+16=25", ["一元二次方程"]),
                ("解方程 x²-5x+6=0", "FILL_BLANK", "MEDIUM", 10,
                 Q(None, ["x=2或x=3","2或3"]),
                 "因式分解得(x-2)(x-3)=0", ["一元二次方程"]),
                ("解不等式 2x-3>5", "FILL_BLANK", "EASY", 3,
                 Q(None, ["x>4"]), "2x>8,x>4", ["一元二次方程"]),
                ("关于x的方程(k-1)x²+2x+1=0有实根,求k范围", "SUBJECTIVE", "HARD", 15,
                 Q(None, {"keywords":["判别式","k≠1","k≤2"],"max_score":15}),
                 "分k=1和k≠1讨论判别式", ["一元二次方程"]),
                ("x²-6x+()=(x-())² 填空", "FILL_BLANK", "EASY", 3,
                 Q(None, ["9,3","9 3"]), "配方法", ["一元二次方程"]),
                ("方程x²-4x=0的解是?", "MULTIPLE_CHOICE", "EASY", 5,
                 Q(OPT(("A","x=0"),("B","x=4"),("C","x=2"),("D","x=-2")), ["A","B"]),
                 "x(x-4)=0", ["一元二次方程"]),
                ("一元二次方程两根之和为?", "SINGLE_CHOICE", "MEDIUM", 5,
                 Q(OPT(("A","c/a"),("B","-b/a"),("C","b/a"),("D","-c/a")), "B"),
                 "韦达定理", ["一元二次方程"]),
                # ═══ 二次函数(6) ═══
                ("y=x²-4x+3的顶点坐标?", "SINGLE_CHOICE", "MEDIUM", 5,
                 Q(OPT(("A","(2,7)"),("B","(2,-1)"),("C","(-2,15)"),("D","(4,3)")), "B"),
                 "配方得y=(x-2)²-1", ["二次函数"]),
                ("y=-2(x+1)²+3开口方向?", "SINGLE_CHOICE", "EASY", 3,
                 Q(OPT(("A","向下"),("B","向上"),("C","向左"),("D","向右")), "A"),
                 "a<0开口向下", ["二次函数"]),
                ("y=x²+2x-3与x轴交点个数?", "SINGLE_CHOICE", "MEDIUM", 5,
                 Q(OPT(("A","0个"),("B","1个"),("C","2个"),("D","3个")), "C"),
                 "Δ=16>0", ["二次函数"]),
                ("y=x²向右平移2个单位?", "FILL_BLANK", "EASY", 3,
                 Q(None, ["y=(x-2)²"]), "右移x→x-2", ["二次函数"]),
                ("y=-(x-1)²+4最大值?", "FILL_BLANK", "EASY", 3,
                 Q(None, ["4"]), "顶点(1,4)", ["二次函数"]),
                ("判断y=ax²+bx+c中a的正负", "SUBJECTIVE", "MEDIUM", 10,
                 Q(None, {"keywords":["开口向上","a>0"],"max_score":10}),
                 "开口向上→a>0", ["二次函数"]),
                # ═══ 分式与根式(6) ═══
                ("化简√8+√18", "FILL_BLANK", "EASY", 5,
                 Q(None, ["5√2"]), "√8=2√2,√18=3√2", ["分式与根式"]),
                ("(x+2)/(x-1)+3/(1-x)", "FILL_BLANK", "HARD", 15,
                 Q(None, ["1"]), "通分化简", ["分式与根式"]),
                ("(x-2)/(x+3)有意义范围?", "SINGLE_CHOICE", "EASY", 3,
                 Q(OPT(("A","x=2"),("B","x=3"),("C","x=-2"),("D","x≠-3")), "D"),
                 "分母≠0", ["分式与根式"]),
                ("√12×√3=?", "FILL_BLANK", "EASY", 3,
                 Q(None, ["6"]), "√36=6", ["分式与根式"]),
                ("化简(x²-4)/(x+2)", "FILL_BLANK", "MEDIUM", 5,
                 Q(None, ["x-2"]), "因式分解", ["分式与根式"]),
                ("1/(√2+1)分母有理化", "FILL_BLANK", "HARD", 10,
                 Q(None, ["√2-1"]), "乘共轭", ["分式与根式"]),
                # ═══ 勾股定理(6) ═══
                ("Rt△ABC,∠C=90°,AC=3,BC=4,AB=?", "FILL_BLANK", "EASY", 5,
                 Q(None, ["5"]), "3²+4²=25", ["勾股定理"]),
                ("哪组能构成直角三角形?", "SINGLE_CHOICE", "EASY", 5,
                 Q(OPT(("A","1,2,3"),("B","2,3,4"),("C","4,5,6"),("D","3,4,5")), "D"),
                 "3²+4²=5²", ["勾股定理"]),
                ("等腰Rt△直角边1,斜边?", "FILL_BLANK", "EASY", 3,
                 Q(None, ["√2"]), "1²+1²=2", ["勾股定理"]),
                ("旗杆折断问题,原高?", "FILL_BLANK", "MEDIUM", 10,
                 Q(None, ["16"]), "6²+8²=100", ["勾股定理"]),
                ("勾股定理逆定理用途?", "SINGLE_CHOICE", "EASY", 3,
                 Q(OPT(("A","求面积"),("B","求周长"),("C","判直角三角形"),("D","判等腰")), "C"),
                 "判断直角三角形", ["勾股定理"]),
                ("直角边5和12,斜边高?", "FILL_BLANK", "HARD", 15,
                 Q(None, ["60/13"]), "斜边13,面积30", ["勾股定理"]),
                # ═══ 平行四边形(5) ═══
                ("▱ABCD中AB=CD依据?", "SINGLE_CHOICE", "EASY", 3,
                 Q(OPT(("A","对边相等"),("B","对角相等"),("C","对边平行"),("D","对角线平分")), "A"),
                 "对边相等", ["平行四边形"]),
                ("▱对角线互相平分?", "SINGLE_CHOICE", "EASY", 3,
                 Q(OPT(("A","正确"),("B","错误")), "A"), "正确", ["平行四边形"]),
                ("矩形与▱最主要区别?", "SINGLE_CHOICE", "EASY", 3,
                 Q(OPT(("A","对边平行"),("B","四角直角"),("C","对角线平分"),("D","对边相等")), "B"),
                 "矩形四角直角", ["平行四边形"]),
                ("菱形AC=8,BD=6,面积?", "FILL_BLANK", "MEDIUM", 10,
                 Q(None, ["24"]), "48/2=24", ["平行四边形"]),
                ("正方形有矩形无的性质?", "MULTIPLE_CHOICE", "MEDIUM", 5,
                 Q(OPT(("A","四角直角"),("B","对边相等"),("C","对角线⊥"),("D","四边相等")), ["C","D"]),
                 "对角线⊥+四边相等", ["平行四边形"]),
                # ═══ 相似三角形(5) ═══
                ("面积比4:9,相似比?", "SINGLE_CHOICE", "MEDIUM", 5,
                 Q(OPT(("A","4:9"),("B","2:3"),("C","16:81"),("D","3:2")), "B"),
                 "面积比=相似比²", ["相似三角形"]),
                ("△ABC∽△DEF,AB=6,DE=9,相似比?", "FILL_BLANK", "EASY", 3,
                 Q(None, ["2:3"]), "6:9=2:3", ["相似三角形"]),
                ("判定相似条件?", "MULTIPLE_CHOICE", "MEDIUM", 5,
                 Q(OPT(("A","两角相等"),("B","两边成比例+夹角等"),("C","三边成比例"),("D","面积相等")), ["A","B","C"]),
                 "三个判定定理", ["相似三角形"]),
                ("DE∥BC,AD:DB=2:3,DE:BC?", "FILL_BLANK", "MEDIUM", 10,
                 Q(None, ["2:5"]), "AD:AB=2:5", ["相似三角形"]),
                ("相似三角形对应高比=?", "SINGLE_CHOICE", "EASY", 3,
                 Q(OPT(("A","相似比"),("B","面积比"),("C","周长比"),("D","1")), "A"),
                 "对应高比=相似比", ["相似三角形"]),
                # ═══ 数据分析(4) ═══
                ("2,3,5,7,8中位数?", "FILL_BLANK", "EASY", 3,
                 Q(None, ["5"]), "中间值", ["数据分析"]),
                ("1,2,2,3,4,4,4,5众数?", "FILL_BLANK", "EASY", 3,
                 Q(None, ["4"]), "最多出现", ["数据分析"]),
                ("查全校视力最合适?", "SINGLE_CHOICE", "EASY", 3,
                 Q(OPT(("A","普查"),("B","抽样调查"),("C","逐个查"),("D","电话查")), "B"),
                 "抽样调查", ["数据分析"]),
                ("2,4,6,8,10平均数?", "FILL_BLANK", "MEDIUM", 10,
                 Q(None, ["6"]), "和/5=6", ["数据分析"]),
                # ═══ 概率初步(4) ═══
                ("骰子偶数概率?", "SINGLE_CHOICE", "EASY", 3,
                 Q(OPT(("A","1/3"),("B","1/6"),("C","1/2"),("D","2/3")), "C"),
                 "3/6=1/2", ["概率初步"]),
                ("抽扑克红桃概率?", "FILL_BLANK", "EASY", 3,
                 Q(None, ["1/4"]), "13/52", ["概率初步"]),
                ("两硬币一正一反概率?", "SINGLE_CHOICE", "MEDIUM", 5,
                 Q(OPT(("A","1/4"),("B","1/3"),("C","1/2"),("D","3/4")), "C"),
                 "2/4=1/2", ["概率初步"]),
                ("3红2白取2红概率?", "FILL_BLANK", "HARD", 10,
                 Q(None, ["3/10"]), "C(3,2)/C(5,2)", ["概率初步"]),
            ]
            for title, qtype, diff, score, meta_json, expl, kps in QS:
                q = Question(title=title, question_type=qtype, difficulty=diff, subject="数学",
                    grade_level="八年级", score=score, correct_answer=str(meta_json),
                    explanation=expl, meta_data={"knowledge_points":kps, "answer_data":_json.loads(meta_json)},
                    source="MANUAL", review_status="APPROVED", created_by=teacher.id, is_active=True)
                db.add(q)
            print(f"Questions: {len(QS)}")

        await db.commit()
        print("Seed complete!")

if __name__ == "__main__":
    asyncio.run(seed())
