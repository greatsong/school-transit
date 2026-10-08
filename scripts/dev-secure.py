"""Start the local server with an API key held only in process memory."""
import getpass
import os
from pathlib import Path
os.chdir(Path(__file__).resolve().parent.parent)
key = os.environ.get('SEOUL_BUS_API_KEY') or getpass.getpass('서울 버스 API 인증키 (화면에 표시되지 않음): ')
if not key.strip():
    raise SystemExit('인증키를 입력해주세요.')
env = os.environ.copy()
env['SEOUL_BUS_API_KEY'] = key.strip()
os.execvpe('node', ['node', 'scripts/dev.mjs'], env)
