# 호서대학교 — 연구실적 분석 포털 (Web)

대학알리미 원시 데이터(Excel)를 전처리하고, 권역·비교군 기준으로 분석해
GPT-4o 서술과 matplotlib 차트가 들어간 Word 보고서를 만든다.

**FastAPI + React** 구성이다. [Streamlit 판](https://github.com/Junghwamin/Hoseo-Research)을
이어받았으며, 통계·전처리·보고서 생성 로직(`core/`)은 그대로 가져왔다.

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

GPT 서술을 쓰려면 `OPENAI_API_KEY` 가 필요하다. **평면 키**로 넣는다.

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
├── core/                       ← 계산 로직. UI 프레임워크에 의존하지 않는다
│   ├── config.py               ← 대학명·비교군·경로·GPT 설정
│   ├── preprocess.py           ← 대학알리미 Excel → CSV
│   ├── data_loader.py          ← CSV 로드 + 통계 계산
│   ├── chart_generator.py      ← matplotlib 차트 5종 (보고서용)
│   ├── gpt_reporter.py         ← OpenAI 서술 생성
│   └── report_builder.py       ← python-docx 보고서 조립
│
├── api/                        ← FastAPI. core/ 를 감싸기만 한다
│   ├── main.py                 ← 진입점 + web/dist 정적 서빙
│   ├── deps.py                 ← 모집단 판정(권역·비교군)
│   ├── schemas.py              ← 응답 계약. 한글 키 → 영문 키 번역
│   └── routers/                ← stats, report, settings
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
│   ├── public/media/           ← 번들된 CC0 사진 (오프라인 대응)
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
| `GET` | `/api/settings` | API 키 설정 여부·출처·마스킹 힌트. **키 값은 절대 내려가지 않는다** |
| `POST` | `/api/settings/api-key` | API 키 저장 (`.env` 기록 + 프로세스 즉시 반영) |

`{kind}` 는 `trend`·`bar`·`avg`·`rank`·`compare` 다. 요청할 때 `compareGroup`
을 함께 보내야 한다 — 빼면 서버 기본 비교군으로 그려져 보고서와 그림이 갈라진다.

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

### 이 저장소의 테스트 규약

- **테스트를 고쳐서 green 을 만드는 것은 실패다.** 구현이 틀렸는지 먼저 본다.
- **완료 기준은 `failed 0` 이 아니다.** 결함을 고치면 그 결함의
  `@pytest.mark.characterization` 테스트는 반드시 깨진다.
- `xfail_strict = true`. 남은 `xfailed` 6건은 의도적으로 고치지 않은 항목이며,
  하나라도 통과로 바뀌면 어떤 수정이 범위를 넘었다는 신호다.
- 디자인 값(색·간격·radius)은 `web/src/design/tokens.css` 밖에 존재하지 않는다.
  `design/tokens.test.ts` 가 소스를 스캔해 위반을 파일:줄까지 잡는다.
- **구조 규칙도 테스트가 강제한다**(`web/src/architecture.test.ts`) — 배럴을
  거치지 않는 import, 거꾸로 가는 의존, 배럴로 새는 three.js 를 잡는다.
  자세한 내용은 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- `scripts/export_openapi.py` 는 **반드시 프로젝트 venv 로** 실행한다. 다른
  인터프리터로 뽑으면 FastAPI 버전 차이로 스키마가 달라진다(스크립트가 막는다).

## 인스톨러

개발 PC 에서 빌드하고, 설치본은 **완전 오프라인**으로 동작한다.
Node 런타임은 사용자 PC 에 필요 없다 — `npm run build` 결과물만 들어간다.

```bash
python scripts/fetch_media.py             # 배경 사진(CC0) 내려받기 — 최초 1회
cd web && npm run build && cd ..          # 화면 먼저
python installer/windows/build_windows.py # 임베디드 파이썬 + 의존성 번들
# 이후 Inno Setup 으로 installer/windows/setup.iss 컴파일

python scripts/verify_built_bundle.py     # 빌드된 번들을 실제로 띄워 관통 확인
```

`scripts/simulate_bundle.py` 는 임베디드 파이썬 없이 파일 구성만 빠르게 검증한다.

## 기술 스택

| 영역 | 사용 |
|---|---|
| 서버 | FastAPI, uvicorn |
| 화면 | React 19, TypeScript, Vite, Tailwind CSS 4 |
| 차트 | recharts(화면), matplotlib(보고서) |
| 3D | three.js (홈 히어로만, 지연 로딩) |
| 데이터 | pandas, openpyxl |
| 문서 | python-docx |
| AI | OpenAI GPT-4o |
| 테스트 | pytest, Vitest, Testing Library, Playwright, Storybook, axe |

## 문제 해결

| 증상 | 해결 |
|---|---|
| 화면이 비어 있다 | `cd web && npm run build` 를 먼저 했는지 확인 |
| `데이터 파일이 없다` (503) | `python -c "from core.preprocess import main; main()"` 로 전처리 |
| GPT 서술이 503 | `OPENAI_API_KEY` 를 **평면 키**로 설정. `[openai]` 테이블 형식은 인식되지 않는다 |
| `.env` 를 넣었는데 안 읽힌다 | 프로젝트 루트에 있는지 확인. 환경변수가 이미 설정돼 있으면 그쪽이 우선이다 |
| 히어로 배경이 비어 있다 | `python scripts/fetch_media.py` 를 실행했는지 확인 (CDN 을 쓰지 않는다) |
| 3단계 차트가 화면과 문서에서 다르다 | 차트 요청에 `compareGroup` 이 빠졌다. `chartUrl()` 을 거쳐 만든다 |
| 한글 폰트 깨짐 (차트) | Windows 는 맑은 고딕, Linux 는 `fonts-nanum` 설치 |
| CSV 한글 깨짐 | `encoding="utf-8-sig"` 사용 |
| 컬럼 탐지 실패 | 구형 포맷은 자동 폴백. 그래도 실패하면 `find_columns()` 키워드 조정 |
| 테스트가 `xpassed` 로 실패 | 의도적 xfail 이 통과한 것. 수정 범위가 넘쳤는지 확인 |

## 라이선스 (License)

[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/License-PolyForm%20Noncommercial%201.0.0-blue.svg)](https://polyformproject.org/licenses/noncommercial/1.0.0)

**Copyright (c) 2026 정화민 (Junghwamin). All rights reserved.**

비영리 목적에 한해 사용할 수 있다. 상업적 사용은 사전 서면 동의 없이 금지된다.
자세한 내용은 [LICENSE](LICENSE) 참조.
