import { Link } from "wouter";
import { ArrowRight, Moon, Sun } from "lucide-react";
import { QIRAAT, RECITERS } from "@/data/surahs";

interface RecitersListProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const qirahColors: Record<string, { bg: string; text: string; badge: string }> = {
  hafs: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400", badge: "bg-blue-100 dark:bg-blue-900/40" },
  qaloon: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", badge: "bg-emerald-100 dark:bg-emerald-900/40" },
  warsh: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", badge: "bg-amber-100 dark:bg-amber-900/40" },
  "ibn-kathir": { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-400", badge: "bg-violet-100 dark:bg-violet-900/40" },
  "abu-amr": { bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-400", badge: "bg-rose-100 dark:bg-rose-900/40" },
  "ibn-amir": { bg: "bg-pink-50 dark:bg-pink-950/30", text: "text-pink-700 dark:text-pink-400", badge: "bg-pink-100 dark:bg-pink-900/40" },
  hamza: { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400", badge: "bg-orange-100 dark:bg-orange-900/40" },
  kisai: { bg: "bg-cyan-50 dark:bg-cyan-950/30", text: "text-cyan-700 dark:text-cyan-400", badge: "bg-cyan-100 dark:bg-cyan-900/40" },
};

export default function RecitersList({ darkMode, toggleDarkMode }: RecitersListProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <button className="p-2 rounded-full hover:bg-muted transition-colors">
              <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1">
            <span className="font-arabic text-lg text-primary">قائمة القُرّاء</span>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="text-center mb-6">
          <div className="bismillah-text text-3xl text-primary mb-2">قائمة القُرّاء والمُقرئين</div>
          <p className="text-muted-foreground text-sm">اختر قارئك المفضل لاستماع القرآن الكريم</p>
        </div>

        {QIRAAT.map((qirah) => {
          const recitersList = RECITERS.filter((r) => r.qirahId === qirah.id);
          const colors = qirahColors[qirah.id] || qirahColors.hafs;

          return (
            <div key={qirah.id} className={`rounded-2xl border border-border overflow-hidden ${colors.bg}`}>
              {/* Header */}
              <div className={`px-5 py-4 border-b border-border/50 ${colors.badge}`}>
                <div className={`font-arabic text-lg font-semibold ${colors.text}`}>{qirah.name}</div>
                <div className="text-sm text-muted-foreground mt-1">{qirah.description}</div>
              </div>

              {/* Reciters grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-5">
                {recitersList.map((reciter) => (
                  <Link key={reciter.id} href={`/surah/1`}>
                    <button
                      className="w-full text-right p-4 rounded-xl bg-background/60 hover:bg-background border border-border/50 transition-all hover:border-current group"
                      onClick={() => {
                        localStorage.setItem("quran_qirah", qirah.id);
                        localStorage.setItem("quran_reciter", reciter.id);
                      }}
                    >
                      <div className={`font-arabic text-base font-semibold ${colors.text} group-hover:scale-105 transition-transform`}>
                        {reciter.name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {qirah.name}
                      </div>
                    </button>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}

        {/* Summary */}
        <div className="bg-card border border-border rounded-2xl p-5 text-center space-y-2">
          <div className="text-xl font-arabic text-primary">
            إجمالي القُرّاء: <span className="font-bold">{RECITERS.length}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            اختر قارئك المفضل من القائمة أعلاه للبدء بالاستماع
          </p>
        </div>
      </div>
    </div>
  );
}
