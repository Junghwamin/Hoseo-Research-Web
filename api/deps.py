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
#:
#: **기본 비교군 경로에만 쓴다.** 사용자가 직접 고른 비교군을 이 값으로
#: 자르면, 화면에 "7개교 선택" 이라고 띄워 놓고 보고서에는 4개교만 넣게 된다.
COMPARE_FALLBACK_SIZE = 4

#: 사용자가 직접 고를 수 있는 비교군 상한.
#:
#: 막대가 스무 개를 넘으면 차트에서 이름이 겹쳐 읽히지 않는다. 다만 넘겼을
#: 때 **조용히 자르지 않고** 사유를 올려보낸다.
MAX_REQUESTED_COMPARE = 20


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


def resolve_years(
    national_df: pd.DataFrame, year: int, requested: list[int] | None
) -> list[int]:
    """분석 연도를 확정한다. 생략하면 데이터에 있는 전 연도.

    원본 Streamlit 판의 「분석 연도 선택」 multiselect 가 하던 일이다. 이관에서
    빠지면서 추이·평균·순위가 **언제나 11개년 전부**로 그려졌다 — 최근 3년만
    보고 싶어도 방법이 없었다.

    기준 연도가 선택 밖이면 422 로 막는다. 그대로 통과시키면 비교표와 YoY 는
    기준 연도로 계산되는데 추이 차트에는 그 해가 없어, 같은 화면의 두 그림이
    서로 다른 해를 말하게 된다.
    """
    available = dl.get_available_years(national_df)
    if not requested:
        return available

    unknown = sorted({y for y in requested if y not in set(available)})
    if unknown:
        raise HTTPException(
            status_code=422,
            detail=f"데이터에 없는 연도다: {unknown}. 가능: {available}",
        )

    years = sorted(set(requested))
    if year not in years:
        raise HTTPException(
            status_code=422,
            detail=(
                f"기준 연도 {year} 는 분석 연도 안에 있어야 한다. "
                f"고른 연도: {years}"
            ),
        )
    return years


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

    경로가 둘이고, **규칙이 다르다.**

    - `requested` 가 있으면 **사용자가 고른 대로** 쓴다. 뺄 이유가 있으면
      (그 해 그 권역에 없는 대학, 상한 초과) 반드시 사유를 함께 올려보낸다.
    - `requested` 가 없으면 기본 비교군을 쓰고, 그것이 부실하면 권역 상위로
      채운다.

    R-RS-02: `config.COMPARE_GROUP` 5개교가 전부 충청권이라, 대상이 다른
    권역이면 후보가 전부 걸러져 비교군이 자기 자신뿐이 됐다. 그러면
    '비교군평균' 이 대상 대학의 값과 같아지는데 경고조차 없었다.
    권역에 기본 비교군이 없으면 같은 권역 상위 대학으로 채운다.

    돌려주는 목록의 **첫 항목은 언제나 대상 대학**이다. 비교 차트에 대상의
    막대가 없으면 무엇과 비교하는지 알 수 없다.
    """
    in_region = set(_region_universities(regional_df, region_name, year))
    note: str | None = None

    if requested:
        # **사용자가 고른 것은 그대로 쓴다.** 하나만 골랐어도 그건 선택이다.
        #
        # 예전에는 아래 `len(group) < 2` 채우기가 요청받은 경우에도 돌아서,
        # 비교군을 1개교만 고르면 말없이 권역 상위 5개교로 바뀌었다. 화면은
        # "1개교 선택" 이라고 하는데 보고서에는 5개교가 실렸다.
        group = [u for u in requested if u != university]

        # 그 해 그 권역에 없는 이름은 계산에서 어차피 빠진다. 조용히 빠지면
        # 비교군 개수가 안 맞는 이유를 알 수 없으므로 사유로 올려보낸다.
        missing = [u for u in group if u not in in_region]
        if missing:
            group = [u for u in group if u in in_region]
            note = (
                f"{year}년 {region_name}에 없는 대학을 비교군에서 뺐다: "
                f"{', '.join(missing)}"
            )

        if len(group) > MAX_REQUESTED_COMPARE:
            # 막대가 스무 개를 넘으면 차트가 읽히지 않는다. 자르되 **말하고**
            # 자른다 — 조용히 자르면 고른 대학이 왜 없는지 알 수 없다.
            note = (
                f"비교군은 최대 {MAX_REQUESTED_COMPARE}개교까지다. "
                f"고른 {len(group)}개교 중 앞 {MAX_REQUESTED_COMPARE}개교만 쓴다."
            )
            group = group[:MAX_REQUESTED_COMPARE]

        if not group and note is None:
            note = (
                f"{university} 자신만 비교군에 있다. "
                f"비교군 평균은 {university} 자신의 값이다."
            )
        return [university, *group], note

    # 기본 비교군 중 이 권역에 실제로 있는 대학만
    group = [u for u in COMPARE_GROUP if u != university and u in in_region]

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
    "MAX_REQUESTED_COMPARE",
    "UNIVERSITY",
    "get_frames",
    "require_university",
    "require_year",
    "reset_cache",
    "resolve_compare_group",
    "resolve_region",
    "resolve_years",
]
