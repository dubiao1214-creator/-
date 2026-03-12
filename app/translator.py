import json
from collections.abc import Iterator

from openai import OpenAI

from app.config import Settings, get_settings
from app.prompts import (
    DEV_TO_PM_SYSTEM_PROMPT,
    DEV_TO_PM_USER_TEMPLATE,
    PM_TO_DEV_SYSTEM_PROMPT,
    PM_TO_DEV_USER_TEMPLATE,
)
from app.schemas import Direction, SceneType, TranslationRequest

PRODUCT_KEYWORDS = ("用户", "需求", "功能", "推荐", "停留时长", "商业", "转化", "增长")
TECHNICAL_KEYWORDS = ("QPS", "缓存", "数据库", "索引", "延迟", "吞吐", "服务", "接口")


def build_messages(direction: Direction, text: str) -> list[dict[str, str]]:
    if direction == Direction.pm_to_dev:
        return [
            {"role": "system", "content": PM_TO_DEV_SYSTEM_PROMPT},
            {"role": "user", "content": PM_TO_DEV_USER_TEMPLATE.format(text=text)},
        ]

    return [
        {"role": "system", "content": DEV_TO_PM_SYSTEM_PROMPT},
        {"role": "user", "content": DEV_TO_PM_USER_TEMPLATE.format(text=text)},
    ]


def detect_scene(text: str) -> SceneType:
    if any(keyword in text for keyword in PRODUCT_KEYWORDS):
        return SceneType.requirement
    if any(keyword in text for keyword in TECHNICAL_KEYWORDS):
        return SceneType.technical
    return SceneType.unknown


def format_sse_event(event: str, data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    return f"event: {event}\ndata: {payload}\n\n"


class TranslatorService:
    def __init__(self, settings: Settings | None = None, client: OpenAI | None = None) -> None:
        self.settings = settings or get_settings()
        self._client = client

    @property
    def client(self) -> OpenAI:
        # Delay client creation so validation/tests do not require a live API key.
        if self._client is None:
            self._client = OpenAI(
                api_key=self.settings.deepseek_api_key,
                base_url=self.settings.deepseek_base_url,
            )
        return self._client

    def _stream_completion(self, messages: list[dict[str, str]]) -> Iterator:
        return self.client.chat.completions.create(
            model=self.settings.deepseek_model,
            messages=messages,
            stream=True,
        )

    async def stream_translation(self, payload: TranslationRequest):
        scene = detect_scene(payload.text) if payload.auto_detect else SceneType.unknown
        # Send metadata first so the UI can update badges before content starts streaming.
        yield {
            "event": "meta",
            "data": {
                "direction": payload.direction.value,
                "scene": scene.value,
                "model": self.settings.deepseek_model,
            },
        }

        messages = build_messages(payload.direction, payload.text)
        parts: list[str] = []

        try:
            for chunk in self._stream_completion(messages):
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if not delta:
                    continue
                parts.append(delta)
                yield {"event": "chunk", "data": {"text": delta}}
        except Exception:
            yield {"event": "error", "data": {"message": "DeepSeek 调用失败，请检查 API Key 或网络配置。"}}
            return

        # Keep a full copy so the client receives both incremental updates and a final stable result.
        final_text = "".join(parts)
        yield {"event": "done", "data": {"text": final_text}}
