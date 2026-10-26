export function formatToman(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '—';
  }
  return `${Math.round(amount).toLocaleString('fa-IR')} تومان`;
}

export function formatNumberFa(num: number | null | undefined): string {
  if (num === null || num === undefined || Number.isNaN(num)) return '۰';
  return num.toLocaleString('fa-IR');
}

export function formatDateTimeFa(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'Completed':
    case 'paid':
    case 'active':
    case 'approved':
    case 'resolved':
    case 'approved_paid':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'Accepted':
    case 'EnRoute':
    case 'Arrived':
    case 'InProgress':
    case 'online':
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Submitted':
    case 'Searching':
    case 'Offered':
    case 'pending_approval':
    case 'preparing':
    case 'under_review':
    case 'pending_gateway':
    case 'open':
    case 'requested':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'Cancelled':
    case 'Failed':
    case 'failed':
    case 'rejected':
    case 'suspended':
    case 'inactive':
    case 'escalated_to_admin':
    case 'UnderSupportReview':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}
