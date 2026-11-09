# 프론트엔드 리디자인 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 연구실적 분석 포털의 프론트엔드를 "활자와 숫자로 서는 편집 디자인"으로 바꾸고, 감사에서
확인된 결함 7건을 함께 고친다. 기존 테스트 계약은 전부 지킨다.

**Architecture:** 토큰(`tokens.css`) → 디자인 프리미티브(`design/ui`) → 도메인 컴포넌트
(`components/*`) → 화면 조립(`features/wizard`, `App.tsx`) 순으로 바깥에서 안으로 간다. 사진·
3D·MediaBand 를 지우고 히어로를 활자만으로 다시 짠다. 마법사 안쪽은 "조용한 패널" 규칙(1px 선,
고정 타입 스케일, 색은 데이터에만)으로 통일한다. 의존 방향(features → components → design)과
`registry.ts` 단일 정의는 그대로다.

**Tech Stack:** React 19.3, TypeScript 6, Vite 8, Tailwind 4(`@theme`), Vitest 5 + Testing Library +
vitest-axe, Playwright 1.63, Storybook 10, Python 3.12 fontTools(글꼴 생성기), pytest.

**Spec:** `docs/superpowers/specs/2026-11-02-frontend-redesign-design.md` — 이 계획은 그 문서에서
논증한다. 실행자는 둘 다 읽는다. **§3 이 §5 보다 우선한다**(스펙 §11).

> **진행 상황(2026-11-02):** Task 1–11 완료. 최종 게이트 — Vitest 310, Playwright 80 passed/2 skipped,
> pytest 3.12·3.11 각 362 passed/1 skipped/6 xfailed(정적 캐시 헤더 계약 포함), Storybook 빌드, 번들 190.6/6.5/0/14.4 KB.
> 스크린샷 28장 검토(1440·390 × 라이트·다크 × 7화면) → 컨텍스트 바 줄바꿈 결함 1건 발견·수정(`@layer base`).
> 프리뷰 배포 https://hoseo-research-eal4t24k7-junghwamins-projects.vercel.app (Vercel 인증으로 보호됨 —
> 헤더 검증 불가). **프로덕션 승격 완료(2026-11-02, 사용자 요청)** — https://hoseo-research-web.vercel.app,
> 배포 `hoseo-research-lmyxro9fi`. 실기 확인: 콘솔 오류·실패 요청 0, Hahmlet 650·Pretendard 로드, 읽기 전용
> 메뉴 숨김, 1→3단계 차트 5장(데스크톱·Pixel 7), `/assets/*` immutable 1년, `/fonts/*` 하루(함수 미들웨어
> 값이 vercel.json headers 보다 우선함 — 함수가 서빙하는 경로라 CDN 헤더 규칙은 닿지 않는다). 커밋은 요청 시.

## Global Constraints

- 색·간격·radius·shadow·글꼴 값은 `web/src/design/tokens.css` 밖에 두지 않는다. 컴포넌트에 hex·
  `rgb()`·px 리터럴 금지(`tokens.test.ts` 가 잡는다). 다크 토큰 블록 셋(`:root[data-theme='dark']`,
  `@media (prefers-color-scheme: dark) :root:not([data-theme='light'])`)의 **이름과 값이 모두 같아야**
  한다.
- 의존 방향 `features → components → design`, 배럴(`index.ts`) 경유 import, 단계 정의는
  `features/wizard/steps/registry.ts` 한 곳(`architecture.test.ts`).
- 번들 예산(gzip): 초기 JS 200KB · 초기 CSS 20KB · 지연 JS 200KB · 글꼴 CSS 20KB
  (`web/scripts/check-bundle.mjs`). 넘으면 빌드가 실패한다.
- 오프라인 설치본: CDN·웹폰트 URL 금지. 글꼴·아이콘은 전부 저장소 안.
- **테스트 계약(스펙 §8)은 바꾸지 않는다.** 예외 둘: shell.spec 의 히어로 문구 단언 2개(새 문구로
  교체)와 삭제되는 컴포넌트(MediaBand·scene·capability)의 테스트. Testing Library 의 `getByText`/
  `name:` 은 **정확 일치·단일 노드**다.
- 단계 이름은 `store/types.ts` 의 `STEPS` 그대로: 데이터 설정 · 통계 확인 · 그래프 검토 · GPT 서술 ·
  보고서 생성.
- 글꼴: 본문·숫자·h3 이하 Pretendard Variable(400/500/600), **h1·단계 h2 만 Hahmlet 650**. 700 이상
  금지. `overflow-wrap: anywhere` 금지, `word-break: keep-all` 유지. 표제 행간 ≥1.15, 본문 1.55–1.6.
- 타입 크기는 토큰 유틸리티로만(`text-display/title/heading/lead/body/meta/kpi/kpi-sub`). Tailwind
  기본 `text-xs`·`text-sm`·`text-3xl` 등 직접 사용 금지(Task 11 에서 테스트로 잠근다).
- 문구: 라벨·제목은 명사형, 설명·안내는 합쇼체. 금지어: 혁신·스마트·AI 기반·원스톱·한눈에·손쉽게·
  최적화·Insight·Dashboard·KPI·이모지. `SCI/SCOPUS` → `SCI급·SCOPUS`. 숫자는 API 값만(상수 금지).
  연도는 "{year}년 공시".
- 사진·그라데이션·3D·스크롤 리빌·아이콘 패키지 금지. 그림자는 콤보박스 드롭다운(`--shadow-lg`) 한 곳.
- **커밋은 사용자가 명시적으로 요청할 때만** 한다(저장소 CLAUDE.md). 각 태스크 끝의 "체크포인트"
  는 게이트 통과 확인이며, 커밋 메시지 초안은 사용자가 커밋을 요청할 때 쓴다.
- 포트 8000 은 이 PC 에서 다른 프로그램이 쓴다. 로컬 서버는 `--port 8010`, Vite 는
  `VITE_API_TARGET=http://127.0.0.1:8010`. Python 은 `.venv\Scripts\python.exe`(3.12).
- 게이트 명령(web/ 에서): `npx tsc -b --noEmit` · `npx vitest run` · `npm run build` ·
  `npm run build-storybook -- --quiet` · e2e 는 `$env:API_PORT='8010'; npx playwright test [파일]`
  (Task 3 이 `playwright.config.ts` 에 `API_PORT` 를 넣는다 — Task 1·2 에는 e2e 게이트가 없다).
  e2e 전에 5173 에 떠 있는 옛 Vite 서버를 끈다(`reuseExistingServer` 가 그걸 재사용한다).
- 테스트와 빌드를 동시에 돌리지 않는다 — `test_openapi_drift.py` 가 `web/dist` 를 잠깐 옮긴다.
- 시작 전 스냅숏: 배포 작업 32개 변경이 미커밋 상태로 깔려 있다. Task 1 전에 `git diff >
  <scratchpad>/pre-redesign.patch` 와 `git status --porcelain > <scratchpad>/pre-redesign-status.txt`
  를 남겨, 나중에 커밋을 요청받으면 배포 diff 와 리디자인 diff 를 가를 수 있게 한다.

## Review Focus

스펙이 말하지 않지만 사용자가 만날 입력. 각 줄의 테스트는 해당 태스크에 들어 있다.

1. **`/api/data` 가 아직 오지 않았거나 실패한 첫 화면** — 신뢰 띠에 `undefined개교`·빈 괄호가 보이면
   안 되고, 로드 전에도 h1·부제·「분석 시작」은 그려져야 한다. → Task 5 HomeHero 테스트.
2. **기준 연도가 최신 연도가 아닐 때의 2단계 캡션** — 다른 해의 대학 수를 지어내지 않는다. → Task 8.
3. **전년 자료가 없는 대학(`yoy.target` null)** 의 2단계 — 증감 자리에 "비교 없음" 회색, `NaN%` 금지.
   → Task 3 Step2Metrics 테스트.
4. **차트 한 장이 실패했을 때** — 그 figure 안에 재시도가 있고, 나머지 4장은 그대로 보여야 한다.
   → Task 9 ChartGallery 테스트.
5. **320px 폭** — 스텝 점 5개·하단 고정 nav 가 가로 넘침을 만들지 않고, 콤보박스 status 가 첫
   `role=status` 로 남는다. → Task 11 e2e(뷰포트 320 추가).

---

### Task 1: 토큰 체계 교체 — 팔레트·타입 스케일·버그 토큰

**Files:**
- Modify: `web/src/design/tokens.css` (전면)
- Modify: `web/src/design/tokens.test.ts`
- Test: `web/src/design/tokens.test.ts`

**Interfaces:**
- Produces(토큰 이름 — 이후 모든 태스크가 쓴다):
  - 표면 `--surface-base/raised/sunken/inverse`, 선 `--border-subtle/strong`, 잉크 `--text-primary/
    secondary/muted/on-action/on-inverse`, 강조 `--accent/--accent-hover/--accent-soft`, 행동
    `--action-bg/--action-bg-hover`, 의미색 `--color-up(-soft)/--color-down(-soft)/--color-neutral
    (-soft)`, `--focus-ring`, `--shadow-lg`(유일한 그림자), `--chart-matte: #ffffff`(`@theme` 한 곳 —
    테마와 무관하게 흰색이라 다크 블록에 넣지 않는다; 서버 PNG 의 흰 배경을 받는 매트).
  - 타입 `--text-display/title/heading/lead/body/meta/kpi/kpi-sub`(각각 `--text-*--line-height`,
    표제·kpi 는 `--letter-spacing` 서브키), 글꼴 `--font-sans/--font-serif/--font-numeric/--font-mono`.
  - 레이아웃 `--appbar-h: 3.25rem`, `--contextbar-h: 2.5rem`, `--actionbar-h: 3.5rem`,
    `--container-content: 72rem`, `--container-prose: 44rem`.
  - 차트 비율 `--chart-aspect-trend: 9 / 5`, `--chart-aspect-bar: 2 / 1`, `--chart-aspect-avg: 2 / 1`,
    `--chart-aspect-rank: 12 / 5`, `--chart-aspect-compare: 8 / 5`.
  - 간격·radius·모션 토큰은 현재 이름 그대로(`--spacing-1..10`, `--radius-sm/md/lg/full`,
    `--duration-fast/base/slow`, `--ease-out-quart`).
- 이 태스크에서는 **옛 토큰(`--text-eyebrow`, `--scrim-*`, `--surface-overlay`, `--shadow-sm/md`,
  `--color-brand-*`, `--color-ink-*`)을 아직 지우지 않는다** — 소비자가 남아 있어 빌드가 깨진다. 삭제는
  Task 11.

- [ ] **Step 1: 실패하는 테스트 — 미정의 토큰 참조·대비·overflow-wrap**

`tokens.test.ts` 에 추가:

```ts
describe('디자인 토큰 — 정합성', () => {
  it('소스가 참조하는 var(--x) 는 tokens.css 에 선언돼 있다', () => {
    // 모든 componentSources() 에서 /var\(--([\w-]+)\)/g 를 모아 tokens.css 의 `--name:` 선언과 대조
    // 기대: 미선언 0건 (현재 --font-numeric 이 걸린다)
  })
  it('body 에 overflow-wrap: anywhere 가 없다', () => {
    expect(css).not.toMatch(/overflow-wrap:\s*anywhere/)
  })
  it('라이트 --text-muted 는 흰 바탕·sunken 바탕에서 4.5:1 이상이다', () => {
    // :root 블록에서 --text-muted, --surface-sunken 을 읽어 WCAG 상대 휘도로 대비 계산
    // 기대: 둘 다 >= 4.5
  })
  it('새 타입 토큰 8개가 @theme 에 있다', () => {
    for (const n of ['display','title','heading','lead','body','meta','kpi','kpi-sub'])
      expect(css).toMatch(new RegExp(`--text-${n}:`))
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd web && npx vitest run src/design/tokens.test.ts`
Expected: 새 4건 FAIL(미정의 `--font-numeric`, `anywhere` 존재, 대비 4.29, 토큰 없음)

- [ ] **Step 3: `tokens.css` 를 다시 쓴다 — 값은 스펙 §3 그대로**

`@theme` 에: 글꼴 `--font-sans: 'Pretendard Variable', 'Pretendard Fallback', 'Malgun Gothic',
'Apple SD Gothic Neo', system-ui, sans-serif` · `--font-serif: Hahmlet, var(--font-sans)` ·
`--font-numeric: var(--font-sans)` · `--font-mono: ui-monospace, Consolas, 'D2Coding', monospace`.
타입: display `clamp(2.5rem, 1.6rem + 3.6vw, 4.5rem)`/1.15/-0.02em, title `1.5rem`/1.3/-0.01em,
heading `1rem`/1.4, lead `1rem`/1.6, body `0.875rem`/1.55, meta `0.75rem`/1.5, kpi `1.875rem`/1.1/
-0.02em, kpi-sub `1.5rem`/1.1. 레이아웃·차트 비율 토큰은 Interfaces 값.
`:root` 라이트: base `#f7f5f0` raised `#ffffff` sunken `#efece6` inverse `#15140f`; border subtle
`#e3dfd6` strong `#cfcabf`; text primary `#15140f` secondary `#4a4740` muted `#6f6b62`
on-action `#ffffff` on-inverse `#f7f5f0`; accent `#2f4ba8` hover `#24398a` soft `rgb(47 75 168 / 0.09)`;
action-bg `#15140f` hover `#3a3834`; up `#1f7a5f`/soft `rgb(31 122 95 / 0.10)`, down `#b3261e`/soft
`rgb(179 38 30 / 0.10)`, neutral `#4a4740`/soft `rgb(74 71 64 / 0.10)`; focus-ring `#2f4ba8`;
shadow-lg `0 10px 34px rgb(21 20 15 / 0.12)`; chart-matte `#ffffff`.
다크(두 블록 동일): base `#141311` raised `#1c1a17` sunken `#0f0e0c` inverse `#f2efe8`;
border subtle `#2a2824` strong `#3a3731`; text primary `#f2efe8` secondary `#b8b3a8` muted `#8a857b`
on-action `#141311` on-inverse `#141311`; accent `#8fa6ff` hover `#b3c2ff` soft `rgb(143 166 255 / 0.14)`;
action-bg `#f2efe8` hover `#cfcabf`; up `#74b69f`/`rgb(116 182 159 / 0.16)`, down `#f2837c`/
`rgb(242 131 124 / 0.16)`, neutral `#b8b3a8`/`rgb(184 179 168 / 0.14)`; focus-ring `#8fa6ff`;
shadow-lg `0 12px 32px rgb(0 0 0 / 0.6)`; chart-matte `#ffffff`.
기본 스타일: body `font-family: var(--font-sans); line-height: 1.55; word-break: keep-all;`
(`overflow-wrap: anywhere` 삭제), `h1,h2,h3 { text-wrap: balance }`, `p { text-wrap: pretty }`,
`.tabular { font-variant-numeric: tabular-nums }`, `html { scroll-padding-top: calc(var(--appbar-h) +
var(--contextbar-h)); scroll-padding-bottom: var(--actionbar-h) }`, `:focus-visible` 유지,
`prefers-reduced-motion` 블록 유지. 머리말 주석의 "방향" 절을 스펙 §1·§3 요지로 교체.
옛 토큰은 `/* 삭제 예정(Task 11) */` 표시만 하고 둔다.

- [ ] **Step 4: 통과 확인 + 기존 대칭성 테스트**

Run: `npx vitest run src/design/tokens.test.ts`
Expected: 전부 PASS(세 다크 블록 이름·값 일치 포함)

- [ ] **Step 5: 전체 단위 테스트·빌드가 깨지지 않았는지**

Run: `npx vitest run && npm run build`
Expected: 272 passed 이상, 초기 CSS ≤ 20KB

- [ ] **Step 6: 체크포인트** — 커밋 메시지 초안 `design(tokens): 웜 뉴트럴 팔레트·고정 타입 스케일·미정의 토큰 수정`

---

### Task 2: 글꼴 생성기·폴백·캐시 헤더·favicon

**Files:**
- Create: `scripts/build_fonts.py`
- Create: `tests/contract/test_fonts_bundle.py`
- Modify: `web/public/fonts/fonts.css`(생성기 출력으로 교체), `web/public/fonts/CREDITS.md`,
  `web/public/fonts/manifest.json`(신규, 생성기 출력)
- Modify: `vercel.json`(headers), `web/public/favicon.svg`(교체), `scripts/README.md`(build_fonts 항목)

**Interfaces:**
- Produces: `scripts/build_fonts.py [--check]` — 인자 없이 실행하면 `npm pack pretendard@1.3.9` 와
  `https://raw.githubusercontent.com/google/fonts/<COMMIT>/ofl/hahmlet/Hahmlet%5Bwght%5D.ttf`(커밋
  해시 상수 `HAHMLET_COMMIT`)를 임시 폴더에 받아 `web/public/fonts/` 전체와 `fonts.css`·
  `manifest.json`(경로→sha256)을 다시 만든다. `--check` 는 네트워크 없이 `manifest.json` 과 실제
  파일 해시, `fonts.css` 의 모든 `url()` 존재를 검사하고 어긋나면 1 로 종료한다.
- `fonts.css` 머리 템플릿(생성기 상수): `@font-face { font-family: 'Pretendard Fallback';
  src: local('Malgun Gothic'), local('MalgunGothic'); size-adjust: 86.4%; ascent-override: 110.2%;
  descent-override: 27.9%; line-gap-override: 0%; }` + Hahmlet 블록 + Pretendard 92블록(패키지
  CSS 의 경로만 `/fonts/pretendard-1.3.9/` 로 치환).

- [ ] **Step 1: 실패하는 pytest**

`tests/contract/test_fonts_bundle.py`:

```python
FONTS = PROJECT_ROOT / "web" / "public" / "fonts"

def test_fonts_css_의_모든_url_이_존재한다():
    css = (FONTS / "fonts.css").read_text("utf-8")
    urls = re.findall(r"url\(/fonts/([^)]+)\)", css)
    assert urls and all((FONTS / u).is_file() for u in urls)

def test_두_글꼴과_폴백이_선언돼_있다():
    css = (FONTS / "fonts.css").read_text("utf-8")
    assert "font-family: 'Hahmlet'" in css and "font-weight: 650" in css
    assert css.count("font-family: 'Pretendard Variable'") == 92
    assert "font-family: 'Pretendard Fallback'" in css and "size-adjust: 86.4%" in css

def test_manifest_와_파일_해시가_같다():
    manifest = json.loads((FONTS / "manifest.json").read_text("utf-8"))
    for rel, digest in manifest.items():
        assert hashlib.sha256((FONTS / rel).read_bytes()).hexdigest() == digest

def test_생성기_check_모드가_통과한다():
    r = subprocess.run([sys.executable, "-X", "utf8", "scripts/build_fonts.py", "--check"], cwd=PROJECT_ROOT, capture_output=True)
    assert r.returncode == 0, r.stderr

def test_OFL_과_CREDITS_가_있다():
    for p in ("pretendard-1.3.9/OFL.txt", "hahmlet-650/OFL.txt", "CREDITS.md"):
        assert (FONTS / p).is_file()
```

- [ ] **Step 2: 실패 확인**

Run: `.venv\Scripts\python.exe -m pytest -q tests/contract/test_fonts_bundle.py`
Expected: FAIL(Fallback 없음, manifest 없음, 스크립트 없음)

- [ ] **Step 3: `scripts/build_fonts.py` 작성** — 작업 메모리의 `build_fonts.py` 를 바탕으로
  `main(check: bool) -> int`, 상수 `PRETENDARD_VERSION = "1.3.9"`, `HAHMLET_COMMIT`(google/fonts 의
  현재 main 커밋 해시를 적는다), `HAHMLET_WEIGHT = 650`, KS X 1001 필터는 `len(ch.encode("euc_kr",
  errors="ignore")) == 2`. fontTools 가 없으면 설치 안내 후 종료. `--check` 는 네트워크·fontTools 없이
  돈다. 입력 파일은 스크래치 임시 폴더에만 두고 저장소에는 산출물만 쓴다.

- [ ] **Step 4: 생성기 실행 → 산출물 교체**

Run: `.venv\Scripts\python.exe -m pip install fonttools brotli` 후 `.venv\Scripts\python.exe scripts/build_fonts.py`
Expected: `web/public/fonts/{pretendard-1.3.9/*.woff2 ×92, OFL.txt}`, `hahmlet-650/{Hahmlet-650.ksx1001.woff2, OFL.txt}`, `fonts.css`, `manifest.json` 생성. `fonts.css` 첫 블록이 Fallback.

- [ ] **Step 5: CREDITS 갱신** — "폴백 (예정)" 절을 현재형으로, 재현 스크립트를 `scripts/build_fonts.py` 로.

- [ ] **Step 6: `vercel.json` headers 추가**

```json
"headers": [
  { "source": "/assets/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
  { "source": "/fonts/(.*)",  "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
]
```

- [ ] **Step 7: favicon 교체** — `web/public/favicon.svg` 를 ≤1KB 로(보라 템플릿 잔재 `#863bff` 제거).
  형태: 32×32 viewBox, 배경 없음, 코발트 `#2f4ba8` 세로 막대 셋(`x=5·13·21`, 폭 5, 높이 10·16·22,
  아래 정렬)과 그 꼭대기를 잇는 잉크색 `#15140f` 폴리라인(stroke 2) 하나. `public/` 정적 SVG 라 토큰
  테스트 대상 밖.

- [ ] **Step 8: `scripts/README.md`** 에 `build_fonts.py` 항목(용도·`--check`·재생성 절차·fontTools 설치) 추가.
  `fetch_media.py`·`web/public/media/` 삭제는 Task 5(MediaBand 와 함께).

- [ ] **Step 9: 통과 확인**

Run: `.venv\Scripts\python.exe -m pytest -q tests/contract/test_fonts_bundle.py tests/contract/test_repo_hygiene.py`
Expected: PASS. Run: `cd web && npm run build` → 글꼴 CSS ≤ 20KB.

- [ ] **Step 10: 체크포인트** — `build(fonts): 글꼴 생성기·폴백 메트릭·immutable 캐시·favicon`

---

### Task 3: 감사 결함 수정 — +970%, 모바일 글자 쪼개짐, 표 접근성

**Files:**
- Create: `web/src/features/wizard/steps/Step2Metrics.test.tsx`
- Modify: `web/src/features/wizard/steps/Step2Metrics.tsx:18-27`
- Modify: `web/src/components/YearTable/YearTable.tsx:50-53,115-158`, `YearTable.test.tsx`
- Modify: `web/src/design/ui/Button.tsx:71-75`, `web/src/components/AppBar/AppBar.tsx:36-48,84-99`
- Modify: `web/playwright.config.ts:55-70`(`API_PORT` 환경변수), `web/e2e/wizard.spec.ts`(모바일 표 높이 테스트 추가)

**Interfaces:**
- Consumes: `describeChange(rate: number | null | undefined): YoYChangeView` from
  `components/YoYPanel`(배럴이 내보내는지 확인; 아니면 `index.ts` 에 export 추가).
- Produces: `Step2Metrics` 가 전년대비 라벨을 `describeChange` 로 만든다(`+9.7%`, `신규`, `0.0%`).

- [ ] **Step 1: 실패하는 테스트 — Step2Metrics 렌더**

`Step2Metrics.test.tsx`(features 첫 테스트; `StepProps` 를 최소 stats 로 구성):

```tsx
const stats = makeStats({ year: 2026, trend: { 2025: {..., perCapita: 0.1182}, 2026: {..., perCapita: 0.1297, nationalRank: 71, regionalRank: 17} },
  rankChanges: { 2026: { regionalRank: 17, nationalRank: 71, regionalRankDelta: 2, nationalRankDelta: 6 } },
  yoy: { top: [], bottom: [], target: { name: '호서대학교', changeRate: 9.7, baseValue: 0.1297, compareValue: 0.1182 } } })

it('1인당 논문 증감률을 서버 값 그대로 보여준다 — ×100 하지 않는다', () => {
  render(<Step2Metrics state={stateWith(stats)} dataset={dataset} actions={noopActions} />)
  const deltas = screen.getAllByTestId('metric-delta')
  expect(deltas.some((d) => d.textContent?.includes('+9.7%'))).toBe(true)
  expect(document.body.textContent).not.toContain('970')
})
it('전년 자료가 없으면 비교 없음 이고 NaN 이 없다', () => {
  render(... yoy: { top: [], bottom: [], target: null } ...)
  expect(document.body.textContent).not.toMatch(/NaN/)
  expect(screen.getByText('비교 없음')).toBeInTheDocument()
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/wizard/steps/Step2Metrics.test.tsx`
Expected: FAIL — `+970.0%` 가 렌더된다

- [ ] **Step 3: `rateLabel`·`rateDirection` 을 `describeChange` 로 교체** — `Step2Metrics.tsx` 의 두 함수를 지우고
  `const view = describeChange(yoy?.changeRate)` 로 `label/direction/srLabel` 을 만든다(`direction
  'new'` 는 MetricCard 의 `DeltaDirection` 에 없으므로 `'flat'` 으로 매핑하고 label `신규` 유지).

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/features/wizard/steps/Step2Metrics.test.tsx` → PASS

- [ ] **Step 5: 실패하는 테스트 — YearTable 접근성·줄바꿈**

`YearTable.test.tsx` 추가:

```tsx
it('가로 스크롤 영역이 키보드로 닿는 region 이다', () => {
  setup()
  const region = screen.getByRole('region', { name: /호서대학교 연도별/ })
  expect(region).toHaveAttribute('tabindex', '0')
})
it('숫자 셀은 줄바꿈하지 않는다', () => {
  setup()
  expect(screen.getByText('0.5246').className).toMatch(/whitespace-nowrap/)
})
```

- [ ] **Step 6: 실패 확인** → `npx vitest run src/components/YearTable` FAIL

- [ ] **Step 7: YearTable 수정** — 래퍼 `<div role="region" aria-labelledby={captionId} tabIndex={0} className="overflow-x-auto">`,
  caption 에 `id={captionId}`(sr-only 유지), `<table className="w-full min-w-[48rem] …">`, `Td numeric`
  와 `Th numeric` 에 `whitespace-nowrap`. `data-testid="year-table"` 은 `<table>` 에 그대로.

- [ ] **Step 8: Button·AppBar 줄바꿈 금지** — `Button.tsx` 공통 클래스에 `whitespace-nowrap`; `AppBar.tsx`
  바깥 flex 를 `flex-nowrap`, 세그먼트 버튼에 `whitespace-nowrap`, `<header>` 높이 `h-[var(--appbar-h)]`.

- [ ] **Step 9: `playwright.config.ts` 에 API 포트 환경변수** — `const API_PORT = process.env.API_PORT ?? '8000'`;
  uvicorn 명령 `--port ${API_PORT}`, `url: http://127.0.0.1:${API_PORT}/api/health`; Vite webServer 에
  `env: { ...process.env, VITE_API_TARGET: \`http://127.0.0.1:${API_PORT}\` }`. 기본값이 8000 이라 CI 는
  그대로다. 이 PC 는 `$env:API_PORT='8010'`.

- [ ] **Step 10: 실패하는 e2e — 모바일 표 한 줄 높이**

`wizard.spec.ts` 추가(기존 `3단계가 화면 폭을 넘지 않는다` 옆; `loadAndAdvance(page)` 는 파일 상단의 기존 헬퍼):

```ts
test('2단계 표가 휴대폰에서 글자 단위로 쪼개지지 않는다', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', '모바일 전용')
  await loadAndAdvance(page)
  const row = page.getByTestId('year-table').locator('tbody tr').first()
  const box = await row.boundingBox()
  expect(box!.height).toBeLessThan(64)
  const header = await page.getByRole('banner').boundingBox()
  expect(header!.height).toBeLessThanOrEqual(56)
})
```

- [ ] **Step 11: 통과 확인**

Run: `npx vitest run` → PASS. Run: `$env:API_PORT='8010'; npx playwright test -g "쪼개지지|화면 폭"` → PASS(desktop 은 skip)

- [ ] **Step 12: 체크포인트** — `fix(web): 2단계 증감 ×100 오류, 모바일 글자 쪼개짐, 연도표 region, e2e API 포트 변수`

---

### Task 4: 디자인 프리미티브 — Icon·Pending·Modal, Button·Card 정리

**Files:**
- Create: `web/src/design/ui/Icon.tsx`, `Pending.tsx`, `Modal.tsx`, 각 `.test.tsx`
- Modify: `web/src/design/ui/Button.tsx`, `Card.tsx`, `index.ts`
- Create: `LICENSES/Lucide-ISC.txt`(저장소 루트)

**Interfaces:**
- `Icon({ name: IconName; size?: 16 | 20 | 24; label?: string; className?: string })` —
  `IconName = 'check' | 'alert' | 'external' | 'download' | 'chevron-down' | 'sun' | 'moon' | 'monitor' |
  'refresh' | 'settings'`. Lucide 경로 복사, `fill="none" stroke="currentColor" strokeWidth={1.75}`.
  `label` 없으면 `aria-hidden="true"`, 있으면 `role="img" aria-label`.
- `Pending({ delayMs?: number (기본 200); label?: string (기본 '불러오는 중'); className?: string })`
  — delay 전엔 null, 이후 `aria-busy="true"` 펄스 블록(테두리 없음, `bg-[var(--surface-sunken)]`,
  `role=status` 없음 — 콤보박스 status 가 첫 status 로 남아야 한다). `minMs` 는 자식이 강제할 수 없어 뺐다.
- `Modal({ open: boolean; onClose: () => void; title: string; id: string; children })` — `role="dialog"
  aria-modal="true" aria-labelledby`, 오버레이 클릭·Escape 로 `onClose`, 열릴 때 제목으로 포커스, 닫힐
  때 이전 포커스 복귀. 네이티브 `<dialog>` 대신 div — jsdom 의 `showModal` 미구현 때문. `aria-modal`
  만으로는 Tab 이 밖으로 나가므로 열려 있는 동안 `document.getElementById('root')` 의 형제가 아닌
  **앱 콘텐츠 래퍼**(`App` 의 `<div data-app-root>`)에 `inert` 를 건다(React 19 prop) — 모달은
  `createPortal` 로 `document.body` 에 그린다. 테스트: 열렸을 때 `[data-app-root]` 가 `inert` 를 가진다.
- `Button`: 변형 유지(primary 알약 잉크색 / secondary / ghost / danger). `active:enabled:translate-y-px`,
  `whitespace-nowrap`, SIZES `sm h-8 px-3` · `md h-9 px-4` · `lg h-11 px-6`(토큰 간격 사용).
- `Card`: eyebrow prop 삭제, 그림자 없음, 헤더는 `border-b`. `CardProps` 에서 `eyebrow` 제거.

- [ ] **Step 1: 실패하는 테스트 — Icon·Pending·Modal**

```tsx
// Icon.test.tsx
it('라벨이 없으면 장식이다', () => { render(<Icon name="check" />); expect(document.querySelector('svg')).toHaveAttribute('aria-hidden', 'true') })
it('라벨이 있으면 이름을 가진 그림이다', () => { render(<Icon name="alert" label="경고" />); expect(screen.getByRole('img', { name: '경고' })).toBeInTheDocument() })
it('10개 이름이 전부 경로를 가진다', () => { for (const n of ICON_NAMES) { const { unmount } = render(<Icon name={n} />); expect(document.querySelector('svg path, svg circle, svg line, svg rect')).not.toBeNull(); unmount() } })

// Pending.test.tsx (vi.useFakeTimers)
it('200ms 전에는 아무것도 그리지 않는다', ...) // advanceTimersByTime(199) → container.firstChild null
it('200ms 뒤에 aria-busy 블록을 그린다', ...)  // advanceTimersByTime(1) → role? querySelector('[aria-busy="true"]')

// Modal.test.tsx
it('열리면 dialog 이고 제목으로 포커스가 간다', ...)
it('Escape 와 오버레이 클릭으로 닫힌다', ...)  // onClose 호출 2회
it('axe 위반이 없다', ...)
```

- [ ] **Step 2: 실패 확인** → `npx vitest run src/design/ui` FAIL(모듈 없음)

- [ ] **Step 3: 구현** — 위 시그니처대로. `Icon.tsx` 머리에 Lucide ISC 출처 주석, `LICENSES/Lucide-ISC.txt`
  에 라이선스 전문. `Card.tsx` 에서 eyebrow 분기 제거. `Card` 에 `eyebrow=` 를 넘기는 호출부도 지운다:
  `App.tsx:102,113`, `Step2Metrics.tsx:104`, `Step3Charts.tsx:52,65,84,95`, 그리고
  `grep -rn eyebrow web/src --include=*.stories.tsx` 가 찍는 스토리. (`HomeHero`·`MediaBand` 의 자체
  `eyebrow` prop 은 Task 5 에서 컴포넌트와 함께 사라진다 — 여기서 건드리지 않는다.)

- [ ] **Step 4: 통과 확인** → `npx tsc -b --noEmit && npx vitest run` PASS

- [ ] **Step 5: 체크포인트** — `design(ui): Icon·Pending·Modal 프리미티브, Button active 상태, Card eyebrow 제거`

---

### Task 5: 홈 셸 — 활자 히어로, 신뢰 띠, 쓰임 띠, 사진·3D 삭제

**Files:**
- Modify: `web/src/App.tsx`(전면), `web/src/components/HomeHero/HomeHero.tsx`(전면),
  `HomeHero.test.tsx`(전면), `HomeHero/index.ts`
- Delete: `web/src/components/HomeHero/scene.ts`, `capability.ts`, `web/src/components/MediaBand/`(폴더),
  `web/public/media/`, `scripts/fetch_media.py`
- Modify: `web/src/features/wizard/WizardShell.tsx`(`dataset` 을 prop 으로 받음, 하단 범위 문장 `<p>` 삭제),
  `web/src/features/wizard/hooks.ts`(`useAsync` 에 `reload`), `web/src/architecture.test.ts:95-100`(three 규칙
  삭제), `web/e2e/shell.spec.ts:56-91`, `scripts/README.md`(fetch_media 항목 삭제)
- Modify: `web/package.json`(`three`, `@types/three` 제거), `web/scripts/check-bundle.mjs:10`(주석)
- Modify: `tests/api/test_web_serving.py:61` — `/media/hero.webp` 200 단언을 `/fonts/fonts.css` 로 바꾼다
  (검증 대상은 "dist 아래 정적 파일이 `app.frontend` 로 나간다" 이고 파일명은 우연이다; 지우면 pytest 가 깨진다)
- Modify: `README.md:116,233,298`(구조도 `public/media` 행, `fetch_media.py` 명령, "히어로 배경이 비어 있다" 행 삭제),
  `docs/ARCHITECTURE.md:174-182`(§미디어 절 → Task 11 에서 §글꼴로 다시 쓰되 여기서 fetch_media 언급은 지운다)

**Interfaces:**
- `HomeHero({ dataset: DatasetInfo | null; onStart: () => void })` — 렌더: meta 한 줄 "기획처·IR센터·
  평가 담당자를 위한", `<h1>` "우리 대학은 몇 번째인가"(`text-display font-[family-name:var(--font-serif)]`),
  `<p>` 부제(스펙 §2 문장), `<Button variant="primary" className="md:hidden">분석 시작</Button>`,
  신뢰 띠 `<ul aria-label="자료 범위">`: "자료 대학알리미 「7-가. 전임교원의 연구 실적」" · "공시
  {years[0]}–{years.at(-1)}년" · `dataset.nationalRankScopeNote` 원문 · "매년 8월 말 공시 반영".
  `dataset` 이 null 이면 띠의 데이터 항목 둘을 **렌더하지 않고** 고정 항목 둘만 그린다(빈 괄호 금지).
  `data-testid="hero-static"` 는 배경 장식 레이어(`aria-hidden="true"`, 활자 뒤 옅은 sunken 면)에 유지.
- `App`: `const dataset = useDataset()` 를 App 이 들고 `HomeHero`·`WizardShell` 에 `dataset` 전달;
  `onStart` 는 `document.getElementById('wizard')?.scrollIntoView()` 후 `university-input` 포커스.
  MediaBand 자리에 `<section aria-label="어디에 쓰는가">`(sunken 띠, h2 "어디에 쓰는가" + 스펙 §2 4행
  문구). 모듈 내비 `<nav aria-label="분석 모듈">` 와 `data-testid="module-*"` 마크업은 유지하고 스타일만
  밑줄 탭으로(shell.spec 이 '준비 중'·'Coming Soon' 부재와 testid 를 본다). 푸터: "출처: 대학알리미
  전임교원 연구실적 공시자료" · "글꼴: Pretendard·Hahmlet (SIL OFL)".
- **범위 문장은 페이지에 한 번만**: WizardShell 하단의 `nationalRankScopeNote` `<p>` 를 이 태스크에서
  지운다 — shell.spec 의 `getByText(/등재된 사립 \d+개교 기준/)` 는 strict 단일 일치다.
- `useAsync` → `Async<T> & { reload(): void }`(모듈 내부 함수 그대로, 반환 타입만 넓힌다).

- [ ] **Step 1: 실패하는 테스트 — HomeHero 재작성**

```tsx
const dataset = { years: [2016, 2026], regions: [], universityCount: 133, universities: [], nationalRankScopeNote: '전국순위는 대학알리미에 등재된 사립 133개교 기준이다.' }
it('표제와 부제를 보여준다', () => { render(<HomeHero dataset={dataset} onStart={() => {}} />); expect(screen.getByRole('heading', { level: 1, name: '우리 대학은 몇 번째인가' })).toBeInTheDocument() })
it('신뢰 띠에 서버의 범위 문장을 그대로 보여준다', () => { ...; expect(screen.getByText(/등재된 사립 133개교 기준/)).toBeInTheDocument(); expect(screen.getByText('공시 2016–2026년')).toBeInTheDocument() })
it('데이터가 아직 없으면 숫자 항목을 비워 두지 않고 생략한다', () => { render(<HomeHero dataset={null} onStart={() => {}} />); expect(document.body.textContent).not.toMatch(/undefined|–년|개교 기준/) })
it('분석 시작을 누르면 onStart 가 불린다', ...)
it('장식 레이어는 보조 기술에서 감춘다', () => { expect(screen.getByTestId('hero-static')).toHaveAttribute('aria-hidden', 'true') })
it('사진·캔버스가 없다', () => { expect(document.querySelector('img, canvas')).toBeNull() })
it('axe 위반이 없다', ...)
```

- [ ] **Step 2: 실패 확인** → FAIL(새 props)

- [ ] **Step 3: 삭제 전 참조 확인(계획 시점에 끝냄)** — 저장소 전체 grep 결과: `tests/api/test_web_serving.py:61`,
  `README.md:116,233,298`, `docs/ARCHITECTURE.md:174,182`, `App.tsx:6,32-33,150-159`, `HomeHero.tsx:11`,
  `web/public/media/CREDITS.md`(폴더와 함께 삭제). `word/media/` 매치는 docx 내부 경로라 무관. 설치본
  스크립트는 `web/dist` 전체를 복사하므로 파일 목록을 들고 있지 않다. 위 Files 가 전부다.

- [ ] **Step 4: HomeHero·App 구현, MediaBand·scene·capability·`public/media`·`fetch_media.py` 삭제, three 제거**

Run after: `npm uninstall three @types/three`

- [ ] **Step 5: shell.spec 갱신** — `:60-63` 을 새 h1/부제로; `:66-75` reduced-motion 테스트는 `hero-static` 존재만 남기고 `hero-canvas` 단언 삭제; `:77-91` three 청크 테스트 삭제. `architecture.test.ts:95-100` 삭제.
  스토리: HomeHero·MediaBand 에는 스토리가 없다(현재 스토리 6개: CompareTable·DataUpdatePanel·MetricCard·TrendChart·YearPicker·YoYPanel).

- [ ] **Step 6: `useAsync.reload`** — `hooks.ts` 에 `tick` 상태를 두고 `key` 와 함께 의존성에 넣는다;
  WizardShell 의 `api-error` 배너에 `<Button size="sm" onClick={dataset.reload}>다시 시도</Button>`.
  테스트: `hooks.test.ts` 신규 — 실패 후 `reload()` 가 재요청한다(fetch mock 호출 2회).

- [ ] **Step 7: 통과 확인**

Run: `npx tsc -b --noEmit && npx vitest run && npm run build && npm run build-storybook -- --quiet`
Expected: PASS; 빌드 출력에 `지연 JS 0.0 KB`, 초기 JS ≤ 200KB; Storybook 이 삭제된 스토리 없이 빌드된다.

- [ ] **Step 8: e2e 셸 테스트** → `$env:API_PORT='8010'; npx playwright test e2e/shell.spec.ts` PASS

- [ ] **Step 9: 체크포인트** — `feat(web): 활자 히어로·신뢰 띠·쓰임 띠, 사진·three.js·MediaBand 제거`

---

### Task 6: 상단바·스텝 스트립·컨텍스트 바·마법사 셸

**Files:**
- Modify: `web/src/components/AppBar/AppBar.tsx`, `web/src/components/StepNav/StepNav.tsx`, `StepNav.test.tsx`
- Create: `web/src/components/ContextBar/{ContextBar.tsx, ContextBar.test.tsx, index.ts}`
- Modify: `web/src/features/wizard/WizardShell.tsx`, `web/src/features/wizard/steps/types.ts`
  (`eyebrow` 삭제), `registry.ts`(eyebrow 삭제, description 합쇼체), `web/e2e/wizard.spec.ts`

**Interfaces:**
- `AppBar` props 유지. 렌더: 불투명 `bg-[var(--surface-base)] border-b`, `h-[var(--appbar-h)]`, 로고는
  텍스트 워드마크만(사각형 'R' 삭제), 테마 세그먼트는 ≥640px 텍스트 라벨 / <640px `Icon`(sun/moon/
  monitor) + `aria-label`(라이트/다크/시스템) — 접근성 이름은 양쪽 동일. `actions` 슬롯 유지.
- `StepNav` props 유지(`current, maxStep, onSelect`). ≥768px: `<ol class="grid grid-cols-5">` 각 `<li>`
  에 `<button data-testid=step-N data-state aria-current disabled aria-label>` + 아래 2px 선
  (`border-b-2`, 현재 `--accent`, 도달 `--border-strong`, 미도달 `--border-subtle`), 라벨 텍스트
  `{label}` 한 노드. <768px: 버튼 5개는 8px 점 + 44px 히트 영역, 라벨 `sr-only`; 그 왼쪽에 한 텍스트
  노드 `"{current} / 5 · {label}"`(단일 노드라 `getByText('데이터 설정')` 정확 일치에 걸리지 않음).
  잠긴 단계는 `opacity` 대신 `text-[var(--text-muted)]`.
- `ContextBar({ stats: StatsResponse; onChange: () => void })` — 루트 `data-testid="context-bar"`,
  `sticky top-[var(--appbar-h)] h-[var(--contextbar-h)]`,
  텍스트 `{university} · {regionName} · {year}년 공시 · {Object.keys(trend).length}개년 · 비교군 {compare.length}개교`,
  오른쪽 `<Button size="sm" variant="ghost" data-testid="context-change">변경</Button>`.
- `WizardShell`: `dataset` prop; `state.stats && state.step > 1` 일 때 `ContextBar` 렌더(onChange →
  `goto(1)`); 헤더 eyebrow 삭제, `<h2 ref tabIndex={-1} className="text-title font-[family-name:var(--font-serif)]">`,
  단계 전환 시 `h2.focus({ preventScroll: false })`; `next-button` 라벨 `다음: {stepAt(state.step + 1)?.title}`
  (`registry.stepAt`; 마지막 단계에서는 버튼을 그리지 않는 현재 동작 유지), `blocked` 문구는 `<span id>` +
  `aria-describedby`; nav 는 <768px `sticky bottom-0 h-[var(--actionbar-h)]` `pb-[env(safe-area-inset-bottom)]`
  `bg-[var(--surface-base)] border-t`; 버튼 순서 `[처음부터 다시] … [이전][다음]`. 하단 범위 문장 `<p>` 는
  Task 5 에서 이미 지웠다.

- [ ] **Step 1: 실패하는 테스트**

```tsx
// ContextBar.test.tsx
it('대상·권역·연도·개년·비교군을 한 줄로 보여준다', () => { render(<ContextBar stats={stats} onChange={fn} />); expect(screen.getByText(/호서대학교 · 충청권 · 2026년 공시 · 11개년 · 비교군 5개교/)).toBeInTheDocument() })
it('변경을 누르면 onChange', ...)
it('axe', ...)
// StepNav.test.tsx 추가
it('라벨은 DOM 에 정확히 한 노드다', () => { render(<StepNav current={1} maxStep={5} onSelect={() => {}} />); expect(screen.getAllByText('데이터 설정')).toHaveLength(1) })
it('잠긴 단계도 글자색으로 읽힌다 — opacity 를 쓰지 않는다', () => { expect(screen.getByTestId('step-5').className).not.toMatch(/opacity/) })
```

e2e(`wizard.spec.ts`) 추가:

```ts
test('다음 버튼이 다음 단계 이름을 말한다', async ({ page }) => { await page.goto('/'); await expect(page.getByTestId('next-button')).toHaveText('다음: 통계 확인') })
test('2단계부터 컨텍스트 바가 대상을 보여준다', async ({ page }) => { await loadAndAdvance(page); await expect(page.getByTestId('context-bar')).toContainText('호서대학교'); await page.getByTestId('context-change').click(); await expect(page.getByTestId('step-1')).toHaveAttribute('aria-current', 'step') })
```

- [ ] **Step 2: 실패 확인** → vitest FAIL(모듈 없음), e2e FAIL

- [ ] **Step 3: 구현** — e2e 는 `next-button` 을 `.click()`·`.toBeDisabled()` 로만 쓴다(계획 시점에 확인) —
  라벨 변경은 안전하다. Interfaces 대로.
  `StepDefinition.eyebrow` 제거 후 `registry.ts` 5항목의 `eyebrow` 삭제,
  `description` 을 합쇼체로(스펙 §5 문장: "분석할 대학과 연도를 고르고 비교군을 정합니다." / "보고서에
  실릴 숫자입니다. 순위 변화는 양수가 개선입니다." / "아래 차트 5장이 그대로 Word 에 들어갑니다.
  여기서 본 것과 문서가 다르지 않습니다." / "절마다 초안을 만들고 직접 고칩니다. 단계를 오가도
  사라지지 않습니다." / "내려받기 전 마지막으로 확인합니다. 아래 내용이 그대로 문서가 됩니다.").

- [ ] **Step 4: 통과 확인** → `npx tsc -b --noEmit && npx vitest run` PASS; `$env:API_PORT='8010'; npx playwright test` 전체 PASS(스텝 이동·리셋 계약이 전부 이 셸을 지난다)

- [ ] **Step 5: 체크포인트** — `feat(web): 불투명 상단바, 밑줄 스텝 스트립, 컨텍스트 바, 단계 이름 붙은 다음 버튼`

---

### Task 7: 설정·데이터 갱신 모달, 드롭존 입력

**Files:**
- Modify: `web/src/App.tsx`(패널 → `Modal`), `web/src/components/DataUpdatePanel/DataUpdatePanel.tsx:77-93`,
  `web/src/components/SettingsPanel/SettingsPanel.tsx`(레이아웃만)

**Interfaces:**
- Consumes: `Modal` from `design/ui`(Task 4).
- App: `settings-toggle`/`data-update-toggle` 는 `aria-expanded`·`aria-controls="settings-panel"|"data-update-panel"`
  유지; `Modal id` 가 그 값. 모바일(<640px)에서 두 버튼은 `Icon`(settings/refresh) + `sr-only` 텍스트
  "설정"/"데이터 갱신"(접근성 이름 동일).
- DataUpdatePanel: `<label>` 드롭존(점선 테두리 `border-dashed`, 안내 문구 "xlsx 를 끌어다 놓거나
  눌러서 고릅니다") 안에 `<input type="file" … className="sr-only" data-testid="raw-file-input"
  aria-label="Raw Excel 파일">` — `sr-only` 까지만(hidden 금지: e2e `toBeVisible`).

- [ ] **Step 1: 실패하는 테스트** — `DataUpdatePanel.test.tsx` 추가: `it('파일 입력은 숨기되 display:none 은 아니다', () => { const input = screen.getByTestId('raw-file-input'); expect(input.className).toMatch(/sr-only/); expect(getComputedStyle(input).display).not.toBe('none') })`

- [ ] **Step 2: 실패 확인** → FAIL

- [ ] **Step 3: 구현** — App 의 두 `<section>` 카드를 `<Modal id="settings-panel" title="설정" open={settingsOpen} onClose>` /
  `<Modal id="data-update-panel" title="데이터 갱신" …>` 로. 패널 내부 testid·문구는 그대로.

- [ ] **Step 4: 통과 확인** → `npx vitest run src/components/DataUpdatePanel src/components/SettingsPanel` PASS;
  `$env:API_PORT='8010'; npx playwright test -g "데이터 갱신|API 키|설정"` PASS(`data-update-toggle` → `raw-file-input` visible,
  `settings-toggle` → `settings-status` 계약)

- [ ] **Step 5: 체크포인트** — `feat(web): 설정·데이터 갱신을 모달로, 드롭존 파일 입력`

---

### Task 8: 1단계 로드 버튼 · 2단계 지표 띠, "답 하나", 캡션·각주

**Files:**
- Modify: `web/src/features/wizard/steps/Step1Target.tsx:222-230`, Create: `Step1Target.test.tsx`
- Modify: `web/src/components/MetricCard/MetricCard.tsx`, `types.ts`, `MetricCard.test.tsx`, `MetricCard.stories.tsx`
- Modify: `web/src/features/wizard/steps/Step2Metrics.tsx`, `Step2Metrics.test.tsx`(Task 3 파일 확장)
- Modify: `web/src/components/YearTable/YearTable.tsx`(캡션 위 자료기준일 줄)

**Interfaces:**
- Step1Target `load-button`: `state.stats` 가 없으면 지금처럼 `variant="primary" size="lg"` 와 현재 문구;
  있으면 `variant="secondary" size="md"` 「다시 불러오기」. 검은 알약은 화면에 `next-button` 하나(§5a 결함 6).
  testid 는 유지 — e2e 는 testid 로만 누르고 이름으로는 찾지 않는다.
- `MetricCardProps` 에 `size?: 'answer' | 'default'`(기본 default), `unit?: string`(값 옆 작은 회색 접미).
  `size="answer"` → 값 `text-kpi font-semibold`, default → `text-kpi-sub`. 카드 자체는 테두리·그림자
  없음(띠의 셀). `null` 값은 `<span className="text-body text-[var(--text-muted)]">—</span>` + 형제
  `<span className="sr-only">자료 없음</span>`. 델타는 `<p data-testid="metric-delta" data-direction>`
  14px 문장 — 화살표(aria-hidden)+라벨은 그대로, 색은 숫자 span 에만.
- Step2Metrics: 4칸을 `<section aria-label="주요 지표" className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 … border rounded-lg">`.
  첫 칸 전국순위 `size="answer"`, 캡션 `"{year}년 공시 · 사립 등재교 기준"` + (`year === Math.max(...dataset.years)` 일 때 — 정렬 순서를 가정하지 않는다)
  `" · {dataset.universityCount}개교"`. 띠 아래 `<p className="text-meta">{dataset.nationalRankScopeNote}</p>`.
  표 Card 위 줄 `"자료기준일 {year}년 8월 공시 · 단위 편·명"`, 표 아래 각주 두 문장(스펙 §5 2단계).

- [ ] **Step 1: 실패하는 테스트**

```tsx
// Step1Target.test.tsx (fetch mock: /api/data → dataset, /api/regions → [], 나머지 미호출)
it('통계가 있으면 로드 버튼이 보조 버튼 다시 불러오기 가 된다', () => { render(<Step1Target state={stateWith(stats)} dataset={dataset} actions={noopActions} />); expect(screen.getByTestId('load-button')).toHaveTextContent('다시 불러오기') })
it('통계가 없으면 문구가 그대로다', () => { render(... stats: null ...); expect(screen.getByTestId('load-button')).not.toHaveTextContent('다시') })
// MetricCard.test.tsx 추가
it('answer 크기는 kpi 토큰을 쓴다', () => { render(<MetricCard label="전국순위" value="71" unit="위" size="answer" />); expect(screen.getByText('71').className).toMatch(/text-kpi(?!-sub)/) })
it('null 은 작은 대시 한 노드와 sr 설명이다', () => { render(<MetricCard label="권역순위" value={null} />); expect(screen.getByText('—').className).toMatch(/text-body/); expect(screen.getByText('자료 없음')).toHaveClass('sr-only') })
// Step2Metrics.test.tsx 추가
it('기준 연도가 최신이면 대학 수를 붙이고, 아니면 붙이지 않는다', () => {
  render(... year: 2026, dataset.years=[2016..2026], universityCount: 133 ...) → expect(screen.getByText(/2026년 공시 · 사립 등재교 기준 · 133개교/))
  render(... year: 2024 ...) → expect(screen.queryByText(/개교/)).toBeNull() (지표 띠 안에서)
})
it('범위 문장을 띠 아래에 보여준다', () => { expect(screen.getByText(/등재된 사립 133개교 기준/)).toBeInTheDocument() })
```

- [ ] **Step 2: 실패 확인** → FAIL

- [ ] **Step 3: 구현** — Interfaces 대로. 기존 MetricCard 테스트(라벨·값·▲▼·`—`·sr 라벨·HTML 이스케이프·
  스켈레톤)는 그대로 통과해야 한다.

- [ ] **Step 4: 통과 확인** → `npx vitest run src/components/MetricCard src/features` PASS; 스토리 `MetricCard.stories.tsx` 에 `답` 스토리 추가 후 `npm run build-storybook -- --quiet` PASS

- [ ] **Step 5: 체크포인트** — `feat(web): 1단계 재로드는 보조 버튼, 2단계 지표 띠와 답 숫자 하나, 공시 기준 캡션`

---

### Task 9: 3단계 — 차트 5장, 헤어라인 섹션, 비율 예약, 재시도

**Files:**
- Modify: `web/src/components/ChartGallery/ChartGallery.tsx`, `ChartGallery.test.tsx`
- Modify: `web/src/features/wizard/steps/Step3Charts.tsx`
- Modify: `web/src/components/YoYPanel/YoYPanel.tsx:108-115`(EntryList 테두리 → divide-x)
- Modify: `web/e2e/wizard.spec.ts:213-231`(4종 → 5종)

**Interfaces:**
- `ChartGallery` props 유지 + `layout?: 'gallery' | 'list'`(기본 gallery). figure: 테두리·패딩 없음,
  `<figcaption>` 위(`text-heading`), `<img>` 는 `aspect-[var(--chart-aspect-{kind})] w-full` 로 자리 예약,
  `<img>` 래퍼는 `bg-[var(--chart-matte)] p-[var(--spacing-3)] rounded-[var(--radius-md)]`(Task 1 토큰 —
  다크에서도 흰 매트). 로딩은 `<Pending>`(200ms). 실패 시 `role=alert` "차트를 그리지 못했다.
  보고서에도 이 그림은 빠진다." + `<Button size="sm" onClick={retry}>다시 그리기</Button>` — retry 는
  `src` 에 `&r={n}` 을 붙여 재요청. `trend` figure 는 `lg:col-span-2`.
- Step3Charts: Card 중첩 대신 `<section>` 셋(각 `border-t pt-5`, `<h3 className="text-heading">`):
  ① "Word 에 들어가는 차트" — `kinds={['trend','avg','bar','rank','compare']}`(Word 순서); trend figure
  아래 `<details><summary>값을 짚어 읽기 (인터랙티브)</summary><TrendChart …/></details>`;
  ② 비교군 표; ③ 전년 대비.

- [ ] **Step 1: 실패하는 테스트**

```tsx
// ChartGallery.test.tsx 추가
it('종류별 비율 토큰으로 자리를 예약한다', () => { render(<ChartGallery {...base} kinds={['rank']} />); expect(screen.getByRole('img').className).toMatch(/--chart-aspect-rank/) })
it('실패한 그림만 다시 그릴 수 있다', () => { render(<ChartGallery {...base} kinds={['avg','bar']} />); fireEvent.error(screen.getAllByRole('img')[0]); fireEvent.click(screen.getByRole('button', { name: '다시 그리기' })); expect(screen.getAllByRole('img')).toHaveLength(2); expect(screen.getAllByRole('img')[0].getAttribute('src')).toMatch(/[&?]r=1/) })
it('figure 에 테두리가 없다', () => { expect(screen.getByTestId('chart-rank').className).not.toMatch(/border/) })
```

e2e `:213` 테스트 이름을 "3단계에 Word 에 실릴 차트 5종이 모두 뜬다" 로, 배열에 `'trend'` 추가.

- [ ] **Step 2: 실패 확인** → FAIL

- [ ] **Step 3: 구현** — Interfaces 대로. 비율 값은 `core/chart_generator.py` 의 `figsize` 와 대조한다
  (trend (9,5), bar (12,6), avg (8,4), rank (12,5), compare (8,5)).

- [ ] **Step 4: 통과 확인** → `npx vitest run src/components/ChartGallery src/components/YoYPanel` PASS; `$env:API_PORT='8010'; npx playwright test -g "3단계|차트|화면 폭"` PASS

- [ ] **Step 5: 체크포인트** — `feat(web): 3단계에 추이 PNG 포함 5장, 헤어라인 섹션, 비율 예약, 재시도`

---

### Task 10: 4단계 키 상태 분기 · 5단계 내려받기 전 확인

**Files:**
- Modify: `web/src/features/wizard/steps/Step4Narrative.tsx`, `Step5Report.tsx`, `web/src/features/wizard/hooks.ts`
- Create: `web/src/features/wizard/steps/Step4Narrative.test.tsx`, `Step5Report.test.tsx`

**Interfaces:**
- `hooks.ts` 에 `export function useSettings(): Async<SettingsResponse> & { reload(): void }` =
  `useAsync('settings', () => api.settings())`(`useAsync` 는 모듈 내부 그대로).
- Step4: 마운트 시 `useSettings()` 1회. 상태 (a) `apiKeyConfigured` →
  현재 UI; (b) `!configured && canPersist` → `<section>` 안내 "GPT 서술을 쓰려면 OpenAI 키가
  필요합니다. 키는 이 PC 의 서버에만 저장됩니다." + `<SettingsPanel onClose={noop} />` 임베드 +
  `generate-button` 은 **그대로 렌더**; (c) `!configured && !canPersist` → 안내 "이 서버에는 GPT 서술
  생성이 꺼져 있습니다. 절을 직접 쓰거나 비워 두면 문서에는 제목만 들어갑니다." + `generate-button`
  을 `variant="secondary"` 로 **렌더 유지**(V16 e2e 계약). 503 detail 의 `**` 는 화면에서 `replace(/\*\*/g, '')`.
  절 섹션 `border-t`, textarea `text-body`(<640px `text-base` 16px 는 토큰 `--text-lead` 16px 사용).
- Step5: `max-w-[var(--container-prose)]`; 구획 3개 `<section>`(각 `border-t`, h3, 오른쪽 `<Button
  size="sm" variant="ghost" data-testid="change-{scope|charts|narratives}">변경</Button>` → `goto(1|3|4)`):
  ① 분석 범위 `<dl>`(대상·권역·기준 연도·분석 N개년(`Object.keys(trend)`)·비교군 `compare.length`개교);
  ② 차트 5장 — `<ol data-testid="chart-list">` 텍스트: 연도별 1인당 논문 수 추이 · 평균 대비 위치 ·
  권역 내 전체 대학 비교 · 순위 변화 추이 · 비교군 대학 비교, 아래 "3단계에서 확인한 그대로 들어갑니다."; ③ 서술 4절 — 각 절
  `line-clamp-2` 미리보기 + `{n}자` / `비어 있음 — 제목만 들어간다`. `report-summary` testid 는 ①~③을
  감싸는 컨테이너에. 내려받기 성공 → `<p role="status" data-testid="report-done">내려받았습니다 —
  {filename}</p>` + `<Button variant="ghost">다시 내려받기</Button>`. busy 라벨 "차트 5장을 그리고 문서를
  조립하는 중…".

- [ ] **Step 1: 실패하는 테스트**

```tsx
// Step4Narrative.test.tsx (fetch mock → /api/settings)
it('키가 없고 저장 불가면 안내문과 함께 생성 버튼을 그대로 둔다', async () => { mock({ apiKeyConfigured: false, canPersist: false }); render(...); await screen.findByText(/GPT 서술 생성이 꺼져 있습니다/); expect(screen.getByTestId('generate-button')).toBeInTheDocument() })
it('키가 없고 저장 가능하면 설정 폼을 임베드한다', async () => { mock({ apiKeyConfigured: false, canPersist: true }); render(...); expect(await screen.findByTestId('api-key-input')).toBeInTheDocument() })
it('키가 있으면 안내문이 없다', ...)
// Step5Report.test.tsx
it('구획마다 변경 버튼이 해당 단계로 간다', async () => { ...click change-scope → goto(1), change-charts → goto(3), change-narratives → goto(4) })
it('차트는 썸네일이 아니라 다섯 줄 목록이다', () => { expect(within(screen.getByTestId('chart-list')).getAllByRole('listitem')).toHaveLength(5); expect(document.querySelector('img')).toBeNull() })
it('내려받으면 파일명을 알린다', async () => { fetch mock → blob + Content-Disposition; click download-button; expect(await screen.findByTestId('report-done')).toHaveTextContent('내려받았습니다') })
```

- [ ] **Step 2: 실패 확인** → FAIL

- [ ] **Step 3: 구현** — Interfaces 대로.

- [ ] **Step 4: 통과 확인** → `npx vitest run src/features` PASS; `$env:API_PORT='8010'; npx playwright test e2e/wizard.spec.ts` PASS(`generate-button`·`narrative-error`·`report-summary`·`download-button` 계약)

- [ ] **Step 5: 체크포인트** — `feat(web): 4단계 키 상태 분기, 5단계 내려받기 전 확인 화면`

---

### Task 11: 타입 스케일 스윕·옛 토큰 삭제·문서·전체 게이트·시각 검증

**Files:**
- Modify: 모든 `web/src/**/*.tsx` 의 `text-xs/sm/base/lg/xl/2xl/3xl`·`font-bold` → 토큰 유틸리티·600 이하
- Modify: `web/src/design/tokens.css`(옛 토큰 삭제), `tokens.test.ts`(Tailwind 기본 크기 금지 검사)
- Modify: `web/src/components/YearPicker/YearPicker.tsx`(칩 `rounded-[var(--radius-md)]`, 프리셋은 ghost 텍스트)
- Modify: `web/src/components/TrendChart/TrendChart.tsx:19-20`(`--border-strong` 제거 → `--text-secondary`/`--text-muted`/`--color-neutral`)
- Modify: `README.md`(디렉토리 구조·기술 스택·문제 해결·Vercel 절), `CLAUDE.md`(토큰 경로 `web/src/design/tokens.css`, 3D 항목 삭제), `docs/ARCHITECTURE.md`(§미디어 → §글꼴, three 예외 삭제)
- Modify: `web/e2e/wizard.spec.ts`(320px 뷰포트 overflow 테스트)

- [ ] **Step 1: 실패하는 테스트 — Tailwind 기본 크기 금지**

`tokens.test.ts`:
```ts
it('컴포넌트가 Tailwind 기본 글자 크기를 직접 쓰지 않는다', () => {
  // componentSources() 에서 /\btext-(xs|sm|base|lg|[2-9]xl)\b/ 매치 → 파일:줄 목록 → toEqual([])
})
it('700 이상 굵기를 쓰지 않는다', () => { /\bfont-(bold|extrabold|black)\b/ → [] })
```

- [ ] **Step 2: 실패 확인** → FAIL(현재 수십 건)

- [ ] **Step 3: 스윕** — 매치마다 토큰 유틸리티로: 12px 캡션 → `text-meta`, 14px UI → `text-body`,
  16px → `text-lead`(설명) 또는 `text-heading`(소제목, 600), 18–20px 소제목 → `text-heading`,
  `font-bold` → `font-semibold`. `CompareTable` 숫자 셀 className 의 `var(--font-numeric)` 리터럴은
  유지. 테스트가 className 을 보는 곳(`CompareTable.test:215`, Task 8·9 추가분)을 깨지 않는지 확인.

- [ ] **Step 4: 옛 토큰 삭제** — `--text-eyebrow`, `--scrim-*`, `--surface-overlay`, `--shadow-sm/md`,
  `--color-brand-*`, `--color-ink-*`(세 블록 모두). 그런 뒤 `grep -rn "scrim-\|surface-overlay\|shadow-sm\|shadow-md\|brand-\|ink-" web/src` 가 0건.

- [ ] **Step 5: 320px e2e**

```ts
test('320px 에서도 가로 넘침이 없고 콤보박스 상태가 첫 status 다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await loadAndAdvance(page); await page.getByTestId('next-button').click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0)
  await page.getByTestId('step-1').click()
  await expect(page.getByRole('status').first()).toContainText(/개교에서 고른다/)
})
```

- [ ] **Step 6: 문서** — README 구조도에서 `public/media` → `public/fonts`, 기술 스택 표의 3D 행 삭제,
  "히어로 배경이 비어 있다" 행 삭제, 글꼴 행 추가("Pretendard·Hahmlet 번들, `scripts/build_fonts.py`");
  CLAUDE.md 5번 항목 경로 수정; ARCHITECTURE §미디어를 §글꼴로.

- [ ] **Step 7: 전체 게이트**

Run(web/): `npx tsc -b --noEmit && npx vitest run && npm run build && npm run build-storybook -- --quiet`
Run(루트): `.venv\Scripts\python.exe -m pytest -q -m "not live"` 와 3.11 venv 동일
Run e2e: `$env:API_PORT='8010'; npx playwright test`
Expected: 전부 PASS; 번들 4줄 OK; pytest 355+5 passed / 6 xfailed.

- [ ] **Step 8: 시각 검증** — Playwright 로 1440×900·390×844 × 라이트·다크 × (홈, 1단계 로드 후, 2, 3, 4, 5단계,
  설정 모달) 스크린샷을 스크래치패드에 찍고 Read 로 본다. 확인 항목: 세리프가 h1·h2 에만, 검은 알약이
  화면당 하나, 차트 축 글자가 읽히는가(trend 가로 ≥ 1100px@1440), 다크에서 PNG 매트, 12px 글자 대비,
  모바일 상단바 한 줄·표 한 줄 높이. 문제는 해당 태스크 파일로 돌아가 고친다(최대 3라운드).

- [ ] **Step 9: 프리뷰 배포로 실기 확인** — `vercel deploy`(프리뷰) 후 `vercel curl` 로 `/fonts/fonts.css` 와
  `/assets/*.css` 의 `Cache-Control: … immutable` 확인; 프리뷰 URL 에서 Playwright 로 Task 11 Step 8 과 같은
  스크린샷 세트를 찍어 로컬과 같은지 본다(보호 우회 토큰은 배포 메모리 파일 참조).
  **프로덕션 배포(`--prod`)는 사용자 확인 뒤에.**

- [ ] **Step 10: 체크포인트** — `refactor(web): 타입 스케일 토큰화, 옛 토큰 제거, 문서 갱신` — 사용자에게 커밋
  단위(태스크 11개) 제안.
