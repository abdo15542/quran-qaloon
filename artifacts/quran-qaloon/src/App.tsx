import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OfflineProvider } from "@/context/OfflineContext";
import Home from "@/pages/Home";
import SurahPlayer from "@/pages/SurahPlayer";
import Athkar from "@/pages/Athkar";
import AthkarDetail from "@/pages/AthkarDetail";
import SearchPage from "@/pages/SearchPage";
import DownloadsPage from "@/pages/DownloadsPage";
import TasbeehPage from "@/pages/TasbeehPage";
import RecitersList from "@/pages/RecitersList";
import FavouritesPage from "@/pages/FavouritesPage";
import JuzPage from "@/pages/JuzPage";
import MushafPage from "@/pages/MushafPage";
import WirdPage from "@/pages/WirdPage";
import PrayerTimesPage from "@/pages/PrayerTimesPage";
import StatsPage from "@/pages/StatsPage";
import NotFound from "@/pages/not-found";
import BottomNav from "@/components/BottomNav";

const queryClient = new QueryClient();

function AppRoutes() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((d) => !d);

  return (
    <>
      <div className="pb-16">
        <Switch>
          <Route path="/" component={() => <Home darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/surah/:number">
            {(params) => {
              const num = parseInt(params.number, 10);
              if (isNaN(num) || num < 1 || num > 114) return <NotFound />;
              return <SurahPlayer surahNumber={num} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;
            }}
          </Route>
          <Route path="/athkar" component={() => <Athkar darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/athkar/:id">
            {(params) => <AthkarDetail categoryId={params.id} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />}
          </Route>
          <Route path="/search" component={() => <SearchPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/downloads" component={() => <DownloadsPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/tasbeeh" component={() => <TasbeehPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/reciters" component={() => <RecitersList darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/favourites" component={() => <FavouritesPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/juz" component={() => <JuzPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/mushaf" component={() => <MushafPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/mushaf/:page" component={() => <MushafPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/wird" component={() => <WirdPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/prayer-times" component={() => <PrayerTimesPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/stats" component={() => <StatsPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route component={NotFound} />
        </Switch>
      </div>
      <BottomNav />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <OfflineProvider>
        {/* NOTE: do NOT pass base={BASE_URL} here. Vite's base is './' for
            relative asset URLs, but wouter turns base '.' into a "~" prefix
            on every location ("~/" instead of "/"), so NO route ever matched
            and the page rendered blank (only the bottom nav showed).
            The app is served at the root of https://localhost/, so the
            default empty base is correct. */}
        <WouterRouter>
          <AppRoutes />
        </WouterRouter>
      </OfflineProvider>
    </QueryClientProvider>
  );
}
