"""LangChain-powered radar score generation persisted to the ai_scores column.

Generated scores take precedence over the hand-entered scores when a breed is
read back (see repositories.cats._to_response); re-generation updates the same
column in place. The legacy data/generated_scores.json cache has been retired.
"""

from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, SystemMessage
from sqlmodel import Session

from repositories.cats import update_ai_scores
from schemas.daily_cat import CatBreed, CatScores

# Known-good scores used as a shared reference frame, so generated scores stay
# comparable across the whole catalog (cat-world average = 5).
CALIBRATION_ANCHORS = """\
评分锚点(以下评分是正确的,新生成的分值必须与它们保持同一参照系):
- 奶牛猫: 拆家7 粘人5 掉毛4 掉钱包2 颜值8
- 波斯猫: 拆家2 粘人6 掉毛9 掉钱包8 颜值9
- 暹罗猫: 拆家6 粘人10 掉毛2 掉钱包4 颜值8
"""

SYSTEM_PROMPT = f"""\
你是资深猫咪品种专家,熟知全球猫品种的官方资料与互联网养猫梗文化。
根据给定的猫咪品种画像,评估该品种在五个维度上的得分。

五个维度含义:
- demolition 拆家指数: 活跃好动、拆家破坏的倾向
- clingy 粘人程度: 对人类的依赖与亲近需求
- shedding 掉毛指数: 掉毛严重程度(10=掉毛很严重)
- cost 掉钱包指数: 饲养成本(购买、饮食、医疗、美容等综合开销)
- looks 颜值指数: 结合品种公认外貌魅力的主观颜值

评分标准:
- 只输出 1-10 的整数,以猫界平均水平 = 5 为参照系

输出格式(必须严格遵守):
- 只输出一个 JSON 对象,键名必须是以下英文,值为 1-10 整数:
  {{"demolition": 整数, "clingy": 整数, "shedding": 整数, "cost": 整数, "looks": 整数}}
- 不要输出 JSON 之外的任何文字,不要使用 markdown 代码块

{CALIBRATION_ANCHORS}
"""


class RadarGenerationError(Exception):
    """Raised when the LLM call or score parsing fails."""


_model = None
_dotenv_loaded = False


def _get_model():
    """Lazily initialize the chat model (matches the notebook setup)."""
    global _model, _dotenv_loaded
    if _model is None:
        if not _dotenv_loaded:
            load_dotenv(override=True)
            _dotenv_loaded = True
        _model = init_chat_model("deepseek:deepseek-v4-flash")
    return _model


def _breed_profile(breed: CatBreed) -> str:
    """Render a breed as the human-message profile for the LLM."""
    return (
        f"品种画像:\n"
        f"- 名称: {breed.name_zh} / {breed.name_en}\n"
        f"- 起源地: {breed.origin}\n"
        f"- 体型: {breed.size}\n"
        f"- 毛发: {breed.coat}\n"
        f"- 网梗标签: {', '.join(breed.meme_tags)}\n"
        f"- 标志语录: {breed.quote}\n"
        f"- 适养人群: {', '.join(breed.suitable_owners)}\n"
    )


def generate_scores(session: Session, breed: CatBreed, force: bool = False) -> CatScores:
    """Generate (or return cached DB) radar scores for a breed, then persist to ai_scores."""
    from repositories.cats import get_ai_scores

    if not force:
        cached = get_ai_scores(session, breed.id)
        if cached:
            return cached

    try:
        # DeepSeek thinking mode rejects tool_choice, so use JSON mode.
        structured = _get_model().with_structured_output(CatScores, method="json_mode")
        scores = structured.invoke(
            [
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=_breed_profile(breed)),
            ]
        )
    except Exception as exc:  # network errors, timeouts, parse failures
        raise RadarGenerationError(
            f"LLM score generation failed for '{breed.id}': {exc}"
        ) from exc

    update_ai_scores(session, breed.id, scores)
    return scores
