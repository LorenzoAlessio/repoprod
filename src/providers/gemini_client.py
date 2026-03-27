from __future__ import annotations

import warnings

with warnings.catch_warnings():
    warnings.simplefilter("ignore", FutureWarning)
    import google.generativeai as genai

from src.config import Settings
from src.providers.openai_client import ChatMessage


class GeminiProvider:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def complete(self, messages: list[ChatMessage]) -> str:
        if not self._settings.google_api_key:
            raise ValueError("GOOGLE_API_KEY o GEMINI_API_KEY mancante nel file .env")
        genai.configure(api_key=self._settings.google_api_key)

        system_chunks = [m["content"] for m in messages if m["role"] == "system"]
        system_instruction = "\n\n".join(system_chunks) if system_chunks else None
        rest = [m for m in messages if m["role"] != "system"]
        if not rest:
            return ""

        if system_instruction:
            model = genai.GenerativeModel(
                self._settings.gemini_model,
                system_instruction=system_instruction,
            )
        else:
            model = genai.GenerativeModel(self._settings.gemini_model)

        history: list[dict[str, list[str]]] = []
        for m in rest[:-1]:
            if m["role"] == "assistant":
                history.append({"role": "model", "parts": [m["content"]]})
            elif m["role"] == "user":
                history.append({"role": "user", "parts": [m["content"]]})

        last = rest[-1]
        if last["role"] != "user":
            combined = "\n\n".join(f"{m['role']}: {m['content']}" for m in rest)
            response = model.generate_content(combined)
            return (response.text or "").strip()

        chat = model.start_chat(history=history)
        response = chat.send_message(last["content"])
        return (response.text or "").strip()
