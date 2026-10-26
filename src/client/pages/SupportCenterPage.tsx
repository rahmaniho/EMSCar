import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Headphones, Send, PlusCircle } from 'lucide-react';
import { useAuth } from '../lib/auth-context.tsx';
import { apiFetch } from '../lib/api.ts';
import { formatDateTimeFa, getStatusBadgeClass } from '../lib/format.ts';

interface TicketListItem {
  id: number;
  ticket_number: string;
  request_id: number | null;
  tracking_code: string | null;
  category: string;
  priority: string;
  subject: string;
  status: string;
  statusLabel: string;
  created_at: string;
}

interface TicketDetailData {
  id: number;
  ticketNumber: string;
  requestId: number | null;
  trackingCode: string | null;
  subject: string;
  status: string;
  statusLabel: string;
  resolutionSummary: string | null;
  messages: Array<{
    id: number;
    body: string;
    sender_name: string;
    sender_role: string;
    created_at: string;
  }>;
}

export function SupportCenterPage() {
  const { user, systemInfo } = useAuth();
  const [searchParams] = useSearchParams();
  const initialReqId = searchParams.get('requestId') || '';
  const supportTelHref = systemInfo?.supportHotline?.replace(/[^+\d]/g, '');
  const publicOperationsEnabled = Boolean(
    systemInfo?.isProduction && systemInfo.publicOperationsEnabled
  );

  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetailData | null>(null);
  const [replyText, setReplyText] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const [form, setForm] = useState({
    requestId: initialReqId,
    category: 'general',
    subject: '',
    message: '',
  });

  const loadTickets = async () => {
    if (!user) return;
    try {
      const res = await apiFetch<{ tickets: TicketListItem[] }>(
        '/api/support/tickets'
      );
      setTickets(res.tickets);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void loadTickets();
  }, [user]);

  const openTicket = async (id: number) => {
    try {
      const res = await apiFetch<{ ticket: TicketDetailData }>(
        `/api/support/tickets/${id}`
      );
      setSelectedTicket(res.ticket);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'خطا در مشاهده تیکت');
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await apiFetch<{ ticket: TicketDetailData }>(
        '/api/support/tickets',
        {
          method: 'POST',
          body: JSON.stringify({
            requestId: form.requestId ? Number(form.requestId) : null,
            category: form.category,
            subject: form.subject,
            message: form.message,
          }),
        }
      );
      setForm({ requestId: '', category: 'general', subject: '', message: '' });
      setFeedback(
        publicOperationsEnabled
          ? 'تیکت در سامانه ثبت شد و در صف رسیدگی قرار گرفت؛ زمان پاسخ‌گویی فقط در صورت اعلام SLA رسمی معتبر است.'
          : 'تیکت در محیط پیش از بهره‌برداری ثبت شد؛ اپراتور یا زمان پاسخ‌گویی واقعی تضمین نشده است.'
      );
      await loadTickets();
      setSelectedTicket(res.ticket);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'خطا در ثبت تیکت');
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;
    try {
      const res = await apiFetch<{ ticket: TicketDetailData }>(
        `/api/support/tickets/${selectedTicket.id}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ body: replyText }),
        }
      );
      setSelectedTicket(res.ticket);
      setReplyText('');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'خطا در ارسال پیام');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="bg-slate-900 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <Headphones className="w-6 h-6 text-amber-400" />
            مرکز پشتیبانی، شکایات و رسیدگی به اختلافات
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            {supportTelHref ? (
              <a className="underline" href={`tel:${supportTelHref}`}>
                شماره تماس ثبت‌شده: {systemInfo?.supportHotline}
              </a>
            ) : (
              'شماره تماس عمومی پس از تأیید شماره واقعی اعلام می‌شود.'
            )}
            {!publicOperationsEnabled &&
              ' این سامانه هنوز در مرحله پیش از بهره‌برداری عمومی است؛ پاسخ‌گویی فوری یا ۲۴ساعته تضمین نشده است.'}
          </p>
        </div>
      </div>

      {!user ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
          <p className="text-sm text-slate-700 font-semibold">
            برای ثبت تیکت رسمی پشتیبانی یا پیگیری شکایت مرتبط با مأموریت، ابتدا وارد حساب
            کاربری شوید.
          </p>
          <Link
            to="/auth?redirect=/support"
            className="inline-block bg-amber-500 text-slate-950 font-extrabold text-xs px-5 py-2.5 rounded-xl"
          >
            ورود به حساب کاربری
          </Link>
        </div>
      ) : (
        <>
          {feedback && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-4 rounded-xl text-xs font-bold">
              {feedback}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
            {/* فرم ثبت شکایت یا تیکت */}
            <form
              onSubmit={handleCreateTicket}
              className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 space-y-3.5 h-fit"
            >
              <h2 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-amber-500" />
                ثبت درخواست پشتیبانی یا شکایت رسمی
              </h2>

              <div>
                <label className="font-bold block mb-1">دسته‌بندی موضوع *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="delay">تأخیر در اعزام یا رسیدن امدادگر</option>
                  <option value="pricing_dispute">اعتراض به تعرفه یا هزینه قطعات</option>
                  <option value="service_quality">کیفیت فنی یا رفتار حرفه‌ای</option>
                  <option value="damage_claim">ادعای خسارت حین حمل یا تعمیر</option>
                  <option value="payment_issue">مشکل پرداخت یا درخواست بازپرداخت</option>
                  <option value="general">سؤال عمومی</option>
                </select>
              </div>

              <div>
                <label className="font-bold block mb-1">
                  شناسه عددی مأموریت مرتبط (اختیاری)
                </label>
                <input
                  type="number"
                  value={form.requestId}
                  onChange={(e) => setForm({ ...form, requestId: e.target.value })}
                  placeholder="مثال: 1"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">عنوان موضوع *</label>
                <input
                  type="text"
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="خلاصه موضوع شکایت یا پیگیری"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">شرح کامل *</label>
                <textarea
                  rows={4}
                  required
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="جزئیات کامل حادثه یا درخواست خود را بنویسید..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-white font-extrabold py-2.5 rounded-xl transition"
              >
                ثبت تیکت پشتیبانی
              </button>
            </form>

            {/* لیست تیکت‌ها و گفت‌وگو */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <h2 className="font-extrabold text-sm text-slate-900">
                  پرونده‌های پشتیبانی شما ({tickets.length.toLocaleString('fa-IR')})
                </h2>
                {tickets.length === 0 ? (
                  <p className="text-slate-500">تیکتی ثبت نشده است.</p>
                ) : (
                  <div className="space-y-2">
                    {tickets.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => void openTicket(t.id)}
                        className={`w-full text-right p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 transition ${
                          selectedTicket?.id === t.id
                            ? 'bg-amber-50 border-amber-400'
                            : 'bg-slate-50 border-slate-200 hover:bg-white'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-900">
                            {t.subject} ({t.ticket_number})
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {formatDateTimeFa(t.created_at)}
                            {t.tracking_code ? ` | مأموریت ${t.tracking_code}` : ''}
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full border font-bold ${getStatusBadgeClass(t.status)}`}
                        >
                          {t.statusLabel}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedTicket && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <div className="font-extrabold text-sm text-slate-900">
                        گفت‌وگوی پرونده {selectedTicket.ticketNumber}:{' '}
                        {selectedTicket.subject}
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full border font-bold ${getStatusBadgeClass(selectedTicket.status)}`}
                    >
                      {selectedTicket.statusLabel}
                    </span>
                  </div>

                  {selectedTicket.resolutionSummary && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-3 rounded-xl">
                      <strong>نتیجه رسیدگی نهایی: </strong>
                      {selectedTicket.resolutionSummary}
                    </div>
                  )}

                  <div className="space-y-2.5 max-h-64 overflow-y-auto">
                    {selectedTicket.messages.map((m) => (
                      <div
                        key={m.id}
                        className={`p-3 rounded-xl border ${
                          m.sender_role === 'operator' || m.sender_role === 'admin'
                            ? 'bg-blue-50/70 border-blue-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                          <span className="font-bold text-slate-800">
                            {m.sender_name} ({m.sender_role})
                          </span>
                          <span>{formatDateTimeFa(m.created_at)}</span>
                        </div>
                        <p className="text-slate-800 leading-relaxed">{m.body}</p>
                      </div>
                    ))}
                  </div>

                  {selectedTicket.status !== 'closed' && (
                    <form onSubmit={handleSendReply} className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="پیام تکمیلی خود را بنویسید..."
                        className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2"
                      />
                      <button
                        type="submit"
                        className="bg-slate-900 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1"
                      >
                        <Send className="w-3.5 h-3.5" />
                        ارسال
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
