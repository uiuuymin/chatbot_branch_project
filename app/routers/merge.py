from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.schemas import MergeRequest, MergeResponse
from app.repositories import repository
from app.services import merge_service

router = APIRouter(tags=["Merge"])


@router.post("/merge", response_model=MergeResponse, summary="두 브랜치 merge")
def merge_branches(req: MergeRequest, db: Session = Depends(get_db)):
    """두 브랜치의 대화 내용을 분석해 통합 답변을 생성하고 새 브랜치에 저장합니다.

    **동작 방식 (2단계)**

    1. 두 브랜치의 공통 조상 대화와 각 브랜치 고유 대화를 분리합니다.
    2. 결정사항·제약·충돌을 구조화해 추출합니다 (merge_summary).
    3. 추출 결과를 바탕으로 통합 답변을 생성합니다 (merged_content).
    4. 새 브랜치를 생성하고 통합 답변을 첫 번째 메시지로 저장합니다.

    **검증 조건**

    - `branch_id_1`, `branch_id_2`가 같은 session에 속해야 합니다.
    - `parent_branch_id`와 `fork_from_message_id`는 일반 브랜치 생성과 동일한 조건을 따릅니다.
    - 두 브랜치가 동일하면 오류를 반환합니다.

    **merge_summary** 는 두 브랜치 분석 결과(결정사항, 충돌, 보존 요소 등)이고,
    **merged_content** 는 사용자가 이어서 대화할 수 있는 통합 응답입니다.
    """
    # 새 브랜치 생성 (일반 브랜치 생성과 동일한 검증 포함)
    name = req.name or f"merge: {req.branch_id_1[:6]} + {req.branch_id_2[:6]}"
    try:
        merged_branch = repository.create_branch(
            db,
            session_id=req.session_id,
            parent_branch_id=req.parent_branch_id,
            fork_from_message_id=req.fork_from_message_id,
            name=name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Merge 실행
    try:
        result = merge_service.perform_merge(
            db,
            branch_id_1=req.branch_id_1,
            branch_id_2=req.branch_id_2,
            model_provider=req.model_provider,
            model_name=req.model_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM API 오류: {e}")

    # merge 트리거 메시지 (user)와 통합 답변 (assistant)을 새 브랜치에 저장
    trigger_msg = repository.save_message(
        db,
        session_id=req.session_id,
        branch_id=merged_branch.id,
        role="user",
        content=f"[Merge 분석 결과]\n\n{result['merge_summary']}",
        parent_id=merged_branch.head_id,
    )
    answer_msg = repository.save_message(
        db,
        session_id=req.session_id,
        branch_id=merged_branch.id,
        role="assistant",
        content=result["merged_content"],
        parent_id=trigger_msg.id,
        model_provider=req.model_provider,
        model_name=req.model_name,
    )

    merged_branch.head_id = answer_msg.id
    db.commit()

    return MergeResponse(
        branch_id=merged_branch.id,
        merge_summary=result["merge_summary"],
        merged_content=result["merged_content"],
    )
