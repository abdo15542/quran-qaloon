// Renders an ayah as a shareable PNG image and shares it.
// No new dependencies: plain canvas + the Web Share API, with a download
// fallback when file sharing is unavailable (desktop browser / headless).
// The ayah is drawn in the bundled Amiri Quran font on the app's deep-green
// brand gradient, with the surah name and ayah number in gold.

export type ShareAyahResult = "shared" | "downloaded" | "cancelled";

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

export async function renderAyahImage(opts: ShareAyahOptions): Promise<Blob> {
  const W = 1080;
  const PAD = 90;
  const ARABIC_FONT = '64px "Amiri Quran", "Amiri", serif';
  const ARABIC_LINE = 122;
  const TRANS_FONT = '30px system-ui, sans-serif';
  const TRANS_LINE = 48;

  // Load the bundled Amiri Quran font for the canvas (falls back to serif).
  try {
    if (typeof document !== "undefined" && (document as Document & { fonts?: FontFaceSet }).fonts) {
      await (document as Document & { fonts: FontFaceSet }).fonts.load('64px "Amiri Quran"');
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
  ctx.font = '56px "Amiri Quran", "Amiri", serif';
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

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))), "image/png");
  });
}

export async function shareAyahImage(opts: ShareAyahOptions): Promise<ShareAyahResult> {
  const blob = await renderAyahImage(opts);
  const fileName = `ayah-${opts.surahNumber}-${opts.ayahNumber}.png`;
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
