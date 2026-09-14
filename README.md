# 호서대학교 — 연구실적 분석 포털 (Web)

대학알리미 원시 데이터(Excel)를 전처리하고, 권역·비교군 기준으로 분석해
GPT-4o 서술과 matplotlib 차트가 들어간 Word 보고서를 만든다.

**FastAPI + React** 구성이다. [Streamlit 판](https://github.com/Junghwamin/Hoseo-Research)을
이어받았으며, 통계·전처리·보고서 생성 로직(`core/`)은 그대로 가져왔다.

## 주요 기능

- **전처리 자동화**: 대학알리미 Excel(2016~2026)을 읽어 1인당 논문 수와 순위를 산출
- **구형/신형 포맷 모두 지원**: 연도별로 다른 헤더 구조를 자동 감지
- **권역 분석**: 전국 6개 권역 중 대상 대학이 속한 권역을 서버가 판정
- **GPT-4o 서술**: 추이·비교·권역·증감 4종. 생성 후 직접 편집 가능
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

키는 **서버에만 있다.** 브라우저로 내려가지 않으며, 프론트는 "설정됨/미설정"
여부만 안다. 키 없이도 전처리·통계·차트·보고서(서술 없는)는 전부 동작한다.

## 앱 워크플로우 (5단계)

| 단계 | 하는 일 |
|---|---|
| 1. 데이터 설정 | 대상 대학·기준 연도 선택. 권역은 서버가 자동 판정 |
| 2. 통계 확인 | 전국순위·권역순위·1인당논문수·전임교원수 |
| 3. 그래프 검토 | 추이 차트, 비교군 표, 전년 대비 증감 |
| 4. GPT 서술 | 4종 일괄 생성 후 편집. 단계를 오가도 사라지지 않는다 |
| 5. 보고서 생성 | Word 파일 내려받기 |

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
│   └── routers/                ← stats, report
│
├── web/                        ← React + TypeScript + Vite
│   ├── src/
│   │   ├── api/                ← 생성된 타입 + 클라이언트
│   │   ├── components/         ← MetricCard, TrendChart, CompareTable, YoYPanel …
│   │   ├── routes/Wizard.tsx   ← 5단계 화면
│   │   ├── store/              ← 순수 리듀서 상태 관리
│   │   └── styles/tokens.css   ← 디자인 토큰 단일 소스
│   ├── e2e/                    ← Playwright
│   └── dist/                   ← 빌드 산출물 (FastAPI 가 서빙)
│
├── tests/                      ← pytest (unit / contract / integration / api)
├── scripts/                    ← 번들 시뮬레이션, 설치본 검증, OpenAPI 내보내기
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
| `GET` | `/api/data` | 연도·권역 목록, 집계 대학 수, 순위 범위 안내 |
| `GET` | `/api/regions?university=` | 대학이 속한 권역(다중 캠퍼스는 복수) |
| `POST` | `/api/stats` | 추이·평균·순위변화·비교군·증감 |
| `POST` | `/api/narrative` | GPT 서술 4종 (일부 실패해도 나머지 반환) |
| `POST` | `/api/report` | Word 파일 (메모리 생성, 디스크에 남기지 않음) |

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
- 디자인 값(색·간격·radius)은 `web/src/styles/tokens.css` 밖에 존재하지 않는다.
  `tokens.test.ts` 가 소스를 스캔해 위반을 파일:줄까지 잡는다.

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
| 한글 폰트 깨짐 (차트) | Windows 는 맑은 고딕, Linux 는 `fonts-nanum` 설치 |
| CSV 한글 깨짐 | `encoding="utf-8-sig"` 사용 |
| 컬럼 탐지 실패 | 구형 포맷은 자동 폴백. 그래도 실패하면 `find_columns()` 키워드 조정 |
| 테스트가 `xpassed` 로 실패 | 의도적 xfail 이 통과한 것. 수정 범위가 넘쳤는지 확인 |

## 라이선스 (License)

[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/License-PolyForm%20Noncommercial%201.0.0-blue.svg)](https://polyformproject.org/licenses/noncommercial/1.0.0)

**Copyright (c) 2026 정화민 (Junghwamin). All rights reserved.**

비영리 목적에 한해 사용할 수 있다. 상업적 사용은 사전 서면 동의 없이 금지된다.
자세한 내용은 [LICENSE](LICENSE) 참조.
