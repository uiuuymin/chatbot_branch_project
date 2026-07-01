from pydantic import BaseModel


# ── Session ──────────────────────────────────────────────────────────────────

class homemessage(BaseModel):
    message: str


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


class TrashSessionOut(BaseModel):
    id: str
    title: str
    created_at: str
    deleted_at: str

    model_config = {"from_attributes": True}


# ── Branch ────────────────────────────────────────────────────────────────────

class CreateBranchRequest(BaseModel):
    session_id: str
    parent_branch_id: str
    fork_from_message_id: int
    name: str | None = None  # None이면 "새 가지"로 생성 후 첫 대화 기준으로 자동 갱신


class MergeBranchRequest(BaseModel):
    session_id: str
    parent_branch_ids: list[str]   # 합칠 브랜치들 (2개 이상)
    name: str | None = None        # None이면 "병합 브랜치"로 생성 후 첫 대화 기준으로 자동 갱신


class UpdateBranchNameRequest(BaseModel):
    name: str


class PatchBranchRequest(BaseModel):
    status: str | None = None        # active / inactive / deleted
    is_collapsed: bool | None = None


class BranchTrashOut(BaseModel):
    id: str
    name: str
    session_id: str
    deleted_at: str | None

    model_config = {"from_attributes": True}


class BranchOut(BaseModel):
    id: str
    session_id: str
    name: str
    parent_branch_id: str | None
    fork_from_message_id: int | None
    head_id: int | None
    status: str
    is_collapsed: bool
    is_merge: bool
    is_main: bool
    merge_parent_ids: list[str] = []
    created_at: str

    model_config = {"from_attributes": True}


class SelectMainBranchResponse(BaseModel):
    branch_id: str
    main_branch_ids: list[str]


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


# ── File ─────────────────────────────────────────────────────────────────────

class FileOut(BaseModel):
    id: str
    session_id: str
    branch_id: str | None   # None = 세션 전체 공유 파일
    filename: str
    summary: str | None
    created_at: str

    model_config = {"from_attributes": True}


# ── Graph ─────────────────────────────────────────────────────────────────────

class GraphNode(BaseModel):
    id: str
    type: str                  # "branch"
    label: str                 # 브랜치 이름
    status: str                # active / inactive / deleted
    is_collapsed: bool
    is_merge: bool             # 여러 브랜치를 합친 머지 브랜치인지 여부
    message_count: int


class GraphEdge(BaseModel):
    id: str
    source: str                # parent branch id
    target: str                # child branch id
    type: str                  # "fork" / "merge"
    fork_from_message_id: int | None


class GraphOut(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
