// حدود الأجزاء الثلاثين — بداية كل جزء (سورة:آية).
// مصدر الحدود: تقسيم المصحف المتعارف عليه (نفس الحدود في قالون —
// الترقيم واحد: 114 سورة، 6236 آية). تم التحقق من كل
// حدّ مقابل النص المضمّن في التطبيق (quran-text.ts): الآية الأولى لكل جزء
// تبدأ بالعبارة المشهورة لذلك الجزء (مثلاً الجزء ٢ يبدأ بـ «سيقول السفهاء»).
// نهاية كل جزء تُحسب تلقائيًا من بداية الجزء التالي (verify-juz.mjs).
import { SURAHS } from "./surahs";

export interface JuzBoundary {
  number: number;
  startSurah: number;
  startAyah: number;
}

export const JUZ_STARTS: JuzBoundary[] = [
  { number: 1, startSurah: 1, startAyah: 1 },
  { number: 2, startSurah: 2, startAyah: 142 },
  { number: 3, startSurah: 2, startAyah: 253 },
  { number: 4, startSurah: 3, startAyah: 93 },
  { number: 5, startSurah: 4, startAyah: 24 },
  { number: 6, startSurah: 4, startAyah: 148 },
  { number: 7, startSurah: 5, startAyah: 82 },
  { number: 8, startSurah: 6, startAyah: 111 },
  { number: 9, startSurah: 7, startAyah: 88 },
  { number: 10, startSurah: 8, startAyah: 41 },
  { number: 11, startSurah: 9, startAyah: 93 },
  { number: 12, startSurah: 11, startAyah: 6 },
  { number: 13, startSurah: 12, startAyah: 53 },
  { number: 14, startSurah: 15, startAyah: 1 },
  { number: 15, startSurah: 17, startAyah: 1 },
  { number: 16, startSurah: 18, startAyah: 75 },
  { number: 17, startSurah: 21, startAyah: 1 },
  { number: 18, startSurah: 23, startAyah: 1 },
  { number: 19, startSurah: 25, startAyah: 21 },
  { number: 20, startSurah: 27, startAyah: 56 },
  { number: 21, startSurah: 29, startAyah: 46 },
  { number: 22, startSurah: 33, startAyah: 31 },
  { number: 23, startSurah: 36, startAyah: 28 },
  { number: 24, startSurah: 39, startAyah: 32 },
  { number: 25, startSurah: 41, startAyah: 47 },
  { number: 26, startSurah: 46, startAyah: 1 },
  { number: 27, startSurah: 51, startAyah: 31 },
  { number: 28, startSurah: 58, startAyah: 1 },
  { number: 29, startSurah: 67, startAyah: 1 },
  { number: 30, startSurah: 78, startAyah: 1 },
];

export interface JuzInfo extends JuzBoundary {
  endSurah: number;
  endAyah: number;
}

/** قائمة الأجزاء مع نهاية كل جزء (الآية التي تسبق بداية الجزء التالي). */
export function getJuzList(): JuzInfo[] {
  return JUZ_STARTS.map((j, i) => {
    const next = JUZ_STARTS[i + 1];
    let endSurah: number;
    let endAyah: number;
    if (next) {
      if (next.startAyah > 1) {
        endSurah = next.startSurah;
        endAyah = next.startAyah - 1;
      } else {
        endSurah = next.startSurah - 1;
        endAyah = SURAHS[endSurah - 1].numberOfAyahs;
      }
    } else {
      endSurah = 114;
      endAyah = SURAHS[113].numberOfAyahs;
    }
    return { ...j, endSurah, endAyah };
  });
}

/** رقم الآية العام (١–٦٢٣٦) لبداية جزء معيّن — للتحقق والاختبار. */
export function juzStartGlobalAyah(juzNumber: number): number | null {
  const j = JUZ_STARTS.find((x) => x.number === juzNumber);
  if (!j) return null;
  let total = 0;
  for (let s = 1; s < j.startSurah; s++) total += SURAHS[s - 1].numberOfAyahs;
  return total + j.startAyah;
}

/** رقم الجزء (١–٣٠) الذي تنتمي إليه آية برقمها العام (١–٦٢٣٦). */
export function getJuzNumber(globalAyah: number): number {
  let juz = 1;
  for (const j of JUZ_STARTS) {
    const start = juzStartGlobalAyah(j.number);
    if (start !== null && globalAyah >= start) juz = j.number;
    else break;
  }
  return juz;
}
