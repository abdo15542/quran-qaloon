// لوحة التنبيهات والأخبار أعلى الرئيسية (1.0.70).
// الأخبار مضمّنة في التطبيق وتعمل دون إنترنت؛ تُحدَّث مع كل إصدار جديد.
// كل خبر له تاريخ انتهاء اختياري — بعدها يختفي تلقائيًا.
// اللوحة لا تُخفى أبدًا: الضغط على خبر بلا رابط يفتح ورقة تفاصيله،
// والضغط على خبر له رابط ينتقل إليه مباشرة.
export type AnnouncementKind = "news" | "tip" | "reminder";

export interface Announcement {
  id: string;
  kind: AnnouncementKind;
  title: string;
  body: string;
  /** مسار داخل التطبيق يُفتح عند الضغط على الخبر (اختياري). */
  link?: string;
  /** تاريخ الانتهاء ISO (اختياري) — بعدها لا يظهر الخبر. */
  expiresAt?: string;
}

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "redesign-1070",
    kind: "news",
    title: "تصميم أدق وأجمل",
    body: "واجهات أسلس وأنيقة: بطاقة بطل مزخرفة، وبطاقات ملوّنة، وحركات ناعمة — ولوحة الأخبار هذه لا تُخفى أبدًا، اضغط أي خبر لعرضه.",
    expiresAt: "2026-12-18",
  },
  {
    id: "widget-1068",
    kind: "tip",
    title: "جرّبت الويدجت؟",
    body: "أضف ويدجت «ترتيل ليبيا» إلى شاشتك الرئيسية لترى آية اليوم والصلاة القادمة.",
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
