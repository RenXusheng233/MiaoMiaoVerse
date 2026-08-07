# backend/routers/meme.py
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from schemas.meme import ImageInput, OverlayScheme
from services.meme import get_provider

router = APIRouter(prefix="/api/meme", tags=["meme"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/overlay", response_model=OverlayScheme)
async def generate_overlay(
    image: UploadFile | None = File(None),
    image_url: str | None = Form(None),
    text: str = Form(min_length=1, max_length=50),
    emotion: str | None = Form(None, max_length=50),
):
    """Generate a text overlay scheme for a meme image (uploaded or catalog URL)."""
    if (image is None) == (image_url is None):
        raise HTTPException(status_code=422, detail="image 与 image_url 必须恰好提供其中一个")

    image_input = ImageInput(url=image_url)
    if image is not None:
        if image.content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(
                status_code=422, detail=f"仅支持 jpeg/png/webp 图片,收到 {image.content_type}"
            )
        content = await image.read(MAX_FILE_SIZE + 1)
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=422, detail="图片大小不能超过 10MB")
        image_input = ImageInput(content=content, content_type=image.content_type)

    return get_provider().generate(image_input, text, emotion)
