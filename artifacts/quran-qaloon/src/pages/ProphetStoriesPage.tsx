// قصص الأنبياء من القرآن (1.0.114): قصة كل نبي مجمعة من الآيات التي
// ذكرته، مرتبة بترتيب المصحف — من موضوع النبي نفسه في بيانات مواضيع
// التطبيق المضمّنة (src/data/topics.ts، عبر src/data/prophet-stories.ts).
// لم يُخترع أي تجميع: النبي الذي لا موضوع له في البيانات غير موجود هنا.
// كل شيء دون إنترنت وبدون ذكاء اصطناعي.
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Moon, Sun, ScrollText } from "lucide-react";
import { QURAN_TEXT, displayAyahText } from "@/data/quran-text";
import { SURAHS } from "@/data/surahs";
import { TOPICS } from "@/data/topics";
import { PROPHET_STORIES, type ProphetStory } from "@/data/prophet-stories";

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

const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]));

function storyRefs(p: ProphetStory): { s: number; a: number }[] {
  const t = TOPIC_BY_ID.get(p.topicId);
  if (!t) return [];
  return t.ayahs
    .split(",")
    .filter(Boolean)
    .map((x) => {
      const [s, a] = x.split(":").map((v) => parseInt(v, 10));
      return { s, a };
    })
    .filter((r) => !isNaN(r.s) && !isNaN(r.a))
    .sort((x, y) => x.s - y.s || x.a - y.a);
}

export default function ProphetStoriesPage({ darkMode, toggleDarkMode }: Props) {
  const [, navigate] = useLocation();
  const [selected, setSelected] = useState<ProphetStory | null>(null);
  const [shownSurahs, setShownSurahs] = useState(3);

  const refs = useMemo(() => (selected ? storyRefs(selected) : []), [selected]);
  const bySurah = useMemo(() => {
    const m = new Map<number, { s: number; a: number }[]>();
    for (const r of refs) {
      const arr = m.get(r.s);
      if (arr) arr.push(r);
      else m.set(r.s, [r]);
    }
    return [...m.entries()].sort((x, y) => x[0] - y[0]);
  }, [refs]);

  const openStory = (p: ProphetStory) => {
    setSelected(p);
    setShownSurahs(3);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="prophet-stories-page">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/">
              <button className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="رجوع">
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <ScrollText className="w-5 h-5 text-primary" />
            <span className="font-arabic text-lg text-primary">قصص الأنبياء من القرآن</span>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {!selected && (
          <>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              قصة كل نبي كما وردت في القرآن — الآيات التي ذكرته، مرتبة بترتيب المصحف. اضغط نبيًا لقراءة قصته كاملة.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {PROPHET_STORIES.map((p) => (
                <button
                  key={p.topicId}
                  data-testid="prophet-row"
                  onClick={() => openStory(p)}
                  className="card-modern p-4 text-right hover:shadow-md transition-shadow"
                >
                  <div className="font-arabic text-lg text-foreground mb-1">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{toArabicNum(p.ayahCount)} آية تذكره</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
              القصص مجمعة من مواضيع الأنبياء في بيانات مواضيع التطبيق — لم تُضف أي آية يدويًا.
            </p>
          </>
        )}

        {selected && (
          <>
            <button
              onClick={() => setSelected(null)}
              className="text-sm text-primary mb-3 flex items-center gap-1"
            >
              <ArrowRight className="w-4 h-4" />
              كل الأنبياء
            </button>
            <h1 className="font-arabic text-2xl text-foreground mb-1">قصة {selected.name} عليه السلام</h1>
            <p className="text-sm text-muted-foreground mb-5">
              {toArabicNum(refs.length)} آية في {toArabicNum(bySurah.length)} سورة — اضغط أي آية لفتحها
            </p>

            <div className="space-y-5">
              {bySurah.slice(0, shownSurahs).map(([s, ayahs]) => (
                <div key={s}>
                  <div className="font-arabic text-base text-primary mb-2">سورة {surahName(s)}</div>
                  <div className="space-y-2">
                    {ayahs.map((r) => (
                      <button
                        key={`${r.s}:${r.a}`}
                        onClick={() => navigate(`/surah/${r.s}?ayah=${r.a}`)}
                        className="w-full text-right card-modern p-4 hover:shadow-md transition-shadow"
                      >
                        <div
                          className="text-lg leading-loose"
                          style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                          dir="rtl"
                        >
                          {displayAyahText(r.s, r.a, QURAN_TEXT[r.s - 1][r.a - 1])}{" "}
                          <span className="text-primary text-base">﴿{toArabicNum(r.a)}﴾</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {shownSurahs < bySurah.length && (
              <button
                onClick={() => setShownSurahs((n) => n + 3)}
                className="w-full mt-4 py-3 rounded-full bg-card border border-border text-sm font-arabic hover:bg-muted transition-colors"
              >
                عرض المزيد ({toArabicNum(bySurah.length - shownSurahs)} سور متبقية)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
