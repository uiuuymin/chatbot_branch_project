from dotenv import load_dotenv

from app.repositories import repository
from app.services import context_builder, auto_tagger, embedding_service
from app.services.providers import get_provider

load_dotenv()

SYSTEM_PROMPT = "너는 친절한 한국어 챗봇이야. 질문에 간결하고 정확하게 답해줘."


def generate_reply(context: list[dict], model_provider: str, model_name: str) -> tuple[str, int, int]:
    provider = get_provider(model_provider)
    return provider.generate(context, model_name, SYSTEM_PROMPT)


def handle_chat(db, req) -> str:
    from fastapi import HTTPException
    branch = repository.get_branch(db, req.branch_id)
    if branch is None:
        raise HTTPException(status_code=404, detail=f"branch_id '{req.branch_id}' 를 찾을 수 없습니다. POST /sessions 로 새 세션을 만들고 응답의 main_branch_id 를 사용하세요.")

    if branch.status != "active":
        raise HTTPException(status_code=409, detail=f"branch가 '{branch.status}' 상태입니다. 채팅은 active 브랜치에서만 가능합니다.")

    is_first_message = branch.head_id is None
    is_first_branch_message = repository.count_branch_chat_messages(db, req.branch_id) == 0

    context = context_builder.build_context(db, req.branch_id, req.message)

    user_msg = repository.save_message(
        db,
        session_id=branch.session_id,
        branch_id=req.branch_id,
        role="user",
        content=req.message,
        parent_id=branch.head_id,
        model_provider=req.model_provider,
        model_name=req.model_name,
    )

    try:
        answer, input_tokens, output_tokens = generate_reply(context, req.model_provider, req.model_name)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM API 오류: {e}")

    bot_msg = repository.save_message(
        db,
        session_id=branch.session_id,
        branch_id=req.branch_id,
        role="assistant",
        content=answer,
        parent_id=user_msg.id,
        model_provider=req.model_provider,
        model_name=req.model_name,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )

    branch.head_id = bot_msg.id
    db.commit()

    try:
        embedding_service.save_message_embedding(db, user_msg.id, req.message)
        embedding_service.save_message_embedding(db, bot_msg.id, answer)
    except Exception:
        pass  # embedding 실패가 채팅을 막으면 안 됨

    if is_first_message:
        title = auto_tagger.generate_session_name(req.message, answer)
        repository.update_session_title(db, branch.session_id, title)

    if is_first_branch_message and (branch.parent_branch_id is not None or branch.is_merge):
        branch_name = auto_tagger.generate_branch_name_from_qa(req.message, answer)
        repository.update_branch_name(db, branch.id, branch_name)

    return answer
