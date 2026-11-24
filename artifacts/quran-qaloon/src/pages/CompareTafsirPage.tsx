// التفسير المقارن (1.0.114): تفسيران مضمّنان في التطبيق جنبًا إلى جنب
// لنفس الآية — تفسير الميسر وتفسير الجلالين (src/data/tafsir-muyassar.ts
// وtafsir-jalalayn.ts). يصل إليه من الرئيسية ومن ورقة التفسير في المشغّل.
// كل شيء دون إنترنت وبدون ذكاء اصطناعي.
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Moon, Sun, Languages, ChevronRight, ChevronLeft } from "lucide-react";
import { QURAN_TEXT, getAyah, displayAyahText } from "@/data/quran-text";
import { SURAHS } from "@/data/surahs";
import { getTafsir, TAFSIR_EDITION_NAME } from "@/data/tafsir-muyassar";
import { getTafsirJalalayn, TAFSIR_JALALAYN_EDITION_NAME } from "@/data/tafsir-jalalayn";

interface Props {
  darkMode: boolean;
  toggleDarkMode: () => void;
  surahNumber?: number;
  ayahNumber?: number;
}

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

export default function CompareTafsirPage({ darkMode, toggleDarkMode, surahNumber = 1, ayahNumber = 1 }: Props) {
  const [surah, setSurah] = useState(surahNumber);
  const [ayah, setAyah] = useState(ayahNumber);

  const ayahCount = useMemo(() => QURAN_TEXT[surah - 1].length, [surah]);
  const ayahObj = useMemo(() => getAyah(surah, ayah), [surah, ayah]);
  const muyassar = useMemo(() => getTafsir(surah, ayah), [surah, ayah]);
  const jalalayn = useMemo(() => getTafsirJalalayn(surah, ayah), [surah, ayah]);

  const stepAyah = (d: number) => {
    let ns = surah;
    let na = ayah + d;
    if (na < 1) {
      if (surah > 1) {
        ns = surah - 1;
        na = QURAN_TEXT[ns - 1].length;
      } else {
        return;
      }
    } else if (na > ayahCount) {
      if (surah < 114) {
        ns = surah + 1;
        na = 1;
      } else {
        return;
      }
    }
    setSurah(ns);
    setAyah(na);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="compare-tafsir-page">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/">
              <button className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="رجوع">
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Languages className="w-5 h-5 text-primary" />
            <span className="font-arabic text-lg text-primary">التفسير المقارن</span>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          تفسيران لنفس الآية جنبًا إلى جنب — اقرأهما معًا وقارن بينهما.
        </p>

        <div className="flex gap-2 mb-4">
          <select
            value={surah}
            onChange={(e) => {
              setSurah(parseInt(e.target.value, 10));
              setAyah(1);
            }}
            className="flex-1 bg-card border border-border rounded-full px-3 py-2.5 text-sm"
          >
            {SURAHS.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number} — {s.name}
              </option>
            ))}
          </select>
          <select
            value={ayah}
            onChange={(e) => setAyah(parseInt(e.target.value, 10))}
            className="w-32 bg-card border border-border rounded-full px-3 py-2.5 text-sm"
          >
            {Array.from({ length: ayahCount }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                الآية {toArabicNum(i + 1)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 mb-5">
          <button
            onClick={() => stepAyah(-1)}
            className="flex-1 py-2.5 rounded-full bg-card border border-border text-sm font-arabic flex items-center justify-center gap-1"
          >
            <ChevronRight className="w-4 h-4" />
            الآية السابقة
          </button>
          <button
            onClick={() => stepAyah(1)}
            className="flex-1 py-2.5 rounded-full bg-card border border-border text-sm font-arabic flex items-center justify-center gap-1"
          >
            الآية التالية
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {ayahObj && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 text-center mb-5">
            <div
              className="text-xl leading-loose"
              style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
              dir="rtl"
            >
              {displayAyahText(surah, ayah, ayahObj.text)}{" "}
              <span className="text-primary text-lg">﴿{toArabicNum(ayah)}﴾</span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              سورة {SURAHS.find((s) => s.number === surah)?.name} — الآية {toArabicNum(ayah)}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div className="card-modern p-5">
            <div className="font-arabic text-lg text-primary mb-3" data-testid="tafsir-muyassar-title">
              {TAFSIR_EDITION_NAME}
            </div>
            {muyassar ? (
              <p className="text-base leading-loose text-right whitespace-pre-line" data-testid="tafsir-muyassar">
                {muyassar}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">لا يوجد تفسير لهذه الآية</p>
            )}
          </div>
          <div className="card-modern p-5">
            <div className="font-arabic text-lg text-primary mb-3" data-testid="tafsir-jalalayn-title">
              {TAFSIR_JALALAYN_EDITION_NAME}
            </div>
            {jalalayn ? (
              <p className="text-base leading-loose text-right whitespace-pre-line" data-testid="tafsir-jalalayn">
                {jalalayn}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">لا يوجد تفسير لهذه الآية</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
