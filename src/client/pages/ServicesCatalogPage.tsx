import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wrench, ShieldAlert, Search } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { useAuth } from '../lib/auth-context.tsx';
import { formatToman } from '../lib/format.ts';
import {
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  EQUIPMENT_TYPE_LABELS,
  type EquipmentType,
} from '../../shared/constants.ts';

interface CatalogItem {
  id: number;
  slug: string;
  titleFa: string;
  category: string;
  categoryLabel: string;
  descriptionFa: string;
  termsFa: string;
  basePriceToman: number;
  includedFreeKm: number;
  perKmDispatchToman: number;
  perKmTowToman: number;
  requiresDestination: boolean;
  requiresOwnershipProof: boolean;
  requiredEquipment: EquipmentType[];
  requiresEvCertification: boolean;
  enrouteCancelFeeToman: number;
  estimatedDurationMin: number;
}

export function ServicesCatalogPage() {
  const { systemInfo } = useAuth();
  const demoMode = Boolean(systemInfo && !systemInfo.isProduction);
  const publicOperationsEnabled = Boolean(
    systemInfo?.isProduction && systemInfo.publicOperationsEnabled
  );
  const canSubmitRequest = demoMode || publicOperationsEnabled;
  const [services, setServices] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch<{ services: CatalogItem[] }>(
          '/api/catalog/services'
        );
        setServices(res.services);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = services.filter((s) => {
    const matchCat =
      selectedCategory === 'all' || s.category === selectedCategory;
    const matchSearch =
      !searchQuery.trim() ||
      s.titleFa.includes(searchQuery.trim()) ||
      s.descriptionFa.includes(searchQuery.trim());
    return matchCat && matchSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-extrabold">
            کاتالوگ خدمات و چارچوب نرخ‌گذاری اولیه «اورژانس خودرو»
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            همه ارقام تومان و فرضیه نرخ پایه در کاتالوگ آزمایشی‌اند؛ نرخ مصوب صنفی یا پیشنهاد تجاری قطعی نیستند و پیش از بهره‌برداری باید بررسی و تأیید شوند.
          </p>
        </div>
        {canSubmitRequest ? (
          <Link
            to="/request/new"
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-5 py-3 rounded-xl text-sm flex items-center gap-2"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>{demoMode ? 'دموی ثبت درخواست' : 'ثبت درخواست امداد'}</span>
          </Link>
        ) : (
          <span className="bg-slate-700 text-slate-300 font-bold px-5 py-3 rounded-xl text-xs">
            ثبت درخواست عمومی غیرفعال است
          </span>
        )}
      </div>

      {/* فیلتر دسته و جستجو */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            همه خدمات ({services.length.toLocaleString('fa-IR')})
          </button>
          {SERVICE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {SERVICE_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی نام خدمت..."
            className="w-full rounded-xl border border-slate-300 pr-9 pl-3 py-1.5 text-xs"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-sm text-slate-500 border border-slate-200">
          در حال بارگذاری کاتالوگ خدمات...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-sm text-slate-500 border border-slate-200">
          خدمتی با فیلتر انتخابی یافت نشد.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between space-y-4 shadow-xs"
            >
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
                    {s.categoryLabel}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {s.requiresDestination && (
                      <span className="text-[11px] font-bold bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-200">
                        نیازمند تعیین مقصد حمل
                      </span>
                    )}
                    {s.requiresOwnershipProof && (
                      <span className="text-[11px] font-bold bg-rose-50 text-rose-800 px-2 py-0.5 rounded-full border border-rose-200">
                        الزام احراز مدارک مالکیت
                      </span>
                    )}
                    {s.requiresEvCertification && (
                      <span className="text-[11px] font-bold bg-sky-50 text-sky-800 px-2 py-0.5 rounded-full border border-sky-200">
                        نیازمند گواهینامه ولتاژ بالا (EV)
                      </span>
                    )}
                  </div>
                </div>

                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-500" />
                  {s.titleFa}
                </h2>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {s.descriptionFa}
                </p>

                <div className="bg-slate-50 rounded-xl p-3 text-[11px] text-slate-600 space-y-1 border border-slate-100">
                  <div>
                    <strong>شرایط ارائه و لغو: </strong>
                    {s.termsFa}
                  </div>
                  <div>
                    <strong>تجهیزات مجاز ناوگان: </strong>
                    {s.requiredEquipment
                      .map((eq) => EQUIPMENT_TYPE_LABELS[eq] ?? eq)
                      .join('، ')}
                  </div>
                  <div>
                    <strong>هزینه لغو پس از اعزام و حرکت امدادگر: </strong>
                    {formatToman(s.enrouteCancelFeeToman)} (پیش از حرکت: رایگان)
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs text-slate-500">
                    فرضیه نرخ پایه (شامل {s.includedFreeKm.toLocaleString('fa-IR')} کیلومتر اعزام در مدل):
                  </div>
                  <div className="text-lg font-black text-slate-900">
                    {formatToman(s.basePriceToman)}
                  </div>
                  {s.perKmTowToman > 0 && (
                    <div className="text-[11px] text-indigo-700 font-semibold">
                      + هر کیلومتر حمل تا مقصد: {formatToman(s.perKmTowToman)}
                    </div>
                  )}
                </div>

                {canSubmitRequest ? (
                  <Link
                    to={`/request/new?serviceId=${s.id}`}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition"
                  >
                    {demoMode ? 'انتخاب در دموی درخواست' : 'انتخاب خدمت'}
                  </Link>
                ) : (
                  <span className="bg-slate-100 text-slate-500 text-[11px] font-bold px-4 py-2.5 rounded-xl">
                    ثبت سفارش غیرفعال
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
