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

from api.routers import report, stats

PROJECT_ROOT = Path(__file__).resolve().parent.parent
WEB_DIST = PROJECT_ROOT / "web" / "dist"

app = FastAPI(
    title="연구실적 분석 포털 API",
    version="6.0",
    description="대학알리미 전임교원 연구실적 분석. core/ 의 순수 함수를 감싼다.",
)

app.include_router(stats.router)
app.include_router(report.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def mount_web() -> None:
    """React 빌드 산출물을 서빙한다. 없으면 조용히 건너뛴다(개발 중에는 Vite 가 뜬다)."""
    if not WEB_DIST.is_dir():
        return

    app.mount("/assets", StaticFiles(directory=WEB_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str) -> FileResponse:
        # 클라이언트 라우팅: 알 수 없는 경로는 index.html 로 넘겨 React 가 처리한다
        candidate = WEB_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(WEB_DIST / "index.html")


mount_web()
