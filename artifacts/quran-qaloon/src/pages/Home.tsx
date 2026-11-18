import { useState, useMemo, useEffect } from "react";
import { Search, BookOpen, Moon, Sun, ScrollText, Info, SearchIcon, RotateCcw, CheckCircle2, WifiOff, Heart, Clock, BarChart3, Compass, Sparkles, Quote } from "lucide-react";
import { SURAHS, RECITERS, buildAudioUrl } from "@/data/surahs";
import { getAyah } from "@/data/quran-text";
import { getVerseOfDay } from "@/data/verse-of-day";
import { formatHijriDate } from "@/data/hijri";
import { getQibla } from "@/data/qibla";
import { useListeningProgress } from "@/hooks/useListeningProgress";
import { useKhatma } from "@/hooks/useKhatma";
import { useFavourites } from "@/hooks/useFavourites";
import { useWird } from "@/hooks/useWird";
import { getNextPrayerForCoords, getActiveLocation, formatPrayerTime, formatCountdown, PRAYER_NAMES, ensurePrayerRemindersScheduled, isPrayerReminderEnabled, isExactAlarmGranted, openExactAlarmSettingsPage } from "@/data/prayer-times";
import { refreshAfterPrayerAthkar } from "@/hooks/useAthkarReminders";
import { updateWidgetData } from "@/lib/widget-data";
import { Capacitor } from "@capacitor/core";
import { getLastMushafPage } from "@/data/mushaf-pages";
import { useOffline } from "@/context/OfflineContext";
import DownloadButton from "@/components/DownloadButton";
import { Link } from "wouter";

interface HomeProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat("ar-SA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(ts));
}

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

function getSelectedReciter() {
  const reciterId = localStorage.getItem("quran_reciter") ?? "mishary";
  return (
    RECITERS.find((r) => r.id === reciterId) ??
    RECITERS.find((r) => r.id === "mishary") ??
    RECITERS[0]
  );
}

export default function Home({ darkMode, toggleDarkMode }: HomeProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "meccan" | "medinan" | "disputed">("all");
  const [showLegend, setShowLegend] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const { getAllProgress } = useListeningProgress();
  const allProgress = getAllProgress();
  const inProgressSurahs = Object.values(allProgress);

  const { cachedItems } = useOffline();

  const {
    totalCompleted,
    isKhatmaComplete,
    startedAt,
    isCompleted,
    resetKhatma,
  } = useKhatma();

  const { count: favouritesCount } = useFavourites();

  const { startPage, endPage, streak, todayDone } = useWird();

  // Next prayer for the Home card (live countdown, 30s tick) + keep the
  // prayer-reminder window fresh whenever the app opens. The location is
  // the active one: stored GPS coordinates in auto mode, the selected
  // city otherwise (detected on the prayer page).
  const [now, setNow] = useState(() => new Date());
  const activeLoc = getActiveLocation();
  const nextPrayer = useMemo(
    () => getNextPrayerForCoords(now, activeLoc.lat, activeLoc.lng),
    [now, activeLoc.lat, activeLoc.lng]
  );
  // True when the reminder is on but the exact-alarm permission is
  // denied, so the adhan falls back to the notification sound: the
  // prayer card shows a one-line status for it (native only — the web
  // preview has no exact alarms at all).
  const [exactAlarmDenied, setExactAlarmDenied] = useState(false);
  useEffect(() => {
    // Tick every second: the countdown shows seconds in the last
    // minute, and a 30s tick left the seconds frozen for up to half
    // a minute before jumping.
    const t = window.setInterval(() => setNow(new Date()), 1000);
    ensurePrayerRemindersScheduled().catch(() => {});
    // تذكيرات أذكار بعد الصلاة (اليوم وغدًا) + بيانات ويدجت الشاشة الرئيسية.
    refreshAfterPrayerAthkar().catch(() => {});
    updateWidgetData().catch(() => {});
    if (Capacitor.isNativePlatform() && isPrayerReminderEnabled()) {
      isExactAlarmGranted().then((ok) => setExactAlarmDenied(!ok)).catch(() => {});
    }
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastMushafPage = getLastMushafPage();

  // آية اليوم — ثابتة لكل يوم (بذرة من التاريخ)، اضغط للانتقال إليها.
  const verseOfDay = useMemo(() => getVerseOfDay(new Date()), []);
  const verseAyah = getAyah(verseOfDay.surah, verseOfDay.ayah);
  const verseSurah = SURAHS.find((s) => s.number === verseOfDay.surah);

  const reciter = getSelectedReciter();

  const filtered = useMemo(() => {
    const searchDigits = search.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
    return SURAHS.filter((s) => {
      const matchesSearch =
        search === "" ||
        s.name.includes(search) ||
        s.englishName.toLowerCase().includes(search.toLowerCase()) ||
        String(s.number).includes(searchDigits);
      const matchesFilter =
        filter === "all" ||
        (filter === "meccan" && s.revelationType === "Meccan") ||
        (filter === "medinan" && s.revelationType === "Medinan") ||
        (filter === "disputed" && s.revelationType === "Disputed");
      return matchesSearch && matchesFilter;
    });
  }, [search, filter]);

  const meccanCount = SURAHS.filter((s) => s.revelationType === "Meccan").length;
  const medinanCount = SURAHS.filter((s) => s.revelationType === "Medinan").length;
  const disputedCount = SURAHS.filter((s) => s.revelationType === "Disputed").length;

  const khatmaPct = Math.round((totalCompleted / 114) * 100);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="font-arabic text-lg text-primary">تسميع القرآن</span>
          </div>
          <div className="text-center hidden sm:block">
            <div className="text-xs text-muted-foreground">رواية قالون عن نافع</div>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/search">
              <button className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground" title="البحث في القرآن">
                <SearchIcon className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/downloads">
              <button
                className="relative p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground"
                title="الملفات المحفوظة"
              >
                <WifiOff className="w-4 h-4" />
                {cachedItems.length > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </button>
            </Link>
            <Link href="/athkar">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-arabic">
                <ScrollText className="w-4 h-4" />
                <span className="hidden sm:inline">الأذكار</span>
              </button>
            </Link>
            <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <div className="bismillah-text text-3xl sm:text-4xl text-primary mb-2">
            بسم الله الرحمن الرحيم
          </div>
          <p className="text-muted-foreground text-sm">
            اختر سورة للاستماع إليها بصوت قالون عن نافع
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            {formatHijriDate(now)} — التاريخ الهجري اليوم
          </p>
        </div>

        {/* Khatma Progress Card */}
        <div className={`mb-6 rounded-2xl border overflow-hidden ${
          isKhatmaComplete
            ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20"
            : "border-border bg-card"
        }`}>
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{isKhatmaComplete ? "🎉" : "📿"}</span>
                <div>
                  <div className="font-arabic text-base text-foreground">
                    {isKhatmaComplete ? "تبارك الله! أتممت الختمة" : "ختمة القرآن الكريم"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    بدأت بتاريخ {formatDate(startedAt)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className={`text-2xl font-sans font-bold ${isKhatmaComplete ? "text-emerald-600 dark:text-emerald-400" : "text-primary"}`}>
                    {totalCompleted}
                    <span className="text-sm font-normal text-muted-foreground">/114</span>
                  </div>
                  <div className="text-xs text-muted-foreground">سورة مكتملة</div>
                </div>
                {totalCompleted > 0 && (
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                    title="بدء ختمة جديدة"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isKhatmaComplete ? "bg-emerald-500" : "bg-primary"
                }`}
                style={{ width: `${khatmaPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
              <span>{khatmaPct}٪ مكتمل</span>
              <span>{114 - totalCompleted} سورة متبقية</span>
            </div>
          </div>

          {showResetConfirm && (
            <div className="border-t border-border bg-muted/50 px-5 py-3 flex items-center justify-between gap-3">
              <span className="text-sm font-arabic text-foreground">هل تريد بدء ختمة جديدة؟ سيتم مسح تقدمك الحالي.</span>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => { resetKhatma(); setShowResetConfirm(false); }}
                  className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs hover:opacity-90 transition-opacity"
                >
                  نعم، ابدأ من جديد
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1.5 rounded-lg bg-card border border-border text-xs hover:bg-muted transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </div>

        {/* آية اليوم */}
        {verseAyah && verseSurah && (
          <Link href={`/surah/${verseOfDay.surah}?ayah=${verseOfDay.ayah}`}>
            <div className="bg-gradient-to-l from-emerald-500/15 to-emerald-500/5 border border-emerald-500/30 rounded-2xl p-4 mb-6 hover:border-emerald-500/60 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-center gap-2 mb-2">
                <Quote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="font-arabic text-base text-foreground">آية اليوم</span>
                <span className="text-xs text-muted-foreground">
                  سورة {verseSurah.name} — الآية {toArabicNum(verseOfDay.ayah)}
                </span>
              </div>
              <div
                className="text-lg text-foreground leading-loose text-center"
                style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
                dir="rtl"
              >
                {verseAyah.text} ﴿{toArabicNum(verseOfDay.ayah)}﴾
              </div>
            </div>
          </Link>
        )}

        {/* المفضلة والأجزاء وأوقات الصلاة والإحصائيات */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link href="/favourites">
            <div className="bg-card border border-border rounded-2xl p-4 hover:border-rose-400/60 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-center gap-2 mb-1.5">
                <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                <span className="font-arabic text-base text-foreground">المفضلة</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {favouritesCount > 0
                  ? `${favouritesCount} آية محفوظة`
                  : "احفظ آياتك المفضلة هنا"}
              </div>
            </div>
          </Link>
          <Link href="/juz">
            <div className="bg-card border border-border rounded-2xl p-4 hover:border-primary/60 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-center gap-2 mb-1.5">
                <BookOpen className="w-5 h-5 text-primary" />
                <span className="font-arabic text-base text-foreground">الأجزاء</span>
              </div>
              <div className="text-xs text-muted-foreground">تصفح المصحف بالجزء — ٣٠ جزءًا</div>
            </div>
          </Link>
          <Link href="/hizb">
            <div className="bg-card border border-border rounded-2xl p-4 hover:border-primary/60 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-center gap-2 mb-1.5">
                <BookOpen className="w-5 h-5 text-primary" />
                <span className="font-arabic text-base text-foreground">الأحزاب</span>
              </div>
              <div className="text-xs text-muted-foreground">تصفح المصحف بالحزب — ٦٠ حزبًا وآيات السجدة</div>
            </div>
          </Link>
          <Link href="/prayer-times">
            <div className="bg-card border border-border rounded-2xl p-4 hover:border-primary/60 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-center gap-2 mb-1.5">
                <Clock className="w-5 h-5 text-primary" />
                <span className="font-arabic text-base text-foreground">أوقات الصلاة</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {PRAYER_NAMES[nextPrayer.key]} {formatPrayerTime(nextPrayer.time)} — متبقٍّ {formatCountdown(nextPrayer.time.getTime() - now.getTime())} · {activeLoc.label}
              </div>
              {exactAlarmDenied && (
                <div
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openExactAlarmSettingsPage();
                  }}
                  className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 cursor-pointer"
                >
                  الأذان الكامل غير مفعّل — اضغط لفتحه
                </div>
              )}
            </div>
          </Link>
          <Link href="/stats">
            <div className="bg-card border border-border rounded-2xl p-4 hover:border-primary/60 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-center gap-2 mb-1.5">
                <BarChart3 className="w-5 h-5 text-primary" />
                <span className="font-arabic text-base text-foreground">إحصائياتي</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {totalCompleted}/١١٤ سورة مكتملة — وسلسلة الورد {streak} {streak === 1 ? "يوم" : streak === 2 ? "يومين" : "أيام"}
              </div>
            </div>
          </Link>
          <Link href="/qibla">
            <div className="bg-card border border-border rounded-2xl p-4 hover:border-primary/60 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-center gap-2 mb-1.5">
                <Compass className="w-5 h-5 text-primary" />
                <span className="font-arabic text-base text-foreground">اتجاه القبلة</span>
              </div>
              <div className="text-xs text-muted-foreground">
                القبلة {getQibla(activeLoc.lat, activeLoc.lng).bearing.toFixed(1)}° من الشمال — {getQibla(activeLoc.lat, activeLoc.lng).distanceKm.toLocaleString("ar-EG")} كم من مكة
              </div>
            </div>
          </Link>
          <Link href="/asma">
            <div className="bg-card border border-border rounded-2xl p-4 hover:border-primary/60 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="font-arabic text-base text-foreground">أسماء الله الحسنى</span>
              </div>
              <div className="text-xs text-muted-foreground">الأسماء التسعة والتسعون ومعانيها</div>
            </div>
          </Link>
        </div>

        {/* وردي اليومي */}
        <Link href="/wird">
          <div className="bg-gradient-to-l from-amber-500/15 to-amber-500/5 border border-amber-500/30 rounded-2xl p-4 mb-6 hover:border-amber-500/60 hover:shadow-sm transition-all cursor-pointer">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-lg">📖</span>
              <span className="font-arabic text-base text-foreground">وردي اليومي</span>
              {todayDone ? (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">✓ أُكمل اليوم</span>
              ) : (
                <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                  {startPage === endPage ? `صفحة ${startPage}` : `الصفحات ${startPage} – ${endPage}`}
                </span>
              )}
              {streak > 0 && (
                <span className="text-xs text-muted-foreground">🔥 {streak} {streak === 1 ? "يوم" : streak === 2 ? "يومين" : "أيام"}</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {todayDone
                ? "أحسنت! ورد الغد بانتظارك"
                : "وردك اليومي بانتظارك — اضغط لتبدأ القراءة"}
            </div>
          </div>
        </Link>

        {/* المصحف — قراءة صفحة صفحة مثل المصحف الورقي */}
        <Link href={`/mushaf/${lastMushafPage}`}>
          <div className="bg-gradient-to-l from-primary/15 to-primary/5 border border-primary/30 rounded-2xl p-4 mb-6 hover:border-primary/60 hover:shadow-sm transition-all cursor-pointer">
            <div className="flex items-center gap-2 mb-1.5">
              <BookOpen className="w-5 h-5 text-primary" />
              <span className="font-arabic text-base text-foreground">المصحف</span>
              <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">٦٠٤ صفحات</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {lastMushafPage > 1
                ? `متابعة القراءة — صفحة ${lastMushafPage}`
                : "اقرأ صفحة صفحة مثل المصحف الورقي"}
            </div>
          </div>
        </Link>

        {/* Resume Listening */}
        {inProgressSurahs.length > 0 && (
          <div className="mb-6 bg-primary/5 border border-primary/20 rounded-2xl p-4">
            <div className="text-sm text-primary font-arabic mb-3 flex items-center gap-2">
              <span>▶</span>
              <span>متابعة الاستماع</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {inProgressSurahs
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .slice(0, 5)
                .map((p) => {
                  const surah = SURAHS.find((s) => s.number === p.surahNumber);
                  if (!surah) return null;
                  const pct = Math.round((p.currentTime / p.duration) * 100);
                  return (
                    <Link key={p.surahNumber} href={`/surah/${p.surahNumber}`}>
                      <div className="bg-card border border-primary/30 rounded-xl px-3 py-2 hover:border-primary/60 transition-colors cursor-pointer min-w-[100px]">
                        <div className="font-arabic text-sm text-primary mb-1">{surah.name}</div>
                        <div className="w-full h-1 bg-muted rounded-full overflow-hidden mb-1">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{formatTime(p.currentTime)}</span>
                          <span>{pct}٪</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
            </div>
          </div>
        )}

        {/* Classification Legend */}
        <div className="bg-card border border-border rounded-2xl mb-6 overflow-hidden">
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="w-4 h-4 text-primary" />
              <span>تصنيف السور المكية والمدنية</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">مكية {meccanCount}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">مدنية {medinanCount}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">مختلف فيها {disputedCount}</span>
              <svg className={`w-4 h-4 text-muted-foreground transition-transform ${showLegend ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {showLegend && (
            <div className="border-t border-border px-4 py-4 text-sm space-y-4 text-right">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 border border-amber-100 dark:border-amber-900">
                  <div className="font-arabic text-base text-amber-700 dark:text-amber-400 mb-1.5">السور المكية ({meccanCount} سورة)</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">نزلت قبل الهجرة النبوية الشريفة. تركز على العقيدة والتوحيد والقصص وأحوال اليوم الآخر.</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-3 border border-emerald-100 dark:border-emerald-900">
                  <div className="font-arabic text-base text-emerald-700 dark:text-emerald-400 mb-1.5">السور المدنية ({medinanCount} سورة)</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">نزلت بعد الهجرة. تتناول التشريعات والأحكام والمعاملات وقضايا المجتمع الإسلامي.</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950/20 rounded-xl p-3 border border-purple-100 dark:border-purple-900">
                  <div className="font-arabic text-base text-purple-700 dark:text-purple-400 mb-1.5">مختلف فيها ({disputedCount} سورة)</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">اختلف العلماء في تصنيفها مكيةً أو مدنية.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="ابحث عن سورة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-card border border-border rounded-xl pr-10 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "meccan", "medinan", "disputed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2.5 rounded-xl text-sm font-sans transition-colors flex-1 sm:flex-none ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border hover:bg-muted text-foreground"
                }`}
              >
                {f === "all" ? "الكل" : f === "meccan" ? "مكية" : f === "medinan" ? "مدنية" : "مختلف فيها"}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-muted-foreground mb-4">{filtered.length} سورة</div>

        {/* Surah Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((surah) => {
            const progress = allProgress[surah.number];
            const pct = progress ? Math.round((progress.currentTime / progress.duration) * 100) : 0;
            const done = isCompleted(surah.number);
            const audioUrl = buildAudioUrl(reciter, surah.number);

            return (
              <div key={surah.number} className="relative group">
                <Link href={`/surah/${surah.number}`}>
                  <div className={`surah-card bg-card border rounded-xl p-4 cursor-pointer hover:shadow-md relative overflow-hidden transition-all ${
                    done
                      ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/10"
                      : "border-border hover:border-primary/50"
                  }`}>
                    {progress && !done && (
                      <div
                        className="absolute bottom-0 left-0 h-0.5 bg-primary/50"
                        style={{ width: `${pct}%` }}
                      />
                    )}
                    {done && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400/60" />
                    )}

                    <div className="flex items-start justify-between mb-2">
                      <span className={`text-xs rounded-full w-6 h-6 flex items-center justify-center font-sans flex-shrink-0 ${
                        done
                          ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "text-muted-foreground bg-muted"
                      }`}>
                        {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : surah.number}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        surah.revelationType === "Meccan"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : surah.revelationType === "Medinan"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                      }`}>
                        {surah.revelationType === "Meccan" ? "مكية" : surah.revelationType === "Medinan" ? "مدنية" : "مختلف فيها"}
                      </span>
                    </div>

                    <div className={`font-arabic text-xl mb-1 text-center transition-colors ${
                      done
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-foreground group-hover:text-primary"
                    }`}>
                      {surah.name}
                    </div>

                    <div className="text-center">
                      {done ? (
                        <div className="text-xs text-emerald-600 dark:text-emerald-400">✓ مكتملة</div>
                      ) : progress ? (
                        <div className="text-xs text-primary">{pct}٪ مكتمل</div>
                      ) : (
                        <div className="text-xs text-muted-foreground">{surah.numberOfAyahs} آية</div>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Download button — floats over bottom-right of card.
                    Always visible: on a touch device there is no hover,
                    so a hover-only button never appears. */}
                <div className="absolute bottom-2 left-2 z-10">
                  <DownloadButton
                    surahNumber={surah.number}
                    surahName={surah.name}
                    reciterId={reciter.id}
                    reciterName={reciter.name}
                    audioUrl={audioUrl}
                    compact
                  />
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <div className="text-4xl mb-3">🔍</div>
            <div>لا توجد نتائج للبحث "{search}"</div>
          </div>
        )}
      </div>

      <footer className="text-center py-6 text-xs text-muted-foreground border-t border-border mt-8">
        <div>رواية قالون عن نافع — القرآن الكريم</div>
        <div className="mt-1 text-muted-foreground/60">مصدر الصوت: موقع القرآن الكريم</div>
      </footer>
    </div>
  );
}
