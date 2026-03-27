from __future__ import annotations

from anthropic import Anthropic

from src.config import Settings
from src.providers.openai_client import ChatMessage


class AnthropicProvider:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def complete(self, messages: list[ChatMessage]) -> str:
        if not self._settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY mancante nel file .env")
        system_parts = [m["content"] for m in messages if m["role"] == "system"]
        system = "\n\n".join(system_parts) if system_parts else None
        api_messages = [
            {"role": m["role"], "content": m["content"]}
            for m in messages
            if m["role"] in ("user", "assistant")
        ]
        if not api_messages:
            return ""

        client = Anthropic(api_key=self._settings.anthropic_api_key)
        kwargs: dict = {
            "model": self._settings.anthropic_model,
            "max_tokens": 1024,
            "messages": api_messages,
        }
        if system:
            kwargs["system"] = system
        response = client.messages.create(**kwargs)
        for block in response.content:
            if block.type == "text":
                return block.text
        return ""
