"""OpenAPI 스키마를 파일로 내보낸다.

서버를 띄우지 않고 `app.openapi()` 를 직접 호출한다 — CI 에서 포트를 잡지
않아도 되고, 타입 생성이 서버 기동 실패에 휘둘리지 않는다.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api.main import app  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "web" / "openapi.json"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    # sort_keys 로 출력을 결정적으로 만든다. 안 그러면 재생성마다 diff 가 난다.
    OUT.write_text(
        json.dumps(app.openapi(), ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"OK: {OUT}")


if __name__ == "__main__":
    main()
