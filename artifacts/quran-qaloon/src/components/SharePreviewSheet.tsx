// Preview sheet for sharing an ayah as an image.
// Tapping "مشاركة" opens this sheet instead of sharing directly: the user
// sees the finished image first, then chooses "حفظ الصورة" (writes the PNG
// straight to the phone's photo gallery — fully offline) or "مشاركة"
// (the system share sheet). Everything is rendered locally, no internet.

import { useEffect, useState } from "react";
import { X, Download, Share2, Loader2, CheckCircle2, WifiOff } from "lucide-react";
import { renderAyahImageDataUrl, saveAyahImage, shareAyahImage } from "@/lib/shareAyah";
import type { ShareAyahOptions } from "@/lib/shareAyah";

export default function SharePreviewSheet({
  ayah,
  onClose,
}: {
  ayah: ShareAyahOptions;
  onClose: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "share" | null>(null);

  // Lock the page behind the sheet while it is open: without this, swiping
  // scrolls the surah page behind the sheet (and the bottom nav stays
  // tappable under it).
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const prevBody = body.style.overflow;
    const prevHtml = html.style.overflow;
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevBody;
      html.style.overflow = prevHtml;
    };
  }, []);

  // Render the image once, when the sheet opens.
  useEffect(() => {
    let alive = true;
    setRendering(true);
    renderAyahImageDataUrl(ayah)
      .then((url) => {
        if (alive) {
          setPreviewUrl(url);
          setRendering(false);
        }
      })
      .catch(() => {
        if (alive) setRendering(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ayah.surahNumber, ayah.ayahNumber, ayah.ayahText, ayah.translation]);

  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 3500);
  };

  const handleSave = async () => {
    if (busy) return;
    setBusy("save");
    try {
      const result = await saveAyahImage(ayah);
      if (result === "saved_gallery") flash("تم حفظ الصورة في المعرض ✓");
      else if (result === "downloaded") flash("تم تنزيل الصورة ✓");
      else flash("تعذّر حفظ الصورة — حاول مجددًا");
    } catch {
      flash("تعذّر حفظ الصورة — حاول مجددًا");
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    if (busy) return;
    setBusy("share");
    try {
      const result = await shareAyahImage(ayah);
      if (result === "shared") flash("تمت المشاركة ✓");
      else if (result === "downloaded") flash("تم تنزيل الصورة ✓");
    } catch {
      flash("تعذّرت المشاركة");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 p-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl bg-card text-card-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="font-arabic text-lg font-bold">مشاركة الآية كصورة</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview */}
        <div className="px-4">
          {rendering ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-muted/50 py-16 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm font-arabic">جاري تجهيز الصورة…</span>
            </div>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt={`سورة ${ayah.surahName} — الآية ${ayah.ayahNumber}`}
              className="w-full rounded-2xl border-2 border-amber-500/60 shadow-xl"
            />
          ) : (
            <div className="rounded-2xl bg-muted/50 py-16 text-center text-sm text-muted-foreground">
              تعذّر تجهيز الصورة
            </div>
          )}
          <p className="text-center text-xs text-muted-foreground font-arabic mt-2">
            سورة {ayah.surahName} — الآية {ayah.ayahNumber}
          </p>
          <p className="flex items-center justify-center gap-1 text-center text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
            <WifiOff className="w-3 h-3" />
            تعمل بدون إنترنت — الصورة تُجهَّز وتُحفظ على جهازك
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 pt-3 pb-2">
          <button
            onClick={handleSave}
            disabled={busy !== null || !previewUrl}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            حفظ الصورة
          </button>
          <button
            onClick={handleShare}
            disabled={busy !== null || !previewUrl}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-card border border-border text-sm font-bold hover:border-primary/40 disabled:opacity-50 transition-colors"
          >
            {busy === "share" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            مشاركة
          </button>
        </div>

        {/* Status */}
        <div className="px-4 pb-4 min-h-[1.75rem] flex items-center justify-center">
          {status && (
            <span className="inline-flex items-center gap-1.5 text-xs font-arabic text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
