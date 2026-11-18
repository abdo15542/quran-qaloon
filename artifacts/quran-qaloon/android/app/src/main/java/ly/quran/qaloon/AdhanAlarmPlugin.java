package ly.quran.qaloon;

import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * App-level Capacitor plugin (registered from MainActivity) that drives
 * the native adhan alarm: exact AlarmManager alarms (7 days x 5
 * prayers) that start a foreground service playing the full adhan.
 *
 * Why native: the prayer notifications go through the notification
 * system, whose sound stops when the notification is dismissed, is
 * silenced in silent / DND mode, and — without the exact-alarm
 * permission — is scheduled with an INEXACT alarm that Doze can delay
 * or skip. The native path plays the whole file on the ALARM stream,
 * on time, even in silent mode, even with the app closed.
 */
@CapacitorPlugin(name = "AdhanAlarm")
public class AdhanAlarmPlugin extends Plugin {

    /** True when exact alarms may be scheduled (always true below S). */
    @PluginMethod
    public void canScheduleExactAlarms(PluginCall call) {
        boolean granted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            granted = am != null && am.canScheduleExactAlarms();
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    /** Open the system "Alarms & reminders" settings for this app. */
    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Intent intent = new Intent(
                Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    /**
     * Replace the stored alarm set with the given one:
     * [{ id, at (epoch ms), title }]. Persists it (for the boot
     * receiver) and registers it with AlarmManager. Requires the
     * exact-alarm permission on S+ — the JS side checks first.
     */
    @PluginMethod
    public void scheduleAlarms(PluginCall call) {
        JSArray alarms = call.getArray("alarms");
        if (alarms == null) {
            call.reject("missing alarms");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            if (am == null || !am.canScheduleExactAlarms()) {
                call.reject("exact alarms not granted");
                return;
            }
        }
        Context ctx = getContext();
        JSONArray old = AdhanAlarms.loadStored(ctx);
        AdhanAlarms.cancelAll(ctx, old);
        AdhanAlarms.saveStored(ctx, alarms);
        AdhanAlarms.registerAll(ctx, alarms);
        call.resolve();
    }

    /** Cancel every stored adhan alarm and forget the set. */
    @PluginMethod
    public void cancelAlarms(PluginCall call) {
        Context ctx = getContext();
        JSONArray stored = AdhanAlarms.loadStored(ctx);
        AdhanAlarms.cancelAll(ctx, stored);
        // The test alarm (id 9999, testAdhan) is registered but never
        // stored, so the stored set alone cannot cancel it.
        AdhanAlarms.cancelId(ctx, 9999);
        AdhanAlarms.clearStored(ctx);
        call.resolve();
    }

    /** Stop a currently playing adhan (if any). */
    @PluginMethod
    public void stopAdhan(PluginCall call) {
        getContext().stopService(new Intent(getContext(), AdhanPlayerService.class));
        call.resolve();
    }

    /** Refresh the home-screen widget (if placed) from widget.json. */
    @PluginMethod
    public void updateWidgets(PluginCall call) {
        QuranWidgetProvider.updateAllWidgets(getContext());
        call.resolve();
    }

    /** Play the full adhan once, 5 seconds from now (test button). Pass { fajr: true } to play the Fajr adhan. */
    @PluginMethod
    public void testAdhan(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            if (am == null || !am.canScheduleExactAlarms()) {
                call.reject("exact alarms not granted");
                return;
            }
        }
        boolean fajr = call.getBoolean("fajr", false);
        String voice = call.getString("voice", "a3");
        JSONArray one = new JSONArray();
        try {
            JSONObject a = new JSONObject();
            a.put("id", 9999);
            a.put("at", System.currentTimeMillis() + 5000);
            a.put("title", fajr ? "اختبار أذان الفجر 🕌" : "اختبار الأذان 🕌");
            a.put("fajr", fajr);
            a.put("voice", voice);
            one.put(a);
        } catch (JSONException e) {
            call.reject("test failed");
            return;
        }
        AdhanAlarms.registerAll(getContext(), one);
        call.resolve();
    }
}
