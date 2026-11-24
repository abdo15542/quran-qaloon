// مدرّب الحفظ (1.0.114): تدريب حفظ باللمس فقط — بلا مايك وبلا تعرّف صوتي
// وبلا ذكاء اصطناعي. وضعان: (أ) تلميح الكلمة الأولى — كل كلمات الآية مخفية
// إلا الأولى، والمسة تكشف كلمة؛ (ب) أعد التركيب — كلمات الآية مخلوطة،
// والمسها بالترتيب الصحيح لإعادة بنائها. التقدم محفوظ محليًا.
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Moon, Sun, Eye, CheckCircle2, RotateCcw, EyeOff } from "lucide-react";
import { QURAN_TEXT, normalizeArabic } from "@/data/quran-text";
import { SURAHS, getGlobalAyahNumber } from "@/data/surahs";
import { JUZ_STARTS } from "@/data/juz";

interface Props {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

interface Ref {
  s: number;
  a: number;
}

// جدول شامل: رقم الآية العام ← (سورة، آية).
const GLOBAL_TO_REF: Ref[] = (() => {
  const arr: Ref[] = [];
  for (let s = 1; s <= 114; s++) {
    for (let a = 1; a <= QURAN_TEXT[s - 1].length; a++) arr.push({ s, a });
  }
  return arr;
})();

function juzRefs(juz: number): Ref[] {
  const start = JUZ_STARTS[juz - 1];
  const startGlobal = getGlobalAyahNumber(start.startSurah, start.startAyah);
  const endGlobal =
    juz < 30
      ? getGlobalAyahNumber(JUZ_STARTS[juz].startSurah, JUZ_STARTS[juz].startAyah) - 1
      : 6236;
  return GLOBAL_TO_REF.slice(startGlobal - 1, endGlobal);
}

function surahRefs(surah: number): Ref[] {
  return QURAN_TEXT[surah - 1].map((_, i) => ({ s: surah, a: i + 1 }));
}

// كلمات الآية (علامات الوقف تُستبعد — ليست كلمات).
function ayahWords(s: number, a: number): string[] {
  return QURAN_TEXT[s - 1][a - 1].split(/\s+/).filter((t) => normalizeArabic(t) !== "");
}

// خلط حتمي ببذرة من مرجع الآية — لا يتغير عند إعادة الرسم.
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let x = seed >>> 0 || 1;
  const rnd = () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const PROGRESS_KEY = "hifz_trainer_progress";

function loadProgress(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "{}") as Record<string, string[]>;
  } catch {
    return {};
  }
}

const CHUNK = 30;

export default function HifzTrainerPage({ darkMode, toggleDarkMode }: Props) {
  const [scope, setScope] = useState<"surah" | "juz">("surah");
  const [surah, setSurah] = useState(1);
  const [juz, setJuz] = useState(1);
  const [mode, setMode] = useState<"hint" | "reconstruct">("hint");
  const [chunk, setChunk] = useState(0);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState<Set<number>>(new Set([0]));
  const [placed, setPlaced] = useState<string[]>([]);
  const [usedChip, setUsedChip] = useState<Set<number>>(new Set());
  const [wrongChip, setWrongChip] = useState<number | null>(null);
  const [errors, setErrors] = useState(0);
  const [reshuffle, setReshuffle] = useState(0);
  const [progress, setProgress] = useState<Record<string, string[]>>(loadProgress);

  const selectionKey = scope === "surah" ? `surah:${surah}` : `juz:${juz}`;
  const allRefs = useMemo(() => (scope === "surah" ? surahRefs(surah) : juzRefs(juz)), [scope, surah, juz]);
  const refs = useMemo(() => allRefs.slice(chunk * CHUNK, chunk * CHUNK + CHUNK), [allRefs, chunk]);
  const totalChunks = Math.max(1, Math.ceil(allRefs.length / CHUNK));
  const current = refs[Math.min(index, refs.length - 1)];
  const doneSet = useMemo(() => new Set(progress[selectionKey] ?? []), [progress, selectionKey]);

  const words = useMemo(() => (current ? ayahWords(current.s, current.a) : []), [current]);
  const shuffled = useMemo(
    () => (current ? seededShuffle(words.map((w, i) => ({ w, i })), current.s * 1000 + current.a + reshuffle * 7919) : []),
    [words, current, reshuffle],
  );

  const resetAyahState = () => {
    setRevealed(new Set([0]));
    setPlaced([]);
    setUsedChip(new Set());
    setWrongChip(null);
    setErrors(0);
  };

  const changeSelection = (fn: () => void) => {
    fn();
    setChunk(0);
    setIndex(0);
    resetAyahState();
  };

  const goTo = (i: number) => {
    setIndex(i);
    resetAyahState();
  };

  const markDone = () => {
    if (!current) return;
    const key = `${current.s}:${current.a}`;
    const next = { ...progress, [selectionKey]: [...(progress[selectionKey] ?? []), key] };
    setProgress(next);
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    } catch {
      /* تجاهل */
    }
    if (index + 1 < refs.length) goTo(index + 1);
  };

  const isDone = current ? doneSet.has(`${current.s}:${current.a}`) : false;
  const doneCount = doneSet.size;
  const reconstructDone = mode === "reconstruct" && placed.length === words.length && words.length > 0;

  const tapChip = (chipIdx: number) => {
    if (wrongChip !== null) return;
    const chip = shuffled[chipIdx];
    if (usedChip.has(chipIdx) || reconstructDone) return;
    if (chip.w === words[placed.length]) {
      const nu = new Set(usedChip);
      nu.add(chipIdx);
      setUsedChip(nu);
      setPlaced([...placed, chip.w]);
    } else {
      setWrongChip(chipIdx);
      setErrors((e) => e + 1);
      setTimeout(() => setWrongChip(null), 600);
    }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="hifz-trainer-page">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/">
              <button className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="رجوع">
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Eye className="w-5 h-5 text-primary" />
            <span className="font-arabic text-lg text-primary">مدرّب الحفظ</span>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          درّب حفظك باللمس: أخفِ الكلمات واكشفها واحدة واحدة، أو أعد ترتيب كلمات الآية. بلا مايك وبلا إنترنت.
        </p>

        {/* اختيار النطاق */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => changeSelection(() => setScope("surah"))}
            className={`flex-1 py-2.5 rounded-full text-sm font-arabic transition-colors ${scope === "surah" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}
          >
            سورة كاملة
          </button>
          <button
            onClick={() => changeSelection(() => setScope("juz"))}
            className={`flex-1 py-2.5 rounded-full text-sm font-arabic transition-colors ${scope === "juz" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}
          >
            جزء كامل
          </button>
        </div>
        {scope === "surah" ? (
          <select
            value={surah}
            onChange={(e) => changeSelection(() => setSurah(parseInt(e.target.value, 10)))}
            className="w-full bg-card border border-border rounded-full px-3 py-2.5 text-sm mb-3"
          >
            {SURAHS.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number} — {s.name} ({toArabicNum(s.numberOfAyahs)} آية)
              </option>
            ))}
          </select>
        ) : (
          <select
            value={juz}
            onChange={(e) => changeSelection(() => setJuz(parseInt(e.target.value, 10)))}
            className="w-full bg-card border border-border rounded-full px-3 py-2.5 text-sm mb-3"
          >
            {JUZ_STARTS.map((j) => (
              <option key={j.number} value={j.number}>
                الجزء {toArabicNum(j.number)}
              </option>
            ))}
          </select>
        )}

        {/* الوضع */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => {
              setMode("hint");
              resetAyahState();
            }}
            data-testid="trainer-mode-hint"
            className={`flex-1 py-2.5 rounded-full text-sm font-arabic transition-colors ${mode === "hint" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}
          >
            تلميح الكلمة الأولى
          </button>
          <button
            onClick={() => {
              setMode("reconstruct");
              resetAyahState();
            }}
            data-testid="trainer-mode-reconstruct"
            className={`flex-1 py-2.5 rounded-full text-sm font-arabic transition-colors ${mode === "reconstruct" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}
          >
            أعد ترتيب الكلمات
          </button>
        </div>

        {current && (
          <div className="card-modern p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm text-muted-foreground">
                سورة {SURAHS.find((s) => s.number === current.s)?.name} — الآية {toArabicNum(current.a)}
                {totalChunks > 1 && (
                  <span>
                    {" "}
                    · الجولة {toArabicNum(chunk + 1)} من {toArabicNum(totalChunks)}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                أتقنت: {toArabicNum(doneCount)} من {toArabicNum(allRefs.length)}
              </div>
            </div>
            <div className="text-xs text-muted-foreground mb-4">
              الآية {toArabicNum(index + 1)} من {toArabicNum(refs.length)} في هذه الجولة
              {isDone && <span className="text-emerald-600 dark:text-emerald-400 font-bold"> · ✓ أتقنتها</span>}
            </div>

            {mode === "hint" && (
              <>
                <div
                  className="text-2xl leading-loose text-center mb-5"
                  style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                  dir="rtl"
                >
                  {words.map((w, i) => {
                    const shown = revealed.has(i);
                    const dots = "•".repeat(Math.min(Math.max(normalizeArabic(w).length, 2), 8));
                    return (
                      <button
                        key={i}
                        data-testid="trainer-word"
                        onClick={() => {
                          const nr = new Set(revealed);
                          nr.add(i);
                          setRevealed(nr);
                        }}
                        className={`mx-1 px-1.5 py-0.5 rounded-lg transition-colors ${
                          shown ? "text-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                        }`}
                      >
                        {shown ? w : dots}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRevealed(new Set(words.map((_, i) => i)))}
                    className="flex-1 py-2.5 rounded-full bg-card border border-border text-sm font-arabic flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-4 h-4" />
                    أظهر الكل
                  </button>
                  <button
                    onClick={markDone}
                    className="flex-1 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-arabic flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    أتقنتها — التالية
                  </button>
                </div>
              </>
            )}

            {mode === "reconstruct" && (
              <>
                <div
                  className="min-h-[4.5rem] bg-primary/5 border border-primary/20 rounded-2xl p-4 text-center text-xl leading-loose mb-4"
                  style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                  dir="rtl"
                >
                  {placed.length === 0 ? (
                    <span className="text-muted-foreground text-base">المس الكلمات بالترتيب الصحيح...</span>
                  ) : (
                    placed.map((w, i) => <span key={i}>{w} </span>)
                  )}
                </div>
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                  {shuffled.map((chip, ci) => (
                    <button
                      key={ci}
                      data-testid="trainer-chip"
                      onClick={() => tapChip(ci)}
                      disabled={usedChip.has(ci)}
                      className={`px-3 py-2 rounded-2xl text-lg border transition-colors ${
                        usedChip.has(ci)
                          ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-300"
                          : wrongChip === ci
                            ? "bg-red-500/20 border-red-500 text-red-700 dark:text-red-300"
                            : "bg-card border-border hover:border-primary/60"
                      }`}
                      style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                    >
                      {chip.w}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground text-center mb-3">
                  {reconstructDone
                    ? "أحسنت! ركّبت الآية كاملة"
                    : errors > 0
                      ? `محاولات خاطئة: ${toArabicNum(errors)}`
                      : "رتّب كل الكلمات لتكمل الآية"}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setReshuffle((r) => r + 1);
                      setPlaced([]);
                      setUsedChip(new Set());
                      setErrors(0);
                    }}
                    className="flex-1 py-2.5 rounded-full bg-card border border-border text-sm font-arabic flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    إعادة خلط
                  </button>
                  <button
                    onClick={markDone}
                    disabled={!reconstructDone}
                    className="flex-1 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-arabic flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    أتقنتها — التالية
                  </button>
                </div>
              </>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => goTo(Math.max(0, index - 1))}
                disabled={index === 0}
                className="flex-1 py-2.5 rounded-full bg-card border border-border text-sm font-arabic disabled:opacity-40"
              >
                الآية السابقة
              </button>
              {index + 1 < refs.length ? (
                <button onClick={() => goTo(index + 1)} className="flex-1 py-2.5 rounded-full bg-card border border-border text-sm font-arabic">
                  الآية التالية
                </button>
              ) : chunk + 1 < totalChunks ? (
                <button
                  onClick={() => {
                    setChunk((c) => c + 1);
                    setIndex(0);
                    resetAyahState();
                  }}
                  className="flex-1 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-arabic"
                >
                  الجولة التالية
                </button>
              ) : (
                <span className="flex-1 py-2.5 text-center text-sm text-muted-foreground">انتهى النطاق — أحسنت</span>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-4 leading-relaxed flex items-start gap-1.5">
          <EyeOff className="w-4 h-4 shrink-0 mt-0.5" />
          نصيحة: في وضع التلميح، حاول تسميع الآية كاملة من حفظك قبل كشف أي كلمة — الكلمة الأولى فقط هي التلميح.
        </p>
      </div>
    </div>
  );
}
