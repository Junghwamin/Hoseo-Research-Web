# 호서대학교 — 연구실적 분석 포털 (Web)

대학알리미 원시 데이터(Excel)를 전처리하고, 권역·비교군 기준으로 분석해
GPT-4o 서술과 matplotlib 차트가 들어간 Word 보고서를 만든다.

**FastAPI + React** 구성이다. [Streamlit 판](https://github.com/Junghwamin/Hoseo-Research)을
이어받았으며, 통계·전처리·보고서 생성 로직(`core/`)은 그대로 가져왔다.

공개 주소: https://hoseo-research-web.vercel.app ([Vercel 배포](#vercel-배포) 참조)

## 주요 기능

- **전처리 자동화**: 대학알리미 Excel(2016~2026)을 읽어 1인당 논문 수와 순위를 산출
- **구형/신형 포맷 모두 지원**: 연도별로 다른 헤더 구조를 자동 감지
- **대학 선택**: 전국 134개교를 검색해서 고른다. 목록에 없는 이름은 확정되지 않는다
- **권역 분석**: 전국 6개 권역 중 대상 대학이 속한 권역을 서버가 판정.
  다캠퍼스 대학(경동대·단국대·상명대·예원예술대·을지대·홍익대)은 직접 고른다
- **비교군 선택**: 권역 안의 대학을 지표와 함께 보고 고른다. 고르지 않으면 서버 기본값
- **차트 5종**: 화면에서 본 그림이 **그대로** Word 에 들어간다
- **GPT-4o 서술**: 추이·비교·권역·증감 4종. 절 단위 생성 + 직접 편집.
  일괄 생성은 이미 쓴 글을 덮어쓰지 않는다
- **Word 보고서**: 표 3개 + 차트 5장 + 서술 4절

## 빠른 시작

```bash
# 1) 파이썬 의존성
pip install -r requirements.txt

# 2) 프론트엔드 빌드 (최초 1회, 또는 화면을 고친 뒤)
cd web && npm ci && npm run build && cd ..

# 3) 서버 실행
uvicorn api.main:app --port 8000
```

브라우저에서 http://127.0.0.1:8000 접속. FastAPI 가 `web/dist` 를 함께 서빙하므로
서버 하나면 된다.

### 개발 중에는

```bash
uvicorn api.main:app --reload --port 8000   # 터미널 1
cd web && npm run dev                        # 터미널 2 → http://127.0.0.1:5173
```

Vite 개발 서버가 `/api` 요청을 8000번으로 프록시한다.

### API Key

GPT 서술을 쓰려면 OpenAI 키가 필요하다. 넣는 길은 셋이고 **화면의 「설정」이 배포
종류에 맞는 길을 고른다.**

| 어디서 | 어떻게 | 어디에 저장되는가 |
|---|---|---|
| 설치본·로컬 | 상단바 「설정」 → 저장 | 서버의 `.env` (`OPENAI_API_KEY=sk-…`) |
| 공개 사이트(Vercel) | 상단바 「설정」 → 저장 | **그 브라우저의 `localStorage` 만.** 서술 요청의 `X-OpenAI-Key` 헤더로만 서버를 거친다 |
| 운영자 | 환경변수 `OPENAI_API_KEY` | 서버 프로세스. 브라우저 키가 있으면 그쪽이 먼저다 |

환경변수·`.env` 에는 **평면 키**로 넣는다.

```bash
# .env 또는 환경변수
OPENAI_API_KEY=sk-...
```

`.env` 는 서버가 뜰 때 `api/main.py` 가 읽는다(`load_dotenv`). 이미 설정된
환경변수가 우선이라, 배포 환경에서 주입한 값을 파일이 덮어쓰지 않는다.

화면 오른쪽 위 **설정**에서도 넣을 수 있다. 저장하면 `.env` 에 기록하고
이번 프로세스에도 즉시 반영하므로 서버를 다시 켤 필요가 없다.

키는 **서버에만 있다.** 브라우저로 내려가지 않으며, 프론트는 설정 여부·출처·
마스킹된 힌트(`sk-ab…7f2c`)만 안다. 키 없이도 전처리·통계·차트·
보고서(서술 없는)는 전부 동작한다.

## 앱 워크플로우 (5단계)

| 단계 | 하는 일 |
|---|---|
| 1. 데이터 설정 | 대학 검색 선택 · 연도 · (다캠퍼스면) 권역 · 비교군 |
| 2. 통계 확인 | 지표 카드 4개 + **10개년 연도별 상세 표** |
| 3. 그래프 검토 | 인터랙티브 추이 + **Word 에 실릴 차트 4종** + 비교군 표 + 증감 |
| 4. GPT 서술 | 절 단위 생성 + 편집. 단계를 오가도 사라지지 않는다 |
| 5. 보고서 생성 | 무엇이 들어가는지 확인하고 Word 내려받기 |

> 1단계에서 고른 **비교군은 화면과 문서가 같은 것을 쓴다.** 차트 요청에도
> 비교군을 함께 보내므로, 3단계에서 확인한 그림이 그대로 보고서에 실린다.

## 디렉토리 구조

```
Hoseo-Research-Web/
├── main.py                     ← Vercel 진입점. 로컬·설치본은 쓰지 않는다
├── vercel.json                 ← Vercel 빌드·리전·함수 설정
├── core/                       ← 계산 로직. UI 프레임워크에 의존하지 않는다
│   ├── config.py               ← 대학명·비교군·경로·GPT 설정
│   ├── preprocess.py           ← 대학알리미 Excel → CSV
│   ├── data_loader.py          ← CSV 로드 + 통계 계산
│   ├── chart_generator.py      ← matplotlib 차트 5종 (보고서용)
│   ├── fonts/                  ← 시스템 폰트가 없는 Linux 용 나눔고딕 (OFL)
│   ├── gpt_reporter.py         ← OpenAI 서술 생성
│   └── report_builder.py       ← python-docx 보고서 조립
│
├── api/                        ← FastAPI. core/ 를 감싸기만 한다
│   ├── main.py                 ← 앱 + web/dist 정적 서빙
│   ├── deps.py                 ← 모집단 판정(권역·비교군·분석 연도)
│   ├── analysis.py             ← 판정 + 통계 수집. 네 엔드포인트가 여기만 쓴다
│   ├── preprocess_service.py   ← 업로드 저장·전처리·교체(백업·롤백 포함)
│   ├── schemas.py              ← 응답 계약. 한글 키 → 영문 키 번역
│   └── routers/                ← stats, report, settings, data
│
├── web/                        ← React + TypeScript + Vite
│   ├── src/
│   │   ├── api/                ← 생성된 타입 + 클라이언트
│   │   ├── design/             ← 디자인 시스템 (도메인을 모른다)
│   │   │   ├── tokens.css      ← 색·간격·radius 단일 소스
│   │   │   └── ui/             ← Button, Card, Field
│   │   ├── components/         ← 도메인 컴포넌트. **폴더 하나 = 독립 단위**
│   │   │   └── <Name>/         ← <Name>.tsx + .test.tsx + index.ts
│   │   ├── features/wizard/    ← 화면 조립
│   │   │   ├── WizardShell.tsx ← 단계를 모른다. registry 에서 읽는다
│   │   │   └── steps/          ← Step1~5 + registry.ts
│   │   └── store/              ← 순수 리듀서 상태 관리
│   ├── public/fonts/           ← 번들 웹 글꼴 (Pretendard·Geist Mono, scripts/build_fonts.py 산출물)
│   ├── e2e/                    ← Playwright
│   └── dist/                   ← 빌드 산출물 (FastAPI 가 서빙)
│
├── tests/                      ← pytest (unit / contract / integration / api)
├── scripts/                    ← 번들 시뮬레이션, 설치본 검증, OpenAPI, 미디어 내려받기
├── docs/ARCHITECTURE.md        ← **무엇을 어디에 두는가** — 새 기능을 붙이기 전에
├── installer/                  ← Windows(Inno Setup) · macOS(.app) 빌드
│
├── config/                     ← universities.json, regions.json
├── Raw data/                   ← 대학알리미 원본 Excel
└── output/                     ← 전처리 결과 CSV·xlsx
```

## 데이터 구조

### `output/전체_대학_데이터.csv`

| 연도 | 학교명 | 전임교원수 | SCI/SCOPUS논문수 | 1인당논문수 | 전국순위 |
|---|---|---|---|---|---|

### `output/권역별_순위.csv`

| 연도 | 학교명 | 전임교원수 | SCI/SCOPUS논문수 | 1인당논문수 | 권역명 | 권역순위 | 전국순위 |
|---|---|---|---|---|---|---|---|

6개 권역 전체를 담는다. 다중 캠퍼스 대학은 권역마다 한 행씩 나타난다.
인코딩은 UTF-8 with BOM(utf-8-sig).

> **전국순위의 범위.** 대학알리미에 등재된 **사립 대학만** 집계한다.
> 국공립대·과기원은 포함되지 않는다. API 의 `/api/data` 가
> `nationalRankScopeNote` 로 이 사실을 함께 돌려주고 화면에도 표시한다.

## API

| 메서드 | 경로 | 하는 일 |
|---|---|---|
| `GET` | `/api/data` | 연도·권역 목록, **대학 이름 전체**, 순위 범위 안내 |
| `GET` | `/api/regions?university=` | 대학이 속한 권역(다중 캠퍼스는 복수) |
| `GET` | `/api/universities?region=&year=` | 권역 안의 대학 전체와 그 해 지표 (비교군 후보) |
| `POST` | `/api/stats` | 추이·평균·순위변화·비교군·증감 |
| `GET` | `/api/chart/{kind}.png` | 차트 이미지. **Word 에 들어가는 것과 같은 PNG** |
| `POST` | `/api/narrative` | GPT 서술 (`keys` 로 절 지정 가능. 일부 실패해도 나머지 반환) |
| `POST` | `/api/report` | Word 파일 (메모리 생성, 디스크에 남기지 않음) |
| `POST` | `/api/preprocess` | Raw xlsx 업로드 → 전처리 → 데이터 교체 (multipart) |
| `GET` | `/api/settings` | API 키 설정 여부·출처·마스킹 힌트. **키 값은 절대 내려가지 않는다** |
| `POST` | `/api/settings/api-key` | API 키 저장 (`.env` 기록 + 프로세스 즉시 반영) |

`{kind}` 는 `trend`·`bar`·`avg`·`rank`·`compare` 다.

**그림을 결정하는 입력은 하나도 빠뜨리지 않는다.** `compareGroup` 과 `years`
를 함께 보내야 한다 — 빼면 서버가 기본 비교군·전 연도로 그리는데, 보고서는
사용자가 고른 것으로 만들어져 화면과 문서의 그림이 갈라진다. 화면에서는
`chartUrl()` 을 거쳐 주소를 만들면 빠뜨릴 수 없다.

### 분석 연도 (`years`)

`/api/stats`·`/api/narrative`·`/api/report`·`/api/chart` 가 모두 받는다.
추이·평균·순위에 남길 해를 정한다. 생략하면 전 연도다.

- **기준 연도(`year`)가 반드시 포함되어야 한다.** 아니면 422 — 비교표와
  전년대비는 기준 연도로 계산되는데 추이 차트에 그 해가 없으면, 같은 화면의
  두 그림이 서로 다른 해를 말하게 된다.
- **「전년대비」는 언제나 바로 앞 해다.** 분석 연도에서 앞 해를 빼도 증감의
  뜻은 바뀌지 않는다. 순위 변화는 전 연도로 계산한 뒤 고를 해만 남긴다 —
  프레임을 걸러서 계산하면 2020·2026만 고른 사용자에게 6년 간격을
  "전년대비" 라고 표시하게 된다.

### 데이터 갱신 (`POST /api/preprocess`)

상단바의 「데이터 갱신」 에서 대학알리미 공시 xlsx 를 올리면 데이터를 다시
만든다. 파일명에 `2026년` 또는 `2026_` 처럼 연도가 있어야 한다.

- **`Raw data/` 폴더 전체를 다시 계산한다.** 올린 파일만 처리하면 CSV 에 그
  연도만 남아 나머지가 사라진다 — 순위가 그 해 전체 대학을 놓고 매겨지는
  값이라 부분 계산이 성립하지 않는다.
- **실패하면 아무것도 바뀌지 않는다.** 임시 폴더에 쓰고 끝까지 성공했을 때만
  `output/` 에 반영한다. 업로드한 파일도 되돌린다 — 남겨 두면 다음 번 성공한
  실행이 그 잘못된 파일을 집어 든다.
- **덮어쓰기 직전 내용을 백업한다** (`output/.backup-<시각>/`, 최근 3개 유지).
- 쓰기 권한이 없는 배포(Vercel)에서는 409 로 거절한다. 그때 화면은 같은 패널을
  **「데이터 추가」 모드**로 열고 상단바 버튼도 「데이터 추가」로 바뀐다 — 모드는
  `/api/settings` 의 `canPersist` 가 정한다.

### 데이터 추가 (`POST /api/dataset/preview` + `overlay`) — 공개 사이트

서버에 쓸 수 없는 배포에서 새 공시 연도를 더하는 길이다. 공시 xlsx **한 개**를
올리면 서버가 그 해의 지표·순위를 메모리에서 계산해 영문 키 행으로 돌려주고
(`DatasetPreviewResponse`), 브라우저가 `localStorage`(2MB 상한)에 저장해 둔다.
이후 `/api/data`·`/api/regions`·`/api/universities`·`/api/stats`·`/api/narrative`·
`/api/report`·`POST /api/chart/{kind}.png` 요청 본문에 `overlay` 로 실리면 서버는
**그 요청 안에서만** 기본 데이터에 덧씌워 계산한다(같은 해는 덮어쓴다). 서버에는
아무것도 남지 않고 다른 사용자에게도 보이지 않는다.

- 한 해 안의 순위는 그 해 파일만으로 완결되므로 파일 하나로 충분하다.
- 파일은 4MB 까지(서버리스 요청 본문 상한 4.5MB 아래).
- overlay 는 표당 6,000행, 연도 2000–2100, 기본 데이터의 권역 이름만 받는다. 어기면 422.
- 차트 캐시 키와 `StatsResponse.overlayHash` 에 overlay 의 digest 가 들어간다.

서버 실행 후 http://127.0.0.1:8000/docs 에서 직접 호출해 볼 수 있다.

## 테스트

```bash
pytest -q                      # core + api
cd web
npm test                       # 컴포넌트 + 접근성(axe)
npm run e2e                    # Playwright (서버를 자동 기동)
npm run build                  # 타입검사 + 빌드 + 번들 예산
npm run storybook              # 컴포넌트 격리 확인
```

공개 사이트 모드(브라우저 키·데이터 추가)의 관통 테스트는 서버를 읽기 전용 강제
스위치로 띄워 따로 돈다. 8000 이 다른 프로그램에 잡혀 있으면 `API_PORT` 를 바꾼다.

```powershell
cd web
$env:API_PORT = '8011'; $env:HOSEO_FORCE_READONLY = '1'
npx playwright test readonly          # e2e/readonly.spec.ts — 스위치가 없으면 통째로 건너뛴다
```

### 이 저장소의 테스트 규약

- **테스트를 고쳐서 green 을 만드는 것은 실패다.** 구현이 틀렸는지 먼저 본다.
- **완료 기준은 `failed 0` 이 아니다.** 결함을 고치면 그 결함의
  `@pytest.mark.characterization` 테스트는 반드시 깨진다.
- `xfail_strict = true`. 남은 `xfailed` 6건은 의도적으로 고치지 않은 항목이며,
  하나라도 통과로 바뀌면 어떤 수정이 범위를 넘었다는 신호다.
- 디자인 값(색·간격·radius)은 `web/src/design/tokens.css` 밖에 존재하지 않는다.
  `design/tokens.test.ts` 가 소스를 스캔해 위반을 파일:줄까지 잡는다.
- **구조 규칙도 테스트가 강제한다**(`web/src/architecture.test.ts`) — 배럴을
  거치지 않는 import, 거꾸로 가는 의존, 단계끼리의 직접 참조를 잡는다.
  자세한 내용은 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- `scripts/export_openapi.py` 는 **반드시 프로젝트 venv 로** 실행한다. 다른
  인터프리터로 뽑으면 FastAPI 버전 차이로 스키마가 달라진다(스크립트가 막는다).

## 인스톨러

개발 PC 에서 빌드하고, 설치본은 **완전 오프라인**으로 동작한다.
Node 런타임은 사용자 PC 에 필요 없다 — `npm run build` 결과물만 들어간다.

```bash
cd web && npm run build && cd ..          # 화면 먼저
python installer/windows/build_windows.py # 임베디드 파이썬 + 의존성 번들
# 이후 Inno Setup 으로 installer/windows/setup.iss 컴파일

python scripts/verify_built_bundle.py     # 빌드된 번들을 실제로 띄워 관통 확인
```

`scripts/simulate_bundle.py` 는 임베디드 파이썬 없이 파일 구성만 빠르게 검증한다.

## Vercel 배포

FastAPI 앱이 함수 하나로 돌고, 화면(`web/dist`)은 Vercel 이 빌드해 CDN 으로 내보낸다.
설정은 `vercel.json`·`.vercelignore`·`main.py`(진입점) 세 파일에 있다.

```bash
vercel link
vercel deploy --prod
```

로컬과 다른 점이 몇 가지 있다.

- **디스크가 읽기 전용이다.** 그래서 서버는 상태를 들지 않고, 사용자가 넣는 것은
  **브라우저가 들고 요청마다 실어 보낸다**(`docs/ARCHITECTURE.md` 「요청 맥락」).
  - **OpenAI 키** — 상단바 「설정」에서 넣으면 그 브라우저의 `localStorage` 에만
    저장되고, 서술을 만들 때 `X-OpenAI-Key` 헤더로 서버를 거쳐 OpenAI 로 간다. 서버는
    응답·로그 어디에도 남기지 않는다. 방문자마다 자기 키를 쓰므로 운영자 키를 공개
    주소에 둘 필요가 없다.
  - **새 공시 데이터** — 「데이터 추가」에서 공시 xlsx 를 올리면 서버가 그 해를
    메모리에서 계산해 돌려주고(`POST /api/dataset/preview`), 브라우저가 저장해 두고
    이후 요청에 `overlay` 로 싣는다. 다른 방문자·서버에는 아무 영향이 없다. 전원이
    볼 기본 데이터를 바꾸려면 로컬에서 전처리한 `output/` 을 커밋해 다시 배포한다.
- **서버 환경변수 `OPENAI_API_KEY` 를 두면 브라우저 키가 없는 방문자도 그 키를 쓴다.**

  > **서술 API 에는 인증이 없다.** 운영자 키를 넣으면 주소를 아는 누구나 그 키의
  > 크레딧을 쓸 수 있다. 브라우저 키(BYOK)만으로 쓰는 것이 기본이고, 서버 키를 둘
  > 때는 사용량 상한을 먼저 정할 것. 브라우저 키가 있으면 언제나 그것이 먼저다.
- **공개 사이트 모드를 로컬에서 재현하려면** `HOSEO_FORCE_READONLY=1` 로 서버를
  띄운다 — `canPersist=false`, `/api/preprocess` 409, 서버 키 무시(「테스트」 참조).
- **파이썬은 3.12 로 돈다.** Vercel 런타임에 3.11 이 없다. `.python-version` 을
  올리면 빌드가 죽으므로 `.vercelignore` 로 뺐다.
- **차트 글꼴은 `core/fonts/` 의 나눔고딕이다.** 함수에는 시스템 폰트를 깔 수 없다.
- **요청·응답 본문은 4.5MB, 실행 시간은 300초까지다**(Hobby 기준).
- **의존성을 늘릴 때는 번들 크기를 볼 것.** 225MB 를 넘으면 Vercel 이 의존성을
  번들에서 빼고 새 인스턴스마다 PyPI 에서 내려받는다. 콜드 스타트가 수 초 늘고
  PyPI 장애가 곧 서비스 장애가 된다. 빌드 로그에 `optimizing dependencies` 가
  보이면 넘은 것이다. `uvicorn[standard]` 대신 `uvicorn` 을 쓰는 이유다.
- **공개 주소의 CPU 사용량은 방문자가 정한다.** Hobby 의 Active CPU 는 월 4시간이고
  다 쓰면 다음 주기까지 함수가 멈출 수 있다. 차트·보고서는 요청마다 약 1초를 쓴다.

## 기술 스택

| 영역 | 사용 |
|---|---|
| 서버 | FastAPI, uvicorn |
| 화면 | React 19, TypeScript, Vite, Tailwind CSS 4 |
| 차트 | recharts(화면), matplotlib(보고서) |
| 글꼴 | Pretendard Variable·Geist Mono 번들 (SIL OFL, `scripts/build_fonts.py`) |
| 디자인 | `DESIGN.md` — open-design `tom-modern` 의 한국어 적응. 값은 `web/src/design/tokens.css` 에만 |
| 데이터 | pandas, openpyxl |
| 문서 | python-docx |
| AI | OpenAI GPT-4o |
| 테스트 | pytest, Vitest, Testing Library, Playwright, Storybook, axe |

## 문제 해결

| 증상 | 해결 |
|---|---|
| 화면이 비어 있다 | `cd web && npm run build` 를 먼저 했는지 확인 |
| `데이터 파일이 없다` (503) | `python -c "from core.preprocess import main; main()"` 로 전처리 |
| GPT 서술이 503 | 상단바 「설정」에서 키를 넣는다. 공개 사이트는 브라우저에, 설치본·로컬은 서버 `.env` 에 저장된다. 환경변수로 넣을 때는 **평면 키**(`OPENAI_API_KEY=sk-…`) |
| `.env` 를 넣었는데 안 읽힌다 | 프로젝트 루트에 있는지 확인. 환경변수가 이미 설정돼 있으면 그쪽이 우선이다 |
| 숫자·연도가 모노스페이스가 아니다 | `web/public/fonts/` 가 비었거나 `manifest.json` 과 어긋났다. `python -X utf8 scripts/build_fonts.py --check` 로 확인 |
| 3단계 차트가 화면과 문서에서 다르다 | 차트 요청에 `compareGroup`·`years` 가 빠졌다. `chartUrl()` 을 거쳐 만든다 |
| 연도를 골랐는데 422 가 난다 | 기준 연도가 분석 연도 밖이다. 화면은 기준 연도를 따라 옮겨 준다 |
| 한글 폰트 깨짐 (차트) | Windows 는 맑은 고딕. Linux 는 시스템 `fonts-nanum`, 없으면 `core/fonts/` 의 번들 폰트 |
| CSV 한글 깨짐 | `encoding="utf-8-sig"` 사용 |
| 컬럼 탐지 실패 | 구형 포맷은 자동 폴백. 그래도 실패하면 `find_columns()` 키워드 조정 |
| 테스트가 `xpassed` 로 실패 | 의도적 xfail 이 통과한 것. 수정 범위가 넘쳤는지 확인 |

## 라이선스 (License)

[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/License-PolyForm%20Noncommercial%201.0.0-blue.svg)](https://polyformproject.org/licenses/noncommercial/1.0.0)

**Copyright (c) 2026 정화민 (Junghwamin). All rights reserved.**

비영리 목적에 한해 사용할 수 있다. 상업적 사용은 사전 서면 동의 없이 금지된다.
자세한 내용은 [LICENSE](LICENSE) 참조.
