import React, { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  Search,
  ShieldCheck,
  AlertTriangle,
  Scale,
  MapPin,
  Clock,
  FileText,
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { formatDateTimeFa, getStatusBadgeClass } from '../lib/format.ts';

interface PublicTrackingSummary {
  trackingCode: string;
  status: string;
  statusLabel: string;
  paymentStatus: string;
  paymentStatusLabel: string;
  serviceTitle: string;
  provinceName: string;
  zoneName: string;
  estimatedEtaMinutes: number | null;
  operatorEscalationRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export function PublicTrackAndLegalPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || '';
  const isLegalView = location.pathname === '/legal';

  const [code, setCode] = useState(initialCode);
  const [summary, setSummary] = useState<PublicTrackingSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const res = await apiFetch<{ summary: PublicTrackingSummary }>(
        `/api/requests/track/${encodeURIComponent(code.trim())}`
      );
      setSummary(res.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در استعلام کد رهگیری');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* تب جابه‌جایی بین پیگیری سریع و قوانین/ایمنی */}
      <div className="flex flex-wrap gap-2">
        <Link
          to="/track"
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition ${
            !isLegalView
              ? 'bg-slate-900 text-amber-400'
              : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          <Search className="w-4 h-4" />
          پیگیری سریع وضعیت مأموریت با کد رهگیری
        </Link>
        <Link
          to="/legal"
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition ${
            isLegalView
              ? 'bg-slate-900 text-amber-400'
              : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          <Scale className="w-4 h-4" />
          ایمنی کنار جاده، قوانین لغو و شفافیت حقوقی
        </Link>
      </div>

      {!isLegalView ? (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Search className="w-5 h-5 text-amber-500" />
              استعلام ایمن وضعیت مأموریت امدادی
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              با وارد کردن کد رهگیری مأموریت (مانند <span className="font-mono">QZV-...</span>)،
              خلاصه وضعیت عملیات بدون افشای اطلاعات شخصی، شماره موبایل یا مختصات دقیق مکانی
              نمایش داده می‌شود. برای مشاهده نقشه زنده و فاکتور کامل وارد حساب خود شوید.
            </p>

            <form onSubmit={handleLookup} className="flex flex-wrap gap-2">
              <input
                type="text"
                required
                dir="ltr"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="QZV-..."
                className="flex-1 min-w-[220px] rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-mono"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-6 py-2.5 rounded-xl text-xs transition"
              >
                {loading ? 'در حال استعلام...' : 'جستجوی وضعیت'}
              </button>
            </form>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-950 p-4 rounded-xl text-xs font-bold">
                {error}
              </div>
            )}

            {summary && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <div className="font-extrabold text-sm text-slate-900">
                      {summary.serviceTitle}
                    </div>
                    <div className="font-mono text-slate-500 mt-0.5">
                      {summary.trackingCode}
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full border font-bold ${getStatusBadgeClass(summary.status)}`}
                  >
                    {summary.statusLabel}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-amber-600" />
                    <span>
                      محدوده عملیات: <strong>{summary.provinceName}</strong> —{' '}
                      <strong>{summary.zoneName}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-sky-600" />
                    <span>
                      آخرین بروزرسانی: <strong>{formatDateTimeFa(summary.updatedAt)}</strong>
                    </span>
                  </div>
                </div>

                {summary.estimatedEtaMinutes !== null && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-3 rounded-xl font-bold">
                    زمان تخمینی رسیدن امدادگر: حدود{' '}
                    {summary.estimatedEtaMinutes.toLocaleString('fa-IR')} دقیقه
                  </div>
                )}

                {summary.operatorEscalationRequired && (
                  <div className="bg-amber-50 border border-amber-300 text-amber-950 p-3 rounded-xl font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      این درخواست در صف ویژه اپراتور مرکز پیام قزوین در حال هماهنگی با
                      نزدیک‌ترین واحد است.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* راهنمای ایمنی اضطراری در کنار جاده */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-3 text-xs">
            <h2 className="font-extrabold text-sm text-amber-400 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              توصیه‌های حیاتی ایمنی تا رسیدن امدادگر در محورهای استان قزوین
            </h2>
            <ul className="space-y-2 text-slate-200 leading-relaxed list-disc pr-5">
              <li>
                چراغ‌های فلاشر خودرو را فوراً روشن کنید و در آزادراه‌های قزوین-کرج و
                قزوین-زنجان، مثلث شبرنگ احتیاط را حداقل در فاصله ۷۰ تا ۱۰۰ متری عقب خودرو قرار
                دهید.
              </li>
              <li>
                در توقف‌های شبانه یا در شانه خاکی آزادراه، سرنشینان را به پشت گاردریل ایمن هدایت
                کنید و از توقف مقابل یا پشت خودرو بپرهیزید.
              </li>
              <li>
                پیش از تحویل خودرو یا آغاز کار، پلاک و نام امدادگر اعزامی را با اطلاعات ثبت‌شده
                در پرونده مأموریت در سامانه تطبیق دهید.
              </li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-6 text-xs leading-relaxed">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              شفافیت تعرفه، قوانین لغو و حریم خصوصی کاربران «اورژانس خودرو»
            </h1>

            <div className="space-y-2">
              <h2 className="font-extrabold text-sm text-slate-900">
                ۱. دامنه پوشش جغرافیایی فعلی
              </h2>
              <p className="text-slate-700">
                در مرحله فعلی بهره‌برداری، خدمات عملیاتی منحصراً در محدوده‌های مصوب{' '}
                <strong>استان قزوین</strong> ارائه می‌شود. نمایش نام سایر استان‌ها در نقشه راه
                به منزله پوشش فعال نیست و ثبت درخواست در مناطق غیرفعال توسط سرور مسدود است.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="font-extrabold text-sm text-slate-900">
                ۲. قوانین شفاف قیمت‌گذاری (تومان) و لغو درخواست
              </h2>
              <ul className="list-disc pr-5 space-y-1.5 text-slate-700">
                <li>
                  تمامی مبالغ نمایش‌داده‌شده در سامانه به <strong>تومان</strong> است و تبدیل به
                  ریال صرفاً هنگام انتقال به درگاه بانکی انجام می‌شود.
                </li>
                <li>
                  لغو درخواست پیش از حرکت امدادگر (`Submitted`, `Searching`, `Offered`,
                  `Accepted`) کاملاً <strong>رایگان</strong> است.
                </li>
                <li>
                  در صورت لغو درخواست توسط مشتری پس از حرکت یا حضور امدادگر در محل (`EnRoute`,
                  `Arrived`)، هزینه مصوب ایاب‌وذهاب مندرج در شناسنامه همان خدمت محاسبه می‌گردد.
                </li>
                <li>
                  هرگونه افزودن هزینه قطعات مصرفی در محل حادثه منوط به ثبت در گزارش فنی و تأیید
                  شفاف مشتری پیش از پرداخت است.
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h2 className="font-extrabold text-sm text-slate-900">
                ۳. حفاظت از حریم خصوصی مکانی و اسناد مالکیت
              </h2>
              <p className="text-slate-700">
                موقعیت دقیق مکانی و شماره تماس مشتری پیش از پذیرش قطعی مأموریت به امدادگر نمایش
                داده نمی‌شود و پس از اتمام مأموریت نیز دسترسی امدادگر به موقعیت و تلفن مشتری قطع
                می‌گردد. در خدمات حساس مانند «باز کردن مجاز در خودرو»، احراز مالکیت خودرو در محل
                الزامی است.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-300 text-amber-950 p-4 rounded-xl">
              <strong>تذکر حقوقی و نظارتی:</strong> چارچوب‌های مربوط به تجارت الکترونیک، مجوزهای
              صنفی/راهداری، مقررات مالیاتی و وضعیت ثبت علامت تجاری نام پیشنهادی انگلیسی{' '}
              <em>Auto Emergency</em> بر پایه فرضیات فنی تدوین شده و پیش از بهره‌برداری تجاری
              عمومی نیازمند بررسی و تأیید مشاور حقوقی رسمی است.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
