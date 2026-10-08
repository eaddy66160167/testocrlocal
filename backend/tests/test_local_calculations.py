import json
from uuid import uuid4
from tests.test_local_first import local,pipeline

def test_snapshots_calculate_analyze_zero_database(local,png):
    client,app=local;pid=pipeline(client);configs=client.get('/api/pipelines').json()
    runs=client.post('/api/ocr/execute',files={'file':('synthetic.png',png,'image/png')},data={'options':json.dumps({'pipelines':[pid]})}).json()['runs']
    did,cid=str(uuid4()),str(uuid4());now='2026-10-08T00:00:00Z'
    case={'id':cid,'document_id':did,'workflow':'legacy','status':'tested','created_at':now,'updated_at':now,'ground_truth_raw':None,'ground_truth_normalized':None,'roi':None,'page_number':None,'categories':[],'runs':runs,'document':{'id':did,'filename':'synthetic.png','mime_type':'image/png','document_type':'image','width':300,'height':200,'page_count':1,'created_at':now,'storage_key':'local'}}
    before=app.state.database.metrics['queries']
    r=client.post('/api/ocr/calculate',json={'operation':'document-gt','case':case,'value':{'ground_truth_raw':'ABXD','confirmed':True}})
    assert r.status_code==200,r.text
    case=r.json();assert case['runs'][0]['metrics']['cer'] is not None
    for operation in ['matrix','summary','pipelines','comparison','categories','document-types','errors']:
        r=client.post('/api/ocr/analyze',json={'operation':operation,'cases':[case],'configs':configs})
        assert r.status_code==200,(operation,r.text)
    r=client.post('/api/ocr/calculate',json={'operation':'recompute','case':case,'value':{}});assert r.status_code==200,r.text
    assert app.state.database.metrics['queries']==before
