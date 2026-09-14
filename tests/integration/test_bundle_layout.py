# ============================================================================
# Copyright (c) 2026 정화민 (Junghwamin)
# Licensed under the PolyForm Noncommercial License 1.0.0.
# ============================================================================
"""설치본에 들어가는 파일만으로 앱이 도는가.

개발 트리에서는 돌던 것이 설치본에서 안 도는 사고가 흔하다. 빌드 스크립트가
빠뜨린 파일은 개발 트리에 그대로 있으니 아무도 모르기 때문이다.

여기서는 **빌드 스크립트가 복사하기로 한 목록**을 정적으로 검사한다.
실제 기동까지 보는 것은 `scripts/simulate_bundle.py` 가 맡는다 — 임베디드
파이썬 다운로드 없이 레이아웃만 흉내 내 서버를 띄운다.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from tests.conftest import PROJECT_ROOT

BUILD_WINDOWS = PROJECT_ROOT / "installer" / "windows" / "build_windows.py"
LAUNCHER = PROJECT_ROOT / "installer" / "windows" / "launcher.pyw"
BUILD_MACOS = PROJECT_ROOT / "installer" / "macos" / "build_macos.sh"


def _source(path: Path) -> str:
    if not path.exists():
        pytest.skip(f"{path.name} 이 없다")
    return path.read_text(encoding="utf-8")


class TestWindowsBundle:
    def test_서버와_화면을_모두_복사한다(self):
        """api/ 와 web/dist 가 빠지면 각각 서버 없음·빈 화면으로 배포된다."""
        src = _source(BUILD_WINDOWS)
        for needed in ('"api"', '"core"', '"config"', 'web" / "dist'):
            assert needed in src, f"빌드가 {needed} 를 복사하지 않는다"

    def test_web_dist_가_없으면_빌드를_멈춘다(self):
        # 조용히 넘어가면 서버는 뜨지만 화면이 빈 설치본이 나간다.
        src = _source(BUILD_WINDOWS)
        assert "web_dist.is_dir()" in src
        assert "SystemExit" in src or "raise" in src

    def test_사라진_경로를_참조하지_않는다(self):
        """Phase 0 에서 옮긴 경로를 그대로 두면 빌드가 FileNotFoundError 로 죽는다."""
        src = _source(BUILD_WINDOWS)
        assert "전임교원_연구실적_전처리.py" not in src, (
            "전처리는 core/preprocess.py 로 옮겨졌다. 옛 경로를 복사하려 하면 빌드가 죽는다."
        )
        # 주석에 남은 언급은 무해하므로 실제 복사 호출만 본다
        tree = ast.parse(src)
        copied = {
            ast.unparse(node)
            for node in ast.walk(tree)
            if isinstance(node, ast.Call) and "copytree" in ast.unparse(node.func)
        }
        assert not any("report_app" in c for c in copied), (
            f"삭제된 report_app 을 복사하려 한다: {copied}"
        )

    def test_streamlit_설정을_번들하지_않는다(self):
        """Streamlit 을 안 쓰는데 .streamlit/ 을 넣으면 secrets 유출 통로만 남는다(V22)."""
        src = _source(BUILD_WINDOWS)
        tree = ast.parse(src)
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and "copytree" in ast.unparse(node.func):
                assert ".streamlit" not in ast.unparse(node), (
                    "빌드가 .streamlit/ 을 복사한다"
                )


class TestLauncher:
    def test_uvicorn_을_띄운다(self):
        src = _source(LAUNCHER)
        assert "uvicorn" in src
        assert "api.main:app" in src
        assert "streamlit" not in src, "런처가 아직 streamlit 을 띄우려 한다"

    def test_헬스_엔드포인트로_준비를_확인한다(self):
        """소켓이 열린 것과 앱이 준비된 것은 다르다.

        uvicorn 은 포트를 먼저 잡고 import 를 마저 한다. 그 사이에 브라우저를
        열면 사용자는 빈 화면을 본다.
        """
        src = _source(LAUNCHER)
        assert "/api/health" in src, "포트 연결만 보고 브라우저를 열면 빈 화면이 뜬다"

    def test_서버가_죽으면_기다리지_않는다(self):
        # 이미 끝난 프로세스를 60초 기다리면 사용자는 앱이 멈춘 줄 안다.
        src = _source(LAUNCHER)
        assert "proc.poll()" in src

    def test_헤드리스_백엔드를_환경에도_건다(self):
        # core/chart_generator 가 직접 못박지만, 런처도 한 번 더 건다.
        # GUI 백엔드로 돌면 요청 스레드에서 Tk 를 건드려 프로세스가 죽는다.
        src = _source(LAUNCHER)
        assert "MPLBACKEND" in src


class TestMacBundle:
    def test_서버와_화면을_모두_복사한다(self):
        src = _source(BUILD_MACOS)
        for needed in ("core", "api", "web/dist"):
            assert needed in src, f"macOS 빌드가 {needed} 를 복사하지 않는다"

    def test_uvicorn_으로_띄운다(self):
        launcher = PROJECT_ROOT / "installer" / "macos" / "launcher.sh"
        src = _source(launcher)
        assert "uvicorn" in src
        assert "streamlit" not in src
