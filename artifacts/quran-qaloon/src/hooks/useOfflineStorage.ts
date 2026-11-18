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

// One shared IndexedDB connection: opening a new connection per
// operation (~12,000 opens in a full-Quran download) is wasteful and
// risks hitting the browser's connection limit.
let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
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
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
    req.onblocked = () => {
      dbPromise = null;
      reject(new Error("IndexedDB blocked"));
    };
  });
  return dbPromise;
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
  /** Size of the cached ayah file in bytes (for the storage meter). */
  size: number;
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

async function getAllAyahKeys(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AYAH_STORE_NAME, "readonly");
    const req = tx.objectStore(AYAH_STORE_NAME).getAllKeys();
    req.onsuccess = () => resolve((req.result as IDBValidKey[]).map(String));
    req.onerror = () => reject(req.error);
  });
}

// Total bytes held by the ayah store. The blob size is read from the
// stored record itself, so even ayah files cached before 1.0.64 (whose
// meta has no size) are counted exactly.
async function getAllAyahBytes(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AYAH_STORE_NAME, "readonly");
    const req = tx.objectStore(AYAH_STORE_NAME).getAll();
    req.onsuccess = () => {
      const rows = req.result as { blob?: Blob; meta?: CachedAyah }[];
      resolve(rows.reduce((acc, r) => acc + (r.blob?.size ?? r.meta?.size ?? 0), 0));
    };
    req.onerror = () => reject(req.error);
  });
}

// Download a surah's per-ayah files (best effort, abort aware, 6 in
// flight at a time). A failed ayah never fails the surah download — it
// is simply skipped and can be cached later when the ayah is played
// online. Sequential fetching froze the progress bar at 99% for minutes
// on long surahs (6,236 fetches for a full Quran), so the ayah phase
// runs concurrently and reports its own progress.
async function downloadAyahFiles(
  reciterId: string,
  surahNumber: number,
  signal?: AbortSignal,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const reciter = RECITERS.find((r) => r.id === reciterId);
  if (!reciter || !reciter.ayahAudioBase) return;
  // Capture the narrowed reciter in a fresh const: a hoisted function
  // declaration sees only the declared (nullable) type of `reciter`.
  const reciterForAyahs = reciter;
  const surah = SURAHS.find((s) => s.number === surahNumber);
  if (!surah) return;
  const total = surah.numberOfAyahs;
  let done = 0;
  const CONCURRENCY = 6;
  let next = 1;
  async function worker(): Promise<void> {
    while (true) {
      if (signal?.aborted) return;
      const a = next++;
      if (a > total) return;
      const global = getGlobalAyahNumber(surahNumber, a);
      const key = getAyahCacheKey(reciterId, global);
      try {
        const existing = await getFromAyahDB(key);
        if (!existing) {
          const url = buildAyahAudioUrl(reciterForAyahs, surahNumber, a);
          if (url) {
            const res = await fetch(url, { signal });
            if (res.ok) {
              const blob = await res.blob();
              if (blob.size === 0) continue;
              await putInAyahDB(key, blob, {
                key,
                reciterId,
                globalAyah: global,
                size: blob.size,
                cachedAt: Date.now(),
              });
            }
          }
        }
      } catch {
        if (signal?.aborted) return;
        // best effort — skip this ayah
      }
      done++;
      onProgress?.(done, total);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker())
  );
}

const blobUrlCache = new Map<string, string>();
const ayahBlobUrlCache = new Map<string, string>();

export function useOfflineStorage() {
  const [cachedItems, setCachedItems] = useState<CachedAudio[]>([]);
  const [downloads, setDownloads] = useState<Map<string, DownloadProgress>>(new Map());
  const [isLoaded, setIsLoaded] = useState(false);
  const [ayahStorageBytes, setAyahStorageBytes] = useState(0);

  const refreshCache = useCallback(async () => {
    try {
      const all = await getAllMeta();
      setCachedItems(all);
    } catch {
      setCachedItems([]);
    }
    try {
      setAyahStorageBytes(await getAllAyahBytes());
    } catch {
      setAyahStorageBytes(0);
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
        // A zero-byte entry (an interrupted download that slipped
        // through) is a cache miss, not a playable file — evict it so
        // the player falls back to the network and a re-download can
        // store a real file.
        if (entry.blob.size === 0) {
          await deleteFromDB(key).catch(() => undefined);
          return null;
        }
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
        if (entry.blob.size === 0) {
          await deleteFromAyahDB(key).catch(() => undefined);
          return null;
        }
        const url = URL.createObjectURL(entry.blob);
        // Cap the cache: blob URLs are never revoked while cached, so
        // an unbounded map leaks one URL per tapped ayah.
        if (ayahBlobUrlCache.size >= 100) {
          const oldest = ayahBlobUrlCache.keys().next().value;
          if (oldest !== undefined) {
            URL.revokeObjectURL(ayahBlobUrlCache.get(oldest)!);
            ayahBlobUrlCache.delete(oldest);
          }
        }
        ayahBlobUrlCache.set(key, url);
        return url;
      } catch {
        return null;
      }
    },
    []
  );

  // All cached ayah keys (one getAllKeys): the Downloads page uses it
  // to tell whether a surah's ayah files are complete, so an
  // interrupted ayah phase is repaired instead of skipped.
  const getCachedAyahKeys = useCallback(async (): Promise<Set<string>> => {
    try {
      return new Set(await getAllAyahKeys());
    } catch {
      return new Set<string>();
    }
  }, []);

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
        await putInAyahDB(key, blob, { key, reciterId, globalAyah, size: blob.size, cachedAt: Date.now() });
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
      // Progress is split across the two phases: the surah file is
      // 0–70%, the per-ayah files 70–100% — before this the bar froze
      // at the surah-phase percentage for minutes while the ayahs
      // downloaded.
      const setProgress = (p: number) => {
        setDownloads((prev) => {
          const next = new Map(prev);
          next.set(key, { key, progress: Math.min(99, Math.max(0, Math.round(p))), status: "downloading" });
          return next;
        });
      };
      const reportAyahProgress = (done: number, total: number) => {
        if (total > 0) setProgress(70 + (done / total) * 30);
      };

      try {
        const response = await fetch(audioUrl, { signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        // A 200 with an error page (HTML) instead of audio must not be
        // stored as a "downloaded" surah that then fails to play.
        const contentType = response.headers.get("content-type") ?? "";
        if (!/^(audio\/|application\/octet-stream)/i.test(contentType)) {
          throw new Error(`Unexpected content-type: ${contentType}`);
        }

        const contentLength = Number(response.headers.get("content-length") ?? "0");
        const reader = response.body?.getReader();

        if (!reader) {
          const blob = await response.blob();
          if (blob.size === 0) throw new Error("Empty audio file");
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
          setProgress(70);
          await downloadAyahFiles(reciterId, surahNumber, signal, reportAyahProgress);
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
            setProgress((received / contentLength) * 70);
          }
        }

        const blob = new Blob(chunks, { type: "audio/mpeg" });
        if (blob.size === 0) throw new Error("Empty audio file");
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
        setProgress(70);
        await downloadAyahFiles(reciterId, surahNumber, signal, reportAyahProgress);

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

  // The storage meter: surah files + the per-ayah files, which used
  // to be invisible here even though they are the bulk of the cache
  // (~400 MB for a full Quran).
  const totalStorageBytes =
    cachedItems.reduce((acc, c) => acc + c.size, 0) + ayahStorageBytes;

  return {
    cachedItems,
    isLoaded,
    isCached,
    getCachedBlobUrl,
    getCachedAyahUrl,
    getCachedAyahKeys,
    cacheAyahAudio,
    downloadAudio,
    deleteAudio,
    clearAll,
    getDownloadProgress,
    totalStorageBytes,
    refreshCache,
  };
}
