from __future__ import annotations

from typing import TypedDict

from openai import OpenAI

from src.config import Settings


class ChatMessage(TypedDict):
    role: str
    content: str


class OpenAIProvider:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def complete(self, messages: list[ChatMessage]) -> str:
        if not self._settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY mancante nel file .env")
        client = OpenAI(api_key=self._settings.openai_api_key)
        response = client.chat.completions.create(
            model=self._settings.openai_model,
            messages=messages,
        )
        choice = response.choices[0].message.content
        return choice or ""
