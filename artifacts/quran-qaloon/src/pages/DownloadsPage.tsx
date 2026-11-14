import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, HardDrive, Trash2, BookOpen, Moon, Sun, WifiOff, Download, AlertTriangle } from "lucide-react";
import { useOffline } from "@/context/OfflineContext";
import { SURAHS } from "@/data/surahs";

interface DownloadsPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 بايت";
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميغابايت`;
}

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat("ar-SA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

export default function DownloadsPage({ darkMode, toggleDarkMode }: DownloadsPageProps) {
  const { cachedItems, totalStorageBytes, deleteAudio, clearAll } = useOffline();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const sorted = [...cachedItems].sort((a, b) => b.cachedAt - a.cachedAt);

  const handleDelete = async (surahNumber: number, reciterId: string) => {
    const key = `${surahNumber}-${reciterId}`;
    setDeletingKey(key);
    await deleteAudio(surahNumber, reciterId);
    setDeletingKey(null);
  };

  const handleClearAll = async () => {
    await clearAll();
    setShowClearConfirm(false);
  };

  const STORAGE_WARN_MB = 200;
  const storageMB = totalStorageBytes / (1024 * 1024);
  const storagePercent = Math.min(Math.round((storageMB / STORAGE_WARN_MB) * 100), 100);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <button className="p-2 rounded-full hover:bg-muted transition-colors">
              <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <WifiOff className="w-4 h-4 text-primary" />
            <span className="font-arabic text-lg text-primary">التشغيل بدون إنترنت</span>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Storage Card */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 text-foreground mb-1">
                  <HardDrive className="w-4 h-4 text-primary" />
                  <span className="font-arabic text-sm">مساحة التخزين المستخدمة</span>
                </div>
                <div className="text-2xl font-sans font-bold text-primary">
                  {formatBytes(totalStorageBytes)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {cachedItems.length} ملف صوتي محفوظ
                </div>
              </div>
              {cachedItems.length > 0 && (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف الكل
                </button>
              )}
            </div>

            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  storagePercent > 75 ? "bg-amber-500" : "bg-primary"
                }`}
                style={{ width: `${storagePercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
              <span>{storagePercent}٪ من حد التوصية</span>
              <span>{STORAGE_WARN_MB} ميغابايت موصى به</span>
            </div>
          </div>

          {showClearConfirm && (
            <div className="border-t border-destructive/30 bg-destructive/5 px-5 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>سيتم حذف جميع الملفات المحفوظة</span>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={handleClearAll}
                  className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs hover:opacity-90 transition-opacity"
                >
                  تأكيد الحذف
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3 py-1.5 rounded-lg bg-card border border-border text-xs hover:bg-muted transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl px-5 py-4 text-sm">
          <div className="font-arabic text-primary mb-2 flex items-center gap-2">
            <Download className="w-4 h-4" />
            كيف يعمل التحميل؟
          </div>
          <ul className="text-muted-foreground text-xs space-y-1.5 list-none">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>عند تشغيل سورة وأنت متصل بالإنترنت، يُحفظ الصوت تلقائياً في جهازك</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>يمكنك أيضاً الضغط على أيقونة <strong>التحميل</strong> بجانب أي سورة في القائمة الرئيسية</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>السور المحفوظة تعمل بدون إنترنت تماماً — حتى في وضع الطيران</span>
            </li>
          </ul>
        </div>

        {/* Downloaded List */}
        {sorted.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <WifiOff className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <div className="text-base mb-1">لا توجد ملفات محفوظة بعد</div>
            <div className="text-sm">استمع إلى أي سورة وهي ستُحفظ تلقائياً</div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground px-1 mb-3">الملفات المحفوظة</div>
            {sorted.map((item) => {
              const surah = SURAHS.find((s) => s.number === item.surahNumber);
              const key = item.key;
              const isDeleting = deletingKey === key;

              return (
                <div
                  key={key}
                  className={`bg-card border border-border rounded-xl overflow-hidden transition-all ${
                    isDeleting ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-4 h-4 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-arabic text-sm text-foreground">{item.surahName}</span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          ({surah?.numberOfAyahs} آية)
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.reciterName} — {formatBytes(item.size)}
                      </div>
                      <div className="text-xs text-muted-foreground/60 mt-0.5">
                        {formatDate(item.cachedAt)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link href={`/surah/${item.surahNumber}`}>
                        <button className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                          استمع
                        </button>
                      </Link>
                      <button
                        onClick={() => handleDelete(item.surahNumber, item.reciterId)}
                        disabled={isDeleting}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        title="حذف الملف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
