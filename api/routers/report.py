# ============================================================================
# Copyright (c) 2026 정화민 (Junghwamin)
# Licensed under the PolyForm Noncommercial License 1.0.0.
# ============================================================================
"""GPT 서술과 Word 보고서 엔드포인트.

두 가지 원칙이 이 모듈의 모양을 정한다.

1. **API 키는 서버 밖으로 나가지 않는다.** 프론트는 "설정됨/미설정" 만 안다.
   Streamlit 판은 키를 `session_state` 에 담아 화면과 같은 생명주기에 뒀는데,
   그건 키를 브라우저로 보낸다는 뜻이다.

2. **보고서는 디스크에 남기지 않는다.** 메모리에서 만들어 바이트로 내려준다.
   서버가 파일을 쓰면 동시 사용자끼리 덮어쓰고, 클라우드에서는 쓰기 권한조차
   없을 수 있다(V15·APP-05 가 그 언저리의 문제였다).

화면 차트는 React 가 그리지만 **Word 보고서용 PNG 는 여기서 matplotlib 이
만든다.** 목적이 다르다 — 하나는 인터랙티브, 하나는 문서에 박히는 정적 이미지다.
"""

from __future__ import annotations

import os
import threading
from collections import OrderedDict
from io import BytesIO
from urllib.parse import quote

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

import core.chart_generator as cg
import core.data_loader as dl
import core.gpt_reporter as gpt
import core.report_builder as rb
from api import deps, schemas

router = APIRouter(prefix="/api", tags=["report"])

#: 차트 생성 직렬화용 락.
#:
#: `core.chart_generator` 는 전역 pyplot 상태를 쓴다. uvicorn 은 동기
#: 엔드포인트를 스레드풀에서 돌리므로, 보고서 요청이 겹치면 서로의 figure 를
#: 건드려 그림이 섞이거나 빈 PNG 가 나온다. 차트 생성만 한 번에 하나씩 한다 —
#: 통계 계산과 문서 조립은 락 밖이라 병렬로 돈다.
_CHART_LOCK = threading.Lock()

DOCX_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)


def _require_api_key() -> str:
    """서버가 가진 키를 돌려준다. 없으면 **이유를 말하고** 503.

    V16 은 키가 없을 때 사이드바에 "⚠ 미설정" 만 뜨고 왜 그런지는
    알려주지 않던 결함이었다. 문서가 안내한 중첩 `[openai]` 테이블 형식이
    코드가 읽는 평면 키와 달라서 생긴 일인데, 사용자는 원인을 알 길이 없었다.
    """
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key or key.startswith("sk-여기에"):
        raise HTTPException(
            status_code=503,
            detail=(
                "OPENAI_API_KEY 가 설정되지 않았다. 환경변수나 .env 에 "
                "**평면 키**로 넣어야 한다 — [openai] 테이블 형식은 인식되지 않는다."
            ),
        )
    return key


def _resolve(
    university: str,
    year: int,
    region_name: str | None,
    compare_group: list[str] | None,
) -> tuple[pd.DataFrame, pd.DataFrame, str, list[str]]:
    """대상·연도를 검증하고 모집단을 확정한다. /api/stats 와 같은 규칙을 쓴다."""
    national_df, regional_df = deps.get_frames()
    deps.require_year(year, national_df)
    deps.require_university(university, national_df, year=year)

    resolved_region = deps.resolve_region(university, regional_df, region_name)
    group, _note = deps.resolve_compare_group(
        university, resolved_region, regional_df, year, compare_group
    )
    return national_df, regional_df, resolved_region, group


def _collect_stats(
    national_df: pd.DataFrame,
    regional_df: pd.DataFrame,
    university: str,
    region_name: str,
    year: int,
    compare_group: list[str],
) -> dict:
    return {
        "trend": dl.get_hoseo_trend(
            national_df, regional_df, university=university, region_name=region_name
        ),
        "averages": dl.get_averages(
            national_df, regional_df, compare_group=compare_group, region_name=region_name
        ),
        "ranks": dl.get_rank_changes(
            national_df, regional_df, university=university, region_name=region_name
        ),
        "compare": dl.get_compare_group_data(
            national_df, regional_df, year,
            compare_group=compare_group, region_name=region_name,
        ),
        "yoy": dl.get_yoy_changes(
            regional_df, year, university=university, region_name=region_name
        ),
    }


# ---------------------------------------------------------------------------
# /api/narrative
# ---------------------------------------------------------------------------


@router.post("/narrative", response_model=schemas.NarrativeResponse)
def post_narrative(req: schemas.NarrativeRequest) -> schemas.NarrativeResponse:
    keys = tuple(req.keys) if req.keys else schemas.NARRATIVE_KEYS
    unknown = [k for k in keys if k not in schemas.NARRATIVE_KEYS]
    if unknown:
        raise HTTPException(
            status_code=422,
            detail=f"알 수 없는 서술 키: {unknown}. 가능: {list(schemas.NARRATIVE_KEYS)}",
        )

    api_key = _require_api_key()

    national_df, regional_df, region_name, group = _resolve(
        req.university, req.year, req.regionName, req.compareGroup
    )
    stats = _collect_stats(
        national_df, regional_df, req.university, region_name, req.year, group
    )

    from openai import OpenAI

    client = OpenAI(api_key=api_key)

    generators = {
        "trend": lambda: gpt.generate_trend_narrative(
            client, stats["trend"], stats["averages"],
            university=req.university, region_name=region_name,
        ),
        "comparison": lambda: gpt.generate_comparison_narrative(
            client, stats["compare"], stats["averages"], req.year,
            university=req.university, region_name=region_name,
        ),
        "regional": lambda: gpt.generate_regional_narrative(
            client, stats["trend"], stats["ranks"],
            university=req.university, region_name=region_name,
        ),
        "yoy": lambda: gpt.generate_yoy_narrative(
            client, stats["yoy"], req.year,
            university=req.university, region_name=region_name,
        ),
    }

    narratives: dict[str, str] = {}
    failed: dict[str, str] = {}
    for key in keys:
        try:
            narratives[key] = generators[key]()
        except Exception as e:  # noqa: BLE001
            # 하나 실패했다고 전부 버리면 사용자가 4번을 다시 기다린다.
            # 실패는 조용히 빈 문자열로 두지 않고 이유와 함께 올려보낸다.
            failed[key] = f"{type(e).__name__}: {e}"

    return schemas.NarrativeResponse(narratives=narratives, failed=failed)


# ---------------------------------------------------------------------------
# /api/report
# ---------------------------------------------------------------------------


@router.post("/report")
def post_report(req: schemas.ReportRequest) -> Response:
    national_df, regional_df, region_name, group = _resolve(
        req.university, req.year, req.regionName, req.compareGroup
    )
    stats = _collect_stats(
        national_df, regional_df, req.university, region_name, req.year, group
    )

    with _CHART_LOCK:
        charts = _build_charts(regional_df, stats, req.university, region_name, req.year)

    # 화면에서 편집한 서술을 그대로 쓴다. 없는 키는 빈 문자열 — 그 절은
    # 제목만 들어간다. 서버가 임의로 채우지 않는다.
    narratives = {k: req.narratives.get(k, "") for k in schemas.NARRATIVE_KEYS}

    buf: BytesIO = rb.build_report(
        req.year,
        stats["trend"],
        stats["averages"],
        stats["compare"],
        stats["yoy"],
        stats["ranks"],
        charts,
        narratives,
        university=req.university,
        region_name=region_name,
    )

    filename = f"{req.university}_연구실적_{req.year}.docx"
    return Response(
        content=buf.getvalue(),
        media_type=DOCX_MEDIA_TYPE,
        headers={
            # 한글 파일명은 RFC 5987 로 인코딩해야 한다. 원문을 그대로 넣으면
            # 헤더가 latin-1 이라 UnicodeEncodeError 가 나거나 이름이 깨진다.
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
        },
    )


def _build_charts(
    regional_df: pd.DataFrame,
    stats: dict,
    university: str,
    region_name: str,
    year: int,
) -> dict[str, BytesIO]:
    """Word 보고서용 정적 차트 5종.

    `create_comparison_bar` 는 연도만 필터하므로(V08 이 났던 자리) 호출 전에
    권역으로 먼저 걸러 넘긴다. 안 그러면 6개 권역 전체가 "충청권 비교" 로 그려진다.
    """
    region_only = regional_df[regional_df["권역명"] == region_name]
    return {
        "trend": cg.create_trend_chart(
            stats["trend"], stats["averages"],
            university=university, region_name=region_name,
        ),
        "bar": cg.create_comparison_bar(
            region_only, year, university=university, region_name=region_name
        ),
        "avg": cg.create_avg_comparison(
            stats["trend"], stats["averages"], year,
            university=university, region_name=region_name,
        ),
        "rank": cg.create_rank_trend_chart(
            stats["ranks"], university=university, region_name=region_name
        ),
        "compare": cg.create_compare_group_bar(
            stats["compare"], year, university=university
        ),
    }


# ---------------------------------------------------------------------------
# /api/chart/{kind}.png
# ---------------------------------------------------------------------------

#: 차트 종류별 한국어 설명. 화면 캡션과 alt 텍스트에 쓴다.
CHART_TITLES = {
    "trend": "연도별 1인당 논문 수 추이",
    "bar": "권역 내 전체 대학 비교",
    "avg": "평균 대비 위치",
    "rank": "순위 변화 추이",
    "compare": "비교군 대학 비교",
}


#: 렌더한 차트 묶음 캐시. 키는 그림을 결정하는 입력 전부다.
#:
#: `_build_charts` 는 **5종을 한 번에** 그린다. 화면이 5장을 붙이면 요청도
#: 5번 오는데, 캐시가 없으면 25번을 그리고 그 전부가 `_CHART_LOCK` 에 줄을
#: 선다 — 3단계 첫 로딩이 20초를 넘는다.
#:
#: 크기를 작게 두는 이유: figure 하나가 수백 KB 다. 사용자는 보통 한두 대상을
#: 오간다.
_CHART_CACHE: "OrderedDict[tuple, dict[str, BytesIO]]" = OrderedDict()
_CHART_CACHE_MAX = 4


def _charts_for(
    university: str,
    year: int,
    region: str | None,
    compare_group: list[str] | None,
) -> dict[str, BytesIO]:
    """5종 차트를 그려 돌려준다. 같은 입력이면 다시 그리지 않는다."""
    national_df, regional_df, region_name, group = _resolve(
        university, year, region, compare_group
    )
    # 키는 **확정된** 값으로 만든다. 요청이 region 을 생략해도 서버가 판정한
    # 권역이 같으면 같은 그림이므로 캐시가 맞는다.
    key = (university, year, region_name, tuple(group))

    with _CHART_LOCK:
        cached = _CHART_CACHE.get(key)
        if cached is not None:
            _CHART_CACHE.move_to_end(key)
            return cached

        stats = _collect_stats(
            national_df, regional_df, university, region_name, year, group
        )
        charts = _build_charts(regional_df, stats, university, region_name, year)
        _CHART_CACHE[key] = charts
        while len(_CHART_CACHE) > _CHART_CACHE_MAX:
            _CHART_CACHE.popitem(last=False)
        return charts


@router.get("/chart/{kind}.png")
def get_chart(
    kind: str,
    university: str,
    year: int,
    region: str | None = None,
    compareGroup: list[str] | None = Query(  # noqa: N803 — 프론트 키 이름을 따른다
        None,
        description=(
            "비교군 대학 이름. **반드시 보고서와 같은 값을 보내야 한다** — "
            "생략하면 서버 기본 비교군으로 그려져 Word 와 그림이 달라진다."
        ),
    ),
) -> Response:
    """Word 보고서에 들어가는 것과 **같은** PNG 를 돌려준다.

    화면 차트를 recharts 로 따로 그리면 사용자가 본 그림과 문서에 실리는
    그림이 갈라진다. Streamlit 판은 같은 PNG 를 화면과 문서가 공유했고
    ("5종 차트를 확인하세요. 보고서에 그대로 삽입됩니다"), 그 계약을 지킨다.

    추이 차트만은 화면에서 인터랙티브(recharts)로도 보여준다 — 값을 짚어
    읽는 용도다. 나머지 4종은 이 PNG 가 유일한 표현이다.
    """
    if kind not in schemas.CHART_KEYS:
        raise HTTPException(
            status_code=404,
            detail=f"없는 차트 종류: {kind}. 가능: {list(schemas.CHART_KEYS)}",
        )

    payload = _charts_for(university, year, region, compareGroup)[kind].getvalue()
    return Response(
        content=payload,
        media_type="image/png",
        headers={
            # 같은 입력이면 같은 그림이다. 단계를 오갈 때마다 다시 그리면
            # 한 장에 1초 가까이 걸리는 matplotlib 이 화면을 느리게 만든다.
            "Cache-Control": "private, max-age=300",
        },
    )
