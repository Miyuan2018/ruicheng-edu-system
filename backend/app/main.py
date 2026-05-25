from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.api import api_router
import asyncio
import logging

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.on_event("startup")
async def startup_event():
    try:
        from app.db.session import AsyncSessionLocal
        from app.seed_reference import seed_reference_data
        async with AsyncSessionLocal() as db:
            await seed_reference_data(db)
        logger.info("Reference data seeded successfully")
    except Exception as e:
        logger.warning(f"Seed reference data skipped: {e}")


@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.PROJECT_NAME} API"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}