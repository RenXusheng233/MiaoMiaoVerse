# MiaoMiaoVerse Backend

面向猫奴的 AI 全栈娱乐平台后端服务:猫咪百科、AI 文案、表情包、疗愈问答。

## 技术栈

| 层       | 技术                                                                                  |
| -------- | ------------------------------------------------------------------------------------- |
| 框架     | FastAPI 0.139 · Uvicorn · Python 3.14                                                 |
| ORM      | SQLModel · PostgreSQL 18(Docker)· pgvector(向量检索)                                  |
| AI       | LangChain · DeepSeek(`deepseek:deepseek-v4-flash`)· bge-small-zh-v1.5(本地 embedding) |
| 依赖管理 | uv(声明式,`uv add` / `uv sync`)                                                       |

## 快速开始

### 1. 环境准备

```bash
# 安装依赖(按 uv.lock 精确还原)
uv sync

# 配置 .env(后端根目录,gitignored)
# DEEPSEEK_API_KEY=...
# DEEPSEEK_BASE_URL=...
# DATABASE_URL="postgresql://user:pass@localhost:5433/cats?schema=public"
```

### 2. 启动数据库(Docker)

```bash
docker run -d --name postgres-miaomiao-db \
  -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=<密码> -e POSTGRES_DB=cats \
  -e PGDATA=/var/lib/postgresql/18/main \
  -p 5433:5432 \
  -d pgvector/pgvector:0.8.6-pg18-trixie
# pgvector 扩展(容器内执行一次)
docker exec postgres-miaomiao-db psql -U admin -d cats -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 3. 启动服务

```bash
source .venv/bin/activate
uvicorn main:app --reload        # → http://localhost:8000
```

- 接口文档(Swagger):http://localhost:8000/docs
- **启动时自动**:建表(`create_all`)+ 空表导入种子数据(cat_breeds 11 品种 + knowledge_docs 18 篇,含预计算 embedding)

## 常用命令速查

> 所有命令在 `backend/` 目录下执行。

### 数据管理(最常用)

```bash
# 同步种子文件 → 数据库(默认 --sync,推荐日常使用)
#   · 表空 → 全量导入
#   · 表非空 → 只更新"文件里已有品种/文档"的资料(image_url、scores、knowledge 内容等)
#   · 绝不插入文件外的新数据、绝不复活已删除的行、绝不删除接口新增的数据
uv run python -m scripts.seed_db

# 重置数据库(清空 cat_breeds + knowledge_docs 后按种子文件重建)
#   ⚠️ 丢弃所有通过接口新增/修改的数据,回到文件基线
uv run python -m scripts.seed_db --reset
```

**日常工作流**:改 `data/cats.py` 或 `data/knowledge.py` 里的种子数据 → 跑 `uv run python -m scripts.seed_db` 同步到数据库 → 前端刷新即生效。

### AI 雷达分

```bash
# 为全部品种批量生成/刷新五维雷达分(写 ai_scores 列)
uv run python -m scripts.generate_radar
# 只生成单个品种 / 强制重新生成(跳过缓存)
uv run python -m scripts.generate_radar --cat ragdoll
uv run python -m scripts.generate_radar --cat ragdoll --force
```

### 数据库直查(Docker)

```bash
PGUSER=$(sed -n 's|.*://\([^:]*\):.*|\1|p' .env | head -1)
docker exec postgres-miaomiao-db psql -U $PGUSER -d cats -c "SELECT id, name_zh FROM cat_breeds;"
```

### 依赖管理

```bash
uv add <pkg>      # 声明式安装(更新 pyproject.toml + uv.lock)
uv sync           # 按锁文件还原环境
```

## API 概览

| 模块     | 端点                                                              | 说明                                                         |
| -------- | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| 首页     | `GET /api/daily-cat`                                              | 今日明星猫(同日确定)                                         |
|          | `GET /api/daily-cat/random?exclude_id=`                           | 随机换一只                                                   |
| 猫咪百科 | `GET /api/cats`                                                   | 列表,筛选 `q` / `size` / `coat` / `owner`(中文值需 URL 编码) |
|          | `GET /api/cats/{id}`                                              | 详情(ai_scores 优先)                                         |
|          | `POST /api/cats` / `PUT /api/cats/{id}` / `DELETE /api/cats/{id}` | 品种管理 CRUD(409 重复 / 404 不存在)                         |
|          | `POST /api/cats/{id}/radar-scores?force=`                         | LLM 生成雷达分(缓存命中 `source="cached"`)                   |
| 文案生成 | `POST /api/copy/generate`                                         | 三版并行生成(SSE:chunk/done/error)                           |
|          | `POST /api/copy/regenerate`                                       | 单版重新生成(SSE)                                            |
| 表情包   | `POST /api/meme/overlay`                                          | 文字叠加方案(multipart:image 或 image_url + text + emotion)  |
| 疗愈问答 | `POST /api/chat`                                                  | 双路由 SSE(闲聊 / 医疗 RAG + disclaimer 事件)                |
| 知识库   | `GET /api/knowledge-docs?category=`                               | 文档列表                                                     |
|          | `GET/POST/PUT/DELETE /api/knowledge-docs(/id)`                    | 文档管理(新增/更新自动计算 embedding)                        |

## 项目结构

```
backend/
├── main.py                 # FastAPI 入口(lifespan 启动建表 + 种子)
├── db.py                   # 数据库 engine / session 依赖 / init_db
├── models/                 # SQLModel 表模型(cat_breeds / knowledge_docs)
├── repositories/           # 数据访问层(行 ↔ 响应模型转换)
├── schemas/                # Pydantic 请求/响应模型
├── routers/                # API 路由(cats / daily_cat / copy / meme / chat / knowledge_docs)
├── services/               # 业务逻辑(雷达分生成 / 文案流 / 表情包 provider / 检索)
├── scripts/                # 命令行工具(seed_db / generate_radar)
├── data/                   # 种子基准文件(seed-only:cats.py / knowledge.py)
└── docs/superpowers/       # 各模块设计文档(specs)与实现计划(plans)
```

## 数据权威模型

- **数据库是唯一权威**:运行时一切读写走 PostgreSQL;`data/` 下文件是种子基准(仅首次导入与 sync/reset 时读取)
- **增删改品种/文档的正规途径是管理接口**(`POST/PUT/DELETE`),不是改文件
- 雷达分(`ai_scores`)由 `POST /api/cats/{id}/radar-scores` 或 `generate_radar.py` 管理
- 检索阈值:pgvector 余弦距离 0.55(与 bge-small-zh 512 维匹配)

## 文档索引

各功能模块的设计与实现记录见 `docs/superpowers/specs/`(设计)与 `docs/superpowers/plans/`(计划),按模块命名(如 `2026-08-07-pgvector-rag-design.md`)。
