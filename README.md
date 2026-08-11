# MiaoMiaoVerse 喵喵宇宙

面向猫奴的 AI 全栈娱乐平台，集猫咪百科，AI 文案生成，表情包制作与疗愈问答于一体。

## 功能模块

| 模块         | 说明                                                        | 状态                |
| ------------ | ----------------------------------------------------------- | ------------------- |
| 3.1 首页     | 视差 Hero，快捷直达魔方，今日明星猫(每日推荐 + 换一只)      | ✅ 已完成            |
| 3.2 猫咪百科 | 品种画廊 + 详情页(网梗标签，基本信息，适养人群徽章，雷达图) | ✅ 已完成            |
| 3.3 文案生成 | 三版并行 SSE 流式文案，单版重生成，一键复制                 | ✅ 已完成            |
| 3.4 表情包   | 上传图片 + 文字生成叠加方案(规则引擎占位，多模态待接入)     | 后端 ✅ ，前端待开发 |
| 3.5 疗愈问答 | 聊天式问答，闲聊/医疗双路由，医疗免责声明                   | ✅ 已完成            |

## 技术架构

```
┌───────────────────────────────────────────────────────┐
│                frontend/(Next.js 16)                  │
│  App Router, RSC, TypeScript, Tailwind v4, shadcn/ui  │
└───────────────────┬───────────────────────────────────┘
                    │ HTTP / SSE
┌───────────────────▼───────────────────────┐
│            backend/(FastAPI)              │
│  LangChain, DeepSeek, SQLModel, pgvector  │
└───────────────────┬───────────────────────┘
                    │
            ┌───────▼───────┐
            │ PostgreSQL 18 │
            │  + pgvector   │
            └───────────────┘
```

- **前端**：Next.js 16(App Router)，bun 包管理，设计令牌集中在 globals.css
- **后端**：FastAPI + LangChain，DeepSeek `deepseek:deepseek-v4-flash`，本地 embedding `bge-small-zh-v1.5`
- **数据库**：PostgreSQL 18(Docker)，pgvector 向量检索：品种/雷达分/知识文档全部入库

## 快速开始

```bash
# 1. 启动数据库(Docker)
docker run -d --name postgres-miaomiao-db   -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=<密码> -e POSTGRES_DB=cats   -p 5433:5432   pgvector/pgvector:0.8.6-pg18-trixie
docker exec postgres-miaomiao-db psql -U admin -d cats -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 2. 启动后端 → http://localhost:8000(启动自动建表 + 种子数据)
cd backend
source .venv/bin/activate
uvicorn main:app --reload

# 3. 启动前端 → http://localhost:3000
cd ../frontend
bun install
bun dev
```

> 环境变量：后端 `backend/.env`(DEEPSEEK_API_KEY，DEEPSEEK_BASE_URL，DATABASE_URL)，前端 `frontend/.env.local`(NEXT_PUBLIC_API_BASE_URL=http://localhost:8000)

## 目录结构

```
MiaoMiaoVerse/
├── PRD.md              # 产品需求文档(含实现进度)
├── backend/            # FastAPI 后端(README 见 backend/README.md)
│   ├── routers/        # API 路由
│   ├── services/       # 业务逻辑(LLM 编排，检索等)
│   ├── models/         # SQLModel 表模型
│   ├── repositories/   # 数据访问层
│   ├── data/           # 种子基准文件(seed-only)
│   └── docs/           # 设计文档与实现计划
└── frontend/           # Next.js 前端(README 见 frontend/README.md)
    ├── app/            # 页面与路由
    ├── components/     # 组件(ui/home/cats/copywriting/chat)
    ├── lib/            # API 封装，SSE 解析器，类型
    └── docs/           # 设计文档与实现计划
```

## 文档索引

| 文档                         | 说明                                               |
| ---------------------------- | -------------------------------------------------- |
| `PRD.md`                     | 产品需求文档(含实现进度标注)                       |
| `backend/README.md`          | 后端说明：命令速查，数据管理(sync/reset)，API 概览 |
| `frontend/README.md`         | 前端说明：快速开始，页面路由，关键约定             |
| `backend/docs/superpowers/`  | 后端各模块设计文档与实现计划                       |
| `frontend/docs/superpowers/` | 前端各模块设计文档与实现计划                       |
