"""Meme overlay generation: provider protocol + rule-based placeholder implementation."""

from typing import Protocol

from schemas.meme import ImageInput, OverlayScheme, TextSlot

# Emotion keywords -> (top caption, top foreground color)
EMOTION_RULES: dict[str, tuple[str, str]] = {
    "生气": ("哼!", "#FF3B30"),
    "怒": ("哼!", "#FF3B30"),
    "委屈": ("呜呜…", "#FFFFFF"),
    "哭": ("呜呜…", "#FFFFFF"),
    "难过": ("呜呜…", "#FFFFFF"),
    "开心": ("嘿嘿", "#FFFFFF"),
    "笑": ("嘿嘿", "#FFFFFF"),
    "哈哈": ("嘿嘿", "#FFFFFF"),
    "撒娇": ("喵呜~", "#FFFFFF"),
    "蹭": ("喵呜~", "#FFFFFF"),
}

DEFAULT_CAPTION = "喵~"
TOP_FONT_SIZE = 44
BOTTOM_FONT_SIZE = 48
WHITE = "#FFFFFF"
BLACK = "#000000"


class OverlayProvider(Protocol):
    """Multimodal seam: a future vision-model provider implements this protocol."""

    def generate(self, image: ImageInput, text: str, emotion: str | None) -> OverlayScheme:
        ...


class RuleBasedProvider:
    """Placeholder provider: pure rules; the image content is ignored."""

    def generate(self, image: ImageInput, text: str, emotion: str | None) -> OverlayScheme:
        caption, color = self._resolve_emotion(emotion, text)
        return OverlayScheme(
            top=TextSlot(
                text=caption,
                font_size=TOP_FONT_SIZE,
                color=color,
                stroke=BLACK,
                position="top",
                align="center",
            ),
            bottom=TextSlot(
                text=text,
                font_size=BOTTOM_FONT_SIZE,
                color=WHITE,
                stroke=BLACK,
                position="bottom",
                align="center",
            ),
            provider="rule_based",
        )

    @staticmethod
    def _resolve_emotion(emotion: str | None, text: str) -> tuple[str, str]:
        """First keyword hit in (emotion + text) decides the top caption and color."""
        source = f"{emotion or ''} {text}"
        for keyword, (caption, color) in EMOTION_RULES.items():
            if keyword in source:
                return caption, color
        return DEFAULT_CAPTION, WHITE


def get_provider() -> OverlayProvider:
    """Return the current provider; swap here when a multimodal model is integrated."""
    return RuleBasedProvider()
