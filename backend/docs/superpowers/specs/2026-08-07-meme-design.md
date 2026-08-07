# 表情包生成模块(PRD 3.4)设计文档

> 后端接口实现。多模态模型未选定前,通过 Provider 抽象 + 规则引擎占位完成开发。

## 背景

PRD 3.4 定义"表情包生成"功能:上传猫咪图片 + 输入文字,AI 一键生成专属表情包。

- **输入**:上传猫咪图片(或从百科选图)+ 填写表情包文字/情绪描述
- **处理**:多模态 LLM 理解图文语义,生成适配文字叠加方案
- **渲染**:前端轻画布(Canvas API)将文字合成到图片上(前端职责,本设计不涉及)
- **输出**:可下载的 PNG 表情包(前端渲染产物)

**多端支持**(Web Canvas / Taro `<canvas>`)是前端职责,后端开发阶段不理会。

## 核心决策:多模态未定的占位方案

DeepSeek 不支持多模态,视觉模型尚未选定。本模块将"图文理解 → 文字叠加方案"抽象为 **`OverlayProvider` 协议**,当前以 **`RuleBasedProvider`(规则引擎)** 占位:

- 协议与路由、schema 完全定型,多模态接入时只替换 provider 实现
- 规则引擎产出可用的默认叠加方案,前端可正常联调
- 规则引擎保留为未来多模态的降级路径

## 范围

- **本设计**:后端接口 `POST /api/meme/overlay` + Provider 抽象 + 规则引擎占位
- **非目标**:多模态模型接入、PNG 渲染(前端)、多端适配(前端)、内容安全审核(PRD 3.4 起涉及,Web 端视运营情况接入)

## 文件结构

```
backend/
├── routers/meme.py            # POST /api/meme/overlay
├── schemas/meme.py            # ImageInput / TextSlot / OverlayScheme
├── services/meme.py           # OverlayProvider 协议 + RuleBasedProvider + get_provider()
└── main.py                    # 注册 meme router
```

## Schema(`schemas/meme.py`)

```python
class ImageInput(BaseModel):
    content: bytes | None = None   # 上传文件字节流(不落盘)
    content_type: str | None = None  # MIME type of content, e.g. "image/jpeg"
    url: str | None = None         # 百科选图 URL
    # 约束:两者恰好一个非空(路由层校验)

class TextSlot(BaseModel):
    text: str
    font_size: int            # 像素,以 800px 宽图片为基准,前端按实际宽缩放
    color: str                # hex 前景色,如 "#FFFFFF"
    stroke: str               # hex 描边色,如 "#000000"
    position: Literal["top", "bottom"]
    align: Literal["center", "left", "right"] = "center"

class OverlayScheme(BaseModel):
    top: TextSlot              # 情绪化短句
    bottom: TextSlot           # 用户主文字
    provider: str              # 来源标识,如 "rule_based"
```

## API

```
POST /api/meme/overlay   (multipart/form-data,非流式 JSON 响应)
- image:      UploadFile | None   — jpeg/png/webp,≤10MB
- image_url:  str | None          — 百科选图 URL
- text:       str 必填,≤50 字
- emotion:    str | None,≤50 字
```

规则:`image` 与 `image_url` 恰好一个非空(都传或都不传 → 422)。

`font_size` 以 800px 宽为基准是前后端约定:前端按 `图片实际宽 / 800` 缩放渲染。

## Provider 抽象(`services/meme.py`)

```python
class OverlayProvider(Protocol):
    """多模态替换点:未来接入视觉模型时实现同一协议,工厂切换一行。"""
    def generate(self, image: ImageInput, text: str, emotion: str | None) -> OverlayScheme:
        ...

def get_provider() -> OverlayProvider:
    """当前恒返回 RuleBasedProvider;未来接多模态时改为按配置/模型选择。"""
    return RuleBasedProvider()
```

## 规则引擎(`RuleBasedProvider`)

| 输入 | 规则 |
| --- | --- |
| 顶部短句 | 按 `emotion` 关键词映射:生气/怒→"哼!"、委屈/哭/难过→"呜呜…"、开心/笑/哈哈→"嘿嘿"、撒娇/蹭→"喵呜~"、默认→"喵~";未填 emotion 时从 text 中查关键词 |
| 顶部样式 | font_size=44、白字黑描边、top 居中;生气/怒 时前景色红色 `#FF3B30` |
| 底部主文 | text 原文,font_size=48、白字黑描边、bottom 居中 |

- 纯逻辑无外部依赖,不调用 LLM;图片内容被忽略(占位阶段),`image` 仅随协议传递

## 错误处理

| 场景 | 处理 |
| --- | --- |
| image 与 image_url 都传/都不传 | 422,中文 detail |
| 文件类型不是 jpeg/png/webp | 422(检查 content-type) |
| 文件 > 10MB | 422(读流时计数截断) |
| text 超长/缺失 | 422(FastAPI 表单校验) |
| 未来 provider 异常 | 500(占位阶段无该路径) |

## 验证方式(无 LLM 调用)

| 场景 | 预期 |
| --- | --- |
| 上传文件 + emotion=生气 | 200,top="哼!"、红色 |
| 百科 URL + text | 200,top 默认"喵~" |
| 都传/都不传 | 422 |
| 非图片类型(.txt) | 422 |
| 超 10MB 文件 | 422 |
| 规则映射 | emotion=委屈→"呜呜…";无 emotion 但 text 含"哈哈"→"嘿嘿" |

## 后续多模态接入路径(记录,不实现)

1. 选定视觉模型 → 新增 `MultimodalProvider` 实现 `OverlayProvider` 协议
2. `get_provider()` 按配置返回新实现(规则引擎保留为降级)
3. 图片字节/URL 已由 `ImageInput` 承载,协议不变,路由与 schema 零改动
4. 如需图像尺寸信息,Provider 内自解析(协议外细节)
