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

import hashlib
import json
import re
from typing import Annotated

from pydantic import BaseModel, Field, field_validator, model_validator


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
# 브라우저 데이터셋(overlay) — 요청에 실려 오고 요청이 끝나면 사라진다
# ---------------------------------------------------------------------------
#
# 공개 사이트(Vercel)는 디스크가 읽기 전용이고 인스턴스마다 다르다. 그래서
# **서버는 계산만 하고 상태는 브라우저가 든다.** 올린 공시 xlsx 한 해를
# `/api/dataset/preview` 가 영문 키 행으로 돌려주면, 브라우저가 그 행들을 저장해
# 두고 이후 모든 요청에 `overlay` 로 실어 보낸다. 서버는 요청마다 기본 데이터에
# 그 해를 덧씌워 계산한다(같은 해가 있으면 덮어쓰고, 없으면 더한다). 다른
# 사용자·다른 브라우저·서버에는 아무 영향이 없다 — 인증이 없는 공개 사이트에서
# 누군가의 업로드가 전원의 데이터를 바꾸면 안 된다.

#: overlay 열 이름 — API(영문) → 코어 CSV(한글). `deps.overlay_frames` 가 이 표로
#: DataFrame 을 만들고, 미리보기는 역표로 코어 결과를 영문 행으로 돌려준다.
#: 영문 ↔ 한글 번역은 이 모듈 한 곳에서만 한다.
OVERLAY_NATIONAL_COLUMNS = {
    "year": "연도",
    "name": "학교명",
    "faculty": "전임교원수",
    "papers": "SCI/SCOPUS논문수",
    "perCapita": "1인당논문수",
    "nationalRank": "전국순위",
}
OVERLAY_REGIONAL_COLUMNS = {
    **OVERLAY_NATIONAL_COLUMNS,
    "regionName": "권역명",
    "regionalRank": "권역순위",
}

#: 표 하나의 행 수 상한. 11개년 전체가 1,500행 안팎이라 네 배 넘게 넉넉하다.
#: 상한이 없으면 공개 엔드포인트에 임의 크기의 표를 보내 CPU 를 태울 수 있다.
OVERLAY_MAX_ROWS = 6000

#: overlay 가 검증에 걸렸을 때의 사유. 어느 행이 틀렸는지는 말하지 않는다 —
#: 브라우저 저장소가 손상된 경우라 사용자가 고칠 수 있는 것은 "지우고 다시
#: 올리기" 뿐이다. `api.main` 의 422 핸들러가 pydantic 오류를 이 문장으로 바꾼다.
OVERLAY_INVALID_DETAIL = "추가한 데이터가 올바르지 않습니다. 데이터를 지우고 다시 올리세요."

#: 순위. 1 부터 세고, 없을 수 있다(그 해 그 표에 없는 대학).
_Rank = Annotated[int, Field(ge=1, le=10_000)]
_Name = Annotated[str, Field(min_length=1, max_length=60)]


class OverlayRow(BaseModel):
    """전국 표의 한 행. 코어 CSV `전체_대학_데이터.csv` 의 한 줄과 1:1 이다.

    요청(DatasetOverlay)과 응답(DatasetPreviewResponse) 양쪽에 쓰인다. 필드에
    기본값을 두지 않는 이유 — 기본값이 있으면 FastAPI 가 입력용·출력용 스키마를
    따로 만들어(`OverlayRow-Input`/`-Output`) 생성 타입 이름이 갈라진다.
    """

    year: Annotated[int, Field(ge=2000, le=2100)]
    name: _Name
    faculty: Annotated[int, Field(ge=0, le=100_000)]
    papers: Annotated[float, Field(ge=0, le=1_000_000)]
    perCapita: Annotated[float, Field(ge=0, le=1_000)]
    nationalRank: _Rank | None


class OverlayRegionalRow(OverlayRow):
    """권역 표의 한 행. 다중 캠퍼스 대학은 권역마다 한 행이다."""

    regionName: _Name
    regionalRank: _Rank | None


class DatasetOverlay(BaseModel):
    """브라우저가 들고 있는 추가 데이터. 서버는 저장하지 않는다."""

    national: Annotated[list[OverlayRow], Field(max_length=OVERLAY_MAX_ROWS)]
    regional: Annotated[list[OverlayRegionalRow], Field(max_length=OVERLAY_MAX_ROWS)]

    @model_validator(mode="after")
    def _no_duplicate_rows(self) -> DatasetOverlay:
        """(연도, 학교명[, 권역명]) 이 겹치면 거절한다.

        같은 해 같은 대학이 두 줄이면 순위가 전부 틀린다 — 표에 2027년이 두 줄
        보이는 것이 Review Focus 2 의 사고다.
        """
        national_keys = {(r.year, r.name) for r in self.national}
        if len(national_keys) != len(self.national):
            raise ValueError(OVERLAY_INVALID_DETAIL)
        regional_keys = {(r.year, r.name, r.regionName) for r in self.regional}
        if len(regional_keys) != len(self.regional):
            raise ValueError(OVERLAY_INVALID_DETAIL)
        return self

    def years(self) -> list[int]:
        """overlay 가 덮는 연도. 오름차순. 기본 데이터에서 이 해들을 빼고 붙인다."""
        return sorted({r.year for r in self.national} | {r.year for r in self.regional})

    def is_empty(self) -> bool:
        return not self.national and not self.regional

    def digest(self) -> str:
        """내용의 sha1 앞 12자. 행 순서와 무관하다.

        차트 캐시 키와 `StatsResponse.overlayHash` 에 쓴다. 빠뜨리면 overlay 를
        바꾸거나 지운 뒤에도 옛 그림이 나온다 — 전처리 캐시 사고(화면은 옛 그림,
        Word 는 새 그림)가 그대로 재현된다.
        """
        payload = {
            "national": sorted(
                (r.model_dump(mode="json") for r in self.national),
                key=lambda r: (r["year"], r["name"]),
            ),
            "regional": sorted(
                (r.model_dump(mode="json") for r in self.regional),
                key=lambda r: (r["year"], r["regionName"], r["name"]),
            ),
        }
        text = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        return hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]


#: overlay 필드의 공통 설명. 요청 모델 8종이 같은 뜻으로 쓴다.
_OVERLAY_DESC = (
    "브라우저에만 저장된 추가 데이터. 서버는 이 요청 안에서만 기본 데이터에 "
    "덧씌워 계산하고 저장하지 않는다. 같은 연도가 기본 데이터에 있으면 덮어쓴다."
)


class DatasetPreviewResponse(BaseModel):
    """공시 xlsx 한 해를 메모리에서 계산한 결과. 브라우저가 이것을 그대로 저장한다.

    미등재로 제외된 대학 수는 담지 않는다 — `core.preprocess.process_in_memory`
    가 돌려주지 않고, `core/` 는 바꾸지 않는다.
    """

    year: int
    #: 그 해 전국 표의 대학 수.
    universities: int
    sourceFile: str
    national: list[OverlayRow]
    regional: list[OverlayRegionalRow]


class DatasetQuery(BaseModel):
    """`POST /api/data` 본문. overlay 가 없으면 GET 과 같다."""

    overlay: DatasetOverlay | None = Field(default=None, description=_OVERLAY_DESC)


class RegionsQuery(BaseModel):
    university: str
    overlay: DatasetOverlay | None = Field(default=None, description=_OVERLAY_DESC)


class UniversitiesQuery(BaseModel):
    region: str
    year: int
    overlay: DatasetOverlay | None = Field(default=None, description=_OVERLAY_DESC)


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
    #: 집계에 포함된 대학 이름 전체(가나다순).
    #:
    #: 화면이 목록에서 고르게 하려면 이름이 필요하다. 개수만 주면 자유 텍스트
    #: 입력이 되고, 오타 한 번에 404 가 난다.
    universities: list[str]
    # V14: '전국순위' 는 등재 사립 N개교 안에서의 순위다. 이 사실을 숨기지 않는다.
    nationalRankScopeNote: str
    #: 요청의 overlay 가 덮은 연도. GET 과 overlay 없는 POST 는 빈 목록.
    #: 화면이 "추가 데이터 2027년 · 이 브라우저" 를 이 값으로 쓴다.
    overlayYears: list[int] = []


#: 분석 연도 필드의 공통 설명. 요청 4종이 같은 뜻으로 쓴다.
_YEARS_DESC = (
    "추이·평균·순위에 남길 연도. 생략하면 전 연도. "
    "**기준 연도(year)가 반드시 포함되어야 한다.**"
)


class StatsRequest(BaseModel):
    university: str
    year: int
    # None 이면 서버가 detect_region 으로 자동 판정한다.
    # V03 이 났던 지점 — 권역 미설정이면 '권역평균'이 전국 평균이 됐다.
    regionName: str | None = None
    compareGroup: list[str] | None = None
    years: list[int] | None = Field(default=None, description=_YEARS_DESC)
    overlay: DatasetOverlay | None = Field(default=None, description=_OVERLAY_DESC)


class ChartRequest(BaseModel):
    """`POST /api/chart/{kind}.png` 본문. GET 의 쿼리와 같은 뜻이고 overlay 만 더 받는다.

    PNG 주소에 overlay 를 실을 수 없어서(수백 KB 를 쿼리에 넣을 수 없다) 본문으로
    받는다. overlay 가 없으면 GET 을 쓰는 것이 맞다 — 브라우저 캐시가 된다.
    """

    university: str
    year: int
    regionName: str | None = None
    compareGroup: list[str] | None = None
    years: list[int] | None = Field(default=None, description=_YEARS_DESC)
    overlay: DatasetOverlay | None = Field(default=None, description=_OVERLAY_DESC)


class StatsResponse(BaseModel):
    university: str
    year: int
    regionName: str
    compareGroup: list[str]
    #: 서버가 확정한 분석 연도. **화면은 이 값을 그대로 되돌려 보낸다.**
    #:
    #: 비교군과 같은 이유다 — 요청이 생략하면 서버가 전 연도로 채우는데,
    #: 그 사실을 화면이 모르면 차트 요청만 연도 없이 나가 Word 와 그림이
    #: 갈라진다. 서버가 쓴 값을 돌려주고 이후 요청은 전부 이것을 싣는다.
    years: list[int]
    #: 데이터 판. 전처리로 CSV 가 교체될 때마다 오른다.
    #:
    #: 차트 주소에 실어 **브라우저 캐시를 깨는** 용도다. 대상·연도·비교군이
    #: 같으면 주소가 글자 하나 안 바뀌는데 응답에 `max-age` 가 붙어 있어서,
    #: 데이터를 갈아끼워도 브라우저가 서버에 묻지 않고 옛 PNG 를 계속 쓴다.
    dataVersion: int
    #: 비교군을 정상적으로 채우지 못했으면 그 이유. 정상이면 None.
    #: R-RS-02 의 교훈 — 자기 자신과 비교하게 되는 상황을 **조용히** 넘기지 않는다.
    #: (제주권은 전 연도에 걸쳐 대학이 1개교뿐이라 실제로 발생한다.)
    compareGroupNote: str | None
    #: 요청에 실린 overlay 의 digest(`DatasetOverlay.digest`). 없으면 None.
    #:
    #: 화면이 차트 캐시 키에 넣는다. `dataVersion` 이 서버 데이터 판을 말한다면
    #: 이것은 브라우저 데이터 판이다 — 둘 중 하나라도 바뀌면 그림을 다시 받는다.
    #: 기본값을 두지 않는 이유: 두면 생성 타입이 `overlayHash?:` 선택형이 된다.
    overlayHash: str | None
    trend: dict[int, TrendPoint]
    averages: dict[int, Averages]
    rankChanges: dict[int, RankChange]
    compare: list[CompareRow]
    yoy: YoYChanges


class RegionsResponse(BaseModel):
    """대학이 속한 권역들. 다중 캠퍼스는 2개 이상이 나온다."""

    university: str
    regions: list[str]


# ---------------------------------------------------------------------------
# 서술 · 보고서
# ---------------------------------------------------------------------------

#: GPT 서술 4종의 키. `core.report_builder` 가 이 이름으로 읽는다.
NARRATIVE_KEYS = ("trend", "comparison", "regional", "yoy")

#: 차트 5종의 키. `core.report_builder` 가 이 이름으로 읽는다.
CHART_KEYS = ("trend", "bar", "avg", "rank", "compare")

#: 서술 한 절의 상한. GPT 가 쓰는 글(`GPT_MAX_TOKENS` 2000)보다 훨씬 넉넉하다.
#:
#: 보고서는 줄마다 단락을 만드는데 python-docx 는 문서가 커질수록 단락 추가가
#: 느려진다. 막지 않으면 0.2MB 요청 하나가 CPU 를 5분 쓴다. 둘 다 있어야 한다 —
#: 글자만 세면 짧은 줄을 쏟아붓고, 줄만 세면 한 줄을 길게 보내 돌아온다.
NARRATIVE_MAX_CHARS = 20_000
NARRATIVE_MAX_LINES = 200

#: Word 문서(XML 1.0)에 담을 수 없는 글자. 탭·줄바꿈은 뺐다.
#:
#: 붙여넣기에 섞여 오는 보이지 않는 글자라 사용자는 원인을 알 수 없다. 그대로
#: 넘기면 lxml 이 `ValueError` 를 던져 설명 없는 500 이 되므로 지우고 진행한다.
_XML_ILLEGAL_CHARS = re.compile("[\x00-\x08\x0b\x0c\x0e-\x1f\ud800-\udfff￾￿]")


class NarrativeRequest(BaseModel):
    university: str
    year: int
    regionName: str | None = None
    compareGroup: list[str] | None = None
    years: list[int] | None = Field(default=None, description=_YEARS_DESC)
    #: 생성할 서술. 생략하면 4종 전부. 중복은 한 번만 만든다.
    keys: list[str] | None = None
    overlay: DatasetOverlay | None = Field(default=None, description=_OVERLAY_DESC)


class NarrativeResponse(BaseModel):
    """생성된 서술.

    키가 4종 전부 오지 않을 수 있다 — 일부만 요청했거나, 일부만 실패했을 때다.
    `failed` 에 실패한 키와 이유를 담는다. 조용히 빈 문자열을 돌려주면
    사용자는 GPT 가 "아무 말도 하지 않았다" 고 오해한다.
    """

    narratives: dict[str, str]
    failed: dict[str, str]


class ReportRequest(BaseModel):
    university: str
    year: int
    regionName: str | None = None
    compareGroup: list[str] | None = None
    years: list[int] | None = Field(default=None, description=_YEARS_DESC)
    overlay: DatasetOverlay | None = Field(default=None, description=_OVERLAY_DESC)
    #: 화면에서 편집한 서술. 비어 있으면 그 절은 제목만 들어간다.
    narratives: dict[str, str] = Field(default_factory=dict)

    @field_validator("narratives")
    @classmethod
    def _check_narratives(cls, value: dict[str, str]) -> dict[str, str]:
        """문서를 만들 수 있는 글만 통과시킨다. 판정 이유는 상수 쪽에 적었다."""
        for text in value.values():
            if len(text) > NARRATIVE_MAX_CHARS or text.count("\n") >= NARRATIVE_MAX_LINES:
                raise ValueError(
                    f"서술 한 절은 {NARRATIVE_MAX_CHARS:,}자, {NARRATIVE_MAX_LINES}줄까지입니다. "
                    "줄여서 다시 보내세요."
                )
        return {key: _XML_ILLEGAL_CHARS.sub("", text) for key, text in value.items()}


# ---------------------------------------------------------------------------
# 권역 대학 목록
# ---------------------------------------------------------------------------


class UniversityRow(BaseModel):
    """권역 대학 한 곳의 그 해 지표."""

    name: str
    faculty: int
    papers: float
    perCapita: float
    regionalRank: int | None
    nationalRank: int | None


class UniversitiesResponse(BaseModel):
    """권역 안의 대학 전체. 비교군 후보 선택과 권역 막대차트가 함께 쓴다."""

    regionName: str
    year: int
    rows: list[UniversityRow]


# ---------------------------------------------------------------------------
# 데이터 갱신
# ---------------------------------------------------------------------------


class PreprocessResponse(BaseModel):
    """전처리 결과 요약.

    **무엇이 바뀌었는지 숫자로 말한다.** "완료됐습니다" 만 띄우면 사용자는
    올린 파일이 실제로 반영됐는지 알 수 없다 — 연도를 못 읽어 조용히
    건너뛰어도 화면은 똑같이 성공이라고 한다.
    """

    #: 결과에 들어간 연도 전체. 올린 연도만이 아니라 `Raw data/` 폴더 전체다.
    years: list[int]
    #: 집계된 대학 수(전 연도 합집합).
    universities: int
    nationalRows: int
    regionalRows: int
    #: 전처리가 실제로 읽은 Raw 파일 이름.
    sourceFiles: list[str]
    #: 이번에 저장한 업로드 파일 이름.
    savedFiles: list[str]
    #: 덮어쓰기 직전 `output/` 을 담아 둔 폴더 이름. 처음이면 None.
    backupPath: str | None


# ---------------------------------------------------------------------------
# 설정
# ---------------------------------------------------------------------------


class SettingsResponse(BaseModel):
    """서버 설정 상태.

    **키 값 자체는 절대 담지 않는다.** 브라우저로 내려가면 개발자 도구에
    그대로 보인다. 설정됐는지와 어떻게 설정됐는지만 알린다.
    """

    apiKeyConfigured: bool
    #: 키를 어디서 읽었는가 — "env" | "dotenv" | None
    apiKeySource: str | None
    #: 마스킹된 힌트. 예: "sk-…a1b2". 미설정이면 None
    apiKeyHint: str | None
    #: `.env` 에 쓸 수 있는가. 읽기 전용 배포에서는 False
    canPersist: bool


class ApiKeyRequest(BaseModel):
    apiKey: str
