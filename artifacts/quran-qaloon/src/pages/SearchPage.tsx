import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Search, Loader2, Moon, Sun, BookOpen, ChevronDown, ChevronUp, ChevronLeft, RefreshCw, ScrollText, Hash, Tags, ListOrdered, AlignStartVertical, AlignEndVertical, Music, Sprout, ListTree, Mic } from "lucide-react";
import { SURAHS, QIRAAT, getGlobalAyahNumber, type RevelationType } from "@/data/surahs";
import { getJuzNumber } from "@/data/juz";
import { ATHKAR_CATEGORIES } from "@/data/athkar";
import { searchQuranDetailed, highlightSegments, normalizeArabic, cleanSearchQuery, getAyah, QURAN_TEXT, matchWord, type QuranSearchHitDetailed, type QuranSearchDetailed } from "@/data/quran-text";
// [1.0.74 advanced search] Topic + revelation-order data (offline, bundled).
import { TOPICS, TOPIC_PARENTS, TOPIC_COVERAGE_NOTE, getTopicAyahRefs, getTopicAyahCount, getTopicParentName, getTopicSourceLabel, type QuranTopic } from "@/data/topics";
// [1.0.108] Per-surah topic outlines (offline, bundled).
import { SURAH_SECTIONS, TOTAL_SURAH_SECTIONS, SURAHS_WITH_SECTIONS_COUNT, SURAHS_WITHOUT_SECTIONS, getSurahSections, type SurahSection } from "@/data/surah-sections";
import { REVELATION_ORDER } from "@/data/revelation-order";
import TafsirSheet from "@/components/TafsirSheet";
import RootSearch from "@/components/RootSearch";
// [1.0.109 voice search] Reuses the Tajweed mic-check hook (native
// SpeechRecognizer via @capacitor-community/speech-recognition on
// Android, Web Speech API on the web) — no new recognition layer.
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
// [1.0.109] One-tap shortcut to the system voice-input settings, where
// the Arabic offline speech pack is downloaded (native only).
import { openVoiceInputSettings, isVoiceSettingsAvailable } from "@/lib/voice-settings";

interface SearchResult {
  number: number;
  numberInSurah: number;
  text: string;
  surahNumber: number;
  surahName: string;
  juz: number;
  occurrences: number;
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

const SUGGESTIONS = ["الله", "الرحمن", "الصلاة", "الجنة", "النار", "المؤمنون", "القرآن", "الدنيا", "الآخرة", "الرحيم"];

const PAGE_SIZE = 60;

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

// Highlight the matched words (diacritic-aware — the same word matching
// the search uses, so the highlight always agrees with the count).
function HighlightedAyah({ text, query }: { text: string; query: string }) {
  const segments = useMemo(() => highlightSegments(text, query), [text, query]);
  return (
    <>
      {segments.map((seg, i) =>
        seg.matched ? (
          <mark key={i} className="bg-amber-200 dark:bg-amber-800/60 text-foreground rounded px-0.5">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

function highlight(text: string, query: string): React.ReactNode {
  return <HighlightedAyah text={text} query={query} />;
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
  const [, navigate] = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [context, setContext] = useState<SearchResultContext | null>(null);
  const [showTafsir, setShowTafsir] = useState(false);

  const surah = SURAHS.find((s) => s.number === result.surahNumber);
  const type = surah?.revelationType;

  const goToAyah = useCallback(() => {
    navigate(`/surah/${result.surahNumber}?ayah=${result.numberInSurah}`);
  }, [navigate, result.surahNumber, result.numberInSurah]);

  const loadContext = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
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
    <div
      onClick={goToAyah}
      className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-arabic text-sm text-primary">{result.surahName}</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            — الآية {toArabicNum(result.numberInSurah)}{result.juz > 0 ? ` — الجزء ${toArabicNum(result.juz)}` : ""}
          </span>
          <span className="text-xs text-muted-foreground sm:hidden">
            آية {toArabicNum(result.numberInSurah)}
          </span>
          {result.occurrences > 1 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              ذُكرت {toArabicNum(result.occurrences)} مرات
            </span>
          )}
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
          <button
            onClick={(e) => { e.stopPropagation(); setShowTafsir(true); }}
            className="text-xs px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors"
          >
            التفسير
          </button>
          <span className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-lg flex items-center gap-0.5">
            <ChevronLeft className="w-3.5 h-3.5" />
            الذهاب إلى الآية
          </span>
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
      {showTafsir && (
        <div onClick={(e) => e.stopPropagation()}>
          <TafsirSheet
            surahNumber={result.surahNumber}
            ayahNumber={result.numberInSurah}
            onClose={() => setShowTafsir(false)}
          />
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
  // Diacritic-insensitive, like the Quran search: the athkar texts are
  // fully vocalised, so a plain includes() misses «الله» in «لِلَّهِ».
  // Athkar texts are modern spelling (no Uthmani dagger alif), so the
  // dagger-alif exception table must not apply to them — pass false.
  const q = normalizeArabic(query.trim(), false);
  if (!q) return [];
  const results: AthkarResult[] = [];
  for (const cat of ATHKAR_CATEGORIES) {
    for (const item of cat.items) {
      for (const content of item.content) {
        if (content.type === "text" && normalizeArabic(content.text, false).includes(q)) {
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

// ---- [1.0.74 advanced search] ----
// Pure helpers for the new search modes. All offline, computed from the
// bundled Hafs text (QURAN_TEXT) and the bundled topics data — no network,
// no new dependencies. Exported so the 1.0.74 harness can call them
// directly (via the Vite dev server) and check them against
// searchQuranDetailed.

// Lazy normalised-words cache over the bundled text, using the same
// normalisation as searchQuranDetailed. Built once, on first use in a
// word-position mode, so the plain text search path pays nothing for it.
let cachedNormWords74: string[][][] | null = null;
function getNormWords74(): string[][][] {
  if (!cachedNormWords74) {
    cachedNormWords74 = QURAN_TEXT.map((texts) =>
      texts.map((t) => normalizeArabic(t).split(/\s+/).filter(Boolean))
    );
  }
  return cachedNormWords74;
}

function ayahRefToResult(surahNumber: number, ayahNumber: number): SearchResult | null {
  const surah = SURAHS.find((s) => s.number === surahNumber);
  const a = getAyah(surahNumber, ayahNumber, "hafs");
  if (!surah || !a) return null;
  return {
    number: ayahNumber,
    numberInSurah: ayahNumber,
    text: a.text,
    surahNumber,
    surahName: surah.name,
    juz: getJuzNumber(getGlobalAyahNumber(surahNumber, ayahNumber)),
    occurrences: 1,
  };
}

function firstQueryWord(query: string): string {
  return normalizeArabic(cleanSearchQuery(query.trim()), false).split(/\s+/).filter(Boolean)[0] ?? "";
}

/** Ayahs whose FIRST word (after normalizeArabic) matches the query word. */
export function searchByFirstWord(query: string): SearchResult[] {
  const q = firstQueryWord(query);
  if (!q) return [];
  const words = getNormWords74();
  const out: SearchResult[] = [];
  for (let s = 0; s < words.length; s++) {
    for (let i = 0; i < words[s].length; i++) {
      if (words[s][i].length > 0 && matchWord(words[s][i][0], q)) {
        const r = ayahRefToResult(s + 1, i + 1);
        if (r) out.push(r);
      }
    }
  }
  return out;
}

/** Ayahs whose LAST word (after normalizeArabic) matches the query word. */
export function searchByLastWord(query: string): SearchResult[] {
  const q = firstQueryWord(query);
  if (!q) return [];
  const words = getNormWords74();
  const out: SearchResult[] = [];
  for (let s = 0; s < words.length; s++) {
    for (let i = 0; i < words[s].length; i++) {
      const w = words[s][i];
      if (w.length > 0 && matchWord(w[w.length - 1], q)) {
        const r = ayahRefToResult(s + 1, i + 1);
        if (r) out.push(r);
      }
    }
  }
  return out;
}

export interface RhymeGroup {
  /** Normalised last word shared by every ayah in the group. */
  ending: string;
  count: number;
  ayahs: Array<{ surah: number; ayah: number }>;
}

// Ayahs grouped by their normalised last word (the rhyme / الفاصلة),
// most common ending first. Built once from the bundled text.
let cachedRhymeGroups74: RhymeGroup[] | null = null;
export function getRhymeGroups(): RhymeGroup[] {
  if (cachedRhymeGroups74) return cachedRhymeGroups74;
  const words = getNormWords74();
  const byEnding = new Map<string, Array<{ surah: number; ayah: number }>>();
  for (let s = 0; s < words.length; s++) {
    for (let i = 0; i < words[s].length; i++) {
      const w = words[s][i];
      if (w.length === 0) continue;
      const ending = w[w.length - 1];
      const list = byEnding.get(ending);
      if (list) list.push({ surah: s + 1, ayah: i + 1 });
      else byEnding.set(ending, [{ surah: s + 1, ayah: i + 1 }]);
    }
  }
  const groups: RhymeGroup[] = [...byEnding.entries()].map(([ending, ayahs]) => ({
    ending,
    count: ayahs.length,
    ayahs,
  }));
  groups.sort((a, b) => b.count - a.count || (a.ending < b.ending ? -1 : 1));
  cachedRhymeGroups74 = groups;
  return groups;
}

/** Ayahs sharing one rhyme ending (a normalised last word). */
export function searchByRhyme(ending: string): SearchResult[] {
  const norm = normalizeArabic(ending.trim(), false);
  if (!norm) return [];
  const group = getRhymeGroups().find((g) => g.ending === norm);
  if (!group) return [];
  const out: SearchResult[] = [];
  for (const ref of group.ayahs) {
    const r = ayahRefToResult(ref.surah, ref.ayah);
    if (r) out.push(r);
  }
  return out;
}

/**
 * Topics whose Arabic name (or parent-topic name) contains the query,
 * diacritic-insensitive. With no query, the best-covered topics first
 * (TOPICS is already sorted by ayah count descending) — browsing.
 */
export function searchTopics74(query: string): QuranTopic[] {
  const q = normalizeArabic(cleanSearchQuery(query.trim()), false);
  if (!q) return TOPICS;
  return TOPICS.filter((t) => {
    if (normalizeArabic(t.name, false).includes(q)) return true;
    if (t.parentId !== null) {
      const parentName = TOPIC_PARENTS[t.parentId] ?? "";
      if (parentName && normalizeArabic(parentName, false).includes(q)) return true;
    }
    return false;
  });
}

/** The ayahs carrying one topic, as search results (occurrences: 1). */
export function getTopicResults(topic: QuranTopic): SearchResult[] {
  const out: SearchResult[] = [];
  for (const ref of getTopicAyahRefs(topic)) {
    const r = ayahRefToResult(ref.surah, ref.ayah);
    if (r) out.push(r);
  }
  return out;
}

// Mode chips for the Quran tab (text is the pre-1.0.74 search).
import type { LucideIcon } from "lucide-react";
const MODES74: Array<{ id: "text" | "topic" | "surah-topics" | "makki" | "revelation" | "first" | "last" | "rhyme" | "root"; label: string; Icon: LucideIcon }> = [
  { id: "text", label: "بحث نصي", Icon: Search },
  { id: "root", label: "الجذر", Icon: Sprout },
  { id: "topic", label: "المواضيع", Icon: Tags },
  { id: "surah-topics", label: "مواضيع السور", Icon: ListTree },
  { id: "makki", label: "مكي / مدني", Icon: BookOpen },
  { id: "revelation", label: "ترتيب النزول", Icon: ListOrdered },
  { id: "first", label: "أول الكلمة", Icon: AlignStartVertical },
  { id: "last", label: "آخر الكلمة", Icon: AlignEndVertical },
  { id: "rhyme", label: "الفاصلة", Icon: Music },
];

const MODE_PLACEHOLDERS74: Record<string, string> = {
  topic: "ابحث في المواضيع... (مثال: الصلاة)",
  "surah-topics": "ابحث عن سورة بالاسم أو الرقم...",
  first: "اكتب كلمة للبحث عن الآيات التي تبدأ بها...",
  last: "اكتب كلمة للبحث عن الآيات التي تنتهي بها...",
  rhyme: "ابحث في نهايات الآيات (الفاصلة)...",
};
// ---- [/1.0.74 advanced search] ----

export default function SearchPage({ darkMode, toggleDarkMode }: SearchPageProps) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<SearchTab>("quran");
  // [1.0.74 advanced search] Modes inside the Quran tab. The root-search
  // tab (added later by the coordinator) sits above these — these modes
  // only change what the Quran tab shows, nothing else.
  type AdvancedMode = "text" | "topic" | "surah-topics" | "makki" | "revelation" | "first" | "last" | "rhyme" | "root";
  const [mode, setMode] = useState<AdvancedMode>("text");
  const [selectedTopic, setSelectedTopic] = useState<QuranTopic | null>(null);
  // [1.0.108] Surah-topics mode: selected surah, then selected section.
  const [selectedSurahTopics, setSelectedSurahTopics] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<{ surah: number; section: SurahSection } | null>(null);
  const [selectedRhyme, setSelectedRhyme] = useState<string | null>(null);
  const [makkiFilter, setMakkiFilter] = useState<RevelationType | "all">("all");
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [showAllRhymes, setShowAllRhymes] = useState(false);
  const [detailed, setDetailed] = useState<QuranSearchDetailed | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [athkarResults, setAthkarResults] = useState<AthkarResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const lastQueryRef = useRef<string>("");
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // ---- [1.0.109 voice search] ----
  // The same hook the Tajweed mic check uses (TajweedChecker pattern:
  // act when listening flips true→false with a fresh final transcript).
  // The recognised text goes through the exact same search the typed
  // query runs — one word, a phrase, or a whole ayah — with the same
  // counts and locations. The search itself is offline; only the
  // speech-to-text step runs through the phone's speech service.
  // [1.0.110 auto-capture] الالتقاط التلقائي: إن انقطعت الجلسة قبل
  // نتيجة نهائية تُعاد بنفسها حتى يلتقط كلامه كاملاً — لا يتوقف إلا
  // بضغطته أو بعد نتيجة نهائية أو بعد جلسات ميتة متتالية.
  const { state: voiceState, start: startVoice, stop: stopVoice, reset: resetVoice } = useSpeechRecognition({ autoRestart: true });
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const prevVoiceListeningRef = useRef(false);
  const prevVoiceTranscriptRef = useRef("");
  // [1.0.109] One-time offline-pack prompt (native only): the Arabic
  // offline pack is system data the app cannot bundle or download, so
  // at first voice use the app offers to open the system screen where
  // the user downloads it once. Remembered in localStorage; never
  // asked again, and listening is never blocked behind it.
  const VOICE_PACK_PROMPT_KEY = "quran_voice_offline_prompted";
  const [showVoicePackPrompt, setShowVoicePackPrompt] = useState(false);

  const startListening = useCallback(() => {
    setVoiceError(null);
    resetVoice();
    // Same 300ms reset→start gap TajweedChecker uses, so a previous
    // session is fully torn down before the next start.
    setTimeout(() => startVoice(), 300);
  }, [resetVoice, startVoice]);

  const handleVoiceToggle = useCallback(() => {
    if (voiceState.isListening) {
      stopVoice();
      return;
    }
    if (isVoiceSettingsAvailable() && !localStorage.getItem(VOICE_PACK_PROMPT_KEY)) {
      setShowVoicePackPrompt(true);
      return;
    }
    startListening();
  }, [voiceState.isListening, stopVoice, startListening]);

  // First-use prompt actions: open the system screen, or skip and listen.
  const handleVoicePackOpenSettings = useCallback(async () => {
    localStorage.setItem(VOICE_PACK_PROMPT_KEY, "1");
    setShowVoicePackPrompt(false);
    const r = await openVoiceInputSettings();
    if (!r.ok) {
      setVoiceError("لم أستطع فتح إعدادات الكلام في هذا الهاتف — افتح الإعدادات ثم ابحث عن «التعرّف دون اتصال» ونزّل العربية.");
    }
  }, []);

  const handleVoicePackListenNow = useCallback(() => {
    localStorage.setItem(VOICE_PACK_PROMPT_KEY, "1");
    setShowVoicePackPrompt(false);
    startListening();
  }, [startListening]);

  // Persistent one-tap shortcut (native only) under the offline note.
  const handleVoicePackInstallLink = useCallback(async () => {
    const r = await openVoiceInputSettings();
    if (!r.ok) {
      setVoiceError("لم أستطع فتح إعدادات الكلام في هذا الهاتف — افتح الإعدادات ثم ابحث عن «التعرّف دون اتصال» ونزّل العربية.");
    }
  }, []);
  // ---- [/1.0.109 voice search] ----

  const doSearch = useCallback(async (q: string, currentTab: SearchTab) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    // Skip a repeat of the exact same search (live search + submit).
    if (trimmed === lastQueryRef.current && currentTab === "quran" && detailed) return;
    if (trimmed === lastQueryRef.current && currentTab === "athkar" && athkarResults.length > 0) return;

    lastQueryRef.current = trimmed;
    setLoading(true);
    setError(null);
    setSearched(true);
    setDetailed(null);
    setResults([]);
    setAthkarResults([]);
    setVisibleCount(PAGE_SIZE);

    if (currentTab === "athkar") {
      const ar = searchAthkar(trimmed);
      setAthkarResults(ar);
      setLoading(false);
      return;
    }

    // Offline search over the bundled Uthmani text — every matching ayah,
    // with the number of occurrences in each ayah and the totals.
    const d = searchQuranDetailed(trimmed, getStoredQirahId());
    setDetailed(d);
    const mapped: SearchResult[] = d.hits
      .map((h: QuranSearchHitDetailed) => {
        const surah = SURAHS.find((s) => s.number === h.surahNumber);
        if (!surah) return null;
        return {
          number: h.number,
          numberInSurah: h.numberInSurah,
          text: h.text,
          surahNumber: h.surahNumber,
          surahName: surah.name,
          juz: getJuzNumber(getGlobalAyahNumber(h.surahNumber, h.numberInSurah)),
          occurrences: h.occurrences,
        };
      })
      .filter(Boolean) as SearchResult[];
    setResults(mapped);
    setLoading(false);
  }, [detailed, athkarResults.length]);

  // [1.0.109 voice search] When a voice session ends with a fresh final
  // transcript, put it in the search box and run the same search the
  // typed query runs (TajweedChecker pattern: act on the true→false
  // listening flip with a changed transcript). Placed after doSearch —
  // the effect's dependency array reads it.
  useEffect(() => {
    const justStopped = prevVoiceListeningRef.current && !voiceState.isListening;
    const transcript = voiceState.transcript.trim();
    const changed = transcript !== prevVoiceTranscriptRef.current;
    if (justStopped && transcript.length > 0 && changed) {
      prevVoiceTranscriptRef.current = transcript;
      setQuery(transcript);
      void doSearch(transcript, tab);
    }
    prevVoiceListeningRef.current = voiceState.isListening;
    if (voiceState.error) setVoiceError(voiceState.error);
  }, [voiceState.isListening, voiceState.transcript, voiceState.error, tab, doSearch]);

  // Live search as the user types (debounced), so results appear while
  // typing without a search on every keystroke — in both tabs (the
  // athkar tab used to search only on submit or tab switch).
  // [1.0.74] Plain-text mode only: first/last-word modes have their own
  // debounced effect below, and topic/rhyme/makki/revelation are browse
  // modes that filter live without a search call.
  useEffect(() => {
    if (tab === "quran" && mode !== "text") return;
    const trimmed = query.trim();
    if (!trimmed) {
      setDetailed(null);
      setResults([]);
      setAthkarResults([]);
      setSearched(false);
      lastQueryRef.current = "";
      return;
    }
    const t = setTimeout(() => { doSearch(query, tab); }, 600);
    return () => clearTimeout(t);
  }, [query, tab, mode, doSearch]);

  // [1.0.74 advanced search] First-word / last-word search (debounced
  // like the text search). Runs over the bundled text, fully offline.
  useEffect(() => {
    if (tab !== "quran" || (mode !== "first" && mode !== "last")) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      const hits = mode === "first" ? searchByFirstWord(trimmed) : searchByLastWord(trimmed);
      setResults(hits);
      setDetailed(null);
      setSearched(true);
      setVisibleCount(PAGE_SIZE);
      setLoading(false);
    }, 600);
    return () => clearTimeout(t);
  }, [query, tab, mode]);

  // Infinite scroll: load more results as the user reaches the end.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || results.length <= visibleCount) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + 100, results.length));
        }
      },
      { rootMargin: "400px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [results.length, visibleCount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // [1.0.74] Non-text Quran modes filter/browse live. Submitting runs
    // the first/last-word search at once (topic/rhyme already filter live).
    if (tab === "quran" && mode !== "text") {
      if (mode === "first" || mode === "last") {
        const hits = mode === "first" ? searchByFirstWord(query) : searchByLastWord(query);
        setResults(hits);
        setDetailed(null);
        setSearched(true);
        setVisibleCount(PAGE_SIZE);
      }
      return;
    }
    doSearch(query, tab);
  };

  const handleRetry = () => {
    doSearch(lastQueryRef.current || query, tab);
  };

  const handleTabChange = (newTab: SearchTab) => {
    setTab(newTab);
    setSearched(false);
    setDetailed(null);
    setResults([]);
    setAthkarResults([]);
    setError(null);
    setVisibleCount(PAGE_SIZE);
    if (query.trim()) {
      doSearch(query, newTab);
    }
  };

  const handleSuggestion = (word: string) => {
    setQuery(word);
    doSearch(word, "quran");
  };

  // [1.0.74 advanced search] Switching modes clears the previous mode's
  // results/selection; the query text itself is kept, so typing a word
  // and switching modes re-uses it (e.g. first-word -> last-word).
  const handleModeChange = (newMode: typeof mode) => {
    setMode(newMode);
    setSelectedTopic(null);
    setSelectedSurahTopics(null);
    setSelectedSection(null);
    setSelectedRhyme(null);
    setShowAllTopics(false);
    setShowAllRhymes(false);
    setDetailed(null);
    setResults([]);
    setAthkarResults([]);
    setSearched(false);
    setError(null);
    setVisibleCount(PAGE_SIZE);
    lastQueryRef.current = "";
  };

  const handleSelectTopic = (topic: QuranTopic) => {
    setSelectedTopic(topic);
    setResults(getTopicResults(topic));
    setSearched(true);
    setVisibleCount(PAGE_SIZE);
  };

  // [1.0.108] Surah-topics mode: pick a section, see its ayahs (tap an
  // ayah to go to it — the shared results list below renders them).
  const handleSelectSection = (surah: number, section: SurahSection) => {
    setSelectedSection({ surah, section });
    const out: SearchResult[] = [];
    for (let a = section.start; a <= section.end; a++) {
      const r = ayahRefToResult(surah, a);
      if (r) out.push(r);
    }
    setResults(out);
    setSearched(true);
    setVisibleCount(PAGE_SIZE);
  };

  // [1.0.108] A topic tapped from a surah without a section outline:
  // switch to the topic view and show that topic's ayahs.
  const handleSelectTopicFromSurah = (topic: QuranTopic) => {
    setSelectedSurahTopics(null);
    setSelectedSection(null);
    setMode("topic");
    handleSelectTopic(topic);
  };

  const handleSelectRhyme = (ending: string) => {
    setSelectedRhyme(ending);
    setResults(searchByRhyme(ending));
    setSearched(true);
    setVisibleCount(PAGE_SIZE);
  };

  // [1.0.74] Live-filtered lists for the browse modes.
  const topicList = useMemo(() => {
    if (mode !== "topic" || selectedTopic) return [];
    return searchTopics74(query);
  }, [mode, query, selectedTopic]);

  const rhymeGroups = useMemo(() => (mode === "rhyme" ? getRhymeGroups() : []), [mode]);
  const filteredRhymes = useMemo(() => {
    const q = normalizeArabic(cleanSearchQuery(query.trim()), false);
    if (!q) return rhymeGroups;
    return rhymeGroups.filter((g) => g.ending.includes(q));
  }, [rhymeGroups, query]);

  // [1.0.108] Surah-topics mode: surahs filtered by name or number, and
  // the topics covering one surah (fallback for surahs with no outline).
  const surahTopicsList = useMemo(() => {
    if (mode !== "surah-topics" || selectedSurahTopics) return [];
    const rawQ = query.trim();
    if (!rawQ) return SURAHS;
    const numQ = rawQ
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[^\d]/g, "");
    const q = normalizeArabic(cleanSearchQuery(rawQ), false);
    return SURAHS.filter((s) => {
      if (q && normalizeArabic(s.name, false).includes(q)) return true;
      if (numQ && String(s.number).includes(numQ)) return true;
      return false;
    });
  }, [mode, query, selectedSurahTopics]);

  const surahFallbackTopics = useMemo(() => {
    if (mode !== "surah-topics" || selectedSurahTopics === null) return [];
    const sn = selectedSurahTopics;
    const withCount = TOPICS.map((t) => {
      let n = 0;
      for (const ref of getTopicAyahRefs(t)) if (ref.surah === sn) n++;
      return { topic: t, count: n };
    }).filter((x) => x.count > 0);
    withCount.sort((a, b) => b.count - a.count);
    return withCount;
  }, [mode, selectedSurahTopics]);

  const makkiSurahs = useMemo(
    () => SURAHS.filter((s) => makkiFilter === "all" || s.revelationType === makkiFilter),
    [makkiFilter]
  );
  const makkiCounts = useMemo(() => {
    const c = { all: SURAHS.length, Meccan: 0, Medinan: 0, Disputed: 0 } as Record<RevelationType | "all", number>;
    for (const s of SURAHS) c[s.revelationType]++;
    return c;
  }, []);

  const totalResults = tab === "quran" ? results.length : athkarResults.length;
  const visibleResults = results.slice(0, visibleCount);

  // Per-surah hit counts, for the surah group headers.
  const perSurahCount = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of results) m.set(r.surahNumber, (m.get(r.surahNumber) ?? 0) + 1);
    return m;
  }, [results]);

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

        {/* [1.0.74 advanced search] Search modes inside the Quran tab */}
        {tab === "quran" && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-5 -mx-1 px-1" dir="rtl">
            {MODES74.map(({ id, label, Icon }) => (
              <button
                key={id}
                data-mode={id}
                data-testid={`mode-${id}`}
                onClick={() => handleModeChange(id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-arabic flex items-center gap-1.5 border transition-colors ${
                  mode === id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* [1.0.74] Makki/Madani + revelation-order + root are browse modes — no query input */}
        {!(tab === "quran" && (mode === "makki" || mode === "revelation" || mode === "root")) && (
        <form onSubmit={handleSubmit} className="mb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="search"
                placeholder={tab === "quran" ? (MODE_PLACEHOLDERS74[mode] ?? "اكتب كلمة أو عبارة أو الصق آية كاملة للبحث في القرآن...") : "ابحث في الأذكار والأدعية..."}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-card border border-border rounded-xl pr-10 pl-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground font-arabic"
                dir="rtl"
              />
            </div>
            {/* [1.0.109 voice search] Mic button beside the search box:
                tap to listen (ar-SA), tap again to stop; the recognised
                text runs the same search as a typed query. */}
            <button
              type="button"
              data-testid="voice-search-btn"
              aria-label={voiceState.isListening ? "إيقاف الاستماع" : "بحث صوتي"}
              onClick={handleVoiceToggle}
              className={`px-4 py-3 rounded-xl transition-colors flex items-center justify-center ${
                voiceState.isListening
                  ? "bg-destructive text-destructive-foreground animate-pulse"
                  : "bg-card border border-border text-primary hover:border-primary/50"
              }`}
            >
              <Mic className="w-5 h-5" />
            </button>
            <button
              type="submit"
              disabled={!query.trim() || loading}
              className="px-5 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors font-arabic"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "بحث"}
            </button>
          </div>
          {/* [1.0.109] First-use offline-pack prompt (native only): the
              Arabic offline pack is system data the app cannot bundle or
              download — one tap opens the system screen to download it
              once; «استمع الآن» skips and listens right away. Asked once. */}
          {showVoicePackPrompt && !voiceState.isListening && (
            <div data-testid="voice-pack-prompt" className="mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-3 text-sm text-center">
              <div className="text-amber-800 dark:text-amber-300 mb-2">
                للبحث الصوتي دون إنترنت: نزّل حزمة العربية مرة واحدة من إعدادات الكلام في النظام — أو استمع الآن وسيعمل البحث الصوتي متى توفرت الخدمة.
              </div>
              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  data-testid="voice-pack-open-settings"
                  onClick={handleVoicePackOpenSettings}
                  className="px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-arabic hover:bg-primary/90 transition-colors"
                >
                  فتح إعدادات الكلام
                </button>
                <button
                  type="button"
                  data-testid="voice-pack-listen-now"
                  onClick={handleVoicePackListenNow}
                  className="px-3.5 py-2 bg-card border border-border rounded-lg text-sm font-arabic text-primary hover:border-primary/50 transition-colors"
                >
                  استمع الآن
                </button>
              </div>
            </div>
          )}
          {/* [1.0.109] Listening status — interim transcript while speaking.
              [1.0.110] تبقى «أستمع…» ظاهرة أثناء إعادة التشغيل التلقائي
              (isListening لا تُقلب بين الجلسات)، مع تذكير أن الضغطة
              توقف وتبحث فوراً عن ما التُقط حتى الآن. */}
          {voiceState.isListening && (
            <div data-testid="voice-listening" className="mt-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 text-sm text-center">
              <span className="inline-flex items-center gap-1.5 text-primary font-arabic">
                <Mic className="w-4 h-4 animate-pulse" />
                أستمع… تكلّم الآن — اضغط الميكروفون للإيقاف والبحث فوراً
              </span>
              {voiceState.interimTranscript && (
                <span className="block mt-1 text-muted-foreground font-arabic">«{voiceState.interimTranscript}»</span>
              )}
            </div>
          )}
          {/* [1.0.109] Voice failure is shown in the page itself, never
              silent: no speech service, no mic permission, no speech. */}
          {voiceError && !voiceState.isListening && (
            <div data-testid="voice-error" className="mt-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl px-4 py-3 text-sm text-center">
              <div className="mb-2">{voiceError}</div>
              <div className="flex gap-2 justify-center">
                {/* [1.0.110] بعد جلسات ميتة متتالية: إعادة محاولة من هنا. */}
                <button
                  type="button"
                  data-testid="voice-error-retry"
                  onClick={() => { setVoiceError(null); startListening(); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs transition-colors"
                >
                  إعادة المحاولة
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceError(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 hover:bg-destructive/20 rounded-lg text-xs transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </div>
          )}
          {/* [1.0.109] Honest offline note: the search itself is fully
              offline; only speech-to-text goes through the phone's speech
              service and may need internet unless the Arabic offline pack
              is installed on the device. */}
          <div data-testid="voice-offline-note" className="mt-2 text-xs text-muted-foreground text-center">
            البحث الصوتي: تحويل الصوت إلى نص يتم بخدمة الكلام في الهاتف، وقد يحتاج إنترنت إن لم تكن حزمة العربية دون اتصال مثبّتة — أما البحث نفسه فيعمل دون إنترنت دائماً.
          </div>
          {/* [1.0.109] Persistent one-tap shortcut to the system screen
              (native only) — download the Arabic pack once, then voice
              search works fully offline. */}
          {isVoiceSettingsAvailable() && (
            <div className="mt-1.5 text-center">
              <button
                type="button"
                data-testid="voice-pack-install-link"
                onClick={handleVoicePackInstallLink}
                className="text-xs text-primary hover:underline font-arabic"
              >
                تثبيت حزمة العربية للبحث دون إنترنت
              </button>
            </div>
          )}
        </form>
        )}

        {/* Popular words */}
        {tab === "quran" && mode === "text" && !searched && (
          <div className="mb-6">
            <div className="text-xs text-muted-foreground mb-2 text-center">كلمات يبحث عنها كثيرًا — اضغط للبحث مباشرة</div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((w) => (
                <button
                  key={w}
                  onClick={() => handleSuggestion(w)}
                  className="px-3.5 py-1.5 bg-card border border-border rounded-full text-sm font-arabic text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        )}

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

        {/* Summary card: how many times the word/phrase occurs, and where.
            [1.0.108] The label adapts: one word = «كلمة», several = «عبارة». */}
        {searched && !loading && !error && tab === "quran" && mode === "text" && detailed && detailed.totalOccurrences > 0 && (
          <div className="mb-5 bg-primary/5 border border-primary/20 rounded-2xl px-5 py-4 text-center">
            <div className="text-sm text-muted-foreground mb-1">
              {cleanSearchQuery(detailed.query).split(/\s+/).filter(Boolean).length > 1 ? "عبارة" : "كلمة"} «<span className="text-primary font-arabic">{detailed.query}</span>» ذُكرت
            </div>
            <div className="flex items-center justify-center gap-2">
              <Hash className="w-5 h-5 text-primary" />
              <span className="text-4xl font-bold text-primary font-arabic">{toArabicNum(detailed.totalOccurrences)}</span>
              <span className="text-lg text-primary font-arabic">مرة</span>
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              في {toArabicNum(detailed.ayahCount)} آية • في {toArabicNum(detailed.surahCount)} سورة
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              اضغط على أي آية للانتقال إليها في المصحف
            </div>
          </div>
        )}

        {searched && !loading && !error && tab === "quran" && detailed && detailed.totalOccurrences === 0 && (
          <div className="mb-4 text-sm text-muted-foreground text-center">
            لم يُعثر على نتائج لـ «{query}»
          </div>
        )}

        {searched && !loading && !error && tab === "athkar" && (
          <div className="mb-4 text-sm text-muted-foreground">
            {totalResults > 0
              ? `وُجد ${toArabicNum(totalResults)} نتيجة لـ "${query}"`
              : `لم يُعثر على نتائج لـ "${query}"`}
          </div>
        )}

        {/* ---- [1.0.74 advanced search] Mode panels ---- */}

        {/* [1.0.74] Root search: every ayah containing a word from this root */}
        {tab === "quran" && mode === "root" && (
          <RootSearch onNavigateAyah={(sn, an) => navigate(`/surah/${sn}?ayah=${an}`)} />
        )}

        {/* Topic search: browse / filter the topic list, tap a topic for its ayahs */}
        {tab === "quran" && mode === "topic" && !selectedTopic && (
          <>
            <div data-testid="topics-coverage-note" className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 rounded-xl px-4 py-3 text-sm text-center">
              {TOPIC_COVERAGE_NOTE}
            </div>
            <div className="mb-3 text-sm text-muted-foreground text-center">
              {query.trim()
                ? `وُجد ${toArabicNum(topicList.length)} موضوع لـ «${query.trim()}»`
                : `${toArabicNum(topicList.length)} موضوع — مرتبة حسب عدد الآيات`}
            </div>
            <div className="space-y-2 mb-5">
              {(showAllTopics ? topicList : topicList.slice(0, 100)).map((t) => (
                <button
                  key={t.id}
                  data-testid="topic-row"
                  data-topic-id={t.id}
                  onClick={() => handleSelectTopic(t)}
                  className="w-full bg-card border border-border rounded-2xl px-4 py-3 hover:border-primary/40 transition-colors text-right"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-arabic text-base text-foreground">{t.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">
                      {toArabicNum(getTopicAyahCount(t))} آية
                    </span>
                  </div>
                  {getTopicParentName(t) && (
                    <div className="text-xs text-muted-foreground mt-1">ضمن: {getTopicParentName(t)}</div>
                  )}
                  {/* [1.0.108] QUL topics (the 40-114 completion layer) show
                      their source; Quranpedia topics keep the old look. */}
                  {t.source && t.source !== "quranpedia" && (
                    <div className="text-xs text-muted-foreground mt-1">المصدر: {getTopicSourceLabel(t)}</div>
                  )}
                </button>
              ))}
            </div>
            {topicList.length > 100 && !showAllTopics && (
              <div className="text-center mb-5">
                <button
                  onClick={() => setShowAllTopics(true)}
                  className="px-4 py-2 bg-card border border-border rounded-xl text-sm font-arabic text-primary hover:border-primary/50 transition-colors"
                >
                  عرض كل المواضيع ({toArabicNum(topicList.length)})
                </button>
              </div>
            )}
            {topicList.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">لا توجد مواضيع مطابقة — جرّب كلمة أخرى</div>
            )}
          </>
        )}

        {/* A topic's ayahs */}
        {tab === "quran" && mode === "topic" && selectedTopic && (
          <div className="mb-4">
            <button
              onClick={() => { setSelectedTopic(null); setResults([]); setSearched(false); }}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-3"
            >
              <ArrowRight className="w-4 h-4" />
              كل المواضيع
            </button>
            <div data-testid="topics-coverage-note" className="mb-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 rounded-xl px-4 py-3 text-sm text-center">
              {TOPIC_COVERAGE_NOTE}
            </div>
            <div className="text-center mb-1">
              <span className="font-arabic text-lg text-primary">موضوع «{selectedTopic.name}»</span>
            </div>
            <div className="text-sm text-muted-foreground text-center">
              {toArabicNum(results.length)} آية في هذا الموضوع
              {getTopicParentName(selectedTopic) ? ` — ضمن: ${getTopicParentName(selectedTopic)}` : ""}
              {selectedTopic.source && selectedTopic.source !== "quranpedia" ? ` — المصدر: ${getTopicSourceLabel(selectedTopic)}` : ""}
            </div>
          </div>
        )}

        {/* [1.0.108] Surah topics (مواضيع السور): every surah split into
            its topics, with the ayah range each covers — 741 sections in
            111 surahs. Surahs 1, 42, 44 have no outline in the source, so
            their QUL topics are shown instead (never an invented outline). */}
        {tab === "quran" && mode === "surah-topics" && selectedSurahTopics === null && (
          <>
            <div data-testid="surah-topics-coverage-note" className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 rounded-xl px-4 py-3 text-sm text-center">
              مواضيع السور — {toArabicNum(SURAHS_WITH_SECTIONS_COUNT)} سورة لها تقسيم مواضيع ({toArabicNum(TOTAL_SURAH_SECTIONS)} موضوعاً) • السور {SURAHS_WITHOUT_SECTIONS.map(toArabicNum).join(" و")} بلا تقسيم مفصّل في المصدر • المصدر: مكتبة القرآن العالمية (QUL)
            </div>
            <div className="mb-3 text-sm text-muted-foreground text-center">
              {query.trim()
                ? `وُجدت ${toArabicNum(surahTopicsList.length)} سورة لـ «${query.trim()}»`
                : `${toArabicNum(surahTopicsList.length)} سورة — اختر سورة لعرض مواضيعها`}
            </div>
            <div className="space-y-2 mb-5">
              {surahTopicsList.map((s) => {
                const sections = SURAH_SECTIONS[s.number] ?? [];
                return (
                  <button
                    key={s.number}
                    data-testid="surah-topic-row"
                    data-surah={s.number}
                    onClick={() => { setSelectedSurahTopics(s.number); setSelectedSection(null); setResults([]); setSearched(false); }}
                    className="w-full bg-card border border-border rounded-2xl px-4 py-3 hover:border-primary/40 transition-colors text-right"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-arabic text-base text-foreground">
                        {toArabicNum(s.number)} — سورة {s.name}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">
                        {sections.length > 0
                          ? `${toArabicNum(sections.length)} موضوعاً`
                          : "لا يوجد تقسيم مفصّل"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{toArabicNum(s.numberOfAyahs)} آية</div>
                  </button>
                );
              })}
            </div>
            {surahTopicsList.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">لا توجد سور مطابقة — جرّب كلمة أخرى</div>
            )}
          </>
        )}

        {/* A surah's sections (or its QUL topics when it has no outline) */}
        {tab === "quran" && mode === "surah-topics" && selectedSurahTopics !== null && !selectedSection && (
          <div className="mb-4">
            <button
              onClick={() => { setSelectedSurahTopics(null); setResults([]); setSearched(false); }}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-3"
            >
              <ArrowRight className="w-4 h-4" />
              كل السور
            </button>
            <div className="text-center mb-1">
              <span className="font-arabic text-lg text-primary">
                مواضيع سورة {SURAHS.find((s) => s.number === selectedSurahTopics)?.name}
              </span>
            </div>
            <div className="text-sm text-muted-foreground text-center mb-4">
              {getSurahSections(selectedSurahTopics).length > 0
                ? `${toArabicNum(getSurahSections(selectedSurahTopics).length)} موضوعاً — اضغط على موضوع لعرض آياته`
                : "لا يوجد تقسيم مواضيع مفصّل لهذه السورة في المصدر — هذه مواضيع السورة من مكتبة القرآن العالمية:"}
            </div>
            {getSurahSections(selectedSurahTopics).length > 0 ? (
              <div className="space-y-2 mb-5">
                {getSurahSections(selectedSurahTopics).map((sec, idx) => (
                  <button
                    key={`${sec.start}-${sec.end}-${idx}`}
                    data-testid="surah-section-row"
                    data-section-start={sec.start}
                    data-section-end={sec.end}
                    onClick={() => handleSelectSection(selectedSurahTopics, sec)}
                    className="w-full bg-card border border-border rounded-2xl px-4 py-3 hover:border-primary/40 transition-colors text-right"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-arabic text-base text-foreground">{sec.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">
                        {toArabicNum(sec.end - sec.start + 1)} آية
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      الآيات {toArabicNum(sec.start)}–{toArabicNum(sec.end)}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2 mb-5">
                {surahFallbackTopics.map(({ topic, count }) => (
                  <button
                    key={topic.id}
                    data-testid="topic-row"
                    data-topic-id={topic.id}
                    onClick={() => handleSelectTopicFromSurah(topic)}
                    className="w-full bg-card border border-border rounded-2xl px-4 py-3 hover:border-primary/40 transition-colors text-right"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-arabic text-base text-foreground">{topic.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">
                        {toArabicNum(count)} آية في هذه السورة
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* A section's ayahs */}
        {tab === "quran" && mode === "surah-topics" && selectedSection && (
          <div className="mb-4">
            <button
              onClick={() => { setSelectedSection(null); setResults([]); setSearched(false); }}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-3"
            >
              <ArrowRight className="w-4 h-4" />
              مواضيع سورة {SURAHS.find((s) => s.number === selectedSection.surah)?.name}
            </button>
            <div className="text-center mb-1">
              <span className="font-arabic text-lg text-primary">{selectedSection.section.title}</span>
            </div>
            <div className="text-sm text-muted-foreground text-center">
              الآيات {toArabicNum(selectedSection.section.start)}–{toArabicNum(selectedSection.section.end)} • {toArabicNum(results.length)} آية
            </div>
          </div>
        )}

        {/* Makki / Madani filter: browse surahs by revelation type */}
        {tab === "quran" && mode === "makki" && (
          <>
            <div className="flex gap-1.5 flex-wrap justify-center mb-4">
              {([
                { id: "all" as const, label: "الكل" },
                { id: "Meccan" as const, label: "مكية" },
                { id: "Medinan" as const, label: "مدنية" },
                { id: "Disputed" as const, label: "مختلف فيها" },
              ]).map(({ id, label }) => (
                <button
                  key={id}
                  data-testid={`makki-filter-${id}`}
                  onClick={() => setMakkiFilter(id)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-arabic border transition-colors ${
                    makkiFilter === id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label} ({toArabicNum(makkiCounts[id])})
                </button>
              ))}
            </div>
            <div className="mb-3 text-sm text-muted-foreground text-center">
              {toArabicNum(makkiSurahs.length)} سورة
              {makkiFilter === "Meccan" ? " مكية" : makkiFilter === "Medinan" ? " مدنية" : makkiFilter === "Disputed" ? " مختلف فيها" : ""}
            </div>
            <div className="space-y-2 mb-5">
              {makkiSurahs.map((s) => (
                <button
                  key={s.number}
                  data-testid="surah-row"
                  data-surah={s.number}
                  onClick={() => navigate(`/surah/${s.number}`)}
                  className="w-full bg-card border border-border rounded-2xl px-4 py-3 hover:border-primary/40 transition-colors text-right"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-arabic text-base text-foreground">
                      {toArabicNum(s.number)} — سورة {s.name}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                      s.revelationType === "Meccan"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        : s.revelationType === "Medinan"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                    }`}>
                      {s.revelationType === "Meccan" ? "مكية" : s.revelationType === "Medinan" ? "مدنية" : "مختلف فيها"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{toArabicNum(s.numberOfAyahs)} آية</div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Revelation-order browse: surahs in the order they were revealed */}
        {tab === "quran" && mode === "revelation" && (
          <>
            <div className="mb-3 text-sm text-muted-foreground text-center">
              سور القرآن بترتيب النزول — أول ما نزل سورة العلق
            </div>
            <div className="space-y-2 mb-5">
              {REVELATION_ORDER.map((surahNum, idx) => {
                const s = SURAHS.find((x) => x.number === surahNum)!;
                return (
                  <button
                    key={surahNum}
                    data-testid="surah-row"
                    data-surah={surahNum}
                    data-revelation-order={idx + 1}
                    onClick={() => navigate(`/surah/${surahNum}`)}
                    className="w-full bg-card border border-border rounded-2xl px-4 py-3 hover:border-primary/40 transition-colors text-right"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-arabic flex-shrink-0">
                        {toArabicNum(idx + 1)}
                      </span>
                      <span className="font-arabic text-base text-foreground flex-1">
                        سورة {s.name}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        السورة {toArabicNum(s.number)} في المصحف • {toArabicNum(s.numberOfAyahs)} آية
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* First-word / last-word result count */}
        {tab === "quran" && (mode === "first" || mode === "last") && searched && !loading && (
          <div className="mb-4 text-sm text-muted-foreground text-center">
            {results.length > 0
              ? `وُجد ${toArabicNum(results.length)} آية ${mode === "first" ? "تبدأ" : "تنتهي"} بـ «${query.trim()}»`
              : `لا توجد آيات ${mode === "first" ? "تبدأ" : "تنتهي"} بـ «${query.trim()}»`}
          </div>
        )}

        {/* Rhyme endings (الفاصلة): pick an ending, see its ayahs */}
        {tab === "quran" && mode === "rhyme" && !selectedRhyme && (
          <>
            <div className="mb-3 text-sm text-muted-foreground text-center">
              نهايات الآيات (الفاصلة) — اختر نهاية لعرض الآيات التي تنتهي بها
              {query.trim() ? ` — ${toArabicNum(filteredRhymes.length)} نهاية مطابقة` : ` — ${toArabicNum(rhymeGroups.length)} نهاية مميزة`}
            </div>
            <div className="space-y-2 mb-5">
              {(showAllRhymes ? filteredRhymes : filteredRhymes.slice(0, 80)).map((g) => (
                <button
                  key={g.ending}
                  data-testid="rhyme-row"
                  data-rhyme={g.ending}
                  onClick={() => handleSelectRhyme(g.ending)}
                  className="w-full bg-card border border-border rounded-2xl px-4 py-3 hover:border-primary/40 transition-colors text-right"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="quran-text text-lg text-foreground">...{g.ending}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">
                      {toArabicNum(g.count)} آية
                    </span>
                  </div>
                </button>
              ))}
            </div>
            {filteredRhymes.length > 80 && !showAllRhymes && (
              <div className="text-center mb-5">
                <button
                  onClick={() => setShowAllRhymes(true)}
                  className="px-4 py-2 bg-card border border-border rounded-xl text-sm font-arabic text-primary hover:border-primary/50 transition-colors"
                >
                  عرض كل النهايات ({toArabicNum(filteredRhymes.length)})
                </button>
              </div>
            )}
            {filteredRhymes.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">لا توجد نهايات مطابقة — جرّب كلمة أخرى</div>
            )}
          </>
        )}

        {/* A rhyme ending's ayahs */}
        {tab === "quran" && mode === "rhyme" && selectedRhyme && (
          <div className="mb-4">
            <button
              onClick={() => { setSelectedRhyme(null); setResults([]); setSearched(false); }}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-3"
            >
              <ArrowRight className="w-4 h-4" />
              كل النهايات
            </button>
            <div className="text-center">
              <span className="font-arabic text-lg text-primary">آيات تنتهي بـ «{selectedRhyme}»</span>
            </div>
            <div className="text-sm text-muted-foreground text-center">
              {toArabicNum(results.length)} آية
            </div>
          </div>
        )}

        {/* ---- [/1.0.74 advanced search] ---- */}

        {!loading && tab === "quran" && visibleResults.length > 0 && (
          <div className="space-y-3">
            {visibleResults.map((r, idx) => {
              const prev = idx > 0 ? visibleResults[idx - 1] : null;
              const showHeader = !prev || prev.surahNumber !== r.surahNumber;
              return (
                <div key={`${r.surahNumber}:${r.numberInSurah}`}>
                  {showHeader && (
                    <div className="flex items-center justify-between px-1 pt-2 pb-1">
                      <span className="font-arabic text-base text-primary">
                        سورة {r.surahName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {mode === "text"
                          ? `${toArabicNum(perSurahCount.get(r.surahNumber) ?? 0)} آية فيها «${detailed?.query}»`
                          : `${toArabicNum(perSurahCount.get(r.surahNumber) ?? 0)} آية`}
                      </span>
                    </div>
                  )}
                  <ResultCard result={r} query={query} />
                </div>
              );
            })}
            {/* Infinite-scroll sentinel */}
            {results.length > visibleCount && (
              <div ref={sentinelRef} className="py-4 text-center text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin inline-block ml-2 text-primary" />
                عرض {toArabicNum(visibleCount)} من {toArabicNum(results.length)} آية...
              </div>
            )}
            {results.length > 0 && visibleCount >= results.length && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                هذه كل الآيات — {toArabicNum(results.length)} آية
              </div>
            )}
          </div>
        )}

        {!loading && tab === "athkar" && athkarResults.length > 0 && (
          <div className="space-y-3">
            {athkarResults.map((r) => (
              <AthkarResultCard key={`${r.categoryId}-${r.dhikrId}`} result={r} query={query} />
            ))}
          </div>
        )}

        {/* [1.0.74] First/last-word modes show their own "no ayahs" line
            above, so the generic empty state stays with text/athkar. */}
        {searched && !loading && totalResults === 0 && !error && (mode === "text" || tab === "athkar") && (
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
