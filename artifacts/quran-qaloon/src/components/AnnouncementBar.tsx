import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Bell, ChevronLeft, Lightbulb, Megaphone } from "lucide-react";
import { getActiveAnnouncements, type Announcement, type AnnouncementKind } from "@/data/announcements";
import AnnouncementDetailSheet from "@/components/AnnouncementDetailSheet";

function kindIcon(kind: AnnouncementKind) {
  if (kind === "news") return <Megaphone className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
  if (kind === "tip") return <Lightbulb className="w-5 h-5 text-sky-600 dark:text-sky-400" />;
  return <Bell className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
}

function kindTint(kind: AnnouncementKind) {
  if (kind === "news") return "from-amber-500/25 via-amber-500/10 to-card border-amber-500/40";
  if (kind === "tip") return "from-sky-500/25 via-sky-500/10 to-card border-sky-500/40";
  return "from-emerald-500/25 via-emerald-500/10 to-card border-emerald-500/40";
}

/**
 * لوحة تنبيهات وأخبار أعلى الرئيسية (1.0.70):
 * - لا تُخفى أبدًا: لا زر إغلاق ولا حفظ إغلاق — تبقى ظاهرة دائمًا.
 * - الضغط على الخبر يفتحه مباشرة: إن كان له رابط ينتقل إليه فورًا،
 *   وإن لم يكن يفتح ورقة تفاصيل الخبر نفسه.
 * - زر السهم يتنقّل بين الأخبار، والنقاط توضح موضعك، مع حركة ناعمة عند التبديل.
 * تختفي اللوحة كليًا فقط عند عدم وجود أخبار نشطة.
 */
export default function AnnouncementBar() {
  const [, navigate] = useLocation();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Announcement | null>(null);

  const visible = useMemo(() => getActiveAnnouncements(), []);
  if (visible.length === 0) return null;
  const current = visible[index % visible.length];

  const open = () => {
    if (current.link) navigate(current.link);
    else setSelected(current);
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") open();
        }}
        className={`w-full rounded-3xl border bg-gradient-to-l p-4 mb-6 flex items-start gap-3 shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.99] cursor-pointer ${kindTint(current.kind)}`}
      >
        <span className="w-11 h-11 rounded-2xl bg-card shadow-sm flex items-center justify-center shrink-0">
          {kindIcon(current.kind)}
        </span>
        <div key={current.id} className="flex-1 min-w-0 animate-fade-up">
          <div className="font-bold text-[15px] text-foreground leading-snug">{current.title}</div>
          <div className="text-[13px] text-muted-foreground leading-relaxed mt-0.5">{current.body}</div>
          <div className="flex items-center gap-1.5 mt-2.5">
            {visible.map((a, i) => (
              <span
                key={a.id}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index % visible.length ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
                }`}
              />
            ))}
            <span className="text-[11px] text-muted-foreground mr-1.5">اضغط لعرض الخبر</span>
          </div>
        </div>
        {visible.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => (i + 1) % visible.length);
            }}
            className="p-2 rounded-full bg-card/90 shadow-sm hover:bg-card transition-colors text-muted-foreground shrink-0"
            title="الخبر التالي"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>
      {selected && (
        <AnnouncementDetailSheet announcement={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
