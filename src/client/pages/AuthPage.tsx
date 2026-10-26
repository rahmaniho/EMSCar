import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldAlert, LogIn, UserPlus, Terminal } from 'lucide-react';
import { useAuth } from '../lib/auth-context.tsx';
import {
  EQUIPMENT_TYPES,
  EQUIPMENT_TYPE_LABELS,
} from '../../shared/constants.ts';

export function AuthPage() {
  const { login, register, systemInfo } = useAuth();
  const supportTelHref = systemInfo?.supportHotline?.replace(/[^+\d]/g, '');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRole =
    searchParams.get('role') === 'responder' ? 'responder' : 'customer';
  const redirectTarget = searchParams.get('redirect') || '';

  const [mode, setMode] = useState<'login' | 'register'>(
    searchParams.get('role') ? 'register' : 'login'
  );
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [nationalCode, setNationalCode] = useState('');
  const [role, setRole] = useState<'customer' | 'responder'>(initialRole);
  const [equipmentType, setEquipmentType] = useState<string>('service_van');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const routeAfterAuth = (userRole: string) => {
    if (redirectTarget && redirectTarget.startsWith('/')) {
      navigate(redirectTarget);
      return;
    }
    switch (userRole) {
      case 'customer':
        navigate('/customer');
        break;
      case 'responder':
        navigate('/responder');
        break;
      case 'operator':
        navigate('/operator');
        break;
      case 'admin':
        navigate('/admin');
        break;
      default:
        navigate('/');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const u = await login(phone, password);
        routeAfterAuth(u.role);
      } else {
        const u = await register({
          phone,
          fullName,
          password,
          role,
          nationalCode: nationalCode || undefined,
          equipmentType: role === 'responder' ? equipmentType : undefined,
          vehiclePlate: role === 'responder' ? vehiclePlate : undefined,
        });
        routeAfterAuth(u.role);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در احراز هویت');
    } finally {
      setSubmitting(false);
    }
  };

  const quickDevLogin = async (devPhone: string, devPass: string) => {
    setError(null);
    setSubmitting(true);
    try {
      const u = await login(devPhone, devPass);
      routeAfterAuth(u.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ورود سریع');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">
              {mode === 'login'
                ? 'ورود به سامانه اورژانس خودرو'
                : 'ثبت‌نام در اورژانس خودرو'}
            </h1>
            <p className="text-xs text-slate-500">
              نشست کاربری امن با محافظت سمت سرور
            </p>
          </div>
        </div>

        {/* تب ورود / ثبت‌نام */}
        <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            <LogIn className="w-4 h-4" />
            ورود به حساب
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              mode === 'register'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            ایجاد حساب جدید
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  نوع عضویت *
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setRole('customer')}
                    className={`p-2.5 rounded-xl border font-bold transition ${
                      role === 'customer'
                        ? 'bg-amber-50 border-amber-400 text-amber-950'
                        : 'bg-white border-slate-300 text-slate-600'
                    }`}
                  >
                    مشتری (درخواست خدمات امداد)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('responder')}
                    className={`p-2.5 rounded-xl border font-bold transition ${
                      role === 'responder'
                        ? 'bg-blue-50 border-blue-400 text-blue-950'
                        : 'bg-white border-slate-300 text-slate-600'
                    }`}
                  >
                    امدادگر (منوط به تأیید مدارک)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نام و نام خانوادگی *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: محمد حسینی"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  کد ملی (۱۰ رقمی)
                </label>
                <input
                  type="text"
                  value={nationalCode}
                  onChange={(e) => setNationalCode(e.target.value)}
                  placeholder="مثال: 4310123456"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                />
              </div>

              {role === 'responder' && (
                <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5 space-y-3">
                  <p className="text-[11px] text-blue-900 font-semibold">
                    توجه: پس از ثبت‌نام اولیه، حساب شما در وضعیت «در انتظار تکمیل مدارک»
                    قرار می‌گیرد و فعالیت عملیاتی تنها پس از بررسی و تأیید مدیر مجاز خواهد بود.
                  </p>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      نوع خودرو / تجهیز امدادی
                    </label>
                    <select
                      value={equipmentType}
                      onChange={(e) => setEquipmentType(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    >
                      {EQUIPMENT_TYPES.map((eq) => (
                        <option key={eq} value={eq}>
                          {EQUIPMENT_TYPE_LABELS[eq]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      پلاک ناوگان امدادی
                    </label>
                    <input
                      type="text"
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value)}
                      placeholder="مثال: ۶۸ ع ۴۱۲ ایران ۷۹"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              شماره موبایل (۱۱ رقمی ایران) *
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09120000021"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm dir-ltr text-left"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              رمز عبور (حداقل ۸ کاراکتر) *
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm dir-ltr text-left"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white font-extrabold py-3 rounded-xl text-sm transition disabled:opacity-50"
          >
            {submitting
              ? 'در حال بررسی...'
              : mode === 'login'
                ? 'ورود به سامانه'
                : 'تکمیل ثبت‌نام و ورود'}
          </button>
        </form>
      </div>

      {/* پنل ورود سریع حساب‌های ارزیابی (فقط در محیط غیرتولید فعال است!) */}
      <div className="lg:col-span-5 space-y-4">
        {systemInfo?.devQuickLoginEnabled ? (
          <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-3.5 border border-slate-800">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <Terminal className="w-4 h-4" />
              <span>حساب‌های ارزیابی محیط توسعه ({systemInfo.environment})</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              این بخش صرفاً در محیط غیرتولید فعال است (در محیط Production به‌صورت خودکار
              غیرفعال و داده‌های آزمایشی مسدود هستند). برای ممیزی سریع هر ۴ نقش کلیک کنید:
            </p>

            <div className="space-y-2 text-xs">
              <button
                type="button"
                onClick={() => void quickDevLogin('09120000021', 'Customer@1405!')}
                className="w-full text-right bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-2.5 transition"
              >
                <div className="font-bold text-amber-300">ورود به‌عنوان مشتری (علی کریمی)</div>
                <div className="text-[11px] text-slate-400">دارای خودروی داخلی + خودروی برقی در قزوین</div>
              </button>

              <button
                type="button"
                onClick={() => void quickDevLogin('09120000011', 'Responder@1405!')}
                className="w-full text-right bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-2.5 transition"
              >
                <div className="font-bold text-emerald-300">
                  امدادگر تأییدشده ۱ (کارگاه سیار قزوین)
                </div>
                <div className="text-[11px] text-slate-400">باتری، پنچرگیری، تعمیرات سبک در محل</div>
              </button>

              <button
                type="button"
                onClick={() => void quickDevLogin('09120000012', 'Responder@1405!')}
                className="w-full text-right bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-2.5 transition"
              >
                <div className="font-bold text-emerald-300">
                  امدادگر تأییدشده ۲ (کفی خودروبر قزوین-الوند)
                </div>
                <div className="text-[11px] text-slate-400">یدک‌کش و حمل خودرو به مقصد</div>
              </button>

              <button
                type="button"
                onClick={() => void quickDevLogin('09120000013', 'Responder@1405!')}
                className="w-full text-right bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-2.5 transition"
              >
                <div className="font-bold text-sky-300">
                  امدادگر تأییدشده ۳ (متخصص خودروی برقی EV)
                </div>
                <div className="text-[11px] text-slate-400">دارای گواهینامه ایمنی ولتاژ بالا</div>
              </button>

              <button
                type="button"
                onClick={() => void quickDevLogin('09120000014', 'Responder@1405!')}
                className="w-full text-right bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-2.5 transition"
              >
                <div className="font-bold text-rose-300">
                  امدادگر در انتظار تأیید مدارک (امیر حسینی)
                </div>
                <div className="text-[11px] text-slate-400">جهت آزمون قفل فعالیت پیش از تأیید مدیر</div>
              </button>

              <button
                type="button"
                onClick={() => void quickDevLogin('09120000002', 'Operator@1405!')}
                className="w-full text-right bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-2.5 transition"
              >
                <div className="font-bold text-purple-300">
                  اپراتور مرکز پیام قزوین (سارا محمدی)
                </div>
                <div className="text-[11px] text-slate-400">مدیریت صف انتظار، تیکت‌ها و یادداشت داخلی</div>
              </button>

              <button
                type="button"
                onClick={() => void quickDevLogin('09120000001', 'Admin@1405!')}
                className="w-full text-right bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-2.5 transition"
              >
                <div className="font-bold text-amber-400">مدیر کل سامانه (Super Admin)</div>
                <div className="text-[11px] text-slate-400">
                  مدیریت استان‌ها، خدمات، تعرفه‌ها، مالی و ممیزی
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-xs text-slate-600 space-y-2">
            <h2 className="font-bold text-sm text-slate-900">راهنمای امنیتی ورود</h2>
            <p>
              لطفاً شماره موبایل ۱۱ رقمی ثبت‌شده خود و رمز عبور را وارد نمایید. این نسخه تا زمان فعال‌سازی بهره‌برداری عمومی، خط امداد اضطراری نیست.
            </p>
            {supportTelHref ? (
              <p className="font-bold">
                شماره تماس پشتیبانی ثبت‌شده:{' '}
                <a className="underline" href={`tel:${supportTelHref}`}>
                  {systemInfo?.supportHotline}
                </a>
              </p>
            ) : (
              <p>شماره تماس پشتیبانی عمومی هنوز تأیید و پیکربندی نشده است.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
