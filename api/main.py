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

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from api.routers import data, report, settings, stats

PROJECT_ROOT = Path(__file__).resolve().parent.parent
WEB_DIST = PROJECT_ROOT / "web" / "dist"

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


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def mount_web() -> None:
    """React 빌드 산출물을 서빙한다. 없으면 조용히 건너뛴다(개발 중에는 Vite 가 뜬다)."""
    if not WEB_DIST.is_dir():
        return

    app.mount("/assets", StaticFiles(directory=WEB_DIST / "assets"), name="assets")

    # OpenAPI 스키마에서 제외한다. 이건 API 엔드포인트가 아니라 정적 파일
    # 서빙이고, 무엇보다 **web/dist 존재 여부에 따라 스키마가 달라지면 안 된다.**
    # 프론트를 빌드했는지에 따라 생성 타입이 갈리면 드리프트 가드가 환경 탓으로
    # 실패한다(실제로 CI 에서 그렇게 터졌다).
    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str) -> FileResponse:
        # 클라이언트 라우팅: 알 수 없는 경로는 index.html 로 넘겨 React 가 처리한다
        candidate = WEB_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(WEB_DIST / "index.html")


mount_web()
