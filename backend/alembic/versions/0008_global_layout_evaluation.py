"""Canonical layout/GT identities. Historical rows retain legacy semantics."""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "0008_global_layout_evaluation"
down_revision = "0007_fields_roi_source"
branch_labels = depends_on = None


def upgrade():
    json_type = sa.JSON().with_variant(JSONB(), "postgresql")
    op.add_column(
        "test_cases", sa.Column("workflow", sa.String(20), nullable=False, server_default="legacy")
    )
    op.add_column(
        "test_cases", sa.Column("layout_confirmed_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "test_cases", sa.Column("layout_locked_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "test_cases",
        sa.Column("evaluation_mode", sa.String(20), nullable=False, server_default="per_field"),
    )
    op.add_column(
        "test_cases",
        sa.Column("document_gt_confirmed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("pipeline_runs", sa.Column("document_evaluation", json_type, nullable=True))
    op.create_table(
        "global_fields",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column(
            "test_case_id",
            sa.Uuid(as_uuid=False),
            sa.ForeignKey("test_cases.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("field_index", sa.Integer(), nullable=False),
        sa.Column("roi", json_type, nullable=False),
        sa.Column("source", sa.String(10), nullable=False),
        sa.Column("ground_truth_raw", sa.Text(), nullable=True),
        sa.Column("ground_truth_normalized", sa.Text(), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("test_case_id", "field_index", name="uq_global_fields_case_index"),
    )
    op.create_index("ix_global_fields_test_case_id", "global_fields", ["test_case_id"])
    # Batch mode also supports the isolated SQLite unit-test database.
    with op.batch_alter_table("ocr_fields") as batch:
        batch.add_column(sa.Column("global_field_id", sa.Uuid(as_uuid=False), nullable=True))
        batch.add_column(
            sa.Column("status", sa.String(20), nullable=False, server_default="success")
        )
        batch.add_column(sa.Column("diagnostics", json_type, nullable=True))
        batch.create_foreign_key(
            "fk_ocr_fields_global_field",
            "global_fields",
            ["global_field_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch.create_index("ix_ocr_fields_global_field_id", ["global_field_id"])


def downgrade():
    with op.batch_alter_table("ocr_fields") as batch:
        batch.drop_index("ix_ocr_fields_global_field_id")
        batch.drop_constraint("fk_ocr_fields_global_field", type_="foreignkey")
        for name in ("diagnostics", "status", "global_field_id"):
            batch.drop_column(name)
    op.drop_column("pipeline_runs", "document_evaluation")
    op.drop_table("global_fields")
    for name in (
        "document_gt_confirmed_at",
        "evaluation_mode",
        "layout_locked_at",
        "layout_confirmed_at",
        "workflow",
    ):
        op.drop_column("test_cases", name)
