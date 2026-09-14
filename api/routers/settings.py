# ============================================================================
# Copyright (c) 2026 정화민 (Junghwamin)
# Licensed under the PolyForm Noncommercial License 1.0.0.
# ============================================================================
"""서버 설정 — API 키 상태 확인과 저장.

**키 값은 절대 브라우저로 내려가지 않는다.** 설정됐는지, 어디서 읽었는지,
마스킹된 힌트만 알린다. Streamlit 판은 키를 `session_state` 에 담았는데
그건 화면과 같은 생명주기에 두는 것이고, 곧 브라우저로 보낸다는 뜻이었다.

저장은 `.env` 에 한다. 환경변수로 이미 주입된 값이 있으면 그쪽이 우선이므로
저장해도 이번 프로세스에는 반영되지 않는다 — 그 사실을 응답으로 알린다.
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter, HTTPException

from api import schemas

router = APIRouter(prefix="/api/settings", tags=["settings"])

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_PATH = PROJECT_ROOT / ".env"

#: 자리표시자. 이 값이 들어 있으면 설정되지 않은 것으로 본다.
PLACEHOLDER_PREFIXES = ("sk-여기에", "sk-your", "sk-xxx")

#: OpenAI 키의 최소 길이. 오타나 잘린 붙여넣기를 거른다.
MIN_KEY_LENGTH = 20


def _is_placeholder(key: str) -> bool:
    return any(key.startswith(p) for p in PLACEHOLDER_PREFIXES)


def _mask(key: str) -> str:
    """앞뒤만 남긴다. 가운데를 보여주면 마스킹의 의미가 없다."""
    if len(key) <= 10:
        return "sk-…"
    return f"{key[:5]}…{key[-4:]}"


def _read_dotenv_key() -> str | None:
    """`.env` 에 적힌 키를 읽는다. 파일이 없거나 없으면 None."""
    if not ENV_PATH.is_file():
        return None
    try:
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("OPENAI_API_KEY="):
                return line.split("=", 1)[1].strip().strip("'\"")
    except OSError:
        return None
    return None


def _can_persist() -> bool:
    """`.env` 에 쓸 수 있는가. 읽기 전용 배포에서는 저장 UI 를 숨겨야 한다."""
    try:
        if ENV_PATH.exists():
            return os.access(ENV_PATH, os.W_OK)
        return os.access(PROJECT_ROOT, os.W_OK)
    except OSError:
        return False


@router.get("", response_model=schemas.SettingsResponse)
def get_settings() -> schemas.SettingsResponse:
    env_key = os.environ.get("OPENAI_API_KEY", "").strip()
    dotenv_key = _read_dotenv_key()

    # 환경변수가 우선이다. main.py 의 load_dotenv 가 override=False 이므로
    # 실제 동작도 그렇다 — 배포 환경에서 주입한 값을 파일이 덮어쓰지 않는다.
    if env_key and not _is_placeholder(env_key):
        return schemas.SettingsResponse(
            apiKeyConfigured=True,
            apiKeySource="dotenv" if env_key == dotenv_key else "env",
            apiKeyHint=_mask(env_key),
            canPersist=_can_persist(),
        )

    return schemas.SettingsResponse(
        apiKeyConfigured=False,
        apiKeySource=None,
        apiKeyHint=None,
        canPersist=_can_persist(),
    )


@router.post("/api-key", response_model=schemas.SettingsResponse)
def set_api_key(req: schemas.ApiKeyRequest) -> schemas.SettingsResponse:
    key = req.apiKey.strip()

    if not key.startswith("sk-"):
        raise HTTPException(status_code=422, detail="OpenAI 키는 'sk-' 로 시작한다.")
    if _is_placeholder(key):
        raise HTTPException(status_code=422, detail="자리표시자를 그대로 넣었다.")
    if len(key) < MIN_KEY_LENGTH:
        raise HTTPException(
            status_code=422,
            detail=f"키가 너무 짧다({len(key)}자). 붙여넣다 잘리지 않았는지 확인할 것.",
        )
    if not _can_persist():
        raise HTTPException(
            status_code=409,
            detail=f"{ENV_PATH} 에 쓸 수 없다. 환경변수 OPENAI_API_KEY 로 설정할 것.",
        )

    from dotenv import set_key

    try:
        set_key(str(ENV_PATH), "OPENAI_API_KEY", key)
    except OSError as e:
        raise HTTPException(status_code=500, detail=f".env 기록 실패: {e}") from e

    # 이번 프로세스에도 즉시 반영한다. 안 하면 사용자가 저장한 뒤에도
    # 서버를 껐다 켜야 GPT 를 쓸 수 있다.
    os.environ["OPENAI_API_KEY"] = key

    return get_settings()
