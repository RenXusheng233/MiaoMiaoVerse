# backend/schemas/meme.py
from typing import Literal

from pydantic import BaseModel, Field


class ImageInput(BaseModel):
    content: bytes | None = None   # uploaded file bytes (never persisted)
    content_type: str | None = None  # MIME type of content, e.g. "image/jpeg"
    url: str | None = None         # catalog image URL
    # exactly one of content/url must be non-null (validated in the router)


class TextSlot(BaseModel):
    text: str = Field(max_length=200)
    font_size: int                 # px, relative to a 800px-wide base image
    color: str                     # hex foreground, e.g. "#FFFFFF"
    stroke: str                    # hex outline, e.g. "#000000"
    position: Literal["top", "bottom"]
    align: Literal["center", "left", "right"] = "center"


class OverlayScheme(BaseModel):
    top: TextSlot                  # emotion caption
    bottom: TextSlot               # user's main text
    provider: str                  # source marker, e.g. "rule_based"
