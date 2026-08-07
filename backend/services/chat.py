# backend/services/chat.py
"""Chat orchestration: dual-route classification, retrieval, and streaming answer."""

from collections.abc import AsyncGenerator

from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from schemas.chat import ChatChunk, ChatDisclaimer, ChatDone, ChatError, ChatRequest
from services.knowledge import search

MODEL_ID = "deepseek:deepseek-v4-flash"

DISCLAIMER = "以上内容由 AI 生成,仅供参考,不构成专业医疗建议。如猫咪出现严重症状,请及时就医。"

MEDICAL_KEYWORDS = [
    "呕吐", "腹泻", "拉稀", "便秘", "便血", "发烧", "发热", "猫瘟", "疫苗",
    "驱虫", "皮肤病", "猫藓", "绝育", "中暑", "尿闭", "口炎", "食欲不振",
    "打喷嚏", "眼屎", "软便", "吐毛球", "寄生虫", "肠胃炎", "猫鼻支",
    "咳嗽", "抽搐", "中毒", "外伤",
]

CHAT_SYSTEM = (
    "你是一只温柔治愈的猫咪助手喵~ 用短句、温暖、有梗的语气陪伴用户,"
    "像一只贴心的小猫那样回应。不要医疗建议,不要长篇大论,两三句就好。"
)

MEDICAL_SYSTEM = (
    "你是一位严谨而温和的猫咪健康助理。基于下面的知识库资料回答用户问题,"
    "回答要具体、可操作,不确定的内容明确说明。\n\n"
    "知识库资料:\n{context}\n\n"
    "如果资料中没有相关内容,基于通用常识回答并明确说明「知识库暂无该问题资料」。"
)

_model: BaseChatModel | None = None
_dotenv_loaded = False


def _get_model() -> BaseChatModel:
    """Lazily initialize the chat model (same pattern as other services)."""
    global _model, _dotenv_loaded
    if _model is None:
        if not _dotenv_loaded:
            load_dotenv(override=True)
            _dotenv_loaded = True
        _model = init_chat_model(MODEL_ID)
    return _model


def is_medical(message: str) -> bool:
    """True when the message hits any medical keyword (dual-route split)."""
    return any(kw in message for kw in MEDICAL_KEYWORDS)


async def stream_chat(
    req: ChatRequest,
) -> AsyncGenerator[ChatChunk | ChatDone | ChatError | ChatDisclaimer, None]:
    medical = is_medical(req.message)
    try:
        if medical:
            docs = search(req.message)
            context = "\n".join(f"[{d.title}] {d.content}" for d in docs)
            if not context:
                context = "知识库暂无该问题资料,回答基于通用常识。"
            messages = [
                SystemMessage(content=MEDICAL_SYSTEM.format(context=context)),
                HumanMessage(content=req.message),
            ]
        else:
            messages = [SystemMessage(content=CHAT_SYSTEM), HumanMessage(content=req.message)]

        model = _get_model()
        async for chunk in model.astream(messages):
            if chunk.content:
                yield ChatChunk(content=chunk.content)
        if medical:
            yield ChatDisclaimer(text=DISCLAIMER)
        yield ChatDone()
    except Exception:
        yield ChatError(message="回答生成失败,请稍后重试")
