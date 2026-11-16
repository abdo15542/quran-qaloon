import { useState, useCallback, useRef } from "react";
import { Link } from "wouter";
import { ArrowRight, Search, Loader2, Moon, Sun, BookOpen, ChevronDown, ChevronUp, RefreshCw, ScrollText } from "lucide-react";
import { SURAHS, QIRAAT } from "@/data/surahs";
import { ATHKAR_CATEGORIES } from "@/data/athkar";
import { searchQuran, getAyah } from "@/data/quran-text";

interface SearchResult {
  number: number;
  numberInSurah: number;
  text: string;
  surahNumber: number;
  surahName: string;
  juz: number;
}

interface AthkarResult {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  dhikrId: number;
  text: string;
}

interface ContextAyah {
  numberInSurah: number;
  text: string;
}

interface SearchResultContext {
  before: ContextAyah | null;
  after: ContextAyah | null;
  loading: boolean;
}

interface SearchPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

type SearchTab = "quran" | "athkar";

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-amber-200 dark:bg-amber-800/60 text-foreground rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

// Offline: ayah context comes from the bundled Uthmani text — no network.
// Search and context use the selected qira'ah's text (same key SurahPlayer
// stores). Only hafs remains, so a stored qira'ah from before the
// reciter cleanup falls back to hafs.
function getStoredQirahId(): string {
  const stored = localStorage.getItem("quran_qirah");
  if (stored && QIRAAT.some((q) => q.id === stored)) return stored;
  return "hafs";
}

async function fetchAyah(surahNum: number, ayahNum: number): Promise<ContextAyah | null> {
  if (ayahNum < 1) return null;
  const surah = SURAHS.find((s) => s.number === surahNum);
  if (!surah || ayahNum > surah.numberOfAyahs) return null;
  const a = getAyah(surahNum, ayahNum, getStoredQirahId());
  return a ? { numberInSurah: a.numberInSurah, text: a.text } : null;
}

function ResultCard({ result, query }: { result: SearchResult; query: string }) {
  const [expanded, setExpanded] = useState(false);
  const [context, setContext] = useState<SearchResultContext | null>(null);

  const surah = SURAHS.find((s) => s.number === result.surahNumber);
  const type = surah?.revelationType;

  const loadContext = useCallback(async () => {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (context) return;
    setContext({ before: null, after: null, loading: true });
    const [before, after] = await Promise.all([
      fetchAyah(result.surahNumber, result.numberInSurah - 1),
      fetchAyah(result.surahNumber, result.numberInSurah + 1),
    ]);
    setContext({ before, after, loading: false });
  }, [expanded, context, result.surahNumber, result.numberInSurah]);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 transition-colors">
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-arabic text-sm text-primary">{result.surahName}</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            — الآية {toArabicNum(result.numberInSurah)}{result.juz > 0 ? ` — الجزء ${toArabicNum(result.juz)}` : ""}
          </span>
          <span className="text-xs text-muted-foreground sm:hidden">
            آية {toArabicNum(result.numberInSurah)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {type && (
            <span className={`text-xs px-2 py-0.5 rounded-full hidden sm:inline ${
              type === "Meccan"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                : type === "Medinan"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
            }`}>
              {type === "Meccan" ? "مكية" : type === "Medinan" ? "مدنية" : "مختلف فيها"}
            </span>
          )}
          <Link href={`/surah/${result.surahNumber}`}>
            <button className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
              استمع
            </button>
          </Link>
        </div>
      </div>

      <div className="p-4">
        <div className="quran-text text-xl text-right leading-loose" dir="rtl">
          {highlight(result.text, query.trim())}
          {" "}
          <span className="text-primary text-base">﴿{toArabicNum(result.numberInSurah)}﴾</span>
        </div>
      </div>

      <div className="border-t border-border">
        <button
          onClick={loadContext}
          className="w-full px-4 py-2 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5"
        >
          {expanded ? (
            <><ChevronUp className="w-3.5 h-3.5" />إخفاء السياق</>
          ) : (
            <><ChevronDown className="w-3.5 h-3.5" />عرض الآية قبلها وبعدها</>
          )}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border bg-muted/20 divide-y divide-border">
          {context?.loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {context?.before && (
                <div className="px-5 py-3">
                  <div className="text-xs text-muted-foreground mb-1.5">
                    الآية {toArabicNum(context.before.numberInSurah)} — قبلها
                  </div>
                  <div className="quran-text text-lg text-right leading-loose text-muted-foreground" dir="rtl">
                    {context.before.text}
                    {" "}
                    <span className="text-muted-foreground/60 text-sm">﴿{toArabicNum(context.before.numberInSurah)}﴾</span>
                  </div>
                </div>
              )}
              <div className="px-5 py-3 bg-primary/5 border-r-2 border-primary">
                <div className="text-xs text-primary mb-1.5">الآية {toArabicNum(result.numberInSurah)} — الآية المطلوبة</div>
                <div className="quran-text text-lg text-right leading-loose" dir="rtl">
                  {result.text}
                  {" "}
                  <span className="text-primary text-sm">﴿{toArabicNum(result.numberInSurah)}﴾</span>
                </div>
              </div>
              {context?.after && (
                <div className="px-5 py-3">
                  <div className="text-xs text-muted-foreground mb-1.5">
                    الآية {toArabicNum(context.after.numberInSurah)} — بعدها
                  </div>
                  <div className="quran-text text-lg text-right leading-loose text-muted-foreground" dir="rtl">
                    {context.after.text}
                    {" "}
                    <span className="text-muted-foreground/60 text-sm">﴿{toArabicNum(context.after.numberInSurah)}﴾</span>
                  </div>
                </div>
              )}
              {!context?.before && !context?.after && (
                <div className="py-3 text-center text-xs text-muted-foreground">لا توجد آيات مجاورة في هذه السورة</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AthkarResultCard({ result, query }: { result: AthkarResult; query: string }) {
  return (
    <Link href={`/athkar/${result.categoryId}`}>
      <div className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 transition-colors cursor-pointer">
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-base">{result.categoryIcon}</span>
            <span className="font-arabic text-sm text-primary">{result.categoryName}</span>
          </div>
          <span className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-lg">اذهب</span>
        </div>
        <div className="p-4">
          <div className="quran-text text-lg text-right leading-loose" dir="rtl">
            {highlight(result.text, query.trim())}
          </div>
        </div>
      </div>
    </Link>
  );
}

function searchAthkar(query: string): AthkarResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: AthkarResult[] = [];
  for (const cat of ATHKAR_CATEGORIES) {
    for (const item of cat.items) {
      for (const content of item.content) {
        if (content.type === "text" && content.text.includes(q)) {
          results.push({
            categoryId: cat.id,
            categoryName: cat.name,
            categoryIcon: cat.icon,
            dhikrId: item.id,
            text: content.text,
          });
          break;
        }
      }
    }
  }
  return results.slice(0, 20);
}

export default function SearchPage({ darkMode, toggleDarkMode }: SearchPageProps) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<SearchTab>("quran");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [athkarResults, setAthkarResults] = useState<AthkarResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastQueryRef = useRef<string>("");

  const doSearch = useCallback(async (q: string, currentTab: SearchTab) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    lastQueryRef.current = trimmed;
    setLoading(true);
    setError(null);
    setSearched(true);
    setResults([]);
    setAthkarResults([]);

    if (currentTab === "athkar") {
      const ar = searchAthkar(trimmed);
      setAthkarResults(ar);
      setLoading(false);
      return;
    }

    // Offline search over the bundled Uthmani text (diacritic-insensitive),
    // in the selected qira'ah's text.
    const hits = searchQuran(trimmed, 30, getStoredQirahId());
    const mapped: SearchResult[] = hits
      .map((h) => {
        const surah = SURAHS.find((s) => s.number === h.surahNumber);
        if (!surah) return null;
        return {
          number: h.number,
          numberInSurah: h.numberInSurah,
          text: h.text,
          surahNumber: h.surahNumber,
          surahName: surah.name,
          juz: 0,
        };
      })
      .filter(Boolean) as SearchResult[];
    setResults(mapped);
    setLoading(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query, tab);
  };

  const handleRetry = () => {
    doSearch(lastQueryRef.current || query, tab);
  };

  const handleTabChange = (newTab: SearchTab) => {
    setTab(newTab);
    setSearched(false);
    setResults([]);
    setAthkarResults([]);
    setError(null);
    if (query.trim()) {
      doSearch(query, newTab);
    }
  };

  const totalResults = tab === "quran" ? results.length : athkarResults.length;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <button className="p-2 rounded-full hover:bg-muted transition-colors">
              <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="font-arabic text-lg text-primary">البحث</span>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <div className="bismillah-text text-3xl text-primary mb-2">البحث في القرآن والأذكار</div>
          <p className="text-muted-foreground text-sm">
            ابحث في آيات القرآن الكريم أو في الأذكار والأدعية
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1 mb-5">
          <button
            onClick={() => handleTabChange("quran")}
            className={`flex-1 py-2 rounded-lg text-sm font-arabic flex items-center justify-center gap-1.5 transition-all ${
              tab === "quran"
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            القرآن الكريم
          </button>
          <button
            onClick={() => handleTabChange("athkar")}
            className={`flex-1 py-2 rounded-lg text-sm font-arabic flex items-center justify-center gap-1.5 transition-all ${
              tab === "athkar"
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" />
            الأذكار والأدعية
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="search"
                placeholder={tab === "quran" ? "اكتب كلمة أو عبارة للبحث في القرآن..." : "ابحث في الأذكار والأدعية..."}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-card border border-border rounded-xl pr-10 pl-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground font-arabic"
                dir="rtl"
              />
            </div>
            <button
              type="submit"
              disabled={!query.trim() || loading}
              className="px-5 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors font-arabic"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "بحث"}
            </button>
          </div>
        </form>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl px-4 py-4 text-sm text-center mb-4">
            <div className="mb-2">{error}</div>
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 hover:bg-destructive/20 rounded-lg text-xs transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              إعادة المحاولة
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-sm">
              {tab === "quran" ? "جارٍ البحث في القرآن الكريم..." : "جارٍ البحث في الأذكار..."}
            </span>
          </div>
        )}

        {searched && !loading && !error && (
          <div className="mb-4 text-sm text-muted-foreground">
            {totalResults > 0
              ? `وُجد ${toArabicNum(totalResults)} نتيجة لـ "${query}"`
              : `لم يُعثر على نتائج لـ "${query}"`}
          </div>
        )}

        {!loading && tab === "quran" && results.length > 0 && (
          <div className="space-y-3">
            {results.map((r) => (
              <ResultCard key={r.number} result={r} query={query} />
            ))}
          </div>
        )}

        {!loading && tab === "athkar" && athkarResults.length > 0 && (
          <div className="space-y-3">
            {athkarResults.map((r) => (
              <AthkarResultCard key={`${r.categoryId}-${r.dhikrId}`} result={r} query={query} />
            ))}
          </div>
        )}

        {searched && !loading && totalResults === 0 && !error && (
          <div className="text-center py-16 text-muted-foreground">
            <div className="text-5xl mb-4">🔍</div>
            <div className="text-base mb-2">لا توجد نتائج</div>
            <div className="text-sm">جرّب كلمة أخرى أو تأكد من الإملاء</div>
          </div>
        )}
      </div>
    </div>
  );
}
