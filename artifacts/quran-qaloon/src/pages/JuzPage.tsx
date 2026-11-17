import { Link, useLocation } from "wouter";
import { ArrowRight, BookOpen, Moon, Sun } from "lucide-react";
import { SURAHS } from "@/data/surahs";
import { getAyah } from "@/data/quran-text";
import { getJuzList } from "@/data/juz";

interface JuzPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

// النص المضمّن يسبق البسملةَ بنص الآية الأولى من كل سورة (ما عدا التوبة)؛
// نخفيها في المعاينة حتى تظهر بداية الآية الحقيقية.
const BASMALA_PREFIX = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
function previewText(text: string): string {
  const t = text.startsWith(BASMALA_PREFIX) ? text.slice(BASMALA_PREFIX.length).trim() : text;
  return t.length > 70 ? t.slice(0, 70) + "…" : t;
}

export default function JuzPage({ darkMode, toggleDarkMode }: JuzPageProps) {
  const [, navigate] = useLocation();
  const juzList = getJuzList();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/">
              <button className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="رجوع">
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="font-arabic text-lg text-primary">الأجزاء</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              ٣٠ جزءًا
            </span>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="space-y-3">
          {juzList.map((juz) => {
            const startSurah = SURAHS.find((s) => s.number === juz.startSurah);
            const endSurah = SURAHS.find((s) => s.number === juz.endSurah);
            const startAyah = getAyah(juz.startSurah, juz.startAyah);
            if (!startSurah || !endSurah || !startAyah) return null;
            return (
              <button
                key={juz.number}
                onClick={() => navigate(`/surah/${juz.startSurah}?ayah=${juz.startAyah}`)}
                className="w-full text-right bg-card border border-border rounded-2xl p-4 hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-arabic text-lg flex-shrink-0">
                      {toArabicNum(juz.number)}
                    </span>
                    <div className="min-w-0">
                      <div className="font-arabic text-base text-foreground">
                        الجزء {toArabicNum(juz.number)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        من سورة {startSurah.name} — الآية {toArabicNum(juz.startAyah)}
                        {" "}إلى سورة {endSurah.name} — الآية {toArabicNum(juz.endAyah)}
                      </div>
                    </div>
                  </div>
                  <span className="text-primary text-lg flex-shrink-0">‹</span>
                </div>
                <div
                  className="text-sm text-muted-foreground mt-2 leading-relaxed"
                  style={{ fontFamily: "'Amiri Quran', 'Amiri', serif" }}
                  dir="rtl"
                >
                  {previewText(startAyah.text)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
