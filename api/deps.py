# ============================================================================
# Copyright (c) 2026 정화민 (Junghwamin)
# Licensed under the PolyForm Noncommercial License 1.0.0.
# ============================================================================
"""데이터 로딩과 해석 규칙.

여기 있는 것은 **"어떤 모집단으로 계산할 것인가"** 의 판정뿐이다.
계산 자체는 전부 `core/` 가 한다 — 233건의 테스트가 지키는 코드를 다시 쓰지
않는다.
"""

from __future__ import annotations

from functools import lru_cache

import pandas as pd
from fastapi import HTTPException

import core.data_loader as dl
from core.config import COMPARE_GROUP, UNIVERSITY

#: 비교군이 대상 대학 하나만 남지 않도록 채울 최소 인원(R-RS-02).
COMPARE_FALLBACK_SIZE = 4


@lru_cache(maxsize=1)
def _load() -> tuple[pd.DataFrame, pd.DataFrame]:
    """CSV 를 한 번만 읽는다. 파일이 없으면 503 — 클라이언트 잘못이 아니다."""
    try:
        return dl.load_all_data()
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=503,
            detail=f"데이터 파일이 없다. 전처리를 먼저 실행해야 한다: {e}",
        ) from e


def get_frames() -> tuple[pd.DataFrame, pd.DataFrame]:
    return _load()


def reset_cache() -> None:
    """전처리로 CSV 가 새로 쓰이면 캐시를 버린다."""
    _load.cache_clear()


def resolve_region(university: str, regional_df: pd.DataFrame, requested: str | None) -> str:
    """대상 대학의 권역을 **반드시 하나로** 확정한다.

    V03 의 핵심이다. 권역이 None 인 채로 통계 함수에 들어가면 '권역평균' 이
    6개 권역 전체 평균이 되는데, 화면·보고서·GPT 프롬프트는 그것을 특정
    권역이라고 표기했다. None 을 그대로 통과시키지 않는다.

    다중 캠퍼스 대학은 요청값을 우선하고, 없으면 첫 번째 권역을 쓴다.
    """
    detected = dl.detect_region(university, regional_df)
    if not detected:
        raise HTTPException(
            status_code=404, detail=f"권역 데이터에 없는 대학이다: {university}"
        )
    if requested is not None:
        if requested not in detected:
            raise HTTPException(
                status_code=400,
                detail=f"{university} 는 {requested} 에 속하지 않는다. 가능: {detected}",
            )
        return requested
    return detected[0]


def resolve_compare_group(
    university: str,
    region_name: str,
    regional_df: pd.DataFrame,
    year: int,
    requested: list[str] | None,
) -> tuple[list[str], str | None]:
    """비교군과, 정상 구성에 실패했다면 그 사유를 돌려준다. **대상 대학 하나만 남는 일은 없다.**

    R-RS-02: `config.COMPARE_GROUP` 5개교가 전부 충청권이라, 대상이 다른
    권역이면 후보가 전부 걸러져 비교군이 자기 자신뿐이 됐다. 그러면
    '비교군평균' 이 대상 대학의 값과 같아지는데 경고조차 없었다.
    권역에 기본 비교군이 없으면 같은 권역 상위 대학으로 채운다.
    """
    if requested:
        group = [u for u in requested if u != university]
    else:
        # 기본 비교군 중 이 권역에 실제로 있는 대학만
        in_region = set(_region_universities(regional_df, region_name, year))
        group = [u for u in COMPARE_GROUP if u != university and u in in_region]

    note: str | None = None
    if len(group) < 2:
        group = _region_top(regional_df, region_name, year, exclude=university)

    if not group:
        # 권역에 다른 대학이 아예 없다. 비교군평균이 대상 대학의 값과 같아지므로
        # 화면이 그것을 "비교" 라고 부르면 안 된다. 사유를 올려보낸다.
        peers = len(_region_universities(regional_df, region_name, year))
        note = (
            f"{year}년 {region_name}에 집계된 대학이 {peers}개교뿐이라 "
            f"비교군을 구성할 수 없다. 비교군 평균은 {university} 자신의 값이다."
        )

    return [university, *group[:COMPARE_FALLBACK_SIZE]], note


def _region_universities(regional_df: pd.DataFrame, region_name: str, year: int) -> list[str]:
    rows = regional_df[
        (regional_df["권역명"] == region_name) & (regional_df["연도"] == year)
    ]
    return rows["학교명"].tolist()


def _region_top(
    regional_df: pd.DataFrame, region_name: str, year: int, exclude: str
) -> list[str]:
    """권역순위 상위 대학. 순위 컬럼이 없으면 학교명 순으로 안정 정렬한다."""
    rows = regional_df[
        (regional_df["권역명"] == region_name) & (regional_df["연도"] == year)
    ]
    rows = rows[rows["학교명"] != exclude]
    sort_col = "권역순위" if "권역순위" in rows.columns else "학교명"
    return rows.sort_values([sort_col, "학교명"])["학교명"].tolist()


def require_university(
    university: str, national_df: pd.DataFrame, year: int | None = None
) -> None:
    """대학이 존재하는지 확인한다.

    `year` 를 주면 **그 해에** 존재하는지까지 본다. 대학은 신설·폐교·개명으로
    특정 연도에만 있을 수 있는데(제주국제대는 2016~2025 에만 있다), 전 연도
    집합으로만 검사하면 없는 해를 조회해도 통과해 빈 통계가 나간다.
    """
    if university not in set(national_df["학교명"]):
        raise HTTPException(status_code=404, detail=f"없는 대학이다: {university}")

    if year is not None:
        in_year = set(national_df[national_df["연도"] == year]["학교명"])
        if university not in in_year:
            years = sorted(
                int(y) for y in national_df[national_df["학교명"] == university]["연도"].unique()
            )
            raise HTTPException(
                status_code=404,
                detail=f"{university} 는 {year} 년 데이터에 없다. 있는 연도: {years}",
            )


def require_year(year: int, national_df: pd.DataFrame) -> None:
    if year not in set(dl.get_available_years(national_df)):
        raise HTTPException(
            status_code=404,
            detail=f"{year} 년 데이터가 없다. 가능: {dl.get_available_years(national_df)}",
        )


__all__ = [
    "COMPARE_FALLBACK_SIZE",
    "UNIVERSITY",
    "get_frames",
    "require_university",
    "require_year",
    "reset_cache",
    "resolve_compare_group",
    "resolve_region",
]
