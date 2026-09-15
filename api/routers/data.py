# ============================================================================
# Copyright (c) 2026 정화민 (Junghwamin)
# Licensed under the PolyForm Noncommercial License 1.0.0.
# ============================================================================
"""데이터 갱신 엔드포인트.

원본 Streamlit 판의 「새 Raw Excel 파일 업로드」가 하던 일이다. 이관에서
엔드포인트째 빠져, 새 연도 공시가 나와도 화면에서 넣을 방법이 없었다.

판정과 실행은 전부 `api.preprocess_service` 에 있다. 여기는 HTTP 모양만 맡는다.
"""

from __future__ import annotations

from fastapi import APIRouter, File, UploadFile

from api import preprocess_service as svc
from api import schemas

router = APIRouter(prefix="/api", tags=["data"])


@router.post("/preprocess", response_model=schemas.PreprocessResponse)
async def post_preprocess(
    files: list[UploadFile] = File(
        ...,
        description=(
            "대학알리미 Raw xlsx. 파일명에 '2026년' 또는 '2026_' 처럼 "
            "연도가 들어 있어야 한다."
        ),
    ),
) -> schemas.PreprocessResponse:
    """Raw Excel 을 올려 데이터를 다시 만든다.

    **`Raw data/` 폴더 전체를 다시 계산한다.** 올린 파일만 처리하면 CSV 에
    그 연도만 남아 나머지가 사라진다 — 순위가 그 해 전체 대학을 놓고 매겨지는
    값이라 부분 계산이 성립하지 않는다.

    실패하면 아무것도 바뀌지 않는다. 임시 폴더에 쓰고 끝까지 성공했을 때만
    `output/` 에 반영하며, 덮어쓰기 직전 내용은 백업해 둔다.

    파일 읽기를 먼저 다 끝내고 판정으로 넘긴다. 서비스 층이 `UploadFile` 을
    모르게 해야 테스트에서 바이트만 주고 돌릴 수 있다.
    """
    uploads: list[tuple[str, bytes]] = []
    for upload in files:
        name = svc.safe_name(upload.filename)
        uploads.append((name, await upload.read()))

    return schemas.PreprocessResponse(**svc.ingest(uploads))
