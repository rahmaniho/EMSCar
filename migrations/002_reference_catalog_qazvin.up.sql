-- ============================================================================
-- Migration 002 (UP): داده‌های مرجع جغرافیایی ایران (راه‌اندازی قزوین) و کاتالوگ ۱۵ خدمت
-- توجه: این فایل فاقد هرگونه کاربر یا مأموریت ساختگی است و صرفاً پیکربندی مرجع عملیاتی است.
-- ============================================================================

-- ۱. استان‌های ایران (تنها استان قزوین در وضعیت active قرار دارد)
INSERT INTO provinces (slug, name_fa, status, center_lat, center_lng, boundary_json, min_required_responders, created_at, updated_at) VALUES
  ('qazvin', 'قزوین', 'active', 36.2688, 50.0041,
    '[{"lat":36.75,"lng":48.85},{"lat":36.75,"lng":50.72},{"lat":35.95,"lng":50.72},{"lat":35.45,"lng":50.45},{"lat":35.45,"lng":48.85}]',
    2, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),
  ('alborz', 'البرز', 'pending_approval', 35.8400, 50.9391,
    '[{"lat":36.35,"lng":50.73},{"lat":36.35,"lng":51.35},{"lat":35.65,"lng":51.35},{"lat":35.65,"lng":50.73}]',
    4, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),
  ('tehran', 'تهران', 'preparing', 35.6892, 51.3890,
    '[{"lat":36.10,"lng":51.05},{"lat":36.10,"lng":53.10},{"lat":35.10,"lng":53.10},{"lat":35.10,"lng":51.05}]',
    10, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),
  ('zanjan', 'زنجان', 'preparing', 36.6736, 48.4787,
    '[{"lat":37.25,"lng":47.60},{"lat":37.25,"lng":49.25},{"lat":35.90,"lng":49.25},{"lat":35.90,"lng":47.60}]',
    3, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),
  ('gilan', 'گیلان', 'inactive', 37.2808, 49.5832,
    '[{"lat":38.45,"lng":48.55},{"lat":38.45,"lng":50.60},{"lat":36.60,"lng":50.60},{"lat":36.60,"lng":48.55}]',
    4, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),
  ('hamadan', 'همدان', 'inactive', 34.7989, 48.5150,
    '[{"lat":35.70,"lng":47.80},{"lat":35.70,"lng":49.45},{"lat":34.00,"lng":49.45},{"lat":34.00,"lng":47.80}]',
    3, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z');

-- ۲. شهرهای استان قزوین و شهر نمونه در استان غیرفعال برای کنترل مرزی
INSERT INTO cities (province_id, slug, name_fa, status, center_lat, center_lng, created_at, updated_at) VALUES
  ((SELECT id FROM provinces WHERE slug = 'qazvin'), 'qazvin-city', 'قزوین', 'active', 36.2688, 50.0041, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),
  ((SELECT id FROM provinces WHERE slug = 'qazvin'), 'alvand', 'الوند (البرز)', 'active', 36.1892, 50.0642, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),
  ((SELECT id FROM provinces WHERE slug = 'qazvin'), 'takestan', 'تاکستان', 'active', 36.0696, 49.6959, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),
  ((SELECT id FROM provinces WHERE slug = 'qazvin'), 'abyek', 'آبیک', 'active', 36.0405, 50.5317, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),
  ((SELECT id FROM provinces WHERE slug = 'qazvin'), 'buin-zahra', 'بوئین‌زهرا', 'active', 35.7667, 50.0578, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),
  ((SELECT id FROM provinces WHERE slug = 'alborz'), 'karaj', 'کرج', 'pending_approval', 35.8400, 50.9391, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),
  ((SELECT id FROM provinces WHERE slug = 'tehran'), 'tehran-city', 'تهران', 'preparing', 35.6892, 51.3890, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z');

-- ۳. مناطق پوشش عملیاتی استان قزوین + مناطق غیرفعال جهت آزمون مرزهای عملیاتی
INSERT INTO service_zones (province_id, city_id, code, name_fa, zone_type, status, center_lat, center_lng, radius_km, tariff_multiplier, target_responder_capacity, created_at, updated_at) VALUES
  ((SELECT id FROM provinces WHERE slug = 'qazvin'), (SELECT id FROM cities WHERE slug = 'qazvin-city'), 'QZV-CENTRAL', 'محدوده شهری قزوین (پونک، مینودر، خیام، بازار)', 'urban', 'active', 36.2688, 50.0041, 18.0, 1.00, 5, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),
  ((SELECT id FROM provinces WHERE slug = 'qazvin'), (SELECT id FROM cities WHERE slug = 'alvand'), 'QZV-ALVAND', 'الوند، زیباشهر و شهر صنعتی البرز', 'industrial', 'active', 36.1892, 50.0642, 15.0, 1.05, 4, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),
  ((SELECT id FROM provinces WHERE slug = 'qazvin'), (SELECT id FROM cities WHERE slug = 'takestan'), 'QZV-TAKESTAN', 'تاکستان و حومه غربی', 'urban', 'active', 36.0696, 49.6959, 22.0, 1.05, 3, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),
  ((SELECT id FROM provinces WHERE slug = 'qazvin'), (SELECT id FROM cities WHERE slug = 'abyek'), 'QZV-ABYEK', 'آبیک و محور شرقی', 'urban', 'active', 36.0405, 50.5317, 20.0, 1.05, 3, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),
  ((SELECT id FROM provinces WHERE slug = 'qazvin'), (SELECT id FROM cities WHERE slug = 'buin-zahra'), 'QZV-BUINZAHRA', 'بوئین‌زهرا و محور جنوبی', 'suburban', 'active', 35.7667, 50.0578, 25.0, 1.10, 2, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),
  ((SELECT id FROM provinces WHERE slug = 'qazvin'), (SELECT id FROM cities WHERE slug = 'qazvin-city'), 'QZV-HWY-EAST', 'آزادراه قزوین - کرج (حوزه استحفاظی قزوین)', 'highway', 'active', 36.1450, 50.3100, 30.0, 1.15, 4, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),
  ((SELECT id FROM provinces WHERE slug = 'qazvin'), (SELECT id FROM cities WHERE slug = 'takestan'), 'QZV-HWY-WEST', 'آزادراه قزوین - زنجان (حوزه استحفاظی قزوین)', 'highway', 'active', 36.2100, 49.5500, 32.0, 1.15, 3, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),
  ((SELECT id FROM provinces WHERE slug = 'alborz'), (SELECT id FROM cities WHERE slug = 'karaj'), 'ALB-KARAJ', 'محدوده شهری کرج (در انتظار تأیید نهایی)', 'urban', 'pending_approval', 35.8400, 50.9391, 20.0, 1.00, 4, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),
  ((SELECT id FROM provinces WHERE slug = 'tehran'), (SELECT id FROM cities WHERE slug = 'tehran-city'), 'THR-CENTRAL', 'تهران مرکزی (در حال آماده‌سازی)', 'urban', 'preparing', 35.6892, 51.3890, 25.0, 1.10, 10, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z');

-- ۴. کاتالوگ کامل ۱۵ خدمت استاندارد «اورژانس خودرو»
INSERT INTO service_catalog (
  slug, title_fa, category, description_fa, terms_fa,
  base_price_toman, included_free_km, per_km_dispatch_toman, per_km_tow_toman,
  requires_destination, requires_ownership_proof, required_equipment_json,
  requires_ev_certification, supported_vehicle_categories_json,
  free_cancel_before_enroute, enroute_cancel_fee_toman, estimated_duration_min,
  is_published, created_at, updated_at
) VALUES
  ('battery-jumpstart', 'باتری‌به‌باتری اضطراری', 'battery_electrical',
   'راه‌اندازی ایمن خودرو با دستگاه بوستر استاندارد و تست اولیه شارژ دینام در محل.',
   'لغو رایگان پیش از حرکت امدادگر؛ در صورت خرابی کامل سلول باتری، امکان ارتقا به تعویض باتری با تأیید مشتری وجود دارد.',
   280000, 6, 15000, 0, 0, 0, '["motorcycle","service_van","ev_specialist_unit"]',
   0, '["domestic","foreign","electric","suv_heavy"]', 1, 90000, 20, 1, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),

  ('battery-replacement', 'تست تخصصی و تعویض باتری در محل', 'battery_electrical',
   'تست سلامت باتری و دینام با تستر دیجیتال، نصب باتری نو با گارانتی معتبر و تحویل داغی.',
   'هزینه قطعه باتری بر اساس آمپراژ انتخابی با تأیید مشتری در صورتحساب نهایی لحاظ می‌شود.',
   350000, 6, 15000, 0, 0, 0, '["service_van","ev_specialist_unit"]',
   0, '["domestic","foreign","suv_heavy"]', 1, 100000, 30, 1, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),

  ('mobile-tire-repair', 'پنچرگیری سیار در محل', 'tire_wheel',
   'رفع پنچری لاستیک‌های تیوبلس در محل، تنظیم باد دیجیتال و کنترل سلامت والو.',
   'در صورت پارگی دیواره لاستیک که قابل پنچرگیری ایمن نباشد، تعویض با زاپاس انجام می‌شود.',
   260000, 5, 15000, 0, 0, 0, '["motorcycle","service_van"]',
   0, '["domestic","foreign","electric","suv_heavy"]', 1, 85000, 25, 1, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),

  ('tire-change', 'تعویض لاستیک و نصب زاپاس', 'tire_wheel',
   'باز کردن چرخ آسیب‌دیده با جک هیدرولیک استاندارد، نصب لاستیک زاپاس و گشتاورسنجی پیچ‌ها.',
   'همراه داشتن لاستیک زاپاس سالم یا قفل رینگ اختصاصی توسط مشتری الزامی است.',
   240000, 5, 15000, 0, 0, 0, '["motorcycle","service_van","wheel_lift_tow"]',
   0, '["domestic","foreign","electric","suv_heavy"]', 1, 85000, 20, 1, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),

  ('emergency-fuel', 'سوخت‌رسانی اضطراری ایمن', 'fuel_lock',
   'رساندن ظرف ایمن استاندارد بنزین جهت رسیدن خودرو به نزدیک‌ترین جایگاه سوخت.',
   'صرفاً در ظروف ایمن استاندارد و تا سقف مجاز ایمنی حمل انجام می‌شود؛ بهای سوخت طبق نرخ مصوب محاسبه می‌گردد.',
   290000, 6, 16000, 0, 0, 0, '["motorcycle","service_van"]',
   0, '["domestic","foreign","suv_heavy"]', 1, 90000, 25, 1, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),

  ('authorized-door-unlock', 'باز کردن در خودرو در شرایط مجاز', 'fuel_lock',
   'بازگشایی تخصصی در خودرو بدون آسیب به رنگ و نوار دور در، صرفاً پس از احراز مالکیت.',
   'ارائه کارت خودرو و کارت ملی تطبیقی مالک پیش از شروع عملیات به امدادگر الزامی است.',
   390000, 5, 16000, 0, 0, 1, '["service_van"]',
   0, '["domestic","foreign","suv_heavy"]', 1, 110000, 30, 1, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),

  ('initial-diagnostics', 'عیب‌یابی اولیه و دیاگ سیار', 'diagnostics_repair',
   'بررسی خطاهای ECU با دستگاه دیاگ، بررسی سیستم برق، سوخت‌رسانی و خنک‌کننده در محل.',
   'گزارش کدهای خطا و علت توقف خودرو در فرم پایان مأموریت ثبت و به مشتری ارائه می‌شود.',
   420000, 6, 16000, 0, 0, 0, '["service_van","ev_specialist_unit"]',
   0, '["domestic","foreign","electric","suv_heavy"]', 1, 110000, 35, 1, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),

  ('light-onsite-repair', 'تعمیرات سبک مکانیکی و برقی در محل', 'diagnostics_repair',
   'رفع ایرادات قابل انجام در محل شامل تسمه‌ها، فیوزها، رله‌ها، شلنگ‌های آب و اتصالات برق.',
   'در صورت نیاز به تعمیر اساسی کارگاهی، هزینه عیب‌یابی لحاظ و امکان درخواست حمل فراهم می‌شود.',
   480000, 6, 17000, 0, 0, 0, '["service_van"]',
   0, '["domestic","foreign","suv_heavy"]', 1, 120000, 45, 1, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),

  ('onsite-part-replacement', 'تعویض قطعات قابل انجام در محل', 'diagnostics_repair',
   'تعویض پمپ بنزین، کوئل، شمع، سنسور دور موتور، ترموستات یا لنت ترمز در محل توقف.',
   'قطعات مصرفی با فاکتور معتبر و تأیید مشتری پیش از نصب محاسبه می‌شوند.',
   520000, 6, 17000, 0, 0, 0, '["service_van"]',
   0, '["domestic","foreign","suv_heavy"]', 1, 120000, 50, 1, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),

  ('towing', 'یدک‌کش چرخ‌گیر استاندارد', 'towing_transport',
   'حمل ایمن خودروهای متوقف با یدک‌کش مجهز به چرخ‌گیر هیدرولیک بدون آسیب به سپر.',
   'تعیین مقصد حمل الزامی است؛ تعرفه بر اساس ورودی پایه به‌علاوه مسافت مبدأ تا مقصد محاسبه می‌شود.',
   680000, 5, 20000, 28000, 1, 0, '["wheel_lift_tow","flatbed_tow"]',
   0, '["domestic","foreign","suv_heavy"]', 1, 180000, 55, 1, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),

  ('transport-to-repair-shop', 'حمل خودرو به تعمیرگاه مجاز', 'towing_transport',
   'انتقال مستقیم خودرو به تعمیرگاه منتخب یا نمایندگی‌های مجاز شهر قزوین و الوند.',
   'تحویل خودرو در تعمیرگاه با ثبت صورتجلسه دیجیتال تحویل انجام می‌شود.',
   650000, 5, 20000, 26000, 1, 0, '["wheel_lift_tow","flatbed_tow"]',
   0, '["domestic","foreign","electric","suv_heavy"]', 1, 180000, 50, 1, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),

  ('transport-to-custom-destination', 'حمل خودرو با کفی خودروبر به مقصد انتخابی', 'towing_transport',
   'حمل کاملاً ایمن خودرو روی کفی هیدرولیک (مخصوص خودروهای اتوماتیک، صفرکیلومتر، شاسی‌بلند و برقی).',
   'مناسب حمل درون‌شهری و بین‌شهری مجاز استان قزوین با مهار چهارچرخ استاندارد.',
   890000, 5, 22000, 35000, 1, 0, '["flatbed_tow"]',
   0, '["domestic","foreign","electric","suv_heavy"]', 1, 220000, 60, 1, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),

  ('domestic-car-assistance', 'امداد جامع خودروهای داخلی', 'specialized_fleet',
   'بسته عیب‌یابی و رفع عیب اختصاصی خودروهای ایران‌خودرو و سایپا با قطعات پرمصرف همراه.',
   'ویژه خودروهای داخلی؛ شامل بررسی کامل برق، سوخت و سیستم خنک‌کننده.',
   380000, 6, 15000, 0, 0, 0, '["service_van"]',
   0, '["domestic"]', 1, 100000, 35, 1, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),

  ('foreign-car-assistance', 'امداد تخصصی خودروهای خارجی و وارداتی', 'specialized_fleet',
   'اعزام کارشناس مجرب خودروهای وارداتی مجهز به دیاگ مولتی‌برند و ابزار تخصصی.',
   'صرفاً برای خودروهای خارجی و شاسی‌بلند؛ با رعایت استانداردهای فنی سازنده.',
   590000, 6, 18000, 0, 0, 0, '["service_van","ev_specialist_unit"]',
   0, '["foreign","suv_heavy"]', 1, 150000, 40, 1, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),

  ('ev-specialized-service', 'خدمات تخصصی خودروهای برقی و هیبریدی (HV)', 'specialized_fleet',
   'ایمن‌سازی سیستم ولتاژ بالا، باتری کمکی ۱۲ ولت خودروی برقی و دیاگ تخصصی EV توسط تکنسین دارای گواهینامه HV.',
   'ارائه این خدمت منوط به حضور امدادگر دارای گواهینامه معتبر ایمنی ولتاژ بالا (EV Certified) در منطقه است.',
   720000, 6, 20000, 0, 0, 0, '["ev_specialist_unit","flatbed_tow"]',
   1, '["electric"]', 1, 160000, 45, 1, '2026-10-26T00:00:00.000Z', '2026-10-26T00:00:00.000Z');

-- ۵. فعال‌سازی خدمات در تمام مناطق فعال استان قزوین
INSERT INTO zone_services (zone_id, service_id, is_enabled)
SELECT z.id, s.id, 1
FROM service_zones z
CROSS JOIN service_catalog s
WHERE z.province_id = (SELECT id FROM provinces WHERE slug = 'qazvin');

-- ۶. قواعد پیش‌فرض قیمت‌گذاری سامانه
INSERT INTO pricing_rules (
  id, domestic_multiplier, foreign_multiplier, electric_multiplier, suv_heavy_multiplier,
  urgent_night_multiplier, night_start_hour, night_end_hour,
  tax_rate_percent, platform_commission_percent, price_approval_threshold_percent, updated_at
) VALUES (
  1, 1.00, 1.25, 1.35, 1.20,
  1.20, 22, 6,
  10.0, 15.0, 10.0, '2026-10-26T00:00:00.000Z'
);

-- ۷. کد تخفیف خوش‌آمدگویی رسمی راه‌اندازی استان قزوین
INSERT INTO discount_codes (
  code, title_fa, percent_off, fixed_toman_off, max_discount_toman, usage_limit, used_count, is_active, expires_at, created_at
) VALUES (
  'QAZVIN1405', 'طرح راه‌اندازی اورژانس خودرو در استان قزوین (۱۰٪ تخفیف تا سقف ۱۵۰ هزار تومان)',
  10, 0, 150000, 5000, 0, 1, '2027-03-21T00:00:00.000Z', '2026-10-26T00:00:00.000Z'
);

-- ۸. تنظیمات عمومی سامانه
INSERT INTO system_settings (key, value_json, description_fa, updated_at) VALUES
  ('support_hotline', '"028-33330000"', 'شماره تماس مرکز عملیات و پشتیبانی قزوین', '2026-10-26T00:00:00.000Z'),
  ('offer_expiry_minutes', '10', 'مهلت پاسخ‌گویی امدادگر به پیشنهاد مأموریت (دقیقه)', '2026-10-26T00:00:00.000Z'),
  ('allow_ev_services', 'true', 'وضعیت فعال بودن خدمات تخصصی خودروهای برقی در صورت وجود نیروی مجاز', '2026-10-26T00:00:00.000Z'),
  ('allow_postpay_debt', 'true', 'اجازه ثبت بدهی مجاز پس از تأیید اپراتور/مدیر در شرایط اضطراری جاده‌ای', '2026-10-26T00:00:00.000Z'),
  ('data_retention_days', '1825', 'سیاست نگهداری اسناد مالی و لاگ‌های ممیزی (۵ سال بر اساس مفروضات قانونی)', '2026-10-26T00:00:00.000Z');
