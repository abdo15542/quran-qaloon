import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight, HardDrive, Trash2, BookOpen, Moon, Sun, WifiOff, Download, AlertTriangle, Square, CheckCircle2 } from "lucide-react";
import { useOffline } from "@/context/OfflineContext";
import { SURAHS, RECITERS, buildAudioUrl, getGlobalAyahNumber } from "@/data/surahs";

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
  const { cachedItems, totalStorageBytes, deleteAudio, clearAll, downloadAudio, isCached, getCachedAyahKeys } = useOffline();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  // All cached ayah keys: a surah counts as fully downloaded only when
  // its surah file AND all its ayah files are cached (an interrupted
  // ayah phase used to be skipped as "already downloaded").
  const [ayahKeys, setAyahKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    getCachedAyahKeys().then((keys) => {
      if (!cancelled) setAyahKeys(keys);
    });
    return () => {
      cancelled = true;
    };
  }, [cachedItems, getCachedAyahKeys]);

  const isSurahFullyCached = (surahNumber: number, reciterId: string, keys: Set<string> = ayahKeys): boolean => {
    if (!isCached(surahNumber, reciterId)) return false;
    const surah = SURAHS.find((s) => s.number === surahNumber);
    if (!surah) return false;
    const firstGlobal = getGlobalAyahNumber(surahNumber, 1);
    for (let a = 0; a < surah.numberOfAyahs; a++) {
      if (!keys.has(`ayah-${reciterId}-${firstGlobal + a}`)) return false;
    }
    return true;
  };

  // ---- تحميل المصحف كاملاً دفعة واحدة ----
  const [selectedReciterId, setSelectedReciterId] = useState<string>(() => {
    if (typeof window === "undefined") return "mishary";
    const stored = localStorage.getItem("quran_reciter");
    if (stored && RECITERS.some((r) => r.id === stored)) return stored;
    return "mishary";
  });
  const [bulk, setBulk] = useState<{
    status: "idle" | "running" | "done" | "cancelled";
    done: number;
    total: number;
    failed: number;
    currentSurah: string;
  }>({ status: "idle", done: 0, total: 0, failed: 0, currentSurah: "" });
  const cancelBulkRef = useRef(false);
  // Aborts the downloads in flight too — a flag alone only stops
  // the queue between surahs, while up to 5 fetches would keep
  // downloading (and saving) for minutes after pressing stop.
  const bulkAbortRef = useRef<AbortController | null>(null);

  const selectedReciter =
    RECITERS.find((r) => r.id === selectedReciterId) ??
    RECITERS.find((r) => r.id === "mishary") ??
    RECITERS[0];
  const alreadyCachedForReciter = SURAHS.filter((s) => isSurahFullyCached(s.number, selectedReciter.id)).length;
  const remainingForReciter = SURAHS.length - alreadyCachedForReciter;

  // تحميل متوازٍ بأقصى سرعة: 5 سور في نفس الوقت بدل سورة بعد سورة.
  const BULK_CONCURRENCY = 5;

  const startBulkDownload = async () => {
    setBulkError(null);
    // Not enough free space for a whole-Quran download: refuse to
    // start instead of failing halfway through (a full Quran with its
    // ayah files is several hundred megabytes).
    try {
      const estimate = await navigator.storage?.estimate?.();
      if (estimate && typeof estimate.quota === "number" && typeof estimate.usage === "number") {
        const free = estimate.quota - estimate.usage;
        if (free < 300 * 1024 * 1024) {
          setBulkError("لا توجد مساحة كافية — حرّر مساحة ثم أعد المحاولة");
          return;
        }
      }
    } catch {
      // estimate unavailable — proceed and let the download fail loudly
    }
    // Fresh keys at click time: the state copy can lag a just-finished
    // download, and a stale empty set would re-queue all 114 surahs.
    const freshAyahKeys = await getCachedAyahKeys();
    const pending = SURAHS.filter((s) => !isSurahFullyCached(s.number, selectedReciter.id, freshAyahKeys));
    if (pending.length === 0) {
      setBulk({ status: "done", done: 0, total: 0, failed: 0, currentSurah: "" });
      return;
    }
    cancelBulkRef.current = false;
    bulkAbortRef.current = new AbortController();
    const signal = bulkAbortRef.current.signal;
    let done = 0;
    let failed = 0;
    setBulk({ status: "running", done: 0, total: pending.length, failed: 0, currentSurah: pending[0].name });
    let nextIndex = 0;
    const worker = async () => {
      for (;;) {
        if (cancelBulkRef.current) return;
        const idx = nextIndex++;
        if (idx >= pending.length) return;
        const surah = pending[idx];
        setBulk((prev) => ({ ...prev, currentSurah: surah.name }));
        // downloadAudio reports success directly; do NOT verify via the
        // cached-items state — React state updates lag behind the await and
        // the check always read stale data (it reported 114 failed even
        // though all 114 had actually been saved).
        const ok = await downloadAudio(
          surah.number,
          surah.name,
          selectedReciter.id,
          selectedReciter.name,
          buildAudioUrl(selectedReciter, surah.number),
          signal
        );
        // Stopped while this surah was downloading: do not count the
        // aborted download as a failure.
        if (cancelBulkRef.current) return;
        if (ok) done++;
        else failed++;
        setBulk((prev) => ({ ...prev, done, failed }));
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(BULK_CONCURRENCY, pending.length) }, () => worker())
    );
    setBulk((prev) => ({
      ...prev,
      status: cancelBulkRef.current ? "cancelled" : "done",
      done,
      failed,
      currentSurah: "",
    }));
  };

  const cancelBulkDownload = () => {
    cancelBulkRef.current = true;
    bulkAbortRef.current?.abort();
  };

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

  const STORAGE_WARN_MB = 1000;
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

        {/* تحميل المصحف كاملاً */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-2 text-foreground">
              <Download className="w-4 h-4 text-primary" />
              <span className="font-arabic text-sm">تحميل المصحف كاملاً</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              حمّل كل السور الـ114 دفعة واحدة بصوت القارئ الذي تختاره، لتستمع بدون إنترنت نهائياً.
              التحميل متوازٍ بأقصى سرعة (5 سور في نفس الوقت).
              الحجم الإجمالي كبير: سورة البقرة وحدها نحو 120 ميغابايت بصوت العفاسي، والمصحف كاملاً مع ملفات الآيات قد يصل إلى نحو 800 ميغابايت — يُفضَّل الاتصال بشبكة Wi-Fi وترك التطبيق مفتوحاً حتى يكتمل التحميل.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedReciterId}
                onChange={(e) => setSelectedReciterId(e.target.value)}
                disabled={bulk.status === "running"}
                className="flex-1 bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              >
                {RECITERS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {bulk.status === "running" ? (
                <button
                  onClick={cancelBulkDownload}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm hover:bg-red-600 transition-colors"
                >
                  <Square className="w-4 h-4" />
                  إيقاف التحميل
                </button>
              ) : (
                <button
                  onClick={startBulkDownload}
                  disabled={remainingForReciter === 0}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {remainingForReciter === 0
                    ? "كل السور محفوظة"
                    : `تحميل الكل (${remainingForReciter} سورة)`}
                </button>
              )}
            </div>

            {alreadyCachedForReciter > 0 && bulk.status !== "running" && (
              <div className="text-xs text-muted-foreground">
                محفوظ حالياً بصوت {selectedReciter.name}: {alreadyCachedForReciter} من 114 سورة
              </div>
            )}

            {bulkError && (
              <div className="flex items-center gap-2 text-xs bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 rounded-xl px-3 py-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{bulkError}</span>
              </div>
            )}

            {bulk.status === "running" && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>جارٍ تحميل: {bulk.currentSurah}</span>
                  <span>
                    {bulk.done}/{bulk.total} سورة
                    {bulk.failed > 0 ? ` — تعذّر ${bulk.failed}` : ""}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${bulk.total > 0 ? Math.round((bulk.done / bulk.total) * 100) : 0}%` }}
                  />
                </div>
              </div>
            )}

            {bulk.status === "done" && bulk.total > 0 && (
              <div className="flex items-center gap-2 text-xs bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-xl px-3 py-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>
                  اكتمل التحميل: {bulk.done} سورة جديدة
                  {bulk.failed > 0
                    ? ` — تعذّر تحميل ${bulk.failed} سورة، تحقق من الاتصال ثم اضغط «تحميل الكل» مجدداً لاستكمالها`
                    : " — المصحف كاملاً محفوظ على جهازك"}
                </span>
              </div>
            )}
            {bulk.status === "done" && bulk.total === 0 && (
              <div className="flex items-center gap-2 text-xs bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-xl px-3 py-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>كل السور محفوظة بالفعل بصوت {selectedReciter.name}</span>
              </div>
            )}
            {bulk.status === "cancelled" && (
              <div className="flex items-center gap-2 text-xs bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 rounded-xl px-3 py-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                  أُوقف التحميل بعد {bulk.done} سورة — يمكنك استئنافه لاحقاً، وسيُكمِل من حيث توقف
                </span>
              </div>
            )}
          </div>
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
              <span>الآيات التي تستمع إليها تُحفظ تلقائياً في جهازك، فتعمل دون إنترنت بعدها</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>يمكنك أيضاً الضغط على أيقونة <strong>التحميل</strong> بجانب أي سورة في القائمة الرئيسية</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>السور المحفوظة تعمل بدون إنترنت تماماً — حتى في وضع الطيران</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>من بطاقة «تحميل المصحف كاملاً» أعلاه يمكنك تحميل كل السور الـ114 دفعة واحدة بصوت قارئ واحد</span>
            </li>
          </ul>
        </div>

        {/* Downloaded List */}
        {sorted.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <WifiOff className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <div className="text-base mb-1">لا توجد ملفات محفوظة بعد</div>
            <div className="text-sm">حمّل أي سورة من القائمة الرئيسية لتستمع إليها دون إنترنت</div>
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
