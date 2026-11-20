import { useState, useRef, useCallback, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";

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
const NO_SPEECH_ERROR = "لم يُكتشف صوت. يرجى التحدث بوضوح.";
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
      error: finalText ? null : NO_SPEECH_ERROR,
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
      const messages: Record<string, string> = {
        "not-allowed": MIC_PERMISSION_ERROR,
        "no-speech": NO_SPEECH_ERROR,
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

export function stripTashkeel(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
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
  return levenshtein(a, b) <= 1;
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
  const refOriginalWords = reference.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean);
  const refWords = refOriginalWords.map((w) => stripTashkeel(w));

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
  if (ref.length === 0) return ok;
  const spoken = spokenRaw.map((w) => stripTashkeel(w)).filter((w) => w.length > 1);
  const spokenOriginal = spokenRaw.filter((w) => stripTashkeel(w).length > 1);
  if (spoken.length === 0) return ok;

  const refWords = ref.map((w) => stripTashkeel(w.word));
  const { refMatched, spokenMatched, spokenToRef } = alignStreams(refWords, spoken);
  const matchedSpoken = spokenMatched.filter(Boolean).length;
  ok.matchedSpoken = matchedSpoken;

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
      consumed: firstBadTmp === -1 ? ref.length : firstBadTmp,
      errorAyah: ref[Math.max(0, anchorRef)].ayah,
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
      const anchorRef = extraIdx > 0 ? spokenToRef[extraIdx - 1] : ref.length - 1;
      return {
        kind: "wrong-word",
        consumed: ref.length,
        errorAyah: ref[Math.max(0, anchorRef)].ayah,
        skippedAyahs: [],
        wrongSpoken: spokenOriginal[extraIdx] ?? spoken[extraIdx] ?? null,
        matchedSpoken,
      };
    }
    return { ...ok, consumed: ref.length };
  }

  // مدى الكلمات غير المطابقة بدءًا من أول خطأ.
  let runEnd = firstBad;
  while (runEnd < ref.length && !refMatched[runEnd]) runEnd++;

  if (runEnd === ref.length) {
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
          errorAyah: firstBad > 0 ? ref[firstBad - 1].ayah : ref[0].ayah,
          skippedAyahs: [],
          wrongSpoken: spokenOriginal[lastMatchedSpoken + 1 + badIdx] ?? after[badIdx] ?? null,
          matchedSpoken,
        };
      }
    }
    return { ...ok, consumed: firstBad };
  }

  // خطأ داخلي: كلمات غير مطابقة يتبعها كلمات مطابقة.
  const runAyahs = [...new Set(ref.slice(firstBad, runEnd).map((w) => w.ayah))];
  const skippedAyahs = runAyahs.filter((a) => {
    let anyInWindow = false;
    let allUnmatched = true;
    for (let k = 0; k < ref.length; k++) {
      if (ref[k].ayah === a) {
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
    errorAyah: ref[firstBad].ayah,
    skippedAyahs: [],
    wrongSpoken: wrongIdx !== -1 ? (spokenOriginal[wrongIdx] ?? spoken[wrongIdx] ?? null) : null,
    matchedSpoken,
  };
}
