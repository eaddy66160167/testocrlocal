import asyncio
from copy import deepcopy

import httpx
import pytest
from PIL import Image

from app.db.models import OCRModel, PipelineConfig
from app.db.seed import seed_database
from app.pipelines.dynamic import DynamicDetectionRecognitionAdapter
from app.services.image_service import ImageService
from tests.test_benchmark_pipeline import fixtures, parts


def integrated(**changes):
    return {"name": "My OCR", "source": "custom", "execution_mode": "integrated",
            "version": "6", "det_weight": "baseline", "rec_weight": "thai_ft_v1", **changes}


def model(**changes):
    return {**dict(name="My REC", kind="rec", source="custom", version="5", weight="thai_ft_v2",
                single_path="/api/v1/text-recognitions?version=5&model=thai_ft_v2",
                batch_path="/api/v1/text-recognition-batches?version=5&model=thai_ft_v2"), **changes}


def test_create_edit_reload_custom_and_run_real_query(client, case, gateway):
    created = client.post("/api/pipelines", json=integrated())
    assert created.status_code == 201, created.text
    pipeline = created.json()
    pid = pipeline["pipeline_id"]
    result = client.post(f"/api/test-cases/{case['id']}/run", json={"pipelines": [pid]})
    assert result.status_code == 200, result.text
    run = result.json()["runs"][0]
    assert run["status"] == "success", run
    call = next(r for r in gateway[1] if r.url.path == "/api/v1/ocr-results")
    assert dict(call.url.params) == dict(engine="custom", version="6", det_model="baseline", rec_model="thai_ft_v1")
    assert parts(call)[0][0] == "image"
    assert run["pipeline_name"] == "My OCR"
    update = client.put(f"/api/pipelines/{pid}/definition", json=integrated(name="Edited", version="5", rec_weight="thai_ft_v2", enabled=False))
    assert update.status_code == 200
    saved = client.get(f"/api/pipelines/{pid}").json()
    assert saved["name"] == "Edited" and not saved["enabled"]
    assert saved["integrated_options"]["rec_weight"] == "thai_ft_v2"
    assert pipeline["pipeline_id"] in [p["pipeline_id"] for p in client.get("/api/pipelines").json()]
    assert "test-gateway-secret" not in str(saved)


def test_official_uses_original_paddle_settings(client, case, gateway):
    pid = client.post("/api/pipelines", json=integrated(source="official")).json()["pipeline_id"]
    response = client.post(f"/api/test-cases/{case['id']}/run", json={"pipelines": [pid]})
    assert response.json()["runs"][0]["status"] == "success"
    call = next(r for r in gateway[1] if r.url.path == "/api/v1/ocr-results")
    assert dict(call.url.params) == {"engine": "paddle"}
    fields = dict(parts(call))
    assert fields["text_det_unclip_ratio"] == b"1.7"
    assert fields["text_det_thresh"] == b"0.25"
    assert fields["text_det_box_thresh"] == b"0.6"


def test_official_cross_version_weights_survive_reload_and_reach_gateway(client, case, gateway):
    definition = integrated(source="official", paddle_model_defaults=False,
        det_version="6", rec_version="5", det_weight="baseline", rec_weight="my_finetune_v3")
    created = client.post("/api/pipelines", json=definition)
    assert created.status_code == 201, created.text
    pid = created.json()["pipeline_id"]
    saved = client.get(f"/api/pipelines/{pid}").json()["integrated_options"]
    assert saved["det_version"] == "6" and saved["rec_version"] == "5"
    assert saved["rec_weight"] == "my_finetune_v3"
    result = client.post(f"/api/test-cases/{case['id']}/run", json={"pipelines": [pid]})
    assert result.json()["runs"][0]["status"] == "success", result.text
    call = next(r for r in gateway[1] if r.url.path == "/api/v1/ocr-results")
    assert dict(call.url.params) == dict(engine="paddle", det_version="6", rec_version="5",
                                        det_model="baseline", rec_model="my_finetune_v3")
    assert client.put(f"/api/pipelines/{pid}/definition", json={**definition, "paddle_model_defaults": True}).status_code == 200
    gateway[1].clear()
    client.post(f"/api/test-cases/{case['id']}/run", json={"pipelines": [pid]})
    assert dict(gateway[1][-1].url.params) == {"engine": "paddle"}


@pytest.mark.parametrize("det_version,rec_version,det_weight,rec_weight", [
    ("6", "5", "baseline", "thai_ft_v1"),
    ("5", "6", "thai_ft_v2", "baseline"),
    ("5", "5", "default", "default"),
    ("6", "6", "thai_ft_v1", "thai_ft_v2"),
])
def test_saved_official_separate_selection_calls_combined_paddle_only(
    client, case, gateway, det_version, rec_version, det_weight, rec_weight,
):
    models = client.get("/api/pipelines/models").json()
    def selected(kind, version, weight):
        return next(m["id"] for m in models if m["source"] == "official" and
                    m["kind"] == kind and m["version"] == version and m["weight"] == weight)
    saved = client.post("/api/pipelines", json=dict(name="Saved official", source="official",
        execution_mode="det_rec", det_model_id=selected("det", det_version, det_weight),
        rec_model_id=selected("rec", rec_version, rec_weight)))
    assert saved.status_code == 201, saved.text
    gateway[1].clear()
    response = client.post(f"/api/test-cases/{case['id']}/run", json={"pipelines": [saved.json()["pipeline_id"]]})
    assert response.json()["runs"][0]["status"] == "success", response.text
    assert len(gateway[1]) == 1
    call = gateway[1][0]
    assert call.method == "POST" and call.url.path == "/api/v1/ocr-results"
    assert dict(call.url.params) == dict(engine="paddle", det_version=det_version, rec_version=rec_version,
        det_model="baseline" if det_weight == "default" else det_weight,
        rec_model="baseline" if rec_weight == "default" else rec_weight)
    assert "image" in dict(parts(call))


@pytest.mark.parametrize("changes", [dict(det_version="7"), dict(rec_version=None), dict(rec_weight="bad&engine=custom")])
def test_official_rejects_invalid_model_selection(client, changes):
    definition = integrated(source="official", paddle_model_defaults=False, det_version="6", rec_version="5")
    assert client.post("/api/pipelines", json={**definition, **changes}).status_code == 422


def test_registry_edit_is_used_by_rec_pipeline_and_preserves_runs(client, case, gateway):
    m = client.post("/api/pipelines/models", json=model())
    assert m.status_code == 201, m.text
    mid = m.json()["id"]
    definition = dict(name="REC", execution_mode="rec", source="custom", rec_model_id=mid)
    created = client.post("/api/pipelines", json=definition)
    assert created.status_code == 201, created.text
    pid = created.json()["pipeline_id"]
    gateway[0]["handler"] = lambda r: httpx.Response(200, json={
        "data": {"count": 1, "results": [{"text": "hello", "confidence": 0.9}]}, "meta": {},
    })
    first = client.post(f"/api/test-cases/{case['id']}/run", json={"pipelines": [pid]})
    assert first.json()["runs"][0]["status"] == "success", first.text
    assert dict(gateway[1][-1].url.params) == {"version": "5", "model": "thai_ft_v2"}
    assert [name for name, _ in parts(gateway[1][-1])] == ["images"]
    updated = client.put(f"/api/pipelines/models/{mid}", json=model(
        version="6", single_path="/api/v1/text-recognitions?version=6&model=thai_ft_v2",
        batch_path="/api/v1/text-recognition-batches?version=6&model=thai_ft_v2"))
    assert updated.status_code == 200, updated.text
    second = client.post(f"/api/test-cases/{case['id']}/run", json={"pipelines": [pid]})
    assert second.json()["runs"][0]["status"] == "success"
    assert gateway[1][-1].url.params["version"] == "6"
    history = client.get(f"/api/test-cases/{case['id']}").json()["runs"]
    versions = {r["raw_response"]["composition"]["recognition"]["version"] for r in history if r["pipeline_id"] == pid}
    assert versions == {"5", "6"}
    assert client.put(f"/api/pipelines/models/{mid}", json=model(source="official")).status_code == 409


def test_separate_models_have_independent_versions_weights_and_order(settings, gateway):
    det, rec = fixtures()
    original = deepcopy(det)
    gateway[0]["handler"] = lambda r: httpx.Response(200, json=det if "detection" in r.url.path else rec)
    cfg = PipelineConfig(pipeline_id="dynamic_test", name="Mixed versions", enabled=True,
        execution_mode="det_rec", source="custom",
        det_model=OCRModel(**model(kind="det", name="Detector", version="6", weight="thai_ft_v1",
            batch_path="/api/v1/text-detection-batches?version=6&model=thai_ft_v1")),
        rec_model=OCRModel(**model()))
    with Image.new("RGB", (1100, 1400), "white") as image:
        roi = dict(x1=20, y1=30, x2=1020, y2=1350)
        crop = ImageService(settings).canonical_crop(image, roi)
        result = asyncio.run(DynamicDetectionRecognitionAdapter(cfg, settings).run(original_image=image, cropped_image=crop, roi=roi))
    assert dict(gateway[1][0].url.params) == dict(version="6", model="thai_ft_v1")
    assert dict(gateway[1][1].url.params) == dict(version="5", model="thai_ft_v2")
    assert result.boxes[0]["polygon"][0] == [original["data"]["result"]["results"][0]["dt_polys"][0][0][0] + 20,
                                          original["data"]["result"]["results"][0]["dt_polys"][0][0][1] + 30]
    assert result.raw_response["composition"]["recognition"]["weight"] == "thai_ft_v2"


@pytest.mark.parametrize("path", ["https://evil.example/api/test", "//evil.example", "/api/../secret", "/api/test?api_key=secret", "/api/test?version=5&version=6", "/api/test?model=wrong"])
def test_invalid_model_paths_are_rejected(client, path):
    assert client.post("/api/pipelines/models", json=model(batch_path=path)).status_code == 422


def test_invalid_compositions_and_builtin_changes_rejected(client):
    models = client.get("/api/pipelines/models").json()
    rec = next(m for m in models if m["source"] == "custom" and m["kind"] == "rec")
    assert client.post("/api/pipelines", json=integrated(version="7")).status_code == 422
    assert client.post("/api/pipelines", json=dict(name="Bad", execution_mode="det_rec", source="custom", rec_model_id=rec["id"])).status_code == 422
    assert client.post("/api/pipelines", json=dict(name="Bad", execution_mode="rec", source="official", rec_model_id=rec["id"])).status_code == 422
    assert client.put("/api/pipelines/mint/definition", json=integrated()).status_code == 404


def test_delete_pipeline_preserves_history_and_does_not_reseed(client, case, settings):
    assert client.get("/api/pipelines").json() == []
    pid = client.post("/api/pipelines", json=integrated()).json()["pipeline_id"]
    response = client.post(f"/api/test-cases/{case['id']}/run", json={"pipelines": [pid]})
    assert response.status_code == 200
    before = client.get(f"/api/test-cases/{case['id']}").json()["runs"]
    assert client.delete(f"/api/pipelines/{pid}").status_code == 204
    assert client.get(f"/api/pipelines/{pid}").status_code == 404
    assert client.delete(f"/api/pipelines/{pid}").status_code == 404
    assert client.post(f"/api/test-cases/{case['id']}/run", json={"pipelines": [pid]}).status_code == 404
    assert client.get(f"/api/test-cases/{case['id']}").json()["runs"] == before
    with client.app.state.database.session_factory() as session:
        session.add(PipelineConfig(pipeline_id="mint", name="Legacy"))
        session.commit()
        seed_database(session, settings)
    assert client.get("/api/pipelines").json() == []
    assert client.get(f"/api/test-cases/{case['id']}").json()["runs"] == before


def test_readiness_does_not_claim_models_verified(client):
    pid = client.post("/api/pipelines", json=integrated()).json()["pipeline_id"]
    result = client.post(f"/api/pipelines/{pid}/test-connection")
    assert result.status_code == 200
    assert result.json()["status"] != "available"


def test_seed_preserves_user_edits(client, settings):
    m = client.get("/api/pipelines/models").json()[0]
    payload = {k: v for k, v in m.items() if k != "id"}
    payload["name"] = "Renamed model"
    assert client.put(f"/api/pipelines/models/{m['id']}", json=payload).status_code == 200
    with client.app.state.database.session_factory() as session:
        seed_database(session, settings)
    saved = client.get("/api/pipelines/models").json()
    assert next(x for x in saved if x["id"] == m["id"])["name"] == "Renamed model"


def test_official_catalog_has_both_versions_and_supports_all_combinations(client, settings):
    models = [m for m in client.get("/api/pipelines/models").json() if m["source"] == "official"]
    assert {(m["kind"], m["version"]) for m in models} == {
        ("det", "5"), ("det", "6"), ("rec", "5"), ("rec", "6"),
    }
    assert len(models) == 16
    for kind in ("det", "rec"):
        for version in ("5", "6"):
            assert {m["weight"] for m in models if m["kind"] == kind and m["version"] == version} == {
                "default", "baseline", "thai_ft_v1", "thai_ft_v2",
            }
    for m in models:
        stem = "text-detection" if m["kind"] == "det" else "text-recognition"
        query = f"version={m['version']}" + (f"&model={m['weight']}" if m["weight"] != "default" else "")
        assert m["single_path"] == f"/api/v1/{stem}s?{query}"
        assert m["batch_path"] == f"/api/v1/{stem}-batches?{query}"
    for det in (m for m in models if m["kind"] == "det"):
        for rec in (m for m in models if m["kind"] == "rec"):
            response = client.post("/api/pipelines", json=dict(name="Official pair", source="official",
                execution_mode="det_rec", det_model_id=det["id"], rec_model_id=rec["id"]))
            assert response.status_code == 201, response.text
    with client.app.state.database.session_factory() as session:
        seed_database(session, settings)
    reloaded = [m for m in client.get("/api/pipelines/models").json() if m["source"] == "official"]
    assert reloaded == models
