# ============================================================================
# Copyright (c) 2026 정화민 (Junghwamin)
# Licensed under the PolyForm Noncommercial License 1.0.0.
# ============================================================================
"""`POST /api/preprocess` 계약 — Raw Excel 업로드로 데이터 갱신.

원본 Streamlit 판의 「새 Raw Excel 파일 업로드」가 하던 일이다. 이관에서
엔드포인트째 빠져 있었다.

**이 파일의 모든 테스트는 `tmp_path` 안에서만 돈다.** 추적 중인 `output/`
을 건드리면 그 자리에서 실데이터 기준값이 날아가고, 그걸 되돌릴 방법은
Raw 전체를 다시 돌리는 것뿐이다. `monkeypatch.chdir` 이 유일한 안전장치다.

여기서 잠그는 것 넷:

1. **폴더 전체를 다시 계산한다** — 올린 파일만 처리하면 나머지 연도가 사라진다.
2. **실패하면 아무것도 바뀌지 않는다** — 업로드 파일까지 되돌린다.
3. **덮어쓰기 전에 백업한다.**
4. **경로를 벗어나지 못한다** — `../` 로 폴더 밖에 쓸 수 없다.
"""

from __future__ import annotations

import shutil
import unicodedata
from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api.main import app
from api import deps
from api.routers import report
from tests.conftest import RAW_AVAILABLE, RAW_DIR

# `report` 를 **모듈 레벨에서** 가져오는 것이 중요하다.
#
# `test_openapi_drift.py` 는 `sys.modules` 에서 `api*` 를 통째로 지우고 다시
# import 한다(프론트 빌드 유무에 따라 스키마가 달라지는지 보려고). 그래서 테스트
# 함수 안에서 import 하면 **app 이 쓰는 것과 다른 세대의 모듈**을 집어 온다 —
# `_CHART_CACHE` 도 `_reset_hooks` 도 각자 따로 있는 상태가 된다.
# 수집 시점에 한 번 묶어 두면 `app`·`deps`·`report` 가 같은 세대로 맞춰진다.

rawdata = pytest.mark.skipif(not RAW_AVAILABLE, reason="Raw data/*.xlsx 가 없다")


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _raw_files(limit: int = 2) -> list[Path]:
    """실제 Raw xlsx 몇 개. 전 연도를 돌리면 테스트가 느려진다."""
    paths = sorted(RAW_DIR.glob("*.xlsx"))
    if len(paths) < limit:
        pytest.skip(f"Raw 파일이 {limit}개 미만이다")
    return paths[-limit:]


@pytest.fixture
def workspace(tmp_path, monkeypatch):
    """`Raw data/` 에 실파일 2개를 둔 격리 작업 폴더.

    `chdir` 로 CWD 를 옮긴다 — 서비스가 `Path.cwd()` 기준으로 경로를 잡으므로
    이게 진짜 `output/` 을 건드리지 않게 하는 장치다.
    """
    raw = tmp_path / "Raw data"
    raw.mkdir()
    for path in _raw_files(2):
        shutil.copy2(path, raw / unicodedata.normalize("NFC", path.name))

    monkeypatch.chdir(tmp_path)
    deps.reset_cache()
    yield tmp_path
    deps.reset_cache()


def _upload(client: TestClient, name: str, data: bytes):
    return client.post(
        "/api/preprocess",
        files=[("files", (name, data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))],
    )


# ---------------------------------------------------------------------------
# 정상 경로
# ---------------------------------------------------------------------------


@rawdata
class TestIngest:
    def test_올린_연도만이_아니라_폴더_전체가_결과에_들어간다(self, client, workspace):
        """가장 중요한 계약이다.

        `process_in_memory` 는 넘긴 파일만 처리한다. 그 결과를 그대로
        내보내면 CSV 에 올린 연도만 남아 **나머지가 통째로 사라진다.**
        순위가 그 해 전체 대학을 놓고 매겨지는 값이라 부분 계산이 성립하지
        않는다.
        """
        existing = sorted(workspace.glob("Raw data/*.xlsx"))
        newcomer = _raw_files(3)[0]  # 폴더에 아직 없는 연도

        r = _upload(client, unicodedata.normalize("NFC", newcomer.name), newcomer.read_bytes())
        assert r.status_code == 200, r.text
        body = r.json()

        # 올린 것 1개 + 원래 있던 2개 = 3개년
        assert len(body["years"]) == len(existing) + 1
        assert len(body["sourceFiles"]) == len(existing) + 1
        assert body["universities"] > 0
        assert body["nationalRows"] > 0

    def test_CSV_가_실제로_쓰이고_그_연도를_담는다(self, client, workspace):
        newcomer = _raw_files(3)[0]
        body = _upload(
            client, unicodedata.normalize("NFC", newcomer.name), newcomer.read_bytes()
        ).json()

        csv = workspace / "output" / "전체_대학_데이터.csv"
        assert csv.exists(), "전처리가 CSV 를 쓰지 않았다"
        frame = pd.read_csv(csv, encoding="utf-8-sig")
        assert sorted(frame["연도"].unique().tolist()) == body["years"]

    def test_덮어쓰기_전에_백업한다(self, client, workspace):
        newcomer = _raw_files(3)[0]
        name = unicodedata.normalize("NFC", newcomer.name)
        data = newcomer.read_bytes()

        first = _upload(client, name, data).json()
        # 처음에는 덮어쓸 것이 없다
        assert first["backupPath"] is None

        second = _upload(client, name, data).json()
        assert second["backupPath"] is not None
        backup = workspace / "output" / second["backupPath"]
        assert (backup / "전체_대학_데이터.csv").exists()

    def test_전처리하면_차트_캐시도_버린다(self, client, workspace):
        """프레임 캐시만 비우면 화면 그림과 Word 그림이 갈라진다.

        `/api/report` 는 캐시를 거치지 않고 차트를 직접 그리는데
        `/api/chart` 는 캐시 히트라 옛 PNG 를 준다. 키에 데이터 판이 없어서
        생기는 일이고, **전처리로 재시작 없이 데이터를 바꿀 수 있게 되면서
        비로소 도달 가능해졌다** — 그 전에는 데이터 교체가 서버 재시작뿐이라
        재시작이 파생 캐시까지 전부 날렸다.
        """
        from io import BytesIO

        # 진짜 차트를 그려 캐시를 채우지 않는다. matplotlib 이 도는지·그 해에
        # 그 대학이 있는지에 결과가 달려 버리면, 정작 재고 싶은 것(**전처리가
        # 파생 캐시를 버리는가**)이 다른 이유로 흔들린다. 표식을 직접 넣는다.
        sentinel = {"rank": BytesIO(b"old-png")}
        report._CHART_CACHE[("표식", 2026, "충청권", (), ())] = sentinel
        assert len(report._CHART_CACHE) > 0

        newcomer = _raw_files(3)[0]
        _upload(client, unicodedata.normalize("NFC", newcomer.name), newcomer.read_bytes())

        assert len(report._CHART_CACHE) == 0, (
            "전처리 후에도 차트 캐시가 남아 있다 — 화면은 옛 그림, Word 는 새 그림이 된다"
        )

    def test_차트_캐시가_deps_에_등록되어_있다(self, client, workspace):
        # 위 테스트는 `clear()` 가 동작한다는 것만으로도 통과할 수 있다.
        # 훅이 실제로 걸려 있는지는 따로 못박는다 — 등록을 빠뜨리면
        # `reset_cache()` 를 부르는 **다른 경로**가 생겼을 때 조용히 새어나간다.
        assert report._drop_chart_cache in deps._reset_hooks

    def test_전처리하면_데이터_판이_오른다(self, client, workspace):
        # 브라우저 캐시를 깨는 토큰이다. 안 오르면 주소가 그대로라 브라우저가
        # 서버에 묻지도 않고 옛 PNG 를 계속 쓴다.
        before = deps.data_version()
        newcomer = _raw_files(3)[0]
        _upload(client, unicodedata.normalize("NFC", newcomer.name), newcomer.read_bytes())
        assert deps.data_version() > before

    def test_전처리_후_캐시가_새_데이터를_본다(self, client, workspace):
        """`reset_cache` 를 안 부르면 화면이 옛 숫자를 계속 본다.

        `deps._load` 가 `lru_cache` 라, CSV 를 새로 써도 이미 읽어 둔 프레임을
        그대로 돌려준다. 사용자는 "업로드했는데 아무것도 안 바뀐다" 를 본다.
        """
        newcomer = _raw_files(3)[0]
        _upload(client, unicodedata.normalize("NFC", newcomer.name), newcomer.read_bytes())

        years = client.get("/api/data").json()["years"]
        national, _ = deps.get_frames()
        assert sorted(national["연도"].unique().tolist()) == years


# ---------------------------------------------------------------------------
# 막아야 하는 것
# ---------------------------------------------------------------------------


@rawdata
class TestValidation:
    def test_대문자_확장자는_소문자로_저장한다(self, client, workspace):
        # `scan_raw_files` 가 `glob("*.xlsx")` 로 찾으므로 `.XLSX` 로 저장하면
        # **저장은 되는데 전처리가 건너뛴다** — "올렸는데 아무 일도 안
        # 일어났다" 가 된다.
        from api import preprocess_service as svc

        assert svc.safe_name("2026년_자료.XLSX") == "2026년_자료.xlsx"

    def test_xlsx_가_아니면_400(self, client, workspace):
        r = _upload(client, "2026년_자료.csv", b"not excel")
        assert r.status_code == 400
        assert "xlsx" in r.json()["detail"]

    def test_연도를_읽을_수_없는_파일명은_400(self, client, workspace):
        # 전처리가 조용히 건너뛴다. 올릴 때 막지 않으면 "올렸는데 아무 일도
        # 안 일어났다" 가 된다.
        r = _upload(client, "연구실적.xlsx", b"x" * 100)
        assert r.status_code == 400
        assert "연도" in r.json()["detail"]

    def test_경로를_벗어나는_파일명은_이름만_쓴다(self, client, workspace):
        """`../` 로 폴더 밖에 쓸 수 없어야 한다.

        브라우저가 보내는 이름을 그대로 경로에 붙이면 막을 곳이 여기밖에 없다.
        내용이 엑셀이 아니라 전처리는 실패하지만, **그 전에 어디에 쓰였는지**가
        이 테스트의 관심사다.
        """
        _upload(client, "../../탈출_2026년.xlsx", b"x" * 100)

        assert not (workspace.parent / "탈출_2026년.xlsx").exists()
        assert not (workspace / "탈출_2026년.xlsx").exists()

    def test_빈_파일은_400(self, client, workspace):
        r = _upload(client, "2026년_빈파일.xlsx", b"")
        assert r.status_code == 400

    def test_파일이_없으면_422(self, client, workspace):
        # FastAPI 가 필수 필드 누락으로 막는다
        assert client.post("/api/preprocess", files=[]).status_code == 422


# ---------------------------------------------------------------------------
# 실패해도 망가지지 않는다
# ---------------------------------------------------------------------------


@rawdata
class TestFailureLeavesNothingBehind:
    def test_엑셀이_아니면_output_이_그대로다(self, client, workspace):
        """파이프라인이 터져도 기존 데이터는 살아 있어야 한다."""
        newcomer = _raw_files(3)[0]
        _upload(client, unicodedata.normalize("NFC", newcomer.name), newcomer.read_bytes())

        csv = workspace / "output" / "전체_대학_데이터.csv"
        before = csv.read_bytes()

        # 이름은 멀쩡하지만 내용이 엑셀이 아니다 → read_excel 이 터진다
        r = _upload(client, "2099년_망가진파일.xlsx", b"PK\x03\x04 not really xlsx")
        assert r.status_code >= 400

        assert csv.read_bytes() == before, "실패한 업로드가 기존 CSV 를 건드렸다"

    def test_실패한_업로드_파일은_남지_않는다(self, client, workspace):
        """남겨 두면 **다음 번 성공한 실행이 그 잘못된 파일을 집어 든다.**

        실패한 업로드가 나중에 조용히 반영되는 셈이라, 원인을 찾기가 아주 어렵다.
        """
        broken = "2099년_망가진파일.xlsx"
        r = _upload(client, broken, b"PK\x03\x04 not really xlsx")
        assert r.status_code >= 400
        assert not (workspace / "Raw data" / broken).exists()

    def test_덮어쓴_파일은_원래_내용으로_돌아온다(self, client, workspace):
        target = sorted((workspace / "Raw data").glob("*.xlsx"))[0]
        original = target.read_bytes()

        # 같은 이름으로 망가진 내용을 올린다
        r = _upload(client, target.name, b"PK\x03\x04 broken")
        assert r.status_code >= 400
        assert target.read_bytes() == original, "덮어쓴 Raw 파일이 복구되지 않았다"
