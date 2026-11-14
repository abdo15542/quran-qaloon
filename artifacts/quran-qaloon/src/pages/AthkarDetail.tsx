import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Moon, Sun, RotateCcw, Check, Minus, Plus } from "lucide-react";
import { ATHKAR_CATEGORIES, type DhikrContent } from "@/data/athkar";
import AyahFromAPI from "@/components/AyahFromAPI";

interface AthkarDetailProps {
  categoryId: string;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const bgColorMap: Record<string, string> = {
  amber: "bg-amber-500",
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-600",
  teal: "bg-teal-600",
  violet: "bg-violet-600",
  orange: "bg-orange-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
};

const lightBgMap: Record<string, string> = {
  amber: "bg-amber-50 dark:bg-amber-950/20",
  indigo: "bg-indigo-50 dark:bg-indigo-950/20",
  emerald: "bg-emerald-50 dark:bg-emerald-950/20",
  teal: "bg-teal-50 dark:bg-teal-950/20",
  violet: "bg-violet-50 dark:bg-violet-950/20",
  orange: "bg-orange-50 dark:bg-orange-950/20",
  rose: "bg-rose-50 dark:bg-rose-950/20",
  sky: "bg-sky-50 dark:bg-sky-950/20",
};

const textColorMap: Record<string, string> = {
  amber: "text-amber-700 dark:text-amber-400",
  indigo: "text-indigo-700 dark:text-indigo-400",
  emerald: "text-emerald-700 dark:text-emerald-400",
  teal: "text-teal-700 dark:text-teal-400",
  violet: "text-violet-700 dark:text-violet-400",
  orange: "text-orange-700 dark:text-orange-400",
  rose: "text-rose-700 dark:text-rose-400",
  sky: "text-sky-700 dark:text-sky-400",
};

const borderColorMap: Record<string, string> = {
  amber: "border-amber-300 dark:border-amber-700",
  indigo: "border-indigo-300 dark:border-indigo-700",
  emerald: "border-emerald-300 dark:border-emerald-700",
  teal: "border-teal-300 dark:border-teal-700",
  violet: "border-violet-300 dark:border-violet-700",
  orange: "border-orange-300 dark:border-orange-700",
  rose: "border-rose-300 dark:border-rose-700",
  sky: "border-sky-300 dark:border-sky-700",
};

const ringColorMap: Record<string, string> = {
  amber: "ring-amber-400",
  indigo: "ring-indigo-400",
  emerald: "ring-emerald-400",
  teal: "ring-teal-400",
  violet: "ring-violet-400",
  orange: "ring-orange-400",
  rose: "ring-rose-400",
  sky: "ring-sky-400",
};

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

function DhikrContentBlock({ content, fontSize }: { content: DhikrContent[]; fontSize: number }) {
  return (
    <div className="space-y-3">
      {content.map((c, i) => {
        if (c.type === "text") {
          return (
            <div
              key={i}
              className="quran-text text-right leading-loose"
              style={{ fontSize: `${fontSize}px` }}
              dir="rtl"
            >
              {c.text}
            </div>
          );
        }
        return (
          <AyahFromAPI
            key={i}
            surah={c.surah}
            from={c.from}
            to={c.to}
            label={c.label}
          />
        );
      })}
    </div>
  );
}

export default function AthkarDetail({ categoryId, darkMode, toggleDarkMode }: AthkarDetailProps) {
  const category = ATHKAR_CATEGORIES.find((c) => c.id === categoryId);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [completed, setCompleted] = useState<Record<number, boolean>>({});
  const [fontSize, setFontSize] = useState<number>(() => {
    const stored = localStorage.getItem("athkar_font_size");
    return stored ? Number(stored) : 20;
  });

  const setFontSizePersist = (v: number) => {
    setFontSize(v);
    localStorage.setItem("athkar_font_size", String(v));
  };

  if (!category) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-6xl mb-4">📿</div>
          <div className="text-xl mb-4">الفئة غير موجودة</div>
          <Link href="/athkar">
            <button className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl">العودة للأذكار</button>
          </Link>
        </div>
      </div>
    );
  }

  const color = category.color;

  const handleCount = (id: number, maxCount: number) => {
    setCounts((prev) => {
      const current = prev[id] || 0;
      if (current >= maxCount) return prev;
      const next = current + 1;
      if (next >= maxCount) {
        setCompleted((c) => ({ ...c, [id]: true }));
      }
      return { ...prev, [id]: next };
    });
  };

  const handleReset = (id: number) => {
    setCounts((prev) => ({ ...prev, [id]: 0 }));
    setCompleted((prev) => ({ ...prev, [id]: false }));
  };

  const handleResetAll = () => {
    setCounts({});
    setCompleted({});
  };

  const completedCount = category.items.filter((item) => completed[item.id]).length;
  const allCompleted = completedCount === category.items.length;
  const progressPct = Math.round((completedCount / category.items.length) * 100);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
          <Link href="/athkar">
            <button className="p-2 rounded-full hover:bg-muted transition-colors">
              <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1 text-center">
            <div className="font-arabic text-base text-primary">{category.icon} {category.name}</div>
          </div>
          <div className="flex items-center gap-1">
            {/* Font size controls */}
            <div className="flex items-center gap-0.5 bg-muted rounded-lg px-1">
              <button
                onClick={() => setFontSizePersist(Math.max(fontSize - 2, 14))}
                disabled={fontSize <= 14}
                className="p-1 rounded hover:bg-background transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="تصغير الخط"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-xs text-muted-foreground w-5 text-center tabular-nums">{fontSize}</span>
              <button
                onClick={() => setFontSizePersist(Math.min(fontSize + 2, 36))}
                disabled={fontSize >= 36}
                className="p-1 rounded hover:bg-background transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="تكبير الخط"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <button
              onClick={handleResetAll}
              className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground"
              title="إعادة ضبط الكل"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-5">
        {/* Category info + progress */}
        <div className={`rounded-2xl p-4 mb-5 ${lightBgMap[color]} border ${borderColorMap[color]}`}>
          <div className={`text-sm text-center ${textColorMap[color]} mb-2`}>{category.description}</div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-white/50 dark:bg-black/20 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${bgColorMap[color]}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className={`text-xs font-sans flex-shrink-0 ${textColorMap[color]}`}>
              {toArabicNum(completedCount)}/{toArabicNum(category.items.length)}
            </span>
          </div>
          {allCompleted && (
            <div className="mt-2 text-sm font-arabic text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
              <Check className="w-4 h-4" />
              تم الانتهاء من جميع الأذكار — تقبّل الله منك
            </div>
          )}
        </div>

        <div className="space-y-3">
          {category.items.map((item, index) => {
            const currentCount = counts[item.id] || 0;
            const maxCount = item.count || 1;
            const isDone = completed[item.id];
            const countProgress = maxCount > 1 ? (currentCount / maxCount) * 100 : isDone ? 100 : 0;

            return (
              <div
                key={item.id}
                className={`bg-card border rounded-2xl overflow-hidden transition-all ${
                  isDone ? `${borderColorMap[color]} ring-1 ${ringColorMap[color]}` : "border-border"
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    {/* Index / Done badge */}
                    <div className={`text-xs font-sans w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1 transition-all ${
                      isDone ? `${bgColorMap[color]} text-white` : "bg-muted text-muted-foreground"
                    }`}>
                      {isDone ? <Check className="w-3 h-3" /> : index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <DhikrContentBlock content={item.content} fontSize={fontSize} />

                      {item.source && (
                        <div className="text-xs text-muted-foreground mt-3 text-right font-sans border-t border-border pt-2">
                          📖 {item.source}
                        </div>
                      )}
                      {item.benefit && (
                        <div className={`text-xs mt-1 text-right font-sans ${textColorMap[color]}`}>
                          ✨ {item.benefit}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Count progress bar */}
                  {maxCount > 1 && (
                    <div className="mb-3">
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${bgColorMap[color]}`}
                          style={{ width: `${countProgress}%` }}
                        />
                      </div>
                      <div className={`text-xs text-center mt-1 font-sans ${textColorMap[color]}`}>
                        {toArabicNum(currentCount)} / {toArabicNum(maxCount)}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    {maxCount > 1 ? (
                      <button
                        onClick={() => handleCount(item.id, maxCount)}
                        disabled={isDone}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-arabic transition-all active:scale-95 ${
                          isDone
                            ? "bg-muted text-muted-foreground cursor-default"
                            : `${bgColorMap[color]} text-white hover:opacity-90`
                        }`}
                      >
                        {isDone
                          ? "✓ اكتمل"
                          : currentCount === 0
                          ? `عُدَّ × ${toArabicNum(maxCount)}`
                          : `عُدَّ — ${toArabicNum(maxCount - currentCount)} متبقية`}
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          setCompleted((c) => ({ ...c, [item.id]: !c[item.id] }))
                        }
                        className={`flex-1 py-2.5 rounded-xl text-sm font-arabic transition-all active:scale-95 ${
                          isDone
                            ? "bg-muted text-muted-foreground"
                            : `${bgColorMap[color]} text-white hover:opacity-90`
                        }`}
                      >
                        {isDone ? "✓ اكتملت" : "قرأتُ هذا الذكر"}
                      </button>
                    )}
                    {(currentCount > 0 || isDone) && (
                      <button
                        onClick={() => handleReset(item.id)}
                        className="p-2.5 rounded-xl hover:bg-muted transition-colors text-muted-foreground"
                        title="إعادة"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}
