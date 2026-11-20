// البحث بالجذر — يكتب المستخدم جذراً (مع التشكيل أو بدونه) فيعرض كل
// آية ورد فيها ذلك الجذر، مع عدد مرات وروده في كل آية. مكون مستقل:
// يوصله المنسق لاحقاً كتبويب في صفحة البحث (SearchPage).
// Fully offline — searchByRoot() reads the bundled root index.
import { useState } from "react";
import { Search, ListOrdered } from "lucide-react";
import { searchByRoot, surahName, type RootSearchResult } from "@/lib/word-root";
import { getAyah, displayAyahText } from "@/data/quran-text";

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

interface RootSearchProps {
  /** Navigate to an ayah (surah, ayah) — the parent owns navigation. */
  onNavigateAyah?: (surahNumber: number, ayahNumber: number) => void;
}

export default function RootSearch({ onNavigateAyah }: RootSearchProps) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<RootSearchResult | null>(null);

  const run = (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setResult(null);
      return;
    }
    setResult(searchByRoot(q));
  };

  return (
    <div data-testid="root-search" dir="rtl">
      <div className="relative">
        <input
          value={query}
          onChange={(e) => run(e.target.value)}
          placeholder="اكتب الجذر… مثال: علم"
          className="w-full bg-card border border-border rounded-xl pr-10 pl-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground font-arabic"
          data-testid="root-search-input"
          aria-label="ابحث بالجذر"
        />
        <Search className="w-5 h-5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {!result && (
        <p className="text-sm text-muted-foreground text-center py-6">
          اكتب جذراً من ثلاثة أحرف أو أكثر، مثل «علم» أو «كتب» أو «رحم»، لعرض
          كل الآيات التي ورد فيها.
        </p>
      )}

      {result && result.ayahs.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6" data-testid="root-search-empty">
          لم نجد آيات بالجذر «{result.query}» — تأكد من الإملاء وحاول مجدداً.
        </p>
      )}

      {result && result.ayahs.length > 0 && (
        <div className="mt-4">
          <div
            className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3"
            data-testid="root-search-summary"
          >
            <ListOrdered className="w-4 h-4" />
            <span>
              الجذر «{result.root}» ورد في {toArabicNum(result.ayahCount)} آية
              ({toArabicNum(result.totalOccurrences)} مرة)
            </span>
          </div>
          <div className="space-y-1.5" data-testid="root-search-results">
            {result.ayahs.map((a) => {
              const ayah = getAyah(a.surahNumber, a.ayahNumber);
              const text = ayah ? displayAyahText(a.surahNumber, a.ayahNumber, ayah.text) : "";
              return (
                <button
                  key={`${a.surahNumber}:${a.ayahNumber}`}
                  onClick={() => onNavigateAyah?.(a.surahNumber, a.ayahNumber)}
                  className="w-full text-right bg-card border border-border rounded-xl p-3 hover:border-primary/40 transition-colors"
                  data-root-ayah={`${a.surahNumber}:${a.ayahNumber}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-arabic text-sm text-primary">
                      سورة {surahName(a.surahNumber)} — الآية {toArabicNum(a.ayahNumber)}
                    </span>
                    {a.count > 1 && (
                      <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 shrink-0">
                        ×{toArabicNum(a.count)}
                      </span>
                    )}
                  </div>
                  <div
                    className="text-sm text-muted-foreground leading-relaxed mt-1 line-clamp-2"
                    style={{ fontFamily: "'Uthman Taha', 'Amiri Quran', serif" }}
                  >
                    {text}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
