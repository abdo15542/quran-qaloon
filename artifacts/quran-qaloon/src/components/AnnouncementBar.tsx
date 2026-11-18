import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Bell, ChevronLeft, Lightbulb, Megaphone, X } from "lucide-react";
import { getActiveAnnouncements, type AnnouncementKind } from "@/data/announcements";

const DISMISSED_KEY = "quran_announcements_dismissed";

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function kindIcon(kind: AnnouncementKind) {
  if (kind === "news") return <Megaphone className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
  if (kind === "tip") return <Lightbulb className="w-5 h-5 text-sky-600 dark:text-sky-400" />;
  return <Bell className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
}

function kindTint(kind: AnnouncementKind) {
  if (kind === "news") return "border-amber-500/40 bg-amber-50 dark:bg-amber-950/30";
  if (kind === "tip") return "border-sky-500/40 bg-sky-50 dark:bg-sky-950/30";
  return "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30";
}

/**
 * لوحة تنبيهات وأخبار أعلى الرئيسية: تعرض أول خبر نشط لم يُغلقه
 * المستخدم، مع زر إغلاق (يُحفظ) وزر تنقّل بين الأخبار.
 * تختفي اللوحة كليًا عند عدم وجود أخبار نشطة.
 */
export default function AnnouncementBar() {
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissed());
  const [index, setIndex] = useState(0);

  const visible = useMemo(() => {
    const active = getActiveAnnouncements();
    return active.filter((a) => !dismissed.includes(a.id));
  }, [dismissed]);

  if (visible.length === 0) return null;
  const current = visible[index % visible.length];

  const dismiss = () => {
    const next = [...dismissed, current.id];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      /* تجاهل — التخزين غير متاح */
    }
    setIndex(0);
  };

  const body = (
    <div className={`rounded-3xl border p-4 mb-6 flex items-start gap-3 shadow-sm ${kindTint(current.kind)}`}>
      <span className="w-10 h-10 rounded-2xl bg-card/80 flex items-center justify-center shrink-0">
        {kindIcon(current.kind)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-foreground">{current.title}</div>
        <div className="text-xs text-muted-foreground leading-relaxed mt-0.5">{current.body}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {visible.length > 1 && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIndex((i) => (i + 1) % visible.length);
            }}
            className="p-1.5 rounded-full hover:bg-card/80 transition-colors text-muted-foreground"
            title="الخبر التالي"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dismiss();
          }}
          className="p-1.5 rounded-full hover:bg-card/80 transition-colors text-muted-foreground"
          title="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return current.link ? <Link href={current.link}>{body}</Link> : body;
}
