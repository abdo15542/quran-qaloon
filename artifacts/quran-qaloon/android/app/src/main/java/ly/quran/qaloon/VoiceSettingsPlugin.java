package ly.quran.qaloon;

import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * [1.0.109 voice search] App-level Capacitor plugin (registered from
 * MainActivity) that opens the system's voice-input settings, where the
 * offline speech-recognition language packs are downloaded.
 *
 * Why native, and why not bundled: Google's offline recognition packs
 * are system data managed by the Google app / system settings — a
 * third-party APK cannot bundle them and there is no public API to
 * download a pack or to query which packs are installed. The closest
 * public entry point is Settings.ACTION_VOICE_INPUT_SETTINGS; from
 * there the "offline speech recognition" entry (Android 13+:
 * Settings > System > Language & region > Speech > On-device
 * recognition) lets the user download Arabic once, after which voice
 * search works fully offline. The speech-recognition plugin itself
 * exposes no offline preference (UtteranceOptions has no such field
 * and its native code never sets EXTRA_PREFER_OFFLINE, which is only
 * a hint a recognizer may ignore anyway), so opening the system
 * screen is the only honest lever the app has.
 */
@CapacitorPlugin(name = "VoiceSettings")
public class VoiceSettingsPlugin extends Plugin {

    /** Open the system voice-input settings (offline packs live there). */
    @PluginMethod
    public void openVoiceInputSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_VOICE_INPUT_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Context ctx = getContext();
        if (intent.resolveActivity(ctx.getPackageManager()) != null) {
            ctx.startActivity(intent);
            call.resolve();
        } else {
            call.reject("no voice input settings on this device");
        }
    }
}
