"""Canonical layout order. Persist numbering at layout save; never reorder a run."""


def reading_order(fields):
    """Group against each row's fixed first box, with >=50% shorter-height overlap.

    Seeds sort by top/left/bottom/right/UUID; row membership never expands via
    transitive overlaps. Choose the earliest matching row, then sort by left/top
    inside it. Geometry and UUID tie-breakers make input/click order irrelevant.
    This is visual row order, not semantic multi-column/table interpretation.
    """
    seeds = sorted(fields, key=lambda f: (f.roi["y1"], f.roi["x1"], f.roi["y2"], f.roi["x2"], f.id))
    rows = []
    for field in seeds:
        box = field.roi
        for row in rows:
            anchor = row[0].roi
            overlap = min(box["y2"], anchor["y2"]) - max(box["y1"], anchor["y1"])
            if overlap >= min(box["y2"] - box["y1"], anchor["y2"] - anchor["y1"]) * 0.5:
                row.append(field)
                break
        else:
            rows.append([field])
    return [
        field
        for row in rows
        for field in sorted(
            row, key=lambda f: (f.roi["x1"], f.roi["y1"], f.roi["x2"], f.roi["y2"], f.id)
        )
    ]


def canonical_document_text(global_fields, predictions):
    """Newline join in stored canonical order, UUID mapping independent of result order.

    Callers validate completeness/success before evaluating. Missing predictions
    remain empty; raw vendor text is stored separately and is never overwritten.
    """
    by_id = {prediction.global_field_id: prediction.ocr_text for prediction in predictions}
    return "\n".join(
        by_id.get(field.id, "") for field in sorted(global_fields, key=lambda f: f.field_index)
    )
