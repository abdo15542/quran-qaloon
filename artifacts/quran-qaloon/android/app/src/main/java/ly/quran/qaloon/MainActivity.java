package ly.quran.qaloon;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-level plugin: the native adhan alarm (exact AlarmManager
        // alarms + a foreground service that plays the full adhan).
        // Must register BEFORE super.onCreate — that is when the
        // bridge is built from the registered plugins.
        registerPlugin(AdhanAlarmPlugin.class);
        // [1.0.109 voice search] Open the system voice-input settings
        // (offline Arabic speech pack download) from the search page.
        registerPlugin(VoiceSettingsPlugin.class);
        super.onCreate(savedInstanceState);
        // Hourly safety net (1.0.102): re-registers the adhan alarms
        // after a reboot even when the boot broadcast never arrives
        // (realme/ColorOS only delivers it when auto-start is allowed).
        AdhanRescheduleWorker.enqueue(this);
    }
}
