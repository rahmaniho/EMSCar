import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  BarChart3,
  Wrench,
  MapPin,
  UserCheck,
  CreditCard,
  Users,
  Settings,
  FileSearch,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { formatDateTimeFa, formatToman } from '../lib/format.ts';

type AdminTab =
  | 'reports'
  | 'responders'
  | 'services'
  | 'tariffs'
  | 'geography'
  | 'finance'
  | 'users'
  | 'settings_audit';

interface ExecutiveDashboardResponse {
  operational: {
    totalRequests: number;
    activeMissionsCount: number;
    completedMissionsCount: number;
    byStatus: Array<{ status: string; cnt: number }>;
    onlineApprovedRespondersCount: number;
    pendingResponderReviewsCount: number;
    openSupportTicketsCount: number;
  };
  financial: {
    grossVerifiedToman: number;
    verifiedPaymentsCount: number;
    totalRefundedToman: number;
    netCollectedToman: number;
    platformCommissionToman: number;
    collectedTaxToman: number;
    settlementsPaidToman: number;
    settlementsPendingToman: number;
  };
  geographyReadiness: Array<{
    provinceId: number;
    slug: string;
    nameFa: string;
    status: string;
    statusLabel: string;
    minRequiredResponders: number;
    approvedRespondersCount: number;
    activeZonesCount: number;
    isReadyForActivation: boolean;
  }>;
}

export function AdminPanelPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('reports');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [reports, setReports] = useState<ExecutiveDashboardResponse | null>(null);
  const [responders, setResponders] = useState<Array<Record<string, unknown>>>([]);
  const [services, setServices] = useState<Array<Record<string, unknown>>>([]);
  const [serviceAuditLogs, setServiceAuditLogs] = useState<
    Array<Record<string, unknown>>
  >([]);
  const [pricingRules, setPricingRules] = useState<Record<string, number> | null>(null);
  const [discounts, setDiscounts] = useState<Array<Record<string, unknown>>>([]);
  const [provinces, setProvinces] = useState<Array<Record<string, unknown>>>([]);
  const [geoHistory, setGeoHistory] = useState<Array<Record<string, unknown>>>([]);
  const [financeReport, setFinanceReport] = useState<{
    summary: Record<string, number>;
    recentTransactions: Array<Record<string, unknown>>;
    settlements: Array<Record<string, unknown>>;
  } | null>(null);
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [settings, setSettings] = useState<Array<Record<string, unknown>>>([]);
  const [smsOutbox, setSmsOutbox] = useState<Array<Record<string, unknown>>>([]);
  const [auditLogs, setAuditLogs] = useState<Array<Record<string, unknown>>>([]);
  const [securityEvents, setSecurityEvents] = useState<Array<Record<string, unknown>>>(
    []
  );

  // Forms
  const [provinceStatusNotes, setProvinceStatusNotes] = useState<
    Record<number, { status: string; reason: string }>
  >({});
  const [newZoneForm, setNewZoneForm] = useState({
    provinceId: 1,
    code: '',
    nameFa: '',
    zoneType: 'urban',
    status: 'active',
    centerLat: '36.2688',
    centerLng: '50.0041',
    radiusKm: '15',
  });
  const [refundForm, setRefundForm] = useState({
    requestId: '',
    amountToman: '',
    reason: '',
  });
  const [newStaffForm, setNewStaffForm] = useState({
    phone: '',
    fullName: '',
    password: '',
    role: 'operator',
  });
  const [newDiscountForm, setNewDiscountForm] = useState({
    code: '',
    titleFa: '',
    percentOff: '10',
    maxDiscountToman: '150000',
  });

  const clearAlerts = () => {
    setFeedback(null);
    setErrorMsg(null);
  };

  const loadTabData = async (tab: AdminTab) => {
    clearAlerts();
    try {
      if (tab === 'reports') {
        const res = await apiFetch<ExecutiveDashboardResponse>(
          '/api/admin/reports/overview'
        );
        setReports(res);
      } else if (tab === 'responders') {
        const res = await apiFetch<{ responders: Array<Record<string, unknown>> }>(
          '/api/admin/responders'
        );
        setResponders(res.responders);
      } else if (tab === 'services') {
        const res = await apiFetch<{
          services: Array<Record<string, unknown>>;
          auditLogs: Array<Record<string, unknown>>;
        }>('/api/catalog/admin/services');
        setServices(res.services);
        setServiceAuditLogs(res.auditLogs);
      } else if (tab === 'tariffs') {
        const res = await apiFetch<{
          rules: Record<string, number>;
          discounts: Array<Record<string, unknown>>;
        }>('/api/pricing/admin/rules');
        setPricingRules(res.rules);
        setDiscounts(res.discounts);
      } else if (tab === 'geography') {
        const [pRes, hRes] = await Promise.all([
          apiFetch<{ readiness: Array<Record<string, unknown>> }>(
            '/api/geography/admin/readiness'
          ),
          apiFetch<{ history: Array<Record<string, unknown>> }>(
            '/api/geography/admin/history'
          ),
        ]);
        setProvinces(pRes.readiness);
        setGeoHistory(hRes.history);
      } else if (tab === 'finance') {
        const res = await apiFetch<{
          report: {
            summary: Record<string, number>;
            recentTransactions: Array<Record<string, unknown>>;
            settlements: Array<Record<string, unknown>>;
          };
        }>('/api/payments/admin/reconciliation');
        setFinanceReport(res.report);
      } else if (tab === 'users') {
        const res = await apiFetch<{ users: Array<Record<string, unknown>> }>(
          '/api/admin/users'
        );
        setUsers(res.users);
      } else if (tab === 'settings_audit') {
        const [setRes, smsRes, audRes] = await Promise.all([
          apiFetch<{ settings: Array<Record<string, unknown>> }>(
            '/api/admin/settings'
          ),
          apiFetch<{ logs: Array<Record<string, unknown>> }>(
            '/api/notifications/admin/outbox'
          ),
          apiFetch<{
            adminAuditLogs: Array<Record<string, unknown>>;
            securityEvents: Array<Record<string, unknown>>;
          }>('/api/admin/audit-logs'),
        ]);
        setSettings(setRes.settings);
        setSmsOutbox(smsRes.logs);
        setAuditLogs(audRes.adminAuditLogs);
        setSecurityEvents(audRes.securityEvents);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در بارگذاری اطلاعات مدیریت');
    }
  };

  useEffect(() => {
    void loadTabData(activeTab);
  }, [activeTab]);

  // Actions
  const handleResponderReview = async (
    responderId: number,
    decision: 'approved' | 'rejected' | 'suspended',
    hasEvCertification: boolean
  ) => {
    clearAlerts();
    try {
      await apiFetch(`/api/admin/responders/${responderId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          hasEvCertification,
          note: `ثبت تصمیم ${decision} توسط مدیر ارشد سامانه`,
        }),
      });
      setFeedback('وضعیت بررسی مدارک و مجوز فعالیت امدادگر به‌روزرسانی و ممیزی شد.');
      await loadTabData('responders');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در بررسی امدادگر');
    }
  };

  const handleToggleService = async (serviceId: number, isPublished: boolean) => {
    clearAlerts();
    try {
      await apiFetch(`/api/catalog/admin/services/${serviceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublished: !isPublished }),
      });
      setFeedback('وضعیت انتشار خدمت به‌روزرسانی و در تاریخچه ممیزی خدمات ثبت شد.');
      await loadTabData('services');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در ویرایش خدمت');
    }
  };

  const handleServicePriceAdjust = async (
    serviceId: number,
    newBasePrice: number
  ) => {
    clearAlerts();
    try {
      await apiFetch(`/api/catalog/admin/services/${serviceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ basePriceToman: newBasePrice }),
      });
      setFeedback('تعرفه پایه خدمت (تومان) بروزرسانی گردید.');
      await loadTabData('services');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در بروزرسانی تعرفه');
    }
  };

  const handleUpdateRules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricingRules) return;
    clearAlerts();
    try {
      await apiFetch('/api/pricing/admin/rules', {
        method: 'PATCH',
        body: JSON.stringify({
          domesticMultiplier: Number(pricingRules.domesticMultiplier),
          foreignMultiplier: Number(pricingRules.foreignMultiplier),
          electricMultiplier: Number(pricingRules.electricMultiplier),
          suvHeavyMultiplier: Number(pricingRules.suvHeavyMultiplier),
          urgentNightMultiplier: Number(pricingRules.urgentNightMultiplier),
          taxRatePercent: Number(pricingRules.taxRatePercent),
          platformCommissionPercent: Number(pricingRules.platformCommissionPercent),
        }),
      });
      setFeedback('ضرایب تعرفه، مالیات و کمیسیون پلتفرم با موفقیت ذخیره شد.');
      await loadTabData('tariffs');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در ذخیره ضرایب تعرفه');
    }
  };

  const handleCreateDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    try {
      await apiFetch('/api/pricing/admin/discounts', {
        method: 'POST',
        body: JSON.stringify({
          code: newDiscountForm.code,
          titleFa: newDiscountForm.titleFa,
          percentOff: Number(newDiscountForm.percentOff),
          maxDiscountToman: Number(newDiscountForm.maxDiscountToman),
        }),
      });
      setNewDiscountForm({
        code: '',
        titleFa: '',
        percentOff: '10',
        maxDiscountToman: '150000',
      });
      setFeedback('کد تخفیف جدید ثبت شد.');
      await loadTabData('tariffs');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در ایجاد کد تخفیف');
    }
  };

  const handleProvinceStatusChange = async (provinceId: number) => {
    clearAlerts();
    const entry = provinceStatusNotes[provinceId];
    if (!entry?.status || !entry?.reason) {
      setErrorMsg('انتخاب وضعیت جدید و درج دلیل ممیزی (حداقل ۵ کاراکتر) الزامی است.');
      return;
    }
    try {
      await apiFetch(`/api/geography/admin/provinces/${provinceId}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status: entry.status,
          reason: entry.reason,
          explicitAdminConfirmation: true,
        }),
      });
      setFeedback(
        'وضعیت عملیاتی استان با تأیید صریح مدیر ارشد تغییر یافت و در تاریخچه جغرافیایی ثبت شد.'
      );
      await loadTabData('geography');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در تغییر وضعیت استان');
    }
  };

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    try {
      await apiFetch('/api/geography/admin/zones', {
        method: 'POST',
        body: JSON.stringify({
          provinceId: Number(newZoneForm.provinceId),
          code: newZoneForm.code,
          nameFa: newZoneForm.nameFa,
          zoneType: newZoneForm.zoneType,
          status: newZoneForm.status,
          centerLat: Number(newZoneForm.centerLat),
          centerLng: Number(newZoneForm.centerLng),
          radiusKm: Number(newZoneForm.radiusKm),
        }),
      });
      setNewZoneForm({
        ...newZoneForm,
        code: '',
        nameFa: '',
      });
      setFeedback('محدوده پوشش خدماتی (زون) جدید با موفقیت ثبت شد.');
      await loadTabData('geography');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در ایجاد زون خدماتی');
    }
  };

  const handleProcessSettlement = async (
    settlementId: number,
    decision: 'approved_paid' | 'rejected'
  ) => {
    clearAlerts();
    try {
      await apiFetch(`/api/payments/admin/settlements/${settlementId}/process`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          bankReferenceCode:
            decision === 'approved_paid' ? `SATNA-${Date.now()}` : undefined,
          note:
            decision === 'approved_paid'
              ? 'واریز پایا/ساتنا انجام و تأیید شد'
              : 'مغایرت شبای بانکی — برگشت مبلغ به کیف پول امدادگر',
        }),
      });
      setFeedback('وضعیت تسویه‌حساب امدادگر ثبت شد.');
      await loadTabData('finance');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در پردازش تسویه');
    }
  };

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    try {
      await apiFetch('/api/payments/admin/refunds', {
        method: 'POST',
        body: JSON.stringify({
          requestId: Number(refundForm.requestId),
          amountToman: Number(refundForm.amountToman),
          reason: refundForm.reason,
        }),
      });
      setRefundForm({ requestId: '', amountToman: '', reason: '' });
      setFeedback('بازپرداخت وجه (Refund) و اصلاح دفترکل مالی ثبت شد.');
      await loadTabData('finance');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در ثبت بازپرداخت');
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(newStaffForm),
      });
      setNewStaffForm({
        phone: '',
        fullName: '',
        password: '',
        role: 'operator',
      });
      setFeedback('حساب کاربری سازمانی (اپراتور / مدیر) ایجاد شد.');
      await loadTabData('users');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در ایجاد کاربر سازمانی');
    }
  };

  const handleToggleUserStatus = async (userId: number, currentActive: boolean) => {
    clearAlerts();
    try {
      await apiFetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !currentActive }),
      });
      setFeedback('وضعیت دسترسی کاربر تغییر یافت و نشست‌های فعال وی بررسی شد.');
      await loadTabData('users');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در تغییر وضعیت کاربر');
    }
  };

  const handleRetrySms = async (smsId: number) => {
    clearAlerts();
    try {
      await apiFetch(`/api/notifications/admin/${smsId}/retry`, {
        method: 'POST',
      });
      setFeedback('تلاش مجدد ارسال پیامک انجام شد.');
      await loadTabData('settings_audit');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در ارسال مجدد پیامک');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="bg-slate-900 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
            پنل مدیریت کلان «اورژانس خودرو» (Super Admin)
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            حاکمیت دسترسی مبتنی بر نقش، مدیریت جغرافیا و فعال‌سازی استان‌ها، ممیزی مالی و
            پیکربندی سامانه
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadTabData(activeTab)}
          className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5"
        >
          <RefreshCw className="w-4 h-4" />
          بروزرسانی داده‌ها
        </button>
      </div>

      {feedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-4 rounded-xl text-xs font-bold">
          {feedback}
        </div>
      )}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-950 p-4 rounded-xl text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {/* نوار تب‌های مدیریت */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'reports', label: 'گزارش‌ها و KPI', icon: BarChart3 },
          { id: 'responders', label: 'تأیید و فعال‌سازی امدادگران', icon: UserCheck },
          { id: 'services', label: 'کاتالوگ خدمات امدادی', icon: Wrench },
          { id: 'tariffs', label: 'ضرایب تعرفه و تخفیف', icon: Settings },
          { id: 'geography', label: 'استان‌ها و زون‌های پوشش', icon: MapPin },
          { id: 'finance', label: 'مالی، بازپرداخت و تسویه', icon: CreditCard },
          { id: 'users', label: 'کاربران و نقش‌ها', icon: Users },
          { id: 'settings_audit', label: 'تنظیمات، پیامک و لاگ ممیزی', icon: FileSearch },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-amber-400 shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ۱. گزارش‌ها */}
      {activeTab === 'reports' && reports && (
        <div className="space-y-6 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { l: 'کل مأموریت‌های ثبت‌شده', v: reports.operational.totalRequests },
              { l: 'مأموریت‌های تکمیل‌شده', v: reports.operational.completedMissionsCount },
              { l: 'مأموریت‌های جاری فعال', v: reports.operational.activeMissionsCount },
              {
                l: 'امدادگران آنلاین آماده',
                v: reports.operational.onlineApprovedRespondersCount,
              },
              {
                l: 'امدادگران در انتظار بررسی مدارک',
                v: reports.operational.pendingResponderReviewsCount,
              },
              {
                l: 'تیکت‌های پشتیبانی باز',
                v: reports.operational.openSupportTicketsCount,
              },
              {
                l: 'وصولی خالص تأییدشده',
                v: formatToman(reports.financial.netCollectedToman || 0),
              },
              {
                l: 'کمیسیون تجمعی پلتفرم',
                v: formatToman(reports.financial.platformCommissionToman || 0),
              },
            ].map((k) => (
              <div
                key={k.l}
                className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1"
              >
                <div className="text-slate-500">{k.l}</div>
                <div className="text-lg font-extrabold text-slate-900">
                  {typeof k.v === 'number' ? k.v.toLocaleString('fa-IR') : k.v}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2.5">
              <h3 className="font-extrabold text-sm text-slate-900">
                وضعیت عملیاتی استان‌ها (فاز اول: قزوین)
              </h3>
              {reports.geographyReadiness.map((p) => (
                <div
                  key={p.provinceId}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                >
                  <span className="font-bold text-slate-800">{p.nameFa}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">
                      {p.activeZonesCount.toLocaleString('fa-IR')} زون فعال |{' '}
                      {p.approvedRespondersCount.toLocaleString('fa-IR')} امدادگر تأییدشده
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        p.status === 'active'
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {p.statusLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2.5">
              <h3 className="font-extrabold text-sm text-slate-900">
                توزیع وضعیت مأموریت‌ها
              </h3>
              {reports.operational.byStatus.length === 0 ? (
                <p className="text-slate-500">هنوز مأموریتی ثبت نشده است.</p>
              ) : (
                reports.operational.byStatus.map((s) => (
                  <div
                    key={s.status}
                    className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                  >
                    <span className="font-mono font-bold">{s.status}</span>
                    <span className="font-extrabold">
                      {Number(s.cnt).toLocaleString('fa-IR')} مورد
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ۲. بررسی و فعال‌سازی امدادگران */}
      {activeTab === 'responders' && (
        <div className="space-y-3 text-xs">
          {responders.map((r) => {
            const id = Number(r.id);
            const evCert = Number(r.has_ev_certification) === 1;
            const docs = (r.documents as Array<Record<string, unknown>>) || [];
            return (
              <div
                key={id}
                className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="font-extrabold text-sm text-slate-900">
                    {String(r.full_name)} ({String(r.phone)})
                  </div>
                  <div className="text-slate-600">
                    ناوگان: <strong>{String(r.equipment_type)}</strong> | پلاک:{' '}
                    <strong>{String(r.vehicle_plate || 'ثبت نشده')}</strong> | مدارک ارسالی:{' '}
                    <strong>{docs.length.toLocaleString('fa-IR')} فقره</strong>
                  </div>
                  <div className="text-slate-600">
                    وضعیت احراز مدارک: <strong>{String(r.verification_status)}</strong> |
                    گواهی خودروی برقی (EV): <strong>{evCert ? 'دارد' : 'ندارد'}</strong>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void handleResponderReview(id, 'approved', evCert)
                    }
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3.5 py-2 rounded-xl"
                  >
                    تأیید مدارک و فعال‌سازی عملیاتی
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleResponderReview(id, 'approved', !evCert)
                    }
                    className="bg-indigo-100 hover:bg-indigo-200 text-indigo-950 font-bold px-3 py-2 rounded-xl"
                  >
                    {evCert ? 'لغو گواهی EV' : 'تأیید + اعطای گواهی EV'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleResponderReview(id, 'suspended', evCert)
                    }
                    className="bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold px-3 py-2 rounded-xl"
                  >
                    تعلیق امدادگر
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ۳. مدیریت کاتالوگ خدمات */}
      {activeTab === 'services' && (
        <div className="space-y-4 text-xs">
          <div className="space-y-3">
            {services.map((s) => {
              const id = Number(s.id);
              const published = Boolean(s.isPublished);
              const basePrice = Number(s.basePriceToman);
              return (
                <div
                  key={id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="font-extrabold text-sm text-slate-900">
                      {String(s.titleFa)}{' '}
                      <span className="font-mono text-xs text-slate-400">
                        ({String(s.slug)})
                      </span>
                    </div>
                    <div className="text-slate-600">
                      نرخ پایه فعلی: <strong>{formatToman(basePrice)}</strong> | هر کیلومتر
                      اعزام: <strong>{formatToman(Number(s.perKmDispatchToman))}</strong> |
                      جریمه لغو در مسیر:{' '}
                      <strong>{formatToman(Number(s.enrouteCancelFeeToman))}</strong>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void handleServicePriceAdjust(id, basePrice + 50000)
                      }
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-1.5 rounded-lg"
                    >
                      +۵۰ هزار تومان به نرخ پایه
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleService(id, published)}
                      className={`px-3.5 py-1.5 rounded-lg font-extrabold ${
                        published
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-rose-100 text-rose-900'
                      }`}
                    >
                      {published
                        ? 'منتشرشده (کلیک جهت توقف ارائه)'
                        : 'متوقف (کلیک جهت انتشار مجدد)'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {serviceAuditLogs.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
              <h3 className="font-extrabold text-sm text-slate-900">
                سابقه ممیزی تغییرات کاتالوگ خدمات
              </h3>
              {serviceAuditLogs.slice(0, 15).map((log) => (
                <div
                  key={Number(log.id)}
                  className="py-1.5 border-b border-slate-100 last:border-0 flex justify-between"
                >
                  <span>
                    {String(log.change_type)} روی خدمت #{String(log.service_id)}
                  </span>
                  <span className="text-slate-500">
                    {formatDateTimeFa(String(log.created_at))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ۴. ضرایب تعرفه و کدهای تخفیف */}
      {activeTab === 'tariffs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          {pricingRules && (
            <form
              onSubmit={handleUpdateRules}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 h-fit"
            >
              <h3 className="font-extrabold text-sm text-slate-900">
                قوانین و ضرایب قیمت‌گذاری سراسری (واحد پایه: تومان)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { k: 'domesticMultiplier', l: 'ضریب خودروی داخلی' },
                  { k: 'foreignMultiplier', l: 'ضریب خودروی خارجی' },
                  { k: 'electricMultiplier', l: 'ضریب خودروی برقی (EV)' },
                  { k: 'suvHeavyMultiplier', l: 'ضریب شاسی‌بلند سنگین' },
                  { k: 'urgentNightMultiplier', l: 'ضریب شبانه / اضطراری' },
                  { k: 'taxRatePercent', l: 'مالیات بر ارزش افزوده (%)' },
                  { k: 'platformCommissionPercent', l: 'کمیسیون پلتفرم (%)' },
                ].map((item) => (
                  <div key={item.k}>
                    <label className="font-bold block mb-1">{item.l}</label>
                    <input
                      type="number"
                      step="0.05"
                      value={pricingRules[item.k] ?? ''}
                      onChange={(e) =>
                        setPricingRules({
                          ...pricingRules,
                          [item.k]: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono"
                    />
                  </div>
                ))}
              </div>
              <button
                type="submit"
                className="bg-slate-900 text-white font-extrabold px-5 py-2.5 rounded-xl"
              >
                ذخیره ضرایب تعرفه
              </button>
            </form>
          )}

          <div className="space-y-4">
            <form
              onSubmit={handleCreateDiscount}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"
            >
              <h3 className="font-extrabold text-sm text-slate-900">
                تعریف کد تخفیف جدید
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  placeholder="کد لاتین (مثال: BAHAR1405)"
                  value={newDiscountForm.code}
                  onChange={(e) =>
                    setNewDiscountForm({
                      ...newDiscountForm,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  className="rounded-xl border border-slate-300 px-3 py-2 font-mono"
                />
                <input
                  type="text"
                  required
                  placeholder="عنوان فارسی کمپین"
                  value={newDiscountForm.titleFa}
                  onChange={(e) =>
                    setNewDiscountForm({
                      ...newDiscountForm,
                      titleFa: e.target.value,
                    })
                  }
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
                <input
                  type="number"
                  required
                  placeholder="درصد تخفیف (%)"
                  value={newDiscountForm.percentOff}
                  onChange={(e) =>
                    setNewDiscountForm({
                      ...newDiscountForm,
                      percentOff: e.target.value,
                    })
                  }
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
                <input
                  type="number"
                  required
                  placeholder="سقف تخفیف (تومان)"
                  value={newDiscountForm.maxDiscountToman}
                  onChange={(e) =>
                    setNewDiscountForm({
                      ...newDiscountForm,
                      maxDiscountToman: e.target.value,
                    })
                  }
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <button
                type="submit"
                className="bg-amber-500 text-slate-950 font-extrabold px-4 py-2 rounded-xl"
              >
                ثبت کد تخفیف
              </button>
            </form>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
              <h3 className="font-extrabold text-sm text-slate-900">
                کدهای تخفیف فعال و ثبت‌شده
              </h3>
              {discounts.map((d) => (
                <div
                  key={Number(d.id)}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                >
                  <div>
                    <span className="font-mono font-bold text-slate-900">
                      {String(d.code)}
                    </span>{' '}
                    — {String(d.title_fa)}
                  </div>
                  <span className="text-slate-600">
                    مصرف‌شده: {String(d.used_count)} از {String(d.usage_limit)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ۵. مدیریت مناطق جغرافیایی و فعال‌سازی استان جدید */}
      {activeTab === 'geography' && (
        <div className="space-y-6 text-xs">
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-amber-950 leading-relaxed">
            <strong>قاعده حاکمیت جغرافیایی سامانه:</strong> وجود رکورد استان در پایگاه‌داده
            به معنی فعال بودن آن نیست. فعال‌سازی عملیاتی هر استان جدید (`active`) صرفاً پس از
            ایجاد حداقل یک زون فعال، تأمین حداقل ظرفیت امدادگر تأییدشده و ثبت تأیید صریح مدیر
            ارشد به همراه دلیل ممیزی امکان‌پذیر است. غیرفعال‌سازی یک استان، هیچ رکورد تاریخی
            مأموریت را حذف نمی‌کند.
          </div>

          <div className="space-y-3">
            {provinces.map((p) => {
              const pid = Number(p.provinceId);
              const noteState = provinceStatusNotes[pid] || {
                status: String(p.status),
                reason: '',
              };

              return (
                <div
                  key={pid}
                  className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-extrabold text-sm text-slate-900">
                        {String(p.nameFa)} ({String(p.slug)})
                      </span>
                      <span
                        className={`mr-2 px-2.5 py-0.5 rounded-full font-bold ${
                          p.status === 'active'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {String(p.statusLabel)}
                      </span>
                    </div>
                    <div className="text-slate-600">
                      زون‌های فعال: <strong>{String(p.activeZonesCount)}</strong> | ناوگان
                      تأییدشده: <strong>{String(p.approvedRespondersCount)}</strong> (حداقل
                      لازم: {String(p.minRequiredResponders)})
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    <select
                      value={noteState.status}
                      onChange={(e) =>
                        setProvinceStatusNotes({
                          ...provinceStatusNotes,
                          [pid]: { ...noteState, status: e.target.value },
                        })
                      }
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold"
                    >
                      <option value="active">فعال عملیاتی (active)</option>
                      <option value="preparing">در حال آماده‌سازی (preparing)</option>
                      <option value="pending_approval">
                        در انتظار تأیید (pending_approval)
                      </option>
                      <option value="temporarily_suspended">
                        تعلیق موقت (temporarily_suspended)
                      </option>
                      <option value="inactive">غیرفعال (inactive)</option>
                    </select>
                    <input
                      type="text"
                      placeholder="دلیل ممیزی تغییر وضعیت استان (حداقل ۵ کاراکتر)..."
                      value={noteState.reason}
                      onChange={(e) =>
                        setProvinceStatusNotes({
                          ...provinceStatusNotes,
                          [pid]: { ...noteState, reason: e.target.value },
                        })
                      }
                      className="flex-1 min-w-[220px] rounded-xl border border-slate-300 px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={() => void handleProvinceStatusChange(pid)}
                      className="bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white font-extrabold px-4 py-2 rounded-xl transition"
                    >
                      ثبت مصوبه وضعیت استان
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* فرم افزودن زون جدید */}
          <form
            onSubmit={handleCreateZone}
            className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"
          >
            <h3 className="font-extrabold text-sm text-slate-900">
              افزودن محدوده پوشش خدماتی (زون جدید برای توسعه شهرها و استان‌ها)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <select
                value={newZoneForm.provinceId}
                onChange={(e) =>
                  setNewZoneForm({
                    ...newZoneForm,
                    provinceId: Number(e.target.value),
                  })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              >
                {provinces.map((p) => (
                  <option key={Number(p.provinceId)} value={Number(p.provinceId)}>
                    {String(p.nameFa)}
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="کد زون (مثال: QZV-NORTH)"
                value={newZoneForm.code}
                onChange={(e) =>
                  setNewZoneForm({
                    ...newZoneForm,
                    code: e.target.value.toUpperCase(),
                  })
                }
                className="rounded-xl border border-slate-300 px-3 py-2 font-mono"
              />
              <input
                type="text"
                required
                placeholder="نام فارسی محدوده"
                value={newZoneForm.nameFa}
                onChange={(e) =>
                  setNewZoneForm({ ...newZoneForm, nameFa: e.target.value })
                }
                className="rounded-xl border border-slate-300 px-3 py-2"
              />
              <input
                type="number"
                step="0.0001"
                placeholder="عرض جغرافیایی مرکز"
                value={newZoneForm.centerLat}
                onChange={(e) =>
                  setNewZoneForm({ ...newZoneForm, centerLat: e.target.value })
                }
                className="rounded-xl border border-slate-300 px-3 py-2 font-mono"
              />
              <input
                type="number"
                step="0.0001"
                placeholder="طول جغرافیایی مرکز"
                value={newZoneForm.centerLng}
                onChange={(e) =>
                  setNewZoneForm({ ...newZoneForm, centerLng: e.target.value })
                }
                className="rounded-xl border border-slate-300 px-3 py-2 font-mono"
              />
              <button
                type="submit"
                className="bg-amber-500 text-slate-950 font-extrabold px-4 py-2 rounded-xl"
              >
                ثبت زون پوشش
              </button>
            </div>
          </form>

          {/* تاریخچه تغییرات جغرافیایی */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
            <h3 className="font-extrabold text-sm text-slate-900">
              تاریخچه ممیزی تغییر وضعیت استان‌ها و مناطق
            </h3>
            {geoHistory.length === 0 ? (
              <p className="text-slate-500">تغییر وضعیتی ثبت نشده است.</p>
            ) : (
              geoHistory.map((h) => (
                <div
                  key={Number(h.id)}
                  className="py-2 border-b border-slate-100 last:border-0 flex flex-wrap justify-between gap-2"
                >
                  <span>
                    {String(h.entity_type)} #{String(h.entity_id)}: از{' '}
                    <strong>{String(h.previous_status || '—')}</strong> به{' '}
                    <strong>{String(h.new_status)}</strong> — دلیل: {String(h.reason)}
                  </span>
                  <span className="text-slate-500">
                    {formatDateTimeFa(String(h.created_at))}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ۶. مدیریت مالی، بازپرداخت و تسویه امدادگران */}
      {activeTab === 'finance' && financeReport && (
        <div className="space-y-6 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-slate-500">درآمد ناخالص تأییدشده</div>
              <div className="text-lg font-extrabold text-slate-900 mt-1">
                {formatToman(financeReport.summary.grossVerifiedToman || 0)}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-slate-500">مجموع بازپرداخت‌ها (Refund)</div>
              <div className="text-lg font-extrabold text-rose-700 mt-1">
                {formatToman(financeReport.summary.totalRefundedToman || 0)}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-slate-500">کمیسیون پلتفرم</div>
              <div className="text-lg font-extrabold text-emerald-700 mt-1">
                {formatToman(financeReport.summary.platformCommissionToman || 0)}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-slate-500">تسویه‌های در انتظار پرداخت شبا</div>
              <div className="text-lg font-extrabold text-amber-700 mt-1">
                {formatToman(financeReport.summary.settlementsPendingToman || 0)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* فرم بازپرداخت */}
            <form
              onSubmit={handleRefund}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 h-fit"
            >
              <h3 className="font-extrabold text-sm text-slate-900">
                ثبت بازپرداخت وجه (Refund کامل یا جزئی با اصلاح خودکار دفترکل)
              </h3>
              <input
                type="number"
                required
                placeholder="شناسه عددی مأموریت (Request ID)"
                value={refundForm.requestId}
                onChange={(e) =>
                  setRefundForm({ ...refundForm, requestId: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <input
                type="number"
                required
                placeholder="مبلغ بازپرداخت (تومان)"
                value={refundForm.amountToman}
                onChange={(e) =>
                  setRefundForm({ ...refundForm, amountToman: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <input
                type="text"
                required
                placeholder="دلیل قانونی/عملیاتی بازپرداخت (حداقل ۵ کاراکتر)"
                value={refundForm.reason}
                onChange={(e) =>
                  setRefundForm({ ...refundForm, reason: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <button
                type="submit"
                className="bg-rose-600 text-white font-extrabold px-4 py-2 rounded-xl"
              >
                اجرای بازپرداخت و ثبت سند برگشتی
              </button>
            </form>

            {/* لیست درخواست‌های تسویه شبا */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <h3 className="font-extrabold text-sm text-slate-900">
                صف درخواست‌های تسویه شبای امدادگران
              </h3>
              {financeReport.settlements.length === 0 ? (
                <p className="text-slate-500">درخواست تسویه‌ای ثبت نشده است.</p>
              ) : (
                financeReport.settlements.map((s) => (
                  <div
                    key={Number(s.id)}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                  >
                    <div className="flex justify-between font-bold">
                      <span>
                        {String(s.responder_name)} ({formatToman(Number(s.amount_toman))})
                      </span>
                      <span>{String(s.status)}</span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">
                      شبا: {String(s.sheba_number)}
                    </div>
                    {s.status === 'requested' && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void handleProcessSettlement(Number(s.id), 'approved_paid')
                          }
                          className="bg-emerald-600 text-white font-bold px-3 py-1 rounded-lg"
                        >
                          تأیید واریز پایا
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleProcessSettlement(Number(s.id), 'rejected')
                          }
                          className="bg-rose-600 text-white font-bold px-3 py-1 rounded-lg"
                        >
                          رد و برگشت به کیف پول
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ۷. مدیریت کاربران و نقش‌ها */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
          <form
            onSubmit={handleCreateStaff}
            className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 space-y-3 h-fit"
          >
            <h3 className="font-extrabold text-sm text-slate-900">
              ایجاد حساب سازمانی (اپراتور / مدیر)
            </h3>
            <input
              type="text"
              required
              placeholder="نام و نام خانوادگی"
              value={newStaffForm.fullName}
              onChange={(e) =>
                setNewStaffForm({ ...newStaffForm, fullName: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
            <input
              type="tel"
              required
              placeholder="موبایل (09...)"
              value={newStaffForm.phone}
              onChange={(e) =>
                setNewStaffForm({ ...newStaffForm, phone: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
            <input
              type="password"
              required
              placeholder="رمز عبور قوی (حداقل ۸ کاراکتر)"
              value={newStaffForm.password}
              onChange={(e) =>
                setNewStaffForm({ ...newStaffForm, password: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
            <select
              value={newStaffForm.role}
              onChange={(e) =>
                setNewStaffForm({ ...newStaffForm, role: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
            >
              <option value="operator">اپراتور پشتیبانی و دیسپچ (operator)</option>
              <option value="admin">مدیر ارشد سامانه (admin)</option>
            </select>
            <button
              type="submit"
              className="w-full bg-slate-900 text-white font-extrabold py-2.5 rounded-xl"
            >
              ایجاد کاربر سازمانی
            </button>
          </form>

          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
            <h3 className="font-extrabold text-sm text-slate-900">
              فهرست کاربران سامانه ({users.length.toLocaleString('fa-IR')})
            </h3>
            {users.map((u) => {
              const uid = Number(u.id);
              const active = Number(u.is_active) === 1;
              return (
                <div
                  key={uid}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 border-b border-slate-100 last:border-0"
                >
                  <div>
                    <span className="font-bold text-slate-900">
                      {String(u.full_name)}
                    </span>{' '}
                    <span className="font-mono text-slate-500">({String(u.phone)})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-100 px-2.5 py-0.5 rounded font-bold">
                      {String(u.role)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleToggleUserStatus(uid, active)}
                      className={`px-2.5 py-0.5 rounded font-bold ${
                        active
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-rose-100 text-rose-900'
                      }`}
                    >
                      {active ? 'فعال (کلیک جهت انسداد)' : 'مسدود (کلیک جهت بازگشایی)'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ۸. تنظیمات، صندوق پیامک و لاگ ممیزی */}
      {activeTab === 'settings_audit' && (
        <div className="space-y-6 text-xs">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2.5">
              <h3 className="font-extrabold text-sm text-slate-900">
                تنظیمات عملیاتی سامانه
              </h3>
              {settings.map((s) => (
                <div
                  key={String(s.key)}
                  className="py-2 border-b border-slate-100 last:border-0 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-slate-800">
                      {String(s.descriptionFa)}
                    </div>
                    <div className="font-mono text-[11px] text-slate-400">
                      {String(s.key)}
                    </div>
                  </div>
                  <span className="font-mono font-bold bg-slate-100 px-2.5 py-1 rounded">
                    {JSON.stringify(s.value)}
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2.5">
              <h3 className="font-extrabold text-sm text-slate-900">
                صندوق خروجی اعلان و پیامک (شفافیت ارسال واقعی / آزمایشی)
              </h3>
              <div className="max-h-72 overflow-y-auto space-y-2">
                {smsOutbox.map((sms) => (
                  <div
                    key={Number(sms.id)}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1"
                  >
                    <div className="flex justify-between font-bold">
                      <span>{String(sms.title || sms.event_type)}</span>
                      <span className="text-amber-800">
                        {String(sms.delivery_status || sms.status)}
                      </span>
                    </div>
                    <p className="text-slate-700">{String(sms.body)}</p>
                    {sms.delivery_status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => void handleRetrySms(Number(sms.id))}
                        className="bg-slate-900 text-white px-2.5 py-1 rounded font-bold"
                      >
                        تلاش مجدد ارسال پیامک
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2.5">
            <h3 className="font-extrabold text-sm text-slate-900">
              لاگ‌های ممیزی مدیریتی ({auditLogs.length.toLocaleString('fa-IR')}) و رخدادهای
              امنیتی ({securityEvents.length.toLocaleString('fa-IR')})
            </h3>
            <div className="max-h-80 overflow-y-auto space-y-1.5">
              {auditLogs.map((log) => (
                <div
                  key={Number(log.id)}
                  className="py-2 border-b border-slate-100 last:border-0 flex flex-wrap justify-between gap-2"
                >
                  <div>
                    <span className="font-mono font-bold text-slate-900">
                      {String(log.action)}
                    </span>{' '}
                    — {String(log.summary || `${log.entity_type} #${log.entity_id || '—'}`)}
                  </div>
                  <div className="text-slate-500">
                    {String(log.actor_name || 'سیستم')} ({String(log.actor_role || '—')}) |{' '}
                    {formatDateTimeFa(String(log.created_at))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
