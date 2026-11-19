// وضع القراءة بملء الشاشة (1.0.78) — مصحف جديد للقراءة السريعة:
// الصفحة تملأ الشاشة كلها بلا شريط علوي ولا شريط سفلي، والتنقل بين
// الصفحات بالسحب (يسار = التالية، يمين = السابقة) أو بالأسهم أو من شريط
// الأدوات الذي يظهر بضغطة زر. كل مزايا المصحف الأول محفوظة: صفحات
// مدنية ٦٠٤، عناوين السور، البسملة، تلوين التجويد + ورقة الشرح، الضغط
// على كلمة يفتح ورقتها (مع إجراءات الآية: تفسير/روايات/حفظ/مشاركة/نسخ
// + تقييم الحفظ)، والصفحة الأخيرة محفوظة بنفس مفتاح المصحف الأول —
// الوضعان يتشاركان موضعك.
// (1.0.79) الصفحة كاملة بلا تمرير عمودي: الخط يتكيّف حتى تدخل الصفحة
// كلها في الشاشة. والضغط على آية يشغّل صوتها (أول ضغطة تشغّل، الثانية
// على نفس الآية تفتح ورقة الكلمة)، مع لوحة الآية تحتها (تفسير/روايات/
// حفظ/مشاركة/نسخ + تقييم الحفظ + إعادة + متواصل + خروج) — نفس قاعدة
// المشغّل، والصوت ملف MP3 لكل آية فلا حاجة لجداول توقيت.
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Moon, Palette, SlidersHorizontal, Sun, X } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import {
  SURAHS,
  RECITERS,
  getRecitersForQirah,
  getGlobalAyahNumber,
  buildAyahAudioUrl,
} from "@/data/surahs";
import {
  getMushafPageRange,
  getLastMushafPage,
  setLastMushafPage,
  getPageOfAyah,
} from "@/data/mushaf-pages";
import { getSurahAyahs, displayAyahText } from "@/data/quran-text";
import { getTranslation } from "@/data/translation-en";
import { buildPageAyahs, BASMALA, type PageAyah } from "@/pages/MushafPage";
import { AyahActions, getStoredQirahId, getStoredReciterId } from "@/pages/SurahPlayer";
import { getPlayerVolume, getPlayerRate } from "@/hooks/useAudio";
import { useOffline } from "@/context/OfflineContext";
import TajweedText, { TAJWEED_LEGEND } from "@/components/TajweedText";
import WordTapText from "@/components/WordTapText";
import WordSheet from "@/components/WordSheet";
import TajweedRuleSheet from "@/components/TajweedRuleSheet";
import TafsirSheet from "@/components/TafsirSheet";
import SharePreviewSheet from "@/components/SharePreviewSheet";
import HifzRating from "@/components/HifzRating";
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
  const innerRef = useRef<HTMLDivElement | null>(null);

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
  const [hifzVersion, setHifzVersion] = useState(0);
  const { isFavourite, toggleFavourite } = useFavourites();

  // [1.0.79] صوت الآية في وضع القراءة (نفس قاعدة المشغّل).
  const [selectedAyah, setSelectedAyah] = useState<{
    surah: number;
    ayah: number;
  } | null>(null);
  const [playingAyah, setPlayingAyah] = useState<{
    surah: number;
    ayah: number;
  } | null>(null);
  const [ayahContinuous, setAyahContinuous] = useState<boolean>(() => {
    try {
      return localStorage.getItem("quran_ayah_continuous") === "1";
    } catch {
      return false;
    }
  });
  const ayahContinuousRef = useRef(ayahContinuous);
  const [ayahError, setAyahError] = useState<string | null>(null);
  const [ayahBuffering, setAyahBuffering] = useState(false);
  const [ayahStarted, setAyahStarted] = useState(false);
  const ayahAudioRef = useRef<HTMLAudioElement | null>(null);
  const ayahPrefetchRef = useRef<HTMLAudioElement | null>(null);
  // الجلسة الجارية (لتجاهل نتائج بحث قديمة عن ملف مخزّن).
  const ayahSessionRef = useRef<{ surah: number; ayah: number } | null>(null);
  const { getCachedAyahUrl, cacheAyahAudio } = useOffline();

  useEffect(() => {
    ayahContinuousRef.current = ayahContinuous;
    try {
      localStorage.setItem("quran_ayah_continuous", ayahContinuous ? "1" : "0");
    } catch {
      // storage unavailable
    }
  }, [ayahContinuous]);

  const getCurrentReciter = useCallback(() => {
    const qirahId = getStoredQirahId();
    const reciterId = getStoredReciterId(qirahId);
    const reciters = getRecitersForQirah(qirahId);
    return reciters.find((r) => r.id === reciterId) ?? reciters[0] ?? RECITERS[0];
  }, []);

  const getNextAyah = useCallback(
    (surah: number, ayah: number): { surah: number; ayah: number } | null => {
      if (ayah < getSurahAyahs(surah).length) return { surah, ayah: ayah + 1 };
      if (surah < 114) return { surah: surah + 1, ayah: 1 };
      return null;
    },
    []
  );

  const stopAyah = useCallback(() => {
    const audio = ayahAudioRef.current;
    if (audio) audio.pause();
    ayahSessionRef.current = null;
    setAyahStarted(false);
    setPlayingAyah(null);
  }, []);

  const playAyah = useCallback(
    async (surah: number, ayah: number, fromTap = false, force = false) => {
      void fromTap;
      // الضغط على الآية الجارية يوقفها ويغلق اللوحة — إلا عند الإعادة
      // الصريحة (force)، فتعيد التشغيل من أول الآية بدل الإيقاف.
      if (!force && playingAyah?.surah === surah && playingAyah?.ayah === ayah) {
        stopAyah();
        setSelectedAyah(null);
        return;
      }
      // حدّد الآية فور الضغط — قبل محاولة تشغيل الصوت — حتى تبقى
      // اللوحة ظاهرة حتى لو فشل الصوت.
      setSelectedAyah({ surah, ayah });
      const audio = ayahAudioRef.current;
      if (!audio) return;
      const reciter = getCurrentReciter();
      // كل القرّاء السبعة لهم ملف MP3 لكل آية — لا مسار بديل هنا.
      const perAyahUrl = buildAyahAudioUrl(reciter, surah, ayah);
      if (!perAyahUrl) {
        setAyahError("لا يوجد صوت متاح لهذه الآية");
        return;
      }
      audio.volume = getPlayerVolume();
      audio.playbackRate = getPlayerRate();
      setAyahError(null);
      setAyahStarted(false);
      setPlayingAyah({ surah, ayah });
      ayahSessionRef.current = { surah, ayah };
      // Offline أولاً: آية محمّلة أو سُمعت من قبل تُشغَّل من الجهاز.
      const globalAyah = getGlobalAyahNumber(surah, ayah);
      const cachedUrl = await getCachedAyahUrl(reciter.id, globalAyah);
      // قد يكون المستخدم ضغط آية أخرى أثناء بحث الملف المخزّن.
      if (ayahSessionRef.current?.surah !== surah || ayahSessionRef.current?.ayah !== ayah)
        return;
      audio.src = cachedUrl ?? perAyahUrl;
      audio.play().catch(() => {
        setAyahError(
          !cachedUrl && !navigator.onLine
            ? "هذه الآية غير محمّلة — حمّل السورة أولاً"
            : "تعذّر تشغيل صوت الآية — تحقق من الاتصال"
        );
        stopAyah();
      });
      if (!cachedUrl) void cacheAyahAudio(reciter.id, globalAyah, perAyahUrl);
      // حمّل الآية التالية مسبقًا حتى لا تنتظر الشبكة عند الانتقال إليها.
      const next = getNextAyah(surah, ayah);
      const pre = ayahPrefetchRef.current;
      if (pre && next) {
        const nextUrl = buildAyahAudioUrl(reciter, next.surah, next.ayah);
        if (nextUrl && pre.src !== nextUrl) {
          pre.src = nextUrl;
          pre.load();
        }
      }
    },
    [playingAyah, stopAyah, getCurrentReciter, getCachedAyahUrl, cacheAyahAudio, getNextAyah]
  );

  const finishAyah = useCallback(() => {
    const session = ayahSessionRef.current;
    if (!session) return;
    if (ayahContinuousRef.current) {
      const next = getNextAyah(session.surah, session.ayah);
      if (next) {
        // الآية التالية قد تكون في صفحة أخرى (أو سورة أخرى) — اقلب
        // الصفحة إليها ثم شغّلها.
        const nextPage = getPageOfAyah(next.surah, next.ayah);
        if (nextPage !== page) setPage(nextPage);
        void playAyah(next.surah, next.ayah);
        return;
      }
    }
    stopAyah();
  }, [page, playAyah, stopAyah, getNextAyah]);

  // [1.0.77] إعادة الآية من أولها: أوقف أولاً ثم شغّل بقوة (playAyah
  // العادي كان سيوقف آية جارية بدل إعادتها).
  const replayAyah = useCallback(
    (surah: number, ayah: number) => {
      stopAyah();
      const audio = ayahAudioRef.current;
      if (audio) audio.currentTime = 0;
      void playAyah(surah, ayah, true, true);
    },
    [stopAyah, playAyah]
  );

  // [1.0.77] الخروج من وضع الآية كاملاً: أوقف الصوت وأغلق الورقة
  // وألغِ التحديد — يعود التخطيط للقراءة العادية.
  const exitAyahMode = useCallback(() => {
    stopAyah();
    setWordSheet(null);
    setSelectedAyah(null);
  }, [stopAyah]);

  // [1.0.76] أول ضغطة على آية تشغّلها؛ الضغطة الثانية على نفس الآية
  // تفتح ورقة الكلمة للكلمة المضغوطة.
  const handleWordTap = useCallback(
    (surah: number, ayah: number, wordIndex: number, wordText: string) => {
      if (selectedAyah?.surah === surah && selectedAyah?.ayah === ayah) {
        setWordSheet({ surahNumber: surah, ayahNumber: ayah, wordIndex, wordText });
      } else {
        void playAyah(surah, ayah, true);
      }
    },
    [selectedAyah, playAyah]
  );

  // مستمعو عنصر صوت الآية (مرة واحدة عند التركيب).
  const finishAyahRef = useRef(finishAyah);
  finishAyahRef.current = finishAyah;
  const stopAyahRef = useRef(stopAyah);
  stopAyahRef.current = stopAyah;
  useEffect(() => {
    const audio = ayahAudioRef.current;
    if (!audio) return;
    const onEnded = () => finishAyahRef.current();
    const onError = () => {
      setAyahError(
        !navigator.onLine
          ? "هذه الآية غير محمّلة — حمّل السورة أولاً"
          : "تعذّر تشغيل صوت الآية — تحقق من الاتصال"
      );
      stopAyahRef.current();
    };
    const onWaiting = () => setAyahBuffering(true);
    const onPlaying = () => {
      setAyahBuffering(false);
      setAyahStarted(true);
    };
    const onCanPlay = () => setAyahBuffering(false);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("canplay", onCanPlay);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("canplay", onCanPlay);
      audio.pause();
    };
  }, []);

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

  // [1.0.79] الصفحة كاملة: كيّف حجم الخط حتى تدخل الصفحة كلها في
  // الشاشة بلا تمرير عمودي. يبدأ من ٣٠ ويصغّر درجة درجة حتى يتسع
  // المحتوى (أرضية ١٥). يعاد القياس عند تغيير الصفحة أو التجويد أو
  // فتح لوحة الآية (تضيف ارتفاعًا) أو ظهور خطأ، وعند تدوير الجهاز
  // أو تغيير حجم النافذة. سطر النص هنا ١٫٦ (لا ٢٫٠ كالمشغّل) لأن
  // صفحة مدنية كاملة (١٥ سطرًا) لا تدخل في شاشة ٣٦٠×٨٠٤ بخط كبير
  // وبتباعد واسع — السطر الأضيق هو ما يجعل الصفحة كاملة ممكنة،
  // وهو قريب من تباعد المصحف المطبوع نفسه.
  // عند فتح لوحة آية تُمرَّر اللوحة إلى داخل الشاشة (block: nearest)
  // لأنها تضيف ارتفاعًا قد يتجاوز ما وفّره التصغير — الصفحة نفسها
  // تبقى كاملة، والتمرير يحدث فقط لإظهار اللوحة.
  const [fitFontSize, setFitFontSize] = useState(30);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const fitPage = useCallback(() => {
    const el = contentRef.current;
    const inner = innerRef.current;
    if (!el || !inner) return;
    let size = 30;
    inner.style.fontSize = `${size}px`;
    let guard = 0;
    while (el.scrollHeight > el.clientHeight && size > 15 && guard++ < 20) {
      size -= 1;
      inner.style.fontSize = `${size}px`;
    }
    setFitFontSize(size);
  }, []);
  useLayoutEffect(() => {
    fitPage();
  }, [page, tajweed, selectedAyah, ayahError, fitPage]);
  useEffect(() => {
    if (selectedAyah) {
      panelRef.current?.scrollIntoView({ behavior: "auto", block: "nearest" });
    }
  }, [selectedAyah, fitFontSize]);
  useEffect(() => {
    window.addEventListener("resize", fitPage);
    return () => window.removeEventListener("resize", fitPage);
  }, [fitPage]);

  const goTo = useCallback((p: number) => {
    if (p >= 1 && p <= 604) setPage(p);
  }, []);

  // السحب للتنقل: يسار = الصفحة التالية، يمين = السابقة (اتجاه القراءة).
  // السحب حركة لا نقرة، فيُكبَت حدث النقر الذي يليها حتى لا تُفتح ورقة
  // كلمة أو يُشغَّل صوت آية بالخطأ.
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
      {/* Hidden ayah-audio elements (same pattern as the player). */}
      <audio ref={ayahAudioRef} preload="auto" className="hidden" />
      <audio ref={ayahPrefetchRef} preload="auto" className="hidden" />

      {/* The page itself — full screen. The top range line and the footer
          hint were removed in 1.0.79: the pill below already shows the
          page, and the fit measures only the page itself. */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClickCapture={onClickCapture}
      >
        <div className="min-h-full px-5 py-6">
          <div
            ref={innerRef}
            className="quran-text text-right leading-[1.6]"
            style={{ fontSize: `${fitFontSize}px` }}
            dir="rtl"
          >
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
                <Fragment key={`${b.item.surah}-${b.item.ayah.numberInSurah}`}>
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
                    onClick={() => void playAyah(b.item.surah, b.item.ayah.numberInSurah, true)}
                    className={`cursor-pointer rounded px-0.5 transition-colors hover:bg-primary/10 ${
                      selectedAyah?.surah === b.item.surah &&
                      selectedAyah?.ayah === b.item.ayah.numberInSurah
                        ? "bg-primary/10"
                        : ""
                    }`}
                  >
                    <WordTapText
                      surahNumber={b.item.surah}
                      ayahNumber={b.item.ayah.numberInSurah}
                      text={b.item.rest}
                      windowBase={b.item.ayah.text.length - b.item.rest.length}
                      tajweed={tajweed}
                      onRuleClick={setSelectedRule}
                      onWordClick={(wi, wt) =>
                        handleWordTap(b.item.surah, b.item.ayah.numberInSurah, wi, wt)
                      }
                    />{" "}
                    <span className="text-primary inline-block mx-1 text-[0.65em]">﴿{toArabicNum(b.item.ayah.numberInSurah)}﴾</span>{" "}
                  </span>
                  {selectedAyah?.surah === b.item.surah &&
                    selectedAyah?.ayah === b.item.ayah.numberInSurah && (
                      <div ref={panelRef} className="my-2" onClick={(e) => e.stopPropagation()}>
                        <AyahActions
                          surahNumber={b.item.surah}
                          ayahNumber={b.item.ayah.numberInSurah}
                          isFav={isFavourite(b.item.surah, b.item.ayah.numberInSurah)}
                          onToggleFavourite={() =>
                            toggleFavourite(b.item.surah, b.item.ayah.numberInSurah)
                          }
                          onTafsir={() => {
                            setWordSheet(null);
                            setTafsirTarget({ surah: b.item.surah, ayah: b.item.ayah.numberInSurah });
                          }}
                          onReadings={() =>
                            navigate(`/readings/${b.item.surah}/${b.item.ayah.numberInSurah}`)
                          }
                          onShare={() => {
                            setWordSheet(null);
                            setShareTarget({ surah: b.item.surah, ayah: b.item.ayah.numberInSurah });
                          }}
                          onCopy={() => handleCopyAyah(b.item.surah, b.item.ayah.numberInSurah)}
                          copied={copiedAyah === b.item.ayah.numberInSurah}
                          memorization={false}
                          revealed={false}
                          onToggleReveal={() => {}}
                          onReplay={() => replayAyah(b.item.surah, b.item.ayah.numberInSurah)}
                          continueOn={ayahContinuous}
                          onToggleContinue={() => setAyahContinuous((c) => !c)}
                          onClose={exitAyahMode}
                        />
                        <div className="my-2">
                          <HifzRating
                            key={`hifz-${b.item.surah}-${b.item.ayah.numberInSurah}-${hifzVersion}`}
                            surahNumber={b.item.surah}
                            ayahNumber={b.item.ayah.numberInSurah}
                          />
                        </div>
                        {playingAyah?.surah === b.item.surah &&
                          playingAyah?.ayah === b.item.ayah.numberInSurah &&
                          ayahStarted && (
                            <div className="text-center text-xs text-primary">تُشغَّل الآن…</div>
                          )}
                        {ayahBuffering && (
                          <div className="text-center text-xs text-muted-foreground">
                            جارٍ تحميل الصوت…
                          </div>
                        )}
                        {ayahError && (
                          <div className="text-center text-xs text-destructive">{ayahError}</div>
                        )}
                      </div>
                    )}
                </Fragment>
              ),
            )}
          </div>
          {/* Clearance for the floating page pill / tools button, so the
              last line of the page is never hidden behind them. */}
          <div className="h-6" aria-hidden />
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
      {/* Word sheet for a tapped word — with ayah actions + replay /
          continue / exit (the reading mode has audio since 1.0.79). */}
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
          onRated={() => setHifzVersion((v) => v + 1)}
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
            onReplay: () =>
              selectedAyah && replayAyah(selectedAyah.surah, selectedAyah.ayah),
            continueOn: ayahContinuous,
            onToggleContinue: () => setAyahContinuous((c) => !c),
            onClose: exitAyahMode,
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
