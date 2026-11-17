// Hijri date (التاريخ الهجري): today's date in the Umm al-Qura
// calendar, from the device's own Intl data — fully offline. The
// Umm al-Qura calendar is a calculation, so the date can differ by a
// day from a moon-sighting announcement.

export function formatHijriDate(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return "";
  }
}
