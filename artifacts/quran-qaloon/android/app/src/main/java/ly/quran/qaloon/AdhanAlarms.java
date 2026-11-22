package ly.quran.qaloon;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Helpers shared by the adhan alarm plugin, the alarm receiver and the
 * boot receiver: persisting the 7-day alarm set, (re-)registering it
 * with AlarmManager, and cancelling it.
 *
 * The alarms use setAlarmClock — the strongest delivery Android
 * offers: fully exempt from Doze and from the allow-while-idle quota.
 * setExactAndAllowWhileIdle (used until 1.0.103) is rate-limited to
 * one alarm per app per 9-15 minutes and ColorOS batches Doze
 * wake-ups — the Isha adhan fired 2 minutes late (19:25 -> 19:27)
 * while the 5-minute pre-alert was late too, although the scheduled
 * time was exactly the displayed prayer time. setAlarmClock also
 * shows an alarm-clock icon in the status bar while an adhan is
 * pending — the price of the guarantee.
 */
public final class AdhanAlarms {
    static final String PREFS = "adhan_alarms";
    static final String KEY_ALARMS = "alarms";
    static final String ACTION_ALARM = "ly.quran.qaloon.ACTION_ADHAN_ALARM";
    static final String ACTION_STOP = "ly.quran.qaloon.ACTION_STOP_ADHAN";
    static final String EXTRA_ID = "adhan_id";
    static final String EXTRA_TITLE = "adhan_title";
    /** True when this alarm must play the Fajr adhan (adhan_fajr.mp3). */
    static final String EXTRA_FAJR = "adhan_fajr";
    /** Voice id for the regular adhan (see ADHAN_VOICES); "a3" = default. */
    static final String EXTRA_VOICE = "adhan_voice";

    private AdhanAlarms() {}

    // Device-protected storage: readable before the first unlock after a
    // reboot (direct boot). Credential-encrypted storage is NOT — an
    // alarm set stored there would be unreadable when Fajr fires before
    // unlock, so the boot receiver could never re-register it.
    private static SharedPreferences prefs(Context ctx) {
        Context storage = ctx;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            storage = ctx.createDeviceProtectedStorageContext();
        }
        return storage.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static JSONArray loadStored(Context ctx) {
        SharedPreferences p = prefs(ctx);
        String raw = p.getString(KEY_ALARMS, null);
        if (raw == null) {
            // One-time migration: alarms stored before 1.0.64 lived in
            // credential-encrypted storage — copy them over once (fails
            // silently before unlock, when that storage is unreadable;
            // the next app open re-schedules them anyway).
            try {
                String legacy = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                        .getString(KEY_ALARMS, null);
                if (legacy != null) {
                    p.edit().putString(KEY_ALARMS, legacy).apply();
                    raw = legacy;
                }
            } catch (Exception ignored) {
                // unreadable before unlock — nothing to migrate yet
            }
        }
        if (raw == null) return new JSONArray();
        try {
            return new JSONArray(raw);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    static void saveStored(Context ctx, JSONArray alarms) {
        prefs(ctx)
            .edit()
            .putString(KEY_ALARMS, alarms.toString())
            .apply();
        // Drop the pre-1.0.64 credential-encrypted copy so a later
        // clear cannot resurrect it through the migration above.
        try {
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .remove(KEY_ALARMS)
                .apply();
        } catch (Exception ignored) {
            // unreadable before unlock — harmless, it is never read again
        }
    }

    static void clearStored(Context ctx) {
        prefs(ctx)
            .edit()
            .remove(KEY_ALARMS)
            .apply();
        try {
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .remove(KEY_ALARMS)
                .apply();
        } catch (Exception ignored) {
            // unreadable before unlock — harmless
        }
    }

    static PendingIntent alarmIntent(Context ctx, int id, String title, boolean fajr, String voice) {
        Intent i = new Intent(ctx, AdhanAlarmReceiver.class);
        i.setAction(ACTION_ALARM);
        i.putExtra(EXTRA_ID, id);
        i.putExtra(EXTRA_TITLE, title);
        i.putExtra(EXTRA_FAJR, fajr);
        i.putExtra(EXTRA_VOICE, voice == null ? "a3" : voice);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(ctx, id, i, flags);
    }

    /** Cancels only need id + action (extras do not affect matching). */
    static PendingIntent alarmIntent(Context ctx, int id, String title) {
        return alarmIntent(ctx, id, title, false, "a3");
    }

    /** Opens the app when the user taps the alarm-clock icon. */
    static PendingIntent showIntent(Context ctx) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(ctx, 0, i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Register every future alarm in the set (past ones are skipped). */
    static void registerAll(Context ctx, JSONArray alarms) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        boolean exact = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            exact = am.canScheduleExactAlarms();
        }
        long now = System.currentTimeMillis();
        for (int n = 0; n < alarms.length(); n++) {
            try {
                JSONObject a = alarms.getJSONObject(n);
                int id = a.getInt("id");
                long at = a.getLong("at");
                String title = a.optString("title", "");
                boolean fajr = a.optBoolean("fajr", false);
                String voice = a.optString("voice", "a3");
                if (at <= now) continue;
                PendingIntent pi = alarmIntent(ctx, id, title, fajr, voice);
                if (exact) {
                    // [1.0.104] setAlarmClock, not setExactAndAllowWhileIdle:
                    // the allow-while-idle quota (one per 9-15 min) and
                    // ColorOS Doze batching delayed the Isha adhan by 2
                    // minutes even though `at` was exactly the displayed
                    // prayer time. setAlarmClock is exempt from both.
                    AlarmManager.AlarmClockInfo info =
                        new AlarmManager.AlarmClockInfo(at, showIntent(ctx));
                    am.setAlarmClock(info, pi);
                } else {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                }
            } catch (Exception ignored) {
                // one bad entry must not block the rest
            }
        }
    }

    /** Cancel every alarm in the given set. */
    static void cancelAll(Context ctx, JSONArray alarms) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        for (int n = 0; n < alarms.length(); n++) {
            try {
                JSONObject a = alarms.getJSONObject(n);
                am.cancel(alarmIntent(ctx, a.getInt("id"), a.optString("title", "")));
            } catch (Exception ignored) {
                // ignore
            }
        }
    }

    /** Cancel a single alarm by id (e.g. the unstored test alarm 9999). */
    static void cancelId(Context ctx, int id) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        am.cancel(alarmIntent(ctx, id, ""));
    }
}
