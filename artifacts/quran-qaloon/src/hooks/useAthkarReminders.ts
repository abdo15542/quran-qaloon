// تذكيرا أذكار الصباح والمساء (1.0.67) + أذكار بعد الصلاة
// وأذكار النوم (1.0.68): إشعارات يومية (LocalNotifications).
// الصباح 400 والمساء 401 والنوم 407 بوقت ثابت يومي؛ أذكار بعد
// الصلاة 402–406 (اليوم) و412–416 (غدًا) عند كل صلاة + ١٠ دقائق،
// تُعاد جدولتها كلما فُتح التطبيق لأن مواقيت الصلاة تتغير يوميًا.
// النمط نفسه المستعمل في useWird: الإلغاء قبل الجدولة حتى لا
// يتكرر الإشعار عند تغيير الوقت، وطلب الإذن أولًا.
import { useEffect, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  getActiveLocation,
  getPrayerTimesForCoords,
  PRAYER_NAMES,
  PRAYER_ORDER,
} from "@/data/prayer-times";

const MORNING_ID = 400;
const EVENING_ID = 401;
const BEDTIME_ID = 407;
const AFTER_PRAYER_IDS_TODAY = [402, 403, 404, 405, 406];
const AFTER_PRAYER_IDS_TOMORROW = [412, 413, 414, 415, 416];
const AFTER_PRAYER_IDS = [...AFTER_PRAYER_IDS_TODAY, ...AFTER_PRAYER_IDS_TOMORROW];

const KEYS = {
  morning: "quran_athkar_morning_reminder",
  morningTime: "quran_athkar_morning_time",
  evening: "quran_athkar_evening_reminder",
  eveningTime: "quran_athkar_evening_time",
  bedtime: "quran_athkar_bedtime_reminder",
  bedtimeTime: "quran_athkar_bedtime_time",
  afterPrayer: "quran_athkar_after_prayer_reminder",
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

/** جدولة تذكير لمرة واحدة في وقت محدد. */
async function scheduleAt(
  id: number,
  title: string,
  body: string,
  at: Date,
): Promise<void> {
  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title,
        body,
        schedule: { at, allowWhileIdle: true },
      },
    ],
  });
}

/**
 * إعادة جدولة تذكيرات أذكار بعد الصلاة لليوم وغدًا (كل صلاة + ١٠
 * دقائق). تُستدعى عند التفعيل وعند كل فتح للتطبيق (من الرئيسية)،
 * لأن مواقيت الصلاة تتحرك يوميًا. لا تفعل شيئًا على الويب.
 */
export async function refreshAfterPrayerAthkar(): Promise<boolean> {
  if (loadStr(KEYS.afterPrayer, "0") !== "1") return false;
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") return false;
    await LocalNotifications.cancel({
      notifications: AFTER_PRAYER_IDS.map((id) => ({ id })),
    }).catch(() => {});
    const { lat, lng } = getActiveLocation();
    const now = new Date();
    for (let day = 0; day <= 1; day++) {
      const date = new Date(now);
      date.setDate(date.getDate() + day);
      const times = getPrayerTimesForCoords(date, lat, lng);
      const ids = day === 0 ? AFTER_PRAYER_IDS_TODAY : AFTER_PRAYER_IDS_TOMORROW;
      for (let i = 0; i < PRAYER_ORDER.length; i++) {
        const key = PRAYER_ORDER[i];
        const at = new Date(times[key].getTime() + 10 * 60 * 1000);
        if (at.getTime() <= now.getTime()) continue;
        await scheduleAt(
          ids[i],
          "أذكار بعد الصلاة 🕌",
          `حان وقت أذكار بعد صلاة ${PRAYER_NAMES[key]}`,
          at,
        );
      }
    }
    return true;
  } catch {
    return false;
  }
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
  const [bedtimeEnabled, setBedtimeEnabled] = useState<boolean>(
    () => loadStr(KEYS.bedtime, "0") === "1",
  );
  const [bedtimeTime, setBedtimeTime] = useState<string>(() =>
    loadStr(KEYS.bedtimeTime, "22:00"),
  );
  const [afterPrayerEnabled, setAfterPrayerEnabled] = useState<boolean>(
    () => loadStr(KEYS.afterPrayer, "0") === "1",
  );
  const [status, setStatus] = useState<string | null>(null);

  // عند فتح صفحة الأذكار: حدّث جدولة أذكار بعد الصلاة لليوم وغدًا.
  useEffect(() => {
    if (afterPrayerEnabled) refreshAfterPrayerAthkar().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const setBedtime = useCallback(
    async (enabled: boolean, time: string) => {
      save(KEYS.bedtimeTime, time);
      setBedtimeTime(time);
      if (!Capacitor.isNativePlatform()) {
        save(KEYS.bedtime, enabled ? "1" : "0");
        setBedtimeEnabled(enabled);
        setStatus(
          enabled
            ? "التذكير يُفعَّل على الهاتف فقط — سيعمل بعد تثبيت النسخة"
            : "تم إيقاف تذكير أذكار النوم",
        );
        return;
      }
      try {
        if (enabled) {
          const ok = await scheduleOne(
            BEDTIME_ID,
            "أذكار النوم 🌙",
            "حان وقت أذكار النوم",
            time,
          );
          if (!ok) {
            save(KEYS.bedtime, "0");
            setBedtimeEnabled(false);
            setStatus("لم يُمنح إذن الإشعارات — فعّله من إعدادات الهاتف");
            return;
          }
          save(KEYS.bedtime, "1");
          setBedtimeEnabled(true);
          setStatus(`تذكير أذكار النوم مفعّل يوميًا الساعة ${time}`);
        } else {
          await LocalNotifications.cancel({
            notifications: [{ id: BEDTIME_ID }],
          }).catch(() => {});
          save(KEYS.bedtime, "0");
          setBedtimeEnabled(false);
          setStatus("تم إيقاف تذكير أذكار النوم");
        }
      } catch {
        setStatus("تعذّر ضبط التذكير — حاول مجددًا");
      }
    },
    [],
  );

  const setAfterPrayer = useCallback(async (enabled: boolean) => {
    if (!Capacitor.isNativePlatform()) {
      save(KEYS.afterPrayer, enabled ? "1" : "0");
      setAfterPrayerEnabled(enabled);
      setStatus(
        enabled
          ? "التذكير يُفعَّل على الهاتف فقط — سيعمل بعد تثبيت النسخة"
          : "تم إيقاف تذكير أذكار بعد الصلاة",
      );
      return;
    }
    try {
      if (enabled) {
        const perm = await LocalNotifications.requestPermissions();
        if (perm.display !== "granted") {
          save(KEYS.afterPrayer, "0");
          setAfterPrayerEnabled(false);
          setStatus("لم يُمنح إذن الإشعارات — فعّله من إعدادات الهاتف");
          return;
        }
        save(KEYS.afterPrayer, "1");
        setAfterPrayerEnabled(true);
        await refreshAfterPrayerAthkar();
        setStatus("تذكير أذكار بعد الصلاة مفعّل — بعد كل صلاة بـ ١٠ دقائق");
      } else {
        await LocalNotifications.cancel({
          notifications: AFTER_PRAYER_IDS.map((id) => ({ id })),
        }).catch(() => {});
        save(KEYS.afterPrayer, "0");
        setAfterPrayerEnabled(false);
        setStatus("تم إيقاف تذكير أذكار بعد الصلاة");
      }
    } catch {
      setStatus("تعذّر ضبط التذكير — حاول مجددًا");
    }
  }, []);

  return {
    morningEnabled,
    morningTime,
    eveningEnabled,
    eveningTime,
    bedtimeEnabled,
    bedtimeTime,
    afterPrayerEnabled,
    status,
    setMorning,
    setEvening,
    setBedtime,
    setAfterPrayer,
  };
}
