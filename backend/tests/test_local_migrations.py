import os,sys,subprocess
from pathlib import Path
from sqlalchemy import create_engine,inspect,text

def test_shared_migration_fresh_and_repeat(tmp_path):
    url=f"sqlite:///{(tmp_path/'shared.db').as_posix()}"
    env={**os.environ,'LOCAL_DATABASE_URL':url}
    backend=Path(__file__).resolve().parents[1]
    for _ in range(2):
        result=subprocess.run([sys.executable,'-m','alembic','-c','alembic-shared.ini','upgrade','head'],cwd=backend,env=env,capture_output=True,text=True)
        assert result.returncode==0,result.stderr
    engine=create_engine(url)
    try:
        assert set(inspect(engine).get_table_names())=={'ocr_models','pipeline_configs','config_revision','alembic_version_shared'}
        with engine.connect() as c: assert c.execute(text('select revision from config_revision')).scalar()==1
    finally:engine.dispose()
