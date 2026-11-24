import { useCallback } from "react";

const STORAGE_KEY = "quran_listening_progress";

export interface SurahProgress {
  surahNumber: number;
  reciterId?: string;
  currentTime: number;
  duration: number;
  updatedAt: number;
}

// Progress used to be keyed by surah number only, so switching reciter
// resumed at the wrong position in a different recording. Since 1.0.64
// the key is `<surah>-<reciterId>`; entries saved before that (plain
// surah number) are read only for the default reciter (hudhaify-qaloon).
type ProgressMap = Record<string, SurahProgress>;

function loadAll(): ProgressMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(data: ProgressMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

const DEFAULT_RECITER_ID = "hudhaify-qaloon";

function keyFor(surahNumber: number, reciterId?: string): string {
  return reciterId ? `${surahNumber}-${reciterId}` : String(surahNumber);
}

export function useListeningProgress() {
  const getProgress = useCallback(
    (surahNumber: number, reciterId?: string): SurahProgress | null => {
      const all = loadAll();
      if (reciterId) {
        const keyed = all[keyFor(surahNumber, reciterId)];
        if (keyed) return keyed;
        if (reciterId === DEFAULT_RECITER_ID) return all[String(surahNumber)] ?? null;
        return null;
      }
      return all[String(surahNumber)] ?? null;
    },
    []
  );

  const saveProgress = useCallback(
    (surahNumber: number, currentTime: number, duration: number, reciterId?: string) => {
      if (!duration || currentTime < 2) return;
      const all = loadAll();
      const key = keyFor(surahNumber, reciterId);
      const percent = currentTime / duration;
      if (percent >= 0.98) {
        delete all[key];
        // A finished surah must not resurrect its legacy position.
        if (reciterId === DEFAULT_RECITER_ID) delete all[String(surahNumber)];
      } else {
        all[key] = {
          surahNumber,
          reciterId,
          currentTime,
          duration,
          updatedAt: Date.now(),
        };
        // Migrate the legacy entry the first time a keyed position is
        // saved for the default reciter.
        if (reciterId === DEFAULT_RECITER_ID) delete all[String(surahNumber)];
      }
      saveAll(all);
    },
    []
  );

  const clearProgress = useCallback((surahNumber: number, reciterId?: string) => {
    const all = loadAll();
    delete all[keyFor(surahNumber, reciterId)];
    if (reciterId === DEFAULT_RECITER_ID) delete all[String(surahNumber)];
    saveAll(all);
  }, []);

  // One entry per surah (the most recently listened reciter's), for
  // the "in progress" lists — the raw map can hold the same surah
  // under two reciters.
  const getAllProgress = useCallback((): Record<number, SurahProgress> => {
    const all = loadAll();
    const bySurah: Record<number, SurahProgress> = {};
    for (const entry of Object.values(all)) {
      const prev = bySurah[entry.surahNumber];
      if (!prev || entry.updatedAt > prev.updatedAt) bySurah[entry.surahNumber] = entry;
    }
    return bySurah;
  }, []);

  return { getProgress, saveProgress, clearProgress, getAllProgress };
}
