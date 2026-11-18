import { Link, useLocation } from "wouter";
import { BookOpen, ScrollText, Hash, Search, Download } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", label: "القرآن", icon: BookOpen, exact: true },
  { path: "/athkar", label: "الأذكار", icon: ScrollText },
  { path: "/downloads", label: "التحميلات", icon: Download },
  { path: "/tasbeeh", label: "التسبيح", icon: Hash },
  { path: "/search", label: "البحث", icon: Search },
];

export default function BottomNav() {
  const [location] = useLocation();

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location === path || location === path + "/";
    return location.startsWith(path);
  };

  return (
    <nav className="fixed bottom-4 left-4 right-4 z-50">
      <div className="max-w-lg mx-auto flex bg-card/95 backdrop-blur border border-border rounded-full shadow-[0_10px_36px_-8px_hsl(160_30%_12%/0.35)] p-1.5">
        {NAV_ITEMS.map(({ path, label, icon: Icon, exact }) => {
          const active = isActive(path, exact);
          return (
            <Link key={path} href={path} className="flex-1">
              <button
                className={`w-full flex flex-col items-center gap-0.5 py-2 px-1 rounded-full transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? "scale-105" : ""}`} />
                <span className="text-[11px] font-bold leading-none">{label}</span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
