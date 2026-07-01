from app.repositories import repository


def build_context(db, branch_id: str, new_user_message: str) -> list[dict]:
    """LLM에 전달할 messages 배열을 구성한다.

    1. 세션 메모리(사용자 정보)를 context 맨 앞에 주입한다.
    2. 부모 브랜치는 fork_from_message_id 이전 메시지까지만 포함하고,
       현재 브랜치는 전체 메시지를 포함한다. 머지 브랜치는 부모 브랜치 요약이
       (user, assistant) 메시지 쌍으로 이미 본인 메시지에 저장되어 있으므로 그대로 포함된다.
    3. 다른 브랜치에서 유사 메시지를 벡터 검색해 참고 context로 추가한다.
    4. 마지막에 새 사용자 메시지를 추가해 반환한다.
    """
    from app.services import embedding_service

    branch = repository.get_branch(db, branch_id)
    memory = repository.get_session_memory(db, branch.session_id)

    if branch.is_merge:
        ancestor_ids = [branch_id] + repository.get_merge_parent_ids(db, branch_id)
        context_messages = fit_to_token_budget(repository.get_branch_messages(db, branch_id))
    else:
        branch_chain = get_branch_ancestor_chain(db, branch_id)
        ancestor_ids = [b.id for b in branch_chain]
        context_messages = fit_to_token_budget(get_full_branch_messages(db, branch_id, branch_chain))

    # 다른 브랜치에서 유사 메시지 검색
    try:
        similar = embedding_service.search_similar_messages(
            db, branch.session_id, new_user_message, exclude_branch_ids=ancestor_ids
        )
    except Exception:
        similar = []

    session_files = repository.get_session_files(db, branch.session_id)
    branch_files = repository.get_branch_files(db, branch_id)
    all_files = session_files + branch_files

    result = []

    if memory:
        result.append({"role": "user", "content": f"[사용자 정보]\n{memory}"})
        result.append({"role": "assistant", "content": "알겠습니다. 해당 정보를 기억하겠습니다."})

    if all_files:
        # 요약만 주입. 전체 텍스트는 llm_service의 tool handler가 필요 시 제공한다.
        lines = []
        for f in all_files:
            scope = "세션 공유" if f.branch_id is None else "브랜치"
            desc = f.summary or "(요약 없음)"
            lines.append(f"- [{scope}] {f.filename}: {desc}")
        result.append({"role": "user", "content": "[첨부 파일 목록]\n" + "\n".join(lines)})
        result.append({"role": "assistant", "content": "파일 목록을 확인했습니다. 전체 내용이 필요하면 도구를 사용하겠습니다."})

    if similar:
        refs = "\n".join([f"- {m.content}" for m in similar])
        result.append({"role": "user", "content": f"[다른 대화에서 관련 내용]\n{refs}"})
        result.append({"role": "assistant", "content": "참고하겠습니다."})

    result.extend([{"role": m.role, "content": m.content} for m in context_messages])
    result.append({"role": "user", "content": new_user_message})
    return result


def get_full_branch_messages(db, branch_id: str, branch_chain: list | None = None) -> list:
    """branch의 분기 이전 조상 맥락 + 본인 메시지 전체를 시간순으로 반환한다."""
    if branch_chain is None:
        branch_chain = get_branch_ancestor_chain(db, branch_id)

    messages = []
    for i, b in enumerate(branch_chain):
        if b.id == branch_id:
            messages.extend(repository.get_branch_messages(db, b.id))
        else:
            child = branch_chain[i + 1]
            messages.extend(repository.get_messages_until(db, b.id, child.fork_from_message_id))
    return messages


def get_branch_ancestor_chain(db, branch_id: str) -> list:
    """현재 branch에서 root까지 역추적해 [root, ..., current] 순으로 반환한다."""
    chain = []
    branch = repository.get_branch(db, branch_id)
    while branch is not None:
        chain.append(branch)
        if branch.parent_branch_id is None:
            break
        branch = repository.get_branch(db, branch.parent_branch_id)
    chain.reverse()
    return chain


def fit_to_token_budget(messages: list, max_messages: int = 20) -> list:
    """컨텍스트가 너무 길면 오래된 메시지부터 제외한다. MVP는 개수 기준으로 제한한다."""
    if len(messages) <= max_messages:
        return messages
    return messages[-max_messages:]
