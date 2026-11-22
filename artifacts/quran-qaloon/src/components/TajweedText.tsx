// تلوين أحكام التجويد في نص الآية — يلوّن كل حرف حسب حكمه وفق
// مفتاح المصاحف الملوّنة (دار المعرفة): المد أحمر، الغنة والإقلاب
// أخضر، الإخفاء والإدغام أزرق، القلقلة سماوي، وما لا يُنطق رمادي.
// البيانات: src/data/tajweed.ts — إحداثيات أحرف (JS indices) مواءمة
// على النص المضمّن في التطبيق. المقاطع المتداخلة (٣٩ آية، كلها غنة
// تتداخل مع الحكم التالي عند التنوين) تُقصّ: الأول يفوز بالحرف
// المشترك، فيُلوَّن كل حرف مرة واحدة.
import { Fragment, memo, useMemo } from "react";
import { TAJWEED, TAJWEED_RULES } from "@/data/tajweed";

const RULE_CLASS: Record<string, string> = {
  // المد — أحمر
  madd_2: "text-red-600 dark:text-red-400",
  madd_246: "text-red-600 dark:text-red-400",
  madd_6: "text-red-600 dark:text-red-400",
  madd_muttasil: "text-red-600 dark:text-red-400",
  madd_munfasil: "text-red-600 dark:text-red-400",
  // الغنة والإقلاب — أخضر
  ghunnah: "text-green-600 dark:text-green-400",
  iqlab: "text-green-600 dark:text-green-400",
  // الإخفاء والإدغام — أزرق
  ikhfa: "text-blue-600 dark:text-blue-400",
  ikhfa_shafawi: "text-blue-600 dark:text-blue-400",
  idghaam_ghunnah: "text-blue-600 dark:text-blue-400",
  idghaam_no_ghunnah: "text-blue-600 dark:text-blue-400",
  idghaam_shafawi: "text-blue-600 dark:text-blue-400",
  idghaam_mutajanisayn: "text-blue-600 dark:text-blue-400",
  idghaam_mutaqaribayn: "text-blue-600 dark:text-blue-400",
  // القلقلة — سماوي
  qalqalah: "text-sky-600 dark:text-sky-400",
  // لا تُنطق — رمادي
  hamzat_wasl: "text-zinc-400 dark:text-zinc-500",
  lam_shamsiyyah: "text-zinc-400 dark:text-zinc-500",
  silent: "text-zinc-400 dark:text-zinc-500",
};

/** مفتاح الألوان المعروض تحت عنوان السورة عند تفعيل التجويد. */
export const TAJWEED_LEGEND: { label: string; className: string }[] = [
  { label: "المد", className: "text-red-600 dark:text-red-400" },
  { label: "الغنة والإقلاب", className: "text-green-600 dark:text-green-400" },
  { label: "الإخفاء والإدغام", className: "text-blue-600 dark:text-blue-400" },
  { label: "القلقلة", className: "text-sky-600 dark:text-sky-400" },
  { label: "لا تُنطق", className: "text-zinc-400 dark:text-zinc-500" },
];

interface TajweedTextProps {
  surahNumber: number;
  ayahNumber: number;
  text: string;
  enabled: boolean;
  /** نافذة [بداية، نهاية) بإحداثيات الآية الكاملة: يُعرض فقط هذا
      المقطع من النص (المصحف يفصل البسملة عن بقية الآية الأولى). */
  window?: [number, number];
  /** عند الضغط على حرف ملوّن: يُستدعى بمعرّف الحكم لعرض شرحه. */
  onRuleClick?: (rule: string) => void;
}

function TajweedText({ surahNumber, ayahNumber, text, enabled, window, onRuleClick }: TajweedTextProps) {
  const w0 = window ? window[0] : 0;
  const w1 = window ? window[1] : text.length;
  // [1.0.104] الفرز والتقطيع كانا يُعادان عند كل رسم لكل آية —
  // فصارا محفوظين: لا يُعادان إلا حين يتغير النص أو النافذة.
  const segments = useMemo(() => {
    if (!enabled) return null;
    const spans = TAJWEED[`${surahNumber}:${ayahNumber}`];
    if (!spans || spans.length === 0) return null;
    // الأطول أولًا عند نفس البداية؛ ثم قصّ أي تداخل.
    const sorted = [...spans].sort((a, b) => a[1] - b[1] || b[2] - b[1] - (a[2] - a[1]));
    const segs: { start: number; end: number; rule: string | null }[] = [];
    let pos = w0;
    for (const [ri, st, en] of sorted) {
      // قصّ المقطع على النافذة أولًا، ثم على ما سبق عرضه.
      const cs = Math.max(st, w0, pos);
      const ce = Math.min(en, w1);
      if (ce <= cs) continue;
      if (cs > pos) segs.push({ start: pos, end: cs, rule: null });
      segs.push({ start: cs, end: ce, rule: TAJWEED_RULES[ri] });
      pos = ce;
    }
    if (pos < w1) segs.push({ start: pos, end: w1, rule: null });
    return segs;
  }, [surahNumber, ayahNumber, text, enabled, w0, w1]);
  if (segments == null) return <>{text}</>;
  return (
    <>
      {segments.map((seg, i) =>
        seg.rule ? (
          <span
            key={i}
            data-tajweed-rule={seg.rule}
            className={`${RULE_CLASS[seg.rule] ?? ""}${onRuleClick ? " cursor-pointer underline decoration-dotted underline-offset-4" : ""}`}
            onClick={
              onRuleClick
                ? (e) => {
                    e.stopPropagation();
                    onRuleClick(seg.rule as string);
                  }
                : undefined
            }
          >
            {text.slice(seg.start - w0, seg.end - w0)}
          </span>
        ) : (
          <Fragment key={i}>{text.slice(seg.start - w0, seg.end - w0)}</Fragment>
        ),
      )}
    </>
  );
}

export default memo(TajweedText);
