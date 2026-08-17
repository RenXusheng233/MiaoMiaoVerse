# Backend Instructions

## Stack

- FastAPI 0.139
- Python 3.14
- Pydantic v2
- Package manager: uv

## Development

- Use async FastAPI patterns where appropriate.
- Define all request and response schemas with Pydantic v2 models.
- Organize API endpoints into routers under `routers/`.
- Load configuration through `pydantic-settings`.
- Never commit `.env` files or secrets.

## Commands

From the project root:

```bash
bun run dev:backend
```

From the backend directory:

```bash
uv run fastapi dev main.py
```
