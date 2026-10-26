import React, { useEffect, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Truck,
  CheckCircle2,
  XCircle,
  Wallet,
  FileCheck,
  Navigation,
  ShieldAlert,
  ListChecks,
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { useRealtimeEvents } from '../lib/use-realtime.ts';
import {
  formatToman,
  formatDateTimeFa,
  getStatusBadgeClass,
} from '../lib/format.ts';
import {
  EQUIPMENT_TYPES,
  EQUIPMENT_TYPE_LABELS,
  type EquipmentType,
  type RequestState,
} from '../../shared/constants.ts';

interface ResponderProfileData {
  id: number;
  verificationStatus: string;
  verificationStatusLabel: string;
  equipmentType: EquipmentType;
  equipmentTypeLabel: string;
  vehiclePlate: string | null;
  hasEvCertification: boolean;
  availabilityStatus: 'offline' | 'online' | 'busy';
  shebaNumber: string | null;
  ratingAvg: number;
  completedMissionsCount: number;
  rejectionReason: string | null;
  walletBalanceToman: number;
  documents: Array<{
    id: number;
    doc_type: string;
    doc_number: string;
    status: string;
    review_note: string | null;
  }>;
  services: Array<{ service_id: number; title_fa: string }>;
  zones: Array<{ zone_id: number; name_fa: string }>;
}

interface MissionOfferItem {
  offerId: number;
  requestId: number;
  trackingCode: string;
  serviceTitle: string;
  zoneName: string;
  vehicleSummary: string;
  distanceKm: number;
  estimatedEtaMinutes: number;
  estimatedPriceToman: number;
  issueDescription: string;
}

interface ResponderMissionItem {
  id: number;
  trackingCode: string;
  status: RequestState;
  statusLabel: string;
  paymentStatus: string;
  serviceTitle: string;
  zoneName: string;
  originAddress: string;
  payableToman: number;
  createdAt: string;
}

export function ResponderDashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const currentTab = location.pathname.endsWith('/missions')
    ? 'missions'
    : location.pathname.endsWith('/earnings')
      ? 'earnings'
      : location.pathname.endsWith('/setup') || location.hash === '#setup'
        ? 'setup'
        : 'operations';

  const [profile, setProfile] = useState<ResponderProfileData | null>(null);
  const [offers, setOffers] = useState<MissionOfferItem[]>([]);
  const [missions, setMissions] = useState<ResponderMissionItem[]>([]);
  const [walletData, setWalletData] = useState<{
    balanceToman: number;
    eligibleForSettlementToman: number;
    settlementMode: string;
    ledger: Array<{
      id: number;
      entry_type: string;
      amount_toman: number;
      balance_after_toman: number;
      description: string;
      created_at: string;
    }>;
    settlements: Array<{
      id: number;
      amount_toman: number;
      sheba_number: string;
      status: string;
      execution_mode: string;
      bank_reference_code: string | null;
      created_at: string;
    }>;
  } | null>(null);

  const [allCatalogServices, setAllCatalogServices] = useState<
    Array<{ id: number; titleFa: string }>
  >([]);
  const [qazvinZones, setQazvinZones] = useState<
    Array<{ id: number; nameFa: string }>
  >([]);

  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [selectedZoneIds, setSelectedZoneIds] = useState<number[]>([]);
  const [equipmentForm, setEquipmentForm] = useState({
    equipmentType: 'service_van' as EquipmentType,
    vehiclePlate: '',
    shebaNumber: '',
  });
  const [docForm, setDocForm] = useState({
    docType: 'national_card',
    docNumber: '',
  });
  const [settlementAmount, setSettlementAmount] = useState(100000);

  // فرم تکمیل مأموریت فعال
  const [completionForm, setCompletionForm] = useState({
    summary: '',
    actionsTaken: '',
    partName: '',
    partCostToman: 0,
    priceChangeReason: '',
  });

  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const loadResponderData = useCallback(async () => {
    try {
      const [meRes, offRes, misRes, walRes, catRes, geoRes] = await Promise.all([
        apiFetch<{ profile: ResponderProfileData }>('/api/responders/me'),
        apiFetch<{ offers: MissionOfferItem[] }>('/api/requests/responder/offers'),
        apiFetch<{ missions: ResponderMissionItem[] }>(
          '/api/requests/responder/missions'
        ),
        apiFetch<{
          balanceToman: number;
          eligibleForSettlementToman: number;
          settlementMode: string;
          ledger: Array<{
            id: number;
            entry_type: string;
            amount_toman: number;
            balance_after_toman: number;
            description: string;
            created_at: string;
          }>;
          settlements: Array<{
            id: number;
            amount_toman: number;
            sheba_number: string;
            status: string;
            execution_mode: string;
            bank_reference_code: string | null;
            created_at: string;
          }>;
        }>('/api/payments/responder/wallet'),
        apiFetch<{ services: Array<{ id: number; titleFa: string }> }>(
          '/api/catalog/services'
        ),
        apiFetch<{
          provinces: Array<{ id: number; slug: string }>;
          zones: Array<{
            id: number;
            provinceId: number;
            nameFa: string;
            status: string;
          }>;
        }>('/api/geography/overview'),
      ]);

      setProfile(meRes.profile);
      setOffers(offRes.offers);
      setMissions(misRes.missions);
      setWalletData(walRes);
      setAllCatalogServices(catRes.services);

      const qzv = geoRes.provinces.find((p) => p.slug === 'qazvin');
      setQazvinZones(
        geoRes.zones.filter((z) => qzv && z.provinceId === qzv.id)
      );

      setSelectedServiceIds(meRes.profile.services.map((s) => s.service_id));
      setSelectedZoneIds(meRes.profile.zones.map((z) => z.zone_id));
      setEquipmentForm({
        equipmentType: meRes.profile.equipmentType,
        vehiclePlate: meRes.profile.vehiclePlate || '',
        shebaNumber: meRes.profile.shebaNumber || '',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'خطا در دریافت اطلاعات پنل امدادگر',
      });
    }
  }, []);

  useEffect(() => {
    void loadResponderData();
  }, [loadResponderData]);

  const activeMission = missions.find((m) =>
    ['Accepted', 'EnRoute', 'Arrived', 'InProgress'].includes(m.status)
  );

  const toggleAvailability = async (next: 'online' | 'offline') => {
    setFeedback(null);
    try {
      await apiFetch('/api/responders/availability', {
        method: 'POST',
        body: JSON.stringify({ status: next, lat: 36.2688, lng: 50.0041 }),
      });
      setFeedback({
        type: 'ok',
        text:
          next === 'online'
            ? 'وضعیت شما به «آماده دریافت مأموریت (آنلاین)» تغییر یافت.'
            : 'وضعیت شما به «آفلاین» تغییر یافت.',
      });
      await loadResponderData();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'تغییر وضعیت انجام نشد',
      });
    }
  };

  const handleAcceptOffer = async (requestId: number) => {
    setFeedback(null);
    try {
      await apiFetch(`/api/requests/${requestId}/accept`, { method: 'POST' });
      setFeedback({ type: 'ok', text: 'مأموریت با موفقیت توسط شما پذیرفته شد!' });
      await loadResponderData();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'خطا در پذیرش مأموریت',
      });
    }
  };

  const handleRejectOffer = async (requestId: number) => {
    setFeedback(null);
    try {
      await apiFetch(`/api/requests/${requestId}/reject-offer`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'مشغول بودن یا فاصله زیاد' }),
      });
      setFeedback({ type: 'ok', text: 'پیشنهاد رد شد.' });
      await loadResponderData();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'خطا در رد پیشنهاد',
      });
    }
  };

  const handleAdvanceStatus = async (
    requestId: number,
    nextStatus: 'EnRoute' | 'Arrived' | 'InProgress'
  ) => {
    setFeedback(null);
    try {
      await apiFetch(`/api/requests/${requestId}/responder-status`, {
        method: 'POST',
        body: JSON.stringify({ nextStatus, lat: 36.271, lng: 50.006 }),
      });
      setFeedback({ type: 'ok', text: 'وضعیت مأموریت ثبت شد.' });
      await loadResponderData();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'خطا در تغییر وضعیت',
      });
    }
  };

  const handleSendLiveLocation = async () => {
    setFeedback(null);
    const sendCoords = async (lat: number, lng: number) => {
      try {
        await apiFetch('/api/responders/location', {
          method: 'POST',
          body: JSON.stringify({ lat, lng }),
        });
        setFeedback({
          type: 'ok',
          text: `موقعیت زنده GPS (${lat.toFixed(4)}, ${lng.toFixed(4)}) به مرکز عملیات و نقشه مشتری ارسال شد.`,
        });
        await loadResponderData();
      } catch (err) {
        setFeedback({
          type: 'err',
          text: err instanceof Error ? err.message : 'خطا در ارسال موقعیت زنده',
        });
      }
    };

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void sendCoords(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          // پشتیبان مختصات قزوین در صورت عدم دسترسی GPS مرورگر در محیط دسکتاپ/پیش‌نمایش
          const jitter = (Math.random() - 0.5) * 0.004;
          void sendCoords(36.2695 + jitter, 50.0048 + jitter);
        },
        { timeout: 4000 }
      );
    } else {
      void sendCoords(36.2695, 50.0048);
    }
  };

  useRealtimeEvents(true, () => {
    void loadResponderData();
  });

  const handleCompleteMission = async (e: React.FormEvent, requestId: number) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const partsUsed =
        completionForm.partName.trim() && completionForm.partCostToman > 0
          ? [
              {
                name: completionForm.partName.trim(),
                costToman: Number(completionForm.partCostToman),
              },
            ]
          : [];

      await apiFetch(`/api/requests/${requestId}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          summary: completionForm.summary,
          actionsTaken: completionForm.actionsTaken,
          partsUsed,
          priceChangeReason: completionForm.priceChangeReason || undefined,
        }),
      });
      setCompletionForm({
        summary: '',
        actionsTaken: '',
        partName: '',
        partCostToman: 0,
        priceChangeReason: '',
      });
      setFeedback({
        type: 'ok',
        text: 'گزارش تکمیل خدمت ثبت و فاکتور رسمی صادر گردید.',
      });
      await loadResponderData();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'خطا در تکمیل مأموریت',
      });
    }
  };

  const handleSaveSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/responders/me', {
        method: 'PATCH',
        body: JSON.stringify(equipmentForm),
      });
      await apiFetch('/api/responders/specialties', {
        method: 'PUT',
        body: JSON.stringify({
          serviceIds: selectedServiceIds,
          zoneIds: selectedZoneIds,
        }),
      });
      setFeedback({
        type: 'ok',
        text: 'مشخصات ناوگان، خدمات تخصصی و مناطق پوشش ذخیره شد.',
      });
      await loadResponderData();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'خطا در ذخیره تنظیمات امدادگر',
      });
    }
  };

  const handleSubmitDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/responders/documents', {
        method: 'POST',
        body: JSON.stringify(docForm),
      });
      setDocForm({ docType: 'national_card', docNumber: '' });
      setFeedback({
        type: 'ok',
        text: 'مدرک ثبت شد و در صف بررسی مدیریت قرار گرفت.',
      });
      await loadResponderData();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'خطا در ارسال مدرک',
      });
    }
  };

  const handleRequestSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiFetch<{
        result: { executionMode: string; simulationOnly: boolean };
      }>('/api/payments/responder/settlements', {
        method: 'POST',
        body: JSON.stringify({ amountToman: settlementAmount }),
      });
      setFeedback({
        type: response.result.simulationOnly ? 'err' : 'ok',
        text: response.result.simulationOnly
          ? 'فقط درخواست شبیه‌سازی‌شده Sandbox ثبت شد؛ هیچ وجه بانکی جابه‌جا نشده است.'
          : 'درخواست ثبت شد؛ این سامانه وجه را منتقل نمی‌کند و پرداخت فقط پس از تأیید دستی مستند ثبت می‌شود.',
      });
      await loadResponderData();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'خطا در درخواست تسویه‌حساب',
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* هدر پنل امدادگر */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold">پنل عملیاتی امدادگر</h1>
            {profile && (
              <span
                className={`text-xs px-3 py-0.5 rounded-full border font-bold ${getStatusBadgeClass(profile.verificationStatus)}`}
              >
                {profile.verificationStatusLabel}
              </span>
            )}
          </div>
          {profile && (
            <p className="text-xs text-slate-300">
              ناوگان: {profile.equipmentTypeLabel} | امتیاز عملکرد:{' '}
              {profile.ratingAvg.toLocaleString('fa-IR')} | مأموریت‌های انجام‌شده:{' '}
              {profile.completedMissionsCount.toLocaleString('fa-IR')}
            </p>
          )}
        </div>

        {profile && (
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${getStatusBadgeClass(profile.availabilityStatus)}`}
            >
              وضعیت فعلی:{' '}
              {profile.availabilityStatus === 'online'
                ? 'آماده به کار (آنلاین)'
                : profile.availabilityStatus === 'busy'
                  ? 'در حال انجام مأموریت'
                  : 'آفلاین'}
            </span>
            {profile.availabilityStatus !== 'busy' && (
              <button
                type="button"
                onClick={() =>
                  void toggleAvailability(
                    profile.availabilityStatus === 'online' ? 'offline' : 'online'
                  )
                }
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                  profile.availabilityStatus === 'online'
                    ? 'bg-slate-700 hover:bg-slate-600 text-white'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                }`}
              >
                {profile.availabilityStatus === 'online'
                  ? 'توقف دریافت مأموریت (آفلاین)'
                  : 'اعلام آمادگی و آنلاین شدن'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* بنر الزامی احراز صلاحیت */}
      {profile && profile.verificationStatus !== 'approved' && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-5 flex items-start gap-3 text-xs text-amber-950">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-extrabold text-sm">
              حساب امدادگری شما هنوز مجوز فعالیت عملیاتی ندارد ({profile.verificationStatusLabel})
            </div>
            <p>
              طبق قوانین ایمنی «اورژانس خودرو»، دریافت پیشنهاد مأموریت و آنلاین شدن منوط
              به تکمیل مدارک، انتخاب تخصص‌ها و تأیید نهایی توسط مدیر کل است.
            </p>
            {profile.rejectionReason && (
              <p className="text-rose-800 font-bold">
                علت اعلام‌شده مدیریت: {profile.rejectionReason}
              </p>
            )}
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-bold border ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* ناوبری تب‌های پنل امدادگر */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-slate-200 text-xs font-bold">
        <button
          type="button"
          onClick={() => navigate('/responder')}
          className={`px-4 py-2 rounded-xl flex items-center gap-1.5 ${
            currentTab === 'operations'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Navigation className="w-4 h-4" />
          عملیات و پیشنهادها ({offers.length.toLocaleString('fa-IR')})
        </button>

        <button
          type="button"
          onClick={() => navigate('/responder/missions')}
          className={`px-4 py-2 rounded-xl flex items-center gap-1.5 ${
            currentTab === 'missions'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ListChecks className="w-4 h-4" />
          فهرست مأموریت‌ها
        </button>

        <button
          type="button"
          onClick={() => navigate('/responder/earnings')}
          className={`px-4 py-2 rounded-xl flex items-center gap-1.5 ${
            currentTab === 'earnings'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Wallet className="w-4 h-4" />
          درآمد و تسویه‌حساب ({formatToman(profile?.walletBalanceToman ?? 0)})
        </button>

        <button
          type="button"
          onClick={() => navigate('/responder/setup')}
          className={`px-4 py-2 rounded-xl flex items-center gap-1.5 ${
            currentTab === 'setup'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          مدارک، تخصص‌ها و محدوده پوشش
        </button>
      </div>

      {/* تب عملیات زنده و پیشنهادها */}
      {currentTab === 'operations' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* مأموریت در جریان */}
          <div className="lg:col-span-7 space-y-4">
            <h2 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600" />
              مأموریت فعال در دست اجرا
            </h2>

            {activeMission ? (
              <div className="bg-white rounded-2xl border-2 border-blue-500 p-5 space-y-4 text-xs shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-extrabold text-base text-slate-900">
                      {activeMission.serviceTitle}
                    </span>
                    <span className="font-mono text-slate-500 mr-2">
                      {activeMission.trackingCode}
                    </span>
                  </div>
                  <span
                    className={`px-3 py-0.5 rounded-full border font-bold ${getStatusBadgeClass(activeMission.status)}`}
                  >
                    {activeMission.statusLabel}
                  </span>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                  <div>
                    <strong>نشانی محل مشتری: </strong>
                    {activeMission.originAddress}
                  </div>
                  <div>
                    <strong>برآورد هزینه مأموریت: </strong>
                    {formatToman(activeMission.payableToman)}
                  </div>
                </div>

                {/* دکمه‌های گام‌به‌گام State Machine */}
                <div className="flex flex-wrap gap-2">
                  {activeMission.status === 'Accepted' && (
                    <button
                      type="button"
                      onClick={() =>
                        void handleAdvanceStatus(activeMission.id, 'EnRoute')
                      }
                      className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold px-4 py-2.5 rounded-xl"
                    >
                      ثبت حرکت به سمت محل مشتری
                    </button>
                  )}
                  {activeMission.status === 'EnRoute' && (
                    <button
                      type="button"
                      onClick={() =>
                        void handleAdvanceStatus(activeMission.id, 'Arrived')
                      }
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-4 py-2.5 rounded-xl"
                    >
                      ثبت رسیدن به محل خودرو
                    </button>
                  )}
                  {activeMission.status === 'Arrived' && (
                    <button
                      type="button"
                      onClick={() =>
                        void handleAdvanceStatus(activeMission.id, 'InProgress')
                      }
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl"
                    >
                      شروع انجام عملیات امدادی
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleSendLiveLocation()}
                    className="bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-bold px-3.5 py-2.5 rounded-xl"
                  >
                    بروزرسانی موقعیت زنده (GPS)
                  </button>

                  <Link
                    to={`/requests/${activeMission.id}`}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2.5 rounded-xl"
                  >
                    مشاهده نقشه و مسیریابی کامل
                  </Link>
                </div>

                {/* فرم گزارش پایان خدمت در وضعیت InProgress */}
                {activeMission.status === 'InProgress' && (
                  <form
                    onSubmit={(e) => void handleCompleteMission(e, activeMission.id)}
                    className="border-t border-slate-200 pt-4 space-y-3"
                  >
                    <div className="font-extrabold text-sm text-emerald-900">
                      ثبت گزارش پایان خدمت و صدور صورتحساب نهایی
                    </div>
                    <div>
                      <label className="font-bold block mb-1">خلاصه عیب‌یابی *</label>
                      <input
                        type="text"
                        required
                        value={completionForm.summary}
                        onChange={(e) =>
                          setCompletionForm({
                            ...completionForm,
                            summary: e.target.value,
                          })
                        }
                        placeholder="مثال: افت ولتاژ باتری به دلیل باز ماندن چراغ سقفی"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="font-bold block mb-1">اقدامات انجام‌شده *</label>
                      <textarea
                        rows={2}
                        required
                        value={completionForm.actionsTaken}
                        onChange={(e) =>
                          setCompletionForm({
                            ...completionForm,
                            actionsTaken: e.target.value,
                          })
                        }
                        placeholder="مثال: راه‌اندازی با بوستر استاندارد و تست سلامت شارژ دینام (۱۴.۲ ولت)"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="font-bold block mb-1">
                          نام قطعه مصرفی (در صورت وجود)
                        </label>
                        <input
                          type="text"
                          value={completionForm.partName}
                          onChange={(e) =>
                            setCompletionForm({
                              ...completionForm,
                              partName: e.target.value,
                            })
                          }
                          placeholder="اختیاری"
                          className="w-full rounded-xl border border-slate-300 px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="font-bold block mb-1">
                          بهای قطعه (تومان)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={completionForm.partCostToman}
                          onChange={(e) =>
                            setCompletionForm({
                              ...completionForm,
                              partCostToman: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2"
                        />
                      </div>
                    </div>
                    {completionForm.partCostToman > 0 && (
                      <div>
                        <label className="font-bold block mb-1 text-amber-800">
                          علت تغییر مبلغ نهایی نسبت به برآورد اولیه (الزامی) *
                        </label>
                        <input
                          type="text"
                          required
                          value={completionForm.priceChangeReason}
                          onChange={(e) =>
                            setCompletionForm({
                              ...completionForm,
                              priceChangeReason: e.target.value,
                            })
                          }
                          placeholder="مثال: تعویض قطعه فرسوده با درخواست و تأیید مشتری در محل"
                          className="w-full rounded-xl border border-amber-400 bg-amber-50/40 px-3 py-2"
                        />
                      </div>
                    )}
                    <button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3 rounded-xl"
                    >
                      ثبت تکمیل خدمت و صدور فاکتور رسمی
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                در حال حاضر مأموریت فعالی در دست انجام ندارید.
              </div>
            )}
          </div>

          {/* پیشنهادهای مأموریت دریافتی */}
          <div className="lg:col-span-5 space-y-4">
            <h2 className="font-extrabold text-sm text-slate-900">
              پیشنهادهای مأموریت واجد شرایط ({offers.length.toLocaleString('fa-IR')})
            </h2>
            {offers.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                پیشنهاد مأموریت بازی برای شما وجود ندارد. (مطمئن شوید وضعیت شما آنلاین است)
              </div>
            ) : (
              <div className="space-y-3">
                {offers.map((o) => (
                  <div
                    key={o.offerId}
                    className="bg-white rounded-2xl border-2 border-amber-400 p-4 space-y-3 text-xs shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-slate-900">
                        {o.serviceTitle}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {o.trackingCode}
                      </span>
                    </div>
                    <div className="text-slate-600 space-y-1">
                      <div>محدوده: {o.zoneName}</div>
                      <div>خودرو: {o.vehicleSummary}</div>
                      <div>
                        فاصله تقریبی: {o.distanceKm.toLocaleString('fa-IR')} کیلومتر | زمان رسیدن:{' '}
                        {o.estimatedEtaMinutes.toLocaleString('fa-IR')} دقیقه
                      </div>
                      <div>شرح مشکل: {o.issueDescription}</div>
                      <div className="font-bold text-slate-900">
                        برآورد مبلغ مأموریت: {formatToman(o.estimatedPriceToman)}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => void handleAcceptOffer(o.requestId)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-2.5 rounded-xl flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        پذیرش مأموریت
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRejectOffer(o.requestId)}
                        className="bg-slate-100 hover:bg-rose-50 text-rose-700 font-bold py-2.5 rounded-xl flex items-center justify-center gap-1"
                      >
                        <XCircle className="w-4 h-4" />
                        رد پیشنهاد
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* تب سابقه مأموریت‌ها */}
      {currentTab === 'missions' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {missions.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              هنوز مأموریتی برای شما ثبت نشده است.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {missions.map((m) => (
                <div
                  key={m.id}
                  className="p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-slate-900">
                      {m.serviceTitle} ({m.trackingCode})
                    </div>
                    <div className="text-slate-500">
                      {m.zoneName} | {formatDateTimeFa(m.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full border font-bold ${getStatusBadgeClass(m.status)}`}
                    >
                      {m.statusLabel}
                    </span>
                    <span className="font-extrabold">
                      {formatToman(m.payableToman)}
                    </span>
                    <Link
                      to={`/requests/${m.id}`}
                      className="bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg"
                    >
                      جزئیات مأموریت
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* تب درآمد و تسویه‌حساب */}
      {currentTab === 'earnings' && walletData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 space-y-4 text-xs">
            <div className="bg-slate-900 text-white rounded-xl p-4 space-y-1">
              <div className="text-slate-300">ماندهٔ دفترکل (به‌تنهایی به معنی وجه بانکی نیست):</div>
              <div className="text-2xl font-black text-slate-100">
                {formatToman(walletData.balanceToman)}
              </div>
              <div className="text-amber-300 mt-2">واجد شرایط درخواست تسویه در این حالت:</div>
              <div className="text-xl font-black text-amber-400">
                {formatToman(walletData.eligibleForSettlementToman)}
              </div>
              <div className="text-[11px] text-slate-400">
                {walletData.settlementMode === 'sandbox_simulated'
                  ? 'Sandbox: عدد شبیه‌سازی است؛ پول واقعی جابه‌جا نمی‌شود.'
                  : 'انتقال بانکی خودکار نیست؛ ثبت پرداخت نیازمند رسید و تأیید مدیر است.'}
              </div>
              <div className="text-[11px] text-slate-400 dir-ltr text-left">
                {profile?.shebaNumber || 'شماره شبا ثبت نشده است'}
              </div>
            </div>

            <form onSubmit={handleRequestSettlement} className="space-y-3">
              <h3 className="font-extrabold text-sm text-slate-900">
                ثبت درخواست تسویهٔ شبا (نه انتقال بانکی)
              </h3>
              <p className="rounded-lg bg-amber-50 p-2 text-amber-950">
                ثبت درخواست به معنی واریز نیست؛ انتقال بانکی خودکار نداریم. در Sandbox هیچ وجه واقعی جابه‌جا نمی‌شود.
              </p>
              <div>
                <label className="font-bold block mb-1">
                  مبلغ درخواستی تسویه (حداقل ۵۰,۰۰۰ تومان)
                </label>
                <input
                  type="number"
                  min={50000}
                  max={walletData.eligibleForSettlementToman}
                  step={10000}
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <button
                type="submit"
                disabled={walletData.eligibleForSettlementToman < 50000}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold py-2.5 rounded-xl"
              >
                ثبت درخواست تسویه (واریز خودکار انجام نمی‌شود)
              </button>
            </form>

            {walletData.settlements.length > 0 && (
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <div className="font-bold">درخواست‌های تسویه اخیر:</div>
                {walletData.settlements.map((st) => (
                  <div
                    key={st.id}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold">{formatToman(st.amount_toman)}</div>
                      {st.bank_reference_code && (
                        <div className="text-[10px] text-emerald-700">
                          شناسه پایا: {st.bank_reference_code}
                        </div>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full border font-bold text-[10px] ${getStatusBadgeClass(st.status)}`}
                    >
                      {st.status === 'approved_paid'
                        ? st.execution_mode === 'sandbox_simulated'
                          ? 'Sandbox؛ وجه واقعی جابه‌جا نشده'
                          : st.execution_mode === 'manual_external'
                            ? 'ثبت دستی مدیر؛ استعلام بانکی نشده'
                            : 'ثبت قدیمی؛ راستی‌آزمایی‌نشده'
                        : st.status === 'requested'
                          ? st.execution_mode === 'sandbox_simulated'
                            ? 'درخواست Sandbox؛ بدون وجه واقعی'
                            : st.execution_mode === 'manual_external'
                              ? 'در انتظار رسیدگی دستی'
                              : 'در انتظار تعیین مسیر؛ قدیمی/نامشخص'
                          : 'ردشده'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 space-y-3 text-xs">
            <h3 className="font-extrabold text-sm text-slate-900">
              دفتر کل گردش مالی امدادگر (Ledger)
            </h3>
            {walletData.ledger.length === 0 ? (
              <p className="text-slate-500">گردش مالی ثبت نشده است.</p>
            ) : (
              <div className="space-y-2">
                {walletData.ledger.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 rounded-xl border border-slate-100 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-slate-900">
                        {entry.description}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {formatDateTimeFa(entry.created_at)}
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <div
                        className={`font-extrabold ${
                          entry.amount_toman >= 0
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {entry.amount_toman >= 0 ? '+' : ''}
                        {formatToman(entry.amount_toman)}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        مانده: {formatToman(entry.balance_after_toman)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* تب مدارک، تخصص‌ها و مناطق پوشش */}
      {currentTab === 'setup' && profile && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
          <form
            onSubmit={handleSaveSetup}
            className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 space-y-4"
          >
            <h3 className="font-extrabold text-sm text-slate-900">
              تجهیزات ناوگان، خدمات تخصصی و مناطق فعالیت در قزوین
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold block mb-1">نوع تجهیز / خودرو</label>
                <select
                  value={equipmentForm.equipmentType}
                  onChange={(e) =>
                    setEquipmentForm({
                      ...equipmentForm,
                      equipmentType: e.target.value as EquipmentType,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                >
                  {EQUIPMENT_TYPES.map((eq) => (
                    <option key={eq} value={eq}>
                      {EQUIPMENT_TYPE_LABELS[eq]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold block mb-1">پلاک خودروی امدادی</label>
                <input
                  type="text"
                  value={equipmentForm.vehiclePlate}
                  onChange={(e) =>
                    setEquipmentForm({
                      ...equipmentForm,
                      vehiclePlate: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold block mb-1">
                  شماره شبا جهت تسویه‌حساب (۲۶ کاراکتر با IR)
                </label>
                <input
                  type="text"
                  value={equipmentForm.shebaNumber}
                  onChange={(e) =>
                    setEquipmentForm({
                      ...equipmentForm,
                      shebaNumber: e.target.value,
                    })
                  }
                  placeholder="IR820540102680020817909001"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 dir-ltr text-left"
                />
              </div>
            </div>

            <div>
              <div className="font-bold mb-2">انتخاب خدمات تخصصی قابل ارائه:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                {allCatalogServices.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedServiceIds.includes(s.id)}
                      onChange={(e) =>
                        setSelectedServiceIds((prev) =>
                          e.target.checked
                            ? [...prev, s.id]
                            : prev.filter((id) => id !== s.id)
                        )
                      }
                    />
                    <span>{s.titleFa}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="font-bold mb-2">انتخاب محدوده‌های پوشش در استان قزوین:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                {qazvinZones.map((z) => (
                  <label key={z.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedZoneIds.includes(z.id)}
                      onChange={(e) =>
                        setSelectedZoneIds((prev) =>
                          e.target.checked
                            ? [...prev, z.id]
                            : prev.filter((id) => id !== z.id)
                        )
                      }
                    />
                    <span>{z.nameFa}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white font-extrabold px-5 py-2.5 rounded-xl transition"
            >
              ذخیره تخصص‌ها و مناطق پوشش
            </button>
          </form>

          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900">
              ارسال مدارک احراز صلاحیت فنی و هویتی
            </h3>
            <form onSubmit={handleSubmitDoc} className="space-y-3">
              <div>
                <label className="font-bold block mb-1">نوع مدرک</label>
                <select
                  value={docForm.docType}
                  onChange={(e) =>
                    setDocForm({ ...docForm, docType: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="national_card">کارت ملی هوشمند</option>
                  <option value="driving_license">گواهینامه رانندگی معتبر</option>
                  <option value="technical_skill_cert">گواهینامه مهارت فنی و حرفه‌ای</option>
                  <option value="tow_permit">مجوز تردد و حمل ناوگان یدک‌کش</option>
                  <option value="background_clearance">گواهی عدم سوءپیشینه</option>
                  <option value="ev_high_voltage_cert">گواهینامه ایمنی خودروهای برقی (HV)</option>
                </select>
              </div>
              <div>
                <label className="font-bold block mb-1">شماره سریال / کد مدرک *</label>
                <input
                  type="text"
                  required
                  value={docForm.docNumber}
                  onChange={(e) =>
                    setDocForm({ ...docForm, docNumber: e.target.value })
                  }
                  placeholder="مثال: TVTO-1405-8821"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl"
              >
                ثبت مدرک جهت بررسی مدیریت
              </button>
            </form>

            <div className="border-t border-slate-100 pt-3 space-y-2">
              <div className="font-bold">مدارک ثبت‌شده شما:</div>
              {profile.documents.length === 0 ? (
                <p className="text-slate-500">مدرکی ثبت نشده است.</p>
              ) : (
                profile.documents.map((d) => (
                  <div
                    key={d.id}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold">{d.doc_type}</div>
                      <div className="text-[11px] text-slate-500">{d.doc_number}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full border font-bold text-[10px] ${getStatusBadgeClass(
                        d.status === 'verified' ? 'approved' : d.status
                      )}`}
                    >
                      {d.status === 'verified' ? 'تأییدشده' : d.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
