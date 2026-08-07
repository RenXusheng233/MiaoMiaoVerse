# backend/services/copywriting.py
"""Copywriting generation: three parallel style chains streamed over one SSE flow."""

import asyncio
from collections.abc import AsyncGenerator

from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import Runnable

from schemas.copywriting import (
    CopyRegenerateRequest,
    CopyRequest,
    CopyStyle,
    Platform,
    PLATFORM_NAMES_ZH,
    SSEChunk,
    SSEDone,
    SSEError,
    STYLE_NAMES_ZH,
)

MODEL_ID = "deepseek:deepseek-v4-flash"

# 平台格式要求,注入各风格 prompt
PLATFORM_FORMAT: dict[Platform, str] = {
    "moments": "朋友圈:短句、生活化、口语化,像随手发的一条日常",
    "weibo": "微博:140 字以内,可带 #话题#",
    "xiaohongshu": "小红书:emoji 丰富,文末带 2-3 个 #话题标签,种草语气",
    "douyin": "抖音:口语化口播文案,节奏快,开头 3 秒抓住注意力",
}

# 每风格独立 System Prompt(变量在调用 astream 时注入)
SYSTEM_PROMPTS: dict[CopyStyle, str] = {
    "funny": (
        "你是一位猫咪文案大师,用户想发一条{platform}文案。\n"
        "【搞笑版】用沙雕、反差、玩梗的语气写猫咪文案,让人会心一笑。\n"
        "用户额外风格要求:{style_pref}。\n"
        "格式要求:{platform_format}。\n"
        "只输出文案正文,不要解释、不要标题、不要引导语。"
    ),
    "healing": (
        "你是一位猫咪文案大师,用户想发一条{platform}文案。\n"
        "【治愈版】用温柔、细腻、有画面感的语气写猫咪文案,治愈人心。\n"
        "用户额外风格要求:{style_pref}。\n"
        "格式要求:{platform_format}。\n"
        "只输出文案正文,不要解释、不要标题、不要引导语。"
    ),
    "cool": (
        "你是一位猫咪文案大师,用户想发一条{platform}文案。\n"
        "【高冷版】用傲娇、冷淡、猫主子视角的语气写文案,自带贵气。\n"
        "用户额外风格要求:{style_pref}。\n"
        "格式要求:{platform_format}。\n"
        "只输出文案正文,不要解释、不要标题、不要引导语。"
    ),
}

HUMAN_TEMPLATE = (
    "猫咪画像:\n"
    "- 名字: {cat_name}\n"
    "- 品种: {breed}\n"
    "- 当前状态/行为: {behavior}"
)

_model: BaseChatModel | None = None
_dotenv_loaded = False


def _get_model() -> BaseChatModel:
    """Lazily initialize the chat model (matches services/radar_scores.py)."""
    global _model, _dotenv_loaded
    if _model is None:
        if not _dotenv_loaded:
            load_dotenv(override=True)
            _dotenv_loaded = True
        _model = init_chat_model(MODEL_ID)
    return _model


def build_chains() -> dict[CopyStyle, Runnable]:
    """Return one ChatPromptTemplate | model chain per style."""
    model = _get_model()
    chains: dict[CopyStyle, Runnable] = {}
    for style, system in SYSTEM_PROMPTS.items():
        prompt = ChatPromptTemplate.from_messages(
            [("system", system), ("human", HUMAN_TEMPLATE)]
        )
        chains[style] = prompt | model
    return chains


def _chain_vars(req: CopyRequest) -> dict[str, str]:
    """Render the form input into prompt template variables."""
    return {
        "cat_name": req.cat_name,
        "breed": req.breed or "未知",
        "behavior": req.behavior or "无",
        "platform": PLATFORM_NAMES_ZH[req.platform],
        "style_pref": req.style_pref or "无",
        "platform_format": PLATFORM_FORMAT[req.platform],
    }


async def stream_copy(req: CopyRequest) -> AsyncGenerator[SSEChunk | SSEDone | SSEError, None]:
    """Stream three style chains in parallel over a single async generator.

    Chunks interleave naturally (each pump task puts into one queue). Any chain
    failure emits a single SSEError and terminates the whole stream.
    """
    queue: asyncio.Queue[tuple[str, CopyStyle, str | None]] = asyncio.Queue()
    vars_ = _chain_vars(req)
    try:
        chains = build_chains()
    except Exception:
        yield SSEError(message="文案生成失败,请稍后重试")
        return

    async def pump(style: CopyStyle, chain: Runnable) -> None:
        try:
            async for chunk in chain.astream(vars_):
                await queue.put(("chunk", style, chunk.content))
            await queue.put(("done", style, None))
        except Exception:
            await queue.put(("error", style, None))

    tasks = [
        asyncio.create_task(pump(style, chain))
        for style, chain in chains.items()
    ]
    alive = len(tasks)
    try:
        while alive > 0:
            kind, style, content = await queue.get()
            if kind == "chunk":
                yield SSEChunk(style=style, content=content or "")
            elif kind == "done":
                yield SSEDone(style=style)
                alive -= 1
            else:  # error
                yield SSEError(message=f"{STYLE_NAMES_ZH[style]}生成失败,请稍后重试")
                return
    finally:
        for task in tasks:
            task.cancel()


async def stream_regenerate(
    req: CopyRegenerateRequest,
) -> AsyncGenerator[SSEChunk | SSEDone | SSEError, None]:
    """Stream a single style chain (used for per-version regeneration)."""
    vars_ = _chain_vars(req)
    try:
        chain = build_chains()[req.style]
        async for chunk in chain.astream(vars_):
            yield SSEChunk(style=req.style, content=chunk.content or "")
        yield SSEDone(style=req.style)
    except Exception:
        yield SSEError(message=f"{STYLE_NAMES_ZH[req.style]}生成失败,请稍后重试")
