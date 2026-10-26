import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Car,
  Receipt,
  UserCheck,
  Clock,
  Trash2,
  Plus,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context.tsx';
import { apiFetch } from '../lib/api.ts';
import {
  formatToman,
  formatDateTimeFa,
  getStatusBadgeClass,
} from '../lib/format.ts';
import {
  VEHICLE_CATEGORIES,
  VEHICLE_CATEGORY_LABELS,
  ACTIVE_CUSTOMER_MISSION_STATES,
  type RequestState,
  type VehicleCategory,
} from '../../shared/constants.ts';

interface RequestSummary {
  id: number;
  trackingCode: string;
  status: RequestState;
  statusLabel: string;
  paymentStatus: string;
  paymentStatusLabel: string;
  paymentIsSandbox: boolean;
  serviceTitle: string;
  zoneName: string;
  vehicleSummary: string;
  payableToman: number;
  createdAt: string;
}

interface VehicleItem {
  id: number;
  brand: string;
  model: string;
  manufactureYear: number;
  plateNumber: string;
  category: VehicleCategory;
  categoryLabel: string;
}

interface InvoiceRecord {
  id: number;
  invoice_number: string;
  request_id: number;
  tracking_code: string;
  service_title: string;
  total_toman: number;
  status: string;
  issued_at: string;
  payment_is_sandbox?: number | null;
  provider_verified_refunds_count?: number;
}

function isUnverifiedInvoicePayment(invoice: InvoiceRecord): boolean {
  if (invoice.status === 'paid') return invoice.payment_is_sandbox == null;
  if (['refunded', 'partially_refunded'].includes(invoice.status)) {
    return Number(invoice.provider_verified_refunds_count ?? 0) === 0;
  }
  return false;
}

function getInvoiceStatusLabel(invoice: InvoiceRecord): string {
  if (Number(invoice.payment_is_sandbox) === 1) {
    return 'پرداخت شبیه‌سازی‌شده (Sandbox)؛ وجه واقعی جابه‌جا نشده';
  }
  if (invoice.status === 'paid') {
    return invoice.payment_is_sandbox === 0
      ? 'پرداخت‌شده (تأیید سمت سرور)'
      : 'وضعیت پرداخت قدیمی/بدون مدرک provider';
  }
  if (['refunded', 'partially_refunded'].includes(invoice.status)) {
    if (isUnverifiedInvoicePayment(invoice)) {
      return 'بازپرداخت قدیمی/راستی‌آزمایی‌نشده';
    }
    return invoice.status === 'refunded'
      ? 'وضعیت بازپرداخت ثبت‌شده؛ مبلغ نیازمند تطبیق'
      : 'وضعیت بازپرداخت جزئی ثبت‌شده؛ مبلغ نیازمند تطبیق';
  }
  if (invoice.status === 'approved_debt') {
    return 'بدهی ثبت‌شده؛ وجه دریافت نشده';
  }
  if (invoice.status === 'issued') return 'صادرشده؛ در انتظار پرداخت';
  return invoice.status;
}

export function CustomerDashboardPage() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<'requests' | 'vehicles' | 'finance' | 'profile'>(
    'requests'
  );
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [newVehicle, setNewVehicle] = useState({
    brand: '',
    model: '',
    manufactureYear: 1402,
    plateNumber: '',
    category: 'domestic' as VehicleCategory,
  });

  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || '',
    nationalCode: user?.nationalCode || '',
    email: user?.email || '',
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [reqRes, vehRes, finRes] = await Promise.all([
        apiFetch<{ requests: RequestSummary[] }>('/api/requests/my'),
        apiFetch<{ vehicles: VehicleItem[] }>('/api/customers/vehicles'),
        apiFetch<{ invoices: InvoiceRecord[] }>('/api/payments/customer/history'),
      ]);
      setRequests(reqRes.requests);
      setVehicles(vehRes.vehicles);
      setInvoices(finRes.invoices);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const activeMissions = requests.filter((r) =>
    ACTIVE_CUSTOMER_MISSION_STATES.includes(r.status)
  );

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/customers/vehicles', {
        method: 'POST',
        body: JSON.stringify(newVehicle),
      });
      setNewVehicle({
        brand: '',
        model: '',
        manufactureYear: 1402,
        plateNumber: '',
        category: 'domestic',
      });
      setMsg('خودروی جدید با موفقیت اضافه شد.');
      await loadAll();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'خطا در افزودن خودرو');
    }
  };

  const handleDeleteVehicle = async (id: number) => {
    if (!window.confirm('آیا از حذف این خودرو از فهرست فعال خود مطمئن هستید؟')) {
      return;
    }
    await apiFetch(`/api/customers/vehicles/${id}`, { method: 'DELETE' });
    await loadAll();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(profileForm),
      });
      await refreshUser();
      setMsg('اطلاعات پروفایل با موفقیت به‌روزرسانی شد.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'خطا در ذخیره پروفایل');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="bg-slate-900 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold">داشبورد مشتری — {user?.fullName}</h1>
          <p className="text-xs text-slate-300 mt-1">
            شماره تماس ثبت‌شده: {user?.phone} | مدیریت درخواست‌ها، خودروها و صورتحساب‌های رسمی
          </p>
        </div>
        <Link
          to="/request/new"
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-5 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2"
        >
          <ShieldAlert className="w-4 h-4" />
          <span>ثبت درخواست جدید امداد</span>
        </Link>
      </div>

      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-xl text-xs font-bold">
          {msg}
        </div>
      )}

      {/* هشدار مأموریت فعال */}
      {activeMissions.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="font-extrabold text-sm text-amber-950 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>مأموریت‌های در جریان شما ({activeMissions.length.toLocaleString('fa-IR')})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeMissions.map((m) => (
              <div
                key={m.id}
                className="bg-white rounded-xl p-4 border border-amber-200 flex items-center justify-between gap-3"
              >
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-slate-900">
                    {m.serviceTitle} ({m.trackingCode})
                  </div>
                  <div className="text-slate-600">{m.zoneName}</div>
                  <span
                    className={`inline-block text-[11px] px-2.5 py-0.5 rounded-full border font-bold ${getStatusBadgeClass(m.status)}`}
                  >
                    {m.statusLabel}
                  </span>
                </div>
                <Link
                  to={`/missions/${m.id}/track`}
                  className="bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white text-xs font-bold px-3.5 py-2 rounded-lg shrink-0"
                >
                  پیگیری زنده
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* تب‌ها */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-slate-200 text-xs font-bold">
        {[
          { key: 'requests', label: 'سوابق درخواست‌ها', icon: Clock },
          { key: 'vehicles', label: 'خودروهای من', icon: Car },
          { key: 'finance', label: 'فاکتورها و پرداخت‌ها', icon: Receipt },
          { key: 'profile', label: 'پروفایل کاربری', icon: UserCheck },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key as typeof tab)}
              className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition ${
                tab === item.key
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-10 text-center text-sm text-slate-500 border border-slate-200">
          در حال دریافت اطلاعات...
        </div>
      ) : (
        <>
          {tab === 'requests' && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {requests.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  هنوز درخواستی ثبت نکرده‌اید.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {requests.map((r) => (
                    <div
                      key={r.id}
                      className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/70"
                    >
                      <div className="space-y-1 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900">
                            {r.serviceTitle}
                          </span>
                          <span className="text-slate-400 font-mono">
                            {r.trackingCode}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full border font-bold text-[11px] ${getStatusBadgeClass(r.status)}`}
                          >
                            {r.statusLabel}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full border font-bold text-[11px] ${
                              r.paymentIsSandbox || r.paymentStatusLabel.includes('راستی‌آزمایی') || r.paymentStatusLabel.includes('بدون مدرک')
                                ? getStatusBadgeClass('pending_gateway')
                                : getStatusBadgeClass(r.paymentStatus)
                            }`}
                          >
                            {r.paymentStatusLabel}
                          </span>
                        </div>
                        <div className="text-slate-600">
                          {r.vehicleSummary} | {r.zoneName} | ثبت‌شده در{' '}
                          {formatDateTimeFa(r.createdAt)}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-left">
                          <div className="text-[11px] text-slate-400">مبلغ صورتحساب</div>
                          <div className="font-extrabold text-sm text-slate-900">
                            {formatToman(r.payableToman)}
                          </div>
                        </div>
                        <Link
                          to={`/requests/${r.id}`}
                          className="bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition"
                        >
                          جزئیات و پیگیری
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'vehicles' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <h2 className="font-extrabold text-sm text-slate-900">
                  خودروهای ثبت‌شده شما
                </h2>
                {vehicles.length === 0 ? (
                  <p className="text-xs text-slate-500">خودرویی ثبت نشده است.</p>
                ) : (
                  <div className="space-y-2.5">
                    {vehicles.map((v) => (
                      <div
                        key={v.id}
                        className="p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-3"
                      >
                        <div className="text-xs space-y-1">
                          <div className="font-bold text-sm text-slate-900">
                            {v.brand} {v.model} ({v.manufactureYear.toLocaleString('fa-IR')})
                          </div>
                          <div className="text-slate-600">
                            پلاک: {v.plateNumber} — {v.categoryLabel}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteVehicle(v.id)}
                          aria-label="حذف خودرو"
                          className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form
                onSubmit={handleAddVehicle}
                className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 space-y-3 text-xs"
              >
                <h2 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-amber-500" />
                  افزودن خودروی جدید
                </h2>
                <div>
                  <label className="font-bold block mb-1">برند سازنده *</label>
                  <input
                    type="text"
                    required
                    value={newVehicle.brand}
                    onChange={(e) =>
                      setNewVehicle({ ...newVehicle, brand: e.target.value })
                    }
                    placeholder="سایپا / ایران‌خودرو / کرمان‌موتور"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">مدل خودرو *</label>
                  <input
                    type="text"
                    required
                    value={newVehicle.model}
                    onChange={(e) =>
                      setNewVehicle({ ...newVehicle, model: e.target.value })
                    }
                    placeholder="پژو ۲۰۷"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">پلاک انتظامی *</label>
                  <input
                    type="text"
                    required
                    value={newVehicle.plateNumber}
                    onChange={(e) =>
                      setNewVehicle({ ...newVehicle, plateNumber: e.target.value })
                    }
                    placeholder="۶۸ ب ۱۲۳ ایران ۷۹"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">دسته فنی *</label>
                  <select
                    value={newVehicle.category}
                    onChange={(e) =>
                      setNewVehicle({
                        ...newVehicle,
                        category: e.target.value as VehicleCategory,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                  >
                    {VEHICLE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {VEHICLE_CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white font-bold py-2.5 rounded-xl transition"
                >
                  ثبت خودرو
                </button>
              </form>
            </div>
          )}

          {tab === 'finance' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <h2 className="font-extrabold text-sm text-slate-900">
                فاکتورهای رسمی صادرشده
              </h2>
              {invoices.length === 0 ? (
                <p className="text-xs text-slate-500">
                  تا این لحظه فاکتوری صادر نشده است. فاکتور رسمی بلافاصله پس از تکمیل
                  خدمت صادر می‌شود.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-slate-900">
                          فاکتور {inv.invoice_number} — {inv.service_title}
                        </div>
                        <div className="text-slate-500">
                          مأموریت {inv.tracking_code} | تاریخ صدور:{' '}
                          {formatDateTimeFa(inv.issued_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full border font-bold ${
                            Number(inv.payment_is_sandbox) === 1 || isUnverifiedInvoicePayment(inv)
                              ? getStatusBadgeClass('pending_gateway')
                              : getStatusBadgeClass(inv.status)
                          }`}
                        >
                          {getInvoiceStatusLabel(inv)}
                        </span>
                        <span className="font-extrabold text-sm">
                          {formatToman(inv.total_toman)}
                        </span>
                        <Link
                          to={`/requests/${inv.request_id}`}
                          className="text-blue-700 font-bold hover:underline"
                        >
                          مشاهده فاکتور
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'profile' && (
            <form
              onSubmit={handleSaveProfile}
              className="max-w-lg bg-white rounded-2xl border border-slate-200 p-6 space-y-4 text-xs"
            >
              <h2 className="font-extrabold text-sm text-slate-900">
                ویرایش مشخصات فردی
              </h2>
              <div>
                <label className="font-bold block mb-1">نام و نام خانوادگی</label>
                <input
                  type="text"
                  required
                  value={profileForm.fullName}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, fullName: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">کد ملی</label>
                <input
                  type="text"
                  value={profileForm.nationalCode}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, nationalCode: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">پست الکترونیک (اختیاری)</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, email: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 dir-ltr text-left"
                />
              </div>
              <button
                type="submit"
                className="bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white font-bold px-5 py-2.5 rounded-xl transition"
              >
                ذخیره تغییرات
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
