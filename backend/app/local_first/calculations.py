"""Stateless calculations on browser snapshots. No session or storage is created."""
from datetime import datetime
from types import SimpleNamespace
from pydantic import Field
from app.core.errors import AppError
from app.db.models import Category, Document, DocumentType, GlobalField, Metric, OCRField, PipelineRun, TestCase, now
from app.local_first.execution import TransientRepository
from app.schemas.contracts import InputModel, GlobalEvaluation, GroundTruthUpdate, BenchmarkFilters
from app.services.field_service import compare_field
from app.services.global_layout_service import GlobalLayoutService
from app.services.matrix_service import MatrixService
from app.services.serializers import test_case_json
from app.services.test_case_service import TestCaseService

class CalculationInput(InputModel):
    operation: str = Field(max_length=100)
    case: dict
    value: dict = Field(default_factory=dict)

class AnalysisInput(InputModel):
    operation: str = Field(max_length=100)
    cases: list[dict] = Field(max_length=2000)
    configs: list[dict] = Field(max_length=100)
    document_types: list[dict] = Field(default_factory=list, max_length=1000)
    filters: BenchmarkFilters = Field(default_factory=BenchmarkFilters)
    include_archived: bool = False

def value_object(cls, data):
    obj = cls()
    for attr in cls.__mapper__.column_attrs:
        key = attr.key
        if key in data:
            value = data[key]
            if key.endswith("_at") and isinstance(value, str): value = datetime.fromisoformat(value.replace("Z", "+00:00"))
            setattr(obj, key, value)
    if hasattr(cls, "created_at") and obj.created_at is None: obj.created_at = now()
    if hasattr(cls, "updated_at") and obj.updated_at is None: obj.updated_at = now()
    return obj

def hydrate(data):
    case = value_object(TestCase, data)
    case.workflow = data.get("workflow", "legacy")
    case.evaluation_mode = data.get("evaluation_mode", "per_field")
    case.document = value_object(Document, data["document"])
    case.document.business_type = None
    case.global_fields = [value_object(GlobalField, f) for f in data.get("global_fields", [])]
    case.categories = [value_object(Category, f) for f in data.get("categories", [])]
    case.runs = []
    for item in data.get("runs", []):
        run = value_object(PipelineRun, item); run.archived = bool(item.get("archived", False))
        run.boxes = item.get("boxes", []); run.fields = [value_object(OCRField, f) for f in item.get("fields", [])]
        run.metric_records = []
        for kind, key in (("final", "metrics"), ("raw", "raw_metrics")):
            if item.get(key): run.metric_records.append(value_object(Metric, {**item[key], "text_kind":kind, "created_at":item.get("created_at")}))
        case.runs.append(run)
    return case

def calculate(data):
    case = hydrate(data.case)
    repository = TransientRepository(case, {})
    service = GlobalLayoutService(SimpleNamespace(repository=repository))
    value = data.value
    if data.operation == "evaluate": service.evaluate(case.id, GlobalEvaluation.model_validate(value))
    elif data.operation == "mode": service.mode(case.id, value["mode"])
    elif data.operation == "document-gt":
        gt = GroundTruthUpdate.model_validate(value)
        if case.workflow == "global": service.save_document_gt(case.id, gt)
        else:
            cases = TestCaseService.__new__(TestCaseService)
            cases._set_ground_truth(case, gt.ground_truth_raw, gt.confirmed)
    elif data.operation == "field-gt":
        from app.schemas.contracts import GlobalGroundTruth
        service.save_gt(case.id, value["field_id"], GlobalGroundTruth.model_validate({"ground_truth_raw":value["ground_truth_raw"]}))
    elif data.operation in {"check", "legacy-field-gt"}:
        run = next((r for r in case.runs if r.id == value["run_id"]), None)
        field = next((f for f in run.fields if f.id == value["field_id"]), None) if run else None
        if field is None: raise AppError("Field not found", 404)
        gt = GroundTruthUpdate.model_validate({k:v for k,v in value.items() if k in {"ground_truth_raw","confirmed"}})
        if data.operation == "check": return compare_field(field.ocr_text, gt.ground_truth_raw)
        from app.services.metrics_service import normalize_text
        field.ground_truth_raw = gt.ground_truth_raw; field.ground_truth_normalized = normalize_text(gt.ground_truth_raw)
        field.confirmed_at = now() if gt.confirmed else None
        field.evaluation = compare_field(field.ocr_text, gt.ground_truth_raw) if gt.confirmed else None
    else: raise AppError("Unknown local calculation", 422)
    return test_case_json(case, detail=True)

class MemoryRepository:
    def __init__(self, data):
        self.records = [hydrate(c) for c in data.cases]
        self.definitions = [SimpleNamespace(**c) for c in data.configs]
        self.types = [value_object(DocumentType, t) for t in data.document_types]
        self.session = SimpleNamespace(scalars=lambda query: self.types, execute=lambda query: [r for c in self.records for r in c.runs])
    def configs(self): return self.definitions
    def categories(self): return list({t.code:t for c in self.records for t in c.categories}.values())
    def cases(self, filters, **kwargs):
        cases = self.records
        if filters.category: cases = [c for c in cases if any(t.code == filters.category for t in c.categories)]
        if filters.pipeline: cases = [c for c in cases if any(r.pipeline_id == filters.pipeline for r in c.runs)]
        if filters.document: cases = [c for c in cases if c.document_id == str(filters.document)]
        if filters.document_type_id: cases = [c for c in cases if c.document.document_type_id == str(filters.document_type_id)]
        if filters.date_from: cases = [c for c in cases if c.created_at.date() >= filters.date_from]
        if filters.date_to: cases = [c for c in cases if c.created_at.date() <= filters.date_to]
        return cases

def analyze(data):
    service = MatrixService.__new__(MatrixService); service.repository = MemoryRepository(data); service._configs = None
    if data.operation == "matrix": return service.matrix(data.filters)
    if data.operation == "summary": return service.summary(data.filters)
    if data.operation == "pipelines": return service.options()
    if data.operation == "comparison": return service.decision(data.filters, data.include_archived)
    if data.operation in {"categories","document-types"}: return service.groups(data.filters, "category" if data.operation == "categories" else "document_type")
    raise AppError("Unknown local analysis", 422)
