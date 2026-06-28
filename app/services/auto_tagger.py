from openai import OpenAI
from dotenv import load_dotenv

from app.repositories import repository

load_dotenv()
client = OpenAI()


def extract_branch_keywords(messages: list) -> list[str]:
    """브랜치 전체 대화를 읽고 핵심 주제 2~3개를 추출한다."""
    conversation = "\n".join([f"{m.role}: {m.content}" for m in messages])
    prompt = (
        "다음 대화의 핵심 주제를 2~3개 추출해줘. "
        "단어나 짧은 구문으로 쉼표 구분해서 답해줘. 다른 말은 하지 마.\n\n"
        f"{conversation}\n\n주제:"
    )
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=50,
    )
    raw = response.choices[0].message.content.strip()
    keywords = [k.strip() for k in raw.split(",") if k.strip()]
    return keywords[:3]


def generate_session_name(user_message: str, assistant_message: str) -> str:
    """첫 번째 대화를 보고 세션 제목을 생성한다."""
    prompt = (
        "다음 대화를 보고 대화 제목을 15글자 이내로 지어줘. "
        "제목만 답해줘. 다른 말은 하지 마.\n\n"
        f"사용자: {user_message}\nAI: {assistant_message}\n\n제목:"
    )
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=30,
    )
    return response.choices[0].message.content.strip()


def generate_name_from_message(message_content: str) -> str:
    """fork 기준 메시지 내용을 보고 브랜치 이름을 생성한다."""
    prompt = (
        "다음 메시지에서 시작되는 대화 브랜치의 이름을 10글자 이내로 지어줘. "
        "이름만 답해줘. 다른 말은 하지 마.\n\n"
        f"메시지: {message_content}\n\n이름:"
    )
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=30,
    )
    return response.choices[0].message.content.strip()


def generate_name_from_conversation(messages: list) -> str:
    """브랜치 전체 대화를 읽고 브랜치 이름을 생성한다."""
    conversation = "\n".join([f"{m.role}: {m.content}" for m in messages])
    prompt = (
        "다음 대화의 핵심 주제를 담은 브랜치 이름을 10글자 이내로 지어줘. "
        "이름만 답해줘. 다른 말은 하지 마.\n\n"
        f"{conversation}\n\n이름:"
    )
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=30,
    )
    return response.choices[0].message.content.strip()


def auto_name_branch(db, branch_id: str) -> str:
    """브랜치 대화 내용을 분석해 이름을 자동 생성하고 DB에 저장한다."""
    messages = repository.get_branch_messages(db, branch_id)
    if not messages:
        return "새 가지"
    name = generate_name_from_conversation(messages)
    repository.update_branch_name(db, branch_id, name)
    return name


def extract_user_memory(messages: list) -> str:
    """대화 전체를 읽고 사용자에 대한 핵심 정보를 추출한다."""
    conversation = "\n".join([f"{m.role}: {m.content}" for m in messages])
    prompt = (
        "다음 대화에서 사용자에 대한 중요한 정보(이름, 직업, 관심사, 선호도 등)를 추출해줘. "
        "없으면 '없음'이라고 답해줘. 3문장 이내로 간결하게 작성해줘. 다른 말은 하지 마.\n\n"
        f"{conversation}\n\n정보:"
    )
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=100,
    )
    return response.choices[0].message.content.strip()


def auto_tag_branch(db, session_id: str, branch_id: str, after_message_id: int | None = None) -> list[str]:
    """브랜치 대화를 분석해 태그를 자동 생성하고 브랜치에 부여한다.

    after_message_id가 주어지면 그 이후 메시지만 사용한다 (fork 시 부모 브랜치 태깅 용도).
    세션에 같은 이름의 태그가 이미 있으면 재사용한다.
    메시지가 없으면 빈 리스트를 반환한다.
    """
    if after_message_id is not None:
        messages = repository.get_branch_messages_after(db, branch_id, after_message_id)
    else:
        messages = repository.get_branch_messages(db, branch_id)
    if not messages:
        return []

    keywords = extract_branch_keywords(messages)

    existing_tags = repository.get_session_tags(db, session_id)
    existing_map = {tag.name: tag for tag in existing_tags}

    assigned = []
    for name in keywords:
        if name in existing_map:
            tag = existing_map[name]
        else:
            tag = repository.create_tag(db, session_id, name, color=None, type="normal")
            existing_map[name] = tag
        repository.add_branch_tag(db, branch_id, tag.id)
        assigned.append(name)

    return assigned
