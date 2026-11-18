import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Heart, Moon, Sun, X } from "lucide-react";
import { SURAHS } from "@/data/surahs";
import { getAyah } from "@/data/quran-text";
import { useFavourites } from "@/hooks/useFavourites";

interface FavouritesPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

export default function FavouritesPage({ darkMode, toggleDarkMode }: FavouritesPageProps) {
  const [, navigate] = useLocation();
  const { favourites, removeFavourite } = useFavourites();

  // بترتيب المصحف (سورة ثم آية) حتى تُقرأ القائمة بالتسلسل.
  const sorted = useMemo(
    () =>
      [...favourites].sort((a, b) =>
        a.surah === b.surah ? a.ayah - b.ayah : a.surah - b.surah
      ),
    [favourites]
  );

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
            <Heart className="w-5 h-5 text-primary fill-primary" />
            <span className="font-arabic text-lg text-primary">المفضلة</span>
            {sorted.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {toArabicNum(sorted.length)} آية
              </span>
            )}
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {sorted.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Heart className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
            <div className="font-arabic text-lg text-foreground mb-2">لا توجد آيات محفوظة بعد</div>
            <div className="text-sm leading-relaxed">
              اضغط على أي آية في المصحف، ثم اضغط زر القلب ♥ بجانب زر «التفسير»
              <br />
              وستظهر الآية هنا لترجع إليها بسرعة.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((fav) => {
              const surah = SURAHS.find((s) => s.number === fav.surah);
              const ayah = getAyah(fav.surah, fav.ayah);
              if (!surah || !ayah) return null;
              return (
                <div
                  key={`${fav.surah}:${fav.ayah}`}
                  className="bg-card border border-border rounded-2xl p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => navigate(`/surah/${fav.surah}?ayah=${fav.ayah}`)}
                      className="flex-1 text-right min-w-0"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-arabic text-primary">
                          سورة {surah.name} — الآية {toArabicNum(fav.ayah)}
                        </span>
                      </div>
                      <div
                        className="text-lg leading-loose text-foreground"
                        style={{ fontFamily: "'Scheherazade New', 'Amiri Quran', serif" }}
                        dir="rtl"
                      >
                        {ayah.text}{" "}
                        <span className="text-primary inline-block mx-1 text-base">
                          ﴿{toArabicNum(fav.ayah)}﴾
                        </span>
                      </div>
                    </button>
                    <button
                      onClick={() => removeFavourite(fav.surah, fav.ayah)}
                      className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground flex-shrink-0"
                      aria-label="إزالة من المفضلة"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
