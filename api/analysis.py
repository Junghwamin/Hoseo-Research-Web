# ============================================================================
# Copyright (c) 2026 정화민 (Junghwamin)
# Licensed under the PolyForm Noncommercial License 1.0.0.
# ============================================================================
"""모집단을 확정하고 통계를 모으는 **한 곳**.

`/api/stats`·`/api/narrative`·`/api/report`·`/api/chart` 는 같은 입력이면
같은 숫자를 내야 한다. "화면에서 확인한 것이 그대로 문서에 들어간다" 가
이 앱의 계약이기 때문이다.

그 계약은 이미 두 번 깨졌다.

- 차트 엔드포인트만 비교군을 무시해, 화면 그림과 Word 그림이 갈라졌다.
- 비교군 채우기 규칙이 요청 경로까지 덮어, 1개교를 고르면 5개교로 바뀌었다.

원인은 같다 — **같은 판정을 네 곳에서 따로 했다.** 판정을 여기 하나로 모으면
갈라질 자리가 없어진다. 라우터는 요청을 `Scope` 로 바꾸고 결과를 번역할 뿐이다.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TypeVar

import pandas as pd

import core.data_loader as dl
from api import deps

T = TypeVar("T")


@dataclass(frozen=True, eq=False)
class Scope:
    """한 번의 분석이 무엇을 대상으로 하는지. **전부 확정된 값이다.**

    `None` 이 하나도 없다는 것이 이 타입의 요점이다. 권역이 `None` 인 채로
    통계 함수에 들어가면 '권역평균' 이 6개 권역 전체 평균이 되는데, 화면과
    보고서는 그것을 특정 권역이라고 표기했다(V03). 확정을 타입으로 강제한다.

    `eq=False` 인 이유: DataFrame 은 `==` 가 진릿값이 아니라 표를 돌려줘
    자동 생성된 `__eq__` 가 예외를 던진다.
    """

    national_df: pd.DataFrame
    regional_df: pd.DataFrame
    university: str
    #: 기준 연도. 비교표·YoY·막대차트가 이 한 해를 본다.
    year: int
    region_name: str
    compare_group: list[str]
    #: 비교군을 정상 구성하지 못했다면 그 사유. 정상이면 None.
    compare_note: str | None
    #: 분석 연도. 추이·평균·순위 계열에 남길 해들이다. 오름차순.
    years: list[int]


def resolve_scope(
    university: str,
    year: int,
    region_name: str | None = None,
    compare_group: list[str] | None = None,
    years: list[int] | None = None,
) -> Scope:
    """요청을 확정된 모집단으로 바꾼다. 네 엔드포인트가 전부 이것을 쓴다."""
    national_df, regional_df = deps.get_frames()

    deps.require_year(year, national_df)
    deps.require_university(university, national_df, year=year)

    resolved_years = deps.resolve_years(national_df, year, years)
    resolved_region = deps.resolve_region(university, regional_df, region_name)
    group, note = deps.resolve_compare_group(
        university, resolved_region, regional_df, year, compare_group
    )

    return Scope(
        national_df=national_df,
        regional_df=regional_df,
        university=university,
        year=year,
        region_name=resolved_region,
        compare_group=group,
        compare_note=note,
        years=resolved_years,
    )


def collect_stats(scope: Scope) -> dict:
    """보고서·화면·차트가 함께 쓰는 통계 묶음.

    **증감은 고른 연도가 아니라 전 연도로 계산한 뒤 잘라낸다.** 이유가 있다.

    `get_rank_changes` 는 프레임에 남은 **바로 앞 행**과 비교한다. 연도를
    걸러서 넘기면 2020년과 2026년만 고른 사용자에게 "전년대비 +3계단" 이라고
    표시되는데, 실제로는 6년 간격이다. 「전년대비」라고 써 놓고 다른 것을
    보여주는 셈이라, 계산은 전 연도로 하고 표시할 해만 남긴다.

    `get_yoy_changes` 는 `year - 1` 을 직접 찾으므로 애초에 거르지 않는다.
    「전년 대비 증감」의 '전년' 은 분석 연도 선택과 무관하게 바로 앞 해다.
    """
    trend = dl.get_hoseo_trend(
        scope.national_df,
        scope.regional_df,
        university=scope.university,
        region_name=scope.region_name,
    )
    averages = dl.get_averages(
        scope.national_df,
        scope.regional_df,
        compare_group=scope.compare_group,
        region_name=scope.region_name,
    )
    ranks = dl.get_rank_changes(
        scope.national_df,
        scope.regional_df,
        university=scope.university,
        region_name=scope.region_name,
    )

    return {
        "trend": _only(trend, scope.years),
        "averages": _only(averages, scope.years),
        "ranks": _only(ranks, scope.years),
        # 아래 둘은 기준 연도(와 그 앞 해)만 보므로 연도 선택의 영향이 없다.
        "compare": dl.get_compare_group_data(
            scope.national_df,
            scope.regional_df,
            scope.year,
            compare_group=scope.compare_group,
            region_name=scope.region_name,
        ),
        "yoy": dl.get_yoy_changes(
            scope.regional_df,
            scope.year,
            university=scope.university,
            region_name=scope.region_name,
        ),
    }


def _only(series: dict[int, T], years: list[int]) -> dict[int, T]:
    """연도별 계열에서 고른 해만 남긴다. 순서는 원본을 따른다."""
    keep = set(years)
    return {y: v for y, v in series.items() if y in keep}


__all__ = ["Scope", "collect_stats", "resolve_scope"]
