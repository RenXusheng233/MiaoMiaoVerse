# PostgreSQL 接入设计文档(SQLModel)

> 将品种数据与 AI 雷达分从硬编码/JSON 缓存迁移到 PostgreSQL;后续再接入 pgvector(本次不做)。

## 背景

现状(无数据库):品种主数据硬编码于 `data/cats.py`(12 条),AI 雷达分存于 `data/generated_scores.json`(生成值覆盖手工值)。

本次接入 PostgreSQL:
- 用户已在 Docker 运行 postgres:18.4(端口 5433),`.env` 已配置 `DATABASE_URL`
- ORM 选定 **SQLModel**(轻量)
- 建表方式:SQLModel `create_all`(开发期简单,pgvector 接入时表结构变化后再评估 Alembic)
- 向量库 pgvector **后续单独接入**(本次不做)

## 核心决策

| 决策 | 选择 |
| --- | --- |
| 表结构 | 单表 `cat_breeds`:`scores`(手工分)+ `ai_scores`(AI 生成分)双 JSONB 列 |
| 读取语义 | `ai_scores` 非空优先,否则 `scores`(保留"生成值覆盖手工值") |
| 数据源切换 | **完全切 DB**;DB 是唯一权威,不提供内存回退 |
| 管理接口 | 完整 CRUD:`POST /api/cats` + `PUT /api/cats/{id}` + `DELETE /api/cats/{id}` |
| 种子脚本 | `scripts/seed_db.py`:`--sync`(只更新已存在行)/ `--reset`(清空重建) |
| 驱动 | 同步引擎,`uv add sqlmodel psycopg[binary]`;URL 代码内适配 `postgresql+psycopg://` |

## 文件结构

```
backend/
├── db.py                       # engine + get_session 依赖 + init_db(create_all + 空表 seed)
├── models/cat.py               # CatBreedRow:SQLModel 表模型
├── repositories/cats.py        # 数据访问层(返回响应模型,含合并语义)
├── schemas/cat_manage.py       # CatBreedCreate / CatBreedUpdate
├── routers/cats.py             # 改用 repository + 新增 POST/PUT/DELETE
├── routers/daily_cat.py        # 改用 repository
├── services/radar_scores.py    # 生成后写 DB(JSON 缓存退役)
├── scripts/generate_radar.py   # 批量生成(复用新逻辑)
├── scripts/seed_db.py          # 种子管理:--sync / --reset
├── data/cats.py                # 降级为种子基准文件(seed-only,运行时不再 import)
└── data/generated_scores.json  # 导入后退役(gitignore 保留)
```

## 表模型(`models/cat.py`)

```python
class CatBreedRow(SQLModel, table=True):
    __tablename__ = "cat_breeds"
    id: str = Field(primary_key=True)                    # "ragdoll" 等
    name_zh: str
    name_en: str
    origin: str
    size: str
    coat: str
    quote: str
    meme_tags: list[str] = Field(default_factory=list, sa_column=Column(JSONB))
    suitable_owners: list[str] = Field(default_factory=list, sa_column=Column(JSONB))
    image_url: str
    scores: dict = Field(default_factory=dict, sa_column=Column(JSONB))        # 手工分
    ai_scores: dict | None = Field(default=None, sa_column=Column(JSONB))     # AI 生成分,读取优先
```

未来 pgvector 接入:仅加一列 `embedding`(vector 类型),不动现有字段。

## db 层(`db.py`)

```python
engine = create_engine(db_url)          # DATABASE_URL 从 .env 读,代码内适配 +psycopg

def get_session():                      # FastAPI 依赖:请求级 Session
    with Session(engine) as session:
        yield session

def init_db():                          # create_all + 空表时 seed(data/cats.py + generated_scores.json)
```

- **启动失败策略**:DB 连接失败 → `init_db` 抛错,服务不启动(尽早失败,避免运行时 500)

## Repository(`repositories/cats.py`)

```python
def list_breeds(session, q=None, size=None, coat=None, owner=None) -> list[CatBreed]
def get_breed(session, cat_id) -> CatBreed | None
def random_breed(session, exclude_id=None) -> CatBreed          # daily_cat 逻辑移入
def create_breed(session, data: CatBreedCreate) -> CatBreed
def update_breed(session, cat_id, data: CatBreedUpdate) -> CatBreed | None
def delete_breed(session, cat_id) -> bool
def update_ai_scores(session, cat_id, scores: CatScores) -> None
```

- 行 → `schemas.CatBreed` 的转换在 repository 内(`ai_scores or scores`),路由与前端零感知
- 筛选 SQL 化;响应模型不变

## 路由改造

| 路由 | 改动 |
| --- | --- |
| `routers/cats.py` | 现有三端点改用 repository + `get_session`;新增 POST(409 重复)/ PUT(404)/ DELETE(404) |
| `routers/daily_cat.py` | 随机选择逻辑移入 repository,端点只调 repository |
| `services/radar_scores.py` | 生成后写 `ai_scores` 列;缓存命中判断改为查 DB;删除 JSON 缓存逻辑 |
| `scripts/generate_radar.py` | 复用新逻辑,CLI 接口不变 |

## 管理接口

```python
class CatBreedCreate(BaseModel):
    id: str = Field(min_length=1, max_length=50, pattern=r"^[a-z0-9_]+$")
    name_zh: str
    name_en: str
    origin: str
    size: Literal["小型", "中型", "大型"]
    coat: Literal["短毛", "长毛", "无毛"]
    quote: str
    meme_tags: list[str]
    suitable_owners: list[str]
    image_url: str
    scores: CatScores          # 手工分

class CatBreedUpdate(CatBreedCreate): ...
```

| 端点 | 行为 |
| --- | --- |
| `POST /api/cats` | 新增品种;id 已存在 → 409;成功 → 201 返回完整 CatBreed |
| `PUT /api/cats/{id}` | 全量更新基础字段 + 手工分;**不动 ai_scores**;不存在 → 404 |
| `DELETE /api/cats/{id}` | 删除品种(单表,ai_scores 同行删除);不存在 → 404 |

## 种子脚本(`scripts/seed_db.py`)

```bash
uv run python -m scripts.seed_db           # --sync(默认):只更新已存在行,不插入
uv run python -m scripts.seed_db --reset   # 清空 cat_breeds,按文件重建
```

**权威模型:DB 是唯一权威,文件只做两件事:**

| 操作 | 语义 |
| --- | --- |
| 首次启动(表空) | 导入文件全部 12 条(含 generated_scores.json 的 AI 分) |
| `--sync` | 文件中的品种若 DB 存在 → 更新资料;不存在 → **跳过并提示**(不复活已删品种、不插入新品种) |
| `--reset` | 清空表,按文件重建(丢弃接口增量,是有意识的选择) |
| 接口 CRUD | 行的增删改唯一正规途径 |

- `--sync` 永不增删行,只更新已存在行的资料;新增走 `POST /api/cats` 或 `--reset`
- `data/cats.py` 顶部注释更新为 seed-only;运行时模块不 import 它

## 错误处理

| 场景 | 处理 |
| --- | --- |
| DB 连接失败(容器未启动/URL 错) | `init_db` 启动即抛错,服务不启动,日志明确提示 |
| 查询时 DB 异常 | 500(FastAPI 默认);不静默回退内存 |
| 品种不存在 | 404(repository 返回 None) |
| id 重复新增 | 409 中文 detail |
| LLM 生成失败 | 502(生成成功才写库) |
| seed 幂等 | 表非空跳过(首启);`--reset` 显式重建 |

## 验证方式

| 步骤 | 验证 |
| --- | --- |
| 1. 依赖安装 | `uv add sqlmodel psycopg[binary]`,启动无导入错误 |
| 2. 建表 + seed | 启动 → psql 查 `cat_breeds` 表结构(JSONB)与 12 条;ai_scores 与 generated_scores.json 一致 |
| 3. API 回归 | 3.1/3.2 全部端点复测(列表/筛选/详情/404/daily-cat 确定性/换一只) |
| 4. CRUD | POST 新增 → 201;重复 POST → 409;PUT 更新 → 数据变化且 ai_scores 不动;DELETE → 404 再查 |
| 5. 雷达分写库 | POST radar-scores(force)→ psql 查 ai_scores 更新;再次 POST source="cached" 不调 LLM |
| 6. sync 语义 | DELETE 一个品种后 `--sync` → 不复活;文件新增品种后 `--sync` → 不插入且提示 |
| 7. reset 语义 | `--reset` → 表回到文件基线;接口增量丢失(预期) |
| 8. 幂等 | 重启服务 → 数据不重复导入 |
| 9. 批量脚本 | `generate_radar.py` 全量跑 → ai_scores 全部更新 |

## 后续 pgvector 接入路径(记录,不实现)

1. `CREATE EXTENSION vector` + `CatBreedRow.embedding: vector(512)` 列
2. 知识库检索(`services/knowledge.py::_get_store`)从 InMemoryVectorStore 迁移至 pgvector
3. 表结构变更时评估引入 Alembic 迁移链
