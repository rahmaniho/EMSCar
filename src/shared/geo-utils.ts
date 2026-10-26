export interface GeoPoint {
  lat: number;
  lng: number;
}

export const IRAN_GEO_BOUNDS = {
  minLat: 24.5,
  maxLat: 40.0,
  minLng: 44.0,
  maxLng: 63.6,
} as const;

export const QAZVIN_DEFAULT_CENTER: GeoPoint = {
  lat: 36.2688,
  lng: 50.0041,
};

export function isValidCoordinate(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

export function isWithinIranBounds(point: GeoPoint): boolean {
  if (!isValidCoordinate(point)) return false;
  return (
    point.lat >= IRAN_GEO_BOUNDS.minLat &&
    point.lat <= IRAN_GEO_BOUNDS.maxLat &&
    point.lng >= IRAN_GEO_BOUNDS.minLng &&
    point.lng <= IRAN_GEO_BOUNDS.maxLng
  );
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * محاسبه فاصله کمان بزرگ (Haversine) بر حسب کیلومتر
 */
export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371; // شعاع زمین به کیلومتر
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const h =
    sinLat * sinLat +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(R * c * 100) / 100;
}

/**
 * تخمین مسافت واقعی جاده‌ای با ضریب انحراف مسیر شهری/بین‌شهری
 */
export function estimateRoadDistanceKm(
  a: GeoPoint,
  b: GeoPoint,
  tortuosityFactor = 1.26
): number {
  const straight = haversineDistanceKm(a, b);
  return Math.round(straight * tortuosityFactor * 10) / 10;
}

/**
 * تخمین واقع‌بینانه زمان رسیدن امدادگر بر حسب دقیقه
 * شامل زمان آماده‌سازی اولیه + حرکت در شبکه معابر
 */
export function estimateEtaMinutes(
  roadDistanceKm: number,
  options?: { isHighway?: boolean; prepMinutes?: number }
): number {
  const avgSpeedKmh = options?.isHighway ? 62 : 36;
  const prep = options?.prepMinutes ?? 5;
  const travelMinutes = (roadDistanceKm / avgSpeedKmh) * 60;
  return Math.max(6, Math.ceil(prep + travelMinutes));
}

export function isPointInPolygon(point: GeoPoint, polygon: GeoPoint[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isPointWithinRadiusKm(
  point: GeoPoint,
  center: GeoPoint,
  radiusKm: number
): boolean {
  return haversineDistanceKm(point, center) <= radiusKm;
}
