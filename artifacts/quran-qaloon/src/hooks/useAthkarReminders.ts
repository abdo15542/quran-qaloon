// تذكيرا أذكار الصباح والمساء: إشعاران يوميان (أصليان فقط —
// LocalNotifications، المعرّفان 400 و401) يفتحان صفحة الأذكار.
// النمط نفسه المستعمل في useWird: الإلغاء قبل الجدولة حتى لا
// يتكرر الإشعار عند تغيير الوقت، وطلب الإذن أولًا.
import { useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const MORNING_ID = 400;
const EVENING_ID = 401;

const KEYS = {
  morning: "quran_athkar_morning_reminder",
  morningTime: "quran_athkar_morning_time",
  evening: "quran_athkar_evening_reminder",
  eveningTime: "quran_athkar_evening_time",
};

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

async function scheduleOne(
  id: number,
  title: string,
  body: string,
  time: string,
): Promise<boolean> {
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== "granted") return false;
  const [h, m] = time.split(":").map((x) => Number(x));
  await LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => {});
  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title,
        body,
        schedule: {
          on: { hour: h, minute: m },
          repeats: true,
          allowWhileIdle: true,
        },
      },
    ],
  });
  return true;
}

export function useAthkarReminders() {
  const [morningEnabled, setMorningEnabled] = useState<boolean>(
    () => loadStr(KEYS.morning, "0") === "1",
  );
  const [morningTime, setMorningTime] = useState<string>(() =>
    loadStr(KEYS.morningTime, "06:30"),
  );
  const [eveningEnabled, setEveningEnabled] = useState<boolean>(
    () => loadStr(KEYS.evening, "0") === "1",
  );
  const [eveningTime, setEveningTime] = useState<string>(() =>
    loadStr(KEYS.eveningTime, "16:00"),
  );
  const [status, setStatus] = useState<string | null>(null);

  const setMorning = useCallback(
    async (enabled: boolean, time: string) => {
      save(KEYS.morningTime, time);
      setMorningTime(time);
      if (!Capacitor.isNativePlatform()) {
        save(KEYS.morning, enabled ? "1" : "0");
        setMorningEnabled(enabled);
        setStatus(
          enabled
            ? "التذكير يُفعَّل على الهاتف فقط — سيعمل بعد تثبيت النسخة"
            : "تم إيقاف تذكير أذكار الصباح",
        );
        return;
      }
      try {
        if (enabled) {
          const ok = await scheduleOne(
            MORNING_ID,
            "أذكار الصباح ☀️",
            "حان وقت أذكار الصباح",
            time,
          );
          if (!ok) {
            save(KEYS.morning, "0");
            setMorningEnabled(false);
            setStatus("لم يُمنح إذن الإشعارات — فعّله من إعدادات الهاتف");
            return;
          }
          save(KEYS.morning, "1");
          setMorningEnabled(true);
          setStatus(`تذكير أذكار الصباح مفعّل يوميًا الساعة ${time}`);
        } else {
          await LocalNotifications.cancel({
            notifications: [{ id: MORNING_ID }],
          }).catch(() => {});
          save(KEYS.morning, "0");
          setMorningEnabled(false);
          setStatus("تم إيقاف تذكير أذكار الصباح");
        }
      } catch {
        setStatus("تعذّر ضبط التذكير — حاول مجددًا");
      }
    },
    [],
  );

  const setEvening = useCallback(
    async (enabled: boolean, time: string) => {
      save(KEYS.eveningTime, time);
      setEveningTime(time);
      if (!Capacitor.isNativePlatform()) {
        save(KEYS.evening, enabled ? "1" : "0");
        setEveningEnabled(enabled);
        setStatus(
          enabled
            ? "التذكير يُفعَّل على الهاتف فقط — سيعمل بعد تثبيت النسخة"
            : "تم إيقاف تذكير أذكار المساء",
        );
        return;
      }
      try {
        if (enabled) {
          const ok = await scheduleOne(
            EVENING_ID,
            "أذكار المساء 🌙",
            "حان وقت أذكار المساء",
            time,
          );
          if (!ok) {
            save(KEYS.evening, "0");
            setEveningEnabled(false);
            setStatus("لم يُمنح إذن الإشعارات — فعّله من إعدادات الهاتف");
            return;
          }
          save(KEYS.evening, "1");
          setEveningEnabled(true);
          setStatus(`تذكير أذكار المساء مفعّل يوميًا الساعة ${time}`);
        } else {
          await LocalNotifications.cancel({
            notifications: [{ id: EVENING_ID }],
          }).catch(() => {});
          save(KEYS.evening, "0");
          setEveningEnabled(false);
          setStatus("تم إيقاف تذكير أذكار المساء");
        }
      } catch {
        setStatus("تعذّر ضبط التذكير — حاول مجددًا");
      }
    },
    [],
  );

  return {
    morningEnabled,
    morningTime,
    eveningEnabled,
    eveningTime,
    status,
    setMorning,
    setEvening,
  };
}
