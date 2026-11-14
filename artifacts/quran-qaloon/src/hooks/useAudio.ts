import { useState, useRef, useEffect, useCallback } from "react";

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

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  const [state, setState] = useState<AudioState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    isLoading: false,
    error: null,
    volume: 1,
    playbackRate: 1,
  });

  useEffect(() => {
    initialTimeRef.current = initialTime;
  }, [initialTime]);

  useEffect(() => {
    if (!url) return;

    const audio = new Audio();
    audio.preload = "metadata";
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
        audio.currentTime = initialTimeRef.current;
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
    audioRef.current.currentTime = time;
    setState((s) => ({ ...s, currentTime: time }));
  }, []);

  const setVolume = useCallback((vol: number) => {
    if (!audioRef.current) return;
    audioRef.current.volume = vol;
    setState((s) => ({ ...s, volume: vol }));
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = rate;
    setState((s) => ({ ...s, playbackRate: rate }));
  }, []);

  return { state, play, pause, toggle, seek, setVolume, setPlaybackRate };
}
