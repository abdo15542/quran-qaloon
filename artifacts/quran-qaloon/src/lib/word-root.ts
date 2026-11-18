// Word / root lookup for 1.0.74 feature 1 (word sheet + root search).
// Fully offline: morphology from the Quranic Arabic Corpus v0.4 (see
// src/data/morphology.ts) and Gharib meanings from Quranpedia's As-Siraj
// (see src/data/meanings.ts). No network, no AI.
//
// WORD INDEX CONTRACT — read this before wiring taps in SurahPlayer /
// MushafPage: `wordIndex` is the index into splitAyahWords() of the text
// AS DISPLAYED, i.e. after displayAyahText() has split the Basmala off
// ayah 1 (surahs 2-114, not 9). Surah 1 ayah 1 IS the Basmala, so there
// the index counts the Basmala words. getWordInfo() adds the 4 Basmala
// words back internally to reach the bundled-text index, then maps to
// the QAC word number (see below). If you pass wordText as well, a
// mismatch between the two interpretations is resolved in favour of the
// one whose bundled word equals wordText.
//
// BUNDLED -> QAC MAPPING: the bundled Hafs text and the QAC word list
// agree word-for-word (verified: 99.987% normalised equality, see
// deep-data-prep/report-74.json) once standalone pause-mark tokens
// (ۛ ۖ ۚ ۗ …) are skipped — they are not words in QAC. So the QAC word
// number of a bundled word is its ordinal among the bundled text's
// real word tokens (Basmala words of ayah 1 map to QAC 1:1 words 1-4).
// Known exceptions (positional mapping still returns *a* word for them):
//  - 15:7: QAC lists "لَّوۡمَا" twice (words 1 and 2); the bundled text
//    splits it into "لَّوْ" + "مَا" — both map to the same QAC entry.
//  - 37:130: QAC joins "إِلۡ يَاسِينَ" into one word (3 QAC words vs 4
//    bundled tokens) — the bundled 4th token has no QAC word (null).
//  - بَعْدَمَا (2:181, 8:6, 13:37): one QAC word "بَعۡدَ مَا" (internal
//    space) vs one bundled token — positions still agree.
import { QURAN_TEXT, normalizeArabic, displayAyahText } from "@/data/quran-text";
import {
  MORPHOLOGY_ROOTS,
  MORPHOLOGY_LEMMAS,
  MORPHOLOGY_POS,
  MORPHOLOGY_WORDS,
  MORPHOLOGY_ROOT_INDEX,
  MORPHOLOGY_ROOT_DISPLAY,
} from "@/data/morphology";
import { MEANING_BOOKS, MEANING_WORDS, MEANING_TEXTS, MEANINGS } from "@/data/meanings";
import { SURAHS } from "@/data/surahs";

export interface WordMeaning {
  /** The word (or phrase) as written in the meanings book. */
  word: string;
  meaning: string;
  book: string;
  bookShort: string;
}

export interface WordInfo {
  surahNumber: number;
  ayahNumber: number;
  /** Index into splitAyahWords() of the displayed ayah text. */
  wordIndex: number;
  wordText: string;
  /** 1-based QAC word number, or null for pause marks / unmapped words. */
  qacWordNumber: number | null;
  /** QAC ayah the word belongs to (1:1 for Basmala words of ayah 1). */
  qacSurah: number;
  qacAyah: number;
  root: string | null;
  lemma: string | null;
  pos: string | null;
  meanings: WordMeaning[];
}

export interface RootAyah {
  surahNumber: number;
  ayahNumber: number;
  /** How many words in this ayah carry the root. */
  count: number;
}

export interface RootSearchResult {
  /** The root as typed (normalised) and as stored for display. */
  query: string;
  root: string | null;
  ayahCount: number;
  totalOccurrences: number;
  ayahs: RootAyah[];
}

/** Split an ayah text into its space-separated tokens (words and any
    standalone pause marks — callers that need real words only should
    filter with isWordToken). */
export function splitAyahWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** True when a token is a real word (not a standalone pause mark such as
    ۛ / ۖ / ۩, which normalise to "" or to a lone mark with no letter). */
export function isWordToken(token: string): boolean {
  return /[\u0621-\u064A]/.test(normalizeArabic(token));
}

function normWord(w: string): string {
  return normalizeArabic(w, false);
}

/**
 * Map a displayed-word index to its QAC word reference.
 * Returns null when the token is a pause mark (no QAC word) or the index
 * is out of range. `wordText` (when given) disambiguates whether the
 * index counts the Basmala words of ayah 1 or not — see the contract
 * above.
 */
export function qacWordRef(
  surahNumber: number,
  ayahNumber: number,
  wordIndex: number,
  wordText?: string
): { surah: number; ayah: number; word: number } | null {
  const fullText = QURAN_TEXT[surahNumber - 1]?.[ayahNumber - 1];
  if (!fullText) return null;
  const fullTokens = splitAyahWords(fullText);
  const basmalaWords =
    ayahNumber === 1 && surahNumber !== 1 && surahNumber !== 9 ? 4 : 0;

  // Candidate A (the contract): the index counts displayed words, so the
  // Basmala words come first in the bundled text.
  const fullIndexA = wordIndex + basmalaWords;
  // Candidate B: the index already counts the Basmala words.
  const fullIndexB = wordIndex;
  let fullIndex = fullIndexA;
  if (wordText !== undefined && basmalaWords > 0) {
    const nw = normWord(wordText);
    const matchA = fullTokens[fullIndexA] !== undefined && normWord(fullTokens[fullIndexA]) === nw;
    const matchB = fullTokens[fullIndexB] !== undefined && normWord(fullTokens[fullIndexB]) === nw;
    if (!matchA && matchB) fullIndex = fullIndexB;
  }
  if (fullIndex < 0 || fullIndex >= fullTokens.length) return null;
  if (!isWordToken(fullTokens[fullIndex])) return null;

  // Ordinal among real word tokens -> 1-based QAC word number.
  let ordinal = 0;
  for (let i = 0; i < fullIndex; i++) {
    if (isWordToken(fullTokens[i])) ordinal++;
  }
  if (ayahNumber === 1 && basmalaWords > 0 && ordinal < 4) {
    // Basmala word -> QAC 1:1 (the Basmala itself).
    return { surah: 1, ayah: 1, word: ordinal + 1 };
  }
  const qacWord = ayahNumber === 1 && basmalaWords > 0 ? ordinal - 4 + 1 : ordinal + 1;
  const ref = { surah: surahNumber, ayah: ayahNumber, word: qacWord };
  // Bounds-check against the morphology table: the one known exception
  // is 37:130, where QAC joins "إِلۡ يَاسِينَ" into a single word, so the
  // bundled 4th token has no QAC word (null, not a phantom word 4).
  const table = MORPHOLOGY_WORDS[`${ref.surah}:${ref.ayah}`];
  if (!table || qacWord < 1 || qacWord > table.length) return null;
  return ref;
}

/** Gharib meanings for one tapped word in one ayah. A meaning entry
    matches when any space-separated token of its word text equals the
    tapped word (normalised, so «بِسْمِ اللهِ» also matches a tap on
    «بِسْمِ»). */
export function getWordMeanings(
  surahNumber: number,
  ayahNumber: number,
  wordText: string
): WordMeaning[] {
  const entries = MEANINGS[`${surahNumber}:${ayahNumber}`];
  if (!entries) return [];
  const nw = normWord(wordText);
  const out: WordMeaning[] = [];
  for (const [wIdx, tIdx, bIdx] of entries) {
    const entryWord = MEANING_WORDS[wIdx];
    const tokens = normWord(entryWord).split(/\s+/).filter(Boolean);
    if (!tokens.includes(nw)) continue;
    const book = MEANING_BOOKS[bIdx];
    out.push({
      word: entryWord,
      meaning: MEANING_TEXTS[tIdx],
      book: book?.name ?? "",
      bookShort: book?.short ?? "",
    });
  }
  return out;
}

/** Full word info for a tapped word: root, lemma, POS and Gharib
    meaning(s). Returns null only when the ayah/word index is invalid;
    a word with no morphology (pause mark, pronoun, particle, or the
    unmapped 37:130 token) still returns an object with null fields so
    the sheet can show a graceful empty state. */
export function getWordInfo(
  surahNumber: number,
  ayahNumber: number,
  wordIndex: number,
  wordText?: string
): WordInfo | null {
  const ayahText = QURAN_TEXT[surahNumber - 1]?.[ayahNumber - 1];
  if (!ayahText) return null;
  const displayed = displayAyahText(surahNumber, ayahNumber, ayahText);
  const tokens = splitAyahWords(displayed);
  if (wordIndex < 0 || wordIndex >= tokens.length) return null;
  const text = wordText ?? tokens[wordIndex];

  const ref = qacWordRef(surahNumber, ayahNumber, wordIndex, text);
  let root: string | null = null;
  let lemma: string | null = null;
  let pos: string | null = null;
  if (ref) {
    const triple = MORPHOLOGY_WORDS[`${ref.surah}:${ref.ayah}`]?.[ref.word - 1];
    if (triple) {
      if (triple[0] >= 0) root = MORPHOLOGY_ROOTS[triple[0]];
      if (triple[1] >= 0) lemma = MORPHOLOGY_LEMMAS[triple[1]];
      if (triple[2] >= 0) pos = MORPHOLOGY_POS[triple[2]];
    }
  }
  return {
    surahNumber,
    ayahNumber,
    wordIndex,
    wordText: text,
    qacWordNumber: ref ? ref.word : null,
    qacSurah: ref ? ref.surah : surahNumber,
    qacAyah: ref ? ref.ayah : ayahNumber,
    root,
    lemma,
    pos,
    meanings: getWordMeanings(surahNumber, ayahNumber, text),
  };
}

/** Every ayah containing `root` (typed with or without diacritics — the
    root is normalised the same way the index keys were built). */
export function searchByRoot(root: string): RootSearchResult {
  const query = normalizeArabic(root.trim(), false);
  if (!query) return { query, root: null, ayahCount: 0, totalOccurrences: 0, ayahs: [] };
  const entries = MORPHOLOGY_ROOT_INDEX[query];
  if (!entries) return { query, root: null, ayahCount: 0, totalOccurrences: 0, ayahs: [] };
  const ayahs: RootAyah[] = entries.map(([s, a, c]) => ({
    surahNumber: s,
    ayahNumber: a,
    count: c,
  }));
  return {
    query,
    root: MORPHOLOGY_ROOT_DISPLAY[query] ?? query,
    ayahCount: ayahs.length,
    totalOccurrences: ayahs.reduce((n, x) => n + x.count, 0),
    ayahs,
  };
}

/** Surah display name (Arabic) for a root-search / sheet row. */
export function surahName(surahNumber: number): string {
  return SURAHS.find((s) => s.number === surahNumber)?.name ?? "";
}
