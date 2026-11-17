// Daily wird (الورد اليومي): a fixed daily portion of the Mushaf, page by
// page, with a consecutive-day streak and an optional daily reminder.
// The portion advances only when the user marks it done, so a missed day
// never skips pages — the reader always continues where they stopped.

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Moon, Sun, BookOpen, CheckCircle2, Flame, Bell, BellOff, CalendarCheck } from "lucide-react";
import { SURAHS } from "@/data/surahs";
import { getMushafPageRange } from "@/data/mushaf-pages";
import { useWird } from "@/hooks/useWird";

interface WirdPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

function surahName(n: number): string {
  return SURAHS.find((s) => s.number === n)?.name ?? "";
}

export default function WirdPage({ darkMode, toggleDarkMode }: WirdPageProps) {
  const [, navigate] = useLocation();
  const {
    startPage,
    endPage,
    pagesPerDay,
    streak,
    todayDone,
    reminderEnabled,
    reminderTime,
    reminderStatus,
    markDoneToday,
    setPagesPerDay,
    setReminder,
  } = useWird();
  const [reminderBusy, setReminderBusy] = useState(false);

  const startRange = getMushafPageRange(startPage);
  const endRange = getMushafPageRange(endPage);
  const pageLabel =
    startPage === endPage
      ? `صفحة ${toArabicNum(startPage)}`
      : `الصفحات ${toArabicNum(startPage)} – ${toArabicNum(endPage)}`;
  const rangeLabel =
    startRange && endRange
      ? startRange.startSurah === endRange.endSurah
        ? `سورة ${surahName(startRange.startSurah)} — من الآية ${toArabicNum(startRange.startAyah)} إلى الآية ${toArabicNum(endRange.endAyah)}`
        : `من سورة ${surahName(startRange.startSurah)} آية ${toArabicNum(startRange.startAyah)} إلى سورة ${surahName(endRange.endSurah)} آية ${toArabicNum(endRange.endAyah)}`
      : "";

  const handleReminderToggle = async () => {
    if (reminderBusy) return;
    setReminderBusy(true);
    try {
      await setReminder(!reminderEnabled, reminderTime);
    } finally {
      setReminderBusy(false);
    }
  };

  const handleTimeChange = async (time: string) => {
    if (reminderBusy) return;
    setReminderBusy(true);
    try {
      // Changing the time while the reminder is on re-schedules it.
      await setReminder(reminderEnabled, time);
    } finally {
      setReminderBusy(false);
    }
  };

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
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="font-arabic text-lg text-primary">وردي اليومي</span>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Streak */}
        <div className="bg-gradient-to-l from-amber-500/15 to-amber-500/5 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Flame className="w-8 h-8 text-amber-500" />
            <div>
              <div className="font-arabic text-base text-foreground">سلسلة الأيام</div>
              <div className="text-xs text-muted-foreground">
                {streak > 0
                  ? `أكملت وردك ${toArabicNum(streak)} ${streak === 1 ? "يوم" : streak === 2 ? "يومين" : "أيام"} متتالية — واصل!`
                  : "ابدأ اليوم، وستظهر سلسلتك هنا"}
              </div>
            </div>
          </div>
          <div className="text-3xl font-bold text-amber-500 tabular-nums">{toArabicNum(streak)}</div>
        </div>

        {/* Today's portion */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <CalendarCheck className="w-5 h-5 text-primary" />
            <span className="font-arabic text-lg text-foreground">ورد اليوم</span>
            {todayDone && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                ✓ أُكمل اليوم
              </span>
            )}
          </div>
          <div className="font-arabic text-2xl text-primary text-center my-3">{pageLabel}</div>
          <div className="text-sm text-muted-foreground text-center mb-4">{rangeLabel}</div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/mushaf/${startPage}`)}
              className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              ابدأ الورد
            </button>
            <button
              onClick={markDoneToday}
              disabled={todayDone}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                todayDone
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-card border border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
              } disabled:opacity-70`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {todayDone ? "أكملت ورد اليوم ✓" : "أكملت الورد"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            عند إكمال الورد ينتقل المؤشر إلى الصفحات التالية تلقائيًا — لا تفوتك صفحة أبدًا.
          </p>
        </div>

        {/* Pages per day */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="font-arabic text-base text-foreground mb-1">كم صفحة في اليوم؟</div>
          <div className="text-xs text-muted-foreground mb-3">
            ختمة كاملة بهذا المعدل خلال {toArabicNum(Math.ceil(604 / pagesPerDay))} يومًا تقريبًا.
          </div>
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 5, 10].map((n) => (
              <button
                key={n}
                onClick={() => setPagesPerDay(n)}
                className={`px-4 py-2 rounded-xl text-sm transition-colors ${
                  pagesPerDay === n
                    ? "bg-primary text-primary-foreground font-bold"
                    : "bg-background border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {toArabicNum(n)} {n === 1 ? "صفحة" : "صفحات"}
              </button>
            ))}
          </div>
        </div>

        {/* Daily reminder */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {reminderEnabled ? (
                <Bell className="w-5 h-5 text-primary" />
              ) : (
                <BellOff className="w-5 h-5 text-muted-foreground" />
              )}
              <span className="font-arabic text-base text-foreground">تذكير يومي</span>
            </div>
            <button
              onClick={handleReminderToggle}
              disabled={reminderBusy}
              className={`relative w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${
                reminderEnabled ? "bg-primary" : "bg-muted"
              }`}
              aria-label="تفعيل التذكير اليومي أو إيقافه"
            >
              <span
                className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${
                  reminderEnabled ? "right-0.5" : "right-[calc(100%-1.625rem)]"
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            إشعار يومي يذكّرك بوردك، حتى والتطبيق مغلق.
          </p>
          {reminderEnabled && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">وقت التذكير:</span>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => handleTimeChange(e.target.value)}
                disabled={reminderBusy}
                className="bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                dir="ltr"
              />
            </label>
          )}
          {reminderStatus && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-3">{reminderStatus}</p>
          )}
        </div>
      </div>
    </div>
  );
}
