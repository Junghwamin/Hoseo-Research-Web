# ============================================================================
# Copyright (c) 2026 정화민 (Junghwamin)
# Licensed under the PolyForm Noncommercial License 1.0.0.
# ============================================================================
"""Raw Excel 업로드 → 전처리 → 데이터 교체.

원본 Streamlit 판의 「새 Raw Excel 파일 업로드」(`research.py:885`)가 하던
일이다. 이관에서 서버 엔드포인트째 빠져, 새 연도 데이터가 나와도 화면에서
넣을 방법이 없었다 — 파일을 손으로 `Raw data/` 에 넣고 CLI 를 돌려야 했다.

## 이 모듈이 조심하는 것

**1. 올라온 파일만 처리하면 안 된다.** `core.preprocess.run_pipeline` 은
`Raw data/` **폴더 전체**를 다시 계산한다. 새 파일만 돌려서 내보내면 CSV 에
그 연도만 남아 나머지 10개년이 통째로 사라진다. 순위가 그 해 전체 대학을
놓고 매겨지는 값이라 부분 계산이라는 것이 아예 성립하지 않는다.

**2. 실패하면 아무것도 바뀌지 않아야 한다.** 파이프라인은 임시 폴더에 쓰고,
끝까지 성공했을 때만 `output/` 으로 옮긴다. 도중에 터지면 업로드한 파일까지
되돌린다 — 남겨 두면 다음 번 성공한 실행이 그 잘못된 파일을 집어 든다.

**3. 지우기 전에 남긴다.** 덮어쓰기 직전의 `output/` 을 백업해 둔다.
사용자가 잘못된 파일을 올렸을 때 되돌릴 방법이 있어야 한다.

**4. `output/` 폴더 자체는 옮기지 않는다.** `core.config` 가 import 시점에
경로를 값으로 붙들고 있어서, 폴더를 갈아치우면 상수가 사라진 곳을 가리킨다.
안에 든 파일만 제자리에서 바꾼다.
"""

from __future__ import annotations

import shutil
import tempfile
import unicodedata
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException

import core.preprocess as pp
from api import deps

#: 파일 하나의 상한. 대학알리미 공시 xlsx 는 보통 1~3MB 다.
MAX_FILE_BYTES = 30 * 1024 * 1024

#: 한 번에 올릴 수 있는 파일 수. 전 연도를 한꺼번에 올려도 넉넉하다.
MAX_FILES = 20

#: 남겨 둘 백업 개수. 오래된 것부터 지운다.
KEEP_BACKUPS = 3

#: 백업 폴더 이름의 앞머리. `output/` 안에 만들되 파일만 골라 담는다.
BACKUP_PREFIX = ".backup-"


def raw_dir() -> Path:
    """`Raw data/`. CWD 기준이라 테스트는 `monkeypatch.chdir` 로 격리한다."""
    return Path.cwd() / "Raw data"


def output_dir() -> Path:
    """`output/`. `core.config` 가 보는 것과 같은 곳이어야 한다."""
    return Path.cwd() / "output"


def safe_name(filename: str | None) -> str:
    """업로드 파일명을 검증해 **경로 없는 이름**으로 돌려준다.

    브라우저가 보내는 이름을 그대로 경로에 붙이면 `../` 로 폴더 밖에 쓸 수
    있다. 여기서 막지 않으면 막을 곳이 없다.
    """
    if not filename:
        raise HTTPException(status_code=400, detail="파일명이 없다.")

    # macOS 는 파일명을 NFD 로 보낸다. 정규화하지 않으면 '년' 이 자모로
    # 분해돼 연도 검사가 실패한다(scan_raw_files 와 같은 이유).
    name = unicodedata.normalize("NFC", filename).strip()

    # 경로 성분을 통째로 버린다. 이름만 쓴다.
    name = Path(name.replace("\\", "/")).name
    if not name or name in {".", ".."}:
        raise HTTPException(status_code=400, detail=f"쓸 수 없는 파일명이다: {filename}")

    if not name.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=400,
            detail=f"xlsx 파일만 받는다: {name}",
        )

    # 연도를 못 읽는 파일은 전처리가 조용히 건너뛴다. 올릴 때 막아야
    # "올렸는데 아무 일도 안 일어났다" 가 되지 않는다.
    if not pp.YEAR_PATTERN.search(name):
        raise HTTPException(
            status_code=400,
            detail=(
                f"파일명에서 연도를 읽을 수 없다: {name}. "
                f"'2026년_...' 또는 '2026_...' 형태여야 한다."
            ),
        )

    return name


def ingest(uploads: list[tuple[str, bytes]]) -> dict:
    """업로드를 `Raw data/` 에 넣고 전처리를 돌려 `output/` 을 갱신한다.

    Returns:
        처리 요약 + 무엇을 저장하고 무엇을 백업했는지.
    """
    if not uploads:
        raise HTTPException(status_code=400, detail="올린 파일이 없다.")
    if len(uploads) > MAX_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"한 번에 {MAX_FILES}개까지 올릴 수 있다. 받은 파일: {len(uploads)}개",
        )

    raw = raw_dir()
    out = output_dir()
    raw.mkdir(parents=True, exist_ok=True)

    # (경로, 원래 내용) — 실패하면 이걸로 되돌린다. None 은 "원래 없던 파일".
    written: list[tuple[Path, bytes | None]] = []

    try:
        for name, data in uploads:
            if len(data) > MAX_FILE_BYTES:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"{name} 이(가) 너무 크다 "
                        f"({len(data) // (1024 * 1024)}MB, 상한 {MAX_FILE_BYTES // (1024 * 1024)}MB)."
                    ),
                )
            if not data:
                raise HTTPException(status_code=400, detail=f"{name} 이(가) 비어 있다.")

            dest = raw / name
            previous = dest.read_bytes() if dest.exists() else None
            dest.write_bytes(data)
            written.append((dest, previous))

        with tempfile.TemporaryDirectory(prefix="preprocess-") as tmp:
            staging = Path(tmp) / "output"
            try:
                summary = pp.run_pipeline(raw, staging)
            except pp.PreprocessError as e:
                # 사용자가 읽고 고칠 수 있는 상황이다(폴더 없음, 연도 없음).
                raise HTTPException(status_code=400, detail=str(e)) from e
            except Exception as e:
                # 파일 내용이 기대와 다르면 코어가 제각각의 예외를 던진다
                # (`BadZipFile`, `KeyError`, `ValueError`…). 그대로 새어 나가면
                # 사용자는 아무 설명 없는 500 을 본다. **원인이 대개 올린
                # 파일이므로** 400 으로, 무엇을 확인해야 하는지와 함께 올린다.
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "전처리가 실패했다. 올린 파일이 대학알리미 "
                        "「전임교원의 연구 실적」 공시 xlsx 가 맞는지 확인할 것. "
                        f"({type(e).__name__}: {e})"
                    ),
                ) from e

            backup = _replace_outputs(staging, out)

    except Exception:
        _rollback(written)
        raise

    # CSV 가 새로 쓰였으니 들고 있던 프레임은 옛것이다.
    deps.reset_cache()

    return {
        **summary,
        "savedFiles": [p.name for p, _ in written],
        "backupPath": backup.name if backup else None,
    }


def _replace_outputs(staging: Path, out: Path) -> Path | None:
    """전처리 결과를 `output/` 에 반영하고, 직전 내용을 백업해 돌려준다.

    폴더를 바꿔치지 않고 **파일만 제자리에서** 덮어쓴다. `core.config` 가
    경로를 값으로 들고 있어서 폴더를 갈아치우면 상수가 사라진 곳을 가리킨다.
    """
    out.mkdir(parents=True, exist_ok=True)

    existing = [p for p in out.iterdir() if p.is_file()]
    backup: Path | None = None
    if existing:
        backup = out / f"{BACKUP_PREFIX}{datetime.now():%Y%m%d-%H%M%S}"
        backup.mkdir(parents=True, exist_ok=True)
        for src in existing:
            shutil.copy2(src, backup / src.name)

    for src in staging.iterdir():
        if src.is_file():
            shutil.copy2(src, out / src.name)

    _prune_backups(out)
    return backup


def _prune_backups(out: Path) -> None:
    """오래된 백업을 지운다. 무한히 쌓으면 설치본 디스크를 채운다."""
    backups = sorted(
        (p for p in out.iterdir() if p.is_dir() and p.name.startswith(BACKUP_PREFIX)),
        key=lambda p: p.name,
    )
    for stale in backups[:-KEEP_BACKUPS]:
        shutil.rmtree(stale, ignore_errors=True)


def _rollback(written: list[tuple[Path, bytes | None]]) -> None:
    """업로드한 파일을 되돌린다.

    남겨 두면 다음 번 성공한 실행이 그 잘못된 파일을 집어 든다 — 실패한
    업로드가 나중에 조용히 반영되는 셈이라, 원인을 찾기가 아주 어렵다.
    """
    for path, previous in reversed(written):
        try:
            if previous is None:
                path.unlink(missing_ok=True)
            else:
                path.write_bytes(previous)
        except OSError:
            # 되돌리기 실패까지 숨기지는 않되, 원래 예외를 덮지도 않는다.
            continue


__all__ = ["MAX_FILES", "MAX_FILE_BYTES", "ingest", "output_dir", "raw_dir", "safe_name"]
