import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  MicOff,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  PlayCircle,
  StopCircle,
} from "lucide-react";
import { useSpeechRecognition, compareTexts, WordResult } from "@/hooks/useSpeechRecognition";

interface Ayah {
  number: number;
  numberInSurah: number;
  text: string;
}

interface TajweedCheckerProps {
  ayahs: Ayah[];
  surahName: string;
  fontSize?: number;
}

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 90
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : score >= 70
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
      : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  const label =
    score >= 90 ? "ممتاز" : score >= 70 ? "جيد" : score >= 50 ? "مقبول" : "يحتاج تحسين";

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-arabic ${color}`}>
      {score >= 90 ? (
        <CheckCircle2 className="w-3.5 h-3.5" />
      ) : (
        <AlertCircle className="w-3.5 h-3.5" />
      )}
      <span>
        الدقة: {toArabicNum(score)}٪ — {label}
      </span>
    </div>
  );
}

function WordHighlight({ words, fontSize }: { words: WordResult[]; fontSize: number }) {
  return (
    <div className="quran-text text-right leading-tight" style={{ fontSize: `${fontSize}px` }} dir="rtl">
      {words.map((w, i) => (
        <span key={i}>
          <span
            className={`px-1 rounded transition-colors ${
              w.missing
                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 opacity-60 line-through decoration-red-400"
                : w.correct
                ? "bg-emerald-200 text-emerald-900 dark:bg-emerald-600/50 dark:text-emerald-100 font-bold"
                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            }`}
            style={w.correct ? { fontSize: `${fontSize + 3}px` } : {}}
          >
            {w.original}
          </span>{" "}
        </span>
      ))}
    </div>
  );
}

export default function TajweedChecker({ ayahs, surahName, fontSize = 22 }: TajweedCheckerProps) {
  const [activeAyah, setActiveAyah] = useState<number | null>(null);
  const [result, setResult] = useState<{ words: WordResult[]; score: number } | null>(null);
  const [allResults, setAllResults] = useState<Record<number, { words: WordResult[]; score: number }>>({});
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [continuousMode, setContinuousMode] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const { state, start, stop, reset } = useSpeechRecognition();

  const prevListening = useRef(false);
  const prevTranscript = useRef("");
  const isContinuousRef = useRef(false);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeAyahRef = useRef<number | null>(null);

  useEffect(() => {
    isContinuousRef.current = continuousMode;
  }, [continuousMode]);

  useEffect(() => {
    activeAyahRef.current = activeAyah;
  }, [activeAyah]);

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
  }, []);

  const startCountdownToNext = useCallback(
    (nextAyahNum: number | null) => {
      let count = 3;
      setCountdown(count);
      clearCountdown();

      countdownIntervalRef.current = setInterval(() => {
        count--;
        if (count > 0) {
          setCountdown(count);
        } else {
          clearInterval(countdownIntervalRef.current!);
          countdownIntervalRef.current = null;
          setCountdown(null);

          if (nextAyahNum !== null && isContinuousRef.current) {
            setActiveAyah(nextAyahNum);
            setResult(null);
            reset();
            setTimeout(() => start(), 300);
          } else {
            setContinuousMode(false);
            isContinuousRef.current = false;
            setActiveAyah(null);
          }
        }
      }, 1000);
    },
    [clearCountdown, reset, start]
  );

  // Detect when STT stops and score the result
  useEffect(() => {
    const justStopped = prevListening.current && !state.isListening;
    const hasTranscript = state.transcript.trim().length > 0;
    const transcriptChanged = state.transcript !== prevTranscript.current;
    const currentAyah = activeAyahRef.current;

    if (justStopped && hasTranscript && transcriptChanged && currentAyah !== null) {
      const ayah = ayahs.find((a) => a.numberInSurah === currentAyah);
      if (ayah) {
        const compared = compareTexts(ayah.text, state.transcript);
        setResult(compared);
        setAllResults((prev) => ({ ...prev, [currentAyah]: compared }));

        if (isContinuousRef.current) {
          const currentIndex = ayahs.findIndex((a) => a.numberInSurah === currentAyah);
          const nextAyah = currentIndex < ayahs.length - 1 ? ayahs[currentIndex + 1] : null;
          startCountdownToNext(nextAyah?.numberInSurah ?? null);
        }
      }
    }

    prevListening.current = state.isListening;
    prevTranscript.current = state.transcript;
  }, [state.isListening, state.transcript, ayahs, startCountdownToNext]);

  // Live comparison while listening
  useEffect(() => {
    if (
      state.isListening &&
      activeAyah !== null &&
      (state.transcript || state.interimTranscript)
    ) {
      const ayah = ayahs.find((a) => a.numberInSurah === activeAyah);
      if (ayah) {
        const combined = (state.transcript + " " + state.interimTranscript).trim();
        if (combined) {
          const liveResult = compareTexts(ayah.text, combined);
          setResult(liveResult);
        }
      }
    }
  }, [state.interimTranscript, state.transcript, state.isListening, activeAyah, ayahs]);

  const handleMic = (ayahNum: number) => {
    clearCountdown();
    if (state.isListening && activeAyah === ayahNum) {
      stop();
    } else {
      reset();
      setResult(null);
      setActiveAyah(ayahNum);
      start();
    }
  };

  const handleReset = () => {
    clearCountdown();
    setContinuousMode(false);
    isContinuousRef.current = false;
    stop();
    reset();
    setResult(null);
    setActiveAyah(null);
    setAllResults({});
  };

  const startContinuousMode = () => {
    clearCountdown();
    setContinuousMode(true);
    isContinuousRef.current = true;
    reset();
    setResult(null);
    setAllResults({});
    const firstAyah = ayahs[0];
    if (firstAyah) {
      setActiveAyah(firstAyah.numberInSurah);
      setTimeout(() => start(), 300);
    }
  };

  const stopContinuousMode = () => {
    clearCountdown();
    setContinuousMode(false);
    isContinuousRef.current = false;
    stop();
  };

  const toggleCollapse = (num: number) => {
    setCollapsed((prev) => ({ ...prev, [num]: !prev[num] }));
  };

  const completedCount = Object.keys(allResults).length;
  const avgScore =
    completedCount > 0
      ? Math.round(
          Object.values(allResults).reduce((s, r) => s + r.score, 0) / completedCount
        )
      : null;

  if (!state.isSupported) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <MicOff className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <div className="text-sm">
          ميزة التسميع الصوتي غير مدعومة على هذا الجهاز.
          <br />
          <span className="text-xs">تأكد من تثبيت خدمة التعرف على الصوت من Google ومنح إذن الميكروفون</span>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {/* Header */}
      <div className="px-4 py-3 bg-primary/5 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-arabic text-primary">التسميع الصوتي — {surahName}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {continuousMode
                ? "وضع التسميع المتواصل — الميكروفون يتقدم آلياً"
                : "اضغط الميكروفون بجانب الآية، اقرأها بصوت واضح"}
            </div>
          </div>
          {(state.isListening || result || continuousMode) && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              إعادة
            </button>
          )}
        </div>

        {/* Continuous mode toggle */}
        <div className="flex items-center gap-2">
          {!continuousMode ? (
            <button
              onClick={startContinuousMode}
              disabled={state.isListening}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              تسميع متواصل
            </button>
          ) : (
            <button
              onClick={stopContinuousMode}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              <StopCircle className="w-3.5 h-3.5" />
              إيقاف التسميع المتواصل
            </button>
          )}

          {completedCount > 0 && avgScore !== null && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-1.5">
              <span>
                {toArabicNum(completedCount)}/{toArabicNum(ayahs.length)} آية — متوسط:{" "}
                {toArabicNum(avgScore)}٪
              </span>
            </div>
          )}
        </div>

        {/* Countdown indicator */}
        {countdown !== null && (
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 font-arabic">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold animate-pulse">
              {countdown}
            </span>
            الانتقال للآية التالية...
          </div>
        )}
      </div>

      {state.error && (
        <div className="px-4 py-3 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          {state.error}
        </div>
      )}

      {ayahs.map((ayah) => {
        const isActive = activeAyah === ayah.numberInSurah;
        const isListeningThis = state.isListening && isActive;
        const isCountingDownThis = countdown !== null && isActive;
        const displayResult = isActive ? result : allResults[ayah.numberInSurah] ?? null;
        const hasResult = !!displayResult && !isListeningThis;
        const isCollapsed = collapsed[ayah.numberInSurah] && !isActive;

        return (
          <div
            key={ayah.number}
            className={`transition-colors ${
              isActive
                ? continuousMode
                  ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                  : "bg-primary/5"
                : allResults[ayah.numberInSurah]
                ? "bg-muted/10"
                : "hover:bg-muted/20"
            }`}
          >
            <div className="flex items-start gap-2 py-1.5 px-3">
              {/* Mic / status button */}
              <button
                onClick={() => handleMic(ayah.numberInSurah)}
                title={isListeningThis ? "إيقاف الاستماع" : "ابدأ التسميع لهذه الآية"}
                className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  isListeningThis
                    ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30"
                    : isCountingDownThis
                    ? "bg-amber-400 text-white"
                    : allResults[ayah.numberInSurah]
                    ? allResults[ayah.numberInSurah].score >= 90
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40"
                      : allResults[ayah.numberInSurah].score >= 70
                      ? "bg-amber-100 text-amber-600 dark:bg-amber-900/40"
                      : "bg-red-100 text-red-600 dark:bg-red-900/40"
                    : "bg-primary/10 text-primary hover:bg-primary/20"
                }`}
              >
                {isListeningThis ? (
                  <MicOff className="w-3 h-3" />
                ) : allResults[ayah.numberInSurah] ? (
                  allResults[ayah.numberInSurah].score >= 70 ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <AlertCircle className="w-3 h-3" />
                  )
                ) : (
                  <Mic className="w-3 h-3" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-primary text-xs">﴿{toArabicNum(ayah.numberInSurah)}﴾</span>
                  {isListeningThis && (
                    <span className="inline-flex items-center gap-1 text-xs text-red-500 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                      جارٍ الاستماع...
                    </span>
                  )}
                  {isCountingDownThis && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                      الآية التالية في {countdown}...
                    </span>
                  )}
                  {hasResult && !isListeningThis && !isCountingDownThis && displayResult && (
                    <ScoreBadge score={displayResult.score} />
                  )}
                </div>

                {isCollapsed ? (
                  <div
                    className="quran-text text-right text-muted-foreground/50 leading-relaxed truncate cursor-pointer"
                    style={{ fontSize: `${Math.max(fontSize - 4, 14)}px` }}
                    dir="rtl"
                    onClick={() => toggleCollapse(ayah.numberInSurah)}
                  >
                    {ayah.text.substring(0, 60)}...
                  </div>
                ) : hasResult && displayResult ? (
                  <div className="space-y-1.5">
                    <WordHighlight words={displayResult.words} fontSize={fontSize} />
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded bg-emerald-200 inline-block" />
                          صحيح: {toArabicNum(displayResult.words.filter((w) => w.correct).length)}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded bg-red-200 inline-block" />
                          خطأ:{" "}
                          {toArabicNum(
                            displayResult.words.filter((w) => !w.correct && !w.missing).length
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded bg-gray-200 inline-block" />
                          فائت: {toArabicNum(displayResult.words.filter((w) => w.missing).length)}
                        </span>
                      </div>
                    </div>
                    {isActive && state.transcript && !isListeningThis && (
                      <div
                        className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-1.5 text-right"
                        dir="rtl"
                      >
                        <span className="opacity-60">ما نُطق: </span>
                        {state.transcript}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className={`quran-text text-right leading-relaxed ${
                      isListeningThis ? "text-muted-foreground opacity-70" : ""
                    }`}
                    style={{ fontSize: `${fontSize}px` }}
                    dir="rtl"
                  >
                    {isListeningThis && state.interimTranscript
                      ? state.interimTranscript
                      : ayah.text}
                  </div>
                )}
              </div>

              {/* Collapse toggle */}
              {!isActive && (
                <button
                  onClick={() => toggleCollapse(ayah.numberInSurah)}
                  className="flex-shrink-0 mt-1 p-1 rounded text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  title={isCollapsed ? "توسيع" : "طي"}
                >
                  {isCollapsed ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronUp className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* End-of-surah summary in continuous mode */}
      {continuousMode && completedCount === ayahs.length && (
        <div className="px-4 py-5 bg-emerald-50 dark:bg-emerald-950/20 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
          <div className="font-arabic text-emerald-700 dark:text-emerald-400">
            أحسنتَ! أتممتَ تسميع سورة {surahName}
          </div>
          {avgScore !== null && (
            <div className="text-sm text-muted-foreground">
              متوسط الدقة: {toArabicNum(avgScore)}٪
            </div>
          )}
          <button
            onClick={handleReset}
            className="mt-2 text-xs px-4 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            بدء جلسة جديدة
          </button>
        </div>
      )}
    </div>
  );
}
