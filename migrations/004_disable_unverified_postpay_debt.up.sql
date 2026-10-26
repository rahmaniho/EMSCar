-- Migration 004 (UP): turn off only the untouched seed default for post-pay debt.
-- The application updates updated_at when an administrator changes a setting, so customized rows are preserved.
UPDATE system_settings
SET value_json = 'false',
    description_fa = 'ثبت بدهی پس‌پرداخت فقط پس از تکمیل خدمت و صدور فاکتور؛ غیرفعال پیش‌فرض و نیازمند FEATURE_ALLOW_POSTPAY_DEBT=true و تأیید مدیر',
    updated_at = '2026-10-26T00:01:00.000Z'
WHERE key = 'allow_postpay_debt'
  AND value_json = 'true'
  AND description_fa = 'اجازه ثبت بدهی مجاز پس از تأیید اپراتور/مدیر در شرایط اضطراری جاده‌ای'
  AND updated_at = '2026-10-26T00:00:00.000Z';
