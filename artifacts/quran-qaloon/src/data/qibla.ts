// Qibla direction (اتجاه القبلة): great-circle bearing and distance
// from any point on Earth to the Kaaba in Makkah. Pure math, fully
// offline — no internet needed once the location is known.

export const KAABA = { lat: 21.4225, lng: 39.8262 };

export interface QiblaInfo {
  /** Initial great-circle bearing from north, 0–360 degrees. */
  bearing: number;
  /** Great-circle distance in kilometres. */
  distanceKm: number;
}

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function getQibla(lat: number, lng: number): QiblaInfo {
  const p1 = toRad(lat);
  const p2 = toRad(KAABA.lat);
  const dl = toRad(KAABA.lng - lng);
  const y = Math.sin(dl) * Math.cos(p2);
  const x =
    Math.cos(p1) * Math.sin(p2) -
    Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
  const a =
    Math.sin((p2 - p1) / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const distanceKm = 2 * 6371 * Math.asin(Math.sqrt(a));
  return { bearing: Math.round(bearing * 10) / 10, distanceKm: Math.round(distanceKm) };
}
