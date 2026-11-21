// [1.0.98] دقة التسميع وسماع الصوت الضعيف، والقراءة برواية قالون.
// ما كان خاطئًا في 1.0.97 (ثبّته فيديو اختبار المستخدم): تنبيهات
// «خطأ في كلمة» على تلاوة صحيحة لآية النصر 3 — سببها علامات وقف
// شبحية (ۚ ۖ …) في النص المرجعي تُقرأ كلمة لا تطابق شيئًا أبدًا،
// والفحص الحي كان يحكم على فرضيات جزئية غير مستقرة. والصوت الضعيف
// كان يوقف الاستماع ويطلب ضغطة للمتابعة.
// الجديد: تُسقط علامات الوقف من المقارنة؛ الفحص الحي يُطلق التنبيه
// فورًا على الآية المنسية فقط، وخطأ الكلمة يُحكم عليه عند نهاية
// المقطع؛ الاستماع لا يتوقف أبدًا للصمت — يستأنف تلقائيًا؛ وفحص
// على مستوى الحرف: حرف واحد منسي أو خاطئ (و/ا/ل) يوقف التسميع،
// مع إغفار تشويش التعرف المعروف فقط (حروف مدّ، تنوين ه/ا، ألف
// خنجرية في مواضعها المعروفة، و«الرحمن» بلا ألف).
// [1.0.98 قالون] المقارنة الآن بنص قالون عن نافع (الافتراضي، من
// quran-text-qaloon.ts — نفس ترقيم الآيات 6236)، مع اختيار حفص
// من الإعداد. «ملك» في 1:4 صحيحة في قالون، و«مالك» تُوقف. صوت
// «سمّعني الآية» يبقى حفصًا (القراء السبعة) — لا صوت قالون
// للآية الواحدة بعد. دون إنترنت وبدون ذكاء اصطناعي.
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
  Pause,
} from "lucide-react";
import { SURAHS, RECITERS, buildAyahAudioUrl, getGlobalAyahNumber, getRecitersForQirah } from "@/data/surahs";
import { getSurahAyahs, getAyah, displayAyahText } from "@/data/quran-text";
import { getStoredQirahId, getStoredReciterId } from "@/pages/SurahPlayer";
import { useOfflineStorage } from "@/hooks/useOfflineStorage";
import {
  useSpeechRecognition,
  stripTashkeel,
  splitComparisonWords,
  diagnoseStream,
  type StreamWord,
  type StreamDiagnosis,
} from "@/hooks/useSpeechRecognition";

const LAST_KEY = "quran_tasmie_last";
const HELPED_KEY = "quran_tasmie_helped";
const QIRAH_KEY = "quran_tasmie_qirah";
// [1.0.98 قالون] رواية المقارنة في التسميع: «قالون» افتراضيًا
// (أمر المستخدم: القراءة برواية قالون)، و«حفص» اختيارًا.
const TASMIE_QIRAHS = [
  { id: "qaloon", name: "قالون عن نافع" },
  { id: "hafs", name: "حفص عن عاصم" },
] as const;

function loadTasmieQirah(): string {
  try {
    const stored = localStorage.getItem(QIRAH_KEY);
    if (stored === "hafs" || stored === "qaloon") return stored;
  } catch {
    // ignore
  }
  return "qaloon";
}
const HELP_COMMANDS = ["سمعني", "سمي لي", "سمع لي"];
// نافذة المقارنة: آيات كاملة حتى 80 كلمة تقريبًا (تكفي لالتقاط آية منسية).
const WINDOW_WORDS = 80;
const LIVE_CONFIRM_MS = 1200;
const RESTART_DELAY_MS = 300;
// [1.0.98] 40 مقطعًا صامتًا قبل استراحة 5 ثوانٍ ثم استئناف تلقائي —
// الاستماع لا يتوقف أبدًا للصمت ولا يطلب ضغطة للمتابعة.
const MAX_EMPTY_CHUNKS = 40;
const SILENCE_RESUME_MS = 5000;

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

interface SurahWord extends StreamWord {
  isFirstOfAyah: boolean;
}

export default function TasmiePage({ darkMode, toggleDarkMode }: { darkMode: boolean; toggleDarkMode: () => void }) {
  const [surah, setSurah] = useState<number>(() => loadLast().s);
  const [startAyah, setStartAyah] = useState<number>(() => loadLast().a);
  const [tasmieQirah, setTasmieQirah] = useState<string>(() => loadTasmieQirah());
  const [started, setStarted] = useState(false);
  const [words, setWords] = useState<SurahWord[]>([]);
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"ok" | "error" | "info">("info");
  const [errorAyah, setErrorAyah] = useState<number | null>(null);
  const [lastHeard, setLastHeard] = useState("");
  const [wrongCount, setWrongCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [helpedCount, setHelpedCount] = useState(0);
  const [helped, setHelped] = useState<HelpedAyah[]>(() => loadHelped());
  const [playingHelp, setPlayingHelp] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [loopActive, setLoopActive] = useState(false);
  const [completed, setCompleted] = useState(false);

  const { state, start, stop, reset } = useSpeechRecognition();
  const { getCachedAyahUrl, cacheAyahAudio } = useOfflineStorage();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevListening = useRef(false);
  const prevTranscript = useRef("");
  const posRef = useRef(0);
  const wordsRef = useRef<SurahWord[]>([]);
  const surahRef = useRef(surah);
  const loopActiveRef = useRef(false);
  const pausedOnErrorRef = useRef(false);
  const helpPlayingRef = useRef(false);
  const chunkErrorFiredRef = useRef(false);
  const emptyStreakRef = useRef(0);
  // [1.0.100] جلسات صمّاء متتالية منذ بدء الجلسة: جلسة تنتهي بلا أي
  // نتيجة جزئية ولا نهائية. إن لم يسمع التطبيق شيئًا إطلاقًا منذ
  // البدء فالميكروفون لا يصله صوت أصلًا (مكالمة تمسكه عادةً) — لا
  // صمت عادي بين الآيات، فالصمت العادي يأتي بعد كلام مسموع.
  const everHeardRef = useRef(false);
  const deafStreakRef = useRef(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingErrorRef = useRef<{ key: string; diagnosis: StreamDiagnosis } | null>(null);
  const interimRef = useRef("");

  useEffect(() => {
    surahRef.current = surah;
  }, [surah]);

  useEffect(() => {
    return () => {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
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

  const currentAyah = pos < words.length ? words[pos].ayah : words.length > 0 ? words[words.length - 1].ayah : startAyah;
  const totalAyahs = SURAHS.find((s) => s.number === surah)?.numberOfAyahs ?? 0;

  const ayahStartPos = useCallback((ayahNum: number): number => {
    const idx = wordsRef.current.findIndex((w) => w.ayah === ayahNum);
    return idx === -1 ? wordsRef.current.length : idx;
  }, []);

  const ayahEndPos = useCallback((ayahNum: number): number => {
    let end = wordsRef.current.length;
    for (let i = wordsRef.current.length - 1; i >= 0; i--) {
      if (wordsRef.current[i].ayah === ayahNum) {
        end = i + 1;
        break;
      }
    }
    return end;
  }, []);

  const setPosition = useCallback(
    (p: number) => {
      posRef.current = p;
      setPos(p);
      const a = p < wordsRef.current.length ? wordsRef.current[p].ayah : totalAyahs;
      saveLast(surahRef.current, Math.max(1, a));
    },
    [saveLast, totalAyahs]
  );

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
            const startAt = now + t + i * 0.17;
            g.gain.setValueAtTime(0.0001, startAt);
            g.gain.exponentialRampToValueAtTime(0.5, startAt + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.15);
            o.start(startAt);
            o.stop(startAt + 0.16);
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

  // نافذة مقارنة من الموضع الحالي: آيات كاملة حتى حد الكلمات.
  const buildWindow = useCallback(
    (fromPos: number, minWords = WINDOW_WORDS): { words: SurahWord[]; endPos: number } => {
      const list = wordsRef.current;
      if (fromPos >= list.length) return { words: [], endPos: list.length };
      const out: SurahWord[] = [];
      let i = fromPos;
      // الآية الحالية من موضعها (قد تكون منتصف آية)، ثم آيات كاملة بعدها.
      while (i < list.length && out.length < minWords) {
        out.push({ ...list[i], isFirstOfAyah: false });
        i++;
      }
      // أكمل آخر آية حتى نهايتها: النافذة تنتهي دائمًا عند حد آية،
      // فلا تُقطع آية في آخر النافذة وتُقرأ خطأً على أنها منسية.
      while (i < list.length && out.length > 0 && list[i].ayah === out[out.length - 1].ayah) {
        out.push({ ...list[i], isFirstOfAyah: false });
        i++;
      }
      // علامة أول كلمة في الآية: صحيحة فقط إن كانت فعلاً أول كلمة
      // في الآية داخل النافذة (أي أن النافذة بدأت عند أول الآية).
      const fixed = out.map((w, idx) => {
        if (idx === 0) return { ...w, isFirstOfAyah: fromPos === ayahStartPos(w.ayah) };
        const prev = out[idx - 1];
        return { ...w, isFirstOfAyah: prev.ayah !== w.ayah };
      });
      return { words: fixed, endPos: i };
    },
    [ayahStartPos]
  );

  // تشخيص مقطع منطوق من الموضع الحالي، مع بحث أبعد إن قفز بعيدًا.
  const diagnoseChunk = useCallback(
    (spokenText: string): StreamDiagnosis & { jumpSkipped?: number[] } => {
      let spokenWords = spokenText.split(/\s+/).filter(Boolean);
      const ok: StreamDiagnosis & { jumpSkipped?: number[] } = {
        kind: "ok",
        consumed: 0,
        errorAyah: null,
        skippedAyahs: [],
        wrongSpoken: null,
        matchedSpoken: 0,
      };
      if (spokenWords.length === 0 || posRef.current >= wordsRef.current.length) return ok;
      // سورة التوبة (9) لا بسملة في نصها؛ فإن بدأ بها عند أول السورة
      // فهي ليست خطأً بل عادة القراءة — تُحذف من المقارنة.
      if (surahRef.current === 9 && posRef.current === 0) {
        const basmala = ["بسم", "الله", "الرحمن", "الرحيم"];
        let cut = 0;
        for (let i = 0; i < basmala.length && i < spokenWords.length; i++) {
          if (stripTashkeel(spokenWords[i]) === stripTashkeel(basmala[i])) cut = i + 1;
          else break;
        }
        if (cut > 0) spokenWords = spokenWords.slice(cut);
        if (spokenWords.length === 0) return ok;
      }
      const win = buildWindow(posRef.current);
      const d = diagnoseStream(win.words, spokenWords);
      // قفز بعيدًا: بادئة مطابقة قصيرة (أقل من 3 كلمات) ومعظم الكلمات
      // المنطوقة لم تطابق شيئًا هنا — كلمة شائعة واحدة مثل «الله» قد
      // تطابق صدفة في النافذة، فلا تكفي وحدها لنفي القفز.
      if (d.consumed < 3 && d.matchedSpoken < spokenWords.length / 2) {
        // لا شيء يطابق هنا إطلاقًا — ربما قفز آيات كثيرة إلى الأمام.
        const win2 = buildWindow(win.endPos, 200);
        if (win2.words.length > 0) {
          const d2 = diagnoseStream(win2.words, spokenWords);
          if (d2.matchedSpoken > 0) {
            const firstAyah = wordsRef.current[posRef.current].ayah;
            const jumpTo = win2.words[0].ayah;
            const skipped: number[] = [];
            for (let a = firstAyah; a < jumpTo; a++) skipped.push(a);
            return {
              kind: "skipped-ayah",
              consumed: 0,
              errorAyah: skipped[0] ?? firstAyah,
              skippedAyahs: [...skipped, ...d2.skippedAyahs],
              wrongSpoken: null,
              matchedSpoken: 0,
              jumpSkipped: skipped,
            };
          }
        }
        // لا يطابق شيئًا في أي مكان قريب: كلمة خاطئة عند الآية الحالية.
        return {
          kind: "wrong-word",
          consumed: 0,
          errorAyah: wordsRef.current[posRef.current].ayah,
          skippedAyahs: [],
          wrongSpoken: spokenWords[0] ?? null,
          matchedSpoken: 0,
        };
      }
      return d;
    },
    [buildWindow]
  );

  const clearLiveTimer = useCallback(() => {
    if (liveTimerRef.current) {
      clearTimeout(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    pendingErrorRef.current = null;
  }, []);

  const fireError = useCallback(
    (d: StreamDiagnosis) => {
      if (pausedOnErrorRef.current) return;
      pausedOnErrorRef.current = true;
      chunkErrorFiredRef.current = true;
      clearLiveTimer();
      setWrongCount((c) => c + 1);
      playAlertSound();
      const a = d.errorAyah ?? currentAyah;
      setErrorAyah(a);
      if (d.kind === "skipped-ayah") {
        const list = d.skippedAyahs.length > 1
          ? `الآيات ${toArabicNum(d.skippedAyahs[0])}–${toArabicNum(d.skippedAyahs[d.skippedAyahs.length - 1])}`
          : `الآية ${toArabicNum(a)}`;
        setStatus(`توجد آية ناقصة — نسيت ${list} — عاود الآية ${toArabicNum(a)}`);
      } else {
        setStatus(`خطأ في كلمة — عاود الآية ${toArabicNum(a)}`);
      }
      setStatusKind("error");
      setLoopActive(false);
      loopActiveRef.current = false;
      void stop();
    },
    [clearLiveTimer, playAlertSound, currentAyah, stop]
  );

  const scheduleRestart = useCallback(() => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(() => {
      if (!loopActiveRef.current || pausedOnErrorRef.current || helpPlayingRef.current) return;
      reset();
      setTimeout(() => {
        if (loopActiveRef.current && !pausedOnErrorRef.current && !helpPlayingRef.current) start();
      }, 100);
    }, RESTART_DELAY_MS);
  }, [reset, start]);

  const resumeLoop = useCallback(() => {
    chunkErrorFiredRef.current = false;
    pausedOnErrorRef.current = false;
    clearLiveTimer();
    deafStreakRef.current = 0;
    setStatus(null);
    setErrorAyah(null);
    setRevealed(false);
    setLoopActive(true);
    loopActiveRef.current = true;
    ensureAudioCtx();
    scheduleRestart();
  }, [clearLiveTimer, ensureAudioCtx, scheduleRestart]);

  // تقييم المقطع عند توقف جلسة الاستماع (صمت) — الفحص الحاسم.
  useEffect(() => {
    const justStopped = prevListening.current && !state.isListening;
    const hasTranscript = state.transcript.trim().length > 0;
    const transcriptChanged = state.transcript !== prevTranscript.current;
    if (
      justStopped &&
      loopActiveRef.current &&
      !pausedOnErrorRef.current &&
      !helpPlayingRef.current
    ) {
      if (chunkErrorFiredRef.current) {
        // التنبيه الحي أطلق already — لا إعادة تقييم.
        chunkErrorFiredRef.current = false;
      } else if (hasTranscript && transcriptChanged) {
        everHeardRef.current = true;
        deafStreakRef.current = 0;
        const chunk = state.transcript.trim();
        setLastHeard(chunk);
        const norm = stripTashkeel(chunk);
        if (HELP_COMMANDS.some((c) => norm.startsWith(stripTashkeel(c)))) {
          // أمر صوتي «سمّعني الآية» — لا يُحسب محاولة.
          prevListening.current = state.isListening;
          prevTranscript.current = state.transcript;
          return;
        }
        const d = diagnoseChunk(chunk);
        if (d.kind === "ok") {
          emptyStreakRef.current = 0;
          setCorrectCount((c) => c + 1);
          const nextPos = posRef.current + d.consumed;
          if (nextPos >= wordsRef.current.length) {
            setPosition(wordsRef.current.length);
            setCompleted(true);
            setLoopActive(false);
            loopActiveRef.current = false;
            setStatus("أتممتَ تسميع السورة كاملة — تبارك الله!");
            setStatusKind("ok");
          } else {
            setPosition(nextPos);
            setStatus(null);
            scheduleRestart();
          }
        } else {
          fireError(d);
        }
      } else {
        // [1.0.100] لم يُسمع شيء إطلاقًا منذ بدء الجلسة: بعد 3 جلسات
        // صمّاء متتالية (~13 ثانية على الهاتف) أوقف الحلقة وقل
        // السبب صراحةً بدل إعادة التشغيل الصامت إلى الأبد —
        // الميكروفون مشغول على الأرجح بمكالمة أو تطبيق آخر.
        // زر «متابعة الاستماع» يعيد المحاولة بعد إغلاق المكالمة.
        if (!everHeardRef.current) {
          deafStreakRef.current += 1;
          if (deafStreakRef.current >= 3) {
            deafStreakRef.current = 0;
            setLoopActive(false);
            loopActiveRef.current = false;
            setStatus("لا يصلني أي صوت من الميكروفون — قد يكون مشغولًا بمكالمة أو تطبيق آخر؛ أغلق المكالمة ثم اضغط «متابعة الاستماع»");
            setStatusKind("error");
            prevListening.current = state.isListening;
            prevTranscript.current = state.transcript;
            return;
          }
        }
        // صمت بلا كلام — أعد الاستماع. [1.0.98] لا توقف أبدًا ولا طلب
        // ضغطة للمتابعة: بعد 40 مقطعًا صامتًا استراحة 5 ثوانٍ ثم
        // استئناف تلقائي، فيلتقط الصوت الضعيف متى عاد.
        emptyStreakRef.current += 1;
        if (emptyStreakRef.current >= MAX_EMPTY_CHUNKS) {
          emptyStreakRef.current = 0;
          setStatus("صامت — بانتظار صوتك… سأستأنف الاستماع تلقائيًا");
          setStatusKind("info");
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (loopActiveRef.current && !pausedOnErrorRef.current && !helpPlayingRef.current) {
              scheduleRestart();
            }
          }, SILENCE_RESUME_MS);
        } else {
          scheduleRestart();
        }
      }
    }
    prevListening.current = state.isListening;
    prevTranscript.current = state.transcript;
  }, [state.isListening, state.transcript, diagnoseChunk, fireError, scheduleRestart, setPosition]);

  // الفحص الحي أثناء الكلام: [1.0.98] آية منسية ثابتة ~ثانية تُطلق
  // التنبيه فورًا؛ أما خطأ الكلمة فلا يُحكم عليه من فرضية جزئية غير
  // مستقرة — يُحكم عليه عند نهاية المقطع (الفحص النهائي أدناه).
  useEffect(() => {
    if (!loopActiveRef.current || pausedOnErrorRef.current || helpPlayingRef.current || !state.isListening) {
      return;
    }
    const combined = `${state.transcript} ${state.interimTranscript}`.trim();
    interimRef.current = combined;
    if (!combined) return;
    everHeardRef.current = true;
    const d = diagnoseChunk(combined);
    if (d.kind === "ok" || d.kind === "wrong-word") {
      clearLiveTimer();
      return;
    }
    const key = `${d.kind}:${d.errorAyah}:${d.skippedAyahs.join(",")}`;
    const pending = pendingErrorRef.current;
    if (pending && pending.key === key) {
      return; // المؤقت يعمل already لهذا الخطأ نفسه.
    }
    pendingErrorRef.current = { key, diagnosis: d };
    if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    liveTimerRef.current = setTimeout(() => {
      const still = diagnoseChunk(interimRef.current);
      const stillKey = `${still.kind}:${still.errorAyah}:${still.skippedAyahs.join(",")}`;
      if (still.kind !== "ok" && stillKey === pendingErrorRef.current?.key) {
        fireError(still);
      } else {
        pendingErrorRef.current = null;
      }
    }, LIVE_CONFIRM_MS);
  }, [state.interimTranscript, state.transcript, diagnoseChunk, fireError, clearLiveTimer]);

  // «سمّعني الآية»: يُسمِع الصوت (offline أولاً) ويكشف النص مؤقتًا،
  // ويسجّل الآية في قائمة «آيات طلبتُ تسميعها»، ثم يستأنف من أول الآية.
  const playHelpAyah = useCallback(async () => {
    const s = surahRef.current;
    const a = currentAyah;
    if (state.isListening) stop();
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    clearLiveTimer();
    setAudioError(null);
    setRevealed(true);
    setPlayingHelp(true);
    helpPlayingRef.current = true;
    setLoopActive(false);
    loopActiveRef.current = false;
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
      helpPlayingRef.current = false;
      return;
    }
    const reciter = getCurrentReciter();
    const perAyahUrl = buildAyahAudioUrl(reciter, s, a);
    if (!perAyahUrl) {
      setAudioError("لا يوجد صوت متاح لهذه الآية");
      setPlayingHelp(false);
      helpPlayingRef.current = false;
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
      helpPlayingRef.current = false;
      return;
    }
    if (!cachedUrl) void cacheAyahAudio(reciter.id, globalAyah, perAyahUrl);
  }, [currentAyah, state.isListening, stop, clearLiveTimer, getCurrentReciter, getCachedAyahUrl, cacheAyahAudio]);

  // عند انتهاء صوت المساعدة: أخفِ النص، وارجع إلى أول الآية، واستأنف.
  const onHelpAudioEnded = useCallback(() => {
    setPlayingHelp(false);
    helpPlayingRef.current = false;
    setRevealed(false);
    setStatus("الآن أعدها من حفظك");
    setStatusKind("info");
    setPosition(ayahStartPos(currentAyah));
    resumeLoop();
  }, [currentAyah, ayahStartPos, resumeLoop, setPosition]);

  const startSession = useCallback(() => {
    // [1.0.98 قالون] قائمة الكلمات من نص الرواية المختارة — قالون
    // افتراضيًا. نفس ترقيم الآيات في الروايتين (6236 آية).
    const ayahs = getSurahAyahs(surah, tasmieQirah);
    const list: SurahWord[] = [];
    ayahs.forEach((ay) => {
      // [1.0.98] تُسقط علامات الوقف الشبحية من قائمة الكلمات.
      splitComparisonWords(ay.text)
        .forEach((w, i) => list.push({ word: w, ayah: ay.numberInSurah, isFirstOfAyah: i === 0 }));
    });
    wordsRef.current = list;
    setWords(list);
    const total = ayahs.length;
    const a = Math.min(Math.max(startAyah, 1), total);
    const startPos = list.findIndex((w) => w.ayah === a);
    posRef.current = startPos === -1 ? 0 : startPos;
    setPos(posRef.current);
    setRevealed(false);
    setStatus(null);
    setErrorAyah(null);
    setLastHeard("");
    setWrongCount(0);
    setCorrectCount(0);
    setHelpedCount(0);
    setAudioError(null);
    setCompleted(false);
    emptyStreakRef.current = 0;
    everHeardRef.current = false;
    deafStreakRef.current = 0;
    chunkErrorFiredRef.current = false;
    pausedOnErrorRef.current = false;
    saveLast(surah, a);
    setStarted(true);
    setLoopActive(true);
    loopActiveRef.current = true;
    ensureAudioCtx();
    scheduleRestart();
  }, [surah, startAyah, tasmieQirah, saveLast, ensureAudioCtx, scheduleRestart]);

  const resetSession = useCallback(() => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    clearLiveTimer();
    setLoopActive(false);
    loopActiveRef.current = false;
    pausedOnErrorRef.current = false;
    helpPlayingRef.current = false;
    if (state.isListening) stop();
    reset();
    setStarted(false);
    setRevealed(false);
    setStatus(null);
    setErrorAyah(null);
    setLastHeard("");
    setPlayingHelp(false);
    setCompleted(false);
    setAudioError(null);
    if (audioRef.current) audioRef.current.pause();
  }, [state.isListening, stop, reset, clearLiveTimer]);

  const toggleLoop = useCallback(() => {
    if (loopActiveRef.current) {
      setLoopActive(false);
      loopActiveRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (state.isListening) stop();
      setStatus("متوقف مؤقتًا — اضغط للمتابعة");
      setStatusKind("info");
    } else {
      resumeLoop();
    }
  }, [state.isListening, stop, resumeLoop]);

  const retryErrorAyah = useCallback(() => {
    if (errorAyah === null) return;
    setPosition(ayahStartPos(errorAyah));
    resumeLoop();
  }, [errorAyah, ayahStartPos, resumeLoop, setPosition]);

  const dismissError = useCallback(() => {
    if (errorAyah === null) return;
    // التعرف أخطأ في السمع لا أنت في القراءة: تجاوز الآية وتابع.
    setPosition(ayahEndPos(errorAyah));
    resumeLoop();
  }, [errorAyah, ayahEndPos, resumeLoop, setPosition]);

  const clearHelped = useCallback(() => {
    setHelped([]);
    try {
      localStorage.removeItem(HELPED_KEY);
    } catch {
      // ignore
    }
  }, []);

  const surahInfo = SURAHS.find((s) => s.number === surah);
  // [1.0.98 قالون] نص الآية الظاهر عند طلب التسميع — من الرواية المختارة.
  const currentAyahText = started ? getAyah(surah, currentAyah, tasmieQirah)?.text ?? null : null;

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
            <div className="text-[11px] text-muted-foreground leading-tight">سمّع السورة كاملة — يوقفك تلقائيًا عند أي خطأ</div>
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
              <label className="text-sm text-muted-foreground block mb-1.5">الرواية</label>
              <select
                value={tasmieQirah}
                onChange={(e) => {
                  const q = e.target.value;
                  setTasmieQirah(q);
                  try {
                    localStorage.setItem(QIRAH_KEY, q);
                  } catch {
                    // ignore
                  }
                }}
                data-testid="tasmie-qirah"
                className="w-full bg-card border border-border rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {TASMIE_QIRAHS.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">السورة</label>
              <select
                value={surah}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setSurah(n);
                  setStartAyah(1);
                }}
                data-testid="tasmie-surah"
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
            <div>• اقرأ السورة كاملة من حفظك دون توقف — نص الآيات مخفي أثناء القراءة.</div>
            <div>• المقارنة برواية قالون عن نافع — بدّل الرواية من الأعلى إن قرأت بحفص.</div>
            <div>• إن أخطأت في كلمة يوقفك تلقائيًا بصوت عالٍ واهتزاز، ويقول لك: «عاود الآية».</div>
            <div>• إن نسيت آية كاملة ينبّهك: «توجد آية ناقصة» ويعيدك إليها.</div>
            <div>• إن أردت سماع آية، قل «سمّعني الآية» أو اضغط زرها — تُسمَع لك وتُسجَّل في قائمتك.</div>
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
              سورة {surahInfo?.name} — الآية {toArabicNum(currentAyah)} من {toArabicNum(totalAyahs)}
            </span>
            <span>
              ✓ {toArabicNum(correctCount)} • ✗ {toArabicNum(wrongCount)} • سُمّعت {toArabicNum(helpedCount)}
            </span>
          </div>

          {/* Current ayah — hidden while reciting */}
          <div className="card-modern p-6 text-center">
            {revealed && currentAyahText ? (
              <div className="space-y-2">
                <div className="quran-text text-foreground" dir="rtl" style={{ fontSize: "1.7rem", lineHeight: 2 }}>
                  {displayAyahText(surah, currentAyah, currentAyahText)} ﴿{toArabicNum(currentAyah)}﴾
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
                <div className="font-arabic text-foreground">الآية {toArabicNum(currentAyah)} مخفية — اقرأها من حفظك</div>
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
          {statusKind === "error" && errorAyah !== null && (
            <div className="flex flex-col gap-2">
              <button
                data-testid="tasmie-retry"
                onClick={retryErrorAyah}
                className="w-full bg-primary text-primary-foreground rounded-2xl py-3 font-bold active:scale-[0.99] transition-all"
              >
                أعد من الآية {toArabicNum(errorAyah)}
              </button>
              <button
                data-testid="tasmie-dismiss-error"
                onClick={dismissError}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                الآية كانت صحيحة — تجاهل التنبيه وتابع
              </button>
            </div>
          )}

          {/* Live transcript */}
          {(state.isListening || lastHeard) && (
            <div className="card-modern p-4">
              <div className="text-xs text-muted-foreground mb-1">
                {state.isListening ? "جارٍ الاستماع... ما يُسمع الآن:" : "آخر ما نُطق:"}
              </div>
              <div className="text-right leading-relaxed" dir="rtl">
                {state.isListening ? state.interimTranscript || state.transcript || "…" : lastHeard}
              </div>
              {state.isListening && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-red-500 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                  يستمع إليك الآن
                </div>
              )}
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
              onClick={toggleLoop}
              data-testid="tasmie-mic"
              className={`w-full flex items-center justify-center gap-2 rounded-2xl py-4 font-bold text-lg active:scale-[0.99] transition-all ${
                loopActive
                  ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {loopActive ? (
                <>
                  <Pause className="w-5 h-5" />
                  إيقاف مؤقت
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  {completed ? "إعادة التسميع" : "متابعة الاستماع"}
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
