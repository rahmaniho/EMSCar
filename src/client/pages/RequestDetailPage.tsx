import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  PhoneCall,
  CreditCard,
  AlertTriangle,
  Star,
  Printer,
  CheckCircle2,
  XCircle,
  Headphones,
  Paperclip,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context.tsx';
import { apiFetch } from '../lib/api.ts';
import { useRealtimeEvents } from '../lib/use-realtime.ts';
import { LiveMissionMap } from '../components/LiveMissionMap.tsx';
import {
  StatusTimeline,
  type HistoryItem,
} from '../components/StatusTimeline.tsx';
import {
  formatToman,
  formatDateTimeFa,
  getStatusBadgeClass,
} from '../lib/format.ts';
import {
  CANCELLABLE_BY_CUSTOMER_STATES,
  EQUIPMENT_TYPE_LABELS,
  type EquipmentType,
  type RequestState,
} from '../../shared/constants.ts';
import type { PriceBreakdown } from '../../shared/pricing-formula.ts';

interface RequestDetailData {
  id: number;
  trackingCode: string;
  status: RequestState;
  statusLabel: string;
  paymentStatus: string;
  paymentStatusLabel: string;
  paymentIsSandbox: boolean;
  customer: { id: number; fullName: string; phone: string | null };
  vehicle: {
    brand: string;
    model: string;
    plateNumber: string;
    category: string;
  };
  service: { id: number; slug: string; titleFa: string };
  geography: { provinceName: string; zoneName: string };
  origin: { lat: number; lng: number; address: string };
  destination: { lat: number; lng: number; address: string | null } | null;
  issueDescription: string;
  estimatedDistanceKm: number;
  estimatedEtaMinutes: number | null;
  pricing: {
    estimatedPriceToman: number;
    estimatedBreakdown: PriceBreakdown;
    finalPriceToman: number | null;
    finalBreakdown: PriceBreakdown | null;
    payableToman: number;
    priceChangeReason: string | null;
    customerPriceApprovalRequired: boolean;
    customerPriceApproved: boolean;
    cancellationFeeToman: number;
  };
  responder: {
    id: number;
    fullName: string;
    phone: string | null;
    equipmentType: EquipmentType;
    vehiclePlate: string | null;
    ratingAvg: number;
    liveLocation: { lat: number; lng: number; updatedAt: string | null } | null;
  } | null;
  report: {
    summary: string;
    actionsTaken: string;
    partsUsed: Array<{ name: string; costToman: number }>;
    partsTotalToman: number;
    actualTowDistanceKm: number;
    createdAt: string;
  } | null;
  invoice: {
    invoiceNumber: string;
    subtotalToman: number;
    discountToman: number;
    partsToman: number;
    taxToman: number;
    totalToman: number;
    totalRial: number;
    status: string;
    issuedAt: string;
    paidAt: string | null;
  } | null;
  review: {
    rating: number;
    tags: string[];
    comment: string | null;
  } | null;
  attachments: Array<{
    id: number;
    original_name: string;
    mime_type: string;
    size_bytes: number;
  }>;
  operatorEscalationRequired: boolean;
  operatorEscalationReason: string | null;
  cancellationReason: string | null;
  history: HistoryItem[];
  createdAt: string;
}

export function RequestDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState<RequestDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // درگاه پرداخت آزمایشی
  const [sandboxOrder, setSandboxOrder] = useState<{
    authority: string;
    amountToman: number;
    amountRial: number;
    gatewayNoticeFa: string;
  } | null>(null);

  // لغو درخواست
  const [showCancelBox, setShowCancelBox] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // امتیازدهی
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const loadDetail = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch<{ request: RequestDetailData }>(
        `/api/requests/${id}`
      );
      setData(res.request);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در بارگذاری جزئیات مأموریت');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadDetail();
    const timer = setInterval(() => {
      void loadDetail();
    }, 10000);
    return () => clearInterval(timer);
  }, [loadDetail]);

  useRealtimeEvents(Boolean(user && id), (ev) => {
    if (!ev.requestId || String(ev.requestId) === String(id)) {
      void loadDetail();
    }
  });

  const handleSubmitDraft = async () => {
    if (!data) return;
    try {
      await apiFetch(`/api/requests/${data.id}/submit`, { method: 'POST' });
      setActionMessage('پیش‌نویس تأیید شد و جستجوی هوشمند امدادگر آغاز گردید.');
      await loadDetail();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'خطا در ارسال پیش‌نویس');
    }
  };

  const handleApprovePrice = async () => {
    if (!data) return;
    try {
      await apiFetch(`/api/requests/${data.id}/approve-price`, { method: 'POST' });
      setActionMessage('مبلغ نهایی صورتحساب توسط شما تأیید شد؛ اکنون امکان پرداخت فعال است.');
      await loadDetail();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'خطا در تأیید مبلغ');
    }
  };

  const handleStartPayment = async () => {
    if (!data) return;
    setActionMessage(null);
    try {
      const res = await apiFetch<{
        order: {
          authority: string;
          amountToman: number;
          amountRial: number;
          isSandbox: boolean;
          paymentRedirectUrl: string;
          gatewayNoticeFa: string;
        };
      }>('/api/payments/orders', {
        method: 'POST',
        body: JSON.stringify({ requestId: data.id }),
      });

      if (res.order.isSandbox) {
        setSandboxOrder(res.order);
      } else {
        window.location.href = res.order.paymentRedirectUrl;
      }
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'خطا در ایجاد سفارش پرداخت');
    }
  };

  const handleSandboxBankAction = async (outcome: 'approve' | 'fail') => {
    if (!sandboxOrder) return;
    try {
      await apiFetch('/api/payments/sandbox/simulate', {
        method: 'POST',
        body: JSON.stringify({ authority: sandboxOrder.authority, outcome }),
      });
      const verifyRes = await apiFetch<{
        result: { paid: boolean; refId?: string; errorMessage?: string };
      }>('/api/payments/callback/verify', {
        method: 'POST',
        body: JSON.stringify({
          authority: sandboxOrder.authority,
          status: outcome === 'approve' ? 'OK' : 'NOK',
        }),
      });

      setSandboxOrder(null);
      if (verifyRes.result.paid) {
        setActionMessage(
          `پرداخت آزمایشی با استعلام سمت سرور تأیید شد. کد رهگیری: ${verifyRes.result.refId}`
        );
      } else {
        setActionMessage(
          `پرداخت انجام نشد: ${verifyRes.result.errorMessage || 'تراکنش ناموفق ثبت شد'}`
        );
      }
      await loadDetail();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'خطا در استعلام پرداخت');
    }
  };

  const handleCancelRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    try {
      await apiFetch(`/api/requests/${data.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason }),
      });
      setShowCancelBox(false);
      setActionMessage('درخواست طبق قوانین لغو شد.');
      await loadDetail();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'خطا در لغو درخواست');
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    try {
      await apiFetch('/api/ratings', {
        method: 'POST',
        body: JSON.stringify({
          requestId: data.id,
          rating,
          tags: rating >= 4 ? ['برخورد محترمانه', 'مهارت فنی'] : ['نیازمند بهبود'],
          comment: reviewComment,
        }),
      });
      setActionMessage('امتیاز و دیدگاه شما ثبت شد. سپاسگزاریم!');
      await loadDetail();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'خطا در ثبت امتیاز');
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-10 text-center text-sm text-slate-500">
        در حال دریافت اطلاعات مأموریت...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl p-6 text-center space-y-3">
          <div className="font-extrabold text-base">{error || 'مأموریت یافت نشد'}</div>
          <Link
            to="/customer"
            className="inline-block bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl"
          >
            بازگشت به داشبورد
          </Link>
        </div>
      </div>
    );
  }

  const isCustomerOwner = user?.role === 'customer' && user.id === data.customer.id;
  const canCustomerCancel =
    isCustomerOwner && CANCELLABLE_BY_CUSTOMER_STATES.includes(data.status);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* نوار وضعیت بالای پرونده */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-extrabold">{data.service.titleFa}</h1>
            <span className="font-mono text-xs bg-slate-800 text-amber-300 px-2.5 py-1 rounded-lg">
              {data.trackingCode}
            </span>
            <span
              className={`text-xs px-3 py-0.5 rounded-full border font-bold ${getStatusBadgeClass(data.status)}`}
            >
              {data.statusLabel}
            </span>
          </div>
          <p className="text-xs text-slate-300">
            خودرو: {data.vehicle.brand} {data.vehicle.model} ({data.vehicle.plateNumber}) | محدوده:{' '}
            {data.geography.zoneName} ({data.geography.provinceName})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          {isCustomerOwner && data.status === 'Draft' && (
            <button
              type="button"
              onClick={() => void handleSubmitDraft()}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs px-4 py-2.5 rounded-xl"
            >
              تأیید نهایی پیش‌نویس و اعزام امدادگر
            </button>
          )}

          <Link
            to={`/support?requestId=${data.id}`}
            className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5"
          >
            <Headphones className="w-3.5 h-3.5 text-amber-400" />
            <span>ثبت شکایت / پیگیری پشتیبانی</span>
          </Link>

          {canCustomerCancel && (
            <button
              type="button"
              onClick={() => setShowCancelBox((v) => !v)}
              className="bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl"
            >
              لغو درخواست
            </button>
          )}
        </div>
      </div>

      {actionMessage && (
        <div className="bg-amber-50 border border-amber-300 text-amber-950 p-4 rounded-xl text-xs font-bold">
          {actionMessage}
        </div>
      )}

      {/* اطلاع‌رسانی صادقانه در صورت قرار گرفتن در صف مرکز پیام */}
      {data.operatorEscalationRequired && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-950">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-extrabold text-sm">
              درخواست شما در صف اولویت اپراتور مرکز پیام قزوین قرار دارد
            </div>
            <p className="mt-1 leading-relaxed">
              {data.operatorEscalationReason ||
                'در این لحظه واحدهای هم‌تخصص مشغول انجام مأموریت هستند. بدون ارائه زمان ساختگی، اپراتور مرکز پیام در حال هماهنگی نزدیک‌ترین واحد مجاز برای شماست.'}
            </p>
          </div>
        </div>
      )}

      {/* مودال لغو با تأیید عملیات حساس */}
      {showCancelBox && (
        <form
          onSubmit={handleCancelRequest}
          className="bg-rose-50 border border-rose-300 rounded-2xl p-5 space-y-3 text-xs no-print"
        >
          <div className="font-extrabold text-rose-900">
            تأیید لغو درخواست {data.trackingCode}
          </div>
          {['EnRoute', 'Arrived'].includes(data.status) ? (
            <p className="text-rose-800 font-semibold">
              توجه: از آنجا که امدادگر به سمت محل شما حرکت کرده است، طبق شرایط خدمت مبلغ
              جریمه ایاب‌وذهاب ثبت خواهد شد.
            </p>
          ) : (
            <p className="text-rose-800">
              لغو پیش از حرکت امدادگر بدون هزینه جریمه است.
            </p>
          )}
          <input
            type="text"
            required
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="علت لغو درخواست را وارد کنید..."
            className="w-full rounded-xl border border-rose-300 bg-white px-3.5 py-2"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-rose-600 text-white font-bold px-4 py-2 rounded-xl"
            >
              تأیید قطعی لغو درخواست
            </button>
            <button
              type="button"
              onClick={() => setShowCancelBox(false)}
              className="bg-white border border-slate-300 text-slate-700 font-bold px-4 py-2 rounded-xl"
            >
              انصراف
            </button>
          </div>
        </form>
      )}

      {/* پنجره شبیه‌ساز شفاف درگاه آزمایشی شاپرک */}
      {sandboxOrder && (
        <div className="bg-white border-2 border-indigo-500 rounded-2xl p-6 shadow-xl space-y-4 no-print">
          <div className="bg-amber-100 border border-amber-300 text-amber-950 px-3.5 py-2 rounded-xl text-xs font-bold">
            هشدار شفافیت: {sandboxOrder.gatewayNoticeFa}
          </div>
          <div className="text-sm space-y-1">
            <div className="font-extrabold text-slate-900">
              شبیه‌ساز درگاه پرداخت بانکی — شناسه تراکنش: {sandboxOrder.authority}
            </div>
            <div className="text-xs text-slate-600">
              مبلغ قابل پرداخت: <strong>{formatToman(sandboxOrder.amountToman)}</strong>{' '}
              (معادل ریالی ارسالی به درگاه: {sandboxOrder.amountRial.toLocaleString('fa-IR')} ریال)
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleSandboxBankAction('approve')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-5 py-3 rounded-xl flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>شبیه‌سازی پرداخت موفق در سرور بانک و استعلام Callback</span>
            </button>
            <button
              type="button"
              onClick={() => void handleSandboxBankAction('fail')}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 py-3 rounded-xl flex items-center gap-1.5"
            >
              <XCircle className="w-4 h-4" />
              <span>شبیه‌سازی انصراف / پرداخت ناموفق</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <div className="no-print">
            <LiveMissionMap
              origin={data.origin}
              destination={data.destination}
              responderLocation={data.responder?.liveLocation}
              estimatedEtaMinutes={data.estimatedEtaMinutes}
              estimatedDistanceKm={data.estimatedDistanceKm}
              showNavigationLink={user?.role === 'responder'}
            />
          </div>

          <div className="no-print">
            <StatusTimeline currentStatus={data.status} history={data.history} />
          </div>

          {/* گزارش فنی پایان خدمت امدادگر */}
          {data.report && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 text-xs">
              <h3 className="font-extrabold text-sm text-slate-900">
                گزارش فنی امدادگر پس از انجام خدمت
              </h3>
              <div>
                <strong>خلاصه عیب‌یابی: </strong>
                {data.report.summary}
              </div>
              <div>
                <strong>اقدامات انجام‌شده: </strong>
                {data.report.actionsTaken}
              </div>
              {data.report.partsUsed.length > 0 && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                  <div className="font-bold">قطعات مصرفی ثبت‌شده:</div>
                  {data.report.partsUsed.map((p, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{p.name}</span>
                      <span className="font-bold">{formatToman(p.costToman)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* پیوست‌های خصوصی */}
          {data.attachments.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2.5 text-xs no-print">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-amber-500" />
                فایل‌ها و تصاویر خصوصی پرونده (محافظت‌شده با احراز هویت)
              </h3>
              <div className="flex flex-wrap gap-2">
                {data.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={`/api/requests/attachments/${att.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-lg font-semibold"
                  >
                    مشاهده {att.original_name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ستون مشخصات امدادگر، مالی، فاکتور و امتیازدهی */}
        <div className="lg:col-span-5 space-y-6">
          {/* کارت امدادگر اختصاص‌یافته */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 text-xs no-print">
            <h3 className="font-extrabold text-sm text-slate-900">
              وضعیت واحد امدادی اختصاص‌یافته
            </h3>
            {data.responder ? (
              <div className="space-y-2">
                <div className="font-bold text-base text-slate-900">
                  {data.responder.fullName}
                </div>
                <div className="text-slate-600">
                  ناوگان: {EQUIPMENT_TYPE_LABELS[data.responder.equipmentType]} | پلاک:{' '}
                  {data.responder.vehiclePlate || 'ثبت‌شده'}
                </div>
                <div className="flex items-center gap-1 text-amber-600 font-bold">
                  <Star className="w-4 h-4 fill-amber-400" />
                  <span>امتیاز عملکرد: {data.responder.ratingAvg.toLocaleString('fa-IR')} از ۵</span>
                </div>
                {data.responder.phone && (
                  <a
                    href={`tel:${data.responder.phone}`}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 text-white font-bold px-3.5 py-2 rounded-xl mt-1"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>تماس با امدادگر: {data.responder.phone}</span>
                  </a>
                )}
              </div>
            ) : (
              <p className="text-slate-500">
                هنوز امدادگری مأموریت را نپذیرفته است. به محض پذیرش، مشخصات ناوگان و
                موقعیت زنده نمایش داده می‌شود.
              </p>
            )}
          </div>

          {/* کارت شفافیت هزینه و پرداخت */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3.5 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900">
                صورتحساب و جزئیات هزینه (تومان)
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full border font-bold ${
                  data.paymentIsSandbox || data.paymentStatusLabel.includes('راستی‌آزمایی') || data.paymentStatusLabel.includes('بدون مدرک')
                    ? getStatusBadgeClass('pending_gateway')
                    : getStatusBadgeClass(data.paymentStatus)
                }`}
              >
                {data.paymentStatusLabel}
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-600">مبلغ برآورد اولیه زمان ثبت:</span>
                <span className="font-bold">
                  {formatToman(data.pricing.estimatedPriceToman)}
                </span>
              </div>

              {data.pricing.finalPriceToman !== null && (
                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm">
                  <span className="font-extrabold text-slate-900">
                    مبلغ نهایی محاسبه‌شده:
                  </span>
                  <span className="font-black text-emerald-800">
                    {formatToman(data.pricing.finalPriceToman)}
                  </span>
                </div>
              )}

              {data.pricing.priceChangeReason && (
                <div className="text-[11px] bg-amber-50 border border-amber-200 text-amber-950 p-2.5 rounded-lg">
                  <strong>علت تفاوت مبلغ نهایی با برآورد اولیه: </strong>
                  {data.pricing.priceChangeReason}
                </div>
              )}
            </div>

            {/* تأیید تغییر مبلغ توسط مشتری */}
            {isCustomerOwner &&
              data.status === 'Completed' &&
              data.pricing.customerPriceApprovalRequired &&
              !data.pricing.customerPriceApproved && (
                <div className="bg-amber-50 border border-amber-300 p-3.5 rounded-xl space-y-2.5 no-print">
                  <p className="text-amber-950 font-semibold leading-relaxed">
                    مبلغ نهایی به دلیل افزودن قطعات یا مسافت نسبت به برآورد اولیه تغییر
                    کرده است. لطفاً پس از بررسی گزارش امدادگر، صورتحساب را تأیید کنید یا
                    تیکت اعتراض ثبت نمایید.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleApprovePrice()}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold py-2.5 rounded-xl"
                  >
                    مورد تأیید من است — ادامه به پرداخت
                  </button>
                </div>
              )}

            {/* دکمه پرداخت آنلاین */}
            {isCustomerOwner &&
              data.status === 'Completed' &&
              data.paymentStatus !== 'paid' &&
              data.paymentStatus !== 'refunded' &&
              (!data.pricing.customerPriceApprovalRequired ||
                data.pricing.customerPriceApproved) && (
                <button
                  type="button"
                  onClick={() => void handleStartPayment()}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3 rounded-xl text-sm flex items-center justify-center gap-2 no-print"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>
                    پرداخت آنلاین صورتحساب ({formatToman(data.pricing.payableToman)})
                  </span>
                </button>
              )}

            {/* نمایش و چاپ فاکتور رسمی */}
            {data.invoice && (
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900">
                    فاکتور رسمی: {data.invoice.invoiceNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-bold no-print"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>چاپ فاکتور</span>
                  </button>
                </div>
                <div className="space-y-1 text-[11px] text-slate-600">
                  <div className="flex justify-between">
                    <span>جمع اجرت خدمات:</span>
                    <span>{formatToman(data.invoice.subtotalToman)}</span>
                  </div>
                  {data.invoice.discountToman > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>تخفیف:</span>
                      <span>- {formatToman(data.invoice.discountToman)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>بهای قطعات مصرفی:</span>
                    <span>{formatToman(data.invoice.partsToman)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>مالیات و عوارض قانونی:</span>
                    <span>{formatToman(data.invoice.taxToman)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-100">
                    <span>جمع کل قابل پرداخت:</span>
                    <span>{formatToman(data.invoice.totalToman)}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    تاریخ صدور: {formatDateTimeFa(data.invoice.issuedAt)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ثبت امتیاز و نظر مشتری */}
          {isCustomerOwner && data.status === 'Completed' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 text-xs no-print">
              <h3 className="font-extrabold text-sm text-slate-900">
                ارزیابی عملکرد امدادگر
              </h3>
              {data.review ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1">
                  <div className="font-bold text-emerald-900">
                    امتیاز ثبت‌شده شما: {data.review.rating.toLocaleString('fa-IR')} از ۵ ستاره
                  </div>
                  {data.review.comment && (
                    <p className="text-emerald-800">{data.review.comment}</p>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmitReview} className="space-y-3">
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`p-2 rounded-lg border font-bold ${
                          rating >= star
                            ? 'bg-amber-100 border-amber-400 text-amber-800'
                            : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        ★ {star.toLocaleString('fa-IR')}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={2}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="دیدگاه شما درباره سرعت، تخصص و برخورد امدادگر..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                  <button
                    type="submit"
                    className="w-full bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white font-bold py-2.5 rounded-xl transition"
                  >
                    ثبت امتیاز و نظر
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
