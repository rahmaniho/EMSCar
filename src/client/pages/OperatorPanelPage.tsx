import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Headphones,
  Radio,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  Lock,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { useRealtimeEvents } from '../lib/use-realtime.ts';
import {
  formatDateTimeFa,
  formatToman,
  getStatusBadgeClass,
} from '../lib/format.ts';
import { REQUEST_STATE_LABELS, type RequestState } from '../../shared/constants.ts';

interface StaffQueueItem {
  id: number;
  tracking_code: string;
  status: RequestState;
  payment_status: string;
  payment_is_sandbox: number | null;
  has_verified_refund: number;
  operator_escalation_required: number;
  operator_escalation_reason: string | null;
  customer_name: string;
  customer_phone: string;
  service_title: string;
  zone_name: string;
  estimated_price_toman: number;
  final_price_toman: number | null;
  responder_name: string | null;
  created_at: string;
}

interface CandidateResponder {
  responderId: number;
  fullName: string;
  equipmentType: string;
  distanceKm: number;
  etaMinutes: number;
  score: number;
}

interface TicketItem {
  id: number;
  ticket_number: string;
  request_id: number | null;
  tracking_code: string | null;
  category: string;
  priority: string;
  subject: string;
  status: string;
  statusLabel: string;
  creator_name: string;
  creator_phone: string;
  created_at: string;
}

interface TicketDetail {
  id: number;
  ticketNumber: string;
  requestId: number | null;
  trackingCode: string | null;
  subject: string;
  status: string;
  statusLabel: string;
  escalatedReason?: string | null;
  resolutionSummary: string | null;
  messages: Array<{
    id: number;
    body: string;
    sender_name: string;
    sender_role: string;
    created_at: string;
  }>;
  internalNotes?: Array<{
    id: number;
    note: string;
    author_name: string;
    author_role: string;
    created_at: string;
  }>;
}

interface ReadinessProvince {
  provinceId: number;
  nameFa: string;
  status: string;
  statusLabel: string;
  approvedRespondersCount: number;
  activeZonesCount: number;
}

export function OperatorPanelPage() {
  const [activeTab, setActiveTab] = useState<'dispatch' | 'tickets' | 'readiness'>(
    'dispatch'
  );
  const [queue, setQueue] = useState<StaffQueueItem[]>([]);
  const [postpayDebtEnabled, setPostpayDebtEnabled] = useState(false);
  const [debtTargetRequestId, setDebtTargetRequestId] = useState<number | null>(null);
  const [debtReason, setDebtReason] = useState('');
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [readiness, setReadiness] = useState<ReadinessProvince[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [escalatedOnly, setEscalatedOnly] = useState(false);

  const [candidatesByReq, setCandidatesByReq] = useState<
    Record<number, CandidateResponder[]>
  >({});
  const [manualAssignSelection, setManualAssignSelection] = useState<
    Record<number, string>
  >({});

  const [replyBody, setReplyBody] = useState('');
  const [internalNoteText, setInternalNoteText] = useState('');
  const [escalateReason, setEscalateReason] = useState('');
  const [resolveNote, setResolveNote] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadAll = async () => {
    setErrorMsg(null);
    try {
      const qs = new URLSearchParams();
      if (statusFilter) qs.set('status', statusFilter);
      if (escalatedOnly) qs.set('escalated', 'true');
      const queryStr = qs.toString() ? `?${qs.toString()}` : '';

      const [qRes, tRes, rRes, capabilityRes] = await Promise.all([
        apiFetch<{ queue: StaffQueueItem[] }>(`/api/requests/staff/queue${queryStr}`),
        apiFetch<{ tickets: TicketItem[] }>('/api/support/tickets'),
        apiFetch<{ readiness: ReadinessProvince[] }>('/api/geography/admin/readiness'),
        apiFetch<{ postpayDebtEnabled: boolean }>('/api/payments/staff/capabilities'),
      ]);
      setQueue(qRes.queue);
      setTickets(tRes.tickets);
      setReadiness(rRes.readiness);
      setPostpayDebtEnabled(capabilityRes.postpayDebtEnabled);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'خطا در بارگذاری میز فرماندهی اپراتور'
      );
    }
  };

  useEffect(() => {
    void loadAll();
  }, [statusFilter, escalatedOnly]);

  useRealtimeEvents(true, () => {
    void loadAll();
  });

  const handleStaffTransition = async (
    requestId: number,
    toStatus: RequestState
  ) => {
    setFeedback(null);
    setErrorMsg(null);
    try {
      await apiFetch(`/api/requests/${requestId}/staff-transition`, {
        method: 'POST',
        body: JSON.stringify({
          toStatus,
          note: `تغییر وضعیت کنترلی توسط اپراتور مرکز پیام به ${toStatus}`,
        }),
      });
      setFeedback(`وضعیت مأموریت به «${REQUEST_STATE_LABELS[toStatus] || toStatus}» تغییر یافت.`);
      await loadAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در تغییر وضعیت کنترلی');
    }
  };

  const handleLoadCandidates = async (requestId: number) => {
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ candidates: CandidateResponder[] }>(
        `/api/requests/${requestId}/eligible-responders`
      );
      setCandidatesByReq((prev) => ({ ...prev, [requestId]: res.candidates }));
      if (res.candidates.length === 0) {
        setFeedback('امدادگر آنلاین واجد شرایطی در این لحظه یافت نشد.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در جستجوی امدادگران واجد شرایط');
    }
  };

  const handleRedispatch = async (requestId: number) => {
    setFeedback(null);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{
        result: { dispatched: boolean; reasonFa?: string };
      }>(`/api/requests/${requestId}/redispatch`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setFeedback(
        res.result.dispatched
          ? 'پیشنهاد مأموریت به بهترین امدادگر واجد شرایط ارسال شد.'
          : res.result.reasonFa || 'امدادگر آزادی یافت نشد؛ پرونده در صف اپراتور باقی ماند.'
      );
      await loadAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در اجرای مجدد دیسپچ هوشمند');
    }
  };

  const handleManualAssign = async (requestId: number) => {
    const respId = Number(manualAssignSelection[requestId]);
    if (!respId) return;
    setFeedback(null);
    setErrorMsg(null);
    try {
      await apiFetch(`/api/requests/${requestId}/staff-assign`, {
        method: 'POST',
        body: JSON.stringify({ responderId: respId }),
      });
      setFeedback('مأموریت به‌صورت دستی به امدادگر انتخاب‌شده اختصاص یافت.');
      await loadAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در تخصیص دستی امدادگر');
    }
  };

  const handleApproveEmergencyDebt = async (requestId: number, reason: string) => {
    setFeedback(null);
    setErrorMsg(null);
    try {
      const result = await apiFetch<{
        amountToman: number;
        paymentReceived: false;
      }>('/api/payments/staff/approve-debt', {
        method: 'POST',
        body: JSON.stringify({ requestId, reason: reason.trim() }),
      });
      setDebtTargetRequestId(null);
      setDebtReason('');
      setFeedback(
        `بدهی ${formatToman(result.amountToman)} برای پیگیری ثبت شد؛ هیچ وجهی دریافت یا پرداخت تأیید نشد.`
      );
      await loadAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در ثبت بدهی پس‌پرداخت');
    }
  };

  const openTicketDetail = async (ticketId: number) => {
    try {
      const res = await apiFetch<{ ticket: TicketDetail }>(
        `/api/support/tickets/${ticketId}`
      );
      setSelectedTicket(res.ticket);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در دریافت جزئیات پرونده');
    }
  };

  const handleSendPublicReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyBody.trim()) return;
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ ticket: TicketDetail }>(
        `/api/support/tickets/${selectedTicket.id}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ body: replyBody }),
        }
      );
      setSelectedTicket(res.ticket);
      setReplyBody('');
      setFeedback('پاسخ رسمی پشتیبانی برای کاربر ارسال شد.');
      await loadAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در ارسال پاسخ');
    }
  };

  const handleAddInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !internalNoteText.trim()) return;
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ ticket: TicketDetail }>(
        `/api/support/tickets/${selectedTicket.id}/internal-notes`,
        {
          method: 'POST',
          body: JSON.stringify({ note: internalNoteText }),
        }
      );
      setSelectedTicket(res.ticket);
      setInternalNoteText('');
      setFeedback('یادداشت داخلی محرمانه اپراتور ثبت شد (کاملاً مخفی از دید مشتری).');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در ثبت یادداشت داخلی');
    }
  };

  const handleEscalateTicket = async () => {
    if (!selectedTicket || !escalateReason.trim()) {
      setErrorMsg('لطفاً علت ارجاع پرونده به مدیر کل را وارد کنید.');
      return;
    }
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ ticket: TicketDetail }>(
        `/api/support/tickets/${selectedTicket.id}/escalate`,
        {
          method: 'POST',
          body: JSON.stringify({
            reason: escalateReason,
            placeRequestUnderReview: true,
          }),
        }
      );
      setSelectedTicket(res.ticket);
      setEscalateReason('');
      setFeedback('پرونده به مدیر ارشد ارجاع شد و مأموریت در وضعیت بررسی پشتیبانی قرار گرفت.');
      await loadAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در ارجاع تیکت');
    }
  };

  const handleResolveTicket = async () => {
    if (!selectedTicket || !resolveNote.trim()) {
      setErrorMsg('ثبت خلاصه نتیجه رسیدگی برای بستن/حل‌وفصل پرونده الزامی است.');
      return;
    }
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ ticket: TicketDetail }>(
        `/api/support/tickets/${selectedTicket.id}/resolve`,
        {
          method: 'POST',
          body: JSON.stringify({ resolutionSummary: resolveNote }),
        }
      );
      setSelectedTicket(res.ticket);
      setResolveNote('');
      setFeedback('پرونده پشتیبانی با موفقیت حل‌وفصل شد.');
      await loadAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در حل‌وفصل تیکت');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="bg-slate-900 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <Radio className="w-6 h-6 text-amber-400" />
            میز فرماندهی مرکز پیام و عملیات (استان قزوین)
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            پایش صف زنده مأموریت‌ها، مدیریت موارد بدون امدادگر، یادداشت‌های محرمانه اپراتور و
            رسیدگی به شکایات
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadAll()}
          className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5"
        >
          <RefreshCw className="w-4 h-4" />
          بروزرسانی صف زنده
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

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          {
            id: 'dispatch',
            label: `صف مأموریت‌ها (${queue.length.toLocaleString('fa-IR')})`,
          },
          {
            id: 'tickets',
            label: `تیکت‌ها و اختلافات (${tickets.length.toLocaleString('fa-IR')})`,
          },
          {
            id: 'readiness',
            label: 'ظرفیت عملیاتی مناطق پوشش',
          },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === t.id
                ? 'bg-slate-900 text-amber-400'
                : 'bg-white border border-slate-200 text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* تب صف مأموریت‌ها */}
      {activeTab === 'dispatch' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-700">فیلتر وضعیت:</span>
              {[
                { v: '', l: 'همه' },
                { v: 'Searching', l: 'در حال جستجو' },
                { v: 'UnderSupportReview', l: 'در بررسی پشتیبانی' },
                { v: 'Offered', l: 'پیشنهاد شده' },
                { v: 'InProgress', l: 'در حال انجام' },
                { v: 'Completed', l: 'تکمیل‌شده' },
              ].map((f) => (
                <button
                  key={f.v}
                  type="button"
                  onClick={() => setStatusFilter(f.v)}
                  className={`px-3 py-1.5 rounded-lg border font-bold ${
                    statusFilter === f.v
                      ? 'bg-amber-500 border-amber-500 text-slate-950'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  {f.l}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 font-bold text-rose-800 cursor-pointer">
              <input
                type="checkbox"
                checked={escalatedOnly}
                onChange={(e) => setEscalatedOnly(e.target.checked)}
                className="w-4 h-4 accent-rose-600"
              />
              فقط پرونده‌های نیازمند مداخله اپراتور
            </label>
          </div>

          <div className="space-y-3">
            {queue.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                مأموریتی با فیلتر انتخابی در صف عملیات وجود ندارد.
              </div>
            ) : (
              queue.map((r) => {
                const candidates = candidatesByReq[r.id] || [];
                return (
                  <div
                    key={r.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 text-xs"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900">
                            {r.service_title}
                          </span>
                          <span className="font-mono text-slate-500">
                            ({r.tracking_code})
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full border font-bold ${getStatusBadgeClass(r.status)}`}
                          >
                            {REQUEST_STATE_LABELS[r.status] || r.status}
                          </span>
                          {r.operator_escalation_required === 1 && (
                            <span className="bg-rose-100 text-rose-900 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              نیازمند پیگیری اپراتور:{' '}
                              {r.operator_escalation_reason || 'عدم یافتن خودکار امدادگر'}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600">
                          محدوده: <strong>{r.zone_name}</strong> | مشتری:{' '}
                          <strong>
                            {r.customer_name} ({r.customer_phone})
                          </strong>{' '}
                          | امدادگر:{' '}
                          <strong>{r.responder_name || 'تخصیص نیافته'}</strong>
                        </div>
                        <div className="text-slate-500">
                          مبلغ: {formatToman(r.final_price_toman ?? r.estimated_price_toman)} |
                          وضعیت پرداخت:{' '}
                          <strong>
                            {r.payment_is_sandbox === 1
                              ? 'Sandbox آزمایشی؛ وجه واقعی جابه‌جا نشده'
                              : ['refunded', 'partially_refunded'].includes(r.payment_status) && r.has_verified_refund !== 1
                                ? 'بازپرداخت قدیمی/راستی‌آزمایی‌نشده'
                                : r.payment_status === 'paid' && r.payment_is_sandbox === null
                                  ? 'پرداخت قدیمی/بدون مدرک provider'
                                  : r.payment_status === 'approved_debt'
                                    ? 'بدهی ثبت‌شده؛ وجه دریافت نشده'
                                    : r.payment_status}
                          </strong>{' '}| ثبت:{' '}
                          {formatDateTimeFa(r.created_at)}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {['Submitted', 'Searching', 'UnderSupportReview'].includes(
                          r.status
                        ) && (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleRedispatch(r.id)}
                              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-3 py-2 rounded-xl"
                            >
                              جستجوی مجدد خودکار
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleLoadCandidates(r.id)}
                              className="bg-slate-800 text-white font-bold px-3 py-2 rounded-xl"
                            >
                              یافتن کاندیداهای تخصیص دستی
                            </button>
                          </>
                        )}

                        {postpayDebtEnabled &&
                          r.status === 'Completed' &&
                          ['unpaid', 'failed'].includes(r.payment_status) && (
                            <button
                              type="button"
                              onClick={() => {
                                setDebtTargetRequestId((current) =>
                                  current === r.id ? null : r.id
                                );
                                setDebtReason('');
                              }}
                              className="bg-indigo-100 hover:bg-indigo-200 text-indigo-950 font-bold px-3 py-2 rounded-xl"
                            >
                              {debtTargetRequestId === r.id
                                ? 'بستن فرم بدهی'
                                : 'ثبت بدهی پس‌پرداخت'}
                            </button>
                          )}

                        {![
                          'Completed',
                          'Cancelled',
                          'Failed',
                          'UnderSupportReview',
                        ].includes(r.status) && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleStaffTransition(r.id, 'UnderSupportReview')
                            }
                            className="bg-purple-100 hover:bg-purple-200 text-purple-950 font-bold px-3 py-2 rounded-xl"
                          >
                            تعلیق جهت بررسی پشتیبانی
                          </button>
                        )}

                        <Link
                          to={`/requests/${r.id}`}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold px-3.5 py-2 rounded-xl"
                        >
                          جزئیات کامل مأموریت
                        </Link>
                      </div>
                    </div>

                    {debtTargetRequestId === r.id && (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void handleApproveEmergencyDebt(r.id, debtReason);
                        }}
                        className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3"
                      >
                        <label className="block font-bold text-indigo-950" htmlFor={`debt-reason-${r.id}`}>
                          دلیل واقعی و قابل ممیزی برای ثبت بدهی پس‌پرداخت
                        </label>
                        <textarea
                          id={`debt-reason-${r.id}`}
                          required
                          minLength={5}
                          maxLength={500}
                          value={debtReason}
                          onChange={(event) => setDebtReason(event.target.value)}
                          placeholder="علت واقعی را بنویسید؛ متن نمونه یا دلیل از پیش‌فرض ثبت نمی‌شود."
                          className="w-full rounded-lg border border-indigo-200 bg-white p-3"
                          rows={3}
                        />
                        <p className="text-indigo-900">
                          ثبت فقط برای خدمت تکمیل‌شده و فاکتور صادرشده ممکن است. این اقدام وجهی دریافت نمی‌کند و پرداخت را تأیید نمی‌کند.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={debtReason.trim().length < 5}
                            className="rounded-lg bg-indigo-700 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            ثبت وضعیت بدهی
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDebtTargetRequestId(null);
                              setDebtReason('');
                            }}
                            className="rounded-lg bg-white px-4 py-2 font-bold text-slate-800"
                          >
                            انصراف
                          </button>
                        </div>
                      </form>
                    )}

                    {candidates.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                        <select
                          value={manualAssignSelection[r.id] || ''}
                          onChange={(e) =>
                            setManualAssignSelection({
                              ...manualAssignSelection,
                              [r.id]: e.target.value,
                            })
                          }
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2"
                        >
                          <option value="">انتخاب امدادگر واجد شرایط...</option>
                          {candidates.map((c) => (
                            <option key={c.responderId} value={c.responderId}>
                              {c.fullName} — فاصله {c.distanceKm}km (ETA حدود {c.etaMinutes}{' '}
                              دقیقه | امتیاز {c.score})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void handleManualAssign(r.id)}
                          className="bg-emerald-600 text-white font-extrabold px-4 py-2 rounded-xl"
                        >
                          تخصیص قطعی توسط اپراتور
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* تب تیکت‌ها و یادداشت‌های محرمانه اپراتور */}
      {activeTab === 'tickets' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 space-y-2.5 h-fit">
            <h2 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
              <Headphones className="w-4 h-4 text-amber-500" />
              پرونده‌های پشتیبانی و شکایات
            </h2>
            {tickets.length === 0 ? (
              <p className="text-slate-500">پرونده‌ای ثبت نشده است.</p>
            ) : (
              tickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => void openTicketDetail(t.id)}
                  className={`w-full text-right p-3.5 rounded-xl border transition ${
                    selectedTicket?.id === t.id
                      ? 'bg-amber-50 border-amber-400'
                      : 'bg-slate-50 border-slate-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">{t.subject}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full border font-bold ${getStatusBadgeClass(t.status)}`}
                    >
                      {t.statusLabel}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {t.creator_name} ({t.creator_phone}) | {t.ticket_number}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="lg:col-span-7">
            {!selectedTicket ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
                یک پرونده را برای مشاهده مکاتبات، ثبت یادداشت داخلی محرمانه یا ارجاع به مدیر
                کل انتخاب کنید.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="font-extrabold text-sm text-slate-900">
                      {selectedTicket.ticketNumber}: {selectedTicket.subject}
                    </div>
                    {selectedTicket.trackingCode && (
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        مرتبط با مأموریت: {selectedTicket.trackingCode}
                      </div>
                    )}
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full border font-bold ${getStatusBadgeClass(selectedTicket.status)}`}
                  >
                    {selectedTicket.statusLabel}
                  </span>
                </div>

                {/* پیام‌های قابل مشاهده برای مشتری */}
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {selectedTicket.messages.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200"
                    >
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span className="font-bold text-slate-900">
                          {m.sender_name} ({m.sender_role})
                        </span>
                        <span>{formatDateTimeFa(m.created_at)}</span>
                      </div>
                      <p className="text-slate-800">{m.body}</p>
                    </div>
                  ))}
                </div>

                {/* یادداشت‌های محرمانه داخلی اپراتور */}
                <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-3.5 space-y-2">
                  <div className="font-extrabold text-amber-950 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    یادداشت‌های داخلی محرمانه اپراتور (غیرقابل رویت برای مشتری و امدادگر)
                  </div>
                  {(selectedTicket.internalNotes || []).map((n) => (
                    <div
                      key={n.id}
                      className="bg-white p-2.5 rounded-lg border border-amber-200"
                    >
                      <div className="text-[11px] text-slate-500 flex justify-between">
                        <span className="font-bold text-amber-900">{n.author_name}</span>
                        <span>{formatDateTimeFa(n.created_at)}</span>
                      </div>
                      <p className="text-slate-800 mt-0.5">{n.note}</p>
                    </div>
                  ))}
                  <form onSubmit={handleAddInternalNote} className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={internalNoteText}
                      onChange={(e) => setInternalNoteText(e.target.value)}
                      placeholder="ثبت یادداشت محرمانه داخلی..."
                      className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-1.5"
                    />
                    <button
                      type="submit"
                      className="bg-amber-600 text-white font-bold px-3 py-1.5 rounded-lg"
                    >
                      ثبت یادداشت محرمانه
                    </button>
                  </form>
                </div>

                {/* فرم ارسال پاسخ رسمی به کاربر */}
                <form onSubmit={handleSendPublicReply} className="flex gap-2">
                  <input
                    type="text"
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="ارسال پاسخ رسمی به کاربر..."
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2"
                  />
                  <button
                    type="submit"
                    className="bg-slate-900 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    ارسال پاسخ
                  </button>
                </form>

                {/* ارجاع به مدیر کل یا حل‌وفصل */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={escalateReason}
                      onChange={(e) => setEscalateReason(e.target.value)}
                      placeholder="علت ارجاع به مدیر ارشد..."
                      className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={() => void handleEscalateTicket()}
                      className="w-full bg-rose-100 hover:bg-rose-200 text-rose-950 font-bold py-2 rounded-xl flex items-center justify-center gap-1"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      ارجاع به مدیر کل + توقف بررسی مأموریت
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={resolveNote}
                      onChange={(e) => setResolveNote(e.target.value)}
                      placeholder="جمع‌بندی حل‌وفصل پرونده..."
                      className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={() => void handleResolveTicket()}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ثبت حل‌وفصل نهایی تیکت
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* تب ظرفیت عملیاتی استان‌ها */}
      {activeTab === 'readiness' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {readiness.map((p) => (
            <div
              key={p.provinceId}
              className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm text-slate-900">{p.nameFa}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold ${
                    p.status === 'active'
                      ? 'bg-emerald-100 text-emerald-900'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {p.statusLabel}
                </span>
              </div>
              <div className="text-slate-600">
                زون‌های فعال: <strong>{p.activeZonesCount}</strong> | امدادگران تأییدشده:{' '}
                <strong>{p.approvedRespondersCount}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
