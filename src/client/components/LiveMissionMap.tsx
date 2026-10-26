import React from 'react';
import { MapPin, Truck, Flag, ExternalLink } from 'lucide-react';
import { projectPointToPercent } from '../lib/map-provider.ts';
import type { GeoPoint } from '../../shared/geo-utils.ts';

interface LiveMissionMapProps {
  origin: GeoPoint & { address: string };
  destination?: (GeoPoint & { address: string | null }) | null;
  responderLocation?: (GeoPoint & { updatedAt: string | null }) | null;
  estimatedEtaMinutes: number | null;
  estimatedDistanceKm: number;
  showNavigationLink?: boolean;
}

export function LiveMissionMap(props: LiveMissionMapProps) {
  const originPct = projectPointToPercent(props.origin);
  const destPct = props.destination
    ? projectPointToPercent(props.destination)
    : null;
  const respPct = props.responderLocation
    ? projectPointToPercent(props.responderLocation)
    : null;

  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${props.origin.lat},${props.origin.lng}`;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 font-bold">
          <MapPin className="w-4 h-4 text-amber-400" />
          <span>نقشه زنده مأموریت و موقعیت مکانی</span>
        </div>
        <div className="flex items-center gap-3">
          {props.estimatedEtaMinutes !== null ? (
            <span className="bg-amber-500 text-slate-950 font-bold px-2.5 py-0.5 rounded-full">
              زمان تقریبی رسیدن: {props.estimatedEtaMinutes.toLocaleString('fa-IR')} دقیقه
            </span>
          ) : (
            <span className="bg-slate-700 text-slate-200 px-2.5 py-0.5 rounded-full">
              در انتظار تخصیص واحد آزاد
            </span>
          )}
          {props.showNavigationLink && (
            <a
              href={navUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded-lg font-semibold"
            >
              <span>مسیریابی ماهواره‌ای</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      <div className="relative h-64 bg-[#eef4f0]">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <pattern id="live-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#d5e2d9" strokeWidth="0.3" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#live-grid)" />

          {respPct && (
            <line
              x1={respPct.x}
              y1={respPct.y}
              x2={originPct.x}
              y2={originPct.y}
              stroke="#0284c7"
              strokeWidth="1.1"
              strokeDasharray="2,1.2"
            />
          )}

          {destPct && (
            <line
              x1={originPct.x}
              y1={originPct.y}
              x2={destPct.x}
              y2={destPct.y}
              stroke="#4f46e5"
              strokeWidth="0.9"
              strokeDasharray="1.5,1.5"
            />
          )}
        </svg>

        {/* موقعیت مشتری */}
        <div
          style={{ left: `${originPct.x}%`, top: `${originPct.y}%` }}
          className="absolute -translate-x-1/2 -translate-y-full"
        >
          <div className="bg-amber-500 text-slate-950 p-1.5 rounded-full shadow-md border-2 border-white">
            <MapPin className="w-5 h-5" />
          </div>
          <span className="block text-[10px] font-bold bg-white/95 px-1.5 py-0.5 rounded shadow mt-0.5 whitespace-nowrap">
            محل خودرو
          </span>
        </div>

        {/* موقعیت زنده امدادگر */}
        {respPct && (
          <div
            style={{ left: `${respPct.x}%`, top: `${respPct.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
          >
            <div className="bg-blue-600 text-white p-1.5 rounded-full shadow-lg border-2 border-white animate-pulse">
              <Truck className="w-4 h-4" />
            </div>
            <span className="block text-[10px] font-bold bg-blue-900 text-white px-1.5 py-0.5 rounded shadow mt-0.5 whitespace-nowrap">
              امدادگر
            </span>
          </div>
        )}

        {/* مقصد حمل */}
        {destPct && (
          <div
            style={{ left: `${destPct.x}%`, top: `${destPct.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-full"
          >
            <div className="bg-indigo-600 text-white p-1.5 rounded-full shadow-md border-2 border-white">
              <Flag className="w-4 h-4" />
            </div>
            <span className="block text-[10px] font-bold bg-white/95 px-1.5 py-0.5 rounded shadow mt-0.5 whitespace-nowrap">
              مقصد حمل
            </span>
          </div>
        )}
      </div>

      <div className="p-3.5 bg-slate-50 border-t border-slate-200 text-xs space-y-1.5">
        <div>
          <span className="font-bold text-slate-700">مبدأ مأموریت: </span>
          <span className="text-slate-600">{props.origin.address}</span>
        </div>
        {props.destination && (
          <div>
            <span className="font-bold text-indigo-800">مقصد حمل: </span>
            <span className="text-slate-600">{props.destination.address}</span>
          </div>
        )}
      </div>
    </div>
  );
}
