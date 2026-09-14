# ============================================================================
# Copyright (c) 2026 정화민 (Junghwamin)
# Licensed under the PolyForm Noncommercial License 1.0.0.
# ============================================================================
"""프론트 타입이 서버 스키마와 어긋나지 않는지 지킨다.

`web/src/api/schema.d.ts` 는 `web/openapi.json` 에서 생성된다. 서버 스키마를
고치고 재생성을 잊으면, 프론트는 **없는 필드를 읽으면서 타입 검사는 통과한다.**
그런 종류의 어긋남은 화면에 `undefined` 로만 드러나서 늦게 발견된다.

이 테스트는 커밋된 openapi.json 이 지금 앱이 내놓는 것과 같은지만 본다.
다르면 `python scripts/export_openapi.py && cd web && npm run gen:api` 를
돌리라는 뜻이다.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from api.main import app
from tests.conftest import PROJECT_ROOT

OPENAPI_JSON = PROJECT_ROOT / "web" / "openapi.json"
SCHEMA_DTS = PROJECT_ROOT / "web" / "src" / "api" / "schema.d.ts"

REGEN = "python scripts/export_openapi.py && cd web && npm run gen:api"


def _current() -> dict:
    return app.openapi()


def test_커밋된_openapi_가_현재_앱과_같다():
    if not OPENAPI_JSON.exists():
        pytest.skip(f"{OPENAPI_JSON} 가 없다")

    committed = json.loads(OPENAPI_JSON.read_text(encoding="utf-8"))
    current = _current()

    if committed != current:
        c_paths = set(committed.get("paths", {}))
        n_paths = set(current.get("paths", {}))
        c_schemas = set(committed.get("components", {}).get("schemas", {}))
        n_schemas = set(current.get("components", {}).get("schemas", {}))
        pytest.fail(
            "openapi.json 이 현재 앱과 다르다. 재생성이 필요하다:\n"
            f"  {REGEN}\n"
            f"  추가된 경로: {sorted(n_paths - c_paths)}\n"
            f"  사라진 경로: {sorted(c_paths - n_paths)}\n"
            f"  추가된 스키마: {sorted(n_schemas - c_schemas)}\n"
            f"  사라진 스키마: {sorted(c_schemas - n_schemas)}"
        )


def test_생성된_타입_파일이_모든_스키마를_담고_있다():
    if not SCHEMA_DTS.exists():
        pytest.skip(f"{SCHEMA_DTS} 가 없다 — `npm run gen:api` 필요")

    dts = SCHEMA_DTS.read_text(encoding="utf-8")
    for name in _current()["components"]["schemas"]:
        assert f"{name}:" in dts, (
            f"생성된 타입에 {name} 이 없다. 재생성이 필요하다: {REGEN}"
        )


def test_응답_모델에_한글_키가_새어나오지_않는다():
    """한글 키가 프론트로 가면 TS 에서 대괄호 접근이 강제된다.

    `1인당논문수` 처럼 숫자로 시작하는 키는 속성 접근 자체가 불가능해서
    자동완성과 타입 추론이 죽는다. 번역은 api/schemas.py 에서 끝나야 한다.
    """
    schemas = _current()["components"]["schemas"]
    offenders: list[str] = []
    for model, spec in schemas.items():
        for field in (spec.get("properties") or {}):
            if any("가" <= ch <= "힣" for ch in field):
                offenders.append(f"{model}.{field}")

    assert offenders == [], (
        f"응답 모델에 한글 필드명이 있다: {offenders}. "
        "api/schemas.py 의 번역표에 추가해야 한다."
    )
