"""
Verifica rapida delle chiavi presenti in .env (nessun output di segreti).

Uso: python scripts/sanity_check.py
"""

from __future__ import annotations

import sys
from collections.abc import Callable
from pathlib import Path

# Aggiunge la root del progetto a sys.path quando si lancia senza pip install -e .
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from src.config import get_settings
from src.providers import AnthropicProvider, GeminiProvider, OpenAIProvider


def _ping(name: str, fn: Callable[[], object]) -> bool:
    try:
        fn()
        print(f"{name}: ok")
        return True
    except Exception as exc:
        print(f"{name}: FAIL — {exc}")
        return False


def main() -> int:
    settings = get_settings()
    failures = 0

    if settings.openai_api_key:
        failures += not _ping(
            "openai",
            lambda: OpenAIProvider(settings).complete(
                [{"role": "user", "content": "Reply with exactly: OK"}]
            ),
        )
    else:
        print("openai: skipped (OPENAI_API_KEY assente)")

    if settings.google_api_key:
        failures += not _ping(
            "gemini",
            lambda: GeminiProvider(settings).complete(
                [{"role": "user", "content": "Reply with exactly: OK"}]
            ),
        )
    else:
        print("gemini: skipped (GOOGLE_API_KEY / GEMINI_API_KEY assente)")

    if settings.anthropic_api_key:
        failures += not _ping(
            "anthropic",
            lambda: AnthropicProvider(settings).complete(
                [{"role": "user", "content": "Reply with exactly: OK"}]
            ),
        )
    else:
        print("anthropic: skipped (ANTHROPIC_API_KEY assente)")

    if settings.supabase_url and (
        settings.supabase_anon_key or settings.supabase_service_role_key
    ):
        try:
            from supabase import create_client

            key = settings.supabase_service_role_key or settings.supabase_anon_key
            assert key is not None
            create_client(settings.supabase_url, key)
            print("supabase: client create ok (nessuna query eseguita)")
        except Exception as exc:
            print(f"supabase: FAIL — {exc}")
            failures += 1
    else:
        print("supabase: skipped (SUPABASE_URL o chiavi assenti)")

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
