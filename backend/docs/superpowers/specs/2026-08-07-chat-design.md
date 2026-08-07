# AI 疗愈问答模块(PRD 3.5)设计文档

> 后端接口实现。关系型/向量数据库均未接入,通过检索抽象 + 内存向量 + 本地 embedding 完成开发。

## 背景

PRD 3.5 定义"AI 疗愈问答":基于 RAG 的猫咪知识问答助手,覆盖日常护理到医疗健康的多类问题。

- **知识库**:猫咪护理、营养、常见疾病等结构化文档(RAG 检索)
- **输入**:用户自然语言提问
- **输出**:流式(SSE)回答,逐字显示

**双路由机制**(PRD 原文):

| 类型 | 判断依据 | 处理方式 |
| --- | --- | --- |
| 日常闲聊 | 话题轻松、无医疗词汇 | 直接 LLM 对话,风格活泼 |
| 医疗/健康问题 | 含症状、疾病、药物等关键词 | RAG 检索 + 固定免责声明 |

> **免责声明(医疗类回答必须展示):**
> "以上内容由 AI 生成,仅供参考,不构成专业医疗建议。如猫咪出现严重症状,请及时就医。"

## 核心决策:无数据库的 RAG

关系型 + 向量数据库均延后接入(用户将在 Docker 中统一启动 PostgreSQL + 向量库后一并接入)。本模块:

- **检索抽象**:`services/knowledge.py` 暴露 `search(query, top_k)`,内部用 LangChain `InMemoryVectorStore` + 本地 embedding 模型(BAAI/bge-small-zh-v1.5,已安装验证,维度 512)。未来接 pgvector/Milvus 只替换 store 构建方式,`search()` 签名不变
- **知识库文档**:开发期编写 15-20 篇结构化短文档,硬编码 `data/knowledge.py`,未来作为种子数据迁移入库
- **embedding 懒加载**:首次请求才加载模型(约 5-15 秒),进程级单例复用;加载失败自动降级为关键词检索

## 范围

- **本设计**:后端接口 `POST /api/chat`(SSE 流)+ 双路由编排 + 知识库与检索层
- **非目标**:数据库接入(后续统一)、前端聊天 UI、内容安全审核(Web 端视运营情况)

## 文件结构

```
backend/
├── routers/chat.py            # POST /api/chat(SSE 流)
├── schemas/chat.py            # ChatRequest + SSE 事件模型
├── services/chat.py           # 双路由编排:分类 → 检索 → 生成
├── services/knowledge.py      # 知识库:文档加载 + embedding + 检索抽象
└── data/knowledge.py          # 硬编码知识文档
```

## Schema(`schemas/chat.py`)

```python
class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)

class ChatChunk(BaseModel):
    content: str

class ChatDone(BaseModel):
    pass

class ChatError(BaseModel):
    message: str

class ChatDisclaimer(BaseModel):
    text: str
```

## 知识库(`data/knowledge.py`)

```python
@dataclass(frozen=True)
class KnowledgeDoc:
    id: str
    category: Literal["护理", "营养", "疾病"]
    title: str
    content: str                    # 100-300 字短文档

KNOWLEDGE_DOCS: list[KnowledgeDoc] = [ ... ]  # 15-20 篇
```

开发期覆盖主题示例:猫砂盆清洁频率 / 换粮过渡 / 化毛膏使用 / 猫瘟早期症状 / 呕吐处理 / 疫苗免疫计划 / 绝育注意事项 / 夏季中暑急救 / 驱虫周期 / 口炎 / 尿闭预警 / 洗澡频率……

## 检索层(`services/knowledge.py`)

```python
_EMBEDDING_MODEL = "BAAI/bge-small-zh-v1.5"

def _get_embedder(): ...   # 懒加载单例;失败时 search() 降级关键词检索
def _get_store(): ...      # 懒加载:文档 → embedding → InMemoryVectorStore

def search(query: str, top_k: int = 3) -> list[KnowledgeDoc]:
    """Vector similarity search. Future vector DB replaces only the
    store construction inside this module; signature stays stable."""
```

## 双路由编排(`services/chat.py`)

```
POST /api/chat → classify(message)
  ├─ 命中医疗词表 → 医疗链: search(top_k=3) → 注入 prompt → astream
  │                 回答流结束后发 disclaimer 事件(固定文本)
  └─ 未命中 → 闲聊链: 直接 LLM,猫系疗愈人设,风格活泼
```

- **分类**:`MEDICAL_KEYWORDS`(20-30 词:呕吐、腹泻、发烧、猫瘟、疫苗、驱虫、皮肤病、绝育、中暑、便血、尿闭、口炎、驱虫、拉稀、便秘、食欲不振……)命中任一 → 医疗路由
- **医疗 prompt**:兽医助理人设(严谨、温和)+ 检索到的知识文档(带标题)+ 用户问题;检索零结果时标注"知识库暂无该问题资料,回答基于通用常识"
- **闲聊 prompt**:猫系疗愈人设,回答短、暖、有梗
- 单链流式(无并行),`stream_chat(req) -> AsyncGenerator[ChatChunk | ChatDone | ChatError | ChatDisclaimer]`;客户端断开 cancel LLM 任务(沿用 3.3 模式)

## SSE 协议

| 事件 | data | 说明 |
| --- | --- | --- |
| `chunk` | `{content}` | 增量片段 |
| `done` | `{}` | 回答结束 |
| `disclaimer` | `{text}` | 仅医疗路由,回答结束后发;前端固定位置展示(醒目、不可隐藏),回答文本不含声明 |
| `error` | `{message}` | 失败终止 |

## 错误处理

| 场景 | 处理 |
| --- | --- |
| 输入校验(message 空/超长) | 422,FastAPI 默认 |
| embedding 模型加载失败 | `search()` 降级关键词检索,服务不中断 |
| 检索零结果 | 医疗链仍回答,prompt 标注知识库无资料,免责声明照发 |
| LLM 调用失败 | 流内 `error` 事件,终止;客户端断开 cancel 任务 |
| 知识库/检索异常 | 收敛为 `ChatError` 事件,不裸抛 500 |

## 验证方式

| 场景 | 预期 |
| --- | --- |
| 闲聊"今天好累啊" | 闲聊链,活泼回答,无 disclaimer 事件 |
| 医疗"猫咪呕吐带血怎么办" | 医疗链,回答引用检索知识,结尾 `disclaimer` 事件 |
| 生僻病名(知识库无内容) | 医疗链回答 + 免责声明照发 |
| 断连测试 | 日志无 "Task was destroyed" |
| 检索质量抽查 | `search("猫瘟")` Top1 为疾病类文档 |

## 未来数据库接入路径(记录,不实现)

1. Docker 启动 PostgreSQL(+ pgvector 扩展)与向量库后,`_get_store()` 改为连接向量库;`search()` 签名不变
2. `KNOWLEDGE_DOCS` 作为种子数据迁移入库(关系表:knowledge_docs)
3. 免责声明文本与医疗关键词表可入库配置化(可选,初期常量即可)
