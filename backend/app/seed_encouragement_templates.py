"""Seed encouragement message templates."""
import uuid
import logging
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.encouragement_template import EncouragementTemplate

logger = logging.getLogger(__name__)

TEMPLATES = [
    # ── EFFORT (努力) ────────────────────────────────────────────────────────
    {"category": "EFFORT", "title": "看到你的努力",
     "message_template": "我注意到你最近在学习上非常用心，这种努力的态度让我很欣慰。继续保持，结果一定不会让你失望！"},
    {"category": "EFFORT", "title": "认真的你最棒",
     "message_template": "看到你认真做题的样子，我真的很为你骄傲。不管结果如何，你的付出我都看在眼里。"},
    {"category": "EFFORT", "title": "每天进步一点点",
     "message_template": "哪怕每天只进步一点点，积累起来也是了不起的成长。你一直在努力，我都看到了。"},
    {"category": "EFFORT", "title": "坚持就是胜利",
     "message_template": "学习有时候确实不容易，但你没有放弃，这份坚持本身就很珍贵。"},

    # ── PROGRESS (进步) ──────────────────────────────────────────────────────
    {"category": "PROGRESS", "title": "正确率提高了",
     "message_template": "你最近的正确率有了明显提升，这是你努力的成果！相信你还会继续进步的。"},
    {"category": "PROGRESS", "title": "知识点掌握了更多",
     "message_template": "我发现你掌握的知识点越来越多了，照这样下去，考试对你来说会越来越轻松！"},
    {"category": "PROGRESS", "title": "错题减少了",
     "message_template": "你的错题数量比以前少了很多，说明你对知识的理解越来越深入了。"},
    {"category": "PROGRESS", "title": "速度也变快了",
     "message_template": "不仅正确率提高了，做题速度也变快了。你的进步是全方位的！"},

    # ── PERSISTENCE (坚持) ───────────────────────────────────────────────────
    {"category": "PERSISTENCE", "title": "连续学习好几天了",
     "message_template": "你已经连续学习了{streak}天，这种自律和坚持真的让人佩服！"},
    {"category": "PERSISTENCE", "title": "风雨无阻",
     "message_template": "不管多忙你都坚持每天练习，这种毅力以后做什么都会成功的。"},
    {"category": "PERSISTENCE", "title": "消灭错题的勇士",
     "message_template": "看到你一道一道地消灭错题，就像勇士在闯关一样，真了不起！"},
    {"category": "PERSISTENCE", "title": "不怕困难",
     "message_template": "遇到难题你没有退缩，而是勇敢面对并解决它，这种品质比成绩更重要。"},

    # ── COMPLETION (完成) ────────────────────────────────────────────────────
    {"category": "COMPLETION", "title": "又完成了一套试卷",
     "message_template": "恭喜你完成了这套试卷！每一次认真完成都是对自己负责的表现。"},
    {"category": "COMPLETION", "title": "今日任务达成",
     "message_template": "今天的学习任务全部完成了，辛苦啦！适当的休息也很重要哦。"},
    {"category": "COMPLETION", "title": "错题全部消灭",
     "message_template": "太棒了！你把这类错题全部搞懂了，这个知识点对你来说不再是难题了。"},
    {"category": "COMPLETION", "title": "阶段性目标达成",
     "message_template": "你达成了这个阶段的学习目标，值得庆祝一下！接下来我们一起设定新目标吧。"},

    # ── GENERAL (通用) ───────────────────────────────────────────────────────
    {"category": "GENERAL", "title": "加油！",
     "message_template": "无论遇到什么困难，记住有人在默默支持你、为你加油！"},
    {"category": "GENERAL", "title": "相信自己",
     "message_template": "你的潜力是无限的，相信自己，你比你想象的更优秀！"},
    {"category": "GENERAL", "title": "为你骄傲",
     "message_template": "不管成绩怎样，你都是让我骄傲的孩子。学习是一辈子的事，慢慢来。"},
    {"category": "GENERAL", "title": "注意休息",
     "message_template": "学习很重要，但身体更重要。记得适当休息，保持好的状态才能学得更好。"},
]


async def seed_encouragement_templates(db: AsyncSession) -> None:
    """Insert encouragement templates if the table is empty."""
    count = await db.scalar(select(func.count()).select_from(EncouragementTemplate))
    if count and count > 0:
        return

    for tpl_data in TEMPLATES:
        db.add(EncouragementTemplate(
            id=str(uuid.uuid4()),
            category=tpl_data["category"],
            title=tpl_data["title"],
            message_template=tpl_data["message_template"],
            is_active=True,
            usage_count=0,
        ))

    await db.commit()
    logger.info(f"Seeded {len(TEMPLATES)} encouragement templates")
