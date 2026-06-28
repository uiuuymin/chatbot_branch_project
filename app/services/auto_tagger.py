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


def generate_branch_name_from_qa(user_message: str, answer: str) -> str:
    """분기 후 해당 브랜치에서 처음 나눈 질문/답변을 보고 브랜치 이름을 생성한다."""
    prompt = (
        "다음 질문과 답변을 보고 이 대화 브랜치의 이름을 10글자 이내로 지어줘. "
        "이름만 답해줘. 다른 말은 하지 마.\n\n"
        f"질문: {user_message}\n답변: {answer}\n\n이름:"
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


def summarize_branch_for_merge(messages: list) -> str:
    """머지 시 다른 브랜치와 합칠 수 있도록 브랜치 전체 맥락을 요약한다."""
    if not messages:
        return "(대화 없음)"
    conversation = "\n".join([f"{m.role}: {m.content}" for m in messages])
    prompt = (
        "다음 대화를 다른 브랜치의 대화와 합쳐서 참고할 수 있도록 핵심 내용 요약해줘. "
        "요약만 답해줘. 다른 말은 하지 마.\n\n"
        f"{conversation}\n\n요약:"
    )
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
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


def auto_tag_branch(db, session_id: str, branch_id: str) -> list[str]:
    """브랜치 전체 대화를 분석해 태그를 자동 생성하고 브랜치에 부여한다.

    세션에 같은 이름의 태그가 이미 있으면 재사용한다.
    메시지가 없으면 빈 리스트를 반환한다.
    """
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
