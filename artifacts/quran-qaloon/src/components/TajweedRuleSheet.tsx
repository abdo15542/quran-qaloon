// ورقة شرح حكم التجويد — تظهر عند الضغط على حرف ملوّن في
// السورة أو في المصحف: اسم الحكم وشرح موجز له.
import { X } from "lucide-react";
import { TAJWEED_RULE_INFO } from "@/data/tajweed-rules";

export default function TajweedRuleSheet({
  rule,
  onClose,
}: {
  rule: string | null;
  onClose: () => void;
}) {
  if (!rule) return null;
  const info = TAJWEED_RULE_INFO[rule];
  if (!info) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg bg-card border border-border rounded-t-2xl p-5 pb-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="font-arabic text-lg text-primary">{info.name}</span>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-foreground leading-relaxed">{info.desc}</p>
        <p className="text-xs text-muted-foreground mt-3">اضغط أي حرف ملوّن آخر لعرض حكمه</p>
      </div>
    </div>
  );
}
