import { useState, useRef, useEffect, useCallback } from "react";

// The player's volume and speed are persisted (and shared with the
// tap-ayah audio): without this, muting and then opening another surah
// created a brand-new Audio element at full volume / 1× while the UI
// still showed muted / 1.5×.
const VOLUME_KEY = "quran_player_volume";
const RATE_KEY = "quran_player_rate";

function readStoredNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

/** The persisted player volume (0–1), shared with the tap-ayah audio. */
export function getPlayerVolume(): number {
  return Math.min(1, Math.max(0, readStoredNumber(VOLUME_KEY, 1)));
}

/** The persisted player speed, shared with the tap-ayah audio. */
export function getPlayerRate(): number {
  const r = readStoredNumber(RATE_KEY, 1);
  return r > 0 ? r : 1;
}

export interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  error: string | null;
  volume: number;
  playbackRate: number;
}

export function useAudio(
  url: string | null,
  initialTime = 0,
  onProgress?: (currentTime: number, duration: number) => void,
  onFinished?: () => void,
  retryKey = 0
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initialTimeRef = useRef(initialTime);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onFinishedRef = useRef(onFinished);
  // The persisted volume/speed, applied to every new Audio element
  // (a new element is created on each surah/reciter change).
  const volumeRef = useRef(getPlayerVolume());
  const rateRef = useRef(getPlayerRate());

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  const [state, setState] = useState<AudioState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    isLoading: false,
    error: null,
    volume: volumeRef.current,
    playbackRate: rateRef.current,
  });

  useEffect(() => {
    initialTimeRef.current = initialTime;
  }, [initialTime]);

  useEffect(() => {
    if (!url) return;

    const audio = new Audio();
    audio.preload = "metadata";
    // Apply the persisted volume/speed to every new element — the
    // element is recreated on each surah/reciter change, and without
    // this a muted player would play the next surah at full volume.
    audio.volume = volumeRef.current;
    audio.playbackRate = rateRef.current;
    audioRef.current = audio;

    setState((s) => ({
      ...s,
      isLoading: true,
      error: null,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
    }));

    const handleLoadedMetadata = () => {
      if (initialTimeRef.current > 0) {
        // The saved position belongs to a different recording when the
        // reciter changed: if it is past this file's length, start
        // from the beginning instead of seeking to the end and
        // instantly firing "ended" (which would falsely mark the
        // surah complete without playing anything).
        if (
          isFinite(audio.duration) &&
          audio.duration > 0 &&
          initialTimeRef.current < audio.duration
        ) {
          audio.currentTime = initialTimeRef.current;
        }
      }
      setState((s) => ({ ...s, duration: audio.duration, isLoading: false }));
    };

    const handleTimeUpdate = () => {
      setState((s) => ({ ...s, currentTime: audio.currentTime }));
    };

    const handleEnded = () => {
      setState((s) => ({ ...s, isPlaying: false, currentTime: 0 }));
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      onFinishedRef.current?.();
    };

    const handleError = () => {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: "تعذّر تحميل الملف الصوتي",
        isPlaying: false,
      }));
    };

    const handleCanPlay = () => {
      setState((s) => ({ ...s, isLoading: false }));
    };

    const handlePlay = () => {
      setState((s) => ({ ...s, isPlaying: true }));
      if (onProgress) {
        progressTimerRef.current = setInterval(() => {
          if (audioRef.current) {
            onProgress(audioRef.current.currentTime, audioRef.current.duration);
          }
        }, 5000);
      }
    };

    const handlePause = () => {
      setState((s) => ({ ...s, isPlaying: false }));
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      if (onProgress && audioRef.current) {
        onProgress(audioRef.current.currentTime, audioRef.current.duration);
      }
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    audio.src = url;

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      audio.pause();
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.src = "";
      audioRef.current = null;
    };
  }, [url, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const play = useCallback(async () => {
    if (!audioRef.current) return;
    try {
      await audioRef.current.play();
    } catch {
      setState((s) => ({ ...s, error: "تعذّر تشغيل الصوت، جرّب إعادة المحاولة" }));
    }
  }, []);

  const pause = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
  }, []);

  const toggle = useCallback(() => {
    if (state.isPlaying) pause();
    else play();
  }, [state.isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    // Setting currentTime before any metadata is loaded throws
    // InvalidStateError — guard it; the seek is simply lost.
    try {
      if (audioRef.current.readyState >= 1) audioRef.current.currentTime = time;
    } catch {
      // not seekable yet — ignore
    }
    setState((s) => ({ ...s, currentTime: time }));
  }, []);

  const setVolume = useCallback((vol: number) => {
    const v = Math.min(1, Math.max(0, vol));
    volumeRef.current = v;
    try {
      localStorage.setItem(VOLUME_KEY, String(v));
    } catch {
      // storage unavailable
    }
    if (audioRef.current) audioRef.current.volume = v;
    setState((s) => ({ ...s, volume: v }));
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const r = rate > 0 ? rate : 1;
    rateRef.current = r;
    try {
      localStorage.setItem(RATE_KEY, String(r));
    } catch {
      // storage unavailable
    }
    if (audioRef.current) audioRef.current.playbackRate = r;
    setState((s) => ({ ...s, playbackRate: r }));
  }, []);

  return { state, play, pause, toggle, seek, setVolume, setPlaybackRate };
}
