# CLAUDE.md — LLM 채팅 브랜치 시각화 서비스

## 프로젝트 개요

LLM 채팅에서 특정 메시지를 기준으로 새 브랜치를 생성하고, 대화 분기 구조를 그래프로 시각화하는 서비스. 일반 채팅과 달리 context가 브랜치별로 독립 관리된다.

**핵심 목표:** LLM API 호출 품질보다 세션·브랜치·메시지의 분기 관계를 정확히 저장하고, 그 구조를 context 구성과 graph API에 일관되게 반영하는 것이 우선이다.

## 기술 스택

- **Backend:** FastAPI + SQLAlchemy + SQLite
- **아키텍처:** `router.py` → `service.py` → `repository.py` → `models.py` / `database.py`
- **API 문서:** `http://127.0.0.1:8000/docs` (Swagger UI)
- **실행:** `uvicorn main:app --reload`

## 용어 고정 (팀 내 통일)

| 용어 | 의미 |
|---|---|
| Session | 전체 대화 그래프 단위. `conversations` 테이블에 대응 |
| Branch | Session 안에서 분기된 하나의 대화 흐름 |
| Message | user / assistant 발화 하나. `messages` 테이블에 대응 |
| Fork point | 브랜치가 생성된 기준 메시지 (`fork_from_message_id`) |
| Parent branch | 새 브랜치가 파생된 기존 브랜치 |
| Root branch | Session 생성 시 자동 생성되는 최초 브랜치 (현재 코드에선 `main`) |

> `branch → 여는 즉시 새 session` 요구사항은 **같은 session_id 안에 새 branch_id를 만드는 것**으로 해석한다. 새 session_id를 만들면 그래프 연결이 끊긴다.

## 현재 구현 상태 (코드 기준)

### DB 모델 (`models.py`)

```
conversations  id(UUID), title, created_at
branches       id(UUID), session_id, name, head_id, created_at
messages       id(Integer), session_id, parent_id, role, content, created_at
```

### 현재 API 엔드포인트 (`router.py`)

```
POST   /sessions                          세션 + main 브랜치 생성
GET    /sessions                          세션 목록
GET    /sessions/{session_id}/branches    세션의 브랜치 목록
POST   /branches                          새 브랜치 생성 (from_message_id 받음)
GET    /branches/{branch_id}/thread       브랜치 대화 줄기 조회
POST   /chat                              메시지 전송 + LLM 응답
GET    /chat/history                      (구버전) 세션 전체 메시지 조회
```

### 현재 구현의 핵심 문제

1. **`branches` 테이블에 `parent_branch_id`와 `fork_from_message_id`가 없다.** 어느 메시지에서 분기되었는지 알 수 없어 그래프 시각화와 정확한 context 구성이 불가능하다.
2. **context 구성 로직이 없다.** 현재 `POST /chat`은 branch context를 올바르게 구성하지 않는다 (분기 이전 부모 메시지를 포함하지 않거나, 분기 이후 부모 메시지까지 포함할 가능성이 있다).
3. **Graph API가 없다.** 프론트 시각화용 nodes / edges 데이터를 제공하는 엔드포인트가 없다.

## DB 설계 목표 (추가/수정 필요한 컬럼)

### `branches` 테이블에 추가

```python
parent_branch_id    = Column(Text, nullable=True)   # 부모 브랜치 (root는 null)
fork_from_message_id = Column(Integer, nullable=True) # 분기 기준 메시지
status              = Column(Text, default="active") # active / inactive / deleted
is_collapsed        = Column(Boolean, default=False) # UI 접힘 여부
```

### `messages` 테이블에 추가

```python
branch_id       = Column(Text, nullable=True)   # 소속 브랜치 (현재는 session_id만 있음)
model_provider  = Column(Text, nullable=True)   # openai, anthropic 등
model_name      = Column(Text, nullable=True)   # gpt-4.1-mini 등
input_tokens    = Column(Integer, nullable=True)
output_tokens   = Column(Integer, nullable=True)
status          = Column(Text, default="active")
```

> `messages.parent_id`는 계획서의 `parent_message_id`와 동일한 역할. 컬럼명은 현재 코드(`parent_id`) 기준으로 유지해도 무방하다.

### 새로 추가할 테이블

```
tags            id, session_id, name, color, type(normal|highlight), created_at
message_tags    message_id, tag_id, created_at
branch_tags     branch_id, tag_id, created_at
embeddings      id, message_id, embedding, embedding_model, created_at
```

> `embeddings`에는 session_id, branch_id를 넣지 않는다. message_id → messages join으로 얻을 수 있고, 중복 저장은 정합성 문제를 만든다.

## API 설계 목표

### 수정/추가할 엔드포인트

```
POST   /branches                             session_id + parent_branch_id + fork_from_message_id + title 필수
POST   /branches/{branch_id}/chat            (기존 POST /chat 교체) body: message, model_provider, model_name
GET    /branches/{branch_id}/messages        include_inherited=true|false 파라미터
GET    /sessions/{session_id}/graph          view=branch|message, include_inactive=true|false
GET    /branches/{branch_id}/context-preview query=... 파라미터 (Graph RAG 확인용)
POST   /tags
POST   /messages/{message_id}/tags
POST   /branches/{branch_id}/tags
GET    /sessions/{session_id}/tags
DELETE /messages/{message_id}/tags/{tag_id}
GET    /sessions/{session_id}/search         q=..., type=all|branch|message|tag
PATCH  /branches/{branch_id}                 title, status, is_collapsed 수정
GET    /sessions/{session_id}                세션 상세 (branch_count, message_count 포함)
```

### `POST /branches` 검증 조건 (반드시 확인)

1. `session_id` 존재 여부
2. `parent_branch_id`가 해당 session에 속하는지
3. `fork_from_message_id`가 해당 parent branch에 속하는지

### `GET /branches/{branch_id}/messages` 파라미터

- `include_inherited=false`: 해당 branch에서 분기 후 작성된 메시지만
- `include_inherited=true`: 분기 이전 부모 맥락까지 포함 (채팅창 표시용)
- 기존 `/branches/{branch_id}/thread`는 deprecated 방향. 리팩터링 전까지 두 경로 유지 가능.

## Context 구성 로직 (핵심)

브랜치에서 LLM에 보낼 context는 다음 순서로 구성한다.

```
1. system prompt
2. root branch부터 현재 branch까지 ancestor path
   - 각 부모 브랜치는 해당 child의 fork_from_message_id 이전 메시지까지만 포함
   - 분기 이후 부모 브랜치 메시지는 포함하지 않는다
3. 현재 branch에서 작성된 메시지 (전체)
4. 사용자의 새 질문
```

### 예시

```
Root branch:  M1(user) → M2(assistant) → M3(user) → M4(assistant)
M2에서 Branch B 생성:  M5(user) → M6(assistant)

Branch B에서 새 질문 시 context:
  포함: M1, M2, M5, M6
  제외: M3, M4  ← 분기 이후 부모 메시지
```

### Context Builder 구조 (별도 서비스로 분리)

```python
# app/services/context_builder.py
def build_context(branch_id: str, new_user_message: str) -> list[dict]:
    branch_chain = get_branch_ancestor_chain(branch_id)  # [root, ..., current]
    context_messages = []
    for b in branch_chain:
        if b.id == branch_id:
            messages = get_messages(branch_id=b.id)
        else:
            child = get_child_branch_in_chain(b, branch_chain)
            messages = get_messages_until(branch_id=b.id, until_message_id=child.fork_from_message_id)
        context_messages.extend(messages)
    context_messages = fit_to_token_budget(context_messages)
    context_messages.append({"role": "user", "content": new_user_message})
    return context_messages
```

> Context Builder가 확정되어야 `GET /branches/{branch_id}/messages`의 `include_inherited` 반환 기준이 정해진다. **context_builder 먼저 구현한다.**

## Graph RAG 구현 범위

MVP는 논문 수준 GraphRAG가 아닌 **Graph-aware context retrieval**이다.

### Context 우선순위

| 우선순위 | context 후보 |
|---|---|
| 1 | 현재 branch 메시지 |
| 2 | ancestor path 메시지 (fork 이전까지) |
| 3 | fork_from_message 자체 |
| 4 | tag / highlight된 메시지 |
| 5 | sibling branch summary |
| 6 | vector search top-k |

### 구현 단계

1. **1단계 (MVP):** graph 구조만으로 context 구성. Vector DB 불필요.
2. **2단계:** tag/highlight 메시지를 trimming에서 우선 보존.
3. **3단계:** embedding 생성 + vector similarity top-k.
4. **4단계:** `GET /branches/{branch_id}/context-preview` API로 시연 가능하게.

## 우선 구현 순서

```
1. branches에 parent_branch_id, fork_from_message_id 컬럼 추가
2. POST /branches request body 수정 (위 두 필드 필수화)
3. context_builder.py 구현 및 분리
4. GET /branches/{branch_id}/messages 구현 (include_inherited 파라미터)
5. POST /chat → POST /branches/{branch_id}/chat 경로 변경 + context_builder 연동
6. GET /sessions/{session_id}/graph?view=branch 구현
7. Tag API 구현
8. GET /branches/{branch_id}/context-preview 구현
9. 모델 변경 구조 (model_provider, model_name 저장)
10. branch 비활성화 / 이름 수정 (PATCH /branches/{branch_id})
```

## 예외 처리 기준

| 상황 | HTTP Status |
|---|---|
| session_id 없음 | 404 |
| branch_id 없음 | 404 |
| fork_from_message_id 없음 | 404 |
| fork message가 parent branch에 없음 | 400 |
| inactive branch에 채팅 요청 | 409 |
| LLM API 오류 | 502 |
| 요청 body 검증 실패 | 422 |

## MVP 완료 기준

- 새 session 생성 시 root branch가 함께 생성된다.
- root branch에서 LLM과 대화할 수 있다.
- 특정 message_id 기준으로 child branch를 만들 수 있다.
- child branch는 분기 이전 context를 공유하지만, 분기 이후 부모 메시지는 포함하지 않는다.
- child branch 대화가 root branch에 섞이지 않는다.
- `GET /sessions/{session_id}/graph`에서 branch nodes와 fork edges가 반환된다.
- tag를 생성하고 메시지 또는 브랜치에 붙일 수 있다.
- Swagger UI에서 위 기능을 순서대로 확인할 수 있다.

## 코드 수정 시 주의사항

- `messages.parent_id` = 계획서의 `parent_message_id`. 컬럼명 변경보다 문서상 통일이 낫다.
- `conversations` 테이블 = 계획서의 `sessions`. 코드 변수명은 현행 유지하되 API 응답 키는 `session_id`로 통일한다.
- `sessions` 테이블에 `root_branch_id` 역참조 컬럼을 추가하지 않는다. `branches.parent_branch_id IS NULL AND session_id = ?` 쿼리로 root branch를 조회한다.
- 삭제는 hard delete 금지. `status = 'deleted'`로 soft delete한다.
- root branch는 삭제 또는 inactive로 변경할 수 없다.
- LLM Provider는 adapter 패턴으로 분리한다 (`OpenAIProvider`, `AnthropicProvider`, `DummyProvider`).
- 테스트는 반드시 `fork_from_message_id` 없이는 작성하지 않는다 — 이 필드 없이 branch만 만들면 나중에 graph와 Graph RAG 구조를 전부 다시 갈아엎어야 한다.
