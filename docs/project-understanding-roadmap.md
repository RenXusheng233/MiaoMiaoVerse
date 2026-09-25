# MiaoMiaoVerse 项目理解路线：从一次请求到下一次迭代

> 基于 2026-09-25 的当前源码。面向已经能读懂 Next.js/TypeScript，但希望真正掌握本项目 FastAPI、LangChain 和数据链路的开发者。本文是**跟读与动手路线**，不是功能设计稿；以后代码变化时，以源码为准。

## 怎么使用这份文档

每一站都按同一个顺序进行：**先预测 → 读指定文件 → 发一个请求或做一个小实验 → 画出链路 → 用自己的话复述**。不要一开始就逐行读完整仓库。建议每站花 60–90 分钟；第一次走完约需 8–12 小时，可以分几天完成。

每站留下三样成果：一张不超过十个方框的调用图、一段 100 字以内的解释、一个自己发现的边界或疑问。能脱离源码讲清楚，才算完成。

| 顺序 | 主题 | 完成后要能回答的问题 |
| --- | --- | --- |
| 0 | 建立全景与运行环境 | 启动时、请求时分别发生什么？ |
| 1 | 从只读接口理解 FastAPI | 一个 `GET /api/cats/{id}` 怎样变成数据库查询和 JSON？ |
| 2 | 输入校验与依赖注入 | 422、404 从哪里来？Session 由谁创建和释放？ |
| 3 | 数据权威与持久化 | 种子文件、表、手工分、AI 分各是什么关系？ |
| 4 | 从单次模型调用理解 LangChain | Prompt、模型、结构化输出各管什么？ |
| 5 | 文案生成与 SSE | 三个模型流如何合并到一个 HTTP 响应？ |
| 6 | 聊天与 RAG | 什么问题会检索？检索失败和检索为空有何不同？ |
| 7 | 前后端边界与功能现状 | 哪些请求在服务端发，哪些在浏览器发？ |
| 8 | 用证据驱动下一轮迭代 | 哪些问题先解决，怎样证明改进有效？ |

已有材料各有侧重：[FastAPI 入门练习册](fastapi-core-learning-guide.md)适合对 `Depends` 和 `async` 还不熟时先做；[FastAPI × LangChain 面试手册](fastapi-langchain-interview-guide.md)适合学完本路线后补原理与面试表达；[Next.js × Fabric 手册](nextjs-fabric-interview-guide.md)适合深入前端。本文只以**目前实际存在的调用链**组织学习。

## 0. 先拿到项目全景，不急着看 AI

从仓库根目录读 `package.json`、`frontend/package.json`、`backend/pyproject.toml`、`backend/main.py`。项目是两个独立服务：Next.js 负责页面及浏览器交互，FastAPI 负责 API、数据库和模型调用；根目录的 `bun dev` 只是并行启动两者。

```text
浏览器 → Next.js 页面/客户端组件 → HTTP 或 SSE → FastAPI Router
                                                 ↓
                                             Service（业务与 AI 编排）
                                                 ↓
                              Repository → SQLModel → PostgreSQL / pgvector
```

读 `backend/main.py` 的 `lifespan`：启动时调用 `init_db()`，然后才对外提供请求。`backend/db.py` 在模块导入时读取 `DATABASE_URL` 并建立 Engine；`init_db()` 建表且在空表时导入猫咪和知识文档。**`create_all()` 不负责已存在表的结构迁移**。启动失败时，先检查数据库连接、pgvector 扩展和本地 embedding 模型，而不要直接归因于某个页面。

如果本地环境已经配置好，可从根目录运行 `bun dev`，访问 `http://localhost:3000` 和 `http://localhost:8000/docs`。后端依赖 `backend/.env` 中的 `DATABASE_URL`；模型调用还需要 DeepSeek 配置，前端依赖 `frontend/.env.local` 中的 `NEXT_PUBLIC_API_BASE_URL`。只核对**变量是否存在**，不要把实际值写进学习笔记、终端截图或文档。首次为知识文档算 embedding 时，可能需要下载本地模型。暂时不运行 `seed_db --reset`、写接口或真实模型请求。

**动手**：在 Swagger 里找到 `/api/cats`、`/api/copy/generate`、`/api/chat`。按“只读 / 写数据库 / 调模型”给接口分类。画一张启动链路图，标出 `main.py`、`db.py` 与 PostgreSQL。

**过关标准**：能够解释“Uvicorn 启动 FastAPI”和“用户发一次请求”是两个阶段，也能指出为什么即便只访问 `/`，后端启动仍依赖数据库。

## 1. 用 `GET /api/cats/{id}` 学 FastAPI 的第一条完整链路

按顺序打开：`frontend/app/cats/[id]/page.tsx` → `frontend/lib/api.ts` 的 `getCat` → `backend/main.py` 的路由注册 → `backend/routers/cats.py` 的 `get_cat` → `backend/repositories/cats.py` 的 `get_breed` / `_to_response` → `backend/models/cat.py` 与 `backend/schemas/daily_cat.py`。

关键节点（摘自当前代码）：

```python
@router.get("/{cat_id}", response_model=CatBreed)
async def get_cat(cat_id: str, session: Session = Depends(get_session)):
    breed = repo.get_breed(session, cat_id)
    if not breed:
        raise HTTPException(status_code=404, detail=f"Cat breed '{cat_id}' not found")
    return breed
```

- `APIRouter(prefix="/api/cats")` 与 `@router.get("/{cat_id}")` 合成最终路径；`main.py` 的 `include_router` 才把它接到应用。
- `cat_id: str` 来自路径；`session` 由 `Depends(get_session)` 注入；`response_model=CatBreed` 声明输出契约。FastAPI 根据函数签名推断来源并在运行时处理请求。
- Repository 使用 `session.get(CatBreedRow, cat_id)` 读表，再把数据库行转成 API 的 `CatBreed`。前端 TypeScript 类型 `CatBreed` 只帮助静态检查；HTTP 边界真正执行 Python 侧的 Pydantic 校验与序列化。
- 详情页中的 `params` 是 Promise，页面 `await params` 后调用 `getCat`；`getCat` 把后端 404 转成 `null`，页面再调用 Next.js 的 `notFound()`。

如果服务已启动，试一条存在的记录和一条不存在的记录（均为只读）：

```bash
curl -i http://localhost:8000/api/cats/ragdoll
curl -i http://localhost:8000/api/cats/does_not_exist
```

**动手**：不看代码，画出 `浏览器 URL → page.tsx → api.ts → Router → Repository → 表 → JSON → 页面`。再说清：404 是在后端哪一层产生的？前端为什么还需要调用 `notFound()`？

**过关标准**：能在每个箭头旁写出传递的数据类型或 HTTP 状态，而不是只背文件名。

## 2. 理解 Pydantic、依赖与请求生命周期

读 `backend/schemas/chat.py`、`backend/schemas/cat_manage.py`、`backend/db.py` 中的 `get_session`，再看 `backend/routers/cats.py` 的创建/更新/删除接口。

```python
class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)

def get_session():
    with Session(engine) as session:
        yield session
```

`ChatRequest` 是**运行时 HTTP 输入校验**：空字符串不满足长度约束，FastAPI 在进入路由体前返回 422。`get_session` 中 `yield` 前创建本次请求要用的 Session，请求结束后退出 `with` 释放它。Engine 则在模块加载时创建，可复用。不要把 Engine、Session 和单条数据库连接当成同一个对象。

```bash
curl -i -X POST http://localhost:8000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":""}'
```

这个输入应被 422 拒绝，不会进入 LangChain，也不会产生模型费用。对照 `POST /api/cats` 中的 `CatBreedCreate`：字段长度、`Literal` 选项、1–10 分数由 Pydantic 校验；“ID 已存在”属于业务判断，由 Router 抛 409；“ID 不存在”抛 404。

**留意当前实现**：若路由写成 `async def`，其中直接调用同步 SQLModel 查询，并不会使数据库操作自动异步化；例如 `get_cat`、`list_cats` 和 `daily_cat` 路由仍调用同步 Session。`def` 路由与 `async def` 路由的执行方式不同，下一轮优化时要实测阻塞影响，再决定统一同步边界还是改异步数据库栈。

**动手**：预测空消息、未知猫 ID、重复猫 ID 分别是谁拒绝的、HTTP 状态是多少。重复 ID 只需静态分析，不必真的写数据库。

**过关标准**：能区分“输入形状错误”和“业务状态冲突”，也能解释为什么 Session 不能简单做成跨请求全局变量。

## 3. 理清 PostgreSQL、种子文件和两个分数来源

读 `backend/data/cats.py`、`backend/data/knowledge.py`、`backend/db.py`、`backend/models/cat.py`、`backend/models/knowledge.py`、`backend/repositories/cats.py`。`data/` 是首次导入或显式同步时使用的**种子基准**；运行时猫咪与知识文档读取数据库。`backend/scripts/seed_db.py` 有同步、补缺和重置模式，学习时先读其行为，不在现有数据上试 `--reset`。

```python
def _to_response(row: CatBreedRow) -> CatBreed:
    scores = row.ai_scores or row.scores
    return CatBreed(
        id=row.id,
        name_zh=row.name_zh,
        name_en=row.name_en,
        origin=row.origin,
        size=row.size,
        coat=row.coat,
        quote=row.quote,
        meme_tags=row.meme_tags,
        suitable_owners=row.suitable_owners,
        image_url=row.image_url,
        scores=CatScores(**scores),
    )
```

这说明详情页雷达图拿到的 `scores` 可能是手工分，也可能是 `ai_scores`；只看前端字段名无法知道来源。`POST /api/cats/{id}/radar-scores` 生成的结果会写入 `ai_scores`；若已存在且未传 `force=true`，直接返回缓存。该接口**会调用付费模型并改数据库**，不适合作为第一轮阅读练习。

知识文档行还有 `embedding: Vector(512)`。文本存入知识表后，向量供相似度检索；`NULL` embedding 的行不会出现在向量查询结果里。初次导入可在 embedding 失败时仍保存文档。`scripts/seed_db.py` 的普通同步可能更新已有种子行；它并非只读命令。

**动手**：追踪首页“今日明星猫”：`frontend/app/page.tsx` → `GET /api/daily-cat` → `backend/routers/daily_cat.py` → `repo.random_breed`。解释为什么同一天会选到同一品种，以及“换一只”为何调用另一个随机接口。然后画出“手工分/AI 分 → API 的 `scores` → 雷达图”的选择过程。

**过关标准**：能解释“修改 `data/cats.py` 不会自动覆盖运行中的数据库”和“修改表模型不等于迁移已有表”。

## 4. 先读一个简单的 LangChain 调用：AI 雷达分

读 `backend/services/radar_scores.py`，按 `_get_model` → `_breed_profile` → `generate_scores` → `update_ai_scores` 的顺序。这里比流式聊天简单：一次输入、一次输出、一次持久化。

```python
structured = _get_model().with_structured_output(CatScores, method="json_mode")
scores = structured.invoke(
    [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=_breed_profile(breed))]
)
update_ai_scores(session, breed.id, scores)
```

- `init_chat_model("deepseek:deepseek-v4-flash")` 在 `_get_model` 中懒加载；LangChain 封装模型适配与消息接口。
- SystemMessage 约束评分规则和输出格式，HumanMessage 提供猫咪资料；Prompt 是对模型的要求，**不等于可信的程序校验**。
- `with_structured_output(CatScores, method="json_mode")` 将结果解析成 Pydantic 模型；`CatScores` 再约束五项都是 1–10 的整数。模型调用、JSON 解析或校验失败会被转成 `RadarGenerationError`，Router 返回 502。
- `invoke` 是一次同步调用；它与后面 `astream` 的逐块异步输出要分开理解。项目依赖清单声明了 LangGraph，但当前这些链路没有使用 Agent/工具循环。

**动手**：把这段代码改写成五句自然语言。预测：第二次请求为什么可能不调用模型？`force=true` 为什么会产生新结果？如果模型返回 11 分，会在哪个边界被拒绝？这一步只做源码推演；如需实际调用，先准备隔离的测试数据库和可接受的模型额度。

**过关标准**：能说清“模型生成 → Pydantic 校验 → 写入数据库 → 下次读取优先用 AI 分”的每个边界。

## 5. 读懂三路文案如何从 LangChain 流到页面

按以下顺序阅读：`backend/schemas/copywriting.py` → `backend/services/copywriting.py` → `backend/routers/copywriting.py` → `frontend/lib/sse.ts` → `frontend/lib/api.ts` → `frontend/components/copywriting/copy-workspace.tsx`。

```python
prompt = ChatPromptTemplate.from_messages([("system", system), ("human", HUMAN_TEMPLATE)])
chains[style] = prompt | model

async for chunk in chain.astream(vars_):
    await queue.put(("chunk", style, chunk.content))
```

`prompt | model` 是 LangChain Runnable 链：先把表单变量填进模板，再交给模型。`stream_copy` 为 `funny`、`healing`、`cool` 各创建一个 `asyncio` task，三条链同时等待远端输出。每个 task 把 `(事件种类, 风格, 内容)` 放进同一个 Queue，因此三种风格的 chunk 可以**交错到达**；它们不是按卡片顺序完成。一个风格报错时，服务会发 `error` 事件并终止整条流，`finally` 取消其余任务。

Router 把 Pydantic 事件编码成 SSE 帧，例如：

```text
event: chunk
data: {"style":"funny","content":"今天"}

event: done
data: {"style":"funny"}

```

前端 `streamSSE` 用 `fetch` 发送 POST，再从 `ReadableStream` 读字节、解码、按空行拆帧；不能假定一次 `reader.read()` 恰好是一帧。`CopyWorkspace` 按 `style` 把 chunk 累加到对应卡片；生成成功需收到三次 `done`。单版重生成调用 `/api/copy/regenerate`，只清空对应卡片。`AbortController` 用于停止旧请求及卸载时的流。

先做免费验证：给 `/api/copy/generate` 发送缺失必填 `cat_name` 的请求，应在模型调用前返回 422。

```bash
curl -i -X POST http://localhost:8000/api/copy/generate \
  -H 'Content-Type: application/json' \
  -d '{"platform":"moments"}'
```

若你主动要观察真实流，可在服务与模型额度准备好后运行：

```bash
curl -N -X POST http://localhost:8000/api/copy/generate \
  -H 'Content-Type: application/json' \
  -d '{"cat_name":"咪咪","platform":"moments"}'
```

**动手**：把一个 `chunk` 从 `chain.astream` 追到页面上一张卡片，写出 Queue、`_sse`、`parseSSEFrame`、`setResults` 各做什么。再解释为什么开始流式响应后，模型失败可能表现为 SSE `error`，而不是改写已发送的 HTTP 状态码。

**过关标准**：能解释任务、Queue、SSE 帧、浏览器缓冲区和取消信号之间的关系。

## 6. 聊天与 RAG：先分流，再检索，再回答

按顺序读 `frontend/components/chat/chat-workspace.tsx` → `frontend/lib/api.ts` 的 `sendChatMessage` → `backend/routers/chat.py` → `backend/services/chat.py` → `backend/services/knowledge.py` → `backend/repositories/knowledge.py`。

```python
medical = is_medical(req.message)
if medical:
    docs = search(req.message)
    context = "\n".join(f"[{d.title}] {d.content}" for d in docs)
    if not context:
        context = "知识库暂无该问题资料,回答基于通用常识。"
    messages = [SystemMessage(content=MEDICAL_SYSTEM.format(context=context)), HumanMessage(content=req.message)]
else:
    messages = [SystemMessage(content=CHAT_SYSTEM), HumanMessage(content=req.message)]
```

本项目的 RAG 是一条**条件路径**：`is_medical` 通过固定关键词判断，命中后才调用 `search`。查询文本由本地 `BAAI/bge-small-zh-v1.5` 算向量；Repository 用 pgvector 余弦距离过滤（当前阈值 `<= 0.55`）、排序、取最多 3 篇，再把文档文本塞进 SystemMessage。模型通过 `astream` 流式回答，医疗路径在末尾额外发送 `disclaimer`，再发送 `done`。

边界要特别记住：

1. “换粮怎么过渡？”虽然与知识库营养文档相关，但当前关键词表不含“换粮”，所以走普通闲聊；“猫瘟早期有什么症状？”含“猫瘟”，会走医疗检索。分类仅看字面命中，不能理解为可靠的意图识别。
2. 向量搜索返回空列表是**有效的无结果**，不会触发关键词降级；只有 embedding 模型不可用或向量路径抛异常时，才对 `data/knowledge.py` 的静态种子资料做关键词搜索。因此数据库新增文档不会自动进入这个降级资料集。
3. `ChatRequest` 只包含本次 `message`，前端虽然展示历史消息，但没有把历史传给后端；当前是单轮回答界面，不具备会话记忆。
4. `search()` 是同步函数，包含本地 embedding 和同步数据库查询，却被异步 `stream_chat` 直接调用；这是之后做并发压测时要检查的阻塞点。
5. 检索文本被放入 Prompt，模型仍可能产生错误内容。当前医疗免责声明不是医学可靠性的证明；知识文档也没有在回答中附可核验的来源引用。

**动手**：对上述两个示例问题，先不运行就预测是否检索、是否出现免责声明。再画出“知识文档导入并生成 embedding”与“用户问题生成 embedding 后检索”两条方向相反的流程。若要实际验证，注意真实聊天请求会调用模型。

**过关标准**：能区分 embedding、向量检索、Prompt 组装和生成；能解释“检索失败”“无匹配结果”“模型回答失败”的不同出口。

## 7. 再看前端边界与尚未打通的功能

`frontend/app/page.tsx` 是服务端页面：`Promise.all([getDailyCat(), getCats()])` 并发获取数据，然后传给组件。`frontend/app/copywriting/page.tsx` 同样先在服务端获取猫咪列表，再把它交给客户端 `CopyWorkspace`。相对地，`ChatWorkspace` 和 `CopyWorkspace` 的用户点击与 SSE 流在浏览器中处理。猫咪画廊的即时搜索在已获取的列表上由客户端筛选，不会每输入一个字就请求后端。`frontend/lib/api.ts` 的普通 GET 使用 `cache: 'no-store'`；这与浏览器里 `fetch` 读取 SSE 是两种不同的数据路径。

表情包功能也要分清：`frontend/app/meme-studio/page.tsx` 使用 `FabricBridge` 在浏览器本地编辑和导出 PNG；`backend/routers/meme.py` 的 `/api/meme/overlay` 当前通过 `RuleBasedProvider` 只返回文字叠加方案，而且忽略图片内容。现在的工作室没有调用该后端接口，**“已有表情包工作室”不等于“多模态表情包生成已接通”**。

**动手**：给以下动作标注运行位置：打开首页、搜索猫咪、生成文案、聊天、导出 PNG。为每个动作回答“是否经过 FastAPI、是否调用模型、是否写数据库”。

**过关标准**：能解释为什么页面上看起来都是一个产品，但部分能力只发生在浏览器，部分能力依赖数据库或 DeepSeek。

## 8. 学完以后，按证据推进下一轮迭代

下面是**建议的迭代顺序**，不是说这些功能已经实现。每次只选一个切口：先记录现状与失败样例，再改动，再用同一组样例复测。生产发布前的安全边界优先于体验扩展。

| 优先级 | 当前代码给出的证据 | 可做的最小迭代 | 验收方式 |
| --- | --- | --- | --- |
| P0：接口边界 | `/api/cats`、`/api/knowledge-docs` 有写接口，但未见鉴权依赖；模型接口也没有额度/限流控制 | 发布前先确定管理者身份、权限和调用额度；为拒绝路径补 API 测试 | 未授权写入被拒绝，合法管理操作仍可用；超额请求可观测 |
| P0：数据演进 | 启动用 `SQLModel.metadata.create_all()`，没有迁移流程 | 设计迁移、备份与回滚，再做首次真实 schema 变更 | 在非生产库从旧表升级且数据保持一致，可回滚 |
| P1：正确性测试 | 目前自动测试主要覆盖 `scripts.seed_db` 的部分行为 | 先为 422/404、缓存优先级、SSE 事件顺序、RAG 空结果/异常降级补稳定测试 | 测试不依赖真实 DeepSeek；失败场景能复现且结果确定 |
| P1：异步与取消 | 异步路由里有同步数据库/embedding；三链流在退出时取消任务，但没有完整的清理与耗时度量 | 记录 p50/p95 耗时与并发下阻塞；针对测得热点调整执行边界和取消清理 | 并发实验显示延迟改善，断连后没有遗留任务 |
| P1：RAG 质量 | 医疗分流靠关键词；向量搜索 `top_k=3`、阈值 0.55；降级库是静态种子 | 收集匿名化问题集，标注应检索文档，评测路由召回、检索命中和回答准确性；再调阈值/分流 | 固定评测集上指标改善，并记录误检、漏检样例 |
| P2：产品体验 | 聊天只传单条消息；SSE 前端有简化帧解析；工作室未接入 `/api/meme/overlay` | 根据实际需求选择会话记忆、稳健 SSE 解析或表情包联动中的一项 | 对应端到端用例能重现，网络中断/重试有明确信号 |

推荐第一项**学习型小改动**：为 `is_medical`、`CatScores` 输入边界或 SSE 帧解析写一个小而稳定的测试。它们不需真实数据库或模型，能练习“先预测与复现，再修改”。随后做一次“文案流里某风格报错”的模拟，观察前端如何处理已经收到的其他风格文本。

## 完成后的自测

不用打开代码，尝试在纸上回答：

1. 后端启动时报数据库错误，为什么 `GET /` 也不可用？
2. `GET /api/cats/ragdoll` 的 `CatBreed` 是数据库表模型、Pydantic 响应模型，还是两者？
3. `Depends(get_session)` 的 `yield` 和 `lifespan` 的 `yield` 分别控制什么生命周期？
4. 为什么从 `data/cats.py` 删除一条记录，刷新页面后它可能还在？
5. 雷达分第一次生成和缓存命中各经过哪些步骤？
6. 三条文案流为什么能交错到达，前端如何知道哪张卡片该更新？
7. 模型已经开始 SSE 输出后出错，浏览器如何得知？
8. “换粮怎么过渡？”为什么可能没读知识库？向量结果为空会怎样？
9. 前端显示多条聊天消息，为什么模型仍可能不知道前文？
10. 表情包工作室的 PNG 导出是否经过 `/api/meme/overlay`？

如果某题解释不清，回到对应站，只重走那一条链路。能从浏览器动作一路讲到数据/模型，再从响应讲回页面，就已经具备独立排查与迭代这个项目的基础。
