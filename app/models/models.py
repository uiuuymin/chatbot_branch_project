from sqlalchemy import Column, Integer, Text, Boolean, ForeignKey, text
from app.database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Text, primary_key=True)
    title = Column(Text, nullable=False, server_default="새 대화")
    memory = Column(Text, nullable=True)  # 브랜치 무관 공유 메모리
    status = Column(Text, nullable=False, server_default="active")  # active / deleted
    deleted_at = Column(Text, nullable=True)  # 휴지통 이동 시각 (ISO datetime)
    created_at = Column(Text, nullable=False, server_default=text("(datetime('now'))"))
    updated_at = Column(Text, nullable=False, server_default=text("(datetime('now'))"))


class Branch(Base):
    __tablename__ = "branches"

    id = Column(Text, primary_key=True)
    session_id = Column(Text, ForeignKey("conversations.id"), nullable=False)
    parent_branch_id = Column(Text, ForeignKey("branches.id"), nullable=True)
    fork_from_message_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    name = Column(Text, nullable=False, server_default="main")
    head_id = Column(Integer, nullable=True)
    status = Column(Text, nullable=False, server_default="active")   # active / inactive / deleted
    deleted_at = Column(Text, nullable=True)  # 휴지통 이동 시각 (ISO datetime)
    is_collapsed = Column(Boolean, nullable=False, server_default="0")
    is_merge = Column(Boolean, nullable=False, server_default="0")    # 여러 브랜치를 합친 머지 브랜치인지 여부
    is_main = Column(Boolean, nullable=False, server_default="0")     # 선택된 main 경로 여부
    created_at = Column(Text, nullable=False, server_default=text("(datetime('now'))"))
    updated_at = Column(Text, nullable=False, server_default=text("(datetime('now'))"))


class BranchMergeParent(Base):
    """머지 브랜치 하나가 가질 수 있는 여러 부모 브랜치 관계.

    일반 분기는 Branch.parent_branch_id(단일)로 표현하지만,
    머지 브랜치는 부모가 여럿이라 별도 테이블로 관리한다.
    """
    __tablename__ = "branch_merge_parents"

    branch_id = Column(Text, ForeignKey("branches.id"), primary_key=True)
    parent_branch_id = Column(Text, ForeignKey("branches.id"), primary_key=True)
    summary = Column(Text, nullable=False)   # 머지 시점에 parent 브랜치 전체 맥락을 요약한 내용
    created_at = Column(Text, nullable=False, server_default=text("(datetime('now'))"))


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Text, ForeignKey("conversations.id"), nullable=False)
    branch_id = Column(Text, ForeignKey("branches.id"), nullable=False)
    parent_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    role = Column(Text, nullable=False)                              # user / assistant / system
    content = Column(Text, nullable=False)
    model_provider = Column(Text, nullable=True)                    # openai, anthropic 등
    model_name = Column(Text, nullable=True)                        # gpt-4o-mini 등
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    status = Column(Text, nullable=False, server_default="active")  # active / deleted
    created_at = Column(Text, nullable=False, server_default=text("(datetime('now'))"))


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Text, primary_key=True)
    session_id = Column(Text, ForeignKey("conversations.id"), nullable=True)
    name = Column(Text, nullable=False)
    color = Column(Text, nullable=True)
    type = Column(Text, nullable=False, server_default="normal")    # normal / highlight
    created_at = Column(Text, nullable=False, server_default=text("(datetime('now'))"))


class MessageTag(Base):
    __tablename__ = "message_tags"

    message_id = Column(Integer, ForeignKey("messages.id"), primary_key=True)
    tag_id = Column(Text, ForeignKey("tags.id"), primary_key=True)
    created_at = Column(Text, nullable=False, server_default=text("(datetime('now'))"))


class BranchTag(Base):
    __tablename__ = "branch_tags"

    branch_id = Column(Text, ForeignKey("branches.id"), primary_key=True)
    tag_id = Column(Text, ForeignKey("tags.id"), primary_key=True)
    created_at = Column(Text, nullable=False, server_default=text("(datetime('now'))"))


class Embedding(Base):
    __tablename__ = "embeddings"

    id = Column(Text, primary_key=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False)
    embedding = Column(Text, nullable=False)    # JSON 직렬화 문자열 (SQLite용)
    embedding_model = Column(Text, nullable=False)
    created_at = Column(Text, nullable=False, server_default=text("(datetime('now'))"))
