// وضع القراءة بملء الشاشة (1.0.78) — مصحف جديد للقراءة السريعة:
// الصفحة تملأ الشاشة كلها بلا شريط علوي ولا شريط سفلي، والتنقل بين
// الصفحات بالسحب (يسار = التالية، يمين = السابقة) أو بالأسهم أو من شريط
// الأدوات الذي يظهر بضغطة زر. كل مزايا المصحف الأول محفوظة: صفحات
// مدنية ٦٠٤، عناوين السور، البسملة، تلوين التجويد + ورقة الشرح، الضغط
// على كلمة يفتح ورقتها (مع إجراءات الآية: تفسير/روايات/حفظ/مشاركة/نسخ
// + تقييم الحفظ)، الضغط على آية ينقل للمشغّل، والصفحة الأخيرة محفوظة
// بنفس مفتاح المصحف الأول — الوضعان يتشاركان موضعك.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Moon, Palette, SlidersHorizontal, Sun, X } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { SURAHS } from "@/data/surahs";
import { getMushafPageRange, getLastMushafPage, setLastMushafPage } from "@/data/mushaf-pages";
import { getSurahAyahs, displayAyahText } from "@/data/quran-text";
import { getTranslation } from "@/data/translation-en";
import { buildPageAyahs, BASMALA, type PageAyah } from "@/pages/MushafPage";
import TajweedText, { TAJWEED_LEGEND } from "@/components/TajweedText";
import WordTapText from "@/components/WordTapText";
import WordSheet from "@/components/WordSheet";
import TajweedRuleSheet from "@/components/TajweedRuleSheet";
import TafsirSheet from "@/components/TafsirSheet";
import SharePreviewSheet from "@/components/SharePreviewSheet";
import { useFavourites } from "@/hooks/useFavourites";
import { copyTextToClipboard } from "@/lib/copy";

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d, 10)]);
}

export default function ReadingMode({
  darkMode,
  toggleDarkMode,
}: {
  darkMode: boolean;
  toggleDarkMode: () => void;
}) {
  const [, params] = useRoute("/reading/:page");
  const [, navigate] = useLocation();
  const [page, setPage] = useState<number>(() => {
    const p = params?.page ? parseInt(params.page, 10) : NaN;
    if (!isNaN(p) && p >= 1 && p <= 604) return p;
    return getLastMushafPage();
  });
  const [jump, setJump] = useState("");
  const [showTools, setShowTools] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Keep the page in sync when the URL changes from outside (e.g. a
  // pasted link): the route renders a stable element, so the component
  // is NOT remounted on navigation — without this, an external
  // /reading/:page link would leave the old page on screen.
  useEffect(() => {
    const p = params?.page ? parseInt(params.page, 10) : NaN;
    if (!isNaN(p) && p >= 1 && p <= 604 && p !== page) setPage(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.page]);

  // تلوين التجويد — المفتاح نفسه المستعمل في المشغّل والمصحف الأول.
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

  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const [wordSheet, setWordSheet] = useState<{
    surahNumber: number;
    ayahNumber: number;
    wordIndex: number;
    wordText: string;
  } | null>(null);
  // A page can span two surahs, so tafsir/share targets carry both.
  const [tafsirTarget, setTafsirTarget] = useState<{ surah: number; ayah: number } | null>(null);
  const [shareTarget, setShareTarget] = useState<{ surah: number; ayah: number } | null>(null);
  const [copiedAyah, setCopiedAyah] = useState<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const { isFavourite, toggleFavourite } = useFavourites();

  const range = getMushafPageRange(page);
  const items = useMemo(() => buildPageAyahs(page), [page]);

  // Keep the URL and the last-read page in sync (same key as the old
  // Mushaf — both modes share the reader's position).
  useEffect(() => {
    setLastMushafPage(page);
    if (params?.page !== String(page)) {
      navigate(`/reading/${page}`, { replace: true });
    }
    contentRef.current?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const goTo = useCallback((p: number) => {
    if (p >= 1 && p <= 604) setPage(p);
  }, []);

  // السحب للتنقل: يسار = الصفحة التالية، يمين = السابقة (اتجاه القراءة).
  // السحب حركة لا نقرة، فيُكبَت حدث النقر الذي يليها حتى لا تُفتح ورقة
  // كلمة أو ينتقل المشغّل بالخطأ.
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);
  const onPointerDown = (e: React.PointerEvent) => {
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swipedRef.current = true;
      window.setTimeout(() => {
        swipedRef.current = false;
      }, 150);
      if (dx < 0) goTo(page + 1);
      else goTo(page - 1);
    }
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (swipedRef.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  // أسهم لوحة المفاتيح للتنقل (اليسار = التالية في اتجاه القراءة).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (wordSheet || tafsirTarget != null || shareTarget != null) return;
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowLeft") goTo(page + 1);
      if (e.key === "ArrowRight") goTo(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, wordSheet, tafsirTarget, shareTarget, goTo]);

  const handleCopyAyah = useCallback(
    async (surah: number, ayahNumber: number) => {
      const ayah = getSurahAyahs(surah)[ayahNumber - 1];
      if (!ayah) return;
      const text = `${displayAyahText(surah, ayahNumber, ayah.text)} ﴿${toArabicNum(ayahNumber)}﴾\nسورة ${SURAHS[surah - 1].name} — الآية ${toArabicNum(ayahNumber)}`;
      const ok = await copyTextToClipboard(text);
      if (ok) {
        setCopiedAyah(ayahNumber);
        if (copyTimerRef.current != null) window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = window.setTimeout(() => setCopiedAyah(null), 2000);
      }
    },
    []
  );

  const sharePreviewData = (() => {
    if (shareTarget == null) return null;
    const ayah = getSurahAyahs(shareTarget.surah)[shareTarget.ayah - 1];
    if (!ayah) return null;
    return {
      ayahText: displayAyahText(shareTarget.surah, shareTarget.ayah, ayah.text),
      surahName: SURAHS[shareTarget.surah - 1].name,
      surahNumber: shareTarget.surah,
      ayahNumber: shareTarget.ayah,
      translation: getTranslation(shareTarget.surah, shareTarget.ayah),
    };
  })();

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
    <div className="fixed inset-0 z-[100] bg-background flex flex-col" data-testid="reading-mode">
      {/* The page itself — full screen, scrollable */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClickCapture={onClickCapture}
      >
        <div className="min-h-full px-5 py-6">
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
          <div className="quran-text text-right leading-loose text-[30px]" dir="rtl">
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
                    data-surah={b.item.surah}
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
          <div className="text-center text-xs text-muted-foreground mt-6 pb-16">
            اضغط أي آية للانتقال إليها في المشغّل • اسحب يميناً أو يساراً لتقليب الصفحات
          </div>
        </div>
      </div>

      {/* Page pill — always visible, never blocks taps */}
      {!showTools && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card/85 backdrop-blur border border-border px-3 py-1.5 rounded-full text-xs text-muted-foreground pointer-events-none whitespace-nowrap"
          data-testid="reading-page-pill"
        >
          صفحة {toArabicNum(page)} / {toArabicNum(604)}
          {startSurah ? ` • سورة ${startSurah.name}` : ""}
        </div>
      )}

      {/* Floating tools button — only while the tools are hidden */}
      {!showTools && (
        <button
          onClick={() => setShowTools(true)}
          className="absolute bottom-4 left-4 w-11 h-11 rounded-full bg-card/85 backdrop-blur border border-border text-foreground flex items-center justify-center shadow-md active:scale-95 transition-transform"
          aria-label="إظهار أدوات القراءة"
          title="أدوات القراءة"
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      )}

      {/* Tools overlay */}
      {showTools && (
        <div data-testid="reading-tools">
          <div className="absolute inset-x-0 top-0 bg-background/95 backdrop-blur border-b border-border">
            <div className="px-4 py-3 flex items-center gap-2">
              <button
                onClick={() => navigate(`/mushaf/${page}`)}
                className="p-2 rounded-full hover:bg-muted transition-colors"
                aria-label="العودة إلى المصحف"
                title="العودة إلى المصحف"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <span className="font-arabic text-lg text-primary flex-1">وضع القراءة</span>
              <span className="text-xs text-muted-foreground bg-card border border-border px-2.5 py-1 rounded-full whitespace-nowrap">
                صفحة {toArabicNum(page)} / {toArabicNum(604)}
              </span>
              <button
                onClick={toggleTajweed}
                className={`p-2 rounded-full hover:bg-muted transition-colors ${tajweed ? "bg-primary/10 text-primary" : ""}`}
                aria-label="تفعيل تلوين التجويد أو إيقافه"
                title="تلوين التجويد"
              >
                <Palette className="w-4 h-4" />
              </button>
              <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="تبديل الوضع الليلي">
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setShowTools(false)}
                className="p-2 rounded-full hover:bg-muted transition-colors"
                aria-label="إخفاء الأدوات"
                title="إخفاء الأدوات"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {tajweed && (
              <div className="px-4 pb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                <span className="text-xs text-muted-foreground">أحكام التجويد — اضغط أي حرف ملوّن لشرح حكمه:</span>
                {TAJWEED_LEGEND.map((item) => (
                  <span key={item.label} className="flex items-center gap-1 text-xs">
                    <span className={`w-2.5 h-2.5 rounded-full bg-current ${item.className}`} />
                    <span className={item.className}>{item.label}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-background/95 backdrop-blur border-t border-border px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => goTo(page - 1)}
                disabled={page <= 1}
                className="flex items-center gap-1 px-4 py-2 rounded-full bg-card border border-border text-sm disabled:opacity-40 hover:border-primary/40 active:scale-95 transition-all"
                aria-label="الصفحة السابقة"
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
                className="flex items-center gap-1 px-4 py-2 rounded-full bg-card border border-border text-sm disabled:opacity-40 hover:border-primary/40 active:scale-95 transition-all"
                aria-label="الصفحة التالية"
              >
                التالية
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            <form
              className="mt-3 flex items-center justify-center gap-2"
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
                aria-label="رقم الصفحة"
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
        </div>
      )}

      {/* شرح حكم التجويد المضغوط عليه */}
      <TajweedRuleSheet rule={selectedRule} onClose={() => setSelectedRule(null)} />
      {/* Word sheet for a tapped word — with ayah actions (no audio here) */}
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
          actions={{
            isFav: isFavourite(wordSheet.surahNumber, wordSheet.ayahNumber),
            onToggleFavourite: () => toggleFavourite(wordSheet.surahNumber, wordSheet.ayahNumber),
            onTafsir: () => {
              setWordSheet(null);
              setTafsirTarget({ surah: wordSheet.surahNumber, ayah: wordSheet.ayahNumber });
            },
            onReadings: () => navigate(`/readings/${wordSheet.surahNumber}/${wordSheet.ayahNumber}`),
            onShare: () => {
              setWordSheet(null);
              setShareTarget({ surah: wordSheet.surahNumber, ayah: wordSheet.ayahNumber });
            },
            onCopy: () => handleCopyAyah(wordSheet.surahNumber, wordSheet.ayahNumber),
            copied: copiedAyah === wordSheet.ayahNumber,
          }}
        />
      )}
      {/* Tafsir sheet for the selected ayah */}
      {tafsirTarget && (
        <TafsirSheet
          surahNumber={tafsirTarget.surah}
          ayahNumber={tafsirTarget.ayah}
          onClose={() => setTafsirTarget(null)}
        />
      )}
      {/* Share preview sheet for the selected ayah */}
      {sharePreviewData && (
        <SharePreviewSheet ayah={sharePreviewData} onClose={() => setShareTarget(null)} />
      )}
    </div>
  );
}
