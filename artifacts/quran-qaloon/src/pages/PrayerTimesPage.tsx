// Prayer times page (أوقات الصلاة): today's five prayers + sunrise for
// the selected Libyan city, a live countdown to the next prayer, and an
// optional daily reminder notification for every prayer (native only).
// All times are calculated on-device with the `adhan` library — no
// internet and no location permission needed.

import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { ArrowRight, Moon, Sun, Bell, BellOff, Clock } from "lucide-react";
import {
  LIBYAN_CITIES,
  PRAYER_NAMES,
  PRAYER_ORDER,
  getStoredCityId,
  setStoredCityId,
  getPrayerTimes,
  getNextPrayer,
  formatPrayerTime,
  formatCountdown,
  isPrayerReminderEnabled,
  schedulePrayerReminders,
  cancelPrayerReminders,
  ensurePrayerRemindersScheduled,
} from "@/data/prayer-times";

interface PrayerTimesPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export default function PrayerTimesPage({ darkMode, toggleDarkMode }: PrayerTimesPageProps) {
  const [cityId, setCityId] = useState<string>(getStoredCityId);
  const [now, setNow] = useState(() => new Date());
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(isPrayerReminderEnabled);
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);

  // Live clock for the countdown (updates every 30 seconds — enough for
  // a minute-level countdown and cheap on battery).
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(t);
  }, []);

  // Keep the 7-day reminder window fresh whenever this page opens.
  useEffect(() => {
    if (reminderEnabled) {
      ensurePrayerRemindersScheduled(cityId).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const times = useMemo(() => getPrayerTimes(now, cityId), [now, cityId]);
  const next = useMemo(() => getNextPrayer(now, cityId), [now, cityId]);
  const city = LIBYAN_CITIES.find((c) => c.id === cityId) ?? LIBYAN_CITIES[0];
  const todayLabel = new Intl.DateTimeFormat("ar-LY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);

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
        const msg = await schedulePrayerReminders(cityId);
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
        {/* City */}
        <div className="bg-card border border-border rounded-2xl p-4">
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
