import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
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
import HizbPage from "@/pages/HizbPage";
import MushafPage from "@/pages/MushafPage";
import ReadingMode from "@/pages/ReadingMode";
import WirdPage from "@/pages/WirdPage";
import PrayerTimesPage from "@/pages/PrayerTimesPage";
import StatsPage from "@/pages/StatsPage";
import QiblaPage from "@/pages/QiblaPage";
import AsmaAlHusnaPage from "@/pages/AsmaAlHusnaPage";
import HifzPage from "@/pages/HifzPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import MutashabihatPage from "@/pages/MutashabihatPage";
import TopicMapPage from "@/pages/TopicMapPage";
import HifzTrainerPage from "@/pages/HifzTrainerPage";
import CompareTafsirPage from "@/pages/CompareTafsirPage";
import ProphetStoriesPage from "@/pages/ProphetStoriesPage";
import DeepStatsPage from "@/pages/DeepStatsPage";
import NotFound from "@/pages/not-found";
import BottomNav from "@/components/BottomNav";
import { refreshLocationIfStale, ensurePrayerRemindersScheduled } from "@/data/prayer-times";

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

  // On every route change, return to the top of the page — the app is a
  // SPA and the scroll position otherwise carries over (opening a surah
  // from a scrolled Home opened the player mid-page). Deep links with
  // ?ayah= are skipped: the player scrolls the target ayah into view
  // itself, and a parent scroll-to-top would override it.
  const [location] = useLocation();
  useEffect(() => {
    if (window.location.search.includes("ayah=")) return;
    window.scrollTo(0, 0);
  }, [location]);

  // A long-press on a card link must not show the WebView's link-preview
  // tooltip with the raw internal URL — the cards are navigation, not
  // links to copy. Suppress the context menu on links only; long-press
  // text selection elsewhere still works.
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("a")) e.preventDefault();
    };
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);

  // زر الرجوع في أندرويد (1.0.79): افتراضيًا يخرج كاباسيتور من التطبيق
  // عند كل ضغطة رجوع — حتى داخل الصفحات — لأن لا مستمع backButton
  // مسجّل. نسجّل مستمعًا واحدًا هنا: في الرئيسية يخرج من التطبيق،
  // وفي أي صفحة أخرى يعود للصفحة السابقة في السجل، وإن لم يكن هناك
  // سجل (رابط عميق مباشر) يعود للرئيسية بدل الخروج. على الويب لا يوجد
  // زر رجوع نظامي فلا يُسجَّل شيء.
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: PluginListenerHandle | null = null;
    CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else if (window.location.pathname !== "/") {
        navigate("/");
      } else {
        void CapacitorApp.exitApp();
      }
    }).then((h) => {
      handle = h;
    });
    // Automatic position refresh on resume (1.0.88): the app may have
    // sat in the background while the user travelled to another city —
    // when it comes back to the foreground, refresh the position (auto
    // mode only, 15-minute throttle inside refreshLocationIfStale), so
    // the times follow without any tap. Home's mount effect covers a
    // fresh launch; this covers a warm resume on any page.
    // The adhan alarms are re-registered on resume too (1.0.102): a
    // reboot wipes AlarmManager alarms, and a warm resume is the first
    // moment the app runs again — healing here means the next prayer
    // already has its alarm, with no tap from the user.
    let resumeHandle: PluginListenerHandle | null = null;
    CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        refreshLocationIfStale().catch(() => {});
        ensurePrayerRemindersScheduled().catch(() => {});
      }
    }).then((h) => {
      resumeHandle = h;
    });
    return () => {
      void handle?.remove();
      void resumeHandle?.remove();
    };
  }, [navigate]);

  return (
    <>
      <div className="pb-28">
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
          <Route path="/hizb" component={() => <HizbPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/mushaf" component={() => <MushafPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/mushaf/:page" component={() => <MushafPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/reading">
            <ReadingMode darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
          </Route>
          <Route path="/reading/:page">
            <ReadingMode darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
          </Route>
          <Route path="/wird" component={() => <WirdPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/prayer-times" component={() => <PrayerTimesPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/stats" component={() => <StatsPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/qibla" component={() => <QiblaPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/asma" component={() => <AsmaAlHusnaPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/hifz" component={() => <HifzPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/analytics" component={() => <AnalyticsPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          {/* [1.0.114] المميزات الأعمق الست */}
          <Route path="/mutashabihat" component={() => <MutashabihatPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/topic-map" component={() => <TopicMapPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/hifz-trainer" component={() => <HifzTrainerPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/compare-tafsir" component={() => <CompareTafsirPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/compare-tafsir/:surah/:ayah">
            {(params) => {
              const s = parseInt(params.surah, 10);
              const a = parseInt(params.ayah, 10);
              if (isNaN(s) || s < 1 || s > 114 || isNaN(a) || a < 1) return <NotFound />;
              return <CompareTafsirPage surahNumber={s} ayahNumber={a} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;
            }}
          </Route>
          <Route path="/prophets" component={() => <ProphetStoriesPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
          <Route path="/deep-stats" component={() => <DeepStatsPage darkMode={darkMode} toggleDarkMode={toggleDarkMode} />} />
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
