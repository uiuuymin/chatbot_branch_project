from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.schemas import (
    ChatRequest, ChatResponse, MessageOut, BranchOut, CreateBranchRequest,
    UpdateBranchNameRequest, PatchBranchRequest,
)
from app.repositories import repository
from app.services import llm_service, auto_tagger

router = APIRouter(tags=["Branches & Chat"])


@router.post("/chat", response_model=ChatResponse, summary="메시지 전송 및 AI 응답")
def chat(req: ChatRequest, db: Session = Depends(get_db)):
    """특정 브랜치에서 메시지를 보내고 AI 응답을 받습니다.

    - `branch_id`에 해당하는 브랜치의 대화 흐름 위에 메시지가 추가됩니다.
    - 분기 이전 부모 브랜치의 맥락(context)은 자동으로 포함됩니다.
    - `model_provider`와 `model_name`으로 사용할 LLM을 지정할 수 있습니다.
    """
    answer = llm_service.handle_chat(db, req)
    return ChatResponse(reply=answer)



@router.post("/branches", response_model=BranchOut, summary="브랜치 생성")
def make_branch(req: CreateBranchRequest, db: Session = Depends(get_db)):
    """특정 메시지를 분기점으로 새 브랜치를 생성합니다.

    - `parent_branch_id`: 분기할 기존 브랜치 ID
    - `fork_from_message_id`: 분기 기준 메시지 ID (이 메시지까지의 맥락을 공유함)
    - 새 브랜치가 생성되면 부모 브랜치 대화 전체를 분석해 태그를 자동으로 답니다.

    **검증 조건**
    - `parent_branch_id`가 해당 session에 속해야 합니다.
    - `fork_from_message_id`가 parent branch의 메시지여야 합니다.
    """
    # name이 없으면 fork 메시지 내용 기준으로 자동 생성
    name = req.name
    if not name:
        fork_msg = repository.get_message(db, req.fork_from_message_id)
        if fork_msg:
            name = auto_tagger.generate_name_from_message(fork_msg.content)
        else:
            name = "새 가지"

    try:
        branch = repository.create_branch(
            db, req.session_id, req.parent_branch_id, req.fork_from_message_id, name
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    auto_tagger.auto_tag_branch(db, req.session_id, req.parent_branch_id)
    return branch


@router.post("/branches/{branch_id}/auto-name", summary="브랜치 이름 자동 생성")
def auto_name_branch(branch_id: str, db: Session = Depends(get_db)):
    """브랜치 전체 대화를 분석해 이름을 자동 생성하고 저장합니다.

    - 브랜치 생성 시에는 fork 메시지 기준으로 이름이 자동 생성됩니다.
    - 대화가 더 쌓인 후 이름을 다시 생성하고 싶을 때 이 API를 사용하세요.
    """
    branch = repository.get_branch(db, branch_id)
    if branch is None:
        raise HTTPException(status_code=404, detail="branch를 찾을 수 없습니다")
    name = auto_tagger.auto_name_branch(db, branch_id)
    return {"branch_id": branch_id, "name": name}


@router.post("/branches/{branch_id}/auto-tag", summary="브랜치 자동 태그")
def auto_tag_branch(branch_id: str, db: Session = Depends(get_db)):
    """브랜치 전체 대화를 분석해 핵심 주제를 태그로 자동 생성합니다.

    - 새 브랜치 생성 시 부모 브랜치에는 자동으로 실행됩니다.
    - 현재 대화 중인 마지막 브랜치에는 이 API로 수동 트리거하세요.
    - 이미 달린 태그는 유지되고, 새 태그만 추가됩니다.
    """
    branch = repository.get_branch(db, branch_id)
    if branch is None:
        raise HTTPException(status_code=404, detail="branch를 찾을 수 없습니다")
    tags = auto_tagger.auto_tag_branch(db, branch.session_id, branch_id)
    return {"branch_id": branch_id, "auto_tags": tags}


@router.patch("/branches/{branch_id}", response_model=BranchOut, summary="브랜치 상태/접힘 수정")
def patch_branch(branch_id: str, req: PatchBranchRequest, db: Session = Depends(get_db)):
    """브랜치 status 또는 is_collapsed를 수정합니다.

    - `status`: `inactive`(비활성화) / `deleted`(소프트 삭제) / `active`(복구)
    - `is_collapsed`: 그래프에서 브랜치를 접을지 여부
    - root branch(main)는 inactive / deleted로 변경할 수 없습니다.
    - 변경하고 싶은 필드만 body에 포함하면 됩니다 (나머지는 유지).
    """
    if req.status is not None and req.status not in ("active", "inactive", "deleted"):
        raise HTTPException(status_code=422, detail="status는 active / inactive / deleted 중 하나여야 합니다.")
    try:
        branch = repository.update_branch_status(db, branch_id, req.status, req.is_collapsed)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if branch is None:
        raise HTTPException(status_code=404, detail="branch를 찾을 수 없습니다.")
    return branch


@router.patch("/branches/{branch_id}/name", response_model=BranchOut, summary="브랜치 이름 수정")
def update_branch_name(branch_id: str, req: UpdateBranchNameRequest, db: Session = Depends(get_db)):
    """브랜치 이름을 직접 수정합니다.

    - 자동 생성된 이름이 마음에 들지 않을 때 사용합니다.
    - `/auto-name` 엔드포인트로 AI가 다시 생성하게 할 수도 있습니다.
    """
    if not req.name.strip():
        raise HTTPException(status_code=422, detail="name은 빈 문자열일 수 없습니다.")
    branch = repository.update_branch_name(db, branch_id, req.name.strip())
    if branch is None:
        raise HTTPException(status_code=404, detail="branch를 찾을 수 없습니다.")
    return branch


@router.get("/branches/{branch_id}/messages", response_model=list[MessageOut], summary="브랜치 메시지 조회")
def branch_messages(branch_id: str, include_inherited: bool = False, db: Session = Depends(get_db)):
    """브랜치 메시지를 조회합니다.

    - `include_inherited=false` (기본값): 이 브랜치에서 직접 작성된 메시지만 반환합니다.
    - `include_inherited=true`: 분기 이전 부모 브랜치 맥락까지 포함해 반환합니다. 채팅창 표시 용도입니다.

    **예시** — main에서 M2 기준으로 분기한 branch B의 경우

    ```
    include_inherited=false → [M5, M6]           (branch B에서 작성한 것만)
    include_inherited=true  → [M1, M2, M5, M6]   (분기 이전 main 맥락 포함)
    ```
    """
    branch = repository.get_branch(db, branch_id)
    if branch is None:
        raise HTTPException(status_code=404, detail="branch를 찾을 수 없습니다")
    if branch.head_id is None:
        return []
    if include_inherited:
        return repository.get_thread(db, branch.head_id)
    return repository.get_branch_messages(db, branch_id)


@router.get(
    "/branches/{branch_id}/thread",
    response_model=list[MessageOut],
    summary="브랜치 대화 조회 (구버전, /messages로 대체)",
    deprecated=True,
)
def branch_thread(branch_id: str, db: Session = Depends(get_db)):
    """이전 버전 호환을 위해 남겨둔 브랜치 대화 조회 API입니다.

    - 현재 권장 API는 `GET /branches/{branch_id}/messages`입니다.
    - 이 API는 항상 부모 브랜치의 분기 이전 맥락까지 포함합니다.
    - 동작은 `GET /branches/{branch_id}/messages?include_inherited=true`와 같습니다.
    - 새 기능에서는 `/messages`를 사용하세요.

    **왜 구버전인가요?**

    처음에는 화면에 보여줄 "현재 브랜치의 전체 대화 줄기"만 필요해서 `/thread`를 만들었습니다.
    이후 사용자가 "현재 브랜치에서 직접 작성한 메시지만 보기"와
    "부모 브랜치에서 물려받은 맥락까지 같이 보기"를 선택할 필요가 생겨
    `/messages`에 `include_inherited` 옵션을 추가했습니다.

    **차이점**

    - `/thread`: 상속 맥락 포함만 가능
    - `/messages?include_inherited=true`: `/thread`와 동일
    - `/messages?include_inherited=false`: 현재 브랜치에서 작성한 메시지만 반환
    """
    branch = repository.get_branch(db, branch_id)
    if branch is None:
        raise HTTPException(status_code=404, detail="branch를 찾을 수 없습니다")
    if branch.head_id is None:
        return []
    return repository.get_thread(db, branch.head_id)
