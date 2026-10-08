"""Only shared OCR configuration, independent of the legacy benchmark lineage."""
from alembic import op
from app.local_first.database import metadata, revision_table
revision = "shared_0001"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    metadata.create_all(op.get_bind(), checkfirst=False)
    op.get_bind().execute(revision_table.insert().values(id=1, revision=1))

def downgrade():
    metadata.drop_all(op.get_bind())
