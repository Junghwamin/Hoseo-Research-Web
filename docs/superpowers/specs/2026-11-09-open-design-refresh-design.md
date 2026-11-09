# open-design 적용 리프레시 — 설계

작성 2026-11-09. 요청 두 건을 한 작업으로 묶는다.

> "이거 vercel에 배포했었는데 지금 메인사이트에 api넣는 공간이 없을 뿐더러 새로운 데이터들을
> 추가해서 분석해볼수있는 것도 없는데"
>
> "추가로 지금 디자인하고 문구등이 맘에 안드는데 https://github.com/nexu-io/open-design.git
> 여기거 적용해서 디자인과 문구, 아티팩트등 모두 업데이트해줘 AI티 안나고 깔끔하도록"

아래 결정은 전부 작성자(Claude)의 것이고 사용자는 결과만 본다. 사용자가 실시간으로 답할 수
없는 상태에서 진행했으므로, **되돌리기 지점을 먼저 만들었다**(§15). 방향이 틀리면 한 번에
되돌린다.

산출물 셋. 계획에서도 셋을 분리해 둔다.

| # | 산출물 | 한 줄 |
|---|---|---|
| A | 공개 사이트의 API 키 | 브라우저가 키를 들고 요청마다 보낸다(BYOK). 서버는 키를 저장하지 않는다 |
| B | 공개 사이트의 새 데이터 | 올린 xlsx 를 서버가 메모리에서 계산해 돌려주고, 브라우저가 들고 다니며 분석에 얹는다 |
| C | 디자인·문구·산출물 | open-design 의 `tom-modern` 디자인 시스템과 craft 규칙을 한국어 도구에 맞게 적용한다 |

---

## 1. 진단 — 지금 무엇이 "AI티" 인가

프로덕션(https://hoseo-research-web.vercel.app)은 2026-11-02 리디자인이다. 그 설계가 잘못된
것이 아니라 **그 결과물이 사용자의 눈에 템플릿으로 읽힌다.** 실제 화면(scratchpad
`shots/prod-desktop.png`, `prod-mobile.png`)에서 확인한 것:

1. **크림색 지면 + 세리프 표제.** 2026년 "편집 디자인" 템플릿의 가장 흔한 조합이다. 오른쪽에
   깔린 옅은 면은 아무 정보도 없는 장식이다. 첫 화면 900px 안에 폼이 들어오지 않는다.
2. **해라체 마이크로카피.** "이름을 입력하거나 목록에서 고른다", "134개교에서 고른다",
   "비교군 표와 전년대비가 보는 해다", "먼저 분석을 불러와야 한다". 사람이 쓴 안내문은 이렇게
   끝나지 않는다. 기계가 중얼거리는 느낌이 "AI티" 의 가장 큰 몫이다.
3. **행동을 서술하는 문구.** 힌트가 전부 "사용자가 지금 하는 일" 을 설명한다. 결과를 말해야
   한다(2026-09-15 메모의 미결 항목이기도 하다).
4. **강조색 범람.** 1단계에 코발트 칩 11개 + 밑줄 2개. craft `color.md` 의 상한은 화면당 2회다.
5. **알약 버튼, 회색으로 죽은 주 버튼, 카드 2×2 "쓰임" 띠, 푸터의 글꼴 크레딧.** 전부
   redesign-skill 이 "generic AI pattern" 으로 꼽는 것들이다.

기능 쪽 공백은 설계된 것이었다(`features.ts` 가 `VITE_READONLY_DEPLOY` 로 설정·데이터 갱신
메뉴를 끄고, 서버는 `canPersist=false`·409). 사용자가 원하는 것은 그 설계의 반대다.

## 2. open-design 에서 무엇을 "적용" 하는가

저장소(`nexu-io/open-design`, Apache-2.0)는 디자인 에이전트 작업대다. 우리가 가져오는 것은
네 층 가운데 셋이다.

| 층 | 가져오는 것 | 어디에 |
|---|---|---|
| design-systems | **`tom-modern`** 패키지(`DESIGN.md` + `tokens.css`) | 루트 `DESIGN.md`(브랜드 계약) + `web/src/design/tokens.css`(바인딩) |
| craft | `typography`(CJK 행간·자간 규칙), `color`(강조 ≤2회·대비 게이트), `anti-ai-slop`(7대 죄·80/20), `state-coverage`(5상태·오류 3문장), `typography-hierarchy`(지배 요소 하나), `accessibility-baseline`(터치 24/44px), `laws-of-ux`(근접성 간격·Hick) | 컴포넌트·문구 규칙(§3·§5·§6) |
| skills | `redesign-skill` 의 감사 순서(글꼴 → 색 → 상태 → 레이아웃 → 컴포넌트 → 빈·오류 상태 → 타입 마감)와 콘텐츠 규칙, `critique` 의 5차원 채점표, `impeccable-design-polish` 의 후속 모드 | 작업 순서와 최종 게이트(§13) |

**왜 `tom-modern` 인가.** 151개 패키지 중 손으로 쓴 시스템은 `tom-modern`·`warm-editorial`·
`atelier-zero`·`default`·브랜드 패키지뿐이다(나머지 ~140개는 3KB 짜리 자동 생성 템플릿).
`default` 는 지금 화면(코발트+산세리프)과 같아 바뀐 것이 없고, `warm-editorial` 은 지금
불만의 원인(세리프·크림)을 더 밀어붙이며, `atelier-zero` 는 콜라주 이미지 체계라 데이터 도구에
안 맞고, 브랜드 패키지는 대학 도구가 특정 회사 옷을 입는 것이다. `tom-modern` 은 "편집·기술
문서" 성격 — 중립 지면, 단일 주홍 강조, 직각, 하드 오프셋 그림자, 모노스페이스 메타데이터,
30px 격자 — 으로 데이터·보고서 도구에 맞고, 스스로를 "anti-generic" 으로 규정한다.

**가져오지 않는 것.** OpenDesign 앱·데몬·MCP(우리는 HTML 아티팩트가 아니라 React 코드다),
design-templates(`dashboard` 템플릿의 왼쪽 사이드바는 redesign-skill 자신이 "always has a
left sidebar" 라고 비판한다), 브랜드 시스템, 이모지·그라데이션, 장식 아이콘 세트.

## 3. 시각 체계 — `tom-modern` 의 한국어 적응

원본 계약은 라틴 기준이다. craft `typography.md` 의 **CJK 오버라이드가 우선한다**: 한글
표제에 음수 자간을 쓰지 않고(0 또는 -0.01em), 표제 행간은 1.3 아래로 내리지 않는다.

### 3.1 글꼴

| 역할 | 글꼴 | 굵기 | 비고 |
|---|---|---|---|
| 모든 한글·본문·UI | **Pretendard Variable 1.3.9**(이미 번들) | 400 / 500 / 600 / **700(표제만)** | 변수 글꼴이라 700 은 합성 볼드가 아니다 |
| 숫자·연도·순위·건수·라틴 아이브로·코드·파일명·키 | **Geist Mono Variable 1.7.2**(새로 번들, OFL) | 400 / 500 / 600 | `tom-modern` 의 "machined" 질감은 모노 메타데이터에서 온다 |
| 표제 세리프 | **Hahmlet 삭제** | — | 번들·CSS·토큰·테스트·NOTICE·CREDITS·푸터 문구에서 전부 뺀다 |

- Geist Mono 는 `scripts/build_fonts.py` 가 npm 타르볼 `geist@1.7.2`(sha256
  `88cbfaca51646078f3172802643691bb8fe2df15ca4c455b1b101e49b7d469a6`)에서
  `dist/fonts/geist-mono/GeistMono-Variable.ttf` 를 꺼내 **라틴·숫자·문장부호·화살표·원화만
  서브셋**한 woff2 하나(`web/public/fonts/geist-mono-1.7.2/GeistMono-Variable.latin.woff2`,
  수십 KB)로 만든다. `font-weight: 100 900`. `LICENSE.txt`(OFL 1.1, Copyright (c) 2023
  Vercel, in collaboration with basement.studio)를 `OFL.txt` 로 함께 둔다. Hahmlet 의
  인스턴스·서브셋 코드는 지운다. 한글은 포함하지 않으므로 한글이 섞인 자리에서는 브라우저가
  Pretendard 로 떨어진다 — 그래서 **모노는 숫자·라틴에만 명시적으로** 건다(`--font-numeric`,
  `.eyebrow-mono`), 문장 안의 숫자에는 걸지 않는다.
- 토큰: `--font-sans`(그대로), `--font-mono: 'Geist Mono', ui-monospace, Consolas, 'D2Coding',
  monospace`, `--font-numeric: var(--font-mono)`. `--font-serif` 삭제.
- `fonts.css` 생성기·`manifest.json`·`tests/contract/test_fonts_bundle.py`(Hahmlet 단언 →
  Geist Mono 단언, url 최소 93 → 93 그대로: 92 + 1)·`web/public/fonts/CREDITS.md`·`NOTICE`
  를 함께 바꾼다. CDN 주소는 어디에도 쓰지 않는다(설치본 오프라인).

### 3.2 타입 토큰

8개 이름은 유지하고 값을 다시 맞춘다. `--text-eyebrow` 를 더한다(tom-modern 의 핵심 장치).

| 토큰 | 크기 | 행간 | 자간 | 굵기·글꼴 | 용도 |
|---|---|---|---|---|---|
| `--text-display` | `clamp(2.25rem, 1.4rem + 3.4vw, 3.75rem)` | 1.3 | -0.01em | 700 Pretendard | 홈 h1 하나 |
| `--text-title` | `clamp(1.5rem, 1.3rem + 0.8vw, 1.75rem)` | 1.3 | -0.01em | 700 | 단계 h2 |
| `--text-heading` | 1rem | 1.4 | 0 | 600 | 구획 h3·카드 제목 |
| `--text-lead` | 1.0625rem | 1.65 | 0 | 400 | 히어로 부제·단계 설명 |
| `--text-body` | 0.875rem | 1.6 | 0 | 400 | 본문·표·컨트롤(휴대폰 입력은 16px) |
| `--text-meta` | 0.75rem | 1.5 | 0.01em | 400 | 캡션·각주 — `--text-muted` 와만 |
| `--text-eyebrow` | 0.75rem | 1 | **0.08em** | 600 Pretendard / 500 Geist Mono | 구획 라벨·단계 번호·메타 띠 |
| `--text-kpi` | 2.25rem | 1.05 | -0.02em | 700 Geist Mono | 2단계 "답 하나"(전국순위) |
| `--text-kpi-sub` | 1.5rem | 1.1 | -0.01em | 500 Geist Mono | 나머지 지표 |

- 라틴 대문자 아이브로(`HOSEO`, `OPENAI`, `KPI` 같은 것)는 쓰지 않는다 — 쓸 말이 없다.
  아이브로는 한국어 짧은 명사("자료 현황", "분석 범위")와 숫자("01", "2016–2026")다.
- `tokens.test.ts` 의 "700 이상 금지" 는 Hahmlet 650 하나뿐이던 시절의 규칙이다. Pretendard
  Variable 이 700 을 담고 있으므로 **금지선을 800 이상(`extrabold`·`black`)으로 옮기고
  테스트 메시지에 이유를 적는다.** 표제 둘(h1·h2)과 KPI 숫자만 700 이다.

### 3.3 색 토큰

`tom-modern` 값을 기준으로, 대비는 `tokens.test.ts` 의 WCAG 공식으로 **계산해서** 정한다
(눈대중 금지). 구현자는 아래 값을 넣은 뒤 그 테스트를 돌려 숫자를 확인하고, 미달이면 어둡게
조정한 값을 적어 둔다.

**라이트**

| 토큰 | 값 | 역할 |
|---|---|---|
| `--surface-base` | `#fafafa` | 지면. 30px 격자가 깔린다 |
| `--surface-raised` | `#ffffff` | 프레임·패널·입력 |
| `--surface-sunken` | `#f1f1f3` | 드롭존·비활성·스켈레톤 |
| `--surface-alt` | `rgb(255 255 255 / 0.72)` | 교대 구획(쓰임 띠) — 격자가 비친다 |
| `--surface-inverse` | `#27272a` | (예비) 한 페이지에 한 번 이하 |
| `--border-subtle` | `#d4d4d8` | 헤어라인·행 구분 |
| `--border-strong` | `#8f8f8f` | 프레임 외곽·입력·표 머리 아래. tom-modern 의 `#969696` 은 흰 바탕 2.96:1 이라 UI 요소 3:1 에 미달해 한 단 어둡게(3.2:1) |
| `--text-on-inverse` | `#fafafa` | 역전 면 위 글자(다크 블록과 대칭을 맞추기 위해 라이트에도 둔다) |
| `--text-primary` | `#27272a` | 표제·본문·버튼 |
| `--text-secondary` | `#52525b` | 설명·보조 |
| `--text-muted` | `#696971` | 12px 캡션 — raised·sunken 양쪽에서 ≥4.5:1 (계산 ≈5.4 / ≈4.8) |
| `--text-on-action` | `#ffffff` | 검은 버튼 글자 |
| `--accent` | `#ee5400` | 주홍. **면·선·밑줄·포커스·강조 단어(≥24px 700)에만**. 흰 바탕 ≈3.5:1 — 큰 글자 한정 |
| `--accent-hover` | `#d44a00` | |
| `--accent-soft` | `rgb(238 84 0 / 0.08)` | 선택 행·선택 칩 배경 |
| `--accent-text` | `#b43c00` | 18px 미만 글자에 쓰는 주홍(≈5.6:1) — 링크·"신규" |
| `--action-bg` / `--action-bg-hover` | `#27272a` / `#3f3f46` | 주 버튼. 한 화면에 하나 |
| `--focus-ring` | `#ee5400` | |
| `--shadow-soft` | `4px 4px 0 rgb(150 150 150 / 0.10)` | 프레임 기본 |
| `--shadow-hard` | `8px 8px 0 rgb(150 150 150 / 0.12)` | 호버·모달·드롭다운 |
| `--shadow-lg` | `var(--shadow-hard)` | 옛 이름 별칭(콤보박스가 쓴다). 다음 정리 때 삭제 |
| `--surface-scrim` | `rgb(39 39 42 / 0.45)` | |
| `--grid-line` / `--grid-size` | `rgb(150 150 150 / 0.04)` / `30px` | body 배경 격자 |
| `--color-up` / `-soft` | `#1a7f4b` / 10% | 개선 |
| `--color-down` / `-soft` | `#c8321e` / 10% | 악화 |
| `--color-neutral` / `-soft` | `#52525b` / 10% | |

**다크** — 색 반전이 아니라 **같은 역할의 다른 값**. 세 블록(`[data-theme='dark']`,
`prefers-color-scheme`)의 이름·값이 같아야 한다(테스트가 잰다).

| 토큰 | 값 |
|---|---|
| `--surface-base` / `-raised` / `-sunken` / `-alt` / `-inverse` | `#131316` / `#1b1b1f` / `#0e0e11` / `rgb(27 27 31 / 0.72)` / `#f4f4f5` |
| `--border-subtle` / `-strong` | `#2e2e34` / `#52525b` |
| `--text-primary` / `-secondary` / `-muted` / `-on-action` / `-on-inverse` | `#f4f4f5` / `#b4b4bc` / `#8f8f98` / `#131316` / `#131316` |
| `--accent` / `-hover` / `-soft` / `-text` | `#ff7a33` / `#ff9459` / `rgb(255 122 51 / 0.14)` / `#ff8a4d` |
| `--action-bg` / `-hover` | `#f4f4f5` / `#d4d4d8` (반전) |
| `--focus-ring` | `#ff7a33` |
| `--shadow-soft` / `-hard` | `4px 4px 0 rgb(0 0 0 / 0.5)` / `8px 8px 0 rgb(0 0 0 / 0.55)` |
| `--surface-scrim` | `rgb(0 0 0 / 0.6)` |
| `--grid-line` | `rgb(255 255 255 / 0.035)` |
| `--color-up` / `-down` / `-neutral` (+soft 16%) | `#5fbf8a` / `#ff8a7a` / `#b4b4bc` |

**강조 규율(craft `color.md`).** 화면 한 장에 주홍은 **두 군데**까지다. 1단계: 현재 단계
밑줄 + 기준 연도 표시. 선택된 연도 칩은 **잉크 채움(`--action-bg`) 흰 글자**이지 주홍이
아니다. 모듈 탭 밑줄은 잉크. 표의 강조 행은 `--accent-soft` 배경 + 왼쪽 3px 주홍 막대(1회).
3단계 인터랙티브 추이의 대상 계열은 주홍(그 화면의 1회), 나머지는 회색 점선.

### 3.4 모서리·선·그림자·격자

- **모서리 0.** `--radius-sm/md/lg/xl/full` 전부 `0px`. 알약 버튼·둥근 칩·둥근 카드가 모두
  직각이 된다 — 이것이 `tom-modern` 의 실루엣이다. 컴포넌트 코드는 토큰만 참조하므로 값만
  바꾸면 된다.
- **깊이는 선과 하드 오프셋 그림자.** 블러 그림자는 없다. 프레임(흰 면 + 1px `--border-strong`
  + `--shadow-soft`), 패널(프레임 + 위쪽 4px 주홍 띠 — 히어로 "자료 현황" 과 2단계 KPI 띠만),
  호버·모달·드롭다운은 `--shadow-hard`. 누르면 그림자가 사라지고 1px 내려간다.
- **격자.** `body` 에 `linear-gradient(var(--grid-line) 1px, transparent 1px),
  linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)`, `background-size:
  var(--grid-size) var(--grid-size)`. 교대 구획은 `--surface-alt` 로 덮어 격자를 옅게 비친다.
- `@layer base` 안에 둔다(바깥 규칙이 유틸리티를 덮은 사고가 있었다).

### 3.5 모션

`--duration-fast 120 / base 200 / slow 320ms`, `--ease-standard cubic-bezier(0.2, 0, 0, 1)`
추가. 움직이는 것은 상태 변화뿐: 버튼 호버의 그림자 등장(120ms), 누름(translate 1px), 단계
전환 포커스, 펜딩 블록. 스크롤 리빌·등장 애니메이션 없음. `prefers-reduced-motion` 유지.

### 3.6 아이콘

`design/ui/Icon.tsx` 의 Lucide 10개 그대로(기능 아이콘만, 장식 0). 새 아이콘은
`plus`·`x`·`upload`·`key` 네 개까지 같은 방식(획 복사)으로 추가할 수 있다. 패키지 금지.

## 4. 페이지 구성

```
AppBar(56px, sticky, rgba(250,250,250,.92)+blur 8px, 아래 1px)
  연구실적 분석 포털  대학알리미 공시자료 (meta)           [라이트|다크|시스템] [데이터 갱신] [설정]
───────────────────────────────────────────────────────────────────────────────────────────
Hero — 2열 비대칭 split (0.92fr / 1.08fr, gap 42px, ≥1024px). 상하 64/48px. 위에서 정렬.
  왼쪽                                               오른쪽: 패널 「자료 현황」(흰 프레임, 위 4px 주홍)
   (eyebrow) 대학알리미 공시 · 전임교원 연구실적        ┌───────────────────────────────────┐
   (h1 700) 우리 대학은 [몇 번째]인가  ← [ ]만 주홍        │ 자료 현황                          │
   (lead) 대학알리미가 공시한 전임교원 1인당 SCI급·       │ 133      11        6       2026    │ ← Geist Mono 2.25rem
          SCOPUS 논문 수로 … Word 보고서로 내려받습니다.  │ 개교     개년       권역    최신 공시 │
   [분석 시작] (<768px 만)                              │ 2016–2026 · 사립 등재교 기준(서버 원문)│
   (meta 띠) 출처 「7-가. 전임교원의 연구 실적」 ·        │ 추가 데이터 2027년 · 이 브라우저 (있을 때)│
            공시 2016–2026년 · 매년 8월 공시 반영          └───────────────────────────────────┘
───────────────────────────────────────────────────────────────────────────────────────────
모듈 탭   연구실적  전임교원 SCI급·SCOPUS 논문        (잉크 2px 밑줄, e2e 계약 유지)
StepNav   01 데이터 설정  02 통계 확인  03 그래프 검토  04 GPT 서술  05 보고서 생성  (번호는 모노)
ContextBar(2~5단계, sticky)  호서대학교 · 충청권 · 2026년 공시 · 11개년 · 비교군 5개교    변경
Step header   (h2 700) 데이터 설정   (lead) 대학과 기준 연도를 고르면 …
Step body     …
Step nav      [처음부터 다시]                                        [이전] [다음: 통계 확인]
───────────────────────────────────────────────────────────────────────────────────────────
어디에 쓰는가 (--surface-alt, 위아래 1px)  왼쪽 제목 / 오른쪽 01–04 번호 목록(모노 번호 + 명사 제목 + 한 문장)
Footer   출처: 대학알리미 전임교원 연구실적 공시자료 · 글꼴 Pretendard · Geist Mono (SIL OFL)
```

- 「자료 현황」 숫자는 전부 `/api/data` 응답이다(대학 수·연도·권역 수·최신 연도). 서버
  응답이 오기 전에는 숫자 자리에 스켈레톤(`Pending`), 실패하면 패널 안에 오류와 「다시 시도」.
  **이 패널이 이 제품만의 한 가지다** — 템플릿에는 없고, 쓰는 사람만 넣을 수 있는 것.
- 히어로는 stats 로드 후에도 남는다(언마운트 금지). `hero-static` testid 는 패널 뒤의
  `aria-hidden` 장식 레이어에 붙인다(e2e 계약).
- 390px: 히어로 1열(패널이 표제 아래로), StepNav 는 "01 / 05 · 데이터 설정" + 44px 사각 점
  5개, 액션바는 바닥 고정. AppBar 아이콘화는 지금 그대로.

## 5. 컴포넌트별 변경

| 컴포넌트 | 변경 |
|---|---|
| `design/ui/Button` | 직각. primary 잉크 채움, 호버 `--shadow-hard` + `translate(-1px,-1px)`, 누름 그림자 0 + `translate(1px,1px)`. secondary 투명 + 1px `--border-strong`, 호버 흰 채움. ghost 그대로. danger 는 secondary 에 `--color-down` 글자·선. 라벨 0.875rem/600/0.02em. `disabled` 는 opacity 가 아니라 `--surface-sunken` 채움 + `--text-muted`(흐린 알약이 "죽은 버튼" 으로 읽혔다) |
| `design/ui/Field`·`CONTROL_CLASS` | 라벨을 아이브로(0.75rem/600/0.08em, `--text-secondary`)로. 입력 높이 2.75rem(44px), 1px `--border-strong`, 포커스에 주홍 2px(`outline`). 힌트는 `--text-meta`. 오류는 `--color-down` + `role=alert` 유지 |
| `design/ui/Card` → **Frame** | 같은 컴포넌트, 모양만: 1px `--border-strong` + `--shadow-soft`, `variant="panel"` 이면 위 4px 주홍 띠. 머리글 아이브로 제목 |
| `design/ui/Modal` | 직각, `--shadow-hard`, 제목 h2 700, 닫기 secondary sm. 포털·inert 그대로. **`React.lazy` 로 두 패널(설정·데이터)을 지연 로드**(번들 예산) |
| `design/ui/Pending` | 직각. 펄스 유지 |
| `Combobox` | 입력 44px. 드롭다운 직각 + `--shadow-hard` + 1px `--border-strong`. 활성 항목 `--surface-sunken` 배경 + 잉크 글자(주홍 아님). status 문구는 §6 |
| `YearPicker` | 칩 직각 + 모노 숫자. 선택 = 잉크 채움 흰 글자, 미선택 = 투명 + `--border-subtle`, 기준 연도 = 주홍 작은 사각(●→■) 1회. 프리셋 버튼 ghost/secondary 그대로 |
| `CompareGroupPicker` | 목록 직각, 체크박스 `accent-color: var(--text-primary)`, 선택 행 `--surface-sunken`. 숫자 모노 |
| `MetricCard` + 2단계 띠 | 띠를 **패널**(위 4px 주홍)로. 라벨 아이브로. 값은 Geist Mono(kpi/kpi-sub). 단위는 `--text-meta`. 증감 문장은 그대로(색은 숫자에만) |
| `YearTable`·`CompareTable` | 프레임 안. 머리글 아이브로 + 아래 1px `--border-strong`. 숫자 셀 `--font-numeric`(모노) + `tabular`. 기준 행·대상 행 `--accent-soft` + 왼쪽 3px 주홍 |
| `YoYPanel` | 구조 유지. 대상 블록 왼쪽 2px 주홍 → 3px. 증감 색 규약 유지 |
| `ChartGallery` | 매트 `--chart-matte` 흰 면 + 1px `--border-subtle`, 직각. 캡션 아이브로 번호("01 연도별 추이"). 오류·재시도 문구 §6. **overlay 가 있으면 POST 로 받아 objectURL**(§8) |
| `TrendChart` | 대상 계열 `var(--accent)`, 비교선 `--text-secondary`/`--text-muted` 점선. 툴팁 직각. 격자선 `--border-subtle` |
| `StepNav` | 번호 "01" 모노 + 이름. 현재: 잉크 글자 + 주홍 2px 밑줄. 도달: `--text-secondary`. 잠김: `--text-muted` + `cursor-not-allowed`. 휴대폰 점 → 8px 사각 |
| `ContextBar` | 글자 `--text-secondary`, 대학명 600. 아래 1px |
| `AppBar` | 반투명+blur(tom-modern 헤더). 테마 세그먼트 직각 |
| `HomeHero` | §4. 새 하위 컴포넌트 `DataPanel`(같은 폴더) |
| `SettingsPanel` | 세 모드(§7). 키 입력은 `--font-mono` |
| `DataUpdatePanel` | 두 모드(§8) |
| `App` | 쓰임 띠를 `--surface-alt` 교대 구획 + 번호 목록으로. 푸터 문구 §6. body 격자 |

## 6. 문구

### 6.1 규율

1. **사용자에게 보이는 문장은 합쇼체.** "~합니다 / ~하세요 / ~없습니다". 라벨·버튼·표 머리는
   명사형. 해라체("~다", "~할 것")는 코드 주석과 문서에만 남는다. **서버의 `detail` 문자열도
   화면에 그대로 뜨므로 같은 규칙이다.**
2. **결과를 말한다, 행동을 중계하지 않는다.** "이름을 입력하거나 목록에서 고른다" → "대학 이름
   검색". "비교군 표와 전년대비가 보는 해다" → "비교표와 전년 대비 증감의 기준 연도입니다".
3. 오류는 세 문장 순서(state-coverage): 무엇이 났는가 → 왜 → 무엇을 하면 되는가. 입력은
   지우지 않는다.
4. 느낌표 없음. "앗"·"오류가 발생했습니다" 같은 빈말 없음. 수동태 없음. 이모지 없음.
5. 금지어(11-02 §2 계승): 혁신·스마트·AI 기반·원스톱·한눈에·손쉽게·최적화·Insight·Dashboard·
   KPI(화면 문구로서). 숫자는 전부 API 값.
6. 숫자·연도·대학 수는 문장 안에서는 본문 글꼴, 단독 메타(띠·표·칩)에서는 모노.

### 6.2 바꾸는 문구 — 옛 → 새

테스트가 단언하는 문구는 ★ 표시. **★ 는 그 단언을 새 문구로 고친다**(testid·role·`data-state`·
`aria-current` 는 손대지 않고, 정규식을 넓히지 않는다). 전체 표는 구현 중 `docs/superpowers/
plans/…` 의 "문구 대조표" 로 유지하고, 여기에는 방향을 정하는 것만 적는다.

**홈·셸**

| 자리 | 옛 | 새 |
|---|---|---|
| 히어로 아이브로 | 기획처 · IR센터 · 평가 담당자를 위한 연구실적 분석 | 대학알리미 공시 · 전임교원 연구실적 |
| 히어로 h1 ★(e2e 이름) | 우리 대학은 몇 번째인가 | 그대로. "몇 번째" 만 주홍 |
| 히어로 부제 ★(e2e `/1인당 SCI급·SCOPUS 논문 수/`) | …사립대 안에서의 자리를 확인하고, 권역·비교군과 나란히 놓은 뒤 확인한 그대로 Word 보고서로 만듭니다. | 대학알리미가 공시한 전임교원 1인당 SCI급·SCOPUS 논문 수로 사립대 안에서 우리 대학의 자리를 확인하고, 권역·비교군과 견준 결과를 그대로 Word 보고서로 내려받습니다. |
| 자료 범위 띠 ★(`공시 \d{4}–\d{4}년`) | 자료 대학알리미 「7-가…」 / 대학알리미 8월 공시 반영 | 출처 대학알리미 「7-가. 전임교원의 연구 실적」 / 공시 2016–2026년 / 매년 8월 공시 반영 |
| 자료 현황 패널(신규) | — | 자료 현황 · 133 개교 · 11 개년 · 6 권역 · 2026 최신 공시 · (서버 원문) · 추가 데이터 2027년 · 이 브라우저 |
| 전국순위 범위 문장 ★(서버, `/등재된 사립 \d+개교 기준/`) | 전국순위는 대학알리미에 등재된 사립 133개교 기준이다. 국공립대·과기원은 집계에 포함되지 않는다. | 전국순위는 대학알리미에 등재된 사립 133개교 기준입니다. 국공립대·과기원은 집계에 포함되지 않습니다. |
| 쓰임 띠 | 카드 4장 | 01 자체평가 보고서 — 연구실적 절의 표 3개·차트 5장·서술 4절을 한 번에 만들어 그대로 붙입니다 / 02 기획처·총장 보고 — 전국·권역·비교군 평균 사이에서 우리 대학의 자리를 숫자로 보입니다 / 03 연도별 추이 — 공시된 모든 해의 1인당 논문 수와 순위 변화를 표와 그래프로 봅니다 / 04 Word 보고서 — 화면에서 확인한 차트·표·서술이 그대로 문서가 됩니다 |
| 푸터 | 글꼴 Pretendard · Hahmlet (SIL OFL) — 출처는 fonts/CREDITS.md | 출처 대학알리미 전임교원 연구실적 공시자료 · 글꼴 Pretendard · Geist Mono (SIL OFL) |
| `api/client.ts` 오류 3종 | …너무 크다. 줄여서 다시 시도할 것. / …끝내지 못했다… / …처리하지 못했다(…)… | …너무 큽니다. 줄여서 다시 시도하세요. / 서버가 제한 시간 안에 끝내지 못했습니다. 잠시 뒤 다시 시도하세요. / 서버가 요청을 처리하지 못했습니다({status}). 잠시 뒤 다시 시도하세요. |
| WizardShell 오류 | 데이터를 불러오지 못했다: {e} | 데이터를 불러오지 못했습니다. {e} |

**단계**

| 자리 | 옛 | 새 |
|---|---|---|
| registry 1 | 분석할 대학과 연도를 고르고 비교군을 정합니다. | 대학과 기준 연도를 고르면 권역과 비교군이 정해집니다. 비교군은 직접 바꿀 수 있습니다. |
| registry 2 | 보고서에 실릴 숫자입니다. 순위 변화는 양수가 개선입니다. | 보고서에 실리는 숫자입니다. 순위 변화는 양수가 개선, 음수가 하락입니다. |
| registry 3 | 아래 차트 5장이 그대로 Word 에 들어갑니다. 여기서 본 것과 문서가 다르지 않습니다. | 차트 5장이 이 모습 그대로 Word 에 들어갑니다. |
| registry 4 | 절마다 초안을 만들고 직접 고칩니다. 단계를 오가도 사라지지 않습니다. | 절마다 GPT 초안을 만들고 직접 다듬습니다. 다른 단계에 다녀와도 글은 남아 있습니다. |
| registry 5 | 내려받기 전 마지막으로 확인합니다. 아래 내용이 그대로 문서가 됩니다. | 아래 내용이 그대로 문서가 됩니다. 고칠 곳이 있으면 「변경」으로 돌아갑니다. |
| blockedReason ★(e2e) | 먼저 분석을 불러와야 한다 | 분석을 먼저 불러오세요 |
| StepNav aria-label ★(unit) | {n}단계 {label} — 이전 단계를 먼저 마쳐야 한다 | {n}단계 {label} — 이전 단계를 먼저 마치세요 |
| 1단계 placeholder | 이름을 입력하거나 목록에서 고른다 | 대학 이름 검색 |
| 콤보박스 status ★(e2e `{N}개교에서 고른다`, `{N}개 중 {M}개`, `일치하는 대학이 없다. 철자를 확인할 것`) | | {N}개교 중에서 고를 수 있습니다 / {N}개교 중 {M}개 일치 / 일치하는 대학이 없습니다. 철자를 확인해 주세요 / 고를 수 있는 대학이 없습니다 / 목록을 불러오는 중… |
| 대학 힌트 | 연도마다 집계 대학이 다르다. 2026년 기준 133개교 | 2026년 공시 기준 133개교 · 연도마다 집계 대학이 다릅니다 |
| 기준 연도 힌트 | 비교군 표와 전년대비가 보는 해다. | 비교표와 전년 대비 증감의 기준 연도입니다. |
| 분석 연도 요약 | 추이·평균·순위에 남길 해. 지금은 11개년 전부다. | 추이·평균·순위에 들어갈 해입니다. 지금은 11개년 전부입니다. |
| 권역 힌트·오류·옵션 | …캠퍼스가 있다. 어느 캠퍼스 기준인지 골라야… / 권역을 골라야 분석할 수 있다 / 고르세요 | {u}는 캠퍼스가 여러 권역에 있습니다. 기준 캠퍼스를 고르면 권역 순위와 평균이 정해집니다. / 권역을 고르면 분석할 수 있습니다 / 권역 선택 |
| 비교군 설명 | 보고서의 「비교군 비교」 절과 비교 차트가 이 목록으로 만들어진다. 고르지 않으면 서버가 권역 상위권으로 정한다. | 「비교군 비교」 절과 비교 차트에 들어가는 대학입니다. 고르지 않으면 권역 상위 대학으로 채웁니다. |
| 비교군 요약 ★(e2e `서버 기본 비교군`) | 서버 기본 비교군을 쓴다 ({r} 상위권) | 서버 기본 비교군 · {r} 상위권 |
| 비교군 빈·오류 ★(unit `/비교할 다른 대학이 없다/`) | {r} 에 비교할 다른 대학이 없다. / …불러오지 못했다: {e} | {r}에는 비교할 다른 대학이 없습니다. / 비교군 후보를 불러오지 못했습니다. {e} |
| 로드 버튼 | 분석 불러오기 / 다시 불러오기 | 분석하기 / 다시 분석 |
| 2단계 증감 없음 | 비교 없음 | 전년 자료 없음 |
| 2단계 표 제목·설명 | {n}개년 수치 / 보고서에 실리는 숫자입니다. 차트로는 소수 넷째 자리를 구분할 수 없습니다. | 연도별 수치 · {n}개년 / 보고서 표에 들어가는 값입니다. 소수 넷째 자리까지 그대로 실립니다. |
| 빈 상태 ★(unit `표시할 연도가 없다.`·`표시할 데이터가 없다.`·`전년도 데이터가 없다.`) | | 표시할 연도가 없습니다. / 표시할 데이터가 없습니다. / 전년도 자료가 없습니다. |
| 3단계 | Word 에 들어가는 차트 / 값을 짚어 읽기 (인터랙티브 추이) / 문서에는 위의 서버 차트가 실립니다. 이 그래프는 점을 가리켜 값을 읽는 용도입니다. | Word 에 실리는 차트 5장 / 값 짚어 보기 · 인터랙티브 추이 / 문서에는 위 차트가 실립니다. 이 그래프는 점을 가리켜 값을 읽을 때 씁니다. |
| 차트 오류 | 차트를 그리지 못했다. 보고서에도 이 그림은 빠진다. | 차트를 그리지 못했습니다. 이대로면 보고서에서도 빠집니다. |
| YoY 중복 경고 | …같은 대학이 중복 등장한다: | …같은 대학이 함께 나옵니다: |
| 4단계 안내(키 없음·저장 가능) | GPT 서술을 쓰려면 OpenAI 키가 필요합니다. 키는 이 PC 의 서버에만 저장됩니다. | 그대로 |
| 4단계 안내(브라우저 키, 신규) | 이 서버에는 GPT 서술 생성이 꺼져 있습니다… | GPT 서술에는 OpenAI API 키가 필요합니다. 키는 이 브라우저에만 저장되고, 서술을 만들 때만 OpenAI 로 전달됩니다. 서버에는 남지 않습니다. |
| 4단계 일괄 버튼 ★(e2e `비어 있는 {n}개 절`) | GPT 서술 일괄 생성 / 비어 있는 {n}개 절 생성 | 4개 절 모두 생성 / 비어 있는 {n}개 절 생성 |
| 4단계 각주 | 일괄 생성은 이미 쓴 글을 덮어쓰지 않습니다. 생성된 글은 직접 고쳐도 됩니다. | 이미 쓴 글은 덮어쓰지 않습니다. 생성한 글은 바로 고칠 수 있습니다. |
| 5단계 ★(`비어 있음`) | 비어 있음 — 제목만 들어간다 / 내려받았습니다 — {f} | 비어 있음 · 제목만 들어갑니다 / 내려받았습니다 · {f} |

**설정·데이터 패널** — §7·§8 에 새 문구가 있다. 잠긴 것: `설정됨`·`설정되지 않음`·`환경변수`(persist
모드 상태 표의 출처 값 — 그대로)·`저장`·`닫기`·`데이터 갱신`·`설정`(접근성 이름)·`{n}개년`·`{m}개교`
결과 포맷. 바꾸는 것★: `저장했다` → `저장했습니다`, `연도가 없다`(picked-files) → `연도가 없습니다`,
"쓸 수 없는 배포에서는 저장 폼을 숨긴다" 는 테스트 자체가 **반대 동작(브라우저 키 폼을 보인다)으로
교체**된다.

**로드 버튼·2단계·클라이언트 오류**★: `분석 불러오기`/`다시 불러오기` → `분석하기`/`다시 분석`
(`Step1Target.test`), `비교 없음` → `전년 자료 없음`(`Step2Metrics.test`), `api/client.ts` 오류 3종
(`client.test.ts`).

**서버 `detail`(api/)** — 전부 합쇼체로. 테스트가 보는 핵심어는 지킨다: `읽기 전용`,
`OPENAI_API_KEY`, `없는키`(422 메시지에 요청 키가 그대로 들어가므로 자동), `등재된 사립 N개교
기준`. e2e V16 의 `평면 키` 단언은 **삭제**한다(그 문구 자체가 운영자용이라 화면에 둘 이유가
없다). 대표 변환: "없는 대학이다: {u}" → "데이터에 없는 대학입니다: {u}", "{y} 년 데이터가 없다.
가능: …" → "{y}년 데이터가 없습니다. 가능한 연도: …", "기준 연도 {y} 는 분석 연도 안에 있어야
한다." → "기준 연도 {y}년은 분석 연도에 포함되어야 합니다.", 비교군 사유 4종("…뺐다" →
"…뺐습니다", "…까지다. …만 쓴다." → "…입니다. …만 씁니다.", "자신만 비교군에 있다. 비교군
평균은 자신의 값이다." → "비교군에 {u} 외의 대학이 없습니다. 비교군 평균은 {u}의 값과 같습니다.",
"…구성할 수 없다. …자신의 값이다." → "…구성할 수 없습니다. …값과 같습니다."), 업로드 400 계열,
설정 422·409, 차트 404, 데이터 503, 서술 상한 422. `core/preprocess.PreprocessError` 는 이미
합쇼체다.

## 7. 산출물 A — API 키(BYOK)

### 7.1 동작

- 키 출처 우선순위: **요청 헤더 `X-OpenAI-Key`** → 서버 환경변수 `OPENAI_API_KEY`(`.env`
  포함) → 없으면 503 "OpenAI API 키가 없습니다. 설정에서 키를 넣거나 서버 환경변수
  OPENAI_API_KEY 를 설정하세요."
- 헤더 값 검증: `sk-` 로 시작, 20자 이상 200자 이하, ASCII 출력 가능 문자만. 아니면 422
  "브라우저에 저장된 OpenAI 키 형식이 올바르지 않습니다. 설정에서 다시 넣으세요."
- 클라이언트: `OpenAI(api_key=key, timeout=60, max_retries=1)`. `keys` 중복 제거.
  실패 사유 문자열에서 키 문자열을 지운다(`str(e).replace(key, "sk-…")`), 200자로 자른다.
  키를 로그에 남기지 않는다. 응답 본문에 `sk-` 가 들어가지 않는다(기존 테스트 유지).
- `/api/settings` 응답 모양은 그대로(`apiKeyConfigured`·`apiKeySource`·`apiKeyHint`·`canPersist`).
  **화면의 모드는 배포 종류가 정한다**: `canPersist ? 'persist' : 'browser'`. 서버에 키가 있어도
  공개 배포(`browser`)에서는 브라우저 키 폼을 **언제나** 보인다 — 운영자가 Vercel 에 키를 넣어 둔
  경우에도 방문자는 자기 키를 쓸 수 있어야 하고(헤더가 서버 키보다 먼저다), 그래야 산출물 A 의
  의도("서버는 키를 저장하지 않는다")가 운영자 실수 한 번에 뒤집히지 않는다. 서버 키가 있으면 상태
  줄에 "서버에 키가 설정돼 있습니다 · 브라우저 키가 있으면 그것을 먼저 씁니다" 를 함께 적는다.
- `HOSEO_FORCE_READONLY=1`(§8.2)은 **서버 키도 없는 것으로 친다**: `/api/settings` 가
  `apiKeyConfigured=false`·`apiKeySource=null` 을 돌려주고, `_require_api_key` 는 헤더만 본다.
  공개 사이트 모드를 개발 PC(`.env` 에 진짜 키가 있는)에서 그대로 재현하기 위해서다.
- 서버 저장(`POST /api/settings/api-key`)은 persist 모드에서만 쓴다. 변경 없음.

### 7.2 화면

- `web/src/api/clientKey.ts`: `localStorage['hoseo-openai-key']` 읽기·쓰기·지우기,
  `useSyncExternalStore` 훅, 마스킹(`sk-…abcd`), 저장소 예외 흡수(사생활 모드면 메모리에만).
  `api.narrative` 가 키가 있으면 헤더를 붙인다. `architecture.test` 방향(design 이 api/store 를
  모르는 것) 위반 없음 — 이 모듈은 `api/` 안에 있다.
- `SettingsPanel` 두 모드(`settings.canPersist` 로 판정, `data-testid="settings-status"` 에
  `data-mode`):
  - **persist**(`.env` 쓰기 가능 — 설치본·로컬): 상태 표(설정됨 · 출처 · 힌트 / 설정되지 않음)
    + 지금의 서버 저장 폼(`api-key-input`·`api-key-save`). 힌트 "sk- 로 시작하는 키를 넣으세요.
    키는 이 PC 의 서버에만 저장되고 브라우저로 다시 내려오지 않습니다." 성공 "저장했습니다. 서버를
    다시 켜지 않아도 바로 쓸 수 있습니다."
  - **browser**(쓰기 불가 — Vercel): 상태 "이 브라우저에 저장된 키 · sk-…abcd" 또는 "저장된
    키가 없습니다"(서버 키가 있으면 "서버에 키가 설정돼 있습니다 · 브라우저 키가 있으면 그것을
    먼저 씁니다" 한 줄 추가). 폼: password 입력(`client-key-input`, `--font-mono`),
    「저장」(`client-key-save`)·「지우기」(`client-key-clear`)·「닫기」. 설명: "키는 이 브라우저에만
    저장되고, 서술을 만들 때만 OpenAI 로 전달됩니다. 서버에는 남지 않습니다. 공용 PC 라면 쓰고
    나서 지우세요." 형식 오류는 보내기 전에 잡는다(`sk-`, 길이, 공백·한글).
- `Step4Narrative`: `keyMissing = !settings.apiKeyConfigured && !clientKey`. 키가 없으면 그
  자리에 `SettingsPanel` 을 임베드한다(모드는 패널이 스스로 고른다 — persist 면 서버 저장 폼,
  browser 면 브라우저 키 폼).
  `generate-button` 은 언제나 DOM 에 남는다(e2e). **일괄 생성은 절마다 요청을 따로 보낸다**
  (`Promise.allSettled`, 비어 있는 절만). 서버리스 함수 한 번의 시간을 GPT 호출 1회로 묶고,
  하나가 실패해도 나머지가 들어온다. 전부 실패하면 첫 오류를 `narrative-error` 에, 일부
  실패는 `narrative-failed` 목록에.
- `features.ts`: `settings`·`dataUpdate` 둘 다 무조건 `true`. `VITE_READONLY_DEPLOY` 와
  `vercel.json` 의 빌드 명령 접두어를 지운다. `features.test.ts` 의 읽기 전용 테스트 → "메뉴는
  배포 종류와 무관하게 켜져 있고 모드는 서버 응답이 정한다" 로 바꾼다.

### 7.3 테스트

- 서버: 헤더 키로 200 + `OpenAI(...)` 에 그 키가 들어감(생성자 monkeypatch) · 헤더 형식 오류
  422 · 둘 다 없으면 503 + `OPENAI_API_KEY` 포함 · 예외 메시지에 키가 섞여도 응답에 `sk-`
  없음 · `keys` 중복 1회 호출 · `timeout=60`.
- 화면: `clientKey` 저장·마스킹·예외 흡수, `SettingsPanel` 세 모드, `Step4` 분기 세 가지,
  일괄 생성이 절마다 요청·부분 실패 표시. e2e V16 단언을 새 503 문구로.

## 8. 산출물 B — 브라우저 데이터셋(overlay)

### 8.1 개념

Vercel 디스크는 읽기 전용이고 인스턴스마다 다르다. 그래서 **서버는 계산만 하고 상태는
브라우저가 든다.** 올린 xlsx 한 해를 `core.preprocess.process_in_memory` 로 계산해(그 해 안의
순위는 그 해 파일만으로 완결된다 — 함정 #36) 영문 키 행으로 돌려주면, 브라우저가 그 행들을
저장해 두고 이후 모든 요청에 `overlay` 로 실어 보낸다. 서버는 요청마다 기본 데이터에 그 해를
덧씌워 계산한다. **`core/` 는 바뀌지 않는다.**

- 같은 연도가 기본 데이터에 있으면 **덮어쓴다**(정정 파일 올리기). 없으면 더한다.
- 공유되지 않는다. 다른 사용자·다른 브라우저·서버에는 아무 영향이 없다. 공개 사이트에
  인증이 없으므로 이것이 맞다 — 누군가의 업로드가 전원의 데이터를 바꾸면 안 된다.
- 로컬·설치본(`canPersist=true`)은 지금의 영구 갱신(`POST /api/preprocess`)을 그대로 쓴다.

### 8.2 API

| 엔드포인트 | 요청 | 응답 |
|---|---|---|
| `POST /api/dataset/preview` | multipart `file` **하나**(Vercel 본문 4.5MB 상한; 공시 xlsx 는 1–3MB). 파일명 검증은 `preprocess_service.safe_name` 재사용 | `DatasetPreviewResponse { year, universities, sourceFile, national: OverlayRow[], regional: OverlayRegionalRow[] }` — 미등재 제외 수는 담지 않는다(`process_in_memory` 가 돌려주지 않고 `core/` 를 바꾸지 않는다) |
| `POST /api/data` | `{ overlay? }` | `DatasetInfo` + `overlayYears: int[]` (GET 은 그대로, `overlayYears: []`) |
| `POST /api/regions` | `{ university, overlay? }` | `RegionsResponse` |
| `POST /api/universities` | `{ region, year, overlay? }` | `UniversitiesResponse` |
| `POST /api/stats` · `/api/narrative` · `/api/report` | 기존 본문 + `overlay?` | 기존 응답. `StatsResponse` 에 `overlayHash: str \| null` 추가 |
| `POST /api/chart/{kind}.png` | `{ university, year, regionName?, compareGroup?, years?, overlay? }` | PNG (GET 은 그대로 — overlay 없을 때만 쓴다) |

- `OverlayRow { year, name, faculty, papers, perCapita, nationalRank }`,
  `OverlayRegionalRow = OverlayRow + { regionName, regionalRank }`,
  `DatasetOverlay { national: OverlayRow[], regional: OverlayRegionalRow[] }`.
- 번역은 `api/schemas.py` 의 표 **한 곳**에서 양방향(`COMPARE_KEYS` 계열의 역표). 코어의 CSV
  열 이름(`연도`·`학교명`·`전임교원수`·`SCI/SCOPUS논문수`·`1인당논문수`·`전국순위`·`권역명`·
  `권역순위`)과 dtype 을 맞춰 `pd.DataFrame` 으로 만든다.
- 검증(pydantic): 각 표 6,000행 이하, 연도 2000–2100, (연도, 학교명[, 권역명]) 중복 없음,
  `faculty` 0–100,000 정수, `papers` 0–1,000,000, `perCapita` 0–1,000, 순위 1–10,000 또는
  None, 이름 1–60자, `regionName` 은 기본 데이터의 권역 집합 안. 어기면 422 "추가한 데이터가
  올바르지 않습니다. 데이터를 지우고 다시 올리세요."
- 병합: `deps.get_frames(overlay)` → overlay 가 없으면 지금처럼 캐시 프레임, 있으면 `base[~연도
  ∈ overlay 연도] ∪ overlay` (연도·순위·학교명 정렬). `analysis.resolve_scope(…, overlay)` 가
  넘긴다. **`_CHART_CACHE` 키와 응답 `overlayHash` 에 overlay 의 sha1(정규화 JSON, 앞 12자)을
  넣는다** — 빠뜨리면 전처리 캐시 사고(함정 #43)가 그대로 재현된다. overlay 요청은 캐시
  크기 4 를 공유한다.
- `DatasetInfo.universityCount` 와 범위 문장은 병합된 프레임의 최신 연도로 센다.
- `HOSEO_FORCE_READONLY=1` 환경변수가 있으면 `_can_persist()` 가 False 를 돌려주고
  `/api/preprocess` 가 409 이며, **서버 환경변수의 OpenAI 키도 없는 것으로 친다**(§7.1).
  **공개 사이트 모드를 로컬 e2e 로 재현하기 위한 것**이지 기능 플래그가 아니다. 문서화하지 않는
  숨은 스위치가 아니라 README 「테스트」에 적는다.

### 8.3 화면

- `web/src/api/overlay.ts`: 외부 스토어(`useSyncExternalStore`) + `localStorage['hoseo-dataset-
  overlay']`(`{ v: 1, items: [{ year, universities, excludedCount, sourceFile, addedAt }],
  national, regional }`). 직렬화 2MB 상한(넘으면 저장 거절 + 문구). 손상된 JSON 은 버린다.
  `api.*` 가 스토어에서 overlay 를 읽어 POST 본문에 싣는다. overlay 가 비면 GET 경로.
- `DataUpdatePanel` 두 모드(`mode: 'persist' | 'browser'` prop — `App` 이 `/api/settings` 의
  `canPersist` 로 정해 넘긴다; 패널은 설정을 묻지 않는다):
  - **persist**: 지금 그대로(문구만 §6).
  - **browser**: 제목 "데이터 추가". 설명 "대학알리미 「전임교원의 연구 실적」 공시 xlsx 를
    올리면 그 해의 지표와 순위를 계산해 분석에 더합니다. 이 브라우저에만 저장되고 서버에는
    남지 않습니다." 드롭존(기존 `raw-file-input`·testid 유지) → 파일마다 순차 업로드, 진행
    "{y}년 계산 중…", 결과 "{y}년 {n}개교 추가됨". 아래 「추가된 데이터」 목록: "{y}년 ·
    {n}개교 · {파일명}" + 「제거」, 「모두 지우기」.
    비어 있으면 "추가된 데이터가 없습니다." 오류: "{파일} 처리에 실패했습니다. {서버 사유}
    파일이 공시 xlsx 가 맞는지 확인하고 다시 올리세요."(입력 유지).
- 바뀌면 `onUpdated` → `App` 의 `dataVersion` 증가 → 마법사 리마운트 + `useDataset` 재조회
  (지금 전처리와 같은 경로). 히어로 패널에 "추가 데이터 2027년 · 이 브라우저" 한 줄.
- `ChartGallery`: overlay 가 있으면 `POST /api/chart/{kind}.png` 를 `fetch` 해 objectURL.
  모듈 수준 `Map<key, objectURL>`(키 = JSON(params) + overlayHash)로 단계를 오갈 때 다시
  그리지 않게 하고, overlay 가 바뀌면 전부 `revokeObjectURL`. 없으면 지금의 `<img src>` GET.

### 8.4 테스트

- 서버(실데이터 마커): 미리보기가 그 해 행과 순위를 돌려준다 · overlay 로 기본에 없는 해를
  더하면 `/api/stats` 추이에 그 해가 있다 · 같은 해를 덮어쓰면 값이 바뀐다 · 경계(행 수·권역·
  음수) 422 · overlay 유무로 차트 PNG 바이트가 다르다(캐시 키) · `/api/data` POST 가
  `overlayYears` 를 준다 · `/api/report` 의 표에 그 해 행이 있다 · 디스크에 아무것도 쓰지
  않는다(`tmp_path` 전후 동일) · `HOSEO_FORCE_READONLY` 로 `canPersist=false`·409.
- 화면: 스토어 저장·복원·상한·손상 복구, 패널 browser 모드 흐름(순차 업로드·제거·모두 지우기·
  오류 유지), `ChartGallery` POST 경로와 revoke, `api` 가 overlay 를 싣는 것.
- e2e: `web/e2e/readonly.spec.ts` — `HOSEO_FORCE_READONLY=1` 로 띄운 서버에서만 돈다(아니면
  skip). 설정 모달이 브라우저 키 폼을 보이고, 데이터 패널이 "데이터 추가" 모드이며, Raw xlsx
  하나를 올리면 히어로 패널에 "추가 데이터" 가 뜨고 1단계 연도 칩에 그 해가 생긴다. 검증
  때 `API_PORT=8011 HOSEO_FORCE_READONLY=1 npx playwright test readonly` 로 한 번 더 돈다.

## 9. 산출물 — 차트·Word·파비콘·메타

- **matplotlib(`core/chart_generator.py`)**: 팔레트만 바꾼다. 대상 `#EE5400`(주홍), 기타
  `#D4D4D8`, 전국 `#52525B`, 권역 `#71717A`, 비교군 `#A1A1AA`, 격자 `#E4E4E7` 실선 0.6,
  스파인 `#A1A1AA`, 눈금 글자 `#52525B`, 제목 잉크 `#27272A`. 해치(`///`) 제거(대상 막대는
  주홍 + 잉크 1.5px 외곽 + 굵은 눈금 라벨 — 색 아닌 신호 유지). 범례 테두리 없음. **제목
  문자열·figsize·subplots 호출은 그대로**(테스트 계약). 상수 이름(`COLOR_HOSEO` 등)은 남기고
  값만 바꾼다.
- **Word(`core/report_builder.py`)**: 표 머리 `27272A` 흰 글자, 줄무늬 `F4F4F5`/`FFFFFF`, 대상
  행 `FFE8DC` + 굵게, 제목 색 `27272A`, 제목 아래 1px 주홍(`EE5400`) 단락 테두리, 표지 대학명
  16pt 잉크·제목 20pt 잉크·그 사이 주홍 선. 글꼴은 맑은 고딕 유지(독자 PC 에 Pretendard 가
  없다). 표 구조·너비·순서 불변. `test_doc_u07_*` 의 배경색 단언 4곳을 새 값으로.
- **파비콘**: 직각 사각(`rx` 제거), 주홍 막대 3개 + 잉크 상승선. 다크는 `prefers-color-scheme`
  로 선 색만 바꾼다.
- **메타**: `index.html` 에 `description`, `og:title`·`og:description`·`og:type`,
  `theme-color`(라이트 `#fafafa`, 다크 `#131316`, `media` 속성). `<title>` 그대로.

## 10. 서버리스 운영

- Vercel 함수 시간은 Fluid compute 기본 300초(Hobby 상한 300초). GPT 4절을 한 요청에 묶어도
  들어가지만, §7 대로 절마다 요청하면 한 함수가 GPT 1회(≤60초 타임아웃)로 끝난다. `vercel.json`
  에 `maxDuration` 은 명시하지 않는다(기본값이 상한이다).
- 요청 본문 4.5MB. 미리보기는 파일 하나씩. overlay 는 11개년을 다 실어도 ~250KB 다.
- 오류 본문은 요약만 돌려준다(키 스크럽·200자).

## 11. 목표 / 비목표 / 실패 조건 / 제약

**목표.** 공개 사이트에서 (1) 설정에서 키를 넣고 4단계 서술이 되고, (2) 공시 xlsx 를 올려 그
해까지 분석·Word 가 되며, (3) 화면·문구·차트·문서가 `DESIGN.md` 하나로 설명되고, 스크린샷을
본 제3자가 템플릿이 아니라 이 제품의 것이라고 알아본다.

**비목표.** `core/` 계산 변경, 새 지표 모듈, 외부 저장소(Vercel Blob·KV), 인증, 연도 축 병기,
다국어, 3D·사진, Streamlit 판 수정, 커밋·푸시·배포(사용자 요청 시).

**실패 조건.** (1) 테스트를 느슨하게 고쳐 통과시킨다(§12 의 목록 밖 단언 변경). (2) 발명
수치·금지어·이모지·그라데이션. (3) 번들 예산 초과(초기 JS 200KB·CSS 20KB·글꼴 CSS 20KB).
(4) 다크 세 블록 어긋남. (5) 키가 응답·로그·URL 에 남는다. (6) overlay 가 다른 사용자 응답에
새어 들어간다(서버 상태에 저장하면 즉시 실패다). (7) 화면당 주홍 3회 이상.

**제약.** 토큰 밖 색·간격 리터럴 금지, 의존 방향 features → components → design, 배럴
import, 단계는 registry 한 곳, 오프라인 설치본(CDN 0), 한글 키는 core 안에서만, OpenAPI
재생성(`.venv` 의 `scripts/export_openapi.py` → `npm run gen:api`).

## 12. 테스트 계약 변경 — 허용 목록

아래만 바꾼다. 각 항목은 "제품이 의도적으로 바뀌어서" 이지 통과시키려고가 아니다. 구현 계획의
문구 대조표에 파일:테스트 이름까지 적는다.

1. 문구(§6.2 의 ★): e2e `shell.spec`(히어로 부제·범위 띠), `wizard.spec`(blockedReason, 콤보박스
   status 3종, 비교군 요약, `연도가 없다`, V16 의 `평면 키` 삭제·503 문구), unit(StepNav
   aria-label, CompareGroupPicker 빈 상태, YearTable·CompareTable·TrendChart·YoYPanel 빈 상태,
   ChartGallery 오류 문구, SettingsPanel `저장했다`, Combobox status, `Step1Target.test` 로드 버튼
   라벨, `Step2Metrics.test` `비교 없음`, `DataUpdatePanel.test` `연도가 없다`·드롭존 문구,
   `api/client.test.ts` 오류 문구 3종, `HomeHero.test`·`stats.fixture` 의 서버 범위 문장 원문).
1a. 동작 교체(테스트를 반대 동작으로 다시 쓴다): `SettingsPanel.test` "쓸 수 없는 배포에서는
   저장 폼을 숨기고 대안을 알려준다" → 브라우저 키 폼을 보이고 저장한다; `Step4Narrative.test`
   "키가 없고 저장도 못 하면 이유를 말하고 생성 버튼은 그대로 둔다" → 브라우저 키 폼을 임베드하고
   생성 버튼은 그대로 둔다(`generate-button` 잔존은 유지).
2. `features.test.ts`: 읽기 전용 플래그 테스트 → 무조건 켜짐.
3. `tokens.test.ts`: 700 금지 → 800 이상 금지. 새 토큰 `--text-eyebrow`·`--surface-alt`·
   `--shadow-soft/hard`·`--grid-*`·`--accent-text` 추가는 기존 검사와 충돌하지 않는다.
4. `tests/contract/test_fonts_bundle.py`: Hahmlet → Geist Mono. `test_OFL_과_CREDITS_가_있다`
   경로.
5. `tests/unit/test_report_builder.py`: `test_doc_u07_*` 셀 배경색 4단언.
6. 서버 `detail` 문구 단언: `test_data_and_stats`·`test_year_selection`·`test_preprocess_upload`·
   `test_settings_and_lists`·`test_narrative_and_report` 에서 **문자열 그대로** 비교하는 것만
   새 문구로. 핵심어 부분 일치 단언은 그대로 통과해야 한다.
7. `tests/api/test_openapi_drift.py` 는 스키마 재생성으로 통과시킨다(테스트 수정 없음).

손대지 않는다: testid 43개, role, `data-state`, `aria-current`, `h1` 하나, `hero-static`
`aria-hidden`, `raw-file-input` 가시성, 콤보박스 status 가 첫 status, 표 `role=region`, YoY
`role=group`, 차트 5장, 단계 이름 5개, 테마 버튼 이름.

## 13. 검증

1. `cd web && npx tsc -b --noEmit` → `npm test` → `npm run build`(예산 출력 기록) →
   `npm run build-storybook -- --quiet`.
2. `.venv/Scripts/python.exe -X utf8 -m pytest -q`(Vite 개발 서버를 끈 상태에서 — 드리프트
   테스트가 `web/dist` 를 잠시 바꾼다).
3. `API_PORT=8010 npx playwright test`(데스크톱·휴대폰) + `API_PORT=8011 HOSEO_FORCE_READONLY=1
   npx playwright test readonly`.
4. 스크린샷 1440·390 × 라이트·다크 × (홈, 1·2·3·4·5단계, 설정 모달 두 모드, 데이터 패널 두
   모드) → 눈으로 본다. **테스트가 전부 통과해도 화면은 틀릴 수 있다**(11-02 의 컨텍스트 바
   사고).
5. open-design `critique` 5차원 채점(철학 일관성 / 위계 / 디테일 / 기능 / 혁신)을 스크린샷에
   대해 독립 에이전트가 매기고, 7 미만 차원은 고친 뒤 다시 잰다. anti-ai-slop P0 7개 항목
   체크리스트를 함께.
6. diff 적대 리뷰(11-02 에서 HIGH 2건을 잡은 그 워크플로): 차원 = 키 유출 경로 / overlay 병합
   정확성 / overlay 변경 전후 캐시 무효화 / 문구·테스트 일치 / 접근성 회귀 / 번들·오프라인.
   반증되지 않은 지적은 고친다.

## 14. 빌더에게 맡기는 것

컴포넌트 내부 마크업·클래스, `DataPanel`·`readonly.spec` 의 세부, Geist Mono 서브셋 범위의
최종 목록(라틴·숫자·문장부호·화살표·₩·■●▲▼ 는 반드시), overlay 직렬화 형식의 세부, 차트
POST 캐시 Map 의 수명, 스토리북 스토리 갱신, 스크린샷 방법, 문구 대조표의 나머지 행.

## 14a. 빌더 검토 후 결정 (작성자의 결정)

독립 검토자가 계획 전에 답이 필요하다고 한 질문 셋. 사용자가 실시간으로 답할 수 없어 작성자가 정했다.

1. **§12 밖에서 깨지는 단위 테스트 6곳** — 전부 "제품이 의도적으로 바뀐 문구·동작" 이므로 허용
   목록(§12 1·1a)에 파일 단위로 넣었다. 브라우저 키 폼은 **새 testid**(`client-key-input`·
   `client-key-save`·`client-key-clear`)를 받는다 — persist 폼의 `api-key-*` 와 한 DOM 에 함께 있을
   수 있어서다. `/환경변수/` 는 persist 모드 상태 표에만 남고 잠긴 문구에서 뺐다.
2. **서버에 키가 있으면 BYOK 가 닿지 않는 문제** — 모드는 `canPersist` 만 보고(§7.1), 공개 배포에서는
   서버 키가 있어도 브라우저 키 폼을 보인다. `HOSEO_FORCE_READONLY` 는 서버 키도 무시한다(§8.2).
3. **`excludedCount`** — 뺐다(③). `core/` 불변이 더 중요하고, "그 해 {n}개교" 만으로 충분하다.

## 15. 되돌리기

작업 전 스냅숏: `D:\Cache\claude-tmp\claude\589c3331f2104688\91558bcd-32dc-4f13-9beb-d5708f664884\
scratchpad\snapshot-pre-open-design\` — `tracked-changes.patch`(HEAD `7972b67` 대비 추적 파일
변경 전부), `untracked-files.tgz`(미추적 127개), `status.txt`, `HEAD.txt`.

```powershell
git checkout -- . ; git clean -fd            # 지금 트리를 비운다(주의: 미추적 삭제)
git apply --binary <snapshot>\tracked-changes.patch
tar --force-local -xzf <snapshot>\untracked-files.tgz
```
