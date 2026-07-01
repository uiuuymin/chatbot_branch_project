import io

MAX_CHARS = 50_000       # 저장할 전체 텍스트 상한선
SUMMARY_INPUT_CHARS = 8_000  # 요약 생성에 사용할 텍스트 길이


def extract_text(filename: str, content: bytes) -> str:
    """파일 확장자에 따라 텍스트를 추출한다."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        text = _extract_pdf(content)
    elif ext == "docx":
        text = _extract_docx(content)
    elif ext in ("txt", "md", "csv", "json", "py", "js", "ts", "html", "xml"):
        text = content.decode("utf-8", errors="replace")
    else:
        raise ValueError(f"지원하지 않는 파일 형식입니다: .{ext}  (지원: pdf, docx, txt, md, csv, json 등 텍스트 파일)")

    text = text.strip()
    if len(text) > MAX_CHARS:
        text = text[:MAX_CHARS] + f"\n\n[파일이 길어 앞 {MAX_CHARS:,}자만 포함했습니다.]"
    return text


def generate_summary(filename: str, text: str, model_provider: str = "openai", model_name: str = "gpt-4o-mini") -> str | None:
    """파일 내용을 LLM으로 3~5문장 요약한다. 실패 시 None 반환."""
    from app.services.providers import get_provider
    try:
        provider = get_provider(model_provider)
        truncated = text[:SUMMARY_INPUT_CHARS]
        context = [{"role": "user", "content": f"다음 파일의 핵심 내용을 3~5문장으로 간결하게 요약해줘.\n\n파일명: {filename}\n\n{truncated}"}]
        summary, _, _ = provider.generate(context, model_name, "문서 요약 전문가입니다.")
        return summary
    except Exception:
        return None


def _extract_pdf(content: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(content))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages)


def _extract_docx(content: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(content))
    return "\n".join(p.text for p in doc.paragraphs)
