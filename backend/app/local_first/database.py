from sqlalchemy import BigInteger, Column, Integer, MetaData, Table, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from app.db.models import OCRModel, PipelineConfig

metadata = MetaData()
# Copy only these two configuration tables. No personal-data table can migrate.
OCRModel.__table__.to_metadata(metadata)
PipelineConfig.__table__.to_metadata(metadata)
revision_table = Table("config_revision", metadata,
    Column("id", Integer, primary_key=True), Column("revision", BigInteger, nullable=False))

class MutationSession(Session):
    def commit(self):
        # Existing config services call commit; the outer transaction owns the
        # actual commit so configuration and revision change atomically.
        self.flush()

class SharedDatabase:
    def __init__(self, settings):
        url = settings.sqlalchemy_url
        kwargs = {"pool_pre_ping": True, "hide_parameters": True}
        if url.startswith("sqlite"):
            kwargs["connect_args"] = {"check_same_thread": False}
        else:
            kwargs.update(pool_size=settings.pool_size, max_overflow=settings.pool_overflow,
                          pool_timeout=10, pool_recycle=1800, connect_args={"connect_timeout": 10})
        self.engine = create_engine(url, **kwargs)
        self.sessions = sessionmaker(self.engine, expire_on_commit=False)
        self.mutations = sessionmaker(self.engine, class_=MutationSession, expire_on_commit=False)
        self.metrics = {"queries": 0, "connections_opened": 0}
        event.listen(self.engine, "before_cursor_execute", self._query)
        event.listen(self.engine, "connect", self._connect)
    def _query(self, *args):
        self.metrics["queries"] += 1
    def _connect(self, *args):
        self.metrics["connections_opened"] += 1
