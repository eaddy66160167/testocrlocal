from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.db.models import GlobalField, Metric, OCRField, PipelineRun
from app.db.models import TestCase as CaseRecord
from app.schemas.contracts import BenchmarkFilters
from app.services.matrix_service import MatrixService

STAMP = datetime(2026, 9, 29, tzinfo=timezone.utc)


def add_case(session, document, *, truth="ก", status="confirmed", workflow="legacy", day=0):
    case = CaseRecord(document_id=document["id"], ground_truth_raw=truth, status=status,
                    workflow=workflow, created_at=STAMP + timedelta(days=day))
    session.add(case)
    session.flush()
    return case


def add_run(case, pipeline="retired", *, cer=0.0, time=1000, day=0, status="success", archived=False):
    run = PipelineRun(pipeline_id=pipeline, pipeline_name=f"Snapshot {pipeline}", status=status,
                      crop_stage="global_fields", processing_time_ms=time, gateway_duration_ms=20,
                      confidence=.9, created_at=STAMP + timedelta(days=day), archived=archived)
    if cer is not None:
        run.metric_records.append(Metric(text_kind="final", cer=cer, wer=cer, exact_match=cer == 0,
                                         created_at=STAMP + timedelta(days=day)))
    case.runs.append(run)
    return run


def test_continuity_counts_coverage_and_provenance(client, document):
    with client.app.state.database.session_factory() as session:
        first = add_case(session, document)
        add_run(first, "retired", cer=.8, day=-1)  # rerun never adds weight
        final = add_run(first, "retired", cer=.2)
        add_run(first, "other", cer=.4)
        second = add_case(session, document, status="tested")
        add_run(second, cer=0)
        add_case(session, document, status="draft")
        session.commit()
        service = MatrixService(session)
        rows = service.matrix(BenchmarkFilters())
        summary = service.summary(BenchmarkFilters())
        raw = service.latest(service.repository.cases(BenchmarkFilters()))
        assert len(raw) == sum(r["tests"] for r in rows) == summary["latest_results"] == 3
        assert summary["test_cases"] == 3 and summary["evaluated_cases"] == 1
        assert summary["evaluated_results"] == sum(r["evaluated_runs"] for r in rows) == 2
        assert summary["coverage"] == 1 / 3
        assert summary["lowest_cer"]["run_id"] == final.id
        assert summary["lowest_cer"]["test_case_id"] == first.id
        assert summary["lowest_cer"]["retired"]
        assert summary["lowest_cer"]["href"] == f"/test/{first.id}"
        for row in rows:
            if row["cer"] is not None:
                assert row["min_cer"] <= row["cer"] <= row["max_cer"]
        assert all(r["retired"] for r in rows)
        assert summary["fastest"] is None
    assert len(client.get("/api/analytics/pipelines").json()) == 2
    assert len(client.get("/api/history").json()) == 2


@pytest.mark.parametrize("truth,confirmed,eligible", [("7", True, True), ("ก", True, True),
    (" \r\n\t ", True, False), ("7", False, False)])
def test_gt_uses_existing_normalization_without_length_threshold(client, document, truth, confirmed, eligible):
    with client.app.state.database.session_factory() as session:
        case = add_case(session, document, truth=truth, status="confirmed" if confirmed else "tested")
        add_run(case)
        session.commit()
        assert MatrixService(session).summary(BenchmarkFilters())["evaluated_results"] == int(eligible)


def test_subset_run_metric_and_newest_evaluation_tie(client, document):
    with client.app.state.database.session_factory() as session:
        case = add_case(session, document, workflow="global")
        case.global_fields = [GlobalField(field_index=i, roi={}, source="manual") for i in (1, 2)]
        run = add_run(case, cer=.25)
        run.fields = [OCRField(field_index=1, geometry={}, ocr_text="7", ground_truth_raw="7",
                              confirmed_at=STAMP, evaluation={"cer": 0, "evaluated_at": STAMP.isoformat()}),
                      OCRField(field_index=2, geometry={}, ocr_text="unknown")]
        other = add_case(session, document, workflow="global")
        newer = add_run(other, "other", cer=.25, day=-1)
        newer.fields = [OCRField(field_index=1, geometry={}, ocr_text="ก", ground_truth_raw="ก",
            confirmed_at=STAMP, evaluation={"cer": 0, "evaluated_at": (STAMP + timedelta(days=2)).isoformat()})]
        session.commit()
        summary = MatrixService(session).summary(BenchmarkFilters())
        assert summary["evaluated_results"] == 2  # other layout field need not be confirmed
        assert summary["lowest_cer"]["cer"] == .25  # final run metric, never field minimum
        assert summary["lowest_cer"]["run_id"] == newer.id
        assert summary["lowest_cer_ties"] == 1
        assert summary["lowest_cer"]["date_source"] == "evaluation"


def test_whole_completeness_and_legacy_date_fallback(client, document):
    with client.app.state.database.session_factory() as session:
        case = add_case(session, document, workflow="global")
        case.evaluation_mode = "whole_document"
        case.document_gt_confirmed_at = STAMP
        field = GlobalField(id=str(uuid4()), field_index=1, roi={}, source="manual")
        case.global_fields.append(field)
        run = add_run(case)
        run.document_evaluation = {"cer": 0}
        session.commit()
        assert MatrixService(session).summary(BenchmarkFilters())["evaluated_results"] == 0
        run.fields.append(OCRField(field_index=1, global_field_id=field.id, geometry={}, ocr_text="ก"))
        session.commit()
        assert MatrixService(session).summary(BenchmarkFilters())["evaluated_results"] == 1
        metric = run.metric_records[0]
        metric.created_at = None  # genuinely missing legacy timestamp, evaluated in memory
        evaluation = MatrixService.evaluation(case, run)
        assert evaluation[2] == "run" and evaluation[1] == run.created_at
        session.rollback()


def test_fastest_threshold_latest_failures_and_archived_runs(client, document):
    with client.app.state.database.session_factory() as session:
        for i in range(5):
            case = add_case(session, document, day=i)
            add_run(case, "qualified", time=1000 + i * 100)
            add_run(case, "superseded", time=10)
            add_run(case, "superseded", day=1, status="error")
            add_run(case, "archived", time=1, archived=True)
            if i < 4:
                add_run(case, "small", time=5)
        session.commit()
        service = MatrixService(session)
        summary = service.summary(BenchmarkFilters())
        assert summary["fastest"]["pipeline_id"] == "qualified"
        assert summary["fastest"]["timed_runs"] == 5
        assert summary["fastest"]["avg_time_ms"] == 1200
        assert "archived" not in {r["pipeline_id"] for r in service.matrix(BenchmarkFilters())}
        assert service.summary(BenchmarkFilters(pipeline="small"))["fastest"] is None


def test_business_scope_date_and_category_ranking(client, document):
    types = client.get("/api/document-types").json()
    type_id = types[0]["id"]
    with client.app.state.database.session_factory() as session:
        case = add_case(session, document)
        case.document.document_type_id = type_id
        case.categories = [MatrixService(session).repository.categories(["thai_text"])[0]]
        add_run(case)
        session.commit()
    filtered = client.get("/api/analytics/summary", params={"document_type_id": type_id, "category": "thai_text",
                         "date_from": "2026-09-29", "date_to": "2026-09-29"}).json()
    assert filtered["test_cases"] == 1 and filtered["date_basis"] == "test_case_created_at"
    category = client.get("/api/analytics/categories", params={"category": "thai_text"}).json()[0]
    assert category["evaluated_results"] == 1 and category["best_pipeline"] is None
    assert client.get("/api/history", params={"document_type_id": str(uuid4())}).json() == []


def test_group_winner_requires_five_distinct_cases_and_current_config_is_not_retired(client, document):
    pipeline = client.post("/api/pipelines", json={"name":"Current disabled", "source":"custom",
        "execution_mode":"integrated", "version":"6", "det_weight":"baseline", "rec_weight":"baseline",
        "enabled":False}).json()["pipeline_id"]
    with client.app.state.database.session_factory() as session:
        category = MatrixService(session).repository.categories(["thai_text"])[0]
        for i in range(5):
            case = add_case(session, document)
            case.categories = [category]
            add_run(case, pipeline, cer=.2)
            add_run(case, pipeline, cer=.1, day=1)
            if i < 4:
                add_run(case, "small", cer=0)
        session.commit()
    group = client.get("/api/analytics/categories", params={"category":"thai_text"}).json()[0]
    assert group["evaluated_cases"] == 5 and group["evaluated_results"] == 9
    assert group["best_pipeline"]["pipeline_id"] == pipeline
    assert group["best_pipeline"]["evaluated_runs"] == 5
    assert group["best_pipeline"]["retired"] is False


def test_logs_historical_snapshot_partial_search_and_deleted_reference(client, document):
    from app.db.models import AppLog
    with client.app.state.database.session_factory() as session:
        case = add_case(session, document)
        add_run(case, "retired")
        session.flush()
        session.add_all([
            AppLog(level="INFO",event_type="ocr_run_success",message="OCR สำเร็จ", test_case_id=case.id,
                   document_id=document["id"],pipeline_id="retired",details={"duration_ms":3800}),
            AppLog(level="ERROR",event_type="ocr_run_error",message="OCR ผิดพลาด",test_case_id=str(uuid4()),
                   document_id=document["id"],pipeline_id="retired",details={"error_code":"UPSTREAM"}),
        ])
        session.commit()
    results = client.get("/api/logs",params={"q":"snap retired"}).json()
    # Even historical rows remain private and are not queried by the disabled route.
    assert results == {"enabled": False, "total": 0, "items": []}
    assert client.get("/api/logs", params={"q":"%_"}).json() == results
