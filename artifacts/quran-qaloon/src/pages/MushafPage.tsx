import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Maximize, Moon, Palette, Sun } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { SURAHS } from "@/data/surahs";
import { getSurahAyahs, type LocalAyah } from "@/data/quran-text";
import { getMushafPageRange, getLastMushafPage, setLastMushafPage } from "@/data/mushaf-pages";
import TajweedText, { TAJWEED_LEGEND } from "@/components/TajweedText";
import WordTapText from "@/components/WordTapText";
import WordSheet from "@/components/WordSheet";
import TajweedRuleSheet from "@/components/TajweedRuleSheet";

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d, 10)]);
}

// The Basmala as it prefixes ayah 1 of every surah (except 9) in the bundled text.
// [1.0.78] Exported for the full-screen reading mode, which renders the same pages.
export const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

export interface PageAyah {
  surah: number;
  ayah: LocalAyah;
  // Basmala split off ayah 1 of a surah, rendered as its own centred line.
  basmala: boolean;
  rest: string;
}

export function buildPageAyahs(page: number): PageAyah[] {
  const range = getMushafPageRange(page);
  if (!range) return [];
  const out: PageAyah[] = [];
  for (let s = range.startSurah; s <= range.endSurah; s++) {
    const ayahs = getSurahAyahs(s);
    const from = s === range.startSurah ? range.startAyah : 1;
    const to = s === range.endSurah ? range.endAyah : ayahs.length;
    for (let n = from; n <= to; n++) {
      const ayah = ayahs[n - 1];
      if (!ayah) continue;
      let basmala = false;
      let rest = ayah.text;
      if (n === 1 && s !== 9 && ayah.text.startsWith(BASMALA)) {
        basmala = true;
        rest = ayah.text.slice(BASMALA.length).trim();
      }
      out.push({ surah: s, ayah, basmala, rest });
    }
  }
  return out;
}

export default function MushafPage({
  darkMode,
  toggleDarkMode,
}: {
  darkMode: boolean;
  toggleDarkMode: () => void;
}) {
  const [, params] = useRoute("/mushaf/:page");
  const [, navigate] = useLocation();
  const [page, setPage] = useState<number>(() => {
    const p = params?.page ? parseInt(params.page, 10) : NaN;
    if (!isNaN(p) && p >= 1 && p <= 604) return p;
    return getLastMushafPage();
  });
  const [jump, setJump] = useState("");

  // تلوين التجويد في المصحف — المفتاح نفسه المستعمل في المشغّل.
  const [tajweed, setTajweed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("quran_tajweed_enabled") !== "0";
    } catch {
      return true;
    }
  });
  const toggleTajweed = () => {
    setTajweed((v) => {
      try {
        localStorage.setItem("quran_tajweed_enabled", v ? "0" : "1");
      } catch {
        // storage unavailable
      }
      return !v;
    });
  };

  // حكم التجويد المضغوط عليه — تُعرض ورقة شرحه.
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  // [1.0.74] Word sheet for a tapped word (root / meanings).
  const [wordSheet, setWordSheet] = useState<{
    surahNumber: number;
    ayahNumber: number;
    wordIndex: number;
    wordText: string;
  } | null>(null);

  const range = getMushafPageRange(page);
  const items = useMemo(() => buildPageAyahs(page), [page]);

  // Keep the URL and the last-read page in sync.
  useEffect(() => {
    setLastMushafPage(page);
    if (params?.page !== String(page)) {
      navigate(`/mushaf/${page}`, { replace: true });
    }
    window.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const goTo = (p: number) => {
    if (p >= 1 && p <= 604) setPage(p);
  };

  const startSurah = range ? SURAHS[range.startSurah - 1] : null;
  const endSurah = range ? SURAHS[range.endSurah - 1] : null;

  // Surah headers: a new header whenever the surah changes within the page.
  let lastSurah = -1;
  const blocks: Array<{ type: "header"; surah: number } | { type: "ayah"; item: PageAyah }> = [];
  for (const item of items) {
    if (item.surah !== lastSurah) {
      blocks.push({ type: "header", surah: item.surah });
      lastSurah = item.surah;
    }
    blocks.push({ type: "ayah", item });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <button className="p-2 rounded-full hover:bg-muted transition-colors">
              <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <BookOpen className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="font-arabic text-lg text-primary truncate">المصحف</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              صفحة {toArabicNum(page)} من {toArabicNum(604)}
            </span>
          </div>
          <button
            onClick={() => navigate(`/reading/${page}`)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary/10 text-primary text-xs font-arabic hover:bg-primary/20 transition-colors whitespace-nowrap"
            aria-label="وضع القراءة بملء الشاشة"
            title="وضع القراءة بملء الشاشة"
          >
            <Maximize className="w-4 h-4" />
            <span className="hidden sm:inline">وضع القراءة</span>
          </button>
          <button
            onClick={toggleTajweed}
            className={`p-2 rounded-full hover:bg-muted transition-colors ${tajweed ? "bg-primary/10 text-primary" : ""}`}
            aria-label="تفعيل تلوين التجويد أو إيقافه"
            title="تلوين التجويد"
          >
            <Palette className="w-4 h-4" />
          </button>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Page range */}
        <div className="text-center text-xs text-muted-foreground mb-4">
          {startSurah && endSurah && (
            <>
              من سورة {startSurah.name}
              {range && (range.startSurah !== range.endSurah || range.startAyah !== range.endAyah)
                ? ` — الآية ${toArabicNum(range.startAyah)}`
                : ""}
              {range && range.startSurah !== range.endSurah
                ? ` إلى سورة ${endSurah.name} — الآية ${toArabicNum(range.endAyah)}`
                : range && range.startAyah !== range.endAyah
                  ? ` إلى الآية ${toArabicNum(range.endAyah)}`
                  : ""}
            </>
          )}
        </div>

        {/* مفتاح ألوان التجويد — يظهر فقط عند تفعيل التلوين. */}
        {tajweed && (
          <div className="mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full bg-muted/60 px-4 py-2">
            <span className="text-xs text-muted-foreground">أحكام التجويد — اضغط أي حرف ملوّن لشرح حكمه:</span>
            {TAJWEED_LEGEND.map((item) => (
              <span key={item.label} className="flex items-center gap-1 text-xs">
                <span className={`w-2.5 h-2.5 rounded-full bg-current ${item.className}`} />
                <span className={item.className}>{item.label}</span>
              </span>
            ))}
          </div>
        )}

        {/* The page itself — framed like a mushaf page */}
        <div className="bg-card border-2 border-amber-500/40 rounded-[2rem] px-5 py-6 sm:px-8 shadow-md">
          <div className="quran-text text-right leading-loose text-[26px] sm:text-[28px]" dir="rtl">
            {blocks.map((b, i) =>
              b.type === "header" ? (
                <div key={`h-${b.surah}-${i}`} className="text-center my-4">
                  <div className="inline-block border-y-2 border-amber-500/40 px-6 py-1.5">
                    <span className="font-arabic text-xl text-primary">سورة {SURAHS[b.surah - 1].name}</span>
                    <span className="text-xs text-muted-foreground mr-2">
                      {SURAHS[b.surah - 1].revelationType === "Meccan"
                        ? "مكية"
                        : SURAHS[b.surah - 1].revelationType === "Medinan"
                          ? "مدنية"
                          : ""}{" "}
                      • {toArabicNum(SURAHS[b.surah - 1].numberOfAyahs)} آية
                    </span>
                  </div>
                </div>
              ) : (
                <span key={`${b.item.surah}-${b.item.ayah.numberInSurah}`}>
                  {b.item.basmala && (
                    <span className="block text-center my-3 text-[0.9em] text-foreground">
                      <TajweedText
                        surahNumber={b.item.surah}
                        ayahNumber={b.item.ayah.numberInSurah}
                        text={BASMALA}
                        enabled={tajweed}
                        window={[0, BASMALA.length]}
                        onRuleClick={setSelectedRule}
                      />
                    </span>
                  )}
                  <span
                    data-ayah={b.item.ayah.numberInSurah}
                    onClick={() => navigate(`/surah/${b.item.surah}?ayah=${b.item.ayah.numberInSurah}`)}
                    className="cursor-pointer rounded px-0.5 transition-colors hover:bg-primary/10"
                  >
                    <WordTapText
                      surahNumber={b.item.surah}
                      ayahNumber={b.item.ayah.numberInSurah}
                      text={b.item.rest}
                      windowBase={b.item.ayah.text.length - b.item.rest.length}
                      tajweed={tajweed}
                      onRuleClick={setSelectedRule}
                      onWordClick={(wi, wt) => setWordSheet({ surahNumber: b.item.surah, ayahNumber: b.item.ayah.numberInSurah, wordIndex: wi, wordText: wt })}
                    />{" "}
                    <span className="text-primary inline-block mx-1 text-[0.65em]">﴿{toArabicNum(b.item.ayah.numberInSurah)}﴾</span>{" "}
                  </span>
                </span>
              ),
            )}
          </div>
          <div className="text-center text-xs text-muted-foreground mt-6">
            اضغط أي آية للانتقال إليها في المشغّل
          </div>
        </div>

        {/* Page navigation */}
        <div className="mt-6 flex items-center justify-between gap-2">
          <button
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
            className="flex items-center gap-1 px-4 py-2 rounded-full bg-card border border-border text-sm disabled:opacity-40 hover:border-primary/40 active:scale-95 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
            السابقة
          </button>
          <span className="text-sm text-muted-foreground bg-card border border-border px-3 py-1.5 rounded-full">
            صفحة {toArabicNum(page)} / {toArabicNum(604)}
          </span>
          <button
            onClick={() => goTo(page + 1)}
            disabled={page >= 604}
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-card border border-border text-sm disabled:opacity-40 hover:border-primary/40 transition-colors"
          >
            التالية
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Jump to a page */}
        <form
          className="mt-4 flex items-center justify-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const p = parseInt(jump.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString()), 10);
            if (!isNaN(p)) goTo(p);
            setJump("");
          }}
        >
          <input
            value={jump}
            onChange={(e) => setJump(e.target.value.replace(/[^0-9٠-٩]/g, ""))}
            inputMode="numeric"
            placeholder="رقم الصفحة (١–٦٠٤)"
            className="w-44 px-3 py-2 rounded-xl bg-card border border-border text-sm text-center placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
          >
            اذهب
          </button>
        </form>
      </div>

      {/* شرح حكم التجويد المضغوط عليه */}
      <TajweedRuleSheet rule={selectedRule} onClose={() => setSelectedRule(null)} />
      {/* Word sheet for a tapped word (1.0.74: root / meanings) */}
      {wordSheet && (
        <WordSheet
          surahNumber={wordSheet.surahNumber}
          ayahNumber={wordSheet.ayahNumber}
          wordIndex={wordSheet.wordIndex}
          wordText={wordSheet.wordText}
          onClose={() => setWordSheet(null)}
          onNavigateAyah={(sn, an) => {
            setWordSheet(null);
            navigate(`/surah/${sn}?ayah=${an}`);
          }}
        />
      )}
    </div>
  );
}
