import { useState, useRef, useCallback, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
// [1.0.98 قالون] جدول الإملاء الحديث للألف الخنجرية (مولّد من النص
// نفسه بمصدر التفسير): يميّز الألف الخنجرية الحقيقية (مالك، العالمين،
// السماوات — تُوقف إن نُسيت) عن الزائدة في الإملاء الحديث (ذلك، هذا،
// الرحمن، موسى، إسرائيل — يكتبها التعرف بلا ألف حتى عند التلاوة الصحيحة).
import { DAGGER_ALIF_FIXES } from "@/data/dagger-alif-fixes";

export interface SpeechRecognitionState {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
}

const LANG = "ar-SA";
const MIC_PERMISSION_ERROR =
  "لم يُمنح إذن الميكروفون. يرجى السماح بالوصول إلى الميكروفون.";
const UNAVAILABLE_ERROR = "التعرف على الصوت غير متوفر على هذا الجهاز.";

interface ISpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): ISpeechRecognitionAlternative;
  [index: number]: ISpeechRecognitionAlternative;
}

interface ISpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface ISpeechRecognitionResultList {
  readonly length: number;
  item(index: number): ISpeechRecognitionResult;
  [index: number]: ISpeechRecognitionResult;
}

interface ISpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: ISpeechRecognitionResultList;
}

interface ISpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface ISpeechRecognitionConstructor {
  new (): ISpeechRecognition;
}

function getWebSpeechRecognition(): ISpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { SpeechRecognition?: ISpeechRecognitionConstructor }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: ISpeechRecognitionConstructor }).webkitSpeechRecognition ??
    null
  );
}

function isWebSupported(): boolean {
  return typeof window !== "undefined" && !!getWebSpeechRecognition();
}

/**
 * Speech recognition with two engines behind one interface:
 * - On a native Android build (Capacitor): the native SpeechRecognizer via
 *   @capacitor-community/speech-recognition. The Web Speech API does not
 *   exist inside the Android WebView, so without this the mic check can
 *   never work in the APK.
 * - On the web: the browser Web Speech API, as before.
 * TajweedChecker uses only { state, start, stop, reset } and never sees
 * which engine is active.
 */
export function useSpeechRecognition() {
  const isNative = Capacitor.isNativePlatform();
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>("");
  // Native engine session state
  const lastMatchesRef = useRef<string>("");
  const finalizedRef = useRef(false);
  const stopSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState] = useState<SpeechRecognitionState>({
    isListening: false,
    transcript: "",
    interimTranscript: "",
    error: null,
    // On native, assume supported until available() says otherwise;
    // on web this is known synchronously.
    isSupported: isNative ? true : isWebSupported(),
  });

  // Verify native availability once (Android needs Google's speech service).
  useEffect(() => {
    if (!isNative) return;
    let cancelled = false;
    SpeechRecognition.available()
      .then(({ available }) => {
        if (!cancelled && !available) {
          setState((s) => ({ ...s, isSupported: false }));
        }
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, isSupported: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [isNative]);

  const clearStopSafetyTimer = useCallback(() => {
    if (stopSafetyTimerRef.current) {
      clearTimeout(stopSafetyTimerRef.current);
      stopSafetyTimerRef.current = null;
    }
  }, []);

  const finalizeNativeSession = useCallback(() => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    clearStopSafetyTimer();
    const finalText = lastMatchesRef.current.trim();
    finalTranscriptRef.current = finalText;
    setState((s) => ({
      ...s,
      isListening: false,
      interimTranscript: "",
      transcript: finalText,
      // [1.0.98] جلسة بلا كلام ليست خطأً: الصفحة تعيد الاستماع
      // تلقائيًا بعد صمت وبلا طلب ضغطة من المستخدم. الخطأ يظهر
      // فقط لمشاكل حقيقية (إذن الميكروفون، الشبكة).
      error: null,
    }));
  }, [clearStopSafetyTimer]);

  const cleanupNativeListeners = useCallback(() => {
    clearStopSafetyTimer();
    void SpeechRecognition.removeAllListeners().catch(() => undefined);
  }, [clearStopSafetyTimer]);

  const startNative = useCallback(async () => {
    // End any previous session cleanly before starting a new one.
    cleanupNativeListeners();
    finalizedRef.current = false;
    lastMatchesRef.current = "";
    finalTranscriptRef.current = "";

    try {
      const { available } = await SpeechRecognition.available();
      if (!available) {
        setState((s) => ({ ...s, error: UNAVAILABLE_ERROR, isSupported: false }));
        return;
      }
    } catch {
      setState((s) => ({ ...s, error: UNAVAILABLE_ERROR }));
      return;
    }

    try {
      const status = await SpeechRecognition.checkPermissions();
      if (status.speechRecognition !== "granted") {
        const next = await SpeechRecognition.requestPermissions();
        if (next.speechRecognition !== "granted") {
          setState((s) => ({ ...s, error: MIC_PERMISSION_ERROR }));
          return;
        }
      }
    } catch {
      setState((s) => ({ ...s, error: MIC_PERMISSION_ERROR }));
      return;
    }

    setState((s) => ({
      ...s,
      isListening: true,
      transcript: "",
      interimTranscript: "",
      error: null,
    }));

    await SpeechRecognition.addListener("partialResults", (data: { matches: string[] }) => {
      const text = data.matches?.[0] ?? "";
      if (!text) return;
      lastMatchesRef.current = text;
      setState((s) => ({ ...s, interimTranscript: text }));
    });

    await SpeechRecognition.addListener(
      "listeningState",
      (data: { status: "started" | "stopped" }) => {
        if (data.status === "started") {
          setState((s) => ({ ...s, isListening: true }));
        } else {
          finalizeNativeSession();
        }
      }
    );

    try {
      // With partialResults:true the promise resolves as soon as listening
      // starts; results arrive through the partialResults events.
      await SpeechRecognition.start({
        language: LANG,
        maxResults: 5,
        partialResults: true,
        popup: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (!finalizedRef.current) {
        setState((s) => ({
          ...s,
          error: msg || "تعذّر بدء التعرف على الصوت.",
          isListening: false,
        }));
      }
    }
  }, [cleanupNativeListeners, finalizeNativeSession]);

  const stopNative = useCallback(() => {
    // Ask the recognizer to stop; its onResults + listeningState('stopped')
    // callbacks deliver the final text. The safety timer guarantees the UI
    // never stays stuck listening if a native callback is lost (e.g. the
    // no-match error path, which fires no 'stopped' event).
    void SpeechRecognition.stop().catch(() => undefined);
    clearStopSafetyTimer();
    stopSafetyTimerRef.current = setTimeout(() => {
      finalizeNativeSession();
    }, 1500);
  }, [clearStopSafetyTimer, finalizeNativeSession]);

  const resetNative = useCallback(() => {
    clearStopSafetyTimer();
    finalizedRef.current = false;
    lastMatchesRef.current = "";
    finalTranscriptRef.current = "";
    cleanupNativeListeners();
    void SpeechRecognition.stop().catch(() => undefined);
    setState((s) => ({
      ...s,
      isListening: false,
      transcript: "",
      interimTranscript: "",
      error: null,
    }));
  }, [cleanupNativeListeners, clearStopSafetyTimer]);

  // Native listeners must not leak across sessions or unmounts.
  useEffect(() => {
    return () => {
      if (Capacitor.isNativePlatform()) {
        if (stopSafetyTimerRef.current) clearTimeout(stopSafetyTimerRef.current);
        void SpeechRecognition.removeAllListeners().catch(() => undefined);
        void SpeechRecognition.stop().catch(() => undefined);
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  const startWeb = useCallback(() => {
    const SpeechRecognitionAPI = getWebSpeechRecognition();

    if (!SpeechRecognitionAPI) {
      setState((s) => ({
        ...s,
        error: "المتصفح لا يدعم التعرف على الصوت. يُرجى استخدام Chrome أو Edge.",
      }));
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    finalTranscriptRef.current = "";
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = LANG;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setState((s) => ({
        ...s,
        isListening: true,
        transcript: "",
        interimTranscript: "",
        error: null,
      }));
    };

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          // Pick the best alternative (highest confidence)
          let best = result[0].transcript;
          let bestConf = result[0].confidence;
          for (let k = 1; k < result.length; k++) {
            if (result[k].confidence > bestConf) {
              bestConf = result[k].confidence;
              best = result[k].transcript;
            }
          }
          finalTranscriptRef.current += best + " ";
        } else {
          interim += result[0].transcript;
        }
      }

      const finalSoFar = finalTranscriptRef.current;
      setState((s) => ({
        ...s,
        transcript: finalSoFar,
        interimTranscript: interim,
      }));
    };

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        // [1.0.98] صمت — ليس خطأً: تُعيد الصفحة الاستماع تلقائيًا.
        setState((s) => ({ ...s, isListening: false, error: null }));
        return;
      }
      const messages: Record<string, string> = {
        "not-allowed": MIC_PERMISSION_ERROR,
        "network": "خطأ في الشبكة.",
        "audio-capture": "لا يوجد ميكروفون. يرجى التحقق من الجهاز.",
        "aborted": "",
      };
      const msg = messages[event.error] ?? `خطأ: ${event.error}`;
      if (msg) {
        setState((s) => ({ ...s, error: msg, isListening: false }));
      }
    };

    recognition.onend = () => {
      setState((s) => ({
        ...s,
        isListening: false,
        interimTranscript: "",
        transcript: finalTranscriptRef.current.trim(),
      }));
    };

    try {
      recognition.start();
    } catch {
      setState((s) => ({
        ...s,
        error: "تعذّر بدء التعرف على الصوت.",
        isListening: false,
      }));
    }
  }, []);

  const stopWeb = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setState((s) => ({
      ...s,
      isListening: false,
      interimTranscript: "",
      transcript: finalTranscriptRef.current.trim(),
    }));
  }, []);

  const resetWeb = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    finalTranscriptRef.current = "";
    setState((s) => ({
      ...s,
      isListening: false,
      transcript: "",
      interimTranscript: "",
      error: null,
    }));
  }, []);

  const start = useCallback(() => {
    if (isNative) void startNative();
    else startWeb();
  }, [isNative, startNative, startWeb]);

  const stop = useCallback(() => {
    if (isNative) stopNative();
    else stopWeb();
  }, [isNative, stopNative, stopWeb]);

  const reset = useCallback(() => {
    if (isNative) resetNative();
    else resetWeb();
  }, [isNative, resetNative, resetWeb]);

  return { state, start, stop, reset };
}

// [1.0.98 قالون] الواو والياء الصغيرتان (ۥ U+06E5، ۦ U+06E6):
// حرفان (→و/ي) إلا بعد هاء الضمير (-هُۥ/-هِۦ: حوله، به) حيث هما
// حركة المدّ فتُحذفان. (دَاوُۥدُ = داود، يَسْتَحْىِۦٓ = يستحيي،
// ٱلنَّبِيِّۦنَ = النبيين؛ أما بِهِۦ وحَوْلَهُۥ فالعلامة حركة لا
// حرف.) حذفهما مطلقًا في 1.0.98 كان يجعل التلاوة الصحيحة لهذه
// الكلمات تُقرأ خطأً. تُطبَّق قبل إزالة التشكيل.
function normalizeSmallWawYeh(text: string): string {
  return text
    .replace(/ه([\u064B-\u065F]*)\u06E6/g, "ه$1")
    .replace(/ه([\u064B-\u065F]*)\u06E5/g, "ه$1")
    .replace(/\u06E6/g, "ي")
    .replace(/\u06E5/g, "و");
}

export function stripTashkeel(text: string): string {
  return normalizeSmallWawYeh(text)
    // [1.0.98 قالون] علامات رسم قالون: التنوين الخاص (ࣰࣱࣲ
    // U+08F0–U+08F2 بدل ًٌٍ)، وعلامتا ۞ (U+06DE) و۩ (U+06E9) —
    // رمزان لا يُنطقان كانا يبقيان «كلمة» شبحية في المقارنة (۞
    // وحدها 199 موضعًا في حفص)، وعلامة اتجاه الكتابة U+200F.
    // و«ے» (U+06D2) تُكتب في قالون حيث تُكتب «ي» (فِے = في).
    // [1.0.98 قالون] توحيد الهمزة: الرسم العثماني يكتب الهمزة
    // منفصلة أو على مقعد مختلف عن الإملاء الحديث (قالون «يُؤْمِنُونَ»
    // = يؤمنون، و«ءَامَنُوا» = آمنوا، و«ٱقْرَأْ» = اقرأ) — فتُوحَّد
    // المقاعد (ؤ→و، ئ→ي، و«ءا»→«ا»، والهمزة المفردة→ا إلا بعد
    // مدّ: ساء، جاء، شيء تبقى بهمزتها) قبل المقارنة.
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DE\u06DF-\u06E8\u06E9\u06EA-\u06ED\u08F0-\u08F2\u200F]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ء(?=ا)/g, "")
    .replace(/ء/g, (_m: string, off: number, str: string) =>
      /[اوي]/.test(str[off - 1] ?? "") ? "ء" : "ا"
    )
    .replace(/ة/g, "ه")
    .replace(/[ىے]/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * stripTashkeel مع حفظ الألف الخنجرية (U+0670) حرف «ا» بدل حذفها —
 * للمقارنة على مستوى الحرف: «مَٰلِكِ» تُقارَن «مالك» لا «ملك».
 */
export function stripTashkeelKeepDagger(text: string): string {
  return normalizeSmallWawYeh(text)
    // [1.0.98] «وٰة» (الصلوة، الزكوة، الحيوة…) تُنطق ألفًا واحدة:
    // الواو صامتة والألف الخنجرية هي الألف المنطوقة. تُطوى إلى «ا»
    // قبل تحويل الألفات الخنجرية الباقية — وإلا اختلفت الكلمة
    // المرجعية عن المنطوقة بحرفين (و+ا) مع أنها صحيحة. لا يُطوى
    // «وٰ» قبل تاء (صلواتك: الواو منطوقة).
    // [1.0.98 قالون] نفس علامات رسم قالون كما في stripTashkeel
    // (تنوين ࣰࣱࣲ، ۞/۩، RLM، ے→ي) — وإلا بقيت في الكلمة المرجعية
    // فحُسبت حرفًا زائدًا أو ناقصًا في فحص الحرف.
    // ونفس توحيد الهمزة: الألف الخنجرية تُحوَّل إلى «ا» قبل قواعد
    // الهمزة (إسرائيل: الألف الخنجرية بعدها همزة تُبقيها همزةً لا ألفًا).
    .replace(/و\u0670(?=ة)/g, "ا")
    .replace(/[\u064B-\u065F\u06D6-\u06DC\u06DE\u06DF-\u06E8\u06E9\u06EA-\u06ED\u08F0-\u08F2\u200F]/g, "")
    .replace(/\u0670/g, "ا")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ء(?=ا)/g, "")
    .replace(/ء/g, (_m: string, off: number, str: string) =>
      /[اوي]/.test(str[off - 1] ?? "") ? "ء" : "ا"
    )
    .replace(/ة/g, "ه")
    .replace(/[ىے]/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * كلمات نصٍّ للمقارنة: تُسقَط علامات الوقف المنفصلة (ۚ ۖ ۗ ۘ ۙ ۛ ۜ)
 * فهي رموز لا تُنطق — بقاؤها «كلمة» فارغة لا تطابق شيئًا أبدًا كان
 * يجعل كل تلاوة صحيحة لآية فيها علامة وقف تُقرأ خطأً. [1.0.98]
 * وُجدت 4364 علامة كهذه في النص المضمّن (ۚ 1972، ۖ 1682، ۗ 603…).
 */
export function splitComparisonWords(text: string): string[] {
  const out: string[] = [];
  for (const w of text.split(/\s+/)) {
    if (stripTashkeel(w).length === 0) continue;
    // [1.0.98 قالون] النداء «يا» ملصق بالمنادى في الرسم العثماني
    // (يَٰبَنِىٓ، يَٰٓأَيُّهَا) بينما يكتبه التعرف كلمتين (يا بني،
    // يا أيها) — يُفصل ليتطابقا. كل الكلمات المطابقة للنمط في
    // النصين (61 كلمة، 349 موضعًا في حفص) نداءات، فالفصل آمن دائمًا.
    const m = w.match(/^ي[\u064B-\u065F]*\u0670(.+)$/);
    if (m && /[\u0621-\u064A]/.test(m[1])) {
      out.push(w.slice(0, w.length - m[1].length), m[1]);
    } else {
      out.push(w);
    }
  }
  return out;
}

export interface WordResult {
  original: string;
  correct: boolean;
  missing: boolean;
}

/**
 * Levenshtein edit distance between two strings (character level).
 * Used for fine-grained fuzzy matching of individual words.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Fuzzy word match: tolerates at most ONE character edit per word.
 * [1.0.96] كان الحد 2 للكلمات الطويلة، فقبل «العليم» بدل «الرحيم»
 * و«الرحيم» بدل «الرحمن» (كلها على بعد حرفين) — فيُحسب الخطأ صوابًا
 * ولا يتوقف التسميع. التشديد إلى حرف واحد يبقي التسامح المطلوب
 * (مثل «الرحمن/الرحمان» = حرف واحد) ويمنع الخلط بين كلمات مختلفة.
 */
export function fuzzyWordMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen <= 3) return a === b;
  if (levenshtein(a, b) <= 1) return true;
  // [1.0.98] لهجة/لكنة: الكلمة نفسها تُسمع بحروف مدّ مختلفة
  // (مثل «ملكي» بدل «مالك»: الكسرة تُسمع ياءً) — نفس الطول ونفس
  // الهيكل الساكن (بعد حذف ا/و/ي) = الكلمة نفسها، لا خطأ.
  if (a.length === b.length && skeletonOf(a) === skeletonOf(b)) return true;
  return false;
}

const VOWEL_LETTERS = new Set(["ا", "و", "ي"]);
function skeletonOf(w: string): string {
  return [...w].filter((c) => !VOWEL_LETTERS.has(c)).join("");
}

/**
 * DP-based word-sequence alignment (Smith–Waterman inspired).
 * Aligns reference words to spoken words, returning a match map.
 * This fixes the "one-word only" bug by considering the full sentence.
 */
function alignWordSequences(
  refWords: string[],
  spokenWords: string[]
): boolean[] {
  const n = refWords.length;
  const m = spokenWords.length;

  if (m === 0) return new Array(n).fill(false);

  // dp[i][j] = best number of matched words using refWords[0..i-1] and spokenWords[0..j-1]
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0)
  );
  // choice[i][j]: 0=skip ref, 1=skip spoken, 2=match
  const choice: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0)
  );

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const matched = fuzzyWordMatch(refWords[i - 1], spokenWords[j - 1]);
      const matchScore = dp[i - 1][j - 1] + (matched ? 1 : 0);
      const skipRef = dp[i - 1][j];
      const skipSpoken = dp[i][j - 1];

      // [1.0.96] ربط صارم (> لا >=): عند التعادل تكون الكلمة المنطوقة
      // قد طابقت كلمة مرجعية سابقة (مثلاً «الله» تطابق «لله» أيضًا)،
      // فيسرق التراجعُ العكسي من آخر المصفوفةِ الكلمةَ اللاحقةَ
      // ويترك السابقة غير مطابقة — فيُقرأ «بسم الله» خطأً، وتُخفى
      // آية منسية خلف كلمة خاطئة. الربط الصارم يجبر أقدم مطابقة.
      if (matched && matchScore > skipRef && matchScore > skipSpoken) {
        dp[i][j] = matchScore;
        choice[i][j] = 2;
      } else if (skipRef >= skipSpoken) {
        dp[i][j] = skipRef;
        choice[i][j] = 0;
      } else {
        dp[i][j] = skipSpoken;
        choice[i][j] = 1;
      }
    }
  }

  // Traceback
  const matched = new Array(n).fill(false);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (choice[i][j] === 2) {
      if (fuzzyWordMatch(refWords[i - 1], spokenWords[j - 1])) {
        matched[i - 1] = true;
      }
      i--; j--;
    } else if (choice[i][j] === 0) {
      i--;
    } else {
      j--;
    }
  }

  return matched;
}

export function compareTexts(
  reference: string,
  spoken: string
): { words: WordResult[]; score: number } {
  // [1.0.98] علامات الوقف الشبحية تُسقط هنا أيضًا (كانت تُحسب كلمات
  // ناقصة في فحص التجويد).
  const refOriginalWords = splitComparisonWords(reference);
  // [1.0.98 قالون] بالألف الخنجرية محفوظة — كلمة بألفي خنجر
  // (الصَّٰلِحَٰتِ) لا تتطابق إن حُذفت ألفاها من المرجع.
  const refWords = refOriginalWords.map((w) => stripTashkeelKeepDagger(w));

  const rawSpoken = stripTashkeel(spoken).split(/\s+/).filter((w) => w.length > 1);

  if (rawSpoken.length === 0) {
    return {
      words: refOriginalWords.map((original) => ({ original, correct: false, missing: true })),
      score: 0,
    };
  }

  // Use DP alignment for the full sentence
  const matchMap = alignWordSequences(refWords, rawSpoken);

  const words: WordResult[] = refOriginalWords.map((original, i) => {
    if (matchMap[i]) return { original, correct: true, missing: false };
    if (i >= rawSpoken.length) return { original, correct: false, missing: true };
    return { original, correct: false, missing: false };
  });

  const correct = words.filter((w) => w.correct).length;
  const score =
    refOriginalWords.length > 0
      ? Math.round((correct / refOriginalWords.length) * 100)
      : 0;

  return { words, score };
}

// [1.0.96] التسميع المتواصل للسورة كاملة — محاذاة تدفق الكلام.
// الفكرة: المسمَّع لا يقرأ آية واحدة ثم يتوقف، بل يقرأ السورة كاملة؛
// فالمقارنة تجري على تدفق كلمات السورة كلها (نافذة من آيات كاملة)،
// لا على آية واحدة بعد انتهائها. القاعدة الحاسمة: كلمات مرجعية غير
// مطابقة يتبعها كلمات مطابقة = خطأ؛ أما غير المطابقة في آخر التدفق
// فهي كلمات لم تُقَل بعد، لا خطأ.
export interface StreamWord {
  word: string;
  ayah: number;
}

export interface StreamDiagnosis {
  kind: "ok" | "wrong-word" | "skipped-ayah";
  /** كلمات مرجعية سليمة من أول النافذة (يُتقدَّم بها موضع الاستماع). */
  consumed: number;
  errorAyah: number | null;
  skippedAyahs: number[];
  wrongSpoken: string | null;
  /** عدد الكلمات المنطوقة التي طابقت شيئًا في النافذة (0 = قفز بعيدًا). */
  matchedSpoken: number;
}

/**
 * DP alignment returning BOTH masks (same DP as alignWordSequences).
 * A spoken word is "matched" when the traceback pairs it with a ref word.
 * spokenToRef[i] = ref index paired with spoken word i, or -1.
 */
function alignStreams(
  refWords: string[],
  spokenWords: string[]
): { refMatched: boolean[]; spokenMatched: boolean[]; spokenToRef: number[] } {
  const n = refWords.length;
  const m = spokenWords.length;
  const refMatched = new Array(n).fill(false);
  const spokenMatched = new Array(m).fill(false);
  const spokenToRef = new Array(m).fill(-1);
  if (m === 0) return { refMatched, spokenMatched, spokenToRef };

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  const choice: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const matched = fuzzyWordMatch(refWords[i - 1], spokenWords[j - 1]);
      const matchScore = dp[i - 1][j - 1] + (matched ? 1 : 0);
      const skipRef = dp[i - 1][j];
      const skipSpoken = dp[i][j - 1];
      // [1.0.96] ربط صارم (> لا >=): عند التعادل تكون الكلمة المنطوقة
      // قد طابقت كلمة مرجعية سابقة (مثلاً «الله» تطابق «لله» أيضًا)،
      // فيسرق التراجعُ العكسي من آخر المصفوفةِ الكلمةَ اللاحقةَ
      // ويترك السابقة غير مطابقة — فيُقرأ «بسم الله» خطأً، وتُخفى
      // آية منسية خلف كلمة خاطئة. الربط الصارم يجبر أقدم مطابقة.
      if (matched && matchScore > skipRef && matchScore > skipSpoken) {
        dp[i][j] = matchScore;
        choice[i][j] = 2;
      } else if (skipRef >= skipSpoken) {
        dp[i][j] = skipRef;
        choice[i][j] = 0;
      } else {
        dp[i][j] = skipSpoken;
        choice[i][j] = 1;
      }
    }
  }

  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (choice[i][j] === 2) {
      if (fuzzyWordMatch(refWords[i - 1], spokenWords[j - 1])) {
        refMatched[i - 1] = true;
        spokenMatched[j - 1] = true;
        spokenToRef[j - 1] = i - 1;
      }
      i--; j--;
    } else if (choice[i][j] === 0) {
      i--;
    } else {
      j--;
    }
  }
  return { refMatched, spokenMatched, spokenToRef };
}

/**
 * Diagnose one chunk of spoken words against a window of WHOLE ayahs.
 * `ref` must contain complete ayahs only (no ayah cut by the window edge),
 * otherwise a cut ayah cannot be told apart from a skipped one.
 */
export function diagnoseStream(
  ref: StreamWord[],
  spokenRaw: string[]
): StreamDiagnosis {
  const ok: StreamDiagnosis = { kind: "ok", consumed: 0, errorAyah: null, skippedAyahs: [], wrongSpoken: null, matchedSpoken: 0 };
  // [1.0.98] أسقط علامات الوقف الشبحية (ۚ ۖ …) من المرجع دفاعيًا أيضًا
  // هنا (المصدر الرئيسي للإسقاط هو splitComparisonWords عند بناء القائمة):
  // رمز لا يُنطق يتحول إلى كلمة فارغة لا تطابق شيئًا أبدًا.
  const refClean = ref.filter((w) => stripTashkeel(w.word).length > 0);
  if (refClean.length === 0) return ok;
  const spoken = spokenRaw.map((w) => stripTashkeel(w)).filter((w) => w.length > 1);
  const spokenOriginal = spokenRaw.filter((w) => stripTashkeel(w).length > 1);
  if (spoken.length === 0) return ok;

  // [1.0.98 قالون] المقارنة بالألف الخنجرية محفوظة (لا محذوفة):
  // كلمة بألفي خنجر (الصَّٰلِحَٰتِ) تُحذف ألفاها معًا بالتجريد
  // فيختلف المنطوق «الصالحات» عنها بحرفين فلا تتطابق أبدًا — بينما
  // التعرف يكتب الإملاء الحديث دائمًا. حرفٌ واحد منسي يُكشف بعدها
  // في فحص الحرف، لا هنا.
  const refWords = refClean.map((w) => stripTashkeelKeepDagger(w.word));
  const { refMatched, spokenMatched, spokenToRef } = alignStreams(refWords, spoken);

  // [1.0.98] «يا» ندائية زائدة (يسمعها التعرف قبل «ربك» ونحوه):
  // «يا» غير مطابقة يجاورها كلام مطابق تُتجاهل — ليست خطأ حفظ.
  for (let i = 0; i < spoken.length; i++) {
    if (!spokenMatched[i] && spoken[i] === "يا") {
      const nextOk = i + 1 < spoken.length && spokenMatched[i + 1];
      const prevOk = i > 0 && spokenMatched[i - 1];
      if (nextOk || prevOk) spokenMatched[i] = true;
    }
  }

  // [1.0.98] بداية منتصف آية: كلمات مرجعية غير مطابقة في أول النافذة
  // لا تغطي آية كاملة تعني أن القارئ بدأ من هنا (بسملة قيلت في مقطع
  // سابق، أو جلسة انقسمت منتصف آية) — تُستهلك بصمت ولا تُحسب خطأ.
  // أما إن غطت آية كاملة فهي آية منسية وتُكشف أدناه كالمعتاد.
  {
    const fb = refMatched.findIndex((m) => !m);
    if (fb === 0) {
      let runEnd = 0;
      while (runEnd < refClean.length && !refMatched[runEnd]) runEnd++;
      const runAyahs = [...new Set(refClean.slice(0, runEnd).map((w) => w.ayah))];
      const coversWholeAyah = runAyahs.some((a) => {
        let anyInWindow = false;
        let allUnmatched = true;
        for (let k = 0; k < refClean.length; k++) {
          if (refClean[k].ayah === a) {
            anyInWindow = true;
            if (refMatched[k]) { allUnmatched = false; break; }
          }
        }
        return anyInWindow && allUnmatched;
      });
      if (!coversWholeAyah) {
        for (let k = 0; k < runEnd; k++) refMatched[k] = true;
      }
    }
  }

  const matchedSpoken = spokenMatched.filter(Boolean).length;
  ok.matchedSpoken = matchedSpoken;

  // [1.0.98] فحص الحرف (و/ا/ل): كلمة مطابقة تختلف بحرف واحد تُفحص
  // حرفًا حرفًا — يُغفر تشويش التعرف المعروف فقط، ويُوقف على الحرف
  // المنسي أو الخاطئ. يُقارَن مع تشخيص الكلمات أدناه ويُبلَّغ الأسبق.
  const letterErr = checkLetterErrors(refClean, spoken, spokenOriginal, spokenMatched, spokenToRef);

  // التشخيص على مستوى الكلمات (منطق 1.0.96 دون تغيير).
  const wd: StreamDiagnosis = (() => {

  // [1.0.96] كلمة منطوقة لا تطابق شيئًا قبل آخر كلمة مطابقة = خطأ
  // (إدراج أو كلمة خاطئة وسط الآية) — حتى لو بقيت كلمات مرجعية
  // لم تُقَل بعد. دون هذا الفحص تُهمل الكلمة الزائدة في المقطع الجزئي.
  const lastMatchedSpoken = spokenMatched.lastIndexOf(true);
  const earlyExtraIdx = spokenMatched.findIndex((m, idx) => !m && idx < lastMatchedSpoken);
  if (earlyExtraIdx !== -1) {
    const firstBadTmp = refMatched.findIndex((m) => !m);
    // آية الخطأ = آية الكلمة المنطوقة السابقة للزائدة، لا أول كلمة
    // مرجعية غير مطابقة (قد تكون في الآية التالية).
    const anchorRef = earlyExtraIdx > 0 ? spokenToRef[earlyExtraIdx - 1] : 0;
    return {
      kind: "wrong-word",
      consumed: firstBadTmp === -1 ? refClean.length : firstBadTmp,
      errorAyah: refClean[Math.max(0, anchorRef)].ayah,
      skippedAyahs: [],
      wrongSpoken: spokenOriginal[earlyExtraIdx] ?? spoken[earlyExtraIdx] ?? null,
      matchedSpoken,
    };
  }

  const firstBad = refMatched.findIndex((m) => !m);
  if (firstBad === -1) {
    // كل الكلمات المرجعية مطابقة — لكن كلمة منطوقة زائدة خطأ أيضًا.
    const extraIdx = spokenMatched.findIndex((m) => !m);
    if (extraIdx !== -1) {
      const anchorRef = extraIdx > 0 ? spokenToRef[extraIdx - 1] : refClean.length - 1;
      return {
        kind: "wrong-word",
        consumed: refClean.length,
        errorAyah: refClean[Math.max(0, anchorRef)].ayah,
        skippedAyahs: [],
        wrongSpoken: spokenOriginal[extraIdx] ?? spoken[extraIdx] ?? null,
        matchedSpoken,
      };
    }
    return { ...ok, consumed: ref.length };
  }

  // مدى الكلمات غير المطابقة بدءًا من أول خطأ.
  let runEnd = firstBad;
  while (runEnd < refClean.length && !refMatched[runEnd]) runEnd++;

  if (runEnd === refClean.length) {
    // غير مطابقة في آخر التدفق فقط: كلمات لم تُقَل بعد — لكن كلمة
    // منطوقة زائدة بعد آخر كلمة مطابقة لا تطابق الكلمات القادمة
    // (نظرة 3 كلمات) فهي خطأ أيضًا، لا «لم تُقَل بعد».
    const after = spoken.slice(lastMatchedSpoken + 1);
    if (after.length > 0) {
      const upcoming = refWords.slice(firstBad, firstBad + 3);
      const badIdx = after.findIndex((w) => !upcoming.some((u) => fuzzyWordMatch(u, w)));
      if (badIdx !== -1) {
        // آية الخطأ = آية آخر كلمة مرجعية سليمة، لا آية أول كلمة
        // لم تُقَل بعد (هي في الآية التالية).
        return {
          kind: "wrong-word",
          consumed: firstBad,
          errorAyah: firstBad > 0 ? refClean[firstBad - 1].ayah : refClean[0].ayah,
          skippedAyahs: [],
          wrongSpoken: spokenOriginal[lastMatchedSpoken + 1 + badIdx] ?? after[badIdx] ?? null,
          matchedSpoken,
        };
      }
    }
    return { ...ok, consumed: firstBad };
  }

  // خطأ داخلي: كلمات غير مطابقة يتبعها كلمات مطابقة.
  const runAyahs = [...new Set(refClean.slice(firstBad, runEnd).map((w) => w.ayah))];
  const skippedAyahs = runAyahs.filter((a) => {
    let anyInWindow = false;
    let allUnmatched = true;
    for (let k = 0; k < refClean.length; k++) {
      if (refClean[k].ayah === a) {
        anyInWindow = true;
        if (refMatched[k]) {
          allUnmatched = false;
          break;
        }
      }
    }
    return anyInWindow && allUnmatched;
  });
  if (skippedAyahs.length > 0) {
    return {
      kind: "skipped-ayah",
      consumed: firstBad,
      errorAyah: skippedAyahs[0],
      skippedAyahs,
      wrongSpoken: null,
      matchedSpoken,
    };
  }
  const wrongIdx = spokenMatched.findIndex((m) => !m);
  return {
    kind: "wrong-word",
    consumed: firstBad,
    errorAyah: refClean[firstBad].ayah,
    skippedAyahs: [],
    wrongSpoken: wrongIdx !== -1 ? (spokenOriginal[wrongIdx] ?? spoken[wrongIdx] ?? null) : null,
    matchedSpoken,
  };
  })();

  // يُبلَّغ الخطأ الأسبق: إن لم يجد تشخيص الكلمات خطأً فخطأ الحرف
  // وحده يكفي؛ وإن وجد خطأً في الكلمات فالأسبق منهما يُبلَّغ.
  if (wd.kind === "ok") return letterErr ?? { ...ok, consumed: wd.consumed };
  if (letterErr && letterErr.consumed <= wd.consumed) return letterErr;
  return wd;
}

/**
 * [1.0.98] فحص الحرف: لكل كلمة منطوقة طابقتها المحاذاة مع كلمة مرجعية،
 * قارن الحروف. فرق حرف واحد يُغفر فقط إن كان من تشويش التعرف المعروف
 * (حروف مدّ، تنوين ه/ا، ألف خنجرية)، وإلا فهو حرف منسي أو خاطئ —
 * واو أو ألف أو لام — فيُوقف التسميع عند آيته.
 */
function checkLetterErrors(
  ref: StreamWord[],
  spoken: string[],
  spokenOriginal: string[],
  spokenMatched: boolean[],
  spokenToRef: number[]
): StreamDiagnosis | null {
  const matchedSpoken = spokenMatched.filter(Boolean).length;
  for (let j = 0; j < spoken.length; j++) {
    const ri = spokenToRef[j];
    if (ri < 0 || !spokenMatched[j]) continue;
    const Rk = stripTashkeelKeepDagger(ref[ri].word);
    const S = spoken[j];
    if (Rk === S) continue;
    if (classifyLetterDiff(ref[ri].word, Rk, S) === "error") {
      return {
        kind: "wrong-word",
        consumed: ri,
        errorAyah: ref[ri].ayah,
        skippedAyahs: [],
        wrongSpoken: spokenOriginal[j] ?? S,
        matchedSpoken,
      };
    }
  }
  return null;
}

/**
 * مواضع الألف الخنجرية في كلمة أصلية: فهرسها في النسخة المحفوظة
 * (stripTashkeelKeepDagger)، والحرف الذي قبلها، وهل هي آخر حرف.
 * (في النص 425 كلمة فيها ألفان خنجريتان فأكثر — لا يكفي فهرس أول واحدة.)
 */
interface DaggerInfo { rkIndex: number; origIndex: number; prevLetter: string | null; isLastLetter: boolean; }
function daggerInfos(original: string): DaggerInfo[] {
  // [1.0.98 قالون] تُعالَج الكلمة كما في stripTashkeelKeepDagger حتى
  // خطوة الألف الخنجرية — فهارس الألفات يجب أن تطابق النسخة المحفوظة
  // (Rk)، وإلا اختلّت عند حذف همزة قبلها (ءَايَةٍ: الهمزة تُحذف
  // فتنزاح الفهارس). الخطوات الباقية (همزة، ة→ه، ى→ي) حرف بحرف
  // فلا تزيح الفهارس.
  const pre = normalizeSmallWawYeh(original)
    .replace(/و\u0670(?=ة)/g, "ا")
    .replace(/[\u064B-\u065F\u06D6-\u06DC\u06DE\u06DF-\u06E8\u06E9\u06EA-\u06ED\u08F0-\u08F2\u200F]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ء(?=ا)/g, "");
  const chars = [...pre];
  const infos: DaggerInfo[] = [];
  let rk = 0;
  let prevLetter: string | null = null;
  for (let idx = 0; idx < chars.length; idx++) {
    const ch = chars[idx];
    if (ch === "\u0670") {
      infos.push({ rkIndex: rk, origIndex: idx, prevLetter, isLastLetter: false });
      rk++;
      prevLetter = "ا";
      continue;
    }
    rk++;
    prevLetter = ch;
  }
  for (const info of infos) {
    let hasLetterAfter = false;
    for (let j = info.origIndex + 1; j < chars.length; j++) {
      if (chars[j] !== "\u0670") { hasLetterAfter = true; break; }
    }
    info.isLastLetter = !hasLetterAfter;
  }
  return infos;
}

/**
 * فرق بين كلمة مرجعية (بألفها الخنجرية محفوظة) وكلمة منطوقة.
 * «benign» = تشويش تعرف/لكنة معروف؛ «error» = حرف منسي أو خاطئ.
 */
function classifyLetterDiff(
  refOriginal: string,
  refKeep: string,
  spoken: string
): "benign" | "error" {
  if (refKeep === spoken) return "benign";
  // [1.0.98 قالون] الإملاء الحديث للكلمة: إن طابق المنطوقُ الإملاءَ
  // الحديث للكلمة المرجعية فالتلاوة صحيحة — الألف الخنجرية ليست
  // دائمًا ألفًا (ذلك، هذا، الرحمن، موسى)، ومقعد الهمزة قد يختلف
  // (إسرائيل). يغطي فرق الحذف والاستبدال معًا.
  if (DAGGER_ALIF_FIXES[refKeep] === spoken) return "benign";
  // نفس الطول ونفس الهيكل الساكن = اختلاف حروف مدّ فقط (لكنة).
  if (refKeep.length === spoken.length && skeletonOf(refKeep) === skeletonOf(spoken)) return "benign";
  if (levenshtein(refKeep, spoken) !== 1) return "error";
  // فرق حرف واحد — حدّد موضعه ونوعه.
  if (spoken.length === refKeep.length - 1) {
    // حذف حرف من المنطوق.
    let i = 0;
    while (i < spoken.length && refKeep[i] === spoken[i]) i++;
    const deleted = refKeep[i];
    const infos = daggerInfos(refOriginal);
    // واو صامتة بعد ألف خنجرية (الصلوة/الزكوة تُنطق «الصلاة») —
    // ليست حرفًا منسيًا.
    if (deleted === "و" && infos.some((d) => d.rkIndex === i - 1)) return "benign";
    // ألف خنجرية أخيرة في آخر الكلمة أو بعد ألف مقصورة (موسى، عيسى)
    // يكتبها التعرف دائمًا بلا ألف — ليست حرفًا منسيًا. (الحالات
    // المثبتة في الجدول أعلاه تُغفر هناك؛ هذا احتياط لكلمات قالون
    // غير المغطاة بالجدول.)
    if (deleted === "ا") {
      const info = infos.find((d) => d.rkIndex === i);
      if (info) {
        const isLastDagger = infos.indexOf(info) === infos.length - 1;
        if (isLastDagger && (info.isLastLetter || info.prevLetter === "ى")) return "benign";
      }
    }
    return "error";
  }
  if (spoken.length === refKeep.length + 1) {
    // زيادة حرف في المنطوق.
    let i = 0;
    while (i < refKeep.length && refKeep[i] === spoken[i]) i++;
    const inserted = spoken[i];
    if (inserted === "ه" && i === spoken.length - 1) return "benign"; // تنوين يُسمع هاءً (بحمده)
    if (inserted === "ا" && refOriginal.includes("\u0670")) return "benign"; // ألف خنجرية مكتوبة (الرحمان)
    return "error";
  }
  // استبدال حرف واحد بنفس الطول.
  let i = 0;
  while (i < spoken.length && refKeep[i] === spoken[i]) i++;
  const a = refKeep[i], b = spoken[i];
  if (a === "ا" && b === "ه" && i === spoken.length - 1) return "benign"; // تنوين (توابا/توابه)
  if (a === "ه" && b === "ا" && i === spoken.length - 1) return "benign";
  if (VOWEL_LETTERS.has(a) && VOWEL_LETTERS.has(b)) return "benign";
  return "error";
}
