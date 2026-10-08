"""Add business document types and non-destructive dataset exclusion."""
import sqlalchemy as sa

from alembic import op

# Kept within Alembic's existing 32-character revision column.
revision = "0009_document_types_dataset"
down_revision = "0008_global_layout_evaluation"
branch_labels = depends_on = None


def upgrade():
    op.create_table("document_types",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("normalized_name", sa.String(200), nullable=False, unique=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("system", sa.Boolean(), nullable=False, server_default="false"))
    if op.get_bind().dialect.name == "sqlite":
        op.execute("ALTER TABLE documents ADD COLUMN document_type_id CHAR(32) REFERENCES document_types(id)")
    else:
        op.add_column("documents", sa.Column("document_type_id", sa.Uuid(as_uuid=False), nullable=True))
        op.create_foreign_key("fk_documents_document_type", "documents", "document_types", ["document_type_id"], ["id"])
    for table in ("test_cases", "global_fields"):
        op.add_column(table, sa.Column("dataset_excluded_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    for table in ("global_fields", "test_cases"):
        op.drop_column(table, "dataset_excluded_at")
    if op.get_bind().dialect.name != "sqlite":
        op.drop_constraint("fk_documents_document_type", "documents", type_="foreignkey")
    op.drop_column("documents", "document_type_id")
    op.drop_table("document_types")
