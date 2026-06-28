from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.database import engine, Base, SessionLocal
import app.models.models  # Base에 테이블 등록
from app.routers import sessions, branches, graph, tags

Base.metadata.create_all(bind=engine)

# create_all은 기존 테이블에 새 컬럼을 추가해주지 않으므로, 누락된 컬럼은 직접 보강한다.
_inspector = inspect(engine)
if "branches" in _inspector.get_table_names():
    _existing_columns = {c["name"] for c in _inspector.get_columns("branches")}
    if "is_merge" not in _existing_columns:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE branches ADD COLUMN is_merge BOOLEAN NOT NULL DEFAULT 0"))
            conn.commit()

if "branches" in _inspector.get_table_names():
    _existing_columns = {c["name"] for c in _inspector.get_columns("branches")}
    if "deleted_at" not in _existing_columns:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE branches ADD COLUMN deleted_at TEXT"))
            conn.commit()

if "conversations" in _inspector.get_table_names():
    _existing_columns = {c["name"] for c in _inspector.get_columns("conversations")}
    with engine.connect() as conn:
        if "status" not in _existing_columns:
            conn.execute(text("ALTER TABLE conversations ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"))
        if "deleted_at" not in _existing_columns:
            conn.execute(text("ALTER TABLE conversations ADD COLUMN deleted_at TEXT"))
        conn.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.repositories import repository
    db = SessionLocal()
    try:
        repository.purge_expired_sessions(db)
        repository.purge_expired_branches(db)
    finally:
        db.close()
    yield

app = FastAPI(title="LLM 채팅 브랜치 시각화 서비스", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", summary="서버 상태 확인", tags=["Health"])
def health():
    """서버가 정상적으로 실행 중인지 확인합니다.

    - 정상이면 `{"status": "ok"}`를 반환합니다.
    - 배포 환경에서 서버가 살아있는지 주기적으로 체크할 때 사용합니다.
    """
    return {"status": "ok"}


app.include_router(sessions.router)
app.include_router(branches.router)
app.include_router(graph.router)
app.include_router(tags.router)
