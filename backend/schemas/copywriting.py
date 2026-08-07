# backend/schemas/copywriting.py
from typing import Literal

from pydantic import BaseModel, Field

CopyStyle = Literal["funny", "healing", "cool"]  # 搞笑 / 治愈 / 高冷
Platform = Literal["moments", "weibo", "xiaohongshu", "douyin"]  # 朋友圈/微博/小红书/抖音

STYLE_NAMES_ZH: dict[str, str] = {
    "funny": "搞笑版",
    "healing": "治愈版",
    "cool": "高冷版",
}

PLATFORM_NAMES_ZH: dict[str, str] = {
    "moments": "朋友圈",
    "weibo": "微博",
    "xiaohongshu": "小红书",
    "douyin": "抖音",
}


class CopyRequest(BaseModel):
    cat_name: str = Field(min_length=1, max_length=50)  # 必填
    breed: str | None = None
    behavior: str | None = None
    style_pref: str | None = Field(default=None, max_length=200)
    platform: Platform = "moments"


class CopyRegenerateRequest(CopyRequest):
    style: CopyStyle


class SSEChunk(BaseModel):
    style: CopyStyle
    content: str


class SSEDone(BaseModel):
    style: CopyStyle


class SSEError(BaseModel):
    message: str
