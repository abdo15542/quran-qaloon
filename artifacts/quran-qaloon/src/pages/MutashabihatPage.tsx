// المتشابهات (1.0.114): آيات متطابقة أو متقاربة في اللفظ، محسوبة من النص
// المضمّن (src/data/mutashabihat.ts) — جنبًا إلى جنب مع تظليل الكلمات
// المختلفة، والضغط على آية يفتحها في مشغّل السورة. + اختبار «من أي سورة؟».
// كل شيء دون إنترنت وبدون ذكاء اصطناعي وبدون مايك.
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Moon, Sun, Copy, CheckCircle2, XCircle, RotateCcw, Trophy } from "lucide-react";
import { QURAN_TEXT, normalizeArabic, displayAyahText } from "@/data/quran-text";
import { SURAHS } from "@/data/surahs";
import { MUTASHABIHAT_GROUPS, type MutashabihatGroup } from "@/data/mutashabihat";

interface Props {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

function surahName(n: number): string {
  return SURAHS.find((s) => s.number === n)?.name ?? `سورة ${n}`;
}

// كلمات الآية للعرض، مع محاذاة كل كلمة خام بصيغتها المطبَّعة.
// إن لم تتطابق المحاذاة مع التطبيع الكلي للنص، نرجع الكلمات دون تطبيع
// (بلا تظليل) بدل عرض تظليل خاطئ.
function displayTokens(s: number, a: number): { text: string; norm: string }[] {
  const raw = QURAN_TEXT[s - 1][a - 1];
  let disp = displayAyahText(s, a, raw);
  if (!disp.trim()) disp = raw;
  const rawToks = disp.split(/\s+/).filter(Boolean);
  const normToks = normalizeArabic(disp).split(/\s+/).filter(Boolean);
  const aligned: { text: string; norm: string }[] = [];
  for (const t of rawToks) {
    const n = normalizeArabic(t);
    if (!n) continue; // علامة وقف — لا كلمة
    aligned.push({ text: t, norm: n });
  }
  if (aligned.length !== normToks.length || aligned.some((x, i) => x.norm !== normToks[i])) {
    return rawToks.map((t) => ({ text: t, norm: "" }));
  }
  return aligned;
}

// مؤشرات a الداخلة في أطول تسلسل مشترك مع b.
function lcsIndices(a: string[], b: string[]): Set<number> {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const keep = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      keep.add(i);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return keep;
}

// لكل آية في المجموعة: مجموعة مؤشرات كلماتها المختلفة عن الآية المرجعية.
function groupDiffs(g: MutashabihatGroup): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  if (g.ayahs.length < 2) return out;
  const ref = g.ayahs[0];
  const refNorms = displayTokens(ref.s, ref.a).map((t) => t.norm);
  g.ayahs.forEach((r, idx) => {
    const toks = displayTokens(r.s, r.a);
    const norms = toks.map((t) => t.norm);
    const other = idx === 0 ? g.ayahs[1] : ref;
    const otherNorms = idx === 0 ? displayTokens(other.s, other.a).map((t) => t.norm) : refNorms;
    const keep = lcsIndices(norms, otherNorms);
    const diff = new Set<number>();
    norms.forEach((w, i) => {
      if (w && !keep.has(i)) diff.add(i);
    });
    out.set(`${r.s}:${r.a}`, diff);
  });
  return out;
}

interface QuizQ {
  groupId: number;
  surah: number;
  ayah: number;
  options: number[];
}

function makeQuestion(): QuizQ {
  const cands = MUTASHABIHAT_GROUPS.filter((g) => new Set(g.ayahs.map((a) => a.s)).size >= 2);
  const g = cands[Math.floor(Math.random() * cands.length)];
  const ayah = g.ayahs[Math.floor(Math.random() * g.ayahs.length)];
  const groupSurahs = [...new Set(g.ayahs.map((a) => a.s))];
  const distract = groupSurahs.filter((s) => s !== ayah.s);
  while (distract.length < 3) {
    const r = 1 + Math.floor(Math.random() * 114);
    if (r !== ayah.s && !distract.includes(r)) distract.push(r);
  }
  const options = [ayah.s, ...distract.slice(0, 3)];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { groupId: g.id, surah: ayah.s, ayah: ayah.a, options };
}

const BEST_KEY = "mutashabihat_quiz_best";

export default function MutashabihatPage({ darkMode, toggleDarkMode }: Props) {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"browse" | "quiz">("browse");
  const [surahFilter, setSurahFilter] = useState<number>(0);
  const [kindFilter, setKindFilter] = useState<"all" | "exact" | "near">("all");
  const [shown, setShown] = useState(20);

  const [question, setQuestion] = useState<QuizQ | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [best, setBest] = useState(() => {
    try {
      return parseInt(localStorage.getItem(BEST_KEY) ?? "0", 10) || 0;
    } catch {
      return 0;
    }
  });

  const surahsInGroups = useMemo(() => {
    const set = new Set<number>();
    for (const g of MUTASHABIHAT_GROUPS) for (const a of g.ayahs) set.add(a.s);
    return [...set].sort((x, y) => x - y);
  }, []);

  const filtered = useMemo(() => {
    return MUTASHABIHAT_GROUPS.filter((g) => {
      if (kindFilter !== "all" && g.kind !== kindFilter) return false;
      if (surahFilter !== 0 && !g.ayahs.some((a) => a.s === surahFilter)) return false;
      return true;
    });
  }, [surahFilter, kindFilter]);

  const diffsByGroup = useMemo(() => {
    const m = new Map<number, Map<string, Set<number>>>();
    for (const g of filtered.slice(0, shown)) m.set(g.id, groupDiffs(g));
    return m;
  }, [filtered, shown]);

  const startQuiz = () => {
    setQuestion(makeQuestion());
    setPicked(null);
  };

  const answer = (opt: number) => {
    if (!question || picked !== null) return;
    setPicked(opt);
    const nt = total + 1;
    setTotal(nt);
    if (opt === question.surah) {
      const ns = score + 1;
      setScore(ns);
      if (ns > best) {
        setBest(ns);
        try {
          localStorage.setItem(BEST_KEY, String(ns));
        } catch {
          /* تجاهل */
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="mutashabihat-page">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/">
              <button className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="رجوع">
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Copy className="w-5 h-5 text-primary" />
            <span className="font-arabic text-lg text-primary">المتشابهات</span>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          {toArabicNum(MUTASHABIHAT_GROUPS.length)} مجموعة من الآيات المتشابهة في اللفظ، محسوبة من نص المصحف نفسه — الكلمات
          المظللة بالأحمر هي ما يختلف بين آيات المجموعة. اضغط أي آية لفتحها في السورة.
        </p>

        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setTab("browse")}
            className={`flex-1 py-2.5 rounded-full text-sm font-arabic transition-colors ${tab === "browse" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}
          >
            تصفح المجموعات
          </button>
          <button
            onClick={() => {
              setTab("quiz");
              if (!question) startQuiz();
            }}
            data-testid="muta-quiz-tab"
            className={`flex-1 py-2.5 rounded-full text-sm font-arabic transition-colors ${tab === "quiz" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}
          >
            اختبر نفسك: من أي سورة؟
          </button>
        </div>

        {tab === "browse" && (
          <>
            <div className="flex gap-2 mb-4">
              <select
                value={surahFilter}
                onChange={(e) => {
                  setSurahFilter(parseInt(e.target.value, 10));
                  setShown(20);
                }}
                className="flex-1 bg-card border border-border rounded-full px-3 py-2.5 text-sm"
              >
                <option value={0}>كل السور</option>
                {surahsInGroups.map((s) => (
                  <option key={s} value={s}>
                    {surahName(s)}
                  </option>
                ))}
              </select>
              <select
                value={kindFilter}
                onChange={(e) => {
                  setKindFilter(e.target.value as "all" | "exact" | "near");
                  setShown(20);
                }}
                className="flex-1 bg-card border border-border rounded-full px-3 py-2.5 text-sm"
              >
                <option value="all">متطابقة ومتقاربة</option>
                <option value="exact">متطابقة تمامًا</option>
                <option value="near">متقاربة (كلمة واحدة)</option>
              </select>
            </div>

            <div className="text-xs text-muted-foreground mb-3">
              {toArabicNum(filtered.length)} مجموعة معروضة
            </div>

            <div className="space-y-4">
              {filtered.slice(0, shown).map((g) => {
                const diffs = diffsByGroup.get(g.id) ?? new Map();
                return (
                  <div key={g.id} data-testid="muta-group" className="card-modern p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {g.kind === "exact" ? "متطابقة" : "متقاربة"}
                      </span>
                      <span className="text-xs text-muted-foreground">{toArabicNum(g.ayahs.length)} آيات</span>
                    </div>
                    <div className="space-y-3">
                      {g.ayahs.map((r) => {
                        const toks = displayTokens(r.s, r.a);
                        const diff = diffs.get(`${r.s}:${r.a}`) ?? new Set<number>();
                        return (
                          <button
                            key={`${r.s}:${r.a}`}
                            onClick={() => navigate(`/surah/${r.s}?ayah=${r.a}`)}
                            className="w-full text-right bg-muted/40 hover:bg-muted/70 rounded-2xl p-3 transition-colors"
                          >
                            <div
                              className="text-lg leading-loose mb-1.5"
                              style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                              dir="rtl"
                            >
                              {toks.map((t, i) => (
                                <span
                                  key={i}
                                  className={diff.has(i) ? "bg-red-500/20 text-red-700 dark:text-red-300 rounded px-0.5" : ""}
                                >
                                  {t.text}{" "}
                                </span>
                              ))}
                              <span className="text-primary text-base">﴿{toArabicNum(r.a)}﴾</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              سورة {surahName(r.s)} — الآية {toArabicNum(r.a)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {shown < filtered.length && (
              <button
                onClick={() => setShown((n) => n + 20)}
                className="w-full mt-4 py-3 rounded-full bg-card border border-border text-sm font-arabic hover:bg-muted transition-colors"
              >
                عرض المزيد ({toArabicNum(filtered.length - shown)} مجموعة متبقية)
              </button>
            )}
          </>
        )}

        {tab === "quiz" && question && (
          <div data-testid="muta-quiz" className="card-modern p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">
                النقاط: <span className="font-bold text-foreground">{toArabicNum(score)}</span> من{" "}
                {toArabicNum(total)}
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Trophy className="w-4 h-4 text-amber-500" />
                الأفضل: {toArabicNum(best)}
              </div>
            </div>

            <div
              className="bg-primary/5 border border-primary/20 rounded-2xl p-5 text-center text-xl leading-loose mb-5"
              style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
              dir="rtl"
            >
              {displayAyahText(question.surah, question.ayah, QURAN_TEXT[question.surah - 1][question.ayah - 1])}
            </div>
            <div className="text-center text-sm text-muted-foreground mb-4">هذه الآية من أي سورة؟</div>

            <div className="grid grid-cols-2 gap-2">
              {question.options.map((opt) => {
                const isCorrect = opt === question.surah;
                const isPicked = picked === opt;
                return (
                  <button
                    key={opt}
                    data-testid="quiz-option"
                    onClick={() => answer(opt)}
                    disabled={picked !== null}
                    className={`py-3 rounded-2xl text-sm font-arabic border transition-colors ${
                      picked === null
                        ? "bg-card border-border hover:border-primary/60"
                        : isCorrect
                          ? "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300"
                          : isPicked
                            ? "bg-red-500/15 border-red-500 text-red-700 dark:text-red-300"
                            : "bg-card border-border opacity-60"
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      {picked !== null && isCorrect && <CheckCircle2 className="w-4 h-4" />}
                      {picked !== null && isPicked && !isCorrect && <XCircle className="w-4 h-4" />}
                      سورة {surahName(opt)}
                    </span>
                  </button>
                );
              })}
            </div>

            {picked !== null && (
              <div className="mt-5 text-center">
                <div className="text-sm mb-3">
                  {picked === question.surah ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">أحسنت! إجابة صحيحة</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">
                      الإجابة الصحيحة: سورة {surahName(question.surah)}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => {
                      const g = MUTASHABIHAT_GROUPS.find((x) => x.id === question.groupId);
                      if (g) {
                        setTab("browse");
                        setSurahFilter(question.surah);
                        setShown(20);
                      }
                    }}
                    className="px-4 py-2.5 rounded-full bg-card border border-border text-sm font-arabic"
                  >
                    عرض المجموعة كاملة
                  </button>
                  <button
                    onClick={startQuiz}
                    className="px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-arabic flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    سؤال جديد
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
