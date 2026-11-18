// الحفظ الذكي — محرك SM-2 للتكرار المتباعد (1.0.74).
// كل البيانات محلية بالكامل (localStorage)، بلا شبكة وبلا ذكاء اصطناعي.
// المخطط المشترك (تقرأه ميزة التحليلات بنفس الشكل — لا تغيّره):
//   quran_hifz_ratings: { "s:a": { q: 1|2|3, d: "YYYY-MM-DD", e, i, r, due: "YYYY-MM-DD" } }
//     q: 1=سهل، 2=متوسط، 3=صعب — e: معامل السهولة (يبدأ 2.5) — i: الفاصل بالأيام
//     r: عدد التكرارات — d: آخر مراجعة — due: المراجعة القادمة.
//   quran_hifz_review_days: ["YYYY-MM-DD", ...] — يوم لكل يوم أُكملت فيه مراجعة واحدة على الأقل.
//
// قواعد SM-2:
//   سهل (1):    r+=1؛ i = r==1 ? 1 : r==2 ? 6 : round(i*e)؛ e = min(2.5, e+0.1)
//   متوسط (2):  r+=1؛ i = r==1 ? 1 : r==2 ? 6 : round(i*e)؛ e كما هو
//   صعب (3):    r=0؛ i=1؛ e = max(1.3, e-0.2)
//   due = d + i أيام. كل حسابات التواريخ بالتوقيت المحلي وبصيغة YYYY-MM-DD.

export type HifzQuality = 1 | 2 | 3;

export interface HifzEntry {
  /** 1=سهل، 2=متوسط، 3=صعب */
  q: HifzQuality;
  /** آخر مراجعة YYYY-MM-DD */
  d: string;
  /** معامل السهولة، يبدأ 2.5، محصور [1.3, 2.5] */
  e: number;
  /** الفاصل بالأيام */
  i: number;
  /** عدد التكرارات المتتالية الناجحة */
  r: number;
  /** المراجعة القادمة YYYY-MM-DD */
  due: string;
}

export type HifzRatings = Record<string, HifzEntry>;

export interface HifzStats {
  totalRated: number;
  dueToday: number;
  weakCount: number;
  /** أيام متتالية فيها مراجعة (تنتهي اليوم أو أمس) */
  reviewStreakDays: number;
}

export const HIFZ_RATINGS_KEY = "quran_hifz_ratings";
export const HIFZ_REVIEW_DAYS_KEY = "quran_hifz_review_days";

export const HIFZ_MIN_EASINESS = 1.3;
export const HIFZ_MAX_EASINESS = 2.5;
export const HIFZ_START_EASINESS = 2.5;

/** مفتاح التخزين لآية: "سورة:آية" */
export function hifzKey(surah: number, ayah: number): string {
  return `${surah}:${ayah}`;
}

function clampEasiness(e: number): number {
  return Math.min(HIFZ_MAX_EASINESS, Math.max(HIFZ_MIN_EASINESS, e));
}

/** تاريخ محلي بصيغة YYYY-MM-DD (بلا UTC — التوقيت المحلي للمستخدم). */
export function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** تاريخ اليوم المحلي YYYY-MM-DD. */
export function todayLocal(date = new Date()): string {
  return formatDateLocal(date);
}

/** "YYYY-MM-DD" + n يوم (محلي). */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return formatDateLocal(date);
}

/** عدد الأيام بين تاريخين YYYY-MM-DD (b - a). سالب إذا كان b قبل a. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ta = new Date(ay, am - 1, ad).getTime();
  const tb = new Date(by, bm - 1, bd).getTime();
  return Math.round((tb - ta) / 86400000);
}

/**
 * دالة نقية قابلة للاختبار في node (بلا DOM وبلا localStorage):
 * تحسب الإدخال الجديد بعد تقييم آية بجودة q في يوم today.
 * entry = null لآية جديدة لم تُقيَّم من قبل.
 */
export function nextReview(
  entry: HifzEntry | null,
  q: HifzQuality,
  today: string,
): HifzEntry {
  const prev: HifzEntry =
    entry ?? { q, d: today, e: HIFZ_START_EASINESS, i: 0, r: 0, due: today };

  let r: number;
  let i: number;
  let e: number;

  if (q === 3) {
    // صعب: إعادة من الصفر، والفاصل يوم واحد، ومعامل السهولة ينقص.
    r = 0;
    i = 1;
    e = clampEasiness(prev.e - 0.2);
  } else {
    r = prev.r + 1;
    i = r === 1 ? 1 : r === 2 ? 6 : Math.round(prev.i * prev.e);
    e = q === 1 ? clampEasiness(prev.e + 0.1) : prev.e;
  }

  return { q, d: today, e, i, r, due: addDays(today, i) };
}

// ---------------------------------------------------------------------------
// التخزين (localStorage) — أغلفة صغيرة حول الدالة النقية.
// ---------------------------------------------------------------------------

function storageAvailable(): boolean {
  return typeof localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!storageAvailable()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // التخزين ممتلئ أو محظور — لا نكسر التطبيق.
  }
}

export function loadRatings(): HifzRatings {
  return readJson<HifzRatings>(HIFZ_RATINGS_KEY, {});
}

export function saveRatings(ratings: HifzRatings): void {
  writeJson(HIFZ_RATINGS_KEY, ratings);
}

export function getRating(surah: number, ayah: number): HifzEntry | null {
  return loadRatings()[hifzKey(surah, ayah)] ?? null;
}

export function loadReviewDays(): string[] {
  const days = readJson<string[]>(HIFZ_REVIEW_DAYS_KEY, []);
  return Array.isArray(days) ? [...new Set(days)].sort() : [];
}

/** يسجّل أن يوم date أُكملت فيه مراجعة واحدة على الأقل (للسلاسل). */
export function markReviewDay(date: string): void {
  const days = loadReviewDays();
  if (!days.includes(date)) {
    days.push(date);
    days.sort();
    writeJson(HIFZ_REVIEW_DAYS_KEY, days);
  }
}

/**
 * يقيّم آية ويحفظ النتيجة. يعيد الإدخال الجديد.
 * today اختياري (للفحص) — الافتراضي تاريخ اليوم المحلي.
 */
export function rateAyah(
  surah: number,
  ayah: number,
  q: HifzQuality,
  today: string = todayLocal(),
): HifzEntry {
  const ratings = loadRatings();
  const key = hifzKey(surah, ayah);
  const entry = nextReview(ratings[key] ?? null, q, today);
  ratings[key] = entry;
  saveRatings(ratings);
  markReviewDay(today);
  return entry;
}

// ---------------------------------------------------------------------------
// الاستعلامات
// ---------------------------------------------------------------------------

export interface DueReview {
  surah: number;
  ayah: number;
  entry: HifzEntry;
  /** كم يوماً مضى على موعدها (0 = مستحقة اليوم) */
  overdueDays: number;
}

/**
 * المراجعات المستحقة في يوم today (due <= today)، مرتبة:
 * الضعيفة (q=3) أولاً، ثم الأكثر تأخراً.
 */
export function getDueReviews(today: string = todayLocal()): DueReview[] {
  const ratings = loadRatings();
  const due: DueReview[] = [];
  for (const [key, entry] of Object.entries(ratings)) {
    if (entry.due <= today) {
      const [surah, ayah] = key.split(":").map(Number);
      if (!surah || !ayah) continue;
      due.push({ surah, ayah, entry, overdueDays: daysBetween(entry.due, today) });
    }
  }
  due.sort((a, b) => {
    const weakA = a.entry.q === 3 ? 0 : 1;
    const weakB = b.entry.q === 3 ? 0 : 1;
    if (weakA !== weakB) return weakA - weakB;
    if (a.overdueDays !== b.overdueDays) return b.overdueDays - a.overdueDays;
    if (a.surah !== b.surah) return a.surah - b.surah;
    return a.ayah - b.ayah;
  });
  return due;
}

/** كل الآيات المقيَّمة «صعب» (q=3) — الأضعف حفظاً. */
export function getWeakAyahs(): DueReview[] {
  const ratings = loadRatings();
  const weak: DueReview[] = [];
  for (const [key, entry] of Object.entries(ratings)) {
    if (entry.q !== 3) continue;
    const [surah, ayah] = key.split(":").map(Number);
    if (!surah || !ayah) continue;
    weak.push({ surah, ayah, entry, overdueDays: 0 });
  }
  weak.sort((a, b) => (a.surah - b.surah) || (a.ayah - b.ayah));
  return weak;
}

/**
 * سلسلة أيام المراجعة المتتالية: تُحسب من اليوم، وإن لم يراجع اليوم بعد
 * تُحسب من أمس. مثال: راجع أمس وقبله ولم يراجع اليوم → السلسلة 2.
 */
export function computeStreak(reviewDays: string[], today: string): number {
  const set = new Set(reviewDays);
  let cursor = today;
  if (!set.has(cursor)) cursor = addDays(cursor, -1);
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function getHifzStats(today: string = todayLocal()): HifzStats {
  const ratings = loadRatings();
  const entries = Object.values(ratings);
  return {
    totalRated: entries.length,
    dueToday: getDueReviews(today).length,
    weakCount: entries.filter((e) => e.q === 3).length,
    reviewStreakDays: computeStreak(loadReviewDays(), today),
  };
}
