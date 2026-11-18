// أسماء الله الحسنى (the 99 Names): browsable offline list with a
// search box. Tap a card to copy «الاسم — المعنى».

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { ASMA_AL_HUSNA } from "@/data/asma-al-husna";

interface AsmaAlHusnaPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

function stripDiacritics(s: string): string {
  return s.replace(/[ً-ٰٓـ]/g, "").replace(/\s+/g, "");
}

export default function AsmaAlHusnaPage({ darkMode, toggleDarkMode }: AsmaAlHusnaPageProps) {
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = stripDiacritics(search.trim());
    if (!q) return ASMA_AL_HUSNA;
    return ASMA_AL_HUSNA.filter(
      (n) =>
        stripDiacritics(n.name).includes(q) ||
        stripDiacritics(n.meaning).includes(q)
    );
  }, [search]);

  const copyName = async (number: number, name: string, meaning: string) => {
    const text = `${name} — ${meaning}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(number);
    window.setTimeout(() => setCopied((c) => (c === number ? null : c)), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/">
              <button className="p-2 rounded-full hover:bg-muted transition-colors" title="رجوع">
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-arabic text-lg text-primary">أسماء الله الحسنى</span>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <div className="text-sm text-muted-foreground">
            {search ? `${filtered.length} نتيجة` : "٩٩ اسمًا — اضغط على أي اسم لنسخه"}
          </div>
        </div>

        <div className="relative max-w-md mx-auto mb-6">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="ابحث عن اسم أو معنى…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-xl pr-10 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="text-4xl mb-3">🔍</div>
            <div>لا توجد نتائج للبحث "{search}"</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map((n) => (
              <button
                key={n.number}
                onClick={() => copyName(n.number, n.name, n.meaning)}
                className="bg-card border border-border rounded-2xl p-4 hover:border-primary/50 hover:shadow-sm transition-all text-center"
              >
                <div className="text-xs text-muted-foreground mb-1">{n.number}</div>
                <div className="font-arabic text-2xl text-primary mb-1">{n.name}</div>
                <div className="text-xs text-muted-foreground leading-relaxed">{n.meaning}</div>
                {copied === n.number && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">تم النسخ ✓</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
