import { useState, useCallback } from "react";

const STORAGE_KEY = "quran_khatma";

export interface KhatmaData {
  completedSurahs: number[];
  startedAt: number;
  lastUpdatedAt: number;
}

function load(): KhatmaData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { completedSurahs: [], startedAt: Date.now(), lastUpdatedAt: Date.now() };
}

function save(data: KhatmaData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function useKhatma() {
  const [data, setData] = useState<KhatmaData>(load);

  const markCompleted = useCallback((surahNumber: number) => {
    setData((prev) => {
      if (prev.completedSurahs.includes(surahNumber)) return prev;
      const next: KhatmaData = {
        ...prev,
        completedSurahs: [...prev.completedSurahs, surahNumber],
        lastUpdatedAt: Date.now(),
      };
      save(next);
      return next;
    });
  }, []);

  const markUncompleted = useCallback((surahNumber: number) => {
    setData((prev) => {
      const next: KhatmaData = {
        ...prev,
        completedSurahs: prev.completedSurahs.filter((n) => n !== surahNumber),
        lastUpdatedAt: Date.now(),
      };
      save(next);
      return next;
    });
  }, []);

  const resetKhatma = useCallback(() => {
    const fresh: KhatmaData = {
      completedSurahs: [],
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
    };
    save(fresh);
    setData(fresh);
  }, []);

  const isCompleted = useCallback(
    (surahNumber: number) => data.completedSurahs.includes(surahNumber),
    [data.completedSurahs]
  );

  return {
    completedSurahs: data.completedSurahs,
    startedAt: data.startedAt,
    lastUpdatedAt: data.lastUpdatedAt,
    markCompleted,
    markUncompleted,
    resetKhatma,
    isCompleted,
    totalCompleted: data.completedSurahs.length,
    isKhatmaComplete: data.completedSurahs.length === 114,
  };
}
