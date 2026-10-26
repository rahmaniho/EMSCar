-- ============================================================================
-- Migration 002 (DOWN): حذف داده‌های مرجع کاتالوگ و جغرافیا در صورت نبود وابستگی
-- ============================================================================

DELETE FROM system_settings WHERE key IN ('support_hotline', 'offer_expiry_minutes', 'allow_ev_services', 'allow_postpay_debt', 'data_retention_days');
DELETE FROM discount_codes WHERE code = 'QAZVIN1405';
DELETE FROM pricing_rules WHERE id = 1;
DELETE FROM zone_services;
DELETE FROM service_catalog;
DELETE FROM service_zones;
DELETE FROM cities;
DELETE FROM provinces;
