from app.repositories import repository
from app.services.context_builder import get_branch_ancestor_chain
from app.services.providers import get_provider

_EXTRACTION_PROMPT = """\
너는 대화 브랜치 merge를 위한 정보 추출기다.

아래 대화는 하나의 공통 조상 대화에서 갈라진 두 개의 브랜치다.
목표는 두 브랜치를 합칠 때 필요한 정보를 최대한 빠뜨리지 않고 구조화하는 것이다.

중요 규칙:
- 대화에 명시적으로 나온 내용만 정리한다.
- 추측, 보완, 새로운 제안, 외부 지식 추가는 금지한다.
- 사소해 보여도 이후 merge에 영향을 줄 결정, 조건, 선호, 제약, 수정 요청, 제외된 방향은 보존한다.
- 같은 내용이 반복되면 한 번만 정리하되 더 구체적인 표현을 우선한다.
- 이전 내용이 나중에 수정되었으면 최종 내용을 우선 정리하고 "(수정됨)"이라고 표시한다.
- 두 브랜치가 충돌하면 임의로 해결하지 말고 충돌 항목으로 분리한다.
- "좋다/별로다/이 방향으로 가자/이건 빼자/나중에 하자"처럼 사용자의 평가나 선택이 드러난 문장은 반드시 반영한다.

[공통 조상 대화]
{common_conversation}

[브랜치 1 고유 대화]
{branch1_conversation}

[브랜치 2 고유 대화]
{branch2_conversation}

아래 형식으로 정리해라. 해당 내용이 없는 항목은 생략한다.

## 공통 조상 핵심 내용
**공유된 목표:**
**공유된 전제:**
**공통으로 결정된 사항:**
**공통 제약조건 / 선호:**
**보류 또는 미해결 사항:**

## 브랜치 1 핵심 내용
**새로 결정된 사항:**
**핵심 결론:**
**추가된 요구사항 / 제약조건:**
**중요하게 다룬 세부사항:**
**제외하거나 수정한 방향:**
**미해결 사항:**

## 브랜치 2 핵심 내용
**새로 결정된 사항:**
**핵심 결론:**
**추가된 요구사항 / 제약조건:**
**중요하게 다룬 세부사항:**
**제외하거나 수정한 방향:**
**미해결 사항:**

## 두 브랜치 공통 내용
**공유하는 결론:**
**공유하는 결정사항:**
**공유하는 요구사항 / 제약조건:**

## 브랜치 간 차이
**브랜치 1에만 있는 내용:**
**브랜치 2에만 있는 내용:**
**서로 다른 결론 또는 방향:**
**충돌하는 결정사항:**

## merge 시 보존해야 할 내용
**반드시 유지해야 할 공통 내용:**
**브랜치 1에서 가져올 만한 내용:**
**브랜치 2에서 가져올 만한 내용:**
**충돌 때문에 사용자 확인이 필요한 내용:**
**빠지면 안 되는 구체값 / 표현 / 조건:**
"""

_SYNTHESIS_PROMPT = """\
너는 두 대화 브랜치의 장점을 합쳐 하나의 통합 응답을 작성하는 merge assistant다.

아래에는 두 브랜치에서 추출한 핵심 정보가 있다.
이 정보를 바탕으로 사용자가 이어서 사용할 수 있는 하나의 통합 응답을 작성하라.

규칙:
- 추출 결과에 있는 내용만 사용한다.
- 새로운 사실, 새로운 요구사항, 외부 지식은 추가하지 않는다.
- 두 브랜치가 공유하는 내용은 자연스럽게 통합한다.
- 충돌하지 않는 내용은 브랜치 구분 없이 모두 반영한다.
- 충돌하는 내용은 임의로 선택하지 말고 "⚠️ 선택 필요: ..." 형식으로 표시한다.
- 사용자가 명확히 선호하거나 결정한 내용은 우선 반영한다.
- 사용자가 제외하거나 싫다고 한 방향은 다시 제안하지 않는다.
- 중복 표현은 정리하되 중요한 구체값·조건·표현은 삭제하지 않는다.
- 최종 응답은 하나의 자연스러운 답변처럼 작성한다.

[브랜치 정보 추출 결과]
{merge_summary}

아래 형식으로 작성하라.

## 통합 답변
(두 브랜치의 내용을 합친 자연스러운 응답)

## 반영한 핵심 결정사항
-

## 브랜치별 반영한 내용
**브랜치 1에서 반영한 내용:**
**브랜치 2에서 반영한 내용:**

## 확인이 필요한 충돌 또는 미해결 사항
(없으면 생략)
"""


def _format_messages(messages: list) -> str:
    if not messages:
        return "(없음)"
    return "\n".join([f"{m.role}: {m.content}" for m in messages])


def _get_full_context_items(db, branch_id: str) -> list[tuple[str, object]]:
    """branch_id 기준 LLM context 순서로 (branch_id, message) 쌍을 반환한다."""
    chain = get_branch_ancestor_chain(db, branch_id)
    result = []
    for i, b in enumerate(chain):
        if b.id == branch_id:
            msgs = repository.get_branch_messages(db, b.id)
        else:
            child = chain[i + 1]
            msgs = repository.get_messages_until(db, b.id, child.fork_from_message_id)
        for m in msgs:
            result.append((b.id, m))
    return result


def get_merge_contexts(db, branch_id_1: str, branch_id_2: str) -> tuple[list, list, list]:
    """두 브랜치 context를 공통 조상 / 브랜치1 고유 / 브랜치2 고유로 분리한다.

    message.id가 동일한 공통 prefix를 common으로, 이후를 각 브랜치 고유로 반환한다.
    """
    items_1 = _get_full_context_items(db, branch_id_1)
    items_2 = _get_full_context_items(db, branch_id_2)

    i = 0
    while i < len(items_1) and i < len(items_2) and items_1[i][1].id == items_2[i][1].id:
        i += 1

    common_msgs = [m for _, m in items_1[:i]]
    unique_msgs_1 = [m for _, m in items_1[i:]]
    unique_msgs_2 = [m for _, m in items_2[i:]]

    return common_msgs, unique_msgs_1, unique_msgs_2


def perform_merge(
    db,
    branch_id_1: str,
    branch_id_2: str,
    model_provider: str = "openai",
    model_name: str = "gpt-4o",
) -> dict:
    """두 브랜치를 2단계로 merge한다.

    1단계: 공통 조상 / 브랜치 고유 대화를 분리해 결정사항·제약·차이를 구조화 추출
    2단계: 추출 결과를 바탕으로 통합 답변 생성

    Returns:
        merge_summary: 1단계 추출 결과 (구조화된 텍스트)
        merged_content: 2단계 통합 답변
    """
    branch_1 = repository.get_branch(db, branch_id_1)
    branch_2 = repository.get_branch(db, branch_id_2)

    if branch_1 is None:
        raise ValueError(f"branch_id_1 '{branch_id_1}'를 찾을 수 없습니다")
    if branch_2 is None:
        raise ValueError(f"branch_id_2 '{branch_id_2}'를 찾을 수 없습니다")
    if branch_id_1 == branch_id_2:
        raise ValueError("같은 브랜치는 merge할 수 없습니다")
    if branch_1.session_id != branch_2.session_id:
        raise ValueError("두 브랜치가 같은 session에 속해야 합니다")

    common_msgs, unique_msgs_1, unique_msgs_2 = get_merge_contexts(db, branch_id_1, branch_id_2)

    provider = get_provider(model_provider)

    # Stage 1: 구조화 추출
    extraction_input = _EXTRACTION_PROMPT.format(
        common_conversation=_format_messages(common_msgs),
        branch1_conversation=_format_messages(unique_msgs_1),
        branch2_conversation=_format_messages(unique_msgs_2),
    )
    merge_summary, _, _ = provider.generate(
        [{"role": "user", "content": extraction_input}],
        model_name,
        system_prompt="",
        max_tokens=4096,
    )

    # Stage 2: 통합 답변 생성
    synthesis_input = _SYNTHESIS_PROMPT.format(merge_summary=merge_summary)
    merged_content, _, _ = provider.generate(
        [{"role": "user", "content": synthesis_input}],
        model_name,
        system_prompt="",
        max_tokens=4096,
    )

    return {
        "merge_summary": merge_summary,
        "merged_content": merged_content,
    }
