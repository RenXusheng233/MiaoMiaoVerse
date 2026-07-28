from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import cats, daily_cat

app = FastAPI(title="MiaoMiaoVerse API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(daily_cat.router)
app.include_router(cats.router)


@app.get("/")
async def root():
    return {"message": "MiaoMiaoVerse API"}
