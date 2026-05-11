from fastapi import APIRouter, Depends
from auth import get_current_user
from schemas import AdvisorRequest
from services.data_fetcher import fetch_stock_data
from services.ai_advisor import generate_investment_proposal
import models

router = APIRouter(prefix="/api/advisor", tags=["advisor"])


@router.post("/proposal")
def get_proposal(
    body: AdvisorRequest,
    user: models.User = Depends(get_current_user),
):
    pinned_stocks = []
    for ticker in body.pinned_tickers:
        data = fetch_stock_data(ticker)
        if data:
            pinned_stocks.append(data)

    proposal = generate_investment_proposal(
        budget=body.budget,
        pinned_stocks=pinned_stocks,
        aggressiveness=max(1, min(5, body.aggressiveness)),
        transactions=body.transactions,
    )
    return proposal
