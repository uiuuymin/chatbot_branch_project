import uuid

from app.models.models import Message, Branch, Conversation, Tag, BranchTag, BranchMergeParent


# ── Message ───────────────────────────────────────────────────────────────────

def save_message(db, session_id, branch_id, role, content,
                 parent_id=None, model_provider=None, model_name=None,
                 input_tokens=None, output_tokens=None):
    msg = Message(
        session_id=session_id,
        branch_id=branch_id,
        role=role,
        content=content,
        parent_id=parent_id,
        model_provider=model_provider,
        model_name=model_name,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )
    db.add(msg)
    db.flush()
    return msg



def get_thread(db, leaf_id):
    """leaf_id에서 root까지 parent_id를 역추적해 시간순으로 반환한다."""
    chain = []
    msg = db.query(Message).filter(Message.id == leaf_id).first()
    while msg is not None:
        chain.append(msg)
        if msg.parent_id is None:
            break
        msg = db.query(Message).filter(Message.id == msg.parent_id).first()
    chain.reverse()
    return chain


def get_message(db, message_id):
    return db.query(Message).filter(Message.id == message_id).first()


def get_branch_messages(db, branch_id: str) -> list:
    """branch의 active 메시지 전체를 시간순으로 반환한다."""
    return (
        db.query(Message)
        .filter(Message.branch_id == branch_id, Message.status == "active")
        .order_by(Message.id)
        .all()
    )


def get_messages_until(db, branch_id: str, until_message_id: int) -> list:
    """branch의 메시지 중 until_message_id까지(포함) 시간순으로 반환한다."""
    return (
        db.query(Message)
        .filter(
            Message.branch_id == branch_id,
            Message.id <= until_message_id,
            Message.status == "active",
        )
        .order_by(Message.id)
        .all()
    )


# ── Conversation (Session) ────────────────────────────────────────────────────

def list_conversations(db):
    return (
        db.query(Conversation)
        .order_by(Conversation.created_at.desc())
        .all()
    )


def create_conversation(db, title="새 대화"):
    conv = Conversation(id=str(uuid.uuid4()), title=title)
    db.add(conv)
    main = Branch(
        id=str(uuid.uuid4()),
        session_id=conv.id,
        name="main",
        parent_branch_id=None,
        fork_from_message_id=None,
        head_id=None,
        status="active",
        is_collapsed=False,
    )
    db.add(main)
    db.commit()
    return conv, main


# ── Branch ────────────────────────────────────────────────────────────────────

def get_branch(db, branch_id):
    return db.query(Branch).filter(Branch.id == branch_id).first()


def list_branches(db, session_id):
    return db.query(Branch).filter(Branch.session_id == session_id).all()


def get_session_memory(db, session_id: str) -> str | None:
    conv = db.query(Conversation).filter(Conversation.id == session_id).first()
    return conv.memory if conv else None


def update_session_memory(db, session_id: str, memory: str) -> Conversation | None:
    conv = db.query(Conversation).filter(Conversation.id == session_id).first()
    if conv:
        conv.memory = memory
        db.commit()
    return conv


def update_session_title(db, session_id: str, title: str) -> Conversation | None:
    conv = db.query(Conversation).filter(Conversation.id == session_id).first()
    if conv:
        conv.title = title
        db.commit()
    return conv


def update_branch_name(db, branch_id: str, name: str) -> Branch | None:
    branch = get_branch(db, branch_id)
    if branch:
        branch.name = name
        db.commit()
    return branch


def update_branch_status(db, branch_id: str, status: str | None, is_collapsed: bool | None) -> Branch | None:
    branch = get_branch(db, branch_id)
    if branch is None:
        return None
    if branch.parent_branch_id is None and not branch.is_merge and status in ("inactive", "deleted"):
        raise ValueError("root branch는 비활성화하거나 삭제할 수 없습니다")
    if status is not None:
        branch.status = status
        if status == "deleted":
            _cascade_delete_children(db, branch_id)
    if is_collapsed is not None:
        branch.is_collapsed = is_collapsed
    db.commit()
    return branch


def _cascade_delete_children(db, branch_id: str) -> None:
    """branch_id를 fork한 모든 하위 브랜치를 재귀적으로 deleted 처리한다."""
    children = db.query(Branch).filter(Branch.parent_branch_id == branch_id).all()
    for child in children:
        if child.status != "deleted":
            child.status = "deleted"
            _cascade_delete_children(db, child.id)


def get_message_count_by_branch(db, session_id: str) -> dict:
    """session 내 브랜치별 active 메시지 수를 {branch_id: count} 형태로 반환한다."""
    from sqlalchemy import func
    rows = (
        db.query(Message.branch_id, func.count(Message.id))
        .filter(Message.session_id == session_id, Message.status == "active")
        .group_by(Message.branch_id)
        .all()
    )
    return {branch_id: count for branch_id, count in rows}


def create_branch(db, session_id, parent_branch_id, fork_from_message_id, name="새 가지"):
    parent = get_branch(db, parent_branch_id)
    if parent is None or parent.session_id != session_id:
        raise ValueError("parent_branch_id가 해당 session에 속하지 않습니다")

    fork_msg = db.query(Message).filter(
        Message.id == fork_from_message_id,
        Message.branch_id == parent_branch_id,
    ).first()
    if fork_msg is None:
        raise ValueError("fork_from_message_id가 parent branch에 속하지 않습니다")

    branch = Branch(
        id=str(uuid.uuid4()),
        session_id=session_id,
        parent_branch_id=parent_branch_id,
        fork_from_message_id=fork_from_message_id,
        name=name,
        head_id=fork_from_message_id,
        status="active",
        is_collapsed=False,
    )
    db.add(branch)
    db.commit()
    return branch


def create_merge_branch(db, session_id: str, parent_summaries: dict[str, str], name="병합 브랜치"):
    """여러 브랜치를 부모로 갖는 머지 브랜치를 생성한다.

    parent_summaries: {parent_branch_id: summary} — 각 부모 브랜치 전체 맥락의 요약.
    머지 브랜치는 단일 fork 지점이 없으므로 parent_branch_id / fork_from_message_id는 비워둔다.
    각 요약은 (user, assistant) 메시지 쌍으로도 저장해서, 채팅창을 열면 합쳐지는 브랜치들의
    요약이 대화 맨 앞에 바로 보이고 LLM context에도 자연스럽게 포함되게 한다.
    """
    parents = {pid: get_branch(db, pid) for pid in parent_summaries}
    if any(p is None or p.session_id != session_id for p in parents.values()):
        raise ValueError("parent_branch_ids가 해당 session에 속하지 않습니다")

    branch = Branch(
        id=str(uuid.uuid4()),
        session_id=session_id,
        parent_branch_id=None,
        fork_from_message_id=None,
        name=name,
        head_id=None,
        status="active",
        is_collapsed=False,
        is_merge=True,
    )
    db.add(branch)
    db.flush()

    last_message_id = None
    for parent_id, summary in parent_summaries.items():
        db.add(BranchMergeParent(branch_id=branch.id, parent_branch_id=parent_id, summary=summary))

        intro = save_message(
            db, session_id=session_id, branch_id=branch.id, role="user",
            content=f"[브랜치 '{parents[parent_id].name}' 요약]\n{summary}", parent_id=last_message_id,
        )
        ack = save_message(
            db, session_id=session_id, branch_id=branch.id, role="assistant",
            content="확인했습니다.", parent_id=intro.id,
        )
        last_message_id = ack.id

    branch.head_id = last_message_id
    db.commit()
    return branch


def count_branch_chat_messages(db, branch_id: str) -> int:
    """머지 시 자동 삽입된 요약 메시지를 제외하고, 실제 채팅으로 만들어진 메시지 수를 센다.

    채팅으로 생성된 메시지는 항상 model_provider가 채워져 있고, 머지 요약 메시지는 비어 있다.
    """
    return (
        db.query(Message)
        .filter(
            Message.branch_id == branch_id,
            Message.status == "active",
            Message.model_provider.isnot(None),
        )
        .count()
    )


def get_branch_merge_parents(db, branch_id: str) -> list[BranchMergeParent]:
    return (
        db.query(BranchMergeParent)
        .filter(BranchMergeParent.branch_id == branch_id)
        .all()
    )


def get_merge_parent_ids(db, branch_id: str) -> list[str]:
    return [mp.parent_branch_id for mp in get_branch_merge_parents(db, branch_id)]


def list_merge_edges(db, session_id: str) -> list[BranchMergeParent]:
    """session 내 모든 머지 관계(branch_id, parent_branch_id, summary)를 반환한다."""
    return (
        db.query(BranchMergeParent)
        .join(Branch, Branch.id == BranchMergeParent.branch_id)
        .filter(Branch.session_id == session_id)
        .all()
    )


# ── Tag ───────────────────────────────────────────────────────────────────────

def create_tag(db, session_id: str, name: str, color: str | None, type: str) -> Tag:
    tag = Tag(id=str(uuid.uuid4()), session_id=session_id, name=name, color=color, type=type)
    db.add(tag)
    db.commit()
    return tag


def get_tag(db, tag_id: str) -> Tag | None:
    return db.query(Tag).filter(Tag.id == tag_id).first()


def get_session_tags(db, session_id: str) -> list:
    return db.query(Tag).filter(Tag.session_id == session_id).order_by(Tag.created_at).all()


def get_branch_tags(db, branch_id: str) -> list:
    """브랜치에 연결된 태그 목록을 반환한다."""
    return (
        db.query(Tag)
        .join(BranchTag, Tag.id == BranchTag.tag_id)
        .filter(BranchTag.branch_id == branch_id)
        .order_by(Tag.created_at)
        .all()
    )



def search_branches(db, session_id: str, q: str) -> list[dict]:
    """브랜치 이름 또는 태그 이름에 q가 포함된 브랜치를 반환한다."""
    like = f"%{q}%"

    by_name = (
        db.query(Branch.id)
        .filter(Branch.session_id == session_id, Branch.status != "deleted", Branch.name.ilike(like))
    )
    by_tag = (
        db.query(BranchTag.branch_id)
        .join(Tag, BranchTag.tag_id == Tag.id)
        .filter(Tag.session_id == session_id, Tag.name.ilike(like))
    )

    matched_ids = {row[0] for row in by_name} | {row[0] for row in by_tag}
    if not matched_ids:
        return []

    branches = db.query(Branch).filter(Branch.id.in_(matched_ids)).all()

    results = []
    for branch in branches:
        tag_names = [
            t.name for t in
            db.query(Tag).join(BranchTag, Tag.id == BranchTag.tag_id)
            .filter(BranchTag.branch_id == branch.id).all()
        ]
        results.append({"id": branch.id, "name": branch.name, "status": branch.status, "tags": tag_names})
    return results


def remove_branch_tag(db, branch_id: str, tag_id: str) -> bool:
    bt = db.query(BranchTag).filter(
        BranchTag.branch_id == branch_id,
        BranchTag.tag_id == tag_id,
    ).first()
    if bt is None:
        return False
    db.delete(bt)
    db.commit()
    return True


def add_branch_tag(db, branch_id: str, tag_id: str) -> BranchTag:
    existing = db.query(BranchTag).filter(
        BranchTag.branch_id == branch_id,
        BranchTag.tag_id == tag_id,
    ).first()
    if existing:
        return existing
    bt = BranchTag(branch_id=branch_id, tag_id=tag_id)
    db.add(bt)
    db.commit()
    return bt


# ── Embedding ─────────────────────────────────────────────────────────────────

def save_embedding(db, message_id: int, vector: list, model: str):
    import json
    import uuid as _uuid
    from app.models.models import Embedding
    existing = db.query(Embedding).filter(Embedding.message_id == message_id).first()
    if existing:
        return existing
    emb = Embedding(
        id=str(_uuid.uuid4()),
        message_id=message_id,
        embedding=json.dumps(vector),
        embedding_model=model,
    )
    db.add(emb)
    db.commit()
    return emb


def get_session_embeddings(db, session_id: str, exclude_branch_ids: list[str]):
    from app.models.models import Embedding
    query = (
        db.query(Embedding, Message)
        .join(Message, Embedding.message_id == Message.id)
        .filter(Message.session_id == session_id, Message.status == "active")
    )
    if exclude_branch_ids:
        query = query.filter(Message.branch_id.notin_(exclude_branch_ids))
    return query.all()
