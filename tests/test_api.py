from fastapi.testclient import TestClient

from app.main import app, get_translator_service


class FakeTranslatorService:
    async def stream_translation(self, payload):
        yield {"event": "meta", "data": {"direction": payload.direction.value, "scene": "需求讨论"}}
        yield {"event": "chunk", "data": {"text": "## 需求目标\n先明确目标"}}
        yield {"event": "done", "data": {"text": "## 需求目标\n先明确目标"}}


def test_translate_endpoint_rejects_blank_text():
    client = TestClient(app)

    response = client.post(
        "/api/translate/stream",
        json={"direction": "pm_to_dev", "text": "   ", "auto_detect": True},
    )

    assert response.status_code == 422


def test_translate_endpoint_streams_meta_chunk_and_done_events():
    app.dependency_overrides[get_translator_service] = lambda: FakeTranslatorService()
    client = TestClient(app)

    response = client.post(
        "/api/translate/stream",
        json={
            "direction": "pm_to_dev",
            "text": "我们需要一个智能推荐功能，提升用户停留时长",
            "auto_detect": True,
        },
    )

    try:
        assert response.status_code == 200
        assert "event: meta" in response.text
        assert "event: chunk" in response.text
        assert "event: done" in response.text
        assert '"scene":"需求讨论"' in response.text
    finally:
        app.dependency_overrides.clear()


def test_root_page_renders_app_shell():
    client = TestClient(app)

    response = client.get("/")

    assert response.status_code == 200
    assert "职能沟通翻译助手" in response.text
    assert "Markdown 预览" in response.text
    assert "流式轨迹" in response.text
