# 首页 Daily Cat(PRD 3.1.3)实现文档

> 回顾式文档:记录已实现功能(在 brainstorming 流程之前开发,本文件补记设计决策与现状)。

## 背景

PRD 3.1.3 今日明星猫咪(Daily Cat):每天从猫咪种类数据库中随机推荐一个品种,展示精美大图 + 标志性"猫咪语录",每日零点刷新,用户可手动"换一只"。

> 注:3.1.1 视差 Hero、3.1.2 快捷直达魔方为前端功能,不在本后端文档范围。

## 实现概览

```
backend/
├── routers/daily_cat.py        # GET /api/daily-cat + GET /api/daily-cat/random
├── schemas/daily_cat.py        # DailyCatResponse(依赖 CatBreed,定义于猫咪百科模块)
└── data/cats.py                # 品种主数据(12 条,与 3.2 共享)
```

## 数据模型(`schemas/daily_cat.py`)

```python
class DailyCatResponse(BaseModel):
    breed: CatBreed      # 完整品种词条(含雷达分,由猫咪百科模块提供)
    date: str            # YYYY-MM-DD
    is_daily: bool       # True=今日固定推荐, False=随机换一只
```

## API

| 端点 | 行为 |
| --- | --- |
| `GET /api/daily-cat` | 当日固定推荐:以 `random.Random(int(YYYYMMDD))` 做确定性选择,同日多次调用结果一致;日期变化(零点)自动换品种,无需持久化 |
| `GET /api/daily-cat/random?exclude_id=` | 随机换一只,`exclude_id` 排除当前品种(传不存在 id 或无效果,无副作用) |

## 设计要点

- **无状态**:不存储"今日已推荐"记录,日期种子保证确定性;`exclude_id` 传入时空池时回退全量列表
- **品种数据源**:与 3.2 共享 `CAT_BREEDS`(未来数据库接入后同源迁移)

## 验证结果(2026-08-07 复验)

| 场景 | 结果 |
| --- | --- |
| 同日两次调用结果一致 | ✅ |
| random 排除指定品种 | ✅ |
| is_daily / date 字段 | ✅ |
