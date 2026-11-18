// Reading analytics (تحليلات القراءة) — 1.0.74 feature 4.
//
// Every number here traces to real data already persisted on-device.
// Pure functions take plain inputs (no DOM, no localStorage inside them)
// so they are unit-testable in node; the thin localStorage readers at
// the bottom are the only impure part and are used by AnalyticsPage.
//
// ── What the app actually persists (verified in code, not assumed) ──
//  • quran_hifz_ratings — "s:a" → {q: 1|2|3, d: "YYYY-MM-DD", e, i, r, due}
//    (schema defined by the 1.0.74 hifz feature; HifzPage still a stub at
//    the time this was written, so readers here are defensive). Each
//    rating is ONE ayah reviewed on date `d` — the ONLY per-day dated
//    ayah activity the app stores. Pace (7/30 days) and the weekly
//    chart are counts of these ratings.
//  • quran_hifz_review_days — ["YYYY-MM-DD", ...] days a review happened.
//  • quran_khatma — {completedSurahs: number[], startedAt: ms,
//    lastUpdatedAt: ms} (src/hooks/useKhatma.ts). Read ayahs = sum of the
//    ayah counts of the completed surahs; average khatma pace = read
//    ayahs ÷ days since startedAt. There is NO per-day khatma history.
//  • quran_listening_progress — "<surah>-<reciter>" → {surahNumber,
//    currentTime, duration, updatedAt} (src/hooks/useListeningProgress.ts).
//    Finished surahs are DELETED (≥98% listened), so this gives only
//    in-progress fractions + a last-listened date per surah — it can
//    NEVER yield ayahs/day, and is used here only for listening gaps
//    (weakest-surah ranking) and as extra activity days.
//  • quran_wird_last_done / quran_wird_streak / quran_wird_pages_per_day
//    (src/hooks/useWird.ts). lastDone is a single date, the streak a
//    stored count — there is NO history of wird days, so no longest
//    wird streak can be derived; wird contributes only its lastDone
//    date to the activity-day set. pages_per_day is a TARGET setting,
//    never a measured pace, and is never presented as one.
//
// ── Honest limits (shown in the UI, not hidden) ──
//  • No 7/30-day listening pace exists: the app never stored per-day
//    listening counts, so pace is the hifz-review pace; the khatma
//    forecast prefers the khatma average pace and falls back to the
//    review pace, and says plainly when neither exists.
//  • Streaks are computed from the recorded activity-day set below, so
//    the longest streak is a lower bound of the true one (listening and
//    wird keep only their latest date).

export interface HifzRating {
  /** 1 = سهل، 2 = متوسط، 3 = صعب */
  q: 1 | 2 | 3;
  /** Rating date, local "YYYY-MM-DD" */
  d: string;
  e?: number;
  i?: number;
  r?: number;
  due?: string;
}

export type HifzRatings = Record<string, HifzRating>;

export interface ListeningEntry {
  surahNumber: number;
  reciterId?: string;
  currentTime: number;
  duration: number;
  /** ms epoch of the last saved position */
  updatedAt: number;
}

export interface KhatmaStored {
  completedSurahs: number[];
  startedAt: number;
  lastUpdatedAt: number;
}

export const TOTAL_AYAH_COUNT = 6236;

export const NO_PACE_MESSAGE =
  "لا توجد بيانات كافية لتوقع تاريخ الإتمام";

// ── Date helpers (local dates, matching useWird's todayStr) ──────────

export function toDayStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDay(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (
    d.getFullYear() !== Number(m[1]) ||
    d.getMonth() !== Number(m[2]) - 1 ||
    d.getDate() !== Number(m[3])
  ) {
    return null;
  }
  return d;
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  c.setDate(c.getDate() + n);
  return c;
}

/** Whole days from `from` (inclusive) to `to`, date-part only. */
export function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

function isValidDayStr(s: unknown): s is string {
  return typeof s === "string" && parseDay(s) !== null;
}

// ── Pace ─────────────────────────────────────────────────────────────

export interface PaceResult {
  /** ayahs/day over the last 7 days (incl. today), null when no hifz data at all */
  pace7: number | null;
  /** ayahs/day over the last 30 days (incl. today), null when no hifz data at all */
  pace30: number | null;
  /** ratings counted inside each window */
  count7: number;
  count30: number;
  /** total ratings ever recorded */
  totalRatings: number;
  /** true when ratings exist but none fall in the last 30 days */
  hasData: boolean;
}

function countRatingsInWindow(
  ratings: HifzRatings,
  today: Date,
  windowDays: number,
): number {
  const start = addDays(today, -(windowDays - 1));
  const startStr = toDayStr(start);
  const todayStr = toDayStr(today);
  let n = 0;
  for (const r of Object.values(ratings)) {
    if (!r || !isValidDayStr(r.d)) continue;
    if (r.d >= startStr && r.d <= todayStr) n++;
  }
  return n;
}

/**
 * Review pace from hifz ratings: each rating is one ayah reviewed on
 * its date `d`. A pace of 0 is a MEASURED zero (ratings exist, none in
 * the window); null means no ratings exist at all.
 */
export function computePace(
  ratings: HifzRatings,
  today: Date = new Date(),
): PaceResult {
  const valid = Object.values(ratings).filter(
    (r) => r && isValidDayStr(r.d) && (r.q === 1 || r.q === 2 || r.q === 3),
  );
  const totalRatings = valid.length;
  if (totalRatings === 0) {
    return { pace7: null, pace30: null, count7: 0, count30: 0, totalRatings: 0, hasData: false };
  }
  const count7 = countRatingsInWindow(ratings, today, 7);
  const count30 = countRatingsInWindow(ratings, today, 30);
  return {
    pace7: count7 / 7,
    pace30: count30 / 30,
    count7,
    count30,
    totalRatings,
    hasData: true,
  };
}

export interface DayCount {
  date: string;
  /** short weekday label, e.g. "السبت" — caller localises */
  weekday: number; // 0 = Sunday
  count: number;
}

/** Ratings per day for the last `days` days ending today (oldest first). */
export function dailyCounts(
  ratings: HifzRatings,
  today: Date = new Date(),
  days = 7,
): DayCount[] {
  const out: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const key = toDayStr(d);
    let n = 0;
    for (const r of Object.values(ratings)) {
      if (r && r.d === key) n++;
    }
    out.push({ date: key, weekday: d.getDay(), count: n });
  }
  return out;
}

// ── Activity days & streaks ──────────────────────────────────────────

/**
 * Union of every recorded activity day: hifz rating dates, review days,
 * last-listened dates (one per in-progress surah — the only listening
 * dates the app keeps) and the wird lastDone date. Dates in the future
 * are ignored.
 */
export function collectActivityDays(input: {
  ratings: HifzRatings;
  reviewDays: string[];
  listening: ListeningEntry[];
  wirdLastDone: string | null;
  today?: Date;
}): Set<string> {
  const todayStr = toDayStr(input.today ?? new Date());
  const days = new Set<string>();
  const add = (s: unknown) => {
    if (isValidDayStr(s) && s <= todayStr) days.add(s);
  };
  for (const r of Object.values(input.ratings)) if (r) add(r.d);
  for (const d of input.reviewDays) add(d);
  for (const e of input.listening) {
    if (e && Number.isFinite(e.updatedAt) && e.updatedAt > 0) {
      add(toDayStr(new Date(e.updatedAt)));
    }
  }
  add(input.wirdLastDone);
  return days;
}

export interface StreakResult {
  /** Consecutive active days ending today (or yesterday, if today is not done yet). */
  current: number;
  /** Longest run of consecutive active days in the recorded set. */
  longest: number;
  /** True when there is no recorded activity at all. */
  hasData: boolean;
}

export function computeStreaks(
  days: Set<string> | string[],
  today: Date = new Date(),
): StreakResult {
  const set = days instanceof Set ? days : new Set(days);
  if (set.size === 0) return { current: 0, longest: 0, hasData: false };
  // Longest run: walk every day that starts a run.
  let longest = 0;
  for (const s of set) {
    const d = parseDay(s);
    if (!d) continue;
    if (set.has(toDayStr(addDays(d, -1)))) continue; // not a run start
    let len = 0;
    let cur = d;
    while (set.has(toDayStr(cur))) {
      len++;
      cur = addDays(cur, 1);
    }
    if (len > longest) longest = len;
  }
  // Current streak: ends today if active, else yesterday; 0 if neither.
  let current = 0;
  let cur = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!set.has(toDayStr(cur))) cur = addDays(cur, -1);
  while (set.has(toDayStr(cur))) {
    current++;
    cur = addDays(cur, -1);
  }
  return { current, longest, hasData: true };
}

// ── Weakest surahs ───────────────────────────────────────────────────

/** One surah's listening state, for the gap signal. */
export interface ListeningState {
  /** fraction listened 0..1, null when the surah was never started */
  fraction: number | null;
  /** ms epoch of last listen, null when never listened */
  lastListenedAt: number | null;
}

export interface WeakSurah {
  surah: number;
  hard: number;
  medium: number;
  easy: number;
  total: number;
  /** hard*3 + medium + gap bonus (see rankWeakestSurahs) */
  score: number;
  listenedFraction: number | null;
  lastListenedAt: number | null;
  /** true when never listened or not listened in >30 days */
  listeningGap: boolean;
}

/**
 * Rank surahs by hifz difficulty — hard (q=3) ratings weigh most,
 * then medium (q=2) — combined with a listening-gap signal: +2 when
 * the surah has no listening progress at all, +1 when its last listen
 * is over 30 days old. Only surahs with at least one rating appear;
 * a surah is never called weak without a rating behind it.
 */
export function rankWeakestSurahs(
  ratings: HifzRatings,
  listeningBySurah: Record<number, ListeningState>,
  today: Date = new Date(),
  topN = 5,
): WeakSurah[] {
  const bySurah = new Map<number, { hard: number; medium: number; easy: number }>();
  for (const [key, r] of Object.entries(ratings)) {
    if (!r || (r.q !== 1 && r.q !== 2 && r.q !== 3)) continue;
    const surah = Number(String(key).split(":")[0]);
    if (!Number.isFinite(surah) || surah < 1 || surah > 114) continue;
    const acc = bySurah.get(surah) ?? { hard: 0, medium: 0, easy: 0 };
    if (r.q === 3) acc.hard++;
    else if (r.q === 2) acc.medium++;
    else acc.easy++;
    bySurah.set(surah, acc);
  }
  const staleAfter = addDays(today, -30).getTime();
  const rows: WeakSurah[] = [];
  for (const [surah, c] of bySurah) {
    const st = listeningBySurah[surah];
    const fraction = st?.fraction ?? null;
    const lastListenedAt = st?.lastListenedAt ?? null;
    let gapBonus = 0;
    let gap = false;
    if (fraction === null) {
      gapBonus = 2;
      gap = true;
    } else if (lastListenedAt !== null && lastListenedAt < staleAfter) {
      gapBonus = 1;
      gap = true;
    }
    rows.push({
      surah,
      hard: c.hard,
      medium: c.medium,
      easy: c.easy,
      total: c.hard + c.medium + c.easy,
      score: c.hard * 3 + c.medium + gapBonus,
      listenedFraction: fraction,
      lastListenedAt,
      listeningGap: gap,
    });
  }
  rows.sort(
    (a, b) =>
      b.score - a.score ||
      b.hard - a.hard ||
      b.medium - a.medium ||
      a.surah - b.surah,
  );
  return rows.slice(0, topN);
}

// ── Khatma forecast ──────────────────────────────────────────────────

/** Ayah counts per surah, index 0 = surah 1 (from QURAN_TEXT lengths). */
export function readAyahs(completedSurahs: number[], ayahCounts: number[]): number {
  let n = 0;
  for (const s of completedSurahs) {
    const c = ayahCounts[s - 1];
    if (Number.isFinite(c)) n += c;
  }
  return n;
}

/**
 * Average khatma pace = read ayahs ÷ whole days since startedAt.
 * Null when nothing is completed yet or less than one whole day has
 * passed (a same-day pace would be meaningless — e.g. 100 ayahs on
 * day one would "predict" finishing in days).
 */
export function khatmaAveragePace(
  read: number,
  startedAt: number,
  today: Date = new Date(),
): number | null {
  if (read <= 0 || !Number.isFinite(startedAt) || startedAt <= 0) return null;
  const elapsed = daysBetween(new Date(startedAt), today);
  if (elapsed < 1) return null;
  return read / elapsed;
}

export type PaceSource = "khatma" | "review30" | "review7";

export interface KhatmaForecast {
  read: number;
  remaining: number;
  total: number;
  pct: number;
  complete: boolean;
  /** ayahs/day actually used for the forecast, null when unknowable */
  pace: number | null;
  paceSource: PaceSource | null;
  /** whole days from today until the finish, null when unknowable */
  daysRemaining: number | null;
  /** "YYYY-MM-DD" finish date, null when unknowable */
  finishDate: string | null;
}

/**
 * Forecast: remaining ayahs ÷ ACTUAL pace. The khatma average pace is
 * preferred (it is the khatma's own reading rate); the hifz-review
 * pace (30-day, then 7-day) is the fallback. When no pace exists the
 * result carries pace null and the caller shows NO_PACE_MESSAGE.
 */
export function computeKhatmaForecast(input: {
  completedSurahs: number[];
  startedAt: number;
  ayahCounts: number[];
  pace30: number | null;
  pace7: number | null;
  today?: Date;
}): KhatmaForecast {
  const today = input.today ?? new Date();
  const total = input.ayahCounts.reduce((a, b) => a + b, 0);
  const read = readAyahs(input.completedSurahs, input.ayahCounts);
  const remaining = Math.max(0, total - read);
  const pct = total > 0 ? Math.round((read / total) * 100) : 0;
  if (remaining === 0) {
    return { read, remaining, total, pct, complete: true, pace: null, paceSource: null, daysRemaining: 0, finishDate: toDayStr(today) };
  }
  const khatmaPace = khatmaAveragePace(read, input.startedAt, today);
  let pace: number | null = null;
  let paceSource: PaceSource | null = null;
  if (khatmaPace !== null && khatmaPace > 0) {
    pace = khatmaPace;
    paceSource = "khatma";
  } else if (input.pace30 !== null && input.pace30 > 0) {
    pace = input.pace30;
    paceSource = "review30";
  } else if (input.pace7 !== null && input.pace7 > 0) {
    pace = input.pace7;
    paceSource = "review7";
  }
  if (pace === null) {
    return { read, remaining, total, pct, complete: false, pace: null, paceSource: null, daysRemaining: null, finishDate: null };
  }
  const daysRemaining = Math.ceil(remaining / pace);
  return {
    read,
    remaining,
    total,
    pct,
    complete: false,
    pace,
    paceSource,
    daysRemaining,
    finishDate: toDayStr(addDays(today, daysRemaining)),
  };
}

// ── localStorage readers (thin, defensive — the only impure part) ───

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadHifzRatings(): HifzRatings {
  const raw = readJson<Record<string, unknown>>("quran_hifz_ratings", {});
  const out: HifzRatings = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!v || typeof v !== "object") continue;
    const r = v as Partial<HifzRating>;
    if ((r.q === 1 || r.q === 2 || r.q === 3) && isValidDayStr(r.d)) {
      out[k] = { q: r.q, d: r.d, e: r.e, i: r.i, r: r.r, due: r.due };
    }
  }
  return out;
}

export function loadReviewDays(): string[] {
  const raw = readJson<unknown>("quran_hifz_review_days", []);
  if (!Array.isArray(raw)) return [];
  return raw.filter((d): d is string => isValidDayStr(d));
}

export function loadKhatma(): KhatmaStored {
  const raw = readJson<Partial<KhatmaStored>>("quran_khatma", {});
  return {
    completedSurahs: Array.isArray(raw.completedSurahs)
      ? raw.completedSurahs.filter((n) => Number.isFinite(n) && n >= 1 && n <= 114)
      : [],
    startedAt: Number.isFinite(raw.startedAt) ? Number(raw.startedAt) : 0,
    lastUpdatedAt: Number.isFinite(raw.lastUpdatedAt) ? Number(raw.lastUpdatedAt) : 0,
  };
}

export function loadListening(): ListeningEntry[] {
  const raw = readJson<Record<string, unknown>>("quran_listening_progress", {});
  const out: ListeningEntry[] = [];
  for (const v of Object.values(raw)) {
    if (!v || typeof v !== "object") continue;
    const e = v as Partial<ListeningEntry>;
    if (
      Number.isFinite(e.surahNumber) &&
      Number.isFinite(e.currentTime) &&
      Number.isFinite(e.duration) &&
      Number(e.duration) > 0 &&
      Number.isFinite(e.updatedAt)
    ) {
      out.push({
        surahNumber: Number(e.surahNumber),
        reciterId: typeof e.reciterId === "string" ? e.reciterId : undefined,
        currentTime: Number(e.currentTime),
        duration: Number(e.duration),
        updatedAt: Number(e.updatedAt),
      });
    }
  }
  return out;
}

/** One listening state per surah (most recently listened reciter wins). */
export function listeningBySurah(entries: ListeningEntry[]): Record<number, ListeningState> {
  const bySurah: Record<number, ListeningState> = {};
  for (const e of entries) {
    const prev = bySurah[e.surahNumber];
    const fraction = Math.min(1, Math.max(0, e.currentTime / e.duration));
    if (!prev || e.updatedAt > (prev.lastListenedAt ?? -1)) {
      bySurah[e.surahNumber] = { fraction, lastListenedAt: e.updatedAt };
    }
  }
  return bySurah;
}

export function loadWirdLastDone(): string | null {
  try {
    const v = localStorage.getItem("quran_wird_last_done");
    return isValidDayStr(v) ? v : null;
  } catch {
    return null;
  }
}

/** Whole data bundle the page needs, in one read. */
export interface AnalyticsData {
  ratings: HifzRatings;
  reviewDays: string[];
  khatma: KhatmaStored;
  listening: ListeningEntry[];
  wirdLastDone: string | null;
}

export function loadAnalyticsData(): AnalyticsData {
  return {
    ratings: loadHifzRatings(),
    reviewDays: loadReviewDays(),
    khatma: loadKhatma(),
    listening: loadListening(),
    wirdLastDone: loadWirdLastDone(),
  };
}
