# ============================================================================
# Copyright (c) 2026 정화민 (Junghwamin)
# All rights reserved.
#
# This file is part of a personal research analysis portal by 정화민 (Junghwamin).
# Licensed under the PolyForm Noncommercial License 1.0.0.
# See the LICENSE file in the project root, or visit:
#     https://polyformproject.org/licenses/noncommercial/1.0.0
#
# Commercial use is strictly prohibited without prior written consent.
# Repository: https://github.com/Junghwamin/Hoseo-Research
# HOSEO-RESEARCH-FINGERPRINT: do not remove this line (used for provenance tracking)
# ============================================================================

"""
그래프 생성 모듈 (matplotlib)

각 함수는 BytesIO 이미지 객체를 반환한다 (Word 파일 삽입 및 Streamlit 미리보기용).

Note:
    Python 3.13+ 에서 matplotlib 3.8.x의 MarkerStyle deepcopy 재귀 버그가 존재한다.
    이를 우회하기 위해 마커를 fmt 문자열("o-") 대신 keyword(marker="o")로 분리하고,
    set_xticks 호출 전에 마커가 없는 상태로 tick을 설정한다.
"""

from __future__ import annotations

import sys
from io import BytesIO
from pathlib import Path

import matplotlib

# 이 모듈은 BytesIO PNG 만 만들고 창을 띄우지 않는다. GUI 백엔드로 돌면
# 요청 스레드에서 Tk 를 건드려 "main thread is not in main loop" 로 터지고,
# 최악에는 Tcl_AsyncDelete 로 프로세스가 죽는다. pyplot 을 import 하기 **전**에
# 백엔드를 못박아야 한다 — import 후에는 use() 가 늦다.
matplotlib.use("Agg", force=True)

import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import pandas as pd

from core.config import COMPARE_GROUP, UNIVERSITY

# 한글 폰트 설정 (OS별 자동 감지)
import platform as _platform
import matplotlib.font_manager as _fm

# Python 3.13+ 에서 matplotlib deepcopy 재귀 버그 방지를 위한 monkey-patch
_PY_VERSION = sys.version_info[:2]
if _PY_VERSION >= (3, 13):
    import copy as _copy
    _orig_deepcopy = _copy.deepcopy
    def _safe_deepcopy(x, memo=None, _nil=[]):
        """deepcopy 재귀 깊이 제한 (matplotlib path 버그 우회)"""
        try:
            return _orig_deepcopy(x, memo)
        except RecursionError:
            return x
    _copy.deepcopy = _safe_deepcopy

#: 시스템 폰트를 설치할 수 없는 곳(Vercel 같은 서버리스)에서 쓰는 번들 폰트.
#: 차트 제목이 bold 라 두 굵기가 다 있어야 한다.
_BUNDLED_FONTS = tuple(
    str(Path(__file__).resolve().parent / "fonts" / name)
    for name in ("NanumGothic-Regular.ttf", "NanumGothic-Bold.ttf")
)


def _setup_korean_font():
    """OS별 한글 폰트를 자동 감지하여 설정한다."""
    system = _platform.system()
    if system == "Windows":
        font_name = "Malgun Gothic"
    elif system == "Darwin":  # macOS
        available = {f.name for f in _fm.fontManager.ttflist}
        if "Apple SD Gothic Neo" in available:
            font_name = "Apple SD Gothic Neo"
        else:
            font_name = "AppleGothic"
    else:  # Linux (Streamlit Cloud 포함)
        font_name = "NanumGothic"
        # packages.txt로 설치된 NanumGothic 폰트를 matplotlib에 등록
        _nanum_path = "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"
        if Path(_nanum_path).exists():
            _fm.fontManager.addfont(_nanum_path)
        else:
            # 서버리스에는 apt 로 폰트를 깔 수 없다. 여기서 빠지면 예외 없이
            # 모든 한글이 두부(□)로 그려져, 오류로 보이지도 않는다.
            for _bundled in _BUNDLED_FONTS:
                if Path(_bundled).exists():
                    _fm.fontManager.addfont(_bundled)
    matplotlib.rcParams["font.family"] = font_name
    matplotlib.rcParams["axes.unicode_minus"] = False

_setup_korean_font()

# 색상 팔레트 — DESIGN.md §7 「문서 차트」. 주홍은 대상 대학 하나에만, 나머지는 회색 단계.
# 화면(web)과 Word 에 같은 PNG 가 들어가므로 여기 값이 곧 보고서의 색이다.
COLOR_HOSEO = "#EE5400"      # 대상 대학 (주홍)
COLOR_OTHERS = "#D4D4D8"     # 기타 대학 막대
COLOR_NATIONAL = "#52525B"   # 전국 평균
COLOR_REGIONAL = "#71717A"   # 권역 평균
COLOR_COMPARE = "#A1A1AA"    # 비교군 평균
COLOR_INK = "#27272A"        # 제목·축 라벨·값 라벨·대상 막대 외곽선
COLOR_GRID = "#E4E4E7"       # 격자 실선
COLOR_SPINE = "#A1A1AA"      # 축선(왼쪽·아래)
COLOR_TICK = "#52525B"       # 눈금 글자

#: 대상 막대의 외곽선 굵기(pt). 해치 대신 색 아닌 신호를 맡는다.
TARGET_EDGE_WIDTH = 1.5


def _save_fig(fig: plt.Figure) -> BytesIO:
    """Figure를 PNG BytesIO로 저장하고 반환한다."""
    buf = BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    buf.seek(0)
    plt.close(fig)
    return buf


def _style_axes(ax: plt.Axes, grid_axis: str = "y") -> None:
    """축 한 벌의 공통 마감 — 격자 실선 0.6, 위·오른쪽 축선 제거, 잉크 글자.

    제목·축 라벨은 set_title/set_xlabel 로 먼저 정한 뒤 호출한다(여기서는 색만 입힌다).
    격자는 막대 뒤로 보낸다 — 기본값(line)은 막대 위로 선이 지나간다.
    """
    ax.set_facecolor("white")
    ax.grid(axis=grid_axis, linestyle="-", color=COLOR_GRID, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_color(COLOR_SPINE)
    ax.tick_params(colors=COLOR_TICK)
    for text in (ax.title, ax.xaxis.label, ax.yaxis.label):
        text.set_color(COLOR_INK)


def _bar_edges(names: list[str], univ: str) -> tuple[list[str], list[float]]:
    """막대별 외곽선 — 대상 대학만 잉크 1.5pt, 나머지는 선 없음."""
    edges = [COLOR_INK if n == univ else "none" for n in names]
    widths = [TARGET_EDGE_WIDTH if n == univ else 0.0 for n in names]
    return edges, widths


def _bold_target_tick(ax: plt.Axes, univ: str, axis: str = "x") -> None:
    """대상 대학의 눈금 라벨을 굵은 잉크로 — 해치를 대신하는 색 아닌 신호."""
    labels = ax.get_xticklabels() if axis == "x" else ax.get_yticklabels()
    for label in labels:
        if label.get_text() == univ:
            label.set_fontweight("bold")
            label.set_color(COLOR_INK)


# ---------------------------------------------------------------------------
# 1. 연도별 1인당논문수 추이 라인차트
# ---------------------------------------------------------------------------

def create_trend_chart(
    hoseo_trend: dict[int, dict],
    averages: dict[int, dict],
    university: str | None = None,
    region_name: str = "충청권",
) -> BytesIO:
    """
    호서대 vs 전국·충청권·비교군 평균의 연도별 1인당논문수 추이 라인차트.

    Args:
        hoseo_trend: get_hoseo_trend() 반환값
        averages: get_averages() 반환값
        university: 강조 표시할 대학명. None이면 config.UNIVERSITY 사용
    """
    univ = university or UNIVERSITY
    years = sorted(hoseo_trend.keys())
    hoseo_vals = [hoseo_trend[y]["1인당논문수"] for y in years]
    nat_avg = [averages[y]["전국평균"] for y in years]
    reg_avg = [averages[y]["권역평균"] for y in years]
    cmp_avg = [averages[y]["비교군평균"] for y in years]

    fig, ax = plt.subplots(figsize=(9, 5))

    # 대상만 주홍 실선. 평균 셋은 회색 단계 + 서로 다른 선 모양·마커(색 아닌 신호).
    ax.plot(years, hoseo_vals, linestyle="-", marker="o", color=COLOR_HOSEO,
            linewidth=2.5, markersize=7, markerfacecolor="white", markeredgewidth=2,
            label=univ, zorder=5)
    ax.plot(years, nat_avg, linestyle="--", marker="s", color=COLOR_NATIONAL,
            linewidth=1.8, markersize=5, markerfacecolor="white", markeredgewidth=1.5,
            label="전국 평균")
    ax.plot(years, reg_avg, linestyle=":", marker="^", color=COLOR_REGIONAL,
            linewidth=1.8, markersize=5, markerfacecolor="white", markeredgewidth=1.5,
            label=f"{region_name} 평균")
    ax.plot(years, cmp_avg, linestyle="-.", marker="D", color=COLOR_COMPARE,
            linewidth=1.5, markersize=5, markerfacecolor="white", markeredgewidth=1.5,
            label=f"{univ[:-2]}비교군 평균")

    # 데이터 레이블 (호서대만) — 글자는 잉크. 주홍 9pt 는 흰 바탕에서 읽기 어렵다.
    for x, y in zip(years, hoseo_vals):
        ax.annotate(f"{y:.4f}", (x, y), textcoords="offset points", xytext=(0, 10),
                    ha="center", fontsize=9, color=COLOR_INK, fontweight="bold")

    ax.set_title("전임교원 1인당 SCI/SCOPUS 논문수 연도별 추이", fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("연도", fontsize=11)
    ax.set_ylabel("1인당 논문수 (편)", fontsize=11)
    ax.set_xticks(years)
    ax.yaxis.set_major_formatter(ticker.FormatStrFormatter("%.4f"))
    # 범례는 축 아래 가로 한 줄 — 안쪽에 두면 연도에 따라 데이터 점을 덮는다.
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.14), ncol=4,
              fontsize=9, frameon=False, labelcolor=COLOR_INK, columnspacing=1.8)
    _style_axes(ax)
    fig.patch.set_facecolor("white")
    fig.tight_layout()

    return _save_fig(fig)


# ---------------------------------------------------------------------------
# 2. 충청권 최신연도 막대차트
# ---------------------------------------------------------------------------

def create_comparison_bar(
    regional_df: pd.DataFrame,
    year: int,
    university: str | None = None,
    region_name: str = "충청권",
) -> BytesIO:
    """
    충청권 대학의 1인당논문수 막대차트 (호서대 강조).

    Args:
        regional_df: 충청권_순위.csv 전체 DataFrame
        year: 기준 연도
        university: 강조 표시할 대학명. None이면 config.UNIVERSITY 사용
    """
    univ = university or UNIVERSITY
    df_year = regional_df[regional_df["연도"] == year]
    # 권역명 컬럼이 있는 신규 포맷이면 해당 권역으로도 걸러낸다
    # (권역명이 없는 레거시 프레임은 이미 단일 권역이므로 그대로 둔다)
    if region_name and "권역명" in df_year.columns:
        df_year = df_year[df_year["권역명"] == region_name]
    df_year = df_year.sort_values("1인당논문수", ascending=False)

    names = df_year["학교명"].tolist()
    values = df_year["1인당논문수"].tolist()
    colors = [COLOR_HOSEO if n == univ else COLOR_OTHERS for n in names]
    edges, widths = _bar_edges(names, univ)

    fig, ax = plt.subplots(figsize=(12, 6))
    bars = ax.bar(names, values, color=colors, edgecolor=edges, linewidth=widths)

    for bar, val in zip(bars, values):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 0.002,
            f"{val:.4f}",
            ha="center", va="bottom", fontsize=8, color=COLOR_INK,
        )

    ax.set_title(f"{year}년 {region_name} 대학 전임교원 1인당 SCI/SCOPUS 논문수", fontsize=13, fontweight="bold", pad=12)
    ax.set_ylabel("1인당 논문수 (편)", fontsize=11)
    ax.tick_params(axis="x", rotation=45)
    # 45° 라벨은 오른쪽 끝을 눈금에 걸어야(anchor) 긴 대학명이 이웃과 겹치지 않는다.
    for label in ax.get_xticklabels():
        label.set_horizontalalignment("right")
        label.set_rotation_mode("anchor")
    _style_axes(ax)
    _bold_target_tick(ax, univ)
    fig.patch.set_facecolor("white")
    fig.tight_layout()

    return _save_fig(fig)


# ---------------------------------------------------------------------------
# 3. 호서대 vs 전국/충청권/비교군 평균 비교 바차트
# ---------------------------------------------------------------------------

def create_avg_comparison(
    hoseo_trend: dict[int, dict],
    averages: dict[int, dict],
    year: int,
    university: str | None = None,
    region_name: str = "충청권",
) -> BytesIO:
    """
    특정 연도에서 대학 vs 전국/충청권/비교군 평균 수평 바차트.

    Args:
        hoseo_trend: get_hoseo_trend() 반환값
        averages: get_averages() 반환값
        year: 기준 연도
        university: 강조 표시할 대학명. None이면 config.UNIVERSITY 사용
    """
    univ = university or UNIVERSITY
    hoseo_val = hoseo_trend[year]["1인당논문수"]
    nat_val = averages[year]["전국평균"]
    reg_val = averages[year]["권역평균"]
    cmp_val = averages[year]["비교군평균"]

    labels = [univ, "전국 평균", f"{region_name} 평균", "비교군 평균"]
    values = [hoseo_val, nat_val, reg_val, cmp_val]
    colors = [COLOR_HOSEO, COLOR_NATIONAL, COLOR_REGIONAL, COLOR_COMPARE]
    edges, widths = _bar_edges(labels, univ)

    fig, ax = plt.subplots(figsize=(8, 4))
    bars = ax.barh(labels, values, color=colors, height=0.5, edgecolor=edges, linewidth=widths)

    for bar, val in zip(bars, values):
        ax.text(
            bar.get_width() + 0.001,
            bar.get_y() + bar.get_height() / 2,
            f"{val:.4f}",
            va="center", ha="left", fontsize=10, color=COLOR_INK,
        )

    ax.set_title(f"{year}년 1인당 논문수 평균 비교", fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("1인당 논문수 (편)", fontsize=11)
    ax.set_xlim(0, max(values) * 1.3)
    _style_axes(ax, grid_axis="x")
    _bold_target_tick(ax, univ, axis="y")
    fig.patch.set_facecolor("white")
    fig.tight_layout()

    return _save_fig(fig)


# ---------------------------------------------------------------------------
# 4. 충청권·전국 순위 변화 라인차트
# ---------------------------------------------------------------------------

def create_rank_trend_chart(
    rank_changes: dict[int, dict],
    university: str | None = None,
    region_name: str = "충청권",
) -> BytesIO:
    """
    대학의 충청권·전국 순위 연도별 변화 라인차트.
    순위는 낮을수록 좋으므로 Y축을 역전시킨다.

    두 선 모두 대상 대학 자신의 순위라 견줄 상대가 없다 — 주홍을 쓰지 않고
    잉크(권역)와 전국 회색으로 구분한다. 주홍은 "남들 사이의 우리" 에만 쓴다.

    Args:
        rank_changes: get_rank_changes() 반환값
        university: 표시할 대학명. None이면 config.UNIVERSITY 사용
    """
    univ = university or UNIVERSITY
    years = sorted(rank_changes.keys())
    reg_ranks = [rank_changes[y]["권역순위"] for y in years]
    nat_ranks = [rank_changes[y]["전국순위"] for y in years]

    # 충청권 순위 데이터 존재 여부 확인 (비충청권 대학은 None)
    has_regional = any(r is not None for r in reg_ranks)

    if has_regional:
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
    else:
        fig, ax2 = plt.subplots(figsize=(7, 5))

    if has_regional:
        # 충청권 순위
        ax1.plot(years, reg_ranks, linestyle="-", marker="o", color=COLOR_INK,
                 linewidth=2.5, markersize=8, markerfacecolor="white", markeredgewidth=2)
        for x, y in zip(years, reg_ranks):
            ax1.annotate(f"{y}위", (x, y), textcoords="offset points", xytext=(0, 10),
                         ha="center", fontsize=10, color=COLOR_INK, fontweight="bold")
        ax1.set_title(f"{univ} {region_name} 순위 변화", fontsize=12, fontweight="bold")
        ax1.set_xlabel("연도")
        ax1.set_ylabel(f"{region_name} 순위")
        ax1.invert_yaxis()
        ax1.set_xticks(years)
        ax1.yaxis.set_major_locator(ticker.MaxNLocator(integer=True))
        _style_axes(ax1, grid_axis="both")

    # 전국 순위
    ax2.plot(years, nat_ranks, linestyle="--", marker="s", color=COLOR_NATIONAL,
             linewidth=2.5, markersize=8, markerfacecolor="white", markeredgewidth=1.5)
    for x, y in zip(years, nat_ranks):
        ax2.annotate(f"{y}위", (x, y), textcoords="offset points", xytext=(0, 10),
                     ha="center", fontsize=10, color=COLOR_INK, fontweight="bold")
    ax2.set_title(f"{univ} 전국 순위 변화", fontsize=12, fontweight="bold")
    ax2.set_xlabel("연도")
    ax2.set_ylabel("전국 순위")
    ax2.invert_yaxis()
    ax2.set_xticks(years)
    ax2.yaxis.set_major_locator(ticker.MaxNLocator(integer=True))
    _style_axes(ax2, grid_axis="both")

    fig.suptitle(f"{univ} 순위 추이", fontsize=13, fontweight="bold", color=COLOR_INK)
    fig.patch.set_facecolor("white")
    fig.tight_layout()

    return _save_fig(fig)


# ---------------------------------------------------------------------------
# 5. 비교군 막대차트 (비교 5개교)
# ---------------------------------------------------------------------------

def create_compare_group_bar(
    compare_data: list[dict],
    year: int,
    university: str | None = None,
) -> BytesIO:
    """
    비교 5개 대학의 1인당논문수 비교 막대차트.

    Args:
        compare_data: get_compare_group_data() 반환값
        year: 기준 연도
        university: 강조 표시할 대학명. None이면 config.UNIVERSITY 사용
    """
    univ = university or UNIVERSITY
    names = [d["학교명"] for d in compare_data]
    values = [d["1인당논문수"] for d in compare_data]
    colors = [COLOR_HOSEO if n == univ else COLOR_OTHERS for n in names]
    edges, widths = _bar_edges(names, univ)

    fig, ax = plt.subplots(figsize=(8, 5))
    bars = ax.bar(names, values, color=colors, edgecolor=edges, linewidth=widths, width=0.5)

    for bar, val in zip(bars, values):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 0.002,
            f"{val:.4f}",
            ha="center", va="bottom", fontsize=10, color=COLOR_INK,
        )

    ax.set_title(f"{year}년 {univ[:-2]}비교군 1인당 SCI/SCOPUS 논문수", fontsize=13, fontweight="bold", pad=12)
    ax.set_ylabel("1인당 논문수 (편)", fontsize=11)
    ax.tick_params(axis="x", rotation=20)
    _style_axes(ax)
    _bold_target_tick(ax, univ)
    fig.patch.set_facecolor("white")
    fig.tight_layout()

    return _save_fig(fig)
