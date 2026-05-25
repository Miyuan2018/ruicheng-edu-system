from fastapi import APIRouter

api_router = APIRouter()

# Import and include routers from each service
from app.api.v1.endpoints import auth_v2, llm_config, subjects, questions, exam_papers, answers, ocr, grading, error_notebooks, self_study, question_admin, knowledge_tree, classes, stats, database, reference

api_router.include_router(auth_v2.router, prefix="/auth", tags=["auth-v2"])
api_router.include_router(llm_config.router, prefix="/admin/llm", tags=["llm-config"])
api_router.include_router(subjects.router, prefix="/subjects", tags=["subjects"])

api_router.include_router(questions.router, prefix="/questions", tags=["questions"])
api_router.include_router(question_admin.router, prefix="/question-admin", tags=["question-admin"])
api_router.include_router(knowledge_tree.router, prefix="/knowledge-tree", tags=["knowledge-tree"])
api_router.include_router(exam_papers.router, prefix="/exam-papers", tags=["exam-papers"])
api_router.include_router(answers.router, prefix="/answers", tags=["answers"])
api_router.include_router(ocr.router, prefix="/ocr", tags=["ocr"])
api_router.include_router(grading.router, prefix="/grading", tags=["grading"])
api_router.include_router(error_notebooks.router, prefix="/error-notebooks", tags=["error-notebooks"])
api_router.include_router(self_study.router, prefix="/self-study", tags=["self-study"])
api_router.include_router(classes.router, prefix="/classes", tags=["classes"])
api_router.include_router(stats.router, prefix="/teacher/stats", tags=["stats"])
api_router.include_router(database.router, tags=["database"])
api_router.include_router(reference.router, prefix="/reference", tags=["reference"])