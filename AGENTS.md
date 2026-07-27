# MiaoMiaoVerse — Agent Instructions

## Repository Structure

```
MiaoMiaoVerse/
├── frontend/   Next.js 16 app (TypeScript, Tailwind v4, shadcn/ui)
└── backend/    FastAPI skeleton (Python 3.14, uv)
```

The two services are independent — no monorepo tooling. Work in each directory separately.

## Frontend

Working directory: `frontend/`  
Package manager: **bun** (use `bun add`, `bun install` — never npm/yarn)

| Task       | Command     |
| ---------- | ----------- |
| Dev server | `bun dev`   |
| Build      | `bun build` |
| Lint       | `bun lint`  |

See [`frontend/AGENTS.md`](frontend/AGENTS.md) for detailed frontend conventions.

## Backend

Working directory: `backend/`  
Runtime: Python 3.14, managed by **uv** (`.venv/`)

| Task         | Command                     |
| ------------ | --------------------------- |
| Run server   | `uvicorn main:app --reload` |
| Install deps | `uv pip install <pkg>`      |

- Framework: FastAPI 0.139 + Pydantic v2
- Currently a minimal skeleton (`main.py`). No database, no routers yet.
- Use `pydantic-settings` for config; `python-dotenv` for `.env` loading.

## Git

- Never commit to `main` directly — use feature branches.
- Commit messages: Conventional Commits, English only (`feat(scope): description`).
