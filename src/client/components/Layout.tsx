import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Bell,
  PhoneCall,
  User,
  LogOut,
  Menu,
  X,
  Wrench,
  Headphones,
  LayoutDashboard,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context.tsx';
import { apiFetch } from '../lib/api.ts';
import { useRealtimeEvents } from '../lib/use-realtime.ts';
import { USER_ROLE_LABELS } from '../../shared/constants.ts';
import { formatDateTimeFa } from '../lib/format.ts';

interface InAppNotification {
  id: number;
  request_id: number | null;
  title: string;
  body: string;
  is_read: number;
  created_at: string;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, systemInfo, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    let mounted = true;
    const loadNotifs = async () => {
      try {
        const res = await apiFetch<{ notifications: InAppNotification[] }>(
          '/api/notifications'
        );
        if (mounted) setNotifications(res.notifications);
      } catch {
        // ignore transient network error
      }
    };
    void loadNotifs();
    const timer = setInterval(loadNotifs, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [user]);

  useRealtimeEvents(Boolean(user), () => {
    void apiFetch<{ notifications: InAppNotification[] }>('/api/notifications')
      .then((res) => setNotifications(res.notifications))
      .catch(() => {});
  });

  const unreadCount = notifications.filter((n) => n.is_read === 0).length;

  const markAsRead = async (id: number, requestId: number | null) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      if (requestId) {
        setNotifOpen(false);
        navigate(`/requests/${requestId}`);
      }
    } catch {
      // ignore
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const getRoleDashboardLink = () => {
    if (!user) return '/auth';
    switch (user.role) {
      case 'customer':
        return '/customer';
      case 'responder':
        return '/responder';
      case 'operator':
        return '/operator';
      case 'admin':
        return '/admin';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* نوار شفافیت محیط آزمایشی (در صورت فعال بودن Sandbox درگاه یا پیامک) */}
      {systemInfo &&
        (systemInfo.integrations.paymentGateway.isSandbox ||
          systemInfo.integrations.smsProvider.isSandbox) && (
          <div className="bg-amber-900 text-amber-50 text-xs py-1.5 px-4 text-center no-print">
            <span className="font-semibold">شفافیت عملیاتی ({systemInfo.environment}): </span>
            پوشش فعال فعلی: <strong>استان قزوین</strong> | درگاه پرداخت:{' '}
            {systemInfo.integrations.paymentGateway.isSandbox
              ? 'آزمایشی (Sandbox — بدون تراکنش بانکی واقعی)'
              : 'عملیاتی'}{' '}
            | پیامک:{' '}
            {systemInfo.integrations.smsProvider.isSandbox
              ? 'ثبت در صف آزمایشی (بدون ارسال مخابراتی)'
              : 'عملیاتی'}
          </div>
        )}

      {/* هدر اصلی */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-md no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-sm group-hover:bg-amber-400 transition">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <div className="font-extrabold text-lg leading-tight tracking-tight">
                  اورژانس خودرو
                </div>
                <div className="text-[11px] text-amber-300 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span>امداد خودرو استان قزوین</span>
                </div>
              </div>
            </Link>
          </div>

          {/* منوی دسکتاپ */}
          <nav className="hidden md:flex items-center gap-5 text-sm font-medium">
            <Link
              to="/"
              className={`hover:text-amber-400 transition ${location.pathname === '/' ? 'text-amber-400' : 'text-slate-200'}`}
            >
              صفحه اصلی
            </Link>
            <Link
              to="/services"
              className={`hover:text-amber-400 transition ${location.pathname === '/services' ? 'text-amber-400' : 'text-slate-200'}`}
            >
              خدمات و تعرفه‌ها
            </Link>
            <Link
              to="/track"
              className={`hover:text-amber-400 transition ${location.pathname === '/track' ? 'text-amber-400' : 'text-slate-200'}`}
            >
              پیگیری مأموریت
            </Link>
            <a
              href="/showcase/"
              className="hover:text-amber-400 transition text-emerald-300 font-semibold"
            >
              بیزینس‌پلن اسلایدی
            </a>
            <Link
              to="/request/new"
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg transition shadow-sm"
            >
              ثبت فوری درخواست امداد
            </Link>
            <Link
              to="/support"
              className={`hover:text-amber-400 transition flex items-center gap-1 ${location.pathname === '/support' ? 'text-amber-400' : 'text-slate-200'}`}
            >
              <Headphones className="w-4 h-4" />
              پشتیبانی
            </Link>
            {user && (
              <Link
                to={getRoleDashboardLink()}
                className={`hover:text-amber-400 transition flex items-center gap-1 ${
                  location.pathname.startsWith(getRoleDashboardLink())
                    ? 'text-amber-400'
                    : 'text-slate-200'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                پنل {USER_ROLE_LABELS[user.role]}
              </Link>
            )}
          </nav>

          {/* ابزارهای سمت چپ هدر */}
          <div className="flex items-center gap-2">
            <a
              href={`tel:${systemInfo?.supportHotline || '02833330000'}`}
              className="hidden lg:inline-flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 px-3 py-1.5 rounded-lg transition"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>{systemInfo?.supportHotline || '۰۲۸-۳۳۳۳۰۰۰۰'}</span>
            </a>

            {user ? (
              <div className="flex items-center gap-2 relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((v) => !v)}
                  aria-label="اعلان‌های سامانه"
                  className="relative p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute left-0 top-12 w-80 sm:w-96 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-sm">اعلان‌های اخیر</span>
                      <span className="text-xs text-slate-500">
                        {unreadCount} خوانده‌نشده
                      </span>
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-500">
                          اعلانی ثبت نشده است.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => void markAsRead(n.id, n.request_id)}
                            className={`w-full text-right p-3.5 hover:bg-slate-50 transition block ${
                              n.is_read === 0 ? 'bg-amber-50/60' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-bold text-xs text-slate-900">
                                {n.title}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {formatDateTimeFa(n.created_at)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {n.body}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <Link
                  to={getRoleDashboardLink()}
                  className="hidden sm:flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-xs"
                >
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-semibold max-w-28 truncate">{user.fullName}</span>
                </Link>

                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  title="خروج از حساب"
                  className="p-2 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/auth"
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-lg transition"
              >
                ورود / ثبت‌نام
              </Link>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="باز کردن منو"
              className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-200"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* منوی موبایل */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-t border-slate-800 px-4 py-4 space-y-2.5 text-sm">
            <Link
              to="/request/new"
              className="block w-full text-center bg-amber-500 text-slate-950 font-bold py-2.5 rounded-lg"
            >
              ثبت فوری درخواست امداد
            </Link>
            <Link to="/" className="block py-2 text-slate-200">
              صفحه اصلی
            </Link>
            <Link to="/services" className="block py-2 text-slate-200">
              کاتالوگ خدمات و تعرفه‌ها
            </Link>
            <Link to="/track" className="block py-2 text-slate-200">
              پیگیری وضعیت مأموریت با کد رهگیری
            </Link>
            <Link to="/legal" className="block py-2 text-slate-200">
              ایمنی جاده‌ای و قوانین لغو
            </Link>
            <a href="/showcase/" className="block py-2 text-emerald-300 font-semibold">
              معرفی جامع پروژه (GitHub Pages)
            </a>
            <Link to="/support" className="block py-2 text-slate-200">
              مرکز پشتیبانی و ثبت شکایات
            </Link>
            {user && (
              <Link
                to={getRoleDashboardLink()}
                className="block py-2 text-amber-400 font-bold"
              >
                پنل {USER_ROLE_LABELS[user.role]} ({user.fullName})
              </Link>
            )}
          </div>
        )}
      </header>

      {/* محتوای اصلی صفحه */}
      <main className="flex-1">{children}</main>

      {/* فوتر رسمی هماهنگ با هویت برند */}
      <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 mt-12 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
          <div>
            <div className="flex items-center gap-2 text-white font-bold text-base mb-2">
              <Wrench className="w-5 h-5 text-amber-400" />
              <span>سامانه جامع «اورژانس خودرو»</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              پلتفرم تخصصی ارتباط مشتریان با امدادگران احراز صلاحیت‌شده در استان قزوین، با
              معماری مقیاس‌پذیر جهت توسعه کنترل‌شده به سایر استان‌های ایران.
            </p>
            <p className="text-[11px] text-slate-500 mt-2">
              * عنوان انگلیسی پیشنهادی «Auto Emergency» صرفاً پیشنهادی کاری است و منوط به
              بررسی حقوقی ثبت علامت تجاری و مالکیت دامنه است.
            </p>
          </div>

          <div>
            <h3 className="text-white font-bold mb-2.5">دسترسی سریع</h3>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li>
                <Link to="/request/new" className="hover:text-amber-400">
                  ثبت درخواست اضطراری امداد
                </Link>
              </li>
              <li>
                <Link to="/services" className="hover:text-amber-400">
                  فهرست ۱۵ خدمت و تعرفه‌های پایه (تومان)
                </Link>
              </li>
              <li>
                <Link to="/support" className="hover:text-amber-400">
                  ثبت شکایت، پیگیری پشتیبانی و قوانین لغو
                </Link>
              </li>
              <li>
                <Link to="/track" className="hover:text-amber-400">
                  استعلام وضعیت مأموریت با کد رهگیری
                </Link>
              </li>
              <li>
                <Link to="/legal" className="hover:text-amber-400">
                  راهنمای ایمنی کنار جاده، تعرفه و ملاحظات حقوقی
                </Link>
              </li>
              <li>
                <Link to="/auth?role=responder" className="hover:text-amber-400">
                  ثبت‌نام و ارسال مدارک امدادگران قزوین
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold mb-2.5">مرکز عملیات استان قزوین</h3>
            <p className="text-xs text-slate-400 mb-2">
              مناطق فعال فعلی: شهر قزوین، الوند و شهر صنعتی البرز، تاکستان، آبیک،
              بوئین‌زهرا و محورهای آزادراهی استحفاظی قزوین.
            </p>
            <div className="inline-flex items-center gap-2 bg-slate-800 px-3.5 py-2 rounded-lg text-amber-300 font-bold text-xs">
              <PhoneCall className="w-4 h-4" />
              <span>تلفن پشتیبانی ۲۴ ساعته: {systemInfo?.supportHotline || '۰۲۸-۳۳۳۳۰۰۰۰'}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
