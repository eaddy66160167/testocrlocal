"""Add model registry and configurable DET/REC pipelines, preserving existing runs."""
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from alembic import op

revision = "0010_dynamic_pipelines"
down_revision = "0009_document_types_dataset"
branch_labels = depends_on = None


def upgrade():
    op.create_table("ocr_models",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("version", sa.String(50), nullable=False),
        sa.Column("weight", sa.String(100), nullable=False),
        sa.Column("single_path", sa.String(500), nullable=False),
        sa.Column("batch_path", sa.String(500), nullable=False))
    with op.batch_alter_table("pipeline_configs") as batch:
        batch.add_column(sa.Column("dynamic_mode", sa.String(20), nullable=True))
        batch.add_column(sa.Column("source", sa.String(20), nullable=True))
        batch.add_column(sa.Column("integrated_options", sa.JSON().with_variant(JSONB(), "postgresql"), nullable=True))
        batch.add_column(sa.Column("det_model_id", sa.Uuid(as_uuid=False), nullable=True))
        batch.add_column(sa.Column("rec_model_id", sa.Uuid(as_uuid=False), nullable=True))
        batch.create_foreign_key("fk_pipeline_det_model", "ocr_models", ["det_model_id"], ["id"])
        batch.create_foreign_key("fk_pipeline_rec_model", "ocr_models", ["rec_model_id"], ["id"])


def downgrade():
    with op.batch_alter_table("pipeline_configs") as batch:
        batch.drop_constraint("fk_pipeline_det_model", type_="foreignkey")
        batch.drop_constraint("fk_pipeline_rec_model", type_="foreignkey")
        for column in ("det_model_id", "rec_model_id", "dynamic_mode", "source", "integrated_options"):
            batch.drop_column(column)
    op.drop_table("ocr_models")
