# ============================================================================
# Copyright (c) 2026 정화민 (Junghwamin)
# Licensed under the PolyForm Noncommercial License 1.0.0.
# ============================================================================
"""API 계약 테스트 — /api/narrative, /api/report.

실제 OpenAI 를 부르지 않는다. `core.gpt_reporter._call_gpt` 를 가짜로 바꿔
**프롬프트에 무엇이 들어가는지**와 **실패를 어떻게 알리는지**를 본다.

보고서는 메모리에서 만들어 바이트로 내려준다 — 서버가 파일을 남기면
동시 사용자끼리 덮어쓰고, 클라우드에서는 쓰기 권한조차 없을 수 있다.
"""

from __future__ import annotations

import io
import zipfile

import pytest
from fastapi.testclient import TestClient

import core.gpt_reporter as gpt
from api.main import app
from tests.conftest import REALDATA_AVAILABLE

realdata = pytest.mark.skipif(
    not REALDATA_AVAILABLE, reason="추적 중인 output/*.csv 가 없다"
)


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def fake_gpt(monkeypatch):
    """`_call_gpt` 를 가로채 호출 내용을 기록한다."""
    calls: list[str] = []

    def _fake(client, user_content: str) -> str:  # noqa: ANN001
        calls.append(user_content)
        return f"가짜 서술 {len(calls)}"

    monkeypatch.setattr(gpt, "_call_gpt", _fake)
    return calls


@pytest.fixture
def api_key(monkeypatch):
    """서버가 키를 갖고 있는 상태를 만든다."""
    monkeypatch.setenv("OPENAI_API_KEY", "sk-" + "test" + "0" * 24)


# ---------------------------------------------------------------------------
# /api/narrative
# ---------------------------------------------------------------------------


@realdata
class TestNarrative:
    def test_4종을_모두_생성한다(self, client, fake_gpt, api_key):
        r = client.post(
            "/api/narrative",
            json={"university": "호서대학교", "year": 2026},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert set(body["narratives"]) == {"trend", "comparison", "regional", "yoy"}
        assert body["failed"] == {}
        assert len(fake_gpt) == 4

    def test_요청한_키만_생성한다(self, client, fake_gpt, api_key):
        body = client.post(
            "/api/narrative",
            json={"university": "호서대학교", "year": 2026, "keys": ["trend"]},
        ).json()
        assert set(body["narratives"]) == {"trend"}
        assert len(fake_gpt) == 1

    def test_프롬프트에_대상과_권역이_들어간다(self, client, fake_gpt, api_key):
        # 권역이 프롬프트에 없으면 GPT 가 엉뚱한 권역을 지어낸다(V03 의 파생).
        client.post(
            "/api/narrative",
            json={"university": "호서대학교", "year": 2026, "keys": ["regional"]},
        )
        prompt = fake_gpt[0]
        assert "호서대학교" in prompt
        assert "충청권" in prompt

    def test_알_수_없는_키는_422(self, client, fake_gpt, api_key):
        r = client.post(
            "/api/narrative",
            json={"university": "호서대학교", "year": 2026, "keys": ["없는키"]},
        )
        assert r.status_code == 422
        assert "없는키" in r.text

    def test_키가_없으면_503_이고_이유를_말한다(self, client, monkeypatch):
        # 사이드바에 "⚠ 미설정" 만 뜨고 원인을 안 알려주던 것이 V16 이었다.
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        r = client.post(
            "/api/narrative", json={"university": "호서대학교", "year": 2026}
        )
        assert r.status_code == 503
        detail = r.json()["detail"]
        assert "OPENAI_API_KEY" in detail

    def test_일부가_실패해도_나머지는_돌려준다(self, client, monkeypatch, api_key):
        # 하나 실패했다고 전부 버리면 사용자가 4번을 다시 기다려야 한다.
        calls = {"n": 0}

        def _flaky(client_, user_content):  # noqa: ANN001
            calls["n"] += 1
            if calls["n"] == 2:
                raise RuntimeError("일시적 오류")
            return "괜찮은 서술"

        monkeypatch.setattr(gpt, "_call_gpt", _flaky)

        body = client.post(
            "/api/narrative", json={"university": "호서대학교", "year": 2026}
        ).json()
        assert len(body["narratives"]) == 3
        assert len(body["failed"]) == 1
        assert "일시적 오류" in next(iter(body["failed"].values()))

    def test_API_키를_응답에_담지_않는다(self, client, fake_gpt, api_key):
        # 키가 클라이언트로 내려가면 브라우저 개발자 도구에 그대로 보인다.
        r = client.post(
            "/api/narrative", json={"university": "호서대학교", "year": 2026}
        )
        assert "sk-" not in r.text


# ---------------------------------------------------------------------------
# /api/report
# ---------------------------------------------------------------------------


@realdata
class TestReport:
    def test_docx_바이트를_내려준다(self, client):
        r = client.post(
            "/api/report",
            json={
                "university": "호서대학교",
                "year": 2026,
                "narratives": {"trend": "추이 서술", "yoy": "증감 서술"},
            },
        )
        assert r.status_code == 200, r.text
        assert r.content[:4] == b"PK\x03\x04", "docx 는 zip 이다"
        assert "wordprocessingml" in r.headers["content-type"]

    def test_파일명이_대상과_연도를_담는다(self, client):
        r = client.post(
            "/api/report", json={"university": "호서대학교", "year": 2026}
        )
        disposition = r.headers["content-disposition"]
        # 한글 파일명은 RFC 5987 로 인코딩된다. 원문이 그대로 들어가면 깨진다.
        assert "filename*=UTF-8''" in disposition
        assert "2026" in disposition

    def test_서술이_실제로_문서에_들어간다(self, client):
        r = client.post(
            "/api/report",
            json={
                "university": "호서대학교",
                "year": 2026,
                "narratives": {"trend": "고유한문자열추이서술"},
            },
        )
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            document = z.read("word/document.xml").decode("utf-8")
        assert "고유한문자열추이서술" in document

    def test_서술이_비어도_문서를_만든다(self, client):
        # 서술 없이 표와 차트만으로도 보고서는 나와야 한다.
        r = client.post(
            "/api/report", json={"university": "호서대학교", "year": 2026}
        )
        assert r.status_code == 200
        assert r.content[:4] == b"PK\x03\x04"

    def test_차트_5장이_들어간다(self, client):
        r = client.post(
            "/api/report", json={"university": "호서대학교", "year": 2026}
        )
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            media = [n for n in z.namelist() if n.startswith("word/media/")]
        assert len(media) == 5, f"차트가 5장이 아니다: {media}"

    def test_서버에_파일을_남기지_않는다(self, client, tmp_path, monkeypatch):
        # 서버가 디스크에 쓰면 동시 사용자끼리 덮어쓰고, 클라우드에서는
        # 쓰기 권한조차 없을 수 있다. 메모리에서 만들어 바이트로 내려준다.
        monkeypatch.chdir(tmp_path)
        before = set(tmp_path.rglob("*"))
        client.post("/api/report", json={"university": "호서대학교", "year": 2026})
        assert set(tmp_path.rglob("*")) == before

    def test_없는_대학은_404(self, client):
        r = client.post("/api/report", json={"university": "없는대학교", "year": 2026})
        assert r.status_code == 404


@realdata
class TestChartSafety:
    """matplotlib 이 서버에서 안전하게 도는가.

    이 두 테스트는 실제로 난 사고에서 나왔다. 테스트는 conftest 가
    `MPLBACKEND=Agg` 를 걸어 통과하는데 **서버는 tkagg 로 돌고 있었다.**
    요청 스레드에서 Tk 를 건드려 "main thread is not in main loop" 가 나고,
    최악에는 `Tcl_AsyncDelete` 로 프로세스가 죽었다.
    """

    def test_차트_모듈이_스스로_헤드리스_백엔드를_고른다(self):
        # 환경변수에 기대면 서버 기동 방식이 바뀔 때마다 다시 깨진다.
        # 모듈이 import 시점에 직접 못박아야 한다.
        import core.chart_generator as cg

        assert cg.matplotlib.get_backend().lower() == "agg", (
            "GUI 백엔드로 돌고 있다. 요청 스레드에서 Tk 를 건드리면 서버가 죽는다."
        )

    def test_보고서_동시_요청이_서로를_망가뜨리지_않는다(self, client):
        # pyplot 은 전역 상태다. uvicorn 이 동기 엔드포인트를 스레드풀에서
        # 돌리므로 요청이 겹치면 figure 가 섞여 차트가 빠지거나 비어 나온다.
        import concurrent.futures as cf

        body = {"university": "호서대학교", "year": 2026}

        def one(_: int):
            r = client.post("/api/report", json=body)
            media = 0
            if r.status_code == 200:
                with zipfile.ZipFile(io.BytesIO(r.content)) as z:
                    media = len([n for n in z.namelist() if n.startswith("word/media/")])
            return r.status_code, len(r.content), media

        with cf.ThreadPoolExecutor(max_workers=4) as ex:
            results = list(ex.map(one, range(4)))

        assert all(code == 200 for code, _, _ in results), results
        assert all(media == 5 for _, _, media in results), (
            f"차트가 5장이 아닌 응답이 있다: {results}"
        )
        # 같은 입력이면 크기도 같아야 한다 — 다르면 figure 가 섞인 것이다
        sizes = {size for _, size, _ in results}
        assert len(sizes) == 1, f"응답 크기가 갈렸다: {sizes}"
