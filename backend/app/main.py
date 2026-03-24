import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.categories import router as categories_router
from app.api.items import router as items_router
from app.api.ranking import router as ranking_router
from app.api.refresh import router as refresh_router
from app.api.watchlist import router as watchlist_router
from app.collector.scheduler import create_scheduler
from app.config import settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # スケジューラー起動
    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    scheduler = create_scheduler(session_factory)
    scheduler.start()
    logger.info("Scheduler started")

    yield

    scheduler.shutdown()
    await engine.dispose()
    logger.info("Scheduler stopped")


app = FastAPI(title="Eorzea Market", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(categories_router, prefix="/api/categories", tags=["categories"])
app.include_router(items_router, prefix="/api/items", tags=["items"])
app.include_router(ranking_router, prefix="/api/ranking", tags=["ranking"])
app.include_router(refresh_router, prefix="/api/refresh", tags=["refresh"])
app.include_router(watchlist_router, prefix="/api/watchlist", tags=["watchlist"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
