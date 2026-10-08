from copy import deepcopy

import pytest
from sqlalchemy import event

from app.db.models import DocumentType
from app.schemas.contracts import BenchmarkFilters
from app.services.comparison_engine import (
    BOOTSTRAP_SAMPLES,
    MIN_PAIR_DOCS,
    PAIR_TIE_PP,
    actions,
    bootstrap_ci,
    decide,
    descriptive,
    pairwise,
    rank_active,
    readiness,
    recommend,
)
from app.services.matrix_service import MatrixService
from tests.test_analytics_scope import add_case, add_run
from tests.test_dynamic_pipelines import integrated


def identity(pid, active=True):
    return dict(pipeline_id=pid, pipeline_name=pid, active=active, retired=not active)


def record(doc, cers, *, case=None, gt=True, runs=None, time=1000):
    return dict(id=case or doc, document_id=doc, filename="synthetic.png", confirmed_gt=gt,
                runs=runs if runs is not None else {p: "success" for p in cers},
                points={p: dict(cer=c, time_ms=time) for p, c in cers.items()})


def cohort(n=5):
    return [record(str(i), {"a": .01, "b": .03}) for i in range(n)]


def test_pair_intersection_and_document_unweighted_means():
    records = [record("pdf", {"a": .1, "b": .3}, case="p1"),
               record("pdf", {"a": .3, "b": .5}, case="p2"),
               record("img", {"a": .8, "b": .9}), record("a-only", {"a": 0}),
               record("b-only", {"b": 1})]
    pair = pairwise(records, "a", "b")
    assert pair["documents"] == 2 and pair["test_cases"] == 3
    assert pair["mean_cer_a"] == pytest.approx(.5)
    assert pair["mean_cer_b"] == pytest.approx(.65)
    assert pair["mean_dcer_pp"] == pytest.approx(-15)
    assert pair["winner"] is None and pair["ci95_pp"] is None


def test_twenty_page_pdf_is_one_document_not_twenty_samples():
    pair = pairwise([record("pdf", {"a": 0, "b": .5}, case=str(i)) for i in range(20)], "a", "b")
    assert pair["test_cases"] == 20 and pair["documents"] == 1
    assert pair["verdict"] == "insufficient" and pair["wins"] == 1


@pytest.mark.parametrize("difference,ties", [(-.0501, 0), (-.05, 0), (-.0499, 1),
                                            (0, 1), (.0499, 1), (.05, 0), (.0501, 0)])
def test_tie_strict_boundary(difference, ties):
    p = pairwise([record("d", {"a": max(difference, 0) / 100,
                               "b": max(-difference, 0) / 100})], "a", "b")
    assert PAIR_TIE_PP == .05 and p["ties"] == ties
    assert p["wins"] + p["ties"] + p["losses"] == 1


@pytest.mark.parametrize("n,verdict", [(0, "insufficient"), (4, "insufficient"), (5, "clear")])
def test_minimum_and_negative_ci(n, verdict):
    p = pairwise(cohort(n), "a", "b")
    assert MIN_PAIR_DOCS == 5 and p["verdict"] == verdict
    assert p["winner"] == ("a" if n >= 5 else None)


def test_positive_zero_and_crossing_ci():
    assert pairwise(cohort(), "b", "a")["winner"] == "a"
    assert pairwise([record(str(i), {"a": .1, "b": .1}) for i in range(5)], "a", "b")["winner"] is None
    p = pairwise([record(str(i), {"a": .1 if i % 2 else .3, "b": .2}) for i in range(8)], "a", "b")
    assert p["ci95_pp"][0] < 0 < p["ci95_pp"][1] and p["verdict"] == "inconclusive"


def test_document_bootstrap_deterministic_and_page_replication_invariant():
    assert BOOTSTRAP_SAMPLES == 2000
    assert bootstrap_ci([-2, 0, 1, 3, 5]) == bootstrap_ci([-2, 0, 1, 3, 5])
    records = cohort()
    before = pairwise(records, "a", "b")
    records += [record("0", {"a": .01, "b": .03}, case=f"extra-{i}") for i in range(20)]
    after = pairwise(records, "a", "b")
    assert after["documents"] == before["documents"]
    assert after["ci95_pp"] == before["ci95_pp"]


def test_rank_scores_deterministic_and_recommendation_abc():
    ids = [identity("a"), identity("b"), identity("c")]
    records = [record(str(i), {"a": 0, "b": .02, "c": .04}) for i in range(5)]
    d = decide(records, ids)
    assert [(r["pipeline_id"], r["score"]) for r in d["ranking"]] == [("a", 2), ("b", 0), ("c", -2)]
    assert d["recommendation"] == "a"
    assert decide(records, ids)["ranking"] == d["ranking"]
    tied = decide([record(str(i), {"a": .1, "b": .1}) for i in range(5)], ids[:2])
    assert tied["recommendation"] is None and all(r["score"] == 0 for r in tied["ranking"])
    assert decide(cohort(4), ids[:2])["recommendation"] is None


def test_top_score_cannot_recommend_after_any_clear_loss():
    ids = [identity(p) for p in "abcde"]
    pairs = []
    for i, a in enumerate("abcde"):
        for b in "abcde"[i+1:]:
            winner = ("a" if a == "a" and b != "e" else "e" if (a, b) == ("a", "e") else None)
            pairs.append(dict(a=a, b=b, winner=winner, documents=5, mean_dcer_pp=-1))
    ranking = rank_active(ids, pairs)
    assert ranking[0]["pipeline_id"] == "a" and ranking[0]["score"] == 2
    assert recommend(ranking, pairs)[0] is None


def test_unique_score_without_clear_runner_up_win_is_not_recommendation():
    pairs = [dict(a="a", b="b", winner=None, documents=5, mean_dcer_pp=-1),
             dict(a="a", b="c", winner="a", documents=5, mean_dcer_pp=-2),
             dict(a="b", b="c", winner=None, documents=5, mean_dcer_pp=-1)]
    ranking = rank_active([identity(p) for p in "abc"], pairs)
    assert ranking[0]["score"] == 1 and ranking[1]["score"] == 0
    assert recommend(ranking, pairs)[0] is None


def test_empty_or_single_active_has_no_pair_or_recommendation():
    for ids in [[], [identity("a")]]:
        result = decide(cohort(), ids)
        assert result["recommendation"] is None and result["featured_pair"] is None
        assert not result["readiness"]["valid_pair"]


@pytest.mark.parametrize("include", [False, True])
def test_archived_display_never_changes_current_decisions(include):
    records = cohort()
    for r in records:
        r["points"]["retired"] = dict(cer=0, time_ms=1)
    ids = [identity("a"), identity("b"), identity("retired", False)]
    reference, current = decide(records, ids), decide(records, ids, include)
    for key in ["recommendation", "ranking", "featured_pair", "readiness"]:
        assert current[key] == reference[key]
    assert current["recommendation"] == "a" and len(current["pairs"]) == 1
    assert all(not p["filled"] and not p["pareto"] for p in current["scatter"]["points"] if not p["active"])


def test_readiness_exclusive_precedence_and_sum():
    records = [record("paired", {"a": 0, "b": 0}), record("gt", {}, gt=False, runs={"a": "error"}),
               record("missing", {}, runs={"a": "error"}),
               record("failed", {}, runs={"a": "error", "b": "success"}),
               record("other", {}, runs={"a": "success", "b": "success"})]
    r = readiness(records, dict(a="a", b="b"))
    assert r["x"] == 1 and r["y"] == 5 and r["documents"] == 1
    assert r["reasons"] == dict(missing_gt=1, not_run=1, failed=1, other=1)
    assert sum(r["reasons"].values()) == r["y"] - r["x"]
    assert not readiness(records, None)["valid_pair"]


def test_scatter_common_only_pareto_and_fill():
    ids = [identity("a"), identity("b")]
    d = decide(cohort(), ids)
    assert d["scatter"]["pareto_valid"] and d["scatter"]["cohort_mode"] == "common"
    assert d["scatter"]["common_documents"] == 5
    own = decide([record(str(i), {"a": .1}) for i in range(5)] +
                 [record(f"other{i}", {"b": .2}) for i in range(5)], ids)
    assert not own["scatter"]["pareto_valid"] and own["featured_pair"]["winner"] is None
    assert not any(p["pareto"] for p in own["scatter"]["points"])
    assert not any(p["filled"] for p in decide(cohort(4), ids)["scatter"]["points"])
    no_time = deepcopy(cohort())
    for r in no_time:
        r["points"]["b"]["time_ms"] = None
    assert not decide(no_time, ids)["scatter"]["pareto_valid"]


def test_descriptive_documents_and_real_actions():
    records = [record("pdf", {"a": .1}, case="1"), record("pdf", {"a": .3}, case="2"),
               record("img", {"a": .8}), record("gt", {}, gt=False)]
    cell = descriptive(records, "a")
    assert cell["cer"] == pytest.approx(.5) and cell["documents"] == 2
    a = actions(records, [identity("a"), identity("b")], [])
    assert a["missing_gt"] == 1
    assert a["missing_runs"][1]["count"] == 3
    assert all(c["href"].startswith("/test/") for c in a["hardest"])


def test_endpoint_types_archived_unassigned_accounting_and_no_drift(client, document, png):
    pid = client.post("/api/pipelines", json=integrated(name="Active A")).json()["pipeline_id"]
    qid = client.post("/api/pipelines", json=integrated(name="Active B")).json()["pipeline_id"]
    docs = [document]
    docs.extend(client.post("/api/documents", files={"file": (f"synthetic-{i}.png", png, "image/png")}).json()
                for i in range(4))
    with client.app.state.database.session_factory() as session:
        archived = DocumentType(name="Archived business", normalized_name="archived business", active=False, system=False)
        session.add(archived)
        session.flush()
        for i, doc in enumerate(docs):
            case = add_case(session, doc)
            if i == 0:
                case.document.document_type_id = archived.id
            add_run(case, pid, cer=.1)
            add_run(case, qid, cer=.3)
            add_run(case, "retired", cer=0)
        session.commit()
        statements = []
        event.listen(session.bind, "before_cursor_execute", lambda *args: statements.append(args[2]))
        svc = MatrixService(session)
        decision = svc.decision(BenchmarkFilters(), True)
        assert len(statements) < 30  # Queries do not scale with 2000 bootstrap resamples.
        assert decision["computation_ms"] < 3000
        assert decision["overall"]["recommendation"] == pid
        assert decision["by_type"][0]["decision"] == decision["overall"]
        assert sum(g["documents"] for g in decision["by_type"][1:]) == decision["overall"]["documents"]
        assert any(g["code"] == "unassigned" for g in decision["by_type"])
        assert any(g["archived"] and g["name"] == "Archived business" for g in decision["by_type"])
        assert decision["latest_results"] == sum(r["tests"] for r in svc.matrix(BenchmarkFilters()))
    r = client.get("/api/analytics/comparison").json()
    old = client.get("/api/analytics/comparison?include_archived=1").json()
    for key in ["recommendation", "ranking", "featured_pair", "readiness"]:
        assert r["overall"][key] == old["overall"][key]
    assert r["by_type"][0]["decision"] == r["overall"]
    assert all(c["documents"] >= 0 for g in old["by_type"] for c in g["decision"]["cells"])
