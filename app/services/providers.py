from abc import ABC, abstractmethod

from dotenv import load_dotenv

load_dotenv()


class LLMProvider(ABC):
    @abstractmethod
    def generate(self, context: list[dict], model_name: str, system_prompt: str) -> tuple[str, int, int]:
        """context를 받아 (답변, input_tokens, output_tokens)를 반환한다."""


class OpenAIProvider(LLMProvider):
    def __init__(self):
        from openai import OpenAI
        self._client = OpenAI()

    def generate(self, context, model_name, system_prompt):
        messages = [{"role": "system", "content": system_prompt}] + context
        response = self._client.chat.completions.create(model=model_name, messages=messages)
        content = response.choices[0].message.content
        return content, response.usage.prompt_tokens, response.usage.completion_tokens


class AnthropicProvider(LLMProvider):
    def __init__(self):
        import anthropic
        self._client = anthropic.Anthropic()

    def generate(self, context, model_name, system_prompt):
        response = self._client.messages.create(
            model=model_name,
            system=system_prompt,
            messages=context,
            max_tokens=1024,
        )
        content = response.content[0].text
        return content, response.usage.input_tokens, response.usage.output_tokens


_PROVIDERS: dict[str, LLMProvider] = {}


def get_provider(model_provider: str) -> LLMProvider:
    """model_provider 문자열에 맞는 LLMProvider 인스턴스를 반환한다. 인스턴스는 재사용한다."""
    if model_provider not in _PROVIDERS:
        if model_provider == "openai":
            _PROVIDERS["openai"] = OpenAIProvider()
        elif model_provider == "anthropic":
            _PROVIDERS["anthropic"] = AnthropicProvider()
        else:
            raise ValueError(f"지원하지 않는 model_provider: '{model_provider}'. openai / anthropic 중 하나를 사용하세요.")
    return _PROVIDERS[model_provider]
