# 文案生成模块实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 PRD 3.3 文案生成模块的后端:三个风格(搞笑/治愈/高冷)并行生成,SSE 流式输出,支持单版本重新生成。

**Architecture:** 3 条独立 `prompt | model` 链按风格构建,`asyncio.Queue` + 3 个 producer task 并行消费 `astream()`,事件带 `style` 字段在单一 SSE 流中交织输出。模型沿用 DeepSeek(`deepseek:deepseek-v4-flash`)。

**Tech Stack:** FastAPI · LangChain · DeepSeek · SSE(Server-Sent Events)· Python 3.14 · uv

**Spec:** `backend/docs/superpowers/specs/2026-08-07-copywriting-design.md`

## Global Constraints

- 全部代码在 `backend/` 目录下,命令从 `backend/` 运行
- Python 3.14,依赖管理用 uv;模型初始化复用 `init_chat_model("deepseek:deepseek-v4-flash")` + `load_dotenv(override=True)`(与 `services/radar_scores.py` 一致)
- 项目暂无测试框架:每个任务用验证脚本 + curl 验证,不引入 pytest
- 代码注释和 commit message 用英文;用户界面文案(错误提示、prompt 内容)用中文
- SSE 事件协议固定:事件类型 `chunk` / `done` / `error`,`data:` 为 `{style, content}` / `{style}` / `{message}` 的 JSON
- `cat_name` 必填(1-50 字符),其余字段可选;`style_pref` 上限 200 字符
- 客户端断开时须 cancel 所有未完成 LLM 任务

---

### Task 1: 请求/事件 Schema

**Files:**
- Create: `backend/schemas/copywriting.py`

**Interfaces:**
- Produces: `CopyStyle`(Literal), `Platform`(Literal), `STYLE_NAMES_ZH`, `PLATFORM_NAMES_ZH`, `CopyRequest`, `CopyRegenerateRequest`, `SSEChunk`, `SSEDone`, `SSEError` — 供 Task 2/3 使用

- [ ] **Step 1: 创建 schema 文件**

```python
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
```

- [ ] **Step 2: 验证 schema 行为**

Run: `source .venv/bin/activate && python -c "
from schemas.copywriting import CopyRequest, CopyRegenerateRequest, SSEChunk, SSEError
import pydantic
# 正常构造
r = CopyRequest(cat_name='布丁')
assert r.platform == 'moments' and r.style_pref is None
# 必填校验
try:
    CopyRequest(cat_name='')
    raise AssertionError('should have raised')
except pydantic.ValidationError:
    pass
# regenerate 需要 style
rr = CopyRegenerateRequest(cat_name='布丁', style='funny')
assert rr.style == 'funny'
# 事件序列化为 SSE data 格式
print(SSEChunk(style='cool', content='hi').model_dump_json())
print('schemas OK')
"`
Expected: 输出 `{"style":"cool","content":"hi"}` 和 `schemas OK`,无异常

- [ ] **Step 3: 结束任务验证**

```bash
git add backend/schemas/copywriting.py && git status --short
```
(项目初期由用户手动提交,此处仅确认暂存内容正确,不执行 commit)

---

### Task 2: 风格链构建 + 并行流服务

**Files:**
- Create: `backend/services/copywriting.py`

**Interfaces:**
- Consumes: Task 1 的 `CopyStyle`, `CopyRequest`, `CopyRegenerateRequest`, `SSEChunk`, `SSEDone`, `SSEError`, `STYLE_NAMES_ZH`, `PLATFORM_NAMES_ZH`
- Produces: `build_chains() -> dict[CopyStyle, Runnable]`、`stream_copy(req: CopyRequest) -> AsyncGenerator[SSEChunk | SSEDone | SSEError, None]`、`stream_regenerate(req: CopyRegenerateRequest) -> AsyncGenerator[SSEChunk | SSEDone | SSEError, None]` — 供 Task 3 使用

- [ ] **Step 1: 创建服务文件**

```python
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
    chains = build_chains()
    vars_ = _chain_vars(req)

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
    chain = build_chains()[req.style]
    try:
        async for chunk in chain.astream(_chain_vars(req)):
            yield SSEChunk(style=req.style, content=chunk.content)
        yield SSEDone(style=req.style)
    except Exception:
        yield SSEError(message=f"{STYLE_NAMES_ZH[req.style]}生成失败,请稍后重试")
```

- [ ] **Step 2: 验证三版并行流(真实调用 LLM)**

Run: `source .venv/bin/activate && python -c "
import asyncio
from schemas.copywriting import CopyRequest
from services.copywriting import stream_copy

async def main():
    req = CopyRequest(cat_name='布丁', breed='奶牛猫', behavior='正在拆沙发', style_pref='带点反差萌', platform='xiaohongshu')
    styles = {}
    async for evt in stream_copy(req):
        if hasattr(evt, 'content') and evt.content:
            styles.setdefault(evt.style, '')
            styles[evt.style] += evt.content
        elif hasattr(evt, 'message'):
            print('ERROR EVENT:', evt.message)
            return
    for style, text in styles.items():
        print(f'--- {style}: {text[:60]}...')
    assert len(styles) == 3, f'expect 3 styles, got {list(styles)}'
    print('stream_copy OK')

asyncio.run(main())
"`
Expected: 打印三个风格的文案片段,`stream_copy OK`,三条链都有输出。若出现 `ERROR EVENT`,检查 DeepSeek key / 网络后重试

- [ ] **Step 3: 验证单版重新生成流**

Run: `source .venv/bin/activate && python -c "
import asyncio
from schemas.copywriting import CopyRegenerateRequest
from services.copywriting import stream_regenerate

async def main():
    req = CopyRegenerateRequest(cat_name='布丁', style='healing')
    texts = {'healing': ''}
    async for evt in stream_regenerate(req):
        if hasattr(evt, 'content') and evt.content:
            texts['healing'] += evt.content
        elif hasattr(evt, 'message'):
            print('ERROR EVENT:', evt.message)
            return
    print('healing:', texts['healing'][:60])
    assert texts['healing']
    print('stream_regenerate OK')

asyncio.run(main())
"`
Expected: 打印治愈版文案片段,`stream_regenerate OK`

- [ ] **Step 4: 结束任务验证**

```bash
git add backend/services/copywriting.py && git status --short
```

---

### Task 3: 路由 + 注册

**Files:**
- Create: `backend/routers/copywriting.py`
- Modify: `backend/main.py`(注册 router)

**Interfaces:**
- Consumes: Task 1 的 `CopyRequest`, `CopyRegenerateRequest`, `SSEChunk`, `SSEDone`, `SSEError`;Task 2 的 `stream_copy`, `stream_regenerate`
- Produces: `POST /api/copy/generate`(CopyRequest → SSE 流)、`POST /api/copy/regenerate`(CopyRegenerateRequest → SSE 流)

- [ ] **Step 1: 创建路由文件**

```python
# backend/routers/copywriting.py
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
    """Serialize one SSE frame: 'event: <name>\\ndata: <json>\\n\\n'."""
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
```

- [ ] **Step 2: 注册路由到 main.py**

修改 `backend/main.py`:

```python
from routers import cats, copywriting, daily_cat
...
app.include_router(copywriting.router)
```

- [ ] **Step 3: 启动服务并 curl 验证 generate 端点的 SSE 流**

Run:
```bash
source .venv/bin/activate
uvicorn main:app --port 8000 &
sleep 2
curl -N -X POST http://localhost:8000/api/copy/generate \
  -H "Content-Type: application/json" \
  -d '{"cat_name":"布丁","breed":"奶牛猫","behavior":"正在拆沙发","style_pref":"带点反差萌","platform":"xiaohongshu"}' \
  | head -40
```
Expected: 输出包含 `event: chunk` 与 `event: done`,且三种 `style`(funny/healing/cool)都在事件中出现(交织)。最后 kill uvicorn

- [ ] **Step 4: curl 验证 regenerate 端点的 SSE 流**

Run:
```bash
source .venv/bin/activate
uvicorn main:app --port 8000 &
sleep 2
curl -N -X POST http://localhost:8000/api/copy/regenerate \
  -H "Content-Type: application/json" \
  -d '{"cat_name":"布丁","style":"healing","platform":"weibo"}' \
  | head -20
```
Expected: 只有 `style` 为 `healing` 的 chunk + 一个 done 事件。kill uvicorn

- [ ] **Step 5: 结束任务验证**

```bash
git add backend/routers/copywriting.py backend/main.py && git status --short
```

---

### Task 4: 端到端验证(含断连)

**Files:**
- 无新文件,验证既有行为

**Interfaces:**
- Consumes: Task 3 的全部端点

- [ ] **Step 1: 完整链路冒烟**

Run:
```bash
source .venv/bin/activate
uvicorn main:app --port 8000 > /tmp/copy_uvicorn.log 2>&1 &
sleep 2
# 三版并行
curl -N -s -X POST http://localhost:8000/api/copy/generate \
  -H "Content-Type: application/json" \
  -d '{"cat_name":"布丁","breed":"英短","behavior":"睡觉"}' \
  -o /tmp/copy_generate.txt
grep -c "event: chunk" /tmp/copy_generate.txt
grep -c "event: done" /tmp/copy_generate.txt
grep -o '"style":"[a-z]*"' /tmp/copy_generate.txt | sort -u
# 单版重新生成
curl -N -s -X POST http://localhost:8000/api/copy/regenerate \
  -H "Content-Type: application/json" \
  -d '{"cat_name":"布丁","style":"funny"}' \
  -o /tmp/copy_regenerate.txt
grep -c "event: done" /tmp/copy_regenerate.txt
```
Expected: generate 的 chunk 数 > 0,done 数 = 3,style 集合 = {funny, healing, cool};regenerate 的 done 数 = 1

- [ ] **Step 2: 客户端断连测试**

Run:
```bash
curl -N -X POST http://localhost:8000/api/copy/generate \
  -H "Content-Type: application/json" \
  -d '{"cat_name":"布丁"}' \
  --max-time 2 > /dev/null; sleep 1
grep -iE "error|exception|traceback" /tmp/copy_uvicorn.log | head -5 || echo "no errors in server log"
kill %1
```
Expected: 服务端日志无 error/exception/traceback(断连被静默处理,任务被 cancel)

- [ ] **Step 3: 收尾检查**

```bash
git status --short
```
Expected: 新文件 `backend/schemas/copywriting.py`、`backend/services/copywriting.py`、`backend/routers/copywriting.py`,修改 `backend/main.py`,均未提交(等待用户手动提交)
