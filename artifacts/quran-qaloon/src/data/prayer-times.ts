// Prayer times (أوقات الصلاة) for Libyan cities, calculated fully offline
// with the `adhan` library (Muslim World League method — the method used
// in Libya; Shafi Asr, as in the Maliki school). No network, no location
// permission: the user picks their city from the list. Times are in the
// device's local timezone, so they are correct on the user's phone.
// Reminders are native local notifications (id range 100-134 = 7 days x
// 5 prayers), re-scheduled whenever the app opens so the window never
// runs out.

import { Coordinates, CalculationMethod, PrayerTimes } from "adhan";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export type PrayerKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

export const PRAYER_NAMES: Record<PrayerKey, string> = {
  fajr: "الفجر",
  dhuhr: "الظهر",
  asr: "العصر",
  maghrib: "المغرب",
  isha: "العشاء",
};

export const PRAYER_ORDER: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

export interface LibyanCity {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export const LIBYAN_CITIES: LibyanCity[] = [
  { id: "tripoli", name: "طرابلس", lat: 32.8872, lng: 13.1913 },
  { id: "benghazi", name: "بنغازي", lat: 32.1197, lng: 20.0866 },
  { id: "misrata", name: "مصراتة", lat: 32.3754, lng: 15.0925 },
  { id: "zawiya", name: "الزاوية", lat: 32.7529, lng: 12.7278 },
  { id: "khoms", name: "الخمس", lat: 32.6489, lng: 14.2636 },
  { id: "zliten", name: "زليتن", lat: 32.4667, lng: 14.5667 },
  { id: "gharyan", name: "غريان", lat: 32.1706, lng: 13.0189 },
  { id: "tarhuna", name: "ترهونة", lat: 32.4333, lng: 13.6333 },
  { id: "bani-walid", name: "بني وليد", lat: 31.7667, lng: 13.9833 },
  { id: "yefren", name: "يفرن", lat: 32.0625, lng: 12.5231 },
  { id: "nalut", name: "نالوت", lat: 31.8692, lng: 10.9817 },
  { id: "zintan", name: "الزنتان", lat: 31.9333, lng: 12.25 },
  { id: "sirte", name: "سرت", lat: 31.2089, lng: 16.5887 },
  { id: "ajdabiya", name: "أجدابيا", lat: 30.7555, lng: 20.2253 },
  { id: "tobruk", name: "طبرق", lat: 32.0833, lng: 23.9667 },
  { id: "derna", name: "درنة", lat: 32.7672, lng: 22.6364 },
  { id: "bayda", name: "البيضاء", lat: 32.7627, lng: 21.755 },
  { id: "marj", name: "المرج", lat: 32.4975, lng: 20.8333 },
  { id: "sabha", name: "سبها", lat: 27.0377, lng: 14.4283 },
  { id: "ghadames", name: "غدامس", lat: 30.1333, lng: 9.5 },
  { id: "ghat", name: "غات", lat: 24.9647, lng: 10.175 },
  { id: "kufra", name: "الكفرة", lat: 24.2167, lng: 23.3 },
];

const CITY_KEY = "quran_prayer_city";
const REMINDER_KEY = "quran_prayer_reminder";
const REMINDER_SCHEDULED_KEY = "quran_prayer_reminder_scheduled";

export function getStoredCityId(): string {
  try {
    const stored = localStorage.getItem(CITY_KEY);
    if (stored && LIBYAN_CITIES.some((c) => c.id === stored)) return stored;
  } catch {
    // storage unavailable
  }
  return "tripoli";
}

export function setStoredCityId(id: string): void {
  try {
    localStorage.setItem(CITY_KEY, id);
  } catch {
    // storage unavailable
  }
}

export function getCity(id: string): LibyanCity {
  return LIBYAN_CITIES.find((c) => c.id === id) ?? LIBYAN_CITIES[0];
}

export function isPrayerReminderEnabled(): boolean {
  try {
    return localStorage.getItem(REMINDER_KEY) === "1";
  } catch {
    return false;
  }
}

function setPrayerReminderEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(REMINDER_KEY, enabled ? "1" : "0");
  } catch {
    // storage unavailable
  }
}

export interface DayPrayerTimes {
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
}

export function getPrayerTimes(date: Date, cityId: string): DayPrayerTimes {
  const city = getCity(cityId);
  const params = CalculationMethod.MuslimWorldLeague();
  const pt = new PrayerTimes(new Coordinates(city.lat, city.lng), date, params);
  return {
    fajr: pt.fajr,
    sunrise: pt.sunrise,
    dhuhr: pt.dhuhr,
    asr: pt.asr,
    maghrib: pt.maghrib,
    isha: pt.isha,
  };
}

// Next prayer from now (among the 5 prayers only — sunrise is not a
// prayer). After Isha, the next prayer is tomorrow's Fajr.
export function getNextPrayer(now: Date, cityId: string): { key: PrayerKey; time: Date } {
  const today = getPrayerTimes(now, cityId);
  for (const key of PRAYER_ORDER) {
    if (today[key].getTime() > now.getTime()) return { key, time: today[key] };
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const t = getPrayerTimes(tomorrow, cityId);
  return { key: "fajr", time: t.fajr };
}

export function formatPrayerTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

// "2 س 15 د" / "45 د" / "30 ث" — Arabic countdown for the next prayer.
export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h} س ${m} د`;
  if (m > 0) return `${m} د`;
  return `${s} ث`;
}

// ---- Reminders (native only) ----

const NOTIF_BASE_ID = 100;
const NOTIF_DAYS = 7;

function notificationIds(): Array<{ id: number }> {
  const ids: Array<{ id: number }> = [];
  for (let d = 0; d < NOTIF_DAYS; d++) {
    for (let i = 0; i < PRAYER_ORDER.length; i++) {
      ids.push({ id: NOTIF_BASE_ID + d * PRAYER_ORDER.length + i });
    }
  }
  return ids;
}

// Schedule the next 7 days of prayer notifications (5 per day).
// Returns a short status message in Arabic, or null on the web.
export async function schedulePrayerReminders(cityId: string): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") {
      setPrayerReminderEnabled(false);
      return "لم يُمنح إذن الإشعارات — فعّله من إعدادات الهاتف";
    }
    await LocalNotifications.cancel({ notifications: notificationIds() }).catch(() => {});
    const notifications = [];
    const now = new Date();
    for (let d = 0; d < NOTIF_DAYS; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() + d);
      const times = getPrayerTimes(date, cityId);
      for (let i = 0; i < PRAYER_ORDER.length; i++) {
        const key = PRAYER_ORDER[i];
        const at = times[key];
        if (at.getTime() <= now.getTime()) continue; // already passed
        notifications.push({
          id: NOTIF_BASE_ID + d * PRAYER_ORDER.length + i,
          title: `حان الآن وقت صلاة ${PRAYER_NAMES[key]} 🕌`,
          body: `صلاة ${PRAYER_NAMES[key]} — ${formatPrayerTime(at)}`,
          schedule: { at, allowWhileIdle: true },
        });
      }
    }
    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
    setPrayerReminderEnabled(true);
    try {
      localStorage.setItem(REMINDER_SCHEDULED_KEY, new Date().toDateString());
    } catch {
      // storage unavailable
    }
    return "التذكير مفعّل — ستصلك إشعارات الصلوات";
  } catch {
    return "تعذّر ضبط التذكير — حاول مجددًا";
  }
}

export async function cancelPrayerReminders(): Promise<void> {
  setPrayerReminderEnabled(false);
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: notificationIds() }).catch(() => {});
  } catch {
    // ignore
  }
}

// Keep the 7-day window fresh: re-schedule once a day when the app opens
// (only if the reminder is enabled). Cheap and idempotent.
export async function ensurePrayerRemindersScheduled(cityId: string): Promise<void> {
  if (!isPrayerReminderEnabled()) return;
  try {
    const last = localStorage.getItem(REMINDER_SCHEDULED_KEY);
    if (last === new Date().toDateString()) return;
  } catch {
    // storage unavailable
  }
  await schedulePrayerReminders(cityId);
}
