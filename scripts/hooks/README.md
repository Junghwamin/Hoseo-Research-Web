# Claude Code 훅 스크립트

개발 중 보조로 쓰는 Claude Code 훅들이다. **어디에도 배선돼 있지 않다** —
`.claude/settings.json` 에 등록해야 동작한다.

프로젝트를 빌드하거나 테스트하는 데 필요하지 않으므로, 쓰지 않는다면
이 디렉터리째 지워도 된다.

| 파일 | 하는 일 |
|---|---|
| `smoke_test.py` | 핵심 모듈 변경 시 데이터 파이프라인을 한 번 관통한다 |
| `syntax_check.py` | 편집 직후 구문 검사 |
| `import_check.py` | 모듈이 import 되는지 확인 |
| `dependency_check.py` | requirements 와 설치본 대조 |
| `auto_pip_install.py` | 빠진 의존성 자동 설치 |
| `backup_on_edit.py` | 편집 전 백업 |
| `log_change.py` | 변경 로그 기록 |
| `memory_update_reminder.py` | 메모리 갱신 알림 |
| `session_end_summary.py` | 세션 종료 시 체크리스트 |

> `smoke_test.py` 는 PostToolUse 훅이라 stdin 으로 JSON 을 받는다.
> 그냥 실행하면 조용히 exit 0 한다 — 통과로 착각하기 쉽다.
> ```bash
> echo '{"tool_input":{"file_path":"core/data_loader.py"}}' | python scripts/hooks/smoke_test.py
> ```
