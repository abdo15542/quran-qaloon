// Reading analytics (تحليلات القراءة) — 1.0.74 feature 4.
// Every number on this page is computed on-device from data the app
// already stores (see src/lib/analytics.ts for the sources and the
// honest limits). Nothing is fetched, estimated, or invented: when a
// metric has no underlying data, the section says so plainly instead
// of showing a zero as if it were measured.

import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  ChartLine,
  Moon,
  Sun,
  Flame,
  TrendingUp,
  BookOpen,
  TriangleAlert,
  Headphones,
  CalendarDays,
} from "lucide-react";
import { QURAN_TEXT } from "@/data/quran-text";
import { SURAHS } from "@/data/surahs";
import {
  NO_PACE_MESSAGE,
  collectActivityDays,
  computeKhatmaForecast,
  computePace,
  computeStreaks,
  dailyCounts,
  listeningBySurah,
  loadAnalyticsData,
  rankWeakestSurahs,
  toDayStr,
  daysBetween,
} from "@/lib/analytics";

interface AnalyticsPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

function toArabicNum(n: number | string): string {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

/** 10 → "١٠" ، 3.33 → "٣٫٣" (one decimal, Arabic decimal separator). */
function formatPace(n: number): string {
  const v = Math.round(n * 10) / 10;
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", "٫");
  return toArabicNum(s);
}

function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("ar-SA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

const WEEKDAY_SHORT = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

export default function AnalyticsPage({ darkMode, toggleDarkMode }: AnalyticsPageProps) {
  const [data] = useState(loadAnalyticsData);
  const today = useMemo(() => new Date(), []);
  const todayStr = toDayStr(today);

  const ayahCounts = useMemo(() => QURAN_TEXT.map((s) => s.length), []);

  const pace = useMemo(() => computePace(data.ratings, today), [data, today]);
  const week = useMemo(() => dailyCounts(data.ratings, today, 7), [data, today]);
  const streaks = useMemo(() => {
    const days = collectActivityDays({
      ratings: data.ratings,
      reviewDays: data.reviewDays,
      listening: data.listening,
      wirdLastDone: data.wirdLastDone,
      today,
    });
    return computeStreaks(days, today);
  }, [data, today]);
  const weakest = useMemo(
    () =>
      rankWeakestSurahs(
        data.ratings,
        listeningBySurah(data.listening),
        today,
        5,
      ),
    [data, today],
  );
  const forecast = useMemo(
    () =>
      computeKhatmaForecast({
        completedSurahs: data.khatma.completedSurahs,
        startedAt: data.khatma.startedAt,
        ayahCounts,
        pace30: pace.pace30,
        pace7: pace.pace7,
        today,
      }),
    [data.khatma, ayahCounts, pace, today],
  );

  const hasAnyData =
    pace.hasData ||
    forecast.read > 0 ||
    data.listening.length > 0 ||
    data.wirdLastDone !== null;
  const maxWeekCount = Math.max(1, ...week.map((d) => d.count));

  const paceSourceLabel =
    forecast.paceSource === "khatma"
      ? "بناءً على متوسط ختمتك"
      : forecast.paceSource === "review30"
        ? "بناءً على وتيرة المراجعة (آخر ٣٠ يومًا)"
        : forecast.paceSource === "review7"
          ? "بناءً على وتيرة المراجعة (آخر ٧ أيام)"
          : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/">
              <button className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="رجوع">
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <ChartLine className="w-5 h-5 text-primary" />
            <span className="font-arabic text-lg text-primary">تحليلات القراءة</span>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {!hasAnyData && (
          <div className="bg-card border border-border rounded-2xl p-5" data-testid="analytics-empty">
            <div className="font-arabic text-base text-foreground mb-1">لا توجد بيانات بعد</div>
            <p className="text-sm text-muted-foreground">
              لم تُسجَّل بعد أي تقييمات حفظ أو سور مكتملة في الختمة أو استماع أو ورد. ابدأ بالقراءة
              والمراجعة، وستظهر هنا وتيرتك وسلاسلك وأضعف السور وتوقع إتمام الختمة.
            </p>
          </div>
        )}

        {/* ── Pace ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-primary" />
            <span className="font-arabic text-base text-foreground">وتيرة المراجعة</span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            آيات راجعتها وقُيّمت في الحفظ — آية واحدة لكل تقييم حفظ مسجَّل.
          </p>
          {pace.hasData ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/60 p-4" data-testid="pace-7" data-value={pace.pace7 === null ? "" : pace.pace7.toFixed(2)}>
                <div className="text-xs text-muted-foreground mb-1">آخر ٧ أيام</div>
                <div className="text-2xl font-bold text-foreground">
                  {pace.pace7 === null ? "—" : formatPace(pace.pace7)}
                  <span className="text-sm font-normal text-muted-foreground"> آية/يوم</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1" data-testid="pace-7-count" data-value={String(pace.count7)}>
                  {toArabicNum(pace.count7)} آية في آخر ٧ أيام
                </div>
              </div>
              <div className="rounded-xl bg-muted/60 p-4" data-testid="pace-30" data-value={pace.pace30 === null ? "" : pace.pace30.toFixed(2)}>
                <div className="text-xs text-muted-foreground mb-1">آخر ٣٠ يومًا</div>
                <div className="text-2xl font-bold text-foreground">
                  {pace.pace30 === null ? "—" : formatPace(pace.pace30)}
                  <span className="text-sm font-normal text-muted-foreground"> آية/يوم</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1" data-testid="pace-30-count" data-value={String(pace.count30)}>
                  {toArabicNum(pace.count30)} آية في آخر ٣٠ يومًا
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="pace-empty">
              لا توجد تقييمات حفظ بعد — قيّم حفظك في «الحفظ الذكي» لتظهر وتيرتك هنا.
            </p>
          )}

          {/* Weekly bar chart (plain divs, no chart library) */}
          {pace.hasData && (
            <div className="mt-5" data-testid="weekly-chart">
              <div className="text-sm text-foreground mb-3">آيات راجعتها كل يوم — آخر ٧ أيام</div>
              <div className="flex items-end gap-2 h-32">
                {week.map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                    <span className="text-xs font-bold text-foreground" data-testid={`week-count-${d.date}`} data-value={String(d.count)}>
                      {toArabicNum(d.count)}
                    </span>
                    <div
                      className={`w-full max-w-8 rounded-t-md ${d.count > 0 ? "bg-primary" : "bg-muted"}`}
                      style={{ height: `${d.count > 0 ? Math.max(8, (d.count / maxWeekCount) * 100) : 3}%` }}
                      data-testid={`week-bar-${d.date}`}
                      data-value={String(d.count)}
                    />
                    <span className="text-[11px] text-muted-foreground">{WEEKDAY_SHORT[d.weekday]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Streaks ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Flame className="w-5 h-5 text-amber-500" />
            <span className="font-arabic text-base text-foreground">السلاسل</span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            أيام متتالية فيها نشاط مسجَّل: تقييم حفظ، أو يوم مراجعة، أو استماع، أو إتمام الورد.
          </p>
          {streaks.hasData ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/60 p-4" data-testid="streak-current" data-value={String(streaks.current)}>
                <div className="text-xs text-muted-foreground mb-1">السلسلة الحالية</div>
                <div className="text-2xl font-bold text-foreground">
                  {toArabicNum(streaks.current)}
                  <span className="text-sm font-normal text-muted-foreground"> يوم</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {streaks.current > 0 ? "مستمرة — واصل اليوم لتحافظ عليها" : "انقطعت — ابدأ اليوم سلسلة جديدة"}
                </div>
              </div>
              <div className="rounded-xl bg-muted/60 p-4" data-testid="streak-longest" data-value={String(streaks.longest)}>
                <div className="text-xs text-muted-foreground mb-1">أطول سلسلة مسجلة</div>
                <div className="text-2xl font-bold text-foreground">
                  {toArabicNum(streaks.longest)}
                  <span className="text-sm font-normal text-muted-foreground"> يوم</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">من أيام النشاط المسجلة على جهازك</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="streak-empty">
              لا توجد أيام نشاط مسجلة بعد — ستظهر سلسلتك هنا مع أول يوم نشاط.
            </p>
          )}
        </div>

        {/* ── Weakest surahs ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <TriangleAlert className="w-5 h-5 text-amber-500" />
            <span className="font-arabic text-base text-foreground">أضعف السور</span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            السور التي قيّمت آياتها «صعب» أكثر — اضغط على سورة لمراجعتها. السور التي لم تُستمع تُرفع في الترتيب.
          </p>
          {weakest.length > 0 ? (
            <div className="space-y-2" data-testid="weakest-list">
              {weakest.map((w, i) => {
                const surah = SURAHS.find((s) => s.number === w.surah);
                const listenedDays =
                  w.lastListenedAt !== null
                    ? daysBetween(new Date(w.lastListenedAt), today)
                    : null;
                return (
                  <Link key={w.surah} href={`/surah/${w.surah}`}>
                    <div
                      className="flex items-center justify-between gap-2 py-2 border-b border-border last:border-b-0 cursor-pointer hover:text-primary transition-colors"
                      data-testid={i === 0 ? "weakest-first" : undefined}
                      data-surah={String(w.surah)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 shrink-0 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                          {toArabicNum(i + 1)}
                        </span>
                        <div className="min-w-0">
                          <div className="font-arabic text-sm text-foreground truncate">
                            {surah ? surah.name : `سورة ${toArabicNum(w.surah)}`}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                            <span className="text-rose-600 dark:text-rose-400">صعب ×{toArabicNum(w.hard)}</span>
                            <span className="text-amber-600 dark:text-amber-400">متوسط ×{toArabicNum(w.medium)}</span>
                            <span>من {toArabicNum(w.total)} آية مقيَّمة</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                        <Headphones className="w-3.5 h-3.5" />
                        {w.listenedFraction === null
                          ? "لم تُستمع بعد"
                          : `استمعت ${toArabicNum(Math.round(w.listenedFraction * 100))}٪${listenedDays !== null && listenedDays > 0 ? ` · منذ ${toArabicNum(listenedDays)} يوم` : ""}`}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="weakest-empty">
              لا توجد تقييمات حفظ بعد — قيّم حفظك في «الحفظ الذكي» لتظهر هنا السور الأضعف.
            </p>
          )}
        </div>

        {/* ── Khatma forecast ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="font-arabic text-base text-foreground">توقع إتمام الختمة</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-foreground">
              قرأت <span className="font-bold" data-testid="forecast-read" data-value={String(forecast.read)}>{toArabicNum(forecast.read)}</span> آية
              من {toArabicNum(forecast.total)}
            </div>
            <div className="text-sm font-bold text-primary">{toArabicNum(forecast.pct)}٪</div>
          </div>
          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden mb-2">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${forecast.pct}%` }} />
          </div>
          <div className="text-xs text-muted-foreground mb-4" data-testid="forecast-remaining" data-value={String(forecast.remaining)}>
            {toArabicNum(forecast.remaining)} آية متبقية — {toArabicNum(data.khatma.completedSurahs.length)} سورة مكتملة من ١١٤
          </div>
          {forecast.complete ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-arabic" data-testid="forecast-complete">
              تبارك الله! أتممت الختمة — {toArabicNum(forecast.read)} آية.
            </p>
          ) : forecast.pace !== null && forecast.finishDate !== null ? (
            <div className="space-y-1" data-testid="forecast-result">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                <span>
                  التوقع: تُتم الختمة بتاريخ{" "}
                  <span className="font-bold" data-testid="forecast-date" data-value={forecast.finishDate}>
                    {formatLongDate(forecast.finishDate)}
                  </span>{" "}
                  — بعد{" "}
                  <span className="font-bold" data-testid="forecast-days" data-value={String(forecast.daysRemaining)}>
                    {toArabicNum(forecast.daysRemaining ?? 0)}
                  </span>{" "}
                  يوم
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {paceSourceLabel} — {formatPace(forecast.pace)} آية/يوم
                {forecast.paceSource === "khatma"
                  ? ` (قرأت ${toArabicNum(forecast.read)} آية منذ بدء الختمة)`
                  : ""}
                . التاريخ يتغير مع تغير وتيرتك.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="forecast-empty">
              {NO_PACE_MESSAGE}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground mt-4">
            الأرقام محسوبة من بياناتك المحفوظة على جهازك فقط: تقييمات الحفظ، الختمة، الاستماع،
            الورد. لا يُرسل شيء خارج جهازك، ولا تُحسب وتيرة استماع يومية لأن التطبيق لا يحفظ
            عدد آيات يومي للاستماع.
          </p>
        </div>

        <p className="text-center text-[11px] text-muted-foreground pb-2">بيانات اليوم: {todayStr}</p>
      </div>
    </div>
  );
}
