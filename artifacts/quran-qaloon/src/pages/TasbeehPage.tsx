import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowRight, RotateCcw, Moon, Sun } from "lucide-react";

interface TasbeehPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

interface DhikrOption {
  id: string;
  text: string;
  target: number;
  color: string;
  ringColor: string;
  bgColor: string;
  textColor: string;
}

const DHIKR_OPTIONS: DhikrOption[] = [
  {
    id: "subhan",
    text: "سُبْحَانَ اللَّهِ",
    target: 33,
    color: "emerald",
    ringColor: "ring-emerald-500",
    bgColor: "bg-emerald-500",
    textColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "alhamd",
    text: "الْحَمْدُ لِلَّهِ",
    target: 33,
    color: "amber",
    ringColor: "ring-amber-500",
    bgColor: "bg-amber-500",
    textColor: "text-amber-600 dark:text-amber-400",
  },
  {
    id: "allahu",
    text: "اللَّهُ أَكْبَرُ",
    target: 34,
    color: "blue",
    ringColor: "ring-blue-500",
    bgColor: "bg-blue-500",
    textColor: "text-blue-600 dark:text-blue-400",
  },
  {
    id: "laila",
    text: "لَا إِلَهَ إِلَّا اللَّهُ",
    target: 100,
    color: "violet",
    ringColor: "ring-violet-500",
    bgColor: "bg-violet-500",
    textColor: "text-violet-600 dark:text-violet-400",
  },
];

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

function CircleProgress({
  count,
  target,
  color,
}: {
  count: number;
  target: number;
  color: string;
}) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(count / target, 1);
  const offset = circumference * (1 - progress);

  const strokeColors: Record<string, string> = {
    emerald: "#10b981",
    amber: "#f59e0b",
    blue: "#3b82f6",
    violet: "#8b5cf6",
  };

  return (
    <svg width="200" height="200" className="rotate-[-90deg]">
      <circle
        cx="100"
        cy="100"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        className="text-muted/30"
      />
      <circle
        cx="100"
        cy="100"
        r={radius}
        fill="none"
        stroke={strokeColors[color] ?? "#10b981"}
        strokeWidth="8"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-300"
      />
    </svg>
  );
}

export default function TasbeehPage({ darkMode, toggleDarkMode }: TasbeehPageProps) {
  const [selectedId, setSelectedId] = useState<string>("subhan");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [totalTaps, setTotalTaps] = useState(0);
  const [flash, setFlash] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  const selected = DHIKR_OPTIONS.find((d) => d.id === selectedId) ?? DHIKR_OPTIONS[0];
  const count = counts[selectedId] ?? 0;
  const laps = Math.floor(count / selected.target);
  const remaining = count % selected.target;

  const handleTap = useCallback(() => {
    setCounts((prev) => {
      const next = (prev[selectedId] ?? 0) + 1;
      if (next % selected.target === 0 && next > 0) {
        setCompletedIds((c) => new Set([...c, selectedId]));
        setTimeout(() => setCompletedIds((c) => { const s = new Set(c); s.delete(selectedId); return s; }), 1500);
      }
      return { ...prev, [selectedId]: next };
    });
    setTotalTaps((t) => t + 1);
    setFlash(true);
    setTimeout(() => setFlash(false), 120);

    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
  }, [selectedId, selected.target]);

  const handleReset = () => {
    setCounts((prev) => ({ ...prev, [selectedId]: 0 }));
  };

  const handleResetAll = () => {
    setCounts({});
    setTotalTaps(0);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleTap]);

  const isCompleted = completedIds.has(selectedId);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <button className="p-2 rounded-full hover:bg-muted transition-colors">
              <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1">
            <span className="font-arabic text-lg text-primary">المسبحة الإلكترونية</span>
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
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Dhikr selector */}
        <div className="grid grid-cols-2 gap-2">
          {DHIKR_OPTIONS.map((opt) => {
            const optCount = counts[opt.id] ?? 0;
            const done = optCount > 0 && optCount % opt.target === 0;
            return (
              <button
                key={opt.id}
                onClick={() => setSelectedId(opt.id)}
                className={`relative p-3 rounded-2xl border-2 text-right transition-all ${
                  selectedId === opt.id
                    ? `border-current ${opt.textColor} bg-muted/50`
                    : "border-border text-muted-foreground hover:border-muted-foreground/40"
                }`}
              >
                <div className={`font-arabic text-base leading-snug ${selectedId === opt.id ? opt.textColor : ""}`}>
                  {opt.text}
                </div>
                <div className="text-xs mt-1 opacity-60">
                  {optCount > 0 ? toArabicNum(optCount) : `الهدف: ${toArabicNum(opt.target)}`}
                </div>
                {done && (
                  <span className="absolute top-2 left-2 text-base">✓</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Main counter */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            <CircleProgress count={remaining} target={selected.target} color={selected.color} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div
                className={`font-arabic text-5xl font-bold transition-transform duration-100 ${
                  isCompleted ? selected.textColor : "text-foreground"
                } ${flash ? "scale-110" : "scale-100"}`}
              >
                {toArabicNum(remaining)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {laps > 0 && `× ${toArabicNum(laps + 1)}`}
              </div>
            </div>
          </div>

          {isCompleted && (
            <div className={`text-sm font-arabic ${selected.textColor} animate-pulse`}>
              ﴿ {selected.text} ﴾ أتممتَ الدورة!
            </div>
          )}

          <div className={`font-arabic text-xl ${selected.textColor}`}>{selected.text}</div>
          <div className="text-sm text-muted-foreground">
            الهدف: {toArabicNum(selected.target)} — المتبقي: {toArabicNum(selected.target - remaining)}
          </div>

          {/* Tap button */}
          <button
            onClick={handleTap}
            className={`w-44 h-44 rounded-full ${selected.bgColor} text-white text-2xl font-arabic shadow-2xl active:scale-95 transition-transform duration-100 select-none flex flex-col items-center justify-center gap-2`}
            aria-label="اضغط للتسبيح"
          >
            <span className="text-3xl">📿</span>
            <span className="text-sm opacity-90">اضغط</span>
          </button>

          <p className="text-xs text-muted-foreground">يمكنك الضغط على مفتاح المسافة أيضاً</p>
        </div>

        {/* Stats */}
        <div className="bg-card border border-border rounded-2xl p-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold font-arabic text-primary">{toArabicNum(count)}</div>
            <div className="text-xs text-muted-foreground mt-1">المجموع</div>
          </div>
          <div>
            <div className="text-2xl font-bold font-arabic text-primary">{toArabicNum(laps)}</div>
            <div className="text-xs text-muted-foreground mt-1">الدورات</div>
          </div>
          <div>
            <div className="text-2xl font-bold font-arabic text-primary">{toArabicNum(totalTaps)}</div>
            <div className="text-xs text-muted-foreground mt-1">إجمالي الجلسة</div>
          </div>
        </div>

        {/* Reset current */}
        {count > 0 && (
          <button
            onClick={handleReset}
            className="w-full py-2.5 text-sm text-muted-foreground border border-border rounded-xl hover:border-destructive/40 hover:text-destructive transition-colors"
          >
            إعادة ضبط هذا الذكر
          </button>
        )}

        {/* Session summary */}
        {Object.keys(counts).some((k) => (counts[k] ?? 0) > 0) && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
            <div className="text-xs text-muted-foreground mb-3">ملخص الجلسة</div>
            {DHIKR_OPTIONS.filter((d) => (counts[d.id] ?? 0) > 0).map((d) => (
              <div key={d.id} className="flex items-center justify-between">
                <span className={`font-arabic text-sm ${d.textColor}`}>{d.text}</span>
                <span className="text-sm font-semibold">{toArabicNum(counts[d.id] ?? 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
