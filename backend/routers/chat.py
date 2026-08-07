from pydantic import BaseModel
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from schemas.chat import ChatChunk, ChatDisclaimer, ChatDone, ChatError, ChatRequest
from services import chat

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _sse(event: str, data: BaseModel) -> str:
    """Serialize one SSE frame: 'event: <name>\ndata: <json>\n\n'."""
    return f"event: {event}\ndata: {data.model_dump_json()}\n\n"


@router.post("")
async def chat_stream(req: ChatRequest, request: Request):
    """Healing Q&A chat: dual-route (casual / medical-RAG) SSE stream."""

    async def event_stream():
        async for evt in chat.stream_chat(req):
            if await request.is_disconnected():
                break
            if isinstance(evt, ChatChunk):
                yield _sse("chunk", evt)
            elif isinstance(evt, ChatDisclaimer):
                yield _sse("disclaimer", evt)
            elif isinstance(evt, ChatDone):
                yield _sse("done", evt)
            else:
                yield _sse("error", evt)

    return StreamingResponse(event_stream(), media_type="text/event-stream")
