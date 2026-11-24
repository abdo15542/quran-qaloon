// خريطة مواضيع القرآن (1.0.114): تصفح مواضيع التطبيق المضمّنة
// (src/data/topics.ts) — بحث، ولكل موضوع: كل آياته في كل السور، ومواضيع
// قريبة تشاركه الآيات. لا أسماء مواضيع مخترعة — فقط ما في البيانات.
// كل شيء دون إنترنت وبدون ذكاء اصطناعي.
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Moon, Sun, Share2, Search } from "lucide-react";
import { QURAN_TEXT, normalizeArabic, displayAyahText } from "@/data/quran-text";
import { SURAHS } from "@/data/surahs";
import { TOPICS, TOPIC_COVERAGE_NOTE, type QuranTopic } from "@/data/topics";

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

function parseRefs(t: QuranTopic): { s: number; a: number }[] {
  return t.ayahs
    .split(",")
    .filter(Boolean)
    .map((p) => {
      const [s, a] = p.split(":").map((x) => parseInt(x, 10));
      return { s, a };
    })
    .filter((r) => !isNaN(r.s) && !isNaN(r.a));
}

export default function TopicMapPage({ darkMode, toggleDarkMode }: Props) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [shownAyahs, setShownAyahs] = useState(40);

  // فهرس معكوس: آية ← مواضيعها (يُبنى مرة واحدة).
  const ayahToTopics = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const t of TOPICS) {
      for (const r of parseRefs(t)) {
        const k = `${r.s}:${r.a}`;
        const arr = m.get(k);
        if (arr) arr.push(t.id);
        else m.set(k, [t.id]);
      }
    }
    return m;
  }, []);

  const topicById = useMemo(() => new Map(TOPICS.map((t) => [t.id, t])), []);

  const results = useMemo(() => {
    const q = normalizeArabic(query.trim(), false);
    if (!q) return TOPICS.slice(0, 60);
    return TOPICS.filter((t) => normalizeArabic(t.name, false).includes(q)).slice(0, 60);
  }, [query]);

  const selected = selectedId !== null ? topicById.get(selectedId) ?? null : null;
  const selectedRefs = useMemo(() => (selected ? parseRefs(selected) : []), [selected]);

  const related = useMemo(() => {
    if (!selected) return [];
    const counts = new Map<number, number>();
    for (const r of selectedRefs) {
      for (const tid of ayahToTopics.get(`${r.s}:${r.a}`) ?? []) {
        if (tid === selected.id) continue;
        counts.set(tid, (counts.get(tid) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .filter(([, c]) => c >= 2)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 8)
      .map(([tid, shared]) => ({ topic: topicById.get(tid)!, shared }));
  }, [selected, selectedRefs, ayahToTopics, topicById]);

  const openTopic = (t: QuranTopic) => {
    setSelectedId(t.id);
    setShownAyahs(40);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="topic-map-page">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/">
              <button className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="رجوع">
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Share2 className="w-5 h-5 text-primary" />
            <span className="font-arabic text-lg text-primary">خريطة مواضيع القرآن</span>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {!selected && (
          <>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{TOPIC_COVERAGE_NOTE}</p>
            <div className="relative mb-4">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="ابحث عن موضوع... (مثال: الصبر، الجنة، موسى)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-card border border-border rounded-full pr-10 pl-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
              />
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              {query ? `${toArabicNum(results.length)} موضوعًا مطابقًا` : "الأكثر تغطية أولًا"}
            </div>
            <div className="space-y-2">
              {results.map((t) => {
                const count = t.ayahs.split(",").filter(Boolean).length;
                return (
                  <button
                    key={t.id}
                    data-testid="topic-row"
                    onClick={() => openTopic(t)}
                    className="w-full text-right card-modern p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-arabic text-base text-foreground">{t.name}</span>
                      <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                        {toArabicNum(count)} آية
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {results.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10">لا يوجد موضوع بهذا الاسم في البيانات</p>
            )}
          </>
        )}

        {selected && (
          <>
            <button
              onClick={() => setSelectedId(null)}
              className="text-sm text-primary mb-3 flex items-center gap-1"
            >
              <ArrowRight className="w-4 h-4" />
              كل المواضيع
            </button>
            <h1 className="font-arabic text-2xl text-foreground mb-1">{selected.name}</h1>
            <p className="text-sm text-muted-foreground mb-5">
              {toArabicNum(selectedRefs.length)} آية في{" "}
              {toArabicNum(new Set(selectedRefs.map((r) => r.s)).size)} سورة — اضغط أي آية لفتحها
            </p>

            {related.length > 0 && (
              <div className="mb-5">
                <div className="text-sm font-bold text-foreground mb-2">مواضيع قريبة (تشاركها الآيات)</div>
                <div className="flex gap-2 flex-wrap">
                  {related.map(({ topic, shared }) => (
                    <button
                      key={topic.id}
                      data-testid="related-topic"
                      onClick={() => openTopic(topic)}
                      className="px-3 py-1.5 rounded-full bg-card border border-border text-sm hover:border-primary/60 transition-colors"
                    >
                      {topic.name} <span className="text-xs text-muted-foreground">({toArabicNum(shared)})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {selectedRefs.slice(0, shownAyahs).map((r) => (
                <button
                  key={`${r.s}:${r.a}`}
                  onClick={() => navigate(`/surah/${r.s}?ayah=${r.a}`)}
                  className="w-full text-right card-modern p-4 hover:shadow-md transition-shadow"
                >
                  <div
                    className="text-lg leading-loose mb-1"
                    style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                    dir="rtl"
                  >
                    {displayAyahText(r.s, r.a, QURAN_TEXT[r.s - 1][r.a - 1])}{" "}
                    <span className="text-primary text-base">﴿{toArabicNum(r.a)}﴾</span>
                  </div>
                  <div className="text-xs text-muted-foreground">سورة {surahName(r.s)}</div>
                </button>
              ))}
            </div>

            {shownAyahs < selectedRefs.length && (
              <button
                onClick={() => setShownAyahs((n) => n + 40)}
                className="w-full mt-4 py-3 rounded-full bg-card border border-border text-sm font-arabic hover:bg-muted transition-colors"
              >
                عرض المزيد ({toArabicNum(selectedRefs.length - shownAyahs)} آية متبقية)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
