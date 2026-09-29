from uuid import UUID

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

from app.api.dependencies import CaseServiceDep, SessionDep
from app.core.errors import AppError
from app.db.models import GlobalField, TestCase, now
from app.schemas.contracts import DatasetExport
from app.services.dataset_service import DatasetService

router = APIRouter(prefix="/dataset")


@router.get("/samples")
def samples(
    service: CaseServiceDep,
    category: str | None = None,
    document: UUID | None = None,
    document_type: UUID | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    return DatasetService(service).samples(category, document, limit, offset, document_type)


@router.delete("/items/{id}")
def exclude_sample(id: UUID, session: SessionDep, kind: str = Query(pattern="^(field|case)$")):
    record = session.get(GlobalField if kind == "field" else TestCase, str(id))
    if record is None:
        raise AppError("ไม่พบตัวอย่าง", 404)
    record.dataset_excluded_at = record.dataset_excluded_at or now()
    session.commit()
    return {"excluded": True}


@router.post("/export")
def export(data: DatasetExport, service: CaseServiceDep):
    output = DatasetService(service).export([str(id) for id in data.test_case_ids], [str(id) for id in data.global_field_ids])

    def chunks():
        try:
            while chunk := output.read(64 * 1024):
                yield chunk
        finally:
            output.close()

    return StreamingResponse(
        chunks(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="dataset.zip"'},
        background=BackgroundTask(output.close),
    )
