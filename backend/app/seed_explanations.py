"""Idempotent explanation session seeder — safe to call on every startup."""
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.explanation_session import ExplanationSession
from app.models.explanation_step import ExplanationStep


# ============================================================
# Problem 1: 二次函数 y=-x²+4x-3 的图像与性质
# ============================================================

PROBLEM_1 = {
    "title": "二次函数 y=-x²+4x-3 的图像与性质",
    "topic": "二次函数",
    "difficulty_label": "中等",
    "problem_statement": """
<div class="chalk-header">已知二次函数</div>
<div class="math display" data-latex="y = -x^2 + 4x - 3"></div>
<p class="chalk-note mt-2">求：开口方向、顶点坐标、与坐标轴的交点，并画出大致图像。</p>
""",
    "graph_config": {
        "fn": "-x^2 + 4*x - 3",
        "fn2": "",
        "fn3": "",
        "points": "[[1,0],[3,0],[0,-3],[2,1]]",
        "x_min": -2,
        "x_max": 6,
        "y_min": -6,
        "y_max": 4,
    },
    "steps": [
        {
            "step_order": 1,
            "text": "首先观察二次项系数 a=-1。因为 a<0，所以抛物线开口向下。",
            "panda_emotion": "explaining",
            "board_line": """
<span class="math" data-latex="a = -1 < 0"></span>
<span class="chalk-accent-yellow ml-4">∴ 抛物线开口向下</span>
""",
        },
        {
            "step_order": 2,
            "text": "用配方法求顶点。y = -(x²-4x)-3 = -(x-2)²+1。顶点 (2,1)，对称轴 x=2。",
            "panda_emotion": "thinking",
            "board_line": """
<span class="math display" data-latex="y = -(x-2)^2 + 1"></span>
<span class="chalk-accent-yellow ml-4">顶点 (2, 1)，对称轴 x = 2</span>
""",
        },
        {
            "step_order": 3,
            "text": "求与坐标轴的交点。与y轴交点：令 x=0，y=-3。与x轴交点：令 y=0，解得 x=1 或 x=3。",
            "panda_emotion": "explaining",
            "board_line": """
<span class="chalk-note">y轴交点:</span> <span class="math" data-latex="(0,-3)"></span>
<span class="chalk-note ml-4">x轴交点:</span> <span class="math" data-latex="(1,0)"></span> 和 <span class="math" data-latex="(3,0)"></span>
""",
        },
        {
            "step_order": 4,
            "text": "综上，这是一条开口向下的抛物线，顶点在最高点 (2,1)，与x轴交于 (1,0) (3,0)，与y轴交于 (0,-3)。",
            "panda_emotion": "satisfied",
            "board_line": """
<span class="chalk-accent-red">综上：</span>开口向下，顶点 <span class="math" data-latex="(2,1)"></span>，
交x轴于 <span class="math" data-latex="(1,0),(3,0)"></span>，
交y轴于 <span class="math" data-latex="(0,-3)"></span>
""",
        },
    ],
}

# ============================================================
# Problem 2: 函数 y=x² 与 y=2x+3 的交点问题
# ============================================================

PROBLEM_2 = {
    "title": "函数 y=x² 与 y=2x+3 的交点问题",
    "topic": "二次函数",
    "difficulty_label": "中等",
    "problem_statement": """
<div class="chalk-header">求两个函数的交点坐标</div>
<div class="math display" data-latex="\\begin{cases} y = x^2 \\\\ y = 2x + 3 \\end{cases}"></div>
""",
    "graph_config": {
        "fn": "x^2",
        "fn2": "2*x+3",
        "fn3": "",
        "points": "[[-1,1],[3,9]]",
        "x_min": -4,
        "x_max": 5,
        "y_min": -2,
        "y_max": 12,
    },
    "steps": [
        {
            "step_order": 1,
            "text": "联立方程：x² = 2x+3，整理得 x²-2x-3=0。",
            "panda_emotion": "explaining",
            "board_line": """
<span class="math display" data-latex="x^2 = 2x + 3"></span>
<span class="math display" data-latex="x^2 - 2x - 3 = 0"></span>
""",
        },
        {
            "step_order": 2,
            "text": "因式分解：(x-3)(x+1)=0。解得 x₁=3, x₂=-1。",
            "panda_emotion": "thinking",
            "board_line": """
<span class="math display" data-latex="(x-3)(x+1) = 0"></span>
<span class="chalk-accent-yellow ml-4">x₁ = 3，x₂ = -1</span>
""",
        },
        {
            "step_order": 3,
            "text": "代回 y=x² 求 y。x=3 → y=9，x=-1 → y=1。交点：(3,9) 和 (-1,1)。",
            "panda_emotion": "explaining",
            "board_line": """
<span class="chalk-note">x=3:</span> <span class="math" data-latex="y=3^2=9"></span> → <span class="chalk-accent-yellow">(3,9)</span>
<span class="chalk-note ml-4">x=-1:</span> <span class="math" data-latex="y=(-1)^2=1"></span> → <span class="chalk-accent-yellow">(-1,1)</span>
""",
        },
        {
            "step_order": 4,
            "text": "从图可见，抛物线 y=x² 与直线 y=2x+3 交于 (-1,1) 和 (3,9) 两点。交点即两函数值相等的位置。",
            "panda_emotion": "satisfied",
            "board_line": """
<span class="chalk-accent-red">综上：</span>
<span class="math" data-latex="y=x^2"></span> 与 <span class="math" data-latex="y=2x+3"></span>
交于 <span class="chalk-accent-yellow">(-1,1)</span> 和 <span class="chalk-accent-yellow">(3,9)</span>
""",
        },
    ],
}

# ============================================================
# Problem 3: 高考压轴 — 椭圆 + 二次函数 + 复数
# ============================================================

PROBLEM_3 = {
    "title": "椭圆、二次函数与复数的综合问题",
    "topic": "解析几何·复数",
    "difficulty_label": "高考压轴",
    "problem_statement": """
<div class="chalk-header">已知</div>
<div style="margin:8px 0;">
在复平面内，满足 <span class="math" data-latex="|z-1|+|z+1|=4"></span>
的复数 <span class="math" data-latex="z"></span> 对应的点的集合为曲线 <span class="math" data-latex="C"></span>。
</div>
<div style="margin:8px 0;">
二次函数 <span class="math" data-latex="f(x)=px^2+qx+r\\;(p\\lt 0)"></span>
的图像为抛物线 <span class="math" data-latex="P"></span>。
</div>
<div style="margin:8px 0;">
<span class="math" data-latex="P"></span> 过 <span class="math" data-latex="C"></span> 的两个焦点，
且 <span class="math" data-latex="P"></span> 的顶点 <span class="math" data-latex="M"></span> 在 <span class="math" data-latex="C"></span> 上。
</div>
<hr style="border-color:#F5F0E820;margin:10px 0;">
<div class="chalk-note">
(1) 求 C 的标准方程、焦点坐标和离心率；<br>
(2) 求抛物线 P 的方程；<br>
(3) 求 C 与 P 的所有交点，记为复数 <span class="math" data-latex="z_k=x_k+y_k i"></span>，
计算所有交点对应复数之积的模。
</div>
""",
    "graph_config": {
        "fn": "sqrt(3 - 3*x^2/4)",
        "fn2": "-sqrt(3 - 3*x^2/4)",
        "fn3": "-sqrt(3)*(x^2 - 1)",
        "points": "[[-1,0],[1,0],[0,1.7320508],[-1.3228756,-1.2990381],[1.3228756,-1.2990381]]",
        "x_min": -2.8,
        "x_max": 2.8,
        "y_min": -2.2,
        "y_max": 2.2,
    },
    "steps": [
        {
            "step_order": 1,
            "text": "条件 |z-1|+|z+1|=4 正是椭圆的定义：到两定点距离之和为常数。两定点 (±1,0) 为焦点，常数 4=2a。",
            "panda_emotion": "explaining",
            "board_line": """
<span class="chalk-accent-yellow">由椭圆定义：</span>
<span class="math" data-latex="|z-1|+|z+1|=4"></span>
<span class="chalk-note ml-2">→ 焦点 F₁(-1,0), F₂(1,0)</span>
""",
        },
        {
            "step_order": 2,
            "text": "2a=4，得 a=2。焦距 2c=2，得 c=1。由 b²=a²-c²=4-1=3，得 b=√3。椭圆中心在原点。",
            "panda_emotion": "explaining",
            "board_line": """
<span class="math" data-latex="2a=4\\;\\Rightarrow\\;a=2"></span>
<span class="math" data-latex="2c=2\\;\\Rightarrow\\;c=1"></span>
<span class="math" data-latex="b^2=a^2-c^2=4-1=3\\;\\Rightarrow\\;b=\\sqrt{3}"></span>
<br>
<span class="chalk-accent-yellow">C:</span>
<span class="math display" data-latex="\\frac{x^2}{4}+\\frac{y^2}{3}=1"></span>
<span class="chalk-note">离心率</span>
<span class="math" data-latex="e=\\frac{c}{a}=\\frac{1}{2}"></span>
""",
        },
        {
            "step_order": 3,
            "text": "P 过两焦点 (±1,0)，由对称性知 q=0。设 f(x)=p(x²-1)。顶点 M(0,-p) 需在 C 上。",
            "panda_emotion": "thinking",
            "board_line": """
<span class="chalk-accent-yellow">P 过焦点 (±1,0)：</span>
<span class="math" data-latex="f(1)=p+q+r=0"></span>
<span class="math" data-latex="f(-1)=p-q+r=0"></span>
<span class="chalk-note ml-2">→ q=0, r=-p</span>
<br>
<span class="math" data-latex="f(x)=p(x^2-1)"></span>
<span class="chalk-note">顶点 M(0,-p)</span>
""",
        },
        {
            "step_order": 4,
            "text": "M 在 C 上：0/4 + (-p)²/3 = 1 → p²=3。已知 p<0，故 p=-√3。P: y=-√3(x²-1)。",
            "panda_emotion": "explaining",
            "board_line": """
<span class="chalk-accent-yellow">M(0,-p) 在 C 上：</span>
<span class="math" data-latex="\\frac{0}{4}+\\frac{(-p)^2}{3}=1\\;\\Rightarrow\\;p^2=3"></span>
<br>
<span class="math" data-latex="p\\lt 0\\;\\Rightarrow\\;p=-\\sqrt{3}"></span>
<br>
<span class="chalk-accent-yellow">P:</span>
<span class="math display" data-latex="y=-\\sqrt{3}(x^2-1)"></span>
""",
        },
        {
            "step_order": 5,
            "text": "联立 C 与 P 求交点。将 y=-√3(x²-1) 代入椭圆方程化简。注意 √3 的平方恰好消去根号。",
            "panda_emotion": "thinking",
            "board_line": """
<span class="chalk-accent-yellow">联立：</span>
<span class="math" data-latex="\\frac{x^2}{4}+\\frac{(-\\sqrt{3}x^2+\\sqrt{3})^2}{3}=1"></span>
<br>
<span class="math" data-latex="\\frac{x^2}{4}+\\frac{3x^4-6x^2+3}{3}=1"></span>
<br>
<span class="math" data-latex="\\frac{x^2}{4}+x^4-2x^2+1=1"></span>
<br>
<span class="math" data-latex="x^4-\\frac{7}{4}x^2=0"></span>
""",
        },
        {
            "step_order": 6,
            "text": "x²(x²-7/4)=0。x=0 为二重根（切点），x=±√7/2 为两个交点。代回求 y 坐标。",
            "panda_emotion": "explaining",
            "board_line": """
<span class="math" data-latex="x^2(x^2-\\frac{7}{4})=0"></span>
<br>
<span class="math" data-latex="x=0"></span>（二重根—切点）
<span class="chalk-note ml-2">→ y=√3</span>
<br>
<span class="math" data-latex="x=\\pm\\frac{\\sqrt{7}}{2}"></span>
<span class="chalk-note ml-2">→ </span><span class="math" data-latex="y=-\\sqrt{3}(\\frac{7}{4}-1)=-\\frac{3\\sqrt{3}}{4}"></span>
""",
        },
        {
            "step_order": 7,
            "text": "交点为 A(0,√3) [切点], B(√7/2, -3√3/4), C(-√7/2, -3√3/4)。A 恰为抛物线顶点！",
            "panda_emotion": "satisfied",
            "board_line": """
<span class="chalk-accent-yellow">三个交点：</span>
<br>
<span class="math" data-latex="A(0,\\sqrt{3})"></span>
<span class="chalk-note">← 抛物线顶点（切点）</span>
<br>
<span class="math" data-latex="B(\\frac{\\sqrt{7}}{2},-\\frac{3\\sqrt{3}}{4})"></span>
<br>
<span class="math" data-latex="C(-\\frac{\\sqrt{7}}{2},-\\frac{3\\sqrt{3}}{4})"></span>
""",
        },
        {
            "step_order": 8,
            "text": "将交点表示为复数：z_A=i√3，z_B=√7/2 - i·3√3/4，z_C=-√7/2 - i·3√3/4。先求 z_B·z_C。",
            "panda_emotion": "thinking",
            "board_line": """
<span class="chalk-accent-yellow">复数表示：</span>
<br>
<span class="math" data-latex="z_A = i\\sqrt{3}"></span>
<br>
<span class="math" data-latex="z_B = \\frac{\\sqrt{7}}{2} - i\\frac{3\\sqrt{3}}{4}"></span>
<br>
<span class="math" data-latex="z_C = -\\frac{\\sqrt{7}}{2} - i\\frac{3\\sqrt{3}}{4}"></span>
""",
        },
        {
            "step_order": 9,
            "text": "z_B·z_C = (√7/2)² + (3√3/4)² = 7/4+27/16 = 55/16。再乘以 z_A：z_A·z_B·z_C = i√3·55/16。",
            "panda_emotion": "explaining",
            "board_line": """
<span class="math" data-latex="z_B\\cdot z_C = (\\frac{\\sqrt{7}}{2})^2+(\\frac{3\\sqrt{3}}{4})^2"></span>
<br>
<span class="math" data-latex="= \\frac{7}{4}+\\frac{27}{16} = \\frac{55}{16}"></span>
<br>
<span class="math" data-latex="z_A\\cdot z_B\\cdot z_C = i\\sqrt{3}\\cdot\\frac{55}{16}"></span>
""",
        },
        {
            "step_order": 10,
            "text": "|z_A·z_B·z_C| = |i√3·55/16| = 55√3/16。所有交点的复数之积的模为 55√3/16。",
            "panda_emotion": "satisfied",
            "board_line": """
<span class="chalk-accent-red">综上：</span>
<span class="math display" data-latex="|z_A\\cdot z_B\\cdot z_C| = \\frac{55\\sqrt{3}}{16}"></span>
<br>
<span class="chalk-note">
椭圆 C 与抛物线 P 有三个交点（一个切点 + 两个交点），
三个复数之积的模为 <span class="chalk-accent-yellow">55√3/16</span>。
</span>
""",
        },
    ],
}

ALL_PROBLEMS = [PROBLEM_1, PROBLEM_2, PROBLEM_3]


async def seed_explanation_data(db: AsyncSession):
    """Insert demo explanation sessions if none exist. Idempotent."""
    existing = await db.execute(select(ExplanationSession).limit(1))
    if existing.scalar_one_or_none():
        return

    for problem in ALL_PROBLEMS:
        session_id = str(uuid.uuid4())
        session = ExplanationSession(
            id=session_id,
            question_id=None,
            title=problem["title"],
            topic=problem["topic"],
            difficulty_label=problem["difficulty_label"],
            problem_statement=problem["problem_statement"],
            graph_config=problem["graph_config"],
            is_active=True,
        )
        db.add(session)
        await db.flush()

        for step_data in problem["steps"]:
            step = ExplanationStep(
                id=str(uuid.uuid4()),
                session_id=session_id,
                step_order=step_data["step_order"],
                text=step_data["text"],
                panda_emotion=step_data["panda_emotion"],
                board_line=step_data["board_line"],
            )
            db.add(step)

    await db.commit()
