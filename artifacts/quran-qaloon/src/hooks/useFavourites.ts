import { useState, useCallback } from "react";

const STORAGE_KEY = "quran_favourites";

export interface FavouriteAyah {
  surah: number;
  ayah: number;
  addedAt: number;
}

function load(): FavouriteAyah[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (f) =>
            f &&
            typeof f.surah === "number" &&
            typeof f.ayah === "number" &&
            f.surah >= 1 &&
            f.surah <= 114 &&
            f.ayah >= 1
        );
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function save(list: FavouriteAyah[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function useFavourites() {
  const [favourites, setFavourites] = useState<FavouriteAyah[]>(load);

  const isFavourite = useCallback(
    (surah: number, ayah: number) =>
      favourites.some((f) => f.surah === surah && f.ayah === ayah),
    [favourites]
  );

  const addFavourite = useCallback((surah: number, ayah: number) => {
    setFavourites((prev) => {
      if (prev.some((f) => f.surah === surah && f.ayah === ayah)) return prev;
      const next = [...prev, { surah, ayah, addedAt: Date.now() }];
      save(next);
      return next;
    });
  }, []);

  const removeFavourite = useCallback((surah: number, ayah: number) => {
    setFavourites((prev) => {
      const next = prev.filter((f) => !(f.surah === surah && f.ayah === ayah));
      save(next);
      return next;
    });
  }, []);

  const toggleFavourite = useCallback(
    (surah: number, ayah: number) => {
      if (isFavourite(surah, ayah)) removeFavourite(surah, ayah);
      else addFavourite(surah, ayah);
    },
    [isFavourite, addFavourite, removeFavourite]
  );

  return {
    favourites,
    count: favourites.length,
    isFavourite,
    addFavourite,
    removeFavourite,
    toggleFavourite,
  };
}
