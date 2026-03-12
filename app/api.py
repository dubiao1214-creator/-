from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.schemas import TranslationRequest
from app.translator import TranslatorService, format_sse_event

router = APIRouter()


def get_translator_service() -> TranslatorService:
    return TranslatorService()


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/api/translate/stream")
async def translate_stream(
    payload: TranslationRequest,
    translator_service: TranslatorService = Depends(get_translator_service),
) -> StreamingResponse:
    async def event_stream():
        # The service yields structured events; the API layer only converts them to SSE wire format.
        async for item in translator_service.stream_translation(payload):
            yield format_sse_event(item["event"], item["data"])

    return StreamingResponse(event_stream(), media_type="text/event-stream")
