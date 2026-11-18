// ورقة الكلمة — تظهر عند الضغط على كلمة في السورة أو المصحف: جذرها
// ومصدرها ونوعها ومعناها في غريب القرآن، وكل آية فيها نفس الجذر.
// Bottom sheet like TajweedRuleSheet (z-[100], above the bottom nav).
import { useEffect, useMemo } from "react";
import { X, BookOpen, Hash, Type, Tag, ListOrdered, BookCopy, Heart, Share2, Copy, Check } from "lucide-react";
import { getWordInfo, searchByRoot, surahName } from "@/lib/word-root";
import { getAyah, displayAyahText } from "@/data/quran-text";
import HifzRating from "@/components/HifzRating";

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

interface WordSheetProps {
  surahNumber: number;
  ayahNumber: number;
  /** Index into splitAyahWords() of the displayed ayah text (see word-root.ts). */
  wordIndex: number;
  wordText: string;
  onClose: () => void;
  /** Navigate to an ayah (surah, ayah) — the parent owns navigation. */
  onNavigateAyah: (surahNumber: number, ayahNumber: number) => void;
  /** Ayah actions (1.0.75) — shown inside the sheet when the parent
      provides them (SurahPlayer); omitted in MushafPage, which has no
      tafsir/share/copy wiring. */
  actions?: {
    isFav: boolean;
    onToggleFavourite: () => void;
    onTafsir: () => void;
    onReadings: () => void;
    onShare: () => void;
    onCopy: () => void;
    copied: boolean;
  };
  /** Called after a hifz rating inside the sheet (parent refreshes the
      inline rating under the ayah). */
  onRated?: () => void;
}

// Long root lists (e.g. «علم» in ~150 ayahs) stay scrollable; cap the
// rendered rows so the sheet never has to mount thousands of nodes.
const MAX_ROOT_AYAHS_SHOWN = 300;

export default function WordSheet({
  surahNumber,
  ayahNumber,
  wordIndex,
  wordText,
  onClose,
  onNavigateAyah,
  actions,
  onRated,
}: WordSheetProps) {
  const info = useMemo(
    () => getWordInfo(surahNumber, ayahNumber, wordIndex, wordText),
    [surahNumber, ayahNumber, wordIndex, wordText]
  );
  const rootResult = useMemo(
    () => (info?.root ? searchByRoot(info.root) : null),
    [info?.root]
  );

  // Lock the page behind the sheet while it is open (same as TafsirSheet).
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

  if (!info) return null;
  const surah = surahName(surahNumber);
  const shownAyahs = rootResult ? rootResult.ayahs.slice(0, MAX_ROOT_AYAHS_SHOWN) : [];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      onClick={onClose}
      data-testid="word-sheet"
      dir="rtl"
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg bg-card border border-border rounded-t-2xl shadow-xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="font-arabic text-lg text-primary">الكلمة</span>
            <span className="text-sm text-muted-foreground">
              سورة {surah} — الآية {toArabicNum(ayahNumber)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {/* The tapped word */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 text-center">
            <div
              className="text-4xl leading-relaxed"
              style={{ fontFamily: "'Scheherazade New', 'Amiri Quran', serif" }}
              data-testid="word-text"
            >
              {info.wordText}
            </div>
          </div>

          {/* Ayah actions (1.0.75) — tapping an ayah used to open only
              this sheet and hide the ayah's actions (tafsir / share /
              copy / favourite / readings + hifz rating). They now live
              here too, right under the word, so one tap shows both. */}
          {actions && (
            <div data-testid="word-sheet-actions">
              <div className="text-xs text-muted-foreground mb-2">إجراءات الآية</div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={actions.onTafsir}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-arabic bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors whitespace-nowrap"
                  aria-label="التفسير"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  التفسير
                </button>
                <button
                  onClick={actions.onReadings}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-arabic bg-teal-500/10 border border-teal-500/30 text-teal-700 dark:text-teal-400 hover:bg-teal-500/20 transition-colors whitespace-nowrap"
                  aria-label="مقارنة الروايات"
                >
                  <BookCopy className="w-3.5 h-3.5" />
                  الروايات
                </button>
                <button
                  onClick={actions.onToggleFavourite}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-arabic border transition-colors whitespace-nowrap ${
                    actions.isFav
                      ? "bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-400"
                      : "bg-background border-border text-muted-foreground hover:text-rose-600"
                  }`}
                  aria-label="حفظ في المفضلة"
                >
                  <Heart className={`w-3.5 h-3.5 ${actions.isFav ? "fill-rose-500 text-rose-500" : ""}`} />
                  {actions.isFav ? "محفوظة" : "حفظ"}
                </button>
                <button
                  onClick={actions.onShare}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-arabic bg-background border border-border text-muted-foreground hover:text-primary transition-colors whitespace-nowrap"
                  aria-label="مشاركة الآية كصورة"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  مشاركة
                </button>
                <button
                  onClick={actions.onCopy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-arabic bg-background border border-border text-muted-foreground hover:text-primary transition-colors whitespace-nowrap"
                  aria-label="نسخ نص الآية"
                >
                  {actions.copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {actions.copied ? "تم النسخ ✓" : "نسخ"}
                </button>
              </div>
              <div className="mt-2">
                <HifzRating surahNumber={surahNumber} ayahNumber={ayahNumber} onRated={() => onRated?.()} />
              </div>
            </div>
          )}

          {/* Root / lemma / POS */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                <Hash className="w-3.5 h-3.5" />
                الجذر
              </div>
              {info.root ? (
                <div
                  className="font-arabic text-xl text-primary"
                  data-testid="word-root"
                >
                  {info.root}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground leading-relaxed" data-testid="word-root-empty">
                  لا جذر
                  <br />
                  لهذه الكلمة
                </div>
              )}
            </div>
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                <Type className="w-3.5 h-3.5" />
                المصدر
              </div>
              {info.lemma ? (
                <div
                  className="font-arabic text-xl"
                  data-testid="word-lemma"
                >
                  {info.lemma}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground leading-relaxed" data-testid="word-lemma-empty">
                  —
                </div>
              )}
            </div>
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                <Tag className="w-3.5 h-3.5" />
                نوع الكلمة
              </div>
              {info.pos ? (
                <div className="font-arabic text-base leading-snug" data-testid="word-pos">
                  {info.pos}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground leading-relaxed" data-testid="word-pos-empty">
                  —
                </div>
              )}
            </div>
          </div>

          {/* Gharib meaning */}
          <div>
            <div className="text-xs text-muted-foreground mb-2">معنى الكلمة في غريب القرآن</div>
            {info.meanings.length > 0 ? (
              <div className="space-y-2" data-testid="word-meaning">
                {info.meanings.map((m, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-3">
                    <p className="text-sm leading-relaxed">{m.meaning}</p>
                    <div className="text-xs text-muted-foreground mt-1.5">
                      {m.bookShort}
                      {m.word !== info.wordText ? ` — «${m.word}»` : ""}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-3" data-testid="word-meaning-empty">
                لا يوجد معنى في غريب القرآن لهذه الكلمة
              </p>
            )}
          </div>

          {/* Every ayah with the same root */}
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <ListOrdered className="w-3.5 h-3.5" />
              {rootResult ? (
                <span data-testid="root-ayah-count">
                  ورد الجذر «{rootResult.root}» في {toArabicNum(rootResult.ayahCount)} آية
                  ({toArabicNum(rootResult.totalOccurrences)} مرة)
                </span>
              ) : (
                <span>لا آيات بهذا الجذر</span>
              )}
            </div>
            {rootResult && rootResult.ayahs.length > 0 ? (
              <div className="space-y-1.5" data-testid="root-ayahs">
                {shownAyahs.map((a) => {
                  const ayah = getAyah(a.surahNumber, a.ayahNumber);
                  const text = ayah ? displayAyahText(a.surahNumber, a.ayahNumber, ayah.text) : "";
                  return (
                    <button
                      key={`${a.surahNumber}:${a.ayahNumber}`}
                      onClick={() => onNavigateAyah(a.surahNumber, a.ayahNumber)}
                      className="w-full text-right bg-card border border-border rounded-xl p-3 hover:border-primary/40 transition-colors"
                      data-root-ayah={`${a.surahNumber}:${a.ayahNumber}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-arabic text-sm text-primary">
                          سورة {surahName(a.surahNumber)} — الآية {toArabicNum(a.ayahNumber)}
                        </span>
                        {a.count > 1 && (
                          <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 shrink-0">
                            ×{toArabicNum(a.count)}
                          </span>
                        )}
                      </div>
                      <div
                        className="text-sm text-muted-foreground leading-relaxed mt-1 line-clamp-2"
                        style={{ fontFamily: "'Scheherazade New', 'Amiri Quran', serif" }}
                      >
                        {text}
                      </div>
                    </button>
                  );
                })}
                {rootResult.ayahs.length > MAX_ROOT_AYAHS_SHOWN && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    و{toArabicNum(rootResult.ayahs.length - MAX_ROOT_AYAHS_SHOWN)} آية أخرى
                  </p>
                )}
              </div>
            ) : (
              rootResult && (
                <p className="text-sm text-muted-foreground text-center py-3">
                  لم نجد آيات أخرى بهذا الجذر
                </p>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
