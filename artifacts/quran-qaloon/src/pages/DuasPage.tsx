import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "wouter";
import {
  ArrowRight, Moon, Sun, Minus, Plus, Star, Copy, Share2, Check,
  Play, Pause, HandHeart, BookOpen, Search, X, Square,
} from "lucide-react";
import { ATHKAR_CATEGORIES } from "@/data/athkar";
import { HISN_CHAPTERS, HISN_DUAS, HISN_FULL_BOOK, QURAN_DUAS_EXTRA } from "@/data/duas";
import { getAyah } from "@/data/quran-text";
import AyahFromAPI from "@/components/AyahFromAPI";

function urlForKey(key: PlayKey): string | null {
  if (key.startsWith("ch:")) {
    const n = Number(key.slice(3));
    return HISN_CHAPTERS[n - 1]?.audio ?? null;
  }
  return HISN_FULL_BOOK[Number(key.slice(3)) - 1]?.url ?? null;
}

interface DuasPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

/** Diacritic-insensitive Arabic normalisation, same idea as the Quran search. */
function normalizeAr(s: string): string {
  return s
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي");
}

/**
 * Strip the attached article/preposition (ال / لل / ل) from each word, so
 * a search for «الوالدين» also finds «للوالدين» — in connected writing the
 * hamzat waṣl of ال disappears after ل, so the plain substring never matches.
 */
function stripArticles(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => w.replace(/^(لل|ال|ل)/, ""))
    .join(" ");
}

type TextDuaItem = {
  key: string;
  kind: "text" | "ayah";
  text?: string;
  surah?: number;
  from?: number;
  to?: number;
  label?: string;
  source?: string;
  count?: number;
  group: string;
  chapter?: number;
};

function dhikrToItems(
  catId: string,
  group: string,
): TextDuaItem[] {
  const cat = ATHKAR_CATEGORIES.find((c) => c.id === catId);
  if (!cat) return [];
  const out: TextDuaItem[] = [];
  for (const item of cat.items) {
    const first = item.content[0];
    if (!first) continue;
    if (first.type === "text") {
      out.push({
        key: `athkar:${catId}:${item.id}`,
        kind: "text",
        text: item.content.map((c) => (c.type === "text" ? c.text : "")).filter(Boolean).join("\n"),
        source: item.source,
        count: item.count,
        group,
      });
    } else {
      out.push({
        key: `athkar:${catId}:${item.id}`,
        kind: "ayah",
        surah: first.surah,
        from: first.from,
        to: first.to,
        label: first.label,
        source: item.source,
        count: item.count,
        group,
      });
    }
  }
  return out;
}

const TEXT_CATEGORIES: { id: string; name: string; icon: string; color: string; description: string; items: TextDuaItem[] }[] = [
  {
    id: "quran",
    name: "أدعية قرآنية",
    icon: "📖",
    color: "sky",
    description: "أدعية وردت في القرآن الكريم على لسان الأنبياء والصالحين",
    items: [
      ...dhikrToItems("quran_adiya", "أدعية قرآنية"),
      ...QURAN_DUAS_EXTRA.map((q, i) => ({
        key: `quran-extra:${q.surah}:${q.from}`,
        kind: "ayah" as const,
        surah: q.surah,
        from: q.from,
        to: q.to,
        label: q.label,
        source: q.source,
        group: "أدعية قرآنية",
      })),
    ],
  },
  {
    id: "mathura",
    name: "أدعية مأثورة",
    icon: "🤲",
    color: "rose",
    description: "أدعية نبوية جامعة لخير الدنيا والآخرة",
    items: dhikrToItems("adiya", "أدعية مأثورة"),
  },
  {
    id: "yawmiyya",
    name: "أدعية يومية",
    icon: "☀️",
    color: "orange",
    description: "أدعية متنوعة لأحوال اليوم",
    items: dhikrToItems("yawmiyya", "أدعية يومية"),
  },
  {
    id: "hisn",
    name: "حصن المسلم كاملاً",
    icon: "🛡️",
    color: "emerald",
    description: "كل أدعية كتاب حصن المسلم — ٢٤٠ دعاءً في ١٣٢ باباً",
    items: HISN_DUAS.map((d) => {
      const ch = HISN_CHAPTERS[d.ch - 1];
      return {
        key: `hisn:${d.id}`,
        kind: "text" as const,
        text: d.arabic,
        source: `حصن المسلم — باب ${toArabicNum(d.ch)}: ${ch ? ch.titleAr : ""}`,
        group: "حصن المسلم",
        chapter: d.ch,
      };
    }),
  },
];

const TOTAL_TEXT = TEXT_CATEGORIES.reduce((s, c) => s + c.items.length, 0);
const TOTAL_AUDIO = HISN_CHAPTERS.filter((c) => c.audio).length;

const colorMap: Record<string, string> = {
  amber: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
  emerald: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800",
  orange: "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800",
  rose: "bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800",
  sky: "bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:border-sky-800",
};

const textColorMap: Record<string, string> = {
  amber: "text-amber-700 dark:text-amber-400",
  emerald: "text-emerald-700 dark:text-emerald-400",
  orange: "text-orange-700 dark:text-orange-400",
  rose: "text-rose-700 dark:text-rose-400",
  sky: "text-sky-700 dark:text-sky-400",
};

const bgColorMap: Record<string, string> = {
  amber: "bg-amber-500",
  emerald: "bg-emerald-600",
  orange: "bg-orange-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
};

const borderColorMap: Record<string, string> = {
  amber: "border-amber-300 dark:border-amber-700",
  emerald: "border-emerald-300 dark:border-emerald-700",
  orange: "border-orange-300 dark:border-orange-700",
  rose: "border-rose-300 dark:border-rose-700",
  sky: "border-sky-300 dark:border-sky-700",
};

function loadSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveSet(key: string, s: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...s]));
  } catch {
    // storage unavailable
  }
}

function DuaContentBlock({ item, fontSize }: { item: TextDuaItem; fontSize: number }) {
  if (item.kind === "ayah" && item.surah && item.from) {
    return (
      <AyahFromAPI surah={item.surah} from={item.from} to={item.to} label={item.label ?? ""} />
    );
  }
  return (
    <div className="quran-text text-right leading-loose whitespace-pre-line" style={{ fontSize: `${fontSize}px` }} dir="rtl">
      {item.text}
    </div>
  );
}

type PlayKey = `ch:${number}` | `cd:1` | `cd:2`;

export default function DuasPage({ darkMode, toggleDarkMode }: DuasPageProps) {
  const [tab, setTab] = useState<"text" | "audio">("text");
  const [query, setQuery] = useState("");
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [favs, setFavs] = useState<Set<string>>(() => loadSet("quran_dua_favourites"));
  const [read, setRead] = useState<Set<string>>(() => loadSet("quran_dua_read"));
  const [showFavsOnly, setShowFavsOnly] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [openHisnCh, setOpenHisnCh] = useState<number | null>(null);
  const [fontSize, setFontSize] = useState<number>(() => {
    const stored = localStorage.getItem("athkar_font_size");
    return stored ? Number(stored) : 20;
  });

  // ---- audio ----
  const [playing, setPlaying] = useState<PlayKey | null>(null);
  const [continuous, setContinuous] = useState<boolean>(() => {
    try {
      return localStorage.getItem("quran_dua_continuous") !== "0";
    } catch {
      return true;
    }
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioState, setAudioState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    error: null as string | null,
  });
  const continuousRef = useRef(continuous);
  useEffect(() => {
    continuousRef.current = continuous;
  }, [continuous]);

  // One persistent Audio element, created once: play() is called from the
  // tap handler (inside the user gesture) and the same element keeps
  // playing across chapters, so auto-advance is never blocked by the
  // autoplay policy the way a recreated element would be.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;
    const onTime = () => setAudioState((s) => ({ ...s, currentTime: audio.currentTime }));
    const onMeta = () => setAudioState((s) => ({ ...s, duration: audio.duration || 0 }));
    const onPlay = () => setAudioState((s) => ({ ...s, isPlaying: true, error: null }));
    const onPause = () => setAudioState((s) => ({ ...s, isPlaying: false }));
    const onError = () =>
      setAudioState((s) => ({ ...s, isPlaying: false, error: "تعذّر تحميل الملف الصوتي" }));
    const onEnded = () => {
      setAudioState((s) => ({ ...s, isPlaying: false, currentTime: 0 }));
      if (!continuousRef.current) {
        setPlaying(null);
        return;
      }
      setPlaying((prev) => {
        if (!prev) return null;
        if (prev.startsWith("ch:")) {
          const n = Number(prev.slice(3));
          for (let m = n + 1; m <= 132; m++) {
            if (HISN_CHAPTERS[m - 1]?.audio) return `ch:${m}` as PlayKey;
          }
          return null;
        }
        if (prev === "cd:1") return "cd:2";
        return null;
      });
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("ended", onEnded);
      audioRef.current = null;
    };
  }, []);

  // A new playing key (tap, or auto-advance) loads its URL and plays.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playing) return;
    const url = urlForKey(playing);
    if (!url) return;
    audio.src = url;
    audio.currentTime = 0;
    setAudioState((s) => ({ ...s, currentTime: 0, duration: 0, error: null }));
    audio.play().catch(() => {
      setAudioState((s) => ({ ...s, error: "تعذّر تشغيل الصوت، جرّب إعادة المحاولة" }));
    });
  }, [playing]);

  const stopPlaying = () => {
    audioRef.current?.pause();
    setPlaying(null);
  };

  const setFontSizePersist = (v: number) => {
    setFontSize(v);
    try {
      localStorage.setItem("athkar_font_size", String(v));
    } catch {
      // storage unavailable
    }
  };

  const setContinuousPersist = (v: boolean) => {
    setContinuous(v);
    try {
      localStorage.setItem("quran_dua_continuous", v ? "1" : "0");
    } catch {
      // storage unavailable
    }
  };

  const toggleFav = (key: string) => {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveSet("quran_dua_favourites", next);
      return next;
    });
  };

  const toggleRead = (key: string) => {
    setRead((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveSet("quran_dua_read", next);
      return next;
    });
  };

  const copyDua = async (item: TextDuaItem) => {
    const text = itemText(item);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        // copy unavailable
      }
    }
    setCopiedKey(item.key);
    setTimeout(() => setCopiedKey((k) => (k === item.key ? null : k)), 1500);
  };

  const shareDua = async (item: TextDuaItem) => {
    const text = itemText(item);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch {
      // share cancelled or unavailable — fall through to copy
    }
    await copyDua(item);
  };

  const allTextItems = useMemo(
    () => TEXT_CATEGORIES.flatMap((c) => c.items),
    [],
  );

  const searchResults = useMemo(() => {
    const q = normalizeAr(query.trim());
    if (!q) return [];
    const qStripped = stripArticles(q);
    return allTextItems
      .filter((it) => {
        const hay = normalizeAr(
          `${it.kind === "ayah" ? (it.label ?? "") : (it.text ?? "")} ${it.group} ${it.source ?? ""}`,
        );
        return hay.includes(q) || stripArticles(hay).includes(qStripped);
      })
      .slice(0, 100);
  }, [query, allTextItems]);

  const openCategory = openCat ? TEXT_CATEGORIES.find((c) => c.id === openCat) : null;
  const favItems = allTextItems.filter((it) => favs.has(it.key));

  const playChapter = (n: number) => {
    const ch = HISN_CHAPTERS[n - 1];
    if (!ch?.audio) return;
    const key = `ch:${n}` as PlayKey;
    if (playing === key) {
      const audio = audioRef.current;
      if (!audio) return;
      if (audioState.isPlaying) audio.pause();
      else audio.play().catch(() => {});
      return;
    }
    setPlaying(key);
  };

  const playCd = (idx: 1 | 2) => {
    const key = `cd:${idx}` as PlayKey;
    if (playing === key) {
      const audio = audioRef.current;
      if (!audio) return;
      if (audioState.isPlaying) audio.pause();
      else audio.play().catch(() => {});
      return;
    }
    setPlaying(key);
  };

  const fmtTime = (s: number) => {
    if (!isFinite(s) || s <= 0) return "٠:٠٠";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${toArabicNum(m)}:${sec < 10 ? "٠" : ""}${toArabicNum(sec)}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
          <Link href="/">
            <button className="p-2 rounded-full hover:bg-muted transition-colors">
              <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1 text-center">
            <div className="font-arabic text-base text-primary flex items-center justify-center gap-1.5">
              <HandHeart className="w-5 h-5" /> الأدعية
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5 bg-muted rounded-lg px-1">
              <button
                onClick={() => setFontSizePersist(Math.max(fontSize - 2, 14))}
                disabled={fontSize <= 14}
                className="p-1 rounded hover:bg-background transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="تصغير الخط"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-xs text-muted-foreground w-5 text-center tabular-nums">{fontSize}</span>
              <button
                onClick={() => setFontSizePersist(Math.min(fontSize + 2, 36))}
                disabled={fontSize >= 36}
                className="p-1 rounded hover:bg-background transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="تكبير الخط"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-5">
        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2 mb-4" data-testid="duas-tabs">
          <button
            data-testid="duas-tab-text"
            onClick={() => setTab("text")}
            className={`py-3 rounded-2xl font-arabic text-base transition-all active:scale-95 ${
              tab === "text" ? "bg-primary text-primary-foreground shadow-md" : "bg-card border border-border text-muted-foreground"
            }`}
          >
            📖 أدعية نصية
            <span className="block text-xs opacity-80 mt-0.5">{toArabicNum(TOTAL_TEXT)} دعاءً</span>
          </button>
          <button
            data-testid="duas-tab-audio"
            onClick={() => setTab("audio")}
            className={`py-3 rounded-2xl font-arabic text-base transition-all active:scale-95 ${
              tab === "audio" ? "bg-primary text-primary-foreground shadow-md" : "bg-card border border-border text-muted-foreground"
            }`}
          >
            🔊 أدعية صوتية
            <span className="block text-xs opacity-80 mt-0.5">{toArabicNum(TOTAL_AUDIO)} تسجيلاً + الكتاب كاملاً</span>
          </button>
        </div>

        {tab === "text" && (
          <div>
            {/* Search */}
            <div className="relative mb-4">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                data-testid="duas-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث في الأدعية…"
                className="w-full bg-card border border-border rounded-2xl py-3 pr-10 pl-10 text-right outline-none focus:ring-2 ring-primary/40"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {query.trim() ? (
              <div>
                <div className="text-sm text-muted-foreground mb-3">
                  {searchResults.length > 0
                    ? `${toArabicNum(searchResults.length)} نتيجة`
                    : "لا توجد نتائج مطابقة"}
                </div>
                <div className="space-y-3">
                  {searchResults.map((it) => (
                    <DuaCard
                      key={it.key}
                      item={it}
                      fontSize={fontSize}
                      isFav={favs.has(it.key)}
                      isRead={read.has(it.key)}
                      copied={copiedKey === it.key}
                      onFav={() => toggleFav(it.key)}
                      onRead={() => toggleRead(it.key)}
                      onCopy={() => copyDua(it)}
                      onShare={() => shareDua(it)}
                    />
                  ))}
                </div>
              </div>
            ) : showFavsOnly ? (
              <div>
                <button
                  data-testid="duas-fav-only"
                  onClick={() => setShowFavsOnly(false)}
                  className="mb-3 text-sm text-primary font-arabic"
                >
                  ← عرض كل الأدعية
                </button>
                {favItems.length === 0 ? (
                  <div className="text-center text-muted-foreground py-10">
                    <Star className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    لا أدعية مفضلة بعد — اضغط النجمة على أي دعاء لحفظه هنا
                  </div>
                ) : (
                  <div className="space-y-3">
                    {favItems.map((it) => (
                      <DuaCard
                        key={it.key}
                        item={it}
                        fontSize={fontSize}
                        isFav
                        isRead={read.has(it.key)}
                        copied={copiedKey === it.key}
                        onFav={() => toggleFav(it.key)}
                        onRead={() => toggleRead(it.key)}
                        onCopy={() => copyDua(it)}
                        onShare={() => shareDua(it)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : openCategory ? (
              <div>
                <button
                  onClick={() => {
                    setOpenCat(null);
                    setOpenHisnCh(null);
                  }}
                  className="mb-3 text-sm text-primary font-arabic"
                >
                  ← كل الفئات
                </button>
                <div className="mb-3">
                  <div className="font-arabic text-lg">
                    {openCategory.icon} {openCategory.name}
                  </div>
                  <div className="text-sm text-muted-foreground">{openCategory.description}</div>
                </div>
                {openCategory.id === "hisn" ? (
                  <div className="space-y-2">
                    {HISN_CHAPTERS.map((ch) => {
                      const items = openCategory.items.filter((it) => it.chapter === ch.n);
                      if (items.length === 0) return null;
                      const open = openHisnCh === ch.n;
                      return (
                        <div key={ch.n} className="bg-card border border-border rounded-2xl overflow-hidden">
                          <button
                            data-testid={`duas-hisn-ch-${ch.n}`}
                            onClick={() => setOpenHisnCh(open ? null : ch.n)}
                            className="w-full flex items-center gap-3 p-3 text-right"
                          >
                            <span className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                              {toArabicNum(ch.n)}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block font-arabic text-[15px] truncate">{ch.titleAr}</span>
                              <span className="block text-xs text-muted-foreground">
                                {toArabicNum(items.length)} {items.length === 1 ? "دعاء" : "أدعية"}
                              </span>
                            </span>
                            <span className="text-muted-foreground text-sm">{open ? "▲" : "▼"}</span>
                          </button>
                          {open && (
                            <div className="px-3 pb-3 space-y-3">
                              {items.map((it) => (
                                <DuaCard
                                  key={it.key}
                                  item={it}
                                  fontSize={fontSize}
                                  isFav={favs.has(it.key)}
                                  isRead={read.has(it.key)}
                                  copied={copiedKey === it.key}
                                  onFav={() => toggleFav(it.key)}
                                  onRead={() => toggleRead(it.key)}
                                  onCopy={() => copyDua(it)}
                                  onShare={() => shareDua(it)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {openCategory.items.map((it) => (
                      <DuaCard
                        key={it.key}
                        item={it}
                        fontSize={fontSize}
                        isFav={favs.has(it.key)}
                        isRead={read.has(it.key)}
                        copied={copiedKey === it.key}
                        onFav={() => toggleFav(it.key)}
                        onRead={() => toggleRead(it.key)}
                        onCopy={() => copyDua(it)}
                        onShare={() => shareDua(it)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-1 gap-3">
                  {TEXT_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      data-testid={`duas-cat-${cat.id}`}
                      onClick={() => setOpenCat(cat.id)}
                      className={`rounded-2xl border p-4 text-right transition-all active:scale-[0.98] ${colorMap[cat.color]}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{cat.icon}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-arabic text-base font-bold">{cat.name}</span>
                          <span className="block text-xs text-muted-foreground mt-0.5">{cat.description}</span>
                        </span>
                        <span className={`text-xs font-sans px-2 py-1 rounded-full bg-white/70 dark:bg-black/20 ${textColorMap[cat.color]}`}>
                          {toArabicNum(cat.items.length)} دعاءً
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  data-testid="duas-fav-only"
                  onClick={() => setShowFavsOnly(true)}
                  className="mt-4 w-full py-3 rounded-2xl bg-card border border-border font-arabic text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <Star className="w-5 h-5 text-amber-500" />
                  أدعيتي المفضلة
                  {favs.size > 0 && <span className="text-sm text-muted-foreground">({toArabicNum(favs.size)})</span>}
                </button>
                <div className="text-center text-xs text-muted-foreground mt-4">
                  نصوص حصن المسلم من طبعة ٢٠٢١ — والأدعية القرآنية من المصحف المضمّن في التطبيق
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "audio" && (
          <div>
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 mb-4 text-sm text-amber-800 dark:text-amber-300">
              🔊 الاستماع يحتاج إنترنت — التسجيلات من مكتبة أرشيف الإنترنت (كتاب حصن المسلم كاملاً بصوت الشيخ).
            </div>

            {/* Full book */}
            <div className="bg-card border border-border rounded-2xl p-4 mb-4">
              <div className="font-arabic text-base font-bold mb-1 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" /> الكتاب كاملاً
              </div>
              <div className="text-xs text-muted-foreground mb-3">كل أدعية حصن المسلم مسجلة من أول الكتاب إلى آخره</div>
              <div className="grid grid-cols-2 gap-2">
                {HISN_FULL_BOOK.map((cd, i) => {
                  const key = `cd:${i + 1}` as PlayKey;
                  const isPlaying = playing === key && audioState.isPlaying;
                  return (
                    <button
                      key={key}
                      data-testid={`duas-cd-${i + 1}`}
                      onClick={() => playCd((i + 1) as 1 | 2)}
                      className={`py-3 px-2 rounded-xl font-arabic text-sm flex flex-col items-center gap-1.5 transition-all active:scale-95 ${
                        playing === key ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      {cd.label}
                      {playing === key && audioState.duration > 0 && (
                        <span className="text-xs opacity-80 tabular-nums">
                          {fmtTime(audioState.currentTime)} / {fmtTime(audioState.duration)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Continuous toggle */}
            <button
              data-testid="duas-continuous"
              onClick={() => setContinuousPersist(!continuous)}
              className="w-full mb-4 py-3 px-4 rounded-2xl bg-card border border-border flex items-center justify-between"
            >
              <span className="font-arabic text-base">تشغيل متواصل — ينتقل للباب التالي تلقائياً</span>
              <span
                className={`w-12 h-7 rounded-full p-1 transition-colors flex-shrink-0 ${
                  continuous ? "bg-emerald-500 justify-end" : "bg-muted justify-start"
                } flex`}
              >
                <span className="w-5 h-5 bg-white rounded-full shadow" />
              </span>
            </button>

            {audioState.error && playing && (
              <div className="rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3 mb-4 text-sm text-red-700 dark:text-red-300">
                {audioState.error}
              </div>
            )}

            {/* Chapters */}
            <div className="space-y-2">
              {HISN_CHAPTERS.map((ch) => {
                const key = `ch:${ch.n}` as PlayKey;
                const isCurrent = playing === key;
                const isPlaying = isCurrent && audioState.isPlaying;
                const pct =
                  isCurrent && audioState.duration > 0
                    ? Math.round((audioState.currentTime / audioState.duration) * 100)
                    : 0;
                return (
                  <div
                    key={ch.n}
                    data-testid={`duas-chapter-${ch.n}`}
                    className={`bg-card border rounded-2xl overflow-hidden ${
                      isCurrent ? "border-primary ring-1 ring-primary" : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3 p-3">
                      <span className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {toArabicNum(ch.n)}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-arabic text-[15px] truncate">{ch.titleAr}</span>
                        <span className="block text-xs text-muted-foreground">
                          {toArabicNum(ch.duas)} {ch.duas === 1 ? "دعاء" : "أدعية"}
                          {isCurrent && audioState.duration > 0 && (
                            <span className="tabular-nums"> · {fmtTime(audioState.currentTime)} / {fmtTime(audioState.duration)}</span>
                          )}
                        </span>
                      </span>
                      {ch.audio ? (
                        <button
                          data-testid={`duas-play-${ch.n}`}
                          onClick={() => playChapter(ch.n)}
                          className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90 ${
                            isCurrent ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                          }`}
                        >
                          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                        </button>
                      ) : (
                        <span
                          data-testid="duas-noaudio-28"
                          className="text-xs text-muted-foreground bg-muted px-2 py-1.5 rounded-lg flex-shrink-0"
                        >
                          بلا تسجيل
                        </span>
                      )}
                      {isCurrent && (
                        <button
                          data-testid="duas-stop"
                          onClick={stopPlaying}
                          className="w-9 h-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0"
                          title="إيقاف"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {isCurrent && audioState.duration > 0 && (
                      <div className="h-1 bg-muted">
                        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}

function itemText(item: TextDuaItem): string {
  if (item.kind === "ayah" && item.surah && item.from) {
    const parts: string[] = [];
    for (let n = item.from; n <= (item.to ?? item.from); n++) {
      const a = getAyah(item.surah, n);
      if (a) parts.push(a.text);
    }
    return parts.join(" ");
  }
  return item.text ?? "";
}

function DuaCard({
  item,
  fontSize,
  isFav,
  isRead,
  copied,
  onFav,
  onRead,
  onCopy,
  onShare,
}: {
  item: TextDuaItem;
  fontSize: number;
  isFav: boolean;
  isRead: boolean;
  copied: boolean;
  onFav: () => void;
  onRead: () => void;
  onCopy: () => void;
  onShare: () => void;
}) {
  return (
    <div
      data-testid="duas-item"
      className={`bg-card border rounded-2xl overflow-hidden transition-all ${
        isRead ? "border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-400/50" : "border-border"
      }`}
    >
      <div className="p-4">
        <DuaContentBlock item={item} fontSize={fontSize} />
        {item.count && item.count > 1 && (
          <div className="text-xs text-primary mt-2 text-right font-sans">
            يُقال {toArabicNum(item.count)} مرات
          </div>
        )}
        {item.source && (
          <div className="text-xs text-muted-foreground mt-3 text-right font-sans border-t border-border pt-2">
            📖 {item.source}
          </div>
        )}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={onRead}
            data-testid="duas-read-btn"
            className={`flex-1 py-2.5 rounded-xl text-sm font-arabic transition-all active:scale-95 ${
              isRead ? "bg-muted text-muted-foreground" : "bg-emerald-600 text-white hover:opacity-90"
            }`}
          >
            {isRead ? "✓ قرأتُ هذا الدعاء" : "قرأتُ هذا الدعاء"}
          </button>
          <button
            onClick={onFav}
            data-testid="duas-fav-btn"
            className={`p-2.5 rounded-xl transition-colors ${
              isFav ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground hover:bg-muted"
            }`}
            title="مفضلة"
          >
            <Star className={`w-5 h-5 ${isFav ? "fill-amber-500" : ""}`} />
          </button>
          <button
            onClick={onCopy}
            data-testid="duas-copy-btn"
            className="p-2.5 rounded-xl text-muted-foreground hover:bg-muted transition-colors"
            title="نسخ"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
          </button>
          <button
            onClick={onShare}
            data-testid="duas-share-btn"
            className="p-2.5 rounded-xl text-muted-foreground hover:bg-muted transition-colors"
            title="مشاركة"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
