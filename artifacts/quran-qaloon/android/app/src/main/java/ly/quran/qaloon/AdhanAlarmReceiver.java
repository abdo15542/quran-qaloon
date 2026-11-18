package ly.quran.qaloon;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * Fired by AlarmManager at prayer time: starts the foreground service
 * that plays the full adhan. Also handles the "إيقاف الأذان" action
 * from the service's notification.
 */
public class AdhanAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        if (AdhanAlarms.ACTION_STOP.equals(intent.getAction())) {
            context.stopService(new Intent(context, AdhanPlayerService.class));
            return;
        }
        if (AdhanAlarms.ACTION_ALARM.equals(intent.getAction())) {
            Intent svc = new Intent(context, AdhanPlayerService.class);
            svc.putExtra(AdhanAlarms.EXTRA_ID, intent.getIntExtra(AdhanAlarms.EXTRA_ID, 0));
            svc.putExtra(AdhanAlarms.EXTRA_TITLE, intent.getStringExtra(AdhanAlarms.EXTRA_TITLE));
            svc.putExtra(AdhanAlarms.EXTRA_FAJR, intent.getBooleanExtra(AdhanAlarms.EXTRA_FAJR, false));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(svc);
            } else {
                context.startService(svc);
            }
        }
    }
}
