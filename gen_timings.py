#!/usr/bin/env python3
"""Generate exact ayah timing tables for Quran reciters whose surah audio
has clear breath pauses (Qaloon reciters), by fusing:
  - ffmpeg silencedetect pauses (exact pause positions), and
  - char-proportion ayah-start predictions (from the bundled Uthmani text).
Assignment is a DP: each ayah start (2..N) gets the nearest unused
pause-END, or falls back to the prediction (fixed penalty 2.0s).
Validated on Al-Fatiha / Huthayfi Qaloon: the DP recovered the true
boundaries exactly (verified against silencedetect by hand).

Usage:
  python3 gen_timings.py --reciter qaloon-nafi --surahs 1,2,112,113,114
  python3 gen_timings.py --reciter qaloon-nafi            (all 114)
Output: ~/workspace/quran-qaloon-android/ayah-timings/<reciter>.json
  { "1": {"d": 58.73, "s": [0, 6.5, 12.7, ...], "fb": 0}, ... }
  d = file duration (s), s = ayah START times (pause-end - 0.2, ayah 1 = 0),
  fb = number of ayah starts that fell back to the char estimate.
"""
import argparse, json, math, os, re, subprocess, sys

BASE = os.path.expanduser("~/workspace/quran-qaloon-android")
QURAN_TEXT = os.path.join(BASE, "artifacts/quran-qaloon/src/data/quran-text.ts")
OUT_DIR = os.path.join(BASE, "ayah-timings")
WORK_DIR = os.path.join(BASE, "ayah-timings", "audio")

RECITERS = {
    "qaloon-nafi":     "https://download.quranicaudio.com/quran/huthayfi_qaloon//",
    "qaloon-doukkali": "https://cdn.mp3quran.net/audio/dokali-alim/r1/",
    "qaloon-husary":   "https://cdn.mp3quran.net/audio/mahmoud-husary/r5/",
    "qaloon-trablsi":  "https://cdn.mp3quran.net/audio/ahmad-tarabulsi/r1/",
    # --- batch 4: remaining 9 reciters (full Mushaf) ---
    # yasser/ghamdi: mp3quran moved to cdn.mp3quran.net — the old
    # server11/server7 URLs 301-redirect to these final bases (verified 200).
    "yasser":           "https://cdn.mp3quran.net/audio/yasser-dosari/r1/",
    "sudais":           "https://download.quranicaudio.com/qdc/abdurrahmaan_as_sudais/murattal/",
    "ghamdi":           "https://cdn.mp3quran.net/audio/saad-ghamdi/r1/",
    "warsh-nafi":       "https://download.quranicaudio.com/quran/abdulbaset_warsh//",
    "ibn-kathir-reader":"https://download.quranicaudio.com/quran/abdurrashid_sufi//",
    "doori-abu-amr":    "https://download.quranicaudio.com/quran/abdurrashid_sufi_soosi_rec//",
    "hisham-ibn-amir":  "https://download.quranicaudio.com/quran/abdurrashid_sufi_shu3ba//",
    "khalaf-hamza":     "https://download.quranicaudio.com/quran/abdurrashid_sufi_-_khalaf_3an_7amza_recitation//",
    "doori-kisai":      "https://download.quranicaudio.com/quran/abdurrashid_sufi_doori//",
}
# File-name padding per reciter (matches surahs.ts `padded`): sudais uses
# bare numbers (1.mp3, 2.mp3); everyone else uses 3-digit (001.mp3).
PADDED = {r: True for r in RECITERS}
PADDED["sudais"] = False
FALLBACK_PENALTY = 4.0   # seconds; a real pause must beat this to be chosen.
# The char predictions err by up to ~3s, so the penalty must exceed that;
# a pause farther than ~4s from the prediction is likely the wrong ayah's.
MIN_PAUSE = 0.35         # seconds; ignore shorter gaps
NOISE = {
    # Per-reciter silencedetect threshold: husary/trablsi recordings have a
    # higher noise floor (loud master / reverb tail), so -40dB finds almost
    # no pauses for them. Measured pause counts on real files: husary surah 4
    # has 14 pauses at -30dB but 673 at -20dB (175 ayahs); surah 9: 2 vs 514;
    # surah 11: 1 vs 382 — so husary needs -20dB too. -40dB is unchanged for
    # nafi/doukkali.
    "qaloon-nafi": "-40dB",
    "qaloon-doukkali": "-40dB",
    "qaloon-husary": "-20dB",
    "qaloon-trablsi": "-20dB",
    # batch 4: start at -40dB; calibrate per reciter if fb is high
    # (see husary: re-measure silence_end counts at -30/-20dB on surah 4).
    # Calibrated defaults (2026-11-14, surah-4 pause counts): yasser
    # -12dB (fb 3004@-20 -> 81); sudais -15dB (fb 82); ghamdi -20dB
    # (fb 62); warsh -40dB (fb 586 -> 43 after fixes); ibn-kathir -20dB
    # (fb 36); doori-abu-amr -20dB (fb 24); hisham -20dB (fb 22);
    # khalaf -20dB (fb 313@-30 -> 33); doori-kisai -20dB (fb 10).
    # PER-SURAH EXCEPTIONS (baked into the JSONs via temp NOISE edits;
    # re-apply if a full re-run is ever needed): warsh 3,7 @-30dB
    # (fb 30+59 -> 0); sudais 27,29 @-10dB (fb 31+27 -> 9+6);
    # ibn-kathir 91,92 @-15dB (fb 6+9 -> 0); hisham 91 @-15dB (fb 6 -> 0);
    # ghamdi 75,76 @-15dB (fb 6+6 -> 0). Warsh 10 zero-pause surahs
    # (1,8,11,45,46,47,48,49,50,51) re-run @-30dB. Gap post-pass
    # (added 2026-11-14) fixes <0.5s false snaps on re-run.
    "yasser": "-12dB",
    "sudais": "-15dB",
    "ghamdi": "-20dB",
    "warsh-nafi": "-40dB",
    "ibn-kathir-reader": "-20dB",
    "doori-abu-amr": "-20dB",
    "hisham-ibn-amir": "-20dB",
    "khalaf-hamza": "-20dB",  # was -30dB: fb=313, 67/114 surahs fb>0, ip=3193;
    # probed bad surahs at -20dB: s52 2->67 pauses, s37 48->226, s99/107/112 0->12/8/7
    "doori-kisai": "-20dB",
}
MIN_SILENCE = 0.25

def load_quran_text():
    """Parse QURAN_TEXT (string[][]) from quran-text.ts with a small
    tokenizer: track string literals and bracket depth; each time depth
    drops 2 -> 1 a surah array is complete."""
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
                cur_str += src[i:i + 2]
                i += 2
                continue
            if ch == '"':
                cur_ayahs.append(json.loads('"' + cur_str + '"'))
                cur_str = None
            else:
                cur_str += ch
            i += 1
            continue
        if ch == '"':
            cur_str = ""
        elif ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 1 and cur_ayahs:
                surahs.append(cur_ayahs)
                cur_ayahs = []
            elif depth == 0:
                break
        elif ch == ";":
            break
        i += 1
    return surahs

def run(cmd):
    # errors="replace": ffmpeg stderr can contain non-UTF-8 bytes from MP3
    # ID3 tags (ghamdi surah 20 crashed the whole run with UnicodeDecodeError).
    return subprocess.run(cmd, capture_output=True, text=True, errors="replace", timeout=300)

def download(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 10000:
        return True
    for attempt in range(3):
        r = run(["curl", "-sS", "-L", "-o", path, "-m", "120", url])
        if r.returncode == 0 and os.path.exists(path) and os.path.getsize(path) > 10000:
            return True
    return False

def ffprobe_duration(path):
    r = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", path])
    try:
        return float(r.stdout.strip())
    except ValueError:
        return None

def detect_pauses(path, reciter):
    r = run(["ffmpeg", "-v", "info", "-i", path,
             "-af", f"silencedetect=noise={NOISE[reciter]}:d={MIN_SILENCE}",
             "-f", "null", "-"])
    pauses = []
    cur_start = None
    for line in (r.stderr + r.stdout).splitlines():
        m = re.search(r"silence_start: ([\d.]+)", line)
        if m:
            cur_start = float(m.group(1))
        m = re.search(r"silence_end: ([\d.]+) \| silence_duration: ([\d.]+)", line)
        if m and cur_start is not None:
            end, dur = float(m.group(1)), float(m.group(2))
            if dur >= MIN_PAUSE:
                pauses.append((cur_start, end, dur))
            cur_start = None
    return pauses

def snap_dp(pred_starts, pause_ends):
    """Assign each pred start to a distinct pause-end (increasing order),
    or fall back (penalty). Returns (chosen list, fallback flags)."""
    n, m = len(pred_starts), len(pause_ends)
    INF = float("inf")
    dp = [[INF] * (m + 1) for _ in range(n + 1)]
    par = [[None] * (m + 1) for _ in range(n + 1)]
    for j in range(m + 1):
        dp[0][j] = 0.0
    for i in range(1, n + 1):
        for j in range(m + 1):
            # skip pause j-1 (do not use it for any boundary)
            if j >= 1 and dp[i][j - 1] < dp[i][j]:
                dp[i][j] = dp[i][j - 1]
                par[i][j] = ("skip", j - 1)
            # fallback for ayah i+1
            if dp[i - 1][j] + FALLBACK_PENALTY < dp[i][j]:
                dp[i][j] = dp[i - 1][j] + FALLBACK_PENALTY
                par[i][j] = ("fb", j)
            # use pause j-1
            if j >= 1 and dp[i - 1][j - 1] != INF:
                c = dp[i - 1][j - 1] + abs(pred_starts[i - 1] - pause_ends[j - 1])
                if c < dp[i][j]:
                    dp[i][j] = c
                    par[i][j] = ("use", j - 1)
    chosen, flags = [], []
    i, j = n, m
    while i > 0:
        kind, pj = par[i][j]
        if kind == "use":
            chosen.append(pause_ends[pj])
            flags.append(False)
            i -= 1
            j = pj
        elif kind == "skip":
            j = pj
        else:
            chosen.append(pred_starts[i - 1])
            flags.append(True)
            i -= 1
    chosen.reverse()
    flags.reverse()
    return chosen, flags

def process_surahm(reciter, surah_no, ayah_texts):
    fname = f"{surah_no:03d}.mp3" if PADDED[reciter] else f"{surah_no}.mp3"
    url = f"{RECITERS[reciter]}{fname}"
    path = os.path.join(WORK_DIR, reciter, f"{surah_no:03d}.mp3")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not download(url, path):
        return None, f"download failed: {url}"
    dur = ffprobe_duration(path)
    if not dur:
        return None, "ffprobe failed"
    pauses = detect_pauses(path, reciter)
    # drop the trailing pause (file end) from candidates
    cand = [(s, e) for (s, e, d) in pauses if e < dur - 0.5]
    pause_ends = [e for (_, e) in cand]
    total_chars = sum(len(t) for t in ayah_texts)
    n = len(ayah_texts)
    pred, before = [], 0
    for i in range(1, n):
        before += len(ayah_texts[i - 1])
        pred.append(before / total_chars * dur - 1.0)
    chosen, flags = snap_dp(pred, pause_ends)
    # Pass 2 — drift correction (long surahs): the reciter's pace drifts,
    # so prediction errors grow with ayah index. Fit a line to the confident
    # assignments (real pause used, error < 3s), shift the predictions by it,
    # and re-run; keep whichever pass has fewer fallbacks.
    if sum(1 for f in flags if not f) >= 10:
        pts = [(i, chosen[i] - pred[i]) for i, f in enumerate(flags)
               if not f and abs(chosen[i] - pred[i]) < 3.0]
        if len(pts) >= 10:
            n_pts = len(pts)
            sx = sum(p[0] for p in pts)
            sy = sum(p[1] for p in pts)
            sxx = sum(p[0] * p[0] for p in pts)
            sxy = sum(p[0] * p[1] for p in pts)
            denom = n_pts * sxx - sx * sx
            if denom:
                b = (n_pts * sxy - sx * sy) / denom
                a = (sy - b * sx) / n_pts
                pred2 = [p + (a + b * i) for i, p in enumerate(pred)]
                chosen2, flags2 = snap_dp(pred2, pause_ends)
                if sum(1 for f in flags2 if f) < sum(1 for f in flags if f):
                    chosen, flags = chosen2, flags2
    starts = [0.0]
    for c, fb in zip(chosen, flags):
        starts.append(max(0.0, round(c - 0.2, 2)) if not fb else round(max(0.0, c), 2))
    # Post-pass — local interpolation for fallback boundaries: if a fallback
    # ayah start has snapped neighbours on both sides, re-estimate it by
    # char proportion between those two true positions (local pace, far more
    # accurate than the global char proportion over the whole surah).
    char_lens = [len(t) for t in ayah_texts]
    snapped = [True] + [not f for f in flags]  # starts[0]=0 is always exact
    interp = 0
    for i in range(1, n):
        if snapped[i]:
            continue
        j = i - 1
        while j >= 0 and not snapped[j]:
            j -= 1
        k = i + 1
        while k < n and not snapped[k]:
            k += 1
        if j >= 0 and k < n:
            chars_jk = sum(char_lens[j:k])
            chars_ji = sum(char_lens[j:i])
            if chars_jk > 0:
                starts_interp = starts[j] + chars_ji / chars_jk * (starts[k] - starts[j])
                starts[i] = round(max(0.0, starts_interp), 2)
                flags[i - 1] = False
                interp += 1
    # Post-pass 2 — impossible gaps: no ayah is shorter than 0.5s, so a
    # gap < 0.5s means a false snap (usually a too-loud threshold catching
    # a quiet consonant inside the previous ayah, e.g. sudais surah 20
    # ayah 1 = 0.2s). Replace the boundary with the local char-proportion
    # interpolation between the nearest properly-spaced neighbours
    # (or the global estimate at the tail); iterate to fixpoint.
    for _ in range(n + 2):
        bad = next((i for i in range(1, n) if starts[i] - starts[i - 1] < 0.5), None)
        if bad is None:
            break
        i = bad
        j = i - 1
        while j > 0 and starts[j] - starts[j - 1] < 0.5:
            j -= 1
        k = i + 1
        while k < n and starts[k] - starts[k - 1] < 0.5:
            k += 1
        if k < n and sum(char_lens[j:k]) > 0:
            val = starts[j] + sum(char_lens[j:i]) / sum(char_lens[j:k]) * (starts[k] - starts[j])
            flags[i - 1] = False
            interp += 1
        else:
            val = sum(char_lens[:i]) / total_chars * dur
            flags[i - 1] = True
        lo = starts[i - 1] + 0.5
        hi = starts[i + 1] - 0.5 if i + 1 < n else dur - 0.5
        starts[i] = round(min(max(val, lo), hi) if hi > lo else lo, 2)
    return {
        "d": round(dur, 2),
        "s": starts,
        "fb": sum(1 for f in flags if f),
        "ip": interp,
        "pauses": len(pause_ends),
    }, None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reciter", required=True, choices=list(RECITERS))
    ap.add_argument("--surahs", default="all", help="e.g. 1,2,112,113,114 or all")
    args = ap.parse_args()
    surahs_text = load_quran_text()
    print(f"loaded {len(surahs_text)} surahs from quran-text.ts", flush=True)
    if args.surahs == "all":
        wanted = list(range(1, 115))
    else:
        wanted = [int(x) for x in args.surahs.split(",")]
    out_path = os.path.join(OUT_DIR, f"{args.reciter}.json")
    existing = {}
    if os.path.exists(out_path):
        existing = json.load(open(out_path, encoding="utf-8"))
    for no in wanted:
        ayahs = surahs_text[no - 1]
        try:
            res, err = process_surahm(args.reciter, no, ayahs)
        except Exception as e:
            print(f"  surah {no}: ERROR exception {type(e).__name__}: {e}", flush=True)
            continue
        if err:
            print(f"  surah {no}: ERROR {err}", flush=True)
            continue
        existing[str(no)] = res
        print(f"  surah {no}: {len(ayahs)} ayahs, dur {res['d']}s, "
              f"pauses {res['pauses']}, fallbacks {res['fb']}", flush=True)
        json.dump(existing, open(out_path, "w", encoding="utf-8"), ensure_ascii=False)
    total_fb = sum(v["fb"] for v in existing.values())
    print(f"done: {len(existing)} surahs, total fallbacks {total_fb} -> {out_path}")

if __name__ == "__main__":
    main()
