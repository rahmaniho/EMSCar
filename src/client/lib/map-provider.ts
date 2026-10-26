import type { GeoPoint } from '../../shared/geo-utils.ts';

export interface MapPresetLocation {
  id: string;
  labelFa: string;
  addressFa: string;
  point: GeoPoint;
  isExpectedActive: boolean;
}

export const QAZVIN_MAP_VIEWPORT = {
  minLat: 35.5,
  maxLat: 36.65,
  minLng: 49.15,
  maxLng: 51.55,
} as const;

export const LOCATION_PRESETS: MapPresetLocation[] = [
  {
    id: 'qzv-poonak',
    labelFa: 'قزوین — پونک (فعال)',
    addressFa: 'قزوین، بلوار نخبگان، میدان صادقیه، پونک',
    point: { lat: 36.2985, lng: 50.0145 },
    isExpectedActive: true,
  },
  {
    id: 'qzv-sabzeh',
    labelFa: 'قزوین — مرکز شهر (فعال)',
    addressFa: 'قزوین، خیابان خیام جنوبی، نزدیک سبزه‌میدان',
    point: { lat: 36.2688, lng: 50.0041 },
    isExpectedActive: true,
  },
  {
    id: 'qzv-alvand',
    labelFa: 'الوند و شهر صنعتی البرز (فعال)',
    addressFa: 'الوند، بلوار سهروردی، ورودی شهر صنعتی البرز',
    point: { lat: 36.1892, lng: 50.0642 },
    isExpectedActive: true,
  },
  {
    id: 'qzv-takestan',
    labelFa: 'تاکستان (فعال)',
    addressFa: 'تاکستان، بلوار امام خمینی، میدان ۱۵ خرداد',
    point: { lat: 36.0696, lng: 49.6959 },
    isExpectedActive: true,
  },
  {
    id: 'qzv-hwy-karaj',
    labelFa: 'آزادراه قزوین - کرج (فعال)',
    addressFa: 'آزادراه قزوین - کرج، کیلومتر ۲۵، محدوده آبیک',
    point: { lat: 36.115, lng: 50.36 },
    isExpectedActive: true,
  },
  {
    id: 'karaj-inactive-test',
    labelFa: 'کرج — البرز (آزمون محدوده غیرفعال)',
    addressFa: 'کرج، میدان آزادگان (استان در انتظار تأیید)',
    point: { lat: 35.84, lng: 50.9391 },
    isExpectedActive: false,
  },
  {
    id: 'tehran-inactive-test',
    labelFa: 'تهران (آزمون استان غیرفعال)',
    addressFa: 'تهران، میدان آزادی (استان در حال آماده‌سازی)',
    point: { lat: 35.6892, lng: 51.389 },
    isExpectedActive: false,
  },
];

/**
 * تبدیل مختصات جغرافیایی (WGS84) به مختصات نرمال بوم برداری (۰ تا ۱۰۰ درصد)
 * مستقل از کتابخانه‌های نقشه خارجی تا در صورت قطع اینترنت بین‌المللی یا عدم بارگذاری کاشی‌ها نیز ۱۰۰٪ عملیاتی باشد.
 */
export function projectPointToPercent(point: GeoPoint): { x: number; y: number } {
  const { minLat, maxLat, minLng, maxLng } = QAZVIN_MAP_VIEWPORT;
  const clampedLng = Math.min(maxLng, Math.max(minLng, point.lng));
  const clampedLat = Math.min(maxLat, Math.max(minLat, point.lat));

  const x = ((clampedLng - minLng) / (maxLng - minLng)) * 100;
  const y = ((maxLat - clampedLat) / (maxLat - minLat)) * 100;
  return { x, y };
}

export function unprojectPercentToPoint(xPercent: number, yPercent: number): GeoPoint {
  const { minLat, maxLat, minLng, maxLng } = QAZVIN_MAP_VIEWPORT;
  const lng = minLng + (Math.min(100, Math.max(0, xPercent)) / 100) * (maxLng - minLng);
  const lat = maxLat - (Math.min(100, Math.max(0, yPercent)) / 100) * (maxLat - minLat);
  return {
    lat: Math.round(lat * 10000) / 10000,
    lng: Math.round(lng * 10000) / 10000,
  };
}
