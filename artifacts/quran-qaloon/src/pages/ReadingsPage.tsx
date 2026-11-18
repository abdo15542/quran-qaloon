import { useMemo } from "react";
import { Link } from "wouter";
import { ArrowRight, BookCopy, ChevronLeft, ChevronRight, Info, Moon, Sun } from "lucide-react";
import { SURAHS } from "@/data/surahs";
import {
  HAFS_AYAH_COUNT,
  WARSH_AYAH_COUNT,
  diffWords,
  formatAyahList,
  getReadings,
  type WordMark,
} from "@/lib/readings";

interface ReadingsPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
  surahNumber: number;
  ayahNumber: number;
}

/** One ayah text with differing words highlighted (amber) in the original script. */
function DiffText({ marks }: { marks: WordMark[] }) {
  return (
    <p className="quran-text" dir="rtl" lang="ar">
      {marks.map((m, i) => (
        <span key={i}>
          {m.diff ? (
            <mark className="bg-amber-400/50 dark:bg-amber-400/30 text-inherit rounded px-0.5">
              {m.word}
            </mark>
          ) : (
            m.word
          )}{" "}
        </span>
      ))}
    </p>
  );
}

function PlainText({ text }: { text: string }) {
  return (
    <p className="quran-text" dir="rtl" lang="ar">
      {text}
    </p>
  );
}

export default function ReadingsPage({ darkMode, toggleDarkMode, surahNumber, ayahNumber }: ReadingsPageProps) {
  const surah = SURAHS[surahNumber - 1];
  const readings = useMemo(() => getReadings(surahNumber, ayahNumber), [surahNumber, ayahNumber]);
  const qaloonDiff = useMemo(
    () => (readings.found ? diffWords(readings.hafs, readings.qaloon) : null),
    [readings]
  );
  const warshDiff = useMemo(
    () => (readings.found && readings.warsh ? diffWords(readings.hafs, readings.warsh.text) : null),
    [readings]
  );

  // Prev/next ayah, crossing surah boundaries.
  const totalAyahs = surah?.numberOfAyahs ?? 0;
  const prev =
    ayahNumber > 1
      ? { s: surahNumber, a: ayahNumber - 1 }
      : surahNumber > 1
        ? { s: surahNumber - 1, a: SURAHS[surahNumber - 2].numberOfAyahs }
        : null;
  const next =
    ayahNumber < totalAyahs
      ? { s: surahNumber, a: ayahNumber + 1 }
      : surahNumber < 114
        ? { s: surahNumber + 1, a: 1 }
        : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href={surah ? `/surah/${surahNumber}` : "/"}>
              <button className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="رجوع">
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <BookCopy className="w-5 h-5 text-primary" />
            <span className="font-arabic text-lg text-primary">مقارنة الروايات</span>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="text-center">
          <h1 className="font-arabic text-xl font-bold">
            {surah ? `سورة ${surah.name}` : "مقارنة الروايات"} — الآية {ayahNumber}
          </h1>
          {surah && (
            <Link href={`/surah/${surahNumber}`}>
              <span className="text-sm text-primary hover:underline cursor-pointer font-arabic">
                العودة إلى السورة
              </span>
            </Link>
          )}
        </div>

        {/* Numbering note: Qaloon here follows Hafs numbering; printed Libyan mushafs use Madani. */}
        <div
          data-testid="numbering-note"
          className="flex gap-2 items-start rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-arabic"
        >
          <Info className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <p>
            نص قالون هنا يستخدم ترقيم حفص ({HAFS_AYAH_COUNT.toLocaleString("ar-EG")} آية) بينما المصاحف
            الليبية المطبوعة تستخدم الترقيم المدني ({WARSH_AYAH_COUNT.toLocaleString("ar-EG")} آية)،
            لذلك قد يختلف رقم الآية بين الروايتين. أرقام آيات ورش أدناه بالترقيم المدني، والكلمات
            المظلّلة بالكهرماني هي الكلمات المختلفة عن حفص.
          </p>
        </div>

        {!readings.found ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center">
            <p className="font-arabic text-muted-foreground">
              هذه الآية غير موجودة في سورة {surah?.name ?? surahNumber}.
            </p>
          </div>
        ) : (
          <>
            {/* Hafs — the baseline; no highlighting (everything is compared against it). */}
            <section
              data-testid="hafs-card"
              className="rounded-2xl border border-border bg-card px-4 py-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-arabic font-bold text-lg">حفص عن عاصم</h2>
                <span className="text-xs text-muted-foreground font-arabic">الرواية المرجعية للمقارنة</span>
              </div>
              <PlainText text={readings.hafs} />
            </section>

            {/* Qaloon — Hafs numbering, direct lookup. */}
            <section
              data-testid="qaloon-card"
              className="rounded-2xl border border-border bg-card px-4 py-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-arabic font-bold text-lg">قالون عن نافع</h2>
                <span className="text-xs text-muted-foreground font-arabic">
                  {qaloonDiff && qaloonDiff.diffCount === 0
                    ? "مطابقة لحفص في هذه الآية"
                    : `${qaloonDiff?.diffCount ?? 0} كلمات مختلفة عن حفص`}
                </span>
              </div>
              {qaloonDiff && <DiffText marks={qaloonDiff.other} />}
            </section>

            {/* Warsh — Madani numbering, resolved through number_in_hafs. */}
            <section
              data-testid="warsh-card"
              className="rounded-2xl border border-border bg-card px-4 py-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-arabic font-bold text-lg">ورش عن نافع</h2>
                <span className="text-xs text-muted-foreground font-arabic">
                  {readings.warsh
                    ? readings.warsh.warshVerses.length > 1
                      ? `الآيتان ${formatAyahList(readings.warsh.warshVerses)} برواية ورش (ترقيم مدني)`
                      : `الآية ${readings.warsh.warshVerse} برواية ورش (ترقيم مدني)`
                    : "لا توجد آية مقابلة"}
                </span>
              </div>
              {readings.warsh ? (
                <>
                  {readings.warsh.hafsSpan.length > 1 && (
                    <p
                      data-testid="warsh-span-note"
                      className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-sm font-arabic text-amber-700 dark:text-amber-400"
                    >
                      هذه الآية الورشية تشمل آيتي حفص {formatAyahList(readings.warsh.hafsSpan)}، لذلك يظهر
                      نصها كاملًا هنا.
                    </p>
                  )}
                  {readings.warsh.warshVerses.length > 1 && (
                    <p
                      data-testid="warsh-split-note"
                      className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-sm font-arabic text-amber-700 dark:text-amber-400"
                    >
                      هذه الآية في حفص مقسّمة إلى آيتين في ورش (
                      {formatAyahList(readings.warsh.warshVerses)})، ويظهر نصهما معًا هنا.
                    </p>
                  )}
                  {warshDiff && <DiffText marks={warshDiff.other} />}
                </>
              ) : (
                <p className="text-sm text-muted-foreground font-arabic">
                  لا توجد آية ورشية مقابلة لهذه الآية في المصدر.
                </p>
              )}
            </section>
          </>
        )}

        {/* Prev / next ayah navigation. */}
        <nav className="flex items-center justify-between gap-3 pt-2">
          {prev ? (
            <Link href={`/readings/${prev.s}/${prev.a}`}>
              <button className="flex items-center gap-1 px-4 py-2 rounded-full border border-border bg-card font-arabic text-sm hover:bg-muted transition-colors">
                <ChevronRight className="w-4 h-4" />
                الآية السابقة
              </button>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/readings/${next.s}/${next.a}`}>
              <button className="flex items-center gap-1 px-4 py-2 rounded-full border border-border bg-card font-arabic text-sm hover:bg-muted transition-colors">
                الآية التالية
                <ChevronLeft className="w-4 h-4" />
              </button>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </div>
    </div>
  );
}
