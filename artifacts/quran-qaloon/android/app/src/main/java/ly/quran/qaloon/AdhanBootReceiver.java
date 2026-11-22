package ly.quran.qaloon;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * AlarmManager alarms are wiped on reboot — re-register the stored
 * 7-day adhan set when the device boots. LOCKED_BOOT_COMPLETED fires
 * before the first unlock (direct boot): the set lives in
 * device-protected storage, so it can be re-registered even then.
 */
public class AdhanBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent != null && (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())
                || Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(intent.getAction()))) {
            AdhanAlarms.registerAll(context, AdhanAlarms.loadStored(context));
            // Hourly safety net (1.0.102): the boot broadcast itself
            // is not always delivered on realme/ColorOS — enqueue the
            // periodic re-registration so a missed boot still heals.
            AdhanRescheduleWorker.enqueue(context);
        }
    }
}
