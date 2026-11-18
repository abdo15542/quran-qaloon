// تلوين أحكام التجويد في نص الآية — يلوّن كل حرف حسب حكمه وفق
// مفتاح المصاحف الملوّنة (دار المعرفة): المد أحمر، الغنة والإقلاب
// أخضر، الإخفاء والإدغام أزرق، القلقلة سماوي، وما لا يُنطق رمادي.
// البيانات: src/data/tajweed.ts — إحداثيات أحرف (JS indices) مواءمة
// على النص المضمّن في التطبيق. المقاطع المتداخلة (٣٩ آية، كلها غنة
// تتداخل مع الحكم التالي عند التنوين) تُقصّ: الأول يفوز بالحرف
// المشترك، فيُلوَّن كل حرف مرة واحدة.
import { Fragment } from "react";
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
}

export default function TajweedText({ surahNumber, ayahNumber, text, enabled }: TajweedTextProps) {
  if (!enabled) return <>{text}</>;
  const spans = TAJWEED[`${surahNumber}:${ayahNumber}`];
  if (!spans || spans.length === 0) return <>{text}</>;
  // الأطول أولًا عند نفس البداية؛ ثم قصّ أي تداخل.
  const sorted = [...spans].sort((a, b) => a[1] - b[1] || b[2] - b[1] - (a[2] - a[1]));
  const segments: { start: number; end: number; rule: string | null }[] = [];
  let pos = 0;
  for (const [ri, st, en] of sorted) {
    if (en <= pos) continue;
    const s = Math.max(st, pos);
    if (s > pos) segments.push({ start: pos, end: s, rule: null });
    segments.push({ start: s, end: en, rule: TAJWEED_RULES[ri] });
    pos = en;
  }
  if (pos < text.length) segments.push({ start: pos, end: text.length, rule: null });
  return (
    <>
      {segments.map((seg, i) =>
        seg.rule ? (
          <span key={i} className={RULE_CLASS[seg.rule] ?? ""}>
            {text.slice(seg.start, seg.end)}
          </span>
        ) : (
          <Fragment key={i}>{text.slice(seg.start, seg.end)}</Fragment>
        ),
      )}
    </>
  );
}
