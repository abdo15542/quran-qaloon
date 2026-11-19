// فهرس السور في وضع القراءة (1.0.81) — قائمة الـ 114 سورة مع بحث
// سريع بالاسم أو بالرقم، والضغط على سورة يقفز إلى أول صفحة لها.
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { SURAHS } from "@/data/surahs";
import { getPageOfAyah } from "@/data/mushaf-pages";

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d, 10)]);
}

function typeLabel(t: string): string {
  if (t === "Meccan") return "مكية";
  if (t === "Medinan") return "مدنية";
  return "";
}

export default function SurahIndexSheet({
  onClose,
  onSelectPage,
}: {
  onClose: () => void;
  onSelectPage: (page: number) => void;
}) {
  const [q, setQ] = useState("");
  const entries = useMemo(
    () =>
      SURAHS.map((s) => ({
        number: s.number,
        name: s.name,
        type: typeLabel(s.revelationType),
        ayahs: s.numberOfAyahs,
        page: getPageOfAyah(s.number, 1),
      })),
    []
  );
  const filtered = useMemo(() => {
    const query = q.trim();
    if (!query) return entries;
    const digits = query.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
    const isDigits = /^[0-9]+$/.test(digits);
    return entries.filter(
      (e) =>
        e.name.includes(query) ||
        (isDigits && (String(e.number) === digits || String(e.page) === digits))
    );
  }, [q, entries]);

  return (
    <div
      className="fixed inset-0 z-[110] bg-background flex flex-col"
      data-testid="surah-index"
    >
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-arabic text-lg text-primary flex-1">فهرس السور</span>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="إغلاق الفهرس"
            title="إغلاق الفهرس"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-3 relative">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث باسم السورة أو رقمها…"
            aria-label="ابحث في فهرس السور"
            className="w-full pr-9 pl-3 py-2.5 rounded-xl bg-card border border-border text-sm placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-10">
            لا توجد سورة بهذا الاسم أو الرقم
          </div>
        )}
        {filtered.map((e) => (
          <button
            key={e.number}
            onClick={() => onSelectPage(e.page)}
            className="w-full flex items-center gap-3 px-4 py-3 border-b border-border/60 hover:bg-muted/60 active:bg-muted transition-colors text-right"
            data-surah={e.number}
          >
            <span className="w-9 h-9 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-arabic">
              {toArabicNum(e.number)}
            </span>
            <span className="flex-1">
              <span className="block font-arabic text-lg leading-tight">{e.name}</span>
              <span className="block text-xs text-muted-foreground">
                {e.type ? `${e.type} • ` : ""}
                {toArabicNum(e.ayahs)} آية • صفحة {toArabicNum(e.page)}
              </span>
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              ص {toArabicNum(e.page)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
