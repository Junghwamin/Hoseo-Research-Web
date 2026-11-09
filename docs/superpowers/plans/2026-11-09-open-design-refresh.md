# open-design 적용 리프레시 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공개 사이트(Vercel)에서 브라우저가 든 OpenAI 키로 GPT 서술을 만들고, 올린 공시 xlsx 를
브라우저에만 더해 분석·Word 까지 되게 하며, 화면·문구·차트·문서를 open-design `tom-modern` 계약
(`DESIGN.md`)으로 바꾼다.

**Architecture:** 서버는 상태를 들지 않는다 — 키는 요청 헤더로, 추가 데이터는 요청 본문 `overlay`
로 오고 요청이 끝나면 사라진다(`core/` 변경 0). 화면은 토큰(`tokens.css`) → 프리미티브(`design/ui`)
→ 도메인 컴포넌트(`components/*`) → 화면 조립(`features/wizard`, `App.tsx`) 순으로 바깥에서 안으로
간다. 의존 방향(features → components → design), 배럴 import, `registry.ts` 단일 정의는 그대로다.

**Tech Stack:** FastAPI + Pydantic v2, pandas, matplotlib(Agg), python-docx, fontTools; React 19,
TypeScript 6(`erasableSyntaxOnly`), Vite 8, Tailwind 4 `@theme`, Vitest 5 + Testing Library +
vitest-axe, Playwright 1.63, Storybook 10.

**Spec:** `docs/superpowers/specs/2026-11-09-open-design-refresh-design.md` (이하 "설계"). 브랜드
계약은 `DESIGN.md`. 실행자는 셋 다 읽는다. **설계 §3 토큰 값과 §6 문구가 이 계획보다 우선한다.**

## Global Constraints

- 색·간격·radius·shadow·글꼴 값은 `web/src/design/tokens.css` 밖에 두지 않는다. 컴포넌트에 hex·
  `rgb()`·Tailwind 기본 글자 크기(`text-sm` 류)·`font-extrabold`/`font-black` 금지(`tokens.test.ts`).
- 다크 토큰 블록 셋(`:root[data-theme='dark']`, `@media (prefers-color-scheme: dark)
  :root:not([data-theme='light'])`)의 **이름과 값이 모두 같아야** 한다.
- 의존 방향 `features → components → design`, `design/` 은 `api/`·`store/`·`features/` 를 모른다,
  배럴(`index.ts`) 경유 import, 단계는 `features/wizard/steps/registry.ts` 한 곳(`architecture.test.ts`).
- 번들 예산(gzip): 초기 JS 200KB · 초기 CSS 20KB · 지연 JS 200KB · 글꼴 CSS 20KB
  (`web/scripts/check-bundle.mjs`). 설정·데이터 패널은 `React.lazy` 로 지연 청크에 둔다.
- 오프라인 설치본: CDN·웹폰트 URL 금지. 글꼴·아이콘은 저장소 안.
- 한글 키는 `core/` 안에서만. 영문 ↔ 한글 번역은 `api/schemas.py` 의 표 한 곳.
- 서버 스키마를 고쳤으면 `.venv/Scripts/python.exe scripts/export_openapi.py && cd web && npm run gen:api`.
  잊으면 `tests/api/test_openapi_drift.py` 가 잡는다.
- 사용자 노출 문장은 합쇼체, 라벨·버튼은 명사형, 느낌표·이모지·금지어(혁신·스마트·AI 기반·원스톱·
  한눈에·손쉽게·최적화·Insight·Dashboard) 없음. 숫자는 API 값만(설계 §6.1).
- 화면 한 장에 `--accent` 는 두 군데까지. 선택된 연도 칩은 잉크 채움이다(설계 §3.3).
- **테스트 계약 변경은 설계 §12 의 허용 목록 안에서만.** testid 43개·role·`data-state`·`aria-current`
  는 손대지 않고, 정규식을 넓히지 않는다. 바꾼 단언은 부록 A 「문구 대조표」에 적는다.
- **커밋·푸시·배포는 하지 않는다**(저장소 규칙). 각 태스크의 "Commit" 자리는 "기록" 이다 — 부록 A 와
  자기 보고에 남긴다. 병렬 실행 중인 에이전트는 **자기 소유 파일 밖을 고치지 않고**, `npm run
  build`·전체 `pytest`·`npm run e2e` 를 돌리지 않는다(`web/dist` 경합, 차트 락). 소유 파일의 테스트와
  `npx tsc -b --noEmit` 만 돌린다. 전체 게이트는 Task 16 에서 한 번에 돈다.
- 검증 명령은 저장소 루트의 `.venv`(Python 3.12)로, 항상 `-X utf8`.

## Review Focus

설계가 말하지 않지만 사람이 반드시 만나는 입력. 각 줄의 테스트를 소유 태스크에 넣었다.

1. **브라우저 키가 있는데 서버에도 키가 있을 때** — 헤더가 이긴다. 사용자가 방금 넣은 키가 쓰여야
   한다. (Task 3 `test_헤더의_키를_서버_키보다_먼저_쓴다`)
2. **같은 해를 두 번 추가** — 두 번째가 첫 번째를 덮고, 목록에는 한 줄만 남는다. 표에 2027년이 두
   줄 보이면 순위가 전부 틀린다. (Task 5 `test_같은_해를_덮어쓰면_값이_바뀐다`, Task 11
   `같은 해를 다시 더하면 바꿔치기한다`)
3. **overlay 를 지운 뒤의 차트** — objectURL 캐시가 옛 그림을 들고 있으면 화면과 Word 가 갈라진다.
   (Task 10 `overlay 가 바뀌면 그린 그림을 전부 버린다`)
4. **localStorage 가 막힌 브라우저(사생활 모드·회사 정책)** — 키와 데이터는 이번 탭에서만 살고,
   앱은 죽지 않는다. (Task 11 `저장소가 예외를 던져도 메모리에서 동작한다`)
5. **overlay 안의 권역 이름 오타·낯선 권역** — 422 와 "지우고 다시 올리세요". 조용히 0개교 권역이
   생기면 권역 평균이 틀린다. (Task 5 `test_경계를_넘는_overlay_는_422`)

---

## 실행 순서와 소유권

병렬로 돌리는 에이전트는 파일 소유권이 겹치지 않는다. 한 단계가 끝나면(게이트) 다음 단계로 간다.

| 단계 | 태스크 | 소유 파일 |
|---|---|---|
| **1 기반** (병렬) | T1 글꼴 | `scripts/build_fonts.py`, `web/public/fonts/**`, `NOTICE`, `tests/contract/test_fonts_bundle.py` |
| | T2 토큰·메타·파비콘 | `web/src/design/tokens.css`, `web/src/design/tokens.test.ts`, `web/index.html`, `web/public/favicon.svg` |
| | T3→T4→T5→T6 서버(한 에이전트가 순서대로) | `api/**`, `tests/api/**`, `web/openapi.json`, `web/src/api/schema.d.ts`(생성) |
| | T7 코어 산출물 | `core/chart_generator.py`, `core/report_builder.py`, `tests/unit/test_report_builder.py`, `tests/unit/test_chart_generator.py` |
| | T8 프리미티브 | `web/src/design/ui/**` |
| **게이트 1** | tsc · vitest(design) · pytest 전체 · OpenAPI 드리프트 | |
| **2 화면** (병렬) | T9 컴포넌트 A | `web/src/components/{AppBar,StepNav,ContextBar,HomeHero,Combobox,YearPicker,CompareGroupPicker}/**` |
| | T10 컴포넌트 B | `web/src/components/{MetricCard,YearTable,CompareTable,YoYPanel,TrendChart,ChartGallery}/**` |
| | T11 api 계층 | `web/src/api/{client.ts,client.test.ts,clientKey.ts,clientKey.test.ts,overlay.ts,overlay.test.ts}` |
| | T12 패널·플래그 | `web/src/components/{SettingsPanel,DataUpdatePanel}/**`, `web/src/features.ts`, `web/src/features.test.ts`, `vercel.json` |
| | T13 마법사·App | `web/src/features/**`, `web/src/App.tsx`, `web/src/store/**`, `web/src/design/tokens.css`(별칭 삭제만), `web/src/design/tokens.test.ts`(별칭 검사 추가만) |
| | T14 e2e | `web/e2e/**` |
| **게이트 2** | tsc · vitest 전체 · build+예산 · Storybook · pytest · Playwright 두 번 | |
| **3 마감** | T15 문서·메모리 | `README.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `scripts/README.md`, 메모리 폴더 |
| | T16 시각 검증·채점·적대 리뷰·수정 루프 | 발견에 따라 |

---

### Task 1: 글꼴 번들 — Geist Mono 추가, Hahmlet 삭제

**Files:**
- Modify: `scripts/build_fonts.py`
- Regenerate: `web/public/fonts/**`(생성기 산출물), `web/public/fonts/CREDITS.md`(손), `NOTICE`
- Test: `tests/contract/test_fonts_bundle.py`

**Interfaces:**
- Produces: `fonts.css` 의 `@font-face { font-family: 'Geist Mono'; font-weight: 100 900; … }`,
  파일 `web/public/fonts/geist-mono-1.7.2/GeistMono-Variable.latin.woff2`, `…/OFL.txt`.
  CSS 글꼴 이름 `'Geist Mono'` 를 T2 토큰이 쓴다. Hahmlet 폴더·선언은 사라진다.

- [ ] **Step 1: 테스트를 새 계약으로 고친다** (`tests/contract/test_fonts_bundle.py`)

```python
def test_두_글꼴과_폴백이_선언돼_있다():
    css = _css()
    assert "font-family: 'Geist Mono'" in css
    assert "font-weight: 100 900;" in css
    assert "Hahmlet" not in css
    assert css.count("font-family: 'Pretendard Variable'") == 92
    assert "font-family: 'Pretendard Fallback'" in css
    assert "size-adjust: 86.4%" in css

def test_OFL_과_CREDITS_가_있다():
    for rel in ("pretendard-1.3.9/OFL.txt", "geist-mono-1.7.2/OFL.txt", "CREDITS.md"):
        assert (FONTS / rel).is_file(), rel

def test_Hahmlet_폴더가_없다():
    assert not (FONTS / "hahmlet-650").exists()
```
모듈 docstring 의 "Hahmlet 650" 도 "Geist Mono 1.7.2" 로. `url(...)` 최소 개수 93 은 그대로(92+1).

- [ ] **Step 2: 실패 확인** — `.venv/Scripts/python.exe -X utf8 -m pytest tests/contract/test_fonts_bundle.py -q` → Geist 단언 3건 FAIL.

- [ ] **Step 3: 생성기 수정** (`scripts/build_fonts.py`)
  - 상수: `GEIST_VERSION = "1.7.2"`, `GEIST_URL = f"https://registry.npmjs.org/geist/-/geist-{GEIST_VERSION}.tgz"`,
    `GEIST_SHA256 = "88cbfaca51646078f3172802643691bb8fe2df15ca4c455b1b101e49b7d469a6"`,
    `GEIST_DIR = f"geist-mono-{GEIST_VERSION}"`, `GEIST_FILE = "GeistMono-Variable.latin.woff2"`,
    `GEIST_RANGES = ("0020-007E", "00A0-00FF", "2010-2027", "2030-205E", "20A9", "2190-2199",
    "2212", "2260-2265", "25A0-25A1", "25B2-25BC", "25CF")`(없는 글자는 서브셋터가 건너뛴다).
  - `build_geist_mono(variable_ttf: Path, out: Path) -> None`: 인스턴스화 없이(가변 축 유지)
    `subset.Subsetter` 로 `parse_ranges(GEIST_RANGES)` 만 남기고 `flavor="woff2"` 저장.
  - `build()`: 타르볼 내려받기(sha256 확인) → `package/dist/fonts/geist-mono/GeistMono-Variable.ttf`
    → 서브셋 → `package/LICENSE.txt` 를 `OFL.txt` 로. `FONTS/"hahmlet-650"` 와 `GEIST_DIR` 를 먼저
    `rmtree`. Hahmlet 상수·`build_hahmlet`·`ksx1001_codepoints`·Hahmlet 다운로드 삭제.
  - `HEADER` 템플릿: Hahmlet 블록 → Geist Mono 블록
    ```css
    /* --- Geist Mono (숫자·연도·순위·코드 전용, 라틴만) -------------------------- */
    @font-face {
      font-family: 'Geist Mono';
      font-style: normal;
      font-display: swap;
      font-weight: 100 900;
      src: url(/fonts/geist-mono-1.7.2/GeistMono-Variable.latin.woff2) format('woff2-variations');
      unicode-range: U+0020-007E, U+00A0-00FF, U+2010-2027, U+2030-205E, U+20A9, U+2190-2199, U+2212, U+2260-2265, U+25A0-25A1, U+25B2-25BC, U+25CF;
    }
    ```
    머리 주석 2번 항목도 Geist Mono 로.
  - `check()`: `"font-family: 'Geist Mono'" not in css` 이면 문제로 보고.

- [ ] **Step 4: 생성** — `.venv/Scripts/python.exe -X utf8 scripts/build_fonts.py` (네트워크). 출력에
  Geist 파일 크기(수십 KB)와 manifest 항목 수(96 = 92 + Pretendard OFL + Geist woff2 + Geist OFL + fonts.css).

- [ ] **Step 5: 출처 문서** — `web/public/fonts/CREDITS.md` 의 Hahmlet 절을 Geist Mono 절로
  (저작권 `Copyright (c) 2023 Vercel, in collaboration with basement.studio`, OFL 1.1, Reserved
  Font Name 없음, 출처 npm `geist@1.7.2` `dist/fonts/geist-mono/GeistMono-Variable.ttf`, 수정:
  fontTools subset 라틴 범위만 + woff2, 용도: 숫자·연도·순위·코드). `NOTICE` 51–53행의 Hahmlet
  항목을 같은 내용으로.

- [ ] **Step 6: 통과 확인** — `.venv/Scripts/python.exe -X utf8 -m pytest tests/contract/test_fonts_bundle.py -q`
  → PASS. `.venv/Scripts/python.exe -X utf8 scripts/build_fonts.py --check` → `OK`.

- [ ] **Step 7: 기록** — 보고에 Geist woff2 바이트 수와 manifest 항목 수를 적는다.

---

### Task 2: 토큰 — `tokens.css` 전면 교체, 메타 태그, 파비콘

**Files:**
- Modify: `web/src/design/tokens.css`, `web/src/design/tokens.test.ts`, `web/index.html`, `web/public/favicon.svg`

**Interfaces:**
- Produces(모든 화면 태스크가 쓴다): 설계 §3.3 의 토큰 이름 전부. 새 이름 —
  `--surface-alt`, `--accent-text`, `--shadow-soft`, `--shadow-hard`, `--grid-line`, `--grid-size`,
  `--text-eyebrow`(+`--line-height`·`--letter-spacing`), `--ease-standard`.
  유지하되 **삭제 예정 별칭**: `--font-serif: var(--font-sans)`, `--shadow-lg: var(--shadow-hard)`
  (T13 이 참조를 없앤 뒤 지운다). `--font-mono`·`--font-numeric` 은 Geist Mono 스택.
  유틸리티: `@utility tabular`(그대로), `@utility eyebrow`(`font-size: var(--text-eyebrow);
  line-height: 1; letter-spacing: 0.08em; font-weight: 600`), `@utility eyebrow-mono`(위 + `font-family:
  var(--font-mono); font-weight: 500`).

- [ ] **Step 1: 테스트 추가·수정** (`tokens.test.ts`)

```ts
it('모서리 토큰이 전부 0px 이다 — tom-modern 의 실루엣', () => {
  for (const name of ['sm', 'md', 'lg', 'xl', 'full'])
    expect(css).toMatch(new RegExp(`--radius-${name}:\\s*0px;`))
})
it('아이브로·격자·그림자 토큰이 있다', () => {
  for (const t of ['--text-eyebrow', '--surface-alt', '--accent-text', '--shadow-soft', '--shadow-hard', '--grid-line', '--grid-size'])
    expect(css, t).toMatch(new RegExp(`${t}:`))
})
it('라이트 --accent 는 흰 바탕에서 3:1 이상(큰 글자), --accent-text 는 4.5:1 이상', () => {
  expect(contrast(blockValue(':root {', '--accent'), blockValue(':root {', '--surface-raised'))).toBeGreaterThanOrEqual(3)
  expect(contrast(blockValue(':root {', '--accent-text'), blockValue(':root {', '--surface-raised'))).toBeGreaterThanOrEqual(4.5)
})
it('body 에 30px 격자가 깔린다', () => {
  expect(css).toMatch(/background-size:\s*var\(--grid-size\)\s+var\(--grid-size\)/)
})
```
"700 이상 굵기를 쓰지 않는다" → 이름 `'800 이상 굵기를 쓰지 않는다 — Pretendard Variable 은 700 까지 번들됐다'`,
정규식 `/\bfont-(extrabold|black)\b/`. 기존 대비 테스트(`--text-muted` raised·sunken ≥4.5, 다크 ≥4.5)는 그대로 둔다.

- [ ] **Step 2: 실패 확인** — `cd web && npx vitest run src/design/tokens.test.ts` → 새 4건 FAIL.

- [ ] **Step 3: `tokens.css` 교체** — 설계 §3.2(타입)·§3.3(색, 라이트/다크 세 블록)·§3.4(모서리 0,
  그림자, 격자)·§3.5(모션) 값을 그대로. 머리 주석을 "방향" 에 맞춰 다시 쓴다(설계 문서 경로 갱신,
  `DESIGN.md` 가 계약임을 적는다). `@layer base` 의 `body` 에 격자 배경, `h1/h2/h3` balance, `p` pretty,
  `:focus-visible` 2px `--focus-ring` 유지. `--chart-matte`·`--chart-aspect-*`·`--appbar-h`(3.5rem)·
  `--contextbar-h`·`--actionbar-h`·`--container-*` 유지.

- [ ] **Step 4: 대비 숫자 확인** — 테스트를 돌려 `--text-muted`(raised·sunken), 다크 `--text-muted`,
  `--accent`, `--accent-text` 가 전부 통과. 미달이면 **값을 어둡게 조정하고 설계 §3.3 표의 값을 같이
  고친다**(둘이 어긋나면 안 된다).

- [ ] **Step 5: 메타·파비콘** — `web/index.html` `<head>` 에
  `<meta name="description" content="대학알리미 전임교원 연구실적 공시자료로 1인당 SCI급·SCOPUS 논문 수와 순위를 전국·권역·비교군 안에서 확인하고 Word 보고서로 내려받는 도구" />`,
  `og:title`(연구실적 분석 포털)·`og:description`(같은 문장)·`og:type`(website),
  `<meta name="theme-color" media="(prefers-color-scheme: light)" content="#fafafa" />` 와 다크 `#131316`.
  `favicon.svg`: 32×32, `rx` 없는 직각 막대 3개 `#ee5400`(5×10 / 5×16 / 5×22, x 5·13·21) + 상승선
  `#27272a`(다크 `#f4f4f5`, `prefers-color-scheme`).

- [ ] **Step 6: 통과 확인** — `npx vitest run src/design src/architecture.test.ts` → PASS.
  `npx tsc -b --noEmit` → 오류 0.

- [ ] **Step 7: 기록** — 보고에 네 대비 값(소수 둘째 자리)을 적는다.

---

### Task 3: 서버 — 브라우저 키(BYOK)

**Files:**
- Modify: `api/routers/report.py`
- Test: `tests/api/test_narrative_and_report.py`

**Interfaces:**
- Produces: 요청 헤더 `X-OpenAI-Key`. `report._client_key(request: Request) -> str | None`(형식 오류
  422), `report._require_api_key(request: Request) -> str`(헤더 → 환경변수 → 503),
  `report._make_client(key: str)`(= `OpenAI(api_key=key, timeout=60, max_retries=1)`),
  `report._scrub(message: str, key: str) -> str`. 503 detail:
  `"OpenAI API 키가 없습니다. 설정에서 키를 넣거나 서버 환경변수 OPENAI_API_KEY 를 설정하세요."`
  422 detail: `"브라우저에 저장된 OpenAI 키 형식이 올바르지 않습니다. 설정에서 다시 넣으세요."`

- [ ] **Step 1: 테스트** — `TestNarrative` 에 추가(기존 `fake_gpt`·`api_key` 픽스처 재사용).

```python
HEADER_KEY = "sk-" + "browser" + "0" * 20

@pytest.fixture
def capture_client(monkeypatch):
    seen: list[str] = []
    monkeypatch.setattr(report, "_make_client", lambda key: (seen.append(key), object())[1])
    return seen

def test_헤더의_키를_서버_키보다_먼저_쓴다(self, client, fake_gpt, api_key, capture_client):
    r = client.post("/api/narrative", json=REQ, headers={"X-OpenAI-Key": HEADER_KEY})
    assert r.status_code == 200, r.text
    assert capture_client == [HEADER_KEY]

def test_헤더_키_형식이_틀리면_422(self, client, fake_gpt, api_key):
    r = client.post("/api/narrative", json=REQ, headers={"X-OpenAI-Key": "abc"})
    assert r.status_code == 422
    assert "형식" in r.json()["detail"]

def test_키가_없으면_503_이고_이유를_말한다(...):   # 기존 — 단언을 새 문구로
    assert "OPENAI_API_KEY" in detail and "설정" in detail

def test_실패_사유에_키가_섞여도_응답에_남지_않는다(self, client, monkeypatch, api_key, capture_client):
    key = "sk-" + "leak" + "0" * 24
    monkeypatch.setattr(gpt, "_call_gpt", lambda c, p: (_ for _ in ()).throw(RuntimeError(f"bad {key}")))
    r = client.post("/api/narrative", json=REQ, headers={"X-OpenAI-Key": key})
    assert r.status_code == 200 and "sk-" not in r.text and r.json()["failed"]

def test_keys_중복은_한_번만_생성한다(self, client, fake_gpt, api_key, capture_client):
    r = client.post("/api/narrative", json={**REQ, "keys": ["trend", "trend"]})
    assert len(fake_gpt) == 1 and set(r.json()["narratives"]) == {"trend"}

def test_클라이언트는_60초_타임아웃_재시도_1회(monkeypatch):
    import openai; seen = {}
    monkeypatch.setattr(openai, "OpenAI", lambda **kw: seen.update(kw) or object())
    report._make_client("sk-" + "x" * 30)
    assert seen["timeout"] == 60 and seen["max_retries"] == 1
```
`report` 는 **모듈 레벨에서** `from api.routers import report` (드리프트 테스트의 재import 세대 문제).

- [ ] **Step 2: 실패 확인** — `.venv/Scripts/python.exe -X utf8 -m pytest tests/api/test_narrative_and_report.py -q -k "헤더 or 키가_없으면 or 섞여도 or 중복 or 타임아웃"` → FAIL.

추가 테스트(Task 4 의 스위치와 짝):
```python
def test_FORCE_READONLY_면_서버_키를_무시하고_헤더만_본다(self, client, fake_gpt, api_key, monkeypatch, capture_client):
    monkeypatch.setenv("HOSEO_FORCE_READONLY", "1")
    assert client.post("/api/narrative", json=REQ).status_code == 503
    assert client.post("/api/narrative", json=REQ, headers={"X-OpenAI-Key": HEADER_KEY}).status_code == 200
```

- [ ] **Step 3: 구현** — `post_narrative(req, request: Request)`. `_client_key` 는 정규식
  `^sk-[\x21-\x7e]{17,197}$`. `_require_api_key` 는 헤더 우선이고, `preprocess_service.forced_readonly()`
  (Task 4 — 같은 에이전트가 먼저 만들어도 된다)가 참이면 환경변수 키를 보지 않는다. `keys` 는 순서 유지 중복 제거
  (`dict.fromkeys`). `failed[key] = _scrub(f"{type(e).__name__}: {e}"[:200], api_key)` — `_scrub` 은
  키 전체와 앞 12자 이상 부분 문자열을 `sk-…` 로 바꾼다. `_make_client` 는 함수 안에서 `from openai
  import OpenAI`. 키를 로그에 남기지 않는다(print/logging 금지).

- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS. 파일 전체 `pytest tests/api/test_narrative_and_report.py -q` → PASS.

- [ ] **Step 5: 기록** — 부록 A 에 503 문구 행.

---

### Task 4: 서버 — 읽기 전용 강제 스위치

**Files:**
- Modify: `api/preprocess_service.py`, `api/routers/settings.py`
- Test: `tests/api/test_settings_and_lists.py`, `tests/api/test_preprocess_upload.py`

**Interfaces:**
- Produces: `preprocess_service.forced_readonly() -> bool`(환경변수 `HOSEO_FORCE_READONLY` 가
  `1|true|yes`). `settings._can_persist()` 와 `preprocess_service._require_writable()` 이 이것을 먼저
  보고, `settings.get_settings()` 는 참이면 **서버 키가 있어도** `apiKeyConfigured=False`·`apiKeySource=None`·
  `apiKeyHint=None` 을 돌려준다(공개 사이트 모드 재현 — 설계 §7.1·§8.2). T14 의 readonly e2e 와
  T16 의 검증이 이 스위치로 공개 사이트 모드를 재현한다.

- [ ] **Step 1: 테스트**

```python
# test_settings_and_lists.py :: TestSettings
def test_FORCE_READONLY_면_canPersist_가_false(self, client, monkeypatch):
    monkeypatch.setenv("HOSEO_FORCE_READONLY", "1")
    assert client.get("/api/settings").json()["canPersist"] is False

def test_FORCE_READONLY_면_서버_키도_없는_것으로_친다(self, client, monkeypatch):
    monkeypatch.setenv("HOSEO_FORCE_READONLY", "1")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-" + "real" + "0" * 24)
    data = client.get("/api/settings").json()
    assert data["apiKeyConfigured"] is False and data["apiKeyHint"] is None

# test_preprocess_upload.py :: TestReadOnlyDeploy
def test_FORCE_READONLY_면_409(self, client, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path); monkeypatch.setenv("HOSEO_FORCE_READONLY", "1")
    r = _upload(client, "2026년_테스트.xlsx", b"not-a-workbook")
    assert r.status_code == 409 and "읽기 전용" in r.json()["detail"]
```

- [ ] **Step 2: 실패 확인** → FAIL. **Step 3: 구현.** **Step 4: 통과 확인** — 두 파일 `-q` PASS.

---

### Task 5: 서버 — overlay 스키마·병합·엔드포인트·OpenAPI 재생성

**Files:**
- Modify: `api/schemas.py`, `api/deps.py`, `api/analysis.py`, `api/routers/stats.py`,
  `api/routers/report.py`, `api/routers/data.py`, `api/preprocess_service.py`
- Create: `tests/api/test_overlay.py`
- Regenerate: `web/openapi.json`, `web/src/api/schema.d.ts`

**Interfaces:**
- Produces (화면 T11·T12·T13 이 그대로 쓴다):
  ```python
  class OverlayRow(BaseModel):          year: int; name: str; faculty: int; papers: float; perCapita: float; nationalRank: int | None
  class OverlayRegionalRow(OverlayRow): regionName: str; regionalRank: int | None
  class DatasetOverlay(BaseModel):      national: list[OverlayRow]; regional: list[OverlayRegionalRow]
      # 검증: 각 표 ≤ 6000행, 연도 2000–2100, (year,name[,regionName]) 중복 없음, faculty 0–100000,
      # papers 0–1e6, perCapita 0–1000, 순위 1–10000 또는 None, name 1–60자. 어기면 422
      # "추가한 데이터가 올바르지 않습니다. 데이터를 지우고 다시 올리세요."
      def years(self) -> list[int]; def is_empty(self) -> bool; def digest(self) -> str  # sha1(정규화 JSON)[:12]
  OVERLAY_NATIONAL_COLUMNS = {"year": "연도", "name": "학교명", "faculty": "전임교원수",
      "papers": "SCI/SCOPUS논문수", "perCapita": "1인당논문수", "nationalRank": "전국순위"}
  OVERLAY_REGIONAL_COLUMNS = {**OVERLAY_NATIONAL_COLUMNS, "regionName": "권역명", "regionalRank": "권역순위"}
  class DatasetPreviewResponse(BaseModel): year: int; universities: int; sourceFile: str;
                                           national: list[OverlayRow]; regional: list[OverlayRegionalRow]
  class DatasetQuery(BaseModel):     overlay: DatasetOverlay | None = None
  class RegionsQuery(BaseModel):     university: str; overlay: DatasetOverlay | None = None
  class UniversitiesQuery(BaseModel): region: str; year: int; overlay: DatasetOverlay | None = None
  class ChartRequest(BaseModel):     university: str; year: int; regionName: str | None = None;
                                     compareGroup: list[str] | None = None; years: list[int] | None = None;
                                     overlay: DatasetOverlay | None = None
  StatsRequest / NarrativeRequest / ReportRequest  += overlay: DatasetOverlay | None = None
  DatasetInfo  += overlayYears: list[int] = []
  StatsResponse += overlayHash: str | None = None
  ```
  ```python
  deps.get_frames(overlay: DatasetOverlay | None = None) -> tuple[DataFrame, DataFrame]
  deps.overlay_frames(overlay) -> tuple[DataFrame, DataFrame]     # 영문 → 한글 열, dtype 정렬
  deps.merge_overlay(base_national, base_regional, overlay) -> tuple[DataFrame, DataFrame]
  analysis.resolve_scope(university, year, region_name=None, compare_group=None, years=None, overlay=None) -> Scope
  Scope.overlay_hash: str | None
  preprocess_service.preview(name: str, data: bytes) -> dict   # process_in_memory 한 파일, MAX_PREVIEW_BYTES = 4 MiB
  ```
  엔드포인트: `POST /api/dataset/preview`(multipart `file` 하나), `POST /api/data`, `POST /api/regions`,
  `POST /api/universities`, `POST /api/chart/{kind}.png`(JSON `ChartRequest`, PNG 응답, `Cache-Control:
  private, no-store`). GET 들은 그대로.

- [ ] **Step 1: 테스트 파일** `tests/api/test_overlay.py` — `realdata`/`rawdata` 마커, `client`
  픽스처, 기본 프레임에서 overlay 를 만드는 헬퍼:

```python
def _overlay_from_base(year_from: int, year_to: int, scale: float = 1.0) -> dict:
    n, r = deps.get_frames()
    rows_n = n[n["연도"] == year_from].copy(); rows_n["연도"] = year_to; rows_n["1인당논문수"] *= scale
    rows_r = r[r["연도"] == year_from].copy(); rows_r["연도"] = year_to; rows_r["1인당논문수"] *= scale
    return {"national": [schemas.translate(x, INV_N) for x in rows_n.to_dict("records")],
            "regional": [schemas.translate(x, INV_R) for x in rows_r.to_dict("records")]}

class TestPreview:        # @rawdata
    def test_미리보기가_그_해의_행과_순위를_돌려준다(self, client, tmp_path, monkeypatch)   # chdir tmp_path, 최신 Raw xlsx 업로드 → year == 파일명 연도, len(national) > 100, 모든 nationalRank ≥ 1, regional 의 regionName ⊂ 기본 권역 집합, tmp_path 가 비어 있음
    def test_너무_큰_파일은_413(self, client)                                             # 4 MiB + 1 바이트 → 413 또는 400, detail 에 "4MB"
class TestMerge:          # @realdata
    def test_overlay_로_없는_해를_더하면_추이에_그_해가_있다(self, client)                # 2026 → 2027, years=[2026,2027] → trend 에 "2027", 값이 2026 과 같다
    def test_같은_해를_덮어쓰면_값이_바뀐다(self, client)                                 # 2026 → 2026, scale 2 → trend["2026"].perCapita 두 배
    def test_overlay_는_서버_상태에_남지_않는다(self, client)                              # 위 요청 뒤 GET /api/data years 에 2027 없음
    def test_POST_data_가_overlayYears_를_준다(self, client)                              # [2027]; GET 은 []
    def test_POST_regions_universities_가_overlay_를_반영한다(self, client)                # universities(충청권, 2027) 행 수 == 2026 행 수
    def test_report_의_표에_overlay_연도가_있다(self, client)                              # docx document.xml 에 "2027"
    def test_overlay_유무로_차트_PNG_가_다르다(self, client)                              # POST chart with/without → bytes 다름; 같은 overlay 두 번 → 같음
class TestValidation:
    @pytest.mark.parametrize("bad", [...])  # 7000행 / regionName "화성권" / faculty -1 / year 1999 / name 61자
    def test_경계를_넘는_overlay_는_422(self, client, bad)                                 # detail 에 "지우고 다시 올리세요"
```

- [ ] **Step 2: 실패 확인** — `pytest tests/api/test_overlay.py -q` → import/404 로 FAIL.

- [ ] **Step 3: 스키마·병합** — `schemas.py` 모델과 역번역표(`INV_*` 는 테스트가 `{v: k for k, v in
  COMPARE_KEYS.items()}` 식으로 만든다). `deps.merge_overlay`: 기본 프레임에서 overlay 연도 행을 빼고
  overlay 프레임을 붙인 뒤 `["연도","전국순위","학교명"]`/`["연도","권역명","권역순위","학교명"]` 정렬,
  `전임교원수` int·순위는 nullable int(`Int64`)·실수 float. 권역명이 기본 데이터 권역 집합 밖이면
  `HTTPException(422, "추가한 데이터가 올바르지 않습니다. 데이터를 지우고 다시 올리세요.")`.
  `get_frames(None)` 은 지금처럼 캐시 프레임을 돌려준다(캐시에 overlay 결과를 넣지 않는다).

- [ ] **Step 4: 라우터** — `stats.py`: GET 핸들러 본문을 `_dataset_info(national, regional, overlay_years)`,
  `_regions_of(...)`, `_universities_of(...)` 로 빼고 GET/POST 가 함께 쓴다. `/api/stats` 는
  `resolve_scope(..., req.overlay)` 와 `overlayHash=scope.overlay_hash`. `report.py`: narrative·report 에
  `req.overlay`; `_charts_for(..., overlay)` 의 캐시 키 끝에 `scope.overlay_hash`; `POST /api/chart/{kind}.png`.
  `data.py`: `POST /api/dataset/preview` → `svc.safe_name` → `svc.preview`. `preprocess_service.preview`:
  크기 상한(413, "파일이 4MB 를 넘습니다. 공시 xlsx 원본은 보통 1–3MB 입니다.") → `pp.process_in_memory
  ({name: data})` → 한글 → 영문 번역 → 연도는 파일명의 것 하나여야 한다(아니면 400).
  예외는 `/api/preprocess` 와 같은 400 문구.

- [ ] **Step 5: 통과 확인** — `pytest tests/api/test_overlay.py tests/api/test_data_and_stats.py tests/api/test_narrative_and_report.py tests/api/test_year_selection.py -q` → PASS.

- [ ] **Step 6: OpenAPI 재생성** — `.venv/Scripts/python.exe scripts/export_openapi.py && cd web && npm run gen:api`.
  `pytest tests/api/test_openapi_drift.py -q` → PASS(Vite 개발 서버가 떠 있으면 안 된다).

- [ ] **Step 7: 기록** — 보고에 새 스키마 이름 목록과 `schema.d.ts` 에 생성된 타입 이름.

---

### Task 6: 서버 — `detail` 문구 합쇼체

**Files:**
- Modify: `api/deps.py`, `api/routers/stats.py`, `api/routers/report.py`, `api/routers/settings.py`,
  `api/preprocess_service.py`, `api/schemas.py`
- Test: `tests/api/test_data_and_stats.py`(211행 `"비교군을 구성할 수 없다"` → `"비교군을 구성할 수 없습니다"`), 나머지는 부분 일치라 그대로

- [ ] **Step 1:** 설계 §6.2 「서버 detail」 표대로 바꾼다. 한 줄 규칙: 종결을 `…입니다/…없습니다/
  …하세요/…합니다` 로, "할 것" → "하세요", "가능:" → "가능한 연도:"/"가능한 권역:". 핵심어
  (`읽기 전용`, `OPENAI_API_KEY`, `등재된 사립 {N}개교 기준`, `xlsx`, `연도`, `기준 연도`, `있는 연도`)는
  남긴다. `nationalRankScopeNote` 는 `"전국순위는 대학알리미에 등재된 사립 {count}개교 기준입니다.
  국공립대·과기원은 집계에 포함되지 않습니다."`.
- [ ] **Step 2:** `pytest tests/api -q` → 실패한 것이 **문구 단언뿐인지** 확인하고 그 단언만 새 문구로.
- [ ] **Step 3:** 전체 `pytest tests/api tests/unit -q` PASS. 부록 A 에 바꾼 서버 문구 전부.

---

### Task 7: 코어 산출물 — 차트 팔레트·Word 스타일

**Files:**
- Modify: `core/chart_generator.py`, `core/report_builder.py`
- Test: `tests/unit/test_report_builder.py`, `tests/unit/test_chart_generator.py`

**Interfaces:**
- Produces: `chart_generator.COLOR_HOSEO = "#EE5400"`, `COLOR_OTHERS = "#D4D4D8"`, `COLOR_NATIONAL =
  "#52525B"`, `COLOR_REGIONAL = "#71717A"`, `COLOR_COMPARE = "#A1A1AA"`, 새 상수 `COLOR_INK = "#27272A"`,
  `COLOR_GRID = "#E4E4E7"`, `COLOR_SPINE = "#A1A1AA"`. `report_builder.FILL_HEADER = "27272A"`,
  `FILL_ZEBRA = "F4F4F5"`, `FILL_TARGET = "FFE8DC"`, `COLOR_ACCENT = "EE5400"`, `COLOR_INK = "27272A"`.

- [ ] **Step 1: Word 테스트 갱신** — `test_doc_u07_trend_table_shading_and_formats`: 헤더 `["27272A"]*6`,
  행 `["27272A", "F4F4F5", "FFFFFF"]`; `…highlights_target_university`: `["27272A", "FFE8DC", "FFFFFF", "F4F4F5"]`;
  `…highlight_follows_university_argument`: `["27272A", "F4F4F5", "FFFFFF", "FFE8DC"]`. 추가:

```python
def test_doc_u08_section_heading_has_accent_rule(fixed_date):
    document = _reopen(_build())
    p = next(p for p in document.paragraphs if p.text.startswith("1. "))
    bottom = p._p.pPr.find(qn("w:pBdr")).find(qn("w:bottom"))
    assert bottom.get(qn("w:color")) == "EE5400"

def test_doc_u08_cover_title_is_ink_not_blue(fixed_date):
    document = _reopen(_build())
    run = next(p for p in document.paragraphs if p.text == rb.REPORT_TITLE).runs[0]
    assert str(run.font.color.rgb) == "27272A"
```

- [ ] **Step 2: 차트 테스트 추가** (`test_chart_generator.py`)

```python
def test_vis_u08_target_bar_is_accent_without_hatch(monkeypatch):
    # create_comparison_bar 의 패치에서 호서 막대의 facecolor 가 #EE5400 이고 hatch 가 None
```
기존 `test_vis_u04_*`(제목 문자열)·`test_vis_u05`(figsize·subplots) 는 **그대로 통과해야** 한다.

- [ ] **Step 3: 실패 확인** → 갱신한 단언 FAIL. **Step 4: 구현** — 설계 §9. `_add_heading` 에
  `w:pBdr/w:bottom`(`w:val=single w:sz=6 w:space=1 w:color=EE5400`), 표지 대학명 16pt `COLOR_INK`,
  제목 20pt `COLOR_INK`, 둘 사이에 주홍 밑선 단락. 차트: 해치 제거, 대상 막대 `edgecolor=COLOR_INK
  linewidth=1.5`, 대상 x 눈금 라벨 bold, 격자 실선 0.6, 범례 `frameon=False`.
- [ ] **Step 5: 통과 확인** — `pytest tests/unit/test_report_builder.py tests/unit/test_chart_generator.py -q` → PASS.
  PNG 한 장을 `scratchpad/shots/chart-compare.png` 로 저장해 눈으로 본다.

---

### Task 8: 프리미티브 — `design/ui`

**Files:**
- Modify: `web/src/design/ui/{Button,Card,Field,Modal,Pending,Icon,index}.tsx`, `Icon.test.tsx`, `Modal.test.tsx`
- Create: `web/src/design/ui/Button.test.tsx`, `web/src/design/ui/Card.test.tsx`

**Interfaces:**
- Produces: `CardProps.variant?: 'frame' | 'panel' | 'plain'`(기본 `'frame'`, `data-variant` 속성),
  `IconName` 에 `'plus' | 'x' | 'upload' | 'key'` 추가(lucide-static 획 복사, `ICON_NAMES` 14개),
  `Field` 라벨이 `eyebrow` 유틸리티, `CONTROL_CLASS` 높이 `h-[2.75rem]`. Button/Modal/Pending 의
  props 는 그대로.

- [ ] **Step 1: 테스트**

```ts
// Button.test.tsx
it('비활성은 투명도가 아니라 채움으로 표현한다', () => { render(<Button disabled>저장</Button>); expect(screen.getByRole('button').className).not.toMatch(/opacity/) })
it('직각이다 — radius-full 을 쓰지 않는다', () => { expect(screen.getByRole('button').className).not.toMatch(/radius-full/) })
// Card.test.tsx
it('기본은 frame, panel 은 data-variant 로 드러난다', () => { … expect(section).toHaveAttribute('data-variant', 'panel') })
// Icon.test.tsx: ICON_NAMES 길이 14, 새 이름 4개 렌더
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/design/ui` → FAIL. **Step 3: 구현** — 설계 §5 Button/
  Field/Card/Modal/Pending 행. Button: `rounded-none`(토큰 0 이라도 클래스에 `radius-full` 을 남기지
  않는다), `hover:enabled:shadow-[var(--shadow-hard)] hover:enabled:-translate-x-px
  hover:enabled:-translate-y-px active:enabled:translate-x-px active:enabled:translate-y-px
  active:enabled:shadow-none`, `disabled:bg-[var(--surface-sunken)] disabled:text-[var(--text-muted)]
  disabled:border-[var(--border-subtle)]`, 라벨 `text-body font-semibold tracking-[0.02em]`.
  Card: `variant='panel'` → `border-t-4 border-t-[var(--accent)]` + `shadow-[var(--shadow-soft)]`;
  `plain` → 선·그림자 없음. Modal: `shadow-[var(--shadow-hard)]`, 닫기 `variant="secondary"`.
- [ ] **Step 4: 통과 확인** — `npx vitest run src/design src/architecture.test.ts` PASS, `npx tsc -b --noEmit` 0.

---

### 게이트 1 (조율자)

`cd web && npx tsc -b --noEmit && npx vitest run src/design src/architecture.test.ts src/features.test.ts`
→ `.venv/Scripts/python.exe -X utf8 -m pytest -q`(전체; Vite 꺼진 상태) → 기록: pytest 수치, 드리프트 통과.

---

### Task 9: 컴포넌트 A — 셸·입력류

**Files:**
- Modify: `web/src/components/{AppBar,StepNav,ContextBar,HomeHero,Combobox,YearPicker,CompareGroupPicker}/**`
- Create: `web/src/components/HomeHero/DataPanel.tsx`, `DataPanel.test.tsx`

**Interfaces:**
- Consumes: T2 토큰·유틸리티(`eyebrow`, `eyebrow-mono`, `tabular`), T8 `Card variant`, `Icon` 새 이름.
- Produces:
  ```ts
  export interface HomeHeroProps {
    readonly dataset: DatasetInfo | null
    readonly datasetError?: string | null        // 패널 오류 상태
    readonly onRetry?: () => void                // 패널 「다시 시도」
    readonly onStart: () => void
  }
  // DataPanel(내부): data-testid="data-panel"; 항목 "개교"(universityCount) · "개년"(years.length) ·
  // "권역"(regions.length) · "최신 공시"(max year); 각주 nationalRankScopeNote 원문;
  // dataset.overlayYears.length > 0 이면 <p data-testid="overlay-note">추가 데이터 {years.join('·')}년 · 이 브라우저</p>
  // dataset null → Pending, datasetError → role=alert + 「다시 시도」
  ```
  `StepNav`·`ContextBar`·`AppBar`·`Combobox`·`YearPicker`·`CompareGroupPicker` 의 props 는 그대로.

- [ ] **Step 1: 테스트 갱신·추가** — StepNav(`/이전 단계를 먼저 마치세요/`), Combobox(status 문구
  5종: `{N}개교 중에서 고를 수 있습니다`, `{N}개교 중 {M}개 일치`, `일치하는 대학이 없습니다. 철자를 확인해
  주세요`, `고를 수 있는 대학이 없습니다`, `목록을 불러오는 중…`; `not.toHaveTextContent('없습니다.')` 로
  "치기 전에 없다고 하지 않는다" 유지), CompareGroupPicker(`/비교할 다른 대학이 없습니다/`,
  `서버 기본 비교군 · 충청권 상위권`), HomeHero(기존 유지 + `서버 문장` 단언은 새 합쇼체 원문으로),
  DataPanel 새 테스트:

```ts
it('자료 현황 숫자는 전부 dataset 에서 온다', () => { render(<DataPanel dataset={makeDataset()} />); expect(screen.getByTestId('data-panel')).toHaveTextContent('133'); … '2026' })
it('추가 데이터가 있으면 그 해를 말한다', () => { …overlayYears:[2027]… expect(screen.getByTestId('overlay-note')).toHaveTextContent('2027년') })
it('아직 없으면 스켈레톤, 실패하면 다시 시도', …)
it('h1 의 접근성 이름은 강조 span 과 무관하게 「우리 대학은 몇 번째인가」다', …)
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/components/{AppBar,StepNav,ContextBar,HomeHero,Combobox,YearPicker,CompareGroupPicker}`.
- [ ] **Step 3: 구현** — 설계 §4·§5·§6.2. 히어로 2열(`lg:grid-cols-[0.92fr_1.08fr] lg:gap-[2.625rem]`),
  h1 안 `<span className="text-[var(--accent)]">몇 번째</span>`, `hero-static` 은 패널 뒤 `aria-hidden`
  격자 장식(`absolute`), 자료 범위 `<ul aria-label="자료 범위">` 유지(`출처 …` / `공시 {f}–{l}년` /
  `매년 8월 공시 반영`). StepNav 번호 `String(step).padStart(2,'0')` 모노, 휴대폰 요약
  `${String(current).padStart(2,'0')} / 0${STEPS.length} · ${label}`(한 텍스트 노드). YearPicker 선택 칩
  `bg-[var(--action-bg)] text-[var(--text-on-action)]`, 기준 연도 `■`. Combobox 드롭다운
  `shadow-[var(--shadow-hard)]`, 활성 `bg-[var(--surface-sunken)]`. AppBar `bg-[color-mix(in_srgb,var(--surface-base)_92%,transparent)] backdrop-blur-[8px]`
  — hex 가 아니므로 토큰 테스트에 걸리지 않는다. 문구는 전부 부록 A.
- [ ] **Step 4: 통과 확인** — 위 테스트 PASS, `npx tsc -b --noEmit`(자기 파일 오류 0).

---

### Task 10: 컴포넌트 B — 데이터 표시

**Files:**
- Modify: `web/src/components/{MetricCard,YearTable,CompareTable,YoYPanel,TrendChart,ChartGallery}/**`
- Create: `web/src/components/ChartGallery/useChartImage.ts`, `useChartImage.test.ts`

**Interfaces:**
- Consumes: T11 `api.chartBlob(kind, params): Promise<Blob>`(T11 과 동시에 진행하므로 테스트에서는
  `fetch` 를 모킹한다 — `api.chartBlob` 은 `POST /api/chart/{kind}.png` JSON 본문을 보내고 `Blob` 을 돌려준다).
  **params 의 타입은 이미 있는 `Parameters<typeof chartUrl>[1]`**(`api/client.ts` 의 `chartUrl` 두 번째
  인자)이다 — T10·T11 이 같은 타입을 쓰므로 새 이름을 만들지 않는다. T11 이 끝나기 전에는 `fetch` 를
  직접 호출하지 말고 `api.chartBlob` 이 있다고 가정해 작성하되, tsc 가 그 이름을 못 찾으면 **같은 시그니처의
  얇은 로컬 함수로 임시 대체하고 보고에 적는다**(조율자가 T11 뒤에 합친다).
- Produces:
  ```ts
  export interface ChartGalleryProps { …기존…; readonly overlayKey?: string | null }   // null/undefined → GET <img src>
  export function useChartImage(kind: ChartKind, params: ChartParams, overlayKey: string | null): { src: string | null; status: 'loading'|'ready'|'error'; retry(): void }
  export function revokeChartImages(): void   // 모듈 Map 비우고 URL.revokeObjectURL 전부
  ```

- [ ] **Step 1: 테스트** — 빈 상태 문구 3곳(`표시할 연도가 없습니다.`, `/표시할 데이터가 없습니다/`,
  `/전년도 자료가 없습니다/`), ChartGallery 오류 문구 `보고서에서도 빠집니다`. 새:

```ts
// useChartImage.test.ts
it('overlayKey 가 있으면 POST 로 받아 blob: 주소를 만든다', async () => { stub URL.createObjectURL → 'blob:1'; fetch → png Blob; expect(fetch).toHaveBeenCalledWith('/api/chart/rank.png', expect.objectContaining({ method: 'POST' })); expect(result.current.src).toBe('blob:1') })
it('같은 키로 두 번 그리면 한 번만 받는다', …)
it('overlay 가 바뀌면 그린 그림을 전부 버린다', () => { revokeChartImages(); expect(URL.revokeObjectURL).toHaveBeenCalledTimes(n) })
it('overlayKey 가 없으면 fetch 하지 않고 GET 주소를 쓴다', …)   // 기존 ChartGallery 테스트가 이 경로다
```

- [ ] **Step 2: 실패 확인.** **Step 3: 구현** — 설계 §5. MetricCard 값 `font-[family-name:var(--font-numeric)]`
  + `text-kpi font-bold` / `text-kpi-sub font-medium`; 라벨 `eyebrow`. 표: 머리글 `eyebrow`, 강조 행
  `border-l-[3px] border-l-[var(--accent)] bg-[var(--accent-soft)]`. ChartGallery 캡션
  `<span className="eyebrow-mono">0{n}</span> {title}`. TrendChart `EMPHASIS_STROKE = 'var(--accent)'`,
  `MUTED_STROKES = ['var(--text-secondary)', 'var(--text-muted)', 'var(--border-strong)']`.
- [ ] **Step 4: 통과 확인** — 소유 폴더 테스트 PASS, tsc 0.

---

### Task 11: api 계층 — 요청 맥락(overlay·브라우저 키)

**Files:**
- Modify: `web/src/api/client.ts`, `web/src/api/client.test.ts`
- Create: `web/src/api/overlay.ts`, `overlay.test.ts`, `web/src/api/clientKey.ts`, `clientKey.test.ts`

**Interfaces:**
- Consumes: T5 가 생성한 `schema.d.ts` 타입(`DatasetOverlay`, `DatasetPreviewResponse`, `ChartRequest`,
  `DatasetQuery`, …).
- Produces:
  ```ts
  // overlay.ts
  export const OVERLAY_STORAGE_KEY = 'hoseo-dataset-overlay'; export const OVERLAY_MAX_BYTES = 2 * 1024 * 1024
  export interface OverlayItem { readonly year: number; readonly universities: number; readonly sourceFile: string; readonly addedAt: string }
  export interface OverlayState { readonly items: readonly OverlayItem[]; readonly national: readonly OverlayRow[]; readonly regional: readonly OverlayRegionalRow[] }
  export function getOverlay(): OverlayState | null
  export function overlayPayload(): DatasetOverlay | null          // 비어 있으면 null
  export function overlayKey(): string | null                      // items 의 `${year}@${addedAt}` 을 이은 문자열; 비어 있으면 null
  export function addOverlayYear(preview: DatasetPreviewResponse, addedAt: string): void   // 같은 year 교체
  export function removeOverlayYear(year: number): void
  export function clearOverlay(): void
  export function useOverlay(): OverlayState | null                // useSyncExternalStore
  // clientKey.ts
  export const CLIENT_KEY_STORAGE_KEY = 'hoseo-openai-key'
  export function getClientKey(): string | null; export function setClientKey(key: string): void; export function clearClientKey(): void
  export function useClientKey(): string | null
  export function maskKey(key: string): string                     // 'sk-ab…7f2c' (앞 5·뒤 4)
  export function validateKeyFormat(key: string): string | null    // 오류 문구 또는 null: 'sk- 로 시작해야 합니다' | '키가 너무 짧습니다' | '공백이나 한글이 섞여 있습니다'
  // client.ts
  api.dataset()                    // overlayPayload() ? POST /api/data : GET /api/data
  api.regions(u) / api.universities(r, y)   // 같은 규칙
  api.stats / api.narrative / api.report    // 본문에 overlay 동봉; narrative 는 getClientKey() 가 있으면 headers['X-OpenAI-Key']
  api.datasetPreview(file: File): Promise<DatasetPreviewResponse>   // multipart 'file', 헤더 미지정
  api.chartBlob(kind: ChartKind, params: Parameters<typeof chartUrl>[1]): Promise<Blob> // POST /api/chart/{kind}.png — dataVersion 은 본문에 싣지 않는다
  ```
  저장소 접근은 전부 try/catch — 예외면 메모리 값으로 동작(Review Focus 4).
  `errorDetail` 의 세 문구(413·504·기타)도 설계 §6.2 의 새 문구로 바꾼다(`client.test.ts` 의 해당 단언 갱신).

- [ ] **Step 1: 테스트** — `overlay.test.ts`: 추가·같은 해 교체·제거·모두 지우기·새로고침 복원
  (`localStorage` 에 JSON)·2MB 상한 거절(`throws /2MB/`)·손상 JSON 무시·저장소 예외 시 메모리 동작.
  `clientKey.test.ts`: 저장·마스킹·형식 검사 3종·예외 흡수. `client.test.ts` 추가: overlay 없으면 GET,
  있으면 POST 본문에 `overlay`; narrative 헤더; `datasetPreview` 가 `FormData` 와 헤더 미지정;
  `chartBlob` 이 POST.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/api`. **Step 3: 구현.** **Step 4: 통과 확인** — PASS, tsc 0.

---

### Task 12: 패널 — 설정 3모드, 데이터 2모드, 플래그, Vercel 빌드 명령

**Files:**
- Modify: `web/src/components/SettingsPanel/**`, `web/src/components/DataUpdatePanel/**`,
  `web/src/features.ts`, `web/src/features.test.ts`, `vercel.json`

**Interfaces:**
- Consumes: T11 `clientKey`·`overlay`·`api.datasetPreview`.
- Produces:
  ```ts
  export interface SettingsPanelProps { readonly onClose: () => void; readonly onSaved?: (next: SettingsResponse) => void }  // 그대로
  // 모드 = settings.canPersist ? 'persist' : 'browser' (설계 §7.1·§14a — 서버 키 유무는 모드를 바꾸지 않는다); <dl data-testid="settings-status" data-mode=…>
  // persist: 상태 표(설정됨/설정되지 않음 · 출처 환경변수|.env 파일 · 힌트) + api-key-input · api-key-save (지금 그대로)
  // browser: client-key-status(role=status: '이 브라우저에 저장된 키 · sk-…abcd' | '저장된 키가 없습니다'; 서버 키가 있으면 '서버에 키가 설정돼 있습니다 · 브라우저 키가 있으면 그것을 먼저 씁니다' 한 줄 추가)
  //          + client-key-input(password, autoComplete off, font-mono) · client-key-save · client-key-clear
  //          onSaved 는 브라우저 키를 저장·삭제했을 때도 현재 settings 로 부른다(4단계가 다시 계산하도록)
  export type DataUpdateMode = 'persist' | 'browser'
  export interface DataUpdatePanelProps { readonly mode: DataUpdateMode; readonly onUpdated: (result?: PreprocessResponse | DatasetPreviewResponse) => void; readonly onClose: () => void }
  // browser 모드 testid: raw-file-input(공용) · overlay-add-button · overlay-progress(role=status) · overlay-result(role=status) · overlay-error(role=alert) · overlay-items · overlay-remove-{year} · overlay-clear
  export const FEATURES = { research: true, educationCost: false, employment: false, settings: true, dataUpdate: true } as const
  ```

- [ ] **Step 1: 테스트** — SettingsPanel: 기존 `저장했다` → `저장했습니다`; "쓸 수 없는 배포" 테스트 →
  `브라우저 키 폼을 보이고 localStorage 에 저장한다`(저장 후 `client-key-status` 에 `sk-ab…`), `지우기`,
  `형식이 틀리면 보내지 않고 인라인으로 말한다`, `공개 배포에서 서버에 키가 있어도 브라우저 키 폼을 보인다`
  (`canPersist:false, apiKeyConfigured:true` → `client-key-input` 존재 + "먼저 씁니다" 문구). DataUpdatePanel:
  `연도가 없다` → `연도가 없습니다`, `/끌어다 놓거나 눌러서 고르세요/`; browser 모드:
  `파일마다 미리보기를 받아 그 해를 더한다`(fetch 가 `/api/dataset/preview` 로 파일 수만큼, 결과
  `2027년 133개교 추가됨`, `onUpdated` 호출), `제거하면 목록과 저장소에서 빠진다`, `실패해도 고른 파일은
  남는다`. `features.test.ts`: 읽기 전용 블록 → `배포 종류와 무관하게 설정·데이터 메뉴가 켜져 있다`.
- [ ] **Step 2: 실패 확인.** **Step 3: 구현** — 설계 §7.2·§8.3·§6.2. `vercel.json` buildCommand
  `"cd web && npm ci && npm run build"`. `features.ts` 의 `READONLY_DEPLOY` 와 주석 삭제.
- [ ] **Step 4: 통과 확인** — 소유 테스트 PASS, tsc 0.

---

### Task 13: 마법사·App — 화면 조립, 문구, 지연 로드, 별칭 정리

**Files:**
- Modify: `web/src/features/wizard/**`(WizardShell, hooks, steps/registry, Step1–5, tests, stats.fixture),
  `web/src/App.tsx`, `web/src/store/types.ts`(변경 없음 예상), `web/src/design/tokens.css`(별칭 삭제),
  `web/src/design/tokens.test.ts`(별칭 부재 검사 추가)

**Interfaces:**
- Consumes: T9 `HomeHeroProps`, T10 `ChartGalleryProps.overlayKey`, T11 `useOverlay`·`overlayKey`·
  `useClientKey`·`api`, T12 `DataUpdatePanelProps.mode`·`SettingsPanel`.
- Produces: `App` 이 `useSettings()` 로 모드를 정해 `DataUpdatePanel mode` 를 넘기고, 두 패널을
  `React.lazy` + `Suspense fallback={<Pending />}` 로 그린다. `useDataset(version)` 은 `api.dataset()`
  (overlay 자동). `Step4Narrative` 의 `keyMissing = settings.data ? !settings.data.apiKeyConfigured &&
  !clientKey : false`, 모드별 임베드, 일괄 생성은 `Promise.allSettled(empty.map(k => api.narrative({...,
  keys: [k]})))`.

- [ ] **Step 1: 테스트** — Step4: 네 경우(`서버 키 있음`: 안내 없음 / `키 없음·persist`: `api-key-input`
  임베드 / `키 없음·browser`: `client-key-input` 임베드 + `/이 브라우저에만 저장/` / `브라우저 키 있음`:
  안내 없음 — `setClientKey` 로 심는다), `일괄 생성은 비어 있는 절마다 요청을 따로 보낸다`(fetch 3회,
  각 본문 `keys` 길이 1), `일부만 실패하면 실패 목록을 보인다`. Step1(`분석하기`/`다시 분석`)·
  Step2(`전년 자료 없음`)·Step5 문구 단언 갱신(부록 A). tokens.test:
  `'--font-serif 와 --shadow-lg 별칭이 없다'`, `'소스에 Hahmlet·font-serif 참조가 없다'`.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/features src/design/tokens.test.ts`.
- [ ] **Step 3: 구현** — 설계 §4·§5·§6.2·§7.2·§8.3. WizardShell h2 `text-title font-bold`(세리프 제거),
  오류 배너 문구, App 의 쓰임 띠(`--surface-alt`, 번호 목록 `eyebrow-mono`), 푸터, `<main>` 과 히어로에
  `dataset.error`·`reload` 전달. 마지막에 `tokens.css` 의 `--font-serif`·`--shadow-lg` 별칭 삭제(T9 의
  Combobox 가 `--shadow-hard` 를 직접 쓰도록 돼 있는지 확인 — 아니면 T9 보고를 보고 조율자에게 알린다).
- [ ] **Step 4: 통과 확인** — `npx vitest run src/features src/design src/architecture.test.ts` PASS, tsc 0.

---

### Task 14: e2e — 문구 갱신 + 읽기 전용 모드 스펙

**Files:**
- Modify: `web/e2e/shell.spec.ts`, `web/e2e/wizard.spec.ts`
- Create: `web/e2e/readonly.spec.ts`

- [ ] **Step 1: 문구 단언 갱신** — shell: 범위 띠 그대로(`공시 \d{4}–\d{4}년`), 부제 `/1인당 SCI급·SCOPUS
  논문 수/` 그대로. wizard: 75행 `/\d{3}개교 중 \d+개 일치|\d{3}개교 중에서/`, 318행 `연도가 없습니다`,
  352행 `분석을 먼저 불러오세요`, V16 — `평면 키` 단언 삭제, `OPENAI_API_KEY` 유지, 추가로 4단계에 브라우저
  키 폼 또는 서버 폼이 보임(`api-key-input` 또는 `client-key-input` 중 하나 `toBeVisible`). 콤보박스
  status `일치하는 대학이 없습니다` 가 쓰이는 곳이 있으면 함께.
- [ ] **Step 2: `readonly.spec.ts`**

```ts
test.describe('공개 사이트 모드 (HOSEO_FORCE_READONLY=1)', () => {
  test.skip(!process.env.HOSEO_FORCE_READONLY, '읽기 전용 서버에서만 성립한다')
  test('설정이 브라우저 키 폼을 보이고 저장하면 4단계가 생성 가능 상태가 된다', …)   // client-key-input 에 가짜 키 → 저장 → settings-status data-mode=browser; 4단계로 가 generate-button 클릭 → narrative-error 가 OpenAI 오류(인증 실패)를 보이되 503 문구는 아님
  test('데이터 패널이 추가 모드이고 공시 xlsx 를 더하면 연도 칩과 자료 현황에 나타난다', …) // Raw data/*.xlsx 최신 파일(없으면 skip) → overlay-result → data-panel 에 '추가 데이터' → year-picker 에 그 해 → load-button → load-summary
  test('추가한 해를 지우면 사라진다', …)
})
```
- [ ] **Step 3: 확인** — 이 태스크는 서버를 띄우지 않는다(게이트 2 에서 돈다). `npx tsc -p e2e` 또는
  `npx playwright test --list` 로 수집만 확인.

---

### 게이트 2 (조율자)

```powershell
cd web; npx tsc -b --noEmit; npm test; npm run build; npm run build-storybook -- --quiet
cd ..; .\.venv\Scripts\python.exe -X utf8 -m pytest -q
cd web; $env:API_PORT='8010'; npx playwright test
$env:API_PORT='8011'; $env:HOSEO_FORCE_READONLY='1'; npx playwright test readonly
```
기록: Vitest·Playwright·pytest 수치, 번들 4줄, Storybook. 실패는 원인별로 소유 태스크에 돌려보낸다.

---

### Task 15: 문서·메모리

**Files:**
- Modify: `README.md`(Vercel 절 — 읽기 전용 플래그 삭제, 브라우저 키·데이터 추가 설명, `HOSEO_FORCE_READONLY`
  를 「테스트」에, 글꼴), `CLAUDE.md`(알려진 함정: Vercel 읽기 전용 → "쓰기 기능은 `canPersist` 로 모드를
  바꾼다, 브라우저 데이터셋은 서버에 저장하지 않는다", 디자인 계약은 `DESIGN.md`), `docs/ARCHITECTURE.md`
  (「글꼴과 장식」: Hahmlet → Geist Mono, `DESIGN.md`; 「요청 맥락」 절 신설: overlay·브라우저 키는
  `web/src/api/` 가 싣고 서버는 저장하지 않는다), `scripts/README.md`(build_fonts 설명)
- Create: 메모리 `C:\Users\정화민\.claude\projects\D--Project-IR---Hoseo-Research-Web\memory\{MEMORY.md,changelog.md,issues.md}`
  (이전 두 폴더 링크 + 이번 작업 요약·결정·남은 결정)

- [ ] 각 문서를 코드와 대조해 고친다. 문서에 적힌 명령은 실제로 한 번 돌려 본다.

---

### Task 16: 시각 검증 · 5차원 채점 · 적대 리뷰 · 수정 루프 (조율자 + 워크플로)

- [ ] 스크린샷: 1440·390 × 라이트·다크 × (홈, 1·2·3·4·5단계, 설정 모달(persist·browser), 데이터
  패널(persist·browser)) — Playwright 스크립트로 `scratchpad/shots/after-*.png`.
- [ ] `critique` 5차원 채점(독립 에이전트 3명, 평균) + anti-ai-slop P0 7항목. 7 미만 차원은 고친다.
- [ ] diff 적대 리뷰 워크플로: 키 유출 / overlay 병합 / 캐시 무효화 / 문구·테스트 일치 / 접근성 / 번들·오프라인.
  반증 안 된 HIGH·MEDIUM 은 고치고 게이트 2 를 다시 돈다.
- [ ] 최종 보고: 방향 선택(tom-modern)과 스냅숏 경로를 첫 줄에.

---

## 부록 A — 문구 대조표 (옛 → 새 · 잠근 테스트)

설계 §6.2 의 표가 원본이다. 여기에는 **테스트를 건드리는 행**과 구현 중 추가된 행만 쌓는다.
형식: `자리 | 옛 | 새 | 고친 테스트`.

| 자리 | 옛 | 새 | 고친 테스트 |
|---|---|---|---|
| blockedReason | 먼저 분석을 불러와야 한다 | 분석을 먼저 불러오세요 | `e2e/wizard.spec.ts:352` |
| StepNav aria-label | … 이전 단계를 먼저 마쳐야 한다 | … 이전 단계를 먼저 마치세요 | `StepNav.test.tsx:30` |
| Combobox status | {N}개교에서 고른다 / {N}개 중 {M}개 / 일치하는 대학이 없다. 철자를 확인할 것 / 고를 수 있는 대학이 없다 | {N}개교 중에서 고를 수 있습니다 / {N}개교 중 {M}개 일치 / 일치하는 대학이 없습니다. 철자를 확인해 주세요 / 고를 수 있는 대학이 없습니다 | `Combobox.test.tsx:50,56,121,160`, `e2e/wizard.spec.ts:75` |
| CompareGroupPicker | {r} 에 비교할 다른 대학이 없다. / 서버 기본 비교군을 쓴다 ({r} 상위권) | {r}에는 비교할 다른 대학이 없습니다. / 서버 기본 비교군 · {r} 상위권 | `CompareGroupPicker.test.tsx:94` |
| 빈 상태 | 표시할 연도가 없다. / 표시할 데이터가 없다. / 전년도 데이터가 없다. | 표시할 연도가 없습니다. / 표시할 데이터가 없습니다. / 전년도 자료가 없습니다. | `YearTable.test.tsx:114`, `CompareTable.test.tsx:285,362`, `TrendChart.test.tsx:170,181`, `YoYPanel.test.tsx:246,252,266,275` |
| ChartGallery 오류 | 차트를 그리지 못했다. 보고서에도 이 그림은 빠진다. | 차트를 그리지 못했습니다. 이대로면 보고서에서도 빠집니다. | `ChartGallery.test.tsx:75` |
| SettingsPanel 성공 | 저장했다. 서버를 다시 켜지 않아도 바로 쓸 수 있다. | 저장했습니다. 서버를 다시 켜지 않아도 바로 쓸 수 있습니다. | `SettingsPanel.test.tsx:89` |
| SettingsPanel 읽기 전용 | 이 서버는 설정 파일에 쓸 수 없다. 환경변수 … | (브라우저 키 폼) | `SettingsPanel.test.tsx:136-142` 교체 |
| DataUpdatePanel | — xlsx 가 아니거나 파일명에 연도가 없다 / xlsx 를 끌어다 놓거나 눌러서 고릅니다 / …다시 만들었다 / …백업했다 | · xlsx 가 아니거나 파일명에 연도가 없습니다 / xlsx 파일을 끌어다 놓거나 눌러서 고르세요 / …다시 만들었습니다 / …백업했습니다 | `DataUpdatePanel.test.tsx:61,131`, `e2e/wizard.spec.ts:318` |
| Step4 안내(읽기 전용) | 이 서버에는 GPT 서술 생성이 꺼져 있습니다… | GPT 서술에는 OpenAI API 키가 필요합니다. 키는 이 브라우저에만 저장되고… | `Step4Narrative.test.tsx` 1번 케이스 교체 |
| 서버 503(키) | OPENAI_API_KEY 가 설정되지 않았다. … 평면 키 … | OpenAI API 키가 없습니다. 설정에서 키를 넣거나 서버 환경변수 OPENAI_API_KEY 를 설정하세요. | `test_narrative_and_report.py` 503 테스트, `e2e/wizard.spec.ts` V16(`평면 키` 삭제) |
| 서버 비교군 사유 | …비교군을 구성할 수 없다. … | …비교군을 구성할 수 없습니다. … | `test_data_and_stats.py:211` |
| 서버 범위 문장 | …133개교 기준이다. …포함되지 않는다. | …133개교 기준입니다. …포함되지 않습니다. | `HomeHero.test.tsx:41`(원문 단언), `stats.fixture.ts` |
| Word 셀 배경 | 2E75B6 / D6E4F0 / FFF2CC | 27272A / F4F4F5 / FFE8DC | `test_report_builder.py` u07 4곳 |
| 글꼴 번들 | Hahmlet 650 | Geist Mono 1.7.2 | `test_fonts_bundle.py` |
| 기능 플래그 | VITE_READONLY_DEPLOY 로 끔 | 무조건 켬 | `features.test.ts` 읽기 전용 블록 |
| 굵기 금지선 | font-bold 이상 | font-extrabold·black | `tokens.test.ts` |
| 로드 버튼 | 분석 불러오기 / 다시 불러오기 | 분석하기 / 다시 분석 | `Step1Target.test.tsx` |
| 2단계 증감 없음 | 비교 없음 | 전년 자료 없음 | `Step2Metrics.test.tsx` |
| client 오류 3종 | …너무 크다… / …끝내지 못했다… / …처리하지 못했다… | 설계 §6.2 | `api/client.test.ts` |
| 설정 읽기 전용 동작 | 저장 폼 숨김 + 환경변수 안내 | 브라우저 키 폼(`client-key-*`) | `SettingsPanel.test.tsx:136-142` 교체 |
| 4단계 읽기 전용 동작 | "꺼져 있습니다" 안내만 | 브라우저 키 폼 임베드 | `Step4Narrative.test.tsx` 1번 교체 |
