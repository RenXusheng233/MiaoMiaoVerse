# 猫咪百科模块(PRD 3.2)实现记录

> 回顾式文档:该模块在正式计划流程之前开发,本文件记录实际实现步骤与验证结果(非前瞻计划)。

**Goal:** 实现 PRD 3.2 猫咪百科后端接口(词条 + Agent 雷达分)。

**Architecture:** 品种主数据硬编码 `data/cats.py`;雷达分由 LangChain + DeepSeek 生成,JSON 文件缓存(生成值覆盖手工值);无数据库。

## 实现步骤回顾

| 步骤 | 内容 | 文件 |
| --- | --- | --- |
| 1 | 品种数据模型 + 12 个品种词条(含手工雷达分) | `schemas/daily_cat.py`、`data/cats.py` |
| 2 | 猫咪百科端点(列表/筛选/详情) | `routers/cats.py` |
| 3 | 雷达分 LLM 生成服务 + JSON 缓存 + 合并语义 | `services/radar_scores.py` |
| 4 | `POST /api/cats/{id}/radar-scores`(force 参数) | `routers/cats.py` |
| 5 | 批量生成脚本 | `scripts/generate_radar.py` |

## 关键调试记录

- **DeepSeek thinking mode 拒绝 `tool_choice`**(400 invalid_request_error)→ `with_structured_output` 改用 `method="json_mode"`,并在 prompt 中显式声明 JSON 键名格式
- Prompt 中 JSON 花括号在 f-string 内需 `{{ }}` 转义
- `CatScores`(Pydantic 模型)写 JSON 前需 `model_dump()`

## 验证结果(2026-08-07 复验)

| 场景 | 结果 |
| --- | --- |
| 列表计数 / 名称 / 体型 / 毛发 / 人群筛选(percent-encoded) | ✅ 全部正确 |
| 组合筛选(中型+短毛) | ✅ 6 条 |
| 详情 + 404 | ✅ |
| POST radar-scores 缓存命中 | ✅ source="cached" |
| 批量生成 12 品种 | ✅ 12/12,锚点品种分值与校准一致 |
| 服务日志 | ✅ 无 error/exception |

## 环境说明

- 中文 query 参数必须 percent-encode(HTTP 规范);curl 调试用 `%E5%A5%B6%E7%89%9B` 这类编码,或 `--data-urlencode`;前端框架自动处理
- 批量生成脚本:`uv run python -m scripts.generate_radar [--cat <id>] [--force]`
