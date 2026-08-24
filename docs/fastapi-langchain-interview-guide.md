# MiaoMiaoVerse：FastAPI × LangChain 面试速成手册

> 适用对象：5 年以上前端经验、熟悉 TypeScript/NestJS，正在转向 Python、FastAPI 与 LangChain，并且已经通过 AI 辅助完成了本项目。
>
> 建议节奏：3 天，每天 5–6 小时。目标不是从零重学 Web，而是把已有的 HTTP、分层、异步和工程经验迁移到 Python 生态，并能够沿着本项目的真实代码解释一次请求如何完成。

## 0. 学完以后，你应该能做到什么

你至少应当能够脱离代码回答以下问题：

1. 一个 `POST /api/chat` 请求从浏览器到 DeepSeek，再流回页面，经过了哪些层？
2. FastAPI 为什么既可以写 `def` 又可以写 `async def`？什么时候写错会阻塞事件循环？
3. `Depends(get_session)` 做了什么？为什么数据库 Session 不应跨请求共享？
4. LangChain 在项目里承担了什么职责？为什么当前实现不是 Agent？
5. RAG 的 Embedding、向量库、Top-K、阈值和 Prompt 分别解决什么问题？
6. 为什么当前项目选择 pgvector 而不是 Milvus？什么规模下应该重新选型？
7. SSE 与 WebSocket 有什么区别？为什么本项目要手写基于 `fetch` 的 SSE 客户端？
8. 三种文案为什么能并发生成？`asyncio.create_task` 是否等于多线程并行？
9. `with_structured_output(..., method="json_mode")` 能保证什么，不能保证什么？
10. 当前实现有哪些技术债？如果要上线，你会按什么优先级改？

如果这些问题都能用自己的话回答，并能现场手写一个最小版本，你就不再只是“会描述项目”。

### 0.1 你的学习策略：迁移，而不是清零

你已经有 5 年以上开发经验，不需要重新学习“什么是路由、DTO、依赖注入和事件循环”。真正需要补的是三类差异：

1. **同一个概念在不同生态里的表达**：NestJS 的 Guard、Pipe、Provider 到 FastAPI 分别如何落地。
2. **运行时语义不同**：TypeScript 类型会在编译后消失，而 Pydantic 会在运行时真正解析和校验数据；Promise 与 Python coroutine 的创建、调度和取消也不完全相同。
3. **AI 应用新增的工程问题**：流式响应、模型输出不确定性、RAG 评测、Token 成本和 Prompt Injection。

复习时采用“三层回答法”：

- 第一层用 20 秒说明概念和项目结论。
- 第二层沿着本项目源码说明请求链路。
- 第三层主动补充限制、监控指标和演进条件。

面试官通常不是在检查你是否记住装饰器，而是在判断你能否对自己写进简历的系统负责。

### 0.2 NestJS 到 FastAPI 的认知映射

| NestJS / Node.js | FastAPI / Python | 关键差异 |
| --- | --- | --- |
| `main.ts` + `NestFactory.create()` | `FastAPI(...)` + Uvicorn | FastAPI 是 ASGI 应用，Uvicorn 才是监听端口的 Server |
| Module | Python package + Router 组装 | FastAPI 没有强制模块容器，边界需要项目自己维护 |
| Controller + 路由装饰器 | `APIRouter` + 路径操作装饰器 | 职责接近，FastAPI 会从函数签名推导参数来源和 OpenAPI |
| Provider / Service | 普通类或函数 + `Depends` | NestJS 是容器式 DI；FastAPI 更像依赖函数图，显式且轻量 |
| DTO + class-validator | Pydantic `BaseModel` | TS DTO 的类型本身不做运行时校验；Pydantic 会解析、转换、校验和序列化 |
| Pipe | Pydantic 校验或 Dependency | 简单转换交给 Schema，含业务/上下文的检查适合依赖函数 |
| Guard | Dependency | 鉴权依赖可读取 Header、Session，并通过抛异常阻止进入路由 |
| Middleware | Starlette Middleware | 都适合跨请求逻辑；不要把需要路由业务数据的规则全部塞进中间件 |
| Exception Filter | `exception_handler` / `HTTPException` | 统一错误格式用 handler，预期 HTTP 错误直接抛 `HTTPException` |
| Interceptor | Middleware、装饰器或自定义 Route | FastAPI 没有完全一一对应物，要按“包围 HTTP 请求还是函数调用”选择 |
| request-scoped Provider | `Depends(... yield ...)` | `yield` 前创建资源，`finally` 中释放；默认会按单次请求缓存依赖结果 |
| TypeORM / Mongoose | SQLAlchemy / SQLModel | Session 是 Unit of Work，不应作为全局单例跨请求共享 |
| `Promise.all` | `asyncio.gather` / `TaskGroup` | 都做并发等待，但 Python coroutine 不会因为被创建就自动执行 |
| `AsyncIterable` | `AsyncIterator` / Async Generator | 都可表达流；Python 用 `async for` 和 `yield` 组合 |
| `AbortController` | Task cancellation / `CancelledError` | 服务端应让取消向下传播，并在 `finally` 释放资源 |

一个适合面试的总结是：

> 我没有把 FastAPI 理解成“Python 版 NestJS”。两者都能做分层和依赖注入，但 NestJS 依靠模块与容器提供强约束，FastAPI 主要依靠函数签名、类型注解和依赖图。迁移时我保留 Router、Service、Repository 的职责边界，同时避免为了模仿 NestJS 引入过重的类和容器。

### 0.3 TypeScript 到 Python 最容易踩的语义差异

- **类型系统**：TypeScript 主要做静态检查；Python 类型注解默认也不强制执行，但 FastAPI 会把 Pydantic 模型接入运行时校验。不要把任意 `dict` 当成已验证对象。
- **`undefined` 与 `null`**：Python 主要用 `None`。`Optional[str]` 表示值可为 `None`，不自动表示字段可以省略；是否必填还取决于默认值。
- **可变默认值**：普通 Python 函数参数不要写 `items=[]`。Pydantic v2 会处理模型字段的深拷贝，但面试中仍应说明普通 Python 的共享默认对象风险。
- **异常**：Python 倾向抛出异常并在边界转换；不要用异常承载所有正常分支，也不要用宽泛的 `except Exception` 静默吞错。
- **生成器与上下文管理器**：`yield` 既可生成序列，也能配合 FastAPI 依赖表达资源进入/退出；`with` / `async with` 对应显式资源生命周期。
- **装饰器**：语法像 NestJS decorator，但 FastAPI 路由装饰器主要登记函数元数据，不等于 NestJS 的 Reflect Metadata + IoC 行为。
- **结构化接口**：TypeScript 常用 `interface`；Python 可用 `Protocol` 做结构类型，用 `Literal`、联合类型和 `Annotated` 表达约束，用 Pydantic 表达运行时边界。

### 0.4 Node 事件循环与 Python asyncio

两者都擅长 I/O 并发，但不能只用“都是单线程”带过：

```text
JavaScript: 调用 async function → 立即得到 Promise，函数开始运行到首次 await
Python:     调用 async def      → 得到 coroutine 对象，必须 await 或创建 Task 才会调度
```

- `await` 只在等待真正的异步 I/O 时让出执行权；同步 CPU 计算和同步 SDK 仍会阻塞。
- `asyncio.create_task()` 类似把 coroutine 注册到事件循环并立即安排执行；必须管理其异常、生命周期和取消。
- `asyncio.gather()` 适合汇总结果；`TaskGroup` 更适合结构化并发，因为一个子任务失败时，其他任务会被统一取消并等待清理。
- Python 可用 `asyncio.to_thread()` 临时隔离阻塞调用，但它不是无限扩容方案；CPU 密集任务通常应放进进程池或任务队列。
- SSE 生成器收到客户端断开或任务取消时，应进入 `finally`；如果捕获 `CancelledError`，通常应在清理后重新抛出，不能假装成功。

---

## 1. 先建立项目全景图

### 1.1 一句话架构

MiaoMiaoVerse 是一个前后端分离的 AI Web 应用：Next.js 负责页面与流式结果渲染，FastAPI 负责接口、业务编排和数据访问，LangChain 统一封装 DeepSeek 调用，PostgreSQL 同时保存业务数据和 pgvector 向量。

### 1.2 后端分层

```text
HTTP Request
    ↓
FastAPI Router        参数接收、依赖注入、状态码、StreamingResponse
    ↓
Service               场景分流、Prompt、LangChain、并发、RAG 编排
    ↓
Repository            SQL 查询与领域对象转换
    ↓
SQLModel / PostgreSQL 业务数据、JSONB、Vector(512)
```

项目中的对应目录：

- `backend/main.py`：应用创建、中间件、lifespan、路由注册。
- `backend/routers/`：HTTP 协议层。
- `backend/schemas/`：Pydantic 请求、响应和 SSE 事件模型。
- `backend/services/`：AI 与业务编排。
- `backend/repositories/`：数据库访问。
- `backend/models/`：SQLModel 表模型。
- `backend/db.py`：Engine、Session 依赖、建表与种子数据。

这种分层的核心价值是“变化隔离”：替换模型时主要改 Service，替换查询实现时主要改 Repository，HTTP 输入输出变化时主要改 Router/Schema。

### 1.3 两条必须能画出来的请求链路

#### 聊天请求

```text
ChatWorkspace
  → POST /api/chat
  → ChatRequest(Pydantic validation)
  → chat.stream_chat()
  → medical keyword routing
      ├─ casual: SystemMessage + HumanMessage
      └─ medical: embed query → pgvector Top-K → context prompt
  → DeepSeek model.astream()
  → ChatChunk / ChatDisclaimer / ChatDone
  → SSE frames
  → fetch ReadableStream parser
  → React incremental state update
```

#### 三风格文案请求

```text
CopyWorkspace
  → POST /api/copy/generate
  → CopyRequest validation
  → build 3 Prompt | Model runnables
  → create 3 asyncio tasks
  → each task streams chunks into one Queue
  → service consumes Queue and adds style field
  → one SSE connection multiplexes 3 result streams
  → frontend routes each chunk to the matching card
```

---

## 2. FastAPI 必会原理

### 2.1 FastAPI、Uvicorn 与 ASGI 的关系

- FastAPI 是 Web 框架，负责路由、参数校验、依赖注入、OpenAPI 等。
- Uvicorn 是 ASGI Server，监听网络端口并把 ASGI 事件交给 FastAPI。
- ASGI 是异步 Web 应用接口规范，支持 HTTP、长连接和流式响应；它不是某个具体服务器。

面试回答不要只说“FastAPI 性能高”。更好的回答是：

> 我选择 FastAPI 是因为项目包含 LLM 网络调用和 SSE 长连接，ASGI 与原生 async 接口更适合 I/O 并发；同时 Pydantic、依赖注入和 OpenAPI 能减少接口层样板代码。不过性能最终仍取决于是否把阻塞操作放进事件循环、数据库连接池和下游模型延迟。

### 2.2 一次请求的生命周期

以 `/api/cats/{id}` 为例：

1. Uvicorn 收到 HTTP 请求。
2. FastAPI/Starlette 执行中间件，例如 CORS。
3. 路由匹配到 Path Operation。
4. 解析 Path、Query、Header、Body。
5. 构建依赖图并执行 `Depends(get_session)`。
6. Pydantic 校验请求；失败通常返回 422。
7. 执行路由函数与 Repository 查询。
8. `response_model` 校验、过滤并序列化响应。
9. 发送响应。
10. 退出 `yield` 依赖，关闭 Session。

### 2.3 `def` 与 `async def`：最容易被追问的点

必须先理解两个概念：

- **并发**：等待一个 I/O 时先处理别的任务。
- **并行**：多个 CPU 核或进程在同一时刻计算。

使用原则：

- 调用原生异步库，并且要 `await`：使用 `async def`。
- 调用同步阻塞库，例如当前同步 SQLModel Session：优先使用普通 `def`，FastAPI 会在线程池中执行。
- 不要在 `async def` 中直接执行耗时同步 I/O 或 CPU 计算，否则会阻塞事件循环。

本项目中的真实情况：

- `generate_cat_radar_scores()` 是普通 `def`，其中包含同步数据库和同步 `structured.invoke()`，方向合理。
- 部分查询接口写成了 `async def`，内部却调用同步 SQLModel；数据量小时能工作，但并发上升时可能阻塞事件循环。
- `chat.stream_chat()` 是异步生成器，但医疗分支先同步执行本地 Embedding 与数据库检索；这同样可能阻塞。

生产改进有两条路线：

1. 保持同步 SQLModel，将纯同步路由改成 `def`；在必须异步的聊天流中使用 `await asyncio.to_thread(search, query)` 隔离阻塞检索。
2. 改用 SQLAlchemy AsyncSession/异步驱动，并把 Embedding 放到线程池、独立推理服务或任务队列。

要点：`async` 不是“更高级的 def”，也不会让 CPU 计算自动变快。

### 2.4 依赖注入与 `yield`

项目中的核心依赖：

```python
def get_session():
    with Session(engine) as session:
        yield session
```

可以把它理解为请求级资源管理器：

- `yield` 前创建资源。
- `yield` 的值注入路由参数。
- 请求结束后退出 `with`，保证 Session 被关闭并归还连接。

为什么有价值：

- 路由不需要重复创建 Session。
- 生命周期明确，不跨请求共享非线程安全 Session。
- 测试时可以使用 `app.dependency_overrides` 换成测试数据库。
- 将来可把鉴权、限流、租户信息做成依赖树。

注意：FastAPI 新版本中，`yield` 依赖默认是 request scope；流式响应可能让资源一直保留到响应结束。若流中不需要 Session，可考虑 `Depends(scope="function")` 或提前释放。

### 2.5 Pydantic 在项目中的三种职责

1. **请求校验**：`ChatRequest.message` 限制 1–500 字；非法请求在进入业务代码前被拒绝。
2. **响应契约**：`response_model=CatBreed` 会校验并过滤返回字段。
3. **LLM 输出校验**：`CatScores` 把五个分数限制在 1–10。

Pydantic 的“验证”并不一定拒绝所有类型不一致输入，它默认可能进行类型转换。需要严格输入时应理解 Strict Mode；不希望忽略额外字段时可以设置 `extra="forbid"`。

常用 V2 API：

- `model_validate()`：从 Python 对象校验。
- `model_dump()`：转为 dict。
- `model_dump_json()`：转为 JSON 字符串，本项目用于 SSE data。
- `model_json_schema()`：生成 JSON Schema。

### 2.6 Lifespan

`backend/main.py` 使用 `@asynccontextmanager`：

- `yield` 前执行启动逻辑：当前为建表与种子导入。
- `yield` 后适合释放模型、连接或后台资源；当前没有关闭逻辑。

当前实现的注意事项：

- `init_db()` 是同步操作，并且可能加载本地 Embedding 模型，在启动期间会阻塞。
- `SQLModel.metadata.create_all()` 只适合原型，不替代 Alembic 数据库迁移。
- 多 Worker 同时启动时都可能执行初始化；虽然“表为空才导入”降低风险，但严谨做法是独立迁移/种子任务和数据库级约束。

### 2.7 HTTP 状态码与错误边界

本项目使用了：

- 404：资源不存在。
- 409：ID 重复，发生资源冲突。
- 422：请求字段或上传文件不符合要求。
- 502：上游 LLM 或 Embedding 服务失败。

流式响应有一个特殊点：HTTP 响应头一旦发出，就不能把状态码从 200 改成 502。因此流中发生的错误只能通过 `event: error` 告诉客户端。面试中能说出这一点，会比只会写 `try/except` 更有说服力。

---

## 3. 数据库与 SQLModel

### 3.1 Engine、Session、Transaction

- Engine 管理数据库方言、连接池和连接创建。
- Session 是一次工作单元，跟踪对象变化并执行查询/提交。
- Transaction 保证一组操作要么全部成功，要么全部失败。

不要把 Engine 和 Session 混为一谈。Engine 通常是进程级共享；Session 通常每请求一个，不能跨并发请求共享。

项目写入流程通常是：

```text
session.add(row) → session.commit() → return domain object
```

更严谨的实现还应考虑：

- `commit()` 失败后的 `rollback()`。
- 是否需要 `refresh()` 取得数据库生成字段。
- 唯一约束和并发写入冲突不能只靠“先查询再插入”。
- 事务边界应在 Service 还是 Repository 统一管理。

### 3.2 为什么有 Schema、Model、Domain 三类对象

- Pydantic Schema：对外接口契约。
- SQLModel Table Model：数据库表结构。
- Domain Object：业务层稳定的数据表示。

本项目 Repository 将数据库行转换为 `CatBreed`/`KnowledgeDoc`，避免路由直接依赖数据库列。代价是代码更多，但后续更换存储或隐藏字段更安全。

### 3.3 PostgreSQL 的 JSONB 与 Vector

- `meme_tags`、`scores` 使用 JSONB，适合结构相对稳定但不值得拆成多张表的小型嵌套数据。
- `embedding` 使用 `Vector(512)`，维度必须与 Embedding 模型输出一致。
- 模型一旦更换且维度改变，需要新列/新表、全量重算 Embedding，并处理灰度迁移，不能直接写入旧列。

---

## 4. LangChain：项目里究竟用了什么

### 4.1 LangChain 的实际职责

本项目使用了四类能力：

1. `init_chat_model()`：按统一接口初始化 DeepSeek Chat Model。
2. Message：`SystemMessage` 与 `HumanMessage`。
3. Prompt/Runnable：`ChatPromptTemplate | model` 组成可调用链。
4. Model I/O：`invoke()`、`astream()`、`with_structured_output()`。

没有使用到：

- `create_agent()` 的模型—工具循环。
- Tool Calling。
- LangGraph 状态图、检查点和持久化。
- 多模型动态路由。
- 对话 Memory。

所以准确说法是“基于 LangChain 构建 Prompt Chain 与 RAG 编排”，不要称为“自主 Agent”。

### 4.2 Chat Model、Message 与 Prompt

Chat Model 的输入是消息序列，不是简单字符串：

- System Message：规定角色、边界和输出要求。
- Human Message：用户问题或业务数据。
- AI Message：模型回复。

`ChatPromptTemplate` 将变量延迟注入模板。本项目针对 3 个文案风格创建了 3 条独立 Prompt Chain：

```python
prompt = ChatPromptTemplate.from_messages([...])
chain = prompt | model
```

管道符是 LangChain Expression Language 的组合语法：前一步输出成为后一步输入，整体仍是 Runnable，因此拥有统一的 `invoke/ainvoke/stream/astream` 接口。

### 4.3 `invoke`、`ainvoke`、`stream`、`astream`

- `invoke()`：同步调用，等待完整结果。
- `ainvoke()`：异步调用，等待完整结果。
- `stream()`：同步迭代输出块。
- `astream()`：异步迭代输出块。

项目中：

- 雷达评分需要完整结构化对象后再写数据库，所以使用同步 `invoke()`。
- 聊天和文案希望降低首字等待时间，所以使用 `astream()`。

流式输出改善的是感知延迟，不一定降低完整生成耗时，也不会减少 Token 成本。

### 4.4 Structured Output 与 JSON Mode

项目代码：

```python
structured = model.with_structured_output(CatScores, method="json_mode")
scores = structured.invoke(messages)
```

这条链包含两层约束：

1. Prompt 明确要求输出固定 JSON 字段。
2. Pydantic `CatScores` 校验字段存在、类型正确且值在 1–10。

必须区分三种策略：

- JSON Mode：主要保证输出是合法 JSON；Schema 通常仍需在 Prompt 中明确。
- Provider-native JSON Schema：提供商在生成阶段约束 Schema，通常更可靠。
- Function/Tool Calling：让模型用符合工具参数 Schema 的调用表达结构化结果。

当前选择 JSON Mode 是为了兼容所用 DeepSeek 模式，但它不等于“永远不会解析失败”，因此代码仍需要捕获网络、解析与校验异常。

### 4.5 模型单例与懒加载

Service 使用模块级 `_model`：首次请求时加载，后续复用客户端对象，避免每次重复初始化。

注意事项：

- 多进程 Worker 各有自己的内存，所以每个 Worker 都会有一个实例。
- 当前 `_get_model()` 没有加锁，首批并发请求理论上可能重复初始化；Embedding 单例使用了线程锁。
- API Client 是否线程安全要看具体集成实现，不应仅凭“单例”假定安全。
- 测试时全局单例不易替换，生产代码可通过工厂或依赖注入提供模型接口。

---

## 5. RAG：从概念到本项目实现

### 5.1 RAG 的完整流程

RAG 分为离线/写入阶段和在线/查询阶段。

#### 写入阶段

```text
Knowledge Document
  → optional chunking
  → Embedding model
  → 512-dimensional vector
  → PostgreSQL knowledge_docs
```

#### 查询阶段

```text
User Query
  → same Embedding model
  → query vector
  → cosine-distance search
  → Top-K documents
  → concatenate into system prompt
  → DeepSeek generation
```

关键原则：文档和查询必须使用兼容的 Embedding 模型与预处理方式，否则向量不在同一语义空间。

### 5.2 Embedding 是什么

Embedding 将文本映射为定长浮点向量，使语义相近文本在向量空间中距离更近。它不是把文本“存进 AI”，也不能直接生成答案。

本项目使用 `BAAI/bge-small-zh-v1.5`：

- 面向中文检索。
- 本地推理，无每次 API 调用费用，原文无需发给第三方 Embedding 服务。
- 输出 512 维，与数据库 `Vector(512)` 对齐。
- small 版本资源开销较低，适合 18 篇小型知识库和个人项目。

代价是本地首次下载/加载慢、CPU 推理可能阻塞、扩容时每个实例都要加载模型。更大的模型或托管 Embedding 可能提高质量，但必须通过自己的检索评测验证，不能只看排行榜。

### 5.3 Cosine Similarity 与 Cosine Distance

余弦相似度关注方向而非向量长度：

```text
cosine_similarity = dot(a, b) / (norm(a) * norm(b))
cosine_distance   = 1 - cosine_similarity
```

- 相似度越大越相关。
- 距离越小越相关。

项目设置 `max_dist=0.55`，等价于允许 `similarity >= 0.45`，再取 Top 3。

这是当前项目最值得主动指出的问题之一：BGE 官方模型卡提醒绝对相似度阈值需要基于自己的数据分布选择，而且 BGE 的不相关文本也可能有较高相似度。因此 0.55 不能仅靠代码注释称为“已校准”；需要构建标注查询集，统计 Precision@K、Recall@K、无答案拒答率后再确定阈值。

### 5.4 Top-K 与阈值分别做什么

- Top-K 控制最多返回多少条，影响上下文长度、噪声和 Token 成本。
- Threshold 控制最差相关度，防止无关文档也因为“总得选 K 条”被送给模型。

只有 Top-K 没阈值：无相关知识时也会返回垃圾结果。

只有阈值没 Top-K：可能返回过多结果，污染 Prompt。

本项目两者都使用了，但阈值需要评测重新标定。

### 5.5 降级策略

当本地 Embedding 加载失败或 pgvector 查询异常时，项目回退到字符命中搜索。这提升了可用性，但要能说出三个局限：

1. 字符匹配不理解同义词和语义。
2. fallback 读取的是种子常量，不是数据库当前内容；通过管理 API 更新的文档不会反映到 fallback，存在一致性问题。
3. 向量查询正常但没有结果时不会 fallback，这是合理选择，因为空结果表示“没有文档通过阈值”，不应强行找关键词结果冒充可信知识。

### 5.6 当前 RAG 不是完整文档平台

当前实现是“小型、人工整理知识条目的 RAG”，而不是通用知识库：

- 没有文件上传、解析、清洗和自动切块。
- 没有 chunk overlap、父子文档或引用定位。
- 没有 reranker、BM25 混合检索和检索评测集。
- 没有 Prompt Injection 隔离与知识来源展示。
- 聊天只发送当前一条消息，没有多轮历史。

面试时主动限定范围，比把它包装成企业级知识平台更可信。

---

## 6. 技术选型答辩

### 6.1 pgvector vs Milvus

| 维度 | pgvector | Milvus |
| --- | --- | --- |
| 定位 | PostgreSQL 扩展，向量与关系数据共存 | 专用向量数据库，提供 Lite、Standalone、Distributed |
| 当前项目运维 | 已有 PostgreSQL，只增加扩展 | 需要引入新的存储/服务边界；Milvus Lite 较轻 |
| 事务与一致性 | 可与业务表共享 PostgreSQL 事务、备份和权限 | 向量检索能力独立，跨业务库一致性需额外设计 |
| 查询 | SQL、JOIN、标量过滤、精确及近似索引 | 面向大规模向量检索、混合检索和独立扩缩容 |
| 扩展能力 | 主要随 PostgreSQL 纵向扩展，也可使用数据库生态方案 | Distributed 可把查询、写入等节点独立横向扩展 |
| 适用场景 | 已使用 PostgreSQL、中小规模、业务与向量强关联 | 大规模/高吞吐向量、独立检索团队、需要水平扩展 |

本项目为什么选 pgvector：

> 知识库只有 18 篇文档，业务数据已经放在 PostgreSQL。使用 pgvector 可以减少一套数据库的部署、监控、备份和一致性处理，并且知识文档 CRUD 与 Embedding 能在同一数据模型中管理。此时 Milvus 的分布式扩缩容能力没有产生实际收益，反而增加运维边界。

什么时候换 Milvus：

- 向量达到百万/千万乃至更大规模，并且增长明显。
- 向量查询 QPS、写入吞吐或延迟目标成为核心瓶颈。
- 需要独立扩容查询节点、复杂多向量/混合检索或专门的向量运维体系。
- 性能压测证明 PostgreSQL 已经成为瓶颈，而不是因为“Milvus 更专业”就提前迁移。

不要说“Milvus 只适合大数据、部署一定很重”：Milvus Lite 可以本地嵌入，Standalone 也能单机部署；比较应基于本项目是否需要独立向量系统。

当前 18 条数据甚至不需要近似索引，精确扫描已经足够。数据扩大后可先在 pgvector 增加 HNSW/IVFFlat 索引并通过 `EXPLAIN ANALYZE` 验证，再决定是否迁移。

### 6.2 为什么选择 bge-small-zh-v1.5

| 方案 | 优点 | 代价 | 适合情况 |
| --- | --- | --- | --- |
| bge-small-zh-v1.5 本地 | 中文、轻量、无按次费用、数据不外发 | 首次加载、CPU 延迟、实例内存占用 | 当前小型中文知识库 |
| bge-base/large | 通常有更强表示能力 | 更慢、更大、向量维度与存储增加 | 质量评测显示 small 不足 |
| BGE-M3/多语言模型 | 多语言、长文本或稠密/稀疏能力更丰富 | 系统复杂度与计算成本更高 | 多语言/复杂检索需求明确 |
| 云端 Embedding API | 接入快、运维简单、易扩容 | 按量成本、网络延迟、隐私和供应商依赖 | 团队不想维护推理资源 |

正确的选型逻辑：先定义中文召回率、延迟、成本、隐私、文档长度，再用标注数据评测候选模型。不能说“BGE 在榜单高，所以一定最好”。

当前还可改进：

- 评测查询是否应添加 BGE 检索指令。
- 显式配置并记录 Embedding normalize 参数。
- 记录模型版本和向量版本，便于重算与回滚。
- 对长文档先切块，避免超过模型有效输入范围。

### 6.3 FastAPI vs Flask vs Django

- FastAPI：类型驱动、Pydantic/OpenAPI 集成、ASGI 与 async 体验好，适合本项目的 LLM I/O 和 SSE。
- Flask：核心小、自由度高，简单同步服务容易上手；类型校验、依赖体系等通常需要自行组合。
- Django：ORM、Admin、用户与权限等“大而全”，适合后台管理和传统业务复杂度高的系统；纯 AI API 可能较重，但若项目很快需要用户、权限和运营后台，它可能反而减少整体工作量。

回答重点应是需求匹配，不要把 FastAPI 描述为所有场景都更快或更先进。

### 6.4 SSE vs WebSocket

| 维度 | SSE | WebSocket |
| --- | --- | --- |
| 方向 | 主要是服务端到客户端 | 全双工 |
| 协议 | 普通 HTTP 响应流 | HTTP Upgrade 后独立帧协议 |
| 重连 | 原生 EventSource 支持；fetch 自己处理 | 应用自行设计 |
| 代理兼容 | 通常更贴近 HTTP 基础设施 | 需确认代理/网关支持 Upgrade |
| 本项目 | 用户一次 POST，服务端持续返回 Token | 没有高频双向通信需求 |

本项目选择 SSE，因为生成过程主要是单向推送。原生 `EventSource` 只能方便地发 GET，无法携带本项目的 POST JSON Body，因此前端使用 `fetch + ReadableStream` 手写解析器。

什么时候选 WebSocket：实时协作、多人在线、双向高频事件、语音流或客户端需要持续向同一连接发送控制消息。

### 6.5 JSON Mode vs Tool Calling vs Agent

- JSON Mode：让一次模型输出成为可解析 JSON，适合雷达评分这种单步结构化任务。
- Tool Calling：模型选择并填写一个外部函数/API 的参数，应用执行工具后可把结果返回模型。
- Agent：模型在状态和工具之间循环决策，直到得到最终答案。

雷达评分不需要调用外部工具或循环决策，因此 Chain + Structured Output 比 Agent 更简单、可预测、便宜。不要为了简历关键词强行引入 Agent。

### 6.6 同步 ORM vs Async ORM

- 同步 SQLModel：代码直观、生态成熟，小项目足够；配合普通 `def` 路由由 FastAPI 线程池承载。
- AsyncSession：高 I/O 并发下能减少线程占用，但事务、懒加载和调用链都必须真正异步，复杂度更高。

是否迁移应由并发压测决定。把函数名改成 `async` 而底层仍同步，不会获得异步收益。

---

## 7. SSE 与流式系统

### 7.1 SSE 帧格式

本项目发送：

```text
event: chunk
data: {"content":"喵"}

```

空行表示一帧结束。`data` 使用 Pydantic `model_dump_json()`，避免手动拼 JSON 转义错误。

事件类型形成一个小型协议：

- `chunk`：增量文本。
- `done`：某条流完成。
- `disclaimer`：医疗回答免责声明。
- `error`：流内错误。

### 7.2 为什么前端要维护 buffer

网络 chunk 不等于 SSE frame：

- 一帧可能被拆成多个 TCP/ReadableStream chunk。
- 一个 chunk 也可能包含多帧。

所以前端必须将 bytes 通过 `TextDecoder` 增量解码，追加到 buffer，再按空行切帧，最后保留未完成尾部。

当前解析器适用于受控后端，但不是完整 SSE 实现：

- 只按 `\n\n` 切分，没有统一处理 `\r\n`。
- 没有处理 `id`、`retry` 和注释心跳。
- EOF 时没有 flush decoder 和尾帧。
- 没有自动重连。

面试时可以说：项目实现的是满足自身协议的最小解析器，而不是通用 SSE 库。

### 7.3 取消、断连与背压

- 前端用 `AbortController` 取消旧请求和组件卸载时的流。
- 后端在每个事件到达后调用 `request.is_disconnected()`。
- 文案服务在 `finally` 中取消并发任务。

局限：如果下游模型长时间不返回 chunk，断连检查不会立刻运行。生产环境还应设置模型超时、代理超时、心跳、最大生成时长，并确保取消后 `gather` 子任务，避免残留任务。

Queue 当前无上限。LLM Token 流通常不会瞬间压垮内存，但严谨方案可使用有界 Queue，让慢消费者对生产者产生背压。

反向代理还可能缓冲流。部署时应验证 Nginx/CDN 是否关闭响应缓冲，并配置适当的 idle timeout，而不是只在本机看到逐字输出就认为生产可用。

---

## 8. 三链并发的原理

文案服务为三种风格分别创建 Task：

```python
tasks = [asyncio.create_task(pump(style, chain)) for style, chain in chains.items()]
```

每个 Task 等待远程模型 I/O 时，事件循环可以运行另外两个 Task。结果写入同一个 Queue，并携带 `style` 标签，因此到达顺序可以交错，前端仍能正确更新对应卡片。

这叫异步并发，不保证三段 Python 代码在多个 CPU 核上同时执行。它适合远程 LLM 这种 I/O 密集任务。

如果串行调用，完整等待时间近似：

```text
T = T_funny + T_healing + T_cool
```

并发调用的完整等待时间通常更接近：

```text
T ≈ max(T_funny, T_healing, T_cool) + scheduling overhead
```

但并发也有代价：

- 同时占用 3 个模型请求配额。
- 更容易触发限流。
- 总 Token 成本没有降低。
- 一条失败时要决定部分成功还是全部失败。

当前策略是 fail-fast：任一风格失败就发 error 并取消其他任务。产品上也可以改为“允许部分成功”，让每张卡独立显示状态。

---

## 9. 当前实现的风险与生产化改进

按面试中建议使用的优先级排列：

### P0：正确性与安全

1. 添加鉴权与知识库管理接口权限，避免任何人修改知识库。
2. 增加限流、请求大小限制和模型调用预算。
3. 为 LLM、Embedding 和数据库设置明确超时与重试策略。
4. 建立 RAG 标注评测集，重新确定 Top-K 与阈值。
5. 医疗内容不能只靠免责声明；需要内容边界、紧急情况规则和可信来源。

### P1：并发与可靠性

1. 修复 `async def` 中的同步数据库/Embedding 阻塞。
2. 将数据库迁移与种子导入从应用启动流程中分离。
3. 增加结构化日志、trace ID、模型耗时、首 Token 延迟、Token 用量和错误率。
4. SSE 增加超时、心跳、代理配置和更完整的取消清理。
5. 对模型返回内容类型做更稳健处理，而不是假设 `chunk.content` 永远是字符串。

### P2：RAG 质量与规模

1. 文档切块并保存 source/chunk metadata。
2. 增加 BM25/稀疏 + Dense 混合检索。
3. 候选召回后使用 reranker。
4. 展示引用来源，并让回答明确区分检索事实与模型补充。
5. 数据增长后给 pgvector 加 HNSW/IVFFlat 索引，再根据压测决定是否迁移 Milvus。

### P3：代码可测试性

1. 通过依赖注入替换全局模型单例。
2. 使用 Fake Chat Model 测试 chunk/done/error 协议。
3. 覆盖路由 422/404/409/502。
4. 使用测试 Session 覆盖 Repository 与事务。
5. 用固定向量或 Mock Embedder 测试阈值、Top-K 和 fallback。

另一个配置问题：项目依赖了 `pydantic-settings`，但实际仍通过 `os.getenv + load_dotenv(override=True)` 读取环境变量。生产中更适合集中定义 Settings，并谨慎使用 `override=True`，避免本地 `.env` 意外覆盖进程已注入的环境变量。

---

## 10. 高频面试题与参考回答

不要逐字背诵，先合上文档回答，再用参考答案补缺口。

### Q1：为什么使用 FastAPI？

项目需要调用远程 LLM 并持续输出 SSE，属于 I/O 密集场景。FastAPI 基于 ASGI，原生支持 async 与 StreamingResponse；Pydantic、依赖注入和 OpenAPI 也能统一接口契约。它并不保证代码自动高性能，如果在 `async def` 中执行同步数据库或本地模型计算，仍会阻塞事件循环。

### Q2：FastAPI 的依赖注入有什么用？

它按照函数签名构建依赖图，统一提供数据库 Session、鉴权等资源。项目通过 `Depends(get_session)` 为每个请求创建 Session，并在 `yield` 依赖退出时关闭。测试时可以 override 依赖，避免访问生产数据库。

### Q3：为什么有的路由是 `def`，有的是 `async def`？

需要 await 异步库或生成异步流时使用 `async def`；使用同步阻塞库时可以用 `def`，FastAPI 会放到线程池。本项目部分 async 查询仍调用同步 SQLModel，是可以工作的原型实现，但高并发下应修改。

### Q4：你的项目为什么不是 Agent？

流程由代码预先确定：分类、检索、拼 Prompt、调用一次模型，没有让模型自主选择工具并循环决策。因此它是 Chain/RAG Workflow。对当前固定业务来说，这比 Agent 更可控、成本更低。

### Q5：`prompt | model` 是什么？

它是 LangChain Runnable 的组合。Prompt 将业务变量转换为消息，Model 接收消息并输出 AIMessage；组合后整体拥有相同的 invoke/stream 接口，方便复用与并发。

### Q6：三种文案如何并发？

每个风格链由一个 asyncio Task 驱动，远程模型等待期间事件循环切换到其他 Task。三个生产者把带 style 的 chunk 放进同一个 Queue，一个消费者统一转成 SSE。它是 I/O 并发，不是 CPU 多核并行。

### Q7：为什么用 SSE，不用 WebSocket？

业务是一次请求后服务端单向推 Token，不需要持续双向通信，SSE 更简单且贴合 HTTP。由于请求需要 POST JSON，不能直接使用只适合 GET 的 EventSource，所以前端使用 fetch 读取响应流。

### Q8：流开始后模型失败，为什么不返回 502？

HTTP 响应头已经发送，状态码不能再修改，所以通过 SSE `error` 事件表达流内错误。流开始前发生的错误才适合直接返回非 2xx。

### Q9：RAG 如何降低幻觉？

先检索领域资料并放入 Prompt，给模型提供可依据的上下文，从而降低完全凭参数记忆回答的概率。但 RAG 不会消灭幻觉；检索错误、上下文冲突或模型忽略资料仍会失败，需要评测、引用、拒答和安全策略。

### Q10：为什么选择 pgvector？

数据量只有 18 篇且已有 PostgreSQL。pgvector 让业务字段和向量共享事务、备份与权限，减少额外服务。若未来达到大规模高 QPS，需要独立扩缩查询节点，再基于压测评估 Milvus。

### Q11：Top-K 和阈值有什么区别？

Top-K 限制最大候选数量；阈值过滤不够相关的结果。两者一起使用才能同时控制上下文长度和无关结果。项目使用 Top 3 与 0.55 余弦距离，但阈值尚缺离线评测支撑。

### Q12：为什么使用本地 BGE？

知识是中文、规模小，本地 small 模型能控制成本且数据不外发，512 维也降低存储与计算开销。代价是启动和 CPU 推理延迟；如果评测质量不达标，会比较更大 BGE、多语言模型或托管 API。

### Q13：Structured Output 如何保证 1–10？

JSON Mode 促使模型输出合法 JSON，`CatScores` 的 Pydantic Field 再校验五个整数范围。JSON Mode 本身不等于严格 Schema，因此解析和校验仍可能失败，代码将其转换为 502。

### Q14：为什么 AI 分数要缓存？

同一品种结果不需要每次重新生成。持久化缓存能降低延迟、成本和输出漂移；`force=true` 用于模型或 Prompt 更新后重算。严谨版本还应记录 model、prompt 和 schema version，避免旧缓存无法追溯。

### Q15：知识文档更新时为什么要重算 Embedding？

向量代表的是旧内容；只改文本不改向量会导致检索仍按旧语义排序。项目在创建/更新时先计算 Embedding，成功后再保存，但还应使用事务和版本字段加强一致性。

### Q16：如何测试 LLM 功能？

不应把所有测试都打到真实模型。单元测试使用 Fake Model/Fake Embedder，验证 Prompt 变量、事件顺序、异常与取消；检索使用固定向量验证 Top-K 和阈值；少量集成测试验证真实提供商；离线评测集验证 RAG 质量。

### Q17：项目如何支持多轮对话？

当前不支持真正的多轮上下文，每次只发送当前 message。可以增加 conversation/message 表或 LangGraph checkpointer，按会话加载最近历史，同时需要做 Token 截断、摘要、隐私和并发一致性处理。

### Q18：如果流量增加十倍，先优化哪里？

先测量而不是先换数据库：记录 QPS、p95、首 Token 时间、模型耗时、Embedding 耗时、连接池等待和错误率。优先移除事件循环中的阻塞、设置连接池/超时/限流、缓存稳定结果，再根据证据扩 Worker、拆 Embedding 服务或升级向量架构。

### Q19：当前医疗路由有什么问题？

关键词路由便宜、可解释，但存在同义表达漏判和非医疗语境误判。可用结构化分类模型或轻量分类器改进，并保留高风险关键词兜底；同时要评测误判成本，不能只追求整体准确率。

### Q20：Prompt Injection 如何处理？

当前没有完整防护。改进包括把检索文档视为不可信数据、明确指令层级、隔离资料边界、限制工具能力、输出引用、内容审核和对抗测试。仅写“忽略之前指令”不足以构成安全方案。

---

## 11. 后端 3 天学习计划（每天 5–6 小时）

三份手册共用 7 天：本手册占 Day 1–3，Next.js/Fabric 占 Day 4–5，数据库占 Day 6–7。每天都按“原理 → 项目源码 → 手写 → 口述”闭环，不建议只看资料。

### Day 1：Python 语义、asyncio 与 FastAPI（5.5 小时）

1. **迁移知识（60 分钟）**：完成 0.2–0.4 的 NestJS/TypeScript 映射；闭卷写出 Promise、coroutine、Task 的差别。
2. **FastAPI 原理（75 分钟）**：ASGI、请求生命周期、`def`/`async def`、Pydantic、`Depends + yield`、lifespan。
3. **源码追踪（60 分钟）**：阅读 `backend/main.py`、`backend/db.py`、一个同步 CRUD Router 和一个流式 Router，画出进入/退出顺序。
4. **手写实验（75 分钟）**：实现最小 CRUD + Session Dependency；用 `time.sleep`/`asyncio.sleep` 对比并发；用 dependency override 注入 fake repository。
5. **口述与错题（45 分钟）**：回答 Q1–Q3、Q18–Q19；说明 NestJS Guard、Pipe、Interceptor 在 FastAPI 中如何落地。

验收：能判断一个阻塞函数应改异步 SDK、线程池还是任务队列；能不看代码画出请求与资源释放流程。

### Day 2：LangChain、流式返回与结构化并发（5.5 小时）

1. **LangChain（75 分钟）**：Model、Message、Prompt、Runnable、`invoke/ainvoke/stream/astream`、Structured Output。
2. **SSE（60 分钟）**：事件格式、网络分块、buffer、断连、取消、代理缓冲和流开始后的错误协议。
3. **源码追踪（75 分钟）**：阅读 `services/copywriting.py`、`services/radar_scores.py`、两个 streaming router、`frontend/lib/sse.ts`。
4. **手写实验（75 分钟）**：用 fake coroutine + Queue/TaskGroup 模拟三路交错流；实现 chunk/error/done 事件；取消客户端后验证子任务被清理。
5. **口述与错题（45 分钟）**：回答 Q4–Q8、Q12–Q14；解释为什么当前是确定性 Workflow，而不是 Agent。

验收：能现场写出最小 AsyncGenerator + `StreamingResponse`，并解释为什么 200 已发送后不能再改成 502。

### Day 3：RAG、选型、评测与生产化（5.5 小时）

1. **RAG 原理（75 分钟）**：切块、Embedding、余弦距离、Top-K、阈值、Metadata Filter、Rerank、Context Prompt。
2. **源码追踪（60 分钟）**：阅读 `services/knowledge.py`、`repositories/knowledge.py`、`models/knowledge.py`，核对 512 维与 0.55 distance threshold。
3. **选型答辩（60 分钟）**：pgvector/Milvus、本地/云端 Embedding、Chain/Tool/Agent、同步/异步 ORM。
4. **评测练习（90 分钟）**：为 18 篇知识设计至少 20 条查询，标相关文档和无答案样本；比较不同 Top-K/阈值并记录 Recall@K、拒答准确率和延迟。
5. **模拟面试（45 分钟）**：连续回答 Q9–Q20；录制 60 秒和 3 分钟项目介绍；列 P0–P3 技术债。

验收：能用规模、QPS、过滤、事务、运维成本和实测指标说明为什么目前用 pgvector，以及什么证据会触发迁移。

---

## 12. 必须亲手完成的 6 个练习

不要让 AI 直接写答案，可以让 AI 只做代码审查。

1. **请求校验**：手写 `POST /practice/score`，输入 5 个 1–10 整数，观察非法输入的 422。
2. **依赖注入**：手写 request-scoped Session 依赖，并在测试中 override。
3. **阻塞实验**：对比 async 路由中的 `time.sleep` 与 `await asyncio.sleep`。
4. **SSE**：手写 AsyncGenerator，依次发送 chunk/done；前端维护 buffer 解析。
5. **并发生成**：用 3 个不同延迟的 fake coroutine + Queue 模拟三风格交错输出。
6. **RAG 评测**：为 18 篇知识写至少 20 条查询，标注相关文档与无答案样本，比较多个 Top-K/阈值组合。

第 6 个练习最有价值，因为它能把简历里的“阈值”从拍脑袋参数变成有证据的工程决策。

---

## 13. 面试用项目介绍

### 60 秒版本

> MiaoMiaoVerse 是我用 Next.js 和 FastAPI 开发的 AI 全栈项目。后端通过 LangChain 接入 DeepSeek，主要实现了三类 AI 能力：第一是三种风格文案的 asyncio 并发生成，并通过一条 SSE 连接复用流式返回；第二是猫咪健康问答，对医疗问题使用本地 BGE Embedding 和 PostgreSQL/pgvector 做 Top-K RAG 检索；第三是使用 Pydantic Structured Output 生成五维猫咪评分，并持久化缓存。项目目前属于可运行原型，我也识别出同步数据库阻塞 async 路径、RAG 阈值缺少评测、无鉴权与完整可观测性等问题。如果生产化，我会先补安全与评测，再处理并发和部署。

### 被追问“是不是 Agent”时

> 当前不是 Agent，而是确定性 Workflow。路由、检索、Prompt 和模型调用顺序由代码控制，没有模型自主选择工具的循环。我刻意不用 Agent，是因为这些任务步骤固定，Chain 更可控、更容易测试；如果未来需要模型动态选择百科查询、图片处理或外部搜索工具，再考虑 Agent/Tool Calling。

### 被追问“为什么不用 Milvus”时

> 当前只有 18 篇知识文档，并且业务数据已经在 PostgreSQL。pgvector 能复用数据库事务、备份和运维体系，精确扫描都足够快；引入独立 Milvus 不会改善当前瓶颈。若向量规模和 QPS 显著增长，我会先用 HNSW/IVFFlat 和压测验证 pgvector 上限，再在需要独立水平扩容时迁移 Milvus。

---

## 14. 官方资料阅读顺序

只读与本项目直接相关的部分：

1. [FastAPI：并发与 async/await](https://fastapi.tiangolo.com/async/)
2. [FastAPI：Dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/)
3. [FastAPI：Dependencies with yield](https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-with-yield/)
4. [FastAPI：Lifespan](https://fastapi.tiangolo.com/advanced/events/)
5. [FastAPI：StreamingResponse](https://fastapi.tiangolo.com/advanced/stream-data/)
6. [FastAPI：Response Model](https://fastapi.tiangolo.com/tutorial/response-model/)
7. [Pydantic：Models](https://docs.pydantic.dev/latest/concepts/models/)
8. [SQLModel：Session Dependency](https://sqlmodel.tiangolo.com/tutorial/fastapi/session-with-dependency/)
9. [SQLModel：测试与 Dependency Override](https://sqlmodel.tiangolo.com/tutorial/fastapi/tests/)
10. [LangChain：Models、Streaming、Structured Output](https://docs.langchain.com/oss/python/langchain/models)
11. [LangChain：DeepSeek Integration](https://docs.langchain.com/oss/python/integrations/chat/deepseek)
12. [LangChain：Sentence Transformers Embedding](https://docs.langchain.com/oss/python/integrations/embeddings/sentence_transformers)
13. [BGE Small Chinese v1.5 模型卡](https://huggingface.co/BAAI/bge-small-zh-v1.5)
14. [pgvector 官方说明](https://github.com/pgvector/pgvector)
15. [pgvector-python / SQLAlchemy 支持](https://github.com/pgvector/pgvector-python)
16. [Milvus 部署模式](https://milvus.io/docs/install-overview.md)
17. [Milvus 架构](https://milvus.io/docs/architecture_overview.md)

阅读官方文档时不要顺序通读。每次带着一个项目问题去找答案，例如：“yield Session 在 StreamingResponse 期间何时关闭？”找到答案后回到源码验证。

---

## 15. 最终自测清单

- [ ] 我能解释 ASGI、Uvicorn、FastAPI 各自的职责。
- [ ] 我能判断某个函数应该用 `def` 还是 `async def`。
- [ ] 我能解释 `Depends + yield` 的进入和退出时机。
- [ ] 我能说明 Pydantic 校验、序列化和 response_model 的差异。
- [ ] 我能解释 LangChain Chain 为什么不是 Agent。
- [ ] 我能说明 invoke/ainvoke/stream/astream。
- [ ] 我能画出聊天和三风格文案的端到端流。
- [ ] 我能解释 SSE buffer、断连、错误和代理缓冲。
- [ ] 我能解释 Embedding、余弦距离、Top-K 和阈值。
- [ ] 我能说明当前 0.55 距离阈值为什么仍需评测。
- [ ] 我能从数据规模、事务、运维和扩展性比较 pgvector/Milvus。
- [ ] 我能比较本地 BGE 与云端 Embedding。
- [ ] 我能主动说明项目没有 Agent、Tool Calling、鉴权和多轮 Memory。
- [ ] 我能提出按优先级排序的生产化改进，而不是只说“加缓存、做微服务”。
- [ ] 我能在 30 分钟内手写一个带 Pydantic、Depends 和 SSE 的最小 FastAPI 应用。
