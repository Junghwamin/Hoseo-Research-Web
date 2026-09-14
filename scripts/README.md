# 프로젝트 스크립트

| 파일 | 하는 일 |
|---|---|
| `export_openapi.py` | FastAPI 스키마를 `web/openapi.json` 으로 내보낸다. 서버를 띄우지 않는다 |
| `simulate_bundle.py` | 인스톨러가 복사할 파일만 모아 서버를 띄워 본다 (임베디드 파이썬 불필요, 빠름) |
| `verify_built_bundle.py` | **실제로 빌드된** 설치본을 그 안의 파이썬으로 띄워 관통 확인 |
| `hooks/` | Claude Code 개발 훅. 프로젝트 동작에 필요 없다 |

## API 를 고친 뒤

```bash
python scripts/export_openapi.py && cd web && npm run gen:api
```

잊으면 `tests/api/test_openapi_drift.py` 가 잡는다.

## 인스톨러를 만든 뒤

```bash
python scripts/verify_built_bundle.py
```

파일 구성만 맞고 실제로는 안 뜨는 설치본을 걸러낸다.
