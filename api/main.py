# ============================================================================
# Copyright (c) 2026 정화민 (Junghwamin)
# Licensed under the PolyForm Noncommercial License 1.0.0.
# ============================================================================
"""FastAPI 진입점.

빌드된 React(`web/dist`)를 같은 서버가 정적 서빙한다. 설치본은 오프라인이고
Node 런타임이 없으므로, 개발 PC 에서 빌드한 결과물만 번들에 들어간다.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from api import schemas
from api.routers import data, report, settings, stats

PROJECT_ROOT = Path(__file__).resolve().parent.parent
WEB_DIST = PROJECT_ROOT / "web" / "dist"

#: 정적 파일 캐시. Vercel 이 함수 응답에 붙이는 기본값은 `max-age=0` 이라 매 방문이
#: 재검증이다. `/assets/*` 는 이름에 내용 해시가 있어 영구 캐시가 안전하고, 글꼴은
#: 파일명이 바뀌지 않은 채 다시 만들어질 수 있어 하루만 둔다. index.html 은 그대로
#: 둔다 — 새 배포의 자산 이름을 가리켜야 한다. (vercel.json 의 headers 는 CDN 으로
#: 올라간 파일에만 닿으므로, 함수가 서빙하는 경우와 오프라인 설치본까지 여기서 맞춘다.)
STATIC_CACHE_CONTROL: dict[str, str] = {
    "/assets/": "public, max-age=31536000, immutable",
    "/fonts/": "public, max-age=86400",
}

# `.env` 를 환경변수로 올린다.
#
# README 와 인스톨러가 `.env` 를 안내하는데 이 호출이 없으면 **조용히
# 무동작**이다 — 사용자는 키를 넣었는데 "설정되지 않았다" 는 503 을 본다.
# Streamlit 판은 app.py 에서 매 run 마다 했고, 이관 과정에서 빠졌었다.
#
# `override=False` 라 이미 설정된 환경변수가 우선한다. 배포 환경에서 주입한
# 값을 파일이 덮어쓰면 안 된다.
load_dotenv(PROJECT_ROOT / ".env", override=False)

app = FastAPI(
    title="연구실적 분석 포털 API",
    version="6.0",
    description="대학알리미 전임교원 연구실적 분석. core/ 의 순수 함수를 감싼다.",
)

app.include_router(stats.router)
app.include_router(report.router)
app.include_router(settings.router)
app.include_router(data.router)


@app.exception_handler(RequestValidationError)
async def _overlay_validation_detail(request: Request, exc: RequestValidationError):  # type: ignore[no-untyped-def]
    """브라우저 데이터셋(`overlay`)의 검증 실패는 **한 문장**으로 답한다.

    FastAPI 의 기본 422 는 pydantic 오류 목록(영문 `msg`, 행 번호 `loc`)이다.
    화면은 `detail` 을 그대로 띄우므로 "body.overlay.national.1234.faculty: Input
    should be…" 가 사용자에게 보인다. overlay 는 브라우저 저장소에서 온 것이라
    사용자가 고칠 수 있는 것은 지우고 다시 올리는 것뿐이다 — 그 말만 한다.
    다른 요청의 422 는 기본 모양 그대로다(기존 계약).
    """
    if any("overlay" in (err.get("loc") or ()) for err in exc.errors()):
        return JSONResponse(
            status_code=422, content={"detail": schemas.OVERLAY_INVALID_DETAIL}
        )
    return await request_validation_exception_handler(request, exc)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def mount_web(target: FastAPI = app, dist: Path = WEB_DIST) -> None:
    """React 빌드 산출물을 서빙한다. 없으면 조용히 건너뛴다(개발 중에는 Vite 가 뜬다).

    **캐치올 라우트를 직접 만들지 않는다.** 예전에는 `dist / 요청경로` 를 그대로
    열었는데, `/..%2f..%2f.env` 로 폴더 밖 파일이 나갔다. 공개 배포에서는
    `/proc/self/environ` 으로 API 키까지 읽힌다. `frontend` 는 경로 검사를
    Starlette 에 맡긴다.

    이 경로는 OpenAPI 에도 잡히지 않는다. **web/dist 존재 여부에 따라 스키마가
    달라지면 안 된다** — 생성 타입이 빌드 여부에 갈리면 드리프트 가드가 환경 탓으로
    실패한다(실제로 CI 에서 그렇게 터졌다).

    Vercel 은 이 폴더를 CDN 으로 올린다. 그래서 첫 화면이 함수의 콜드 스타트를
    기다리지 않는다.
    """
    if not dist.is_dir():
        return

    target.frontend("/", directory=dist)

    @target.middleware("http")
    async def static_cache_control(request: Request, call_next):  # type: ignore[no-untyped-def]
        response = await call_next(request)
        if response.status_code == 200:
            path = request.url.path
            for prefix, value in STATIC_CACHE_CONTROL.items():
                if path.startswith(prefix):
                    response.headers["cache-control"] = value
                    break
        return response


mount_web()
