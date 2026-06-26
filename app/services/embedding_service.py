import json
import math
import uuid

from openai import OpenAI
from dotenv import load_dotenv

from app.repositories import repository

load_dotenv()
_client = OpenAI()


def generate_embedding(text: str) -> list[float]:
    response = _client.embeddings.create(model="text-embedding-3-small", input=text)
    return response.data[0].embedding


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def save_message_embedding(db, message_id: int, text: str):
    """메시지 embedding을 생성하고 DB에 저장한다."""
    vector = generate_embedding(text)
    repository.save_embedding(db, message_id, vector, "text-embedding-3-small")


def search_similar_messages(db, session_id: str, query: str, exclude_branch_ids: list[str], top_k: int = 3) -> list:
    """query와 유사한 메시지를 exclude_branch_ids 브랜치를 제외한 곳에서 찾는다."""
    query_vector = generate_embedding(query)
    all_embeddings = repository.get_session_embeddings(db, session_id, exclude_branch_ids)

    scored = []
    for emb_row, message in all_embeddings:
        vector = json.loads(emb_row.embedding)
        score = cosine_similarity(query_vector, vector)
        scored.append((score, message))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [msg for score, msg in scored[:top_k] if score > 0.7]
