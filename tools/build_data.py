#!/usr/bin/env python3
"""10번 논문의 원자료(savings_per_image.csv)에서 앱이 쓰는 수치(paper-results.js)를 만든다.

  python3 tools/build_data.py

조건(이미지 종류 × 포맷 × 목표 SSIM)마다 이미지 24장의 절감률로
중앙값, 가운데 절반 범위(25~75%), 최솟값·최댓값, JPEG보다 커진 장 수를 계산한다.
화면 캡처 판정 기준은 screen_selection_log.csv에서 선택된 24장의 '가장 많은 한 색 비율' 최솟값을 쓴다.
"""
import csv
import json
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def q(v, p):
    """선형 보간 분위수 (numpy 기본값과 같은 방식)."""
    v = sorted(v)
    k = (len(v) - 1) * p
    f = int(k)
    c = min(f + 1, len(v) - 1)
    return v[f] + (v[c] - v[f]) * (k - f)


rows = list(csv.DictReader(open(ROOT / "data/savings_per_image.csv", encoding="utf-8")))
out = {}
for r in rows:
    key = f'{r["group"]}|{r["format"]}|{float(r["target_ssim"]):.2f}'
    out.setdefault(key, {"s": [], "floor": 0})
    out[key]["s"].append(float(r["saving"]))
    if r["status"] == "floor" or r["jpeg_status"] == "floor":
        out[key]["floor"] += 1
cond = {}
for key, d in sorted(out.items()):
    s = d["s"]
    cond[key] = {
        "n": len(s),
        "mean": round(statistics.mean(s), 4),
        "median": round(statistics.median(s), 4),
        "p25": round(q(s, 0.25), 4),
        "p75": round(q(s, 0.75), 4),
        "min": round(min(s), 4),
        "max": round(max(s), 4),
        "negative": sum(1 for x in s if x < 0),
        "floor": d["floor"],
    }

sel = [r for r in csv.DictReader(open(ROOT / "data/screen_selection_log.csv", encoding="utf-8-sig"))
       if r["status"] == "선택"]
dom = [float(r["dominant_share"]) for r in sel]
edge = [float(r["edge_density"]) for r in sel]
# 화면 캡처 24장: 이미지별 '가장 많은 한 색 비율'과 조건별 절감률 (논문: AVIF 절감률과 상관 r = 0.68 / 0.73 / 0.77)
per = {}
for r in rows:
    if r["group"] != "screen":
        continue
    per.setdefault(r["image"], {})[f'{r["format"]}|{float(r["target_ssim"]):.2f}'] = round(float(r["saving"]), 4)
screen_images = [{"dominant": float(x["dominant_share"]), "edge": float(x["edge_density"]), "saving": per[x["file"]]}
                 for x in sorted(sel, key=lambda x: float(x["dominant_share"])) if x["file"] in per]
assert len(screen_images) == len(sel) == 24
data = {
    "paper": {
        "title": "같은 화질에서 WebP·AVIF는 JPEG보다 얼마나 작은가",
        "author": "임동호",
        "date": "2026-10-14",
        "images": "사진(Kodak) 24장, 보안 실습 화면 캡처 24장, 가운데 640×400",
        "encodings": 432,
        "avifSlower": 120,
    },
    "conditions": cond,
    "screenImages": screen_images,
    "screenRule": {
        "n": len(sel),
        "dominantMin": min(dom), "dominantMax": max(dom),
        "edgeMin": min(edge), "edgeMax": max(edge),
        "blankDominant": 0.95, "blankEdge": 0.01,
    },
}
js = "// tools/build_data.py 가 논문 원자료에서 만든 파일입니다. 직접 고치지 마세요.\n"
js += "window.PAPER = " + json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + ";\n"
(ROOT / "paper-results.js").write_text(js, encoding="utf-8")
print(json.dumps({k: (v["median"], v["p25"], v["p75"], v["negative"], v["floor"]) for k, v in cond.items()}, ensure_ascii=False, indent=1))
print("screenRule", data["screenRule"], "encodings", data["paper"]["encodings"])
