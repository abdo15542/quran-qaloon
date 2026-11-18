import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  ChevronLeft,
  Eye,
  Flame,
  Moon,
  Sun,
} from "lucide-react";
import { displayAyahText, getAyah } from "@/data/quran-text";
import { SURAHS } from "@/data/surahs";
import {
  getDueReviews,
  getHifzStats,
  todayLocal,
  type DueReview,
  type HifzStats,
} from "@/lib/hifz";
import HifzRating from "@/components/HifzRating";

interface HifzPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

function overdueLabel(overdueDays: number): string {
  if (overdueDays <= 0) return "مستحقة اليوم";
  if (overdueDays === 1) return "متأخرة يوم واحد";
  if (overdueDays === 2) return "متأخرة يومان";
  return `متأخرة ${overdueDays} أيام`;
}

function ayahText(surah: number, ayah: number): string {
  const a = getAyah(surah, ayah);
  return a ? displayAyahText(surah, ayah, a.text) : "";
}

export default function HifzPage({ darkMode, toggleDarkMode }: HifzPageProps) {
  const [, navigate] = useLocation();
  const [queue, setQueue] = useState<DueReview[]>(() => getDueReviews());
  const [reviewedCount, setReviewedCount] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState<HifzStats>(() => getHifzStats());

  const totalDue = queue.length + reviewedCount;
  const current = queue[0] ?? null;

  const surahName = (n: number) => SURAHS[n - 1]?.name ?? "";

  const handleRated = () => {
    // الآية المقيَّمة خرجت من قائمة اليوم (موعدها الجديد في المستقبل).
    setQueue((q) => q.slice(1));
    setReviewedCount((c) => c + 1);
    setRevealed(false);
    setStats(getHifzStats());
  };

  const today = useMemo(() => todayLocal(), []);

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/">
              <button className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="رجوع">
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Brain className="w-5 h-5 text-primary" />
            <span className="font-arabic text-lg text-primary">الحفظ الذكي</span>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* ملخص: مستحقة اليوم / ضعيفة / السلسلة */}
        <div className="grid grid-cols-3 gap-2" data-testid="hifz-summary">
          <div className="rounded-2xl border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-primary" data-testid="hifz-due-count">
              {stats.dueToday}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">مستحقة اليوم</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-red-600" data-testid="hifz-weak-count">
              {stats.weakCount}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">آيات ضعيفة</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-amber-600 flex items-center justify-center gap-1">
              <Flame className="w-5 h-5" />
              <span data-testid="hifz-streak">{stats.reviewStreakDays}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">سلسلة المراجعة</p>
          </div>
        </div>

        {current ? (
          /* بطاقة مراجعة: آية واحدة في كل مرة */
          <section
            className="rounded-2xl border border-border bg-card p-4 space-y-4"
            data-testid="hifz-review-card"
            data-surah={current.surah}
            data-ayah={current.ayah}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base">مراجعة اليوم</h2>
              <span className="text-xs text-muted-foreground">
                {reviewedCount + 1} من {totalDue}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-primary">
                سورة {surahName(current.surah)} — الآية {current.ayah}
              </span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full ${
                  current.entry.q === 3
                    ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                    : current.overdueDays > 0
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                }`}
              >
                {overdueLabel(current.overdueDays)}
              </span>
              {current.entry.q === 3 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-600 text-white">ضعيفة</span>
              )}
            </div>

            {revealed ? (
              <p className="quran-text text-center text-foreground" dir="rtl" data-testid="hifz-ayah-text">
                {ayahText(current.surah, current.ayah)}
              </p>
            ) : (
              <button
                type="button"
                data-testid="hifz-reveal"
                onClick={() => setRevealed(true)}
                className="w-full py-8 rounded-xl border border-dashed border-border bg-muted/50 flex flex-col items-center gap-2 text-muted-foreground hover:bg-muted transition-colors"
              >
                <Eye className="w-6 h-6" />
                <span className="text-sm font-bold">عرض الآية</span>
                <span className="text-xs">حاول تذكرها أولاً ثم اعرضها وقيّم حفظك</span>
              </button>
            )}

            {revealed && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">كيف كان حفظك لهذه الآية؟</p>
                <HifzRating
                  key={`${current.surah}:${current.ayah}`}
                  surahNumber={current.surah}
                  ayahNumber={current.ayah}
                  onRated={handleRated}
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate(`/surah/${current.surah}?ayah=${current.ayah}`)}
              className="w-full text-sm text-primary font-bold py-2 rounded-xl hover:bg-muted transition-colors flex items-center justify-center gap-1"
            >
              فتح الآية في السورة
              <ChevronLeft className="w-4 h-4" />
            </button>
          </section>
        ) : reviewedCount > 0 ? (
          /* أكمل كل مراجعات اليوم */
          <section
            className="rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 p-6 text-center space-y-2"
            data-testid="hifz-done"
          >
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h2 className="font-bold text-lg text-emerald-700 dark:text-emerald-300">
              أحسنت! أكملت مراجعة اليوم
            </h2>
            <p className="text-sm text-muted-foreground">
              راجعت {reviewedCount} {reviewedCount === 1 ? "آية" : "آيات"} اليوم — سلسلة المراجعة{" "}
              {stats.reviewStreakDays} {stats.reviewStreakDays === 1 ? "يوم" : "أيام"}.
            </p>
          </section>
        ) : (
          /* لا شيء مستحق */
          <section
            className="rounded-2xl border border-border bg-card p-8 text-center space-y-2"
            data-testid="hifz-empty"
          >
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h2 className="font-bold text-lg">لا مراجعات مستحقة اليوم — أحسنت</h2>
            <p className="text-sm text-muted-foreground">
              قيّم حفظك من صفحة السورة (سهل / متوسط / صعب) وستظهر آياتك هنا في موعد مراجعتها.
            </p>
          </section>
        )}

        {/* قائمة مراجعة اليوم — الضعيفة والأكثر تأخراً أولاً */}
        {queue.length > 0 && (
          <section>
            <h2 className="font-bold text-base mb-2">مراجعة اليوم ({queue.length})</h2>
            <div className="space-y-2">
              {queue.map((item) => (
                <button
                  key={`${item.surah}:${item.ayah}`}
                  type="button"
                  data-testid="hifz-due-item"
                  data-surah={item.surah}
                  data-ayah={item.ayah}
                  data-q={item.entry.q}
                  data-overdue={item.overdueDays}
                  onClick={() => navigate(`/surah/${item.surah}?ayah=${item.ayah}`)}
                  className="w-full text-start rounded-2xl border border-border bg-card p-3 hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">
                      سورة {surahName(item.surah)} — الآية {item.ayah}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {item.entry.q === 3 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-600 text-white">
                          ضعيفة
                        </span>
                      )}
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full ${
                          item.overdueDays > 0
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}
                      >
                        {overdueLabel(item.overdueDays)}
                      </span>
                    </span>
                  </div>
                  <p className="quran-text text-[17px] leading-[2.2] text-foreground/90 line-clamp-2 mt-1" dir="rtl">
                    {ayahText(item.surah, item.ayah)}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {stats.totalRated > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            آيات قيد الحفظ: {stats.totalRated} — اليوم {today}
          </p>
        )}
      </div>
    </div>
  );
}
