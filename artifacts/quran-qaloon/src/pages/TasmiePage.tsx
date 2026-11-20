// [1.0.95] التسميع — سمّع القرآن على التطبيق دون إنترنت وبدون ذكاء اصطناعي.
// الفكرة (أمر المستخدم 2026-11-20): أقرأ القرآن على التطبيق، فإن أخطأت في
// كلمة أو آية نبّهني تلقائيًا بصوت عالٍ دون أن يسمّعني الآية، بل يقول لي
// «عاود الآية التي قبلها»؛ وإن قلت «سمّعني الآية» قرأها لي وسجّلها عنده.
// التنفيذ: نص الآية مخفي أثناء المحاولة (لا يُعرض ولا يُسمَّع)، والاستماع من
// خدمة التعرف على الصوت في الهاتف نفسه (@capacitor-community/speech-recognition
// — نفس محرك فاحص التجويد)، والمقارنة على الجهاز بمطابقة الكلمات
// (compareTexts — مسافة ليفنشتاين + محاذاة DP، لا نموذج ذكاء اصطناعي ولا سحابة).
// الخطأ في كلمة واحدة يكفي للتنبيه (ليس النسبة): أي كلمة غير صحيحة أو فائتة.
// التنبيه: نغمة عالية (Web Audio — لا ملف) + اهتزاز + لافتة حمراء، ثم يرجع
// الموضع آية واحدة إلى الوراء (الآية التي قبلها). «سمّعني الآية» تُسمِع الصوت
// (offline-first من ayah-cache) وتكشف النص مؤقتًا، وتسجّل الآية في قائمة
// «آيات طلبتُ تسميعها» المحفوظة محليًا.
import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import {
  Mic,
  MicOff,
  Volume2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  ChevronLeft,
  Trash2,
  BookOpen,
  Play,
  Square,
} from "lucide-react";
import { SURAHS, RECITERS, buildAyahAudioUrl, getGlobalAyahNumber, getRecitersForQirah } from "@/data/surahs";
import { getSurahAyahs, getAyah, displayAyahText } from "@/data/quran-text";
import { getStoredQirahId, getStoredReciterId } from "@/pages/SurahPlayer";
import { useOfflineStorage } from "@/hooks/useOfflineStorage";
import { useSpeechRecognition, compareTexts, stripTashkeel } from "@/hooks/useSpeechRecognition";

const LAST_KEY = "quran_tasmie_last";
const HELPED_KEY = "quran_tasmie_helped";
// أي كلمة غير مطابقة أو فائتة = خطأ يستحق التنبيه (أمر المستخدم: «كلمة أو آية»).
const HELP_COMMANDS = ["سمعني", "سمي لي", "سمع لي"];

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

interface HelpedAyah {
  s: number;
  a: number;
  t: number;
}

function loadLast(): { s: number; a: number } {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { s: number; a: number };
      if (p.s >= 1 && p.s <= 114 && p.a >= 1) return p;
    }
  } catch {
    // ignore
  }
  return { s: 1, a: 1 };
}

function loadHelped(): HelpedAyah[] {
  try {
    const raw = localStorage.getItem(HELPED_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as HelpedAyah[];
      if (Array.isArray(arr)) return arr.filter((x) => x && x.s >= 1 && x.s <= 114 && x.a >= 1);
    }
  } catch {
    // ignore
  }
  return [];
}

export default function TasmiePage({ darkMode, toggleDarkMode }: { darkMode: boolean; toggleDarkMode: () => void }) {
  const [surah, setSurah] = useState<number>(() => loadLast().s);
  const [startAyah, setStartAyah] = useState<number>(() => loadLast().a);
  const [started, setStarted] = useState(false);
  const [ayah, setAyah] = useState<number>(() => loadLast().a);
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"ok" | "error" | "info">("info");
  const [lastHeard, setLastHeard] = useState("");
  const [wrongCount, setWrongCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [helpedCount, setHelpedCount] = useState(0);
  const [helped, setHelped] = useState<HelpedAyah[]>(() => loadHelped());
  const [playingHelp, setPlayingHelp] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const { state, start, stop, reset } = useSpeechRecognition();
  const { getCachedAyahUrl, cacheAyahAudio } = useOfflineStorage();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevListening = useRef(false);
  const prevTranscript = useRef("");
  const ayahRef = useRef(ayah);
  const surahRef = useRef(surah);
  const startedRef = useRef(started);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    ayahRef.current = ayah;
  }, [ayah]);
  useEffect(() => {
    surahRef.current = surah;
  }, [surah]);
  useEffect(() => {
    startedRef.current = started;
  }, [started]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (audioRef.current) audioRef.current.pause();
      if (audioCtxRef.current) void audioCtxRef.current.close().catch(() => undefined);
    };
  }, []);

  const saveLast = useCallback((s: number, a: number) => {
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify({ s, a }));
    } catch {
      // ignore
    }
  }, []);

  // النغمة العالية: تُنشأ من أول ضغطة ميكروفون (إيماءة المستخدم) حتى لا
  // يبدأ AudioContext موقوفًا في WebView عند التنبيه اللاحق.
  const ensureAudioCtx = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) audioCtxRef.current = new Ctx();
      }
      if (audioCtxRef.current?.state === "suspended") {
        void audioCtxRef.current.resume().catch(() => undefined);
      }
    } catch {
      // ignore — يبقى التنبيه المرئي والاهتزاز
    }
  }, []);

  const playAlertSound = useCallback(() => {
    ensureAudioCtx();
    const ctx = audioCtxRef.current;
    if (ctx) {
      try {
        const now = ctx.currentTime + 0.02;
        [0, 0.38, 0.76].forEach((t) => {
          [880, 659].forEach((f, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sine";
            o.frequency.value = f;
            o.connect(g);
            g.connect(ctx.destination);
            const start = now + t + i * 0.17;
            g.gain.setValueAtTime(0.0001, start);
            g.gain.exponentialRampToValueAtTime(0.5, start + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
            o.start(start);
            o.stop(start + 0.16);
          });
        });
      } catch {
        // ignore
      }
    }
    try {
      navigator.vibrate?.([300, 150, 300, 150, 600]);
    } catch {
      // ignore
    }
  }, [ensureAudioCtx]);

  const getCurrentReciter = useCallback(() => {
    const qirahId = getStoredQirahId();
    const reciterId = getStoredReciterId(qirahId);
    const reciters = getRecitersForQirah(qirahId);
    return reciters.find((r) => r.id === reciterId) ?? reciters[0] ?? RECITERS[0];
  }, []);

  const moveTo = useCallback(
    (s: number, a: number) => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      const total = getSurahAyahs(s).length;
      const next = Math.min(Math.max(a, 1), total);
      setAyah(next);
      setRevealed(false);
      setStatus(null);
      setLastHeard("");
      setAudioError(null);
      saveLast(s, next);
    },
    [saveLast]
  );

  const advance = useCallback(() => {
    const s = surahRef.current;
    const a = ayahRef.current;
    const total = getSurahAyahs(s).length;
    if (a < total) {
      moveTo(s, a + 1);
    } else if (s < 114) {
      setSurah(s + 1);
      moveTo(s + 1, 1);
    } else {
      setStatus("أتممتَ تسميع المصحف كاملاً — تبارك الله!");
      setStatusKind("ok");
    }
  }, [moveTo]);

  // «سمّعني الآية»: يُسمِع الصوت (offline أولاً) ويكشف النص مؤقتًا،
  // ويسجّل الآية في قائمة «آيات طلبتُ تسميعها».
  const playHelpAyah = useCallback(async () => {
    const s = surahRef.current;
    const a = ayahRef.current;
    if (state.isListening) stop();
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    setAudioError(null);
    setRevealed(true);
    setPlayingHelp(true);
    setStatus("أستمع إلى الآية — ثم أعدها من حفظك");
    setStatusKind("info");
    setHelped((prev) => {
      const next = [{ s, a, t: Date.now() }, ...prev.filter((x) => !(x.s === s && x.a === a))].slice(0, 100);
      try {
        localStorage.setItem(HELPED_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setHelpedCount((c) => c + 1);

    const audio = audioRef.current;
    if (!audio) {
      setPlayingHelp(false);
      return;
    }
    const reciter = getCurrentReciter();
    const perAyahUrl = buildAyahAudioUrl(reciter, s, a);
    if (!perAyahUrl) {
      setAudioError("لا يوجد صوت متاح لهذه الآية");
      setPlayingHelp(false);
      return;
    }
    const globalAyah = getGlobalAyahNumber(s, a);
    const cachedUrl = await getCachedAyahUrl(reciter.id, globalAyah);
    audio.src = cachedUrl ?? perAyahUrl;
    try {
      await audio.play();
    } catch {
      setAudioError(
        !cachedUrl && !navigator.onLine
          ? "هذه الآية غير محمّلة — حمّل السورة أولاً من صفحة التحميلات"
          : "تعذّر تشغيل صوت الآية"
      );
      setPlayingHelp(false);
      return;
    }
    if (!cachedUrl) void cacheAyahAudio(reciter.id, globalAyah, perAyahUrl);
  }, [state.isListening, stop, getCurrentReciter, getCachedAyahUrl, cacheAyahAudio]);

  // عند انتهاء صوت المساعدة: أخفِ النص مجددًا واطلب إعادتها من الحفظ.
  const onHelpAudioEnded = useCallback(() => {
    setPlayingHelp(false);
    setRevealed(false);
    setStatus("الآن أعدها من حفظك — اضغط الميكروفون");
    setStatusKind("info");
  }, []);

  const handleMic = useCallback(() => {
    if (!startedRef.current) return;
    ensureAudioCtx();
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    if (state.isListening) {
      stop();
    } else {
      setStatus(null);
      setLastHeard("");
      reset();
      setTimeout(() => start(), 250);
    }
  }, [state.isListening, stop, reset, start, ensureAudioCtx]);

  // تقييم المحاولة عند توقف الاستماع: أي كلمة خاطئة أو فائتة = تنبيه.
  useEffect(() => {
    const justStopped = prevListening.current && !state.isListening;
    const hasTranscript = state.transcript.trim().length > 0;
    const transcriptChanged = state.transcript !== prevTranscript.current;
    if (!justStopped || !hasTranscript || !transcriptChanged || !startedRef.current) {
      prevListening.current = state.isListening;
      prevTranscript.current = state.transcript;
      return;
    }
    const heard = state.transcript.trim();
    setLastHeard(heard);
    const norm = stripTashkeel(heard);
    // أمر صوتي: «سمّعني الآية» — يُسمِعها ويسجّلها، ولا تُحسب محاولة.
    if (HELP_COMMANDS.some((c) => norm.startsWith(stripTashkeel(c)))) {
      prevListening.current = state.isListening;
      prevTranscript.current = state.transcript;
      void playHelpAyah();
      return;
    }
    const current = getAyah(surahRef.current, ayahRef.current);
    if (!current) {
      prevListening.current = state.isListening;
      prevTranscript.current = state.transcript;
      return;
    }
    const compared = compareTexts(current.text, heard);
    const wrong = compared.words.filter((w) => !w.correct);
    if (wrong.length === 0) {
      setCorrectCount((c) => c + 1);
      setStatus("أحسنت — الآية صحيحة");
      setStatusKind("ok");
      advanceTimerRef.current = setTimeout(() => advance(), 1600);
    } else {
      // خطأ: تنبيه عالٍ دون تسميع الآية، ثم الرجوع آية واحدة إلى الوراء.
      setWrongCount((c) => c + 1);
      playAlertSound();
      setStatus("عاود الآية التي قبلها");
      setStatusKind("error");
      const back = Math.max(1, ayahRef.current - 1);
      advanceTimerRef.current = setTimeout(() => moveTo(surahRef.current, back), 2600);
    }
    prevListening.current = state.isListening;
    prevTranscript.current = state.transcript;
  }, [state.isListening, state.transcript, playAlertSound, playHelpAyah, advance, moveTo]);

  useEffect(() => {
    prevListening.current = state.isListening;
  }, [state.isListening]);

  const startSession = useCallback(() => {
    const total = getSurahAyahs(surah).length;
    const a = Math.min(Math.max(startAyah, 1), total);
    setAyah(a);
    setRevealed(false);
    setStatus(null);
    setLastHeard("");
    setWrongCount(0);
    setCorrectCount(0);
    setHelpedCount(0);
    setAudioError(null);
    saveLast(surah, a);
    setStarted(true);
  }, [surah, startAyah, saveLast]);

  const resetSession = useCallback(() => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    if (state.isListening) stop();
    reset();
    setStarted(false);
    setRevealed(false);
    setStatus(null);
    setLastHeard("");
    setPlayingHelp(false);
    setAudioError(null);
    if (audioRef.current) audioRef.current.pause();
  }, [state.isListening, stop, reset]);

  const clearHelped = useCallback(() => {
    setHelped([]);
    try {
      localStorage.removeItem(HELPED_KEY);
    } catch {
      // ignore
    }
  }, []);

  const surahInfo = SURAHS.find((s) => s.number === surah);
  const totalAyahs = surahInfo ? surahInfo.numberOfAyahs : 0;
  const currentAyah = started ? getAyah(surah, ayah) : null;

  if (!state.isSupported) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="p-6 text-center text-muted-foreground">
          <MicOff className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <div className="text-sm">
            التسميع الصوتي غير مدعوم على هذا الجهاز.
            <br />
            <span className="text-xs">تأكد من تثبيت خدمة التعرف على الصوت من Google ومنح إذن الميكروفون</span>
          </div>
          <Link href="/">
            <span className="inline-block mt-4 text-sm text-primary cursor-pointer">← العودة إلى الرئيسية</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <audio ref={audioRef} onEnded={onHelpAudioEnded} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link href="/">
            <button className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground" title="رجوع">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <div className="font-bold text-lg text-foreground leading-tight">التسميع</div>
            <div className="text-[11px] text-muted-foreground leading-tight">سمّع القرآن — ينبّهك عند الخطأ دون أن يسمّعك الآية</div>
          </div>
        </div>
        {started && (
          <button
            onClick={resetSession}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            جلسة جديدة
          </button>
        )}
      </div>

      {!started ? (
        <div className="space-y-4">
          <div className="card-modern p-5 space-y-4">
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">السورة</label>
              <select
                value={surah}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setSurah(n);
                  setStartAyah(1);
                }}
                className="w-full bg-card border border-border rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {SURAHS.map((s) => (
                  <option key={s.number} value={s.number}>
                    {s.number} — {s.name} ({toArabicNum(s.numberOfAyahs)} آية)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">ابدأ من الآية</label>
              <input
                type="number"
                min={1}
                max={totalAyahs}
                value={startAyah}
                onChange={(e) => setStartAyah(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-card border border-border rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <div className="text-xs text-muted-foreground mt-1">السورة {toArabicNum(totalAyahs)} آية</div>
            </div>
            <button
              onClick={startSession}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-3.5 font-bold active:scale-[0.99] transition-all"
            >
              <Play className="w-5 h-5" />
              ابدأ التسميع
            </button>
          </div>

          <div className="card-modern p-5 text-sm text-muted-foreground leading-relaxed space-y-1.5">
            <div className="font-bold text-foreground">كيف يعمل؟</div>
            <div>• اقرأ الآية من حفظك — نصها مخفي أثناء المحاولة.</div>
            <div>• إن أخطأت في كلمة أو آية، ينبّهك بصوت عالٍ واهتزاز دون أن يسمّعك الآية، ويقول لك: «عاود الآية التي قبلها».</div>
            <div>• إن أردت سماع الآية، قل «سمّعني الآية» أو اضغط زرها — تُسمَع لك وتُسجَّل في قائمتك.</div>
            <div>• يعمل دون إنترنت وبدون ذكاء اصطناعي: النص محفوظ في التطبيق، والاستماع من خدمة التعرف على الصوت في هاتفك، والمقارنة تتم على الجهاز. إن لم يعمل الاستماع دون إنترنت، ثبّت حزمة اللغة العربية للتعرف على الصوت دون اتصال في إعدادات الهاتف.</div>
          </div>

          {helped.length > 0 && (
            <div className="card-modern p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-foreground">آيات طلبتُ تسميعها ({toArabicNum(helped.length)})</div>
                <button onClick={clearHelped} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                  مسح القائمة
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {helped.map((h, i) => {
                  const sn = SURAHS.find((s) => s.number === h.s)?.name ?? "";
                  return (
                    <Link key={`${h.s}:${h.a}:${i}`} href={`/surah/${h.s}?ayah=${h.a}`}>
                      <span className="inline-block text-xs bg-muted px-2.5 py-1.5 rounded-full cursor-pointer hover:bg-primary/10">
                        {sn} — الآية {toArabicNum(h.a)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Progress */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              سورة {surahInfo?.name} — الآية {toArabicNum(ayah)} من {toArabicNum(totalAyahs)}
            </span>
            <span>
              ✓ {toArabicNum(correctCount)} • ✗ {toArabicNum(wrongCount)} • سُمّعت {toArabicNum(helpedCount)}
            </span>
          </div>

          {/* Current ayah — hidden while attempting */}
          <div className="card-modern p-6 text-center">
            {revealed && currentAyah ? (
              <div className="space-y-2">
                <div className="quran-text text-foreground" dir="rtl" style={{ fontSize: "1.7rem", lineHeight: 2 }}>
                  {displayAyahText(surah, ayah, currentAyah.text)} ﴿{toArabicNum(ayah)}﴾
                </div>
                <button
                  onClick={() => setRevealed(false)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  إخفاء الآية
                </button>
              </div>
            ) : (
              <div className="py-6 space-y-2">
                <EyeOff className="w-8 h-8 mx-auto text-muted-foreground/40" />
                <div className="font-arabic text-foreground">الآية {toArabicNum(ayah)} مخفية — اقرأها من حفظك</div>
                <div className="text-xs text-muted-foreground">لن تُعرض ولن تُسمَّع إلا إن طلبتَ ذلك</div>
              </div>
            )}
          </div>

          {/* Status banner */}
          {status && (
            <div
              data-testid="tasmie-status"
              className={`rounded-3xl p-4 text-center font-bold animate-fade-up ${
                statusKind === "error"
                  ? "bg-red-500 text-white text-lg shadow-lg shadow-red-500/30"
                  : statusKind === "ok"
                  ? "bg-emerald-500 text-white"
                  : "bg-primary/10 text-foreground"
              }`}
            >
              {statusKind === "error" && <AlertTriangle className="w-6 h-6 inline-block ml-2" />}
              {statusKind === "ok" && <CheckCircle2 className="w-5 h-5 inline-block ml-2" />}
              {status}
            </div>
          )}
          {statusKind === "error" && (
            <button
              data-testid="tasmie-dismiss-error"
              onClick={() => {
                if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
                setStatus(null);
                advance();
              }}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              الآية كانت صحيحة — تجاهل التنبيه وتابع
            </button>
          )}

          {/* Live transcript */}
          {(state.isListening || lastHeard) && (
            <div className="card-modern p-4">
              <div className="text-xs text-muted-foreground mb-1">
                {state.isListening ? "جارٍ الاستماع... ما يُسمع الآن:" : "ما نُطق:"}
              </div>
              <div className="text-right leading-relaxed" dir="rtl">
                {state.isListening ? state.interimTranscript || state.transcript || "…" : lastHeard}
              </div>
            </div>
          )}

          {state.error && (
            <div className="px-4 py-3 bg-destructive/10 text-destructive text-sm rounded-2xl">{state.error}</div>
          )}
          {audioError && (
            <div className="px-4 py-3 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm rounded-2xl">{audioError}</div>
          )}

          {/* Controls */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleMic}
              data-testid="tasmie-mic"
              className={`w-full flex items-center justify-center gap-2 rounded-2xl py-4 font-bold text-lg active:scale-[0.99] transition-all ${
                state.isListening
                  ? "bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {state.isListening ? (
                <>
                  <Square className="w-5 h-5" />
                  إيقاف — انتهيت من الآية
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  اضغط واقرأ الآية {toArabicNum(ayah)}
                </>
              )}
            </button>
            <button
              onClick={() => void playHelpAyah()}
              disabled={playingHelp}
              data-testid="tasmie-play-help"
              className="w-full flex items-center justify-center gap-2 bg-amber-500/15 border border-amber-500/40 text-foreground rounded-2xl py-3.5 font-bold active:scale-[0.99] transition-all disabled:opacity-50"
            >
              <Volume2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              {playingHelp ? "جارٍ تسميع الآية..." : "سمّعني الآية"}
            </button>
            <div className="text-center text-xs text-muted-foreground">
              أو قل «سمّعني الآية» أثناء الاستماع — تُسمَع لك وتُسجَّل في قائمتك
            </div>
          </div>

          {/* Helped list (session) */}
          {helped.length > 0 && (
            <div className="card-modern p-4">
              <div className="text-sm font-bold text-foreground mb-2">
                آيات طلبتُ تسميعها ({toArabicNum(helped.length)})
              </div>
              <div className="flex flex-wrap gap-2">
                {helped.slice(0, 12).map((h, i) => {
                  const sn = SURAHS.find((s) => s.number === h.s)?.name ?? "";
                  return (
                    <span key={`${h.s}:${h.a}:${i}`} className="text-xs bg-muted px-2.5 py-1.5 rounded-full">
                      {sn} — الآية {toArabicNum(h.a)}
                    </span>
                  );
                })}
                {helped.length > 12 && (
                  <span className="text-xs text-muted-foreground px-2 py-1.5">و{toArabicNum(helped.length - 12)} أخرى...</span>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span>
              يعمل دون إنترنت وبدون ذكاء اصطناعي — النص محفوظ في التطبيق، والاستماع من هاتفك، والمقارنة على الجهاز.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
