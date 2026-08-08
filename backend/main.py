from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import init_db
from routers import cats, chat, copywriting, daily_cat, knowledge_docs, meme


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables and seed on startup; DB failure fails fast."""
    init_db()
    yield


app = FastAPI(title="MiaoMiaoVerse API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(daily_cat.router)
app.include_router(cats.router)
app.include_router(copywriting.router)
app.include_router(meme.router)
app.include_router(knowledge_docs.router)


@app.get("/")
async def root():
    return {"message": "MiaoMiaoVerse API"}
