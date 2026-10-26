export const BRAND_IDENTITY = {
  persianName: 'اورژانس خودرو',
  suggestedEnglishName: 'Auto Emergency',
  englishNameDisclaimer:
    'نام انگلیسی «Auto Emergency» صرفاً یک عنوان پیشنهادی کاری است و بدون بررسی حقوقی مالکیت علامت تجاری و دامنه، نام تجاری ثبت‌شده محسوب نمی‌شود.',
  initialLaunchProvinceSlug: 'qazvin',
  initialLaunchProvinceName: 'قزوین',
  currencyUnit: 'TOMAN' as const,
  currencyLabel: 'تومان',
};

export const USER_ROLES = ['customer', 'responder', 'operator', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  customer: 'مشتری',
  responder: 'امدادگر',
  operator: 'اپراتور مرکز پیام',
  admin: 'مدیر کل',
};

export const GEOGRAPHY_STATUSES = [
  'preparing',
  'pending_approval',
  'active',
  'inactive',
] as const;
export type GeographyStatus = (typeof GEOGRAPHY_STATUSES)[number];

export const GEOGRAPHY_STATUS_LABELS: Record<GeographyStatus, string> = {
  preparing: 'در حال آماده‌سازی',
  pending_approval: 'در انتظار تأیید',
  active: 'فعال',
  inactive: 'غیرفعال',
};

export const REQUEST_STATES = [
  'Draft',
  'Submitted',
  'Searching',
  'Offered',
  'Accepted',
  'EnRoute',
  'Arrived',
  'InProgress',
  'Completed',
  'Cancelled',
  'Failed',
  'UnderSupportReview',
] as const;
export type RequestState = (typeof REQUEST_STATES)[number];

export const REQUEST_STATE_LABELS: Record<RequestState, string> = {
  Draft: 'پیش‌نویس',
  Submitted: 'ثبت‌شده',
  Searching: 'در حال جستجوی امدادگر',
  Offered: 'پیشنهاد ارسال‌شده به امدادگر',
  Accepted: 'پذیرفته‌شده توسط امدادگر',
  EnRoute: 'امدادگر در مسیر محل',
  Arrived: 'رسیدن امدادگر به محل',
  InProgress: 'در حال انجام خدمت',
  Completed: 'تکمیل‌شده',
  Cancelled: 'لغوشده',
  Failed: 'ناموفق',
  UnderSupportReview: 'در حال بررسی پشتیبانی',
};

export const ALLOWED_REQUEST_TRANSITIONS: Record<RequestState, readonly RequestState[]> = {
  Draft: ['Submitted', 'Cancelled'],
  Submitted: ['Searching', 'Cancelled', 'UnderSupportReview'],
  Searching: ['Offered', 'Accepted', 'Cancelled', 'Failed', 'UnderSupportReview'],
  Offered: ['Accepted', 'Searching', 'Cancelled', 'Failed', 'UnderSupportReview'],
  Accepted: ['EnRoute', 'Searching', 'Cancelled', 'UnderSupportReview'],
  EnRoute: ['Arrived', 'Cancelled', 'UnderSupportReview'],
  Arrived: ['InProgress', 'Cancelled', 'UnderSupportReview'],
  InProgress: ['Completed', 'Failed', 'UnderSupportReview'],
  Completed: ['UnderSupportReview'],
  Cancelled: [],
  Failed: ['Searching', 'UnderSupportReview'],
  UnderSupportReview: ['Searching', 'InProgress', 'Completed', 'Cancelled', 'Failed'],
};

export const ACTIVE_CUSTOMER_MISSION_STATES: readonly RequestState[] = [
  'Submitted',
  'Searching',
  'Offered',
  'Accepted',
  'EnRoute',
  'Arrived',
  'InProgress',
  'UnderSupportReview',
];

export const RESPONDER_BUSY_STATES: readonly RequestState[] = [
  'Accepted',
  'EnRoute',
  'Arrived',
  'InProgress',
];

export const CANCELLABLE_BY_CUSTOMER_STATES: readonly RequestState[] = [
  'Draft',
  'Submitted',
  'Searching',
  'Offered',
  'Accepted',
  'EnRoute',
  'Arrived',
];

export const VEHICLE_CATEGORIES = [
  'domestic',
  'foreign',
  'electric',
  'suv_heavy',
] as const;
export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number];

export const VEHICLE_CATEGORY_LABELS: Record<VehicleCategory, string> = {
  domestic: 'خودروی سواری داخلی',
  foreign: 'خودروی سواری خارجی / وارداتی',
  electric: 'خودروی برقی / هیبریدی پلاگین',
  suv_heavy: 'شاسی‌بلند سنگین / وانت',
};

export const EQUIPMENT_TYPES = [
  'motorcycle',
  'service_van',
  'wheel_lift_tow',
  'flatbed_tow',
  'ev_specialist_unit',
] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  motorcycle: 'موتورسیکلت امدادی سریع',
  service_van: 'خودروی کارگاهی سیار',
  wheel_lift_tow: 'یدک‌کش چرخ‌گیر استاندارد',
  flatbed_tow: 'کفی خودروبر هیدرولیک',
  ev_specialist_unit: 'واحد تخصصی خودروهای برقی (HV)',
};

export const VERIFICATION_STATUSES = [
  'pending_documents',
  'under_review',
  'approved',
  'rejected',
  'suspended',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  pending_documents: 'در انتظار تکمیل مدارک',
  under_review: 'در حال بررسی مدارک',
  approved: 'تأییدشده و مجاز به فعالیت',
  rejected: 'ردشده (نیازمند اصلاح)',
  suspended: 'تعلیق عملیاتی',
};

export const SERVICE_CATEGORIES = [
  'battery_electrical',
  'tire_wheel',
  'fuel_lock',
  'diagnostics_repair',
  'towing_transport',
  'specialized_fleet',
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  battery_electrical: 'باتری و برق خودرو',
  tire_wheel: 'چرخ و لاستیک',
  fuel_lock: 'سوخت‌رسانی و بازگشایی مجاز',
  diagnostics_repair: 'عیب‌یابی و تعمیرات در محل',
  towing_transport: 'یدک‌کش و حمل خودرو',
  specialized_fleet: 'خدمات تخصصی خودروهای خاص و برقی',
};

export const PAYMENT_STATUSES = [
  'unpaid',
  'pending_gateway',
  'paid',
  'failed',
  'refunded',
  'partially_refunded',
  'approved_debt',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'پرداخت‌نشده',
  pending_gateway: 'در انتظار تأیید درگاه',
  paid: 'پرداخت‌شده (تأیید سرور)',
  failed: 'پرداخت ناموفق',
  refunded: 'وضعیت بازپرداخت ثبت‌شده؛ مبلغ نیازمند تطبیق',
  partially_refunded: 'وضعیت بازپرداخت جزئی ثبت‌شده؛ مبلغ نیازمند تطبیق',
  approved_debt: 'بدهی مجاز ثبت‌شده؛ وجه دریافت نشده',
};

export const TICKET_STATUSES = [
  'open',
  'in_progress',
  'escalated_to_admin',
  'resolved',
  'closed',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'باز',
  in_progress: 'در حال رسیدگی اپراتور',
  escalated_to_admin: 'ارجاع‌شده به مدیر کل',
  resolved: 'حل‌شده',
  closed: 'بسته‌شده',
};
