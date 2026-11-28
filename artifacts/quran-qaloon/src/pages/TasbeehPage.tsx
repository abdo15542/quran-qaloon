import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { ArrowRight, RotateCcw, Moon, Sun, Plus, X, Volume2, VolumeX, Vibrate, VibrateOff, SkipForward, Check, Trash2 } from "lucide-react";

interface TasbeehPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

interface DhikrOption {
  id: string;
  text: string;
  defaultTarget: number;
  color: string;
  ringColor: string;
  bgColor: string;
  textColor: string;
  custom?: boolean;
}

interface CustomDhikr {
  id: string;
  text: string;
  target: number;
}

// [1.0.117] عشرة أذكار جاهزة بدل أربعة — الأذكار اليومية الأكثر استعمالاً.
const BUILT_IN_DHIKR: DhikrOption[] = [
  { id: "subhan", text: "سُبْحَانَ اللَّهِ", defaultTarget: 33, color: "emerald", ringColor: "ring-emerald-500", bgColor: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400" },
  { id: "alhamd", text: "الْحَمْدُ لِلَّهِ", defaultTarget: 33, color: "amber", ringColor: "ring-amber-500", bgColor: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400" },
  { id: "allahu", text: "اللَّهُ أَكْبَرُ", defaultTarget: 34, color: "blue", ringColor: "ring-blue-500", bgColor: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400" },
  { id: "laila", text: "لَا إِلَهَ إِلَّا اللَّهُ", defaultTarget: 100, color: "violet", ringColor: "ring-violet-500", bgColor: "bg-violet-500", textColor: "text-violet-600 dark:text-violet-400" },
  { id: "astaghfir", text: "أَسْتَغْفِرُ اللَّهَ", defaultTarget: 100, color: "teal", ringColor: "ring-teal-500", bgColor: "bg-teal-500", textColor: "text-teal-600 dark:text-teal-400" },
  { id: "subhanbihamd", text: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", defaultTarget: 100, color: "rose", ringColor: "ring-rose-500", bgColor: "bg-rose-500", textColor: "text-rose-600 dark:text-rose-400" },
  { id: "subhanazeem", text: "سُبْحَانَ اللَّهِ الْعَظِيمِ", defaultTarget: 100, color: "indigo", ringColor: "ring-indigo-500", bgColor: "bg-indigo-500", textColor: "text-indigo-600 dark:text-indigo-400" },
  { id: "hawqala", text: "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ", defaultTarget: 100, color: "orange", ringColor: "ring-orange-500", bgColor: "bg-orange-500", textColor: "text-orange-600 dark:text-orange-400" },
  { id: "salawat", text: "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ", defaultTarget: 100, color: "cyan", ringColor: "ring-cyan-500", bgColor: "bg-cyan-500", textColor: "text-cyan-600 dark:text-cyan-400" },
  { id: "hasbi", text: "حَسْبِيَ اللَّهُ وَنِعْمَ الْوَكِيلُ", defaultTarget: 100, color: "lime", ringColor: "ring-lime-500", bgColor: "bg-lime-500", textColor: "text-lime-600 dark:text-lime-400" },
];

// تسبيح بعد الصلاة: ٣٣ + ٣٣ + ٣٤ بالترتيب.
const PRAYER_SEQUENCE = ["subhan", "alhamd", "allahu"];
const PRAYER_TARGETS = [33, 33, 34];

const CUSTOM_COLORS: Array<{ color: string; ringColor: string; bgColor: string; textColor: string }> = [
  { color: "teal", ringColor: "ring-teal-500", bgColor: "bg-teal-500", textColor: "text-teal-600 dark:text-teal-400" },
  { color: "rose", ringColor: "ring-rose-500", bgColor: "bg-rose-500", textColor: "text-rose-600 dark:text-rose-400" },
  { color: "indigo", ringColor: "ring-indigo-500", bgColor: "bg-indigo-500", textColor: "text-indigo-600 dark:text-indigo-400" },
  { color: "orange", ringColor: "ring-orange-500", bgColor: "bg-orange-500", textColor: "text-orange-600 dark:text-orange-400" },
  { color: "cyan", ringColor: "ring-cyan-500", bgColor: "bg-cyan-500", textColor: "text-cyan-600 dark:text-cyan-400" },
  { color: "lime", ringColor: "ring-lime-500", bgColor: "bg-lime-500", textColor: "text-lime-600 dark:text-lime-400" },
];

const TARGET_CHOICES = [33, 100, 500, 1000];
const GOAL_CHOICES = [100, 300, 500, 1000];
const WEEKDAY_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function toArabicNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d)]);
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeStreak(daily: Record<string, number>): number {
  let streak = 0;
  const d = new Date();
  if ((daily[dateKey(d)] ?? 0) === 0) d.setDate(d.getDate() - 1);
  while ((daily[dateKey(d)] ?? 0) > 0) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function CircleProgress({ count, target, color }: { count: number; target: number; color: string }) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = target > 0 ? Math.min(count / target, 1) : 0;
  const offset = circumference * (1 - progress);

  const strokeColors: Record<string, string> = {
    emerald: "#10b981",
    amber: "#f59e0b",
    blue: "#3b82f6",
    violet: "#8b5cf6",
    teal: "#14b8a6",
    rose: "#f43f5e",
    indigo: "#6366f1",
    orange: "#f97316",
    cyan: "#06b6d4",
    lime: "#84cc16",
  };

  return (
    <svg width="200" height="200" className="rotate-[-90deg]">
      <circle cx="100" cy="100" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
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

interface TasbeehStore {
  counts: Record<string, number>;
  totalTaps: number;
  targets?: Record<string, number>;
  custom?: CustomDhikr[];
  daily?: Record<string, number>;
  goal?: number;
  settings?: { sound: boolean; vibrate: boolean; autoAdvance: boolean };
}

const TASBEEH_KEY = "quran_tasbeeh_counts";

function loadStore(): TasbeehStore {
  try {
    const raw = localStorage.getItem(TASBEEH_KEY);
    if (!raw) return { counts: {}, totalTaps: 0 };
    const parsed = JSON.parse(raw) as TasbeehStore;
    return {
      counts: parsed.counts ?? {},
      totalTaps: parsed.totalTaps ?? 0,
      targets: parsed.targets ?? {},
      custom: Array.isArray(parsed.custom) ? parsed.custom : [],
      daily: parsed.daily ?? {},
      goal: typeof parsed.goal === "number" && parsed.goal > 0 ? parsed.goal : 100,
      settings: {
        sound: parsed.settings?.sound ?? false,
        vibrate: parsed.settings?.vibrate ?? true,
        autoAdvance: parsed.settings?.autoAdvance ?? false,
      },
    };
  } catch {
    return { counts: {}, totalTaps: 0 };
  }
}

export default function TasbeehPage({ darkMode, toggleDarkMode }: TasbeehPageProps) {
  const [initial] = useState<TasbeehStore>(() => loadStore());
  const [selectedId, setSelectedId] = useState<string>("subhan");
  const [counts, setCounts] = useState<Record<string, number>>(initial.counts);
  const [totalTaps, setTotalTaps] = useState<number>(initial.totalTaps);
  const [targets, setTargets] = useState<Record<string, number>>(initial.targets ?? {});
  const [customDhikr, setCustomDhikr] = useState<CustomDhikr[]>(initial.custom ?? []);
  const [daily, setDaily] = useState<Record<string, number>>(initial.daily ?? {});
  const [goal, setGoal] = useState<number>(initial.goal ?? 100);
  const [settings, setSettings] = useState(initial.settings ?? { sound: false, vibrate: true, autoAdvance: false });
  const [flash, setFlash] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  // [1.0.117] تسبيح بعد الصلاة: ٣٣ + ٣٣ + ٣٤ بالترتيب مع انتقال تلقائي.
  const [prayerMode, setPrayerMode] = useState(false);
  const [prayerStep, setPrayerStep] = useState(0);
  const [prayerDone, setPrayerDone] = useState(false);

  // إضافة ذكر مخصص.
  const [customText, setCustomText] = useState("");
  const [customTarget, setCustomTarget] = useState(100);
  const [showCustomForm, setShowCustomForm] = useState(false);

  // هدف مخصص للذكر المحدد.
  const [customTargetInput, setCustomTargetInput] = useState("");

  useEffect(() => {
    try {
      const store: TasbeehStore = { counts, totalTaps, targets, custom: customDhikr, daily, goal, settings };
      localStorage.setItem(TASBEEH_KEY, JSON.stringify(store));
    } catch {
      // storage unavailable
    }
  }, [counts, totalTaps, targets, customDhikr, daily, goal, settings]);

  const allOptions: DhikrOption[] = [
    ...BUILT_IN_DHIKR,
    ...customDhikr.map((c, i) => {
      const col = CUSTOM_COLORS[i % CUSTOM_COLORS.length];
      return { id: c.id, text: c.text, defaultTarget: c.target, color: col.color, ringColor: col.ringColor, bgColor: col.bgColor, textColor: col.textColor, custom: true };
    }),
  ];

  const selected = allOptions.find((d) => d.id === selectedId) ?? allOptions[0];
  // في وضع الصلاة الهدف ثابت ٣٣/٣٣/٣٤ مهما كان الهدف المخصص.
  const target = prayerMode ? PRAYER_TARGETS[prayerStep] : (targets[selected.id] ?? selected.defaultTarget);
  const count = counts[selected.id] ?? 0;
  const laps = target > 0 ? Math.floor(count / target) : 0;
  const remaining = target > 0 ? count % target : 0;

  const todayKey = dateKey(new Date());
  const todayCount = daily[todayKey] ?? 0;
  const streak = computeStreak(daily);
  const bestDay = Object.values(daily).reduce((m, v) => Math.max(m, v), 0);
  const goalProgress = goal > 0 ? Math.min(todayCount / goal, 1) : 0;

  // آخر ٧ أيام للسجل.
  const last7: Array<{ key: string; label: string; value: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7.push({ key: dateKey(d), label: i === 0 ? "اليوم" : WEEKDAY_AR[d.getDay()], value: daily[dateKey(d)] ?? 0 });
  }
  const maxDay = Math.max(1, ...last7.map((d) => d.value));

  const beep = useCallback((freq: number, dur: number, vol: number, delay = 0) => {
    try {
      if (!audioRef.current) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioRef.current = new AC();
      }
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      const t0 = ctx.currentTime + delay;
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur);
    } catch {
      // no audio
    }
  }, []);

  const clearTimers = () => {
    if (completeTimeoutRef.current) {
      clearTimeout(completeTimeoutRef.current);
      completeTimeoutRef.current = null;
    }
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
  };

  const handleTap = useCallback(() => {
    const next = (counts[selected.id] ?? 0) + 1;
    setCounts((prev) => ({ ...prev, [selected.id]: next }));
    setTotalTaps((t) => t + 1);
    setDaily((prev) => ({ ...prev, [todayKey]: (prev[todayKey] ?? 0) + 1 }));
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
    if (settings.vibrate && navigator.vibrate) navigator.vibrate(30);
    if (settings.sound) beep(660, 0.05, 0.04);

    if (next % target === 0 && next > 0) {
      setCompletedIds((c) => new Set([...c, selected.id]));
      if (settings.sound) {
        beep(880, 0.15, 0.15);
        beep(1174, 0.2, 0.15, 0.12);
      }
      if (settings.vibrate && navigator.vibrate) navigator.vibrate([60, 60, 60]);
      completeTimeoutRef.current = setTimeout(() => {
        setCompletedIds((c) => {
          const s = new Set(c);
          s.delete(selected.id);
          return s;
        });
      }, 1500);

      if (prayerMode) {
        if (prayerStep < 2) {
          const nextStep = prayerStep + 1;
          advanceTimeoutRef.current = setTimeout(() => {
            setPrayerStep(nextStep);
            setSelectedId(PRAYER_SEQUENCE[nextStep]);
          }, 800);
        } else {
          advanceTimeoutRef.current = setTimeout(() => {
            setPrayerDone(true);
            setPrayerMode(false);
          }, 800);
        }
      } else if (settings.autoAdvance) {
        const idx = allOptions.findIndex((d) => d.id === selected.id);
        const nextOpt = allOptions[(idx + 1) % allOptions.length];
        if (nextOpt) {
          advanceTimeoutRef.current = setTimeout(() => setSelectedId(nextOpt.id), 600);
        }
      }
    }
  }, [counts, selected, target, todayKey, settings, beep, prayerMode, prayerStep, allOptions]);

  const handleReset = () => {
    setCounts((prev) => ({ ...prev, [selected.id]: 0 }));
    setCompletedIds((c) => {
      const s = new Set(c);
      s.delete(selected.id);
      return s;
    });
    clearTimers();
  };

  const handleResetAll = () => {
    setCounts({});
    setTotalTaps(0);
    setCompletedIds(new Set());
    clearTimers();
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        // Space on a focused button fires its click on keyup, which a
        // keydown preventDefault does NOT block — the tap would count
        // twice. Let the button handle its own key instead.
        if (document.activeElement instanceof HTMLButtonElement) return;
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleTap]);

  const startPrayerMode = () => {
    clearTimers();
    setPrayerDone(false);
    setPrayerMode(true);
    setPrayerStep(0);
    setSelectedId(PRAYER_SEQUENCE[0]);
  };

  const exitPrayerMode = () => {
    clearTimers();
    setPrayerMode(false);
    setPrayerDone(false);
  };

  const addCustomDhikr = () => {
    const text = customText.trim();
    if (!text) return;
    const id = `custom-${Date.now()}`;
    const t = customTarget > 0 ? customTarget : 100;
    setCustomDhikr((prev) => [...prev, { id, text, target: t }]);
    setTargets((prev) => ({ ...prev, [id]: t }));
    setCustomText("");
    setCustomTarget(100);
    setShowCustomForm(false);
    setSelectedId(id);
  };

  const deleteCustomDhikr = (id: string) => {
    setCustomDhikr((prev) => prev.filter((c) => c.id !== id));
    setCounts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setTargets((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (selectedId === id) setSelectedId("subhan");
  };

  const setTargetForSelected = (t: number) => {
    if (t <= 0) return;
    setTargets((prev) => ({ ...prev, [selected.id]: t }));
    setCustomTargetInput("");
  };

  const isCompleted = completedIds.has(selected.id);

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
        {/* [1.0.117] تسبيح بعد الصلاة */}
        {prayerDone && (
          <div data-testid="tasbeeh-prayer-done" className="bg-emerald-500/10 border border-emerald-500/40 rounded-2xl p-4 text-center">
            <div className="font-arabic text-lg text-emerald-600 dark:text-emerald-400">تقبّل الله منا ومنكم</div>
            <div className="text-xs text-muted-foreground mt-1">أتممتَ تسبيح ما بعد الصلاة: ٣٣ + ٣٣ + ٣٤</div>
            <button
              onClick={() => setPrayerDone(false)}
              className="mt-3 px-4 py-1.5 text-sm rounded-full bg-emerald-500 text-white"
            >
              حسناً
            </button>
          </div>
        )}

        {prayerMode ? (
          <div data-testid="tasbeeh-prayer-steps" className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-arabic text-base text-primary">تسبيح بعد الصلاة</span>
              <button onClick={exitPrayerMode} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground" title="إنهاء">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {PRAYER_SEQUENCE.map((id, i) => {
                const opt = BUILT_IN_DHIKR.find((d) => d.id === id)!;
                const done = i < prayerStep;
                const active = i === prayerStep;
                return (
                  <div
                    key={id}
                    className={`flex-1 text-center py-2 rounded-xl border-2 font-arabic text-sm ${
                      done
                        ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                        : active
                          ? `border-current ${opt.textColor} bg-muted/50`
                          : "border-border text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="w-4 h-4 mx-auto" /> : opt.text}
                    <div className="text-[11px] mt-0.5 opacity-70">
                      {toArabicNum(PRAYER_TARGETS[i])} — {toArabicNum(i + 1)} من ٣
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <button
            data-testid="tasbeeh-prayer-btn"
            onClick={startPrayerMode}
            className="w-full py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-arabic text-base hover:bg-emerald-500/20 transition-colors"
          >
            📿 تسبيح بعد الصلاة — ٣٣ + ٣٣ + ٣٤
          </button>
        )}

        {/* Main counter */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            <CircleProgress count={remaining} target={target} color={selected.color} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div
                data-testid="tasbeeh-count"
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
            <div data-testid="tasbeeh-complete" className={`text-sm font-arabic ${selected.textColor} animate-pulse`}>
              ﴿ {selected.text} ﴾ أتممتَ الدورة!
            </div>
          )}

          <div data-testid="tasbeeh-current-dhikr" className={`font-arabic text-xl ${selected.textColor}`}>{selected.text}</div>
          <div data-testid="tasbeeh-goal-line" className="text-sm text-muted-foreground">
            الهدف: {toArabicNum(target)} — المتبقي: {toArabicNum(target - remaining)}
          </div>

          {/* Tap button */}
          <button
            data-testid="tasbeeh-tap"
            onClick={handleTap}
            className={`w-44 h-44 rounded-full ${selected.bgColor} text-white text-2xl font-arabic shadow-2xl active:scale-95 transition-transform duration-100 select-none flex flex-col items-center justify-center gap-2`}
            aria-label="اضغط للتسبيح"
          >
            <span className="text-3xl">📿</span>
            <span className="text-sm opacity-90">اضغط</span>
          </button>

          <p className="text-xs text-muted-foreground">يمكنك الضغط على مفتاح المسافة أيضاً</p>
        </div>

        {/* [1.0.117] هدف الذكر المحدد */}
        {!prayerMode && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="text-xs text-muted-foreground">هدف هذا الذكر</div>
            <div className="flex flex-wrap gap-2">
              {TARGET_CHOICES.map((t) => (
                <button
                  key={t}
                  data-testid={`tasbeeh-target-${t}`}
                  onClick={() => setTargetForSelected(t)}
                  className={`px-4 py-1.5 rounded-full text-sm font-arabic border-2 transition-colors ${
                    target === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {toArabicNum(t)}
                </button>
              ))}
              <input
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="هدف آخر…"
                value={customTargetInput}
                onChange={(e) => setCustomTargetInput(e.target.value)}
                onBlur={() => {
                  const v = parseInt(customTargetInput, 10);
                  if (!Number.isNaN(v) && v > 0) setTargetForSelected(v);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="w-24 px-3 py-1.5 rounded-full text-sm text-center bg-muted border border-border outline-none"
                aria-label="هدف مخصص"
              />
            </div>
          </div>
        )}

        {/* Dhikr selector */}
        {!prayerMode && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">اختر الذكر</div>
            <div className="grid grid-cols-2 gap-2">
              {allOptions.map((opt) => {
                const optCount = counts[opt.id] ?? 0;
                const optTarget = targets[opt.id] ?? opt.defaultTarget;
                const done = optCount > 0 && optTarget > 0 && optCount % optTarget === 0;
                const progress = optTarget > 0 ? Math.min((optCount % optTarget) / optTarget, 1) : 0;
                return (
                  <div
                    key={opt.id}
                    className={`relative p-3 rounded-2xl border-2 text-right transition-all ${
                      selectedId === opt.id
                        ? `border-current ${opt.textColor} bg-muted/50`
                        : "border-border text-muted-foreground hover:border-muted-foreground/40"
                    }`}
                  >
                    <button onClick={() => setSelectedId(opt.id)} className="w-full text-right">
                      <div className={`font-arabic text-base leading-snug ${selectedId === opt.id ? opt.textColor : ""}`}>
                        {opt.text}
                      </div>
                      <div className="text-xs mt-1 opacity-60">
                        {optCount > 0 ? toArabicNum(optCount) : `الهدف: ${toArabicNum(optTarget)}`}
                      </div>
                      <div className="h-1.5 mt-2 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${opt.bgColor}`} style={{ width: `${Math.round(progress * 100)}%` }} />
                      </div>
                    </button>
                    {done && <span className="absolute top-2 left-2 text-base">✓</span>}
                    {opt.custom && (
                      <button
                        data-testid="tasbeeh-custom-delete"
                        onClick={() => deleteCustomDhikr(opt.id)}
                        className="absolute bottom-2 left-2 p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        title="حذف هذا الذكر"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* [1.0.117] إضافة ذكر مخصص */}
            {showCustomForm ? (
              <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <input
                  type="text"
                  data-testid="tasbeeh-custom-text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="اكتب الذكر… مثال: سُبْحَانَ اللَّهِ وَبِحَمْدِهِ"
                  className="w-full px-3 py-2 rounded-xl bg-muted border border-border outline-none font-arabic text-base"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">الهدف:</span>
                  {TARGET_CHOICES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setCustomTarget(t)}
                      className={`px-3 py-1 rounded-full text-sm font-arabic border-2 ${
                        customTarget === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                      }`}
                    >
                      {toArabicNum(t)}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button data-testid="tasbeeh-custom-submit" onClick={addCustomDhikr} disabled={!customText.trim()} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm disabled:opacity-40">
                    إضافة الذكر
                  </button>
                  <button onClick={() => setShowCustomForm(false)} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground">
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (
              <button
                data-testid="tasbeeh-custom-add"
                onClick={() => setShowCustomForm(true)}
                className="w-full py-2.5 text-sm border border-dashed border-border rounded-xl text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> أضف ذكراً خاصاً بك
              </button>
            )}
          </div>
        )}

        {/* [1.0.117] الهدف اليومي والسلسلة */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">هدف اليوم</span>
            <span data-testid="tasbeeh-today" className="text-xs text-muted-foreground">
              {toArabicNum(todayCount)} / {toArabicNum(goal)}
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${Math.round(goalProgress * 100)}%` }}
            />
          </div>
          {todayCount >= goal && (
            <div className="text-sm font-arabic text-emerald-600 dark:text-emerald-400 text-center">🎉 أتممتَ هدف اليوم!</div>
          )}
          <div className="flex flex-wrap gap-2">
            {GOAL_CHOICES.map((g) => (
              <button
                key={g}
                data-testid={`tasbeeh-goal-${g}`}
                onClick={() => setGoal(g)}
                className={`px-3 py-1 rounded-full text-sm font-arabic border-2 ${
                  goal === g ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                {toArabicNum(g)}
              </button>
            ))}
            <span data-testid="tasbeeh-streak" className="ml-auto text-xs text-muted-foreground self-center">
              🔥 السلسلة: {toArabicNum(streak)} {streak === 1 ? "يوم" : "أيام"}
            </span>
          </div>
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

        {/* [1.0.117] سجل آخر ٧ أيام */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">آخر ٧ أيام</span>
            <span className="text-xs text-muted-foreground">
              أفضل يوم: {toArabicNum(bestDay)} • الإجمالي: {toArabicNum(totalTaps)}
            </span>
          </div>
          <div className="flex items-end gap-2 h-28">
            {last7.map((d) => (
              <div key={d.key} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <span className="text-[11px] font-semibold text-primary">{d.value > 0 ? toArabicNum(d.value) : ""}</span>
                <div
                  className={`w-full rounded-t-md ${d.key === todayKey ? "bg-emerald-500" : "bg-primary/40"}`}
                  style={{ height: `${Math.max(d.value > 0 ? 6 : 2, Math.round((d.value / maxDay) * 72))}px` }}
                />
                <span className="text-[10px] text-muted-foreground">{d.label}</span>
              </div>
            ))}
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
            {allOptions.filter((d) => (counts[d.id] ?? 0) > 0).map((d) => (
              <div key={d.id} className="flex items-center justify-between">
                <span className={`font-arabic text-sm ${d.textColor}`}>{d.text}</span>
                <span className="text-sm font-semibold">{toArabicNum(counts[d.id] ?? 0)}</span>
              </div>
            ))}
          </div>
        )}

        {/* [1.0.117] إعدادات التسبيح */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="text-sm font-semibold">إعدادات التسبيح</div>
          <button
            data-testid="tasbeeh-setting-sound"
            onClick={() => setSettings((s) => ({ ...s, sound: !s.sound }))}
            className="w-full flex items-center justify-between py-1"
          >
            <span className="flex items-center gap-2 text-sm">
              {settings.sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              صوت عند إتمام الدورة
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${settings.sound ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
              {settings.sound ? "مفعّل" : "متوقف"}
            </span>
          </button>
          <button
            onClick={() => setSettings((s) => ({ ...s, vibrate: !s.vibrate }))}
            className="w-full flex items-center justify-between py-1"
          >
            <span className="flex items-center gap-2 text-sm">
              {settings.vibrate ? <Vibrate className="w-4 h-4" /> : <VibrateOff className="w-4 h-4" />}
              اهتزاز عند الضغط
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${settings.vibrate ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
              {settings.vibrate ? "مفعّل" : "متوقف"}
            </span>
          </button>
          <button
            onClick={() => setSettings((s) => ({ ...s, autoAdvance: !s.autoAdvance }))}
            className="w-full flex items-center justify-between py-1"
          >
            <span className="flex items-center gap-2 text-sm">
              <SkipForward className="w-4 h-4" />
              انتقال تلقائي للذكر التالي بعد إتمام الدورة
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${settings.autoAdvance ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
              {settings.autoAdvance ? "مفعّل" : "متوقف"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
