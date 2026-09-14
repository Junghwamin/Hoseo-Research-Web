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

from fastapi import APIRouter

import core.data_loader as dl
from api import deps, schemas

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
    national_df, regional_df = deps.get_frames()

    deps.require_year(req.year, national_df)
    deps.require_university(req.university, national_df, year=req.year)

    # 권역과 비교군은 반드시 확정된 값으로 아래에 넘긴다. None 을 흘려보내면
    # '권역평균' 이 전국 평균이 된다(V03).
    region_name = deps.resolve_region(req.university, regional_df, req.regionName)
    compare_group, compare_note = deps.resolve_compare_group(
        req.university, region_name, regional_df, req.year, req.compareGroup
    )

    trend = dl.get_hoseo_trend(
        national_df, regional_df, university=req.university, region_name=region_name
    )
    averages = dl.get_averages(
        national_df, regional_df, compare_group=compare_group, region_name=region_name
    )
    ranks = dl.get_rank_changes(
        national_df, regional_df, university=req.university, region_name=region_name
    )
    compare = dl.get_compare_group_data(
        national_df,
        regional_df,
        req.year,
        compare_group=compare_group,
        region_name=region_name,
    )
    yoy = dl.get_yoy_changes(
        regional_df, req.year, university=req.university, region_name=region_name
    )

    return schemas.StatsResponse(
        university=req.university,
        year=req.year,
        regionName=region_name,
        compareGroup=compare_group,
        compareGroupNote=compare_note,
        trend={
            y: schemas.TrendPoint(**schemas.translate(v, schemas.TREND_KEYS))
            for y, v in trend.items()
        },
        averages={
            y: schemas.Averages(**schemas.translate(v, schemas.AVERAGE_KEYS))
            for y, v in averages.items()
        },
        rankChanges={
            y: schemas.RankChange(**schemas.translate(v, schemas.RANK_CHANGE_KEYS))
            for y, v in ranks.items()
        },
        compare=[
            schemas.CompareRow(**schemas.translate(row, schemas.COMPARE_KEYS))
            for row in compare
        ],
        yoy=_to_yoy(yoy),
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
