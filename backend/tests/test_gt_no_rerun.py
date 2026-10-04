from tests.test_dynamic_pipelines import integrated
from tests.test_global_layout import layout


def test_gt_confirmation_reuses_saved_predictions_without_gateway_calls(client, document, gateway):
    case, fields = layout(client, document)
    root = f"/api/test-cases/{case['id']}"
    created = client.post("/api/pipelines", json=integrated())
    assert created.status_code == 201, created.text
    response = client.post(root + "/run", json={"pipelines": [created.json()["pipeline_id"]]})
    assert response.status_code == 200, response.text
    runs = response.json()["runs"]
    assert all(run["status"] == "success" for run in runs)
    calls_after_run = len(gateway[1])
    assert calls_after_run > 0
    for i, field in enumerate(fields):
        response = client.put(root + f"/global-fields/{field['id']}/ground-truth", json={"ground_truth_raw": f"GT {i}"})
        assert response.status_code == 200, response.text
    response = client.put(root + "/ground-truth", json={"ground_truth_raw": "GT 0\nGT 1", "confirmed": False})
    assert response.status_code == 200, response.text
    response = client.put(root + "/evaluation-mode", json={"mode": "per_field"})
    assert response.status_code == 200, response.text
    for _ in range(2):
        response = client.post(root + "/evaluate", json={"mode": "auto", "global_field_ids": [f["id"] for f in fields], "require_complete_gt": True})
        assert response.status_code == 200, response.text
        saved = response.json()["runs"]
        assert [r["id"] for r in saved] == [r["id"] for r in runs]
        assert all(r["document_evaluation"] and all(f["evaluation"] for f in r["fields"]) for r in saved)
        assert len(gateway[1]) == calls_after_run
