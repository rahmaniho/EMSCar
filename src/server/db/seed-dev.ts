import type { AppDatabase } from './connection.ts';
import { hashPassword } from '../modules/identity/password.ts';

export function seedDevelopmentData(
  db: AppDatabase,
  options: { isProduction: boolean }
): { seeded: boolean; message: string } {
  if (options.isProduction) {
    throw new Error(
      'خطای امنیتی (اصل ۸ مهندسی): بارگذاری داده‌های آزمایشی در محیط Production مطلقاً ممنوع است.'
    );
  }

  // تخفیف QAZVIN1405 یک داده نمایشی است؛ فقط در seed محیط توسعه فعال می‌شود.
  db.run("UPDATE discount_codes SET is_active = 1 WHERE code = 'QAZVIN1405'");

  const existingAdmin = db.get<{ id: number }>(
    'SELECT id FROM users WHERE phone = ?',
    '09120000001'
  );
  if (existingAdmin) {
    return {
      seeded: false,
      message: 'داده‌های محیط توسعه قبلاً بارگذاری شده‌اند.',
    };
  }

  const now = new Date().toISOString();
  const adminPass = hashPassword('Admin@1405!');
  const operatorPass = hashPassword('Operator@1405!');
  const responderPass = hashPassword('Responder@1405!');
  const customerPass = hashPassword('Customer@1405!');

  db.transaction(() => {
    const adminRes = db.run(
      `INSERT INTO users (phone, full_name, national_code, email, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'admin', 1, ?, ?)`,
      '09120000001',
      'مدیر ارشد سامانه (قزوین)',
      '4310000001',
      'admin@auto-emergency.local',
      adminPass,
      now,
      now
    );
    const adminId = adminRes.lastInsertRowid;

    db.run(
      `INSERT INTO users (phone, full_name, national_code, email, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'operator', 1, ?, ?)`,
      '09120000002',
      'سارا محمدی (اپراتور مرکز پیام قزوین)',
      '4310000002',
      'operator@auto-emergency.local',
      operatorPass,
      now,
      now
    );

    // ثبت تأییدیه رسمی اولیه استان قزوین توسط مدیر کل
    db.run(
      `UPDATE provinces SET approved_by_admin_id = ?, approved_at = ? WHERE slug = 'qazvin'`,
      adminId,
      now
    );

    const qazvinZones = db.all<{ id: number; code: string }>(
      `SELECT id, code FROM service_zones WHERE province_id = (SELECT id FROM provinces WHERE slug = 'qazvin')`
    );
    const allServices = db.all<{ id: number; slug: string }>(
      `SELECT id, slug FROM service_catalog`
    );
    const serviceBySlug = new Map(allServices.map((s) => [s.slug, s.id]));

    // امدادگر ۱: کارگاه سیار قزوین (تأییدشده)
    const r1User = db.run(
      `INSERT INTO users (phone, full_name, national_code, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'responder', 1, ?, ?)`,
      '09120000011',
      'رضا قاسمی (امدادگر سیار قزوین)',
      '4320000011',
      responderPass,
      now,
      now
    );
    const r1Profile = db.run(
      `INSERT INTO responder_profiles (
        user_id, verification_status, equipment_type, vehicle_plate, has_ev_certification,
        availability_status, max_concurrent_missions, max_dispatch_radius_km,
        current_lat, current_lng, location_updated_at, sheba_number,
        rating_avg, rating_count, completed_missions_count,
        verified_by_admin_id, verified_at, created_at, updated_at
      ) VALUES (?, 'approved', 'service_van', '۶۸ ع ۴۱۲ ایران ۷۹', 0, 'online', 1, 35, 36.2745, 50.0048, ?, 'IR820540102680020817909001', 4.9, 18, 42, ?, ?, ?, ?)`,
      r1User.lastInsertRowid,
      now,
      adminId,
      now,
      now,
      now
    );
    for (const doc of [
      ['national_card', '4320000011'],
      ['driving_license', 'DL-98112201'],
      ['technical_skill_cert', 'TVTO-QZV-4410'],
    ]) {
      db.run(
        `INSERT INTO responder_documents (responder_id, doc_type, doc_number, status, reviewed_by_admin_id, review_note, created_at, updated_at)
         VALUES (?, ?, ?, 'verified', ?, 'اصالت مدارک بررسی و تأیید شد', ?, ?)`,
        r1Profile.lastInsertRowid,
        doc[0],
        doc[1],
        adminId,
        now,
        now
      );
    }
    for (const slug of [
      'battery-jumpstart',
      'battery-replacement',
      'mobile-tire-repair',
      'tire-change',
      'emergency-fuel',
      'authorized-door-unlock',
      'initial-diagnostics',
      'light-onsite-repair',
      'onsite-part-replacement',
      'domestic-car-assistance',
      'foreign-car-assistance',
    ]) {
      const sid = serviceBySlug.get(slug);
      if (sid) {
        db.run(
          `INSERT INTO responder_services (responder_id, service_id, is_authorized) VALUES (?, ?, 1)`,
          r1Profile.lastInsertRowid,
          sid
        );
      }
    }
    for (const z of qazvinZones) {
      db.run(
        `INSERT INTO responder_zones (responder_id, zone_id) VALUES (?, ?)`,
        r1Profile.lastInsertRowid,
        z.id
      );
    }

    // امدادگر ۲: کفی خودروبر و یدک‌کش قزوین و الوند (تأییدشده)
    const r2User = db.run(
      `INSERT INTO users (phone, full_name, national_code, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'responder', 1, ?, ?)`,
      '09120000012',
      'مهدی رضایی (کفی خودروبر قزوین-الوند)',
      '4320000012',
      responderPass,
      now,
      now
    );
    const r2Profile = db.run(
      `INSERT INTO responder_profiles (
        user_id, verification_status, equipment_type, vehicle_plate, has_ev_certification,
        availability_status, max_concurrent_missions, max_dispatch_radius_km,
        current_lat, current_lng, location_updated_at, sheba_number,
        rating_avg, rating_count, completed_missions_count,
        verified_by_admin_id, verified_at, created_at, updated_at
      ) VALUES (?, 'approved', 'flatbed_tow', '۶۸ ع ۸۸۵ ایران ۷۹', 0, 'online', 1, 50, 36.1950, 50.0720, ?, 'IR550170000000229911004402', 4.8, 25, 61, ?, ?, ?, ?)`,
      r2User.lastInsertRowid,
      now,
      adminId,
      now,
      now,
      now
    );
    for (const doc of [
      ['national_card', '4320000012'],
      ['driving_license', 'DL-P2-774410'],
      ['tow_permit', 'TOW-QZV-9012'],
    ]) {
      db.run(
        `INSERT INTO responder_documents (responder_id, doc_type, doc_number, status, reviewed_by_admin_id, review_note, created_at, updated_at)
         VALUES (?, ?, ?, 'verified', ?, 'مجوز حمل ناوگان تأیید شد', ?, ?)`,
        r2Profile.lastInsertRowid,
        doc[0],
        doc[1],
        adminId,
        now,
        now
      );
    }
    for (const slug of [
      'towing',
      'transport-to-repair-shop',
      'transport-to-custom-destination',
      'tire-change',
    ]) {
      const sid = serviceBySlug.get(slug);
      if (sid) {
        db.run(
          `INSERT INTO responder_services (responder_id, service_id, is_authorized) VALUES (?, ?, 1)`,
          r2Profile.lastInsertRowid,
          sid
        );
      }
    }
    for (const z of qazvinZones) {
      db.run(
        `INSERT INTO responder_zones (responder_id, zone_id) VALUES (?, ?)`,
        r2Profile.lastInsertRowid,
        z.id
      );
    }

    // امدادگر ۳: متخصص خودروهای برقی EV (تأییدشده)
    const r3User = db.run(
      `INSERT INTO users (phone, full_name, national_code, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'responder', 1, ?, ?)`,
      '09120000013',
      'کاوه نادری (متخصص خودروهای برقی و خارجی)',
      '4320000013',
      responderPass,
      now,
      now
    );
    const r3Profile = db.run(
      `INSERT INTO responder_profiles (
        user_id, verification_status, equipment_type, vehicle_plate, has_ev_certification,
        availability_status, max_concurrent_missions, max_dispatch_radius_km,
        current_lat, current_lng, location_updated_at, sheba_number,
        rating_avg, rating_count, completed_missions_count,
        verified_by_admin_id, verified_at, created_at, updated_at
      ) VALUES (?, 'approved', 'ev_specialist_unit', '۶۸ د ۵۱۰ ایران ۷۹', 1, 'online', 1, 40, 36.3010, 50.0180, ?, 'IR190120020000008877665503', 5.0, 9, 19, ?, ?, ?, ?)`,
      r3User.lastInsertRowid,
      now,
      adminId,
      now,
      now,
      now
    );
    for (const doc of [
      ['national_card', '4320000013'],
      ['ev_high_voltage_cert', 'HV-EV-2026-301'],
    ]) {
      db.run(
        `INSERT INTO responder_documents (responder_id, doc_type, doc_number, status, reviewed_by_admin_id, review_note, created_at, updated_at)
         VALUES (?, ?, ?, 'verified', ?, 'گواهینامه ایمنی ولتاژ بالا تأیید شد', ?, ?)`,
        r3Profile.lastInsertRowid,
        doc[0],
        doc[1],
        adminId,
        now,
        now
      );
    }
    for (const slug of [
      'ev-specialized-service',
      'foreign-car-assistance',
      'initial-diagnostics',
      'battery-jumpstart',
    ]) {
      const sid = serviceBySlug.get(slug);
      if (sid) {
        db.run(
          `INSERT INTO responder_services (responder_id, service_id, is_authorized) VALUES (?, ?, 1)`,
          r3Profile.lastInsertRowid,
          sid
        );
      }
    }
    for (const z of qazvinZones) {
      db.run(
        `INSERT INTO responder_zones (responder_id, zone_id) VALUES (?, ?)`,
        r3Profile.lastInsertRowid,
        z.id
      );
    }

    // امدادگر ۴: در حال بررسی مدارک (جهت آزمون صف تأیید مدیریت و قفل فعالیت)
    const r4User = db.run(
      `INSERT INTO users (phone, full_name, national_code, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'responder', 1, ?, ?)`,
      '09120000014',
      'امیر حسینی (متقاضی امدادگری - در انتظار تأیید)',
      '4320000014',
      responderPass,
      now,
      now
    );
    const r4Profile = db.run(
      `INSERT INTO responder_profiles (
        user_id, verification_status, equipment_type, vehicle_plate, has_ev_certification,
        availability_status, max_concurrent_missions, max_dispatch_radius_km,
        current_lat, current_lng, location_updated_at, sheba_number,
        created_at, updated_at
      ) VALUES (?, 'under_review', 'motorcycle', '۶۸ ط ۲۲۱ ایران ۷۹', 0, 'offline', 1, 20, 36.2600, 50.0100, ?, 'IR440190000000112233445504', ?, ?)`,
      r4User.lastInsertRowid,
      now,
      now,
      now
    );
    db.run(
      `INSERT INTO responder_documents (responder_id, doc_type, doc_number, status, created_at, updated_at)
       VALUES (?, 'national_card', '4320000014', 'pending', ?, ?),
              (?, 'technical_skill_cert', 'TVTO-PENDING-77', 'pending', ?, ?)`,
      r4Profile.lastInsertRowid,
      now,
      now,
      r4Profile.lastInsertRowid,
      now,
      now
    );

    // مشتری نمونه
    const c1User = db.run(
      `INSERT INTO users (phone, full_name, national_code, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'customer', 1, ?, ?)`,
      '09120000021',
      'علی کریمی',
      '4310000021',
      customerPass,
      now,
      now
    );
    db.run(
      `INSERT INTO customer_vehicles (customer_user_id, brand, model, manufacture_year, plate_number, category, color, notes, created_at)
       VALUES
         (?, 'ایران‌خودرو', 'پژو ۲۰۷ اتوماتیک', 1402, '۶۸ ب ۳۴۵ ایران ۷۹', 'domestic', 'سفید', 'گیربکس اتوماتیک', ?),
         (?, 'کرمان‌موتور', 'KMC E50A برقی', 1404, '۶۸ ج ۷۱۲ ایران ۷۹', 'electric', 'مشکی', 'خودروی تمام برقی', ?)`,
      c1User.lastInsertRowid,
      now,
      c1User.lastInsertRowid,
      now
    );
  });

  return {
    seeded: true,
    message: 'حساب‌های ارزیابی محیط توسعه با موفقیت ایجاد شدند.',
  };
}
