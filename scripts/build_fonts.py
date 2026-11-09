"""번들 웹 글꼴을 처음부터 다시 만든다. 몇 번을 돌려도 결과가 같다.

산출물은 `web/public/fonts/` 전체(`CREDITS.md` 제외)와 `fonts.css`, 그리고 파일마다
sha256 을 적은 `manifest.json` 이다. 설치본과 Vercel 은 빌드 시점에 아무것도
내려받지 않으므로 산출물은 저장소에 커밋한다.

입력은 둘이고, 둘 다 sha256 으로 고정돼 있다 — 상류가 바뀌면 조용히 다른 글꼴이
들어오는 대신 여기서 멈춘다.

- Pretendard Variable 1.3.9 (npm 타르볼): 패키지가 만든 동적 서브셋 92조각과 CSS 를
  **수정 없이** 복사하고 경로만 바꾼다. Reserved Font Name 이 있어 직접 서브셋하면
  이름을 바꿔야 하기 때문이다.
- Geist Mono 1.7.2 (npm 타르볼): 가변 글꼴(wght 100–900)을 **인스턴스화하지 않고**
  라틴·숫자·문장부호·화살표·기호 범위만 남겨 woff2 하나로 만든다. 범위에 넣어도 원본에
  없는 글자(₩ U+20A9, ■ U+25A0, □ U+25A1)는 서브셋터가 건너뛰고 브라우저가 다음 글꼴로
  넘긴다. 한글은 없다 — 숫자·연도·순위·코드처럼 모노를 명시적으로 건 자리에만 쓰이고,
  한글이 섞이면 Pretendard 로 떨어진다. Reserved Font Name 이 없어 서브셋에 원래 이름을
  써도 된다.

사용법:
    python -X utf8 scripts/build_fonts.py          # 내려받아 전부 다시 만든다
    python -X utf8 scripts/build_fonts.py --check  # 산출물이 manifest 와 같은지만 본다

`--check` 는 네트워크도 brotli 도 필요 없다. `tests/contract/test_fonts_bundle.py` 가 부른다.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
import tarfile
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FONTS = ROOT / "web" / "public" / "fonts"
CSS = FONTS / "fonts.css"
MANIFEST = FONTS / "manifest.json"

#: 생성기가 만들지 않는 파일. manifest 에 넣지 않는다.
HAND_WRITTEN = {"manifest.json", "CREDITS.md"}

# --- 입력 고정 -----------------------------------------------------------------

PRETENDARD_VERSION = "1.3.9"
PRETENDARD_URL = (
    f"https://registry.npmjs.org/pretendard/-/pretendard-{PRETENDARD_VERSION}.tgz"
)
PRETENDARD_SHA256 = "0ffc240cee83be02520fb4ac1b2a0a51052b9d13506ade0ba90c591dbbb3bd53"
PRETENDARD_DIR = f"pretendard-{PRETENDARD_VERSION}"
PRETENDARD_PIECES = 92

GEIST_VERSION = "1.7.2"
GEIST_URL = f"https://registry.npmjs.org/geist/-/geist-{GEIST_VERSION}.tgz"
GEIST_SHA256 = "88cbfaca51646078f3172802643691bb8fe2df15ca4c455b1b101e49b7d469a6"
GEIST_DIR = f"geist-mono-{GEIST_VERSION}"
GEIST_FILE = "GeistMono-Variable.latin.woff2"
#: 타르볼 안의 원본 가변 글꼴과 라이선스.
GEIST_TTF_IN_PKG = "dist/fonts/geist-mono/GeistMono-Variable.ttf"
GEIST_LICENSE_IN_PKG = "LICENSE.txt"

#: Geist Mono 에 남기는 글자. 라틴·라틴1 보충·일반 문장부호·원화·화살표·빼기·비교 기호·
#: 기하 도형(■□▲▼●). 글괴에 없는 코드포인트는 서브셋터가 그냥 건너뛴다.
GEIST_RANGES = (
    "0020-007E", "00A0-00FF", "2010-2027", "2030-205E", "20A9", "2190-2199",
    "2212", "2260-2265", "25A0-25A1", "25B2-25BC", "25CF",
)
#: CSS 의 unicode-range 는 위 범위에서 그대로 만든다 — 파일과 선언이 어긋나지 않게.
GEIST_UNICODE_RANGE = ", ".join(f"U+{r}" for r in GEIST_RANGES)

# --- fonts.css 템플릿 -----------------------------------------------------------

HEADER = """\
/* ============================================================================
 * 번들 글꼴. 설치본은 오프라인이라 CDN 을 쓰지 않는다. 파일은 web/public/fonts/.
 *
 * 1. 'Pretendard Fallback' — 글꼴 파일이 아니다. Windows 의 Malgun Gothic 을
 *    Pretendard 의 글자 폭·행높이에 맞춘 local() 선언. 글꼴이 내려오기 전에 그려진
 *    줄이 교체 뒤에도 같은 자리에서 끊어지게 한다(레이아웃 이동 방지).
 * 2. Geist Mono 1.7.2 — 숫자·연도·순위·코드. SIL OFL 1.1 (geist-mono-1.7.2/OFL.txt)
 *    가변 축(wght 100–900)을 그대로 둔 채 라틴·숫자·문장부호·화살표·기호 범위만 남긴
 *    파일 하나다. 한글은 없고 원본에 없는 ₩·■·□ 도 빠져 있다 — 모노를 명시적으로
 *    건 자리에만 쓰이고, 없는 글자는 Pretendard 로 떨어진다.
 * 3. Pretendard Variable 1.3.9 — 한글·본문·UI. SIL OFL 1.1 (pretendard-1.3.9/OFL.txt)
 *    패키지의 동적 서브셋 92조각과 CSS 를 그대로 쓰고 경로만 바꿨다. 브라우저가
 *    화면에 실제로 쓰인 글자가 든 조각만 내려받는다(이 앱 기준 약 25조각).
 *
 * 이 파일은 scripts/build_fonts.py 가 생성한다. 손으로 고치지 말 것 —
 * manifest.json 과 어긋나면 tests/contract/test_fonts_bundle.py 가 잡는다.
 * ========================================================================== */

/* --- Pretendard Fallback (Malgun Gothic, 메트릭 보정) ------------------------- */
@font-face {
  font-family: 'Pretendard Fallback';
  src: local('Malgun Gothic'), local('MalgunGothic');
  size-adjust: 86.4%;
  ascent-override: 110.2%;
  descent-override: 27.9%;
  line-gap-override: 0%;
}

/* --- Geist Mono (숫자·연도·순위·코드 전용, 라틴만) -------------------------- */
@font-face {
  font-family: 'Geist Mono';
  font-style: normal;
  font-display: swap;
  font-weight: 100 900;
  src: url(/fonts/__GEIST_DIR__/__GEIST_FILE__) format('woff2-variations');
  unicode-range: __GEIST_UNICODE_RANGE__;
}

/* --- Pretendard Variable ----------------------------------------------------- */
""".replace("__GEIST_DIR__", GEIST_DIR).replace("__GEIST_FILE__", GEIST_FILE).replace(
    "__GEIST_UNICODE_RANGE__", GEIST_UNICODE_RANGE
)


# --- 공용 -------------------------------------------------------------------------


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def download(url: str, dest: Path, expected_sha256: str | None) -> None:
    print(f"내려받기  {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "hoseo-research-web build_fonts"})
    with urllib.request.urlopen(req, timeout=120) as res, dest.open("wb") as out:
        shutil.copyfileobj(res, out)
    if expected_sha256 is not None:
        got = sha256(dest)
        if got != expected_sha256:
            sys.exit(
                f"입력이 바뀌었다: {dest.name}\n  기대 {expected_sha256}\n  실제 {got}\n"
                "상류를 확인하고 의도한 변경이면 이 스크립트의 sha256 상수를 갱신한다."
            )


def write_text(path: Path, text: str) -> None:
    # 줄바꿈을 LF 로 고정한다 — Windows 와 Linux 에서 돌려도 manifest 가 같아야 한다.
    with path.open("w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def parse_ranges(ranges: tuple[str, ...]) -> list[int]:
    out: list[int] = []
    for r in ranges:
        lo, _, hi = r.partition("-")
        out.extend(range(int(lo, 16), int(hi or lo, 16) + 1))
    return out


def relative_files(root: Path) -> set[str]:
    return {p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file()}


# --- 만들기 -------------------------------------------------------------------------


def build_geist_mono(variable_ttf: Path, out: Path) -> None:
    """가변 글꼴을 인스턴스화하지 않고(wght 축 유지) 라틴 범위만 남겨 woff2 로 저장한다."""
    try:
        import brotli  # noqa: F401  (woff2 압축)
        from fontTools import subset
        from fontTools.ttLib import TTFont
    except ImportError as e:  # pragma: no cover - 환경 안내
        sys.exit(f"{e}\nwoff2 를 만들려면 brotli 가 필요하다:  uv pip install brotli")

    # recalcTimestamp=False — head.modified 를 다시 찍으면 돌릴 때마다 바이트가 달라져
    # manifest 가 흔들린다. 서브셋 결과는 입력이 같으면 같아야 한다.
    font = TTFont(variable_ttf, recalcTimestamp=False)

    options = subset.Options()
    options.layout_features = ["*"]   # calt·liga 등 전부 유지
    options.name_IDs = ["*"]          # 저작권·라이선스 name 레코드를 지우지 않는다(OFL)
    options.notdef_outline = True
    options.hinting = False
    options.flavor = "woff2"
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=parse_ranges(GEIST_RANGES))
    subsetter.subset(font)
    font.flavor = "woff2"  # options.flavor 는 TTFont.save() 에 전해지지 않는다
    font.save(out)


def extract_tarball(tgz: Path, into: Path) -> Path:
    # 내려받은 아카이브는 신뢰하지 않는다 — filter="data" 가 경로 탈출을 막는다.
    with tarfile.open(tgz) as tar:
        tar.extractall(into, filter="data")
    pkg = into / "package"
    if not pkg.is_dir():
        sys.exit("타르볼 안에 package/ 가 없다")
    return pkg


def build() -> int:
    with tempfile.TemporaryDirectory(prefix="build_fonts_") as tmp_s:
        tmp = Path(tmp_s)

        tgz = tmp / f"pretendard-{PRETENDARD_VERSION}.tgz"
        download(PRETENDARD_URL, tgz, PRETENDARD_SHA256)
        pkg = extract_tarball(tgz, tmp / "pretendard")

        geist_tgz = tmp / f"geist-{GEIST_VERSION}.tgz"
        download(GEIST_URL, geist_tgz, GEIST_SHA256)
        geist_pkg = extract_tarball(geist_tgz, tmp / "geist")
        geist_ttf = geist_pkg / GEIST_TTF_IN_PKG
        geist_license = geist_pkg / GEIST_LICENSE_IN_PKG
        for required in (geist_ttf, geist_license):
            if not required.is_file():
                sys.exit(f"geist 타르볼에 {required.relative_to(geist_pkg).as_posix()} 가 없다")

        # 산출 폴더를 비우고 다시 만든다 — 지난 실행의 파일이 남아 manifest 에 끼지 않게.
        # "hahmlet-650" 은 전에 쓰던 표제 세리프다. 남아 있으면 manifest 밖 파일로 걸린다.
        for sub in (PRETENDARD_DIR, GEIST_DIR, "hahmlet-650"):
            shutil.rmtree(FONTS / sub, ignore_errors=True)
        pre_dir = FONTS / PRETENDARD_DIR
        geist_dir = FONTS / GEIST_DIR
        pre_dir.mkdir(parents=True)
        geist_dir.mkdir(parents=True)

        # Pretendard: 조각·라이선스·CSS 를 그대로
        pieces = sorted((pkg / "dist/web/variable/woff2-dynamic-subset").glob("*.woff2"))
        if len(pieces) != PRETENDARD_PIECES:
            sys.exit(f"Pretendard 조각 수가 {len(pieces)}개다 (기대 {PRETENDARD_PIECES})")
        for piece in pieces:
            shutil.copyfile(piece, pre_dir / piece.name)
        license_src = next(
            p for p in (pkg / "dist/LICENSE.txt", pkg / "LICENSE.txt", pkg / "LICENSE") if p.is_file()
        )
        shutil.copyfile(license_src, pre_dir / "OFL.txt")
        pre_css = (pkg / "dist/web/variable/pretendardvariable-dynamic-subset.css").read_text("utf-8")
        pre_css = pre_css.replace("\r\n", "\n")
        pre_css = pre_css[pre_css.index("/* [0] */"):].replace(
            "url(./woff2-dynamic-subset/", f"url(/fonts/{PRETENDARD_DIR}/"
        )
        if pre_css.count("font-family: 'Pretendard Variable'") != PRETENDARD_PIECES:
            sys.exit("Pretendard CSS 의 @font-face 수가 조각 수와 다르다")

        # Geist Mono: 가변 축 유지 + 라틴 서브셋 + woff2, 라이선스는 OFL.txt 로
        build_geist_mono(geist_ttf, geist_dir / GEIST_FILE)
        shutil.copyfile(geist_license, geist_dir / "OFL.txt")

        write_text(CSS, HEADER + pre_css.rstrip("\n") + "\n")

    manifest = {
        rel: sha256(FONTS / rel)
        for rel in sorted(relative_files(FONTS) - HAND_WRITTEN)
    }
    write_text(MANIFEST, json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")

    print(f"Pretendard 조각  {len(pieces)}")
    print(f"Geist Mono       {(FONTS / GEIST_DIR / GEIST_FILE).stat().st_size:,} bytes")
    print(f"fonts.css        {CSS.stat().st_size:,} bytes")
    print(f"manifest         {len(manifest)} 항목")
    return 0


# --- 검사 -------------------------------------------------------------------------


def check() -> int:
    problems: list[str] = []
    if not MANIFEST.is_file():
        print("manifest.json 이 없다 — 생성기를 먼저 돌린다")
        return 1
    manifest: dict[str, str] = json.loads(MANIFEST.read_text("utf-8"))

    for rel, digest in manifest.items():
        p = FONTS / rel
        if not p.is_file():
            problems.append(f"manifest 에 있는데 파일이 없다: {rel}")
        elif sha256(p) != digest:
            problems.append(f"내용이 manifest 와 다르다(손으로 고쳤나): {rel}")

    strays = relative_files(FONTS) - set(manifest) - HAND_WRITTEN
    problems.extend(f"manifest 에 없는 파일: {rel}" for rel in sorted(strays))

    if CSS.is_file():
        css = CSS.read_text("utf-8")
        for url in re.findall(r"url\(/fonts/([^)]+)\)", css):
            if not (FONTS / url).is_file():
                problems.append(f"fonts.css 가 없는 파일을 가리킨다: {url}")
        if "font-family: 'Pretendard Fallback'" not in css:
            problems.append("fonts.css 에 Pretendard Fallback 선언이 없다")
        if "font-family: 'Geist Mono'" not in css:
            problems.append("fonts.css 에 Geist Mono 선언이 없다")
        if css.count("font-family: 'Pretendard Variable'") != PRETENDARD_PIECES:
            problems.append("fonts.css 의 Pretendard @font-face 수가 92 가 아니다")
    else:
        problems.append("fonts.css 가 없다")

    for line in problems:
        print(line)
    print("OK" if not problems else f"{len(problems)}건 어긋남")
    return 1 if problems else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="산출물이 manifest 와 같은지만 검사한다")
    args = parser.parse_args(argv)
    return check() if args.check else build()


if __name__ == "__main__":
    sys.exit(main())
