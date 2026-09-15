# ============================================================================
# Copyright (c) 2026 정화민 (Junghwamin)
# Licensed under the PolyForm Noncommercial License 1.0.0.
# ============================================================================
"""데이터셋 정보와 통계 엔드포인트.

이 모듈은 **코어 함수를 감싸기만 한다.** 계산 로직을 새로 쓰지 않는다.
하는 일은 셋이다: 모집단 판정(deps), 한글 키 → 영문 키 번역(schemas),
그리고 HTTP 오류 매핑.
"""

from __future__ import annotations

import pandas as pd
from fastapi import APIRouter

import core.data_loader as dl
from api import analysis, deps, schemas

router = APIRouter(prefix="/api", tags=["stats"])


@router.get("/data", response_model=schemas.DatasetInfo)
def get_dataset_info() -> schemas.DatasetInfo:
    national_df, regional_df = deps.get_frames()
    years = dl.get_available_years(national_df)
    latest = years[-1]

    count = int((national_df["연도"] == latest).sum())

    return schemas.DatasetInfo(
        years=years,
        regions=sorted(regional_df["권역명"].dropna().unique().tolist()),
        universityCount=count,
        # 화면이 목록에서 고르게 하려면 이름이 필요하다. 전 연도 합집합을 주는
        # 이유는, 특정 해에만 있는 대학(제주국제대는 2016~2025)도 고를 수
        # 있어야 하기 때문이다 — 없는 해를 고르면 서버가 404 로 알려준다.
        universities=sorted(national_df["학교명"].dropna().unique().tolist()),
        # V14. 사용자 결정은 "현행 유지 + 라벨 명시" 였다. 수치는 그대로 두되
        # 어떤 모집단인지를 API 가 반드시 알려준다.
        nationalRankScopeNote=(
            f"전국순위는 대학알리미에 등재된 사립 {count}개교 기준이다. "
            f"국공립대·과기원은 집계에 포함되지 않는다."
        ),
    )


@router.get("/regions", response_model=schemas.RegionsResponse)
def get_regions(university: str) -> schemas.RegionsResponse:
    _, regional_df = deps.get_frames()
    regions = dl.detect_region(university, regional_df)
    if not regions:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail=f"없는 대학이다: {university}")
    return schemas.RegionsResponse(university=university, regions=regions)


@router.post("/stats", response_model=schemas.StatsResponse)
def post_stats(req: schemas.StatsRequest) -> schemas.StatsResponse:
    # 모집단 판정과 계산은 `api.analysis` 한 곳에서만 한다. 여기서 한 번 더
    # 하면 보고서·차트와 갈라질 자리가 생긴다 — 실제로 두 번 그랬다.
    scope = analysis.resolve_scope(
        req.university, req.year, req.regionName, req.compareGroup, req.years
    )
    stats = analysis.collect_stats(scope)

    return schemas.StatsResponse(
        university=scope.university,
        year=scope.year,
        regionName=scope.region_name,
        compareGroup=scope.compare_group,
        compareGroupNote=scope.compare_note,
        years=scope.years,
        trend={
            y: schemas.TrendPoint(**schemas.translate(v, schemas.TREND_KEYS))
            for y, v in stats["trend"].items()
        },
        averages={
            y: schemas.Averages(**schemas.translate(v, schemas.AVERAGE_KEYS))
            for y, v in stats["averages"].items()
        },
        rankChanges={
            y: schemas.RankChange(**schemas.translate(v, schemas.RANK_CHANGE_KEYS))
            for y, v in stats["ranks"].items()
        },
        compare=[
            schemas.CompareRow(**schemas.translate(row, schemas.COMPARE_KEYS))
            for row in stats["compare"]
        ],
        yoy=_to_yoy(stats["yoy"]),
    )


def _to_yoy(raw: dict) -> schemas.YoYChanges:
    """코어의 `{상위, 하위, 호서}` 를 API 모양으로 옮긴다.

    키 이름이 '호서' 인 것은 역사적 잔재다 — 값은 `university=` 로 지정한
    대상 대학이다(D07 에서 확인). 이름만 바로잡고 값은 그대로 쓴다.
    """

    def entry(row: dict | None) -> schemas.YoYEntry | None:
        if not row:
            return None
        return schemas.YoYEntry(**schemas.translate(row, schemas.YOY_ENTRY_KEYS))

    return schemas.YoYChanges(
        top=[e for e in (entry(r) for r in raw.get("상위", [])) if e],
        bottom=[e for e in (entry(r) for r in raw.get("하위", [])) if e],
        target=entry(raw.get("호서")),
    )


@router.get("/universities", response_model=schemas.UniversitiesResponse)
def get_region_universities(region: str, year: int) -> schemas.UniversitiesResponse:
    """권역 안의 대학 전체와 그 해 지표.

    비교군 후보를 고르는 화면과 권역 막대차트가 같은 데이터를 쓴다.
    `/api/stats` 의 `compare` 는 **확정된 비교군만** 담으므로, 후보를 보여주려면
    이게 따로 필요하다.
    """
    national_df, regional_df = deps.get_frames()
    deps.require_year(year, national_df)

    regions = set(regional_df["권역명"].dropna().unique())
    if region not in regions:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=404, detail=f"없는 권역이다: {region}. 가능: {sorted(regions)}"
        )

    rows = regional_df[
        (regional_df["권역명"] == region) & (regional_df["연도"] == year)
    ]
    sort_col = "권역순위" if "권역순위" in rows.columns else "학교명"
    rows = rows.sort_values([sort_col, "학교명"])

    def _int_or_none(value) -> int | None:
        return None if pd.isna(value) else int(value)

    return schemas.UniversitiesResponse(
        regionName=region,
        year=year,
        rows=[
            schemas.UniversityRow(
                name=str(r["학교명"]),
                faculty=int(r["전임교원수"]),
                papers=float(r["SCI/SCOPUS논문수"]),
                perCapita=float(r["1인당논문수"]),
                regionalRank=_int_or_none(r.get("권역순위")),
                nationalRank=_int_or_none(r.get("전국순위")),
            )
            for _, r in rows.iterrows()
        ],
    )
