from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Query

from app.api.dependencies import SessionDep

router = APIRouter(prefix="/logs")


@router.get("")
def logs(session: SessionDep, level: Literal["INFO", "WARNING", "ERROR"] | None = None,
         q: str | None = Query(default=None, max_length=200),
         event_type: str | None = Query(default=None, max_length=50),
         pipeline: str | None = Query(default=None, max_length=50),
         request_id: str | None = Query(default=None, max_length=100),
         test_case_id: UUID | None = None, date_from: datetime | None = None,
         date_to: datetime | None = None, limit: int = Query(default=25, ge=1, le=100),
         offset: int = Query(default=0, ge=0)):
    # Compatibility endpoint: event persistence is disabled without querying AppLog.
    return {"enabled": False, "total": 0, "items": []}
