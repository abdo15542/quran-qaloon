// Renders an ayah as a shareable PNG image.
// Fully offline: the ayah text, the translation and the Uthman Taha font
// are all bundled in the app — no internet is needed to draw the image.
// Save: on the real app the image is written straight to the phone's photo
// gallery with the Media plugin (no share sheet, no internet); in a browser
// it downloads the PNG. Share: on the real app the NATIVE Android share
// sheet opens (Capacitor Share plugin, file attached) — it lists WhatsApp,
// Facebook, Telegram, Messenger and every other app that takes an image;
// in a browser it is the Web Share API, with the same download fallback
// when file sharing is unavailable (desktop browser / headless).

import { Capacitor } from "@capacitor/core";
import { Media } from "@capacitor-community/media";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";

export type ShareAyahResult = "shared" | "downloaded" | "cancelled" | "failed";
export type SaveAyahResult = "saved_gallery" | "downloaded" | "failed";

export interface ShareAyahOptions {
  ayahText: string;
  surahName: string;
  surahNumber: number;
  ayahNumber: number;
  translation?: string | null;
}

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d, 10)]);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [text];
}

async function drawAyahCanvas(opts: ShareAyahOptions): Promise<HTMLCanvasElement> {
  const W = 1080;
  const PAD = 90;
  const ARABIC_FONT = '64px "Uthman Taha", "Amiri Quran", serif';
  const ARABIC_LINE = 122;
  const TRANS_FONT = '30px system-ui, sans-serif';
  const TRANS_LINE = 48;

  // Load the bundled Uthman Taha font for the canvas (falls back to serif).
  // Never wait forever: if the font is not ready in 1.5s, draw with the
  // serif fallback — the image must render even when offline.
  try {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts) {
      await Promise.race([
        fonts.load('64px "Uthman Taha", "Amiri Quran"'),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    }
  } catch {
    // font not ready — canvas falls back to serif, still renders Arabic.
  }

  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = ARABIC_FONT;
  measure.direction = "rtl";
  const arabicLines = wrapText(measure, opts.ayahText, W - PAD * 2);
  let transLines: string[] = [];
  if (opts.translation) {
    measure.font = TRANS_FONT;
    measure.direction = "ltr";
    transLines = wrapText(measure, opts.translation, W - PAD * 2);
  }

  const topPad = 110;
  const headerH = 60;
  const footerH = 150;
  const gapTrans = transLines.length > 0 ? 44 : 0;
  const H =
    topPad + headerH + arabicLines.length * ARABIC_LINE + gapTrans + transLines.length * TRANS_LINE + footerH + 70;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background: deep-green brand gradient.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#0B6B4F");
  grad.addColorStop(1, "#063B2B");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Gold frame.
  ctx.strokeStyle = "rgba(212, 175, 55, 0.65)";
  ctx.lineWidth = 4;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.strokeStyle = "rgba(212, 175, 55, 0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(52, 52, W - 104, H - 104);

  // Header: app name.
  ctx.fillStyle = "#D4AF37";
  ctx.font = '600 34px system-ui, sans-serif';
  ctx.textAlign = "center";
  ctx.direction = "rtl";
  ctx.fillText("تسميع القرآن — قالون عن نافع", W / 2, topPad);

  // Ayah text.
  ctx.fillStyle = "#FFFFFF";
  ctx.font = ARABIC_FONT;
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  let y = topPad + headerH + 64;
  for (const line of arabicLines) {
    ctx.fillText(line, W / 2, y);
    y += ARABIC_LINE;
  }
  // Ayah number marker in gold, on its own line.
  ctx.fillStyle = "#D4AF37";
  ctx.font = '56px "Uthman Taha", "Amiri Quran", serif';
  ctx.fillText(`﴿${toArabicNum(opts.ayahNumber)}﴾`, W / 2, y + 10);
  y += 96;

  // English translation, if given.
  if (transLines.length > 0) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
    ctx.font = TRANS_FONT;
    ctx.direction = "ltr";
    ctx.textAlign = "center";
    for (const line of transLines) {
      ctx.fillText(line, W / 2, y);
      y += TRANS_LINE;
    }
  }

  // Footer: surah name + ayah number.
  ctx.fillStyle = "#D4AF37";
  ctx.font = '600 38px system-ui, sans-serif';
  ctx.direction = "rtl";
  ctx.fillText(`سورة ${opts.surahName} — الآية ${toArabicNum(opts.ayahNumber)}`, W / 2, H - 90);

  return canvas;
}

export async function renderAyahImage(opts: ShareAyahOptions): Promise<Blob> {
  const canvas = await drawAyahCanvas(opts);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))), "image/png");
  });
}

export async function renderAyahImageDataUrl(opts: ShareAyahOptions): Promise<string> {
  const canvas = await drawAyahCanvas(opts);
  return canvas.toDataURL("image/png");
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Which gallery album to save into: the Pictures album when it exists,
// otherwise Camera / Download, otherwise the first album the phone reports.
function pickAlbum(albums: { identifier: string; name: string }[]): { identifier: string; name: string } | null {
  if (!albums || albums.length === 0) return null;
  const byName = (re: RegExp) => albums.find((a) => re.test(a.name));
  return byName(/pictures|صور/i) ?? byName(/camera|dcim|الكاميرا/i) ?? byName(/download|تنزيل/i) ?? albums[0];
}

// Native gallery save: the Media plugin writes the PNG straight into the
// phone's photo gallery (it asks for the photo permission itself on first
// use). Works fully offline. Returns false when anything goes wrong, so the
// caller can fall back to the download.
async function saveToGallery(dataUrl: string, fileName: string): Promise<boolean> {
  try {
    const { albums } = await Media.getAlbums();
    const album = pickAlbum(albums);
    if (!album) return false;
    await Media.savePhoto({
      path: dataUrl,
      albumIdentifier: album.identifier,
      fileName: fileName.replace(/\.png$/i, ""),
    });
    return true;
  } catch {
    return false;
  }
}

export async function saveAyahImage(opts: ShareAyahOptions): Promise<SaveAyahResult> {
  const fileName = `ayah-${opts.surahNumber}-${opts.ayahNumber}.png`;
  try {
    if (Capacitor.isNativePlatform()) {
      const dataUrl = await renderAyahImageDataUrl(opts);
      if (await saveToGallery(dataUrl, fileName)) return "saved_gallery";
      // Gallery save failed — on native there is no working download
      // fallback (anchor downloads are ignored inside the WebView),
      // so report the failure instead of a false success.
      return "failed";
    }
    const blob = await renderAyahImage(opts);
    downloadBlob(blob, fileName);
    return "downloaded";
  } catch {
    return "failed";
  }
}

// Native share (real app): write the PNG to the cache dir, then open the
// NATIVE Android share sheet with the file attached — the sheet lists every
// app that can take an image (WhatsApp, Facebook, Telegram, Messenger...).
// This is the reliable path: the Web Share API is unreliable inside the
// Capacitor WebView, and a plain download is ignored there. The Share
// plugin resolves when the user picks an app, and rejects with
// "Share canceled" when the sheet is dismissed without choosing.
async function shareNative(opts: ShareAyahOptions, dataUrl: string, fileName: string): Promise<ShareAyahResult> {
  try {
    const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
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
      title: `سورة ${opts.surahName} — الآية ${opts.ayahNumber}`,
      text: `سورة ${opts.surahName} — الآية ${opts.ayahNumber}`,
      files: [uri],
      dialogTitle: "مشاركة الآية كصورة",
    });
    return "shared";
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).toLowerCase();
    if (msg.includes("cancel")) return "cancelled";
    return "failed";
  }
}

export async function shareAyahImage(opts: ShareAyahOptions): Promise<ShareAyahResult> {
  const fileName = `ayah-${opts.surahNumber}-${opts.ayahNumber}.png`;

  if (Capacitor.isNativePlatform()) {
    // On the phone the native sheet is the only working path — a download
    // fallback would silently do nothing in the WebView, so a failure is
    // reported as "failed" instead of a false "downloaded".
    const dataUrl = await renderAyahImageDataUrl(opts);
    return await shareNative(opts, dataUrl, fileName);
  }

  // Web path: Web Share API, then download fallback.
  const blob = await renderAyahImage(opts);
  const file = new File([blob], fileName, { type: "image/png" });

  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void>; canShare?: (data: ShareData) => boolean };
  if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
    try {
      await nav.share({
        files: [file],
        title: `سورة ${opts.surahName} — الآية ${opts.ayahNumber}`,
      });
      return "shared";
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return "cancelled";
      // Any other share failure falls through to the download.
    }
  }

  // Download fallback (desktop browser, headless, or share unavailable).
  downloadBlob(blob, fileName);
  return "downloaded";
}
