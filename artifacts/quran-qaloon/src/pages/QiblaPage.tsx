// Qibla direction (اتجاه القبلة): a live compass dial from the
// active location (stored GPS coordinates or the manual city).
// Bearing and distance are pure math (great-circle to the Kaaba) —
// fully offline. The compass comes from the device orientation
// sensor; when it is unavailable the page still shows the bearing
// and distance, so it is never empty.

import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { ArrowRight, Compass, MapPin, RefreshCw } from "lucide-react";
import { getQibla } from "@/data/qibla";
import {
  getActiveLocation,
  setStoredCoords,
  detectPrayerLocation,
} from "@/data/prayer-times";

interface QiblaPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export default function QiblaPage({ darkMode, toggleDarkMode }: QiblaPageProps) {
  const [loc, setLoc] = useState(() => getActiveLocation());
  const [heading, setHeading] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const qibla = useMemo(() => getQibla(loc.lat, loc.lng), [loc.lat, loc.lng]);

  useEffect(() => {
    const onOri = (e: DeviceOrientationEvent) => {
      const h = (e as DeviceOrientationEvent & { webkitCompassHeading?: number })
        .webkitCompassHeading;
      if (h != null) {
        setHeading(h);
      } else if (e.alpha != null) {
        setHeading(e.alpha);
      }
    };
    window.addEventListener("deviceorientationabsolute", onOri);
    window.addEventListener("deviceorientation", onOri);
    return () => {
      window.removeEventListener("deviceorientationabsolute", onOri);
      window.removeEventListener("deviceorientation", onOri);
    };
  }, []);

  const refreshLocation = async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const pos = await detectPrayerLocation();
      setStoredCoords(pos.lat, pos.lng);
      setLoc(getActiveLocation());
    } catch {
      setLocationError("تعذّر تحديد موقعك — تُعرض القبلة من مدينتك المحفوظة");
    } finally {
      setLocating(false);
    }
  };

  // How far to turn (clockwise) from the current heading to face qibla.
  const turn =
    heading == null ? null : (qibla.bearing - heading + 360) % 360;
  const facingQibla = turn != null && (turn < 8 || turn > 352);
  const turnText =
    turn == null
      ? null
      : facingQibla
        ? "أنت متجه نحو القبلة ✓"
        : turn < 180
          ? `أدر يمينًا ${Math.round(turn)}°`
          : `أدر يسارًا ${Math.round(360 - turn)}°`;

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
            <Compass className="w-5 h-5 text-primary" />
            <span className="font-arabic text-lg text-primary">اتجاه القبلة</span>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-muted transition-colors">
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-1.5 text-base font-arabic text-foreground">
            <MapPin className="w-4 h-4 text-primary" />
            من موقعك: قرب {loc.label}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            القبلة على بُعد {qibla.bearing.toFixed(1)}° من الشمال — {qibla.distanceKm.toLocaleString("ar-EG")} كم من مكة المكرمة
          </div>
          <button
            onClick={refreshLocation}
            disabled={locating}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            تحديث موقعي
          </button>
          {locationError && (
            <div className="text-xs text-amber-600 dark:text-amber-400 mt-2">{locationError}</div>
          )}
        </div>

        {/* Compass dial: north-up (rotates with the heading), the Kaaba
            marker sits at the bearing on the rim, and the fixed arrow
            at the top is the direction the phone faces. */}
        <div className="relative mx-auto w-72 h-72 rounded-full border-2 border-primary/30 bg-card shadow-sm mb-6">
          <div
            className="absolute inset-0 transition-transform duration-200 ease-linear"
            style={{ transform: `rotate(${heading == null ? 0 : -heading}deg)` }}
          >
            <span className="absolute top-2 left-1/2 -translate-x-1/2 text-sm font-bold text-foreground">N</span>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">E</span>
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-sm font-bold text-muted-foreground">S</span>
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">W</span>
            <div
              className="absolute left-1/2 top-1/2 w-0 h-0"
              style={{ transform: `rotate(${qibla.bearing}deg)` }}
            >
              <div
                className="absolute -translate-x-1/2 -translate-y-[8.5rem] text-3xl"
                style={{
                  transform: `translate(-50%, -8.5rem) rotate(${-(qibla.bearing - (heading ?? 0))}deg)`,
                }}
              >
                🕋
              </div>
            </div>
          </div>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-primary text-xl">▲</div>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-3xl font-bold text-foreground">{qibla.bearing.toFixed(1)}°</div>
            <div className="text-xs text-muted-foreground">من الشمال</div>
            <div className="text-xs text-muted-foreground mt-1">{qibla.distanceKm.toLocaleString("ar-EG")} كم إلى مكة</div>
          </div>
        </div>

        <div className="text-center">
          {heading == null ? (
            <div>
              <div className="font-arabic text-base text-foreground">بانتظار البوصلة…</div>
              <div className="text-xs text-muted-foreground mt-1">
                حرّك هاتفك في شكل 8 لمعايرة البوصلة — والقبلة من موقعك {qibla.bearing.toFixed(1)}° من الشمال
              </div>
            </div>
          ) : (
            <div
              className={`font-arabic text-lg ${facingQibla ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}
            >
              {turnText}
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-3">
            N = الشمال · E = الشرق · S = الجنوب · W = الغرب — أدر هاتفك حتى يصل مؤشر الكعبة 🕋 إلى السهم ▲
          </div>
        </div>
      </div>
    </div>
  );
}
