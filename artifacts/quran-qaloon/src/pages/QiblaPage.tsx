// Qibla direction (اتجاه القبلة): a live compass dial from the
// active location (stored GPS coordinates or the manual city).
// Bearing and distance are pure math (great-circle to the Kaaba) —
// fully offline. The compass comes from the device orientation
// sensor; when it is unavailable the page still shows the bearing
// and distance, so it is never empty.
//
// Heading sources, in priority order (this is what makes the dial
// consistent across phones — they do NOT all report the same north):
//   1. deviceorientationabsolute alpha — TRUE north (Android Chrome).
//   2. webkitCompassHeading — TRUE north (iOS Safari; needs a
//      one-time permission tap on iOS 13+).
//   3. plain deviceorientation alpha — MAGNETIC north, used only when
//      neither of the above ever fires, and corrected by the local
//      magnetic declination (getMagneticDeclination).
// Chrome fires BOTH absolute and plain orientation events; the plain
// one is ignored once absolute has been seen, otherwise the heading
// would flicker between true and magnetic north (they differ by the
// ~3.5 deg declination in Libya). The displayed heading is also
// smoothed (angle-aware exponential moving average) so the dial and
// the turn hint do not jitter degree by degree.
// The dial size is min(74vw, 18rem) on every screen and the Kaaba
// marker offset is derived from that same size, so the marker sits
// on the rim on any phone.

import { useState, useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { Link } from "wouter";
import { ArrowRight, Compass, MapPin, RefreshCw } from "lucide-react";
import { getQibla, getMagneticDeclination } from "@/data/qibla";
import {
  getActiveLocation,
  setStoredCoords,
  detectPrayerLocation,
} from "@/data/prayer-times";

interface QiblaPageProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

type HeadingSource = "true" | "magnetic";
type CompassPermission = "na" | "needed" | "granted" | "denied";

const norm360 = (d: number) => ((d % 360) + 360) % 360;
// Shortest signed delta from `from` to `to`, in (-180, 180].
const angleDelta = (from: number, to: number) => ((to - from + 540) % 360) - 180;

// The direction the user is FACING, from a deviceorientation event.
// Raw alpha alone is only the heading of the TOP edge of the phone
// when it lies flat. Held upright (the normal way to look at the
// screen), alpha is the rotation about the screen-normal axis, so a
// natural roll of the phone (gamma) shifts it degree for degree:
// upright with a 10 deg roll, raw alpha is 10 deg off the true
// facing direction. Derived from the rotation matrix
// R = Rz(-alpha) Rx(beta) Ry(gamma) (Earth: X east, Y north, Z up):
//   top edge  -> atan2(sin a * cos b, cos a * cos b)
//   back of phone (the way the user faces when upright)
//             -> atan2(-cos a * sin g + sin a * sin b * cos g,
//                      sin a * sin g + cos a * sin b * cos g)
// When the phone is flat the back points at the floor, so the top
// direction is used; when upright the back direction is used; in
// between (|beta| 30..60 deg) the two are blended, so there is no
// jump while tilting. Verified: flat (100,0,0) -> 100; upright
// (100,90,0) -> 100; upright rolled (100,90,10) -> 90; tilted
// (100,70,10) -> 89.4. webkitCompassHeading (iOS) already accounts
// for the attitude, so it is used as-is and never passes through here.
const computeFacing = (alpha: number, beta: number | null, gamma: number | null): number => {
  if (beta == null || gamma == null) return norm360(alpha);
  const a = (alpha * Math.PI) / 180;
  const b = (beta * Math.PI) / 180;
  const g = (gamma * Math.PI) / 180;
  const sA = Math.sin(a);
  const cA = Math.cos(a);
  const sB = Math.sin(b);
  const cB = Math.cos(b);
  const sG = Math.sin(g);
  const cG = Math.cos(g);
  const top = norm360((Math.atan2(sA * cB, cA * cB) * 180) / Math.PI);
  const back = norm360(
    (Math.atan2(-cA * sG + sA * sB * cG, sA * sG + cA * sB * cG) * 180) / Math.PI,
  );
  const w = Math.min(1, Math.max(0, (Math.abs(beta) - 30) / 30));
  return norm360(top + w * angleDelta(top, back));
};

export default function QiblaPage({ darkMode, toggleDarkMode }: QiblaPageProps) {
  const [loc, setLoc] = useState(() => getActiveLocation());
  const [heading, setHeading] = useState<number | null>(null);
  const [headingSource, setHeadingSource] = useState<HeadingSource | null>(null);
  const [compassAccuracy, setCompassAccuracy] = useState<number | null>(null);
  const [permission, setPermission] = useState<CompassPermission>(() =>
    typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown })
      .requestPermission === "function"
      ? "needed"
      : "na",
  );
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const smoothedRef = useRef<number | null>(null);
  const absoluteSeenRef = useRef(false);
  const magneticAllowedRef = useRef(false);

  const qibla = useMemo(() => getQibla(loc.lat, loc.lng), [loc.lat, loc.lng]);
  const declination = useMemo(
    () => getMagneticDeclination(loc.lat, loc.lng),
    [loc.lat, loc.lng],
  );

  // Feed one raw heading (true-north referenced) into the smoother.
  const feedHeading = (raw: number, source: HeadingSource) => {
    const prev = smoothedRef.current;
    const next =
      prev == null ? norm360(raw) : norm360(prev + 0.25 * angleDelta(prev, raw));
    smoothedRef.current = next;
    setHeading(next);
    setHeadingSource(source);
  };

  useEffect(() => {
    if (permission === "needed" || permission === "denied") return;
    // Give the absolute event a second to appear before trusting the
    // plain (magnetic) orientation event.
    const timer = window.setTimeout(() => {
      magneticAllowedRef.current = true;
    }, 1000);

    const onAbsolute = (e: DeviceOrientationEvent) => {
      if (e.alpha == null) return;
      absoluteSeenRef.current = true;
      feedHeading(computeFacing(e.alpha, e.beta, e.gamma), "true");
    };
    const onOrientation = (e: DeviceOrientationEvent) => {
      const h = (e as DeviceOrientationEvent & { webkitCompassHeading?: number })
        .webkitCompassHeading;
      const acc = (e as DeviceOrientationEvent & { webkitCompassAccuracy?: number })
        .webkitCompassAccuracy;
      if (acc != null) setCompassAccuracy(acc);
      if (h != null) {
        // iOS Safari: true-north heading.
        feedHeading(h, "true");
        return;
      }
      // Magnetic north: only once absolute has had its chance, and
      // only while absolute has never fired.
      if (e.alpha == null || absoluteSeenRef.current || !magneticAllowedRef.current)
        return;
      feedHeading(
        norm360(computeFacing(e.alpha, e.beta, e.gamma) + declination),
        "magnetic",
      );
    };
    window.addEventListener("deviceorientationabsolute", onAbsolute);
    window.addEventListener("deviceorientation", onOrientation);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("deviceorientationabsolute", onAbsolute);
      window.removeEventListener("deviceorientation", onOrientation);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission, declination]);

  const enableCompass = async () => {
    const doe = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    try {
      const res = await doe.requestPermission?.();
      setPermission(res === "granted" ? "granted" : "denied");
    } catch {
      setPermission("denied");
    }
  };

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
            at the top is the direction the phone faces. The dial size
            is --dial on every screen; the marker offset is derived
            from the same variable, so it stays on the rim anywhere. */}
        <div
          className="relative mx-auto w-[var(--dial)] h-[var(--dial)] rounded-full border-2 border-primary/30 bg-card shadow-sm mb-6"
          style={{ "--dial": "min(74vw, 18rem)" } as CSSProperties}
        >
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
                className="absolute text-3xl"
                style={{
                  transform: `translate(-50%, calc(-1 * var(--dial) / 2 + 8px)) rotate(${-(qibla.bearing - (heading ?? 0))}deg)`,
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
          {permission === "needed" ? (
            <div>
              <button
                onClick={enableCompass}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-arabic hover:opacity-90 transition-opacity"
              >
                <Compass className="w-4 h-4" />
                تفعيل البوصلة
              </button>
              <div className="text-xs text-muted-foreground mt-2">
                جهازك يطلب إذن البوصلة مرة واحدة — اضغط الزر ثم اسمح
              </div>
            </div>
          ) : permission === "denied" ? (
            <div>
              <div className="font-arabic text-base text-foreground">البوصلة غير مفعّلة</div>
              <div className="text-xs text-muted-foreground mt-1">
                فعّل إذن البوصلة من إعدادات المتصفح — والقبلة من موقعك {qibla.bearing.toFixed(1)}° من الشمال
              </div>
            </div>
          ) : heading == null ? (
            <div>
              <div className="font-arabic text-base text-foreground">بانتظار البوصلة…</div>
              <div className="text-xs text-muted-foreground mt-1">
                حرّك هاتفك في شكل 8 لمعايرة البوصلة — والقبلة من موقعك {qibla.bearing.toFixed(1)}° من الشمال
              </div>
            </div>
          ) : (
            <div>
              <div className="text-sm text-muted-foreground">
                اتجاهك الآن: {Math.round(heading)}° من الشمال
              </div>
              <div
                className={`font-arabic text-lg mt-1 ${facingQibla ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}
              >
                {turnText}
              </div>
              {headingSource === "magnetic" && (
                <div className="text-xs text-muted-foreground mt-1">
                  البوصلة مغناطيسية — تم تصحيح الانحراف المغناطيسي ({declination.toFixed(1)}°)
                </div>
              )}
              {compassAccuracy != null && compassAccuracy > 25 && (
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  دقة البوصلة منخفضة — حرّك هاتفك في شكل 8 لمعايرتها
                </div>
              )}
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-3">
            N = الشمال · E = الشرق · S = الجنوب · W = الغرب — أدر هاتفك حتى يصل مؤشر الكعبة 🕋 إلى السهم ▲
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            إذا كان الاتجاه غير صحيح: حرّك هاتفك في شكل 8 عدة مرات لمعايرة البوصلة، وابتعد عن المعادن والمغناطيس
          </div>
        </div>
      </div>
    </div>
  );
}
