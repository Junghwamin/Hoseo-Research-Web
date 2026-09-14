# ============================================================================
# Copyright (c) 2026 정화민 (Junghwamin)
# Licensed under the PolyForm Noncommercial License 1.0.0.
# ============================================================================
"""히어로 이미지를 내려받아 번들용으로 줄인다.

**설치본은 오프라인이다.** CDN 링크를 쓰면 설치본에서 그림이 통째로 빠진다.
그래서 빌드 PC 에서 한 번 받아 `web/public/media/` 에 넣고, 그 파일을 번들에
포함시킨다.

## 이미지 고르는 기준

1. **CC0 만 쓴다.** 저작자 표시 의무가 있는 라이선스(CC BY 등)는 화면 어딘가에
   크레딧을 계속 달고 다녀야 하는데, 그 의무를 코드가 아니라 사람이 기억해야
   하는 순간 언젠가 빠진다.
2. **특정 대학 캠퍼스 사진은 쓰지 않는다.** 이 앱은 호서대 포털인데 다른
   대학 건물 사진을 히어로에 깔면 소속을 오해시킨다. 대학을 특정하지 않는
   건축·서가 이미지만 쓴다.

출처와 라이선스는 `web/public/media/CREDITS.md` 에 기록한다 — CC0 는 표시
의무가 없지만, **나중에 이 파일이 어디서 왔는지 아무도 모르는 상태**가 되는
편이 더 위험하다.

사용법:
    .venv/Scripts/python.exe scripts/fetch_media.py
"""

from __future__ import annotations

import io
import json
import sys
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "web" / "public" / "media"

USER_AGENT = "hoseo-research-web/1.0 (media fetch; offline installer bundling)"


@dataclass(frozen=True)
class MediaItem:
    """받을 이미지 하나. `openverse_id` 로 출처를 되짚을 수 있다."""

    name: str
    openverse_id: str
    url: str
    title: str
    source_page: str
    #: 긴 변 기준 목표 폭(px). 히어로는 넓게, 띠는 좁게.
    width: int
    #: 화면에서 어떻게 쓰는지. CREDITS.md 에 적는다.
    usage: str


ITEMS = (
    MediaItem(
        name="hero-reading-room",
        openverse_id="edf1b421-7c1b-4504-9a85-3ce7e22f72f6",
        url=(
            "https://upload.wikimedia.org/wikipedia/commons/2/28/"
            "East_Asia_Library_Reading_Room.jpg"
        ),
        title="East Asia Library Reading Room (Alecrr)",
        source_page="https://commons.wikimedia.org/w/index.php?curid=188161895",
        # 히어로는 전체 폭을 덮는다. 원본이 3336px 라 2000 으로 줄여도 선명하다.
        width=2000,
        usage="홈 히어로 배경",
    ),
    MediaItem(
        name="band-library",
        openverse_id="19612c61-cfbc-4dda-9c5e-ba248d531fc0",
        url=(
            # rawpixel 은 image_1300 이 가장 큰 변형이다(editor_2000 은 404).
            # 히어로에 쓰기엔 작아서 좁은 띠에만 쓴다.
            "https://images.rawpixel.com/image_1300/"
            "czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIv"
            "ZnJzdHV0dGdhcnRfYXJjaGl0ZWN0dXJlX2xpYnJhcnlfMTE4MTY4OS1pbWFnZS1r"
            "eWJjbTA0eS5qcGc.jpg"
        ),
        title="Modern minimal library",
        source_page=(
            "https://www.rawpixel.com/image/6031468/"
            "photo-image-book-public-domain-minimal"
        ),
        width=1300,
        usage="보고서 안내 구간 배경",
    ),
)


def _download(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as res:  # noqa: S310 — 고정 URL
        return res.read()


def _verify_cc0(item: MediaItem) -> dict:
    """받기 전에 라이선스를 다시 확인한다.

    목록을 만든 시점과 받는 시점 사이에 라이선스가 바뀌었을 수 있다. 사람이
    "CC0 였던 것 같은데" 로 기억하는 것보다 매번 확인하는 편이 싸다.
    """
    url = f"https://api.openverse.org/v1/images/{item.openverse_id}/"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as res:  # noqa: S310
        meta = json.load(res)

    if meta.get("license") != "cc0":
        sys.exit(
            f"{item.name}: 라이선스가 CC0 가 아니다({meta.get('license')}). "
            f"표시 의무가 있는 이미지는 쓰지 않는다."
        )
    return meta


def _process(raw: bytes, width: int) -> tuple[bytes, tuple[int, int]]:
    """폭을 맞추고 WebP 로 줄인다.

    WebP 만 쓴다. 같은 화질에 JPEG 의 2/3 이고, 설치본이 뜨는 브라우저는
    전부 지원한다. 그림을 못 받으면 히어로는 CSS 그라디언트로 떨어진다.
    """
    img = Image.open(io.BytesIO(raw))
    img = img.convert("RGB")

    if img.width > width:
        height = round(img.height * width / img.width)
        img = img.resize((width, height), Image.LANCZOS)

    buf = io.BytesIO()
    # method=6 은 느리지만 가장 작다. 빌드 때 한 번만 돈다.
    img.save(buf, format="WEBP", quality=76, method=6)
    return buf.getvalue(), img.size


def main() -> None:
    # Windows 콘솔은 cp949 라 '—' 같은 글자에서 UnicodeEncodeError 로 죽는다.
    # 파일은 다 만들어 놓고 마지막 print 에서 터지면 실패한 줄 안다.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    credits: list[str] = [
        "# 번들된 미디어 출처",
        "",
        "`scripts/fetch_media.py` 가 생성한다. 손으로 고치지 말 것.",
        "",
        "전부 **CC0 1.0**(퍼블릭 도메인 기증)이다. 표시 의무는 없지만,",
        "나중에 이 파일이 어디서 왔는지 아무도 모르는 상태가 되지 않도록 남긴다.",
        "",
    ]

    total = 0
    for item in ITEMS:
        meta = _verify_cc0(item)
        print(f"[{item.name}] CC0 확인, 내려받는 중…")

        data, size = _process(_download(item.url), item.width)
        out = OUT_DIR / f"{item.name}.webp"
        out.write_bytes(data)
        total += len(data)
        print(f"  → {out.relative_to(ROOT)}  {size[0]}x{size[1]}  {len(data) / 1024:.0f} KB")

        credits += [
            f"## {item.name}.webp",
            "",
            f"- 제목: {meta.get('title') or item.title}",
            f"- 저작자: {meta.get('creator') or '표시 없음'}",
            f"- 라이선스: CC0 1.0 ({meta.get('license_url')})",
            f"- 출처: {item.source_page}",
            f"- 용도: {item.usage}",
            f"- 크기: {size[0]}x{size[1]}, {len(data) / 1024:.0f} KB",
            "",
        ]

    (OUT_DIR / "CREDITS.md").write_text("\n".join(credits), encoding="utf-8")
    print(f"\n합계 {total / 1024:.0f} KB — 설치본에 그대로 들어간다.")


if __name__ == "__main__":
    main()
