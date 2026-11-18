// Revelation order (tartib al-nuzul): surah numbers in the order they
// were revealed, first revealed first.
// Source: https://api.quran.com/api/v4/chapters — the revelation_order
// field per chapter, fetched 2026-11-18. This is the widely-published
// traditional order (also used by Tanzil): it starts 96 (Al-'Alaq), 68,
// 73, 74, 1, 111, ... and ends 110 (An-Nasr).
// Verified at build time: 114 entries; surahs 1-114 each exactly once;
// revelation_order values 1-114 each exactly once; first five are
// 96, 68, 73, 74, 1 and the last is 110.
export const REVELATION_ORDER: number[] = [
  96, 68, 73, 74, 1, 111, 81, 87, 92, 89, 93, 94,
  103, 100, 108, 102, 107, 109, 105, 113, 114, 112, 53, 80,
  97, 91, 85, 95, 106, 101, 75, 104, 77, 50, 90, 86,
  54, 38, 7, 72, 36, 25, 35, 19, 20, 56, 26, 27,
  28, 17, 10, 11, 12, 15, 6, 37, 31, 34, 39, 40,
  41, 42, 43, 44, 45, 46, 51, 88, 18, 16, 71, 14,
  21, 23, 32, 52, 67, 69, 70, 78, 79, 82, 84, 30,
  29, 83, 2, 8, 3, 33, 60, 4, 99, 57, 47, 13,
  55, 76, 65, 98, 59, 24, 22, 63, 58, 49, 66, 64,
  61, 62, 48, 5, 9, 110,
];

/** 1-based revelation order of a surah (1 = first revealed), or 0 if unknown. */
export function getRevelationOrder(surahNumber: number): number {
  return REVELATION_ORDER.indexOf(surahNumber) + 1;
}
