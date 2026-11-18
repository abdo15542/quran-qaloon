// Prayer times page (أوقات الصلاة): today's five prayers + sunrise,
// a live countdown to the next prayer, and an optional daily reminder
// notification for every prayer (native only). Times are calculated
// on-device with the `adhan` library — no internet needed.
//
// Location is automatic by default: the app reads the device's GPS
// position, computes the times from the real coordinates, and shows the
// nearest Libyan city. Travelling to another city updates the times
// automatically the next time the page opens (or on «تحديث الموقع»).
// The user can switch to manual city selection at any time; if the
// location permission is denied, the page falls back to manual.

import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "wouter";
import { ArrowRight, Moon, Sun, Bell, BellOff, Clock, MapPin, RefreshCw, Settings } from "lucide-react";
import {
  LIBYAN_CITIES,
  PRAYER_NAMES,
  PRAYER_ORDER,
  getStoredCityId,
  setStoredCityId,
  getPrayerTimesForCoords,
  getNextPrayerForCoords,
  getIqamaTime,
  getCurrentIqama,
  formatPrayerTime,
  formatCountdown,
  isPrayerReminderEnabled,
  isPreAlertEnabled,
  setPreAlertEnabled,
  isIqamaEnabled,
  setIqamaEnabled,
  getIqamaDelays,
  setIqamaDelays,
  ADHAN_VOICES,
  getAdhanVoice,
  setAdhanVoice,
  schedulePrayerReminders,
  schedulePrayerRemindersForCoords,
  cancelPrayerReminders,
  ensurePrayerRemindersScheduled,
  getStoredMode,
  setStoredMode,
  getStoredCoords,
  setStoredCoords,
  getActiveLocation,
  detectPrayerLocation,
  locationErrorMessage,
  openLocationSettings,
  enableReminderIfFirstRun,
  isExactAlarmGranted,
  openExactAlarmSettingsPage,
  type PrayerLocationMode,
  type PrayerKey,
  type StoredCoords,
} from "@/data/prayer-times";
import { formatHijriDate } from "@/data/hijri";

// Set once the exact-alarm settings have been opened automatically from
// the reminder toggle, so it does not pop up on every enable.
const EXACT_ALARM_PROMPTED_KEY = "quran_exact_alarm_prompted";

interface PrayerTimesPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export default function PrayerTimesPage({ darkMode, toggleDarkMode }: PrayerTimesPageProps) {
  const [mode, setMode] = useState<PrayerLocationMode>(getStoredMode);
  const [cityId, setCityId] = useState<string>(getStoredCityId);
  const [coords, setCoords] = useState<StoredCoords | null>(getStoredCoords);
  const [locatedVia, setLocatedVia] = useState<"gps" | "network" | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(isPrayerReminderEnabled);
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [preAlert, setPreAlert] = useState<boolean>(isPreAlertEnabled);
  const [iqamaOn, setIqamaOn] = useState<boolean>(isIqamaEnabled);
  const [adhanVoice, setAdhanVoiceState] = useState<string>(getAdhanVoice);
  const [iqamaDelays, setIqamaDelaysState] = useState<Record<PrayerKey, number>>(getIqamaDelays);

  // Live clock for the countdown (updates every 30 seconds — enough for
  // a minute-level countdown and cheap on battery).
  useEffect(() => {
    // Tick every second: the countdown shows seconds in the last
    // minute, and a 30s tick left the seconds frozen for up to half
    // a minute before jumping.
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Detect the position (auto mode): on open, and whenever the user
  // taps «تحديد موقعي» / «تحديث الموقع». GPS first, then the network
  // location (cell / Wi-Fi) which needs no GPS. On success the
  // coordinates are stored, so the Home card and the reminders keep
  // using them until the next detection.
  const detectLocation = useCallback(async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const pos = await detectPrayerLocation();
      const stored = setStoredCoords(pos.lat, pos.lng);
      setCoords(stored);
      setLocatedVia(pos.via);
      // Re-schedule the reminders for the new location if they are on.
      if (isPrayerReminderEnabled()) {
        await schedulePrayerRemindersForCoords(pos.lat, pos.lng);
      } else {
        // First run: the user asked for notifications with the adhan —
        // turn the reminder on now (the system dialog is the consent).
        const msg = await enableReminderIfFirstRun(pos.lat, pos.lng);
        if (msg) {
          setReminderEnabled(isPrayerReminderEnabled());
          setReminderStatus(msg);
        }
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : "unavailable";
      setLocationError(locationErrorMessage(reason));
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "auto") {
      detectLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Keep the 7-day reminder window fresh whenever this page opens.
  useEffect(() => {
    if (reminderEnabled) {
      ensurePrayerRemindersScheduled().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The active location: getActiveLocation() applies the 24h GPS expiry
  // (the same source Home and the scheduler use) — the page's raw coords
  // state has no expiry, so the page could show stale-location times
  // while the reminders were scheduled for the fallback city.
  const active = useMemo(() => {
    const loc = getActiveLocation();
    return { lat: loc.lat, lng: loc.lng, label: loc.label, cityId: loc.cityId };
  }, [mode, coords, cityId]);

  const times = useMemo(
    () => getPrayerTimesForCoords(now, active.lat, active.lng),
    [now, active.lat, active.lng]
  );
  const next = useMemo(
    () => getNextPrayerForCoords(now, active.lat, active.lng),
    [now, active.lat, active.lng]
  );
  // The prayer whose adhan passed but whose iqama has not come yet.
  const currentIqama = useMemo(
    () => (iqamaOn ? getCurrentIqama(now, active.lat, active.lng) : null),
    [now, active.lat, active.lng, iqamaOn, iqamaDelays]
  );
  const todayLabel = new Intl.DateTimeFormat("ar-LY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  // formatHijriDate returns "" when the Islamic calendar is unavailable
  // — hide the bullet too, so the line never ends with a dangling «•».
  const hijriLabel = formatHijriDate(now);

  const handleModeChange = (m: PrayerLocationMode) => {
    // Tapping the already-active «الموقع الحالي» button must re-detect
    // (React bails out on an unchanged mode, so the effect would not
    // re-run — that was the «ضغطت ولم يظهر شيء» bug).
    if (m === mode && m === "auto") {
      detectLocation();
      return;
    }
    setMode(m);
    setStoredMode(m);
    setLocationError(null);
    if (m === "manual") {
      // Re-schedule the reminders for the manual city if they are on.
      if (reminderEnabled) {
        schedulePrayerReminders(cityId).then((msg) => {
          if (msg) setReminderStatus(msg);
        });
      }
    }
  };

  const handleCityChange = (id: string) => {
    setCityId(id);
    setStoredCityId(id);
    // Re-schedule the reminders for the new city if they are on.
    if (reminderEnabled) {
      schedulePrayerReminders(id).then((msg) => {
        if (msg) setReminderStatus(msg);
      });
    }
  };

  const handleReminderToggle = async () => {
    if (reminderBusy) return;
    setReminderBusy(true);
    try {
      if (reminderEnabled) {
        await cancelPrayerReminders();
        setReminderEnabled(false);
        setReminderStatus("تم إيقاف تذكير الصلوات");
      } else {
        const msg = await schedulePrayerRemindersForCoords(active.lat, active.lng);
        setReminderEnabled(isPrayerReminderEnabled());
        if (msg) setReminderStatus(msg);
        else setReminderStatus("التذكير يُفعَّل على الهاتف فقط — سيعمل بعد تثبيت النسخة");
        // No instruction text in the UI any more — but if the
        // exact-alarm permission is missing, the native adhan silently
        // falls back to the notification sound with no remedy in the
        // app. Open the system settings ONCE so it can be granted;
        // afterwards the Home card's status line is the way back in.
        if (isPrayerReminderEnabled() && !(await isExactAlarmGranted())) {
          try {
            if (!localStorage.getItem(EXACT_ALARM_PROMPTED_KEY)) {
              localStorage.setItem(EXACT_ALARM_PROMPTED_KEY, "1");
              await openExactAlarmSettingsPage();
            }
          } catch {
            // storage unavailable — open anyway, once per toggle
            await openExactAlarmSettingsPage();
          }
        }
      }
    } finally {
      setReminderBusy(false);
    }
  };

  // Re-schedule all three notification sets after a pre-alert / iqama
  // change (the scheduler cancels everything and rebuilds it).
  const reschedule = async () => {
    if (!reminderEnabled) return;
    const msg = await schedulePrayerRemindersForCoords(active.lat, active.lng);
    if (msg) setReminderStatus(msg);
  };

  const handlePreAlertToggle = async () => {
    const nextVal = !preAlert;
    setPreAlert(nextVal);
    setPreAlertEnabled(nextVal);
    await reschedule();
  };

  const handleIqamaToggle = async () => {
    const nextVal = !iqamaOn;
    setIqamaOn(nextVal);
    setIqamaEnabled(nextVal);
    await reschedule();
  };

  // Changing the adhan voice re-schedules the alarms (native + fallback
  // channel) so the next prayer already uses the new voice. Fajr is
  // untouched: it always plays the Mishary Fajr adhan.
  const handleVoiceChange = async (id: string) => {
    setAdhanVoiceState(id);
    setAdhanVoice(id);
    await reschedule();
    setReminderStatus(`صوت الأذان: ${ADHAN_VOICES.find((v) => v.id === id)?.name ?? id}`);
  };

  const handleIqamaDelay = async (key: PrayerKey, delta: number) => {
    const nextDelays = {
      ...iqamaDelays,
      [key]: Math.min(30, Math.max(0, iqamaDelays[key] + delta)),
    };
    setIqamaDelaysState(nextDelays);
    setIqamaDelays(nextDelays);
    await reschedule();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/">
              <button className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="رجوع">
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Clock className="w-5 h-5 text-primary" />
            <span className="font-arabic text-lg text-primary">أوقات الصلاة</span>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Location mode */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-center gap-1.5 mb-3">
            <button
              onClick={() => handleModeChange("auto")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-arabic transition-colors ${
                mode === "auto"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              الموقع الحالي (تلقائي)
            </button>
            <button
              onClick={() => handleModeChange("manual")}
              className={`px-3 py-1.5 rounded-full text-xs font-arabic transition-colors ${
                mode === "manual"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              اختر مدينة
            </button>
          </div>

          {mode === "auto" ? (
            <div className="text-center">
              {locating ? (
                <div className="text-sm text-muted-foreground">جارٍ تحديد موقعك…</div>
              ) : coords ? (
                <div>
                  <div className="flex items-center justify-center gap-1.5 text-base font-arabic text-foreground">
                    <MapPin className="w-4 h-4 text-primary" />
                    موقعك الحالي: قرب {active.label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    الأوقات محسوبة من إحداثيات جهازك
                    {locatedVia === "network" ? " عبر الشبكة (بدون GPS)" : " عبر GPS"}
                    {" "}— تتغير تلقائيًا عند السفر لمدينة أخرى
                  </div>
                  <button
                    onClick={detectLocation}
                    disabled={locating}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    تحديث الموقع
                  </button>
                </div>
              ) : (
                <div>
                  <div className="text-sm text-muted-foreground">لم يُحدَّد موقعك بعد</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    تُعرض حاليًا أوقات {active.label} (مدينتك المحفوظة) — حدّد موقعك لتظهر أوقات مكانك الحقيقي
                  </div>
                  <button
                    onClick={detectLocation}
                    disabled={locating}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    تحديد موقعي
                  </button>
                </div>
              )}
              {locationError && (
                <div>
                  <div className="text-xs text-amber-600 dark:text-amber-400 mt-3">{locationError}</div>
                  <button
                    onClick={openLocationSettings}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs text-foreground hover:border-primary/40 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    فتح إعدادات الموقع
                  </button>
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-2">{todayLabel}{hijriLabel ? ` • ${hijriLabel}` : ""}</div>
            </div>
          ) : (
            <div>
              <label className="text-xs text-muted-foreground block mb-2">المدينة</label>
              <select
                value={cityId}
                onChange={(e) => handleCityChange(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-base font-arabic focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {LIBYAN_CITIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="text-xs text-muted-foreground mt-2">{todayLabel}{hijriLabel ? ` • ${hijriLabel}` : ""}</div>
            </div>
          )}
        </div>

        {/* Next prayer */}
        <div className="bg-gradient-to-l from-primary/15 to-primary/5 border border-primary/30 rounded-2xl p-5 text-center">
          <div className="text-xs text-muted-foreground mb-1">الصلاة القادمة</div>
          <div className="font-arabic text-3xl text-primary mb-1">{PRAYER_NAMES[next.key]}</div>
          <div className="text-2xl font-bold tabular-nums">{formatPrayerTime(next.time)}</div>
          <div className="text-sm text-muted-foreground mt-1">
            متبقٍّ {formatCountdown(next.time.getTime() - now.getTime())}
          </div>
          {currentIqama && (
            <div className="text-sm text-emerald-600 dark:text-emerald-400 mt-2">
              الإقامة بعد {formatCountdown(currentIqama.time.getTime() - now.getTime())} — صلاة {PRAYER_NAMES[currentIqama.key]}
            </div>
          )}
        </div>

        {/* Today's prayers */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {PRAYER_ORDER.map((key) => {
            const time = times[key];
            // After Isha the next prayer is tomorrow's Fajr, whose time
            // is later than today's Fajr row — >= (not ===) so the Fajr
            // row is marked "next" instead of "ended" at night.
            const isNext = next.key === key && next.time.getTime() >= time.getTime();
            const passed = time.getTime() <= now.getTime();
            const iqamaTime = getIqamaTime(now, key, active.lat, active.lng);
            const iqamaNow = currentIqama?.key === key;
            return (
              <div
                key={key}
                className={`flex items-center justify-between px-5 py-3.5 border-b border-border last:border-b-0 ${
                  isNext ? "bg-primary/10" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-arabic text-base text-foreground">{PRAYER_NAMES[key]}</span>
                  {isNext && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground">القادمة</span>
                  )}
                  {passed && !isNext && (
                    <span className="text-xs text-muted-foreground">انتهت</span>
                  )}
                  {iqamaOn && !iqamaNow && iqamaTime.getTime() > now.getTime() && (
                    <span className="text-xs text-muted-foreground">الإقامة {formatPrayerTime(iqamaTime)}</span>
                  )}
                  {iqamaNow && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                      الإقامة بعد {formatCountdown(currentIqama.time.getTime() - now.getTime())}
                    </span>
                  )}
                </div>
                <span className={`text-lg font-bold tabular-nums ${isNext ? "text-primary" : "text-foreground"}`}>
                  {formatPrayerTime(time)}
                </span>
              </div>
            );
          })}
          <div className="flex items-center justify-between px-5 py-3 bg-muted/40">
            <span className="text-sm text-muted-foreground">الشروق</span>
            <span className="text-base font-bold tabular-nums text-muted-foreground">
              {formatPrayerTime(times.sunrise)}
            </span>
          </div>
        </div>

        {/* Reminder */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {reminderEnabled ? (
                <Bell className="w-5 h-5 text-primary" />
              ) : (
                <BellOff className="w-5 h-5 text-muted-foreground" />
              )}
              <span className="font-arabic text-base text-foreground">تذكير الصلوات</span>
            </div>
            <button
              onClick={handleReminderToggle}
              disabled={reminderBusy}
              className={`relative w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${
                reminderEnabled ? "bg-primary" : "bg-muted"
              }`}
              aria-label="تفعيل تذكير الصلوات أو إيقافه"
            >
              <span
                className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${
                  reminderEnabled ? "right-0.5" : "right-[calc(100%-1.625rem)]"
                }`}
              />
            </button>
          </div>
          {/* Adhan voice — the regular adhan only; Fajr always plays
              the Mishary Fajr adhan. */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <div>
              <div className="text-sm font-arabic text-foreground">صوت المؤذن</div>
              <div className="text-xs text-muted-foreground">أذان الفجر يبقى بصوت مشاري العفاسي دائمًا</div>
            </div>
            <select
              value={adhanVoice}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 max-w-[55%]"
              dir="rtl"
            >
              {ADHAN_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          {/* Pre-alert: 5 minutes before each prayer */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <div>
              <div className="text-sm font-arabic text-foreground">تنبيه قبل الصلاة بـ 5 دقائق</div>
              <div className="text-xs text-muted-foreground">إشعار قصير قبل كل صلاة لتستعد لها</div>
            </div>
            <button
              onClick={handlePreAlertToggle}
              disabled={!reminderEnabled}
              className={`relative w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${
                preAlert && reminderEnabled ? "bg-primary" : "bg-muted"
              }`}
              aria-label="تفعيل التنبيه قبل الصلاة أو إيقافه"
            >
              <span
                className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${
                  preAlert && reminderEnabled ? "right-0.5" : "right-[calc(100%-1.625rem)]"
                }`}
              />
            </button>
          </div>

          {/* Iqama */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <div>
              <div className="text-sm font-arabic text-foreground">تنبيه الإقامة</div>
              <div className="text-xs text-muted-foreground">إشعار عند وقت إقامة كل صلاة</div>
            </div>
            <button
              onClick={handleIqamaToggle}
              disabled={!reminderEnabled}
              className={`relative w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${
                iqamaOn && reminderEnabled ? "bg-primary" : "bg-muted"
              }`}
              aria-label="تفعيل تنبيه الإقامة أو إيقافه"
            >
              <span
                className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${
                  iqamaOn && reminderEnabled ? "right-0.5" : "right-[calc(100%-1.625rem)]"
                }`}
              />
            </button>
          </div>
          {iqamaOn && (
            <div className="mt-3 space-y-2">
              {PRAYER_ORDER.map((key) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="font-arabic text-foreground">إقامة صلاة {PRAYER_NAMES[key]}</span>
                  <span className="flex items-center gap-2">
                    <button
                      onClick={() => handleIqamaDelay(key, -5)}
                      disabled={!reminderEnabled || iqamaDelays[key] <= 0}
                      className="w-7 h-7 rounded-full bg-muted text-foreground disabled:opacity-40"
                      aria-label="تقليل وقت الإقامة"
                    >
                      −
                    </button>
                    <span className="w-12 text-center tabular-nums text-foreground">{iqamaDelays[key]} د</span>
                    <button
                      onClick={() => handleIqamaDelay(key, 5)}
                      disabled={!reminderEnabled || iqamaDelays[key] >= 30}
                      className="w-7 h-7 rounded-full bg-muted text-foreground disabled:opacity-40"
                      aria-label="زيادة وقت الإقامة"
                    >
                      +
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {reminderStatus && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-3">{reminderStatus}</p>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          طريقة الحساب: رابطة العالم الإسلامي — المعتمدة في ليبيا. الأوقات تقديرية وتعتمد على موقع المدينة.
        </p>
      </div>
    </div>
  );
}
