// حدود الأحزاب الستين وآيات السجدة الخمس عشرة.
// مصدر الحدود: api.alquran.cloud/v1/meta (hizbQuarters) — تم التحقق من
// كل حدّ مقابل مصدرين مستقلين: quran.com (by_hizb) والأجزاء المضمّنة
// في التطبيق (juz.ts): كل حزب فردي يساوي بداية جزء (٣٠/٣٠ مطابق).
// آيات السجدة: api.alquran.cloud/v1/sajda — ١٥ آية، والعدد يشمل ٢٢:٧٧
// (السجدة الثانية في الحج) كما في المصحف المدني. الأربع الواجبة
// (٣٢:١٥، ٤١:٣٨، ٥٣:٦٢، ٩٦:١٩) موسومة obligatory.
import { SURAHS } from "./surahs";

export interface HizbBoundary {
  number: number;
  startSurah: number;
  startAyah: number;
}

export const HIZB_STARTS: HizbBoundary[] = [
  { number: 1, startSurah: 1, startAyah: 1 },
  { number: 2, startSurah: 2, startAyah: 75 },
  { number: 3, startSurah: 2, startAyah: 142 },
  { number: 4, startSurah: 2, startAyah: 203 },
  { number: 5, startSurah: 2, startAyah: 253 },
  { number: 6, startSurah: 3, startAyah: 15 },
  { number: 7, startSurah: 3, startAyah: 93 },
  { number: 8, startSurah: 3, startAyah: 171 },
  { number: 9, startSurah: 4, startAyah: 24 },
  { number: 10, startSurah: 4, startAyah: 88 },
  { number: 11, startSurah: 4, startAyah: 148 },
  { number: 12, startSurah: 5, startAyah: 27 },
  { number: 13, startSurah: 5, startAyah: 82 },
  { number: 14, startSurah: 6, startAyah: 36 },
  { number: 15, startSurah: 6, startAyah: 111 },
  { number: 16, startSurah: 7, startAyah: 1 },
  { number: 17, startSurah: 7, startAyah: 88 },
  { number: 18, startSurah: 7, startAyah: 171 },
  { number: 19, startSurah: 8, startAyah: 41 },
  { number: 20, startSurah: 9, startAyah: 34 },
  { number: 21, startSurah: 9, startAyah: 93 },
  { number: 22, startSurah: 10, startAyah: 26 },
  { number: 23, startSurah: 11, startAyah: 6 },
  { number: 24, startSurah: 11, startAyah: 84 },
  { number: 25, startSurah: 12, startAyah: 53 },
  { number: 26, startSurah: 13, startAyah: 19 },
  { number: 27, startSurah: 15, startAyah: 1 },
  { number: 28, startSurah: 16, startAyah: 51 },
  { number: 29, startSurah: 17, startAyah: 1 },
  { number: 30, startSurah: 17, startAyah: 99 },
  { number: 31, startSurah: 18, startAyah: 75 },
  { number: 32, startSurah: 20, startAyah: 1 },
  { number: 33, startSurah: 21, startAyah: 1 },
  { number: 34, startSurah: 22, startAyah: 1 },
  { number: 35, startSurah: 23, startAyah: 1 },
  { number: 36, startSurah: 24, startAyah: 21 },
  { number: 37, startSurah: 25, startAyah: 21 },
  { number: 38, startSurah: 26, startAyah: 111 },
  { number: 39, startSurah: 27, startAyah: 56 },
  { number: 40, startSurah: 28, startAyah: 51 },
  { number: 41, startSurah: 29, startAyah: 46 },
  { number: 42, startSurah: 31, startAyah: 22 },
  { number: 43, startSurah: 33, startAyah: 31 },
  { number: 44, startSurah: 34, startAyah: 24 },
  { number: 45, startSurah: 36, startAyah: 28 },
  { number: 46, startSurah: 37, startAyah: 145 },
  { number: 47, startSurah: 39, startAyah: 32 },
  { number: 48, startSurah: 40, startAyah: 41 },
  { number: 49, startSurah: 41, startAyah: 47 },
  { number: 50, startSurah: 43, startAyah: 24 },
  { number: 51, startSurah: 46, startAyah: 1 },
  { number: 52, startSurah: 48, startAyah: 18 },
  { number: 53, startSurah: 51, startAyah: 31 },
  { number: 54, startSurah: 55, startAyah: 1 },
  { number: 55, startSurah: 58, startAyah: 1 },
  { number: 56, startSurah: 62, startAyah: 1 },
  { number: 57, startSurah: 67, startAyah: 1 },
  { number: 58, startSurah: 72, startAyah: 1 },
  { number: 59, startSurah: 78, startAyah: 1 },
  { number: 60, startSurah: 87, startAyah: 1 },
];

export interface HizbInfo extends HizbBoundary {
  endSurah: number;
  endAyah: number;
}

/** قائمة الأحزاب مع نهاية كل حزب (الآية التي تسبق بداية الحزب التالي). */
export function getHizbList(): HizbInfo[] {
  return HIZB_STARTS.map((h, i) => {
    const next = HIZB_STARTS[i + 1];
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
    return { ...h, endSurah, endAyah };
  });
}

/** رقم الآية العام (١–٦٢٣٦) لبداية حزب معيّن. */
export function hizbStartGlobalAyah(hizbNumber: number): number | null {
  const h = HIZB_STARTS.find((x) => x.number === hizbNumber);
  if (!h) return null;
  let total = 0;
  for (let s = 1; s < h.startSurah; s++) total += SURAHS[s - 1].numberOfAyahs;
  return total + h.startAyah;
}

/** رقم الحزب (١–٦٠) الذي تنتمي إليه آية برقمها العام (١–٦٢٣٦). */
export function getHizbNumber(globalAyah: number): number {
  let hizb = 1;
  for (const h of HIZB_STARTS) {
    const start = hizbStartGlobalAyah(h.number);
    if (start !== null && globalAyah >= start) hizb = h.number;
    else break;
  }
  return hizb;
}

export interface SajdahAyah {
  surah: number;
  ayah: number;
  globalAyah: number;
  /** سجدة واجبة (عند من يوجبها) أم مستحبة. */
  obligatory: boolean;
}

export const SAJDAH_AYAHS: SajdahAyah[] = [
  { surah: 7, ayah: 206, globalAyah: 1160, obligatory: false },
  { surah: 13, ayah: 15, globalAyah: 1722, obligatory: false },
  { surah: 16, ayah: 50, globalAyah: 1951, obligatory: false },
  { surah: 17, ayah: 109, globalAyah: 2138, obligatory: false },
  { surah: 19, ayah: 58, globalAyah: 2308, obligatory: false },
  { surah: 22, ayah: 18, globalAyah: 2613, obligatory: false },
  { surah: 22, ayah: 77, globalAyah: 2672, obligatory: false },
  { surah: 25, ayah: 60, globalAyah: 2915, obligatory: false },
  { surah: 27, ayah: 26, globalAyah: 3185, obligatory: false },
  { surah: 32, ayah: 15, globalAyah: 3518, obligatory: true },
  { surah: 38, ayah: 24, globalAyah: 3994, obligatory: false },
  { surah: 41, ayah: 38, globalAyah: 4256, obligatory: true },
  { surah: 53, ayah: 62, globalAyah: 4846, obligatory: true },
  { surah: 84, ayah: 21, globalAyah: 5905, obligatory: false },
  { surah: 96, ayah: 19, globalAyah: 6125, obligatory: true },
];

/** هل هذه الآية من آيات السجدة؟ */
export function isSajdahAyah(surah: number, ayah: number): boolean {
  return SAJDAH_AYAHS.some((s) => s.surah === surah && s.ayah === ayah);
}
