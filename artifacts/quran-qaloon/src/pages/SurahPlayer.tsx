import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from "react";
import { ArrowRight, BookOpen, Loader2, Moon, Sun, FileText, Mic, CheckCircle2, WifiOff, ALargeSmall, Repeat, Square, Volume2, Heart, Languages, Share2, Copy, Check, Eye, EyeOff, Palette, BookCopy } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { SURAHS, QIRAAT, RECITERS, getRecitersForQirah, buildAudioUrl, buildAyahAudioUrl, getGlobalAyahNumber } from "@/data/surahs";
import { getAyahTimings } from "@/data/ayah-timings";
import { getSurahAyahs, splitAyahBasmala, displayAyahText } from "@/data/quran-text";
import { isSajdahAyah } from "@/data/hizb";
import { getTranslation } from "@/data/translation-en";
import { getPageOfAyah } from "@/data/mushaf-pages";
import AudioPlayer from "@/components/AudioPlayer";
import TajweedChecker from "@/components/TajweedChecker";
import TajweedText, { TAJWEED_LEGEND } from "@/components/TajweedText";
import WordTapText from "@/components/WordTapText";
import WordSheet from "@/components/WordSheet";
import HifzRating from "@/components/HifzRating";
import TajweedRuleSheet from "@/components/TajweedRuleSheet";
import TafsirSheet from "@/components/TafsirSheet";
import SharePreviewSheet from "@/components/SharePreviewSheet";
import DownloadButton from "@/components/DownloadButton";
import { useListeningProgress } from "@/hooks/useListeningProgress";
import { getPlayerVolume, getPlayerRate } from "@/hooks/useAudio";
import { useKhatma } from "@/hooks/useKhatma";
import { useFavourites } from "@/hooks/useFavourites";
import { useOffline } from "@/context/OfflineContext";

interface Ayah {
  number: number;
  numberInSurah: number;
  text: string;
}

interface SurahPlayerProps {
  surahNumber: number;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

// Action buttons shown above a tapped ayah: التفسير / حفظ في المفضلة /
// مشاركة كصورة / نسخ نص الآية. In memorization mode an إظهار/إخفاء
// button is added, to reveal the hidden ayah text. Shared by the
// continuous-text layout and the translation layout.
function AyahActions({
  surahNumber,
  ayahNumber,
  isFav,
  onToggleFavourite,
  onTafsir,
  onReadings,
  onShare,
  onCopy,
  copied,
  memorization,
  revealed,
  onToggleReveal,
}: {
  surahNumber: number;
  ayahNumber: number;
  isFav: boolean;
  onToggleFavourite: () => void;
  onTafsir: () => void;
  onReadings: () => void;
  onShare: () => void;
  onCopy: () => void;
  copied: boolean;
  memorization: boolean;
  revealed: boolean;
  onToggleReveal: () => void;
}) {
  // In the translation layout the buttons sit inside the clickable ayah
  // block, so stop the click from bubbling up and re-triggering playback.
  return (
    <span className="flex flex-wrap items-center justify-center gap-2 my-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTafsir();
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-arabic bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors whitespace-nowrap"
      >
        <BookOpen className="w-3.5 h-3.5" />
        التفسير
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onReadings();
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-arabic bg-teal-500/10 border border-teal-500/30 text-teal-700 dark:text-teal-400 hover:bg-teal-500/20 transition-colors whitespace-nowrap"
        aria-label="مقارنة الروايات"
      >
        <BookCopy className="w-3.5 h-3.5" />
        الروايات
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavourite();
        }}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-arabic border transition-colors whitespace-nowrap ${
          isFav
            ? "bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-400"
            : "bg-background border-border text-muted-foreground hover:text-rose-600"
        }`}
        aria-label="حفظ في المفضلة"
      >
        <Heart className={`w-3.5 h-3.5 ${isFav ? "fill-rose-500 text-rose-500" : ""}`} />
        {isFav ? "محفوظة" : "حفظ"}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onShare();
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-arabic bg-background border border-border text-muted-foreground hover:text-primary transition-colors whitespace-nowrap"
        aria-label="مشاركة الآية كصورة"
      >
        <Share2 className="w-3.5 h-3.5" />
        مشاركة
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCopy();
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-arabic bg-background border border-border text-muted-foreground hover:text-primary transition-colors whitespace-nowrap"
        aria-label="نسخ نص الآية"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "تم النسخ ✓" : "نسخ"}
      </button>
      {memorization && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleReveal();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-arabic bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
          aria-label={revealed ? "إخفاء الآية" : "إظهار الآية"}
        >
          {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {revealed ? "إخفاء" : "إظهار"}
        </button>
      )}
    </span>
  );
}

// Copy text to the clipboard. The Clipboard API needs a secure context and
// a user gesture; the textarea + execCommand fallback covers the Android
// WebView when it is unavailable.
async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea fallback
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function getStoredQirahId(): string {
  const stored = localStorage.getItem("quran_qirah");
  // A stored qira'ah from before the reciter cleanup (e.g. "qaloon")
  // no longer exists — fall back to hafs instead of an empty list.
  if (stored && QIRAAT.some((q) => q.id === stored)) return stored;
  return "hafs";
}

function getStoredReciterId(qirahId: string): string {
  const stored = localStorage.getItem("quran_reciter");
  if (stored) {
    const reciter = RECITERS.find((r) => r.id === stored && r.qirahId === qirahId);
    if (reciter) return stored;
  }
  return (
    RECITERS.find((r) => r.id === "mishary" && r.qirahId === qirahId)?.id ??
    getRecitersForQirah(qirahId)[0]?.id ??
    RECITERS[0].id
  );
}

// في WebView على أندرويد يخرج الصوت المسموع متأخرًا عن ساعة عنصر الصوت
// (currentTime) بنحو ثانيتين بسبب التخزين المؤقت للصوت، فتتقدّم الشارة
// (الآية الظاهرة) على ما يُسمع فعلًا ويبدو أن التطبيق يقرأ الآية السابقة.
// نؤخّر إنهاء الآية بهذا القدر حتى تتزامن الشارة مع الصوت المسموع.
// (قيسناه من فيديوهات الجهاز: الشارة تسبق الصوت ~٢ ث؛ القفز نفسه صحيح
// ويبدأ من الآية المضغوطة، المشكلة في التزامن فقط).
const AYAH_END_LATENCY_S = 1.5;

export default function SurahPlayer({
  surahNumber,
  darkMode,
  toggleDarkMode,
}: SurahPlayerProps) {
  const [, navigate] = useLocation();
  // الآية المطلوبة من رابط خارجي (مثل نتيجة بحث: ‎/surah/2?ayah=25) —
  // ننتقل إليها ونظللها عند فتح السورة.
  const search = useSearch();
  const targetAyah = useMemo(() => {
    const n = parseInt(new URLSearchParams(search).get("ayah") ?? "", 10);
    return isNaN(n) ? null : n;
  }, [search]);
  const [highlightedAyah, setHighlightedAyah] = useState<number | null>(null);
  // الآية المعروض تفسيرها (null = لا يوجد تفسير مفتوح).
  const [tafsirAyah, setTafsirAyah] = useState<number | null>(null);
  // [1.0.74] Word sheet for a tapped word (root / meanings).
  const [wordSheet, setWordSheet] = useState<{
    surahNumber: number;
    ayahNumber: number;
    wordIndex: number;
    wordText: string;
  } | null>(null);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rightMode, setRightMode] = useState<"text" | "recite">("text");
  const [justCompleted, setJustCompleted] = useState(false);
  const [fontSize, setFontSize] = useState<number>(() => {
    const stored = localStorage.getItem("quran_font_size");
    return stored ? Number(stored) : 22;
  });

  const [selectedQirahId, setSelectedQirahId] = useState<string>(getStoredQirahId);
  const [selectedReciterId, setSelectedReciterId] = useState<string>(() =>
    getStoredReciterId(getStoredQirahId())
  );
  const [effectiveAudioUrl, setEffectiveAudioUrl] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const { getProgress, saveProgress, clearProgress } = useListeningProgress();
  const { isCompleted, markCompleted, markUncompleted } = useKhatma();
  const { isFavourite, toggleFavourite } = useFavourites();
  const { isCached, getCachedBlobUrl, getCachedAyahUrl, cacheAyahAudio } = useOffline();


  useEffect(() => {
    document.documentElement.style.setProperty("--quran-font-size", `${fontSize}px`);
    localStorage.setItem("quran_font_size", String(fontSize));
  }, [fontSize]);

  const increaseFontSize = () => setFontSize((s) => Math.min(s + 2, 36));
  const decreaseFontSize = () => setFontSize((s) => Math.max(s - 2, 14));

  const surah = SURAHS.find((s) => s.number === surahNumber);
  const prevSurah = SURAHS.find((s) => s.number === surahNumber - 1);
  const nextSurah = SURAHS.find((s) => s.number === surahNumber + 1);

  const currentQirah = QIRAAT.find((q) => q.id === selectedQirahId) ?? QIRAAT[0];
  const recitersForQirah = getRecitersForQirah(selectedQirahId);
  const currentReciter =
    recitersForQirah.find((r) => r.id === selectedReciterId) ?? recitersForQirah[0];

  const networkAudioUrl = currentReciter ? buildAudioUrl(currentReciter, surahNumber) : null;
  const audioUrl = networkAudioUrl;

  // Resume is per reciter: the same surah with another reciter is a
  // different recording, so its position is stored separately.
  const savedProgress = getProgress(surahNumber, currentReciter?.id);
  const initialTime = savedProgress?.currentTime ?? 0;
  const surahCompleted = isCompleted(surahNumber);

  // ---- تشغيل آية بالضغط عليها (مع تكرار للحفظ وتشغيل متواصل) ----
  const [playingAyah, setPlayingAyah] = useState<number | null>(null);
  // الآية المحدّدة بالضغط — تبقى محدّدة حتى لو فشل صوتها (بلا إنترنت
  // أو بلا تحميل)، حتى يبقى زر «التفسير» متاحًا دائمًا. التفسير
  // مضمّن في التطبيق ولا يعتمد على الصوت ولا على تحميل المصحف.
  const [selectedAyah, setSelectedAyah] = useState<number | null>(null);
  const [ayahRepeat, setAyahRepeat] = useState<number>(1);
  const [ayahContinuous, setAyahContinuous] = useState(false);
  const [ayahError, setAyahError] = useState<string | null>(null);
  const [pauseSignal, setPauseSignal] = useState(0);
  // English translation (Sahih International) under each ayah — persisted.
  const [showTranslation, setShowTranslation] = useState<boolean>(() => {
    try {
      return localStorage.getItem("quran_show_translation") === "1";
    } catch {
      return false;
    }
  });
  // Ayah whose share preview sheet is open (null = closed).
  const [sharePreviewAyah, setSharePreviewAyah] = useState<number | null>(null);
  // Memorization mode (وضع الحفظ): the ayah text is blurred until the
  // reader reveals it — listen first, recite from memory, then check.
  // Persisted, so the mode survives reopening the app.
  const [memorization, setMemorization] = useState<boolean>(() => {
    try {
      return localStorage.getItem("quran_memorization_mode") === "1";
    } catch {
      return false;
    }
  });
  // Ayahs revealed in this surah while memorization is on (numbers in
  // surah). Cleared when the surah changes.
  const [revealedAyahs, setRevealedAyahs] = useState<Set<number>>(new Set());
  // Ayah whose «تم النسخ ✓» feedback is showing (null = none).
  const [copiedAyah, setCopiedAyah] = useState<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  const toggleMemorization = () => {
    setMemorization((v) => {
      try {
        localStorage.setItem("quran_memorization_mode", v ? "0" : "1");
      } catch {
        // storage unavailable
      }
      return !v;
    });
  };

  // Tajweed coloring (تلوين أحكام التجويد): on by default — the colors
  // follow the printed tajweed mushafs. Persisted like memorization.
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

  // حكم التجويد المضغوط عليه — تُعرض ورقة شرحه.
  const [selectedRule, setSelectedRule] = useState<string | null>(null);

  const toggleReveal = useCallback((ayahNumber: number) => {
    setRevealedAyahs((prev) => {
      const next = new Set(prev);
      if (next.has(ayahNumber)) next.delete(ayahNumber);
      else next.add(ayahNumber);
      return next;
    });
  }, []);

  const revealAll = useCallback(() => {
    setRevealedAyahs(new Set(ayahs.map((a) => a.numberInSurah)));
  }, [ayahs]);

  const hideAll = useCallback(() => {
    setRevealedAyahs(new Set());
  }, []);

  const handleCopyAyah = useCallback(
    async (ayahNumber: number) => {
      if (!surah) return;
      const ayah = ayahs.find((a) => a.numberInSurah === ayahNumber);
      if (!ayah) return;
      const text = `${displayAyahText(surahNumber, ayahNumber, ayah.text)} ﴿${toArabicNum(ayahNumber)}﴾\nسورة ${surah.name} — الآية ${toArabicNum(ayahNumber)}`;
      const ok = await copyTextToClipboard(text);
      if (ok) {
        setCopiedAyah(ayahNumber);
        if (copyTimerRef.current != null) window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = window.setTimeout(() => setCopiedAyah(null), 2000);
      }
    },
    [ayahs, surah]
  );

  const toggleTranslation = () => {
    setShowTranslation((v) => {
      try {
        localStorage.setItem("quran_show_translation", v ? "0" : "1");
      } catch {
        // storage unavailable
      }
      return !v;
    });
  };

  // The share preview sheet handles rendering, saving and sharing — the
  // player only opens it for the tapped ayah.
  // Ayah 1 of surahs 2-114 carries the Basmala as a text prefix; the header
  // above already shows it, so display the ayah without it. TajweedText gets
  // the windowed text plus the full-text window so its spans still clip
  // correctly. Surah 1 ayah 1 IS the Basmala and is kept whole.
  const ayahParts = useMemo(
    () => ayahs.map((a) => splitAyahBasmala(surahNumber, a.numberInSurah, a.text)),
    [ayahs, surahNumber]
  );

  const sharePreviewData = (() => {
    if (sharePreviewAyah == null || !surah) return null;
    const ayah = ayahs.find((a) => a.numberInSurah === sharePreviewAyah);
    if (!ayah) return null;
    return {
      ayahText: displayAyahText(surahNumber, sharePreviewAyah, ayah.text),
      surahName: surah.name,
      surahNumber,
      ayahNumber: sharePreviewAyah,
      translation: getTranslation(surahNumber, sharePreviewAyah),
    };
  })();
  const ayahAudioRef = useRef<HTMLAudioElement | null>(null);
  // Guards the blob -> network fallback so it fires at most once per surah+reciter.
  const audioFallbackTriedRef = useRef("");
  const [ayahBuffering, setAyahBuffering] = useState(false);
  // هل بدأ صوت الآية يتحرك فعلًا (وليس مجرد ضغطة بانتظار البيانات).
  const [ayahStarted, setAyahStarted] = useState(false);
  // عنصر تحميل مسبق لصوت الآية التالية (لقرّاء الصوت-لكل-آية فقط).
  const ayahPrefetchRef = useRef<HTMLAudioElement | null>(null);
  const ayahSessionRef = useRef<{
    ayah: number;
    start: number;
    end: number | null;
    totalRepeats: number;
    played: number;
  } | null>(null);
  const ayahRangeRef = useRef<{ startFrac: number; endFrac: number } | null>(null);
  // موضع دقيق بالثواني من جدول التوقيت المقاس (إن وُجد لهذا القارئ والسورة).
  const ayahExactRef = useRef<{ start: number; end: number } | null>(null);
  const ayahContinuousRef = useRef(false);
  useEffect(() => {
    ayahContinuousRef.current = ayahContinuous;
  }, [ayahContinuous]);

  const ayahSeekTimerRef = useRef<number | null>(null);
  // The pending seek's `seeked` listener: stopping (or tapping another
  // ayah) must remove it, or it fires later and restarts the old ayah
  // / yanks the new one back to the old position.
  const ayahSeekListenerRef = useRef<(() => void) | null>(null);
  const clearAyahSeek = useCallback(() => {
    if (ayahSeekTimerRef.current != null) {
      window.clearTimeout(ayahSeekTimerRef.current);
      ayahSeekTimerRef.current = null;
    }
    const audio = ayahAudioRef.current;
    if (audio && ayahSeekListenerRef.current) {
      audio.removeEventListener("seeked", ayahSeekListenerRef.current);
      ayahSeekListenerRef.current = null;
    }
  }, []);

  const stopAyah = useCallback(() => {
    const audio = ayahAudioRef.current;
    if (audio) audio.pause();
    clearAyahStopTimer();
    clearAyahSeek();
    ayahSessionRef.current = null;
    ayahRangeRef.current = null;
    ayahExactRef.current = null;
    setAyahStarted(false);
    setPlayingAyah(null);
  }, [clearAyahSeek]);

  // عند الانتقال إلى سورة أخرى ألغِ تحديد الآية (حتى لا تبقى لوحة
  // سورة قديمة ظاهرة) وأوقف صوت الآية، وأخفِ الآيات المكشوفة في
  // وضع الحفظ.
  useEffect(() => {
    setSelectedAyah(null);
    setRevealedAyahs(new Set());
    stopAyah();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surahNumber]);

  // قفز موثوق في WebView أندرويد: تغيير currentTime قد يُتجاهل إن لم
  // تكن بيانات الصوت جاهزة (أو إن سبقه تشغيل)، فيبدأ الصوت من أول
  // السورة فيسمع المستخدم الآيات السابقة للآية المضغوطة. لذلك نوقف
  // التشغيل، نقفز، ونتأكد أن الموضع تغيّر فعلًا (حدث seeked أو قراءة
  // currentTime) قبل أن نشغّل؛ وإن لم يتغيّر نعيد القفز بضع مرات.
  // وإن لم تكن بيانات الصوت قد حُمّلت أصلًا لا نشغّل من موضع خاطئ؛
  // مستمع loadedmetadata يعيد تطبيق القفز عند جاهزيتها.
  // الضغط على آية يريدها المستخدم من بدايتها دائمًا، حتى لو كان
  // الصوت واقفًا داخلها أصلًا؛ أما التقدّم المتواصل فيترك الصوت يكمل
  // من حيث هو حتى لا يعيد بداية الآية التالية (انظر applyAyahRange).
  // يُمرَّر عبر ref لأن مستمع loadedmetadata قد يطبّق القفز لاحقًا.
  const ayahForceSeekRef = useRef(false);
  // مؤقّت إيقاف بالساعة (احتياط لمستمع timeupdate): يوقف الصوت عند
  // نهاية الآية حتى لو تأخّر timeupdate أو ساعة العنصر في WebView.
  const ayahStopTimerRef = useRef<number | null>(null);
  const clearAyahStopTimer = () => {
    if (ayahStopTimerRef.current != null) {
      window.clearTimeout(ayahStopTimerRef.current);
      ayahStopTimerRef.current = null;
    }
  };
  const seekAyahAudio = useCallback((target: number) => {
    const audio = ayahAudioRef.current;
    if (!audio) return;
    clearAyahSeek();
    audio.pause();
    audio.currentTime = target;
    let tries = 0;
    let done = false;
    const onSeeked = () => {
      if (Math.abs(audio.currentTime - target) < 0.75) finish();
    };
    const giveUp = () => {
      if (done) return;
      done = true;
      audio.removeEventListener("seeked", onSeeked);
      ayahSeekListenerRef.current = null;
      if (ayahSeekTimerRef.current != null) {
        window.clearTimeout(ayahSeekTimerRef.current);
        ayahSeekTimerRef.current = null;
      }
    };
    const finish = () => {
      if (done) return;
      giveUp();
      audio.play().catch(() => {
        setAyahError("تعذّر تشغيل صوت الآية");
        stopAyah();
      });
    };
    // القفز لم ينجح بعد مهلة طويلة: لا تشغّل من موضع خاطئ فيسمع
    // المستخدم آية أخرى؛ أظهر خطأً وأوقف الجلسة بدل ذلك.
    const failSeek = () => {
      if (done) return;
      giveUp();
      setAyahBuffering(false);
      setAyahError("تعذّر القفز إلى الآية — تحقق من الاتصال وحاول مجددًا");
      stopAyah();
    };
    const check = () => {
      if (done) return;
      if (Math.abs(audio.currentTime - target) < 0.75) { finish(); return; }
      // بيانات الصوت لم تُحمَّل بعد: انتظر loadedmetadata بدل التشغيل
      // من موضع خاطئ.
      if (audio.readyState < 1) { giveUp(); return; }
      // مهلة أطول (~10 ثوانٍ) لأن القفز البعيد في ملف سورة كبير
      // متدفَّق من الشبكة قد يحتاج جلب نطاقه أولًا.
      if (tries >= 28) { failSeek(); return; }
      tries += 1;
      if (!audio.seeking) audio.currentTime = target;
      ayahSeekTimerRef.current = window.setTimeout(check, 350);
    };
    if (Math.abs(audio.currentTime - target) < 0.75) { finish(); return; }
    ayahSeekListenerRef.current = onSeeked;
    audio.addEventListener("seeked", onSeeked);
    ayahSeekTimerRef.current = window.setTimeout(check, 600);
  }, [stopAyah, clearAyahSeek]);

  // يطبّق موضع الآية (دقيق من الجدول أو تقديري من النص) على عنصر الصوت.
  // ضغطة المستخدم (forceSeek) تقفز دائمًا إلى بداية الآية؛ أما التقدّم
  // المتواصل فيترك الصوت يكمل إن كان داخل الآية التالية أصلًا.
  const applyAyahRange = useCallback(() => {
    const audio = ayahAudioRef.current;
    const session = ayahSessionRef.current;
    if (!audio || !session) return false;
    const forceSeek = ayahForceSeekRef.current;
    ayahForceSeekRef.current = false;
    const exact = ayahExactRef.current;
    if (exact) {
      ayahSessionRef.current = { ...session, start: exact.start, end: exact.end };
      // الصوت وصل فعلًا إلى داخل هذه الآية (بعد تأخير الإنهاء): لا تقفز
      // للوراء وتعيد بدايتها، اتركه يكمل من حيث هو. ولأن الصوت لم يتوقف
      // أصلًا فلن يصل حدث playing من جديد، فثبّت حالة البدء يدويًا حتى
      // تظهر الشارة ولا يبقى مؤشر التحميل.
      // هذا للتقدم المتواصل فقط؛ ضغطة المستخدم تقفز للبداية دائمًا.
      if (!forceSeek && audio.currentTime >= exact.start && audio.currentTime < exact.end) {
        if (audio.paused) audio.play().catch(() => {});
        setAyahBuffering(false);
        setAyahStarted(true);
        return true;
      }
      seekAyahAudio(exact.start);
      return true;
    }
    const range = ayahRangeRef.current;
    if (range && isFinite(audio.duration) && audio.duration > 0) {
      const start = Math.max(0, range.startFrac * audio.duration - 1);
      const end = range.endFrac * audio.duration;
      ayahSessionRef.current = { ...session, start, end };
      if (!forceSeek && audio.currentTime >= start && audio.currentTime < end) {
        if (audio.paused) audio.play().catch(() => {});
        setAyahBuffering(false);
        setAyahStarted(true);
        return true;
      }
      seekAyahAudio(start);
      return true;
    }
    return false;
  }, [seekAyahAudio]);

  const playAyah = useCallback(
    async (ayahNumberInSurah: number, fromTap = false) => {
      // الضغط على الآية الجارية يوقفها ويغلق اللوحة.
      if (playingAyah === ayahNumberInSurah) {
        stopAyah();
        setSelectedAyah(null);
        return;
      }
      clearAyahStopTimer();
      clearAyahSeek();
      setHighlightedAyah(null);
      // حدّد الآية فور الضغط — قبل محاولة تشغيل الصوت — حتى تبقى
      // اللوحة وزر «التفسير» ظاهرين حتى لو فشل الصوت.
      setSelectedAyah(ayahNumberInSurah);
      const audio = ayahAudioRef.current;
      if (!audio) return;
      // The tap-ayah element is separate from the main player: apply
      // the persisted volume/speed here too, or a muted main player
      // still plays tapped ayahs at full volume / 1×.
      audio.volume = getPlayerVolume();
      audio.playbackRate = getPlayerRate();
      // أوقف مشغّل السورة الرئيسي حتى لا يتداخل الصوتان.
      setPauseSignal((s) => s + 1);
      setAyahError(null);
      setAyahStarted(false);
      const perAyahUrl = currentReciter
        ? buildAyahAudioUrl(currentReciter, surahNumber, ayahNumberInSurah)
        : null;
      if (perAyahUrl) {
        // صوت دقيق لكل آية (العفاسي، الحصري، المعيقلي، الشريم، العجمي، عبد الباسط، الحذيفي).
        ayahRangeRef.current = null;
        ayahExactRef.current = null;
        ayahSessionRef.current = {
          ayah: ayahNumberInSurah,
          start: 0,
          end: null,
          totalRepeats: ayahRepeat,
          played: 0,
        };
        setPlayingAyah(ayahNumberInSurah);
        // Offline first: a downloaded or previously heard ayah plays
        // from the device instead of the network.
        const globalAyah = getGlobalAyahNumber(surahNumber, ayahNumberInSurah);
        const cachedUrl = currentReciter
          ? await getCachedAyahUrl(currentReciter.id, globalAyah)
          : null;
        // The user may have tapped another ayah (or stopped) while the
        // cache lookup was in flight — only play if this session is
        // still the current one.
        if (ayahSessionRef.current?.ayah !== ayahNumberInSurah) return;
        audio.src = cachedUrl ?? perAyahUrl;
        audio.play().catch(() => {
          // Offline with an uncached ayah: say so plainly, instead of
          // a generic connection error — the fix is downloading the
          // surah, not checking the connection.
          setAyahError(
            !cachedUrl && !navigator.onLine
              ? "هذه الآية غير محمّلة — حمّل السورة أولاً"
              : "تعذّر تشغيل صوت الآية — تحقق من الاتصال"
          );
          stopAyah();
        });
        // Cache this ayah for offline use after it plays online.
        if (!cachedUrl && currentReciter) {
          void cacheAyahAudio(currentReciter.id, globalAyah, perAyahUrl);
        }
        // حمّل الآية التالية مسبقًا حتى لا تنتظر الشبكة عند الانتقال إليها.
        const nextUrl =
          ayahs.some((a) => a.numberInSurah === ayahNumberInSurah + 1) && currentReciter
            ? buildAyahAudioUrl(currentReciter, surahNumber, ayahNumberInSurah + 1)
            : null;
        const pre = ayahPrefetchRef.current;
        if (pre && nextUrl && pre.src !== nextUrl) {
          pre.src = nextUrl;
          pre.load();
        }
        return;
      }
      // بديل (قالون وباقي القرّاء بلا مصدر صوت لكل آية): شغّل صوت
      // السورة من عند الآية المضغوطة.
      // 1) إن وُجد جدول توقيت مقاس لهذا القارئ والسورة (من تسجيله نفسه):
      //    موضع دقيق بالثواني، لا تقدير.
      // 2) وإلا: تقدير من حصة الآية من طول نص السورة، يبدأ قبلها بثانية.
      const url = effectiveAudioUrl ?? networkAudioUrl;
      if (!url) {
        setAyahError("لا يوجد صوت متاح لهذه السورة");
        return;
      }
      const timings = currentReciter
        ? getAyahTimings(currentReciter.id, surahNumber)
        : null;
      ayahExactRef.current = null;
      ayahRangeRef.current = null;
      if (timings && timings.s.length === ayahs.length) {
        const idx = ayahNumberInSurah - 1;
        const start = Math.max(0, timings.s[idx] - 0.2);
        const end =
          idx + 1 < timings.s.length ? timings.s[idx + 1] : timings.d;
        ayahExactRef.current = { start, end };
      } else {
        const totalChars = ayahs.reduce((sum, a) => sum + a.text.length, 0);
        if (totalChars === 0) return;
        let beforeChars = 0;
        let ayahChars = 0;
        for (const a of ayahs) {
          if (a.numberInSurah < ayahNumberInSurah) beforeChars += a.text.length;
          else if (a.numberInSurah === ayahNumberInSurah) ayahChars = a.text.length;
        }
        ayahRangeRef.current = {
          startFrac: beforeChars / totalChars,
          endFrac: (beforeChars + ayahChars) / totalChars,
        };
      }
      ayahSessionRef.current = {
        ayah: ayahNumberInSurah,
        start: 0,
        end: null,
        totalRepeats: ayahRepeat,
        played: 0,
      };
      setPlayingAyah(ayahNumberInSurah);
      if (audio.src !== url) audio.src = url;
      // ضغطة المستخدم تعني: ابدأ هذه الآية من أولها مهما كان موضع
      // الصوت الحالي (حتى لو كان داخلها). التقدّم المتواصل يترك
      // الصوت يكمل من حيث هو.
      ayahForceSeekRef.current = fromTap;
      if (audio.readyState >= 1 && isFinite(audio.duration) && audio.duration > 0) {
        applyAyahRange();
      } else if (ayahExactRef.current) {
        // الموضع الدقيق لا يحتاج مدة الملف: اقفز وشغّل فورًا.
        applyAyahRange();
      } else {
        // انتظر تحميل بيانات الصوت ثم اقفز لموضع الآية (في مستمع loadedmetadata).
        audio.load();
      }
    },
    [playingAyah, currentReciter, surahNumber, ayahRepeat, effectiveAudioUrl, networkAudioUrl, ayahs, stopAyah, applyAyahRange, clearAyahSeek, getCachedAyahUrl, cacheAyahAudio]
  );

  const finishAyah = useCallback(() => {
    clearAyahStopTimer();
    const session = ayahSessionRef.current;
    const audio = ayahAudioRef.current;
    if (!session || !audio) return;
    const played = session.played + 1;
    if (played < session.totalRepeats) {
      ayahSessionRef.current = { ...session, played };
      seekAyahAudio(session.start);
      return;
    }
    const nextAyah = session.ayah + 1;
    if (ayahContinuousRef.current && ayahs.some((a) => a.numberInSurah === nextAyah)) {
      playAyah(nextAyah);
      return;
    }
    stopAyah();
  }, [ayahs, playAyah, stopAyah, seekAyahAudio]);

  // مستمعو عنصر صوت الآية (مرة واحدة عند التركيب).
  const playAyahRef = useRef(playAyah);
  playAyahRef.current = playAyah;
  const finishAyahRef = useRef(finishAyah);
  finishAyahRef.current = finishAyah;
  const stopAyahRef = useRef(stopAyah);
  stopAyahRef.current = stopAyah;

  // مؤقّت إيقاف بالساعة: عند بدء تشغيل آية يُضبط ليوقف الصوت عند
  // نهايتها بعد (النهاية − الموضع الحالي) من زمن التشغيل الفعلي،
  // فيعمل حتى لو تأخّر حدث timeupdate أو ساعة العنصر. يُعاد ضبطه
  // عند كل استئناف للتشغيل، ويُلغى عند الإيقاف أو التخزين المؤقت.
  const scheduleAyahStop = () => {
    clearAyahStopTimer();
    const audio = ayahAudioRef.current;
    const session = ayahSessionRef.current;
    if (!audio || !session || session.end == null) return;
    const target = ayahContinuousRef.current
      ? session.end + AYAH_END_LATENCY_S
      : session.end;
    const remainingMs = (target - audio.currentTime) * 1000;
    if (remainingMs <= 0) {
      audio.pause();
      finishAyahRef.current();
      return;
    }
    ayahStopTimerRef.current = window.setTimeout(() => {
      ayahStopTimerRef.current = null;
      const a = ayahAudioRef.current;
      if (a) a.pause();
      finishAyahRef.current();
    }, remainingMs);
  };
  const applyAyahRangeRef = useRef(applyAyahRange);
  applyAyahRangeRef.current = applyAyahRange;
  useEffect(() => {
    const audio = ayahAudioRef.current;
    if (!audio) return;
    const onLoadedMetadata = () => {
      applyAyahRangeRef.current();
    };
    const onTimeUpdate = () => {
      const session = ayahSessionRef.current;
      if (!session || session.end == null) return;
      // التشغيل المتواصل مطفأ: أوقف الصوت عند نهاية الآية تمامًا
      // حتى لا يُسمع شيء من الآية التالية، ثم أنهِ الجلسة (تكرار
      // أو إيقاف). الإيقاف الفوري هنا يسبق أي تقدّم للشارة.
      if (!ayahContinuousRef.current) {
        if (audio.currentTime >= session.end) {
          audio.pause();
          finishAyahRef.current();
        }
        return;
      }
      // المتواصل: أخّر الإنهاء بقدر تأخر الصوت المسموع عن ساعة العنصر
      // حتى لا تتقدّم الشارة على ما يُسمع (انظر AYAH_END_LATENCY_S).
      if (audio.currentTime >= session.end + AYAH_END_LATENCY_S) {
        finishAyahRef.current();
      }
    };
    const onEnded = () => finishAyahRef.current();
    const onError = () => {
      // Offline: the ayah file is not on the device — say so, instead
      // of blaming the connection (the fix is downloading the surah).
      setAyahError(
        !navigator.onLine
          ? "هذه الآية غير محمّلة — حمّل السورة أولاً"
          : "تعذّر تشغيل صوت الآية — تحقق من الاتصال"
      );
      stopAyahRef.current();
    };
    // أثناء انتظار بيانات الصوت من الشبكة أظهر «جارٍ التحميل» بدل أن
    // تبدو الآية متوقفة أو أن توقيتها خاطئ.
    const onWaiting = () => { clearAyahStopTimer(); setAyahBuffering(true); };
    const onPlaying = () => {
      setAyahBuffering(false);
      setAyahStarted(true);
      scheduleAyahStop();
    };
    const onPause = () => clearAyahStopTimer();
    const onCanPlay = () => setAyahBuffering(false);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("canplay", onCanPlay);
    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("canplay", onCanPlay);
      clearAyahStopTimer();
      audio.pause();
    };
  }, []);

  // تغيير السورة أو القارئ يوقف صوت الآية.
  useEffect(() => {
    stopAyah();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surahNumber, currentReciter?.id]);

  // حمّل صوت السورة مسبقًا في عنصر صوت الآية منذ فتح الصفحة، حتى لا
  // تنتظر كل قفزة إلى آية جلب بياناتها من الشبكة. كان العنصر
  // preload="metadata" فيجلب البيانات عند الضغط فقط، فتتوقف الآية
  // ثوانيَ أثناء التحميل ويبدو توقيتها خاطئًا على الاتصال البطيء.
  useEffect(() => {
    const audio = ayahAudioRef.current;
    const url = effectiveAudioUrl ?? networkAudioUrl;
    const firstAyahUrl = currentReciter
      ? buildAyahAudioUrl(currentReciter, surahNumber, 1)
      : null;
    // لقرّاء الصوت-لكل-آية لا يحتاج عنصر الآية ملف السورة أبدًا،
    // فيُكتفى بتحميل صوت الآية الأولى مسبقًا.
    if (audio && url && !firstAyahUrl && audio.src !== url) {
      audio.src = url;
      audio.load();
    }
    // لقرّاء الصوت-لكل-آية: حمّل صوت الآية الأولى مسبقًا أيضًا، فهي
    // ملفات مستقلة لا يغطيها تحميل ملف السورة.
    const pre = ayahPrefetchRef.current;
    if (pre && firstAyahUrl && pre.src !== firstAyahUrl) {
      pre.src = firstAyahUrl;
      pre.load();
    }
  }, [effectiveAudioUrl, networkAudioUrl, currentReciter, surahNumber]);

  // If the offline blob fails to play (a corrupt/empty cache entry or a
  // stale blob URL), fall back to the network URL once instead of leaving
  // the player dead with «تعذّر تحميل الملف الصوتي». A network failure
  // after the switch shows the normal banner with retry (the guard above
  // stops any loop).
  const handlePlayerError = useCallback(() => {
    if (!isOffline || !networkAudioUrl) return;
    const key = `${surahNumber}-${currentReciter?.id ?? ""}`;
    if (audioFallbackTriedRef.current === key) return;
    audioFallbackTriedRef.current = key;
    setEffectiveAudioUrl(networkAudioUrl);
    setIsOffline(false);
  }, [isOffline, networkAudioUrl, surahNumber, currentReciter?.id]);

  // Downloading the currently open surah must switch the player to
  // the offline blob without leaving the page: isCached() is a
  // dependency (its result changes when the cache refreshes).
  useEffect(() => {
    if (!networkAudioUrl || !currentReciter) {
      setEffectiveAudioUrl(networkAudioUrl);
      setIsOffline(false);
      return;
    }
    let alive = true;
    audioFallbackTriedRef.current = "";
    getCachedBlobUrl(surahNumber, currentReciter.id).then((blobUrl) => {
      // A slow lookup for the previous surah must not overwrite the
      // current one when the user switches surahs quickly.
      if (!alive) return;
      if (blobUrl) {
        setEffectiveAudioUrl(blobUrl);
        setIsOffline(true);
      } else {
        setEffectiveAudioUrl(networkAudioUrl);
        setIsOffline(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [surahNumber, currentReciter?.id, networkAudioUrl, getCachedBlobUrl, isCached(surahNumber, currentReciter?.id ?? "")]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleQirahChange = (qirahId: string) => {
    setSelectedQirahId(qirahId);
    localStorage.setItem("quran_qirah", qirahId);
    const firstReciter = getRecitersForQirah(qirahId)[0];
    if (firstReciter) {
      setSelectedReciterId(firstReciter.id);
      localStorage.setItem("quran_reciter", firstReciter.id);
    }
  };

  const handleReciterChange = (reciterId: string) => {
    setSelectedReciterId(reciterId);
    localStorage.setItem("quran_reciter", reciterId);
  };

  const handleProgress = useCallback(
    (currentTime: number, duration: number) => {
      saveProgress(surahNumber, currentTime, duration, currentReciter?.id);
    },
    [surahNumber, saveProgress, currentReciter?.id]
  );

  const handleFinished = useCallback(() => {
    clearProgress(surahNumber, currentReciter?.id);
    markCompleted(surahNumber);
    setJustCompleted(true);
    setTimeout(() => setJustCompleted(false), 4000);
  }, [surahNumber, clearProgress, markCompleted, currentReciter?.id]);

  // Offline: the full Uthmani text is bundled in src/data/quran-text.ts —
  // no network is needed to read a surah. Only audio is streamed/downloaded.
  // The displayed text follows the selected qira'ah (Qaloon has its own
  // table; other qira'at fall back to the Hafs text).
  useEffect(() => {
    if (!surah) return;
    setJustCompleted(false);
    const local = getSurahAyahs(surahNumber, selectedQirahId);
    if (local.length > 0) {
      setAyahs(local);
      setError(null);
    } else {
      setAyahs([]);
      setError("تعذّر تحميل نص السورة");
    }
    setLoading(false);
  }, [surahNumber, surah, selectedQirahId]);

  // الانتقال إلى الآية المطلوبة من رابط (نتيجة بحث): مرّر إليها في
  // النص وظلّلها حتى يضغط المستخدم على آية أخرى.
  useEffect(() => {
    if (!targetAyah || ayahs.length === 0) return;
    if (targetAyah < 1 || targetAyah > ayahs.length) return;
    setHighlightedAyah(targetAyah);
    const el = document.querySelector(`[data-ayah="${targetAyah}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [ayahs, targetAyah]);

  if (!surah) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-6xl mb-4">📖</div>
          <div className="text-xl mb-4">السورة غير موجودة</div>
          <Link href="/">
            <button className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl">
              العودة للقائمة
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* عنصر صوت الآية (مخفي) — خارج أي شرط حتى تُرفَق مستمعاته عند التركيب */}
      <audio ref={ayahAudioRef} preload="auto" className="hidden" />
      {/* عنصر تحميل مسبق للآية التالية (لقرّاء الصوت-لكل-آية) */}
      <audio ref={ayahPrefetchRef} preload="auto" className="hidden" />
      {justCompleted && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)] text-center bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2 animate-bounce-once font-arabic text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          تبارك الله! أتممت سورة {surah.name} ✨
        </div>
      )}

      {/* الشريط العلوي منزَّل عن حافة الشاشة (قاعدة header.sticky في
          index.css: حشوة علوية 2.25rem + مساحة آمنة) حتى يكون واضحًا.
          إصلاح الحركة الأفقية: الصف كان أعرض من الهاتف (~426px على
          شاشة 360px) فيدفع الصفحة كلها يمين/يسار. الأزرار الآن
          مضغوطة، وزرا «نص/تسميع» مخفيان على الشاشات الضيقة (تبويبا
          البطاقة أسفل المشغّل يؤديان نفس الوظيفة)، وشريط الأزرار
          يُمرَّر داخلياً (no-scrollbar) فلا يوسّع الصفحة أبداً. */}
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border/70">
        <div className="max-w-4xl mx-auto px-3 py-3 flex items-center gap-2">
          <Link href="/" className="flex-shrink-0">
            <button className="p-1.5 rounded-full hover:bg-muted transition-colors">
              <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <BookOpen className="w-4 h-4 text-primary flex-shrink-0 hidden min-[400px]:block" />
            <span className="surah-name text-foreground truncate">{surah.name}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">({surah.numberOfAyahs} آية)</span>
            {surahCompleted && (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-0.5 min-w-0 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setRightMode("text")}
              className={`p-1.5 rounded-full transition-colors flex-shrink-0 hidden sm:block ${
                rightMode === "text" ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"
              }`}
              title="نص السورة"
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              onClick={() => setRightMode("recite")}
              className={`p-1.5 rounded-full transition-colors flex-shrink-0 hidden sm:block ${
                rightMode === "recite" ? "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400" : "hover:bg-muted text-muted-foreground"
              }`}
              title="التسميع الصوتي"
            >
              <Mic className="w-4 h-4" />
            </button>
            <button
              onClick={toggleTranslation}
              className={`p-1.5 rounded-full transition-colors flex-shrink-0 ${
                showTranslation ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"
              }`}
              title="الترجمة الإنجليزية"
            >
              <Languages className="w-4 h-4" />
            </button>
            <button
              onClick={toggleMemorization}
              className={`p-1.5 rounded-full transition-colors flex-shrink-0 ${
                memorization ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"
              }`}
              title="وضع الحفظ — إخفاء نص الآيات لتسميعها"
            >
              <EyeOff className="w-4 h-4" />
            </button>
            <button
              onClick={toggleTajweed}
              className={`p-1.5 rounded-full transition-colors flex-shrink-0 ${
                tajweed ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"
              }`}
              title="تلوين أحكام التجويد"
            >
              <Palette className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-0.5 bg-muted rounded-lg px-1 flex-shrink-0" title="حجم الخط">              <button
                onClick={decreaseFontSize}
                disabled={fontSize <= 14}
                className="p-1 rounded hover:bg-background transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="تصغير الخط"
              >
                <ALargeSmall className="w-3.5 h-3.5 scale-75" />
              </button>
              <span className="text-xs text-muted-foreground w-6 text-center tabular-nums">{fontSize}</span>
              <button
                onClick={increaseFontSize}
                disabled={fontSize >= 36}
                className="p-1 rounded hover:bg-background transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="تكبير الخط"
              >
                <ALargeSmall className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-full hover:bg-muted transition-colors flex-shrink-0"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="h-0.5 bg-gradient-to-l from-transparent via-amber-500/60 to-transparent" />
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="md:col-span-2">
            <div className="md:sticky md:top-20 space-y-4">
              {effectiveAudioUrl ? (
                <div className="relative">
                  {isOffline && (
                    <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-emerald-600/90 text-white text-xs px-2 py-0.5 rounded-full">
                      <WifiOff className="w-3 h-3" />
                      <span>وضع أوفلاين</span>
                    </div>
                  )}
                  <AudioPlayer
                    surahNumber={surahNumber}
                    surahName={surah.name}
                    reciterName={currentReciter?.name ?? currentQirah.name}
                    audioUrl={effectiveAudioUrl}
                    initialTime={initialTime}
                    onProgress={handleProgress}
                    onFinished={handleFinished}
                    onPrevious={prevSurah ? () => navigate(`/surah/${surahNumber - 1}`) : undefined}
                    onNext={nextSurah ? () => navigate(`/surah/${surahNumber + 1}`) : undefined}
                    hasPrevious={!!prevSurah}
                    hasNext={!!nextSurah}
                    pauseSignal={pauseSignal}
                    onError={handlePlayerError}
                  />
                </div>
              ) : (
                <div className="card-modern p-6 min-h-[260px] flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-sm">جارٍ تحميل المشغّل…</span>
                </div>
              )}

              {networkAudioUrl && currentReciter && (
                <div className="flex items-center justify-between bg-card border border-border rounded-2xl px-4 py-2.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {isCached(surahNumber, currentReciter.id) ? (
                      <>
                        <WifiOff className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400">محفوظ للاستماع بدون إنترنت</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3.5 h-3.5 opacity-40" />
                        <span>للاستماع بدون إنترنت</span>
                      </>
                    )}
                  </div>
                  <DownloadButton
                    surahNumber={surahNumber}
                    surahName={surah.name}
                    reciterId={currentReciter.id}
                    reciterName={currentReciter.name}
                    audioUrl={networkAudioUrl}
                  />
                </div>
              )}

              <div className="card-modern p-4 text-sm space-y-3">
                <div className="text-xs text-muted-foreground">{QIRAAT.length > 1 ? "اختيار القراءة والقارئ" : "اختيار القارئ"}</div>

                {QIRAAT.length > 1 && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">القراءة</label>
                    <select
                      value={selectedQirahId}
                      onChange={(e) => handleQirahChange(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      {QIRAAT.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">القارئ</label>
                  <select
                    value={selectedReciterId}
                    onChange={(e) => handleReciterChange(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    disabled={recitersForQirah.length <= 1}
                  >
                    {recitersForQirah.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="card-modern p-4 text-sm space-y-2">
                <div className="text-xs text-muted-foreground mb-1">معلومات السورة</div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">رقم السورة</span>
                  <span className="font-sans">{surah.number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">عدد الآيات</span>
                  <span className="font-sans">{surah.numberOfAyahs}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">نوع السورة</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    surah.revelationType === "Meccan"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : surah.revelationType === "Medinan"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                  }`}>
                    {surah.revelationType === "Meccan" ? "مكية" : surah.revelationType === "Medinan" ? "مدنية" : "مختلف فيها"}
                  </span>
                </div>
                {savedProgress && (
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="text-muted-foreground">آخر موضع</span>
                    <span className="text-xs text-primary">
                      {Math.round((savedProgress.currentTime / savedProgress.duration) * 100)}٪ مكتمل
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-border">
                  <span className="text-muted-foreground">الختمة</span>
                  <button
                    onClick={() =>
                      surahCompleted ? markUncompleted(surahNumber) : markCompleted(surahNumber)
                    }
                    className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                      surahCompleted
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {surahCompleted ? "✓ مكتملة" : "لم تُكتمل"}
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                {prevSurah && (
                  <Link href={`/surah/${prevSurah.number}`} className="flex-1">
                    <button className="w-full bg-card border border-border rounded-xl py-2.5 px-3 text-sm hover:border-primary/50 transition-colors text-right">
                      <div className="text-xs text-muted-foreground">السابقة</div>
                      <div className="font-arabic">{prevSurah.name}</div>
                    </button>
                  </Link>
                )}
                {nextSurah && (
                  <Link href={`/surah/${nextSurah.number}`} className="flex-1">
                    <button className="w-full bg-card border border-border rounded-xl py-2.5 px-3 text-sm hover:border-primary/50 transition-colors text-left">
                      <div className="text-xs text-muted-foreground">التالية</div>
                      <div className="font-arabic">{nextSurah.name}</div>
                    </button>
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="md:col-span-3">
            <div className="card-modern overflow-hidden">
              <div className="flex border-b border-border">
                <button
                  onClick={() => setRightMode("text")}
                  className={`flex-1 py-2.5 text-sm flex items-center justify-center gap-1.5 transition-colors ${
                    rightMode === "text"
                      ? "bg-primary/5 text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  نص السورة
                </button>
                <button
                  onClick={() => setRightMode("recite")}
                  className={`flex-1 py-2.5 text-sm flex items-center justify-center gap-1.5 transition-colors ${
                    rightMode === "recite"
                      ? "bg-red-50 text-red-600 border-b-2 border-red-500 dark:bg-red-900/10 dark:text-red-400"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  التسميع الصوتي
                </button>
              </div>

              {rightMode === "text" ? (
                <>
                  {surah.number !== 9 && surah.number !== 1 && (
                    <div className="text-center py-5 border-b border-border bg-primary/5">
                      <div className="bismillah-text text-2xl sm:text-3xl text-primary">
                        بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                      </div>
                    </div>
                  )}

                  {loading && (
                    <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-sm">جارٍ تحميل السورة...</span>
                    </div>
                  )}

                  {error && (
                    <div className="py-12 text-center text-muted-foreground">
                      <div className="text-3xl mb-3">⚠️</div>
                      <div className="text-sm">{error}</div>
                    </div>
                  )}

                  {!loading && !error && ayahs.length > 0 && (
                    <div className="p-6">
                      {/* وضع الحفظ: النص مخفي حتى يُكشف — استمع للآية ثم
                          اضغط «إظهار» لتتأكد منها. */}
                      {memorization && (
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                          <span className="flex items-center gap-1.5 text-xs text-primary font-arabic">
                            <EyeOff className="w-3.5 h-3.5" />
                            وضع الحفظ مفعّل — استمع للآية ثم اضغط «إظهار» لتتأكد
                          </span>
                          <span className="flex items-center gap-1.5">
                            <button
                              onClick={revealAll}
                              className="px-2.5 py-1 rounded-lg text-xs bg-background border border-border text-muted-foreground hover:text-foreground transition-colors"
                            >
                              إظهار الكل
                            </button>
                            <button
                              onClick={hideAll}
                              className="px-2.5 py-1 rounded-lg text-xs bg-background border border-border text-muted-foreground hover:text-foreground transition-colors"
                            >
                              إخفاء الكل
                            </button>
                          </span>
                        </div>
                      )}
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-muted-foreground">اضغط على أي آية لسماعها</span>
                        <button
                          onClick={() => navigate(`/mushaf/${getPageOfAyah(surahNumber, selectedAyah ?? 1)}`)}
                          className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-full hover:bg-primary/20 transition-colors"
                          title="افتح هذه الآية في المصحف"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          المصحف
                        </button>
                        {/* شارة الآية تظهر فقط عندما يتحرك الصوت فعلًا،
                            لا من لحظة الضغط — حتى لا يُحسب زمن انتظار
                            الشبكة ضمن مدة الآية. */}
                        {playingAyah != null && ayahStarted && !ayahBuffering && (
                          <span className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-full">
                            <Volume2 className="w-3.5 h-3.5" />
                            الآية {toArabicNum(playingAyah)}
                          </span>
                        )}
                        {playingAyah != null && (!ayahStarted || ayahBuffering) && (
                          <span className="flex items-center gap-1 bg-amber-500/10 text-amber-600 px-2 py-1 rounded-full">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            جارٍ تحميل الصوت...
                          </span>
                        )}
                      </div>
                      {/* لوحة أزرار التشغيل (تكرار/متواصل/إيقاف) — تظهر فقط
                          أثناء التشغيل فعلًا. زر «التفسير» صار فوق الآية
                          المضغوطة مباشرة (داخل نص السورة)، حتى لا يضطر
                          المستخدم للرجوع إلى أول السورة ليجده. */}
                      {selectedAyah != null && playingAyah != null && (
                        <div className="mb-4 flex flex-wrap items-center gap-2 bg-muted/50 border border-border rounded-xl px-3 py-2">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Repeat className="w-3.5 h-3.5" />
                            تكرار الآية:
                          </span>
                          {[1, 3, 5].map((n) => (
                            <button
                              key={n}
                              onClick={() => {
                                setAyahRepeat(n);
                                if (ayahSessionRef.current) {
                                  ayahSessionRef.current = {
                                    ...ayahSessionRef.current,
                                    totalRepeats: n,
                                  };
                                }
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                                ayahRepeat === n
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-background border border-border text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              ×{n}
                            </button>
                          ))}
                          <button
                            onClick={() => setAyahContinuous((c) => !c)}
                            className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                              ayahContinuous
                                ? "bg-primary text-primary-foreground"
                                : "bg-background border border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            متواصل
                          </button>
                          <button
                            onClick={() => {
                              stopAyah();
                              setSelectedAyah(null);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-background border border-border text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Square className="w-3 h-3" />
                            إيقاف
                          </button>
                        </div>
                      )}
                      {ayahError && (
                        <div className="mb-3 text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2">
                          {ayahError}
                        </div>
                      )}
                      {/* مفتاح ألوان التجويد — يظهر فقط عند تفعيل التلوين. */}
                      {tajweed && rightMode === "text" && (
                        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-muted/60 px-3 py-2">
                          <span className="text-xs text-muted-foreground">أحكام التجويد:</span>
                          {TAJWEED_LEGEND.map((item) => (
                            <span key={item.label} className="flex items-center gap-1 text-xs">
                              <span className={`w-2.5 h-2.5 rounded-full bg-current ${item.className}`} />
                              <span className={item.className}>{item.label}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {/* عند تشغيل الترجمة: آية آية، كل آية في بلوك مستقل
                          وتحتها ترجمتها الإنجليزية. بدونها: النص المتصل
                          المعتاد مثل المصحف. */}
                      {showTranslation ? (
                        <div className="space-y-5" dir="rtl">
                          {ayahs.map((ayah, idx) => (
                            <div
                              key={ayah.number}
                              data-ayah={ayah.numberInSurah}
                              onClick={() => playAyah(ayah.numberInSurah, true)}
                              className={`cursor-pointer rounded-xl px-3 py-2 transition-colors hover:bg-primary/5 ${
                                playingAyah === ayah.numberInSurah || selectedAyah === ayah.numberInSurah ? "bg-primary/10" : ""
                              } ${
                                highlightedAyah === ayah.numberInSurah
                                  ? "bg-amber-200/80 dark:bg-amber-800/60 ring-2 ring-amber-400/70"
                                  : ""
                              }`}
                            >
                              <div className="quran-text leading-loose" style={{ fontSize: `${fontSize}px` }}>
                                <span className={memorization && !revealedAyahs.has(ayah.numberInSurah) ? "blur-md select-none" : ""}>
                                  <WordTapText surahNumber={surahNumber} ayahNumber={ayah.numberInSurah} text={ayahParts[idx].rest} windowBase={ayahParts[idx].basmala ? ayah.text.length - ayahParts[idx].rest.length : 0} tajweed={tajweed} onRuleClick={setSelectedRule} onWordClick={memorization && !revealedAyahs.has(ayah.numberInSurah) ? undefined : (wi, wt) => setWordSheet({ surahNumber, ayahNumber: ayah.numberInSurah, wordIndex: wi, wordText: wt })} />
                                </span>{" "}
                                <span className="text-primary inline-block mx-1 text-base">
                                  ﴿{toArabicNum(ayah.numberInSurah)}﴾
                                </span>
                                {isSajdahAyah(surahNumber, ayah.numberInSurah) && (
                                  <span className="inline-block mx-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs align-middle" title="آية سجدة">
                                    ۩ سجدة
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed mt-1.5" dir="ltr">
                                {getTranslation(surahNumber, ayah.numberInSurah)}
                              </p>
                              {selectedAyah === ayah.numberInSurah && (
                                <AyahActions
                                  surahNumber={surahNumber}
                                  ayahNumber={ayah.numberInSurah}
                                  isFav={isFavourite(surahNumber, ayah.numberInSurah)}
                                  onToggleFavourite={() => toggleFavourite(surahNumber, ayah.numberInSurah)}
                                  onTafsir={() => setTafsirAyah(ayah.numberInSurah)}
                                  onReadings={() => navigate(`/readings/${surahNumber}/${ayah.numberInSurah}`)}
                                  onShare={() => setSharePreviewAyah(ayah.numberInSurah)}
                                  onCopy={() => handleCopyAyah(ayah.numberInSurah)}
                                  copied={copiedAyah === ayah.numberInSurah}
                                  memorization={memorization}
                                  revealed={revealedAyahs.has(ayah.numberInSurah)}
                                  onToggleReveal={() => toggleReveal(ayah.numberInSurah)}
                                />
                              )}
                              {selectedAyah === ayah.numberInSurah && (
                                <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                  <HifzRating surahNumber={surahNumber} ayahNumber={ayah.numberInSurah} />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="quran-text text-right leading-loose" style={{ fontSize: `${fontSize}px` }} dir="rtl">
                          {ayahs.map((ayah, idx) => (
                            <Fragment key={ayah.number}>
                              {/* أزرار الآية المضغوطة مباشرة فوقها — التفسير /
                                  حفظ في المفضلة / مشاركة كصورة — حتى لا يضطر
                                  المستخدم للرجوع إلى أول السورة ليجدها. */}
                              {selectedAyah === ayah.numberInSurah && (
                                <AyahActions
                                  surahNumber={surahNumber}
                                  ayahNumber={ayah.numberInSurah}
                                  isFav={isFavourite(surahNumber, ayah.numberInSurah)}
                                  onToggleFavourite={() => toggleFavourite(surahNumber, ayah.numberInSurah)}
                                  onTafsir={() => setTafsirAyah(ayah.numberInSurah)}
                                  onReadings={() => navigate(`/readings/${surahNumber}/${ayah.numberInSurah}`)}
                                  onShare={() => setSharePreviewAyah(ayah.numberInSurah)}
                                  onCopy={() => handleCopyAyah(ayah.numberInSurah)}
                                  copied={copiedAyah === ayah.numberInSurah}
                                  memorization={memorization}
                                  revealed={revealedAyahs.has(ayah.numberInSurah)}
                                  onToggleReveal={() => toggleReveal(ayah.numberInSurah)}
                                />
                              )}
                              {selectedAyah === ayah.numberInSurah && (
                                <div className="my-2" onClick={(e) => e.stopPropagation()}>
                                  <HifzRating surahNumber={surahNumber} ayahNumber={ayah.numberInSurah} />
                                </div>
                              )}
                              <span
                                data-ayah={ayah.numberInSurah}
                                onClick={() => playAyah(ayah.numberInSurah, true)}
                                className={`cursor-pointer rounded px-0.5 transition-colors hover:bg-primary/10 ${
                                  playingAyah === ayah.numberInSurah || selectedAyah === ayah.numberInSurah ? "bg-primary/15" : ""
                                } ${
                                  highlightedAyah === ayah.numberInSurah
                                    ? "bg-amber-200/80 dark:bg-amber-800/60 ring-2 ring-amber-400/70"
                                    : ""
                                }`}
                              >
                                <span className={memorization && !revealedAyahs.has(ayah.numberInSurah) ? "blur-md select-none" : ""}>
                                  <WordTapText surahNumber={surahNumber} ayahNumber={ayah.numberInSurah} text={ayahParts[idx].rest} windowBase={ayahParts[idx].basmala ? ayah.text.length - ayahParts[idx].rest.length : 0} tajweed={tajweed} onRuleClick={setSelectedRule} onWordClick={memorization && !revealedAyahs.has(ayah.numberInSurah) ? undefined : (wi, wt) => setWordSheet({ surahNumber, ayahNumber: ayah.numberInSurah, wordIndex: wi, wordText: wt })} />
                                </span>{" "}
                                <span className="text-primary inline-block mx-1 text-base">
                                  ﴿{toArabicNum(ayah.numberInSurah)}﴾
                                </span>{" "}
                                {isSajdahAyah(surahNumber, ayah.numberInSurah) && (
                                  <span className="inline-block mx-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs align-middle" title="آية سجدة">
                                    ۩ سجدة
                                  </span>
                                )}{" "}
                              </span>
                            </Fragment>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {loading ? (
                    <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-sm">جارٍ تحميل آيات السورة...</span>
                    </div>
                  ) : error ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <div className="text-3xl mb-3">⚠️</div>
                      <div className="text-sm">{error}</div>
                    </div>
                  ) : ayahs.length > 0 ? (
                    <TajweedChecker ayahs={ayahs} surahName={surah.name} fontSize={fontSize} />
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Share preview sheet for the tapped ayah */}
      {sharePreviewData && (
        <SharePreviewSheet ayah={sharePreviewData} onClose={() => setSharePreviewAyah(null)} />
      )}

      {/* Word sheet for a tapped word (1.0.74: root / meanings) */}
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
        />
      )}

      {/* Tafsir sheet for the selected ayah */}
      {tafsirAyah != null && surah && (
        <TafsirSheet
          surahNumber={surahNumber}
          ayahNumber={tafsirAyah}
          onClose={() => setTafsirAyah(null)}
          onPlayAyah={(n) => {
            setTafsirAyah(null);
            playAyah(n, true);
          }}
        />
      )}

      {/* شرح حكم التجويد المضغوط عليه */}
      <TajweedRuleSheet rule={selectedRule} onClose={() => setSelectedRule(null)} />
    </div>
  );
}
