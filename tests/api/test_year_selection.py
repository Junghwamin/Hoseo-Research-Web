# ============================================================================
# Copyright (c) 2026 정화민 (Junghwamin)
# Licensed under the PolyForm Noncommercial License 1.0.0.
# ============================================================================
"""분석 연도 선택 계약.

원본 Streamlit 판의 「분석 연도 선택」 multiselect(`research.py:614`)가
이관에서 빠져, 추이·평균·순위가 언제나 11개년 전부로 그려졌다. 최근 3년만
보고 싶어도 방법이 없었다.

여기서 잠그는 것은 셋이다.

1. **고른 해만 나온다** — 그리고 기준 연도는 반드시 그 안에 있다.
2. **증감의 뜻이 바뀌지 않는다** — 「전년대비」는 언제나 바로 앞 해다.
   연도를 걸러서 계산하면 2020·2026만 고른 사용자에게 6년 간격을
   "전년대비" 라고 표시하게 된다.
3. **네 엔드포인트가 같은 해를 본다** — /api/stats 와 /api/chart 가
   갈라지면 화면과 Word 의 그림이 달라진다. 비교군에서 실제로 났던 사고다.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from api.main import app
from tests.conftest import REALDATA_AVAILABLE

realdata = pytest.mark.skipif(
    not REALDATA_AVAILABLE, reason="추적 중인 output/*.csv 가 없다"
)

UNIV = "호서대학교"


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def _stats(client: TestClient, **body) -> dict:
    r = client.post("/api/stats", json={"university": UNIV, **body})
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------------------------------------------------------------
# 무엇이 걸러지는가
# ---------------------------------------------------------------------------


@realdata
class TestYearFilter:
    def test_생략하면_전_연도다(self, client):
        # 기존 동작이다. 연도를 안 보낸 클라이언트가 갑자기 3개년만 받으면 안 된다.
        available = client.get("/api/data").json()["years"]
        body = _stats(client, year=2026)
        assert body["years"] == available
        assert sorted(int(y) for y in body["trend"]) == available

    def test_고른_해만_추이_평균_순위에_남는다(self, client):
        years = [2024, 2025, 2026]
        body = _stats(client, year=2026, years=years)

        assert body["years"] == years
        assert sorted(int(y) for y in body["trend"]) == years
        assert sorted(int(y) for y in body["averages"]) == years
        assert sorted(int(y) for y in body["rankChanges"]) == years

    def test_한_해만_골라도_된다(self, client):
        # 원본도 1개년을 허용했다(research.py:634 는 0개일 때만 막는다).
        body = _stats(client, year=2026, years=[2026])
        assert body["years"] == [2026]
        assert list(body["trend"]) == ["2026"]

    def test_순서와_중복은_서버가_정리한다(self, client):
        body = _stats(client, year=2026, years=[2026, 2024, 2026, 2025])
        assert body["years"] == [2024, 2025, 2026]

    def test_거른다고_값이_바뀌지는_않는다(self, client):
        # 연도 선택은 **무엇을 보여줄지**만 정한다. 그 해의 권역평균은 그 해에
        # 집계된 대학 전체로 계산되므로, 다른 해를 빼도 값이 흔들리면 안 된다.
        full = _stats(client, year=2026)
        narrow = _stats(client, year=2026, years=[2025, 2026])
        assert narrow["averages"]["2026"] == full["averages"]["2026"]
        assert narrow["trend"]["2026"] == full["trend"]["2026"]
        assert narrow["compare"] == full["compare"]


# ---------------------------------------------------------------------------
# 증감의 뜻은 바뀌지 않는다
# ---------------------------------------------------------------------------


@realdata
class TestDeltaMeaning:
    def test_앞_해를_빼도_전년대비는_전년이다(self, client):
        """2024 를 빼도 2025 의 순위 변화는 여전히 2024 대비다.

        `get_rank_changes` 는 프레임에 남은 **바로 앞 행**과 비교한다. 연도를
        걸러서 넘기면 2020·2026 만 고른 사용자에게 "전년대비 +3계단" 이라고
        표시되는데 실제로는 6년 간격이다. 원본이 프레임을 직접 걸렀으므로
        그 결함을 물려받을 수 있었다 — 계산은 전 연도로 하고 표시할 해만 남긴다.
        """
        full = _stats(client, year=2026)
        # 2024 를 건너뛰고 2025·2026 만 고른다
        skipped = _stats(client, year=2026, years=[2025, 2026])

        assert skipped["rankChanges"]["2025"] == full["rankChanges"]["2025"], (
            "2024 를 화면에서 뺐다고 2025 의 '전년대비' 가 달라지면 안 된다"
        )
        assert skipped["rankChanges"]["2026"] == full["rankChanges"]["2026"]

    def test_전년_대비_증감은_연도_선택과_무관하다(self, client):
        # 「전년 대비 증감」 절의 '전년' 은 기준 연도 바로 앞 해다. 분석 연도에서
        # 그 해를 빼도 절의 의미가 바뀌지는 않는다 — 빼면 조용히 빈 절이 된다.
        full = _stats(client, year=2026)
        only_base = _stats(client, year=2026, years=[2026])
        assert only_base["yoy"] == full["yoy"]
        assert only_base["yoy"]["target"] is not None


# ---------------------------------------------------------------------------
# 막아야 하는 것
# ---------------------------------------------------------------------------


@realdata
class TestYearValidation:
    def test_기준_연도가_선택_밖이면_422(self, client):
        # 그대로 통과시키면 비교표·YoY 는 2026 으로 계산되는데 추이 차트에는
        # 2026 이 없다. 같은 화면의 두 그림이 서로 다른 해를 말하게 된다.
        r = client.post(
            "/api/stats",
            json={"university": UNIV, "year": 2026, "years": [2023, 2024]},
        )
        assert r.status_code == 422
        assert "기준 연도" in r.json()["detail"]

    def test_데이터에_없는_연도는_422_이고_가능한_연도를_알려준다(self, client):
        r = client.post(
            "/api/stats",
            json={"university": UNIV, "year": 2026, "years": [1999, 2026]},
        )
        assert r.status_code == 422
        detail = r.json()["detail"]
        assert "1999" in detail
        assert "2026" in detail

    def test_빈_배열은_전_연도로_읽는다(self, client):
        # 빈 배열로 "아무 해도 안 본다" 를 표현할 수는 없다 — 그러면 보여줄
        # 것이 없다. 화면이 0개를 막고, 서버는 생략과 같게 취급한다.
        available = client.get("/api/data").json()["years"]
        assert _stats(client, year=2026, years=[])["years"] == available


# ---------------------------------------------------------------------------
# 네 엔드포인트가 같은 해를 본다
# ---------------------------------------------------------------------------


@realdata
class TestEndpointsAgree:
    def test_차트도_연도를_받는다(self, client):
        r = client.get(
            "/api/chart/trend.png",
            params={"university": UNIV, "year": 2026, "years": [2025, 2026]},
        )
        assert r.status_code == 200
        assert r.headers["content-type"] == "image/png"
        assert r.content[:4] == bytes([0x89, 0x50, 0x4E, 0x47])

    def test_연도가_다르면_다른_그림이_나온다(self, client):
        """캐시 키에 연도가 빠지면 연도만 바꿨을 때 이전 그림이 그대로 나온다.

        화면은 3개년인데 차트는 11개년인 상태가 되는데, 비교군에서 똑같은
        사고가 한 번 났다 — 그때는 캐시가 아니라 파라미터 자체가 없었다.
        """
        common = {"university": UNIV, "year": 2026}
        wide = client.get("/api/chart/trend.png", params=common)
        narrow = client.get(
            "/api/chart/trend.png", params={**common, "years": [2025, 2026]}
        )
        assert wide.status_code == narrow.status_code == 200
        assert wide.content != narrow.content, (
            "11개년 추이와 2개년 추이가 같은 PNG 일 수 없다 — 캐시 키에 연도가 빠졌다"
        )

    def test_차트도_기준_연도_밖_선택을_막는다(self, client):
        r = client.get(
            "/api/chart/trend.png",
            params={"university": UNIV, "year": 2026, "years": [2023]},
        )
        assert r.status_code == 422

    def test_보고서가_고른_해만_담는다(self, client):
        """Word 의 연도별 표가 고른 해만 담아야 한다.

        docx 를 풀어 문서 텍스트를 직접 본다 — 여기가 갈라지면 화면에서 확인한
        것과 문서가 다르다는 뜻이고, 그건 이 앱이 팔고 있는 계약 자체다.
        """
        import zipfile
        from io import BytesIO

        r = client.post(
            "/api/report",
            json={"university": UNIV, "year": 2026, "years": [2025, 2026]},
        )
        assert r.status_code == 200

        with zipfile.ZipFile(BytesIO(r.content)) as z:
            xml = z.read("word/document.xml").decode("utf-8")

        assert "2026" in xml and "2025" in xml
        # 2016 은 고르지 않았다. 표에도 차트 축에도 나오면 안 된다
        # (차트는 이미지라 XML 엔 없다 — 표만 본다).
        assert "2016" not in xml, "고르지 않은 연도가 보고서에 들어갔다"
