from alembic import context
from sqlalchemy import create_engine
from app.local_first.database import metadata
from app.local_first.settings import LocalSettings
config = context.config
if context.is_offline_mode():
    raise RuntimeError("Use an explicit testing database connection for shared migrations")
engine = create_engine(LocalSettings().sqlalchemy_url, hide_parameters=True)
with engine.connect() as connection:
    context.configure(connection=connection, target_metadata=metadata, version_table="alembic_version_shared")
    with context.begin_transaction(): context.run_migrations()
engine.dispose()
