# ============================================================================
# Copyright (c) 2026 정화민 (Junghwamin)
# Licensed under the PolyForm Noncommercial License 1.0.0.
# ============================================================================
"""API 응답 계약.

**코어의 한글 키를 여기서 영문으로 번역한다.** 이유는 둘이다.

1. `1인당논문수` 는 숫자로 시작해서 TypeScript 에서 `d.1인당논문수` 로 접근할
   수 없다. 전부 대괄호 표기가 되어 자동완성과 타입 추론이 죽는다.
2. 코어를 건드리지 않기 위해서다. `core/` 는 233건의 테스트가 지키고 있고
   한글 키가 그 계약의 일부다. 번역은 경계에서만 한다(anti-corruption layer).

번역표는 `_KEY_MAP` 하나에 모은다. 두 군데로 갈라지면 반드시 어긋난다.
"""

from __future__ import annotations

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# 번역표 — 코어(한글) → API(영문)
# ---------------------------------------------------------------------------

TREND_KEYS = {
    "논문수": "papers",
    "전임교원수": "faculty",
    "1인당논문수": "perCapita",
    "권역순위": "regionalRank",
    "전국순위": "nationalRank",
}

AVERAGE_KEYS = {
    "전국평균": "national",
    "권역평균": "regional",
    "비교군평균": "compareGroup",
}

RANK_CHANGE_KEYS = {
    "권역순위": "regionalRank",
    "전국순위": "nationalRank",
    "권역순위_변화": "regionalRankDelta",
    "전국순위_변화": "nationalRankDelta",
}

COMPARE_KEYS = {
    "학교명": "name",
    "전임교원수": "faculty",
    "논문수": "papers",
    "1인당논문수": "perCapita",
    "전국순위": "nationalRank",
    "권역순위": "regionalRank",
}

# 주의: 코어의 `기준연도`/`비교연도` 는 **연도가 아니라 그 해의 값**이다.
# (get_yoy_changes 가 1인당논문수를 담는다.) 이름이 오해를 부르므로 바로잡는다.
YOY_ENTRY_KEYS = {
    "학교명": "name",
    "증감률": "changeRate",
    "기준연도": "baseValue",
    "비교연도": "compareValue",
}


def translate(row: dict, key_map: dict[str, str]) -> dict:
    """한 행의 키를 번역한다. 표에 없는 키는 그대로 둔다(조용히 잃지 않기 위해)."""
    return {key_map.get(k, k): v for k, v in row.items()}


# ---------------------------------------------------------------------------
# 응답 모델
# ---------------------------------------------------------------------------


class TrendPoint(BaseModel):
    """한 해의 대상 대학 실적."""

    papers: float
    faculty: int
    perCapita: float
    # 권역 데이터가 없으면 None. 0 과 구분해야 한다.
    regionalRank: int | None
    nationalRank: int | None


class Averages(BaseModel):
    """한 해의 평균 3종. 모집단이 비면 0.0 이 아니라 None 이다."""

    national: float | None
    regional: float | None
    compareGroup: float | None


class RankChange(BaseModel):
    """순위와 그 변화.

    **부호 규약: 양수 = 개선.** 순위는 작아지는 것이 개선이므로
    `이전순위 - 현재순위` 다. V09 가 이 규약을 화면에서 한 번 더 뒤집어
    개선을 하락으로 표시했던 결함이다. 여기서 못박고 프론트는 그대로 쓴다.
    """

    regionalRank: int | None
    nationalRank: int | None
    regionalRankDelta: int | None
    nationalRankDelta: int | None


class CompareRow(BaseModel):
    """비교군 표의 한 행."""

    name: str
    faculty: int
    papers: float
    perCapita: float
    nationalRank: int | None
    regionalRank: int | None


class YoYEntry(BaseModel):
    """전년 대비 증감 한 건."""

    name: str
    # 이전값이 0 이면 증감률을 낼 수 없다. 0.0 이 아니라 None 을 보낸다 —
    # V12 에서 신규 실적이 "+0.0%" 로 표기되던 결함의 수정 결과다.
    changeRate: float | None
    baseValue: float
    compareValue: float


class YoYChanges(BaseModel):
    top: list[YoYEntry]
    bottom: list[YoYEntry]
    target: YoYEntry | None


class DatasetInfo(BaseModel):
    """어떤 데이터로 계산했는지. 화면 라벨의 근거가 된다."""

    years: list[int]
    regions: list[str]
    universityCount: int
    # V14: '전국순위' 는 등재 사립 N개교 안에서의 순위다. 이 사실을 숨기지 않는다.
    nationalRankScopeNote: str


class StatsRequest(BaseModel):
    university: str
    year: int
    # None 이면 서버가 detect_region 으로 자동 판정한다.
    # V03 이 났던 지점 — 권역 미설정이면 '권역평균'이 전국 평균이 됐다.
    regionName: str | None = None
    compareGroup: list[str] | None = None


class StatsResponse(BaseModel):
    university: str
    year: int
    regionName: str
    compareGroup: list[str]
    #: 비교군을 정상적으로 채우지 못했으면 그 이유. 정상이면 None.
    #: R-RS-02 의 교훈 — 자기 자신과 비교하게 되는 상황을 **조용히** 넘기지 않는다.
    #: (제주권은 전 연도에 걸쳐 대학이 1개교뿐이라 실제로 발생한다.)
    compareGroupNote: str | None
    trend: dict[int, TrendPoint]
    averages: dict[int, Averages]
    rankChanges: dict[int, RankChange]
    compare: list[CompareRow]
    yoy: YoYChanges


class RegionsResponse(BaseModel):
    """대학이 속한 권역들. 다중 캠퍼스는 2개 이상이 나온다."""

    university: str
    regions: list[str]
