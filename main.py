# ============================================================================
# Copyright (c) 2026 정화민 (Junghwamin)
# Licensed under the PolyForm Noncommercial License 1.0.0.
# ============================================================================
"""Vercel 진입점. 앱은 `api/main.py` 에 있고, 여기서는 배포 환경만 맞춘다.

**로컬과 설치본은 이 파일을 거치지 않는다** — `uvicorn api.main:app` 그대로다.
"""

from __future__ import annotations

import os
import time

# 보고서 표지의 생성일은 `date.today()` 다. 함수는 UTC 로 돌아서, 그대로 두면
# 한국 시각 오전 9시 전에 만든 보고서에 전날 날짜가 찍힌다. `TZ` 는 Vercel 이
# 예약한 이름이라 프로젝트 환경변수로 넣을 수 없어 여기서 정한다.
#
# POSIX 표기를 쓰는 이유는 함수 이미지에 tzdata 가 있다고 기대하지 않기 위해서다.
os.environ["TZ"] = "KST-9"
if hasattr(time, "tzset"):  # Windows 의 `vercel dev` 에는 없다
    time.tzset()

from api.main import app  # noqa: E402,F401
