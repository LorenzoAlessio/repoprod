from __future__ import annotations

import argparse

from src.config import get_settings
from src.providers import AnthropicProvider, GeminiProvider, OpenAIProvider


def main() -> None:
    parser = argparse.ArgumentParser(description="Un turno di chat con il provider scelto.")
    parser.add_argument(
        "--provider",
        choices=("openai", "gemini", "anthropic"),
        default="openai",
        help="Backend LLM da usare",
    )
    parser.add_argument(
        "--message",
        default="Rispondi in una frase: cos'è un agente basato su LLM?",
        help="Messaggio utente",
    )
    args = parser.parse_args()

    settings = get_settings()
    messages = [{"role": "user", "content": args.message}]

    if args.provider == "openai":
        reply = OpenAIProvider(settings).complete(messages)
    elif args.provider == "gemini":
        reply = GeminiProvider(settings).complete(messages)
    else:
        reply = AnthropicProvider(settings).complete(messages)

    print(reply)


if __name__ == "__main__":
    main()
