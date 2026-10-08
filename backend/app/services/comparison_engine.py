"""In-memory document-level decision support; eligibility belongs to MatrixService."""
from collections import defaultdict
from itertools import combinations
from random import Random
from statistics import fmean

MIN_PAIR_DOCS = 5
PAIR_TIE_PP = 0.05
BOOTSTRAP_SAMPLES = 2000
BOOTSTRAP_SEED = 20261006


def average(values):
    values = list(values)
    return fmean(values) if values else None


def bootstrap_ci(differences):
    """Resample compact distinct-Document values, never ORM objects or pages."""
    rng = Random(BOOTSTRAP_SEED)
    values = sorted(fmean(rng.choices(differences, k=len(differences)))
                    for _ in range(BOOTSTRAP_SAMPLES))

    def percentile(q):
        position = (len(values) - 1) * q
        lo = int(position)
        return values[lo] + (values[min(lo + 1, len(values) - 1)] - values[lo]) * (position - lo)

    return [percentile(.025), percentile(.975)]


def pairwise(records, a, b):
    documents = defaultdict(list)
    case_ids = []
    for record in records:
        points = record["points"]
        if a in points and b in points:
            documents[record["document_id"]].append((points[a]["cer"] * 100, points[b]["cer"] * 100))
            case_ids.append(record["id"])
    values = [(average(x[0] for x in documents[d]), average(x[1] for x in documents[d]))
              for d in sorted(documents)]
    differences = [x - y for x, y in values]
    ci = bootstrap_ci(differences) if len(values) >= MIN_PAIR_DOCS else None
    winner = a if ci and ci[1] < 0 else b if ci and ci[0] > 0 else None
    return dict(a=a, b=b, documents=len(values), test_cases=len(case_ids),
                mean_cer_a=average(x / 100 for x, _ in values),
                mean_cer_b=average(y / 100 for _, y in values),
                mean_dcer_pp=average(differences), ci95_pp=ci,
                wins=sum(d <= -PAIR_TIE_PP for d in differences),
                ties=sum(abs(d) < PAIR_TIE_PP for d in differences),
                losses=sum(d >= PAIR_TIE_PP for d in differences), winner=winner,
                verdict="insufficient" if ci is None else "clear" if winner else "inconclusive")


def rank_active(identities, pairs):
    rows = []
    for identity in identities:
        pid = identity["pipeline_id"]
        selected = [p for p in pairs if pid in (p["a"], p["b"])]
        score = sum(1 if p["winner"] == pid else -1 for p in selected if p["winner"])
        differences = [p["mean_dcer_pp"] * (1 if p["a"] == pid else -1)
                       for p in selected if p["documents"] >= MIN_PAIR_DOCS]
        rows.append(dict(**identity, score=score, mean_pair_dcer_pp=average(differences)))
    rows.sort(key=lambda p: (-p["score"], p["mean_pair_dcer_pp"]
                            if p["mean_pair_dcer_pp"] is not None else float("inf"),
                            p["pipeline_name"], p["pipeline_id"]))
    return rows


def recommend(ranking, pairs):
    if len(ranking) < 2:
        return None, None
    top, runner = (r["pipeline_id"] for r in ranking[:2])
    featured = next(p for p in pairs if {p["a"], p["b"]} == {top, runner})
    has_loss = any(p["winner"] and p["winner"] != top for p in pairs if top in (p["a"], p["b"]))
    unique_score = all(ranking[0]["score"] > r["score"] for r in ranking[1:])
    return (top if unique_score and not has_loss and featured["winner"] == top else None), featured


def readiness(records, featured):
    reasons = dict(missing_gt=0, not_run=0, failed=0, other=0)
    paired = []
    if featured:
        ids = [featured["a"], featured["b"]]
        for r in records:
            if all(i in r["points"] for i in ids):
                paired.append(r)
            elif not r["confirmed_gt"]:
                reasons["missing_gt"] += 1
            elif any(i not in r["runs"] for i in ids):
                reasons["not_run"] += 1
            elif any(r["runs"][i] != "success" for i in ids):
                reasons["failed"] += 1
            else:
                reasons["other"] += 1
    return dict(x=len(paired), y=len(records), documents=len({r["document_id"] for r in paired}),
                reasons=reasons, valid_pair=featured is not None,
                reason=None if featured else "ต้องมี Pipeline ที่ใช้งานอยู่อย่างน้อยสองตัวในขอบเขตนี้")


def descriptive(records, pid):
    docs = defaultdict(list)
    times = []
    for r in records:
        if pid in r["points"]:
            p = r["points"][pid]
            docs[r["document_id"]].append(p["cer"])
            if p["time_ms"] is not None:
                times.append(p["time_ms"])
    return dict(cer=average(average(v) for v in docs.values()), documents=len(docs),
                timed_runs=len(times), time_seconds=average(t / 1000 for t in times))


def scatter(records, active, displayed):
    ids = [p["pipeline_id"] for p in active]
    common = [r for r in records if ids and all(pid in r["points"] for pid in ids)]
    common_docs = len({r["document_id"] for r in common})
    matched = len(ids) >= 2 and common_docs >= MIN_PAIR_DOCS
    points = []
    for identity in displayed:
        values = descriptive(common if matched and identity["active"] else records, identity["pipeline_id"])
        points.append(dict(**identity, **values, cohort_mode="common" if matched and identity["active"] else "own",
                           filled=identity["active"] and values["documents"] >= MIN_PAIR_DOCS
                           and values["timed_runs"] >= MIN_PAIR_DOCS, pareto=False))
    comparable = [p for p in points if p["active"]]
    valid = matched and all(p["time_seconds"] is not None for p in comparable)
    if valid:
        for p in comparable:
            p["pareto"] = not any(q["cer"] <= p["cer"] and q["time_seconds"] <= p["time_seconds"]
                                  and (q["cer"] < p["cer"] or q["time_seconds"] < p["time_seconds"])
                                  for q in comparable if q is not p)
    return dict(points=points, common_test_cases=len(common), common_documents=common_docs,
                cohort_mode="common" if matched else "own", pareto_valid=valid)


def decide(records, identities, include_archived=False):
    active = [p for p in identities if p["active"]]
    displayed = identities if include_archived else active
    pairs = [pairwise(records, a["pipeline_id"], b["pipeline_id"]) for a, b in combinations(active, 2)]
    ranking = rank_active(active, pairs)
    recommendation, featured = recommend(ranking, pairs)
    historical = [pairwise(records, a["pipeline_id"], b["pipeline_id"])
                  for a, b in combinations(displayed, 2) if not (a["active"] and b["active"])] if include_archived else []
    return dict(recommendation=recommendation, ranking=ranking, featured_pair=featured, pairs=pairs,
                historical_pairs=historical, readiness=readiness(records, featured),
                scatter=scatter(records, active, displayed), documents=len({r["document_id"] for r in records}),
                cells=[dict(**p, **descriptive(records, p["pipeline_id"])) for p in displayed])


def actions(records, active, groups):
    missing_gt = sum(not r["confirmed_gt"] for r in records)
    missing_runs = []
    failed_runs = []
    for p in active:
        pid = p["pipeline_id"]
        missing_runs.append(dict(**p, count=sum(pid not in r["runs"] and any(i in r["runs"] for i in
                                  [q["pipeline_id"] for q in active if q["pipeline_id"] != pid]) for r in records)))
        failed_runs.append(dict(**p, count=sum(r["runs"].get(pid) not in (None, "success") for r in records)))
    hard = []
    for r in records:
        cers = [r["points"][p["pipeline_id"]]["cer"] for p in active if p["pipeline_id"] in r["points"]]
        if cers:
            hard.append(dict(test_case_id=r["id"], filename=r["filename"], href=f"/test/{r['id']}",
                             spread=max(cers) - min(cers) if len(cers) >= 2 else None, best_cer=min(cers)))
    return dict(missing_gt=missing_gt, missing_runs=missing_runs, failed_runs=failed_runs,
                short_types=[dict(code=g["code"], name=g["name"], documents=g["eligible_documents"],
                                  needed=max(0, MIN_PAIR_DOCS-g["eligible_documents"]))
                             for g in groups if g["eligible_documents"] < MIN_PAIR_DOCS],
                largest_spread=sorted((h for h in hard if h["spread"] is not None),
                                      key=lambda h: (-h["spread"], h["test_case_id"]))[:5],
                hardest=sorted(hard, key=lambda h: (-h["best_cer"], h["test_case_id"]))[:5])
