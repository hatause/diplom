"""Tests use an empty device allowlist: no camera is accessed."""
import json, os, socket, subprocess, sys, time, urllib.request, urllib.error
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
token = 'test-only-' + 'x' * 32
process = subprocess.Popen([sys.argv[1]], env={**os.environ, 'CAMERA_HOST': '127.0.0.1', 'CAMERA_PORT': str(port), 'CAMERA_SERVICE_TOKEN': token, 'CAMERA_DEVICE_INDICES': ''})
def get(path, authorized=True):
    req = urllib.request.Request(f'http://127.0.0.1:{port}{path}', headers={'Authorization': 'Bearer ' + token} if authorized else {})
    try:
        with urllib.request.urlopen(req, timeout=2) as response: return response.status, response.read(), response.headers
    except urllib.error.HTTPError as exc: return exc.code, exc.read(), exc.headers
try:
    for _ in range(60):
        try:
            if get('/health', False)[0] == 200: break
        except urllib.error.URLError: time.sleep(.05)
    assert get('/cameras', False)[0] == 401
    status, body, headers = get('/cameras')
    assert status == 200 and json.loads(body) == {'cameras': []}
    assert headers['Cache-Control'] == 'no-store'
    assert get('/cameras/camera-0')[0] == 404
    assert get('/cameras/camera-0/snapshot')[0] == 404
    assert get('/cameras/camera-0/snapshot', False)[0] == 401
    assert get('/cameras/http://example.com/snapshot')[0] == 404
    print('Camera HTTP contract passed; no hardware accessed.')
finally:
    process.terminate(); process.wait(timeout=5)
