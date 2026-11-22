package ly.quran.qaloon;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.util.concurrent.TimeUnit;

/**
 * Safety net for the adhan alarms (1.0.102): Android wipes every
 * AlarmManager alarm on reboot, and on realme/ColorOS the boot
 * receiver only runs when auto-start is allowed for the app — so
 * after a restart the adhan can silently stay dead until the app is
 * opened again. This periodic worker re-registers the stored 7-day
 * alarm set every hour, so even a missed boot broadcast heals itself
 * soon after a reboot, with no tap from the user. Battery cost is
 * trivial: one tiny re-registration per hour, no network, no wake
 * lock held beyond the call.
 */
public class AdhanRescheduleWorker extends Worker {
    static final String UNIQUE_NAME = "adhan-reschedule";

    public AdhanRescheduleWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            Context ctx = getApplicationContext();
            AdhanAlarms.registerAll(ctx, AdhanAlarms.loadStored(ctx));
        } catch (Exception ignored) {
            // Never fail loudly — the next hourly run heals the set.
        }
        return Result.success();
    }

    /** Enqueue the hourly re-registration (no-op when already enqueued). */
    static void enqueue(Context ctx) {
        try {
            PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
                    AdhanRescheduleWorker.class, 1, TimeUnit.HOURS).build();
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
                    UNIQUE_NAME, ExistingPeriodicWorkPolicy.KEEP, request);
        } catch (Exception ignored) {
            // WorkManager unavailable (e.g. direct boot before unlock,
            // when its storage is unreadable): the boot receiver runs
            // again after unlock, and the next app open enqueues it.
        }
    }
}
