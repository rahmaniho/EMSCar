-- ============================================================================
-- Migration 001 (UP): طرحواره جامع سامانه «اورژانس خودرو»
-- تمام مبالغ مالی داخلی با واحد صریح تومان صحیح (_toman) ذخیره می‌شوند.
-- کلیدهای خارجی برای سوابق عملیاتی و مالی با ON DELETE RESTRICT محافظت شده‌اند.
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  national_code TEXT,
  email TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'responder', 'operator', 'admin')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent TEXT,
  ip_address TEXT,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);

-- جغرافیا و پوشش خدماتی
CREATE TABLE IF NOT EXISTS provinces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name_fa TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing', 'pending_approval', 'active', 'inactive')),
  center_lat REAL NOT NULL,
  center_lng REAL NOT NULL,
  boundary_json TEXT NOT NULL,
  min_required_responders INTEGER NOT NULL DEFAULT 2,
  approved_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  province_id INTEGER NOT NULL REFERENCES provinces(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL UNIQUE,
  name_fa TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing', 'pending_approval', 'active', 'inactive')),
  center_lat REAL NOT NULL,
  center_lng REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cities_province ON cities(province_id);

CREATE TABLE IF NOT EXISTS service_zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  province_id INTEGER NOT NULL REFERENCES provinces(id) ON DELETE RESTRICT,
  city_id INTEGER REFERENCES cities(id) ON DELETE RESTRICT,
  code TEXT NOT NULL UNIQUE,
  name_fa TEXT NOT NULL,
  zone_type TEXT NOT NULL DEFAULT 'urban' CHECK (zone_type IN ('urban', 'suburban', 'highway', 'industrial')),
  status TEXT NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing', 'pending_approval', 'active', 'inactive')),
  center_lat REAL NOT NULL,
  center_lng REAL NOT NULL,
  radius_km REAL NOT NULL DEFAULT 15,
  polygon_json TEXT,
  tariff_multiplier REAL NOT NULL DEFAULT 1.0,
  target_responder_capacity INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_zones_province_status ON service_zones(province_id, status);

CREATE TABLE IF NOT EXISTS geography_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('province', 'city', 'zone')),
  entity_id INTEGER NOT NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- کاتالوگ خدمات
CREATE TABLE IF NOT EXISTS service_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title_fa TEXT NOT NULL,
  category TEXT NOT NULL,
  description_fa TEXT NOT NULL,
  terms_fa TEXT NOT NULL,
  base_price_toman INTEGER NOT NULL CHECK (base_price_toman >= 0),
  included_free_km REAL NOT NULL DEFAULT 5,
  per_km_dispatch_toman INTEGER NOT NULL DEFAULT 15000 CHECK (per_km_dispatch_toman >= 0),
  per_km_tow_toman INTEGER NOT NULL DEFAULT 0 CHECK (per_km_tow_toman >= 0),
  requires_destination INTEGER NOT NULL DEFAULT 0 CHECK (requires_destination IN (0, 1)),
  requires_ownership_proof INTEGER NOT NULL DEFAULT 0 CHECK (requires_ownership_proof IN (0, 1)),
  required_equipment_json TEXT NOT NULL DEFAULT '[]',
  requires_ev_certification INTEGER NOT NULL DEFAULT 0 CHECK (requires_ev_certification IN (0, 1)),
  supported_vehicle_categories_json TEXT NOT NULL DEFAULT '["domestic","foreign","electric","suv_heavy"]',
  free_cancel_before_enroute INTEGER NOT NULL DEFAULT 1 CHECK (free_cancel_before_enroute IN (0, 1)),
  enroute_cancel_fee_toman INTEGER NOT NULL DEFAULT 120000 CHECK (enroute_cancel_fee_toman >= 0),
  estimated_duration_min INTEGER NOT NULL DEFAULT 30,
  is_published INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS zone_services (
  zone_id INTEGER NOT NULL REFERENCES service_zones(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES service_catalog(id) ON DELETE CASCADE,
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  custom_base_price_toman INTEGER,
  PRIMARY KEY (zone_id, service_id)
);

CREATE TABLE IF NOT EXISTS service_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER NOT NULL REFERENCES service_catalog(id) ON DELETE CASCADE,
  changed_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  change_summary TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);

-- خودروهای مشتریان
CREATE TABLE IF NOT EXISTS customer_vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  manufacture_year INTEGER NOT NULL,
  plate_number TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('domestic', 'foreign', 'electric', 'suv_heavy')),
  color TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON customer_vehicles(customer_user_id);

-- پروفایل، مدارک و صلاحیت امدادگران
CREATE TABLE IF NOT EXISTS responder_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  verification_status TEXT NOT NULL DEFAULT 'pending_documents' CHECK (verification_status IN ('pending_documents', 'under_review', 'approved', 'rejected', 'suspended')),
  equipment_type TEXT NOT NULL DEFAULT 'service_van' CHECK (equipment_type IN ('motorcycle', 'service_van', 'wheel_lift_tow', 'flatbed_tow', 'ev_specialist_unit')),
  vehicle_plate TEXT,
  has_ev_certification INTEGER NOT NULL DEFAULT 0 CHECK (has_ev_certification IN (0, 1)),
  availability_status TEXT NOT NULL DEFAULT 'offline' CHECK (availability_status IN ('offline', 'online', 'busy')),
  max_concurrent_missions INTEGER NOT NULL DEFAULT 1 CHECK (max_concurrent_missions >= 1),
  max_dispatch_radius_km REAL NOT NULL DEFAULT 35,
  current_lat REAL,
  current_lng REAL,
  location_updated_at TEXT,
  sheba_number TEXT,
  rating_avg REAL NOT NULL DEFAULT 5.0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  completed_missions_count INTEGER NOT NULL DEFAULT 0,
  verified_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  verified_at TEXT,
  rejection_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_responders_status ON responder_profiles(verification_status, availability_status);

CREATE TABLE IF NOT EXISTS responder_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  responder_id INTEGER NOT NULL REFERENCES responder_profiles(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  doc_number TEXT NOT NULL,
  file_attachment_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  reviewed_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  review_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS responder_services (
  responder_id INTEGER NOT NULL REFERENCES responder_profiles(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES service_catalog(id) ON DELETE CASCADE,
  is_authorized INTEGER NOT NULL DEFAULT 1 CHECK (is_authorized IN (0, 1)),
  PRIMARY KEY (responder_id, service_id)
);

CREATE TABLE IF NOT EXISTS responder_zones (
  responder_id INTEGER NOT NULL REFERENCES responder_profiles(id) ON DELETE CASCADE,
  zone_id INTEGER NOT NULL REFERENCES service_zones(id) ON DELETE CASCADE,
  PRIMARY KEY (responder_id, zone_id)
);

-- قواعد قیمت‌گذاری و کدهای تخفیف
CREATE TABLE IF NOT EXISTS pricing_rules (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  domestic_multiplier REAL NOT NULL DEFAULT 1.0,
  foreign_multiplier REAL NOT NULL DEFAULT 1.25,
  electric_multiplier REAL NOT NULL DEFAULT 1.35,
  suv_heavy_multiplier REAL NOT NULL DEFAULT 1.20,
  urgent_night_multiplier REAL NOT NULL DEFAULT 1.20,
  night_start_hour INTEGER NOT NULL DEFAULT 22,
  night_end_hour INTEGER NOT NULL DEFAULT 6,
  tax_rate_percent REAL NOT NULL DEFAULT 10.0,
  platform_commission_percent REAL NOT NULL DEFAULT 15.0,
  price_approval_threshold_percent REAL NOT NULL DEFAULT 10.0,
  updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS discount_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title_fa TEXT NOT NULL,
  percent_off REAL NOT NULL DEFAULT 0,
  fixed_toman_off INTEGER NOT NULL DEFAULT 0,
  max_discount_toman INTEGER NOT NULL DEFAULT 200000,
  usage_limit INTEGER NOT NULL DEFAULT 1000,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  expires_at TEXT,
  created_at TEXT NOT NULL
);

-- درخواست‌های امداد و چرخه مأموریت
CREATE TABLE IF NOT EXISTS service_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_code TEXT NOT NULL UNIQUE,
  idempotency_key TEXT UNIQUE,
  customer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  vehicle_id INTEGER NOT NULL REFERENCES customer_vehicles(id) ON DELETE RESTRICT,
  service_id INTEGER NOT NULL REFERENCES service_catalog(id) ON DELETE RESTRICT,
  province_id INTEGER NOT NULL REFERENCES provinces(id) ON DELETE RESTRICT,
  city_id INTEGER REFERENCES cities(id) ON DELETE RESTRICT,
  zone_id INTEGER NOT NULL REFERENCES service_zones(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN (
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
    'UnderSupportReview'
  )),
  origin_lat REAL NOT NULL,
  origin_lng REAL NOT NULL,
  origin_address TEXT NOT NULL,
  destination_lat REAL,
  destination_lng REAL,
  destination_address TEXT,
  issue_description TEXT NOT NULL,
  ownership_confirmed INTEGER NOT NULL DEFAULT 1 CHECK (ownership_confirmed IN (0, 1)),
  is_urgent INTEGER NOT NULL DEFAULT 0 CHECK (is_urgent IN (0, 1)),
  discount_code TEXT,
  assigned_responder_id INTEGER REFERENCES responder_profiles(id) ON DELETE RESTRICT,
  estimated_distance_km REAL NOT NULL DEFAULT 0,
  tow_distance_km REAL NOT NULL DEFAULT 0,
  estimated_eta_minutes INTEGER,
  estimated_price_toman INTEGER NOT NULL CHECK (estimated_price_toman >= 0),
  estimated_breakdown_json TEXT NOT NULL,
  final_price_toman INTEGER CHECK (final_price_toman IS NULL OR final_price_toman >= 0),
  final_breakdown_json TEXT,
  price_change_reason TEXT,
  customer_price_approval_required INTEGER NOT NULL DEFAULT 0 CHECK (customer_price_approval_required IN (0, 1)),
  customer_price_approved INTEGER NOT NULL DEFAULT 0 CHECK (customer_price_approved IN (0, 1)),
  cancellation_fee_toman INTEGER NOT NULL DEFAULT 0 CHECK (cancellation_fee_toman >= 0),
  cancellation_reason TEXT,
  cancelled_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN (
    'unpaid',
    'pending_gateway',
    'paid',
    'failed',
    'refunded',
    'partially_refunded',
    'approved_debt'
  )),
  operator_escalation_required INTEGER NOT NULL DEFAULT 0 CHECK (operator_escalation_required IN (0, 1)),
  operator_escalation_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_requests_customer ON service_requests(customer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_responder ON service_requests(assigned_responder_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_status ON service_requests(status, operator_escalation_required);

CREATE TABLE IF NOT EXISTS request_state_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_request_history ON request_state_history(request_id);

CREATE TABLE IF NOT EXISTS mission_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  responder_id INTEGER NOT NULL REFERENCES responder_profiles(id) ON DELETE CASCADE,
  score REAL NOT NULL,
  distance_km REAL NOT NULL,
  estimated_eta_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'superseded')),
  rejection_reason TEXT,
  expires_at TEXT NOT NULL,
  responded_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_offers_responder_status ON mission_offers(responder_id, status);
CREATE INDEX IF NOT EXISTS idx_offers_request ON mission_offers(request_id, status);

CREATE TABLE IF NOT EXISTS mission_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL UNIQUE REFERENCES service_requests(id) ON DELETE CASCADE,
  responder_id INTEGER NOT NULL REFERENCES responder_profiles(id) ON DELETE RESTRICT,
  summary TEXT NOT NULL,
  actions_taken TEXT NOT NULL,
  parts_used_json TEXT NOT NULL DEFAULT '[]',
  parts_total_toman INTEGER NOT NULL DEFAULT 0 CHECK (parts_total_toman >= 0),
  actual_tow_distance_km REAL NOT NULL DEFAULT 0 CHECK (actual_tow_distance_km >= 0),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS price_change_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  actor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  previous_amount_toman INTEGER NOT NULL,
  new_amount_toman INTEGER NOT NULL,
  reason TEXT NOT NULL,
  requires_customer_approval INTEGER NOT NULL DEFAULT 0,
  customer_approved_at TEXT,
  created_at TEXT NOT NULL
);

-- فایل‌های خصوصی حفاظت‌شده
CREATE TABLE IF NOT EXISTS private_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  request_id INTEGER REFERENCES service_requests(id) ON DELETE CASCADE,
  responder_id INTEGER REFERENCES responder_profiles(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_filename TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

-- پرداخت‌ها، بازپرداخت، فاکتور و تسویه حساب
CREATE TABLE IF NOT EXISTS payment_intents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE RESTRICT,
  customer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  gateway_provider TEXT NOT NULL,
  authority TEXT NOT NULL,
  amount_toman INTEGER NOT NULL CHECK (amount_toman > 0),
  amount_rial INTEGER NOT NULL CHECK (amount_rial > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed', 'refunded', 'partially_refunded')),
  is_sandbox INTEGER NOT NULL DEFAULT 0 CHECK (is_sandbox IN (0, 1)),
  ref_id TEXT,
  failure_reason TEXT,
  callback_count INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(gateway_provider, authority)
);

CREATE INDEX IF NOT EXISTS idx_payments_request ON payment_intents(request_id);

CREATE TABLE IF NOT EXISTS refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_intent_id INTEGER NOT NULL REFERENCES payment_intents(id) ON DELETE RESTRICT,
  request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE RESTRICT,
  amount_toman INTEGER NOT NULL CHECK (amount_toman > 0),
  reason TEXT NOT NULL,
  approved_by_admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL UNIQUE,
  request_id INTEGER NOT NULL UNIQUE REFERENCES service_requests(id) ON DELETE RESTRICT,
  customer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  responder_id INTEGER REFERENCES responder_profiles(id) ON DELETE RESTRICT,
  subtotal_toman INTEGER NOT NULL,
  discount_toman INTEGER NOT NULL,
  parts_toman INTEGER NOT NULL,
  tax_toman INTEGER NOT NULL,
  total_toman INTEGER NOT NULL,
  total_rial INTEGER NOT NULL,
  platform_commission_toman INTEGER NOT NULL,
  responder_net_toman INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'paid', 'refunded', 'approved_debt')),
  issued_at TEXT NOT NULL,
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  responder_id INTEGER NOT NULL REFERENCES responder_profiles(id) ON DELETE RESTRICT,
  amount_toman INTEGER NOT NULL CHECK (amount_toman > 0),
  sheba_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved_paid', 'rejected')),
  bank_reference_code TEXT,
  processed_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  processed_at TEXT
);

CREATE TABLE IF NOT EXISTS wallet_ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  responder_id INTEGER NOT NULL REFERENCES responder_profiles(id) ON DELETE RESTRICT,
  request_id INTEGER REFERENCES service_requests(id) ON DELETE RESTRICT,
  settlement_id INTEGER REFERENCES settlements(id) ON DELETE RESTRICT,
  refund_id INTEGER REFERENCES refunds(id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('mission_earning', 'refund_reversal', 'settlement_payout', 'manual_adjustment')),
  amount_toman INTEGER NOT NULL,
  balance_after_toman INTEGER NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_responder ON wallet_ledger_entries(responder_id, created_at DESC);

-- اعلان‌ها و پیامک‌ها
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id INTEGER REFERENCES service_requests(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'sms', 'email')),
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  dedup_key TEXT UNIQUE,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'sandbox_logged', 'failed')),
  provider_name TEXT NOT NULL,
  provider_message_id TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

-- پشتیبانی، شکایات و یادداشت‌های داخلی اپراتور
CREATE TABLE IF NOT EXISTS support_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_number TEXT NOT NULL UNIQUE,
  creator_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  request_id INTEGER REFERENCES service_requests(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('delay', 'pricing_dispute', 'service_quality', 'damage_claim', 'payment_issue', 'general')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'escalated_to_admin', 'resolved', 'closed')),
  assigned_operator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  escalated_reason TEXT,
  resolution_summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS internal_operator_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER REFERENCES support_tickets(id) ON DELETE CASCADE,
  request_id INTEGER REFERENCES service_requests(id) ON DELETE CASCADE,
  author_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- امتیاز و نظرات مشتریان
CREATE TABLE IF NOT EXISTS mission_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL UNIQUE REFERENCES service_requests(id) ON DELETE CASCADE,
  customer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  responder_id INTEGER NOT NULL REFERENCES responder_profiles(id) ON DELETE RESTRICT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  tags_json TEXT NOT NULL DEFAULT '[]',
  comment TEXT,
  created_at TEXT NOT NULL
);

-- لاگ‌های ممیزی مدیریت، رویدادهای امنیتی و تنظیمات عمومی
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  summary TEXT NOT NULL,
  metadata_json TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ip_address TEXT,
  path TEXT,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  description_fa TEXT NOT NULL,
  updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL
);
