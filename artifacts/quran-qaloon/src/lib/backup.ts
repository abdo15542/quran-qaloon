// نسخة احتياطية: تصدير كل إعدادات التطبيق وبياناته المحلية
// (المفضلة، التقدم، الورد، الإعدادات، مواقيت الصلاة...) إلى ملف
// JSON واستعادتها منه. لا تشمل الصوتيات المحمّلة (IndexedDB) —
// تُحمَّل من جديد من صفحة التحميلات. التصدير على الهاتف يفتح
// ورقة المشاركة الأصلية (النمط المستعمل في shareAyah)، وعلى
// الويب ينزّل الملف. الاستعادة تقرأ الملف وتكتب مفاتيحه ثم
// يُعاد تحميل الصفحة لتطبيقها.
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  data: Record<string, string>;
}

export function buildBackup(): BackupFile {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) {
      const v = localStorage.getItem(k);
      if (v != null) data[k] = v;
    }
  }
  return { app: "quran-qaloon", version: 1, exportedAt: new Date().toISOString(), data };
}

export function backupFileName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `quran-qaloon-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`;
}

export async function exportBackup(): Promise<"shared" | "downloaded" | "cancelled" | "failed"> {
  const fileName = backupFileName();
  const json = JSON.stringify(buildBackup(), null, 2);
  try {
    if (Capacitor.isNativePlatform()) {
      const base64 = btoa(unescape(encodeURIComponent(json)));
      await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      });
      const { uri } = await Filesystem.getUri({
        path: fileName,
        directory: Directory.Cache,
      });
      await Share.share({
        title: "نسخة احتياطية — تسميع القرآن",
        text: "نسخة احتياطية من بيانات تطبيق تسميع القرآن",
        files: [uri],
        dialogTitle: "حفظ النسخة الاحتياطية",
      });
      return "shared";
    }
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return "downloaded";
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).toLowerCase();
    if (msg.includes("cancel")) return "cancelled";
    return "failed";
  }
}

/** التحقق من ملف النسخة واستعادته: يعيد عدد المفاتيح المستعادة. */
export function importBackup(jsonText: string): number {
  const parsed = JSON.parse(jsonText) as Partial<BackupFile>;
  if (!parsed || parsed.app !== "quran-qaloon" || typeof parsed.data !== "object" || parsed.data == null) {
    throw new Error("not a quran-qaloon backup");
  }
  let count = 0;
  for (const [k, v] of Object.entries(parsed.data)) {
    if (typeof v === "string") {
      localStorage.setItem(k, v);
      count++;
    }
  }
  return count;
}
