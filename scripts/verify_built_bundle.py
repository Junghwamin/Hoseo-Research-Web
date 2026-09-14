"""실제로 빌드된 설치본을 띄워 관통 확인한다.

시뮬레이터(scripts/simulate_bundle.py)는 "파일 구성이 맞는가"까지만 본다.
여기서는 **번들된 임베디드 파이썬**으로 진짜 서버를 띄운다 — 의존성이
설치본 안에 제대로 들어갔는지, 오프라인에서 도는지를 확인하는 유일한 방법이다.
"""

import io
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

BUNDLE = Path(__file__).resolve().parent.parent / "build" / "windows" / "HoseoIRPortal"
PYTHON = BUNDLE / "python-embed" / "python.exe"
PORT = 8199

TARGET = b'{"university": "\\ud638\\uc11c\\ub300\\ud559\\uad50", "year": 2026}'


def get(path, timeout=5.0):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}{path}", timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except (urllib.error.URLError, OSError) as e:
        return 0, str(e).encode()


def post(path, payload, timeout=120.0):
    req = urllib.request.Request(
        f"http://127.0.0.1:{PORT}{path}", data=payload,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except (urllib.error.URLError, OSError) as e:
        return 0, str(e).encode()


def main() -> int:
    if not PYTHON.exists():
        print(f"빌드가 없다: {PYTHON}")
        return 1

    env = {**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8", "MPLBACKEND": "Agg"}
    env.pop("PYTHONPATH", None)   # 개발 트리가 섞이면 검증이 무의미하다

    log_path = BUNDLE / "verify.log"
    log = open(log_path, "w", encoding="utf-8")
    proc = subprocess.Popen(
        [str(PYTHON), "-m", "uvicorn", "api.main:app",
         "--host", "127.0.0.1", "--port", str(PORT), "--log-level", "warning"],
        cwd=str(BUNDLE), env=env, stdout=log, stderr=log,
    )

    try:
        ready = False
        deadline = time.time() + 90
        while time.time() < deadline:
            if proc.poll() is not None:
                break
            if get("/api/health", timeout=2)[0] == 200:
                ready = True
                break
            time.sleep(0.5)

        if not ready:
            log.close()
            print("서버가 뜨지 않았다. 로그 끝부분:")
            print(log_path.read_text(encoding="utf-8", errors="replace")[-2500:])
            return 1

        checks = []

        status, body = get("/")
        html = body.decode("utf-8", "replace")
        checks.append(("화면(/)", status == 200 and 'id="root"' in html, f"HTTP {status}"))

        assets = set(re.findall(r"/assets/[\w.-]+\.(?:js|css)", html))
        ok = bool(assets) and all(get(a)[0] == 200 for a in assets)
        checks.append(("자산 서빙", ok, f"{len(assets)}개"))

        status, body = get("/api/data")
        checks.append(("/api/data", status == 200 and b"years" in body, f"HTTP {status}"))

        status, body = post("/api/stats", TARGET, timeout=30)
        checks.append(("/api/stats", status == 200 and b"regionName" in body, f"HTTP {status}"))

        status, content = post("/api/report", TARGET)
        media = 0
        if content[:4] == b"PK\x03\x04":
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                media = len([n for n in z.namelist() if n.startswith("word/media/")])
        checks.append(("/api/report (Word)", content[:4] == b"PK\x03\x04" and media == 5,
                       f"HTTP {status}, {len(content):,}바이트, 차트 {media}장"))

        status, body = get("/some/client/route")
        checks.append(("SPA 폴백", status == 200 and b'id="root"' in body, f"HTTP {status}"))

        print()
        failed = 0
        for name, ok, note in checks:
            if not ok:
                failed += 1
            print(f"  {'OK  ' if ok else 'FAIL'} {name}  - {note}")

        log.flush()
        content = log_path.read_text(encoding="utf-8", errors="replace")
        bad = [ln for ln in content.splitlines()
               if "Traceback" in ln or "main thread is not in main loop" in ln
               or "Tcl_AsyncDelete" in ln]
        if bad:
            failed += 1
            print(f"  FAIL 서버 로그 오류 {len(bad)}건")
            for ln in bad[:5]:
                print(f"       {ln}")

        print(f"\n{'설치본이 실제로 동작한다' if failed == 0 else f'{failed}건 실패'}")
        return 0 if failed == 0 else 1

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        log.close()


if __name__ == "__main__":
    sys.exit(main())
