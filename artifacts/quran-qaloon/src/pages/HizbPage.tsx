import { Link, useLocation } from "wouter";
import { ArrowRight, BookOpen, Moon, Sun } from "lucide-react";
import { SURAHS } from "@/data/surahs";
import { getAyah } from "@/data/quran-text";
import { getHizbList, SAJDAH_AYAHS } from "@/data/hizb";

interface HizbPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

// The Hizb 1 card starts at 1:1, whose entire text IS the basmala —
// stripping it leaves an empty preview, so fall back to the basmala
// itself instead of showing a blank line (same as JuzPage).
const BASMALA_PREFIX = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
function previewText(text: string): string {
  const t = text.startsWith(BASMALA_PREFIX) ? text.slice(BASMALA_PREFIX.length).trim() : text;
  const shown = t.length > 0 ? t : BASMALA_PREFIX;
  return shown.length > 70 ? shown.slice(0, 70) + "…" : shown;
}

export default function HizbPage({ darkMode, toggleDarkMode }: HizbPageProps) {
  const [, navigate] = useLocation();
  const hizbList = getHizbList();

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
            <span className="font-arabic text-lg text-primary">الأحزاب</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              ٦٠ حزبًا
            </span>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* آيات السجدة — الخمس عشرة، اضغط للانتقال إلى الآية. */}
        <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
          <div className="font-arabic text-base text-amber-700 dark:text-amber-400 mb-1">
            ۩ آيات السجدة — {toArabicNum(SAJDAH_AYAHS.length)} آية
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            عند قراءتها يُستحب السجود — اضغط على أي آية للانتقال إليها.
          </p>
          <div className="flex flex-wrap gap-2">
            {SAJDAH_AYAHS.map((s) => {
              const surah = SURAHS.find((x) => x.number === s.surah);
              if (!surah) return null;
              return (
                <button
                  key={`${s.surah}:${s.ayah}`}
                  onClick={() => navigate(`/surah/${s.surah}?ayah=${s.ayah}`)}
                  className="px-3 py-1.5 rounded-full bg-background border border-border text-xs text-foreground hover:border-amber-500/50 transition-colors"
                >
                  {surah.name} {toArabicNum(s.ayah)}
                  {s.obligatory ? " •" : ""}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {hizbList.map((hizb) => {
            const startSurah = SURAHS.find((s) => s.number === hizb.startSurah);
            const endSurah = SURAHS.find((s) => s.number === hizb.endSurah);
            const startAyah = getAyah(hizb.startSurah, hizb.startAyah);
            if (!startSurah || !endSurah || !startAyah) return null;
            return (
              <button
                key={hizb.number}
                onClick={() => navigate(`/surah/${hizb.startSurah}?ayah=${hizb.startAyah}`)}
                className="w-full text-right bg-card border border-border rounded-2xl p-4 hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-arabic text-lg flex-shrink-0">
                      {toArabicNum(hizb.number)}
                    </span>
                    <div className="min-w-0">
                      <div className="font-arabic text-base text-foreground">
                        الحزب {toArabicNum(hizb.number)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        من سورة {startSurah.name} — الآية {toArabicNum(hizb.startAyah)}
                        {" "}إلى سورة {endSurah.name} — الآية {toArabicNum(hizb.endAyah)}
                      </div>
                    </div>
                  </div>
                  <span className="text-primary text-lg flex-shrink-0">‹</span>
                </div>
                <div
                  className="text-sm text-muted-foreground mt-2 leading-relaxed"
                  style={{ fontFamily: "'Amiri Quran', serif" }}
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
