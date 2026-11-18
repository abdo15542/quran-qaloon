import { useState, useEffect, useCallback } from "react";
import { RECITERS, SURAHS, getGlobalAyahNumber, buildAyahAudioUrl } from "@/data/surahs";

const DB_NAME = "quran-offline-v1";
const STORE_NAME = "audio-cache";
const AYAH_STORE_NAME = "ayah-cache";
const DB_VERSION = 2;

export interface CachedAudio {
  key: string;
  surahNumber: number;
  surahName: string;
  reciterId: string;
  reciterName: string;
  size: number;
  cachedAt: number;
  duration?: number;
}

export interface DownloadProgress {
  key: string;
  progress: number;
  status: "idle" | "downloading" | "done" | "error";
  error?: string;
}

function getCacheKey(surahNumber: number, reciterId: string): string {
  return `${surahNumber}-${reciterId}`;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(AYAH_STORE_NAME)) {
        db.createObjectStore(AYAH_STORE_NAME, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getFromDB(key: string): Promise<{ blob: Blob; meta: CachedAudio } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function putInDB(
  key: string,
  blob: Blob,
  meta: CachedAudio
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ key, blob, meta });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteFromDB(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllMeta(): Promise<CachedAudio[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const results = (req.result as { meta: CachedAudio }[]).map((r) => r.meta);
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

async function clearAllDB(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- Per-ayah audio cache ----
// The offline cache used to store whole-surah blobs only, while
// tap-ayah plays per-ayah files — so tapping an ayah never worked
// offline even for a downloaded surah. Ayah files are cached here
// under `ayah-<reciterId>-<globalAyah>` (same DB, separate store).

export interface CachedAyah {
  key: string;
  reciterId: string;
  globalAyah: number;
  cachedAt: number;
}

function getAyahCacheKey(reciterId: string, globalAyah: number): string {
  return `ayah-${reciterId}-${globalAyah}`;
}

async function getFromAyahDB(key: string): Promise<{ blob: Blob; meta: CachedAyah } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AYAH_STORE_NAME, "readonly");
    const req = tx.objectStore(AYAH_STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function putInAyahDB(key: string, blob: Blob, meta: CachedAyah): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AYAH_STORE_NAME, "readwrite");
    tx.objectStore(AYAH_STORE_NAME).put({ key, blob, meta });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteFromAyahDB(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AYAH_STORE_NAME, "readwrite");
    tx.objectStore(AYAH_STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearAyahDB(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AYAH_STORE_NAME, "readwrite");
    tx.objectStore(AYAH_STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Download a surah's per-ayah files (best effort, sequential, abort
// aware). A failed ayah never fails the surah download — it is simply
// skipped and can be cached later when the ayah is played online.
async function downloadAyahFiles(
  reciterId: string,
  surahNumber: number,
  signal?: AbortSignal
): Promise<void> {
  const reciter = RECITERS.find((r) => r.id === reciterId);
  if (!reciter?.ayahAudioBase) return;
  const surah = SURAHS.find((s) => s.number === surahNumber);
  if (!surah) return;
  for (let a = 1; a <= surah.numberOfAyahs; a++) {
    if (signal?.aborted) return;
    const global = getGlobalAyahNumber(surahNumber, a);
    const key = getAyahCacheKey(reciterId, global);
    try {
      const existing = await getFromAyahDB(key);
      if (existing) continue;
    } catch {
      // fall through and fetch
    }
    try {
      const url = buildAyahAudioUrl(reciter, surahNumber, a);
      if (!url) continue;
      const res = await fetch(url, { signal });
      if (!res.ok) continue;
      const blob = await res.blob();
      await putInAyahDB(key, blob, { key, reciterId, globalAyah: global, cachedAt: Date.now() });
    } catch {
      if (signal?.aborted) return;
      // best effort — skip this ayah
    }
  }
}

const blobUrlCache = new Map<string, string>();
const ayahBlobUrlCache = new Map<string, string>();

export function useOfflineStorage() {
  const [cachedItems, setCachedItems] = useState<CachedAudio[]>([]);
  const [downloads, setDownloads] = useState<Map<string, DownloadProgress>>(new Map());
  const [isLoaded, setIsLoaded] = useState(false);

  const refreshCache = useCallback(async () => {
    try {
      const all = await getAllMeta();
      setCachedItems(all);
    } catch {
      setCachedItems([]);
    }
  }, []);

  useEffect(() => {
    refreshCache().finally(() => setIsLoaded(true));
  }, [refreshCache]);

  const isCached = useCallback(
    (surahNumber: number, reciterId: string): boolean => {
      const key = getCacheKey(surahNumber, reciterId);
      return cachedItems.some((c) => c.key === key);
    },
    [cachedItems]
  );

  const getCachedBlobUrl = useCallback(
    async (surahNumber: number, reciterId: string): Promise<string | null> => {
      const key = getCacheKey(surahNumber, reciterId);
      if (blobUrlCache.has(key)) return blobUrlCache.get(key)!;

      try {
        const entry = await getFromDB(key);
        if (!entry) return null;
        const url = URL.createObjectURL(entry.blob);
        blobUrlCache.set(key, url);
        return url;
      } catch {
        return null;
      }
    },
    []
  );

  const getCachedAyahUrl = useCallback(
    async (reciterId: string, globalAyah: number): Promise<string | null> => {
      const key = getAyahCacheKey(reciterId, globalAyah);
      if (ayahBlobUrlCache.has(key)) return ayahBlobUrlCache.get(key)!;
      try {
        const entry = await getFromAyahDB(key);
        if (!entry) return null;
        const url = URL.createObjectURL(entry.blob);
        ayahBlobUrlCache.set(key, url);
        return url;
      } catch {
        return null;
      }
    },
    []
  );

  // Cache one ayah file in the background (fire-and-forget): an ayah
  // heard online becomes playable offline afterwards.
  const cacheAyahAudio = useCallback(
    async (reciterId: string, globalAyah: number, url: string): Promise<boolean> => {
      const key = getAyahCacheKey(reciterId, globalAyah);
      try {
        const existing = await getFromAyahDB(key);
        if (existing) return true;
        const res = await fetch(url);
        if (!res.ok) return false;
        const blob = await res.blob();
        await putInAyahDB(key, blob, { key, reciterId, globalAyah, cachedAt: Date.now() });
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const downloadAudio = useCallback(
    async (
      surahNumber: number,
      surahName: string,
      reciterId: string,
      reciterName: string,
      audioUrl: string,
      signal?: AbortSignal
    ): Promise<boolean> => {
      const key = getCacheKey(surahNumber, reciterId);

      setDownloads((prev) => {
        const next = new Map(prev);
        next.set(key, { key, progress: 0, status: "downloading" });
        return next;
      });

      try {
        const response = await fetch(audioUrl, { signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const contentLength = Number(response.headers.get("content-length") ?? "0");
        const reader = response.body?.getReader();

        if (!reader) {
          const blob = await response.blob();
          const meta: CachedAudio = {
            key,
            surahNumber,
            surahName,
            reciterId,
            reciterName,
            size: blob.size,
            cachedAt: Date.now(),
          };
          await putInDB(key, blob, meta);
          if (blobUrlCache.has(key)) {
            URL.revokeObjectURL(blobUrlCache.get(key)!);
            blobUrlCache.delete(key);
          }
          // Tap-ayah needs the per-ayah files too, not just the surah file.
          await downloadAyahFiles(reciterId, surahNumber, signal);
          setDownloads((prev) => {
            const next = new Map(prev);
            next.set(key, { key, progress: 100, status: "done" });
            return next;
          });
          await refreshCache();
          return true;
        }

        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let received = 0;

        while (true) {
          if (signal?.aborted) throw new Error("Aborted");
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          if (contentLength > 0) {
            const progress = Math.round((received / contentLength) * 100);
            setDownloads((prev) => {
              const next = new Map(prev);
              next.set(key, { key, progress, status: "downloading" });
              return next;
            });
          }
        }

        const blob = new Blob(chunks, { type: "audio/mpeg" });
        const meta: CachedAudio = {
          key,
          surahNumber,
          surahName,
          reciterId,
          reciterName,
          size: blob.size,
          cachedAt: Date.now(),
        };
        await putInDB(key, blob, meta);
        if (blobUrlCache.has(key)) {
          URL.revokeObjectURL(blobUrlCache.get(key)!);
          blobUrlCache.delete(key);
        }
        // Tap-ayah needs the per-ayah files too, not just the surah file.
        await downloadAyahFiles(reciterId, surahNumber, signal);

        setDownloads((prev) => {
          const next = new Map(prev);
          next.set(key, { key, progress: 100, status: "done" });
          return next;
        });
        await refreshCache();
        return true;
      } catch (err) {
        const error = err instanceof Error ? err.message : "خطأ في التحميل";
        setDownloads((prev) => {
          const next = new Map(prev);
          next.set(key, { key, progress: 0, status: "error", error });
          return next;
        });
        return false;
      }
    },
    [refreshCache]
  );

  const deleteAudio = useCallback(
    async (surahNumber: number, reciterId: string): Promise<void> => {
      const key = getCacheKey(surahNumber, reciterId);
      if (blobUrlCache.has(key)) {
        URL.revokeObjectURL(blobUrlCache.get(key)!);
        blobUrlCache.delete(key);
      }
      await deleteFromDB(key);
      // Remove this surah's cached ayah files too.
      const surah = SURAHS.find((s) => s.number === surahNumber);
      if (surah) {
        const firstGlobal = getGlobalAyahNumber(surahNumber, 1);
        const keys: string[] = [];
        for (let a = 0; a < surah.numberOfAyahs; a++) {
          const g = firstGlobal + a;
          const ak = getAyahCacheKey(reciterId, g);
          if (ayahBlobUrlCache.has(ak)) {
            URL.revokeObjectURL(ayahBlobUrlCache.get(ak)!);
            ayahBlobUrlCache.delete(ak);
          }
          keys.push(ak);
        }
        await Promise.all(keys.map((k) => deleteFromAyahDB(k).catch(() => {})));
      }
      setDownloads((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      await refreshCache();
    },
    [refreshCache]
  );

  const clearAll = useCallback(async (): Promise<void> => {
    blobUrlCache.forEach((url) => URL.revokeObjectURL(url));
    blobUrlCache.clear();
    ayahBlobUrlCache.forEach((url) => URL.revokeObjectURL(url));
    ayahBlobUrlCache.clear();
    await clearAllDB();
    await clearAyahDB();
    setDownloads(new Map());
    await refreshCache();
  }, [refreshCache]);

  const getDownloadProgress = useCallback(
    (surahNumber: number, reciterId: string): DownloadProgress | null => {
      const key = getCacheKey(surahNumber, reciterId);
      return downloads.get(key) ?? null;
    },
    [downloads]
  );

  const totalStorageBytes = cachedItems.reduce((acc, c) => acc + c.size, 0);

  return {
    cachedItems,
    isLoaded,
    isCached,
    getCachedBlobUrl,
    getCachedAyahUrl,
    cacheAyahAudio,
    downloadAudio,
    deleteAudio,
    clearAll,
    getDownloadProgress,
    totalStorageBytes,
    refreshCache,
  };
}
