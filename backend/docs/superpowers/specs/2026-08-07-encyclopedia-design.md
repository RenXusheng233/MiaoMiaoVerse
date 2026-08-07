# 猫咪百科模块(PRD 3.2)实现文档

> 回顾式文档:记录已实现功能(在 brainstorming 流程之前开发,本文件补记设计决策与现状)。

## 背景

PRD 3.2 猫咪百科:品种的权威 + 趣味数据库。

- **3.2.1 猫圈梗百科**:词条含官方名、起源地、体型、毛发类型、网梗/黑话标签
- **3.2.2 全方位雷达图**:五维评分(拆家/粘人/掉毛/掉钱包/颜值),数据由 Agent 生成,生成值覆盖人工值
- **3.2.3 适养人群匹配**:适养人群标签(当前人工录入,Agent 生成规划中)

## 实现概览

```
backend/
├── routers/cats.py             # GET /api/cats + GET /api/cats/{id} + POST /api/cats/{id}/radar-scores
├── schemas/daily_cat.py        # CatBreed / CatScores(3.1 Daily Cat 亦复用)
├── schemas/radar_scores.py     # RadarScoresResponse
├── services/radar_scores.py    # 雷达分 LLM 生成 + JSON 缓存层
├── scripts/generate_radar.py   # 批量生成脚本
└── data/cats.py                # 12 个品种硬编码主数据
```

## 数据模型(`schemas/daily_cat.py`)

```python
Score = Annotated[int, Field(ge=1, le=10)]   # 1-10 整数分

class CatScores(BaseModel):
    demolition: Score   # 拆家指数
    clingy: Score       # 粘人程度
    shedding: Score     # 掉毛指数
    cost: Score         # 掉钱包指数(饲养成本)
    looks: Score        # 颜值指数

class CatBreed(BaseModel):
    id: str
    name_zh: str
    name_en: str
    origin: str
    size: str            # 小型 / 中型 / 大型
    coat: str            # 短毛 / 长毛 / 无毛
    quote: str           # 猫咪语录
    meme_tags: list[str]
    suitable_owners: list[str]   # 适养人群标签(当前手工录入)
    image_url: str
    scores: CatScores    # 手工录入值(可能被 AI 生成值覆盖)
```

## API

| 端点 | 行为 |
| --- | --- |
| `GET /api/cats` | 全量列表,支持 `q`(中文/英文名子串)、`size`、`coat`、`owner` 筛选与组合;返回**合并后**分值(生成值优先) |
| `GET /api/cats/{id}` | 单品种详情(合并分值);不存在 → 404 |
| `POST /api/cats/{id}/radar-scores?force=` | 调 LLM 生成五维雷达分并持久化;命中缓存且非 force 直接返回(`source="cached"`);失败 → 502 |

## 雷达分生成(`services/radar_scores.py`)

- **模型**:`init_chat_model("deepseek:deepseek-v4-flash")` 懒加载单例
- **结构化输出**:`with_structured_output(CatScores, method="json_mode")` — DeepSeek thinking mode 不支持 `tool_choice`,必须用 JSON mode(response_format json_object);prompt 内声明严格 JSON 输出格式
- **Prompt**:系统提示含五维定义、1-10 评分标准(猫界均值=5)、**校准锚点**(奶牛猫/波斯猫/暹罗猫的已知分值,保证跨品种可比)
- **缓存层**:`data/generated_scores.json`(gitignored)
  - 读取时**生成值覆盖手工值**(merge 语义);删除文件即完全回退手工数据
  - 原子写入(临时文件 + `os.replace`);文件损坏/缺失 → 空缓存,读路径永不抛错
- **批量脚本**:`uv run python -m scripts.generate_radar [--cat <id>] [--force]` — 遍历全部品种生成并写缓存,失败不中断,末尾汇总
- **错误处理**:LLM 调用/解析失败 → `RadarGenerationError` → API 502

## 已知限制(2026-08-07 审查记录)

| 项 | 说明 | 风险 |
| --- | --- | --- |
| 缓存并发写竞态 | `generate_scores` 的 read-modify-write 无锁,并发请求可能丢失更新 | 低(单用户开发期;接数据库后消除) |
| 缓存部分损坏回退 | 单条目损坏会导致整个缓存返回空(回退手工分) | 低 |
| 中文 query 需 URL 编码 | curl 发送原始 UTF-8 会被 HTTP 层拒绝(400);浏览器/前端框架自动 percent-encode,无实际影响 | 无 |
| 品种数据硬编码 | 12 品种在 `data/cats.py`;新增品种需手工追加(含占位 scores) | 计划中:数据库接入时迁移 |

## 后续数据库接入路径(记录,未实现)

1. `CAT_BREEDS` → `cat_breeds` 表(12 条种子数据,id 为主键)
2. `generated_scores.json` → `cat_scores` 表或 `cat_breeds.scores` JSON 列(生成值优先语义保留)
3. `merge_breeds()` 改为 DB 读取合并;删除 JSON 缓存逻辑
4. 详情见 3.2 模块 SDD ledger 的 load-bearing 记录
