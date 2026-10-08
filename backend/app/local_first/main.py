from app.local_first.calculations import CalculationInput, AnalysisInput, calculate, analyze
import asyncio
import hmac
from collections import deque
from contextlib import asynccontextmanager
from time import monotonic
from fastapi import Depends, FastAPI, File, Form, Header, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy import select, update
from sqlalchemy.exc import SQLAlchemyError
from starlette.concurrency import run_in_threadpool
from app.core.errors import AppError
from app.db.models import PipelineConfig
from app.integrations.model_gateway import ModelGatewayClient
from app.local_first.cache import ConfigCache
from app.local_first.database import SharedDatabase, revision_table
from app.local_first.execution import ExecutionInput, execute
from app.local_first.settings import LocalSettings
from app.schemas.dynamic_pipelines import DynamicPipelineInput, OCRModelInput
from app.services.dynamic_pipeline_service import DynamicPipelineService, model_json
from app.services.image_service import ImageService
from app.services.pdf_service import PdfService
from app.services.serializers import config_json

class BodyLimit:
    def __init__(self, app, limit): self.app, self.limit = app, limit
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http": return await self.app(scope, receive, send)
        chunks, size = [], 0
        while True:
            event = await receive()
            if event["type"] == "http.disconnect": return
            size += len(event.get("body", b""))
            if size > self.limit:
                return await JSONResponse({"detail":"Request exceeds configured size limit"}, 413)(scope, receive, send)
            chunks.append(event.get("body", b""))
            if not event.get("more_body", False): break
        body, consumed = b"".join(chunks), False
        async def replay():
            nonlocal consumed
            if consumed: return await receive()
            consumed = True
            return {"type":"http.request", "body":body, "more_body":False}
        await self.app(scope, replay, send)

def create_app(settings=None):
    settings = settings or LocalSettings()
    database = SharedDatabase(settings)
    cache = ConfigCache(database, settings)
    metrics = {"ocr_runs":0, "ocr_db_queries":0, "api_response_bytes":0, "rate_rejections":0}
    arrivals = deque()
    semaphore = asyncio.Semaphore(settings.ocr_concurrency)
    @asynccontextmanager
    async def lifespan(app):
        await run_in_threadpool(cache.get)
        try: yield
        finally: database.engine.dispose()
    app = FastAPI(title="OCR local-first testing gateway", lifespan=lifespan)
    app.state.database, app.state.cache = database, cache
    app.add_middleware(BodyLimit, limit=(settings.max_upload_mb + 2) * 1024 * 1024)
    app.add_middleware(CORSMiddleware, allow_origins=[x.strip() for x in settings.cors_origins.split(",")],
        allow_methods=["GET","POST","PUT","DELETE","OPTIONS"], allow_headers=["Content-Type","Authorization","If-None-Match"],
        expose_headers=["ETag","X-Config-Revision","X-Image-Width","X-Image-Height","X-Page-Count"])
    @app.middleware("http")
    async def limits(request, call_next):
        if request.url.path != "/api/health" and request.method != "OPTIONS":
            now = monotonic()
            while arrivals and arrivals[0] < now - 60: arrivals.popleft()
            if len(arrivals) >= settings.requests_per_minute:
                metrics["rate_rejections"] += 1
                return JSONResponse({"detail":"Gateway rate limit reached"}, 429, headers={"Retry-After":"60"})
            arrivals.append(now)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers.setdefault("Cache-Control", "private, no-store")
        metrics["api_response_bytes"] += int(response.headers.get("content-length","0"))
        return response
    @app.exception_handler(AppError)
    async def known(request, error): return JSONResponse({"detail":error.message}, error.status_code)
    @app.exception_handler(RequestValidationError)
    @app.exception_handler(ValidationError)
    async def validation(request, error): return JSONResponse({"detail":[{"loc":list(e["loc"]),"msg":e["msg"],"type":e["type"]} for e in error.errors()]}, 422)
    @app.exception_handler(SQLAlchemyError)
    async def sql_error(request, error): return JSONResponse({"detail":"Shared configuration unavailable"}, 503)
    @app.exception_handler(Exception)
    async def unexpected(request, error): return JSONResponse({"detail":"Operation could not be completed"}, 500)
    def administrator(authorization: str | None = Header(default=None)):
        token = settings.admin_token.get_secret_value()
        if not token: raise AppError("Pipeline administration is disabled until configured", 503)
        if not authorization or not hmac.compare_digest(authorization, "Bearer " + token): raise AppError("Administrator authorization required", 401)
    def conditional(request, value, snapshot):
        tag = f'"config-{snapshot.revision}"'
        headers = {"ETag":tag,"X-Config-Revision":str(snapshot.revision),"Cache-Control":"private, max-age=0, must-revalidate"}
        if request.headers.get("if-none-match") == tag: return Response(status_code=304, headers=headers)
        return JSONResponse(value, headers=headers)
    def mutate(fn):
        with database.mutations.begin() as session:
            revision = session.scalar(select(revision_table.c.revision).where(revision_table.c.id == 1).with_for_update())
            if revision is None: raise AppError("Shared schema is not initialized", 503)
            value = fn(session)
            session.execute(update(revision_table).where(revision_table.c.id == 1).values(revision=revision + 1))
        cache.invalidate()
        return value
    @app.get("/api/health")
    def health(): return {"status":"ok","mode":"local-first","persistence":"shared-configuration-only"}
    @app.get("/api/upload-config")
    def upload_config(): return {"max_upload_mb":settings.max_upload_mb,"pdf_render_dpi":settings.pdf_render_dpi}
    @app.get("/api/config/version")
    def version(request: Request):
        snapshot = cache.get(); return conditional(request, {"revision":snapshot.revision}, snapshot)
    @app.get("/api/pipelines/models")
    def models(request: Request):
        snapshot = cache.get(); return conditional(request, list(snapshot.public_models), snapshot)
    @app.get("/api/pipelines")
    def pipelines(request: Request):
        snapshot = cache.get(); return conditional(request, list(snapshot.public_configs), snapshot)
    @app.post("/api/pipelines/models", dependencies=[Depends(administrator)], status_code=201)
    def create_model(data: OCRModelInput): return mutate(lambda s: model_json(DynamicPipelineService(s).save_model(data)))
    @app.put("/api/pipelines/models/{model_id}", dependencies=[Depends(administrator)])
    def update_model(model_id: str, data: OCRModelInput): return mutate(lambda s: model_json(DynamicPipelineService(s).save_model(data, model_id)))
    @app.post("/api/pipelines", dependencies=[Depends(administrator)], status_code=201)
    def create_pipeline(data: DynamicPipelineInput): return mutate(lambda s: config_json(DynamicPipelineService(s).save_pipeline(data), settings))
    @app.put("/api/pipelines/{pipeline_id}/definition", dependencies=[Depends(administrator)])
    def update_pipeline(pipeline_id: str, data: DynamicPipelineInput): return mutate(lambda s: config_json(DynamicPipelineService(s).save_pipeline(data, pipeline_id), settings))
    @app.delete("/api/pipelines/{pipeline_id}", dependencies=[Depends(administrator)], status_code=204)
    def delete_pipeline(pipeline_id: str):
        def remove(session):
            config = session.scalar(select(PipelineConfig).where(PipelineConfig.pipeline_id == pipeline_id))
            if config is None: raise AppError("Pipeline not found", 404)
            session.delete(config)
        mutate(remove); return Response(status_code=204)
    @app.get("/api/integrations/model-gateway/status")
    async def gateway_status(): return await ModelGatewayClient(settings).status()
    async def image(file, page_number):
        try: data = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
        finally: await file.close()
        if len(data) > settings.max_upload_mb * 1024 * 1024: raise AppError("File exceeds upload limit", 413)
        if file.content_type == "application/pdf":
            page = await run_in_threadpool(PdfService(settings).render, data, page_number)
            return page.png, page.width, page.height, page.page_count
        png, width, height = await run_in_threadpool(ImageService(settings).decode_upload, data, file.content_type)
        return png, width, height, 1
    @app.post("/api/ocr/prepare")
    async def prepare(file: UploadFile = File(...), page_number: int = Form(default=1, ge=1)):
        png, width, height, count = await image(file, page_number)
        return Response(png, media_type="image/png", headers={"X-Image-Width":str(width),"X-Image-Height":str(height),"X-Page-Count":str(count)})
    @app.post("/api/ocr/execute")
    async def ocr(file: UploadFile = File(...), options: str = Form(..., max_length=100000), page_number: int = Form(default=1, ge=1)):
        data = ExecutionInput.model_validate_json(options)
        try: await asyncio.wait_for(semaphore.acquire(), timeout=0.1)
        except TimeoutError: raise AppError("OCR gateway is busy; retry later", 429)
        try:
            png, _, _, _ = await image(file, page_number)
            before = database.metrics["queries"]
            snapshot = await run_in_threadpool(cache.get)
            result = await execute(png, data, snapshot, settings)
            metrics["ocr_runs"] += 1
            metrics["ocr_db_queries"] += database.metrics["queries"] - before
            return result
        finally: semaphore.release()
    @app.get("/api/admin/metrics", dependencies=[Depends(administrator)])
    def counters(): return {**database.metrics,**cache.metrics,**metrics,"byte_estimate_scope":"serialized config payload only; excludes protocol/TLS/query overhead; not Neon billing","warning_thresholds_mb":settings.transfer_warning_mb}
    @app.post("/api/ocr/calculate")
    def calculation(data: CalculationInput): return calculate(data)
    @app.post("/api/ocr/analyze")
    def analysis(data: AnalysisInput): return analyze(data)
    @app.post("/api/ocr/crop")
    async def crop(file: UploadFile = File(...), options: str = Form(..., max_length=100000), page_number: int = Form(default=1, ge=1)):
        from app.schemas.contracts import ROI
        import json
        raw = json.loads(options)
        roi = ROI.model_validate(raw["roi"]).model_dump() if raw.get("roi") else None
        png, _, _, _ = await image(file, page_number)
        images = ImageService(settings)
        with images.open(png) as original: cropped = images.canonical_crop(original, roi)
        return Response(cropped.png, media_type="image/png")
    @app.post("/api/ocr/auto-rois")
    async def auto_roi(file: UploadFile = File(...), options: str = Form(..., max_length=100000), page_number: int = Form(default=1, ge=1)):
        from types import SimpleNamespace
        from app.schemas.contracts import AutoROIRequest
        from app.services.auto_roi_service import AutoROIService
        data = AutoROIRequest.model_validate_json(options)
        png, width, height, _ = await image(file, page_number)
        service = AutoROIService.__new__(AutoROIService)
        service.repository = SimpleNamespace(document=lambda id: None)
        service.gateway = ModelGatewayClient(settings)
        service.cases = SimpleNamespace(page_image=lambda *a: (png,width,height))
        return await service.suggest("transient", data)
    @app.post("/api/pipelines/{pipeline_id}/test-connection", dependencies=[Depends(administrator)])
    async def connection(pipeline_id: str):
        snapshot = await run_in_threadpool(cache.get)
        if pipeline_id not in {p.pipeline_id for p in snapshot.configs}: raise AppError("Pipeline not found",404)
        if not settings.api_key(pipeline_id): return {"status":"missing_key","message":"Configure LOCAL_MODEL_GATEWAY_API_KEY first"}
        status = await ModelGatewayClient(settings).status()
        return {"status":"gateway_connected" if status["gateway"] == "connected" else "unavailable","message":"Run OCR to verify the selected model"}
    return app
