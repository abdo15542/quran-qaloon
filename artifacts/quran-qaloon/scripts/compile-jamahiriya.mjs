// Compiler: مصحف الجماهيرية JSONs -> src/data/jamahiriya.ts (1.0.116).
//
// Usage:
//   node scripts/compile-jamahiriya.mjs <jamahiriya-dir> [app-root]
//   jamahiriya-dir must contain: jamahiriya-table.json,
//   kufi-to-madani-first-corrected.json, surah-starts.json
//   app-root defaults to the repo root (parent of scripts/).
//
// The script VALIDATES the source data before emitting anything:
//  - 602 pages, numbered 1..602, Kufi ordinals contiguous 1..6236
//    (Kufi counts are read from the app's own src/data/surahs.ts —
//    the app keeps Kufi 6236 everywhere; printed numbers are a
//    DISPLAY layer only, see CORRECTIONS.md in the source dir).
//  - every Kufi ayah has a printed-number entry (6236 entries);
//  - surah-starts has all 114 surahs and matches the counts file.
// If any check fails the script exits non-zero and writes nothing.
//
// Generated file layout:
//  - JAMAHIRIYA_PAGES: [startSurah, startAyahKufi, endSurah, endAyahKufi,
//    printedStart, printedEnd] per page (printed numbers reset at each
//    surah, so printedStart > printedEnd on the 42 pages that span a
//    surah boundary — that is expected, not an error).
//  - KUFI_PRINTED: printed numbers per Kufi ayah, indexed by global
//    Kufi ordinal (0-based). "" = identity (printed == Kufi number),
//    otherwise "n" or "n,m" (a Kufi ayah split across printed numbers;
//    merged Kufi ayahs share one printed number).
//  - JAMAHIRIYA_SURAH_STARTS: { page, printedCount } per surah.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(process.argv[3] ?? join(__dirname, ".."));
const srcDir = resolve(process.argv[2] ?? join(appRoot, "scripts", "data", "jamahiriya"));
const outFile = join(appRoot, "src", "data", "jamahiriya.ts");

function fail(msg) {
  console.error(`compile-jamahiriya: ERROR: ${msg}`);
  process.exit(1);
}

const table = JSON.parse(readFileSync(join(srcDir, "jamahiriya-table.json"), "utf8"));
const corrected = JSON.parse(
  readFileSync(join(srcDir, "kufi-to-madani-first-corrected.json"), "utf8")
);
const starts = JSON.parse(readFileSync(join(srcDir, "surah-starts.json"), "utf8"));

// Kufi ayah counts from the app's own SURAHS table (source of truth).
const surahsSrc = readFileSync(join(appRoot, "src", "data", "surahs.ts"), "utf8");
const kufiCounts = [...surahsSrc.matchAll(/numberOfAyahs:\s*(\d+)/g)].map((m) => Number(m[1]));
if (kufiCounts.length !== 114) fail(`expected 114 surahs in surahs.ts, got ${kufiCounts.length}`);
if (kufiCounts.reduce((a, b) => a + b, 0) !== 6236)
  fail(`Kufi total is not 6236: ${kufiCounts.reduce((a, b) => a + b, 0)}`);

// --- validate the 602-page table -------------------------------------------
if (!Array.isArray(table) || table.length !== 602)
  fail(`expected 602 pages, got ${Array.isArray(table) ? table.length : typeof table}`);
const cum = [0];
for (const c of kufiCounts) cum.push(cum[cum.length - 1] + c);
const ord = (s, a) => cum[s - 1] + a;
let prev = 0;
for (const p of table) {
  if (p.page < 1 || p.page > 602) fail(`bad page number ${p.page}`);
  if (table[p.page - 1] !== p) fail(`pages out of order at ${p.page}`);
  if (p.midAyahSplit !== false)
    fail(`page ${p.page}: midAyahSplit is not false (0 Kufi ayahs split across pages)`);
  const o0 = ord(p.startSurah, p.startAyahKufi);
  const o1 = ord(p.endSurah, p.endAyahKufi);
  if (o0 !== prev + 1) fail(`page ${p.page}: Kufi coverage gap/overlap (ordinal ${prev} -> ${o0})`);
  if (o1 < o0) fail(`page ${p.page}: end before start`);
  prev = o1;
}
if (prev !== 6236) fail(`last Kufi ordinal is ${prev}, expected 6236`);

// --- validate the printed-number mapping ------------------------------------
const map = corrected.kufi2sys;
const counts = corrected.counts;
if (!map || Object.keys(map).length !== 6236)
  fail(`kufi2sys has ${map ? Object.keys(map).length : 0} entries, expected 6236`);
for (let s = 1; s <= 114; s++) {
  for (let a = 1; a <= kufiCounts[s - 1]; a++) {
    const v = map[`${s}:${a}`];
    if (!Array.isArray(v) || v.length === 0 || v.some((n) => !Number.isInteger(n) || n < 1))
      fail(`kufi2sys missing/invalid for ${s}:${a}`);
  }
}
// --- validate surah starts ---------------------------------------------------
for (let s = 1; s <= 114; s++) {
  const st = starts[String(s)];
  if (!st || !Number.isInteger(st.page) || st.page < 1 || st.page > 602)
    fail(`surah-starts missing/invalid for surah ${s}`);
  if (st.printedCount !== Number(counts[String(s)]))
    fail(`surah ${s}: printedCount ${st.printedCount} != counts ${counts[String(s)]}`);
  const onPage = table[st.page - 1];
  if (!onPage) fail(`surah ${s}: start page ${st.page} missing from the table`);
  // The surah may start mid-page (e.g. surah 5 starts on p.106, whose
  // first ayah is 4:176) — only require that (s,1) is ON that page.
  const onFirst = onPage.startSurah < s || (onPage.startSurah === s && onPage.startAyahKufi <= 1);
  const onLast = onPage.endSurah > s || (onPage.endSurah === s && onPage.endAyahKufi >= 1);
  if (!onFirst || !onLast) fail(`surah ${s}: start page ${st.page} does not contain ${s}:1`);
}

// --- emit --------------------------------------------------------------------
const pagesTs = table
  .map(
    (p) =>
      `  [${p.startSurah}, ${p.startAyahKufi}, ${p.endSurah}, ${p.endAyahKufi}, ${p.printedStart}, ${p.printedEnd}], // page ${p.page}`
  )
  .join("\n");
const startsTs = Object.entries(starts)
  .map(([s, st]) => `  ${s}: { page: ${st.page}, printedCount: ${st.printedCount} },`)
  .join("\n");
// KUFI_PRINTED: one entry per global Kufi ordinal (0-based), "" = identity.
const printedTs = [];
for (let s = 1; s <= 114; s++) {
  for (let a = 1; a <= kufiCounts[s - 1]; a++) {
    const v = map[`${s}:${a}`];
    printedTs.push(v.length === 1 && v[0] === a ? `""` : `"${v.join(",")}"`);
  }
}
// Wrap lines at 20 entries for readability.
const printedLines = [];
for (let i = 0; i < printedTs.length; i += 20) {
  printedLines.push(`  ${printedTs.slice(i, i + 20).join(", ")},`);
}

const header = `// GENERATED — DO NOT EDIT BY HAND.
// Source: مصحف الجماهيرية (archive.org 20230517_20230517_0342, 2011 print),
// verified tables in the jamahiriya source dir (see CORRECTIONS.md there:
// p.85 endAyahKufi fix, 7 midAyahSplit flags corrected, 17 mapping fixes,
// p.440 verified-pages error — the table used here already has them).
// Regenerate: node scripts/compile-jamahiriya.mjs <jamahiriya-dir>
//
// Numbering rule: the app keeps Kufi 6236 everywhere. Printed (Madani-first)
// numbers are a DISPLAY layer only — see getPrintedNumbers().
// Printed numbers reset at every surah, so on the 42 pages that span a
// surah boundary printedStart > printedEnd; that is expected.
// 0 Kufi ayahs are split across pages (midAyahSplit is false on all 602).
import { SURAHS } from "./surahs";

export const JAMAHIRIYA_TOTAL_PAGES = 602;

// [startSurah, startAyahKufi, endSurah, endAyahKufi, printedStart, printedEnd]
export const JAMAHIRIYA_PAGES: ReadonlyArray<
  readonly [number, number, number, number, number, number]
> = [
${pagesTs}
];

// First Jamahiriya page of each surah + its PRINTED ayah count.
export const JAMAHIRIYA_SURAH_STARTS: Readonly<
  Record<number, { page: number; printedCount: number }>
> = {
${startsTs}
};

// Printed numbers per Kufi ayah, indexed by global Kufi ordinal (0-based,
// 6236 entries). "" = identity (printed == Kufi number); otherwise "n" or
// "n,m" (one Kufi ayah split across printed numbers; merged Kufi ayahs
// share a single printed number).
export const KUFI_PRINTED: ReadonlyArray<string> = [
${printedLines.join("\n")}
];

export interface JamahiriyaPageRange {
  page: number;
  startSurah: number;
  startAyah: number;
  endSurah: number;
  endAyah: number;
  printedStart: number;
  printedEnd: number;
  surahStart: { surah: number; printedCount: number } | null;
}

export function getJamahiriyaPageRange(page: number): JamahiriyaPageRange | null {
  if (page < 1 || page > 602) return null;
  const [s0, a0, s1, a1, ps, pe] = JAMAHIRIYA_PAGES[page - 1];
  // A surah may start mid-page (e.g. surah 5 starts on p.106, whose
  // first ayah is 4:176): surahStart is the first surah whose first
  // ayah is ON this page, or null.
  let surahStart: { surah: number; printedCount: number } | null = null;
  for (let s = s0; s <= s1; s++) {
    const st = JAMAHIRIYA_SURAH_STARTS[s];
    if (st && st.page === page) {
      surahStart = { surah: s, printedCount: st.printedCount };
      break;
    }
  }
  return {
    page,
    startSurah: s0,
    startAyah: a0,
    endSurah: s1,
    endAyah: a1,
    printedStart: ps,
    printedEnd: pe,
    surahStart,
  };
}

// Global Kufi ordinal (1-based) of an ayah, from the app's SURAHS counts.
function kufiOrdinal(surahNumber: number, ayahNumber: number): number {
  let n = 0;
  for (const s of SURAHS) {
    if (s.number === surahNumber) return n + ayahNumber;
    n += s.numberOfAyahs;
  }
  return n + ayahNumber;
}

/** Printed (Madani-first) number(s) of a Kufi ayah — the display layer. */
export function getPrintedNumbers(surahNumber: number, ayahNumber: number): number[] {
  const raw = KUFI_PRINTED[kufiOrdinal(surahNumber, ayahNumber) - 1];
  if (!raw) return [ayahNumber];
  return raw.split(",").map((x) => Number(x));
}

/** Printed ayah count of a surah (the number shown in its Jamahiriya header). */
export function getPrintedSurahCount(surahNumber: number): number {
  return JAMAHIRIYA_SURAH_STARTS[surahNumber]?.printedCount ?? SURAHS[surahNumber - 1]?.numberOfAyahs ?? 0;
}

/** First Jamahiriya page of a surah. */
export function getJamahiriyaSurahStartPage(surahNumber: number): number {
  return JAMAHIRIYA_SURAH_STARTS[surahNumber]?.page ?? 1;
}

// Page of a given Kufi ayah (binary search over the 602 ranges).
export function getJamahiriyaPageOfAyah(surahNumber: number, ayahNumber: number): number {
  let lo = 0;
  let hi = 601;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [s0, a0, s1, a1] = JAMAHIRIYA_PAGES[mid];
    const before = surahNumber < s0 || (surahNumber === s0 && ayahNumber < a0);
    const after = surahNumber > s1 || (surahNumber === s1 && ayahNumber > a1);
    if (before) hi = mid - 1;
    else if (after) lo = mid + 1;
    else return mid + 1;
  }
  return 1;
}

// Last-read Jamahiriya page (separate key from the 604-page mushaf).
const LAST_JAMAHIRIYA_PAGE_KEY = "jamahiriya_last_page";

export function getLastJamahiriyaPage(): number {
  try {
    const raw = localStorage.getItem(LAST_JAMAHIRIYA_PAGE_KEY);
    const p = raw ? parseInt(raw, 10) : NaN;
    if (!isNaN(p) && p >= 1 && p <= 602) return p;
  } catch {
    // storage unavailable
  }
  return 1;
}

export function setLastJamahiriyaPage(page: number): void {
  try {
    localStorage.setItem(LAST_JAMAHIRIYA_PAGE_KEY, String(page));
  } catch {
    // storage unavailable
  }
}
`;

mkdirSync(join(appRoot, "src", "data"), { recursive: true });
writeFileSync(outFile, header, "utf8");
console.log(
  `compile-jamahiriya: OK — 602 pages, 6236 printed-number entries, 114 surah starts -> ${outFile}`
);
