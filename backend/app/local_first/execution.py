"""Transient ORM value objects reuse verified adapters, never attach to a session."""
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4
from pydantic import Field, model_validator
from app.core.errors import AppError
from app.db.models import TestCase, Document, GlobalField
from app.schemas.contracts import InputModel, ROI, GlobalFieldInput
from app.services.global_layout_service import GlobalLayoutService
from app.services.image_service import ImageService
from app.services.pipeline_manager import PipelineManager
from app.services.field_service import FieldService
from app.services.serializers import run_json

class ExecutionInput(InputModel):
    pipelines: list[str] = Field(min_length=1, max_length=10)
    roi: ROI | None = None
    roi_source: str = Field(default="none", pattern="^(none|manual|auto)$")
    fields: list[GlobalFieldInput] = Field(default_factory=list, max_length=200)
    pipeline_revision: int | None = Field(default=None, ge=0)
    @model_validator(mode="after")
    def unique(self):
        if len(set(self.pipelines)) != len(self.pipelines):
            raise ValueError("Pipeline IDs must be unique")
        if len({str(f.id) for f in self.fields}) != len(self.fields) or len({f.field_index for f in self.fields}) != len(self.fields):
            raise ValueError("Global field IDs and indices must be unique")
        if self.fields and self.roi:
            raise ValueError("Choose global fields or legacy ROI")
        return self

class TransientRepository:
    session = SimpleNamespace(commit=lambda: None)
    def __init__(self, case, configs): self.record, self.configs = case, configs
    def test_case(self, *args, **kwargs): return self.record
    def config(self, pipeline_id): return self.configs[pipeline_id]
    def save(self, value): return value

async def execute(png, data, snapshot, settings):
    if data.pipeline_revision is not None and data.pipeline_revision != snapshot.revision:
        raise AppError("Pipeline configuration changed; refresh before running", 409)
    configs = {c.pipeline_id: c for c in snapshot.configs}
    if any(p not in configs for p in data.pipelines): raise AppError("Pipeline not found", 404)
    selected = [configs[p] for p in data.pipelines]
    images = ImageService(settings)
    with images.open(png) as original:
        roi = data.roi.model_dump() if data.roi else None
        images.validate_roi(roi, original.width, original.height)
        for f in data.fields: images.validate_roi(f.roi.model_dump(), original.width, original.height)
        if data.fields:
            case = TestCase(id=str(uuid4()), workflow="global", layout_confirmed_at=datetime.now(timezone.utc),
                            document=Document(id=str(uuid4()), width=original.width, height=original.height),
                            runs=[], global_fields=[GlobalField(id=str(f.id), field_index=f.field_index, roi=f.roi.model_dump(), source=f.source) for f in data.fields])
            service = SimpleNamespace(repository=TransientRepository(case, configs), settings=settings, images=images,
                                      logs=SimpleNamespace(add=lambda *a, **kw: None), page_image=lambda *a: (png, original.width, original.height))
            runs = await GlobalLayoutService(service).run(case.id, data.pipelines)
        else:
            runs = await PipelineManager(settings).run(selected, original, images.canonical_crop(original, roi), roi, data.roi_source)
            for run in runs: FieldService.generate(run)
    result = []
    for run in runs:
        run.id, run.created_at = str(uuid4()), datetime.now(timezone.utc)
        for field in run.fields:
            field.id, field.pipeline_run_id = str(uuid4()), run.id
        value = run_json(run)
        value["pipeline_revision"] = snapshot.revision
        result.append(value)
    return {"revision": snapshot.revision, "runs": result}
