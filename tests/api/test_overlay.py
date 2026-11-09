# ============================================================================
# Copyright (c) 2026 정화민 (Junghwamin)
# Licensed under the PolyForm Noncommercial License 1.0.0.
# ============================================================================
"""브라우저 데이터셋(overlay) 계약 — 서버는 계산만 하고 상태는 브라우저가 든다.

공개 사이트(Vercel)는 디스크가 읽기 전용이고 인스턴스마다 다르다. 올린 공시
xlsx 한 해를 `/api/dataset/preview` 가 영문 키 행으로 돌려주면, 브라우저가 그
행들을 저장해 두고 이후 모든 요청에 `overlay` 로 실어 보낸다.

여기서 잠그는 것 다섯:

1. **미리보기는 디스크에 아무것도 쓰지 않는다.**
2. **overlay 는 요청 안에서만 산다** — 다음 요청의 서버 상태에 남지 않는다.
3. **같은 해는 덮어쓰고 없는 해는 더한다** — 표에 같은 해가 두 줄이면 순위가 전부
   틀린다(Review Focus 2).
4. **차트 캐시가 overlay 를 안다** — 모르면 overlay 를 지운 뒤에도 옛 그림이 나온다.
5. **경계를 넘는 overlay 는 한 문장짜리 422** — 낯선 권역이 조용히 0개교 권역을
   만들면 권역 평균이 틀린다(Review Focus 5).
"""

from __future__ import annotations

import io
import re
import unicodedata
import zipfile

import pytest
from fastapi.testclient import TestClient

import core.gpt_reporter as gpt
from api import deps, schemas
from api.main import app
from api.routers import report
from tests.conftest import RAW_AVAILABLE, RAW_DIR, REALDATA_AVAILABLE

# `deps`·`schemas`·`report` 를 **모듈 레벨에서** 가져온다. `test_openapi_drift.py`
# 가 `api*` 를 통째로 다시 import 하므로, 함수 안에서 가져오면 `app` 과 다른
# 세대의 모듈을 집어 캐시가 서로 다른 것이 된다.

realdata = pytest.mark.skipif(
    not REALDATA_AVAILABLE, reason="추적 중인 output/*.csv 가 없다"
)
rawdata = pytest.mark.skipif(not RAW_AVAILABLE, reason="Raw data/*.xlsx 가 없다")

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
UNIV = "호서대학교"
BASE = {"university": UNIV, "year": 2026}

#: 코어(한글) → API(영문). 서버의 표를 뒤집어 쓴다 — 테스트가 표를 따로 들면 어긋난다.
INV_N = {v: k for k, v in schemas.OVERLAY_NATIONAL_COLUMNS.items()}
INV_R = {v: k for k, v in schemas.OVERLAY_REGIONAL_COLUMNS.items()}


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def _overlay_from_base(year_from: int, year_to: int, scale: float = 1.0) -> dict:
    """기본 데이터의 한 해를 복사해 overlay 를 만든다. `scale` 로 값을 바꿀 수 있다."""
    n, r = deps.get_frames()
    rows_n = n[n["연도"] == year_from].copy()
    rows_n["연도"] = year_to
    rows_n["1인당논문수"] *= scale
    rows_r = r[r["연도"] == year_from].copy()
    rows_r["연도"] = year_to
    rows_r["1인당논문수"] *= scale
    return {
        "national": [schemas.translate(x, INV_N) for x in rows_n.to_dict("records")],
        "regional": [schemas.translate(x, INV_R) for x in rows_r.to_dict("records")],
    }


# ---------------------------------------------------------------------------
# /api/dataset/preview
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def preview(client, tmp_path_factory):
    """최신 Raw xlsx 한 개의 미리보기. 엑셀 파싱이 비싸서 모듈에서 한 번만 받는다.

    CWD 를 빈 폴더로 옮겨 두고 받는다 — 끝난 뒤 그 폴더가 비어 있어야
    "디스크에 아무것도 쓰지 않는다" 가 성립한다.
    """
    if not RAW_AVAILABLE:
        pytest.skip("Raw data/*.xlsx 가 없다")
    path = sorted(RAW_DIR.glob("*.xlsx"))[-1]
    name = unicodedata.normalize("NFC", path.name)
    year = int(re.search(r"(\d{4})", name).group(1))

    workdir = tmp_path_factory.mktemp("preview")
    mp = pytest.MonkeyPatch()
    mp.chdir(workdir)
    try:
        r = client.post(
            "/api/dataset/preview",
            files={"file": (name, path.read_bytes(), XLSX_MIME)},
        )
    finally:
        mp.undo()

    return {"name": name, "year": year, "response": r, "leftover": sorted(workdir.iterdir())}


@rawdata
class TestPreview:
    def test_미리보기가_그_해의_행과_순위를_돌려준다(self, client, preview):
        r = preview["response"]
        assert r.status_code == 200, r.text
        body = r.json()

        assert body["year"] == preview["year"]
        assert body["sourceFile"] == preview["name"]
        assert len(body["national"]) > 100, "한 해 전국 표는 130개교 안팎이다"
        assert body["universities"] == len(body["national"])
        assert {row["year"] for row in body["national"]} == {preview["year"]}
        assert all(row["nationalRank"] >= 1 for row in body["national"])
        assert all(row["regionalRank"] >= 1 for row in body["regional"])

        base_regions = set(client.get("/api/data").json()["regions"])
        assert {row["regionName"] for row in body["regional"]} <= base_regions

        # 영문 키만 나간다 — 한글 키는 코어 안에서만.
        assert set(body["national"][0]) == set(schemas.OVERLAY_NATIONAL_COLUMNS)
        assert set(body["regional"][0]) == set(schemas.OVERLAY_REGIONAL_COLUMNS)

    def test_디스크에_아무것도_쓰지_않는다(self, preview):
        assert preview["leftover"] == [], "미리보기가 파일을 남겼다"

    def test_미리보기_결과를_그대로_overlay_로_보낼_수_있다(self, client, preview):
        """브라우저가 하는 일 그대로 — 받은 행을 저장했다가 다음 요청에 싣는다."""
        body = preview["response"].json()
        overlay = {"national": body["national"], "regional": body["regional"]}

        info = client.post("/api/data", json={"overlay": overlay})
        assert info.status_code == 200, info.text
        assert info.json()["overlayYears"] == [preview["year"]]

    def test_너무_큰_파일은_413(self, client):
        r = client.post(
            "/api/dataset/preview",
            files={"file": ("2027년_큰파일.xlsx", b"x" * (4 * 1024 * 1024 + 1), XLSX_MIME)},
        )
        assert r.status_code == 413
        assert "4MB" in r.json()["detail"]

    def test_엑셀이_아니면_400(self, client):
        r = client.post(
            "/api/dataset/preview",
            files={"file": ("2027년_망가진파일.xlsx", b"PK\x03\x04 not really xlsx", XLSX_MIME)},
        )
        assert r.status_code == 400
        assert "xlsx" in r.json()["detail"]

    def test_연도_없는_파일명은_400(self, client):
        r = client.post(
            "/api/dataset/preview",
            files={"file": ("연구실적.xlsx", b"x" * 100, XLSX_MIME)},
        )
        assert r.status_code == 400
        assert "연도" in r.json()["detail"]


# ---------------------------------------------------------------------------
# 병합 — 없는 해는 더하고, 같은 해는 덮어쓴다
# ---------------------------------------------------------------------------


@realdata
class TestMerge:
    def test_overlay_로_없는_해를_더하면_추이에_그_해가_있다(self, client):
        overlay = _overlay_from_base(2026, 2027)
        r = client.post(
            "/api/stats", json={**BASE, "years": [2026, 2027], "overlay": overlay}
        )
        assert r.status_code == 200, r.text
        body = r.json()

        assert body["years"] == [2026, 2027]
        assert body["trend"]["2027"] == body["trend"]["2026"], "2026 을 복사한 해다"
        # 같은 순위를 복사했으니 변화는 0 이다 — 전년대비가 overlay 해까지 이어진다
        assert body["rankChanges"]["2027"]["nationalRankDelta"] == 0
        assert isinstance(body["overlayHash"], str) and len(body["overlayHash"]) == 12

    def test_같은_해를_덮어쓰면_값이_바뀐다(self, client):
        """정정 파일을 올리는 경우다. 두 줄이 아니라 **바꿔치기**여야 한다."""
        plain = client.post("/api/stats", json=BASE).json()
        doubled = client.post(
            "/api/stats", json={**BASE, "overlay": _overlay_from_base(2026, 2026, scale=2)}
        )
        assert doubled.status_code == 200, doubled.text
        body = doubled.json()

        assert body["trend"]["2026"]["perCapita"] == pytest.approx(
            plain["trend"]["2026"]["perCapita"] * 2, rel=1e-3
        )
        assert body["years"] == plain["years"], "덮어쓴 해가 두 번 나오면 안 된다"
        assert len(body["compare"]) == len(plain["compare"])

    def test_overlay_는_서버_상태에_남지_않는다(self, client):
        client.post("/api/stats", json={**BASE, "overlay": _overlay_from_base(2026, 2027)})

        assert 2027 not in client.get("/api/data").json()["years"]
        assert "2027" not in client.post("/api/stats", json=BASE).json()["trend"]
        national, regional = deps.get_frames()
        assert 2027 not in set(national["연도"]) and 2027 not in set(regional["연도"])

    def test_빈_overlay_는_없는_것과_같다(self, client):
        plain = client.post("/api/stats", json=BASE).json()
        empty = client.post(
            "/api/stats", json={**BASE, "overlay": {"national": [], "regional": []}}
        ).json()
        assert empty["overlayHash"] is None
        assert plain["overlayHash"] is None
        assert empty["trend"] == plain["trend"]

    def test_POST_data_가_overlayYears_를_준다(self, client):
        with_overlay = client.post(
            "/api/data", json={"overlay": _overlay_from_base(2026, 2027)}
        ).json()
        assert with_overlay["overlayYears"] == [2027]
        assert with_overlay["years"][-1] == 2027
        # 대학 수와 범위 문장은 병합된 최신 연도(2027)로 센다
        base = client.get("/api/data").json()
        assert with_overlay["universityCount"] == base["universityCount"]

        assert base["overlayYears"] == []
        assert client.post("/api/data", json={}).json()["overlayYears"] == []

    def test_POST_regions_universities_가_overlay_를_반영한다(self, client):
        overlay = _overlay_from_base(2026, 2027)
        # 한 대학의 이름을 바꿔 "overlay 에만 있는 대학" 을 만든다
        renamed = "검증용대학교"
        for row in overlay["national"] + overlay["regional"]:
            if row["name"] == UNIV:
                row["name"] = renamed

        universities = client.post(
            "/api/universities", json={"region": "충청권", "year": 2027, "overlay": overlay}
        )
        assert universities.status_code == 200, universities.text
        base_rows = client.get(
            "/api/universities", params={"region": "충청권", "year": 2026}
        ).json()["rows"]
        assert len(universities.json()["rows"]) == len(base_rows)
        assert renamed in {row["name"] for row in universities.json()["rows"]}

        regions = client.post("/api/regions", json={"university": renamed, "overlay": overlay})
        assert regions.status_code == 200, regions.text
        assert regions.json()["regions"] == ["충청권"]
        assert client.get("/api/regions", params={"university": renamed}).status_code == 404

    def test_report_의_표에_overlay_연도가_있다(self, client):
        r = client.post(
            "/api/report",
            json={**BASE, "years": [2026, 2027], "overlay": _overlay_from_base(2026, 2027)},
        )
        assert r.status_code == 200, r.text
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            xml = z.read("word/document.xml").decode("utf-8")
        assert "2027" in xml

    def test_narrative_의_프롬프트에_overlay_연도가_있다(self, client, monkeypatch):
        calls: list[str] = []
        monkeypatch.setattr(gpt, "_call_gpt", lambda c, p: calls.append(p) or "가짜 서술")
        header_key = "sk-" + "overlay" + "0" * 20

        r = client.post(
            "/api/narrative",
            json={**BASE, "keys": ["trend"], "overlay": _overlay_from_base(2026, 2027)},
            headers={"X-OpenAI-Key": header_key},
        )
        assert r.status_code == 200, r.text
        assert "2027" in calls[0]

    def test_overlay_유무로_차트_PNG_가_다르다(self, client):
        """캐시 키에 overlay 가 없으면 overlay 를 더한 뒤에도 옛 그림이 나온다."""
        overlay = _overlay_from_base(2026, 2027)
        without = client.post("/api/chart/trend.png", json=BASE)
        with_overlay = client.post("/api/chart/trend.png", json={**BASE, "overlay": overlay})
        again = client.post("/api/chart/trend.png", json={**BASE, "overlay": overlay})

        assert without.status_code == with_overlay.status_code == 200, with_overlay.text
        assert with_overlay.content[:4] == b"\x89PNG"
        assert with_overlay.content != without.content, "overlay 가 캐시 키에 없다"
        assert with_overlay.content == again.content, "같은 overlay 는 같은 그림이다"
        # overlay 가 실린 그림은 브라우저가 캐시하면 안 된다 — 지운 뒤에도 남는다
        assert with_overlay.headers["cache-control"] == "private, no-store"
        assert without.content == client.get("/api/chart/trend.png", params=BASE).content

    def test_차트_캐시_키에_overlay_digest_가_들어간다(self, client):
        overlay = schemas.DatasetOverlay(**_overlay_from_base(2026, 2027))
        client.post("/api/chart/rank.png", json={**BASE, "overlay": overlay.model_dump()})
        assert any(key[-1] == overlay.digest() for key in report._CHART_CACHE), (
            "overlay 요청의 캐시 키 끝에 digest 가 없다"
        )


# ---------------------------------------------------------------------------
# 경계
# ---------------------------------------------------------------------------


def _row(**over) -> dict:
    return {
        "year": 2027,
        "name": "검증대학교",
        "faculty": 10,
        "papers": 5.0,
        "perCapita": 0.5,
        "nationalRank": 1,
        **over,
    }


def _rrow(**over) -> dict:
    return {**_row(), "regionName": "충청권", "regionalRank": 1, **over}


BAD_OVERLAYS = {
    "7000행": {"national": [_row(name=f"대학{i}") for i in range(7000)], "regional": []},
    "낯선 권역": {"national": [_row()], "regional": [_rrow(regionName="화성권")]},
    "음수 교원": {"national": [_row(faculty=-1)], "regional": []},
    "연도 1999": {"national": [_row(year=1999)], "regional": []},
    "이름 61자": {"national": [_row(name="가" * 61)], "regional": []},
    "순위 0": {"national": [_row(nationalRank=0)], "regional": []},
    "같은 행 두 번": {"national": [_row(), _row()], "regional": []},
    "필드 누락": {"national": [{"year": 2027, "name": "검증대학교"}], "regional": []},
}


@realdata
class TestValidation:
    @pytest.mark.parametrize("bad", list(BAD_OVERLAYS), ids=list(BAD_OVERLAYS))
    def test_경계를_넘는_overlay_는_422(self, client, bad):
        r = client.post("/api/stats", json={**BASE, "overlay": BAD_OVERLAYS[bad]})
        assert r.status_code == 422, r.text
        # pydantic 의 영문 오류 목록이 아니라 **한 문장**이어야 화면에 그대로 띄울 수 있다
        detail = r.json()["detail"]
        assert isinstance(detail, str), detail
        assert "지우고 다시 올리세요" in detail

    def test_overlay_가_아닌_422_는_기존_모양_그대로다(self, client):
        # 다른 요청의 검증 오류까지 한 문장으로 뭉개면 안 된다
        r = client.post("/api/stats", json={"university": UNIV})
        assert r.status_code == 422
        assert isinstance(r.json()["detail"], list)

    def test_digest_는_행_순서와_무관하다(self):
        a = schemas.DatasetOverlay(national=[_row(name="가"), _row(name="나")], regional=[])
        b = schemas.DatasetOverlay(national=[_row(name="나"), _row(name="가")], regional=[])
        c = schemas.DatasetOverlay(national=[_row(name="가"), _row(name="다")], regional=[])
        assert a.digest() == b.digest()
        assert a.digest() != c.digest()
        assert len(a.digest()) == 12
