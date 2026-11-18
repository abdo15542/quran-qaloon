// Native adhan alarm (Android only; no-op on web).
//
// The prayer notifications cannot guarantee a full adhan: their sound
// stops the moment the notification is dismissed, silent / DND mode
// silences it, and — without the exact-alarm permission — the plugin
// schedules them with an INEXACT alarm that Doze can delay or skip.
// So the adhan itself is played natively: an exact AlarmManager alarm
// (7 days x 5 prayers) starts a foreground service whose MediaPlayer
// plays the whole bundled adhan on the ALARM audio stream — on time,
// in full, even in silent mode, even with the app closed.
// The regular adhan is adhan.mp3 (the full AlAdhan a3, 124s); Fajr
// plays adhan_fajr.mp3 (Mishary, 187s, with «الصلاة خير من النوم»).
// The pre-alert and iqama stay as short notifications: they only
// need a beep, and the notification system is fine for that.
import { Capacitor, registerPlugin } from "@capacitor/core";

export interface AdhanAlarmItem {
  id: number;
  /** Epoch millis when the adhan must play. */
  at: number;
  title: string;
  /** True for Fajr alarms: play the Fajr adhan (adhan_fajr.mp3). */
  fajr?: boolean;
  /** Voice id for the regular adhan (see ADHAN_VOICES); "a3" = default. */
  voice?: string;
}

interface AdhanAlarmPlugin {
  canScheduleExactAlarms(): Promise<{ granted: boolean }>;
  openExactAlarmSettings(): Promise<void>;
  scheduleAlarms(options: { alarms: AdhanAlarmItem[] }): Promise<void>;
  cancelAlarms(): Promise<void>;
  stopAdhan(): Promise<void>;
  testAdhan(options?: { fajr?: boolean; voice?: string }): Promise<void>;
  updateWidgets(): Promise<void>;
}

const AdhanAlarm = registerPlugin<AdhanAlarmPlugin>("AdhanAlarm", {
  web: {
    async canScheduleExactAlarms() {
      return { granted: false };
    },
    async openExactAlarmSettings() {},
    async scheduleAlarms() {},
    async cancelAlarms() {},
    async stopAdhan() {},
    async testAdhan() {},
    async updateWidgets() {},
  },
});

/** True when the native exact-adhan path can be used (Android, exact-alarm permission granted). */
export async function canScheduleExactAdhanAlarms(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    return (await AdhanAlarm.canScheduleExactAlarms()).granted;
  } catch {
    return false;
  }
}

/** Open the system "Alarms & reminders" settings for this app (native only). */
export async function openExactAlarmSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AdhanAlarm.openExactAlarmSettings();
  } catch {
    // ignore
  }
}

/** Replace the stored native alarm set. Returns false when it could not be scheduled. */
export async function scheduleNativeAdhanAlarms(alarms: AdhanAlarmItem[]): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await AdhanAlarm.scheduleAlarms({ alarms });
    return true;
  } catch {
    return false;
  }
}

export async function cancelNativeAdhanAlarms(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AdhanAlarm.cancelAlarms();
  } catch {
    // ignore
  }
}

/** Play the full adhan once, 5 seconds from now. Pass true to play the Fajr adhan. Returns false when the native path is unavailable. */
export async function testNativeAdhan(fajr = false, voice?: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await AdhanAlarm.testAdhan({ fajr, voice });
    return true;
  } catch {
    return false;
  }
}

/** Ask the native side to refresh the home-screen widget now (from widget.json). */
export async function requestWidgetUpdate(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AdhanAlarm.updateWidgets();
  } catch {
    // ignore
  }
}
