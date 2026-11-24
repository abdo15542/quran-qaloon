// إحصائيات القرآن العميقة (1.0.114): أرقام محسوبة من النص المضمّن في
// التطبيق (src/data/deep-stats.ts) — أكثر الكلمات تكرارًا، الكلمات التي
// لا تتكرر إلا مرة واحدة، وعدد الكلمات والحروف لكل سورة. أرقام إحصائية
// فقط — بلا أي تأويل. دون إنترنت وبدون ذكاء اصطناعي.
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Moon, Sun, Hash, Search } from "lucide-react";
import { normalizeArabic } from "@/data/quran-text";
import { SURAHS } from "@/data/surahs";
import {
  QURAN_TOTAL_WORDS,
  QURAN_TOTAL_LETTERS,
  QURAN_TOTAL_AYAHS,
  QURAN_UNIQUE_WORDS,
  QURAN_HAPAX_COUNT,
  QURAN_TOP_WORDS,
  QURAN_HAPAX,
  QURAN_PER_SURAH_STATS,
} from "@/data/deep-stats";

interface Props {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

export default function DeepStatsPage({ darkMode, toggleDarkMode }: Props) {
  const [hapaxQuery, setHapaxQuery] = useState("");
  const [hapaxShown, setHapaxShown] = useState(100);
  const [surahQuery, setSurahQuery] = useState("");
  const [tab, setTab] = useState<"top" | "hapax" | "surahs">("top");

  const maxTop = QURAN_TOP_WORDS[0]?.[1] ?? 1;

  const hapaxFiltered = useMemo(() => {
    const q = normalizeArabic(hapaxQuery.trim(), false);
    if (!q) return QURAN_HAPAX;
    return QURAN_HAPAX.filter(([w]) => normalizeArabic(w, false).includes(q));
  }, [hapaxQuery]);

  const surahFiltered = useMemo(() => {
    const q = normalizeArabic(surahQuery.trim(), false);
    if (!q) return QURAN_PER_SURAH_STATS;
    return QURAN_PER_SURAH_STATS.filter((st) => {
      const name = SURAHS.find((s) => s.number === st.s)?.name ?? "";
      return normalizeArabic(name, false).includes(q) || String(st.s).includes(surahQuery.trim());
    });
  }, [surahQuery]);

  const totals: { label: string; value: number }[] = [
    { label: "عدد الكلمات", value: QURAN_TOTAL_WORDS },
    { label: "عدد الحروف", value: QURAN_TOTAL_LETTERS },
    { label: "عدد الآيات", value: QURAN_TOTAL_AYAHS },
    { label: "كلمات مختلفة", value: QURAN_UNIQUE_WORDS },
    { label: "كلمات وردت مرة واحدة", value: QURAN_HAPAX_COUNT },
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="deep-stats-page">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/">
              <button className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="رجوع">
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Hash className="w-5 h-5 text-primary" />
            <span className="font-arabic text-lg text-primary">إحصائيات القرآن العميقة</span>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          أرقام من نص المصحف المضمّن في التطبيق — إحصائيات فقط، بلا تأويل. الكلمات بعد إزالة التشكيل وتوحيد الرسم،
          والحروف تُحسب مع احتساب الألف الخنجرية حرفًا.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {totals.map((t) => (
            <div key={t.label} className="card-modern p-4 text-center">
              <div className="text-2xl font-bold text-primary tabular-nums" data-testid="deep-stats-total">
                {toArabicNum(t.value)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{t.label}</div>
            </div>
          ))}
          <div className="card-modern p-4 text-center">
            <div className="text-2xl font-bold text-primary tabular-nums">{toArabicNum(114)}</div>
            <div className="text-xs text-muted-foreground mt-1">عدد السور</div>
          </div>
        </div>

        <div className="flex gap-2 mb-5">
          {(
            [
              ["top", "أكثر الكلمات تكرارًا"],
              ["hapax", "كلمات وردت مرة واحدة"],
              ["surahs", "إحصاء كل سورة"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              data-testid={`deep-stats-tab-${key}`}
              className={`flex-1 py-2.5 rounded-full text-sm font-arabic transition-colors ${tab === key ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "top" && (
          <div className="card-modern divide-y divide-border" data-testid="deep-stats-top">
            {QURAN_TOP_WORDS.map(([w, c], i) => (
              <div key={w} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-xs text-muted-foreground w-6 text-center">{toArabicNum(i + 1)}</span>
                <span className="font-arabic text-lg w-24 shrink-0">{w}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round((c / maxTop) * 100)}%` }} />
                </div>
                <span className="text-sm font-bold tabular-nums w-14 text-left">{toArabicNum(c)}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "hapax" && (
          <>
            <div className="relative mb-4">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="ابحث في الكلمات التي وردت مرة واحدة..."
                value={hapaxQuery}
                onChange={(e) => {
                  setHapaxQuery(e.target.value);
                  setHapaxShown(100);
                }}
                className="w-full bg-card border border-border rounded-full pr-10 pl-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
              />
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              {toArabicNum(hapaxFiltered.length)} كلمة — كل كلمة مع موضع ورودها الوحيد
            </div>
            <div className="card-modern divide-y divide-border" data-testid="deep-stats-hapax">
              {hapaxFiltered.slice(0, hapaxShown).map(([w, s, a]) => (
                <div key={`${w}-${s}-${a}`} className="flex items-center justify-between px-4 py-2.5">
                  <span className="font-arabic text-lg">{w}</span>
                  <span className="text-xs text-muted-foreground">
                    سورة {SURAHS.find((x) => x.number === s)?.name} — الآية {toArabicNum(a)}
                  </span>
                </div>
              ))}
            </div>
            {hapaxShown < hapaxFiltered.length && (
              <button
                onClick={() => setHapaxShown((n) => n + 100)}
                className="w-full mt-4 py-3 rounded-full bg-card border border-border text-sm font-arabic hover:bg-muted transition-colors"
              >
                عرض المزيد ({toArabicNum(hapaxFiltered.length - hapaxShown)} كلمة متبقية)
              </button>
            )}
          </>
        )}

        {tab === "surahs" && (
          <>
            <div className="relative mb-4">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="ابحث عن سورة..."
                value={surahQuery}
                onChange={(e) => setSurahQuery(e.target.value)}
                className="w-full bg-card border border-border rounded-full pr-10 pl-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
              />
            </div>
            <div className="card-modern divide-y divide-border" data-testid="deep-stats-surahs">
              <div className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-muted-foreground">
                <span className="flex-1">السورة</span>
                <span className="w-12 text-center">آيات</span>
                <span className="w-16 text-center">كلمات</span>
                <span className="w-16 text-center">حروف</span>
              </div>
              {surahFiltered.map((st) => (
                <div key={st.s} className="flex items-center gap-2 px-4 py-2.5">
                  <span className="flex-1 font-arabic">
                    {toArabicNum(st.s)} — {SURAHS.find((x) => x.number === st.s)?.name}
                  </span>
                  <span className="w-12 text-center text-sm tabular-nums">{toArabicNum(st.ayahs)}</span>
                  <span className="w-16 text-center text-sm tabular-nums">{toArabicNum(st.words)}</span>
                  <span className="w-16 text-center text-sm tabular-nums">{toArabicNum(st.letters)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
