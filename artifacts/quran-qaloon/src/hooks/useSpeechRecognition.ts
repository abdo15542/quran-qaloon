import { useState, useRef, useCallback } from "react";

export interface SpeechRecognitionState {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
}

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

function getSpeechRecognition(): ISpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { SpeechRecognition?: ISpeechRecognitionConstructor }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: ISpeechRecognitionConstructor }).webkitSpeechRecognition ??
    null
  );
}

export function useSpeechRecognition() {
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>("");

  const [state, setState] = useState<SpeechRecognitionState>({
    isListening: false,
    transcript: "",
    interimTranscript: "",
    error: null,
    isSupported: typeof window !== "undefined" &&
      !!(
        (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
      ),
  });

  const start = useCallback(() => {
    const SpeechRecognitionAPI = getSpeechRecognition();

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
    recognition.lang = "ar-SA";
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
        "not-allowed": "لم يُمنح إذن الميكروفون. يرجى السماح بالوصول إلى الميكروفون.",
        "no-speech": "لم يُكتشف صوت. يرجى التحدث بوضوح.",
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

  const stop = useCallback(() => {
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

  const reset = useCallback(() => {
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
 * Fuzzy word match: tolerates up to 2 character edits per word,
 * scaled proportionally so short words are stricter.
 */
function fuzzyWordMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen <= 3) return a === b;
  const maxEdits = maxLen <= 5 ? 1 : maxLen <= 8 ? 2 : 3;
  return levenshtein(a, b) <= maxEdits;
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

      if (matched && matchScore >= skipRef && matchScore >= skipSpoken) {
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
