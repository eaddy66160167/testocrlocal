import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from tests.test_local_first import local, pipeline

ORIGIN = 'https://testocrlocal.vercel.app'

def cors(response):
    assert response.headers['access-control-allow-origin'] == ORIGIN
    assert 'location' not in response.headers

@pytest.mark.parametrize('method,path,headers', [
    ('GET','/api/pipelines','if-none-match'),
    ('POST','/api/ocr/prepare','content-type'),
    ('POST','/api/pipelines','content-type,authorization'),
    ('PUT','/api/pipelines/x/definition','content-type'),
    ('DELETE','/api/pipelines/x','authorization'),
])
def test_preflight(local, method, path, headers):
    client,_=local
    r=client.options(path,headers={'Origin':ORIGIN,'Access-Control-Request-Method':method,'Access-Control-Request-Headers':headers})
    assert r.status_code == 200
    cors(r)
    for h in headers.split(','): assert h in r.headers['access-control-allow-headers'].lower()

def test_untrusted_origin(local):
    client,_=local
    r=client.options('/api/pipelines',headers={'Origin':'https://untrusted.example','Access-Control-Request-Method':'GET'})
    assert r.status_code == 400 and 'access-control-allow-origin' not in r.headers

@pytest.mark.parametrize('path,status',[('/api/missing',404),('/api/ocr/prepare',405)])
def test_error_cors(local,path,status):
    client,_=local
    r=client.get(path,headers={'Origin':ORIGIN});assert r.status_code == status;cors(r)

def test_upload_and_etag(local,png):
    client,app=local; pipeline(client)
    r=client.get('/api/pipelines',headers={'Origin':ORIGIN});cors(r)
    r=client.get('/api/pipelines',headers={'Origin':ORIGIN,'If-None-Match':r.headers['etag']});assert r.status_code==304;cors(r)
    before=app.state.database.metrics['queries']
    r=client.post('/api/ocr/prepare',headers={'Origin':ORIGIN},files={'file':('synthetic.png',png,'image/png')})
    assert r.status_code==200 and r.headers['x-image-width']=='300';cors(r)
    assert app.state.database.metrics['queries']==before
    for files,status in [({},422),({'file':('bad.png',b'invalid','image/png')},415)]:
        r=client.post('/api/ocr/prepare',headers={'Origin':ORIGIN},files=files);assert r.status_code==status;cors(r)

def test_rate_limit_cors(local):
    client,_=local
    for _ in range(1001):r=client.get('/api/upload-config',headers={'Origin':ORIGIN})
    assert r.status_code==429;cors(r)
    assert client.options('/api/pipelines',headers={'Origin':ORIGIN,'Access-Control-Request-Method':'GET'}).status_code==200

@pytest.mark.parametrize('error,status',[(RuntimeError('private internal detail'),500),(OperationalError('sql',{},Exception('private secret')),503)])
def test_failure_cors(local,monkeypatch,error,status):
    _,app=local
    def fail():raise error
    with TestClient(app,raise_server_exceptions=False) as client:
        monkeypatch.setattr(app.state.cache,'get',fail)
        r=client.get('/api/pipelines',headers={'Origin':ORIGIN})
        assert r.status_code==status and 'private' not in r.text;cors(r)
