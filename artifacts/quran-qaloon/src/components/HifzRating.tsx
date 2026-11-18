import { useState } from "react";
import { getRating, rateAyah, type HifzEntry, type HifzQuality } from "@/lib/hifz";

interface HifzRatingProps {
  surahNumber: number;
  ayahNumber: number;
  /** يُستدعى بعد كل تقييم بالإدخال الجديد. */
  onRated?: (entry: HifzEntry) => void;
}

const BUTTONS: Array<{ q: HifzQuality; label: string; cls: string; activeCls: string }> = [
  {
    q: 1,
    label: "سهل",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
    activeCls: "bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-600 dark:text-white ring-2 ring-emerald-400",
  },
  {
    q: 2,
    label: "متوسط",
    cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
    activeCls: "bg-amber-500 text-white border-amber-500 dark:bg-amber-500 dark:text-white ring-2 ring-amber-400",
  },
  {
    q: 3,
    label: "صعب",
    cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800",
    activeCls: "bg-red-600 text-white border-red-600 dark:bg-red-600 dark:text-white ring-2 ring-red-400",
  },
];

/**
 * صف تقييم الحفظ لآية: سهل / متوسط / صعب.
 * يكتب عبر rateAyah (SM-2) ويُظهر التقييم المحفوظ الحالي إن وُجد.
 * يستخدمه منسّق SurahPlayer لاحقاً — لا يعدّل أي صفحة مشتركة.
 */
export default function HifzRating({ surahNumber, ayahNumber, onRated }: HifzRatingProps) {
  const [saved, setSaved] = useState<HifzEntry | null>(() => getRating(surahNumber, ayahNumber));

  const handleRate = (q: HifzQuality) => {
    const entry = rateAyah(surahNumber, ayahNumber, q);
    setSaved(entry);
    onRated?.(entry);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2" role="group" aria-label="تقييم الحفظ">
        {BUTTONS.map(({ q, label, cls, activeCls }) => {
          const active = saved?.q === q;
          return (
            <button
              key={q}
              type="button"
              data-testid={`hifz-rate-${q}`}
              data-hifz-rate={q}
              onClick={() => handleRate(q)}
              aria-pressed={active}
              className={`flex-1 py-2.5 px-2 rounded-xl border text-sm font-bold transition-colors ${
                active ? activeCls : cls
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {saved && (
        <p className="text-[11px] text-muted-foreground text-center">
          آخر تقييم: {saved.q === 1 ? "سهل" : saved.q === 2 ? "متوسط" : "صعب"} — المراجعة القادمة{" "}
          {new Date(`${saved.due}T12:00:00`).toLocaleDateString("ar-EG", {
            day: "numeric",
            month: "long",
          })}
        </p>
      )}
    </div>
  );
}
