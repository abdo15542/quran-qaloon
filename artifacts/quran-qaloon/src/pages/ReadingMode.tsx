// وضع القراءة بملء الشاشة (1.0.78) — مصحف جديد للقراءة السريعة:
// الصفحة تملأ الشاشة كلها بلا شريط علوي ولا شريط سفلي، والتنقل بين
// الصفحات بالسحب (يسار = التالية، يمين = السابقة) أو بالأسهم أو من شريط
// الأدوات الذي يظهر بضغطة زر. كل مزايا المصحف الأول محفوظة: صفحات
// مدنية ٦٠٤، عناوين السور، البسملة، تلوين التجويد + ورقة الشرح، الضغط
// على كلمة يفتح ورقتها (مع إجراءات الآية: تفسير/روايات/حفظ/مشاركة/نسخ
// + تقييم الحفظ)، والصفحة الأخيرة محفوظة بنفس مفتاح المصحف الأول —
// الوضعان يتشاركان موضعك.
// (1.0.82) مثل المصحف في الفيديو المرجعي: صفحة ورقية كريمية
// بترويسة سورة مزخرفة، وسحب أفقي صافٍ بلا ميلان (كشريط صور)،
// وشريط أيقونات سفلي بصفّين (سور/أحزاب/علامة/تفسير/بحث/سطوع/
// حول) يظهر ويختفي بضغطة زر، وتنبيه «ربع الحزب» عند كل صفحة.
// (1.0.81) قلب سلس كالمصحف الحقيقي: الصفحتان المجاورتان مرسومتان
// تحت الصفحة الجارية (التالية والسابقة)، فالسحب يكشف الصفحة التالية
// فعلًا بدل فراغ أبيض؛ الصفحة تتبع الإصبع بميلان أخف (٦°) وظل يكبر
// مع السحب، والإفلات بحركة نابضة انسيابية، والسحبة السريعة تقلب
// حتى لمسافة قصيرة. الجزء العلوي نزل قليلًا (pt-10). فهرس السور
// مع بحث سريع (اسم/رقم) يقفز لأول صفحة السورة. وتكبير/تصغير الخط
// من شريط الأدوات (يدوي ١٥–٣٦، أو تلقائي = الملاءمة الكاملة).
// (1.0.80) الضغط على آية يشغّل صوتها فقط — بلا لوحة وبلا ورقة:
// لا شيء يظهر فوق النص؛ الآية الجارية تُظلَّل بخفة فقط، والضغط
// عليها مجددًا يعيدها من أولها. ورقة الكلمة (معاني/تفسير/إجراءات)
// تُفتح بالضغطة المطوّلة على كلمة (٥٥٠ms). وقلب الصفحات باليد:
// الصفحة تتبع إصبعك أثناء السحب (إزاحة + ميلان + ظل) وتكمل دورتها
// إن تجاوزت ربع العرض، وإلا عادت مكانها — لا أزرار لتقليب الصفحات.
// (1.0.79) الصفحة كاملة بلا تمرير عمودي: الخط يتكيّف حتى تدخل الصفحة
// كلها في الشاشة. والصوت ملف MP3 لكل آية فلا حاجة لجداول توقيت.
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  Info,
  LayoutGrid,
  List,
  Moon,
  Palette,
  PanelBottom,
  Search,
  SlidersHorizontal,
  Square,
  Sun,
  X,
} from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { quarterLabelForAyah } from "@/data/hizb-quarters";
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
import SurahIndexSheet from "@/components/SurahIndexSheet";
import HizbSheet from "@/components/HizbSheet";
import TajweedRuleSheet from "@/components/TajweedRuleSheet";
import TafsirSheet from "@/components/TafsirSheet";
import SharePreviewSheet from "@/components/SharePreviewSheet";
import { useFavourites } from "@/hooks/useFavourites";
import { copyTextToClipboard } from "@/lib/copy";

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d, 10)]);
}

// [1.0.81] محتوى صفحة مصحف واحدة — يُستعمل للصفحة الجارية وللصفحتين
// المجاورتين تحتها أثناء السحب (معاينة غير تفاعلية: بلا ضغطات ولا
// تظليل). innerRef يُمرَّر للصفحة الجارية فقط لقياس الملاءمة.
function PageContent({
  page,
  fontSize,
  tajweed,
  interactive,
  playingAyah,
  onRuleClick,
  onPlayAyah,
  onWordLongPress,
  innerRef,
}: {
  page: number;
  fontSize: number;
  tajweed: boolean;
  interactive: boolean;
  playingAyah: { surah: number; ayah: number } | null;
  onRuleClick: (rule: string) => void;
  onPlayAyah: (surah: number, ayah: number) => void;
  onWordLongPress: (surah: number, ayah: number, wordIndex: number, wordText: string) => void;
  innerRef?: React.Ref<HTMLDivElement>;
}) {
  const items = useMemo(() => buildPageAyahs(page), [page]);
  // [1.0.83] ترويسة السورة تظهر فقط حيث تبدأ السورة فعلًا في هذه
  // الصفحة (آيتها الأولى) — كالمصحف المطبوع تمامًا. صفحة المتابعة
  // (مثل 521: أولها 51:7) لا تحمل ترويسة، فتتسع الصفحة للنص.
  let lastSurah = -1;
  const blocks: Array<{ type: "header"; surah: number } | { type: "ayah"; item: PageAyah }> = [];
  for (const item of items) {
    if (item.surah !== lastSurah && item.ayah.numberInSurah === 1) {
      blocks.push({ type: "header", surah: item.surah });
      lastSurah = item.surah;
    } else if (item.surah !== lastSurah) {
      lastSurah = item.surah;
    }
    blocks.push({ type: "ayah", item });
  }
  // [1.0.84] تباعد الأسطر 2.0 بأسلوب مضمّن — لا بـ leading-[1.6]:
  // قاعدة ‎.quran-text في index.css تفرض line-height: 2.6 وتغلب
  // على أداة Tailwind (غير المطبَّقة تتغلب على المطبَّقة)، فكان
  // التباعد الفعلي 2.6 والملاءمة التلقائية تُصغّر كل صفحة إلى أرضية
  // 15px (فيديو المستخدم: نص صغير وفراغ أسفل الصفحة). 2.0 هو تباعد
  // Uthman Taha القياسي للنص القرآني — الحروف تملأ الصفحة
  // كالمصحف المطبوع وتبقى للتشكيل مساحة كافية (1.6 يصطدم التشكيل).
  return (
    <div
      ref={innerRef}
      className="quran-text text-right text-[#1c1a14]"
      style={{ fontSize: `${fontSize}px`, lineHeight: 2.0 }}
      dir="rtl"
    >
      {blocks.map((b, i) =>
        b.type === "header" ? (
          <div key={`h-${b.surah}-${i}`} className="text-center my-4">
            {/* [1.0.82] ترويسة السورة كالمصحف المطبوع: إطار مزخرف
                مزدوج (أخضر/ذهبي) يحمل اسم السورة ونوعها وعدد آياتها. */}
            <div className="inline-block relative border-2 border-emerald-800/70 rounded-lg px-8 py-2">
              <span
                className="absolute inset-1 border border-amber-600/60 rounded-md pointer-events-none"
                aria-hidden
              />
              <span className="block font-arabic text-2xl text-emerald-900 leading-tight">
                سورة {SURAHS[b.surah - 1].name}
              </span>
              <span className="block text-xs text-[#6b6252] mt-0.5">
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
              <span className="block text-center my-3 text-[0.9em]">
                <TajweedText
                  surahNumber={b.item.surah}
                  ayahNumber={b.item.ayah.numberInSurah}
                  text={BASMALA}
                  enabled={tajweed}
                  window={[0, BASMALA.length]}
                  onRuleClick={onRuleClick}
                />
              </span>
            )}
            <span
              data-ayah={b.item.ayah.numberInSurah}
              data-surah={b.item.surah}
              onClick={interactive ? () => onPlayAyah(b.item.surah, b.item.ayah.numberInSurah) : undefined}
              className={
                interactive
                  ? `cursor-pointer rounded px-0.5 transition-colors hover:bg-primary/10 ${
                      playingAyah?.surah === b.item.surah &&
                      playingAyah?.ayah === b.item.ayah.numberInSurah
                        ? "bg-primary/10"
                        : ""
                    }`
                  : "rounded px-0.5"
              }
            >
              <WordTapText
                surahNumber={b.item.surah}
                ayahNumber={b.item.ayah.numberInSurah}
                text={b.item.rest}
                windowBase={b.item.ayah.text.length - b.item.rest.length}
                tajweed={tajweed}
                onRuleClick={onRuleClick}
                onWordClick={interactive ? () => onPlayAyah(b.item.surah, b.item.ayah.numberInSurah) : undefined}
                onWordLongPress={
                  interactive
                    ? (wi, wt) =>
                        onWordLongPress(b.item.surah, b.item.ayah.numberInSurah, wi, wt)
                    : undefined
                }
              />{" "}
              <span className="text-primary inline-block mx-1 text-[0.65em]">﴿{toArabicNum(b.item.ayah.numberInSurah)}﴾</span>{" "}
            </span>
          </Fragment>
        ),
      )}
    </div>
  );
}

// [1.0.82] زر أيقونة في الشريط السفلي: أيقونة + تسمية صغيرة.
function BarButton({
  icon,
  label,
  onClick,
  disabled,
  active,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 active:bg-muted/60 transition-colors ${
        disabled ? "opacity-40" : ""
      } ${active ? "text-primary" : "text-foreground"}`}
      aria-label={label}
      title={label}
    >
      {icon}
      <span className="text-[10px] leading-none">{label}</span>
    </button>
  );
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
  const [showIndex, setShowIndex] = useState(false);
  // [1.0.82] شريط الأيقونات السفلي (مثل التطبيق المرجعي): مخفي
  // أثناء القراءة، ويظهر بضغطة زر أسفل اليمين، ويختفي من زر
  // «إخفاء» فيه. قائمة الأحزاب وحوار «حول التطبيق» ونافذة
  // السطوع والعلامة المحفوظة كلها هنا.
  const [showBottomBar, setShowBottomBar] = useState(false);
  const [showHizb, setShowHizb] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showBrightness, setShowBrightness] = useState(false);
  const [bookmarkPage, setBookmarkPage] = useState<number | null>(() => {
    try {
      const v = parseInt(localStorage.getItem("quran_bookmark_page") ?? "", 10);
      return isNaN(v) || v < 1 || v > 604 ? null : v;
    } catch {
      return null;
    }
  });
  const [brightness, setBrightness] = useState<number>(() => {
    try {
      const v = parseInt(localStorage.getItem("quran_reading_brightness") ?? "100", 10);
      return isNaN(v) ? 100 : Math.max(20, Math.min(100, v));
    } catch {
      return 100;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("quran_reading_brightness", String(brightness));
    } catch {
      // storage unavailable
    }
  }, [brightness]);
  const [infoToast, setInfoToast] = useState<string | null>(null);
  const [quarterToast, setQuarterToast] = useState<string | null>(null);
  useEffect(() => {
    if (!infoToast) return;
    const t = window.setTimeout(() => setInfoToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [infoToast]);
  // [1.0.81] حجم الخط اليدوي: 0 = تلقائي (ملاءمة الصفحة كاملة).
  const [manualFont, setManualFont] = useState<number>(() => {
    try {
      const v = parseInt(localStorage.getItem("quran_reading_font_size") ?? "0", 10);
      return isNaN(v) ? 0 : v;
    } catch {
      return 0;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("quran_reading_font_size", String(manualFont));
    } catch {
      // storage unavailable
    }
  }, [manualFont]);
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
      // [1.0.86] الضغط على الآية الجارية يوقفها — لا إعادة. المستخدم
      // لا يجد زر إيقاف، والضغطة الثانية كانت تعيد التشغيل فيُحسّ
      // أنه لا يقدر أن يوقف. الإعادة من زر «إعادة» في ورقة الكلمة،
      // أو بالضغط على الآية بعد إيقافها (تشغّل من أولها).
      if (!force && playingAyah?.surah === surah && playingAyah?.ayah === ayah) {
        stopAyah();
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

  // [1.0.82] أول آية في الصفحة — لتفسير الصفحة ولتنبيه ربع الحزب.
  const firstPageAyah = useMemo(() => buildPageAyahs(page)[0] ?? null, [page]);

  // [1.0.82] تنبيه ربع الحزب عند كل صفحة (مثل الفيديو): تسمية
  // الربع الذي تنتمي إليه أول آية في الصفحة، يظهر ٢٫٥ ثانية.
  useEffect(() => {
    if (!firstPageAyah) return;
    setQuarterToast(
      quarterLabelForAyah(firstPageAyah.surah, firstPageAyah.ayah.numberInSurah)
    );
    const t = window.setTimeout(() => setQuarterToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [firstPageAyah]);

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

  // [1.0.92] الحشوة العلوية تُقاس من الشريط نفسه، لا رقم ثابت:
  // 1.0.85 قدّر 129px فصارت 140px، و1.0.91 قاس 137px فصارت
  // 150px، ومع ذلك عاد الطلب «نزّله قليلًا» — لأن ارتفاع الشريط
  // يتغير مع الجهاز وحجم خط النظام والتفاف الدليل، فأي رقم ثابت
  // سيخطئ على هاتف ما. ResizeObserver يقيس الشريط العلوي حيًا
  // (+16px هامش) وتُعاد الملاءمة مع كل قياس جديد.
  const toolsTopRef = useRef<HTMLDivElement | null>(null);
  const [toolsTopH, setToolsTopH] = useState(0);
  useEffect(() => {
    if (!showTools) return;
    const el = toolsTopRef.current;
    if (!el) return;
    const measure = () => setToolsTopH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showTools, tajweed]);
  const toolsPadTopPx = showTools ? toolsTopH + 16 : 40;

  // [1.0.79] الصفحة كاملة: كيّف حجم الخط حتى تدخل الصفحة كلها في
  // الشاشة بلا تمرير عمودي. يبدأ من ٣٠ ويصغّر درجة درجة حتى يتسع
  // المحتوى (أرضية ١٥). يعاد القياس عند تغيير الصفحة أو التجويد
  // أو عند تدوير الجهاز أو تغيير حجم النافذة. سطر النص هنا ١٫٦
  // (لا ٢٫٠ كالمشغّل) لأن صفحة مدنية كاملة (١٥ سطرًا) لا تدخل في
  // شاشة ٣٦٠×٨٠٤ بخط كبير وبتباعد واسع — السطر الأضيق هو ما يجعل
  // الصفحة كاملة ممكنة، وهو قريب من تباعد المصحف المطبوع نفسه.
  // [1.0.80] لا لوحة آية بعد اليوم، فلا تمرير لإظهارها ولا إعادة
  // قياس بسببها.
  // [1.0.81] خط يدوي (manualFont > 0): يُستعمل كما هو؛ وإن زاد عن
  // الشاشة يُمرَّر عموديًا (الحاوية قابلة للتمرير أصلًا).
  const [fitFontSize, setFitFontSize] = useState(30);
  const fitPage = useCallback(() => {
    const el = contentRef.current;
    const inner = innerRef.current;
    if (!el || !inner) return;
    if (manualFont > 0) {
      inner.style.fontSize = `${manualFont}px`;
      setFitFontSize(manualFont);
      return;
    }
    let size = 30;
    inner.style.fontSize = `${size}px`;
    let guard = 0;
    while (el.scrollHeight > el.clientHeight && size > 15 && guard++ < 20) {
      size -= 1;
      inner.style.fontSize = `${size}px`;
    }
    setFitFontSize(size);
  }, [manualFont]);
  useLayoutEffect(() => {
    fitPage();
  }, [page, tajweed, manualFont, showBottomBar, showTools, fitPage, toolsTopH]);
  // [1.0.84] أعد الملاءمة بعد تحميل خط Uthman Taha: القياس الأول
  // يجري بخط بديل أعرض فيُصغّر الخط أكثر من اللازم (19px بدل 21px
  // في ص69 — أثبته الفحص)، وإعادة القياس بعد تبديل الخط تصل للحد
  // الأقصى الصحيح.
  useEffect(() => {
    let on = true;
    document.fonts?.ready.then(() => {
      if (on) fitPage();
    });
    return () => {
      on = false;
    };
  }, [fitPage]);
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

  // [1.0.82] العلامة: حفظ الصفحة الجارية، والقفز إلى المحفوظة.
  const saveBookmark = useCallback(() => {
    try {
      localStorage.setItem("quran_bookmark_page", String(page));
    } catch {
      // storage unavailable
    }
    setBookmarkPage(page);
    setInfoToast(`تم حفظ العلامة في صفحة ${toArabicNum(page)}`);
  }, [page]);

  const goBookmark = useCallback(() => {
    if (!bookmarkPage) {
      setInfoToast("لا توجد علامة محفوظة بعد");
      return;
    }
    // [1.0.85] وأنت على صفحة العلامة أصلًا لا يحدث شيء مرئي —
    // أعطِ تأكيدًا بدل الصمت حتى لا تبدو كأن الزر لا يعمل.
    if (bookmarkPage === page) {
      setInfoToast("أنت في صفحة العلامة الآن");
      return;
    }
    goTo(bookmarkPage);
  }, [bookmarkPage, page, goTo]);

  // [1.0.82] تفسير الصفحة: تفسير أول آية فيها.
  const openPageTafsir = useCallback(() => {
    if (firstPageAyah) {
      setTafsirTarget({ surah: firstPageAyah.surah, ayah: firstPageAyah.ayah.numberInSurah });
    }
  }, [firstPageAyah]);

  // [1.0.81] تكبير/تصغير الخط: من الحجم الملائم الحالي إن كان
  // تلقائيًا، وإلا من اليدوي؛ بين ١٥ و٣٦.
  const bumpFont = (delta: number) => {
    setManualFont((prev) => {
      const base = prev > 0 ? prev : fitFontSize;
      return Math.max(15, Math.min(36, base + delta));
    });
  };

  // [1.0.82] قلب الصفحة باليد — كشريط صور صافٍ (مثل الفيديو):
  // لا ميلان إطلاقًا، الصفحة تنزلق أفقيًا فقط وتكشف التالية تحتها،
  // وعند الإكمال تنزلق خارج الشاشة وتظهر الجديدة في مكانها فورًا
  // بلا انزلاق دخول — الصفحة الجديدة هي نفسها المعاينة التي
  // كُشفت أثناء السحب، فلا قفزة تُرى. (1.0.81) السحب يكشف
  // الصفحة التالية فعلًا بدل فراغ أبيض؛ الإفلات بحركة انسيابية
  // نابضة (٣٨٠ms مع تجاوز خفيف)، والسحبة السريعة تقلب حتى
  // لمسافة قصيرة (>٠٫٥ بكسل/ms و>٤٠ بكسل). عند أول صفحة أو
  // آخرها يُقاوَم السحب (مطاط) ويعود دائمًا. السحب حركة لا نقرة،
  // فيُكبَت النقر الذي يليه حتى لا يُشغَّل صوت آية بالخطأ.
  // (بلا setPointerCapture: الالتقاط يغيّر هدف النقر فيكسر ضغطة
  // الكلمة؛ وtouch-pan-y على الحاوية يكفي ليوصل السحب الأفقي.)
  const flipRef = useRef<HTMLDivElement | null>(null);
  const previewNextRef = useRef<HTMLDivElement | null>(null);
  const previewPrevRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; dragging: boolean; dir: 1 | -1 | null; startT: number } | null>(null);
  const turningRef = useRef(false);
  const swipedRef = useRef(false);

  // [1.0.85] سلاسة القلب: تطبيق التحويل كان يجري مع كل حدث مؤشر
  // (ظل يُعاد حسابه + فلتر المعاينة + قراءة عرض) فيعيد رسم ثلاث
  // صفحات ملوّنة — فيتقطّع على الهاتف. الآن: عرض يُحفظ عند بدء
  // السحب، ظل ثابت، فلتر بخطوات 5%، وتحويل translate3d عبر rAF.
  const dragRafRef = useRef<number | null>(null);
  const pendingDxRef = useRef<number | null>(null);
  const dragWidthRef = useRef(360);
  const lastFilterRef = useRef(-1);

  const cancelDragRaf = useCallback(() => {
    if (dragRafRef.current != null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    pendingDxRef.current = null;
  }, []);

  const applyDragFrame = useCallback(() => {
    dragRafRef.current = null;
    const el = flipRef.current;
    const d = dragRef.current;
    const eff = pendingDxRef.current;
    if (!el || !d || eff == null || !d.dragging) return;
    el.style.transition = "none";
    el.style.transform = `translate3d(${eff}px, 0, 0)`;
    const w = dragWidthRef.current;
    const threshold = Math.max(100, w * 0.25);
    const q = Math.round(Math.min(1, Math.abs(eff) / threshold) / 0.05);
    if (q !== lastFilterRef.current && d.dir) {
      lastFilterRef.current = q;
      const pv = d.dir === 1 ? previewNextRef.current : previewPrevRef.current;
      if (pv) pv.style.filter = `brightness(${0.88 + 0.12 * (q * 0.05)})`;
    }
  }, []);

  const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
  const EASE_SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

  const hidePreviews = useCallback((animate: boolean) => {
    for (const pv of [previewNextRef.current, previewPrevRef.current]) {
      if (!pv) continue;
      pv.style.transition = animate ? "opacity 300ms ease-out" : "none";
      pv.style.opacity = "0";
      pv.style.filter = "";
      pv.style.top = "";
    }
  }, []);

  const showPreview = useCallback(
    (dir: 1 | -1, progress: number) => {
      const pv = dir === 1 ? previewNextRef.current : previewPrevRef.current;
      const other = dir === 1 ? previewPrevRef.current : previewNextRef.current;
      if (other) {
        other.style.transition = "none";
        other.style.opacity = "0";
        other.style.filter = "";
      }
      if (!pv) return;
      pv.style.transition = "none";
      pv.style.opacity = "1";
      // المعاينة تلتصق بأعلى ما يُرى (قد تكون الصفحة مُمرَّرة بخط يدوي).
      pv.style.top = `${contentRef.current?.scrollTop ?? 0}px`;
      pv.style.filter = `brightness(${0.88 + 0.12 * Math.min(1, progress)})`;
    },
    []
  );

  const resetFlip = useCallback(
    (animate: boolean) => {
      cancelDragRaf();
      const el = flipRef.current;
      if (!el) return;
      el.style.transition = animate
        ? `transform 380ms ${EASE_SPRING}, opacity 380ms ${EASE_SPRING}`
        : "none";
      el.style.transform = "";
      el.style.opacity = "";
      el.style.boxShadow = "";
    },
    [EASE_SPRING, cancelDragRaf]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (turningRef.current) return;
    dragRef.current = { x: e.clientX, y: e.clientY, dragging: false, dir: null, startT: performance.now() };
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
      dragWidthRef.current = contentRef.current?.clientWidth ?? 360;
      lastFilterRef.current = -1;
      // ظل ثابت طوال السحب بدل إعادة حسابه مع كل حركة.
      el.style.boxShadow = "0 18px 40px rgba(0,0,0,0.35)";
    }
    const dir: 1 | -1 = dx < 0 ? 1 : -1; // يسار = التالية، يمين = السابقة
    const w = dragWidthRef.current;
    const threshold = Math.max(100, w * 0.25);
    if (d.dir !== dir) {
      d.dir = dir;
      showPreview(dir, Math.abs(dx) / threshold);
    }
    // مطاط عند الحدود: لا صفحة بعد الأخيرة ولا قبل الأولى.
    let eff = dx;
    if ((dx < 0 && page >= 604) || (dx > 0 && page <= 1)) eff = dx * 0.4;
    // [1.0.85] طبّق التحويل مرة واحدة لكل إطار (rAF) بدل كل حدث.
    pendingDxRef.current = eff;
    if (dragRafRef.current == null) {
      dragRafRef.current = requestAnimationFrame(applyDragFrame);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    cancelDragRaf();
    if (!d || !d.dragging || turningRef.current) return;
    const dx = e.clientX - d.x;
    const w = contentRef.current?.clientWidth ?? 360;
    const threshold = Math.max(100, w * 0.25);
    const dir = dx < 0 ? 1 : -1; // يسار = التالية، يمين = السابقة
    const atEdge = (dir === 1 && page >= 604) || (dir === -1 && page <= 1);
    const velocity = Math.abs(dx) / Math.max(1, performance.now() - d.startT);
    const flick = velocity > 0.5 && Math.abs(dx) > 40;
    // أي سحب — حتى المرتد — يكبت النقرة التي تليه.
    swipedRef.current = true;
    window.setTimeout(() => {
      swipedRef.current = false;
    }, 150);
    if (Math.abs(dx) < threshold && !flick) {
      hidePreviews(true);
      resetFlip(true);
      return;
    }
    if (atEdge) {
      hidePreviews(true);
      resetFlip(true);
      return;
    }
    // أكمل الدورة: الصفحة تنزلق خارج الشاشة، والجديدة — وهي
    // نفسها المعاينة التي كُشفت — تظهر في مكانها فورًا بلا
    // انزلاق دخول (فلا قفزة تُرى).
    // [1.0.83] الانزلاق يستمر في اتجاه السحب نفسه (يسارًا
    // للتالية، يمينًا للسابقة) — لا يرتدّ عبر الشاشة عكس السحب.
    turningRef.current = true;
    const el = flipRef.current;
    if (el) {
      el.style.transition = `transform 300ms ${EASE_OUT}, opacity 300ms ${EASE_OUT}`;
      el.style.transform = `translate3d(${-dir * (w + 80)}px, 0, 0)`;
      el.style.opacity = "0.7";
    }
    window.setTimeout(() => {
      goTo(page + dir);
      hidePreviews(false);
      resetFlip(false);
      turningRef.current = false;
    }, 300);
  };

  const onPointerCancel = () => {
    dragRef.current = null;
    cancelDragRaf();
    if (!turningRef.current) {
      hidePreviews(true);
      resetFlip(true);
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
        className="flex-1 overflow-y-auto overscroll-contain touch-pan-y relative bg-[#f8f2dc]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerCancel}
        onClickCapture={onClickCapture}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* [1.0.81] الصفحتان المجاورتان تحت الجارية — السحب يكشف
            التالية (أو السابقة) فعلًا بدل فراغ أبيض. شفافة حتى يبدأ
            السحب (opacity تُدار مباشرة من معالجات المؤشر). */}
        {page < 604 && (
          <div
            ref={previewNextRef}
            data-testid="reading-preview-next"
            className={`absolute inset-0 px-5 pb-6 overflow-hidden pointer-events-none bg-[#f8f2dc]`}
            style={{ opacity: 0, paddingTop: toolsPadTopPx }}
            aria-hidden
          >
            <PageContent
              page={page + 1}
              fontSize={fitFontSize}
              tajweed={tajweed}
              interactive={false}
              playingAyah={null}
              onRuleClick={setSelectedRule}
              onPlayAyah={() => {}}
              onWordLongPress={() => {}}
            />
          </div>
        )}
        {page > 1 && (
          <div
            ref={previewPrevRef}
            data-testid="reading-preview-prev"
            className={`absolute inset-0 px-5 pb-6 overflow-hidden pointer-events-none bg-[#f8f2dc]`}
            style={{ opacity: 0, paddingTop: toolsPadTopPx }}
            aria-hidden
          >
            <PageContent
              page={page - 1}
              fontSize={fitFontSize}
              tajweed={tajweed}
              interactive={false}
              playingAyah={null}
              onRuleClick={setSelectedRule}
              onPlayAyah={() => {}}
              onWordLongPress={() => {}}
            />
          </div>
        )}
        <div
          ref={flipRef}
          className={`relative min-h-full px-5 pb-6 bg-[#f8f2dc]`}
          style={{ willChange: "transform", paddingTop: toolsPadTopPx }}
        >
          <PageContent
            page={page}
            fontSize={fitFontSize}
            tajweed={tajweed}
            interactive
            playingAyah={playingAyah}
            onRuleClick={setSelectedRule}
            onPlayAyah={(s, a) => void playAyah(s, a, true)}
            onWordLongPress={(s, a, wi, wt) =>
              setWordSheet({ surahNumber: s, ayahNumber: a, wordIndex: wi, wordText: wt })
            }
            innerRef={innerRef}
          />
          {/* Clearance for the floating page pill / tools button, so the
              last line of the page is never hidden behind them.
              [1.0.83] والشريط السفلي حين يظهر (96px): مساحة أكبر
              تحته، ويُعاد قياس الملاءمة عند ظهوره/اختفائه.
              [1.0.91] لوحة الأدوات السفلية (متواصل + حجم الخط +
              الانتقال للصفحة) عائمة أيضًا: مقاسة 187px، والحشوة
              h-6 كانت تُخفي آخر 128px من الصفحة خلفها نهائيًا
              (probe91: آخر آية تنتهي 128px تحت حافتها حتى مع
              التمرير للنهاية). h-52 (208px) يفسح لها مع هامش.
              وبدون أدوات: h-6 (24px) لا تكفي للأزرار العائمة
              (44px، تصل إلى 60px من الأسفل) — h-20 (80px). */}
          <div className={showTools ? "h-52" : showBottomBar ? "h-28" : "h-20"} aria-hidden />
        </div>
        {/* [1.0.82] تعتيم السطوع فوق الصفحة فقط (بلا تأثير على
            الأشرطة والأزرار). */}
        {brightness < 100 && (
          <div
            className="absolute inset-0 bg-black pointer-events-none z-10"
            style={{ opacity: ((100 - brightness) / 100) * 0.55 }}
            aria-hidden
          />
        )}
      </div>

      {/* [1.0.82] تنبيه ربع الحزب — حبّة داكنة مثل الفيديو.
          [1.0.92] كانت أعلى الصفحة في المنتصف (top-3) فتغطي أول
          سطر حين تكون الأدوات مغلقة، وتغطي الشريط العلوي حين
          تكون مفتوحة — «غير واضحة فوق». بأمره: إلى اليمين أسفل
          الشاشة (bottom-28 right-4): فوق الشريط السفلي بـ16px
          وفوق آخر سطر بـ32px، ولا تغطي نصًا ولا زرًا أبدًا. */}
      {quarterToast && (
        <div className="absolute bottom-28 right-4 z-20 bg-black/70 text-white px-3 py-1 rounded-full text-xs whitespace-nowrap pointer-events-none">
          {quarterToast}
        </div>
      )}

      {/* [1.0.82] رسالة معلومات صغيرة (حفظ علامة وغيرها).
          [1.0.85] كانت bottom-16 وz-20 فتختفي خلف الشريط السفلي
          (96px وz-105) حين يكون مفتوحًا — فيضغط «حفظ علامة» ولا
          يرى شيئًا فيظن الزر لا يعمل. حين يظهر الشريط ترتفع فوقه. */}
      {infoToast && (
        <div className={`absolute left-1/2 -translate-x-1/2 bg-foreground text-background px-3 py-1.5 rounded-full text-xs whitespace-nowrap shadow-md pointer-events-none ${showBottomBar ? "bottom-28 z-[110]" : "bottom-16 z-20"}`}>
          {infoToast}
        </div>
      )}

      {/* خطأ صوت — رسالة صغيرة فوق الحبّة تختفي وحدها بعد ٤ ثوانٍ
          [1.0.85] نفس إصلاح التنبيه: فوق الشريط حين يكون مفتوحًا. */}
      {ayahError && (
        <div className={`absolute left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-3 py-1.5 rounded-full text-xs whitespace-nowrap shadow-md pointer-events-none ${showBottomBar ? "bottom-28 z-[110]" : "bottom-16 z-20"}`}>
          {ayahError}
        </div>
      )}

      {/* Page pill — always visible, never blocks taps (hidden while
          the bottom bar is shown — the bar is the interface then).
          [1.0.86] وأثناء تشغيل صوت آية يحلّ محلّها زر «إيقاف» ظاهر
          في نفس المكان — لا زر إيقاف في وضع القراءة، والضغطة على
          الآية الجارية توقفها أيضًا. */}
      {!showTools && !showBottomBar && playingAyah && (
        <button
          onClick={stopAyah}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-4 py-1.5 rounded-full text-xs shadow-md active:scale-95 transition-transform flex items-center gap-1.5 whitespace-nowrap"
          aria-label="إيقاف الصوت"
          data-testid="reading-stop-audio"
        >
          <Square className="w-3.5 h-3.5" /> إيقاف
        </button>
      )}
      {!showTools && !showBottomBar && !playingAyah && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card/85 backdrop-blur border border-border px-3 py-1.5 rounded-full text-xs text-muted-foreground pointer-events-none whitespace-nowrap"
          data-testid="reading-page-pill"
        >
          صفحة {toArabicNum(page)} / {toArabicNum(604)}
          {startSurah ? ` • سورة ${startSurah.name}` : ""}
        </div>
      )}

      {/* Floating tools button — only while the tools and the bar are hidden */}
      {!showTools && !showBottomBar && (
        <button
          onClick={() => setShowTools(true)}
          className="absolute bottom-4 left-4 w-11 h-11 rounded-full bg-card/85 backdrop-blur border border-border text-foreground flex items-center justify-center shadow-md active:scale-95 transition-transform"
          aria-label="إظهار أدوات القراءة"
          title="أدوات القراءة"
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      )}

      {/* [1.0.82] زر إظهار شريط الأيقونات — أسفل اليمين (مثل
          التطبيق المرجعي: الأيقونات تظهر وتختفي بضغطة). */}
      {!showTools && !showBottomBar && (
        <button
          onClick={() => setShowBottomBar(true)}
          className="absolute bottom-4 right-4 w-11 h-11 rounded-full bg-card/85 backdrop-blur border border-border text-foreground flex items-center justify-center shadow-md active:scale-95 transition-transform"
          aria-label="إظهار شريط الأيقونات"
          title="شريط الأيقونات"
        >
          <PanelBottom className="w-5 h-5" />
        </button>
      )}

      {/* Tools overlay */}
      {showTools && (
        <div data-testid="reading-tools">
          <div ref={toolsTopRef} className="absolute inset-x-0 top-0 bg-background/95 backdrop-blur border-b border-border">
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
              <button
                onClick={() => setShowIndex(true)}
                className="p-2 rounded-full hover:bg-muted transition-colors"
                aria-label="فهرس السور"
                title="فهرس السور"
              >
                <List className="w-4 h-4" />
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
              <div className="px-4 pt-2 pb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
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
            {/* [1.0.81] تكبير/تصغير الخط — يدوي (١٥–٣٦) أو تلقائي
                (ملاءمة الصفحة كاملة). */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground">حجم الخط</span>
              <button
                onClick={() => bumpFont(-2)}
                className="w-9 h-9 rounded-full bg-card border border-border text-lg leading-none active:scale-95 transition-transform"
                aria-label="تصغير الخط"
                title="تصغير الخط"
              >
                −
              </button>
              <span className="text-sm min-w-14 text-center" aria-live="polite">
                {manualFont > 0 ? toArabicNum(manualFont) : "تلقائي"}
              </span>
              <button
                onClick={() => bumpFont(2)}
                className="w-9 h-9 rounded-full bg-card border border-border text-lg leading-none active:scale-95 transition-transform"
                aria-label="تكبير الخط"
                title="تكبير الخط"
              >
                +
              </button>
              {manualFont > 0 && (
                <button
                  onClick={() => setManualFont(0)}
                  className="px-3 py-1.5 rounded-full bg-card border border-border text-xs active:scale-95 transition-transform"
                >
                  تلقائي
                </button>
              )}
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

      {/* [1.0.82] شريط الأيقونات السفلي — بصفّين مثل التطبيق
          المرجعي: الصف الأول (علامة/سطوع/إخفاء)، والثاني
          (أحزاب/سور/تفسير/حول/بحث). يغطي أسفل الصفحة وهو ظاهر،
          ويختفي من زر «إخفاء» فيعيده زر أسفل اليمين. */}
      {showBottomBar && (
        <div
          className="absolute inset-x-0 bottom-0 h-24 z-[105] bg-background/95 backdrop-blur border-t border-border flex flex-col"
          data-testid="reading-bottom-bar"
        >
          <div className="flex-1 flex items-stretch">
            <BarButton
              icon={<BookmarkCheck className="w-5 h-5" />}
              label="انتقال للعلامة"
              onClick={goBookmark}
              disabled={!bookmarkPage}
              testId="reading-goto-bookmark"
            />
            <BarButton
              icon={<Bookmark className="w-5 h-5" />}
              label="حفظ علامة"
              onClick={saveBookmark}
              testId="reading-save-bookmark"
            />
            <BarButton
              icon={<Sun className="w-5 h-5" />}
              label="سطوع"
              onClick={() => setShowBrightness((v) => !v)}
              active={showBrightness}
              testId="reading-brightness-btn"
            />
            <BarButton
              icon={<ChevronDown className="w-5 h-5" />}
              label="إخفاء"
              onClick={() => setShowBottomBar(false)}
              testId="reading-hide-bar"
            />
          </div>
          <div className="flex-1 flex items-stretch border-t border-border/60">
            <BarButton
              icon={<LayoutGrid className="w-5 h-5" />}
              label="الأحزاب"
              onClick={() => setShowHizb(true)}
              testId="reading-hizb-btn"
            />
            <BarButton
              icon={<List className="w-5 h-5" />}
              label="السور"
              onClick={() => setShowIndex(true)}
              testId="reading-surah-btn"
            />
            <BarButton
              icon={<BookOpen className="w-5 h-5" />}
              label="التفسير"
              onClick={openPageTafsir}
              testId="reading-tafsir-btn"
            />
            <BarButton
              icon={<Info className="w-5 h-5" />}
              label="حول التطبيق"
              onClick={() => setShowAbout(true)}
              testId="reading-about-btn"
            />
            <BarButton
              icon={<Search className="w-5 h-5" />}
              label="بحث"
              onClick={() => navigate("/search")}
              testId="reading-search-btn"
            />
          </div>
        </div>
      )}

      {/* [1.0.82] نافذة السطوع فوق الشريط. */}
      {showBrightness && showBottomBar && (
        <div
          className="absolute bottom-28 right-3 z-[106] bg-card border border-border rounded-xl shadow-lg p-3 w-56"
          data-testid="reading-brightness"
        >
          <div className="flex items-center gap-2 text-sm">
            <Sun className="w-4 h-4 text-primary" />
            <span className="flex-1">سطوع الصفحة</span>
            <span className="text-xs text-muted-foreground">{toArabicNum(brightness)}٪</span>
          </div>
          <input
            type="range"
            min={20}
            max={100}
            value={brightness}
            onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
            className="w-full mt-2"
            aria-label="سطوع الصفحة"
          />
          <button
            onClick={() => setShowBrightness(false)}
            className="mt-1 text-xs text-muted-foreground"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* [1.0.82] حول التطبيق. */}
      {showAbout && (
        <div
          className="absolute inset-0 z-[130] bg-black/50 flex items-center justify-center p-6"
          onClick={() => setShowAbout(false)}
          data-testid="reading-about"
        >
          <div
            className="bg-card border border-border rounded-2xl p-5 max-w-xs w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-arabic text-2xl text-primary">تسميع القرآن</div>
            <div className="text-sm text-muted-foreground mt-1">
              قالون عن نافع — الإصدار 1.0.102
            </div>
            <p className="text-sm mt-3 leading-relaxed">
              المصحف المدني — ٦٠٤ صفحات، ٧ قرّاء برواية حفص، تفسير ومعاني
              الكلمات وأحكام التجويد، ويعمل دون إنترنت إلا عند تحميل الصوت.
            </p>
            <button
              onClick={() => setShowAbout(false)}
              className="mt-4 px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* [1.0.82] قائمة الأحزاب — القفز إلى أول صفحة الحزب. */}
      {showHizb && (
        <HizbSheet
          onClose={() => setShowHizb(false)}
          onSelectPage={(p) => {
            setShowHizb(false);
            setShowTools(false);
            goTo(p);
          }}
        />
      )}

      {/* [1.0.81] فهرس السور — بحث سريع والقفز لأول صفحة السورة. */}
      {showIndex && (
        <SurahIndexSheet
          onClose={() => setShowIndex(false)}
          onSelectPage={(p) => {
            setShowIndex(false);
            setShowTools(false);
            goTo(p);
          }}
        />
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
