"""OpenAPI 스키마를 파일로 내보낸다.

서버를 띄우지 않고 `app.openapi()` 를 직접 호출한다 — CI 에서 포트를 잡지
않아도 되고, 타입 생성이 서버 기동 실패에 휘둘리지 않는다.

**반드시 프로젝트 venv 로 실행한다.**

    .venv/Scripts/python.exe scripts/export_openapi.py   # Windows
    .venv/bin/python scripts/export_openapi.py           # macOS/Linux

시스템 파이썬으로 돌리면 FastAPI·Pydantic 버전이 달라 스키마가 미묘하게
달라진다(실제로 `ValidationError` 의 `ctx`·`input` 필드가 통째로 사라졌다).
그 파일을 커밋하면 드리프트 테스트가 "경로도 스키마도 같은데 다르다" 는
설명하기 어려운 실패를 낸다. 아래 검사가 그 전에 멈춘다.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from api.main import app  # noqa: E402

OUT = ROOT / "web" / "openapi.json"


def _require_project_venv() -> None:
    """프로젝트 venv 밖이면 멈춘다. 경고만으로는 아무도 안 읽는다."""
    try:
        Path(sys.prefix).relative_to(ROOT)
    except ValueError:
        sys.exit(
            f"이 스크립트는 프로젝트 venv 로 실행해야 한다.\n"
            f"  현재: {sys.executable}\n"
            f"  기대: {ROOT / '.venv'} 아래\n"
            f"다른 인터프리터로 뽑으면 FastAPI 버전 차이로 스키마가 달라지고,\n"
            f"드리프트 테스트가 원인을 알기 어려운 실패를 낸다."
        )


def main() -> None:
    _require_project_venv()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    # sort_keys 로 출력을 결정적으로 만든다. 안 그러면 재생성마다 diff 가 난다.
    OUT.write_text(
        json.dumps(app.openapi(), ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"OK: {OUT}")


if __name__ == "__main__":
    main()
