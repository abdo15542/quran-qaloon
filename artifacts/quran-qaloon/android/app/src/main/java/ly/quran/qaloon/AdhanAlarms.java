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
 * The alarms are exact (setExactAndAllowWhileIdle) so they fire on time
 * even in Doze — that is the whole point: the LocalNotifications plugin
 * falls back to an inexact alarm when the app lacks the exact-alarm
 * permission, which is why the adhan sometimes came late or not at all.
 */
public final class AdhanAlarms {
    static final String PREFS = "adhan_alarms";
    static final String KEY_ALARMS = "alarms";
    static final String ACTION_ALARM = "ly.quran.qaloon.ACTION_ADHAN_ALARM";
    static final String ACTION_STOP = "ly.quran.qaloon.ACTION_STOP_ADHAN";
    static final String EXTRA_ID = "adhan_id";
    static final String EXTRA_TITLE = "adhan_title";

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

    static PendingIntent alarmIntent(Context ctx, int id, String title) {
        Intent i = new Intent(ctx, AdhanAlarmReceiver.class);
        i.setAction(ACTION_ALARM);
        i.putExtra(EXTRA_ID, id);
        i.putExtra(EXTRA_TITLE, title);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(ctx, id, i, flags);
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
                if (at <= now) continue;
                PendingIntent pi = alarmIntent(ctx, id, title);
                if (exact) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
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
