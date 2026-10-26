import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import {
  GEOGRAPHY_STATUSES,
  GEOGRAPHY_STATUS_LABELS,
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  type GeographyStatus,
  type ServiceCategory,
} from '../../shared/constants.ts';

type AdminTab =
  | 'reports'
  | 'responders'
  | 'services'
  | 'tariffs'
  | 'geography'
  | 'finance'
  | 'users'
  | 'settings_audit';

interface SettlementReviewDraft {
  bankReferenceCode: string;
  note: string;
  externalTransferConfirmed: boolean;
}

const EMPTY_SETTLEMENT_REVIEW_DRAFT: SettlementReviewDraft = {
  bankReferenceCode: '',
  note: '',
  externalTransferConfirmed: false,
};

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
  financialGateway: {
    providerName: string;
    isSandbox: boolean;
    connectionVerified: boolean;
    noticeFa: string;
  };
  financialSandbox: Record<string, number>;
  financialExcludedUnverified: Record<string, number>;
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

const SECTION_TO_TAB: Record<string, AdminTab> = {
  reports: 'reports',
  responders: 'responders',
  services: 'services',
  tariffs: 'tariffs',
  geography: 'geography',
  finance: 'finance',
  users: 'users',
  settings: 'settings_audit',
  settings_audit: 'settings_audit',
};

export function AdminPanelPage() {
  const { section } = useParams();
  const navigate = useNavigate();
  const resolvedTab: AdminTab =
    (section && SECTION_TO_TAB[section]) || 'reports';
  const [activeTab, setActiveTab] = useState<AdminTab>(resolvedTab);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const next = (section && SECTION_TO_TAB[section]) || 'reports';
    if (next !== activeTab) {
      setActiveTab(next);
    }
  }, [section]);

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
    gateway: {
      providerName: string;
      isSandbox: boolean;
      connectionVerified: boolean;
      noticeFa: string;
    };
    summary: Record<string, number>;
    sandbox: Record<string, number>;
    excludedUnverified: Record<string, number>;
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
  const [settlementDrafts, setSettlementDrafts] = useState<
    Record<number, SettlementReviewDraft>
  >({});
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
  const [newServiceForm, setNewServiceForm] = useState({
    slug: '',
    titleFa: '',
    category: 'diagnostics_repair' as ServiceCategory,
    basePriceToman: '450000',
    perKmDispatchToman: '18000',
    enrouteCancelFeeToman: '120000',
    descriptionFa: '',
  });
  const [settingDrafts, setSettingDrafts] = useState<Record<string, string>>({});

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
            gateway: {
              providerName: string;
              isSandbox: boolean;
              connectionVerified: boolean;
              noticeFa: string;
            };
            summary: Record<string, number>;
            sandbox: Record<string, number>;
            excludedUnverified: Record<string, number>;
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

  const updateSettlementDraft = (
    settlementId: number,
    patch: Partial<SettlementReviewDraft>
  ) => {
    setSettlementDrafts((current) => ({
      ...current,
      [settlementId]: {
        ...EMPTY_SETTLEMENT_REVIEW_DRAFT,
        ...current[settlementId],
        ...patch,
      },
    }));
  };

  const handleProcessSettlement = async (
    settlementId: number,
    decision: 'approved_paid' | 'rejected'
  ) => {
    clearAlerts();
    const draft = settlementDrafts[settlementId] ?? EMPTY_SETTLEMENT_REVIEW_DRAFT;
    const settlement = financeReport?.settlements.find(
      (item) => Number(item.id) === settlementId
    );
    const isSandbox = settlement?.execution_mode === 'sandbox_simulated';

    if (decision === 'approved_paid' && !isSandbox) {
      if (draft.bankReferenceCode.trim().length < 4) {
        setErrorMsg('شناسه مرجع را از رسید واقعی وارد کنید؛ سامانه آن را با بانک تطبیق نمی‌دهد.');
        return;
      }
      if (draft.note.trim().length < 5 || !draft.externalTransferConfirmed) {
        setErrorMsg('یادداشت ممیزی و تأیید مشاهده رسید واقعی بانکی الزامی است.');
        return;
      }
    }
    if (decision === 'rejected' && draft.note.trim().length < 5) {
      setErrorMsg('برای رد درخواست، دلیل واقعی حداقل ۵ کاراکتری وارد کنید.');
      return;
    }

    try {
      const response = await apiFetch<{
        result: { simulationOnly: boolean; bankTransferVerifiedByProvider: boolean };
      }>(`/api/payments/admin/settlements/${settlementId}/process`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          bankReferenceCode:
            decision === 'approved_paid' && !isSandbox
              ? draft.bankReferenceCode.trim()
              : undefined,
          note: draft.note.trim() || undefined,
          externalTransferConfirmed:
            decision === 'approved_paid' && !isSandbox
              ? draft.externalTransferConfirmed
              : undefined,
        }),
      });
      setSettlementDrafts((current) => {
        const next = { ...current };
        delete next[settlementId];
        return next;
      });
      setFeedback(
        response.result.simulationOnly
          ? 'فقط شبیه‌سازی Sandbox ثبت شد؛ هیچ وجه واقعی جابه‌جا نشده است.'
          : decision === 'approved_paid'
            ? 'ثبت دستی بر پایه تأیید مدیر انجام شد؛ سامانه انتقال یا استعلام بانکی خودکار انجام نداده است.'
            : 'رد درخواست و برگشت مبلغ به کیف پول ثبت شد.'
      );
      await loadTabData('finance');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در پردازش تسویه');
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
      const response = await apiFetch<{
        result: { acceptedByProvider: boolean; simulationOnly: boolean };
      }>(`/api/notifications/admin/${smsId}/retry`, { method: 'POST' });
      setFeedback(
        response.result.acceptedByProvider
          ? 'درخواست پیامک توسط API ارائه‌دهنده پذیرفته شد؛ تحویل به گوشی تأیید نشده است.'
          : response.result.simulationOnly
            ? 'فقط در صندوق Sandbox ثبت شد؛ پیامک واقعی ارسال نشده است.'
            : 'پذیرش پیامک توسط ارائه‌دهنده تأیید نشد.'
      );
      await loadTabData('settings_audit');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'پذیرش مجدد پیامک تأیید نشد');
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    try {
      await apiFetch('/api/catalog/admin/services', {
        method: 'POST',
        body: JSON.stringify({
          slug: newServiceForm.slug.trim().toLowerCase(),
          titleFa: newServiceForm.titleFa.trim(),
          category: newServiceForm.category,
          descriptionFa:
            newServiceForm.descriptionFa.trim() ||
            `ارائه تخصصی خدمت ${newServiceForm.titleFa.trim()} توسط ناوگان تأییدشده`,
          termsFa: 'لغو پیش از حرکت امدادگر رایگان و پس از حرکت مشمول هزینه ایاب‌وذهاب مصوب است.',
          basePriceToman: Number(newServiceForm.basePriceToman),
          perKmDispatchToman: Number(newServiceForm.perKmDispatchToman),
          enrouteCancelFeeToman: Number(newServiceForm.enrouteCancelFeeToman),
        }),
      });
      setNewServiceForm({
        slug: '',
        titleFa: '',
        category: 'diagnostics_repair',
        basePriceToman: '450000',
        perKmDispatchToman: '18000',
        enrouteCancelFeeToman: '120000',
        descriptionFa: '',
      });
      setFeedback('خدمت امدادی جدید به کاتالوگ اضافه شد و در لاگ ممیزی ثبت گردید.');
      await loadTabData('services');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در ایجاد خدمت جدید');
    }
  };

  const handleZoneStatusToggle = async (
    zoneId: number,
    nextStatus: GeographyStatus
  ) => {
    clearAlerts();
    try {
      await apiFetch(`/api/geography/admin/zones/${zoneId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
          reason: `تغییر وضعیت زون به ${nextStatus} توسط مدیر ارشد در پنل مدیریت`,
        }),
      });
      setFeedback('وضعیت عملیاتی زون پوشش به‌روزرسانی و ممیزی شد.');
      await loadTabData('geography');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در تغییر وضعیت زون');
    }
  };

  const handleSaveSetting = async (key: string, rawDraft: string) => {
    clearAlerts();
    try {
      let parsedValue: unknown = rawDraft;
      try {
        parsedValue = JSON.parse(rawDraft);
      } catch {
        parsedValue = rawDraft;
      }
      await apiFetch(`/api/admin/settings/${encodeURIComponent(key)}`, {
        method: 'PUT',
        body: JSON.stringify({ value: parsedValue }),
      });
      setFeedback(`تنظیم سیستمی «${key}» ذخیره و در لاگ ممیزی ثبت شد.`);
      await loadTabData('settings_audit');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در ذخیره تنظیمات');
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
              onClick={() => {
                setActiveTab(tab.id as AdminTab);
                const slug = tab.id === 'settings_audit' ? 'settings' : tab.id;
                navigate(slug === 'reports' ? '/admin' : `/admin/${slug}`);
              }}
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
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 space-y-1">
            <div className="font-extrabold">مبنای گزارش مالی</div>
            <p>
              جمع‌های اصلی فقط پرداخت‌های غیر-Sandbox با پاسخ تأیید سرور را شامل می‌شوند؛ بازپرداخت‌های تأییدنشده و داده‌های آزمایشی از آن‌ها جدا هستند. تسویه‌های دستی صرفاً تأیید مدیرند و استعلام بانکی خودکار ندارند.
            </p>
            <p>{reports.financialGateway.noticeFa}</p>
            <p>
              Sandbox جداگانه: {formatToman(reports.financialSandbox.grossPaymentsToman || 0)} پرداخت شبیه‌سازی‌شده؛ وجه واقعی محسوب نمی‌شود.
            </p>
          </div>
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
          <form
            onSubmit={handleCreateService}
            className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"
          >
            <h3 className="font-extrabold text-sm text-slate-900">
              افزودن خدمت جدید به کاتالوگ امداد خودرو
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <input
                type="text"
                required
                placeholder="شناسه لاتین (slug)"
                value={newServiceForm.slug}
                onChange={(e) =>
                  setNewServiceForm({ ...newServiceForm, slug: e.target.value })
                }
                className="rounded-xl border border-slate-300 px-3 py-2 font-mono"
              />
              <input
                type="text"
                required
                placeholder="عنوان فارسی خدمت"
                value={newServiceForm.titleFa}
                onChange={(e) =>
                  setNewServiceForm({ ...newServiceForm, titleFa: e.target.value })
                }
                className="rounded-xl border border-slate-300 px-3 py-2"
              />
              <select
                value={newServiceForm.category}
                onChange={(e) =>
                  setNewServiceForm({
                    ...newServiceForm,
                    category: e.target.value as ServiceCategory,
                  })
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              >
                {SERVICE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {SERVICE_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                required
                placeholder="نرخ پایه (تومان)"
                value={newServiceForm.basePriceToman}
                onChange={(e) =>
                  setNewServiceForm({
                    ...newServiceForm,
                    basePriceToman: e.target.value,
                  })
                }
                className="rounded-xl border border-slate-300 px-3 py-2 font-mono"
              />
              <input
                type="number"
                required
                placeholder="هر کیلومتر اعزام (تومان)"
                value={newServiceForm.perKmDispatchToman}
                onChange={(e) =>
                  setNewServiceForm({
                    ...newServiceForm,
                    perKmDispatchToman: e.target.value,
                  })
                }
                className="rounded-xl border border-slate-300 px-3 py-2 font-mono"
              />
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl"
              >
                ایجاد خدمت جدید
              </button>
            </div>
          </form>

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
                      {GEOGRAPHY_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {GEOGRAPHY_STATUS_LABELS[st]} ({st})
                        </option>
                      ))}
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

                  {Array.isArray(p.zones) && p.zones.length > 0 && (
                    <div className="pt-3 border-t border-slate-100 space-y-1.5">
                      <div className="font-bold text-slate-700">
                        زون‌های خدماتی تعریف‌شده در این استان:
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {(p.zones as Array<Record<string, unknown>>).map((z) => {
                          const zid = Number(z.zoneId);
                          const isZoneActive = z.status === 'active';
                          return (
                            <div
                              key={zid}
                              className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2"
                            >
                              <div>
                                <div className="font-bold text-slate-900">
                                  {String(z.nameFa)}{' '}
                                  <span className="font-mono text-[11px] text-slate-500">
                                    ({String(z.code)})
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  آمادگی ناوگان: {String(z.approvedResponders)}/
                                  {String(z.targetCapacity)} ({String(z.readinessPercent)}%)
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleZoneStatusToggle(
                                    zid,
                                    isZoneActive ? 'inactive' : 'active'
                                  )
                                }
                                className={`px-2.5 py-1 rounded-lg font-bold ${
                                  isZoneActive
                                    ? 'bg-emerald-100 text-emerald-900'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {isZoneActive
                                  ? 'فعال (غیرفعال‌سازی)'
                                  : `${String(z.statusLabel)} (فعال‌سازی)`}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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

      {/* ۶. گزارش مالی، بازپرداختِ مسدود تا اتصال واقعی، و تسویه دستی شفاف */}
      {activeTab === 'finance' && financeReport && (
        <div className="space-y-6 text-xs">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 space-y-1.5">
            <div className="font-extrabold">مبنای گزارش و محدودیت‌های مالی</div>
            <p>
              جمع اصلی فقط پرداخت‌های غیر-Sandbox با پاسخ تأیید سمت سرور را دربرمی‌گیرد. بازپرداخت فقط با مدرک تأیید provider شمرده می‌شود؛ تسویه دستی، صرفاً ثبت مدیر پس از مشاهده رسید است و اتصال یا استعلام بانکی خودکار ندارد.
            </p>
            <p>{financeReport.gateway.noticeFa}</p>
            <p>
              بازپرداخت در این نسخه غیرفعال است: تا پیاده‌سازی و آزمون اتصال واقعی، هیچ فاکتور، وضعیت پرداخت یا دفترکلی با درخواست بازپرداخت تغییر نمی‌کند.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-slate-500">پرداخت‌های غیر-Sandbox تأییدشده</div>
              <div className="text-lg font-extrabold text-slate-900 mt-1">
                {formatToman(financeReport.summary.grossVerifiedToman || 0)}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-slate-500">بازپرداخت‌های تأییدشده توسط provider</div>
              <div className="text-lg font-extrabold text-rose-700 mt-1">
                {formatToman(financeReport.summary.totalRefundedToman || 0)}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-slate-500">کمیسیون فاکتورهای پرداخت غیر-Sandbox</div>
              <div className="text-lg font-extrabold text-emerald-700 mt-1">
                {formatToman(financeReport.summary.platformCommissionToman || 0)}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-slate-500">تسویه‌های ثبت‌شده با تأیید دستی مدیر</div>
              <div className="text-lg font-extrabold text-slate-900 mt-1">
                {formatToman(financeReport.summary.settlementsPaidToman || 0)}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-slate-500">درخواست‌های دستی در انتظار رسیدگی</div>
              <div className="text-lg font-extrabold text-amber-700 mt-1">
                {formatToman(financeReport.summary.settlementsPendingToman || 0)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-300 bg-indigo-50 p-4 text-indigo-950 space-y-1.5">
            <h3 className="font-extrabold text-sm">خلاصهٔ Sandbox — جدا از جمع واقعی</h3>
            <p>
              پرداخت شبیه‌سازی‌شده: {formatToman(financeReport.sandbox.grossPaymentsToman || 0)}
              {' '}({Number(financeReport.sandbox.verifiedPaymentsCount || 0).toLocaleString('fa-IR')} تراکنش)؛ این مبالغ پول واقعی نیستند.
            </p>
            <p>
              تسویهٔ شبیه‌سازی‌شده: {formatToman(financeReport.sandbox.settlementsPaidToman || 0)}
              {' '}({Number(financeReport.sandbox.settlementsPaidCount || 0).toLocaleString('fa-IR')} مورد)؛ وجه بانکی جابه‌جا نشده است.
            </p>
          </div>

          {(Number(financeReport.excludedUnverified.legacyRefundsCount || 0) > 0 ||
            Number(financeReport.excludedUnverified.legacySettlementsPaidCount || 0) > 0 ||
            Number(financeReport.excludedUnverified.legacySettlementsPendingCount || 0) > 0) && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-950">
              رکوردهای قدیمیِ راستی‌آزمایی‌نشده از جمع اصلی حذف شده‌اند: بازپرداخت{' '}
              {formatToman(financeReport.excludedUnverified.legacyRefundsToman || 0)}؛ تسویهٔ قدیمیِ ثبت‌شده{' '}
              {formatToman(financeReport.excludedUnverified.legacySettlementsPaidToman || 0)}؛ درخواست قدیمیِ در انتظار{' '}
              {formatToman(financeReport.excludedUnverified.legacySettlementsPendingToman || 0)}.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-rose-200 p-5 space-y-3 h-fit">
              <h3 className="font-extrabold text-sm text-slate-900">بازپرداخت مشتری</h3>
              <p className="text-rose-900 font-bold">
                اجرای بازپرداخت در این نسخه مسدود است. endpoint نیز با خطای REFUND_PROVIDER_UNAVAILABLE رد می‌کند و هیچ وضعیت، فاکتور، دفترکل یا پیام موفقیتی ثبت نمی‌کند.
              </p>
              <p className="text-slate-600">
                تا زمان اتصال و آزمون provider واقعی، پیگیری مالی را خارج از سامانه و طبق رویهٔ مصوب انجام دهید. صرف تأیید مدیر یا ثبت دلیل، انتقال وجه را اثبات نمی‌کند.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <h3 className="font-extrabold text-sm text-slate-900">
                صف تسویهٔ امدادگران — Sandbox یا تأیید دستی مستند
              </h3>
              <p className="text-slate-600">
                در مسیر دستی، ابتدا انتقال را خارج از سامانه انجام دهید؛ سپس مرجع واقعی، یادداشت ممیزی و تأیید مشاهده رسید را ثبت کنید. نرم‌افزار بانک را استعلام نمی‌کند.
              </p>
              {financeReport.settlements.length === 0 ? (
                <p className="text-slate-500">درخواست تسویه‌ای ثبت نشده است.</p>
              ) : (
                financeReport.settlements.map((s) => {
                  const settlementId = Number(s.id);
                  const mode = String(s.execution_mode || 'legacy_unverified');
                  const draft = settlementDrafts[settlementId] ?? EMPTY_SETTLEMENT_REVIEW_DRAFT;
                  const isRequested = s.status === 'requested';
                  const statusLabel =
                    s.status === 'rejected'
                      ? 'ردشده؛ مبلغ به کیف پول برگشته'
                      : s.status === 'requested'
                        ? 'در انتظار رسیدگی'
                        : mode === 'sandbox_simulated'
                          ? 'Sandbox: شبیه‌سازی؛ وجه واقعی جابه‌جا نشده'
                          : mode === 'manual_external'
                            ? 'ثبت دستی با تأیید مدیر؛ استعلام بانکی نشده'
                            : 'وضعیت قدیمی/راستی‌آزمایی‌نشده';
                  const modeLabel =
                    mode === 'sandbox_simulated'
                      ? 'شبیه‌سازی Sandbox'
                      : mode === 'manual_external'
                        ? 'انتقال خارج از سامانه با تأیید دستی'
                        : 'قدیمی/نامشخص';
                  return (
                    <div
                      key={settlementId}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                    >
                      <div className="flex flex-wrap justify-between gap-2 font-bold">
                        <span>
                          {String(s.responder_name)} ({formatToman(Number(s.amount_toman))})
                        </span>
                        <span className={mode === 'legacy_unverified' ? 'text-rose-800' : 'text-slate-700'}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">
                        شبا: {String(s.sheba_number)}
                      </div>
                      <div>روش ثبت: <strong>{modeLabel}</strong></div>
                      {typeof s.bank_reference_code === 'string' && s.bank_reference_code && (
                        <div className="font-mono text-[11px] text-slate-600">
                          {mode === 'manual_external'
                            ? 'مرجع واردشده دستی؛ اصالت بانکی استعلام نشده:'
                            : 'مرجع تاریخیِ راستی‌آزمایی‌نشده:'}{' '}
                          {s.bank_reference_code}
                        </div>
                      )}
                      {typeof s.note === 'string' && s.note && (
                        <div className="text-slate-600">یادداشت: {s.note}</div>
                      )}
                      {isRequested && (
                        <div className="space-y-2 border-t border-slate-200 pt-2">
                          {mode === 'manual_external' && (
                            <>
                              <label className="block font-bold">
                                شناسهٔ مرجع واقعی از رسید پایا/ساتنا
                                <input
                                  type="text"
                                  value={draft.bankReferenceCode}
                                  onChange={(e) => updateSettlementDraft(settlementId, { bankReferenceCode: e.target.value })}
                                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                                  placeholder="مرجع واقعی را از رسید بانکی وارد کنید"
                                />
                              </label>
                              <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-amber-950">
                                <input
                                  type="checkbox"
                                  checked={draft.externalTransferConfirmed}
                                  onChange={(e) => updateSettlementDraft(settlementId, { externalTransferConfirmed: e.target.checked })}
                                  className="mt-0.5"
                                />
                                <span>انتقال را خارج از سامانه انجام داده‌ام و رسید واقعی را مشاهده و تطبیق کرده‌ام؛ سامانه استعلام بانکی خودکار ندارد.</span>
                              </label>
                            </>
                          )}
                          {mode === 'sandbox_simulated' && (
                            <p className="rounded-lg bg-indigo-50 p-2 text-indigo-950">
                              این تأیید فقط Sandbox است؛ مرجع بانکی وارد نکنید و وجه واقعی جابه‌جا نمی‌شود.
                            </p>
                          )}
                          <label className="block font-bold">
                            یادداشت ممیزی{mode === 'sandbox_simulated' ? ' (اختیاری در Sandbox)' : ''}
                            <input
                              type="text"
                              value={draft.note}
                              onChange={(e) => updateSettlementDraft(settlementId, { note: e.target.value })}
                              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                              placeholder={mode === 'manual_external' ? 'یادداشت واقعی درباره رسید و انتقال' : 'یادداشت یا دلیل رد'}
                            />
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {mode !== 'legacy_unverified' && (
                              <button
                                type="button"
                                disabled={mode === 'manual_external' && (
                                  draft.bankReferenceCode.trim().length < 4 ||
                                  draft.note.trim().length < 5 ||
                                  !draft.externalTransferConfirmed
                                )}
                                onClick={() => void handleProcessSettlement(settlementId, 'approved_paid')}
                                className="disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-lg"
                              >
                                {mode === 'sandbox_simulated' ? 'ثبت شبیه‌سازی Sandbox' : 'ثبت دستی پس از انتقال واقعی'}
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={draft.note.trim().length < 5}
                              onClick={() => void handleProcessSettlement(settlementId, 'rejected')}
                              className="disabled:opacity-40 disabled:cursor-not-allowed bg-rose-600 text-white font-bold px-3 py-1.5 rounded-lg"
                            >
                              رد و برگشت مبلغ به کیف پول
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
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
              {settings.map((s) => {
                const key = String(s.key);
                const defaultText =
                  typeof s.value === 'string'
                    ? s.value
                    : JSON.stringify(s.value);
                const draftVal =
                  settingDrafts[key] !== undefined ? settingDrafts[key] : defaultText;
                const isBooleanSetting =
                  key === 'allow_ev_services' || key === 'allow_postpay_debt';
                const environmentLocked = Boolean(s.environmentLocked);
                return (
                  <div
                    key={key}
                    className="py-2.5 border-b border-slate-100 last:border-0 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800">
                        {String(s.descriptionFa)}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {key}
                      </span>
                    </div>
                    {environmentLocked && (
                      <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900 font-bold">
                        وضعیت مؤثر: {isBooleanSetting && s.effectiveValue === true ? 'فعال' : 'غیرفعال'}؛ قفل محیط سرور اجازه فعال‌سازی این قابلیت را نمی‌دهد.
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      {isBooleanSetting ? (
                        <select
                          dir="ltr"
                          value={draftVal}
                          onChange={(e) =>
                            setSettingDrafts({
                              ...settingDrafts,
                              [key]: e.target.value,
                            })
                          }
                          className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono"
                        >
                          <option value="true" disabled={environmentLocked}>
                            true — فعال
                          </option>
                          <option value="false">false — غیرفعال</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          dir="ltr"
                          value={draftVal}
                          onChange={(e) =>
                            setSettingDrafts({
                              ...settingDrafts,
                              [key]: e.target.value,
                            })
                          }
                          className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => void handleSaveSetting(key, draftVal)}
                        className="bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white font-bold px-3 py-1.5 rounded-lg transition"
                      >
                        ذخیره
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2.5">
              <h3 className="font-extrabold text-sm text-slate-900">
                صندوق خروجی اعلان و پیامک (شفافیت پذیرش provider / Sandbox)
              </h3>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-950">
                «پذیرفته‌شده توسط ارائه‌دهنده» به معنی تحویل قطعی به گوشی نیست؛ گزارش تحویل مخابراتی در این نسخه دریافت نمی‌شود.
              </p>
              <div className="max-h-72 overflow-y-auto space-y-2">
                {smsOutbox.map((sms) => (
                  <div
                    key={Number(sms.id)}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1"
                  >
                    <div className="flex justify-between font-bold">
                      <span>{String(sms.title || sms.event_type)}</span>
                      <span className="text-amber-800 text-right">
                        {sms.delivery_status === 'sent'
                          ? 'پذیرفته‌شده توسط API؛ تحویل نهایی تأیید نشده'
                          : sms.delivery_status === 'sandbox_logged'
                            ? 'ثبت محلی Sandbox؛ ارسال واقعی انجام نشده'
                            : String(sms.delivery_status || sms.status)}
                      </span>
                    </div>
                    <p className="text-slate-700">{String(sms.body)}</p>
                    {typeof sms.provider_message_id === 'string' && sms.provider_message_id && (
                      <p className="font-mono text-[10px] text-slate-500">
                        شناسهٔ واقعی پیام در provider: {sms.provider_message_id}
                      </p>
                    )}
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
