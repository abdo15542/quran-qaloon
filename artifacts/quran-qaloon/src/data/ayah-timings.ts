// Exact ayah start times (seconds) per reciter and surah, measured
// from the reciter's own surah recordings.
// EMPTY since 1.0.35: the seven kept reciters all have per-ayah MP3s,
// so tap-ayah never needs a timing table (the per-ayah branch in
// SurahPlayer runs first and getAyahTimings is never consulted).
// The tables of the removed reciters (4 Qaloon + 9 others) are gone
// from this file; their measured sources are preserved on disk under
// ayah-timings/*.json and can be regenerated with make_timings_ts.py
// if a reciter is ever restored.
// Ayah i plays from s[i] to s[i+1], or to d (the file
// duration) for the last ayah.

export interface AyahTimings {
  d: number;
  s: number[];
}

export const AYAH_TIMINGS: Record<string, (AyahTimings | null)[]> = {};

/** Exact timings for this reciter+surah, or null (use the estimate). */
export function getAyahTimings(reciterId: string, surahNumber: number): AyahTimings | null {
  const list = AYAH_TIMINGS[reciterId];
  if (!list) return null;
  return list[surahNumber - 1] ?? null;
}
