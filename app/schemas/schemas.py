from pydantic import BaseModel


# ── Session ──────────────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    title: str = "새 대화"


class UpdateSessionTitleRequest(BaseModel):
    title: str


class UpdateMemoryRequest(BaseModel):
    memory: str


class MemoryOut(BaseModel):
    session_id: str
    memory: str | None


class SessionOut(BaseModel):
    id: str
    title: str
    main_branch_id: str


class ConversationOut(BaseModel):
    id: str
    title: str
    created_at: str

    model_config = {"from_attributes": True}


# ── Branch ────────────────────────────────────────────────────────────────────

class CreateBranchRequest(BaseModel):
    session_id: str
    parent_branch_id: str
    fork_from_message_id: int
    name: str | None = None  # None이면 fork 메시지 기준으로 자동 생성


class UpdateBranchNameRequest(BaseModel):
    name: str


class PatchBranchRequest(BaseModel):
    status: str | None = None        # active / inactive / deleted
    is_collapsed: bool | None = None


class BranchOut(BaseModel):
    id: str
    session_id: str
    name: str
    parent_branch_id: str | None
    fork_from_message_id: int | None
    head_id: int | None
    status: str
    is_collapsed: bool
    created_at: str

    model_config = {"from_attributes": True}


# ── Message / Chat ────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    branch_id: str
    message: str
    model_provider: str = "openai"
    model_name: str = "gpt-4o-mini"


class ChatResponse(BaseModel):
    reply: str


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    branch_id: str | None
    created_at: str

    model_config = {"from_attributes": True}


# ── Tag ──────────────────────────────────────────────────────────────────────

class CreateTagRequest(BaseModel):
    session_id: str
    name: str
    color: str | None = None
    type: str = "normal"        # normal / highlight


class AddTagRequest(BaseModel):
    tag_id: str


class TagOut(BaseModel):
    id: str
    session_id: str | None
    name: str
    color: str | None
    type: str
    created_at: str

    model_config = {"from_attributes": True}


# ── Search ────────────────────────────────────────────────────────────────────

class BranchSearchResult(BaseModel):
    id: str
    name: str
    status: str
    tags: list[str]


# ── Graph ─────────────────────────────────────────────────────────────────────

class GraphNode(BaseModel):
    id: str
    type: str                  # "branch"
    label: str                 # 브랜치 이름
    status: str                # active / inactive / deleted
    is_collapsed: bool
    message_count: int


class GraphEdge(BaseModel):
    id: str
    source: str                # parent branch id
    target: str                # child branch id
    type: str                  # "fork"
    fork_from_message_id: int | None


class GraphOut(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
