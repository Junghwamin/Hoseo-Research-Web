# 호서대학교 정화민 — 연구실적 분석 포털 (Web)

## 프로젝트 개요

대학알리미 전임교원 연구실적 데이터를 전처리·분석하고, GPT-4o 서술과
matplotlib 차트가 들어간 Word 보고서를 만든다.

**FastAPI + React.** [Streamlit 판](https://github.com/Junghwamin/Hoseo-Research)을
이어받았고, 계산 로직(`core/`)은 그대로 가져왔다.

---

## 실행 방법

```bash
# 의존성 (최초 1회)
pip install -r requirements.txt
cd web && npm ci && cd ..

# 개발: 두 터미널
uvicorn api.main:app --reload --port 8000
cd web && npm run dev            # http://127.0.0.1:5173

# 단일 서버 (프론트를 빌드해 FastAPI 가 함께 서빙)
cd web && npm run build && cd ..
uvicorn api.main:app --port 8000  # http://127.0.0.1:8000
```

---

## 계층 구조 — 어디에 무엇을 넣는가

```
core/   계산. UI 프레임워크를 모른다. streamlit·fastapi 참조 0건을 유지할 것
api/    core/ 를 감싸기만 한다. 계산 로직을 여기 쓰지 않는다
web/    화면. 통계를 다시 계산하지 않고 API 응답을 그대로 그린다
```

이 경계가 이 프로젝트의 뼈대다. Streamlit → React 전환이 가능했던 이유가
`core/` 가 UI 를 몰랐기 때문이고, 다음 전환도 그래야 가능하다.

**한글 키는 `core/` 안에서만 쓴다.** `api/schemas.py` 의 번역표 한 곳에서
영문으로 바꾼다 — `1인당논문수` 는 숫자로 시작해 TypeScript 에서 속성 접근이
불가능하다. 코어를 고치면 안 되는 이유는 282건의 테스트가 한글 키를 계약으로
붙들고 있어서다.

---

## 테스트 (코드 수정 시 필수 준수)

```bash
pytest -q                  # core + api
cd web && npm test         # 컴포넌트 + 접근성
cd web && npm run e2e      # Playwright (서버 자동 기동)
cd web && npm run build    # 타입검사 + 빌드 + 번들 예산
```

**프로덕션 코드를 고쳤으면 반드시 돌리고 결과를 근거로 제시한다.
"고쳤습니다" 라는 보고만으로는 부족하다.**

### 반드시 알아야 할 것

1. **`xfail_strict = true`** — 결함 잠금 테스트가 예상외로 통과하면 실행이
   FAILED 로 떨어진다. 버그가 아니라 설계다. 테스트를 고쳐서 통과시키지 말고
   수정 범위를 다시 본다.
2. **테스트를 고쳐서 green 을 만드는 것은 실패다.**
3. **완료 기준은 `failed 0` 이 아니다.** 결함을 고치면 그 결함의
   `@pytest.mark.characterization` 테스트는 반드시 깨진다. 올바른 기준은
   "모든 실패가 strict XPASS 아니면 낡은 characterization, 그 밖은 0건".
4. `tests/conftest.py`, `pytest.ini`, `tests/fixtures/` 는 하네스다.
   통과시키려고 건드리면 스위트 전체가 거짓 통과한다.
   `tests/test_harness_guards.py` 가 감시한다.
5. **디자인 값은 `web/src/styles/tokens.css` 밖에 존재하지 않는다.**
   컴포넌트에 hex·rgb 리터럴을 쓰지 않는다. `tokens.test.ts` 가 파일:줄까지 잡는다.
6. **꺼진 기능은 렌더 트리에 올리지 않는다.** `web/src/features.ts` 의 플래그를
   통과한 것만 그린다. `disabled` 로 흐리게 보여주지 않는다 —
   Streamlit 판에서 홈 카드 2/3 이 "Coming Soon" 장식이었고 그게 불만의 실체였다.

### 알려진 함정

- **`core/chart_generator.py` 는 pyplot import 전에 `matplotlib.use("Agg")` 를
  못박는다.** 환경변수(`MPLBACKEND`)에 기대면 서버가 GUI 백엔드로 돌아
  요청 스레드에서 죽는다(`Tcl_AsyncDelete`). 실제로 그렇게 터졌다.
- **pyplot 은 전역 상태다.** 보고서 생성은 `api/routers/report.py` 의
  `_CHART_LOCK` 으로 직렬화한다. 동시 요청이 서로의 figure 를 건드린다.
- **`build/` 를 pytest `norecursedirs` 에 넣어 뒀다.** 인스톨러가 만든
  임베디드 파이썬의 site-packages 를 수집하다 죽는다.
- **E2E 워커는 4(CI 2)로 제한돼 있다.** 보고서 생성이 차트 락에 직렬화되므로
  워커를 늘리면 타임아웃이 '진짜 실패' 처럼 보인다.
- **API 타입은 손으로 쓰지 않는다.** 서버 스키마를 고쳤으면
  `python scripts/export_openapi.py && cd web && npm run gen:api`.
  잊으면 `tests/api/test_openapi_drift.py` 가 잡는다.

---

## 상태 관리 — 왜 리듀서인가

Streamlit 판의 확정 결함 중 **6건이 전부 상태 관리에서** 났다
(V04·V05·V06·V07·V17·V19). 공통 원인은 하나다 — 상태를 바꾸는 길이 여러
개였고 서로 어긋났다.

`web/src/store/reducer.ts` 가 전이를 하나로 모은다. 지켜야 할 규칙:

- **리셋은 키를 골라 지우지 않는다.** 초기 상태를 새로 만들어 돌려준다.
  고르는 순간 빠뜨린다.
- `clearDerived` 는 무엇을 *남길지*가 아니라 **무엇을 버릴지**를 적는다.
- **서술은 위젯이 아니라 스토어가 들고 있다.** 단계 이동과 무관해야 한다.
- 순위 변화는 **양수가 개선**이다. API 가 이미 그렇게 계산해 온다.
  화면에서 다시 뒤집지 않는다(V09 가 그 사고였다).

---

## 데이터 구조

```
output/전체_대학_데이터.csv   연도, 학교명, 전임교원수, SCI/SCOPUS논문수, 1인당논문수, 전국순위
output/권역별_순위.csv        위 + 권역명, 권역순위
config/universities.json      대학 정보·캠퍼스 매핑
config/regions.json           권역별 대학 목록
```

**전국순위는 등재 사립 대학 안에서의 순위다.** 국공립대·과기원은 집계에
없다. 이 사실을 화면에서 숨기지 않는다 — `/api/data` 가
`nationalRankScopeNote` 로 함께 돌려준다.

**제주권은 전 연도에 걸쳐 대학이 1개교뿐**이고 2026년에는 아예 없다.
비교군을 만들 수 없는 경우가 실제로 존재하므로, API 가 `compareGroupNote` 로
사유를 알린다. 조용히 자기 자신과 비교하게 두지 않는다.

---

## 인스톨러

개발 PC 에서 빌드하고 설치본은 완전 오프라인으로 돈다.
**Node 런타임은 사용자 PC 에 필요 없다** — `npm run build` 결과물만 들어간다.

```bash
cd web && npm run build && cd ..
python installer/windows/build_windows.py     # 임베디드 파이썬 + 의존성
python scripts/verify_built_bundle.py         # 빌드된 번들을 실제로 띄워 확인
python scripts/simulate_bundle.py             # 파일 구성만 빠르게 확인
```

`web/dist` 가 없으면 빌드가 멈춘다. 조용히 넘어가면 "서버는 뜨지만 빈 화면"
설치본이 나간다.

---

## 메모리 시스템

어시스턴트 메모리는 `~/.claude/projects/C--Users-----Desktop-Hoseo-Reasearch/memory/`
에 있다. 작업 이력은 `changelog.md`, 결함 상태는 `issues.md`.

---

## 커밋·푸시

- 커밋·푸시는 **사용자가 명시적으로 요청할 때만** 한다.
- 푸시 전 이 문서와 README 가 코드와 어긋나지 않는지 점검한다.
