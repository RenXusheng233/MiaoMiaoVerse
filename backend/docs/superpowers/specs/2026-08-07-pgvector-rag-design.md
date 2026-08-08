# pgvector RAG 迁移设计文档

> 将 3.5 知识库检索从 InMemoryVectorStore 迁移到 PostgreSQL pgvector,并补齐知识文档管理接口。

## 背景

现状:3.5 问答模块的知识检索使用 LangChain `InMemoryVectorStore` + 本地 embedding(bge-small-zh-v1.5,512 维),18 篇知识文档硬编码于 `data/knowledge.py`;每次进程启动重建内存向量库,冷启动加载模型约 10 秒。

前置条件(已完成验证):
- PostgreSQL 18.4(Docker,端口 5433)已安装 **pgvector 扩展 0.8.6**(`CREATE EXTENSION vector` 已执行,vector 类型/插入/距离查询实测可用)
- 品种模块已接入 PostgreSQL(SQLModel),本迁移沿用其架构模式

## 核心决策

| 决策 | 选择 |
| --- | --- |
| 表结构 | 单表 `knowledge_docs`(id/category/title/content + embedding vector(512),可空) |
| 检索实现 | 手写 SQL 余弦距离(`embedding <=> :query`)+ `pgvector` 的 Vector 类型 |
| 查询入口 | `services/knowledge.py::search()` 签名不变 → chat 路由零改动 |
| 距离度量 | 余弦距离 `<=>`(与 InMemoryVectorStore 的 cosine 相似度语义一致) |
| 阈值 | `max_dist = 1 - 0.45 = 0.55` 起步,实现时用既有测试查询实测校准 |
| 降级 | embedding 失败 / DB 异常 → 关键词检索(保留);零结果是有效答案(向量路径成功即权威返回,不降级) |
| 文档管理 | 完整 CRUD:`GET/POST/PUT/DELETE /api/knowledge-docs`(新增/更新自动计算 embedding) |
| 种子模式 | 与品种模块一致:`data/knowledge.py` = seed-only;`seed_db.py` 扩展 `--sync`/`--reset` 双表管理 |

## 文件结构

```
backend/
├── models/knowledge.py         # KnowledgeDocRow(SQLModel 表模型,embedding Vector(512))
├── repositories/knowledge.py   # CRUD + search(原生 SQL 余弦距离)
├── services/knowledge.py       # search() 改为:查询向量实时算 → repository.search;降级保留
├── schemas/knowledge_manage.py # KnowledgeDocCreate / KnowledgeDocUpdate
├── routers/knowledge_docs.py   # GET/POST/PUT/DELETE /api/knowledge-docs
├── db.py                       # init_db 扩展:_seed_knowledge_if_empty(空表导入 + 预计算 embedding)
├── scripts/seed_db.py          # 扩展支持 knowledge_docs(--sync/--reset)
└── data/knowledge.py           # 降级为种子基准文件(seed-only,运行时不再 import)
```

## 表模型(`models/knowledge.py`)

```python
class KnowledgeDocRow(SQLModel, table=True):
    __tablename__ = "knowledge_docs"

    id: str = Field(primary_key=True)          # 与 data/knowledge.py 的 id 一致
    category: str                              # 护理 / 营养 / 疾病
    title: str
    content: str
    embedding: list[float] | None = Field(default=None, sa_column=Column(Vector(512)))
```

- `embedding` 可空:embedding 计算失败时文档仍可入库(NULL),检索自动降级关键词
- 512 维与 bge-small-zh-v1.5 实测输出一致(pgvector 列维度在 DDL 时固定,换模型需重建列)

## Repository(`repositories/knowledge.py`)

```python
def list_docs(session, category=None) -> list[KnowledgeDoc]
def get_doc(session, doc_id) -> KnowledgeDoc | None
def create_doc(session, data, embedding) -> KnowledgeDoc
def update_doc(session, doc_id, data, embedding) -> KnowledgeDoc | None
def delete_doc(session, doc_id) -> bool
def search(session, query_embedding: list[float], top_k=3, max_dist=0.55) -> list[KnowledgeDoc]
    # SELECT ... FROM knowledge_docs
    # WHERE embedding IS NOT NULL AND embedding <=> :q <= :max_dist
    # ORDER BY embedding <=> :q LIMIT :top_k
```

- CRUD 的 embedding 由服务/路由层算好传入(repository 不做模型调用,保持数据层纯净)

## 检索服务(`services/knowledge.py` 改造)

```python
def search(query: str, top_k: int = 3) -> list[KnowledgeDoc]:
    # 1) 本地 embedder 实时计算查询向量(<1 秒,复用单例)
    # 2) repository.search(session, query_embedding, top_k)
    # 3) 失败降级:embedder 失败 / DB 异常 / 零结果 → 关键词检索
```

- 对外签名不变,chat 路由零改动;`_get_embedder` 保留(查询向量实时计算)

## 管理接口(`routers/knowledge_docs.py`)

```python
class KnowledgeDocCreate(BaseModel):
    id: str = Field(min_length=1, max_length=50, pattern=r"^[a-z0-9_]+$")
    category: Literal["护理", "营养", "疾病"]
    title: str = Field(min_length=1, max_length=100)
    content: str = Field(min_length=10, max_length=2000)

class KnowledgeDocUpdate(KnowledgeDocCreate): ...   # 同字段,全量更新
```

| 端点 | 行为 |
| --- | --- |
| `GET /api/knowledge-docs?category=` | 文档列表(管理用途) |
| `GET /api/knowledge-docs/{id}` | 单文档详情;不存在 → 404 |
| `POST /api/knowledge-docs` | 新增:计算 embedding 入库;id 重复 → 409;embedding 失败 → 502 不入库 |
| `PUT /api/knowledge-docs/{id}` | 全量更新:内容变化 → 重新计算 embedding;不存在 → 404;embedding 失败 → 502 |
| `DELETE /api/knowledge-docs/{id}` | 删除;不存在 → 404 |

## 种子模式(`data/knowledge.py` + `scripts/seed_db.py`)

`data/knowledge.py` 降级为种子基准文件(seed-only,顶部注释声明;运行时模块不 import 它)。

| 操作 | knowledge_docs 语义 |
| --- | --- |
| 首次启动(表空) | 导入 18 篇 + 预计算 embedding(约 10-20 秒,仅一次);embedding 失败 → 文档照常入库(NULL) |
| `--sync` | 文件中的文档若 DB 存在 → 更新 title/category/content **并重新计算 embedding**;不存在 → 跳过提示;不删除文件外的行、不复活已删文档 |
| `--reset` | 清空重建(接口新增文档丢弃,回文件基线) |
| 管理接口 | 行的增删改正规途径 |

**与品种模块的行为差异**:knowledge 的 `--sync` 更新内容时强制重算 embedding(embedding 是内容的纯派生);品种 sync 不动 ai_scores(那是 LLM 生成数据,与文件内容无派生关系)。此为有意设计。

## 错误处理

| 场景 | 处理 |
| --- | --- |
| pgvector 扩展缺失 | create_all 建表失败 → 启动即失败,日志提示 `CREATE EXTENSION vector` |
| embedding 模型加载失败 | seed 照常导入(NULL);检索降级关键词;管理接口创建 → 502 |
| 检索时 DB 异常 | 降级关键词检索,服务不中断(chat 错误契约不变) |
| id 重复 / 文档不存在 | 409 / 404 |
| 零结果 | 返回空列表(chat 已有"知识库暂无资料"标注,不变) |

## 验证方式

| 步骤 | 验证 |
| --- | --- |
| 1. 依赖 + 建表 | `uv add pgvector`;启动 → psql `\d knowledge_docs` 显示 embedding vector(512) |
| 2. seed + embedding | 首次启动:18 篇入库且 embedding 全部非空 |
| 3. 检索回归 | `search("猫咪呕吐带血怎么办")` Top1=vomiting;`search("猫瘟")` Top1=panleukopenia;换粮 → diet_transition;生僻问题 → 0 条 |
| 4. 阈值校准 | 用既有测试查询实测 pgvector 余弦距离分布,确认 0.55 阈值区间干净;必要时调整 |
| 5. chat 端到端 | 医疗问题 → 回答引用知识 + disclaimer 事件;闲聊 → 无 disclaimer |
| 6. 文档 CRUD | POST 201 / 重复 409 / PUT 内容变更 → embedding 更新(psql 对比)/ DELETE 204 / 404 |
| 7. seed 脚本 | `--sync`:改文件内容 → 更新且 embedding 重算;删文档 → 不复活;接口新增 → 保留;`--reset` → 回 18 篇基线 |
| 8. 降级路径 | 模拟 embedder 失败 → 关键词检索仍工作,chat 医疗流不中断 |
| 9. 幂等 | 重启 → 不重复导入 |

## 迁移收益

- 检索进程无关(多 worker 共享),重启不重建向量库
- chat 首次医疗提问冷启动从 ~10 秒降为 <1 秒(仅查询向量实时计算)
- 知识库可通过接口持续扩充,embedding 自动维护
