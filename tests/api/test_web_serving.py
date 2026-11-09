# ============================================================================
# Copyright (c) 2026 정화민 (Junghwamin)
# Licensed under the PolyForm Noncommercial License 1.0.0.
# ============================================================================
"""프론트 정적 서빙 계약 — `web/dist` 밖의 파일은 어떤 경로로도 나가지 않는다.

오프라인 설치본만 있을 때는 서버가 자기 PC 에서만 돌아 드러나지 않던 문제다.
공개 배포에서는 `/proc/self/environ` 한 번으로 `OPENAI_API_KEY` 가 샌다.

`mount_web` 에 임시 앱과 임시 폴더를 넘긴다. pytest job 은 프론트를 빌드하지
않으므로, 진짜 `app` 에 기대면 CI 에서 이 계약이 아무것도 검사하지 못한다.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.main import mount_web

SECRET = "OUTSIDE-OF-DIST"
INDEX = '<!doctype html><div id="root"></div>'


@pytest.fixture
def site(tmp_path) -> tuple[TestClient, Path]:
    """`web/dist` 바깥 두 단계 위에 비밀 파일을 둔 작은 사이트."""
    (tmp_path / "secret.txt").write_text(SECRET, encoding="utf-8")

    dist = tmp_path / "web" / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "fonts").mkdir()
    (dist / "index.html").write_text(INDEX, encoding="utf-8")
    (dist / "assets" / "app.js").write_text("console.log(1)", encoding="utf-8")
    (dist / "fonts" / "fonts.css").write_text("@font-face{}", encoding="utf-8")

    app = FastAPI()

    @app.get("/api/ping")
    def ping() -> dict[str, bool]:
        return {"ok": True}

    mount_web(app, dist)
    return TestClient(app), tmp_path


class TestServing:
    def test_첫_화면을_내준다(self, site):
        client, _ = site
        r = client.get("/")
        assert r.status_code == 200
        assert 'id="root"' in r.text

    def test_해시_자산과_public_파일을_내준다(self, site):
        """번들 자산만 보면 안 된다. 글꼴 CSS 는 `dist` 바로 아래 `fonts/` 에 있다."""
        client, _ = site
        assert client.get("/assets/app.js").status_code == 200
        assert client.get("/fonts/fonts.css").status_code == 200

    def test_해시_자산은_1년_캐시_글꼴은_하루_캐시다(self, site):
        """Vercel 이 함수 응답에 붙이는 기본값은 `max-age=0` 이라 매 방문마다 재검증한다.

        `/assets/*` 는 내용 해시가 이름에 들어 있어 영구 캐시가 안전하다. 글꼴은
        파일명이 바뀌지 않은 채 다시 만들어질 수 있어 하루만 둔다. index.html 은
        캐시하지 않는다 — 새 배포의 자산 이름을 가리켜야 한다.
        """
        client, _ = site
        assert (
            client.get("/assets/app.js").headers["cache-control"]
            == "public, max-age=31536000, immutable"
        )
        assert client.get("/fonts/fonts.css").headers["cache-control"] == "public, max-age=86400"
        assert "immutable" not in client.get("/").headers.get("cache-control", "")

    def test_API_가_프론트보다_먼저다(self, site):
        client, _ = site
        assert client.get("/api/ping").json() == {"ok": True}

    def test_브라우저_이동은_index_로_떨어진다(self, site):
        client, _ = site
        r = client.get("/some/client/route", headers={"Accept": "text/html"})
        assert r.status_code == 200
        assert 'id="root"' in r.text

    def test_없는_자산에_HTML_을_돌려주지_않는다(self, site):
        """200 + HTML 이면 브라우저가 JS 자리에 HTML 을 받아 흰 화면이 된다."""
        client, _ = site
        assert client.get("/assets/missing.js").status_code == 404


@pytest.mark.parametrize(
    "path",
    [
        # 비밀 파일은 `dist` 의 두 단계 위에 있다. 세 번 올라가면 없는 파일을
        # 찾는 셈이라, 구멍이 뚫려 있어도 이 테스트는 통과해 버린다.
        pytest.param("/..%2f..%2fsecret.txt", id="인코딩된-슬래시"),
        pytest.param("/%2e%2e/%2e%2e/secret.txt", id="인코딩된-점"),
        pytest.param("/..%5c..%5csecret.txt", id="인코딩된-역슬래시"),
        pytest.param("/assets/..%2f..%2f..%2fsecret.txt", id="자산-경로-경유"),
    ],
)
def test_상대_경로로_dist_밖에_나갈_수_없다(site, path):
    client, _ = site
    r = client.get(path, headers={"Accept": "text/html"})
    assert SECRET not in r.text, f"{path} 로 dist 밖 파일이 나갔다"


def test_절대_경로로_dist_밖에_나갈_수_없다(site):
    """`dist / "/etc/passwd"` 는 `/etc/passwd` 다. pathlib 이 앞을 버린다."""
    client, root = site
    target = (root / "secret.txt").as_posix()
    # 리눅스는 `//tmp/...`, Windows 는 드라이브가 살아 있는 `/C:/...` 가 된다.
    r = client.get(f"http://testserver/{target}", headers={"Accept": "text/html"})
    assert SECRET not in r.text, "절대 경로로 dist 밖 파일이 나갔다"
