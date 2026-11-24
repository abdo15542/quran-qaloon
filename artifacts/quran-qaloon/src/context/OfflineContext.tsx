import { createContext, useContext, ReactNode } from "react";
import { useOfflineStorage, CachedAudio, DownloadProgress } from "@/hooks/useOfflineStorage";

interface OfflineContextValue {
  cachedItems: CachedAudio[];
  isLoaded: boolean;
  isCached: (surahNumber: number, reciterId: string) => boolean;
  getCachedBlobUrl: (surahNumber: number, reciterId: string) => Promise<string | null>;
  downloadAudio: (
    surahNumber: number,
    surahName: string,
    reciterId: string,
    reciterName: string,
    audioUrl: string,
    signal?: AbortSignal
  ) => Promise<boolean>;
  deleteAudio: (surahNumber: number, reciterId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  getDownloadProgress: (surahNumber: number, reciterId: string) => DownloadProgress | null;
  totalStorageBytes: number;
  refreshCache: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const value = useOfflineStorage();
  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used within OfflineProvider");
  return ctx;
}
