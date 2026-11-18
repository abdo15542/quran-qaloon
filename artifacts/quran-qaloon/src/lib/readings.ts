// مقارنة الروايات — حفص عن عاصم / قالون عن نافع / ورش عن نافع.
// 1.0.74 feature 3. Offline only: all three texts are bundled
// (Hafs in quran-text.ts, Qaloon in quran-text-qaloon.ts, Warsh in
// warsh-text.ts). No network, no new dependencies.
//
// Numbering — read this before touching the Warsh lookup:
// - Hafs and Qaloon share the SAME numbering: 6,236 ayahs. A Qaloon
//   ayah is looked up by the same (surah, ayah) as Hafs.
// - Warsh uses Madani numbering: 6,214 ayahs, and 50 of 114 surahs
//   have a different ayah count than Hafs (e.g. Al-Kahf 105 vs 110,
//   Al-Ma'idah 122 vs 120). A Warsh verse is therefore found ONLY
//   through its `h` field (number_in_hafs): the Warsh verse(s) whose
//   `h` includes this Hafs ayah number. NEVER assume verse N of Warsh
//   is ayah N of Hafs — it usually is not (e.g. Hafs 2:58 is Warsh
//   2:57, Hafs 2:184 is Warsh 2:183).
// - 78 Warsh verses span 2+ Hafs ayahs (e.g. Warsh 1:1 <-> Hafs
//   1:1+1:2). When that happens getReadings returns the FULL Warsh
//   verse text with its hafsSpan, and the UI must say so plainly —
//   never silently truncate the verse to the requested ayah.
// - The reverse also happens: 59 Hafs ayahs are SPLIT across two
//   Warsh verses in the source (e.g. Hafs 1:7 is Warsh 1:6+1:7, Hafs
//   2:255 is Warsh 2:253+2:254). Then getReadings returns the two
//   verses joined, with warshVerses listing both, and the UI must
//   say so plainly too. Either way, no 1:1 alignment is ever forced.
// - The Basmala is not inside any Warsh verse text (the two «بِسْمِ»
//   hits in the source are mid-ayah words, 11:41 and 27:30). For ayah
//   1 of a surah (except 9) the Basmala is prepended to the displayed
//   Warsh text, same as the bundled Hafs text carries it.
// - 13 Qaloon ayahs (and 13 Warsh verses) carry a mid-ayah U+200F
//   (RLM). It is stripped from every text returned here so display
//   and comparison never see it; the bundled data files are untouched.

import { BASMALA, getAyah, normalizeArabic } from "@/data/quran-text";
import { WARSH_TEXT } from "@/data/warsh-text";

/** Total ayahs in the Hafs numbering the app uses everywhere. */
export const HAFS_AYAH_COUNT = 6236;
/** Total ayahs in the Madani numbering Warsh (and printed Libyan mushafs) use. */
export const WARSH_AYAH_COUNT = 6214;

/** Right-to-left mark (U+200F) — stripped from displayed/compared text. */
export const RLM = "\u200F";

/** Strip U+200F (RLM) from a text. Local to this module. */
export function stripRlm(text: string): string {
  return text.replace(/\u200F/g, "");
}

export interface WarshReading {
  /** Display text of the Warsh verse(s) covering this Hafs ayah
      (Basmala prepended for ayah 1, surah != 9; when one Hafs ayah
      is split across two Warsh verses, both texts joined with a space). */
  text: string;
  /** The first Warsh verse number (Madani numbering). */
  warshVerse: number;
  /** All Warsh verse numbers covering this Hafs ayah (1 normally, 2 when split). */
  warshVerses: number[];
  /** The Hafs ayah numbers these Warsh verse(s) cover (1 entry normally, 2+ when spanning). */
  hafsSpan: number[];
}

export interface ReadingsResult {
  surah: number;
  ayah: number;
  /** Hafs text ("" when the ayah does not exist). */
  hafs: string;
  /** Qaloon text ("" when the ayah does not exist). */
  qaloon: string;
  /** Warsh verse covering this Hafs ayah, or null when none maps to it. */
  warsh: WarshReading | null;
  /** False when the requested Hafs ayah does not exist (bad surah/ayah). */
  found: boolean;
}

/**
 * Find the Warsh verse(s) covering a Hafs ayah. Lookup is ONLY
 * through `h` (number_in_hafs) — never by verse number. Normally one
 * verse matches; when one Hafs ayah is split across two Warsh verses
 * (59 ayahs in the source), both are returned joined, in order.
 * Returns null when no Warsh verse maps to the ayah (should not
 * happen: 0 verses in the source lack a mapping, but the UI must
 * handle it gracefully).
 */
export function findWarshVerse(surahNumber: number, ayahNumber: number): WarshReading | null {
  const verses = WARSH_TEXT[surahNumber - 1];
  if (!verses) return null;
  const matches = verses.filter((v) => v.h.includes(ayahNumber));
  if (matches.length === 0) return null;
  const texts = matches.map((v) => stripRlm(v.t));
  const text =
    ayahNumber === 1 && surahNumber !== 9
      ? `${BASMALA} ${texts.join(" ")}`
      : texts.join(" ");
  const hafsSpan = [...new Set(matches.flatMap((v) => v.h))].sort((a, b) => a - b);
  return {
    text,
    warshVerse: matches[0].v,
    warshVerses: matches.map((v) => v.v),
    hafsSpan,
  };
}

/**
 * The three readings for one Hafs ayah.
 * Qaloon shares Hafs numbering, so it is a direct lookup; Warsh is
 * resolved through findWarshVerse (see above).
 */
export function getReadings(surahNumber: number, ayahNumber: number): ReadingsResult {
  const hafsAyah = getAyah(surahNumber, ayahNumber);
  const qaloonAyah = getAyah(surahNumber, ayahNumber, "qaloon");
  return {
    surah: surahNumber,
    ayah: ayahNumber,
    hafs: hafsAyah ? stripRlm(hafsAyah.text) : "",
    qaloon: qaloonAyah ? stripRlm(qaloonAyah.text) : "",
    warsh: findWarshVerse(surahNumber, ayahNumber),
    found: hafsAyah !== null,
  };
}

// ---------------------------------------------------------------------------
// Word-level diff (Hafs vs another reading)
// ---------------------------------------------------------------------------

export interface WordMark {
  /** The word in its original script (diacritics kept, for display). */
  word: string;
  /** True when this word has no counterpart in the other text. */
  diff: boolean;
}

export interface WordDiff {
  /** Hafs words, in order, flagged against the other text. */
  hafs: WordMark[];
  /** The other reading's words, in order, flagged against Hafs. */
  other: WordMark[];
  /** Number of differing words on the other reading's side. */
  diffCount: number;
}

function splitWords(text: string): string[] {
  return stripRlm(text)
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Compare two ayah texts word by word and flag the differing words.
 * Words are compared after normalizeArabic (diacritics/tatweel and
 * alef/ya variants stripped), but the returned marks carry the
 * ORIGINAL words so the UI highlights in the original script.
 *
 * Alignment is a longest-common-subsequence over the normalised
 * words, so a word that moved, was added, or was dropped is flagged
 * `diff` on the side that has it, while identical words elsewhere
 * still line up — a plain index-by-index compare would flag every
 * word after the first insertion as different.
 */
export function diffWords(hafsText: string, otherText: string): WordDiff {
  const hafsWords = splitWords(hafsText);
  const otherWords = splitWords(otherText);
  const hafsNorm = hafsWords.map((w) => normalizeArabic(w));
  const otherNorm = otherWords.map((w) => normalizeArabic(w));

  const n = hafsNorm.length;
  const m = otherNorm.length;
  // LCS lengths, (n+1) x (m+1). Ayahs are short (longest ~200 words),
  // so the O(n*m) table is small.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        hafsNorm[i] === otherNorm[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const hafs: WordMark[] = [];
  const other: WordMark[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (hafsNorm[i] === otherNorm[j]) {
      hafs.push({ word: hafsWords[i], diff: false });
      other.push({ word: otherWords[j], diff: false });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      hafs.push({ word: hafsWords[i], diff: true });
      i++;
    } else {
      other.push({ word: otherWords[j], diff: true });
      j++;
    }
  }
  while (i < n) {
    hafs.push({ word: hafsWords[i], diff: true });
    i++;
  }
  while (j < m) {
    other.push({ word: otherWords[j], diff: true });
    j++;
  }

  return { hafs, other, diffCount: other.filter((w) => w.diff).length };
}

/** Arabic list of Hafs ayah numbers, e.g. [1, 2] -> "1 و 2". */
export function formatAyahList(numbers: number[]): string {
  return numbers.join(" و ");
}
