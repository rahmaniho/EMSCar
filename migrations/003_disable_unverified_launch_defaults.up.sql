-- Migration 003 (UP): حذف اطلاعات تماس و پیشنهاد تبلیغاتی نمونه از وضعیت پیش‌فرض.
-- شماره پشتیبانی باید توسط مالک محصول با شماره واقعیِ تأییدشده جایگزین شود.
UPDATE system_settings
SET value_json = '""',
    description_fa = 'شماره رسمی تماس پشتیبانی؛ پیش از بهره‌برداری عمومی باید تأیید و ثبت شود',
    updated_at = '2026-10-26T00:00:00.000Z'
WHERE key = 'support_hotline'
  AND value_json = '"028-33330000"';

-- کمپین نمونه QAZVIN1405 فقط پس از بررسی و فعال‌سازی صریح مدیر قابل استفاده است.
UPDATE discount_codes
SET is_active = 0
WHERE code = 'QAZVIN1405';
