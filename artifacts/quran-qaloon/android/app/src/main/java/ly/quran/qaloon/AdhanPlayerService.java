package ly.quran.qaloon;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import java.io.IOException;

/**
 * Plays the full bundled adhan (res/raw/adhan.mp3, 75s) with a
 * MediaPlayer in a foreground service — this is what makes the adhan
 * play COMPLETELY and automatically at prayer time:
 *
 * - A notification sound cannot do this: it stops the moment the
 *   notification is swiped away, and it is silenced by silent mode
 *   and Do Not Disturb.
 * - The player uses the ALARM audio stream (USAGE_ALARM), so it
 *   sounds even when the phone is silent or on vibrate — like an
 *   alarm clock — and keeps playing until the file ends.
 * - The foreground notification stays while it plays, with an
 *   "إيقاف الأذان" button; when the adhan ends the notification
 *   stays in the shade (dismissible) and the service stops itself.
 */
public class AdhanPlayerService extends Service {

    static final String CHANNEL_ID = "adhan-player";
    static final int NOTIF_ID = 9001;

    private MediaPlayer player;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID, "تشغيل الأذان", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("إشعار تشغيل الأذان عند وقت الصلاة");
        // The MediaPlayer is the sound — the notification itself is silent.
        ch.setSound(null, null);
        ch.enableVibration(true);
        nm.createNotificationChannel(ch);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            // Never play unprompted (system restart with a null intent).
            stopSelf();
            return START_NOT_STICKY;
        }
        if (intent.getBooleanExtra("stop", false)) {
            stopPlaying();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        String title = intent.getStringExtra(AdhanAlarms.EXTRA_TITLE);
        if (title == null || title.isEmpty()) title = "حان الآن وقت الصلاة 🕌";
        stopPlaying();
        Notification notif = buildNotification(title);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIF_ID, notif);
        }
        startPlaying();
        return START_NOT_STICKY;
    }

    private Notification buildNotification(String title) {
        Intent stop = new Intent(this, AdhanAlarmReceiver.class);
        stop.setAction(AdhanAlarms.ACTION_STOP);
        PendingIntent stopPi = PendingIntent.getBroadcast(
            this, 0, stop,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(
            this, 0, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText("جارٍ تشغيل الأذان كاملًا — اضغط «إيقاف الأذان» لإسكاته")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentIntent(openPi)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .addAction(0, "إيقاف الأذان", stopPi)
            .build();
    }

    private void startPlaying() {
        try {
            MediaPlayer mp = new MediaPlayer();
            mp.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build());
            AssetFileDescriptor afd = getResources().openRawResourceFd(R.raw.adhan);
            mp.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            afd.close();
            mp.setWakeMode(getApplicationContext(), PowerManager.PARTIAL_WAKE_LOCK);
            mp.setOnCompletionListener(p -> {
                // Adhan finished: leave the notification in the shade
                // (dismissible) and stop the service.
                stopForeground(false);
                stopSelf();
            });
            mp.setOnErrorListener((p, what, extra) -> {
                stopForeground(true);
                stopSelf();
                return true;
            });
            mp.prepare();
            mp.start();
            player = mp;
        } catch (IOException e) {
            stopForeground(true);
            stopSelf();
        }
    }

    private void stopPlaying() {
        if (player != null) {
            try {
                if (player.isPlaying()) player.stop();
            } catch (Exception ignored) {
            }
            try {
                player.release();
            } catch (Exception ignored) {
            }
            player = null;
        }
    }

    @Override
    public void onDestroy() {
        stopPlaying();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
