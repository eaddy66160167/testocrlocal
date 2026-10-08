import json,time,statistics
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tests.test_local_first import local,pipeline,AUTH
from app.local_first.cache import ConfigCache

def test_cached_workloads(local,png):
    client,app=local;pid=pipeline(client);client.get('/api/pipelines')
    report={'environment':'in-process TestClient; SQLite configuration; synthetic OCR HTTP transport; NOT Neon billing or deployed latency','workloads':[]}
    for users in [1,5,10]:
        before=dict(app.state.database.metrics);hits=app.state.cache.metrics['hits']
        def run(_):
            start=time.perf_counter()
            r=client.post('/api/ocr/execute',files={'file':('synthetic.png',png,'image/png')},data={'options':json.dumps({'pipelines':[pid]})})
            assert r.status_code==200,r.text
            assert r.json()['runs'][0]['status']=='success'
            return (time.perf_counter()-start)*1000
        start=time.perf_counter()
        with ThreadPoolExecutor(max_workers=users) as pool:latencies=list(pool.map(run,range(100)))
        queries=app.state.database.metrics['queries']-before['queries']
        assert queries==0
        report['workloads'].append({'concurrency':users,'runs':100,'queries':queries,'errors':0,'wall_seconds':time.perf_counter()-start,'p50_ms':statistics.median(latencies),'p95_ms':sorted(latencies)[94],'cache_hits':app.state.cache.metrics['hits']-hits,'new_connections':app.state.database.metrics['connections_opened']-before['connections_opened']})
    before=app.state.database.metrics['queries']
    for _ in range(100):assert client.get('/api/pipelines').status_code==200
    assert app.state.database.metrics['queries']==before
    # A second process cache observes changes within bounded TTL, never mixed revisions.
    other=ConfigCache(app.state.database,app.state.cache.settings);other.get()
    r=client.put(f'/api/pipelines/{pid}',headers=AUTH,json={'enabled':False});assert r.status_code==200
    current=app.state.cache.get();other.expires=0;assert other.get().revision==current.revision
    assert not other.get().public_configs[0]['enabled']
    before=app.state.database.metrics['queries'];app.state.cache.expires=0;app.state.cache.get()
    assert app.state.database.metrics['queries']-before==1
    report['unchanged_expired_cache_queries']=1
    report['metrics']=client.get('/api/admin/metrics',headers=AUTH).json()
    assert report['metrics']['ocr_db_queries']==0
    (Path(__file__).resolve().parents[2]/'docs/local-first-load-results.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
