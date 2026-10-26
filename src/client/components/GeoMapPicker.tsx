import React, { useEffect, useRef, useState } from 'react';
import {
  MapPin,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Flag,
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import {
  LOCATION_PRESETS,
  projectPointToPercent,
  unprojectPercentToPoint,
} from '../lib/map-provider.ts';
import type { GeoPoint } from '../../shared/geo-utils.ts';

interface CoverageCheckResponse {
  isActiveOperational: boolean;
  reasonCode: string;
  messageFa: string;
  coverage?: {
    zoneId: number;
    zoneNameFa: string;
    provinceNameFa: string;
    tariffMultiplier: number;
  };
}

interface GeoMapPickerProps {
  origin: GeoPoint;
  originAddress: string;
  onOriginChange: (point: GeoPoint, suggestedAddress?: string) => void;
  onOriginAddressChange: (address: string) => void;
  requiresDestination: boolean;
  destination: GeoPoint | null;
  destinationAddress: string;
  onDestinationChange: (point: GeoPoint | null, suggestedAddress?: string) => void;
  onDestinationAddressChange: (address: string) => void;
  onCoverageEvaluated?: (info: CoverageCheckResponse) => void;
}

export function GeoMapPicker(props: GeoMapPickerProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [pickMode, setPickMode] = useState<'origin' | 'destination'>('origin');
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<CoverageCheckResponse | null>(null);

  useEffect(() => {
    if (!props.requiresDestination && pickMode === 'destination') {
      setPickMode('origin');
    }
  }, [props.requiresDestination, pickMode]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch<CoverageCheckResponse>(
          `/api/geography/check-point?lat=${props.origin.lat}&lng=${props.origin.lng}`
        );
        if (active) {
          setCoverage(res);
          props.onCoverageEvaluated?.(res);
        }
      } catch {
        if (active) {
          setCoverage({
            isActiveOperational: false,
            reasonCode: 'NETWORK_ERROR',
            messageFa: 'بررسی آنلاین محدوده موقتاً در دسترس نیست؛ ثبت دستی آدرس فعال است.',
          });
        }
      }
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [props.origin.lat, props.origin.lng]);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const pt = unprojectPercentToPoint(xPct, yPct);

    if (pickMode === 'destination' && props.requiresDestination) {
      props.onDestinationChange(pt);
    } else {
      props.onOriginChange(pt);
    }
  };

  const handleUseBrowserGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('مرورگر شما از سرویس GPS پشتیبانی نمی‌کند؛ لطفاً موقعیت را روی نقشه یا دستی وارد کنید.');
      return;
    }
    setGpsStatus('در حال دریافت موقعیت ماهواره‌ای...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt = {
          lat: Math.round(pos.coords.latitude * 10000) / 10000,
          lng: Math.round(pos.coords.longitude * 10000) / 10000,
        };
        props.onOriginChange(pt);
        setGpsStatus('موقعیت فعلی شما با موفقیت دریافت شد.');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus(
            'اجازه دسترسی به GPS داده نشد. می‌توانید نقطه را روی نقشه انتخاب کنید یا آدرس را دستی بنویسید.'
          );
        } else {
          setGpsStatus(
            'سیگنال GPS در دسترس نیست؛ انتخاب روی نقشه و ثبت دستی آدرس فعال است.'
          );
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const originPos = projectPointToPercent(props.origin);
  const destPos = props.destination
    ? projectPointToPercent(props.destination)
    : null;

  return (
    <div className="space-y-4">
      {/* ابزارهای بالای نقشه */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPickMode('origin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition ${
              pickMode === 'origin'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            تعیین محل توقف خودرو (مبدأ)
          </button>

          {props.requiresDestination && (
            <button
              type="button"
              onClick={() => setPickMode('destination')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition ${
                pickMode === 'destination'
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              <Flag className="w-3.5 h-3.5" />
              تعیین مقصد حمل روی نقشه
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleUseBrowserGps}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 transition"
        >
          <Navigation className="w-3.5 h-3.5" />
          دریافت موقعیت فعلی (GPS)
        </button>
      </div>

      {gpsStatus && (
        <div className="text-xs bg-slate-100 text-slate-700 px-3 py-2 rounded-lg border border-slate-200">
          {gpsStatus}
        </div>
      )}

      {/* نقاط سریع استان قزوین + نقاط مرزی جهت آزمون پوشش */}
      <div className="flex flex-wrap gap-1.5">
        {LOCATION_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => {
              if (pickMode === 'destination' && props.requiresDestination) {
                props.onDestinationChange(preset.point, preset.addressFa);
              } else {
                props.onOriginChange(preset.point, preset.addressFa);
              }
            }}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
              preset.isExpectedActive
                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-200'
                : 'bg-slate-100 hover:bg-rose-50 text-slate-600 border-slate-300'
            }`}
          >
            {preset.labelFa}
          </button>
        ))}
      </div>

      {/* بوم نقشه برداری تعاملی مستقل از سرویس خارجی */}
      <div
        ref={mapRef}
        onClick={handleMapClick}
        role="application"
        aria-label="نقشه تعاملی انتخاب موقعیت در استان قزوین"
        className="relative w-full h-72 sm:h-80 rounded-2xl overflow-hidden border-2 border-slate-300 cursor-crosshair select-none bg-[#eef4f0] shadow-inner"
      >
        {/* شبکه مختصات پس‌زمینه و محورهای جاده‌ای واقعی قزوین */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#d5e2d9" strokeWidth="0.3" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grid)" />

          {/* محدوده سبز پوشش فعال استان قزوین */}
          <polygon
            points="0,0 64,0 64,61 52,95 0,95"
            fill="#10b981"
            fillOpacity="0.13"
            stroke="#059669"
            strokeWidth="0.6"
            strokeDasharray="2,1"
          />

          {/* محدوده غیرفعال شرق (البرز و تهران) */}
          <polygon
            points="65,0 100,0 100,100 65,100"
            fill="#f43f5e"
            fillOpacity="0.07"
            stroke="#e11d48"
            strokeWidth="0.4"
            strokeDasharray="1.5,1.5"
          />

          {/* محور آزادراه زنجان - قزوین - کرج - تهران */}
          <polyline
            points="8,36 35,33 38,40 57,49 74,70 93,83"
            fill="none"
            stroke="#64748b"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          {/* محور قزوین - تاکستان - بوئین‌زهرا */}
          <polyline
            points="35,33 23,50 38,76"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="0.9"
          />

          {/* خط مسیر حمل در صورت انتخاب مقصد */}
          {destPos && (
            <line
              x1={originPos.x}
              y1={originPos.y}
              x2={destPos.x}
              y2={destPos.y}
              stroke="#1d4ed8"
              strokeWidth="0.9"
              strokeDasharray="2,1.5"
            />
          )}
        </svg>

        {/* برچسب شهرهای مرجع روی نقشه */}
        {[
          { name: 'قزوین (فعال)', lat: 36.2688, lng: 50.0041, active: true },
          { name: 'الوند', lat: 36.1892, lng: 50.0642, active: true },
          { name: 'تاکستان', lat: 36.0696, lng: 49.6959, active: true },
          { name: 'آبیک', lat: 36.0405, lng: 50.5317, active: true },
          { name: 'بوئین‌زهرا', lat: 35.7667, lng: 50.0578, active: true },
          { name: 'کرج (غیرفعال)', lat: 35.84, lng: 50.9391, active: false },
          { name: 'تهران (غیرفعال)', lat: 35.6892, lng: 51.389, active: false },
        ].map((city) => {
          const p = projectPointToPercent({ lat: city.lat, lng: city.lng });
          return (
            <div
              key={city.name}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs ${
                city.active
                  ? 'bg-white/90 text-emerald-900 border border-emerald-300'
                  : 'bg-rose-50/90 text-rose-700 border border-rose-200'
              }`}
            >
              {city.name}
            </div>
          );
        })}

        {/* نشانگر مبدأ */}
        <div
          style={{ left: `${originPos.x}%`, top: `${originPos.y}%` }}
          className="absolute -translate-x-1/2 -translate-y-full pointer-events-none transition-all duration-150"
        >
          <div className="bg-amber-500 text-slate-950 p-1.5 rounded-full shadow-lg border-2 border-white">
            <MapPin className="w-5 h-5" />
          </div>
        </div>

        {/* نشانگر مقصد حمل */}
        {destPos && (
          <div
            style={{ left: `${destPos.x}%`, top: `${destPos.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-full pointer-events-none transition-all duration-150"
          >
            <div className="bg-blue-600 text-white p-1.5 rounded-full shadow-lg border-2 border-white">
              <Flag className="w-4 h-4" />
            </div>
          </div>
        )}

        <div className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-[11px] px-2.5 py-1 rounded-lg pointer-events-none">
          برای جابه‌جایی نشانگر {pickMode === 'destination' ? 'مقصد' : 'مبدأ'} روی نقشه کلیک کنید
        </div>
      </div>

      {/* وضعیت بررسی پوشش سمت سرور */}
      {coverage && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
            coverage.isActiveOperational
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {coverage.isActiveOperational ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-bold">{coverage.messageFa}</div>
            <div className="text-[11px] opacity-80 mt-0.5">
              مختصات ثبت‌شده: {props.origin.lat.toFixed(4)}, {props.origin.lng.toFixed(4)}
            </div>
          </div>
        </div>
      )}

      {/* ورود دستی نشانی و مختصات (الزامی جهت تاب‌آوری در صورت قطع نقشه/GPS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            نشانی دقیق محل توقف خودرو (امکان ثبت دستی) *
          </label>
          <input
            type="text"
            required
            value={props.originAddress}
            onChange={(e) => props.onOriginAddressChange(e.target.value)}
            placeholder="مثال: قزوین، بلوار نخبگان، ۲۰۰ متر بعد از میدان صادقیه، لاین کندرو"
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            عرض جغرافیایی مبدأ (Latitude)
          </label>
          <input
            type="number"
            step="0.0001"
            value={props.origin.lat}
            onChange={(e) =>
              props.onOriginChange({
                lat: Number(e.target.value),
                lng: props.origin.lng,
              })
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dir-ltr text-left"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            طول جغرافیایی مبدأ (Longitude)
          </label>
          <input
            type="number"
            step="0.0001"
            value={props.origin.lng}
            onChange={(e) =>
              props.onOriginChange({
                lat: props.origin.lat,
                lng: Number(e.target.value),
              })
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dir-ltr text-left"
          />
        </div>

        {props.requiresDestination && (
          <div className="sm:col-span-2 pt-2 border-t border-slate-200">
            <label className="block text-xs font-bold text-blue-800 mb-1">
              نشانی مقصد حمل خودرو (الزامی برای خدمات یدک‌کش و خودروبر) *
            </label>
            <input
              type="text"
              required
              value={props.destinationAddress}
              onChange={(e) => props.onDestinationAddressChange(e.target.value)}
              placeholder="مثال: قزوین، شهر صنعتی البرز، تعمیرگاه مرکزی ایران‌خودرو"
              className="w-full rounded-xl border border-blue-300 bg-blue-50/40 px-3.5 py-2.5 text-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}
