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
import { ArrowRight, Moon, Sun, Bell, BellOff, Clock, MapPin, RefreshCw } from "lucide-react";
import {
  LIBYAN_CITIES,
  PRAYER_NAMES,
  PRAYER_ORDER,
  getStoredCityId,
  setStoredCityId,
  getCity,
  getPrayerTimesForCoords,
  getNextPrayerForCoords,
  formatPrayerTime,
  formatCountdown,
  isPrayerReminderEnabled,
  schedulePrayerReminders,
  schedulePrayerRemindersForCoords,
  cancelPrayerReminders,
  ensurePrayerRemindersScheduled,
  getStoredMode,
  setStoredMode,
  getStoredCoords,
  setStoredCoords,
  getCurrentPosition,
  type PrayerLocationMode,
  type StoredCoords,
} from "@/data/prayer-times";

interface PrayerTimesPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export default function PrayerTimesPage({ darkMode, toggleDarkMode }: PrayerTimesPageProps) {
  const [mode, setMode] = useState<PrayerLocationMode>(getStoredMode);
  const [cityId, setCityId] = useState<string>(getStoredCityId);
  const [coords, setCoords] = useState<StoredCoords | null>(getStoredCoords);
  const [now, setNow] = useState(() => new Date());
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(isPrayerReminderEnabled);
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);

  // Live clock for the countdown (updates every 30 seconds — enough for
  // a minute-level countdown and cheap on battery).
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(t);
  }, []);

  // Detect the position (auto mode): on open, and whenever the user
  // taps «تحديث الموقع». On success the coordinates are stored, so the
  // Home card and the reminders keep using them until the next detection.
  const detectLocation = useCallback(async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const pos = await getCurrentPosition();
      const stored = setStoredCoords(pos.lat, pos.lng);
      setCoords(stored);
      // Re-schedule the reminders for the new location if they are on.
      if (isPrayerReminderEnabled()) {
        await schedulePrayerRemindersForCoords(pos.lat, pos.lng);
      }
    } catch {
      setLocationError("تعذّر تحديد موقعك — تحقق من إذن الموقع ومن تفعيل GPS، أو اختر مدينتك يدويًا");
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

  // The active location: GPS coordinates in auto mode (when detected),
  // the selected city otherwise.
  const active = useMemo(() => {
    if (mode === "auto" && coords) {
      return { lat: coords.lat, lng: coords.lng, label: getCity(coords.cityId).name, cityId: coords.cityId };
    }
    const city = LIBYAN_CITIES.find((c) => c.id === cityId) ?? LIBYAN_CITIES[0];
    return { lat: city.lat, lng: city.lng, label: city.name, cityId: city.id };
  }, [mode, coords, cityId]);

  const times = useMemo(
    () => getPrayerTimesForCoords(now, active.lat, active.lng),
    [now, active.lat, active.lng]
  );
  const next = useMemo(
    () => getNextPrayerForCoords(now, active.lat, active.lng),
    [now, active.lat, active.lng]
  );
  const todayLabel = new Intl.DateTimeFormat("ar-LY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);

  const handleModeChange = (m: PrayerLocationMode) => {
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
      }
    } finally {
      setReminderBusy(false);
    }
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
                    الأوقات محسوبة من إحداثيات جهازك — تتغير تلقائيًا عند السفر لمدينة أخرى
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
                <div className="text-sm text-muted-foreground">لم يُحدَّد موقعك بعد</div>
              )}
              {locationError && (
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-3">{locationError}</div>
              )}
              <div className="text-xs text-muted-foreground mt-2">{todayLabel}</div>
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
              <div className="text-xs text-muted-foreground mt-2">{todayLabel}</div>
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
        </div>

        {/* Today's prayers */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {PRAYER_ORDER.map((key) => {
            const time = times[key];
            const isNext = next.key === key && next.time.getTime() === time.getTime();
            const passed = time.getTime() <= now.getTime();
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
          <p className="text-xs text-muted-foreground">
            إشعار عند وقت كل صلاة، حتى والتطبيق مغلق. تُحسب الأوقات على جهازك دون إنترنت.
          </p>
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
