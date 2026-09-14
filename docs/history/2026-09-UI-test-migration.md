# Streamlit UI 테스트 폐기 대조표

Streamlit → React 전환으로 폐기되는 **84건**(고유 함수 69개)이 각각 무엇을 지키던 테스트인지 기록한다.
지우기 전에 이 표를 만드는 이유는 하나다 — **테스트가 사라지면 그 테스트가 잡던 버그도 같이 잊힌다.**

원본은 `streamlit-origin` 리모트(= 기존 폴더)의 `64a45d6` 커밋에 그대로 남아 있다.

| 상태 | 의미 |
|---|---|
| **必** | React 에서 반드시 동등한 테스트를 만든다. 실제 결함이 났던 지점이다 |
| 권장 | 만들면 좋다. 일반적인 회귀 방지 |
| 폐기 | Streamlit 고유 문제라 React 에서는 대상이 없어진다 |

---

## A. 앱 부팅 · 라우팅 — `test_app_shell.py`

| 원래 테스트 | 지키던 것 | React 대응 | 상태 |
|---|---|---|---|
| `test_boots_without_exception_and_lands_on_home` | 앱이 예외 없이 뜨고 홈에서 시작 | Playwright: 루트 진입 스모크 | 권장 |
| `test_home_renders_only_research_card_enabled` | 홈에 연구실적만 활성 | **기능 플래그 테스트** — 꺼진 모듈이 DOM 에 아예 없을 것 | **必** |
| `test_home_card_click_routes_to_research_step1` | 카드 클릭 → 1단계 | Playwright: 홈→분석 라우팅 | 권장 |
| `test_sidebar_module_button_routes_to_research` | 사이드바 모듈 이동 | Playwright: 네비게이션 | 권장 |
| `test_sidebar_module_button_absent_for_active_module` | 현재 모듈은 버튼을 렌더하지 않음 | Vitest: `NavItem` 활성 상태 | 권장 |
| `test_step_buttons_enabled_only_up_to_max_step` | 도달하지 않은 단계는 잠김 | **Vitest: `StepNav` 게이팅** | **必** |
| `test_seeded_step_advances_max_step` | 진행하면 최대 도달 단계가 오름 | 상태 스토어 단위 테스트 | **必** |
| `test_max_step_never_decreases_when_going_back` | 뒤로 가도 최대 단계가 줄지 않음 | 상태 스토어 단위 테스트 | **必** |
| `test_max_step_survives_step_short_circuit` | **V19** — 조기 반환이 최대 단계 갱신을 건너뛰던 결함 | 상태 스토어 단위 테스트 | **必** |

> A 그룹의 `max_step` 4건은 전부 "진행 상태를 어디서 갱신하는가" 문제다. React 에서는 상태가 스토어 한 곳에 모이므로 **순수 함수 단위 테스트로 내려간다**(E2E 불필요).

## B. API 키 — `test_app_shell.py`

| 원래 테스트 | 지키던 것 | React 대응 | 상태 |
|---|---|---|---|
| `test_api_key_priority` | secrets → env → 플레이스홀더 거부 순서 | **서버 측 pytest** (키 해석은 API 로 이동) | **必** |
| `test_nested_secrets_form_is_ignored` | **V16** — 중첩 `[openai]` 테이블은 인식 안 됨 | 서버 설정 로딩 테스트 | **必** |
| `test_dialog_renders_when_flag_set` | 키 입력 다이얼로그 표시 | Vitest: `ApiKeyDialog` | 권장 |
| `test_save_updates_session_state_and_writes_dotenv` | 저장 시 `.env` 기록 | 서버 pytest: 저장 엔드포인트 | **必** |
| `test_save_skips_dotenv_in_cloud` | 클라우드에서는 파일 기록 안 함 | 서버 pytest: 환경 분기 | **必** |
| `test_short_key_is_rejected_without_saving` | 짧은 키 거부 | Vitest: 폼 검증 | 권장 |
| `test_sidebar_change_button_sets_flag` | 변경 버튼 동작 | Vitest | 권장 |

> **키가 클라이언트로 내려가면 안 된다.** React 전환에서 가장 조심할 보안 지점이다. 키는 서버에만 두고, 프론트는 "설정됨/미설정" 여부만 받는다. 이 원칙 자체를 테스트로 만든다(신규).

## C. 클라우드 / 로컬 분기 — `test_app_shell.py`

| 원래 테스트 | 지키던 것 | React 대응 | 상태 |
|---|---|---|---|
| `test_existing_source_card_disabled_only_in_cloud` | 클라우드에서 기존 output 사용 불가 | 서버 pytest | 권장 |
| `test_cloud_has_no_raw_save_button` | 클라우드에서 Raw 저장 버튼 없음 | 서버 pytest + 프론트 조건 렌더 | 권장 |
| `test_cloud_raw_source_shows_upload_warning` | 클라우드 업로드 안내 | Vitest | 권장 |
| `test_raw_dir_created_only_in_local` | 클라우드에서 디렉터리 생성 금지 | **서버 pytest** | **必** |
| `test_report_dir_created_only_in_local` | 동일 | **서버 pytest** | **必** |

> 파일 쓰기 분기는 React 와 무관하게 **서버에 그대로 남는다**. 테스트도 서버로 옮겨간다.

## D. 설정 화면 — `test_app_shell.py`

| 원래 테스트 | 지키던 것 | React 대응 | 상태 |
|---|---|---|---|
| `test_settings_renders_without_exception` | 설정 화면 렌더 | Vitest | 권장 |
| `test_settings_masks_api_key` | 키를 마스킹해 표시 | **Vitest: 마스킹 단위 테스트** | **必** |

> 현재 `settings` 라우트는 **UI 어디에서도 도달할 수 없다**(죽은 코드). React 에서는 실제로 도달 가능한 설정 화면으로 되살린다.

## E. 컴포넌트 — `test_components.py`

| 원래 테스트 | 지키던 것 | React 대응 | 상태 |
|---|---|---|---|
| `test_ui02_모듈_버튼_클릭시...` | 모듈 클릭 반환값·플래그 소비 | Vitest `NavItem` | 권장 |
| `test_ui03_단계_게이팅...` (2건) | 단계 버튼 활성 범위 | Vitest `StepNav` | **必** |
| `test_ui05_api_key_상태_뱃지...` (2건) | 키 설정 여부 뱃지 | Vitest `ApiKeyBadge` | 권장 |
| `test_ui06_툴바...` (2건) | 브레드크럼 항목 수·표시 내용 | Vitest `Breadcrumb` | 권장 |
| `test_ui07_delta_type...` (3건) | **V09** — 순위 변화 부호·화살표 방향 | **Vitest `MetricCard` 경계 테스트** | **必** |
| `test_ui08_gpt_section...` (3건) | 생성 버튼 비활성·예외 표시·결과 반영 | Vitest `NarrativeEditor` | **必** |
| `test_ui09_chart_card...` (2건) | breakdown 표·다운로드·확대 | Vitest `ChartCard` | 권장 |
| `test_ui10_home...` (3건) | 홈 카드 클릭·**준비중 비활성** | 기능 플래그 테스트로 대체 | **必** |
| `test_ui11_html_이스케이프` | **V18** — 대학명 HTML 미이스케이프 | **React 가 기본 이스케이프** → 대상 소멸 | 폐기 |
| `test_ui12_use_container_width_경고` | Streamlit deprecation 경고 | 대상 소멸 | 폐기 |
| `test_ui13_고아_닫는_div` | **D11** — HTML 래핑 깨짐 | 대상 소멸 (JSX 는 구조가 강제됨) | 폐기 |

> `ui07` 의 delta 방향은 **V09(개선이 빨간 하락으로 표시되던 결함)** 가 났던 곳이다. 부호 규약(양수 = 개선)을 React 컴포넌트 테스트에 그대로 옮긴다.

## F. 연구 분석 흐름 — `test_research_flow.py`, `test_research_extra.py`

**이 그룹이 가장 중요하다.** 확정 결함 잠금이 여기 몰려 있다.

| 원래 테스트 | 원래 결함 | React 대응 | 상태 |
|---|---|---|---|
| `test_r7_01_typed_narratives_survive_step_navigation` | **V07** — 4단계를 벗어났다 돌아오면 GPT 서술 4개 소실 | **Playwright: 단계 왕복 후 입력 보존** (4→5→4, 4→3→4, 사이드바 직행) | **必** |
| `test_r7_02_sidebar_reset_clears_analysis_state` | **V04** — 사이드바 리셋이 홈 이동만 하고 상태를 안 지움 | Playwright: 리셋 후 상태 초기화 | **必** |
| `test_r7_03_step1_renders_after_reset_and_reload` | **V05** — 리셋 후 재로드 시 TypeError 크래시 | Playwright: 리셋→재로드 | **必** |
| `test_r7_04_step5_reset_locks_later_steps` | **V06** — 리셋이 최대 단계를 안 되돌림 | 상태 스토어 단위 테스트 | **必** |
| `test_r7_11_reloading_data_resets_previous_filter_state` | **V17** — 재로드가 이전 데이터 잔재를 남김 | Playwright: A 로드→B 재로드 | **必** |
| `test_r7_12_reset_leaves_no_analysis_residue` | V04·V05·V06·V17 종합 | 상태 스토어: 리셋 후 파생 상태 전멸 | **必** |
| `test_r7_05_stats_are_scoped_to_target_region_after_load` | **V03** — 권역 미설정 시 권역평균이 전국 평균 | **API 계약 테스트 + 수치 대조** | **必** |
| `test_flt_01b_region_average_uses_whole_region_population` | **R-RS-01** — 필터가 권역 모집단을 비교군으로 좁힘 | **API 계약 테스트** | **必** |
| `test_flt_01a_filter_binds_region_and_compare_group` | 필터 적용 결과 결합 | API 계약 테스트 | **必** |
| `test_flt_02_multi_region_university_defaults_to_first_region` | 다중 캠퍼스 대학 권역 선택 | API + Playwright | **必** |
| `test_rrs02_타권역_대상이어도_비교군이_성립해야_한다` | **R-RS-02** — 비교군이 자기 자신 하나만 남음 | API 계약 테스트 | **必** |
| `test_rrs02_타권역_대상_선택시_비교군이_자기자신뿐이다` | 위의 특성화(현행 기록) | 수정 완료분이라 이관 불필요 | 폐기 |
| `test_r_rs_03_step2_yoy_info_reads_previous_to_current` | **R-RS-03** — 증감 안내 연도 순서 역순 | Vitest: 문구 생성 단위 테스트 | **必** |
| `test_r7_06_rank_improvement_renders_as_up` | **V09** — 순위 개선이 하락으로 표시 | Vitest `MetricCard` (E 그룹과 동일) | **必** |
| `test_r7_07_upload_paths_normalize_legacy_format` | **V02** — 레거시 CSV 업로드 시 KeyError | **서버 pytest: 업로드 정규화** | **必** |
| `test_r7_08_happy_path_produces_docx_with_narratives` | 5단계 관통 → 서술 포함 docx | **Playwright E2E 해피패스** | **必** |
| `test_r7_09_step4_gates_on_api_key` | 키 없으면 4단계 차단 | Playwright + 서버 가드 | **必** |
| `test_r7_10_step3_uses_chart_cache` | 차트 캐시 재사용 | 프론트 상태 테스트 | 권장 |
| `test_r7_10b_step3_generates_five_charts_when_cache_empty` | 캐시 비면 5종 생성 | 프론트 상태 테스트 | 권장 |

## G. CSS 계약 — `test_css_contract.py`

| 원래 테스트 | 지키던 것 | React 대응 | 상태 |
|---|---|---|---|
| `test_ui01_get_css_가_style_태그로...` | CSS 문자열 구조 | 대상 소멸 | 폐기 |
| `test_ui01_사용하는_모든_ir_클래스가...` | **D10** — 미정의 클래스 10개 | Tailwind + TS 가 구조적으로 방지 | 폐기 |
| `test_ui01_인라인_style_셀렉터가...` | **D09** — 인라인 CSS 충돌 | 규칙(§12-2)으로 대체 | 폐기 |
| `test_ui01_컴포넌트가_실제로_ir_클래스를...` | 클래스 사용 여부 | 대상 소멸 | 폐기 |

---

## 요약

| 구분 | 건수 |
|---|---|
| **必** — React 에서 반드시 재작성 | **31** |
| 권장 | 16 |
| 폐기 (Streamlit 고유) | 22 |
| 합계 (고유 함수) | 69 |

**폐기 22건 중 7건은 "좋은 소식"** 이다 — V18 HTML 미이스케이프, D09/D10/D11 CSS 문제, use_container_width 경고는 전부 Streamlit 에 HTML 을 억지로 밀어 넣어서 생긴 결함이고, React 에서는 발생할 구조 자체가 없다.

**必 31건 중 13건이 확정 결함 잠금**(V02·V03·V04·V05·V06·V07·V09·V16·V17·V19·R-RS-01·R-RS-02·R-RS-03)이다. 이것들은 "Streamlit 이라서 난 버그" 가 아니라 **"단계별 마법사에서 상태를 다루면 누구나 겪는 버그"** 다. React 로 옮겨도 같은 실수를 할 수 있으므로 반드시 다시 잠근다.
