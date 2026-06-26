from fastapi import FastAPI

from app.database import engine, Base
import app.models.models  # Base에 테이블 등록
from app.routers import sessions, branches, graph, tags

Base.metadata.create_all(bind=engine)

app = FastAPI(title="LLM 채팅 브랜치 시각화 서비스")


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
