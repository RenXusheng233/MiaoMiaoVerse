# 文案生成模块(AI 猫咪文案)设计文档

> PRD 3.3 模块后端接口实现。面向猫奴的 AI 娱乐平台 MiaoMiaoVerse。

## 背景

PRD 3.3 定义"文案生成"功能:AI 驱动的朋友圈/社媒猫咪文案一键生成工具。

- **输入**:多维度表单(猫咪名字、品种、当前状态/行为、风格偏好、平台目标)
- **输出**:同时生成 3 个版本供用户选择(搞笑版 / 治愈版 / 高冷版)
- **交互**:支持对单个版本"重新生成"或"一键复制"(一键复制为前端行为,不在本设计范围)
- **技术要点**:LangChain 并行链同时生成 3 个风格版本;SSE 流式逐字渲染;每风格独立 System Prompt

## 范围

- **本设计**:后端接口开发(生成 + 重新生成两个端点),不包含前端页面
- **非目标**:文案持久化存储、历史记录、内容安全审核(PRD 3.4 起才涉及审核)

## 文件结构

```
backend/
├── routers/copywriting.py      # POST /api/copy/generate + POST /api/copy/regenerate
├── schemas/copywriting.py      # 请求模型 + SSE 事件模型
├── services/copywriting.py     # 3 条风格链构建 + 并行流编排
└── main.py                     # 注册 copywriting router
```

## Schema(`schemas/copywriting.py`)

```python
CopyStyle = Literal["funny", "healing", "cool"]   # 搞笑 / 治愈 / 高冷
Platform = Literal["moments", "weibo", "xiaohongshu", "douyin"]  # 朋友圈/微博/小红书/抖音

class CopyRequest(BaseModel):
    cat_name: str = Field(min_length=1, max_length=50)          # 必填
    breed: str | None = None                                    # 品种
    behavior: str | None = None                                 # 当前状态/行为
    style_pref: str | None = Field(default=None, max_length=200)  # 全局语气微调
    platform: Platform = "moments"                              # 默认朋友圈

class CopyRegenerateRequest(CopyRequest):
    style: CopyStyle   # 指定重新生成的风格
```

SSE 事件模型(供 services 层产出的结构化事件,序列化为 SSE `data:` JSON):

```python
class SSEChunk(BaseModel):
    style: CopyStyle
    content: str

class SSEDone(BaseModel):
    style: CopyStyle

class SSEError(BaseModel):
    message: str
```

- `cat_name` 必填(文案主角),其余字段可选
- `style_pref` 作为全局语气微调,注入三条链的 prompt

## SSE 事件协议

流式响应使用标准 SSE 事件类型(前端按 `event` 字段分派):

```
event: chunk
data: {"style": "funny", "content": "今天我家猫..."}

event: done
data: {"style": "cool"}

event: error
data: {"message": "生成失败,请稍后重试"}
```

| 事件 | data 内容 | 说明 |
| --- | --- | --- |
| `chunk` | `{style, content}` | 某风格的增量片段,前端按 style 累积 |
| `done` | `{style}` | 该风格完整输出结束 |
| `error` | `{message}` | 任一条链失败,终止整个流 |

## 并行流编排(`services/copywriting.py`)

```python
def build_chains() -> dict[CopyStyle, Runnable]:
    # 3 条链:每个风格独立 System Prompt + 共享 Human 输入模板
    # prompt | model(deepseek:deepseek-v4-flash)

async def stream_copy(req: CopyRequest) -> AsyncGenerator[SSEChunk | SSEDone | SSEError, None]:
    # asyncio.create_task 并发跑 3 条链的 astream(),事件经队列合并
    # 每个 chunk 包装为 {style, content} 产出
```

- **3 条链并行**:`asyncio.create_task` 同时跑 3 条链的 `astream`,先产出先发(天然交织)
- **客户端断开**:`StreamingResponse` 被取消时,`finally` 中 cancel 其余未完成任务,不浪费 API 调用
- **任一条链失败**:发 `error` 事件后终止整个流,其余任务一并取消

### 端点

| 端点 | body | 行为 |
| --- | --- | --- |
| `POST /api/copy/generate` | `CopyRequest` | 3 条链并行,SSE 流输出三版 |
| `POST /api/copy/regenerate` | `CopyRegenerateRequest` | 复用链构建逻辑,只跑指定 `style` 单链 |

## Prompt 工程

三个独立 System Prompt,共享同一 Human 消息模板(表单输入):

```
你是一位猫咪文案大师,用户想发一条{platform 文案}。
【搞笑版】 用沙雕、反差、玩梗的语气写猫咪文案,让人会心一笑
【治愈版】 用温柔、细腻、有画面感的语气写猫咪文案,治愈人心
【高冷版】 用傲娇、冷淡、猫主子视角的语气写文案,自带贵气

共同约束:
- 平台格式:{moments:短句生活化 / weibo:140字内可带话题 / xiaohongshu:emoji+话题标签 / douyin:口语化口播}
- 风格偏好(用户额外要求):{style_pref},如有则融合进语气
- 只输出文案正文,不要解释、不要标题、不要引导语
```

Human 消息 = `cat_name / breed / behavior` 渲染成猫咪画像。

模型沿用 `init_chat_model("deepseek:deepseek-v4-flash")`,与 3.2 模块一致。

## 错误处理

| 场景 | 处理 |
| --- | --- |
| 输入校验失败(cat_name 为空等) | FastAPI 默认 422,不建立流 |
| LLM 调用失败(超时/限流) | 流内发 `event: error`,终止全部任务 |
| 客户端中途断开 | `finally` 里 cancel 未完成任务,静默结束 |
| 并发产出交织 | 无需特殊处理,事件天然按 style 分发 |

## 验证方式

- **curl 冒烟测试**:`curl -N -X POST .../api/copy/generate`,观察三版 chunk 交织输出
- **双端点**:generate(三版并行)、regenerate(单版)各测一次
- **断连测试**:curl 中途 Ctrl+C,确认服务端无报错、无残留任务
- 项目暂无测试框架,用脚本 + curl 验证
