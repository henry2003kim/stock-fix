from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from database import engine, Base
import models  # noqa: ensures tables are registered
from routers import auth, stocks, portfolio, advisor

Base.metadata.create_all(bind=engine)

app = FastAPI(title="StockFix API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(stocks.router)
app.include_router(portfolio.router)
app.include_router(advisor.router)


@app.get("/")
def health():
    return {"status": "ok", "service": "StockFix API"}
