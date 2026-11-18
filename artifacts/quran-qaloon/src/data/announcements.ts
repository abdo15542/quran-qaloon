// لوحة التنبيهات والأخبار أعلى الرئيسية (1.0.69).
// الأخبار مضمّنة في التطبيق وتعمل دون إنترنت؛ تُحدَّث مع كل إصدار جديد.
// كل خبر له تاريخ انتهاء اختياري — بعدها يختفي تلقائيًا.
export type AnnouncementKind = "news" | "tip" | "reminder";

export interface Announcement {
  id: string;
  kind: AnnouncementKind;
  title: string;
  body: string;
  /** مسار داخل التطبيق يُفتح عند الضغط على اللوحة (اختياري). */
  link?: string;
  /** تاريخ الانتهاء ISO (اختياري) — بعدها لا يظهر الخبر. */
  expiresAt?: string;
}

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "redesign-1069",
    kind: "news",
    title: "تصميم جديد كليًا",
    body: "خطوط جديدة وواجهات عصرية وشاشة رئيسية جديدة — جرّب الوضع الليلي أيضًا.",
    expiresAt: "2026-12-18",
  },
  {
    id: "widget-1068",
    kind: "tip",
    title: "جرّبت الويدجت؟",
    body: "أضف ويدجت «تسميع القرآن» إلى شاشتك الرئيسية لترى آية اليوم والصلاة القادمة.",
  },
  {
    id: "backup-1068",
    kind: "tip",
    title: "احفظ نسخة احتياطية",
    body: "من صفحة «إحصائياتي» صدّر نسخة من المفضلة والتقدم والورد قبل تغيير هاتفك.",
    link: "/stats",
  },
];

export function getActiveAnnouncements(now: Date = new Date()): Announcement[] {
  return ANNOUNCEMENTS.filter((a) => !a.expiresAt || new Date(a.expiresAt).getTime() > now.getTime());
}
