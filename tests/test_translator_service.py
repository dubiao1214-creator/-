from types import SimpleNamespace

from app.schemas import Direction, TranslationRequest
from app.translator import TranslatorService


def make_chunk(text: str):
    return SimpleNamespace(
        choices=[SimpleNamespace(delta=SimpleNamespace(content=text))],
    )


class SuccessfulClient:
    class chat:
        class completions:
            @staticmethod
            def create(**kwargs):
                assert kwargs["model"] == "deepseek-chat"
                assert kwargs["stream"] is True
                return [make_chunk("## 需求目标\n"), make_chunk("先明确业务目标")]


class FailingClient:
    class chat:
        class completions:
            @staticmethod
            def create(**kwargs):
                raise RuntimeError("boom")


async def collect_events(service, payload):
    return [item async for item in service.stream_translation(payload)]


def test_translator_service_streams_deepseek_chunks():
    payload = TranslationRequest(direction=Direction.pm_to_dev, text="我们需要一个智能推荐功能")
    service = TranslatorService(client=SuccessfulClient())

    events = __import__("asyncio").run(collect_events(service, payload))

    assert events[0]["event"] == "meta"
    assert events[1]["event"] == "chunk"
    assert events[2]["event"] == "chunk"
    assert events[3]["event"] == "done"
    assert events[3]["data"]["text"] == "## 需求目标\n先明确业务目标"


def test_translator_service_yields_friendly_error_event():
    payload = TranslationRequest(direction=Direction.dev_to_pm, text="QPS提升了30%")
    service = TranslatorService(client=FailingClient())

    events = __import__("asyncio").run(collect_events(service, payload))

    assert events[0]["event"] == "meta"
    assert events[1]["event"] == "error"
    assert "DeepSeek 调用失败" in events[1]["data"]["message"]
