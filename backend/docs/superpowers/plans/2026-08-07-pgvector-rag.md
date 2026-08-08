# pgvector RAG 迁移实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 3.5 知识库检索从 InMemoryVectorStore 迁移到 pgvector,补齐知识文档管理接口与双表种子脚本。

**Architecture:** `knowledge_docs` 表(id/category/title/content + embedding vector(512),可空);repository 用 pgvector 余弦距离(`embedding <=> :q`);`services/knowledge.py::search()` 签名不变(查询向量实时算 + 关键词降级),chat 路由零改动;文档 CRUD 自动计算/重算 embedding;`data/knowledge.py` 降级为种子基准文件,`seed_db.py` 双表管理。

**Tech Stack:** FastAPI · SQLModel · pgvector · pgvector 0.8.6(已验证)· bge-small-zh-v1.5 · PostgreSQL 18.4

**Spec:** `backend/docs/superpowers/specs/2026-08-07-pgvector-rag-design.md`

## Global Constraints

- 全部代码在 `backend/` 下,命令从 `backend/` 运行(先 `source .venv/bin/activate`)
- 新增依赖一律 `uv add <pkg>`(声明式);`.env` 只读不写
- 项目暂无测试框架:每个任务用验证脚本 + curl + psql(docker exec)验证
- 项目初期:实现者**不执行** `git add` / `git commit`(用户手动提交)
- 代码注释用英文;用户可见文本(错误 detail、提示)用中文
- 检索距离度量:余弦距离 `<=>`;阈值 `max_dist = 0.55` 起步,实测校准
- `services/knowledge.py::search(query, top_k=3) -> list[KnowledgeDoc]` 对外签名不变
- 降级路径保留:embedding 失败 / DB 异常 / 零结果 → 关键词检索
- `data/knowledge.py` = seed-only(运行时路由/services 不 import 它;db.py seed 与 scripts 例外)
- knowledge `--sync` 更新内容时必须重算 embedding(与品种 sync 不动 ai_scores 的差异是有意设计)
- psql 命令:`docker exec postgres-miaomiao-db psql -U $PGUSER -d cats -t -c "..."`,PGUSER 用 `sed -n 's|.*://\([^:]*\):.*|\1|p' .env | head -1`(macOS 无 grep -oP)

---

### Task 1: 依赖 + 表模型 + db 扩展 + seed

**Files:**
- Create: `backend/models/knowledge.py`
- Modify: `backend/db.py`(import 注册表 + `_seed_knowledge_if_empty` + init_db 调用)

**Interfaces:**
- Produces: `models.knowledge.KnowledgeDocRow`(表模型,embedding Vector(512) 可空)、`db.init_db()` 扩展(空表导入 18 篇 + 预计算 embedding)— 供 Task 2-5 使用

- [ ] **Step 1: 安装依赖**

Run: `cd /Users/renxusheng/Documents/AI/MiaoMiaoVerse/backend && source .venv/bin/activate && uv add pgvector`
Expected: 成功;`grep pgvector pyproject.toml` 有命中

- [ ] **Step 2: 创建表模型**

```python
# backend/models/knowledge.py
"""SQLModel table model for the RAG knowledge base. Embedding is a pgvector
column; NULL means the embedding failed and retrieval degrades to keywords."""

from pgvector.sqlalchemy import Vector
from sqlmodel import Column, Field, SQLModel


class KnowledgeDocRow(SQLModel, table=True):
    __tablename__ = "knowledge_docs"

    id: str = Field(primary_key=True)          # same ids as data/knowledge.py
    category: str                              # 护理 / 营养 / 疾病
    title: str
    content: str
    embedding: list[float] | None = Field(default=None, sa_column=Column(Vector(512)))
```

- [ ] **Step 3: db.py 扩展**

修改 `backend/db.py`:

```python
from models.cat import CatBreedRow
from models.knowledge import KnowledgeDocRow
```

在 `_seed_if_empty` 之后新增:

```python
def _seed_knowledge_if_empty() -> None:
    """Import the 18 knowledge docs (with precomputed embeddings) when empty."""
    from data.knowledge import KNOWLEDGE_DOCS
    from services.knowledge import _get_embedder

    with Session(engine) as session:
        if session.exec(select(KnowledgeDocRow)).first() is not None:
            return
        docs = list(KNOWLEDGE_DOCS)
        embeddings: list[list[float]] | None = None
        embedder = _get_embedder()
        if embedder is not None:
            try:
                embeddings = embedder.embed_documents([d.content for d in docs])
            except Exception:
                embeddings = None  # docs still imported with NULL embedding
        for doc, emb in zip(docs, embeddings or [None] * len(docs)):
            session.add(
                KnowledgeDocRow(
                    id=doc.id,
                    category=doc.category,
                    title=doc.title,
                    content=doc.content,
                    embedding=emb,
                )
            )
        session.commit()
```

在 `init_db` 末尾追加调用:

```python
def init_db() -> None:
    """Create tables (idempotent), then seed when empty. Called at app startup."""
    SQLModel.metadata.create_all(engine)
    _seed_if_empty()
    _seed_knowledge_if_empty()
```

- [ ] **Step 4: 验证建表 + seed + embedding**

Run: `source .venv/bin/activate && python -c "
from db import init_db
init_db()
from sqlmodel import Session, select
from models.knowledge import KnowledgeDocRow
with Session(engine) as s:
    rows = s.exec(select(KnowledgeDocRow).order_by(KnowledgeDocRow.id)).all()
    print('docs:', len(rows))
    embedded = [r for r in rows if r.embedding is not None]
    print('embedded:', len(embedded))
    assert len(rows) == 18, f'expect 18 docs, got {len(rows)}'
    assert len(embedded) == 18, f'expect 18 embeddings, got {len(embedded)}'
    r = rows[0]
    print('sample:', r.id, r.category, 'emb dim:', len(r.embedding))
    assert len(r.embedding) == 512
print('knowledge seed OK')
"`
Expected: docs: 18、embedded: 18、sample 显示维度 512、`knowledge seed OK`(首次运行含模型加载与 18 篇向量计算,约 10-30 秒)

- [ ] **Step 5: psql 交叉验证**

Run: `PGUSER=$(sed -n 's|.*://\([^:]*\):.*|\1|p' .env | head -1) && docker exec postgres-miaomiao-db psql -U $PGUSER -d cats -c "\d knowledge_docs" 2>&1 | head -12`
Expected: 表结构显示 id/category/title/content/embedding vector(512)

- [ ] **Step 6: 结束任务验证**

```bash
git status --short
```
Expected: 新增 models/knowledge.py,修改 db.py、pyproject.toml、uv.lock(不提交)

---

### Task 2: Repository + 检索服务改造

**Files:**
- Create: `backend/repositories/__init__.py`(已存在则跳过),`backend/repositories/knowledge.py`
- Modify: `backend/services/knowledge.py`(检索改为 DB + 查询向量实时算;保留降级)

**Interfaces:**
- Consumes: Task 1 的 `KnowledgeDocRow`, `db.engine`;`data.knowledge.KnowledgeDoc`(领域类型)
- Produces: `repositories.knowledge.list_docs/get_doc/create_doc/update_doc/delete_doc/search` — 供 Task 3/4/5 使用

- [ ] **Step 1: 创建 repository**

```python
# backend/repositories/knowledge.py
"""Data access for the RAG knowledge base. Embeddings are computed by the
service/router layer and passed in — this layer stays model-free."""

from sqlmodel import Session, select

from data.knowledge import KnowledgeDoc
from models.knowledge import KnowledgeDocRow

_MAX_DIST = 0.55  # cosine distance floor; 1 - 0.45 similarity (calibrated on the corpus)


def _to_domain(row: KnowledgeDocRow) -> KnowledgeDoc:
    return KnowledgeDoc(id=row.id, category=row.category, title=row.title, content=row.content)


def list_docs(session: Session, category: str | None = None) -> list[KnowledgeDoc]:
    stmt = select(KnowledgeDocRow)
    if category:
        stmt = stmt.where(KnowledgeDocRow.category == category)
    return [_to_domain(r) for r in session.exec(stmt.order_by(KnowledgeDocRow.id)).all()]


def get_doc(session: Session, doc_id: str) -> KnowledgeDoc | None:
    row = session.get(KnowledgeDocRow, doc_id)
    return _to_domain(row) if row else None


def create_doc(session: Session, data, embedding: list[float] | None) -> KnowledgeDoc:
    row = KnowledgeDocRow(
        id=data.id, category=data.category, title=data.title,
        content=data.content, embedding=embedding,
    )
    session.add(row)
    session.commit()
    return _to_domain(row)


def update_doc(session: Session, doc_id: str, data, embedding: list[float] | None) -> KnowledgeDoc | None:
    row = session.get(KnowledgeDocRow, doc_id)
    if not row:
        return None
    row.category = data.category
    row.title = data.title
    row.content = data.content
    row.embedding = embedding  # content changed -> embedding must be recomputed
    session.add(row)
    session.commit()
    return _to_domain(row)


def delete_doc(session: Session, doc_id: str) -> bool:
    row = session.get(KnowledgeDocRow, doc_id)
    if not row:
        return False
    session.delete(row)
    session.commit()
    return True


def search(
    session: Session,
    query_embedding: list[float],
    top_k: int = 3,
    max_dist: float = _MAX_DIST,
) -> list[KnowledgeDoc]:
    """Cosine-distance search; embeddings NULL or beyond max_dist are excluded."""
    from pgvector.sqlalchemy import Vector

    q = str(query_embedding)  # pgvector accepts '[0.1, 0.2, ...]' text form
    stmt = (
        select(KnowledgeDocRow)
        .where(KnowledgeDocRow.embedding.is_not(None))
        .where(KnowledgeDocRow.embedding.cosine_distance(q) <= max_dist)
        .order_by(KnowledgeDocRow.embedding.cosine_distance(q))
        .limit(top_k)
    )
    return [_to_domain(r) for r in session.exec(stmt).all()]
```

> 注:`cosine_distance` 来自 pgvector.sqlalchemy 的 Vector 类型方法,生成 `embedding <=> :q`;若绑定 list 类型报错,用 `str(query_embedding)`(文本形式 pgvector 原生支持)。

- [ ] **Step 2: 改造检索服务**

重写 `backend/services/knowledge.py`(保留 `_EMBEDDING_MODEL`、`_DEFAULT_TOP_K`、`_lock`、`_get_embedder`、`_keyword_search`;删除 `_get_store`、`_doc_from_metadata` 与 InMemoryVectorStore 逻辑):

```python
# backend/services/knowledge.py
"""Knowledge base retrieval: pgvector search with keyword fallback.

Query embeddings are computed live by the local model (document embeddings
are precomputed and stored in PostgreSQL). search() is the stable seam —
chat routes depend only on this signature.
"""

import threading

from sqlmodel import Session

from data.knowledge import KNOWLEDGE_DOCS, KnowledgeDoc
from db import engine
from repositories import knowledge as repo

_EMBEDDING_MODEL = "BAAI/bge-small-zh-v1.5"
_DEFAULT_TOP_K = 3
_MAX_DIST = 0.55  # cosine distance; 1 - 0.45 similarity floor

_lock = threading.Lock()
_embedder = None
_embedding_failed = False


def _get_embedder():
    """Lazy-load the local embedding model once (process singleton)."""
    global _embedder, _embedding_failed
    if _embedder is not None or _embedding_failed:
        return _embedder
    with _lock:
        if _embedder is not None or _embedding_failed:
            return _embedder
        try:
            from langchain_community.embeddings import SentenceTransformerEmbeddings
            _embedder = SentenceTransformerEmbeddings(model_name=_EMBEDDING_MODEL)
        except Exception:
            _embedding_failed = True
            _embedder = None
    return _embedder


def search(query: str, top_k: int = _DEFAULT_TOP_K) -> list[KnowledgeDoc]:
    """pgvector cosine search; keyword fallback ONLY when the embedder or
    the vector path fails. An empty vector result is a valid answer
    (nothing in the knowledge base passes the distance floor)."""
    embedder = _get_embedder()
    if embedder is not None:
        try:
            query_vec = embedder.embed_query(query)
            with Session(engine) as session:
                return repo.search(session, query_vec, top_k=top_k, max_dist=_MAX_DIST)
        except Exception:
            pass  # fall through to keyword search
    return _keyword_search(query, top_k)


def _keyword_search(query: str, top_k: int) -> list[KnowledgeDoc]:
    """Fallback: score docs by character hits in title (x2) and content (x1)."""
    scored: list[tuple[int, KnowledgeDoc]] = []
    for doc in KNOWLEDGE_DOCS:
        score = sum(2 if ch in doc.title else 1 if ch in doc.content else 0 for ch in query)
        if score > 0:
            scored.append((score, doc))
    scored.sort(key=lambda x: -x[0])
    return [doc for _, doc in scored[:top_k]]
```

- [ ] **Step 3: 验证检索回归 + 阈值校准**

Run: `source .venv/bin/activate && python -c "
from services.knowledge import search

# 三组真实查询 Top1 必须正确(与内存版一致)
r1 = search('猫咪呕吐带血怎么办')
print('呕吐 query top1:', r1[0].id if r1 else None)
assert r1 and r1[0].id == 'vomiting', r1

r2 = search('猫瘟有什么症状')
print('猫瘟 query top1:', r2[0].id if r2 else None)
assert r2 and r2[0].id == 'panleukopenia', r2

r3 = search('换粮怎么过渡')
print('换粮 query top1:', r3[0].id if r3 else None)
assert r3 and r3[0].id == 'diet_transition', r3

# 生僻问题:0 条(0.55 距离阈值过滤)
r4 = search('完全没有相关内容的生僻问题xyzq')
print('unrelated hits:', len(r4))
assert len(r4) == 0, f'expect 0, got {len(r4)}'
print('pgvector search OK')
"`
Expected: 三个 Top1 正确、生僻 0 条、`pgvector search OK`(首次会加载模型,约 10 秒)

- [ ] **Step 4: 距离分布实测(阈值校准证据)**

Run: `source .venv/bin/activate && python -c "
from langchain_community.embeddings import SentenceTransformerEmbeddings
from sqlmodel import Session, select
from db import engine
from models.knowledge import KnowledgeDocRow
from pgvector.sqlalchemy import Vector

emb = SentenceTransformerEmbeddings(model_name='BAAI/bge-small-zh-v1.5')
queries = {'呕吐': '猫咪呕吐带血怎么办', '猫瘟': '猫瘟有什么症状', '换粮': '换粮怎么过渡', '噪音': '完全没有相关内容的生僻问题xyzq'}
with Session(engine) as s:
    rows = s.exec(select(KnowledgeDocRow).where(KnowledgeDocRow.embedding.is_not(None))).all()
    for name, q in queries.items():
        qv = emb.embed_query(q)
        dists = sorted(r.embedding.cosine_distance(str(qv)) for r in rows)
        print(f'{name}: top3 dists = {[round(d, 3) for d in dists[:3]]}')
"`
Expected: 真实查询 top1 距离明显 < 0.55(约 0.2-0.3),噪音查询 top1 距离 > 0.55(约 0.62);若噪音查询有 < 0.55 的命中,需调低 `_MAX_DIST` 并同步 repository 与 services 两处常量(记录实测值)

- [ ] **Step 5: 结束任务验证**

```bash
git status --short
```
Expected: 新增 repositories/knowledge.py,修改 services/knowledge.py(不提交)

---

### Task 3: 知识文档管理接口

**Files:**
- Create: `backend/schemas/knowledge_manage.py`
- Create: `backend/routers/knowledge_docs.py`
- Modify: `backend/main.py`(注册 router)

**Interfaces:**
- Consumes: Task 2 的 `repositories.knowledge` CRUD 函数;`services.knowledge._get_embedder`
- Produces: `GET/POST/PUT/DELETE /api/knowledge-docs`(embedding 自动计算/重算)

- [ ] **Step 1: 创建管理 schema**

```python
# backend/schemas/knowledge_manage.py
from typing import Literal

from pydantic import BaseModel, Field


class KnowledgeDocCreate(BaseModel):
    id: str = Field(min_length=1, max_length=50, pattern=r"^[a-z0-9_]+$")
    category: Literal["护理", "营养", "疾病"]
    title: str = Field(min_length=1, max_length=100)
    content: str = Field(min_length=10, max_length=2000)


class KnowledgeDocUpdate(KnowledgeDocCreate):
    """Full update; content changes force an embedding recompute."""
```

- [ ] **Step 2: 创建路由**

```python
# backend/routers/knowledge_docs.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from db import get_session
from repositories import knowledge as repo
from schemas.knowledge_manage import KnowledgeDocCreate, KnowledgeDocUpdate
from services import knowledge as knowledge_service

router = APIRouter(prefix="/api/knowledge-docs", tags=["knowledge-docs"])


def _compute_embedding(content: str) -> list[float]:
    """Embedding is mandatory for managed docs; failure is a 502, doc NOT stored."""
    embedder = knowledge_service._get_embedder()
    if embedder is None:
        raise HTTPException(status_code=502, detail="Embedding 模型不可用,请稍后重试")
    try:
        return embedder.embed_query(content)
    except Exception:
        raise HTTPException(status_code=502, detail="Embedding 计算失败,请稍后重试")


@router.get("")
async def list_docs(category: str | None = Query(None), session: Session = Depends(get_session)):
    return repo.list_docs(session, category=category)


@router.get("/{doc_id}")
async def get_doc(doc_id: str, session: Session = Depends(get_session)):
    doc = repo.get_doc(session, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Knowledge doc '{doc_id}' not found")
    return doc


@router.post("", status_code=201)
def create_doc(data: KnowledgeDocCreate, session: Session = Depends(get_session)):
    """Create a doc; embedding computed and stored atomically with the row."""
    if repo.get_doc(session, data.id) is not None:
        raise HTTPException(status_code=409, detail=f"Knowledge doc '{data.id}' already exists")
    embedding = _compute_embedding(data.content)
    return repo.create_doc(session, data, embedding)


@router.put("/{doc_id}")
def update_doc(doc_id: str, data: KnowledgeDocUpdate, session: Session = Depends(get_session)):
    """Full update; content changes recompute the embedding."""
    if repo.get_doc(session, doc_id) is None:
        raise HTTPException(status_code=404, detail=f"Knowledge doc '{doc_id}' not found")
    embedding = _compute_embedding(data.content)
    return repo.update_doc(session, doc_id, data, embedding)


@router.delete("/{doc_id}", status_code=204)
def delete_doc(doc_id: str, session: Session = Depends(get_session)):
    if not repo.delete_doc(session, doc_id):
        raise HTTPException(status_code=404, detail=f"Knowledge doc '{doc_id}' not found")
```

> 注:路由里 `_compute_embedding` 调用 `services.knowledge._get_embedder`(内部函数,服务内复用);不需要 `schemas.daily_cat` import——若实现时确认未用则删掉该行。

- [ ] **Step 3: main.py 注册**

修改 `backend/main.py`:

```python
from routers import cats, chat, copywriting, daily_cat, knowledge_docs, meme
...
app.include_router(knowledge_docs.router)
```

- [ ] **Step 4: CRUD curl 验证**

Run:
```bash
source .venv/bin/activate
uvicorn main:app --port 8000 > /tmp/kd_uvicorn.log 2>&1 &
sleep 2
# 列表与筛选
curl -s "http://localhost:8000/api/knowledge-docs" | python3 -c "import json,sys; print('docs:', len(json.load(sys.stdin)))"
curl -s "http://localhost:8000/api/knowledge-docs?category=%E7%96%BE%E7%97%85" | python3 -c "import json,sys; print('疾病 docs:', len(json.load(sys.stdin)))"
# 新增(自动 embedding)
curl -s -o /dev/null -w "create: %{http_code}\n" -X POST http://localhost:8000/api/knowledge-docs \
  -H "Content-Type: application/json" \
  -d '{"id":"test_doc","category":"护理","title":"测试文档","content":"这是一篇用于验证管理接口的测试知识文档,内容足够长以通过最小长度校验。"}'
# 重复 → 409
curl -s -o /dev/null -w "duplicate: %{http_code}\n" -X POST http://localhost:8000/api/knowledge-docs \
  -H "Content-Type: application/json" \
  -d '{"id":"test_doc","category":"护理","title":"测试文档","content":"这是一篇用于验证管理接口的测试知识文档,内容足够长以通过最小长度校验。"}'
# 更新内容(embedding 重算)
curl -s -X PUT http://localhost:8000/api/knowledge-docs/test_doc \
  -H "Content-Type: application/json" \
  -d '{"id":"test_doc","category":"护理","title":"测试文档v2","content":"更新后的测试知识文档内容,验证 embedding 会随内容重新计算。"}' | python3 -c "import json,sys; d=json.load(sys.stdin); print('updated:', d['title'])"
# 删除 → 204;再查 → 404
curl -s -o /dev/null -w "delete: %{http_code}\n" -X DELETE http://localhost:8000/api/knowledge-docs/test_doc
curl -s -o /dev/null -w "after delete: %{http_code}\n" http://localhost:8000/api/knowledge-docs/test_doc
kill %1
```
Expected: docs: 18、疾病 docs: 6、create: 201、duplicate: 409、updated 显示新 title、delete: 204、after delete: 404

- [ ] **Step 5: 结束任务验证**

```bash
git status --short
```
Expected: 新增 schemas/knowledge_manage.py、routers/knowledge_docs.py,修改 main.py(不提交)

---

### Task 4: seed 脚本扩展 + data/knowledge.py 降级

**Files:**
- Modify: `backend/scripts/seed_db.py`(支持 knowledge_docs)
- Modify: `backend/data/knowledge.py`(顶部加 seed-only docstring)

**Interfaces:**
- Consumes: Task 1 的 `KnowledgeDocRow`;Task 2 的 `_get_embedder`;`data.knowledge.KNOWLEDGE_DOCS`
- Produces: `seed_db.py --sync/--reset` 双表管理(知识文档 sync 重算 embedding)

- [ ] **Step 1: data/knowledge.py 加 seed-only 注释**

在 `backend/data/knowledge.py` 顶部(imports 之前)加:

```python
"""Seed-only baseline data for the RAG knowledge base.

Used ONLY by db.py's empty-table seed and scripts/seed_db.py. Runtime
modules must retrieve documents through the database instead.
"""
```

- [ ] **Step 2: seed_db.py 扩展**

修改 `backend/scripts/seed_db.py`:import 增加,并在 `_sync`/`_reset` 中处理两张表。新增函数与 main 改造:

```python
from data.knowledge import KNOWLEDGE_DOCS
from models.knowledge import KnowledgeDocRow
from services.knowledge import _get_embedder


def _compute_embeddings(contents: list[str]) -> list[list[float] | None]:
    """Batch-embed; any failure yields None per doc (NULL embedding -> keyword fallback)."""
    embedder = _get_embedder()
    if embedder is None:
        return [None] * len(contents)
    try:
        return embedder.embed_documents(contents)
    except Exception:
        return [None] * len(contents)


def _sync_knowledge(session: Session) -> None:
    rows = {r.id: r for r in session.exec(select(KnowledgeDocRow)).all()}
    if not rows:
        contents = [d.content for d in KNOWLEDGE_DOCS]
        embeddings = _compute_embeddings(contents)
        for doc, emb in zip(KNOWLEDGE_DOCS, embeddings):
            session.add(
                KnowledgeDocRow(
                    id=doc.id, category=doc.category, title=doc.title,
                    content=doc.content, embedding=emb,
                )
            )
        session.commit()
        print(f"Imported {len(KNOWLEDGE_DOCS)} knowledge docs (table was empty).")
        return

    updated = skipped = 0
    contents = [d.content for d in KNOWLEDGE_DOCS]
    embeddings = _compute_embeddings(contents)
    for doc, emb in zip(KNOWLEDGE_DOCS, embeddings):
        row = rows.get(doc.id)
        if row is None:
            print(f"[skip] {doc.id} not in DB — use POST /api/knowledge-docs or --reset to insert")
            skipped += 1
            continue
        row.category = doc.category
        row.title = doc.title
        row.content = doc.content
        row.embedding = emb  # content changed -> embedding recomputed (unlike cat_breeds sync)
        session.add(row)
        updated += 1
    session.commit()
    print(f"Synced {updated} knowledge docs, skipped {skipped} (not in DB).")


def _reset_knowledge(session: Session) -> None:
    for row in session.exec(select(KnowledgeDocRow)).all():
        session.delete(row)
    session.commit()
    contents = [d.content for d in KNOWLEDGE_DOCS]
    embeddings = _compute_embeddings(contents)
    for doc, emb in zip(KNOWLEDGE_DOCS, embeddings):
        session.add(
            KnowledgeDocRow(
                id=doc.id, category=doc.category, title=doc.title,
                content=doc.content, embedding=emb,
            )
        )
    session.commit()
    print(f"Reset: re-imported {len(KNOWLEDGE_DOCS)} knowledge docs from the seed file.")
```

`main()` 中 `--sync` 分支与 `--reset` 分支各自追加调用 `_sync_knowledge(session)` / `_reset_knowledge(session)`(在 cat_breeds 处理之后)。脚本顶部 docstring 更新为"manage cat_breeds and knowledge_docs"。

- [ ] **Step 3: 验证 sync 语义(重算 embedding、不复活、保留接口增量)**

Run:
```bash
source .venv/bin/activate
PGUSER=$(sed -n 's|.*://\([^:]*\):.*|\1|p' .env | head -1)
# 1) 通过接口新增一篇文件里没有的文档(模拟接口增量)
uvicorn main:app --port 8000 > /tmp/sync_uvicorn.log 2>&1 &
sleep 2
curl -s -o /dev/null -w "api create: %{http_code}\n" -X POST http://localhost:8000/api/knowledge-docs \
  -H "Content-Type: application/json" \
  -d '{"id":"api_only_doc","category":"护理","title":"接口文档","content":"这是通过管理接口新增的知识文档,内容足够长以通过最小长度校验。"}'
kill %1
# 2) 直接改 DB 里 vomiting 的 content 为垃圾值 → --sync 应恢复文件内容且 embedding 重算
docker exec postgres-miaomiao-db psql -U $PGUSER -d cats -c "UPDATE knowledge_docs SET content='DB里的垃圾内容', embedding=NULL WHERE id='vomiting';" 2>&1 | head -2
uv run python -m scripts.seed_db
docker exec postgres-miaomiao-db psql -U $PGUSER -d cats -t -c "SELECT left(content, 12) FROM knowledge_docs WHERE id='vomiting';"
docker exec postgres-miaomiao-db psql -U $PGUSER -d cats -t -c "SELECT embedding IS NOT NULL FROM knowledge_docs WHERE id='vomiting';"
# 3) api_only_doc 应保留;删除文件内文档再 sync 不复活
docker exec postgres-miaomiao-db psql -U $PGUSER -d cats -t -c "SELECT count(*) FROM knowledge_docs WHERE id='api_only_doc';"
docker exec postgres-miaomiao-db psql -U $PGUSER -d cats -c "DELETE FROM knowledge_docs WHERE id='heatstroke';" 2>&1 | head -2
uv run python -m scripts.seed_db
docker exec postgres-miaomiao-db psql -U $PGUSER -d cats -t -c "SELECT count(*) FROM knowledge_docs WHERE id='heatstroke';"
```
Expected: api create: 201;vomiting content 恢复为文件原文且 embedding IS NOT NULL=true;api_only_doc count=1(保留);heatstroke count=0(不复活)

- [ ] **Step 4: 验证 reset 语义**

Run:
```bash
uv run python -m scripts.seed_db --reset
PGUSER=$(sed -n 's|.*://\([^:]*\):.*|\1|p' .env | head -1)
docker exec postgres-miaomiao-db psql -U $PGUSER -d cats -t -c "SELECT count(*) FROM knowledge_docs;"
docker exec postgres-miaomiao-db psql -U $PGUSER -d cats -t -c "SELECT count(*) FROM knowledge_docs WHERE id IN ('api_only_doc','heatstroke');"
```
Expected: count=18;api_only_doc 不存在(丢弃接口增量)、heatstroke 恢复(种子品种)——cat_breeds 同步回 12 条基线

- [ ] **Step 5: 结束任务验证**

```bash
git status --short
```
Expected: 修改 scripts/seed_db.py、data/knowledge.py(不提交)

---

### Task 5: 端到端验证

**Files:**
- 无新文件,验证既有行为

**Interfaces:**
- Consumes: Task 1-4 的全部功能

- [ ] **Step 1: chat 端到端回归(真实 LLM)**

Run:
```bash
source .venv/bin/activate
uvicorn main:app --port 8000 > /tmp/e2e_uvicorn.log 2>&1 &
sleep 2
# 医疗:回答 + disclaimer
curl -N -s -X POST http://localhost:8000/api/chat -H "Content-Type: application/json" \
  -d '{"message":"猫瘟早期有什么症状"}' -o /tmp/e2e_medical.txt
grep -c "event: chunk" /tmp/e2e_medical.txt
grep -c "event: disclaimer" /tmp/e2e_medical.txt
grep -c "event: done" /tmp/e2e_medical.txt
# 闲聊:无 disclaimer
curl -N -s -X POST http://localhost:8000/api/chat -H "Content-Type: application/json" \
  -d '{"message":"今天好累啊"}' -o /tmp/e2e_casual.txt
grep -c "event: disclaimer" /tmp/e2e_casual.txt || echo "0 disclaimer (expected)"
kill %1
```
Expected: 医疗 chunk>0、disclaimer=1、done=1;闲聊 disclaimer=0

- [ ] **Step 2: 降级路径验证(不加载模型也能检索)**

Run:
```bash
source .venv/bin/activate && python -c "
from services.knowledge import _get_embedder, search
# 模拟 embedder 加载失败
import services.knowledge as k
k._embedding_failed = True
k._embedder = None
assert _get_embedder() is None
r = search('猫瘟')
print('degraded search top1:', r[0].id if r else None)
assert r and r[0].id == 'panleukopenia'
k._embedding_failed = False
print('degradation OK')
"
```
Expected: `degraded search top1: panleukopenia`、`degradation OK`

- [ ] **Step 3: 重启幂等 + 日志检查**

Run:
```bash
uvicorn main:app --port 8000 > /tmp/e2e_uvicorn2.log 2>&1 &
sleep 2
PGUSER=$(sed -n 's|.*://\([^:]*\):.*|\1|p' .env | head -1)
docker exec postgres-miaomiao-db psql -U $PGUSER -d cats -t -c "SELECT count(*) FROM knowledge_docs;"
grep -icE "error|exception|traceback" /tmp/e2e_uvicorn.log /tmp/e2e_uvicorn2.log || echo "logs clean"
kill %1
```
Expected: count=18(幂等,不重复导入);日志无 error

- [ ] **Step 4: 收尾检查**

Run:
```bash
git status --short
```
Expected: 新增 models/knowledge.py、repositories/knowledge.py、schemas/knowledge_manage.py、routers/knowledge_docs.py,修改 db.py、services/knowledge.py、main.py、scripts/seed_db.py、data/knowledge.py、pyproject.toml、uv.lock,均未提交
