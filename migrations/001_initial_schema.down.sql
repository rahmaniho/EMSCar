-- ============================================================================
-- Migration 001 (DOWN): بازگردانی کامل جداول طرحواره اولیه به ترتیب معکوس وابستگی
-- هشدار: اجرای Rollback صرفاً در محیط‌های توسعه/آزمایش مجاز است.
-- ============================================================================

DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS security_events;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS mission_reviews;
DROP TABLE IF EXISTS internal_operator_notes;
DROP TABLE IF EXISTS ticket_messages;
DROP TABLE IF EXISTS support_tickets;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS wallet_ledger_entries;
DROP TABLE IF EXISTS settlements;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS refunds;
DROP TABLE IF EXISTS payment_intents;
DROP TABLE IF EXISTS private_attachments;
DROP TABLE IF EXISTS price_change_logs;
DROP TABLE IF EXISTS mission_reports;
DROP TABLE IF EXISTS mission_offers;
DROP TABLE IF EXISTS request_state_history;
DROP TABLE IF EXISTS service_requests;
DROP TABLE IF EXISTS discount_codes;
DROP TABLE IF EXISTS pricing_rules;
DROP TABLE IF EXISTS responder_zones;
DROP TABLE IF EXISTS responder_services;
DROP TABLE IF EXISTS responder_documents;
DROP TABLE IF EXISTS responder_profiles;
DROP TABLE IF EXISTS customer_vehicles;
DROP TABLE IF EXISTS service_audit_logs;
DROP TABLE IF EXISTS zone_services;
DROP TABLE IF EXISTS service_catalog;
DROP TABLE IF EXISTS geography_status_history;
DROP TABLE IF EXISTS service_zones;
DROP TABLE IF EXISTS cities;
DROP TABLE IF EXISTS provinces;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS users;
