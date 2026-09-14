# 기여 안내

## 개발 환경

```bash
pip install -r requirements.txt -r requirements-dev.txt
cd web && npm ci && cd ..
```

Python 3.11, Node 22 를 쓴다. 버전은 `.python-version` 과 `web/package.json` 의
`engines` 를 따른다.

## 실행

```bash
# 개발 (터미널 두 개)
uvicorn api.main:app --reload --port 8000
cd web && npm run dev

# 단일 서버
cd web && npm run build && cd .. && uvicorn api.main:app --port 8000
```

## 계층 경계

```
core/   계산. UI 프레임워크를 모른다
api/    core/ 를 감싼다. 계산 로직을 두지 않는다
web/    화면. 통계를 다시 계산하지 않는다
```

이 경계가 이 프로젝트의 뼈대다. Streamlit → React 전환이 가능했던 이유가
`core/` 가 UI 를 몰랐기 때문이다. 다음 전환도 그래야 가능하다.

**`core/` 에 `streamlit`·`fastapi` 를 import 하지 않는다.** 테스트가 감시한다.

## 테스트

```bash
pytest -q                  # core + api
cd web && npm test         # 컴포넌트 + 접근성
cd web && npm run e2e      # Playwright (서버 자동 기동)
cd web && npm run build    # 타입검사 + 빌드 + 번들 예산
```

### 규약

1. **테스트를 고쳐서 green 을 만드는 것은 실패다.** 구현이 틀렸는지 먼저 본다.
2. **완료 기준은 `failed 0` 이 아니다.** 결함을 고치면 그 결함의
   `@pytest.mark.characterization` 테스트는 반드시 깨진다. 올바른 기준은
   "모든 실패가 strict XPASS 아니면 낡은 characterization, 그 밖은 0건".
3. `xfail_strict = true` 다. 남은 `xfailed` 는 의도적으로 고치지 않은 항목이며,
   하나라도 통과로 바뀌면 어떤 수정이 범위를 넘었다는 신호다.
4. `tests/conftest.py`, `pytest.ini`, `tests/fixtures/` 는 하네스다.
   통과시키려고 건드리면 스위트 전체가 거짓 통과한다.

### 새 기능에는 테스트를 먼저 쓴다

1. 계약을 타입으로 선언
2. 실패하는 테스트 작성 → **실패를 눈으로 확인**
3. 통과할 만큼만 구현
4. 경계 케이스 추가 (빈 값, `null`, `0`, 음수, 긴 한글, HTML 문자열)

`null` 과 `0` 을 반드시 구분한다. 이 프로젝트에서 가장 많이 났던 종류의 결함이다.

## 디자인

**색·간격·radius 값은 `web/src/styles/tokens.css` 밖에 존재하지 않는다.**
컴포넌트에 hex·rgb 리터럴을 쓰지 않는다. `tokens.test.ts` 가 소스를 스캔해
위반을 파일:줄까지 잡는다.

정보를 **색만으로 전달하지 않는다.** 증감은 화살표와 스크린리더 라벨을
함께 쓴다.

## API 를 고쳤으면

```bash
python scripts/export_openapi.py && cd web && npm run gen:api
```

잊으면 `tests/api/test_openapi_drift.py` 가 잡는다. 프론트 타입은 손으로 쓰지 않는다.

## 커밋

- 한 커밋에 한 가지 일. 메시지는 **왜** 그렇게 했는지를 적는다
- Conventional Commits 접두사를 쓴다: `feat:` `fix:` `test:` `docs:` `refactor:` `ci:`
- 푸시 전 README·CLAUDE.md 가 코드와 어긋나지 않는지 본다

## 인스톨러

```bash
cd web && npm run build && cd ..
python installer/windows/build_windows.py
python scripts/verify_built_bundle.py   # 실제로 띄워 관통 확인
```

`web/dist` 가 없으면 빌드가 멈춘다. 조용히 넘어가면 "서버는 뜨지만 빈 화면"
설치본이 나간다.
