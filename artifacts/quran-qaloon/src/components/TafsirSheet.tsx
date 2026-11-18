import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Volume2, BookOpen, Heart, Share2 } from "lucide-react";
import { SURAHS } from "@/data/surahs";
import { getAyah, displayAyahText } from "@/data/quran-text";
import { getTafsir, TAFSIR_EDITION_NAME } from "@/data/tafsir-muyassar";
import { getTafsirJalalayn, TAFSIR_JALALAYN_EDITION_NAME } from "@/data/tafsir-jalalayn";
import AsbabSection from "@/components/AsbabSection";
import { getTranslation, TRANSLATION_EDITION_NAME } from "@/data/translation-en";
import SharePreviewSheet from "@/components/SharePreviewSheet";
import { useFavourites } from "@/hooks/useFavourites";

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
  const { isFavourite, toggleFavourite } = useFavourites();
  // Tafsir edition: Muyassar (default) or Jalalayn — persisted, so the
  // choice survives reopening the sheet.
  const [edition, setEdition] = useState<"muyassar" | "jalalayn">(() => {
    try {
      return localStorage.getItem("quran_tafsir_edition") === "jalalayn" ? "jalalayn" : "muyassar";
    } catch {
      return "muyassar";
    }
  });

  const setTafsirEdition = (e: "muyassar" | "jalalayn") => {
    setEdition(e);
    try {
      localStorage.setItem("quran_tafsir_edition", e);
    } catch {
      // storage unavailable
    }
  };

  useEffect(() => {
    setCurrentAyah(ayahNumber);
  }, [ayahNumber]);

  const surah = SURAHS.find((s) => s.number === surahNumber);
  const ayah = getAyah(surahNumber, currentAyah);
  const tafsir =
    edition === "jalalayn"
      ? getTafsirJalalayn(surahNumber, currentAyah)
      : getTafsir(surahNumber, currentAyah);
  const editionName =
    edition === "jalalayn" ? TAFSIR_JALALAYN_EDITION_NAME : TAFSIR_EDITION_NAME;
  const translation = getTranslation(surahNumber, currentAyah);
  const totalAyahs = surah?.numberOfAyahs ?? 0;

  // Lock the page behind the sheet while it is open, so the surah does not
  // scroll away underneath it.
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const prevBody = body.style.overflow;
    const prevHtml = html.style.overflow;
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevBody;
      html.style.overflow = prevHtml;
    };
  }, []);

  // Share preview sheet state (the sheet renders, saves and shares the image).
  const [showSharePreview, setShowSharePreview] = useState(false);

  const goPrev = () => {
    if (currentAyah > 1) setCurrentAyah(currentAyah - 1);
  };
  const goNext = () => {
    if (currentAyah < totalAyahs) setCurrentAyah(currentAyah + 1);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background" dir="rtl">
      {/* Header — pushed down like the main player header: the sheet is
          full-screen (fixed inset-0), so without top padding its bar
          sits right under the phone's status bar / notch and is not
          clearly visible. Same safe-area-aware value as header.sticky. */}
      <div
        className="flex items-center justify-between px-4 pb-3 border-b border-border bg-background/95"
        style={{ paddingTop: "max(2.25rem, calc(env(safe-area-inset-top, 0px) + 1.25rem))" }}
      >
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
          {/* The ayah itself — fixed size, NOT the .quran-text class:
              .quran-text reads the user's reading font-size variable
              (--quran-font-size), which can be 36px and makes a long
              ayah overflow the sheet. Here the ayah is a reference
              header above the tafsir, so it stays a steady 20px. */}
          {ayah && (
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 text-center">
              <div
                className="text-xl leading-loose"
                style={{ fontFamily: "'Scheherazade New', 'Amiri Quran', serif" }}
                dir="rtl"
              >
                {displayAyahText(surahNumber, currentAyah, ayah.text)}{" "}
                <span className="text-primary text-lg">﴿{toArabicNum(ayah.numberInSurah)}﴾</span>
              </div>
              {translation && (
                <div className="mt-3 pt-3 border-t border-primary/10">
                  <div className="text-xs text-muted-foreground mb-1">{TRANSLATION_EDITION_NAME}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed" dir="ltr">
                    {translation}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* The tafsir — two editions, both bundled offline */}
          <div>
            <div className="flex items-center justify-center gap-1.5 mb-3">
              <button
                onClick={() => setTafsirEdition("muyassar")}
                className={`px-3 py-1.5 rounded-full text-xs font-arabic transition-colors ${
                  edition === "muyassar"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {TAFSIR_EDITION_NAME}
              </button>
              <button
                onClick={() => setTafsirEdition("jalalayn")}
                className={`px-3 py-1.5 rounded-full text-xs font-arabic transition-colors ${
                  edition === "jalalayn"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {TAFSIR_JALALAYN_EDITION_NAME}
              </button>
            </div>
            <div className="text-xs text-muted-foreground mb-2 text-center">{editionName}</div>
            {tafsir ? (
              <p className="text-base leading-loose text-right whitespace-pre-line">{tafsir}</p>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">لا يوجد تفسير لهذه الآية</p>
            )}
          </div>

          {/* [1.0.74] سبب النزول (الواحدي) — يظهر فقط للآيات المشمولة (٥٦٤ آية) */}
          <AsbabSection surahNumber={surahNumber} ayahNumber={currentAyah} />
        </div>
      </div>

      {/* Footer: prev / play / next — compact so all five controls fit one row */}
      <div className="border-t border-border bg-background/95 px-2 py-2">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-1.5">
          <button
            onClick={goPrev}
            disabled={currentAyah <= 1}
            className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs whitespace-nowrap disabled:opacity-40 hover:border-primary/40 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
            الآية السابقة
          </button>
          {onPlayAyah && (
            <button
              onClick={() => onPlayAyah(currentAyah)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs whitespace-nowrap hover:bg-primary/90 transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5" />
              استمع للآية
            </button>
          )}
          <button
            onClick={() => toggleFavourite(surahNumber, currentAyah)}
            className={`p-2 rounded-lg border transition-colors ${
              isFavourite(surahNumber, currentAyah)
                ? "bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-400"
                : "bg-card border-border text-muted-foreground hover:text-rose-600"
            }`}
            aria-label="حفظ في المفضلة"
          >
            <Heart
              className={`w-3.5 h-3.5 ${
                isFavourite(surahNumber, currentAyah) ? "fill-rose-500 text-rose-500" : ""
              }`}
            />
          </button>
          <button
            onClick={() => setShowSharePreview(true)}
            className="p-2 rounded-lg bg-card border border-border text-muted-foreground hover:text-primary transition-colors"
            aria-label="مشاركة الآية كصورة"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={goNext}
            disabled={currentAyah >= totalAyahs}
            className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs whitespace-nowrap disabled:opacity-40 hover:border-primary/40 transition-colors"
          >
            الآية التالية
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Share preview sheet for the current ayah */}
      {showSharePreview && ayah && surah && (
        <SharePreviewSheet
          ayah={{
            ayahText: displayAyahText(surahNumber, currentAyah, ayah.text),
            surahName: surah.name,
            surahNumber,
            ayahNumber: currentAyah,
            translation,
          }}
          onClose={() => setShowSharePreview(false)}
        />
      )}
    </div>
  );
}
