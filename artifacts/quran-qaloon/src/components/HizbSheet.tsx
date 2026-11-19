// قائمة الأحزاب في وضع القراءة (1.0.82) — الـ 60 حزبًا مع بداية
// كل حزب ونهايته وصفحته، والضغط على حزب يقفز إلى أول صفحة له.
import { X } from "lucide-react";
import { SURAHS } from "@/data/surahs";
import { getHizbList } from "@/data/hizb";
import { getPageOfAyah } from "@/data/mushaf-pages";

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d, 10)]);
}

export default function HizbSheet({
  onClose,
  onSelectPage,
}: {
  onClose: () => void;
  onSelectPage: (page: number) => void;
}) {
  const hizbs = getHizbList().map((h) => ({
    ...h,
    page: getPageOfAyah(h.startSurah, h.startAyah),
  }));

  return (
    <div
      className="fixed inset-0 z-[110] bg-background flex flex-col"
      data-testid="hizb-sheet"
    >
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-arabic text-lg text-primary flex-1">الأحزاب</span>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="إغلاق قائمة الأحزاب"
            title="إغلاق قائمة الأحزاب"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          ٦٠ حزبًا — اضغط أي حزب للقفز إلى أول صفحة فيه
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {hizbs.map((h) => {
          const startSurah = SURAHS[h.startSurah - 1];
          const endSurah = SURAHS[h.endSurah - 1];
          return (
            <button
              key={h.number}
              onClick={() => onSelectPage(h.page)}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-border/60 hover:bg-muted/60 active:bg-muted transition-colors text-right"
              data-hizb={h.number}
            >
              <span className="w-9 h-9 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-arabic">
                {toArabicNum(h.number)}
              </span>
              <span className="flex-1">
                <span className="block font-arabic text-lg leading-tight">
                  الحزب {toArabicNum(h.number)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  من سورة {startSurah.name} — الآية {toArabicNum(h.startAyah)} إلى سورة{" "}
                  {endSurah.name} — الآية {toArabicNum(h.endAyah)}
                </span>
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                ص {toArabicNum(h.page)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
