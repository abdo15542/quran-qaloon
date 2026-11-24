import { Link } from "wouter";
import { ArrowRight, Moon, Sun } from "lucide-react";
import { RECITERS } from "@/data/surahs";

interface RecitersListProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

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

        {/* قسم واحد: كل القُرّاء في صفحة واحدة */}
        <div className="rounded-2xl border border-border overflow-hidden bg-blue-50 dark:bg-blue-950/30">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border/50 bg-blue-100 dark:bg-blue-900/40">
            <div className="font-arabic text-lg font-semibold text-blue-700 dark:text-blue-400">القُرّاء</div>
            <div className="text-sm text-muted-foreground mt-1">قالون عن نافع</div>
          </div>

          {/* Reciters grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-5">
            {RECITERS.map((reciter) => (
              <Link key={reciter.id} href={`/surah/1`}>
                <button
                  className="w-full text-right p-4 rounded-xl bg-background/60 hover:bg-background border border-border/50 transition-all hover:border-current group"
                  onClick={() => {
                    localStorage.setItem("quran_qirah", reciter.qirahId);
                    localStorage.setItem("quran_reciter", reciter.id);
                  }}
                >
                  <div className="font-arabic text-base font-semibold text-blue-700 dark:text-blue-400 group-hover:scale-105 transition-transform">
                    {reciter.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    قالون عن نافع
                  </div>
                </button>
              </Link>
            ))}
          </div>
        </div>

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
