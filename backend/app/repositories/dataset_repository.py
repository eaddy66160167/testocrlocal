from types import SimpleNamespace

from sqlalchemy import JSON, func, literal, select, union_all
from sqlalchemy.orm import noload

from app.core.errors import AppError
from app.db.models import Category, GlobalField, TestCase


class DatasetRepository:
    def __init__(self, session):
        self.session = session

    @staticmethod
    def eligible(case):
        return case.workflow == "legacy" and case.status == "confirmed" and case.ground_truth_raw is not None and bool(case.roi)

    def samples(self, category, document, limit, offset):
        query = (
            select(TestCase.id.label("id"), literal("case").label("kind"), TestCase.id.label("case_order"), literal(0).label("field_order"))
            .where(
                TestCase.workflow == "legacy",
                TestCase.status == "confirmed",
                TestCase.ground_truth_raw.is_not(None),
                TestCase.roi.is_not(None),
                TestCase.roi != JSON.NULL,
            )
        )
        if category:
            query = query.where(TestCase.categories.any(Category.code == category))
        if document:
            query = query.where(TestCase.document_id == str(document))
        fields = select(GlobalField.id.label("id"), literal("field").label("kind"), GlobalField.test_case_id.label("case_order"), GlobalField.field_index.label("field_order")).join(TestCase).where(
            GlobalField.confirmed_at.is_not(None), GlobalField.ground_truth_normalized != "",
            TestCase.layout_confirmed_at.is_not(None),
        )
        if category:
            fields = fields.where(TestCase.categories.any(Category.code == category))
        if document:
            fields = fields.where(TestCase.document_id == str(document))
        combined = union_all(query, fields).subquery()
        total = self.session.scalar(select(func.count()).select_from(combined))
        rows = self.session.execute(select(combined).order_by(combined.c.case_order, combined.c.field_order, combined.c.id).limit(limit).offset(offset))
        return total, [self.field_sample(self.session.get(GlobalField, row.id)) if row.kind == "field"
                       else self.session.get(TestCase, row.id) for row in rows]

    @staticmethod
    def field_sample(field):
        case = field.test_case
        return SimpleNamespace(id=field.id, test_case_id=case.id, global_field_id=field.id,
            field_index=field.field_index, document_id=case.document_id, document=case.document,
            page_number=case.page_number, roi=field.roi, ground_truth_raw=field.ground_truth_raw,
            updated_at=field.updated_at, categories=case.categories)

    def selected_fields(self, ids):
        fields = list(self.session.scalars(select(GlobalField).where(GlobalField.id.in_(ids)).order_by(GlobalField.test_case_id, GlobalField.field_index)))
        if len(fields) != len(ids):
            raise AppError("One or more Global Fields no longer exist", 404)
        if any(not f.confirmed_at or not f.ground_truth_normalized or not f.test_case.layout_confirmed_at for f in fields):
            raise AppError("Dataset fields require confirmed Layout and non-empty confirmed canonical Ground Truth", 422)
        return [self.field_sample(f) for f in fields]

    def selected(self, ids):
        cases = list(
            self.session.scalars(
                select(TestCase)
                .options(noload(TestCase.runs))
                .where(TestCase.id.in_(ids))
                .order_by(TestCase.id)
            )
        )
        if len(cases) != len(ids):
            raise AppError("One or more selected test cases no longer exist", 404)
        if any(not self.eligible(case) for case in cases):
            raise AppError("Dataset samples require a saved ROI and confirmed Ground Truth", 422)
        return cases
