import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Volume2, BookOpen } from "lucide-react";
import { SURAHS } from "@/data/surahs";
import { getAyah } from "@/data/quran-text";
import { getTafsir, TAFSIR_EDITION_NAME } from "@/data/tafsir-muyassar";

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

interface TafsirSheetProps {
  surahNumber: number;
  ayahNumber: number;
  onClose: () => void;
  /** Play this ayah's audio (SurahPlayer only). */
  onPlayAyah?: (ayahNumber: number) => void;
}

// Full-screen sheet showing one ayah and its tafsir (Tafsir al-Muyassar,
// bundled offline). Prev/next move to the neighbouring ayahs in the same
// surah, so the user can read the tafsir ayah by ayah without closing.
export default function TafsirSheet({ surahNumber, ayahNumber, onClose, onPlayAyah }: TafsirSheetProps) {
  const [currentAyah, setCurrentAyah] = useState(ayahNumber);

  useEffect(() => {
    setCurrentAyah(ayahNumber);
  }, [ayahNumber]);

  const surah = SURAHS.find((s) => s.number === surahNumber);
  const ayah = getAyah(surahNumber, currentAyah);
  const tafsir = getTafsir(surahNumber, currentAyah);
  const totalAyahs = surah?.numberOfAyahs ?? 0;

  const goPrev = () => {
    if (currentAyah > 1) setCurrentAyah(currentAyah - 1);
  };
  const goNext = () => {
    if (currentAyah < totalAyahs) setCurrentAyah(currentAyah + 1);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/95">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="font-arabic text-lg text-primary">تفسير الآية</span>
          {surah && (
            <span className="text-sm text-muted-foreground">
              سورة {surah.name} — الآية {toArabicNum(currentAyah)}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="إغلاق">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body (scrollable) */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
          {/* The ayah itself */}
          {ayah && (
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 text-center">
              <div className="quran-text text-2xl leading-loose" dir="rtl">
                {ayah.text}{" "}
                <span className="text-primary text-lg">﴿{toArabicNum(ayah.numberInSurah)}﴾</span>
              </div>
            </div>
          )}

          {/* The tafsir */}
          <div>
            <div className="text-xs text-muted-foreground mb-2 text-center">{TAFSIR_EDITION_NAME}</div>
            {tafsir ? (
              <p className="text-base leading-loose text-right whitespace-pre-line">{tafsir}</p>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">لا يوجد تفسير لهذه الآية</p>
            )}
          </div>
        </div>
      </div>

      {/* Footer: prev / play / next */}
      <div className="border-t border-border bg-background/95 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <button
            onClick={goPrev}
            disabled={currentAyah <= 1}
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-card border border-border text-sm disabled:opacity-40 hover:border-primary/40 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
            الآية السابقة
          </button>
          {onPlayAyah && (
            <button
              onClick={() => onPlayAyah(currentAyah)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              استمع للآية
            </button>
          )}
          <button
            onClick={goNext}
            disabled={currentAyah >= totalAyahs}
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-card border border-border text-sm disabled:opacity-40 hover:border-primary/40 transition-colors"
          >
            الآية التالية
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
