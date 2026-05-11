from fastapi import APIRouter, HTTPException
from services.data_fetcher import (
    fetch_kospi_index,
    fetch_top_stocks,
    fetch_stock_data,
    fetch_stock_history,
    get_stock_factors,
    PERIOD_INTERVAL_MAP,
)

router = APIRouter(prefix="/api/stocks", tags=["stocks"])


@router.get("/kospi")
def get_kospi():
    return fetch_kospi_index()


@router.get("/top")
def get_top_stocks(limit: int = 20):
    return fetch_top_stocks(limit=limit)


@router.get("/{ticker}")
def get_stock(ticker: str):
    data = fetch_stock_data(ticker)
    if not data:
        raise HTTPException(status_code=404, detail="Stock not found")
    factors = get_stock_factors(ticker)
    return {**data, **factors}


@router.get("/{ticker}/history")
def get_history(ticker: str, timeframe: str = "1d"):
    naver_tf, count = PERIOD_INTERVAL_MAP.get(timeframe, ("day", 30))
    history = fetch_stock_history(ticker, period=naver_tf, count=count)
    if not history:
        raise HTTPException(status_code=404, detail="No history data available")
    return history
