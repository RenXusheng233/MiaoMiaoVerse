# MiaoMiaoVerse

> 面向猫奴的 AI 全栈娱乐平台，集猫咪百科、AI 文案、表情包生成与疗愈问答于一体。

## Architecture

Decoupled frontend + backend, two independent services with no monorepo tooling:

```
MiaoMiaoVerse/
├── frontend/   Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui
└── backend/    FastAPI · Python 3.14 · Pydantic v2
```

## Tech Stack

### Frontend (`frontend/`)

| Layer       | Technology                                         |
| ----------- | -------------------------------------------------- |
| Framework   | Next.js 16.2 — App Router, RSC enabled             |
| Language    | TypeScript 5 (strict)                              |
| Styling     | Tailwind CSS v4 — CSS-first, no `tailwind.config*` |
| Components  | shadcn/ui (`base-nova` style) + `@base-ui/react`   |
| Icons       | lucide-react                                       |
| Package mgr | **bun** (never npm/yarn)                           |

### Backend (`backend/`)

| Layer       | Technology              |
| ----------- | ----------------------- |
| Framework   | FastAPI 0.139 + Uvicorn |
| Language    | Python 3.14             |
| Validation  | Pydantic v2             |
| Package mgr | **uv**                  |

## Dev Commands

### Frontend

```bash
cd frontend
bun dev                      # dev server → http://localhost:3000
bun build                    # production build
bun lint                     # ESLint
bunx shadcn add <component>  # add a shadcn/ui component
```

### Backend

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload    # dev server → http://localhost:8000
uv pip install <pkg>         # install a package
```

## Dev Environment

| Tool    | Minimum Version | Reason                                   |
| ------- | --------------- | ---------------------------------------- |
| Node.js | 20.9.0          | Next.js 16 hard requirement              |
| bun     | 1.0             | lockfile format v1                       |
| Python  | 3.14            | project `.venv` is pinned to 3.14 via uv |
| uv      | 0.5             | Python 3.14 environment management       |

## Environment Variables

No `.env` files configured yet. When adding:

- Frontend → `frontend/.env.local` (gitignored, never commit)
- Backend → `backend/.env` (gitignored, never commit)

## Coding Conventions

### Frontend

- All class merging must use `cn()` from `@/lib/utils` — never string concatenation.
- Path alias `@/*` resolves to `frontend/` root.
- Design tokens live in `app/globals.css` under `@theme inline { ... }` using `oklch` values — do not hardcode raw color values inline.
- Dark mode: class-based (`.dark`) via `@custom-variant dark (&:is(.dark *))` in CSS.
- Custom components → `components/`; shadcn primitives → `components/ui/`.

### Backend

- All request/response schemas use **Pydantic v2** models.
- Configuration via `pydantic-settings`; secrets loaded from `.env` using `python-dotenv`.
- Organize into routers under `routers/` as the project grows.

## Important Notes

- **Next.js 16 has breaking changes.** Before writing any Next.js code, consult `frontend/node_modules/next/dist/docs/`. See [`frontend/AGENTS.md`](frontend/AGENTS.md) for full frontend warnings.
- **`@base-ui/react` ≠ Radix UI.** shadcn/ui uses `@base-ui/react` as its headless primitive layer — Radix prop APIs do not apply.
- **Tailwind v4** is CSS-first: no `tailwind.config.*` exists or should be created. All theme customization belongs in `app/globals.css`.
- **No tests** are set up yet — no test framework or scripts exist.

## Workflow

- Before modifying code, inspect the relevant files and existing patterns.
- Keep changes minimal and focused.
- Use English for code comments and commit messages.
- Run the relevant lint, build, or test commands after changes.
- Do not modify `.env` files unless explicitly requested.
- Never commit secrets, API keys, or local environment files.

## Git

- Work on feature or development branches.
- Do not commit directly to `main`, `master`, or `production`.
- Use Conventional Commits for commit messages.
- Before committing, inspect `git diff` and verify the changed files.

## Development Commands

Run commands from the project root.

| Task               | Command                |
| ------------------ | ---------------------- |
| Start both servers | `bun dev`              |
| Frontend only      | `bun run dev:frontend` |
| Backend only       | `bun run dev:backend`  |

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Backend Swagger: http://localhost:8000/docs
