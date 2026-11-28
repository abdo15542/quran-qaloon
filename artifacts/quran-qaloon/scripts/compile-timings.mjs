// Compiler: per-ayah timing JSONs -> src/data/ayah-timings-qaloon.ts (1.0.116).
//
// Usage:
//   node scripts/compile-timings.mjs <timings-dir> [app-root]
//   timings-dir holds one file per reciter x surah:
//     <reciter-id>-s<NNN>.json   e.g. hudhaify-qaloon-s036.json
//   app-root defaults to the repo root (parent of scripts/).
//
// Input format (the contract the timing builder must satisfy):
//   { surah: number,
//     ayahs: [{ ayah, start, end, matched, expected, confidence }],
//     diagnostics: {...} }
//   - ayahs cover 1..N with no gaps (N = the surah's Kufi count from
//     the app's own src/data/surahs.ts), strictly monotonic windows,
//     start < end, confidence in [0, 1].
// Files that fail validation abort the run (exit non-zero, nothing
// written) and are named in the error.
//
// WHERE THE FULL TABLES DROP IN: put the finished per-surah JSONs for
// all 7 reciters x 114 surahs in the timings dir and re-run this
// script. It merges whatever is present — a partial set is fine and
// the generated file records exactly which surahs each reciter covers
// (TIMING_COVERAGE), so the app always knows what is timed and what
// falls back to approximate playback. No other code change is needed
// when the full tables land: recompile, rebuild, push.
//
// Output layout: AYAH_TIMINGS[reciterId][surah] = [[start, end,
// confidence], ...] indexed by ayah-1 (null entries are never emitted
// — a surah is either fully present or absent).
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(process.argv[3] ?? join(__dirname, ".."));
const timingsDir = resolve(process.argv[2] ?? join(appRoot, "scripts", "data", "timings"));
const outFile = join(appRoot, "src", "data", "ayah-timings-qaloon.ts");

function fail(msg) {
  console.error(`compile-timings: ERROR: ${msg}`);
  process.exit(1);
}

// Reciter ids + Kufi counts from the app's own source (source of truth).
const surahsSrc = readFileSync(join(appRoot, "src", "data", "surahs.ts"), "utf8");
const reciterIds = [...surahsSrc.matchAll(/id:\s*"([a-z]+-qaloon)"/g)].map((m) => m[1]);
if (reciterIds.length !== 7) fail(`expected 7 Qaloon reciters in surahs.ts, got ${reciterIds.length}: ${reciterIds.join(", ")}`);
const kufiCounts = [...surahsSrc.matchAll(/numberOfAyahs:\s*(\d+)/g)].map((m) => Number(m[1]));
if (kufiCounts.length !== 114 || kufiCounts.reduce((a, b) => a + b, 0) !== 6236)
  fail(`bad Kufi counts in surahs.ts`);

const files = readdirSync(timingsDir).filter((f) => f.endsWith(".json")).sort();
if (files.length === 0) fail(`no timing JSONs in ${timingsDir}`);

// data[reciter][surah] = [[start, end, confidence], ...]
const data = {};
const coverage = {};
let totalAyahs = 0;
let totalMatched = 0;
let totalExpected = 0;
for (const f of files) {
  const m = f.match(/^([a-z]+-qaloon)-s(\d{3})\.json$/);
  if (!m) fail(`${f}: filename must be <reciter-id>-s<NNN>.json`);
  const [, reciter, surahStr] = m;
  const surah = Number(surahStr);
  if (!reciterIds.includes(reciter)) fail(`${f}: unknown reciter ${reciter}`);
  if (surah < 1 || surah > 114) fail(`${f}: bad surah ${surah}`);
  const d = JSON.parse(readFileSync(join(timingsDir, f), "utf8"));
  if (d.surah !== surah) fail(`${f}: "surah" field is ${d.surah}, filename says ${surah}`);
  const ayahs = d.ayahs;
  const n = kufiCounts[surah - 1];
  if (!Array.isArray(ayahs) || ayahs.length !== n)
    fail(`${f}: expected ${n} ayahs, got ${Array.isArray(ayahs) ? ayahs.length : typeof ayahs}`);
  let prevEnd = -1;
  const rows = [];
  for (let i = 0; i < n; i++) {
    const a = ayahs[i];
    if (a.ayah !== i + 1) fail(`${f}: ayah ${i + 1} out of order (got ${a.ayah})`);
    if (typeof a.start !== "number" || typeof a.end !== "number" || !(a.start < a.end))
      fail(`${f}: ayah ${a.ayah} has a bad window [${a.start}, ${a.end}]`);
    if (a.start < prevEnd) fail(`${f}: ayah ${a.ayah} starts before the previous ayah ends (${a.start} < ${prevEnd})`);
    if (typeof a.confidence !== "number" || a.confidence < 0 || a.confidence > 1)
      fail(`${f}: ayah ${a.ayah} has a bad confidence ${a.confidence}`);
    if (typeof a.matched !== "number" || typeof a.expected !== "number" || a.matched > a.expected)
      fail(`${f}: ayah ${a.ayah} has bad matched/expected ${a.matched}/${a.expected}`);
    prevEnd = a.end;
    rows.push([a.start, a.end, a.confidence]);
    totalMatched += a.matched;
    totalExpected += a.expected;
  }
  if (data[reciter]?.[surah]) fail(`${f}: duplicate table for ${reciter} surah ${surah}`);
  (data[reciter] ??= {})[surah] = rows;
  (coverage[reciter] ??= []).push(surah);
  totalAyahs += n;
}

const coveredSurahs = [...new Set(Object.values(coverage).flat())].sort((a, b) => a - b);
const matchRate = totalExpected ? (totalMatched / totalExpected).toFixed(4) : "n/a";

const tablesTs = reciterIds
  .filter((r) => data[r])
  .map((r) => {
    const surahs = Object.keys(data[r])
      .map(Number)
      .sort((a, b) => a - b)
      .map((s) => {
        const rows = data[r][s].map(([st, en, cf]) => `[${st}, ${en}, ${cf}]`).join(", ");
        return `    ${s}: [${rows}],`;
      })
      .join("\n");
    return `  "${r}": {\n${surahs}\n  },`;
  })
  .join("\n");
const coverageTs = reciterIds
  .filter((r) => coverage[r])
  .map((r) => `  "${r}": [${coverage[r].sort((a, b) => a - b).join(", ")}],`)
  .join("\n");

const header = `// GENERATED — DO NOT EDIT BY HAND.
// Timing tables built from the whole-surah Qaloon recordings on the
// mp3quran CDN (forced alignment of the transcribed words against the
// bundled Qaloon text). Regenerate:
//   node scripts/compile-timings.mjs <timings-dir>
// FULL TABLES: drop one JSON per reciter x surah
// (<reciter-id>-s<NNN>.json) into the timings dir and re-run — no
// other code change is needed; the app reads TIMING_COVERAGE to know
// what is timed and falls back to approximate playback elsewhere.
//
// Coverage when generated: ${files.length} files, ${totalAyahs} ayahs,
// surahs ${coveredSurahs.join(", ")} x 7 reciters,
// word match ${totalMatched}/${totalExpected} (${matchRate}).
// A surah is either fully present for a reciter or absent — never partial.

export type AyahTimingWindow = readonly [start: number, end: number, confidence: number];

/** AYAH_TIMINGS[reciterId][surah] = one [start, end, confidence] window per ayah (index = ayah - 1). */
export const AYAH_TIMINGS: Readonly<
  Record<string, Readonly<Record<number, ReadonlyArray<AyahTimingWindow>>>>
> = {
${tablesTs}
};

/** Surahs with a timing table, per reciter. */
export const TIMING_COVERAGE: Readonly<Record<string, ReadonlyArray<number>>> = {
${coverageTs}
};

export interface AyahTiming {
  start: number;
  end: number;
  confidence: number;
}

/** Measured [start, end] window of an ayah in a reciter's whole-surah recording, or null. */
export function getAyahTiming(
  reciterId: string,
  surahNumber: number,
  ayahNumber: number
): AyahTiming | null {
  const row = AYAH_TIMINGS[reciterId]?.[surahNumber]?.[ayahNumber - 1];
  if (!row) return null;
  return { start: row[0], end: row[1], confidence: row[2] };
}

export function hasAyahTiming(reciterId: string, surahNumber: number, ayahNumber: number): boolean {
  return getAyahTiming(reciterId, surahNumber, ayahNumber) !== null;
}
`;

mkdirSync(join(appRoot, "src", "data"), { recursive: true });
writeFileSync(outFile, header, "utf8");
console.log(
  `compile-timings: OK — ${files.length} files, ${totalAyahs} ayahs, surahs [${coveredSurahs.join(", ")}] x ${Object.keys(data).length} reciters, word match ${matchRate} -> ${outFile}`
);
