"""번들 글꼴 계약 — `web/public/fonts/` 는 `scripts/build_fonts.py` 의 산출물이다.

설치본은 오프라인이고 공개 배포는 CDN 을 쓰지 않으므로 글꼴은 저장소 안에 있어야
한다. 여기서는 네트워크·fontTools 없이 확인할 수 있는 것만 본다.

    - fonts.css 가 가리키는 파일이 전부 있다
    - 두 글꼴(Pretendard Variable 92조각, Geist Mono 1.7.2)과 폴백 메트릭 선언이 있다
    - manifest.json 의 sha256 이 실제 파일과 같다 (손으로 고친 흔적이 없다)
    - 폴더에 manifest 밖의 낯선 파일이 없다
    - 생성기의 `--check` 가 통과한다
    - 라이선스 사본과 출처 문서가 있다
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys

from tests.conftest import PROJECT_ROOT

FONTS = PROJECT_ROOT / "web" / "public" / "fonts"
CSS = FONTS / "fonts.css"

#: 생성기가 만들지 않는, 사람이 쓰는 파일.
HAND_WRITTEN = {"manifest.json", "CREDITS.md"}


def _css() -> str:
    return CSS.read_text("utf-8")


def _manifest() -> dict[str, str]:
    return json.loads((FONTS / "manifest.json").read_text("utf-8"))


def test_fonts_css_의_모든_url_이_존재한다():
    urls = re.findall(r"url\(/fonts/([^)]+)\)", _css())
    assert len(urls) >= 93, "Pretendard 92조각 + Geist Mono 1 이 최소치다"
    missing = [u for u in urls if not (FONTS / u).is_file()]
    assert missing == []


def test_두_글꼴과_폴백이_선언돼_있다():
    css = _css()
    # Geist Mono 는 가변 축(wght 100–900)을 그대로 둔 woff2 하나다 — 인스턴스화하지 않는다
    assert "font-family: 'Geist Mono'" in css
    assert "font-weight: 100 900;" in css
    assert "Hahmlet" not in css
    assert css.count("font-family: 'Pretendard Variable'") == 92
    # 글꼴이 늦게 오는 동안 Malgun Gothic 을 Pretendard 폭에 맞춰 줄바꿈이 튀지 않게 한다
    assert "font-family: 'Pretendard Fallback'" in css
    assert "local('Malgun Gothic')" in css
    assert "size-adjust: 86.4%" in css


def test_manifest_와_파일_해시가_같다():
    manifest = _manifest()
    assert len(manifest) >= 96, "92조각 + OFL 2 + Geist Mono 1 + fonts.css"
    mismatched = [
        rel
        for rel, digest in manifest.items()
        if hashlib.sha256((FONTS / rel).read_bytes()).hexdigest() != digest
    ]
    assert mismatched == []


def test_manifest_밖의_낯선_파일이_없다():
    on_disk = {p.relative_to(FONTS).as_posix() for p in FONTS.rglob("*") if p.is_file()}
    assert on_disk - set(_manifest()) == HAND_WRITTEN


def test_생성기_check_모드가_통과한다():
    # cp949 콘솔에서 한글 출력이 깨지지 않도록 -X utf8
    result = subprocess.run(
        [sys.executable, "-X", "utf8", "scripts/build_fonts.py", "--check"],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=120,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_OFL_과_CREDITS_가_있다():
    for rel in ("pretendard-1.3.9/OFL.txt", "geist-mono-1.7.2/OFL.txt", "CREDITS.md"):
        assert (FONTS / rel).is_file(), rel


def test_Hahmlet_폴더가_없다():
    # 표제 세리프는 뺐다. 폴더가 남아 있으면 manifest 밖 파일로도 걸리지만 이유를 분명히 적는다
    assert not (FONTS / "hahmlet-650").exists()
