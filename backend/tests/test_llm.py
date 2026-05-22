from fastapi.testclient import TestClient
from app.main import app
from app.services.captcha import _store
c = TestClient(app)
r = c.get('/api/v1/auth/captcha')
k = r.json()['captcha_key']; code = _store[k]['code']
r = c.post('/api/v1/auth/admin/login', json={'username':'SYSAdmin','password':'SYSPass','captcha_key':k,'captcha_code':code,'sms_code':'111111','role':2})
tok = r.json()['access_token']

# Test connection with form endpoint
r = c.post('/admin/llm/config/test', json={'endpoint':'http://127.0.0.1:11434/v1'}, headers={'Authorization':f'Bearer {tok}'})
d = r.json()
print(f'Test: ok={d["ok"]} models={len(d.get("models",[]))}')

# Save
r = c.put('/admin/llm/config', json={'provider':'ollama','endpoint':'http://127.0.0.1:11434/v1','model':'qwen3-coder:30b'}, headers={'Authorization':f'Bearer {tok}'})
print(f'Save: {r.json()["message"]}')

# Verify file
import json
cfg = json.load(open('sysconfig.json'))
print(f'Stored: endpoint={cfg["llm"]["endpoint"]} model={cfg["llm"]["model"]}')
