"""Celery tasks for LLM question generation and web scraping."""
import asyncio
import json
import uuid
import logging
from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.celery_app import celery
from app.core.config import settings

logger = logging.getLogger(__name__)

# Sync engine for Celery workers (cannot use async sessions)
_sync_engine = create_engine(settings.DATABASE_URL, echo=False)
_SyncSession = sessionmaker(bind=_sync_engine, expire_on_commit=False)


def _update_task(session: Session, task_id: str, **kwargs):
    """Update QuestionTask fields."""
    from app.models.question_task import QuestionTask
    task = session.query(QuestionTask).filter(QuestionTask.id == task_id).first()
    if task:
        for k, v in kwargs.items():
            setattr(task, k, v)
        session.commit()


@celery.task(bind=True, name="generate_questions")
def generate_questions_task(
    self,
    task_id: str,
    knowledge_point: str,
    difficulty: str,
    question_type: str,
    count: int,
    subject: str,
    grade_level: str,
    model: str | None,
    provider: str,
    created_by: str,
):
    """Async LLM question generation via Celery."""
    from app.models.question_task import QuestionTask
    from app.models.question import Question
    from app.services.llm_service import generate_questions as llm_generate

    session: Session = _SyncSession()
    try:
        # Mark running
        _update_task(session, task_id, status="RUNNING",
                     started_at=datetime.now(timezone.utc))

        # Call async LLM service from sync context
        result = asyncio.run(llm_generate(
            knowledge_point=knowledge_point, difficulty=difficulty,
            question_type=question_type, count=count,
            subject=subject, grade_level=grade_level,
            model=model, provider=provider,
        ))

        if not result.get("ok"):
            _update_task(session, task_id, status="FAILED",
                         error_message=result.get("error", "生成失败"),
                         completed_at=datetime.now(timezone.utc))
            return {"ok": False, "error": result.get("error")}

        # Build grade_level JSON (same logic as sync endpoint)
        grade_json = {"scope": "grade", "grades": [grade_level] if grade_level else []}
        if knowledge_point:
            kps = [kp.strip() for kp in knowledge_point.split(",") if kp.strip()]
            if kps:
                grade_json["chapter"] = kps[0]
                grade_json["knowledge_points"] = kps

        generated_ids = []
        creator_uuid = uuid.UUID(created_by)
        for item in result["questions"]:
            correct_answer = item.get("correct_answer")
            if isinstance(correct_answer, (dict, list)):
                correct_answer = json.dumps(correct_answer, ensure_ascii=False)

            q = Question(
                title=item.get("title", ""),
                question_type=question_type, difficulty=difficulty,
                subject=subject, grade_level=grade_json,
                score=item.get("score", 5),
                correct_answer=correct_answer or "",
                explanation=item.get("explanation", ""),
                meta_data={"knowledge_points": [knowledge_point]},
                source="LLM_GENERATED", review_status="PENDING",
                source_task_id=uuid.UUID(task_id),
                created_by=creator_uuid,
            )
            session.add(q)
            session.flush()
            generated_ids.append(str(q.id))

        _update_task(session, task_id,
                     status="COMPLETED",
                     completed_items=len(generated_ids),
                     completed_at=datetime.now(timezone.utc),
                     result_summary={"generated_ids": generated_ids})

        return {"ok": True, "count": len(generated_ids)}

    except Exception as e:
        logger.exception("generate_questions_task failed")
        _update_task(session, task_id, status="FAILED",
                     error_message=str(e),
                     completed_at=datetime.now(timezone.utc))
        return {"ok": False, "error": str(e)}
    finally:
        session.close()


@celery.task(bind=True, name="scrape_questions")
def scrape_questions_task(
    self,
    task_id: str,
    knowledge_point: str,
    subject: str,
    grade_level: str,
    difficulty: str,
    question_type: str,
    count: int,
    created_by: str,
):
    """Async web scraping via Celery."""
    from app.models.question_task import QuestionTask
    from app.models.question import Question
    from app.services.scraper import search_questions as do_scrape

    session: Session = _SyncSession()
    try:
        _update_task(session, task_id, status="RUNNING",
                     started_at=datetime.now(timezone.utc))

        raw_results = asyncio.run(do_scrape(
            knowledge_point=knowledge_point, subject=subject,
            grade_level=grade_level, difficulty=difficulty,
            question_type=question_type, count=count,
        ))

        if not raw_results:
            _update_task(session, task_id, status="FAILED",
                         error_message="未找到试题",
                         completed_at=datetime.now(timezone.utc))
            return {"ok": False, "error": "未找到试题"}

        kps = [kp.strip() for kp in knowledge_point.split(",") if kp.strip()]
        grade_json = {"scope": "grade", "grades": [grade_level]}
        if kps:
            grade_json["chapter"] = kps[0]
            grade_json["knowledge_points"] = kps

        creator_uuid = uuid.UUID(created_by)
        saved = 0
        for q_data in raw_results:
            ca = q_data.get("correct_answer", "")
            session.add(Question(
                title=q_data.get("title", ""),
                question_type=q_data.get("question_type", question_type),
                difficulty=q_data.get("difficulty", difficulty),
                subject=q_data.get("subject", subject),
                grade_level=grade_json,
                score=q_data.get("score", 5),
                correct_answer=ca,
                explanation=q_data.get("explanation", ""),
                source="SCRAPED", review_status="PENDING",
                source_task_id=uuid.UUID(task_id),
                created_by=creator_uuid,
                meta_data={"knowledge_points": kps},
            ))
            saved += 1

        _update_task(session, task_id,
                     status="COMPLETED",
                     completed_items=saved,
                     completed_at=datetime.now(timezone.utc),
                     result_summary={"scraped_count": saved})

        return {"ok": True, "count": saved}

    except Exception as e:
        logger.exception("scrape_questions_task failed")
        _update_task(session, task_id, status="FAILED",
                     error_message=str(e),
                     completed_at=datetime.now(timezone.utc))
        return {"ok": False, "error": str(e)}
    finally:
        session.close()
