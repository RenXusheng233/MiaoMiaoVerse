"""LangChain-powered radar score generation with a JSON cache layer.

Generated scores live in data/generated_scores.json and take precedence
over the hand-entered scores in data/cats.py when merged at read time.
Deleting the cache file reverts everything to the manual data.
"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, SystemMessage

from data.cats import CAT_BREEDS
from schemas.daily_cat import CatBreed, CatScores

CACHE_PATH = Path(__file__).resolve().parent.parent / "data" / "generated_scores.json"

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


def _load_cache() -> dict[str, CatScores]:
    """Read the generated-scores cache; corrupt/missing entries are dropped."""
    if not CACHE_PATH.exists():
        return {}
    try:
        raw = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        return {cat_id: CatScores(**data) for cat_id, data in raw.items()}
    except (json.JSONDecodeError, TypeError, ValueError):
        return {}


def _write_cache(data: dict[str, CatScores]) -> None:
    """Atomically replace the cache file (temp file + rename)."""
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = CACHE_PATH.with_suffix(".json.tmp")
    tmp.write_text(
        json.dumps(
            {cat_id: scores.model_dump() for cat_id, scores in data.items()},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    os.replace(tmp, CACHE_PATH)


def get_scores(breed_id: str) -> CatScores | None:
    """Return cached generated scores for a breed, or None."""
    return _load_cache().get(breed_id)


def generate_scores(breed: CatBreed, force: bool = False) -> CatScores:
    """Generate (or return cached) radar scores for a breed, then persist them."""
    if not force:
        cached = get_scores(breed.id)
        if cached:
            return cached

    try:
        # DeepSeek thinking mode rejects tool_choice, so use JSON mode
        # (response_format json_object) instead of the default function_calling.
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

    cache = _load_cache()
    cache[breed.id] = scores
    _write_cache(cache)
    return scores


def merge_breeds() -> list[CatBreed]:
    """Return all breeds with generated scores taking precedence over manual ones."""
    generated = _load_cache()
    if not generated:
        return list(CAT_BREEDS)
    return [
        breed.model_copy(update={"scores": generated[breed.id]})
        if breed.id in generated
        else breed
        for breed in CAT_BREEDS
    ]
