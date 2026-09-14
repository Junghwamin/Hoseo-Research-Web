## 무엇을, 왜

<!-- 무엇을 바꿨는지보다 **왜** 바꿨는지가 중요합니다. -->

## 확인한 것

- [ ] `pytest -q`
- [ ] `cd web && npm test`
- [ ] `cd web && npm run build` (타입검사 + 번들 예산)
- [ ] `cd web && npm run e2e` (화면을 고쳤다면)
- [ ] API 를 고쳤다면 `python scripts/export_openapi.py && cd web && npm run gen:api`

## 테스트

<!-- 새 기능이면 테스트를 먼저 쓰고 실패를 확인했는지.
     결함 수정이면 그 결함을 재현하는 테스트가 있는지. -->
