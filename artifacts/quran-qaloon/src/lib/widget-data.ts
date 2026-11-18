// بيانات ويدجت الشاشة الرئيسية: آية اليوم + الصلاة القادمة.
// تُكتب في ملف widget.json داخل مجلد بيانات التطبيق (Directory.Data
// = filesDir على أندرويد) فيقرأها QuranWidgetProvider الأصلي ويعرضها
// على الشاشة الرئيسية. تُحدَّث عند كل فتح للتطبيق (من الرئيسية)،
// والويدجت نفسه يتحدث كل ٣٠ دقيقة من آخر ملف مكتوب. على الويب
// تُحفظ نسخة في localStorage ليقرأها اختبار repro.
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { getVerseOfDay } from "@/data/verse-of-day";
import { getSurahAyahs } from "@/data/quran-text";
import { SURAHS } from "@/data/surahs";
import {
  getActiveLocation,
  getNextPrayerForCoords,
  PRAYER_NAMES,
  formatPrayerTime,
} from "@/data/prayer-times";
import { requestWidgetUpdate } from "@/lib/adhan-alarm";

export interface WidgetData {
  date: string;
  verseText: string;
  verseRef: string;
  nextPrayerName: string;
  nextPrayerTime: string;
}

export async function updateWidgetData(): Promise<boolean> {
  try {
    const now = new Date();
    const v = getVerseOfDay(now);
    const ayah = getSurahAyahs(v.surah)[v.ayah - 1];
    const surah = SURAHS.find((s) => s.number === v.surah);
    const { lat, lng } = getActiveLocation();
    const next = getNextPrayerForCoords(now, lat, lng);
    const data: WidgetData = {
      date: `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`,
      verseText: ayah ? ayah.text : "",
      verseRef: surah ? `سورة ${surah.name} — الآية ${v.ayah}` : "",
      nextPrayerName: PRAYER_NAMES[next.key],
      nextPrayerTime: formatPrayerTime(next.time),
    };
    const json = JSON.stringify(data);
    if (Capacitor.isNativePlatform()) {
      await Filesystem.writeFile({
        path: "widget.json",
        data: json,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      await requestWidgetUpdate();
    } else {
      try {
        localStorage.setItem("quran_widget_data", json);
      } catch {
        // storage unavailable
      }
    }
    return true;
  } catch {
    return false;
  }
}
