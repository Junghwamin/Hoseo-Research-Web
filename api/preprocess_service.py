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

import os
import shutil
import tempfile
import unicodedata
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException

import pandas as pd

import core.preprocess as pp
from api import deps, schemas

#: 파일 하나의 상한. 대학알리미 공시 xlsx 는 보통 1~3MB 다.
MAX_FILE_BYTES = 30 * 1024 * 1024

#: 미리보기(`/api/dataset/preview`) 한 파일의 상한. Vercel 함수의 요청 본문
#: 상한이 4.5MB 라 그 아래에서 **우리가 먼저 알아듣는 말로** 거절한다 — 넘기면
#: 앞단이 본문 없는 413 을 돌려줘 화면은 숫자만 본다.
MAX_PREVIEW_BYTES = 4 * 1024 * 1024
PREVIEW_TOO_LARGE_DETAIL = "파일이 4MB 를 넘습니다. 공시 xlsx 원본은 보통 1–3MB 입니다."

#: 한 번에 올릴 수 있는 파일 수. 전 연도를 한꺼번에 올려도 넉넉하다.
MAX_FILES = 20

#: 남겨 둘 백업 개수. 오래된 것부터 지운다.
KEEP_BACKUPS = 3

#: 백업 폴더 이름의 앞머리. `output/` 안에 만들되 파일만 골라 담는다.
BACKUP_PREFIX = ".backup-"

#: 읽기 전용 배포를 **강제로** 재현하는 환경변수. `1|true|yes` 면 켜진 것이다.
#:
#: 기능 플래그가 아니라 검증용 스위치다. 공개 사이트(Vercel)는 디스크가 읽기
#: 전용이라 저절로 그 모드가 되지만, 개발 PC 는 언제나 쓸 수 있어 e2e 가 그
#: 모드를 만들 방법이 없었다. 켜지면 `/api/preprocess` 가 409, 설정의
#: `canPersist` 가 False, 그리고 **서버 환경변수의 OpenAI 키도 없는 것으로
#: 친다**(`.env` 에 진짜 키가 있는 PC 에서도 브라우저 키 폼이 떠야 한다).
FORCE_READONLY_ENV = "HOSEO_FORCE_READONLY"


#: 쓸 수 없는 서버에서 갱신을 거절할 때의 사유. 화면에 그대로 뜬다.
READONLY_DETAIL = (
    "이 서버는 읽기 전용 배포라 데이터를 갱신할 수 없습니다. "
    "로컬에서 전처리한 결과를 커밋해 다시 배포하세요."
)


def forced_readonly() -> bool:
    """`HOSEO_FORCE_READONLY` 가 켜져 있는가. 매번 환경변수를 읽는다(테스트가 바꾼다)."""
    return os.environ.get(FORCE_READONLY_ENV, "").strip().lower() in {"1", "true", "yes"}


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
        raise HTTPException(status_code=400, detail="파일명이 없습니다.")

    # macOS 는 파일명을 NFD 로 보낸다. 정규화하지 않으면 '년' 이 자모로
    # 분해돼 연도 검사가 실패한다(scan_raw_files 와 같은 이유).
    name = unicodedata.normalize("NFC", filename).strip()

    # 경로 성분을 통째로 버린다. 이름만 쓴다.
    name = Path(name.replace("\\", "/")).name
    if not name or name in {".", ".."}:
        raise HTTPException(status_code=400, detail=f"쓸 수 없는 파일명입니다: {filename}")

    if not name.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=400,
            detail=f"xlsx 파일만 올릴 수 있습니다: {name}",
        )

    # 확장자를 소문자로 못박는다. `scan_raw_files` 가 `glob("*.xlsx")` 로 찾기
    # 때문에, `.XLSX` 로 저장하면 **저장은 되는데 전처리가 건너뛴다** —
    # 사용자에게는 "올렸는데 아무 일도 안 일어났다" 로 보인다.
    name = name[: -len(".xlsx")] + ".xlsx"

    # 연도를 못 읽는 파일은 전처리가 조용히 건너뛴다. 올릴 때 막아야
    # "올렸는데 아무 일도 안 일어났다" 가 되지 않는다.
    if not pp.YEAR_PATTERN.search(name):
        raise HTTPException(
            status_code=400,
            detail=(
                f"파일명에서 연도를 읽을 수 없습니다: {name}. "
                f"'2026년_...' 또는 '2026_...' 형태여야 합니다."
            ),
        )

    return name


def _require_writable(*folders: Path) -> None:
    """쓸 수 없는 서버에서는 시작하지 않는다.

    Vercel 같은 서버리스는 `/tmp` 밖이 읽기 전용이다. 막지 않으면 `OSError` 가
    설명 없는 500 으로 나간다. `/tmp` 로 돌리는 것도 답이 아니다 — 인스턴스마다
    따로이고 곧 사라져, 갱신이 됐다가 안 됐다가 하는 것처럼 보인다.

    `HOSEO_FORCE_READONLY` 가 켜져 있으면 디스크 권한과 무관하게 같은 409 다.
    """
    if forced_readonly():
        raise HTTPException(status_code=409, detail=READONLY_DETAIL)
    for folder in folders:
        probe = folder if folder.exists() else folder.parent
        if not os.access(probe, os.W_OK):
            raise HTTPException(status_code=409, detail=READONLY_DETAIL)


def ingest(uploads: list[tuple[str, bytes]]) -> dict:
    """업로드를 `Raw data/` 에 넣고 전처리를 돌려 `output/` 을 갱신한다.

    Returns:
        처리 요약 + 무엇을 저장하고 무엇을 백업했는지.
    """
    if not uploads:
        raise HTTPException(status_code=400, detail="올린 파일이 없습니다.")
    if len(uploads) > MAX_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"한 번에 {MAX_FILES}개까지 올릴 수 있습니다. 받은 파일: {len(uploads)}개",
        )

    raw = raw_dir()
    out = output_dir()
    _require_writable(raw, out)
    raw.mkdir(parents=True, exist_ok=True)

    # (경로, 원래 내용) — 실패하면 이걸로 되돌린다. None 은 "원래 없던 파일".
    written: list[tuple[Path, bytes | None]] = []

    try:
        for name, data in uploads:
            if len(data) > MAX_FILE_BYTES:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"{name} 이(가) 너무 큽니다"
                        f"({len(data) // (1024 * 1024)}MB, 상한 {MAX_FILE_BYTES // (1024 * 1024)}MB)."
                    ),
                )
            if not data:
                raise HTTPException(status_code=400, detail=f"{name} 이(가) 비어 있습니다.")

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
                raise _preprocess_failed(e) from e

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


def _preprocess_failed(e: Exception) -> HTTPException:
    """코어가 던진 제각각의 예외를 사용자가 읽을 400 으로 바꾼다.

    파일 내용이 기대와 다르면 코어는 `BadZipFile`, `KeyError`, `ValueError`…
    를 던진다. 그대로 새어 나가면 사용자는 아무 설명 없는 500 을 본다.
    **원인이 대개 올린 파일이므로** 400 으로, 무엇을 확인해야 하는지와 함께.
    `/api/preprocess` 와 `/api/dataset/preview` 가 같은 문장을 쓴다.
    """
    return HTTPException(
        status_code=400,
        detail=(
            "전처리가 실패했습니다. 올린 파일이 대학알리미 "
            "「전임교원의 연구 실적」 공시 xlsx 가 맞는지 확인하세요. "
            f"({type(e).__name__}: {e})"
        ),
    )


# ---------------------------------------------------------------------------
# 미리보기 — 디스크에 아무것도 쓰지 않는다
# ---------------------------------------------------------------------------


def preview(name: str, data: bytes) -> dict:
    """공시 xlsx 한 해를 메모리에서 계산해 **영문 키 행**으로 돌려준다.

    읽기 전용 배포를 위한 경로다. `ingest` 와 달리 `Raw data/`·`output/` 을
    건드리지 않고, 캐시도 비우지 않는다 — 결과는 브라우저가 들고 간다.

    한 해 안의 순위는 그 해 파일만으로 완결되므로 파일 하나로 충분하다
    (`process_in_memory` 가 폴더 전체를 요구하지 않는 이유와 같다).
    """
    if len(data) > MAX_PREVIEW_BYTES:
        raise HTTPException(status_code=413, detail=PREVIEW_TOO_LARGE_DETAIL)
    if not data:
        raise HTTPException(status_code=400, detail=f"{name} 이(가) 비어 있습니다.")

    # `safe_name` 이 연도를 보장한다. 결과의 연도가 이것 하나여야 한다.
    match = pp.YEAR_PATTERN.search(name)
    assert match is not None  # noqa: S101 — safe_name 계약
    year = int(match.group(1))

    try:
        national, regional = pp.process_in_memory({name: data})
    except pp.PreprocessError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        raise _preprocess_failed(e) from e

    found_years = sorted(
        {int(y) for y in national["연도"].unique()} | {int(y) for y in regional["연도"].unique()}
    )
    if found_years != [year]:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{name} 의 계산 결과에 파일명의 {year}년이 아닌 연도가 있습니다: "
                f"{found_years}. 파일 하나에는 한 해만 들어 있어야 합니다."
            ),
        )

    return {
        "year": year,
        "universities": int(len(national)),
        "sourceFile": name,
        "national": _records(national, schemas.OVERLAY_NATIONAL_COLUMNS),
        "regional": _records(regional, schemas.OVERLAY_REGIONAL_COLUMNS),
    }


def _records(frame: pd.DataFrame, columns: dict[str, str]) -> list[dict]:
    """코어 프레임 → 영문 키 행. 한글 → 영문은 `schemas` 의 표 하나로만 한다.

    numpy 스칼라를 파이썬 값으로 풀고, 빈 순위(NaN)는 None 으로 보낸다 —
    pydantic 의 `int | None` 은 NaN 을 받지 않아 응답 직렬화에서 500 이 난다.
    """
    inverse = {korean: english for english, korean in columns.items()}
    rank_columns = {"전국순위", "권역순위"}
    float_columns = {"SCI/SCOPUS논문수", "1인당논문수"}

    rows: list[dict] = []
    for record in frame[list(columns.values())].to_dict("records"):
        row: dict = {}
        for korean, value in record.items():
            if korean in rank_columns:
                row[inverse[korean]] = None if pd.isna(value) else int(value)
            elif korean in float_columns:
                row[inverse[korean]] = float(value)
            elif korean in {"연도", "전임교원수"}:
                row[inverse[korean]] = int(value)
            else:
                row[inverse[korean]] = str(value)
        rows.append(row)
    return rows


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

    # 파일을 하나씩 덮어쓰므로 **중간에 실패하면 절반만 새 데이터**가 된다
    # (연도가 섞인 CSV 한 벌). 방금 만든 백업으로 되돌린다 — 되돌릴 것이
    # 없으면(첫 전처리) 반쯤 쓰인 파일을 치운다.
    written: list[Path] = []
    try:
        for src in staging.iterdir():
            if src.is_file():
                shutil.copy2(src, out / src.name)
                written.append(out / src.name)
    except OSError:
        _restore(backup, written, out)
        raise

    _prune_backups(out)
    return backup


def _restore(backup: Path | None, written: list[Path], out: Path) -> None:
    """반쯤 덮어쓴 `output/` 을 되돌린다.

    여기서 손을 놓으면 **CSV 한 벌 안에서 연도가 섞인다.** 그 상태는 오류로
    보이지 않고 그냥 틀린 숫자로 보이므로, 사용자가 알아차릴 방법이 없다.
    """
    if backup is None:
        for path in written:
            path.unlink(missing_ok=True)
        return
    for path in written:
        source = backup / path.name
        try:
            if source.exists():
                shutil.copy2(source, path)
            else:
                path.unlink(missing_ok=True)
        except OSError:
            continue


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


__all__ = [
    "FORCE_READONLY_ENV",
    "MAX_FILES",
    "MAX_FILE_BYTES",
    "MAX_PREVIEW_BYTES",
    "READONLY_DETAIL",
    "forced_readonly",
    "ingest",
    "output_dir",
    "preview",
    "raw_dir",
    "safe_name",
]
