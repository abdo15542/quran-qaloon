import { useState, useEffect, useCallback } from "react";
import { ArrowRight, BookOpen, Loader2, Moon, Sun, FileText, Mic, CheckCircle2, WifiOff, ALargeSmall } from "lucide-react";
import { Link, useLocation } from "wouter";
import { SURAHS, QIRAAT, RECITERS, getRecitersForQirah, buildAudioUrl } from "@/data/surahs";
import { getSurahAyahs } from "@/data/quran-text";
import AudioPlayer from "@/components/AudioPlayer";
import TajweedChecker from "@/components/TajweedChecker";
import DownloadButton from "@/components/DownloadButton";
import { useListeningProgress } from "@/hooks/useListeningProgress";
import { useKhatma } from "@/hooks/useKhatma";
import { useOffline } from "@/context/OfflineContext";

interface Ayah {
  number: number;
  numberInSurah: number;
  text: string;
}

interface SurahPlayerProps {
  surahNumber: number;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

function getStoredQirahId(): string {
  return localStorage.getItem("quran_qirah") ?? "qaloon";
}

function getStoredReciterId(qirahId: string): string {
  const stored = localStorage.getItem("quran_reciter");
  if (stored) {
    const reciter = RECITERS.find((r) => r.id === stored && r.qirahId === qirahId);
    if (reciter) return stored;
  }
  return getRecitersForQirah(qirahId)[0]?.id ?? "qaloon-nafi";
}

export default function SurahPlayer({
  surahNumber,
  darkMode,
  toggleDarkMode,
}: SurahPlayerProps) {
  const [, navigate] = useLocation();
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rightMode, setRightMode] = useState<"text" | "recite">("text");
  const [justCompleted, setJustCompleted] = useState(false);
  const [fontSize, setFontSize] = useState<number>(() => {
    const stored = localStorage.getItem("quran_font_size");
    return stored ? Number(stored) : 22;
  });

  const [selectedQirahId, setSelectedQirahId] = useState<string>(getStoredQirahId);
  const [selectedReciterId, setSelectedReciterId] = useState<string>(() =>
    getStoredReciterId(getStoredQirahId())
  );
  const [effectiveAudioUrl, setEffectiveAudioUrl] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const { getProgress, saveProgress, clearProgress } = useListeningProgress();
  const { isCompleted, markCompleted, markUncompleted } = useKhatma();
  const { isCached, getCachedBlobUrl } = useOffline();

  useEffect(() => {
    document.documentElement.style.setProperty("--quran-font-size", `${fontSize}px`);
    localStorage.setItem("quran_font_size", String(fontSize));
  }, [fontSize]);

  const increaseFontSize = () => setFontSize((s) => Math.min(s + 2, 36));
  const decreaseFontSize = () => setFontSize((s) => Math.max(s - 2, 14));

  const surah = SURAHS.find((s) => s.number === surahNumber);
  const prevSurah = SURAHS.find((s) => s.number === surahNumber - 1);
  const nextSurah = SURAHS.find((s) => s.number === surahNumber + 1);

  const currentQirah = QIRAAT.find((q) => q.id === selectedQirahId) ?? QIRAAT[0];
  const recitersForQirah = getRecitersForQirah(selectedQirahId);
  const currentReciter =
    recitersForQirah.find((r) => r.id === selectedReciterId) ?? recitersForQirah[0];

  const networkAudioUrl = currentReciter ? buildAudioUrl(currentReciter, surahNumber) : null;
  const audioUrl = networkAudioUrl;

  const savedProgress = getProgress(surahNumber);
  const initialTime = savedProgress?.currentTime ?? 0;
  const surahCompleted = isCompleted(surahNumber);

  useEffect(() => {
    if (!networkAudioUrl || !currentReciter) {
      setEffectiveAudioUrl(networkAudioUrl);
      setIsOffline(false);
      return;
    }
    getCachedBlobUrl(surahNumber, currentReciter.id).then((blobUrl) => {
      if (blobUrl) {
        setEffectiveAudioUrl(blobUrl);
        setIsOffline(true);
      } else {
        setEffectiveAudioUrl(networkAudioUrl);
        setIsOffline(false);
      }
    });
  }, [surahNumber, currentReciter?.id, networkAudioUrl, getCachedBlobUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleQirahChange = (qirahId: string) => {
    setSelectedQirahId(qirahId);
    localStorage.setItem("quran_qirah", qirahId);
    const firstReciter = getRecitersForQirah(qirahId)[0];
    if (firstReciter) {
      setSelectedReciterId(firstReciter.id);
      localStorage.setItem("quran_reciter", firstReciter.id);
    }
  };

  const handleReciterChange = (reciterId: string) => {
    setSelectedReciterId(reciterId);
    localStorage.setItem("quran_reciter", reciterId);
  };

  const handleProgress = useCallback(
    (currentTime: number, duration: number) => {
      saveProgress(surahNumber, currentTime, duration);
    },
    [surahNumber, saveProgress]
  );

  const handleFinished = useCallback(() => {
    clearProgress(surahNumber);
    markCompleted(surahNumber);
    setJustCompleted(true);
    setTimeout(() => setJustCompleted(false), 4000);
  }, [surahNumber, clearProgress, markCompleted]);

  // Offline: the full Uthmani text is bundled in src/data/quran-text.ts —
  // no network is needed to read a surah. Only audio is streamed/downloaded.
  useEffect(() => {
    if (!surah) return;
    setJustCompleted(false);
    const local = getSurahAyahs(surahNumber);
    if (local.length > 0) {
      setAyahs(local);
      setError(null);
    } else {
      setAyahs([]);
      setError("تعذّر تحميل نص السورة");
    }
    setLoading(false);
  }, [surahNumber, surah]);

  if (!surah) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-6xl mb-4">📖</div>
          <div className="text-xl mb-4">السورة غير موجودة</div>
          <Link href="/">
            <button className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl">
              العودة للقائمة
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {justCompleted && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2 animate-bounce-once font-arabic text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          تبارك الله! أتممت سورة {surah.name} ✨
        </div>
      )}

      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <button className="p-2 rounded-full hover:bg-muted transition-colors">
              <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <BookOpen className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="font-arabic text-lg text-primary truncate">{surah.name}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">({surah.numberOfAyahs} آية)</span>
            {surahCompleted && (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setRightMode("text")}
              className={`p-2 rounded-full transition-colors ${
                rightMode === "text" ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"
              }`}
              title="نص السورة"
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              onClick={() => setRightMode("recite")}
              className={`p-2 rounded-full transition-colors ${
                rightMode === "recite" ? "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400" : "hover:bg-muted text-muted-foreground"
              }`}
              title="التسميع الصوتي"
            >
              <Mic className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-0.5 bg-muted rounded-lg px-1" title="حجم الخط">
              <button
                onClick={decreaseFontSize}
                disabled={fontSize <= 14}
                className="p-1 rounded hover:bg-background transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="تصغير الخط"
              >
                <ALargeSmall className="w-3.5 h-3.5 scale-75" />
              </button>
              <span className="text-xs text-muted-foreground w-6 text-center tabular-nums">{fontSize}</span>
              <button
                onClick={increaseFontSize}
                disabled={fontSize >= 36}
                className="p-1 rounded hover:bg-background transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="تكبير الخط"
              >
                <ALargeSmall className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="md:col-span-2">
            <div className="md:sticky md:top-20 space-y-4">
              {effectiveAudioUrl && (
                <div className="relative">
                  {isOffline && (
                    <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-emerald-600/90 text-white text-xs px-2 py-0.5 rounded-full">
                      <WifiOff className="w-3 h-3" />
                      <span>وضع أوفلاين</span>
                    </div>
                  )}
                  <AudioPlayer
                    surahNumber={surahNumber}
                    surahName={surah.name}
                    reciterName={currentReciter?.name ?? currentQirah.name}
                    audioUrl={effectiveAudioUrl}
                    initialTime={initialTime}
                    onProgress={handleProgress}
                    onFinished={handleFinished}
                    onPrevious={prevSurah ? () => navigate(`/surah/${surahNumber - 1}`) : undefined}
                    onNext={nextSurah ? () => navigate(`/surah/${surahNumber + 1}`) : undefined}
                    hasPrevious={!!prevSurah}
                    hasNext={!!nextSurah}
                  />
                </div>
              )}

              {networkAudioUrl && currentReciter && (
                <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {isCached(surahNumber, currentReciter.id) ? (
                      <>
                        <WifiOff className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400">محفوظ للاستماع بدون إنترنت</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3.5 h-3.5 opacity-40" />
                        <span>للاستماع بدون إنترنت</span>
                      </>
                    )}
                  </div>
                  <DownloadButton
                    surahNumber={surahNumber}
                    surahName={surah.name}
                    reciterId={currentReciter.id}
                    reciterName={currentReciter.name}
                    audioUrl={networkAudioUrl}
                  />
                </div>
              )}

              <div className="bg-card border border-border rounded-2xl p-4 text-sm space-y-3">
                <div className="text-xs text-muted-foreground">اختيار القراءة والقارئ</div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">القراءة</label>
                  <select
                    value={selectedQirahId}
                    onChange={(e) => handleQirahChange(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {QIRAAT.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">القارئ</label>
                  <select
                    value={selectedReciterId}
                    onChange={(e) => handleReciterChange(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    disabled={recitersForQirah.length <= 1}
                  >
                    {recitersForQirah.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-4 text-sm space-y-2">
                <div className="text-xs text-muted-foreground mb-1">معلومات السورة</div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">رقم السورة</span>
                  <span className="font-sans">{surah.number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">عدد الآيات</span>
                  <span className="font-sans">{surah.numberOfAyahs}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">نوع السورة</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    surah.revelationType === "Meccan"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : surah.revelationType === "Medinan"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                  }`}>
                    {surah.revelationType === "Meccan" ? "مكية" : surah.revelationType === "Medinan" ? "مدنية" : "مختلف فيها"}
                  </span>
                </div>
                {savedProgress && (
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="text-muted-foreground">آخر موضع</span>
                    <span className="text-xs text-primary">
                      {Math.round((savedProgress.currentTime / savedProgress.duration) * 100)}٪ مكتمل
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-border">
                  <span className="text-muted-foreground">الختمة</span>
                  <button
                    onClick={() =>
                      surahCompleted ? markUncompleted(surahNumber) : markCompleted(surahNumber)
                    }
                    className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                      surahCompleted
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {surahCompleted ? "✓ مكتملة" : "لم تُكتمل"}
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                {prevSurah && (
                  <Link href={`/surah/${prevSurah.number}`} className="flex-1">
                    <button className="w-full bg-card border border-border rounded-xl py-2.5 px-3 text-sm hover:border-primary/50 transition-colors text-right">
                      <div className="text-xs text-muted-foreground">السابقة</div>
                      <div className="font-arabic">{prevSurah.name}</div>
                    </button>
                  </Link>
                )}
                {nextSurah && (
                  <Link href={`/surah/${nextSurah.number}`} className="flex-1">
                    <button className="w-full bg-card border border-border rounded-xl py-2.5 px-3 text-sm hover:border-primary/50 transition-colors text-left">
                      <div className="text-xs text-muted-foreground">التالية</div>
                      <div className="font-arabic">{nextSurah.name}</div>
                    </button>
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="md:col-span-3">
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex border-b border-border">
                <button
                  onClick={() => setRightMode("text")}
                  className={`flex-1 py-2.5 text-sm flex items-center justify-center gap-1.5 transition-colors ${
                    rightMode === "text"
                      ? "bg-primary/5 text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  نص السورة
                </button>
                <button
                  onClick={() => setRightMode("recite")}
                  className={`flex-1 py-2.5 text-sm flex items-center justify-center gap-1.5 transition-colors ${
                    rightMode === "recite"
                      ? "bg-red-50 text-red-600 border-b-2 border-red-500 dark:bg-red-900/10 dark:text-red-400"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  التسميع الصوتي
                </button>
              </div>

              {rightMode === "text" ? (
                <>
                  {surah.number !== 9 && (
                    <div className="text-center py-5 border-b border-border bg-primary/5">
                      <div className="bismillah-text text-2xl sm:text-3xl text-primary">
                        بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                      </div>
                    </div>
                  )}

                  {loading && (
                    <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-sm">جارٍ تحميل السورة...</span>
                    </div>
                  )}

                  {error && (
                    <div className="py-12 text-center text-muted-foreground">
                      <div className="text-3xl mb-3">⚠️</div>
                      <div className="text-sm">{error}</div>
                    </div>
                  )}

                  {!loading && !error && ayahs.length > 0 && (
                    <div className="p-6">
                      <div className="quran-text text-right leading-loose" style={{ fontSize: `${fontSize}px` }} dir="rtl">
                        {ayahs.map((ayah) => (
                          <span key={ayah.number}>
                            {ayah.text}{" "}
                            <span className="text-primary inline-block mx-1 text-base">
                              ﴿{toArabicNum(ayah.numberInSurah)}﴾
                            </span>{" "}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {loading ? (
                    <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-sm">جارٍ تحميل آيات السورة...</span>
                    </div>
                  ) : error ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <div className="text-3xl mb-3">⚠️</div>
                      <div className="text-sm">{error}</div>
                    </div>
                  ) : ayahs.length > 0 ? (
                    <TajweedChecker ayahs={ayahs} surahName={surah.name} fontSize={fontSize} />
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
