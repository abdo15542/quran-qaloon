// Stats dashboard (إحصائياتي): everything the app already tracks, in one
// place — khatma progress, surahs in progress, favourites, wird streak,
// mushaf page, and offline downloads. All data is local (localStorage /
// IndexedDB); nothing is invented or estimated.

import { useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Moon, Sun, BookOpen, Headphones, Heart, Flame, WifiOff, CheckCircle2, Download, Upload, ShieldCheck } from "lucide-react";
import { SURAHS } from "@/data/surahs";
import { getLastJamahiriyaPage } from "@/data/jamahiriya";
import { useKhatma } from "@/hooks/useKhatma";
import { useListeningProgress } from "@/hooks/useListeningProgress";
import { useFavourites } from "@/hooks/useFavourites";
import { useWird } from "@/hooks/useWird";
import { useOffline } from "@/context/OfflineContext";
import { exportBackup, importBackup } from "@/lib/backup";

interface StatsPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat("ar-SA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(ts));
}

export default function StatsPage({ darkMode, toggleDarkMode }: StatsPageProps) {
  const { totalCompleted, isKhatmaComplete, startedAt } = useKhatma();
  const { getAllProgress } = useListeningProgress();
  const allProgress = getAllProgress();
  const inProgress = Object.values(allProgress).sort((a, b) => b.updatedAt - a.updatedAt);
  const { count: favouritesCount } = useFavourites();
  const { streak, todayDone, startPage, endPage } = useWird();
  const { cachedItems } = useOffline();
  // [1.0.116] Full-screen reading is مصحف الجماهيرية now — the
  // progress tile tracks its 602 pages, not the old 604 key.
  const lastMushafPage = getLastJamahiriyaPage();

  // نسخة احتياطية: تصدير كل بيانات التطبيق إلى ملف JSON واستعادتها.
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      const r = await exportBackup();
      setBackupStatus(
        r === "shared"
          ? "تم إنشاء النسخة — اختر مكان حفظها من ورقة المشاركة"
          : r === "downloaded"
            ? "تم تنزيل ملف النسخة الاحتياطية"
            : r === "cancelled"
              ? "أُلغي التصدير"
              : "تعذّر إنشاء النسخة — حاول مجددًا",
      );
    } finally {
      setBackupBusy(false);
    }
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file || backupBusy) return;
    setBackupBusy(true);
    try {
      const text = await file.text();
      const count = importBackup(text);
      setBackupStatus(`تمت استعادة ${count} إعدادًا — سيُعاد تحميل التطبيق الآن`);
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      setBackupStatus("هذا الملف ليس نسخة احتياطية صالحة من التطبيق");
    } finally {
      setBackupBusy(false);
    }
  };

  const khatmaPct = Math.round((totalCompleted / 114) * 100);
  const mushafPct = Math.round((lastMushafPage / 602) * 100);

  const tiles = [
    {
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
      label: "سور مكتملة",
      value: toArabicNum(totalCompleted),
      sub: `من ١١٤ سورة`,
    },
    {
      icon: <Headphones className="w-5 h-5 text-primary" />,
      label: "سور قيد الاستماع",
      value: toArabicNum(inProgress.length),
      sub: "متابعة من حيث توقفت",
    },
    {
      icon: <Heart className="w-5 h-5 text-rose-500" />,
      label: "آيات مفضلة",
      value: toArabicNum(favouritesCount),
      sub: "محفوظة في المفضلة",
    },
    {
      icon: <Flame className="w-5 h-5 text-amber-500" />,
      label: "سلسلة الورد",
      value: toArabicNum(streak),
      sub: todayDone ? "أكملت ورد اليوم ✓" : `ورد اليوم: صفحة ${toArabicNum(startPage)}${startPage !== endPage ? ` – ${toArabicNum(endPage)}` : ""}`,
    },
    {
      icon: <BookOpen className="w-5 h-5 text-primary" />,
      label: "المصحف",
      value: `صفحة ${toArabicNum(lastMushafPage)}`,
      sub: `من ٦٠٢ — ${toArabicNum(mushafPct)}٪`,
    },
    {
      icon: <WifiOff className="w-5 h-5 text-emerald-500" />,
      label: "سور محمّلة",
      value: toArabicNum(cachedItems.length),
      sub: "للاستماع دون إنترنت",
    },
  ];

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
            <span className="font-arabic text-lg text-primary">إحصائياتي</span>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Khatma */}
        <div className={`rounded-2xl border overflow-hidden ${
          isKhatmaComplete
            ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20"
            : "border-border bg-card"
        }`}>
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-arabic text-base text-foreground">
                  {isKhatmaComplete ? "تبارك الله! أتممت الختمة" : "ختمة القرآن الكريم"}
                </div>
                <div className="text-xs text-muted-foreground">بدأت بتاريخ {formatDate(startedAt)}</div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${isKhatmaComplete ? "text-emerald-600 dark:text-emerald-400" : "text-primary"}`}>
                  {toArabicNum(totalCompleted)}
                  <span className="text-sm font-normal text-muted-foreground">/١١٤</span>
                </div>
                <div className="text-xs text-muted-foreground">سورة مكتملة</div>
              </div>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isKhatmaComplete ? "bg-emerald-500" : "bg-primary"}`}
                style={{ width: `${khatmaPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
              <span>{toArabicNum(khatmaPct)}٪ مكتمل</span>
              <span>{toArabicNum(114 - totalCompleted)} سورة متبقية</span>
            </div>
          </div>
        </div>

        {/* Tiles */}
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                {t.icon}
                <span className="font-arabic text-sm text-foreground">{t.label}</span>
              </div>
              <div className="text-2xl font-bold text-foreground mb-0.5">{t.value}</div>
              <div className="text-xs text-muted-foreground">{t.sub}</div>
            </div>
          ))}
        </div>

        {/* Recently listened */}
        {inProgress.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-arabic text-base text-foreground mb-3">آخر ما استمعت إليه</div>
            <div className="space-y-2">
              {inProgress.slice(0, 5).map((p) => {
                const surah = SURAHS.find((s) => s.number === p.surahNumber);
                if (!surah) return null;
                const pct = Math.round((p.currentTime / p.duration) * 100);
                return (
                  <Link key={p.surahNumber} href={`/surah/${p.surahNumber}`}>
                    <div className="flex items-center justify-between py-2 border-b border-border last:border-b-0 cursor-pointer hover:text-primary transition-colors">
                      <span className="font-arabic text-sm text-foreground">{surah.name}</span>
                      <span className="text-xs text-muted-foreground">{toArabicNum(pct)}٪ مكتمل</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* نسخة احتياطية */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span className="font-arabic text-base text-foreground">نسخة احتياطية</span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            احفظ المفضلة والتقدم والورد وكل الإعدادات في ملف، واستعدها عند تغيير الهاتف أو إعادة التثبيت. النسخة لا تشمل الصوتيات المحمّلة.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportBackup}
              disabled={backupBusy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              تصدير نسخة
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={backupBusy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm hover:border-primary/40 transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              استعادة نسخة
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                handleImportFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          {backupStatus && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-3">{backupStatus}</p>
          )}
        </div>
      </div>
    </div>
  );
}
