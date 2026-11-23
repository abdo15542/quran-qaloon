import { Capacitor, registerPlugin } from "@capacitor/core";

interface VoiceSettingsPlugin {
  openVoiceInputSettings(): Promise<void>;
}

const VoiceSettings = registerPlugin<VoiceSettingsPlugin>("VoiceSettings");

/**
 * [1.0.109 voice search] Open the system's voice-input settings, where
 * the offline speech-recognition language packs are downloaded (Android
 * 13+: Settings > System > Language & region > Speech > On-device
 * recognition). Native only — on the web there is no system settings
 * screen to open. The pack itself is system data: the app cannot
 * bundle it, download it, or query whether it is installed.
 */
export async function openVoiceInputSettings(): Promise<{ ok: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) return { ok: false, error: "web" };
  try {
    await VoiceSettings.openVoiceInputSettings();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** True on a native build, where the system settings screen exists. */
export function isVoiceSettingsAvailable(): boolean {
  return Capacitor.isNativePlatform();
}
