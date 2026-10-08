from dataclasses import dataclass
from threading import RLock
from time import monotonic
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.db.models import OCRModel, PipelineConfig
from app.local_first.database import revision_table
from app.services.serializers import config_json
from app.services.dynamic_pipeline_service import model_json

@dataclass(frozen=True)
class Snapshot:
    revision: int
    configs: tuple
    models: tuple
    public_configs: tuple
    public_models: tuple

class ConfigCache:
    def __init__(self, database, settings):
        self.database, self.settings = database, settings
        self.lock = RLock()
        self.value = None
        self.expires = 0
        self.metrics = {"hits": 0, "misses": 0, "estimated_config_bytes": 0}
    def invalidate(self):
        with self.lock:
            self.expires = 0
    def get(self):
        with self.lock:
            if self.value is not None and monotonic() < self.expires:
                self.metrics["hits"] += 1
                return self.value
            self.metrics["misses"] += 1
            # Shared row lock keeps the version and definition read consistent
            # with writers. No transaction or ORM session survives this method.
            with self.database.sessions.begin() as session:
                revision = session.scalar(select(revision_table.c.revision).where(revision_table.c.id == 1).with_for_update(read=True))
                if revision is None:
                    raise RuntimeError("Run the separate shared configuration migrations first")
                if self.value is None or self.value.revision != revision:
                    configs = tuple(session.scalars(select(PipelineConfig).options(joinedload(PipelineConfig.det_model), joinedload(PipelineConfig.rec_model)).order_by(PipelineConfig.created_at, PipelineConfig.pipeline_id)))
                    models = tuple(session.scalars(select(OCRModel).order_by(OCRModel.id)))
                    public = tuple(config_json(c, self.settings) for c in configs)
                    public_models = tuple(model_json(m) for m in models)
                    import json
                    self.metrics["estimated_config_bytes"] += len(json.dumps([public, public_models]).encode())
                    session.expunge_all()
                    self.value = Snapshot(revision, configs, models, public, public_models)
            self.expires = monotonic() + self.settings.cache_ttl_seconds
            return self.value
