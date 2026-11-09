# 프로젝트 스크립트

| 파일 | 하는 일 |
|---|---|
| `export_openapi.py` | FastAPI 스키마를 `web/openapi.json` 으로 내보낸다. 서버를 띄우지 않는다 |
| `build_fonts.py` | 번들 웹 글꼴(`web/public/fonts/`)과 `fonts.css`·`manifest.json` 을 처음부터 다시 만든다. `--check` 는 네트워크 없이 산출물만 검사한다 |
| `simulate_bundle.py` | 인스톨러가 복사할 파일만 모아 서버를 띄워 본다 (임베디드 파이썬 불필요, 빠름) |
| `verify_built_bundle.py` | **실제로 빌드된** 설치본을 그 안의 파이썬으로 띄워 관통 확인 |
| `hooks/` | Claude Code 개발 훅. 프로젝트 동작에 필요 없다 |

## API 를 고친 뒤

```bash
python scripts/export_openapi.py && cd web && npm run gen:api
```

잊으면 `tests/api/test_openapi_drift.py` 가 잡는다.

## 글꼴을 바꾸거나 다시 만들 때

```bash
uv pip install brotli            # woff2 압축. fontTools 는 matplotlib 과 함께 이미 있다
python -X utf8 scripts/build_fonts.py          # 내려받아 전부 다시 만든다
python -X utf8 scripts/build_fonts.py --check  # 산출물이 manifest 와 같은지만 본다 (CI)
```

입력은 npm 의 `pretendard@1.3.9` 타르볼과 `geist@1.7.2` 타르볼(Geist Mono 가변 글꼴,
라틴·숫자·기호만 서브셋) 둘이다. 스크립트가 두 입력의 sha256 을 확인하므로 상류가
바뀌면 조용히 다른 글꼴이 들어오지 않는다. 산출물(`web/public/fonts/`)은 저장소에 커밋한다 — 설치본과 Vercel 은
빌드 시점에 아무것도 내려받지 않는다. 출처와 라이선스는 `web/public/fonts/CREDITS.md`.

`tests/contract/test_fonts_bundle.py` 가 `--check` 와 manifest 를 검사한다.

## 인스톨러를 만든 뒤

```bash
python scripts/verify_built_bundle.py
```

파일 구성만 맞고 실제로는 안 뜨는 설치본을 걸러낸다.
