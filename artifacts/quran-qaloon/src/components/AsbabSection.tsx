import { ScrollText } from "lucide-react";
import { getAsbab } from "@/data/asbab";

interface AsbabSectionProps {
  surahNumber: number;
  ayahNumber: number;
}

// سبب النزول داخل ورقة تفاصيل الآية (TafsirSheet) — يركّبه المنسّق هناك.
// لا يرسم شيئًا إطلاقًا عندما لا يذكر الواحدي سببًا لنزول الآية،
// فتبقى الورقة كما هي للآيات غير المشمولة (٥٦٤ آية مشمولة من ٦٢٣٦).
// البيانات مضمّنة دون إنترنت من «أسباب نزول القرآن» للواحدي.
export default function AsbabSection({ surahNumber, ayahNumber }: AsbabSectionProps) {
  const asbab = getAsbab(surahNumber, ayahNumber);
  if (!asbab) return null;

  return (
    <section aria-label="سبب النزول">
      <div className="flex items-center gap-2 mb-2">
        <ScrollText className="w-4 h-4 text-primary" />
        <h3 className="font-arabic text-base text-primary">سبب النزول — الواحدي</h3>
      </div>
      <p className="text-base leading-loose text-right whitespace-pre-line">{asbab}</p>
    </section>
  );
}
