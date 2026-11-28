// Tap-ayah playback (1.0.116): one ayah from a whole-surah recording.
//
// The 7 Qaloon reciters have whole-surah mp3s only — no per-ayah files
// exist anywhere. Per-ayah timing tables (src/data/ayah-timings-qaloon.ts,
// built by scripts/compile-timings.mjs from the measured windows) give
// each ayah's [start, end] inside its surah's recording, so a tap seeks
// the shared whole-surah element to the ayah's start and stops at its
// end. Two stop mechanisms, both armed:
//   1. a timeupdate listener that pauses at `end` (the precise one), and
//   2. a wall-clock timer for (end - start) / rate + 2.5s grace — the
//      backup if timeupdate stalls (slow network, backgrounded tab).
// If a timing window is missing for an ayah/reciter, the ayah is played
// from an APPROXIMATE position instead — word-count-proportional inside
// the surah — and keeps playing to the end of the surah (whole-surah
// playback, never a wrong ayah cut): the caller is told via `notice`
// so the UI can say so plainly. The hook never pretends an approximate
// play is a timed one (`playing.timed`).
//
// [1.0.119] Two hardening rules, after the "reads the next ayah" report:
//   1. SEEK GATE: a bare `currentTime = start` can be ignored by the
//      WebView (element still playing, data not ready yet), and the audio
//      then plays from the wrong position. The seek is now verified by
//      reading currentTime back (within 0.5 s of start), retried up to 5
//      times, and playback starts ONLY after the read-back matches. If
//      the seek never lands, the session fails loudly instead of playing
//      the wrong ayah.
//   2. NO ADVANCE WITHOUT PLAY: a session that ends without its playhead
//      ever entering its window (seek overshot past the end, file ended
//      early) never calls onFinished, so the caller's continuous-play
//      (متواصل) cannot jump to the next ayah on a session that never
//      sounded its own ayah — the exact failure the user reported.
//
// One Audio element is shared for all tap-ayah plays (created lazily);
// the main whole-surah player (AudioPlayer/useAudio) is a different
// element — the caller pauses it via its pauseSignal when a tap starts.
import { useCallback, useEffect, useRef, useState } from "react";
import { getAyahTiming } from "@/data/ayah-timings-qaloon";
import { getSurahAyahs } from "@/data/quran-text";
import { getPlayerVolume, getPlayerRate } from "./useAudio";

export interface PlayingAyah {
  surah: number;
  ayah: number;
  reciterId: string;
  /** True when the play uses a measured timing window. */
  timed: boolean;
  start: number;
  /** Null for approximate playback (plays to the end of the surah). */
  end: number | null;
  repeat: number;
  repeatIndex: number;
}

export interface PlayAyahOptions {
  /** Whole-surah audio URL (network URL or offline blob) for this reciter. */
  url: string;
  reciterId: string;
  surah: number;
  ayah: number;
  /** How many times the ayah repeats (1 = once). Default 1. */
  repeat?: number;
  /** Called when the ayah (and its repeats) finish playing. */
  onFinished?: (finished: { surah: number; ayah: number }) => void;
}

interface Session {
  token: number;
  surah: number;
  ayah: number;
  reciterId: string;
  timed: boolean;
  start: number;
  end: number | null;
  repeat: number;
  repeatIndex: number;
  onFinished?: (finished: { surah: number; ayah: number }) => void;
  /** True once the playhead has been inside this session's window.
   * [1.0.119] onFinished fires only for sessions that actually sounded
   * their own ayah — see finishSession. */
  playedInside: boolean;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function useAyahAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const wallTimerRef = useRef<number | null>(null);
  const metaTimerRef = useRef<number | null>(null);
  const seekTimerRef = useRef<number | null>(null);
  const tokenRef = useRef(0);
  const [playing, setPlaying] = useState<PlayingAyah | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearWallTimer = useCallback(() => {
    if (wallTimerRef.current != null) {
      window.clearTimeout(wallTimerRef.current);
      wallTimerRef.current = null;
    }
  }, []);

  const clearMetaTimer = useCallback(() => {
    if (metaTimerRef.current != null) {
      window.clearTimeout(metaTimerRef.current);
      metaTimerRef.current = null;
    }
  }, []);

  const clearSeekTimer = useCallback(() => {
    if (seekTimerRef.current != null) {
      window.clearTimeout(seekTimerRef.current);
      seekTimerRef.current = null;
    }
  }, []);

  const finishSession = useCallback(
    (session: Session, reason: "ended" | "stopped") => {
      clearWallTimer();
      if (sessionRef.current === session) sessionRef.current = null;
      setPlaying(null);
      // [1.0.119] A session that ends without its playhead ever entering
      // its window never sounded its own ayah (seek overshot past the
      // end, or the file ended early) — do NOT call onFinished, or the
      // caller's continuous play (متواصل) would jump to the next ayah
      // and the user would hear only ayah+1. Only a session that played
      // inside its window may advance.
      if (reason === "ended" && session.playedInside)
        session.onFinished?.({ surah: session.surah, ayah: session.ayah });
    },
    [clearWallTimer]
  );

  const stop = useCallback(() => {
    clearWallTimer();
    clearMetaTimer();
    clearSeekTimer();
    tokenRef.current += 1;
    sessionRef.current = null;
    const audio = audioRef.current;
    if (audio) audio.pause();
    setPlaying(null);
  }, [clearWallTimer, clearMetaTimer, clearSeekTimer]);

  // One-time listeners on the shared element (attached on first use).
  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio();
    audio.preload = "metadata";
    audio.addEventListener("timeupdate", () => {
      const session = sessionRef.current;
      if (!session) return;
      // [1.0.119] Mark the session as having played inside its window
      // once the playhead is at/inside it (timed: [start, end);
      // approximate: [start, file end)). A session that never gets here
      // never sounded its own ayah — see finishSession.
      if (
        audio.currentTime >= session.start - 0.5 &&
        (session.end == null || audio.currentTime < session.end)
      ) {
        session.playedInside = true;
      }
      if (session.end == null) return;
      const end = session.end;
      // Stop just past the measured end so the last word is heard whole.
      if (audio.currentTime >= end - 0.03) {
        if (session.repeatIndex < session.repeat - 1) {
          // Repeat: back to the ayah's start (same session).
          const next = { ...session, repeatIndex: session.repeatIndex + 1 };
          sessionRef.current = next;
          setPlaying({
            surah: next.surah,
            ayah: next.ayah,
            reciterId: next.reciterId,
            timed: next.timed,
            start: next.start,
            end: next.end,
            repeat: next.repeat,
            repeatIndex: next.repeatIndex,
          });
          try {
            audio.currentTime = next.start;
          } catch {
            // not seekable — the wall-clock timer stops it instead
          }
          void audio.play().catch(() => undefined);
          // Re-arm the wall-clock backup for this repeat.
          clearWallTimer();
          wallTimerRef.current = window.setTimeout(
            () => finishSession(next, "ended"),
            ((end - next.start) / Math.max(0.25, getPlayerRate()) + 2.5) * 1000
          );
        } else {
          audio.pause();
          finishSession(session, "ended");
        }
      }
    });
    audio.addEventListener("ended", () => {
      const session = sessionRef.current;
      if (!session) return;
      audio.pause();
      finishSession(session, "ended");
    });
    audio.addEventListener("error", () => {
      const session = sessionRef.current;
      if (!session) return;
      clearWallTimer();
      sessionRef.current = null;
      setPlaying(null);
      setError("تعذّر تشغيل صوت الآية");
    });
    audioRef.current = audio;
    return audio;
  }, [clearWallTimer, finishSession]);

  const playAyah = useCallback(
    (opts: PlayAyahOptions) => {
      const repeat = opts.repeat && opts.repeat > 0 ? Math.min(5, Math.floor(opts.repeat)) : 1;
      stop();
      setError(null);
      setNotice(null);
      const audio = ensureAudio();
      audio.volume = getPlayerVolume();
      audio.playbackRate = getPlayerRate();
      const token = ++tokenRef.current;
      const timing = getAyahTiming(opts.reciterId, opts.surah, opts.ayah);

      const startPlayback = () => {
        if (token !== tokenRef.current) return; // superseded / stopped
        const duration = audio.duration;
        let start: number;
        let end: number | null;
        let timed: boolean;
        if (timing) {
          start = timing.start;
          end = timing.end;
          timed = true;
        } else {
          // Approximate fallback: word-count-proportional position in
          // the surah, then play to the end of the surah. Never cut at
          // a guessed end — that could play the wrong ayah.
          const ayahs = getSurahAyahs(opts.surah);
          const totalWords = ayahs.reduce((n, a) => n + wordCount(a.text), 0);
          const wordsBefore = ayahs
            .slice(0, Math.max(0, opts.ayah - 1))
            .reduce((n, a) => n + wordCount(a.text), 0);
          start = isFinite(duration) && duration > 0 && totalWords > 0
            ? (wordsBefore / totalWords) * duration
            : 0;
          end = null;
          timed = false;
          setNotice("التوقيت الدقيق لهذه الآية غير متوفر بعد — يُشغَّل من موضع تقريبي حتى نهاية السورة");
        }
        // Clamp inside the file (a measured start past a truncated
        // download would otherwise throw / end instantly).
        if (isFinite(duration) && duration > 0) {
          start = Math.min(Math.max(0, start), Math.max(0, duration - 0.5));
          if (end != null) end = Math.min(end, duration);
        }
        const session: Session = {
          token,
          surah: opts.surah,
          ayah: opts.ayah,
          reciterId: opts.reciterId,
          timed,
          start,
          end,
          repeat,
          repeatIndex: 0,
          onFinished: opts.onFinished,
          playedInside: false,
        };
        sessionRef.current = session;
        // [1.0.119] SEEK GATE: verify the seek lands before playing.
        // A bare `currentTime = start` can be ignored by the WebView
        // (element still playing, data not ready yet) — the audio would
        // then play from the wrong position. Read currentTime back: if
        // it is within 0.5 s of start, play; otherwise re-seek, up to 5
        // attempts; if it never lands, fail loudly through the existing
        // error path instead of playing the wrong ayah.
        const SEEK_TOLERANCE = 0.5;
        const MAX_SEEK_ATTEMPTS = 5;
        let seekAttempts = 0;
        const beginPlay = () => {
          setPlaying({
            surah: session.surah,
            ayah: session.ayah,
            reciterId: session.reciterId,
            timed: session.timed,
            start: session.start,
            end: session.end,
            repeat: session.repeat,
            repeatIndex: 0,
          });
          void audio.play().catch(() => {
            if (token !== tokenRef.current) return;
            sessionRef.current = null;
            setPlaying(null);
            setError("تعذّر تشغيل الصوت، جرّب إعادة المحاولة");
          });
          if (end != null) {
            clearWallTimer();
            wallTimerRef.current = window.setTimeout(
              () => {
                const s = sessionRef.current;
                if (s && s.token === token) {
                  audio.pause();
                  finishSession(s, "ended");
                }
              },
              ((end - start) / Math.max(0.25, getPlayerRate()) + 2.5) * 1000
            );
          }
        };
        const failSeek = () => {
          if (token !== tokenRef.current) return;
          sessionRef.current = null;
          setPlaying(null);
          setError("تعذّر تشغيل الصوت");
        };
        const attemptSeek = () => {
          if (token !== tokenRef.current) return;
          if (Math.abs(audio.currentTime - start) <= SEEK_TOLERANCE) {
            beginPlay();
            return;
          }
          seekAttempts += 1;
          if (seekAttempts > MAX_SEEK_ATTEMPTS) {
            failSeek();
            return;
          }
          try {
            audio.currentTime = start;
          } catch {
            // not seekable yet — the retry below tries again
          }
          clearSeekTimer();
          seekTimerRef.current = window.setTimeout(attemptSeek, 250);
        };
        attemptSeek();
      };

      const needsLoad = audio.src !== opts.url || audio.readyState < 1;
      if (needsLoad) {
        audio.src = opts.url;
        const onMeta = () => {
          clearMetaTimer();
          startPlayback();
        };
        audio.addEventListener("loadedmetadata", onMeta, { once: true });
        // If metadata never arrives (dead network), fail loudly
        // instead of hanging on a silent play button.
        metaTimerRef.current = window.setTimeout(() => {
          audio.removeEventListener("loadedmetadata", onMeta);
          if (token !== tokenRef.current) return;
          sessionRef.current = null;
          setPlaying(null);
          setError("تعذّر تحميل الملف الصوتي");
        }, 15000);
      } else {
        startPlayback();
      }
    },
    [stop, ensureAudio, clearWallTimer, clearMetaTimer, clearSeekTimer, finishSession]
  );

  const clearNotice = useCallback(() => setNotice(null), []);
  const clearError = useCallback(() => setError(null), []);

  useEffect(
    () => () => {
      clearWallTimer();
      clearMetaTimer();
      clearSeekTimer();
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
      }
    },
    [clearWallTimer, clearMetaTimer, clearSeekTimer]
  );

  return { playing, notice, error, playAyah, stop, clearNotice, clearError };
}
