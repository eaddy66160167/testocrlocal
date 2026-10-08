"""Loopback-only synthetic OCR backend for browser/load tests, never deployment."""
import tempfile
from pathlib import Path
import httpx
from fastapi.testclient import TestClient
from app.integrations.model_gateway import ModelGatewayClient
from app.local_first.main import create_app
from app.local_first.settings import LocalSettings
from app.local_first.database import metadata,revision_table
from tests.upstream_fixture import response
_directory=tempfile.TemporaryDirectory(prefix='ocr-synthetic-')
settings=LocalSettings(database_url=f"sqlite:///{(Path(_directory.name)/'shared.db').as_posix()}",cors_origins='http://127.0.0.1:3100',model_gateway_base_url='https://synthetic.invalid',model_gateway_api_key='synthetic-only',admin_token="synthetic-admin",requests_per_minute=1000,ocr_concurrency=10)
ModelGatewayClient._client=lambda self,timeout=None:httpx.AsyncClient(transport=httpx.MockTransport(response),timeout=timeout or 1)
app=create_app(settings)
metadata.create_all(app.state.database.engine)
with app.state.database.engine.begin() as c:c.execute(revision_table.insert().values(id=1,revision=1))
with TestClient(app) as client:
 for source in ('custom','official'):
  r=client.post('/api/pipelines',json={'name':f'Synthetic {source}','source':source,'execution_mode':'integrated'})
  assert r.status_code==201,r.text
