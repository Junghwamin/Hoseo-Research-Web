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
from api.routers import report
from tests.conftest import REALDATA_AVAILABLE

# `report` 를 **모듈 레벨에서** 가져온다. `test_openapi_drift.py` 가 `api*` 를
# 통째로 다시 import 하므로, 함수 안에서 가져오면 `app` 과 다른 세대의 모듈을
# 집어 `_make_client` 를 바꿔치기해도 라우터가 보지 못한다.

realdata = pytest.mark.skipif(
    not REALDATA_AVAILABLE, reason="추적 중인 output/*.csv 가 없다"
)

REQ = {"university": "호서대학교", "year": 2026}

#: 브라우저가 헤더로 보내는 키. 서버 키(`api_key` 픽스처)와 다른 값이어야
#: "어느 쪽을 썼는가" 를 구분할 수 있다.
HEADER_KEY = "sk-" + "browser" + "0" * 20


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def capture_client(monkeypatch):
    """`OpenAI(...)` 생성을 가로채 **어느 키로 만들었는지** 기록한다."""
    seen: list[str] = []
    monkeypatch.setattr(report, "_make_client", lambda key: (seen.append(key), object())[1])
    return seen


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
        # 무엇을 하면 되는지도 말한다 — 설정에서 넣거나 서버 환경변수로.
        assert "설정" in detail

    # --- 브라우저 키(BYOK) ------------------------------------------------

    def test_헤더의_키를_서버_키보다_먼저_쓴다(self, client, fake_gpt, api_key, capture_client):
        """사용자가 방금 넣은 키가 쓰여야 한다. 서버 키가 이기면 BYOK 가 닿지 않는다."""
        r = client.post("/api/narrative", json=REQ, headers={"X-OpenAI-Key": HEADER_KEY})
        assert r.status_code == 200, r.text
        assert capture_client == [HEADER_KEY]

    def test_헤더가_없으면_서버_키를_쓴다(self, client, fake_gpt, api_key, capture_client):
        r = client.post("/api/narrative", json=REQ)
        assert r.status_code == 200, r.text
        assert capture_client == ["sk-" + "test" + "0" * 24]

    def test_헤더_키_형식이_틀리면_422(self, client, fake_gpt, api_key):
        # 서버 키가 있어도 **브라우저가 보낸 키가 망가졌다는 사실**을 알려야
        # 한다. 조용히 서버 키로 넘어가면 사용자는 자기 키가 쓰인 줄 안다.
        r = client.post("/api/narrative", json=REQ, headers={"X-OpenAI-Key": "abc"})
        assert r.status_code == 422
        assert "형식" in r.json()["detail"]

    def test_빈_헤더는_없는_것으로_친다(self, client, fake_gpt, api_key, capture_client):
        r = client.post("/api/narrative", json=REQ, headers={"X-OpenAI-Key": "  "})
        assert r.status_code == 200, r.text
        assert capture_client == ["sk-" + "test" + "0" * 24]

    def test_실패_사유에_키가_섞여도_응답에_남지_않는다(
        self, client, monkeypatch, api_key, capture_client
    ):
        """OpenAI 의 인증 오류 메시지는 키 일부를 그대로 되돌려 준다."""
        key = "sk-" + "leak" + "0" * 24

        def _boom(c, p):  # noqa: ANN001
            raise RuntimeError(f"bad {key} and masked {key[:12]}**** too")

        monkeypatch.setattr(gpt, "_call_gpt", _boom)
        r = client.post("/api/narrative", json=REQ, headers={"X-OpenAI-Key": key})
        assert r.status_code == 200, r.text
        assert "sk-" not in r.text
        assert r.json()["failed"]
        # 키 아닌 부분은 남아 있어야 원인을 읽을 수 있다
        assert "RuntimeError" in next(iter(r.json()["failed"].values()))

    def test_keys_중복은_한_번만_생성한다(self, client, fake_gpt, api_key, capture_client):
        r = client.post("/api/narrative", json={**REQ, "keys": ["trend", "trend"]})
        assert r.status_code == 200, r.text
        assert len(fake_gpt) == 1
        assert set(r.json()["narratives"]) == {"trend"}

    def test_FORCE_READONLY_면_서버_키를_무시하고_헤더만_본다(
        self, client, fake_gpt, api_key, monkeypatch, capture_client
    ):
        # 개발 PC 의 `.env` 에 진짜 키가 있어도 공개 사이트처럼 굴어야 e2e 가
        # 그 모드를 재현한다. 설정 응답(`apiKeyConfigured=false`)과 짝이다.
        monkeypatch.setenv("HOSEO_FORCE_READONLY", "1")
        assert client.post("/api/narrative", json=REQ).status_code == 503
        r = client.post("/api/narrative", json=REQ, headers={"X-OpenAI-Key": HEADER_KEY})
        assert r.status_code == 200, r.text
        assert capture_client == [HEADER_KEY]

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


def test_클라이언트는_60초_타임아웃_재시도_1회(monkeypatch):
    """서버리스 함수 한 번을 GPT 호출 1회로 묶는다. SDK 기본(600초·재시도 2회)이면
    함수 시간 상한을 넘겨 사용자는 504 만 본다."""
    import openai

    seen: dict = {}
    monkeypatch.setattr(openai, "OpenAI", lambda **kw: seen.update(kw) or object())
    report._make_client("sk-" + "x" * 30)
    assert seen["api_key"] == "sk-" + "x" * 30
    assert seen["timeout"] == 60
    assert seen["max_retries"] == 1


class TestScrub:
    """실패 사유에서 키를 지우는 규칙. 응답·로그 어디에도 키가 남으면 안 된다."""

    KEY = "sk-" + "proj" + "a" * 40

    def test_키_전체를_지운다(self):
        out = report._scrub(f"Incorrect API key provided: {self.KEY}.", self.KEY)
        assert self.KEY not in out and "sk-" not in out
        assert "Incorrect API key provided" in out

    def test_앞_12자_이상_조각도_지운다(self):
        # 200자 자르기나 SDK 의 마스킹(`sk-proj****`)이 키 조각을 남긴다
        out = report._scrub(f"got {self.KEY[:20]}*** back", self.KEY)
        assert "sk-" not in out and "back" in out

    def test_키가_아닌_글은_건드리지_않는다(self):
        assert report._scrub("일시적 오류: 다시 시도", self.KEY) == "일시적 오류: 다시 시도"


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
class TestNarrativeInput:
    """서술 본문은 공개 배포에서 아무나 보낼 수 있는 입력이다."""

    BASE = {"university": "호서대학교", "year": 2026}

    def _report(self, client, text: str):
        return client.post(
            "/api/report", json={**self.BASE, "narratives": {"trend": text}}
        )

    def test_줄이_너무_많으면_문서를_만들기_전에_거절한다(self, client):
        """보고서는 줄마다 단락을 만든다. 막지 않으면 0.2MB 로 CPU 를 5분 쓴다."""
        assert self._report(client, "가\n" * 70_000).status_code == 422

    def test_글자가_너무_많으면_거절한다(self, client):
        """줄만 세면 한 줄을 길게 보내 돌아올 수 있다."""
        assert self._report(client, "가" * 200_000).status_code == 422

    def test_상한_안쪽의_서술은_그대로_들어간다(self, client):
        text = "\n".join(f"{i}번째 문장" for i in range(200))

        r = self._report(client, text)

        assert r.status_code == 200
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            assert "199번째 문장" in z.read("word/document.xml").decode("utf-8")

    def test_보이지_않는_제어_문자가_섞여도_문서를_만든다(self, client):
        """붙여넣기에 섞여 오는 글자다. Word 의 XML 에 담을 수 없어 500 이 났다."""
        r = self._report(client, "논문 수는 늘었다.\x0b전년 대비\x1b 상승했다.\x00")

        assert r.status_code == 200
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            assert "논문 수는 늘었다.전년 대비 상승했다." in z.read(
                "word/document.xml"
            ).decode("utf-8")


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
