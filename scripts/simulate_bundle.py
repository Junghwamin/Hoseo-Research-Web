"""설치본 레이아웃을 흉내 내 실제로 서버를 띄워본다.

임베디드 파이썬을 내려받는 전체 빌드는 시간이 오래 걸리므로, **빌드
스크립트가 복사하기로 한 것들만** 임시 디렉터리에 그대로 옮겨 놓고
`python -m uvicorn api.main:app` 을 돌린다. 확인하려는 것은 하나다 —
**번들에 들어가는 파일만으로 앱이 뜨고 화면이 나오는가.**

개발 트리에서는 돌던 것이 설치본에서 안 도는 사고가 흔하다. 빌드 스크립트가
빠뜨린 파일은 개발 트리에 있으니까 아무도 모른다.
"""

import os
import shutil
import tempfile
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STAGE = Path(tempfile.mkdtemp(prefix="hoseo_bundle_"))
#: 번들에는 임베디드 파이썬이 들어가지만 여기서는 현재 인터프리터를 쓴다.
#: 확인하려는 것은 파이썬 배포 방식이 아니라 **복사된 파일만으로 도는가** 다.
PYTHON = Path(sys.executable)
PORT = 8123


def stage_bundle() -> None:
    if STAGE.exists():
        shutil.rmtree(STAGE)
    STAGE.mkdir(parents=True)

    # build_windows.py 가 복사하는 것과 같은 목록
    for name in ("core", "api", "config"):
        shutil.copytree(ROOT / name, STAGE / name,
                        ignore=shutil.ignore_patterns("__pycache__"))

    web_dist = ROOT / "web" / "dist"
    if not web_dist.is_dir():
        raise SystemExit("web/dist 가 없다. `cd web && npm run build` 를 먼저 하라.")
    shutil.copytree(web_dist, STAGE / "web" / "dist")

    (STAGE / "output" / "reports").mkdir(parents=True)
    for csv in ("전체_대학_데이터.csv", "권역별_순위.csv", "충청권_순위.csv"):
        src = ROOT / "output" / csv
        if src.exists():
            shutil.copy2(src, STAGE / "output" / csv)

    (STAGE / "Raw data").mkdir()
    shutil.copy2(ROOT / "requirements.txt", STAGE / "requirements.txt")

    files = sum(1 for p in STAGE.rglob("*") if p.is_file())
    size = sum(p.stat().st_size for p in STAGE.rglob("*") if p.is_file())
    print(f"번들 구성: {files}개 파일, {size / 1024 / 1024:.1f}MB")


def get(path: str, timeout: float = 3.0):
    """GET 한 번. 오류 응답도 예외 대신 (상태, 본문) 으로 돌려준다.

    진단 도구가 첫 실패에서 죽으면 나머지를 못 본다. 무엇이 되고 무엇이
    안 되는지를 한 번에 보여주는 것이 이 스크립트의 목적이다.
    """
    url = f"http://127.0.0.1:{PORT}{path}"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except (urllib.error.URLError, OSError) as e:
        return 0, str(e).encode()


def post(path: str, payload: bytes, timeout: float = 60.0):
    """POST 한 번. get() 과 같은 이유로 예외를 삼킨다."""
    req = urllib.request.Request(
        f"http://127.0.0.1:{PORT}{path}",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except (urllib.error.URLError, OSError) as e:
        return 0, str(e).encode()


def main() -> int:
    stage_bundle()

    env = {
        **os.environ,
        "PYTHONUTF8": "1",
        "PYTHONIOENCODING": "utf-8",
        "MPLBACKEND": "Agg",
    }
    # 개발 트리가 sys.path 에 섞여 들어가면 "번들만으로 도는가" 를 확인할 수 없다
    env.pop("PYTHONPATH", None)

    log = open(STAGE / "server.log", "w", encoding="utf-8")
    proc = subprocess.Popen(
        [str(PYTHON), "-m", "uvicorn", "api.main:app",
         "--host", "127.0.0.1", "--port", str(PORT), "--log-level", "warning"],
        cwd=str(STAGE), env=env, stdout=log, stderr=log,
    )

    try:
        # 준비 대기 — 죽으면 즉시 포기
        ready = False
        deadline = time.time() + 60
        while time.time() < deadline:
            if proc.poll() is not None:
                break
            try:
                if get("/api/health")[0] == 200:
                    ready = True
                    break
            except (urllib.error.URLError, OSError):
                time.sleep(0.5)

        if not ready:
            print("서버가 뜨지 않았다. 로그:")
            log.close()
            print((STAGE / "server.log").read_text(encoding="utf-8", errors="replace")[-2000:])
            return 1

        checks: list[tuple[str, bool, str]] = []

        # 1) 화면이 나오는가
        status, body = get("/")
        html = body.decode("utf-8", "replace")
        checks.append(("화면(/) 응답", status == 200 and "<div id=\"root\"" in html,
                       f"HTTP {status}, {len(body)}바이트"))

        # 2) JS/CSS 자산이 실제로 서빙되는가
        import re
        assets = re.findall(r'/assets/[\w.-]+\.(?:js|css)', html)
        ok_assets = bool(assets)
        for a in set(assets):
            try:
                if get(a)[0] != 200:
                    ok_assets = False
            except Exception:
                ok_assets = False
        checks.append(("자산(JS/CSS) 서빙", ok_assets, f"{len(set(assets))}개"))

        # 3) 데이터 API
        status, body = get("/api/data")
        checks.append(("/api/data", status == 200 and b"years" in body, f"HTTP {status}"))

        # 4) 통계 API (POST)
        target = b'{"university": "\\ud638\\uc11c\\ub300\\ud559\\uad50", "year": 2026}'
        status, body = post("/api/stats", target, timeout=15)
        checks.append(("/api/stats", status == 200 and b"regionName" in body,
                       f"HTTP {status}"))

        # 5) 보고서 생성 (차트 5장 포함) — 설치본에서 가장 무거운 경로
        status, content = post("/api/report", target, timeout=120)
        import io
        import zipfile
        media = 0
        if content[:4] == b"PK\x03\x04":
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                media = len([n for n in z.namelist() if n.startswith("word/media/")])
        checks.append(("/api/report (Word)", content[:4] == b"PK\x03\x04" and media == 5,
                       f"HTTP {status}, {len(content):,}바이트, 차트 {media}장"))

        # 6) SPA 폴백 — 클라이언트 라우팅 경로도 index.html 로 떨어지는가
        status, body = get("/some/client/route")
        checks.append(("SPA 폴백", status == 200 and b'id="root"' in body, f"HTTP {status}"))

        print()
        failed = 0
        for name, ok, note in checks:
            mark = "OK  " if ok else "FAIL"
            if not ok:
                failed += 1
            print(f"  {mark} {name}{'  — ' + note if note else ''}")

        # 서버가 조용히 경고를 냈는지도 본다
        log.flush()
        content = (STAGE / "server.log").read_text(encoding="utf-8", errors="replace")
        bad = [ln for ln in content.splitlines()
               if "Traceback" in ln or "main thread is not in main loop" in ln]
        if bad:
            failed += 1
            print(f"  FAIL 서버 로그에 오류 {len(bad)}건")
            for ln in bad[:5]:
                print(f"       {ln}")

        print(f"\n{'번들만으로 정상 동작' if failed == 0 else f'{failed}건 실패'}")
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
