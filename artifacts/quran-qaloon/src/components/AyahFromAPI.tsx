import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface AyahFromAPIProps {
  surah: number;
  from: number;
  to?: number;
  label: string;
}

interface AyahData {
  numberInSurah: number;
  text: string;
}

const cache: Record<string, AyahData[]> = {};

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

export default function AyahFromAPI({ surah, from, to, label }: AyahFromAPIProps) {
  const cacheKey = `${surah}-${from}-${to ?? from}`;
  const [ayahs, setAyahs] = useState<AyahData[]>(cache[cacheKey] || []);
  const [loading, setLoading] = useState(!cache[cacheKey]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache[cacheKey]) {
      setAyahs(cache[cacheKey]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`https://api.alquran.cloud/v1/surah/${surah}/quran-uthmani`)
      .then((r) => {
        if (!r.ok) throw new Error("فشل التحميل");
        return r.json();
      })
      .then((data) => {
        if (data.code === 200 && data.data?.ayahs) {
          const end = to ?? from;
          const filtered: AyahData[] = data.data.ayahs
            .filter((a: AyahData) => a.numberInSurah >= from && a.numberInSurah <= end)
            .map((a: AyahData) => ({ numberInSurah: a.numberInSurah, text: a.text }));
          cache[cacheKey] = filtered;
          setAyahs(filtered);
        } else {
          throw new Error("بيانات غير صحيحة");
        }
      })
      .catch(() => setError("تعذّر تحميل الآية"))
      .finally(() => setLoading(false));
  }, [surah, from, to, cacheKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">جاري تحميل {label}...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive text-center py-2">{error}</div>
    );
  }

  return (
    <div>
      <div className="text-xs text-primary/70 mb-1.5 text-right font-sans">{label}</div>
      <div className="quran-text text-xl text-right leading-loose">
        {ayahs.map((ayah) => (
          <span key={ayah.numberInSurah}>
            {ayah.text}{" "}
            <span className="text-primary inline-block text-base">
              ﴿{toArabicNum(ayah.numberInSurah)}﴾
            </span>{" "}
          </span>
        ))}
      </div>
    </div>
  );
}
