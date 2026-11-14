import { getAyah } from "@/data/quran-text";

interface AyahFromAPIProps {
  surah: number;
  from: number;
  to?: number;
  label: string;
}

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

// Offline: ayahs come from the bundled Uthmani text (src/data/quran-text.ts),
// never from the network.
export default function AyahFromAPI({ surah, from, to, label }: AyahFromAPIProps) {
  const end = to ?? from;
  const ayahs = [];
  for (let n = from; n <= end; n++) {
    const a = getAyah(surah, n);
    if (a) ayahs.push(a);
  }

  if (ayahs.length === 0) {
    return (
      <div className="text-sm text-destructive text-center py-2">تعذّر تحميل الآية</div>
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
