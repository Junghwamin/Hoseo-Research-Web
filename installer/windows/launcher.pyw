"""
호서대학교 정화민 - 연구실적 분석 포털 - Windows 런처

바탕화면 아이콘에서 실행되는 진입점.
콘솔 창 없이 Streamlit 서버를 시작하고 기본 브라우저를 연다.

.pyw 확장자로 pythonw.exe가 실행하므로 콘솔 창이 표시되지 않는다.
실패 시 app_error.log에 원인을 기록한다.
"""

import os
import socket
import subprocess
import sys
import time
import webbrowser
from datetime import datetime
from pathlib import Path


def find_free_port(start=8501, end=8510):
    """사용 가능한 포트를 찾는다. 8501부터 시도."""
    for port in range(start, end + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return start


def wait_for_server(port, proc=None, timeout=60):
    """API 가 실제로 응답할 때까지 기다린다.

    소켓이 열린 것과 앱이 준비된 것은 다르다. uvicorn 은 포트를 먼저 잡고
    import 를 마저 하는데, 그 사이에 브라우저를 열면 빈 화면을 본다.
    `/api/health` 가 200 을 줄 때까지 기다린다.

    `proc` 을 주면 서버가 **죽었을 때 즉시 포기한다** — 안 그러면 이미 끝난
    프로세스를 60초 동안 기다리게 된다.
    """
    import urllib.error
    import urllib.request

    url = f"http://127.0.0.1:{port}/api/health"
    start_time = time.time()
    while time.time() - start_time < timeout:
        if proc is not None and proc.poll() is not None:
            return False  # 서버가 이미 종료됐다
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                if resp.status == 200:
                    return True
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(0.5)
    return False


def show_error(message):
    """Windows 메시지 박스로 에러를 표시한다."""
    try:
        import ctypes
        ctypes.windll.user32.MessageBoxW(
            0, message, "연구실적 분석 포털 - 오류", 0x10,
        )
    except Exception:
        pass


def main():
    app_dir = Path(__file__).resolve().parent
    python_exe = app_dir / "python-embed" / "python.exe"
    log_path = app_dir / "app_error.log"

    # 로그 파일 준비
    log = open(log_path, "w", encoding="utf-8")
    log.write(f"시작: {datetime.now().isoformat()}\n")
    log.write(f"앱 경로: {app_dir}\n")
    log.write(f"Python: {python_exe}\n\n")

    # Python 존재 확인
    if not python_exe.exists():
        msg = f"Python을 찾을 수 없습니다.\n경로: {python_exe}"
        log.write(f"[오류] {msg}\n")
        log.close()
        show_error(msg)
        return

    # 포트 확보
    port = find_free_port()
    log.write(f"포트: {port}\n")

    # 환경 변수
    env = os.environ.copy()
    env["PYTHONUTF8"] = "1"
    # 한글 파일명·로그가 cp949 로 깨지지 않게 한다
    env["PYTHONIOENCODING"] = "utf-8"
    # 차트는 창을 띄우지 않는다. 백엔드는 core/chart_generator 가 직접
    # 못박지만, 혹시 다른 경로로 import 되더라도 안전하도록 한 번 더 건다.
    env["MPLBACKEND"] = "Agg"

    # Streamlit 서버 시작 — stderr를 로그 파일로 리디렉션
    CREATE_NO_WINDOW = 0x08000000
    stderr_path = app_dir / "server_error.log"
    stderr_file = open(stderr_path, "w", encoding="utf-8")

    log.write("API 서버 시작 중...\n")
    log.flush()

    proc = subprocess.Popen(
        [
            str(python_exe), "-m", "uvicorn", "api.main:app",
            "--host", "127.0.0.1",
            "--port", str(port),
            # 설치본은 단일 사용자다. 워커를 늘리면 메모리만 더 쓴다.
            "--workers", "1",
            "--log-level", "warning",
        ],
        cwd=str(app_dir),
        env=env,
        creationflags=CREATE_NO_WINDOW,
        stdout=subprocess.DEVNULL,
        stderr=stderr_file,
    )

    # 서버 대기 — 죽으면 즉시 포기한다
    if wait_for_server(port, proc=proc):
        log.write(f"서버 시작 성공: http://localhost:{port}\n")
        log.close()
        webbrowser.open(f"http://localhost:{port}")
    else:
        stderr_file.close()
        stderr_content = stderr_path.read_text(encoding="utf-8", errors="replace")
        log.write(f"[실패] 서버 타임아웃\n\n--- stderr ---\n{stderr_content}\n")
        log.close()
        show_error(
            f"앱 서버 시작에 실패했습니다.\n\n"
            f"오류 로그:\n{log_path}\n{stderr_path}\n\n"
            f"이 파일을 개발자에게 전달해 주세요."
        )
        proc.terminate()
        return

    # 서버 종료 대기
    try:
        proc.wait()
    except KeyboardInterrupt:
        proc.terminate()
    finally:
        stderr_file.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        app_dir = Path(__file__).resolve().parent
        log_path = app_dir / "app_error.log"
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"\n[예외] {type(e).__name__}: {e}\n")
        show_error(f"오류 발생: {e}\n\n로그: {log_path}")
