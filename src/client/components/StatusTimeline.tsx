import React from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { formatDateTimeFa } from '../lib/format.ts';
import type { RequestState } from '../../shared/constants.ts';

const ORDERED_MAIN_STEPS: Array<{ key: RequestState; label: string }> = [
  { key: 'Submitted', label: 'ثبت درخواست' },
  { key: 'Offered', label: 'ارسال به امدادگر' },
  { key: 'Accepted', label: 'پذیرش مأموریت' },
  { key: 'EnRoute', label: 'حرکت به محل' },
  { key: 'Arrived', label: 'رسیدن به محل' },
  { key: 'InProgress', label: 'شروع خدمت' },
  { key: 'Completed', label: 'تکمیل و فاکتور' },
];

export interface HistoryItem {
  id: number;
  fromStatus: string | null;
  toStatus: RequestState;
  toStatusLabel: string;
  actorRole: string;
  note: string | null;
  createdAt: string;
}

export function StatusTimeline(props: {
  currentStatus: RequestState;
  history: HistoryItem[];
}) {
  const reachedStates = new Set(props.history.map((h) => h.toStatus));
  if (props.currentStatus === 'Searching') {
    reachedStates.add('Submitted');
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-5 shadow-xs">
      <h3 className="font-bold text-sm text-slate-900">زنجیره پیشرفت عملیات</h3>

      {/* نوار مراحل اصلی */}
      <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
        {ORDERED_MAIN_STEPS.map((step, idx) => {
          const done = reachedStates.has(step.key);
          const isCurrent = props.currentStatus === step.key;
          return (
            <div
              key={step.key}
              className={`rounded-xl p-2.5 border text-center text-xs transition ${
                isCurrent
                  ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold'
                  : done
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                {done ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
                <span>{(idx + 1).toLocaleString('fa-IR')}</span>
              </div>
              <div>{step.label}</div>
            </div>
          );
        })}
      </div>

      {/* تاریخچه دقیق رویدادهای ثبت‌شده در پایگاه داده */}
      <div className="border-t border-slate-100 pt-4">
        <div className="text-xs font-bold text-slate-700 mb-2.5">
          سابقه ممیزی تغییرات وضعیت (ثبت‌شده در سرور):
        </div>
        <div className="space-y-2 max-h-52 overflow-y-auto">
          {props.history.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50 px-3 py-2 rounded-lg border border-slate-100"
            >
              <div>
                <span className="font-bold text-slate-900">{item.toStatusLabel}</span>
                {item.note && (
                  <span className="text-slate-600 mr-2">— {item.note}</span>
                )}
              </div>
              <span className="text-[11px] text-slate-400">
                {formatDateTimeFa(item.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
