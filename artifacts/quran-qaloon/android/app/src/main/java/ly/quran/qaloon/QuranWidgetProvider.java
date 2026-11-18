package ly.quran.qaloon;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;

/**
 * Home-screen widget: verse of the day + next prayer time.
 * The JS side writes widget.json into the app files dir
 * (Directory.Data) on every app open and asks for an update via
 * AdhanAlarmPlugin.updateWidgets; the widget also refreshes every
 * 30 minutes from the last file written. Tapping the widget opens
 * the app. Nothing here needs the internet.
 */
public class QuranWidgetProvider extends AppWidgetProvider {

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quran);
        JSONObject data = readWidgetData(context);
        if (data != null) {
            views.setTextViewText(R.id.widget_verse, data.optString("verseText", ""));
            views.setTextViewText(R.id.widget_ref, data.optString("verseRef", ""));
            views.setTextViewText(R.id.widget_prayer,
                "الصلاة القادمة: " + data.optString("nextPrayerName", "")
                + " " + data.optString("nextPrayerTime", ""));
        }
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        PendingIntent pending = PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pending);
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, id);
        }
    }

    /** Refresh every placed widget now. */
    public static void updateAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName name = new ComponentName(context, QuranWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(name);
        for (int id : ids) {
            updateAppWidget(context, manager, id);
        }
    }

    private static JSONObject readWidgetData(Context context) {
        try {
            File f = new File(context.getFilesDir(), "widget.json");
            if (!f.exists()) return null;
            FileInputStream in = new FileInputStream(f);
            byte[] bytes = new byte[(int) f.length()];
            int read = 0;
            while (read < bytes.length) {
                int n = in.read(bytes, read, bytes.length - read);
                if (n < 0) break;
                read += n;
            }
            in.close();
            return new JSONObject(new String(bytes, 0, read, StandardCharsets.UTF_8));
        } catch (Exception e) {
            return null;
        }
    }
}
