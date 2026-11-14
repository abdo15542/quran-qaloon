#!/usr/bin/env python3
"""Verify ayah-timings JSONs: structure, monotonicity, gaps, fb/ip totals."""
import json, os, sys

BASE = os.path.expanduser("~/workspace/quran-qaloon-android")
QURAN_TEXT = os.path.join(BASE, "artifacts/quran-qaloon/src/data/quran-text.ts")

def load_quran_text():
    src = open(QURAN_TEXT, encoding="utf-8").read()
    start = src.index("export const QURAN_TEXT")
    eq = src.index("=", start)
    surahs, cur_ayahs, cur_str = [], [], None
    depth = 0
    i = eq + 1
    while i < len(src):
        ch = src[i]
        if cur_str is not None:
            if ch == "\\":
                cur_str += src[i:i + 2]; i += 2; continue
            if ch == '"':
                cur_ayahs.append(json.loads('"' + cur_str + '"')); cur_str = None
            else:
                cur_str += ch
            i += 1; continue
        if ch == '"': cur_str = ""
        elif ch == "[": depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 1 and cur_ayahs:
                surahs.append(cur_ayahs); cur_ayahs = []
            elif depth == 0: break
        elif ch == ";": break
        i += 1
    return surahs

def verify(reciter, surahs_text):
    path = os.path.join(BASE, "ayah-timings", f"{reciter}.json")
    if not os.path.exists(path):
        print(f"{reciter}: MISSING {path}")
        return None
    data = json.load(open(path, encoding="utf-8"))
    problems, tot_fb, tot_ip, zero_pause, worst = [], 0, 0, [], []
    for no in range(1, 115):
        e = data.get(str(no))
        if e is None:
            problems.append(f"surah {no}: MISSING"); continue
        n = len(surahs_text[no - 1])
        s, d = e["s"], e["d"]
        tot_fb += e.get("fb", 0); tot_ip += e.get("ip", 0)
        if e.get("pauses", 1) == 0: zero_pause.append(no)
        if len(s) != n: problems.append(f"surah {no}: {len(s)} starts != {n} ayahs")
        if s and s[0] != 0.0: problems.append(f"surah {no}: first start {s[0]} != 0.0")
        if s and s[-1] >= d: problems.append(f"surah {no}: last start {s[-1]} >= dur {d}")
        for i in range(1, len(s)):
            if s[i] <= s[i-1]: problems.append(f"surah {no}: not increasing at ayah {i+1}: {s[i-1]} -> {s[i]}")
            if s[i] - s[i-1] < 0.5: problems.append(f"surah {no}: gap <0.5s at ayah {i+1}: {s[i]-s[i-1]:.2f}s")
        if e.get("fb", 0) > 0: worst.append((no, e["fb"], e.get("ip", 0), e.get("pauses", 0)))
    print(f"== {reciter}: {len(data)}/114 surahs, total fb={tot_fb}, ip={tot_ip}, "
          f"0-pause surahs={zero_pause or 'none'}")
    if worst:
        print(f"   worst fb surahs: {sorted(worst, key=lambda x: -x[1])[:10]}")
    if problems:
        print(f"   PROBLEMS ({len(problems)}):")
        for p in problems[:30]: print(f"     {p}")
    else:
        print("   structural checks: ALL PASS")
    return {"fb": tot_fb, "ip": tot_ip, "problems": problems}

if __name__ == "__main__":
    st = load_quran_text()
    for r in sys.argv[1:]:
        verify(r, st)
