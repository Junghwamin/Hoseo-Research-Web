@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem ==========================================================================
rem  연구실적 분석 포털 — 로컬 실행
rem
rem  화면(web/dist)을 FastAPI 가 함께 서빙하므로 서버 하나면 된다.
rem  개발 중이라면 이 파일 대신 README 의 "개발 중에는" 절을 따를 것.
rem ==========================================================================

set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
rem 차트는 창을 띄우지 않는다. GUI 백엔드로 돌면 요청 스레드에서 죽는다.
set MPLBACKEND=Agg

if not exist "web\dist\index.html" (
    echo  [오류] 화면이 빌드되지 않았습니다.
    echo.
    echo  다음을 먼저 실행하세요:
    echo      cd web ^&^& npm ci ^&^& npm run build
    echo.
    pause
    exit /b 1
)

python -c "import uvicorn" >nul 2>&1
if errorlevel 1 (
    echo  [오류] 의존성이 설치되어 있지 않습니다.
    echo.
    echo  다음을 먼저 실행하세요:
    echo      pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

echo  서버를 시작합니다... http://127.0.0.1:8000
echo  종료하려면 이 창에서 Ctrl+C 를 누르세요.
echo.

start "" http://127.0.0.1:8000
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
