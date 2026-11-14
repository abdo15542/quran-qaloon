import { useState, useEffect, useCallback } from "react";

const DB_NAME = "quran-offline-v1";
const STORE_NAME = "audio-cache";
const DB_VERSION = 1;

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

const blobUrlCache = new Map<string, string>();

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

  const downloadAudio = useCallback(
    async (
      surahNumber: number,
      surahName: string,
      reciterId: string,
      reciterName: string,
      audioUrl: string
    ): Promise<void> => {
      const key = getCacheKey(surahNumber, reciterId);

      setDownloads((prev) => {
        const next = new Map(prev);
        next.set(key, { key, progress: 0, status: "downloading" });
        return next;
      });

      try {
        const response = await fetch(audioUrl);
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
          setDownloads((prev) => {
            const next = new Map(prev);
            next.set(key, { key, progress: 100, status: "done" });
            return next;
          });
          await refreshCache();
          return;
        }

        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let received = 0;

        while (true) {
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

        setDownloads((prev) => {
          const next = new Map(prev);
          next.set(key, { key, progress: 100, status: "done" });
          return next;
        });
        await refreshCache();
      } catch (err) {
        const error = err instanceof Error ? err.message : "خطأ في التحميل";
        setDownloads((prev) => {
          const next = new Map(prev);
          next.set(key, { key, progress: 0, status: "error", error });
          return next;
        });
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
    await clearAllDB();
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
    downloadAudio,
    deleteAudio,
    clearAll,
    getDownloadProgress,
    totalStorageBytes,
    refreshCache,
  };
}
