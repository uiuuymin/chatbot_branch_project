from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.schemas import FileOut
from app.repositories import repository
from app.services import file_service

router = APIRouter(tags=["Files"])


def _upload(
    session_id: str,
    filename: str,
    content: bytes,
    model_provider: str,
    model_name: str,
    db: Session,
    branch_id: str | None = None,
) -> FileOut:
    try:
        extracted = file_service.extract_text(filename, content)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    summary = file_service.generate_summary(filename, extracted, model_provider, model_name)
    return repository.save_file(db, session_id, filename, extracted, summary, branch_id)


@router.post("/branches/{branch_id}/upload", response_model=FileOut, summary="브랜치에 파일 업로드")
async def upload_to_branch(
    branch_id: str,
    file: UploadFile = File(...),
    model_provider: str = Form("openai"),
    model_name: str = Form("gpt-4o-mini"),
    db: Session = Depends(get_db),
):
    """브랜치 전용 파일을 업로드합니다. 이 브랜치의 채팅에서만 참조됩니다."""
    branch = repository.get_branch(db, branch_id)
    if branch is None:
        raise HTTPException(status_code=404, detail="branch를 찾을 수 없습니다.")
    content = await file.read()
    return _upload(branch.session_id, file.filename or "unknown", content, model_provider, model_name, db, branch_id)


@router.post("/sessions/{session_id}/upload", response_model=FileOut, summary="세션에 파일 업로드")
async def upload_to_session(
    session_id: str,
    file: UploadFile = File(...),
    model_provider: str = Form("openai"),
    model_name: str = Form("gpt-4o-mini"),
    db: Session = Depends(get_db),
):
    """세션 전체 공유 파일을 업로드합니다. 이 세션의 모든 브랜치에서 참조됩니다."""
    content = await file.read()
    return _upload(session_id, file.filename or "unknown", content, model_provider, model_name, db, branch_id=None)


@router.get("/branches/{branch_id}/files", response_model=list[FileOut], summary="브랜치 전용 파일 목록")
def list_branch_files(branch_id: str, db: Session = Depends(get_db)):
    branch = repository.get_branch(db, branch_id)
    if branch is None:
        raise HTTPException(status_code=404, detail="branch를 찾을 수 없습니다.")
    return repository.get_branch_files(db, branch_id)


@router.get("/sessions/{session_id}/files", response_model=list[FileOut], summary="세션 공유 파일 목록")
def list_session_files(session_id: str, db: Session = Depends(get_db)):
    return repository.get_session_files(db, session_id)


@router.delete("/files/{file_id}", status_code=204, summary="파일 삭제")
def delete_file(file_id: str, db: Session = Depends(get_db)):
    """업로드된 파일을 삭제합니다."""
    ok = repository.delete_file(db, file_id)
    if not ok:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
