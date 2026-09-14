# ============================================================================
# Copyright (c) 2026 정화민 (Junghwamin)
# Licensed under the PolyForm Noncommercial License 1.0.0.
# ============================================================================
"""API 계약 테스트 — /api/data, /api/stats, /api/regions.

계획 §7.2 의 루프 2단계다. 구현 전에 쓰고 실패를 확인한 뒤 구현한다.

여기서 잠그는 것은 두 가지다.
1. **응답 모양** — 프론트가 기대하는 키가 실제로 온다.
2. **수치** — 기존 Streamlit 판과 같은 숫자가 나온다. 마이그레이션에서
   가장 조용히 깨지는 것이 값이라, 실데이터 기준값을 직접 박아 둔다.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from api.main import app
from tests.conftest import REALDATA_AVAILABLE

realdata = pytest.mark.skipif(
    not REALDATA_AVAILABLE, reason="추적 중인 output/*.csv 가 없다"
)


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


# ---------------------------------------------------------------------------
# /api/data
# ---------------------------------------------------------------------------


@realdata
class TestDataset:
    def test_연도_목록을_돌려준다(self, client):
        r = client.get("/api/data")
        assert r.status_code == 200
        body = r.json()
        assert body["years"] == list(range(2016, 2027)), (
            "Raw data/ 의 연도를 빠짐없이, 그것만 담아야 한다"
        )

    def test_권역_6개를_돌려준다(self, client):
        body = client.get("/api/data").json()
        assert sorted(body["regions"]) == [
            "강원권",
            "수도권",
            "영남권",
            "제주권",
            "충청권",
            "호남권",
        ]

    def test_전국순위_모집단을_숨기지_않는다(self, client):
        # V14: '전국순위' 는 등재 사립 안에서의 순위다. 사용자 결정은
        # "현행 유지 + 라벨 명시" 였으므로 API 가 그 라벨 근거를 제공해야 한다.
        body = client.get("/api/data").json()
        assert body["universityCount"] > 0
        assert "사립" in body["nationalRankScopeNote"]
        assert str(body["universityCount"]) in body["nationalRankScopeNote"]


# ---------------------------------------------------------------------------
# /api/regions
# ---------------------------------------------------------------------------


@realdata
class TestRegions:
    def test_단일_권역_대학(self, client):
        body = client.get("/api/regions", params={"university": "호서대학교"}).json()
        assert body["regions"] == ["충청권"]

    def test_다중_캠퍼스는_권역이_둘_이상이다(self, client):
        body = client.get("/api/regions", params={"university": "단국대학교"}).json()
        assert len(body["regions"]) >= 2, (
            "단국대는 경기(수도권)와 충남(충청권)에 캠퍼스가 있다"
        )

    def test_없는_대학은_404(self, client):
        r = client.get("/api/regions", params={"university": "없는대학교"})
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# /api/stats — 모양
# ---------------------------------------------------------------------------


@realdata
class TestStatsShape:
    @pytest.fixture(scope="class")
    def body(self, client):
        r = client.post(
            "/api/stats",
            json={"university": "호서대학교", "year": 2026, "regionName": "충청권"},
        )
        assert r.status_code == 200, r.text
        return r.json()

    def test_영문_키로_번역해_보낸다(self, body):
        # 한글 키가 새어나오면 TS 에서 대괄호 접근이 강제된다
        point = body["trend"]["2026"]
        assert set(point) == {
            "papers",
            "faculty",
            "perCapita",
            "regionalRank",
            "nationalRank",
        }
        assert set(body["averages"]["2026"]) == {"national", "regional", "compareGroup"}

    def test_해석에_쓴_권역과_비교군을_돌려준다(self, body):
        # 프론트가 "무엇을 기준으로 계산했는지" 를 화면에 쓸 수 있어야 한다
        assert body["regionName"] == "충청권"
        assert isinstance(body["compareGroup"], list)
        assert len(body["compareGroup"]) > 0

    def test_yoy_는_top_bottom_target_구조다(self, body):
        assert set(body["yoy"]) == {"top", "bottom", "target"}
        assert body["yoy"]["target"]["name"] == "호서대학교"


# ---------------------------------------------------------------------------
# /api/stats — 수치 (Streamlit 판과 대조)
# ---------------------------------------------------------------------------


@realdata
class TestStatsValues:
    @pytest.fixture(scope="class")
    def body(self, client):
        return client.post(
            "/api/stats",
            json={"university": "호서대학교", "year": 2026, "regionName": "충청권"},
        ).json()

    def test_2026_호서대_실적(self, body):
        p = body["trend"]["2026"]
        assert p["papers"] == pytest.approx(52.65, abs=1e-2)
        assert p["faculty"] == 406
        assert p["perCapita"] == pytest.approx(0.1297, abs=1e-4)
        assert p["nationalRank"] == 71
        assert p["regionalRank"] == 17

    def test_2017_은_V01_수정값을_반영한다(self, body):
        # 남성분만 집계하던 시절이면 0.1288 이 나온다
        assert body["trend"]["2017"]["perCapita"] == pytest.approx(0.1622, abs=1e-4)

    def test_순위_변화는_양수가_개선이다(self, body):
        # 2025년 77위 → 2026년 71위 = 6계단 개선
        rc = body["rankChanges"]["2026"]
        assert rc["nationalRank"] == 71
        assert rc["nationalRankDelta"] == 6, (
            "양수 = 개선 규약. 음수가 나오면 부호가 뒤집힌 것이다(V09)"
        )

    def test_권역평균은_권역_전체_모집단_기준이다(self, body, client):
        # V03·R-RS-01 이 났던 축이다. 비교군 평균과 같아지면 모집단이 좁혀진 것.
        avg = body["averages"]["2026"]
        assert avg["regional"] == pytest.approx(0.1975, abs=1e-4)
        assert avg["regional"] != avg["compareGroup"], (
            "권역평균이 비교군평균과 같다 — 모집단이 비교군으로 좁혀졌다"
        )


# ---------------------------------------------------------------------------
# /api/stats — 권역 자동 판정 (V03)
# ---------------------------------------------------------------------------


@realdata
class TestRegionResolution:
    def test_권역을_안_주면_자동_판정한다(self, client):
        # V03: 권역이 None 이면 '권역평균' 이 6개 권역 전체 평균이 됐다.
        # 서버가 반드시 하나의 권역으로 확정해서 돌려줘야 한다.
        body = client.post(
            "/api/stats", json={"university": "호서대학교", "year": 2026}
        ).json()
        assert body["regionName"] == "충청권"
        assert body["averages"]["2026"]["regional"] == pytest.approx(0.1975, abs=1e-4)

    def test_타_권역_대학도_권역_동료로_비교군을_채운다(self, client):
        # R-RS-02: 기본 비교군 5개교가 전부 충청권이라, 타 권역 대상이면 후보가
        # 전부 걸러져 비교군이 자기 자신 하나만 남았다. 같은 권역 대학으로 채운다.
        # 국립대는 데이터에 없다(V14 — 등재 사립만 집계). 사립대를 쓴다.
        body = client.post(
            "/api/stats", json={"university": "영남대학교", "year": 2026}
        ).json()
        assert body["regionName"] == "영남권"
        assert len(body["compareGroup"]) >= 3, (
            f"비교군이 {body['compareGroup']} 뿐이다 — 자기 자신과 비교하게 된다"
        )
        assert body["compareGroupNote"] is None

    def test_권역에_동료가_없으면_사유를_알린다(self, client):
        # 제주권은 전 연도에 걸쳐 대학이 1개교뿐이다. 데이터 현실이라 비교군을
        # 만들 수 없는데, 그걸 조용히 넘기면 '비교군평균' 이 자기 값이 되고
        # 화면은 그것을 "비교" 라고 부른다. 반드시 사유를 올려보낸다.
        body = client.post(
            "/api/stats", json={"university": "제주국제대학교", "year": 2025}
        ).json()
        assert body["regionName"] == "제주권"
        assert body["compareGroup"] == ["제주국제대학교"]
        assert body["compareGroupNote"] is not None
        assert "비교군을 구성할 수 없다" in body["compareGroupNote"]

    def test_그_해에_없는_대학은_404_이고_있는_연도를_알려준다(self, client):
        # 제주국제대는 2016~2025 에만 있다. 2026 을 물으면 빈 통계를 내주는 대신
        # 어느 해에 데이터가 있는지 알려준다.
        r = client.post(
            "/api/stats", json={"university": "제주국제대학교", "year": 2026}
        )
        assert r.status_code == 404
        assert "2025" in r.json()["detail"]


# ---------------------------------------------------------------------------
# 오류 처리
# ---------------------------------------------------------------------------


@realdata
class TestErrors:
    def test_없는_대학은_404(self, client):
        r = client.post("/api/stats", json={"university": "없는대학교", "year": 2026})
        assert r.status_code == 404

    def test_없는_연도는_404(self, client):
        r = client.post("/api/stats", json={"university": "호서대학교", "year": 1999})
        assert r.status_code == 404

    def test_필수_필드_누락은_422(self, client):
        assert client.post("/api/stats", json={"university": "호서대학교"}).status_code == 422
