# ============================================================================
# Copyright (c) 2026 정화민 (Junghwamin)
# Licensed under the PolyForm Noncommercial License 1.0.0.
# ============================================================================
"""API 계약 테스트 — 설정, 대학 목록, 차트 이미지.

원본 Streamlit 판에 있었으나 이관에서 빠졌던 것들을 잠근다. 함께 잡은
실제 버그 하나도 여기서 막는다 — `.env` 가 전혀 읽히지 않았다.
"""

from __future__ import annotations

import subprocess
import sys

import pytest
from fastapi.testclient import TestClient

from api.main import app
from tests.conftest import PROJECT_ROOT, REALDATA_AVAILABLE

realdata = pytest.mark.skipif(
    not REALDATA_AVAILABLE, reason="추적 중인 output/*.csv 가 없다"
)


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


# ---------------------------------------------------------------------------
# .env 로딩 (실제로 났던 버그)
# ---------------------------------------------------------------------------


def test_dotenv_를_실제로_읽는다():
    """README 와 인스톨러가 `.env` 를 안내하는데 읽지 않고 있었다.

    `load_dotenv` 호출이 코드 어디에도 없어서, 사용자가 키를 넣어도
    "설정되지 않았다" 는 503 을 봤다. Streamlit 판은 app.py 에서 매 run 마다
    했고 이관 과정에서 빠졌다.

    별도 프로세스에서 확인한다 — 현재 프로세스는 이미 import 가 끝나
    load_dotenv 가 실행된 뒤라 검증이 되지 않는다.
    """
    env_path = PROJECT_ROOT / ".env"
    if env_path.exists():
        pytest.skip("실제 .env 가 있다. 덮어쓰지 않는다")

    probe_key = "sk-" + "dotenvprobe" + "0" * 15
    env_path.write_text(f"OPENAI_API_KEY={probe_key}\n", encoding="utf-8")
    try:
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import os;"
                    "os.environ.pop('OPENAI_API_KEY', None);"
                    "import api.main;"
                    "print(os.environ.get('OPENAI_API_KEY', ''))"
                ),
            ],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
        )
        assert probe_key in result.stdout, (
            f".env 가 읽히지 않는다. api/main.py 의 load_dotenv 를 확인할 것.\n"
            f"stdout={result.stdout!r} stderr={result.stderr[-400:]!r}"
        )
    finally:
        env_path.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# /api/settings
# ---------------------------------------------------------------------------


class TestSettings:
    def test_키_값을_절대_내려보내지_않는다(self, client, monkeypatch):
        """키가 브라우저로 가면 개발자 도구에 그대로 보인다.

        Streamlit 판은 키를 session_state 에 담았는데, 그건 화면과 같은
        생명주기에 두는 것이고 곧 브라우저로 보낸다는 뜻이었다.
        """
        secret = "sk-" + "supersecret" + "0" * 20
        monkeypatch.setenv("OPENAI_API_KEY", secret)

        body = client.get("/api/settings")
        assert secret not in body.text
        data = body.json()
        assert data["apiKeyConfigured"] is True
        # 힌트는 앞뒤만 남긴다. 가운데를 보여주면 마스킹이 아니다.
        assert "supersecret" not in data["apiKeyHint"]

    def test_미설정_상태를_알린다(self, client, monkeypatch):
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        data = client.get("/api/settings").json()
        assert data["apiKeyConfigured"] is False
        assert data["apiKeyHint"] is None

    def test_자리표시자는_설정된_것으로_보지_않는다(self, client, monkeypatch):
        # V16 의 사촌 — 템플릿을 그대로 둔 채 "설정됨" 이라고 하면 안 된다
        monkeypatch.setenv("OPENAI_API_KEY", "sk-여기에_실제_키를_입력하세요")
        assert client.get("/api/settings").json()["apiKeyConfigured"] is False

    @pytest.mark.parametrize(
        ("key", "reason"),
        [
            ("not-a-key", "sk- 로 시작하지 않는다"),
            ("sk-short", "너무 짧다"),
            ("sk-여기에_실제_키를_입력하세요", "자리표시자"),
        ],
    )
    def test_잘못된_키를_거부한다(self, client, key, reason):
        r = client.post("/api/settings/api-key", json={"apiKey": key})
        assert r.status_code == 422, f"{reason} 인데 통과했다"


# ---------------------------------------------------------------------------
# /api/data — 대학 목록
# ---------------------------------------------------------------------------


@realdata
class TestUniversityList:
    def test_대학_이름_전체를_돌려준다(self, client):
        """개수만 주면 화면이 자유 텍스트 입력이 되고, 오타 한 번에 404 다.

        원본은 selectbox 로 목록에서 고르게 해서 없는 이름을 넣는 것이
        구조적으로 불가능했다.
        """
        data = client.get("/api/data").json()
        names = data["universities"]
        assert len(names) >= 100, f"목록이 너무 짧다: {len(names)}"
        assert "호서대학교" in names
        assert names == sorted(names), "가나다순이어야 골라 쓰기 쉽다"

    def test_목록의_이름은_모두_조회가_된다(self, client):
        """목록에 있는데 조회가 안 되면 목록의 의미가 없다."""
        data = client.get("/api/data").json()
        latest = data["years"][-1]
        # 전 연도 합집합이라 특정 해에 없는 대학이 있을 수 있다.
        # 그 경우 404 와 함께 **있는 연도**를 알려줘야 한다.
        for name in data["universities"][:5]:
            r = client.post("/api/stats", json={"university": name, "year": latest})
            assert r.status_code in (200, 404)
            if r.status_code == 404:
                assert "있는 연도" in r.json()["detail"]


# ---------------------------------------------------------------------------
# /api/universities — 권역 대학
# ---------------------------------------------------------------------------


@realdata
class TestRegionUniversities:
    def test_권역_대학_전체와_지표를_돌려준다(self, client):
        body = client.get(
            "/api/universities", params={"region": "충청권", "year": 2026}
        ).json()
        assert body["regionName"] == "충청권"
        assert len(body["rows"]) > 10, "권역 전체여야 한다(비교군 몇 개가 아니라)"
        assert {"name", "faculty", "papers", "perCapita", "regionalRank"} <= set(
            body["rows"][0]
        )

    def test_권역순위_순으로_정렬한다(self, client):
        rows = client.get(
            "/api/universities", params={"region": "충청권", "year": 2026}
        ).json()["rows"]
        ranks = [r["regionalRank"] for r in rows if r["regionalRank"] is not None]
        assert ranks == sorted(ranks)

    def test_없는_권역은_404(self, client):
        r = client.get("/api/universities", params={"region": "없는권", "year": 2026})
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# /api/chart/{kind}.png
# ---------------------------------------------------------------------------


@realdata
class TestChartImages:
    @pytest.mark.parametrize("kind", ["trend", "bar", "avg", "rank", "compare"])
    def test_5종_모두_PNG_를_돌려준다(self, client, kind):
        """화면 차트와 Word 차트가 **같은 그림**이어야 한다.

        원본은 3단계에서 "5종 차트를 확인하세요. 보고서에 그대로 삽입됩니다"
        라고 안내했고, 실제로 같은 PNG 를 썼다. 화면을 따로 그리면 사용자가
        본 것과 문서에 실리는 것이 갈라진다.
        """
        r = client.get(
            f"/api/chart/{kind}.png",
            params={"university": "호서대학교", "year": 2026},
        )
        assert r.status_code == 200, r.text
        assert r.content[:4] == b"\x89PNG", "PNG 매직이 아니다"
        assert len(r.content) > 5000, "빈 차트로 보인다"
        assert r.headers["content-type"] == "image/png"

    def test_없는_종류는_404(self, client):
        r = client.get(
            "/api/chart/없는종류.png",
            params={"university": "호서대학교", "year": 2026},
        )
        assert r.status_code == 404

    def test_보고서와_같은_차트를_쓴다(self, client):
        """`_build_charts` 하나만 쓰는지 확인한다.

        경로가 둘이 되는 순간 한쪽만 고치는 사고가 난다.
        """
        import api.routers.report as report_module

        source = (PROJECT_ROOT / "api" / "routers" / "report.py").read_text(
            encoding="utf-8"
        )
        assert source.count("def _build_charts") == 1, "차트 생성 함수가 둘 이상이다"
        assert hasattr(report_module, "_build_charts")
