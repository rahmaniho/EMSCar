-- Migration 004 (DOWN): restore only the seed row changed by this migration.
-- Any value updated after migration has a different timestamp and is left untouched.
UPDATE system_settings
SET value_json = 'true',
    description_fa = 'اجازه ثبت بدهی مجاز پس از تأیید اپراتور/مدیر در شرایط اضطراری جاده‌ای',
    updated_at = '2026-10-26T00:00:00.000Z'
WHERE key = 'allow_postpay_debt'
  AND value_json = 'false'
  AND description_fa = 'ثبت بدهی پس‌پرداخت فقط پس از تکمیل خدمت و صدور فاکتور؛ غیرفعال پیش‌فرض و نیازمند FEATURE_ALLOW_POSTPAY_DEBT=true و تأیید مدیر'
  AND updated_at = '2026-10-26T00:01:00.000Z';
