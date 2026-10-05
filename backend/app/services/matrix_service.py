from datetime import datetime, timezone
from statistics import fmean

from sqlalchemy import select

from app.db.models import DocumentType, PipelineRun
from app.repositories.benchmark_repository import BenchmarkRepository
from app.services.metrics_service import normalize_text


def mean_present(values):
    present = [value for value in values if value is not None]
    return fmean(present) if present else None


def timestamp(value):
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value


class MatrixService:
    """Read-only analytics. Each case/pipeline contributes its latest eligible run."""

    minimum_samples = 5

    def __init__(self, session):
        self.repository = BenchmarkRepository(session)
        self._configs = None

    def configs(self):
        if self._configs is None:
            self._configs = self.repository.configs()
        return self._configs

    @staticmethod
    def eligible(run):
        return not run.archived and not (
            run.pipeline_id == "hutch_full" and run.crop_stage not in {"full_image", "global_fields", "app_crop"}
        )

    def latest(self, cases, pipeline=None):
        pairs = []
        for case in cases:
            latest = {}
            for run in case.runs:
                if not self.eligible(run) or (pipeline and run.pipeline_id != pipeline):
                    continue
                old = latest.get(run.pipeline_id)
                if old is None or (run.created_at, run.id) > (old.created_at, old.id):
                    latest[run.pipeline_id] = run
            pairs.extend((case, run) for run in latest.values())
        return pairs

    @staticmethod
    def evaluation(case, run):
        metric = next((m for m in run.metric_records if m.text_kind == "final"), None)
        if run.status != "success" or metric is None or metric.cer is None:
            return None
        dates = []
        if case.workflow == "global":
            if case.evaluation_mode == "whole_document":
                snapshot = run.document_evaluation or {}
                complete = {f.global_field_id for f in run.fields if f.status == "success"} == {
                    f.id for f in case.global_fields
                }
                if not (case.document_gt_confirmed_at and normalize_text(case.ground_truth_raw or "")
                        and snapshot and complete):
                    return None
                dates = [timestamp(snapshot.get("evaluated_at"))]
            else:
                # Preserve the existing confirmed Sub-field subset semantics.
                confirmed = [f for f in run.fields if f.confirmed_at and f.evaluation]
                if not confirmed or not all(normalize_text(f.ground_truth_raw or "") for f in confirmed):
                    return None
                dates = [timestamp(f.evaluation.get("evaluated_at")) for f in confirmed]
        elif not (case.status == "confirmed" and normalize_text(case.ground_truth_raw or "")):
            return None
        dates = [d for d in dates if d is not None]
        # Metric.created_at records evaluation creation, but is not updated on recompute.
        # An explicit evaluation timestamp therefore always takes precedence.
        date = max(dates) if dates else timestamp(metric.created_at)
        source = "evaluation" if dates else "metric" if date else "run"
        return metric, date or timestamp(run.created_at), source

    def identities(self, cases):
        identities = {c.pipeline_id: dict(pipeline_id=c.pipeline_id, pipeline_name=c.name, retired=False)
                      for c in self.configs()}
        for _, run in sorted(self.latest(cases), key=lambda p: (p[1].created_at, p[1].id), reverse=True):
            identities.setdefault(run.pipeline_id, dict(
                pipeline_id=run.pipeline_id, pipeline_name=run.pipeline_name, retired=True,
            ))
        return list(identities.values())

    def aggregate(self, cases, pipeline=None):
        pairs = self.latest(cases, pipeline)
        rows = []
        for identity in self.identities(cases):
            if pipeline and identity["pipeline_id"] != pipeline:
                continue
            selected = [(c, r) for c, r in pairs if r.pipeline_id == identity["pipeline_id"]]
            successful = [r for _, r in selected if r.status == "success"]
            metrics = [e[0] for c, r in selected if (e := self.evaluation(c, r))]
            values = [m.cer for m in metrics]
            timed = [r for r in successful if r.processing_time_ms is not None]
            rows.append(dict(
                **identity, tests=len(selected), successful_runs=len(successful),
                failed_runs=len(selected) - len(successful), evaluated_runs=len(metrics),
                cer=mean_present(values), min_cer=min(values) if values else None,
                max_cer=max(values) if values else None, wer=mean_present(m.wer for m in metrics),
                exact_match_rate=mean_present(float(m.exact_match) for m in metrics),
                timed_runs=len(timed), avg_time_ms=mean_present(r.processing_time_ms for r in timed),
                avg_gateway_time_ms=mean_present(r.gateway_duration_ms for r in successful),
                avg_confidence=mean_present(r.confidence for r in successful),
            ))
        return rows

    def summarize(self, cases, pipeline=None):
        pairs = self.latest(cases, pipeline)
        rows = self.aggregate(cases, pipeline)
        retired = {r["pipeline_id"]: r["retired"] for r in rows}
        candidates = []
        for case, run in pairs:
            evaluation = self.evaluation(case, run)
            if evaluation is None:
                continue
            metric, date, source = evaluation
            candidates.append(dict(
                cer=metric.cer, pipeline_id=run.pipeline_id, pipeline_name=run.pipeline_name,
                retired=retired[run.pipeline_id], run_id=run.id, test_case_id=case.id,
                document_id=case.document_id, filename=case.document.filename, page_number=case.page_number,
                evaluated_at=date.isoformat(), date_source=source,
                evaluation_mode=case.evaluation_mode if case.workflow == "global" else "whole_document",
                href=f"/test/{case.id}",
            ))
        candidates.sort(key=lambda c: (timestamp(c["evaluated_at"]), c["run_id"]), reverse=True)
        candidates.sort(key=lambda c: c["cer"])
        timed = [r for r in rows if r["timed_runs"] >= self.minimum_samples]
        timed.sort(key=lambda r: (r["avg_time_ms"], r["pipeline_id"]))
        evaluated_cases = len({c["test_case_id"] for c in candidates})
        return dict(
            test_cases=len(cases), history_cases=sum(bool(c.runs) for c in cases), latest_results=len(pairs),
            evaluated_results=len(candidates), evaluated_cases=evaluated_cases,
            coverage=evaluated_cases / len(cases) if cases else None,
            evaluated_pipelines=len({c["pipeline_id"] for c in candidates}),
            lowest_cer=candidates[0] if candidates else None,
            lowest_cer_ties=sum(c["cer"] == candidates[0]["cer"] for c in candidates) - 1 if candidates else 0,
            fastest=timed[0] if timed else None, minimum_samples=self.minimum_samples,
            fastest_progress=max((r["timed_runs"] for r in rows), default=0),
            date_basis="test_case_created_at",
        )

    def matrix(self, filters):
        return self.aggregate(self.repository.cases(filters, analytics=True), filters.pipeline)

    def summary(self, filters):
        return {**self.summarize(self.repository.cases(filters, analytics=True), filters.pipeline),
                "scope": filters.model_dump(mode="json")}

    def options(self):
        # Historical options are snapshots, never recreated executable configs.
        current = {c.pipeline_id: dict(pipeline_id=c.pipeline_id, pipeline_name=c.name, retired=False)
                   for c in self.configs()}
        runs = self.repository.session.execute(select(
            PipelineRun.pipeline_id, PipelineRun.pipeline_name, PipelineRun.archived, PipelineRun.crop_stage,
        ).order_by(PipelineRun.created_at.desc(), PipelineRun.id.desc()))
        for run in runs:
            if self.eligible(run):
                current.setdefault(run.pipeline_id, dict(pipeline_id=run.pipeline_id, pipeline_name=run.pipeline_name, retired=True))
        return list(current.values())

    def groups(self, filters, dimension):
        cases = self.repository.cases(filters, analytics=True)
        if dimension == "category":
            groups = [(c.code, c.display_name, [x for x in cases if any(t.code == c.code for t in x.categories)])
                      for c in self.repository.categories() if not filters.category or c.code == filters.category]
        else:
            types = list(self.repository.session.scalars(select(DocumentType).order_by(DocumentType.name)))
            groups = [(t.id, t.name, [c for c in cases if c.document.document_type_id == t.id])
                      for t in types if not filters.document_type_id or str(filters.document_type_id) == t.id]
            if not filters.document_type_id:
                groups.append(("unassigned", "ยังไม่ระบุประเภทเอกสาร", [c for c in cases if not c.document.document_type_id]))
        output = []
        for code, name, selected in groups:
            summary = self.summarize(selected, filters.pipeline)
            rows = self.aggregate(selected, filters.pipeline)
            ranked = [r for r in rows if r["evaluated_runs"] >= self.minimum_samples and r["cer"] is not None]
            ranked.sort(key=lambda r: (r["cer"], r["pipeline_id"]))
            output.append(dict(code=code, display_name=name, **summary, pipelines=rows,
                               best_pipeline=ranked[0] if ranked else None))
        return output

    def categories(self, filters):
        return self.groups(filters, "category")
