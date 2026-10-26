import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  PhoneCall,
  MapPin,
  CheckCircle2,
  Wrench,
  CreditCard,
  Clock,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { useAuth } from '../lib/auth-context.tsx';
import { formatToman, getStatusBadgeClass } from '../lib/format.ts';

interface ServiceItem {
  id: number;
  slug: string;
  titleFa: string;
  categoryLabel: string;
  descriptionFa: string;
  basePriceToman: number;
  estimatedDurationMin: number;
  requiresEvCertification: boolean;
}

interface ProvinceSummary {
  id: number;
  slug: string;
  nameFa: string;
  status: string;
  statusLabel: string;
}

interface ZoneSummary {
  id: number;
  provinceId: number;
  code: string;
  nameFa: string;
  status: string;
  statusLabel: string;
}

export function HomePage() {
  const { systemInfo } = useAuth();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [provinces, setProvinces] = useState<ProvinceSummary[]>([]);
  const [zones, setZones] = useState<ZoneSummary[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [catRes, geoRes] = await Promise.all([
          apiFetch<{ services: ServiceItem[] }>('/api/catalog/services'),
          apiFetch<{ provinces: ProvinceSummary[]; zones: ZoneSummary[] }>(
            '/api/geography/overview'
          ),
        ]);
        setServices(catRes.services.slice(0, 6));
        setProvinces(geoRes.provinces);
        setZones(geoRes.zones);
      } catch {
        // handled gracefully
      }
    })();
  }, []);

  const qazvin = provinces.find((p) => p.slug === 'qazvin');
  const qazvinActiveZones = zones.filter(
    (z) => qazvin && z.provinceId === qazvin.id && z.status === 'active'
  );

  return (
    <div>
      {/* بخش Hero اضطراری */}
      <section className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white py-12 sm:py-16 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-3.5 py-1.5 rounded-full text-xs font-bold">
              <MapPin className="w-3.5 h-3.5" />
              <span>پوشش عملیاتی فعال: سراسر استان قزوین و محورهای آزادراهی</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight">
              امداد خودروی مطمئن و شفاف با{' '}
              <span className="text-amber-400">اورژانس خودرو</span>
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl">
              در شرایط توقف یا خرابی خودرو تنها نیستید. اعزام نزدیک‌ترین امدادگر دارای
              مدارک تأییدشده، محاسبه رسمی هزینه به تومان پیش از ثبت نهایی و پیگیری زنده
              مأموریت تا صدور فاکتور رسمی.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/request/new"
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-6 py-3.5 rounded-xl shadow-lg flex items-center gap-2 text-base transition"
              >
                <ShieldAlert className="w-5 h-5" />
                <span>ثبت فوری درخواست امداد</span>
              </Link>

              <a
                href={`tel:${systemInfo?.supportHotline || '02833330000'}`}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold px-5 py-3.5 rounded-xl flex items-center gap-2 text-sm transition"
              >
                <PhoneCall className="w-4 h-4 text-amber-400" />
                <span>مرکز پیام قزوین: {systemInfo?.supportHotline || '۰۲۸-۳۳۳۳۰۰۰۰'}</span>
              </a>
            </div>
          </div>

          {/* کارت تضمین‌های عملیاتی */}
          <div className="lg:col-span-5 bg-slate-800/80 border border-slate-700 rounded-2xl p-6 space-y-4">
            <h2 className="font-bold text-lg text-amber-400 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              استانداردهای غیرقابل مذاکره عملیاتی
            </h2>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-200">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />
                <span>
                  <strong>احراز صلاحیت الزامی امدادگران:</strong> هیچ امدادگری پیش از
                  تأیید مدارک فنی و هویتی توسط مدیریت، مجاز به دریافت مأموریت نیست.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CreditCard className="w-4 h-4 text-amber-400 shrink-0 mt-1" />
                <span>
                  <strong>شفافیت کامل مالی (تومان):</strong> تفکیک دقیق برآورد اولیه از
                  صورتحساب نهایی؛ هرگونه قطعه یا تغییر مبلغ منوط به ثبت دلیل و تأیید مشتری است.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-sky-400 shrink-0 mt-1" />
                <span>
                  <strong>بدون وعده ساختگی:</strong> در صورت تکمیل ظرفیت لحظه‌ای منطقه،
                  درخواست صادقانه به صف اولویت اپراتور مرکز پیام قزوین منتقل می‌شود.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* وضعیت مناطق فعال قزوین و راهبرد توسعه ایران */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                وضعیت پوشش جغرافیایی سامانه در ایران
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                راه‌اندازی مرحله نخست به‌صورت متمرکز و کنترل‌شده در{' '}
                <strong>استان قزوین</strong> انجام شده است. فعال‌سازی استان‌های بعدی منوط به
                تکمیل ناوگان و تأیید رسمی مدیر کل است.
              </p>
            </div>
            <Link
              to="/request/new"
              className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1"
            >
              <span>بررسی موقعیت من روی نقشه</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>

          {qazvinActiveZones.length > 0 && (
            <div>
              <div className="text-xs font-bold text-emerald-800 mb-2">
                محدوده‌های عملیاتی فعال در استان قزوین ({qazvinActiveZones.length.toLocaleString('fa-IR')} منطقه):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {qazvinActiveZones.map((z) => (
                  <div
                    key={z.id}
                    className="bg-emerald-50/70 border border-emerald-200 rounded-xl px-3.5 py-2.5 text-xs flex items-center justify-between gap-2"
                  >
                    <span className="font-bold text-emerald-950">{z.nameFa}</span>
                    <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full shrink-0">
                      فعال
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {provinces.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-500 mb-2">
                وضعیت استان‌های ثبت‌شده در معماری ملی سامانه:
              </div>
              <div className="flex flex-wrap gap-2">
                {provinces.map((p) => (
                  <span
                    key={p.id}
                    className={`text-xs px-3 py-1 rounded-full border font-semibold ${getStatusBadgeClass(p.status)}`}
                  >
                    استان {p.nameFa}: {p.statusLabel}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* گزیده خدمات پرکاربرد */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">
              خدمات امداد و حمل خودرو
            </h2>
            <p className="text-xs text-slate-500">
              تعرفه‌های پایه مصوب به تومان (پیش از ضرایب مسافت و نوع خودرو)
            </p>
          </div>
          <Link
            to="/services"
            className="text-xs sm:text-sm font-bold text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 px-3.5 py-2 rounded-xl flex items-center gap-1.5"
          >
            <span>مشاهده هر ۱۵ خدمت</span>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between hover:border-amber-400 transition shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
                    {s.categoryLabel}
                  </span>
                  {s.requiresEvCertification && (
                    <span className="text-[11px] font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full">
                      ویژه خودرو برقی EV
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-base text-slate-900 mb-1.5 flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-amber-500" />
                  {s.titleFa}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  {s.descriptionFa}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-400">تعرفه پایه:</div>
                  <div className="font-extrabold text-sm text-slate-900">
                    {formatToman(s.basePriceToman)}
                  </div>
                </div>
                <Link
                  to={`/request/new?serviceId=${s.id}`}
                  className="bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition"
                >
                  درخواست خدمت
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
