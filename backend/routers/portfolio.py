from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models, schemas

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.get("/budget")
def get_budget(user: models.User = Depends(get_current_user)):
    return {"budget": user.investment_budget}


@router.put("/budget")
def update_budget(
    body: schemas.BudgetUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user.investment_budget = body.budget
    db.commit()
    return {"budget": user.investment_budget}


@router.get("/pins")
def get_pins(user: models.User = Depends(get_current_user)):
    return [p.ticker for p in user.pins]


@router.post("/pins/{ticker}")
def pin_stock(
    ticker: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(models.PinnedStock).filter(
        models.PinnedStock.user_id == user.id,
        models.PinnedStock.ticker == ticker,
    ).first()
    if existing:
        return {"message": "Already pinned"}

    pin = models.PinnedStock(user_id=user.id, ticker=ticker)
    db.add(pin)
    db.commit()
    return {"message": "Pinned", "ticker": ticker}


@router.delete("/pins/{ticker}")
def unpin_stock(
    ticker: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pin = db.query(models.PinnedStock).filter(
        models.PinnedStock.user_id == user.id,
        models.PinnedStock.ticker == ticker,
    ).first()
    if not pin:
        raise HTTPException(status_code=404, detail="Not pinned")
    db.delete(pin)
    db.commit()
    return {"message": "Unpinned", "ticker": ticker}


@router.get("/transactions", response_model=list[schemas.TransactionResponse])
def get_transactions(user: models.User = Depends(get_current_user)):
    return user.transactions


@router.post("/transactions", response_model=schemas.TransactionResponse)
def add_transaction(
    body: schemas.TransactionCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    txn = models.Transaction(
        user_id=user.id,
        ticker=body.ticker.upper(),
        quantity=body.quantity,
        price=body.price,
        action=body.action.upper(),
        note=body.note,
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


@router.delete("/transactions/{txn_id}")
def delete_transaction(
    txn_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    txn = db.query(models.Transaction).filter(
        models.Transaction.id == txn_id,
        models.Transaction.user_id == user.id,
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(txn)
    db.commit()
    return {"message": "Deleted"}
