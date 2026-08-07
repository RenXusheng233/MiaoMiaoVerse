from pydantic import BaseModel
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from schemas.copywriting import (
    CopyRegenerateRequest,
    CopyRequest,
    SSEChunk,
    SSEDone,
    SSEError,
)
from services import copywriting

router = APIRouter(prefix="/api/copy", tags=["copywriting"])


def _sse(event: str, data: BaseModel) -> str:
    """Serialize one SSE frame: 'event: <name>\ndata: <json>\n\n'."""
    return f"event: {event}\ndata: {data.model_dump_json()}\n\n"


@router.post("/generate")
async def generate_copy(req: CopyRequest, request: Request):
    """Generate three style versions in parallel, streamed via SSE."""

    async def event_stream():
        async for evt in copywriting.stream_copy(req):
            if await request.is_disconnected():
                break
            if isinstance(evt, SSEChunk):
                yield _sse("chunk", evt)
            elif isinstance(evt, SSEDone):
                yield _sse("done", evt)
            else:
                yield _sse("error", evt)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/regenerate")
async def regenerate_copy(req: CopyRegenerateRequest, request: Request):
    """Regenerate a single style version, streamed via SSE."""

    async def event_stream():
        async for evt in copywriting.stream_regenerate(req):
            if await request.is_disconnected():
                break
            if isinstance(evt, SSEChunk):
                yield _sse("chunk", evt)
            elif isinstance(evt, SSEDone):
                yield _sse("done", evt)
            else:
                yield _sse("error", evt)

    return StreamingResponse(event_stream(), media_type="text/event-stream")
