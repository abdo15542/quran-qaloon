import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, BookOpen, Moon, Sun, ChevronLeft, Bell, BellOff } from "lucide-react";
import { ATHKAR_CATEGORIES } from "@/data/athkar";
import { useAthkarReminders } from "@/hooks/useAthkarReminders";

interface AthkarProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const colorMap: Record<string, string> = {
  amber: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
  indigo: "bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800",
  emerald: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800",
  teal: "bg-teal-50 border-teal-200 dark:bg-teal-950/30 dark:border-teal-800",
  violet: "bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800",
  orange: "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800",
  rose: "bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800",
  sky: "bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:border-sky-800",
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

const badgeColorMap: Record<string, string> = {
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
};

export default function Athkar({ darkMode, toggleDarkMode }: AthkarProps) {
  const {
    morningEnabled,
    morningTime,
    eveningEnabled,
    eveningTime,
    status,
    setMorning,
    setEvening,
  } = useAthkarReminders();
  const [reminderBusy, setReminderBusy] = useState(false);

  const handleMorningToggle = async () => {
    if (reminderBusy) return;
    setReminderBusy(true);
    try {
      await setMorning(!morningEnabled, morningTime);
    } finally {
      setReminderBusy(false);
    }
  };

  const handleEveningToggle = async () => {
    if (reminderBusy) return;
    setReminderBusy(true);
    try {
      await setEvening(!eveningEnabled, eveningTime);
    } finally {
      setReminderBusy(false);
    }
  };

  const handleMorningTime = async (time: string) => {
    if (reminderBusy) return;
    setReminderBusy(true);
    try {
      await setMorning(morningEnabled, time);
    } finally {
      setReminderBusy(false);
    }
  };

  const handleEveningTime = async (time: string) => {
    if (reminderBusy) return;
    setReminderBusy(true);
    try {
      await setEvening(eveningEnabled, time);
    } finally {
      setReminderBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <button className="p-2 rounded-full hover:bg-muted transition-colors">
              <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="font-arabic text-lg text-primary">الأذكار والأدعية</span>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="bismillah-text text-3xl text-primary mb-2">الأذكار والأدعية</div>
          <p className="text-muted-foreground text-sm">
            حصن المسلم — أذكار الصباح والمساء والصلاة والنوم والأدعية اليومية
          </p>
        </div>

        {/* تذكيرا أذكار الصباح والمساء */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-5 h-5 text-primary" />
            <span className="font-arabic text-base text-foreground">تذكير أذكار الصباح والمساء</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">☀️ أذكار الصباح</span>
              <div className="flex items-center gap-2">
                {morningEnabled && (
                  <input
                    type="time"
                    value={morningTime}
                    onChange={(e) => handleMorningTime(e.target.value)}
                    disabled={reminderBusy}
                    className="bg-background border border-border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    dir="ltr"
                  />
                )}
                <button
                  onClick={handleMorningToggle}
                  disabled={reminderBusy}
                  className={`relative w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${
                    morningEnabled ? "bg-primary" : "bg-muted"
                  }`}
                  aria-label="تفعيل تذكير أذكار الصباح أو إيقافه"
                >
                  <span
                    className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${
                      morningEnabled ? "right-0.5" : "right-[calc(100%-1.625rem)]"
                    }`}
                  />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">🌙 أذكار المساء</span>
              <div className="flex items-center gap-2">
                {eveningEnabled && (
                  <input
                    type="time"
                    value={eveningTime}
                    onChange={(e) => handleEveningTime(e.target.value)}
                    disabled={reminderBusy}
                    className="bg-background border border-border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    dir="ltr"
                  />
                )}
                <button
                  onClick={handleEveningToggle}
                  disabled={reminderBusy}
                  className={`relative w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${
                    eveningEnabled ? "bg-primary" : "bg-muted"
                  }`}
                  aria-label="تفعيل تذكير أذكار المساء أو إيقافه"
                >
                  <span
                    className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${
                      eveningEnabled ? "right-0.5" : "right-[calc(100%-1.625rem)]"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
          {status && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-3">{status}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ATHKAR_CATEGORIES.map((cat) => (
            <Link key={cat.id} href={`/athkar/${cat.id}`}>
              <div className={`border rounded-2xl p-4 cursor-pointer hover:shadow-md transition-all surah-card ${colorMap[cat.color]}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{cat.icon}</span>
                    <div>
                      <div className={`font-arabic text-lg mb-0.5 ${textColorMap[cat.color]}`}>{cat.name}</div>
                      <div className="text-xs text-muted-foreground">{cat.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColorMap[cat.color]}`}>
                      {cat.items.length} ذكر
                    </span>
                    <ChevronLeft className={`w-4 h-4 flex-shrink-0 ${textColorMap[cat.color]}`} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
