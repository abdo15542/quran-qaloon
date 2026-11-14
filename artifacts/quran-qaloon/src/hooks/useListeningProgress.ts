import { useCallback } from "react";

const STORAGE_KEY = "quran_listening_progress";

export interface SurahProgress {
  surahNumber: number;
  currentTime: number;
  duration: number;
  updatedAt: number;
}

function loadAll(): Record<number, SurahProgress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(data: Record<number, SurahProgress>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function useListeningProgress() {
  const getProgress = useCallback((surahNumber: number): SurahProgress | null => {
    const all = loadAll();
    return all[surahNumber] ?? null;
  }, []);

  const saveProgress = useCallback(
    (surahNumber: number, currentTime: number, duration: number) => {
      if (!duration || currentTime < 2) return;
      const all = loadAll();
      const percent = currentTime / duration;
      if (percent >= 0.98) {
        delete all[surahNumber];
      } else {
        all[surahNumber] = {
          surahNumber,
          currentTime,
          duration,
          updatedAt: Date.now(),
        };
      }
      saveAll(all);
    },
    []
  );

  const clearProgress = useCallback((surahNumber: number) => {
    const all = loadAll();
    delete all[surahNumber];
    saveAll(all);
  }, []);

  const getAllProgress = useCallback((): Record<number, SurahProgress> => {
    return loadAll();
  }, []);

  return { getProgress, saveProgress, clearProgress, getAllProgress };
}
