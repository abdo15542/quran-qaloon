import { ArrowLeft, Bell, Lightbulb, Megaphone, X } from "lucide-react";
import { useLocation } from "wouter";
import type { Announcement, AnnouncementKind } from "@/data/announcements";

function kindIcon(kind: AnnouncementKind) {
  if (kind === "news") return <Megaphone className="w-6 h-6 text-amber-600 dark:text-amber-400" />;
  if (kind === "tip") return <Lightbulb className="w-6 h-6 text-sky-600 dark:text-sky-400" />;
  return <Bell className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />;
}

function kindTile(kind: AnnouncementKind) {
  if (kind === "news") return "bg-amber-500/15";
  if (kind === "tip") return "bg-sky-500/15";
  return "bg-emerald-500/15";
}

/**
 * ورقة تفاصيل خبر من لوحة التنبيهات (1.0.70): تُفتح عند الضغط على
 * خبر بلا رابط. إن كان للخبر رابط، زر «الانتقال الآن» ينقلك إليه.
 */
export default function AnnouncementDetailSheet({
  announcement,
  onClose,
}: {
  announcement: Announcement;
  onClose: () => void;
}) {
  const [, navigate] = useLocation();

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card rounded-t-[2rem] p-5 pb-8 shadow-2xl animate-fade-up">
        <div className="w-10 h-1.5 rounded-full bg-muted mx-auto mb-4" />
        <div className="flex items-start gap-3 mb-3">
          <span className={`w-12 h-12 rounded-2xl ${kindTile(announcement.kind)} flex items-center justify-center shrink-0`}>
            {kindIcon(announcement.kind)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-lg text-foreground leading-snug">{announcement.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">لوحة التنبيهات والأخبار</div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground shrink-0"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[15px] leading-relaxed text-foreground/90">{announcement.body}</p>
        {announcement.link && (
          <button
            onClick={() => {
              onClose();
              navigate(announcement.link!);
            }}
            className="mt-5 w-full py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            الانتقال الآن
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
