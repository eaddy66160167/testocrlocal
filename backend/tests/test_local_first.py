import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, select
from app.local_first.main import create_app
from app.local_first.settings import LocalSettings
from app.local_first.database import metadata, revision_table
@pytest.fixture
def local(tmp_path, gateway):
    settings = LocalSettings(database_url=f"sqlite:///{(tmp_path/'shared.db').as_posix()}", admin_token="isolated-test-admin", pipeline_mutations_public=False, model_gateway_base_url="https://gateway.example", model_gateway_api_key="test-gateway-secret", requests_per_minute=1000, ocr_concurrency=10)
    app = create_app(settings); metadata.create_all(app.state.database.engine)
    with app.state.database.engine.begin() as c: c.execute(revision_table.insert().values(id=1, revision=1))
    with TestClient(app) as client: yield client, app
AUTH = {"Authorization":"Bearer isolated-test-admin"}
def pipeline(client):
    response = client.post("/api/pipelines", headers=AUTH, json={"name":"synthetic","source":"custom","execution_mode":"integrated"})
    assert response.status_code == 201, response.text
    return response.json()["pipeline_id"]
def test_only_shared_schema_and_no_personal_routes(local):
    client, app = local
    assert set(inspect(app.state.database.engine).get_table_names()) == {"ocr_models","pipeline_configs","config_revision"}
    for path in ("/api/history","/api/documents","/api/matrix","/api/test-cases","/api/dataset/samples"): assert client.get(path).status_code == 404

def test_auth_revision_atomicity_and_etag(local):
    client, app = local
    assert client.post("/api/pipelines", json={"name":"x","source":"custom"}).status_code == 401
    pid = pipeline(client); response = client.get("/api/pipelines")
    assert response.headers["x-config-revision"] == "2"
    assert client.get("/api/pipelines", headers={"If-None-Match":response.headers["etag"]}).status_code == 304
    assert "isolated-test-admin" not in response.text and "test-gateway-secret" not in response.text
    assert client.put(f"/api/pipelines/{pid}/definition", headers=AUTH, json={"name":"bad","source":"custom","execution_mode":"rec","rec_model_id":"00000000-0000-0000-0000-000000000001"}).status_code == 404
    with app.state.database.sessions() as s: assert s.scalar(select(revision_table.c.revision)) == 2
    assert client.delete(f"/api/pipelines/{pid}", headers=AUTH).status_code == 204
    assert client.get("/api/config/version").json()["revision"] == 3

def test_cached_stateless_runs_zero_queries_and_repeat_ids(local, png):
    client, app = local; pid = pipeline(client); client.get("/api/pipelines"); before = app.state.database.metrics["queries"]
    def run(): return client.post("/api/ocr/execute", files={"file":("synthetic.png",png,"image/png")}, data={"options":'{"pipelines":["'+pid+'"],"pipeline_revision":2}'})
    a, b = run(), run(); assert a.status_code == b.status_code == 200, a.text
    assert a.json()["runs"][0]["status"] == "success"
    assert a.json()["runs"][0]["id"] != b.json()["runs"][0]["id"]
    assert app.state.database.metrics["queries"] == before
    assert client.post("/api/ocr/execute", files={"file":("fixture.png",png,"image/png")}, data={"options":'{"pipelines":["'+pid+'"],"pipeline_revision":1}'}).status_code == 409

def test_validation_and_limits(local, png):
    client, app = local; pid = pipeline(client)
    assert client.post("/api/ocr/execute", files={"file":("bad.png",b"not an image","image/png")}, data={"options":'{"pipelines":["'+pid+'"]}'}).status_code == 415
    response = client.post("/api/ocr/execute", files={"file":("synthetic.png",png,"image/png")}, data={"options":"SECRET-invalid-json"})
    assert response.status_code == 422 and "SECRET-invalid-json" not in response.text
    assert client.post("/api/ocr/execute", files={"file":("x.png",png,"image/png")}, data={"options":'{"pipelines":["'+pid+'"],"roi":{"x1":0,"y1":0,"x2":9999,"y2":1}}'}).status_code == 422

def test_settings_do_not_load_production_dotenv():
    with pytest.raises(ValueError): LocalSettings(database_url="")

def test_global_layout_stateless(local, png):
    import json
    client, app = local; pid = pipeline(client); client.get("/api/pipelines"); before = app.state.database.metrics["queries"]
    options = {"pipelines":[pid],"fields":[{"id":"00000000-0000-0000-0000-000000000001","field_index":1,"source":"manual","roi":{"x1":0,"y1":0,"x2":100,"y2":100}}]}
    response = client.post("/api/ocr/execute", files={"file":("synthetic.png",png,"image/png")}, data={"options":json.dumps(options)})
    assert response.status_code == 200, response.text
    assert response.json()["runs"][0]["fields"][0]["global_field_id"] == options["fields"][0]["id"]
    assert app.state.database.metrics["queries"] == before


def test_public_pipeline_management_as_requested(tmp_path, gateway):
    settings = LocalSettings(database_url=f"sqlite:///{(tmp_path/'public.db').as_posix()}", model_gateway_base_url="https://gateway.example")
    app = create_app(settings)
    metadata.create_all(app.state.database.engine)
    with app.state.database.engine.begin() as c:
        c.execute(revision_table.insert().values(id=1,revision=1))
    with TestClient(app) as client:
        created=client.post("/api/pipelines",json={"name":"public","source":"custom"})
        assert created.status_code == 201, created.text
        pid=created.json()["pipeline_id"]
        edited=client.put(f"/api/pipelines/{pid}/definition",json={"name":"renamed","source":"custom","enabled":False})
        assert edited.status_code == 200 and edited.json()["enabled"] is False
        assert client.delete(f"/api/pipelines/{pid}").status_code == 204
        assert client.get("/api/config/version").json()["revision"] == 4
        assert client.get("/api/admin/metrics").status_code == 503
