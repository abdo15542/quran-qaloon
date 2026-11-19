// وضع القراءة بملء الشاشة (1.0.78) — مصحف جديد للقراءة السريعة:
// الصفحة تملأ الشاشة كلها بلا شريط علوي ولا شريط سفلي، والتنقل بين
// الصفحات بالسحب (يسار = التالية، يمين = السابقة) أو بالأسهم أو من شريط
// الأدوات الذي يظهر بضغطة زر. كل مزايا المصحف الأول محفوظة: صفحات
// مدنية ٦٠٤، عناوين السور، البسملة، تلوين التجويد + ورقة الشرح، الضغط
// على كلمة يفتح ورقتها (مع إجراءات الآية: تفسير/روايات/حفظ/مشاركة/نسخ
// + تقييم الحفظ)، والصفحة الأخيرة محفوظة بنفس مفتاح المصحف الأول —
// الوضعان يتشاركان موضعك.
// (1.0.80) الضغط على آية يشغّل صوتها فقط — بلا لوحة وبلا ورقة:
// لا شيء يظهر فوق النص؛ الآية الجارية تُظلَّل بخفة فقط، والضغط
// عليها مجددًا يعيدها من أولها. ورقة الكلمة (معاني/تفسير/إجراءات)
// تُفتح بالضغطة المطوّلة على كلمة (٥٥٠ms). وقلب الصفحات باليد:
// الصفحة تتبع إصبعك أثناء السحب (إزاحة + ميلان + ظل) وتكمل دورتها
// إن تجاوزت ربع العرض، وإلا عادت مكانها — لا أزرار لتقليب الصفحات.
// (1.0.79) الصفحة كاملة بلا تمرير عمودي: الخط يتكيّف حتى تدخل الصفحة
// كلها في الشاشة. والصوت ملف MP3 لكل آية فلا حاجة لجداول توقيت.
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Moon, Palette, SlidersHorizontal, Sun, X } from "lucide-react";
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
import { getStoredQirahId, getStoredReciterId } from "@/pages/SurahPlayer";
import { getPlayerVolume, getPlayerRate } from "@/hooks/useAudio";
import { useOffline } from "@/context/OfflineContext";
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
  const { isFavourite, toggleFavourite } = useFavourites();

  // [1.0.79] صوت الآية في وضع القراءة. [1.0.80] الضغطة = صوت فقط:
  // لا لوحة تحت الآية ولا ورقة تفتح — الآية الجارية تُظلَّل بخفة
  // (playingAyah) لا غير، وأي خطأ يظهر كرسالة صغيرة تختفي وحدها.
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
    setPlayingAyah(null);
  }, []);

  const playAyah = useCallback(
    async (surah: number, ayah: number, fromTap = false, force = false) => {
      void fromTap;
      // [1.0.80] الضغط على الآية الجارية يعيدها من أولها — الصوت
      // نفسه والملف نفسه، فتكفي إعادة المؤشر والتشغيل.
      if (!force && playingAyah?.surah === surah && playingAyah?.ayah === ayah) {
        const audio0 = ayahAudioRef.current;
        if (audio0) {
          audio0.currentTime = 0;
          void audio0.play().catch(() => {});
        }
        return;
      }
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

  // [1.0.77] الخروج من وضع الآية كاملاً: أوقف الصوت وأغلق الورقة.
  const exitAyahMode = useCallback(() => {
    stopAyah();
    setWordSheet(null);
  }, [stopAyah]);

  // [1.0.80] الضغطة على أي كلمة تشغّل صوت الآية فقط (مثل الضغطة
  // على الآية نفسها)؛ ورقة الكلمة تُفتح بالضغطة المطوّلة فقط.

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
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
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
  // المحتوى (أرضية ١٥). يعاد القياس عند تغيير الصفحة أو التجويد
  // أو عند تدوير الجهاز أو تغيير حجم النافذة. سطر النص هنا ١٫٦
  // (لا ٢٫٠ كالمشغّل) لأن صفحة مدنية كاملة (١٥ سطرًا) لا تدخل في
  // شاشة ٣٦٠×٨٠٤ بخط كبير وبتباعد واسع — السطر الأضيق هو ما يجعل
  // الصفحة كاملة ممكنة، وهو قريب من تباعد المصحف المطبوع نفسه.
  // [1.0.80] لا لوحة آية بعد اليوم، فلا تمرير لإظهارها ولا إعادة
  // قياس بسببها.
  const [fitFontSize, setFitFontSize] = useState(30);
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
  }, [page, tajweed, fitPage]);
  useEffect(() => {
    window.addEventListener("resize", fitPage);
    return () => window.removeEventListener("resize", fitPage);
  }, [fitPage]);

  // رسالة خطأ الصوت تختفي وحدها بعد ٤ ثوانٍ (بلا لوحة تحت الآية).
  useEffect(() => {
    if (!ayahError) return;
    const t = window.setTimeout(() => setAyahError(null), 4000);
    return () => window.clearTimeout(t);
  }, [ayahError]);

  const goTo = useCallback((p: number) => {
    if (p >= 1 && p <= 604) setPage(p);
  }, []);

  // [1.0.80] قلب الصفحة باليد — كالمصحف الحقيقي: الصفحة تتبع
  // إصبعك أثناء السحب (إزاحة + ميلان خفيف + ظل)؛ إن تجاوز السحب
  // ربع عرض الشاشة (أو ١٢٠ بكسل) أكملت الصفحة دورتها إلى التالية
  // (يسار) أو السابقة (يمين)، وإلا عادت مكانها بنابض. عند أول
  // صفحة أو آخرها يُقاوَم السحب (مطاط) ويعود دائمًا. السحب حركة
  // لا نقرة، فيُكبَت النقر الذي يليه حتى لا يُشغَّل صوت آية بالخطأ.
  // (بلا setPointerCapture: الالتقاط يغيّر هدف النقر فيكسر ضغطة
  // الكلمة؛ وtouch-pan-y على الحاوية يكفي ليوصل السحب الأفقي.)
  const flipRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; dragging: boolean } | null>(null);
  const turningRef = useRef(false);
  const swipedRef = useRef(false);

  const resetFlip = useCallback((animate: boolean) => {
    const el = flipRef.current;
    if (!el) return;
    el.style.transition = animate ? "transform 250ms ease-out, opacity 250ms ease-out" : "none";
    el.style.transform = "";
    el.style.opacity = "";
    el.style.boxShadow = "";
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (turningRef.current) return;
    dragRef.current = { x: e.clientX, y: e.clientY, dragging: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const el = flipRef.current;
    if (!d || !el || turningRef.current) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.dragging) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) * 1.5) {
        dragRef.current = null; // تمرير عمودي — ليس سحب صفحة
        return;
      }
      if (Math.abs(dx) <= 10) return;
      d.dragging = true;
    }
    // مطاط عند الحدود: لا صفحة بعد الأخيرة ولا قبل الأولى.
    let eff = dx;
    if ((dx < 0 && page >= 604) || (dx > 0 && page <= 1)) eff = dx * 0.4;
    const w = contentRef.current?.clientWidth ?? 360;
    const rot = Math.max(-10, Math.min(10, (eff / w) * 12));
    el.style.transition = "none";
    el.style.transform = `translateX(${eff}px) rotateY(${rot}deg)`;
    el.style.boxShadow = "0 18px 40px rgba(0,0,0,0.35)";
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || !d.dragging || turningRef.current) return;
    const dx = e.clientX - d.x;
    const w = contentRef.current?.clientWidth ?? 360;
    const threshold = Math.max(100, w * 0.25);
    const dir = dx < 0 ? 1 : -1; // يسار = التالية، يمين = السابقة
    const atEdge = (dir === 1 && page >= 604) || (dir === -1 && page <= 1);
    // أي سحب — حتى المرتد — يكبت النقرة التي تليه.
    swipedRef.current = true;
    window.setTimeout(() => {
      swipedRef.current = false;
    }, 150);
    if (Math.abs(dx) < threshold || atEdge) {
      resetFlip(true);
      return;
    }
    // أكمل الدورة: الصفحة تنزلق خارج الشاشة ثم تأتي الجديدة.
    turningRef.current = true;
    const el = flipRef.current;
    if (el) {
      el.style.transition = "transform 180ms ease-in, opacity 180ms ease-in";
      el.style.transform = `translateX(${dir * (w + 80)}px) rotateY(${dir * 18}deg)`;
      el.style.opacity = "0.6";
    }
    window.setTimeout(() => {
      goTo(page + dir);
      // الصفحة الجديدة تدخل بانزلاق قصير من الجهة المقابلة.
      requestAnimationFrame(() => {
        const el2 = flipRef.current;
        if (el2) {
          el2.style.transition = "none";
          el2.style.transform = `translateX(${-dir * 60}px)`;
          el2.style.opacity = "0.7";
          el2.style.boxShadow = "";
          requestAnimationFrame(() => {
            el2.style.transition = "transform 220ms ease-out, opacity 220ms ease-out";
            el2.style.transform = "";
            el2.style.opacity = "";
          });
        }
        turningRef.current = false;
      });
    }, 180);
  };

  const onPointerCancel = () => {
    dragRef.current = null;
    if (!turningRef.current) resetFlip(true);
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
        className="flex-1 overflow-y-auto overscroll-contain touch-pan-y"
        style={{ perspective: "1200px" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerCancel}
        onClickCapture={onClickCapture}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div ref={flipRef} className="min-h-full px-5 py-6">
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
                      playingAyah?.surah === b.item.surah &&
                      playingAyah?.ayah === b.item.ayah.numberInSurah
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
                      onWordClick={() =>
                        void playAyah(b.item.surah, b.item.ayah.numberInSurah, true)
                      }
                      onWordLongPress={(wi, wt) =>
                        setWordSheet({
                          surahNumber: b.item.surah,
                          ayahNumber: b.item.ayah.numberInSurah,
                          wordIndex: wi,
                          wordText: wt,
                        })
                      }
                    />{" "}
                    <span className="text-primary inline-block mx-1 text-[0.65em]">﴿{toArabicNum(b.item.ayah.numberInSurah)}﴾</span>{" "}
                  </span>
                </Fragment>
              ),
            )}
          </div>
          {/* Clearance for the floating page pill / tools button, so the
              last line of the page is never hidden behind them. */}
          <div className="h-6" aria-hidden />
        </div>
      </div>

      {/* خطأ صوت — رسالة صغيرة فوق الحبّة تختفي وحدها بعد ٤ ثوانٍ */}
      {ayahError && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-3 py-1.5 rounded-full text-xs whitespace-nowrap shadow-md pointer-events-none">
          {ayahError}
        </div>
      )}

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
              {/* [1.0.80] لا أزرار لتقليب الصفحات — التقليب باليد فقط.
                  متواصل انتقل هنا من لوحة الآية الملغاة. */}
              <button
                onClick={() => setAyahContinuous((c) => !c)}
                className={`px-4 py-2 rounded-full border text-sm active:scale-95 transition-all whitespace-nowrap ${
                  ayahContinuous
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border"
                }`}
                aria-label="تشغيل متواصل للآيات"
              >
                متواصل {ayahContinuous ? "مفعّل" : "متوقف"}
              </button>
              <span className="text-xs text-muted-foreground text-center flex-1">
                الضغط على الآية يشغّل صوتها فقط — اضغط مطوّلًا على كلمة لمعانيها والتفسير
              </span>
              <span className="text-sm text-muted-foreground bg-card border border-border px-3 py-1.5 rounded-full whitespace-nowrap">
                صفحة {toArabicNum(page)} / {toArabicNum(604)}
              </span>
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
      {/* Word sheet for a long-pressed word [1.0.80] — with ayah actions
          + replay / continue / exit (the reading mode has audio since
          1.0.79); replay/close target this sheet's own ayah. */}
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
            onReplay: () =>
              replayAyah(wordSheet.surahNumber, wordSheet.ayahNumber),
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
