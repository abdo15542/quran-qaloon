// Prayer times (أوقات الصلاة) for Libyan cities, calculated fully offline
// with the `adhan` library (Muslim World League method — the method used
// in Libya; Shafi Asr, as in the Maliki school) PLUS the adjustments of
// the official Libyan Awqaf timetable (تقويم الهيئة العامة للأوقاف):
// raw MWL does NOT match what Libyan mosques actually call — verified
// 2026-11-19 against the Awqaf's own published times (Tripoli 7-Jul-2026
// via @AwqafLibya; Khoms/Tripoli/Benghazi 19-Nov-2026 Awqaf tables):
// the mosque calls Fajr ~3 min EARLIER and Dhuhr/Maghrib ~3 min and
// Isha ~6 min LATER than raw MWL. With the adjustments below all four
// checkpoints reproduce the published times within ±1 minute. The user
// can still fine-tune each prayer by ±10 minutes (ضبط دقائق الأوقات)
// to match his own mosque exactly. No network, no location permission:
// the user picks their city from the list. Times are in the device's
// local timezone, so they are correct on the user's phone.
// Reminders are native local notifications (id ranges 100-134 adhan,
// 200-234 five-minute pre-alert, 300-334 iqama — 7 days x 5 prayers
// each), re-scheduled whenever the app opens so the window never
// runs out.

import { Coordinates, CalculationMethod, PrayerTimes } from "adhan";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Geolocation } from "@capacitor/geolocation";
import {
  canScheduleExactAdhanAlarms,
  openExactAlarmSettings,
  scheduleNativeAdhanAlarms,
  cancelNativeAdhanAlarms,
  testNativeAdhan,
  type AdhanAlarmItem,
} from "@/lib/adhan-alarm";

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
const NATIVE_ADHAN_STATE_KEY = "quran_prayer_native_adhan";
const MODE_KEY = "quran_prayer_mode";
const COORDS_KEY = "quran_prayer_coords";
const PRE_ALERT_KEY = "quran_prayer_pre_alert";
const IQAMA_ENABLED_KEY = "quran_iqama_enabled";
const IQAMA_DELAYS_KEY = "quran_iqama_delays";

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

// Open the Android system Location settings, so the user can switch
// Location on with one tap when detection fails. Uses an intent:
// URL, which the Capacitor WebView hands to the system; on web it
// is a no-op (there are no system location settings to open).
export function openLocationSettings(): void {
  if (!Capacitor.isNativePlatform()) return;
  window.location.href = "intent:#Intent;action=android.settings.LOCATION_SOURCE_SETTINGS;end";
}

// The location the app should use right now: in auto mode the stored
// GPS coordinates (or the manual city when nothing was detected yet),
// in manual mode the selected city.
export function getActiveLocation(): { lat: number; lng: number; label: string; cityId: string } {
  if (getStoredMode() === "auto") {
    const coords = getStoredCoords();
    // Stored GPS coordinates NEVER expire: they are the user's home
    // until a new detection replaces them. (Expiring them after 24h
    // silently fell back to the saved manual city — e.g. بني وليد while
    // the user lives in زليتن — shifting every prayer by 2–4 minutes
    // until the next manual «تحديث الموقع», which is exactly the
    // «اضغط على الموقع فيتغير التوقيت» the user reported. The prayer
    // page re-detects on every open in auto mode, so travelling still
    // updates the position; a stale home position is always a better
    // fallback than a different city.)
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

// ---- Pre-alert (5 minutes before) and iqama (الإقامة) ----

// Minutes between the adhan and the iqama for each prayer, as practised
// in Libyan mosques (Fajr 20, Dhuhr 15, Asr 15, Maghrib 10, Isha 15).
// Adjustable from the prayer page, 0-30 minutes.
export const DEFAULT_IQAMA_DELAYS: Record<PrayerKey, number> = {
  fajr: 20,
  dhuhr: 15,
  asr: 15,
  maghrib: 10,
  isha: 15,
};

export function getIqamaDelays(): Record<PrayerKey, number> {
  try {
    const raw = localStorage.getItem(IQAMA_DELAYS_KEY);
    if (!raw) return { ...DEFAULT_IQAMA_DELAYS };
    const parsed = JSON.parse(raw) as Partial<Record<PrayerKey, unknown>>;
    const out = { ...DEFAULT_IQAMA_DELAYS };
    for (const key of PRAYER_ORDER) {
      const v = parsed[key];
      if (typeof v === "number" && v >= 0 && v <= 30) out[key] = v;
    }
    return out;
  } catch {
    return { ...DEFAULT_IQAMA_DELAYS };
  }
}

export function setIqamaDelays(delays: Record<PrayerKey, number>): void {
  try {
    localStorage.setItem(IQAMA_DELAYS_KEY, JSON.stringify(delays));
  } catch {
    // storage unavailable
  }
}

// Both default ON — the user asked for them. The key being absent
// means "not chosen yet", which is ON.
export function isPreAlertEnabled(): boolean {
  try {
    return localStorage.getItem(PRE_ALERT_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setPreAlertEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(PRE_ALERT_KEY, enabled ? "1" : "0");
  } catch {
    // storage unavailable
  }
}

export function isIqamaEnabled(): boolean {
  try {
    return localStorage.getItem(IQAMA_ENABLED_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setIqamaEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(IQAMA_ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    // storage unavailable
  }
}

// Iqama time for one prayer on one day: adhan + the configured delay.
export function getIqamaTime(date: Date, key: PrayerKey, lat: number, lng: number): Date {
  const times = getPrayerTimesForCoords(date, lat, lng);
  return new Date(times[key].getTime() + getIqamaDelays()[key] * 60000);
}

// The prayer whose adhan has passed but whose iqama has not come yet
// (today), if any — for the live "الإقامة بعد X" countdown.
export function getCurrentIqama(now: Date, lat: number, lng: number): { key: PrayerKey; time: Date } | null {
  const times = getPrayerTimesForCoords(now, lat, lng);
  const delays = getIqamaDelays();
  for (const key of PRAYER_ORDER) {
    const iqama = new Date(times[key].getTime() + delays[key] * 60000);
    if (times[key].getTime() <= now.getTime() && iqama.getTime() > now.getTime()) {
      return { key, time: iqama };
    }
  }
  return null;
}

export interface DayPrayerTimes {
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
}

// Official Libyan Awqaf timetable adjustments (minutes) on top of raw
// MWL — see the file header for the verification (four checkpoints,
// all within ±1 min of the published Awqaf times). Isha is +6 as the
// midpoint of the observed +5 (Nov) to +7 (Jul) seasonal spread.
export const AWQAF_ADJUSTMENTS: Record<PrayerKey | "sunrise", number> = {
  fajr: -3,
  sunrise: -1,
  dhuhr: 3,
  asr: 0,
  maghrib: 3,
  isha: 6,
};

// Per-prayer fine-tuning by the user (minutes, −10..+10, default 0),
// so each prayer can be matched to his own mosque exactly. Applied on
// top of the Awqaf adjustments, everywhere times are computed.
const TIME_ADJUSTMENTS_KEY = "quran_prayer_time_adjustments";

export function getPrayerTimeAdjustments(): Record<PrayerKey, number> {
  const zero: Record<PrayerKey, number> = { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
  try {
    const raw = localStorage.getItem(TIME_ADJUSTMENTS_KEY);
    if (!raw) return zero;
    const parsed = JSON.parse(raw) as Partial<Record<PrayerKey, unknown>>;
    const out = { ...zero };
    for (const key of PRAYER_ORDER) {
      const v = parsed[key];
      if (typeof v === "number" && Number.isFinite(v)) {
        out[key] = Math.min(10, Math.max(-10, Math.round(v)));
      }
    }
    return out;
  } catch {
    return zero;
  }
}

export function setPrayerTimeAdjustments(adj: Record<PrayerKey, number>): void {
  try {
    localStorage.setItem(TIME_ADJUSTMENTS_KEY, JSON.stringify(adj));
  } catch {
    // storage unavailable
  }
}

export function getPrayerTimesForCoords(date: Date, lat: number, lng: number): DayPrayerTimes {
  const params = CalculationMethod.MuslimWorldLeague();
  const user = getPrayerTimeAdjustments();
  params.adjustments = {
    fajr: AWQAF_ADJUSTMENTS.fajr + user.fajr,
    sunrise: AWQAF_ADJUSTMENTS.sunrise,
    dhuhr: AWQAF_ADJUSTMENTS.dhuhr + user.dhuhr,
    asr: AWQAF_ADJUSTMENTS.asr + user.asr,
    maghrib: AWQAF_ADJUSTMENTS.maghrib + user.maghrib,
    isha: AWQAF_ADJUSTMENTS.isha + user.isha,
  };
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

// The adhan itself is played by the native alarm (see adhan-alarm.ts):
// an exact AlarmManager alarm starts a foreground service whose
// MediaPlayer plays the whole adhan.mp3 on the ALARM stream. The
// notification channel below is only the FALLBACK, used when the
// exact-alarm permission is not granted: on Android 8+ a
// notification's sound lives on its channel, so the channel is
// created (once — Android keeps the first creation) with the bundled
// adhan.mp3 (android/app/src/main/res/raw/adhan.mp3, the full 124s
// file) before scheduling.
export const ADHAN_CHANNEL_ID = "prayer-adhan";

// Fajr has its own channel with the Fajr adhan as its sound, so the
// fallback path (exact-alarm permission not granted) also plays
// «الصلاة خير من النوم» at Fajr instead of the regular adhan.
export const ADHAN_FAJR_CHANNEL_ID = "prayer-adhan-fajr";

// ---- Adhan voices (اختيار صوت المؤذن) ----

// The regular adhan (not Fajr — Fajr always plays the Mishary Fajr
// adhan, adhan_fajr.mp3) can be one of these voices. All files live in
// android/app/src/main/res/raw/; "a3" is the bundled default (the full
// AlAdhan a3, 124s, res/raw/adhan.mp3). The rest come from the
// Kiwifu/adhan-mp3 collection (raw.githubusercontent.com): each was
// verified complete (full adhan sequence, no «الصلاة خير من النوم»)
// before bundling — Makkah 246s, Madinah 190s, Mishary 155s,
// Al-Aqsa 152s, Abdulbasit 245s.
export const ADHAN_VOICES: { id: string; name: string }[] = [
  { id: "a3", name: "الأذان الافتراضي" },
  { id: "makkah", name: "مكة المكرمة — علي ملا" },
  { id: "madinah", name: "المدينة المنورة — الحرم المدني" },
  { id: "mishary", name: "مشاري العفاسي" },
  { id: "aqsa", name: "المسجد الأقصى — القدس" },
  { id: "abdulbasit", name: "عبد الباسط عبد الصمد" },
];

const ADHAN_VOICE_KEY = "quran_adhan_voice";

export function getAdhanVoice(): string {
  try {
    const v = localStorage.getItem(ADHAN_VOICE_KEY) ?? "a3";
    return ADHAN_VOICES.some((x) => x.id === v) ? v : "a3";
  } catch {
    return "a3";
  }
}

export function setAdhanVoice(id: string): void {
  try {
    localStorage.setItem(ADHAN_VOICE_KEY, id);
  } catch {
    // storage unavailable
  }
}

/** Channel id for the fallback adhan notification of the given voice. */
export function adhanChannelIdForVoice(voice: string): string {
  return voice === "a3" ? ADHAN_CHANNEL_ID : `prayer-adhan-${voice}`;
}

/** Raw resource file name for the voice (without the res/raw/ prefix). */
export function adhanSoundForVoice(voice: string): string {
  return voice === "a3" ? "adhan.mp3" : `adhan_${voice}.mp3`;
}

// The pre-alert (5 minutes before) and the iqama use a second channel
// with the system default sound — a short alert, not the adhan.
// Both channels vibrate, so the phone alerts in vibrate mode too.
export const REMINDER_CHANNEL_ID = "prayer-reminder";

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

export async function createFajrAdhanChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: ADHAN_FAJR_CHANNEL_ID,
      name: "أذان الفجر",
      description: "تذكير بصوت أذان الفجر عند وقت صلاة الفجر",
      sound: "adhan_fajr.mp3",
      importance: 5,
      vibration: true,
      lights: true,
    });
  } catch {
    // channel creation is best-effort; scheduling still proceeds
  }
}

// Fallback channel for a chosen voice: created on demand when the
// user picks that voice. Android keeps the FIRST creation of a
// channel, so a voice channel is created once and then reused.
export async function createVoiceAdhanChannel(voice: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (voice === "a3") {
    await createPrayerChannel();
    return;
  }
  const v = ADHAN_VOICES.find((x) => x.id === voice);
  if (!v) return;
  try {
    await LocalNotifications.createChannel({
      id: adhanChannelIdForVoice(voice),
      name: `أذان — ${v.name}`,
      description: "تذكير بصوت الأذان عند وقت كل صلاة",
      sound: adhanSoundForVoice(voice),
      importance: 5,
      vibration: true,
      lights: true,
    });
  } catch {
    // channel creation is best-effort; scheduling still proceeds
  }
}

export async function createReminderChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: REMINDER_CHANNEL_ID,
      name: "تذكير الصلوات",
      description: "تنبيه قبل الصلاة بخمس دقائق وتنبيه الإقامة",
      importance: 4,
      vibration: true,
      lights: true,
    });
  } catch {
    // channel creation is best-effort; scheduling still proceeds
  }
}

// Open one channel's system settings page, so the user can allow the
// notification to bypass Do Not Disturb / silent mode for that channel.
// Android itself silences app sounds in silent mode — this system
// switch is the way to let the adhan through. Uses an intent: URL,
// like openLocationSettings; on web it is a no-op.
export function openNotificationChannelSettings(channelId: string): void {
  if (!Capacitor.isNativePlatform()) return;
  window.location.href =
    "intent:#Intent;action=android.settings.CHANNEL_NOTIFICATION_SETTINGS" +
    `;S.android.provider.extra.CHANNEL_ID=${channelId}` +
    ";S.android.provider.extra.APP_PACKAGE=ly.quran.qaloon;end";
}

const NOTIF_BASE_ID = 100;
const PRE_ALERT_BASE_ID = 200;
const IQAMA_BASE_ID = 300;
const NOTIF_DAYS = 7;

// The adhan notification ids (100-134) only, for cancelling the
// fallback adhan without touching the pre-alert / iqama sets.
function adhanNotificationIds(): Array<{ id: number }> {
  const ids: Array<{ id: number }> = [];
  for (let d = 0; d < NOTIF_DAYS; d++) {
    for (let i = 0; i < PRAYER_ORDER.length; i++) {
      ids.push({ id: NOTIF_BASE_ID + d * PRAYER_ORDER.length + i });
    }
  }
  return ids;
}

function allNotificationIds(): Array<{ id: number }> {
  const ids: Array<{ id: number }> = [];
  for (const base of [NOTIF_BASE_ID, PRE_ALERT_BASE_ID, IQAMA_BASE_ID]) {
    for (let d = 0; d < NOTIF_DAYS; d++) {
      for (let i = 0; i < PRAYER_ORDER.length; i++) {
        ids.push({ id: base + d * PRAYER_ORDER.length + i });
      }
    }
  }
  // The test notifications (id 999 regular, 998 Fajr — «جرّب صوت
  // الأذان» / «جرّب أذان الفجر») are not part of the daily sets —
  // include them so cancelling the reminders never leaves a stale
  // test adhan behind.
  ids.push({ id: 999 });
  ids.push({ id: 998 });
  return ids;
}

// ---- Native adhan alarms (the full adhan) ----

// The adhan itself is NOT a notification sound any more: a
// notification's sound stops when it is dismissed, is silenced in
// silent / DND mode, and — without the exact-alarm permission — is
// scheduled with an inexact alarm that Doze can delay or skip. The
// native alarm plays the whole adhan on the ALARM stream instead.
// Returns true when the native path is in use (exact-alarm permission
// granted); false means the app falls back to the sounding
// notification channel (the old behaviour).
async function scheduleNativeAlarmsForCoords(lat: number, lng: number): Promise<boolean> {
  if (!(await canScheduleExactAdhanAlarms())) return false;
  const alarms: AdhanAlarmItem[] = [];
  const voice = getAdhanVoice();
  const now = new Date();
  for (let d = 0; d < NOTIF_DAYS; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const times = getPrayerTimesForCoords(date, lat, lng);
    for (let i = 0; i < PRAYER_ORDER.length; i++) {
      const key = PRAYER_ORDER[i];
      const at = times[key];
      if (at.getTime() > now.getTime()) {
        alarms.push({
          id: NOTIF_BASE_ID + d * PRAYER_ORDER.length + i,
          at: at.getTime(),
          title: `حان الآن وقت صلاة ${PRAYER_NAMES[key]} 🕌`,
          // Fajr alarms play the Fajr adhan (adhan_fajr.mp3, with
          // «الصلاة خير من النوم»); the rest play the chosen voice.
          fajr: key === "fajr",
          voice,
        });
      }
    }
  }
  return scheduleNativeAdhanAlarms(alarms);
}

// For the prayer page: is the full-adhan native path active right now?
export async function isExactAlarmGranted(): Promise<boolean> {
  return canScheduleExactAdhanAlarms();
}

// For the prayer page: open the system "Alarms & reminders" settings.
export async function openExactAlarmSettingsPage(): Promise<void> {
  await openExactAlarmSettings();
}

// Schedule the next 7 days of prayer notifications (5 per day) for the
// given coordinates: the adhan at prayer time (ids 100-134), a short
// alert 5 minutes before each prayer (ids 200-234, when enabled), and
// the iqama alert (ids 300-334, when enabled). Returns a short status
// message in Arabic, or null on the web.
export async function schedulePrayerRemindersForCoords(lat: number, lng: number): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") {
      // Notifications are denied — but the native adhan does NOT need
      // the notification permission: the alarm receiver starts the
      // foreground service and the adhan plays on the ALARM stream.
      // So only the notification-based ids are cancelled; the native
      // alarms stay armed and the reminder stays ON. (The service
      // notification's stop button is hidden while notifications are
      // denied — the adhan still stops by itself when the file ends.)
      await LocalNotifications.cancel({ notifications: allNotificationIds() }).catch(() => {});
      const nativeAdhan = await scheduleNativeAlarmsForCoords(lat, lng);
      if (nativeAdhan) setPrayerReminderEnabled(true);
      try {
        localStorage.setItem(REMINDER_SCHEDULED_KEY, new Date().toDateString());
      } catch {
        // storage unavailable
      }
      if (nativeAdhan) return "التذكير مفعّل";
      return "لم يُمنح إذن الإشعارات — فعّله من إعدادات الهاتف";
    }
    await createPrayerChannel();
    await createFajrAdhanChannel();
    await createVoiceAdhanChannel(getAdhanVoice());
    await createReminderChannel();
    await LocalNotifications.cancel({ notifications: allNotificationIds() }).catch(() => {});
    const preAlert = isPreAlertEnabled();
    const iqamaOn = isIqamaEnabled();
    const delays = getIqamaDelays();
    // The adhan itself: native exact alarms when the exact-alarm
    // permission is granted (full adhan, on time, even in silent
    // mode); otherwise the sounding notification channel below.
    const nativeAdhan = await scheduleNativeAlarmsForCoords(lat, lng);
    const notifications = [];
    const now = new Date();
    for (let d = 0; d < NOTIF_DAYS; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() + d);
      const times = getPrayerTimesForCoords(date, lat, lng);
      for (let i = 0; i < PRAYER_ORDER.length; i++) {
        const key = PRAYER_ORDER[i];
        const at = times[key];
        // Only as a fallback: when the native alarms are in use, the
        // foreground service already plays the adhan AND shows its
        // own notification — posting this one too would play the
        // adhan twice at once.
        if (!nativeAdhan && at.getTime() > now.getTime()) {
          notifications.push({
            id: NOTIF_BASE_ID + d * PRAYER_ORDER.length + i,
            title: `حان الآن وقت صلاة ${PRAYER_NAMES[key]} 🕌`,
            body: `صلاة ${PRAYER_NAMES[key]} — ${formatPrayerTime(at)}`,
            schedule: { at, allowWhileIdle: true },
            // Fajr fallback plays the Fajr adhan channel; the rest
            // play the channel of the chosen voice.
            channelId: key === "fajr" ? ADHAN_FAJR_CHANNEL_ID : adhanChannelIdForVoice(getAdhanVoice()),
          });
        }
        if (preAlert) {
          const preAt = new Date(at.getTime() - 5 * 60000);
          if (preAt.getTime() > now.getTime()) {
            notifications.push({
              id: PRE_ALERT_BASE_ID + d * PRAYER_ORDER.length + i,
              title: `بعد 5 دقائق: صلاة ${PRAYER_NAMES[key]} 🕌`,
              body: `استعد لصلاة ${PRAYER_NAMES[key]} — ${formatPrayerTime(at)}`,
              schedule: { at: preAt, allowWhileIdle: true },
              channelId: REMINDER_CHANNEL_ID,
            });
          }
        }
        if (iqamaOn) {
          const iqamaAt = new Date(at.getTime() + delays[key] * 60000);
          if (iqamaAt.getTime() > now.getTime()) {
            notifications.push({
              id: IQAMA_BASE_ID + d * PRAYER_ORDER.length + i,
              title: `حان وقت إقامة صلاة ${PRAYER_NAMES[key]} 🕌`,
              body: `أقيمت الصلاة — صلاة ${PRAYER_NAMES[key]}`,
              schedule: { at: iqamaAt, allowWhileIdle: true },
              channelId: REMINDER_CHANNEL_ID,
            });
          }
        }
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
    const parts = ["التذكير مفعّل"];
    if (preAlert) parts.push("تنبيه قبلها بـ 5 دقائق");
    if (iqamaOn) parts.push("تنبيه الإقامة");
    return parts.join("، ");
  } catch {
    return "تعذّر ضبط التذكير — حاول مجددًا";
  }
}

// Fire a real adhan in 5 seconds, so the user can hear the FULL
// adhan without waiting for a prayer time. Prefers the native player
// (the whole file); falls back to the notification sound when the
// exact-alarm permission is not granted. Pass true to test the Fajr
// adhan («الصلاة خير من النوم») instead of the regular one. Returns
// a status message, or null on the web.
export async function scheduleTestAdhanNotification(fajr = false): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") {
      return "لم يُمنح إذن الإشعارات — فعّله من إعدادات الهاتف";
    }
    if (await canScheduleExactAdhanAlarms()) {
      if (await testNativeAdhan(fajr)) {
        return fajr
          ? "سيُسمَع أذان الفجر كاملًا خلال ٥ ثوانٍ — أوقفْه من زر «إيقاف الأذان» في الإشعار"
          : "سيُسمَع الأذان كاملًا خلال ٥ ثوانٍ — أوقفْه من زر «إيقاف الأذان» في الإشعار";
      }
    }
    await createPrayerChannel();
    await createFajrAdhanChannel();
    const at = new Date(Date.now() + 5000);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: fajr ? 998 : 999,
          title: fajr ? "اختبار أذان الفجر 🕌" : "اختبار الأذان 🕌",
          body: fajr
            ? "هذا صوت أذان الفجر الذي سيسمع عند وقت صلاة الفجر"
            : "هذا صوت الأذان الذي سيسمع عند وقت كل صلاة",
          schedule: { at, allowWhileIdle: true },
          channelId: fajr ? ADHAN_FAJR_CHANNEL_ID : ADHAN_CHANNEL_ID,
        },
      ],
    });
    return fajr
      ? "سيصلك إشعار اختبار بصوت أذان الفجر خلال ٥ ثوانٍ"
      : "سيصلك إشعار اختبار بصوت الأذان خلال ٥ ثوانٍ";
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
  await cancelNativeAdhanAlarms();
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: allNotificationIds() }).catch(() => {});
  } catch {
    // ignore
  }
}

// Keep the 7-day window fresh: re-schedule once a day when the app opens
// (only if the reminder is enabled). Uses the active location — the
// stored GPS coordinates in auto mode, the selected city otherwise.
// The native adhan alarms are re-registered on EVERY app open (cheap
// and idempotent): a force-stop cancels all alarms, and this heals
// them as soon as the app opens again instead of waiting for tomorrow.
export async function ensurePrayerRemindersScheduled(): Promise<void> {
  if (!isPrayerReminderEnabled()) return;
  const loc = getActiveLocation();
  const nativeOn = await scheduleNativeAlarmsForCoords(loc.lat, loc.lng).catch(() => false);
  if (nativeOn) {
    // The native alarms are registered now, but a fallback adhan
    // notification (ids 100-134) from an earlier denied-state schedule
    // may still be pending — cancel it so the adhan never plays twice.
    await LocalNotifications.cancel({ notifications: adhanNotificationIds() }).catch(() => {});
  }
  try {
    const last = localStorage.getItem(REMINDER_SCHEDULED_KEY);
    const prevNative = localStorage.getItem(NATIVE_ADHAN_STATE_KEY);
    const nativeStr = nativeOn ? "1" : "0";
    // Already scheduled today with the same adhan path: nothing to do.
    // The native state is tracked so the on→off transition (exact
    // alarms revoked) still triggers an immediate fallback schedule
    // instead of waiting for tomorrow — otherwise a whole day would
    // pass with no adhan at all.
    if (last === new Date().toDateString() && prevNative === nativeStr) return;
    localStorage.setItem(NATIVE_ADHAN_STATE_KEY, nativeStr);
  } catch {
    // storage unavailable
  }
  await schedulePrayerRemindersForCoords(loc.lat, loc.lng);
}
