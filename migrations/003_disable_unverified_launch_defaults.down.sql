-- Migration 003 (DOWN): بازگردانی دقیق مقادیر مرجع پیش از این مهاجرت.
-- اگر مدیر شماره واقعی ثبت کرده باشد، آن مقدار دست‌نخورده باقی می‌ماند.
UPDATE system_settings
SET value_json = '"028-33330000"',
    description_fa = 'شماره تماس مرکز عملیات و پشتیبانی قزوین',
    updated_at = '2026-10-26T00:00:00.000Z'
WHERE key = 'support_hotline'
  AND value_json = '""'
  AND description_fa = 'شماره رسمی تماس پشتیبانی؛ پیش از بهره‌برداری عمومی باید تأیید و ثبت شود';

UPDATE discount_codes
SET is_active = 1
WHERE code = 'QAZVIN1405'
  AND is_active = 0;
