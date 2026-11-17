// Daily wird (الورد اليومي): a fixed daily portion of the Mushaf, tracked
// page by page, with a consecutive-day streak and an optional daily
// reminder notification (native only — the LocalNotifications plugin).
// Everything is stored in localStorage; the reminder is scheduled with the
// native plugin (Capacitor LocalNotifications, id 1) and fires every day
// at the chosen time, even when the app is closed.

import { useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const WIRD_NOTIFICATION_ID = 1;
const TOTAL_PAGES = 604;

const KEYS = {
  page: "quran_wird_page",
  perDay: "quran_wird_pages_per_day",
  lastDone: "quran_wird_last_done",
  streak: "quran_wird_streak",
  reminder: "quran_wird_reminder",
  reminderTime: "quran_wird_reminder_time",
};

function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayStr(d);
}

function loadNum(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function loadStr(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable
  }
}

function clampPage(p: number): number {
  if (!Number.isFinite(p) || p < 1) return 1;
  if (p > TOTAL_PAGES) return TOTAL_PAGES;
  return Math.floor(p);
}

export function useWird() {
  const [page, setPage] = useState<number>(() => clampPage(loadNum(KEYS.page, 1)));
  const [pagesPerDay, setPagesPerDayState] = useState<number>(() => {
    const n = loadNum(KEYS.perDay, 1);
    return Math.min(10, Math.max(1, Number.isFinite(n) ? Math.floor(n) : 1));
  });
  const [lastDone, setLastDone] = useState<string | null>(() => {
    try {
      return localStorage.getItem(KEYS.lastDone);
    } catch {
      return null;
    }
  });
  const [streak, setStreak] = useState<number>(() => loadNum(KEYS.streak, 0));
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(
    () => loadStr(KEYS.reminder, "0") === "1"
  );
  const [reminderTime, setReminderTime] = useState<string>(() =>
    loadStr(KEYS.reminderTime, "08:00")
  );
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);

  const todayDone = lastDone === todayStr();
  const startPage = page;
  const endPage = Math.min(TOTAL_PAGES, page + pagesPerDay - 1);

  // Mark today's portion done: advance the pointer to the next unread
  // page (wrapping to page 1 after the last page) and update the streak
  // (yesterday done -> +1, otherwise restart at 1).
  const markDoneToday = useCallback(() => {
    if (lastDone === todayStr()) return;
    const today = todayStr();
    const newStreak = lastDone === yesterdayStr() ? streak + 1 : 1;
    const nextPage = endPage >= TOTAL_PAGES ? 1 : endPage + 1;
    save(KEYS.lastDone, today);
    save(KEYS.streak, String(newStreak));
    save(KEYS.page, String(nextPage));
    setLastDone(today);
    setStreak(newStreak);
    setPage(nextPage);
  }, [lastDone, streak, endPage]);

  const setPagesPerDay = useCallback((n: number) => {
    const v = Math.min(10, Math.max(1, Math.floor(n)));
    save(KEYS.perDay, String(v));
    setPagesPerDayState(v);
  }, []);

  // Daily reminder: on the phone it schedules a native notification that
  // fires every day at the chosen time, even when the app is closed.
  // On the web there is no such API, so it only saves the setting.
  const setReminder = useCallback(
    async (enabled: boolean, time: string) => {
      save(KEYS.reminderTime, time);
      setReminderTime(time);
      if (!Capacitor.isNativePlatform()) {
        save(KEYS.reminder, enabled ? "1" : "0");
        setReminderEnabled(enabled);
        setReminderStatus(
          enabled
            ? "التذكير يُفعَّل على الهاتف فقط — سيعمل بعد تثبيت النسخة"
            : "تم إيقاف التذكير"
        );
        return;
      }
      try {
        if (enabled) {
          const perm = await LocalNotifications.requestPermissions();
          if (perm.display !== "granted") {
            save(KEYS.reminder, "0");
            setReminderEnabled(false);
            setReminderStatus("لم يُمنح إذن الإشعارات — فعّله من إعدادات الهاتف");
            return;
          }
          const [h, m] = time.split(":").map((x) => Number(x));
          // Cancel first so changing the time never leaves two reminders.
          await LocalNotifications.cancel({
            notifications: [{ id: WIRD_NOTIFICATION_ID }],
          }).catch(() => {});
          await LocalNotifications.schedule({
            notifications: [
              {
                id: WIRD_NOTIFICATION_ID,
                title: "وردك اليومي 📖",
                body: "حان وقت وردك اليومي من القرآن الكريم",
                schedule: {
                  on: { hour: h, minute: m },
                  repeats: true,
                  allowWhileIdle: true,
                },
              },
            ],
          });
          save(KEYS.reminder, "1");
          setReminderEnabled(true);
          setReminderStatus(`التذكير مفعّل يوميًا الساعة ${time}`);
        } else {
          await LocalNotifications.cancel({
            notifications: [{ id: WIRD_NOTIFICATION_ID }],
          }).catch(() => {});
          save(KEYS.reminder, "0");
          setReminderEnabled(false);
          setReminderStatus("تم إيقاف التذكير");
        }
      } catch {
        setReminderStatus("تعذّر ضبط التذكير — حاول مجددًا");
      }
    },
    []
  );

  return {
    startPage,
    endPage,
    pagesPerDay,
    streak,
    todayDone,
    lastDone,
    reminderEnabled,
    reminderTime,
    reminderStatus,
    markDoneToday,
    setPagesPerDay,
    setReminder,
  };
}
