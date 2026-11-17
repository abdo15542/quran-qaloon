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
import { Geolocation } from "@capacitor/geolocation";

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
const MODE_KEY = "quran_prayer_mode";
const COORDS_KEY = "quran_prayer_coords";

export type PrayerLocationMode = "auto" | "manual";

export interface StoredCoords {
  lat: number;
  lng: number;
  /** Nearest Libyan city at the time of detection (for display). */
  cityId: string;
  updatedAt: number;
}

export function getStoredMode(): PrayerLocationMode {
  try {
    return localStorage.getItem(MODE_KEY) === "manual" ? "manual" : "auto";
  } catch {
    return "auto";
  }
}

export function setStoredMode(mode: PrayerLocationMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // storage unavailable
  }
}

export function getStoredCoords(): StoredCoords | null {
  try {
    const raw = localStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as StoredCoords;
    if (typeof c.lat !== "number" || typeof c.lng !== "number") return null;
    return c;
  } catch {
    return null;
  }
}

export function setStoredCoords(lat: number, lng: number): StoredCoords {
  const city = findNearestCity(lat, lng);
  const coords: StoredCoords = { lat, lng, cityId: city.id, updatedAt: Date.now() };
  try {
    localStorage.setItem(COORDS_KEY, JSON.stringify(coords));
  } catch {
    // storage unavailable
  }
  return coords;
}

// Haversine distance in km between two points.
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function findNearestCity(lat: number, lng: number): LibyanCity {
  let best = LIBYAN_CITIES[0];
  let bestD = Infinity;
  for (const city of LIBYAN_CITIES) {
    const d = haversineKm(lat, lng, city.lat, city.lng);
    if (d < bestD) {
      bestD = d;
      best = city;
    }
  }
  return best;
}

// The device's current position (GPS on the phone, browser geolocation
// on the web). Throws when the permission is denied or no fix is
// available — callers fall back to the manual city.
export async function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  const pos = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 300000, // a fix up to 5 minutes old is fine for prayer times
  });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

export type LocationFailureReason = "denied" | "unavailable" | "timeout";

// Detect the position, asking for the location permission first (so the
// system dialog actually appears), then trying GPS and — if that fails
// — the network location (cell towers / Wi-Fi), which works WITHOUT
// turning GPS on. Returns how the position was found, so the UI can say
// so. Throws a reason code the UI turns into a clear message.
export async function detectPrayerLocation(): Promise<{
  lat: number;
  lng: number;
  via: "gps" | "network";
}> {
  // 1. Permission — explicit, so the user sees the system dialog.
  // IMPORTANT: requestPermissions() must be called whenever the
  // permission is not granted yet — checkPermissions() returns
  // 'denied' for the never-asked state too, and throwing there
  // (as 1.0.50 did) means the dialog NEVER appears. Only a
  // 'denied' result FROM requestPermissions() itself stops here.
  // On the web requestPermissions only reports the state, and the
  // prompt is triggered by getCurrentPosition below — so a 'prompt'
  // result proceeds as well.
  try {
    const status = await Geolocation.checkPermissions();
    if (status.location !== "granted") {
      const asked = await Geolocation.requestPermissions();
      if (asked.location === "denied") {
        throw new Error("denied");
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message === "denied") throw e;
    // check/request not supported (old web) — fall through and try anyway
  }
  // 2. GPS (high accuracy). Works WITHOUT internet (satellites
  // directly) — but a cold GPS fix offline can take up to ~30s
  // (no A-GPS assistance), so the timeout is generous; the cached
  // fix (up to 5 min old) makes repeat updates instant.
  try {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 300000,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude, via: "gps" };
  } catch {
    // 3. Network location — no GPS needed (cell / Wi-Fi).
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 600000,
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, via: "network" };
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : "";
      if (/denied|permission/i.test(msg)) throw new Error("denied");
      if (/timeout/i.test(msg)) throw new Error("timeout");
      throw new Error("unavailable");
    }
  }
}

export function locationErrorMessage(reason: string): string {
  if (reason === "denied")
    return "لم يُمنح إذن الموقع — فعّله من إعدادات الهاتف (التطبيق ← الأذونات ← الموقع)، أو اختر مدينتك يدويًا";
  if (reason === "timeout")
    return "انتهت مهلة تحديد الموقع — تأكد من تشغيل الموقع أو الإنترنت وحاول مجددًا، أو اختر مدينتك يدويًا";
  return "تعذّر تحديد موقعك — تأكد من تفعيل الموقع في الهاتف وحاول مجددًا، أو اختر مدينتك يدويًا";
}

// The location the app should use right now: in auto mode the stored
// GPS coordinates (or the manual city when nothing was detected yet),
// in manual mode the selected city.
export function getActiveLocation(): { lat: number; lng: number; label: string; cityId: string } {
  if (getStoredMode() === "auto") {
    const coords = getStoredCoords();
    if (coords) {
      return { lat: coords.lat, lng: coords.lng, label: getCity(coords.cityId).name, cityId: coords.cityId };
    }
  }
  const city = getCity(getStoredCityId());
  return { lat: city.lat, lng: city.lng, label: city.name, cityId: city.id };
}

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

export function getPrayerTimesForCoords(date: Date, lat: number, lng: number): DayPrayerTimes {
  const params = CalculationMethod.MuslimWorldLeague();
  const pt = new PrayerTimes(new Coordinates(lat, lng), date, params);
  return {
    fajr: pt.fajr,
    sunrise: pt.sunrise,
    dhuhr: pt.dhuhr,
    asr: pt.asr,
    maghrib: pt.maghrib,
    isha: pt.isha,
  };
}

export function getPrayerTimes(date: Date, cityId: string): DayPrayerTimes {
  const city = getCity(cityId);
  return getPrayerTimesForCoords(date, city.lat, city.lng);
}

// Next prayer from now (among the 5 prayers only — sunrise is not a
// prayer). After Isha, the next prayer is tomorrow's Fajr.
export function getNextPrayerForCoords(now: Date, lat: number, lng: number): { key: PrayerKey; time: Date } {
  const today = getPrayerTimesForCoords(now, lat, lng);
  for (const key of PRAYER_ORDER) {
    if (today[key].getTime() > now.getTime()) return { key, time: today[key] };
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const t = getPrayerTimesForCoords(tomorrow, lat, lng);
  return { key: "fajr", time: t.fajr };
}

export function getNextPrayer(now: Date, cityId: string): { key: PrayerKey; time: Date } {
  const city = getCity(cityId);
  return getNextPrayerForCoords(now, city.lat, city.lng);
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

// Prayer notifications play the adhan: on Android 8+ the sound lives
// on the notification CHANNEL, so the channel is created (once —
// Android keeps the first creation) with the bundled adhan.mp3
// (android/app/src/main/res/raw/adhan.mp3, 75s) before scheduling.
export const ADHAN_CHANNEL_ID = "prayer-adhan";

export async function createPrayerChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: ADHAN_CHANNEL_ID,
      name: "أوقات الصلاة",
      description: "تذكير بصوت الأذان عند وقت كل صلاة",
      sound: "adhan.mp3",
      importance: 5,
      vibration: true,
      lights: true,
    });
  } catch {
    // channel creation is best-effort; scheduling still proceeds
  }
}

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

// Schedule the next 7 days of prayer notifications (5 per day) for the
// given coordinates, on the adhan channel. Returns a short status
// message in Arabic, or null on the web.
export async function schedulePrayerRemindersForCoords(lat: number, lng: number): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") {
      setPrayerReminderEnabled(false);
      return "لم يُمنح إذن الإشعارات — فعّله من إعدادات الهاتف";
    }
    await createPrayerChannel();
    await LocalNotifications.cancel({ notifications: notificationIds() }).catch(() => {});
    const notifications = [];
    const now = new Date();
    for (let d = 0; d < NOTIF_DAYS; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() + d);
      const times = getPrayerTimesForCoords(date, lat, lng);
      for (let i = 0; i < PRAYER_ORDER.length; i++) {
        const key = PRAYER_ORDER[i];
        const at = times[key];
        if (at.getTime() <= now.getTime()) continue; // already passed
        notifications.push({
          id: NOTIF_BASE_ID + d * PRAYER_ORDER.length + i,
          title: `حان الآن وقت صلاة ${PRAYER_NAMES[key]} 🕌`,
          body: `صلاة ${PRAYER_NAMES[key]} — ${formatPrayerTime(at)}`,
          schedule: { at, allowWhileIdle: true },
          channelId: ADHAN_CHANNEL_ID,
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
    return "التذكير مفعّل — ستصلك إشعارات الصلوات بصوت الأذان";
  } catch {
    return "تعذّر ضبط التذكير — حاول مجددًا";
  }
}

// Fire a real prayer notification in 5 seconds, so the user can hear
// the adhan and see the notification without waiting for a prayer time.
// Returns a status message, or null on the web.
export async function scheduleTestAdhanNotification(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") {
      return "لم يُمنح إذن الإشعارات — فعّله من إعدادات الهاتف";
    }
    await createPrayerChannel();
    const at = new Date(Date.now() + 5000);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 999,
          title: "اختبار الأذان 🕌",
          body: "هذا صوت الأذان الذي سيسمع عند وقت كل صلاة",
          schedule: { at, allowWhileIdle: true },
          channelId: ADHAN_CHANNEL_ID,
        },
      ],
    });
    return "سيصلك إشعار اختبار بصوت الأذان خلال ٥ ثوانٍ";
  } catch {
    return "تعذّر إرسال إشعار الاختبار — حاول مجددًا";
  }
}

// First-run auto-enable: the user asked for prayer notifications with
// the adhan. The first time a location is detected successfully, turn
// the reminder on (the system permission dialog is the consent gate).
// A manual choice afterwards is respected: once the reminder key exists
// ("1" or "0"), this never runs again.
export async function enableReminderIfFirstRun(lat: number, lng: number): Promise<string | null> {
  try {
    if (localStorage.getItem(REMINDER_KEY) !== null) return null;
  } catch {
    return null;
  }
  return schedulePrayerRemindersForCoords(lat, lng);
}

export async function schedulePrayerReminders(cityId: string): Promise<string | null> {
  const city = getCity(cityId);
  return schedulePrayerRemindersForCoords(city.lat, city.lng);
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
// (only if the reminder is enabled). Uses the active location — the
// stored GPS coordinates in auto mode, the selected city otherwise.
// Cheap and idempotent.
export async function ensurePrayerRemindersScheduled(): Promise<void> {
  if (!isPrayerReminderEnabled()) return;
  try {
    const last = localStorage.getItem(REMINDER_SCHEDULED_KEY);
    if (last === new Date().toDateString()) return;
  } catch {
    // storage unavailable
  }
  const loc = getActiveLocation();
  await schedulePrayerRemindersForCoords(loc.lat, loc.lng);
}
