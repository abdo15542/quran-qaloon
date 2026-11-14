import { Link, useLocation } from "wouter";
import { BookOpen, ScrollText, Hash, Search } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", label: "القرآن", icon: BookOpen, exact: true },
  { path: "/athkar", label: "الأذكار", icon: ScrollText },
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border safe-area-inset-bottom">
      <div className="max-w-lg mx-auto flex">
        {NAV_ITEMS.map(({ path, label, icon: Icon, exact }) => {
          const active = isActive(path, exact);
          return (
            <Link key={path} href={path} className="flex-1">
              <button
                className={`relative w-full flex flex-col items-center gap-1 py-2 px-1 transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-b-full" />
                )}
                <Icon className={`w-5 h-5 transition-transform ${active ? "scale-110" : ""}`} />
                <span className="text-xs font-arabic">{label}</span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
