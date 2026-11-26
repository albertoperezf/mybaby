#!/usr/bin/env python3
"""Builds src/lib/who/who-lms.json from the WHO "expanded tables" (z-score) xlsx files.

Usage: python3 scripts/build-who-data.py <dir with wfa_boys.xlsx, wfa_girls.xlsx, lhfa_*.xlsx, hcfa_*.xlsx>
Source: https://www.who.int/tools/child-growth-standards/standards (WHO Child Growth Standards, 0-5 years).
Samples the daily LMS rows every STEP days to keep the bundle small.
"""
import json
import re
import sys
import zipfile
from pathlib import Path

STEP = 7
INDICATORS = ["wfa", "lhfa", "hcfa"]
SEXES = ["boys", "girls"]


def read_rows(path):
    z = zipfile.ZipFile(path)
    sheet = z.read("xl/worksheets/sheet1.xml").decode()
    rows = {}
    for m in re.finditer(r'<c r="([A-D])(\d+)"(?: [^>]*)?><v>([^<]+)</v></c>', sheet):
        col, row, val = m.group(1), int(m.group(2)), m.group(3)
        if row == 1:
            continue
        rows.setdefault(row, {})[col] = float(val)
    out = []
    for r in sorted(rows):
        d = rows[r]
        if all(c in d for c in "ABCD"):
            out.append((int(d["A"]), d["B"], d["C"], d["D"]))
    return out


def main(src_dir):
    result = {}
    for ind in INDICATORS:
        result[ind] = {}
        for sex in SEXES:
            rows = read_rows(Path(src_dir) / f"{ind}_{sex}.xlsx")
            by_day = {r[0]: r for r in rows}
            last = max(by_day)
            days = list(range(0, last + 1, STEP))
            if days[-1] != last:
                days.append(last)
            result[ind][sex] = {
                "days": days,
                "L": [round(by_day[d][1], 4) for d in days],
                "M": [round(by_day[d][2], 4) for d in days],
                "S": [round(by_day[d][3], 5) for d in days],
            }
            print(ind, sex, "days", days[0], "-", days[-1], "points", len(days))
    out = Path(__file__).resolve().parent.parent / "src/lib/who/who-lms.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, separators=(",", ":")))
    print("wrote", out, out.stat().st_size, "bytes")


if __name__ == "__main__":
    main(sys.argv[1])
