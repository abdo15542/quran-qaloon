// آية اليوم — آية واحدة ثابتة لكل يوم، حتمية من التاريخ نفسه
// (لا تحتاج تخزينًا ولا إنترنت): بذرة من YYYYMMDD تختار رقمًا عامًا
// بين ١ و٦٢٣٦، فيراها كل مستخدم للتطبيق في اليوم نفسه.
import { SURAHS } from "./surahs";

export interface VerseOfDay {
  surah: number;
  ayah: number;
  globalAyah: number;
}

/** آية اليوم لتاريخ معيّن (الافتراضي: اليوم). */
export function getVerseOfDay(date: Date = new Date()): VerseOfDay {
  const seed =
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  // خلط بسيط للبذرة حتى لا تتتابع الأيام على آيات متجاورة.
  let x = seed;
  x = Math.imul(x ^ (x >>> 16), 2246822519);
  x = Math.imul(x ^ (x >>> 13), 3266489917);
  x ^= x >>> 16;
  const globalAyah = (Math.abs(x) % 6236) + 1;
  let rest = globalAyah;
  for (const s of SURAHS) {
    if (rest <= s.numberOfAyahs) {
      return { surah: s.number, ayah: rest, globalAyah };
    }
    rest -= s.numberOfAyahs;
  }
  return { surah: 114, ayah: 6, globalAyah: 6236 };
}
