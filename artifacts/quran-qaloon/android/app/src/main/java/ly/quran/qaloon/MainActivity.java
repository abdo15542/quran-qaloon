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
        super.onCreate(savedInstanceState);
    }
}
