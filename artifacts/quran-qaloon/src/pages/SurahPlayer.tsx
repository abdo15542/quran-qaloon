import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from "react";
import { ArrowRight, BookOpen, Loader2, Moon, Sun, FileText, Mic, CheckCircle2, WifiOff, ALargeSmall, Heart, Languages, Share2, Copy, Check, Eye, EyeOff, Palette, X, Square, List, LayoutGrid } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { SURAHS, RECITERS, buildAudioUrl } from "@/data/surahs";
import { getSurahAyahs, splitAyahBasmala, displayAyahText, BASMALA } from "@/data/quran-text";
import { isSajdahAyah } from "@/data/hizb";
import { getTranslation } from "@/data/translation-en";
import { getPageOfAyah } from "@/data/mushaf-pages";
import { getJamahiriyaPageOfAyah } from "@/data/jamahiriya";
import { useAyahAudio } from "@/hooks/useAyahAudio";
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
import { useKhatma } from "@/hooks/useKhatma";
import { useFavourites } from "@/hooks/useFavourites";
import { useOffline } from "@/context/OfflineContext";
import { copyTextToClipboard } from "@/lib/copy";

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
export function AyahActions({
  surahNumber,
  ayahNumber,
  isFav,
  onToggleFavourite,
  onTafsir,
  onShare,
  onCopy,
  copied,
  memorization,
  revealed,
  onToggleReveal,
  onClose,
}: {
  surahNumber: number;
  ayahNumber: number;
  isFav: boolean;
  onToggleFavourite: () => void;
  onTafsir: () => void;
  onShare: () => void;
  onCopy: () => void;
  copied: boolean;
  memorization: boolean;
  revealed: boolean;
  onToggleReveal: () => void;
  onClose: () => void;
}) {
  // In the translation layout the buttons sit inside the clickable ayah
  // block, so stop the click from bubbling up and re-selecting the ayah.
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
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-arabic bg-background border border-border text-muted-foreground hover:text-destructive transition-colors whitespace-nowrap"
        aria-label="الخروج من وضع الآية"
      >
        <X className="w-3.5 h-3.5" />
        خروج
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

export function getStoredReciterId(_qirahId: string): string {
  const stored = localStorage.getItem("quran_reciter");
  if (stored && RECITERS.some((r) => r.id === stored)) return stored;
  // 1.0.115: the default reciter is Hudhaify (Qaloon). An old stored
  // Hafs reciter id (e.g. "mishary") matches nothing and falls through.
  return "hudhaify-qaloon";
}

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
  // [1.0.75] Rating refresh token: a rating made inside the word sheet
  // must also refresh the inline rating under the ayah (separate
  // HifzRating instance, reads its value on mount).
  const [hifzVersion, setHifzVersion] = useState(0);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rightMode, setRightMode] = useState<"text" | "recite">("text");
  const [justCompleted, setJustCompleted] = useState(false);
  const [fontSize, setFontSize] = useState<number>(() => {
    const stored = localStorage.getItem("quran_font_size");
    return stored ? Number(stored) : 22;
  });

  const [selectedReciterId, setSelectedReciterId] = useState<string>(() =>
    getStoredReciterId("qaloon")
  );
  const [effectiveAudioUrl, setEffectiveAudioUrl] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const { getProgress, saveProgress, clearProgress } = useListeningProgress();
  const { isCompleted, markCompleted, markUncompleted } = useKhatma();
  const { isFavourite, toggleFavourite } = useFavourites();
  const { isCached, getCachedBlobUrl } = useOffline();


  useEffect(() => {
    document.documentElement.style.setProperty("--quran-font-size", `${fontSize}px`);
    localStorage.setItem("quran_font_size", String(fontSize));
  }, [fontSize]);

  const increaseFontSize = () => setFontSize((s) => Math.min(s + 2, 36));
  const decreaseFontSize = () => setFontSize((s) => Math.max(s - 2, 14));

  const surah = SURAHS.find((s) => s.number === surahNumber);
  const prevSurah = SURAHS.find((s) => s.number === surahNumber - 1);
  const nextSurah = SURAHS.find((s) => s.number === surahNumber + 1);

  const recitersForQirah = RECITERS;
  const currentReciter =
    recitersForQirah.find((r) => r.id === selectedReciterId) ?? recitersForQirah[0];

  const networkAudioUrl = currentReciter ? buildAudioUrl(currentReciter, surahNumber) : null;
  const audioUrl = networkAudioUrl;

  // Resume is per reciter: the same surah with another reciter is a
  // different recording, so its position is stored separately.
  const savedProgress = getProgress(surahNumber, currentReciter?.id);
  const initialTime = savedProgress?.currentTime ?? 0;
  const surahCompleted = isCompleted(surahNumber);

  // 1.0.116: tapping an ayah PLAYS it again — from the whole-surah
  // recording, seeking to the ayah's measured timing window (see
  // useAyahAudio). It also selects the ayah and shows its actions
  // (tafsir / favourite / share / copy) plus the hifz rating; tapping
  // a word in it opens the word sheet (WordTapText stops that tap
  // propagating, so a word tap never starts audio). Tapping the
  // playing ayah again stops it. Whole-surah playback is the
  // AudioPlayer above (paused while an ayah plays, via pauseSignal).
  const [selectedAyah, setSelectedAyah] = useState<number | null>(null);
  const ayahAudio = useAyahAudio();
  // Ref to the current playAyahFor (defined below, after the audio URL
  // resolves): handleAyahTap and the continuous-play callback need it
  // without a circular useCallback dependency.
  const playAyahForRef = useRef<(ayahNumber: number) => void>(() => {});
  // Index into surahPages (below) — the Madani page currently shown.
  const [pageIdx, setPageIdx] = useState(0);
  // [1.0.116] Per-surah 604-page Madani view (default — the user's
  // order) vs the ayah-list view. Both keep the same ayah features.
  const [viewMode, setViewMode] = useState<"pages" | "list">(() => {
    try {
      return localStorage.getItem("quran_surah_view") === "list" ? "list" : "pages";
    } catch {
      return "pages";
    }
  });
  const setView = (v: "pages" | "list") => {
    setViewMode(v);
    try {
      localStorage.setItem("quran_surah_view", v);
    } catch {
      // storage unavailable
    }
  };
  // Tap-ayah repeat (×1/×3/×5) and continuous play (next ayah when
  // one finishes) — persisted like the other player settings.
  const [ayahRepeat, setAyahRepeat] = useState<number>(() => {
    try {
      const v = parseInt(localStorage.getItem("quran_ayah_repeat") ?? "1", 10);
      return v === 3 || v === 5 ? v : 1;
    } catch {
      return 1;
    }
  });
  const [ayahContinuous, setAyahContinuous] = useState<boolean>(() => {
    try {
      return localStorage.getItem("quran_ayah_continuous") === "1";
    } catch {
      return false;
    }
  });
  // Increment to pause the whole-surah player (AudioPlayer pauseSignal).
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
  // Guards the blob -> network fallback so it fires at most once per surah+reciter.
  const audioFallbackTriedRef = useRef("");

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

  // [1.0.116] The surah's Madani 604 pages (from mushaf-pages.ts):
  // the page view shows one page at a time, keeping the surah's audio
  // and ayah features. A page is listed even if the surah only touches
  // part of it (the page view shows only this surah's ayahs).
  const surahPages = useMemo(() => {
    if (!surah) return [];
    const first = getPageOfAyah(surahNumber, 1);
    const last = getPageOfAyah(surahNumber, surah.numberOfAyahs);
    const pages: number[] = [];
    for (let p = first; p <= last; p++) pages.push(p);
    return pages;
  }, [surahNumber, surah]);
  const currentPage = surahPages[Math.min(pageIdx, Math.max(0, surahPages.length - 1))] ?? 1;
  const pageAyahs = useMemo(
    () => ayahs.filter((a) => getPageOfAyah(surahNumber, a.numberInSurah) === currentPage),
    [ayahs, surahNumber, currentPage]
  );
  const pageParts = useMemo(
    () => pageAyahs.map((a) => splitAyahBasmala(surahNumber, a.numberInSurah, a.text)),
    [pageAyahs, surahNumber]
  );

  // Turn the page view to the page holding an ayah (continuous play).
  const goToAyahPage = useCallback(
    (ayahNumber: number) => {
      const p = getPageOfAyah(surahNumber, ayahNumber);
      const idx = surahPages.indexOf(p);
      if (idx >= 0) setPageIdx(idx);
    },
    [surahNumber, surahPages]
  );

  // Play one ayah from the whole-surah recording (timed window, or an
  // approximate position when no timing exists yet). Uses the same
  // source as the main player (offline blob when downloaded, else the
  // network URL) and pauses the main player first.
  const playAyahFor = useCallback(
    (ayahNumber: number) => {
      const url = effectiveAudioUrl ?? networkAudioUrl;
      if (!url) return;
      setPauseSignal((s) => s + 1);
      ayahAudio.playAyah({
        url,
        reciterId: selectedReciterId,
        surah: surahNumber,
        ayah: ayahNumber,
        repeat: ayahRepeat,
        onFinished: ({ ayah }) => {
          if (ayahContinuous && surah && ayah < surah.numberOfAyahs) {
            const next = ayah + 1;
            setSelectedAyah(next);
            goToAyahPage(next);
            playAyahForRef.current(next);
          }
        },
      });
    },
    [effectiveAudioUrl, networkAudioUrl, selectedReciterId, surahNumber, ayahRepeat, ayahContinuous, surah, ayahAudio, goToAyahPage]
  );
  playAyahForRef.current = playAyahFor;

  // Reciter change: the tap-ayah audio belongs to the old recording.
  const handleReciterChange = (reciterId: string) => {
    ayahAudio.stop();
    setSelectedReciterId(reciterId);
    localStorage.setItem("quran_reciter", reciterId);
  };

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
  // 1.0.116: tap-ayah plays the ayah (measured window, or an
  // approximate position when no timing exists yet — see useAyahAudio).
  // عند الانتقال إلى سورة أخرى ألغِ تحديد الآية (حتى لا تبقى لوحة
  // سورة قديمة ظاهرة) وأخفِ الآيات المكشوفة في وضع الحفظ، وأوقف
  // صوت الآية وارجع لأول صفحة من صفحات السورة الجديدة.
  useEffect(() => {
    setSelectedAyah(null);
    setRevealedAyahs(new Set());
    setPageIdx(0);
    ayahAudio.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surahNumber]);

  // Tap an ayah: play it + select it (shows its actions); tap the
  // playing ayah again to stop it and deselect.
  const handleAyahTap = useCallback(
    (ayahNumberInSurah: number) => {
      setHighlightedAyah(null);
      if (
        ayahAudio.playing?.surah === surahNumber &&
        ayahAudio.playing?.ayah === ayahNumberInSurah
      ) {
        ayahAudio.stop();
        setSelectedAyah(null);
        return;
      }
      setSelectedAyah(ayahNumberInSurah);
      playAyahForRef.current(ayahNumberInSurah);
    },
    [ayahAudio, surahNumber]
  );

  // [1.0.74] Tap a word: select its ayah and open the word sheet
  // (root / meanings) for it directly — no audio gate any more.
  const handleWordTap = useCallback(
    (ayahNumberInSurah: number, wordIndex: number, wordText: string) => {
      setSelectedAyah(ayahNumberInSurah);
      setWordSheet({ surahNumber, ayahNumber: ayahNumberInSurah, wordIndex, wordText });
    },
    [surahNumber]
  );

  // Exit the selected-ayah mode entirely: close the word sheet if open,
  // and deselect — the layout returns to plain reading.
  const exitAyahMode = useCallback(() => {
    setWordSheet(null);
    setSelectedAyah(null);
  }, []);

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

  // Offline: the full Qaloon text is bundled in src/data/quran-text.ts —
  // no network is needed to read a surah. Only audio is streamed/downloaded.
  // 1.0.115: the displayed text is always Qaloon ('an Nafi').
  useEffect(() => {
    if (!surah) return;
    setJustCompleted(false);
    const local = getSurahAyahs(surahNumber);
    if (local.length > 0) {
      setAyahs(local);
      setError(null);
    } else {
      setAyahs([]);
      setError("تعذّر تحميل نص السورة");
    }
    setLoading(false);
  }, [surahNumber, surah]);

  // الانتقال إلى الآية المطلوبة من رابط (نتيجة بحث): مرّر إليها في
  // النص وظلّلها حتى يضغط المستخدم على آية أخرى.
  useEffect(() => {
    if (!targetAyah || ayahs.length === 0) return;
    if (targetAyah < 1 || targetAyah > ayahs.length) return;
    setHighlightedAyah(targetAyah);
    const el = document.querySelector(`[data-ayah="${targetAyah}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [ayahs, targetAyah]);

  // [1.0.116] The ayah text of one view — the ayah-list view passes
  // all ayahs, the 604-page view passes only the current page's ayahs.
  // Same rendering (and same features) in both: tap-ayah plays the ayah,
  // word tap opens the word sheet, tafsir/favourite/share/copy + rating.
  const renderAyahText = (
    list: Ayah[],
    parts: ReturnType<typeof splitAyahBasmala>[]
  ) => (
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
                        <span className="text-muted-foreground">اضغط على أي آية لتشغيلها وعرض إجراءاتها</span>
                        <button
                          onClick={() => navigate(`/reading/${getJamahiriyaPageOfAyah(surahNumber, selectedAyah ?? 1)}`)}
                          className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-full hover:bg-primary/20 transition-colors"
                          title="افتح هذه الآية في مصحف الجماهيرية"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          المصحف
                        </button>
                      </div>
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
                          {list.map((ayah, idx) => (
                            <div
                              key={ayah.number}
                              data-ayah={ayah.numberInSurah}
                              onClick={() => handleAyahTap(ayah.numberInSurah)}
                              className={`cursor-pointer rounded-xl px-3 py-2 transition-colors hover:bg-primary/5 ${
                                selectedAyah === ayah.numberInSurah ? "bg-primary/10" : ""
                              } ${
                                highlightedAyah === ayah.numberInSurah
                                  ? "bg-amber-200/80 dark:bg-amber-800/60 ring-2 ring-amber-400/70"
                                  : ""
                              }`}
                            >
                              <div className="quran-text leading-loose" style={{ fontSize: `${fontSize}px` }}>
                                <span className={memorization && !revealedAyahs.has(ayah.numberInSurah) ? "blur-md select-none" : ""}>
                                  <WordTapText surahNumber={surahNumber} ayahNumber={ayah.numberInSurah} text={parts[idx].rest} windowBase={parts[idx].basmala ? ayah.text.length - parts[idx].rest.length : 0} tajweed={tajweed} onRuleClick={setSelectedRule} onWordClick={memorization && !revealedAyahs.has(ayah.numberInSurah) ? undefined : (wi, wt) => handleWordTap(ayah.numberInSurah, wi, wt)} />
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
                                  onShare={() => setSharePreviewAyah(ayah.numberInSurah)}
                                  onCopy={() => handleCopyAyah(ayah.numberInSurah)}
                                  copied={copiedAyah === ayah.numberInSurah}
                                  memorization={memorization}
                                  revealed={revealedAyahs.has(ayah.numberInSurah)}
                                  onToggleReveal={() => toggleReveal(ayah.numberInSurah)}
                                  onClose={exitAyahMode}
                                />
                              )}
                              {selectedAyah === ayah.numberInSurah && (
                                <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                  <HifzRating key={`hifz-${ayah.numberInSurah}-${hifzVersion}`} surahNumber={surahNumber} ayahNumber={ayah.numberInSurah} />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="quran-text text-right leading-loose" style={{ fontSize: `${fontSize}px` }} dir="rtl">
                          {list.map((ayah, idx) => (
                            <Fragment key={ayah.number}>
                              <span
                                data-ayah={ayah.numberInSurah}
                                onClick={() => handleAyahTap(ayah.numberInSurah)}
                                className={`cursor-pointer rounded px-0.5 transition-colors hover:bg-primary/10 ${
                                  selectedAyah === ayah.numberInSurah ? "bg-primary/15" : ""
                                } ${
                                  highlightedAyah === ayah.numberInSurah
                                    ? "bg-amber-200/80 dark:bg-amber-800/60 ring-2 ring-amber-400/70"
                                    : ""
                                }`}
                              >
                                <span className={memorization && !revealedAyahs.has(ayah.numberInSurah) ? "blur-md select-none" : ""}>
                                  <WordTapText surahNumber={surahNumber} ayahNumber={ayah.numberInSurah} text={parts[idx].rest} windowBase={parts[idx].basmala ? ayah.text.length - parts[idx].rest.length : 0} tajweed={tajweed} onRuleClick={setSelectedRule} onWordClick={memorization && !revealedAyahs.has(ayah.numberInSurah) ? undefined : (wi, wt) => handleWordTap(ayah.numberInSurah, wi, wt)} />
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
                              {/* [1.0.77] أزرار الآية تحت نصها — لا فوقه: عندما
                                  كانت فوقها كانت اللوحة تغطي الآية التي قبلها
                                  وتضيع من الشاشة. */}
                              {selectedAyah === ayah.numberInSurah && (
                                <AyahActions
                                  surahNumber={surahNumber}
                                  ayahNumber={ayah.numberInSurah}
                                  isFav={isFavourite(surahNumber, ayah.numberInSurah)}
                                  onToggleFavourite={() => toggleFavourite(surahNumber, ayah.numberInSurah)}
                                  onTafsir={() => setTafsirAyah(ayah.numberInSurah)}
                                  onShare={() => setSharePreviewAyah(ayah.numberInSurah)}
                                  onCopy={() => handleCopyAyah(ayah.numberInSurah)}
                                  copied={copiedAyah === ayah.numberInSurah}
                                  memorization={memorization}
                                  revealed={revealedAyahs.has(ayah.numberInSurah)}
                                  onToggleReveal={() => toggleReveal(ayah.numberInSurah)}
                                  onClose={exitAyahMode}
                                />
                              )}
                              {selectedAyah === ayah.numberInSurah && (
                                <div className="my-2" onClick={(e) => e.stopPropagation()}>
                                  <HifzRating key={`hifz-${ayah.numberInSurah}-${hifzVersion}`} surahNumber={surahNumber} ayahNumber={ayah.numberInSurah} />
                                </div>
                              )}
                            </Fragment>
                          ))}
                        </div>
                      )}
                    </div>
  );

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
                    reciterName={currentReciter?.name ?? "قالون عن نافع"}
                    audioUrl={effectiveAudioUrl}
                    initialTime={initialTime}
                    onProgress={handleProgress}
                    onFinished={handleFinished}
                    onPrevious={prevSurah ? () => navigate(`/surah/${surahNumber - 1}`) : undefined}
                    onNext={nextSurah ? () => navigate(`/surah/${surahNumber + 1}`) : undefined}
                    hasPrevious={!!prevSurah}
                    hasNext={!!nextSurah}
                    onError={handlePlayerError}
                    pauseSignal={pauseSignal}
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
                <div className="text-xs text-muted-foreground">اختيار القارئ — قالون عن نافع</div>

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

              {rightMode === "text" && (
                <>
                  {/* [1.0.116] عرض الصفحات (المدني ٦٠٤، الافتراضي) / عرض
                      القائمة — نفس الآيات ونفس المزايا في العرضين. */}
                  <div className="flex flex-wrap items-center gap-2 px-4 pt-3" data-testid="surah-view-switch">
                    <button
                      onClick={() => setView("pages")}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-colors ${
                        viewMode === "pages" ? "bg-primary/10 text-primary border border-primary/30" : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      عرض الصفحات
                    </button>
                    <button
                      onClick={() => setView("list")}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-colors ${
                        viewMode === "list" ? "bg-primary/10 text-primary border border-primary/30" : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                      عرض القائمة
                    </button>
                    <span className="flex-1" />
                    <span className="text-xs text-muted-foreground">تكرار الآية</span>
                    {[1, 3, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => {
                          setAyahRepeat(n);
                          try {
                            localStorage.setItem("quran_ayah_repeat", String(n));
                          } catch {
                            // storage unavailable
                          }
                        }}
                        className={`px-2 py-1 rounded-full text-xs transition-colors ${
                          ayahRepeat === n ? "bg-primary/10 text-primary border border-primary/30" : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        ×{n}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setAyahContinuous((v) => {
                          try {
                            localStorage.setItem("quran_ayah_continuous", v ? "0" : "1");
                          } catch {
                            // storage unavailable
                          }
                          return !v;
                        });
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                        ayahContinuous ? "bg-primary/10 text-primary border border-primary/30" : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                      title="تشغيل الآية التالية تلقائيًا عند انتهاء الآية"
                    >
                      متواصل
                    </button>
                  </div>
                  {viewMode === "pages" && surahPages.length > 1 && (
                    <div className="flex items-center justify-between gap-2 px-4 pt-3" data-testid="surah-page-nav">
                      <button
                        onClick={() => setPageIdx((i) => Math.max(0, i - 1))}
                        disabled={pageIdx <= 0}
                        className="px-3 py-1.5 rounded-full bg-muted text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                      >
                        السابقة
                      </button>
                      <span className="text-xs text-muted-foreground" data-testid="surah-page-label">
                        صفحة {toArabicNum(currentPage)} • {toArabicNum(pageIdx + 1)} من {toArabicNum(surahPages.length)}
                      </span>
                      <button
                        onClick={() => setPageIdx((i) => Math.min(surahPages.length - 1, i + 1))}
                        disabled={pageIdx >= surahPages.length - 1}
                        className="px-3 py-1.5 rounded-full bg-muted text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                      >
                        التالية
                      </button>
                    </div>
                  )}
                  {ayahAudio.playing && (
                    <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2" data-testid="ayah-playing">
                      <span className="text-xs text-red-700 dark:text-red-400 flex-1">
                        جارٍ تشغيل الآية ﴿{toArabicNum(ayahAudio.playing.ayah)}﴾
                        {ayahAudio.playing.timed ? "" : " — من موضع تقريبي"}
                        {ayahAudio.playing.repeat > 1 ? ` — تكرار ${toArabicNum(ayahAudio.playing.repeatIndex + 1)} من ${toArabicNum(ayahAudio.playing.repeat)}` : ""}
                      </span>
                      <button
                        onClick={() => ayahAudio.stop()}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs hover:bg-red-700 transition-colors"
                        aria-label="إيقاف صوت الآية"
                      >
                        <Square className="w-3 h-3" />
                        إيقاف
                      </button>
                    </div>
                  )}
                  {ayahAudio.notice && (
                    <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2" data-testid="ayah-approx-notice">
                      <span className="text-xs text-amber-700 dark:text-amber-400 flex-1">{ayahAudio.notice}</span>
                      <button onClick={ayahAudio.clearNotice} className="text-amber-700 dark:text-amber-400 text-sm leading-none" aria-label="إغلاق التنبيه">
                        ×
                      </button>
                    </div>
                  )}
                  {ayahAudio.error && (
                    <div className="mx-4 mt-3 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-700 dark:text-red-400" data-testid="ayah-error">
                      {ayahAudio.error}
                    </div>
                  )}
                </>
              )}

              {rightMode === "text" ? (
                <>
                  {(viewMode === "list" || pageIdx === 0) && surah.number !== 9 && surah.number !== 1 && (
                    <div className="text-center py-5 border-b border-border bg-primary/5">
                      <div className="bismillah-text text-2xl sm:text-3xl text-primary">
                        {BASMALA}
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

                  {!loading && !error && ayahs.length > 0 &&
                    renderAyahText(viewMode === "pages" ? pageAyahs : ayahs, viewMode === "pages" ? pageParts : ayahParts)}
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
          actions={{
            isFav: isFavourite(wordSheet.surahNumber, wordSheet.ayahNumber),
            onToggleFavourite: () => toggleFavourite(wordSheet.surahNumber, wordSheet.ayahNumber),
            onTafsir: () => {
              setWordSheet(null);
              setTafsirAyah(wordSheet.ayahNumber);
            },
            onShare: () => {
              setWordSheet(null);
              setSharePreviewAyah(wordSheet.ayahNumber);
            },
            onCopy: () => handleCopyAyah(wordSheet.ayahNumber),
            copied: copiedAyah === wordSheet.ayahNumber,
            onClose: exitAyahMode,
          }}
          onRated={() => setHifzVersion((v) => v + 1)}
        />
      )}

      {/* Tafsir sheet for the selected ayah */}
      {tafsirAyah != null && surah && (
        <TafsirSheet
          surahNumber={surahNumber}
          ayahNumber={tafsirAyah}
          onClose={() => setTafsirAyah(null)}
        />
      )}

      {/* شرح حكم التجويد المضغوط عليه */}
      <TajweedRuleSheet rule={selectedRule} onClose={() => setSelectedRule(null)} />
    </div>
  );
}
