import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAppContext } from '../src/server/app.ts';
import { seedDevelopmentData } from '../src/server/db/seed-dev.ts';
import { createDatabaseBackup } from '../src/server/db/backup.ts';
import { rollbackLastMigration, runMigrations } from '../src/server/db/migrator.ts';
import {
  calculateOfficialPrice,
  tomanToRial,
  rialToToman,
} from '../src/shared/pricing-formula.ts';
import {
  KavenegarSmsProvider,
  SandboxOutboxSmsProvider,
  type SmsProvider,
} from '../src/server/modules/notifications/sms-provider.ts';

describe('سامانه جامع اورژانس خودرو — مجموعه تست‌های خودکار مهندسی، امنیتی و مالی', () => {
  let tmpDir: string;
  let ctx: ReturnType<typeof createAppContext>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emscar-test-'));
    ctx = createAppContext({
      configOverrides: {
        APP_ENV: 'test',
        DATABASE_PATH: path.join(tmpDir, 'test.db'),
        PRIVATE_STORAGE_DIR: path.join(tmpDir, 'private'),
        DATABASE_BACKUP_DIR: path.join(tmpDir, 'backups'),
        RATE_LIMIT_MAX_REQUESTS: '500',
        AUTH_RATE_LIMIT_MAX_REQUESTS: '100',
        // قابلیت‌های ویژه در آزمون یکپارچه صریحاً فعال می‌شوند؛ Production پیش‌فرض آن‌ها خاموش است.
        FEATURE_ALLOW_EV_SERVICES: 'true',
        FEATURE_ALLOW_POSTPAY_DEBT: 'true',
      },
    });
    ctx.attachErrorHandler();
    seedDevelopmentData(ctx.db, { isProduction: false });
  });

  afterEach(() => {
    ctx.db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function loginAs(phone: string, password: string): Promise<string> {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ phone, password })
      .expect(200);
    return res.body.token as string;
  }

  it('۱. فرمول قیمت‌گذاری، ضرایب، سقف تخفیف، مالیات و تبدیل تومان/ریال را دقیق محاسبه می‌کند', () => {
    const breakdown = calculateOfficialPrice({
      basePriceToman: 680000,
      dispatchDistanceKm: 10,
      includedFreeDispatchKm: 5,
      perKmDispatchToman: 20000, // 5 * 20,000 = 100,000
      towDistanceKm: 12,
      perKmTowToman: 28000, // 12 * 28,000 = 336,000
      vehicleCategory: 'foreign', // 1.25x روی 1,116,000 -> +279,000 = 1,395,000
      vehicleMultipliers: {
        domestic: 1.0,
        foreign: 1.25,
        electric: 1.35,
        suv_heavy: 1.2,
      },
      zoneMultiplier: 1.15, // آزادراه -> 1,395,000 * 0.15 = +209,250 -> 1,604,250
      isUrgentOrNight: true,
      urgentNightMultiplier: 1.2, // +320,850 -> 1,925,100
      partsCostToman: 200000,
      discountPercent: 10, // 192,510 اما سقف 150,000 -> 150,000 تخفیف
      maxDiscountToman: 150000,
      taxRatePercent: 10,
    });

    expect(breakdown.currency).toBe('TOMAN');
    expect(breakdown.dispatchDistanceFeeToman).toBe(100000);
    expect(breakdown.towTransportFeeToman).toBe(336000);
    expect(breakdown.discountAmountToman).toBe(150000);
    expect(breakdown.taxableServiceNetToman).toBe(1775100);
    expect(breakdown.taxAmountToman).toBe(197510); // 10% از (1,775,100 + 200,000)
    expect(breakdown.totalToman).toBe(2172610);
    expect(breakdown.totalRialForGateway).toBe(21726100);
    expect(rialToToman(tomanToRial(450000))).toBe(450000);
  });

  it('۲. ثبت‌نام، ورود، نرمال‌سازی ارقام فارسی موبایل و جلوگیری از ثبت‌نام غیرمجاز نقش مدیر را رعایت می‌کند', async () => {
    // تلاش برای ثبت‌نام مستقیم با نقش admin باید رد شود
    await request(ctx.app)
      .post('/api/auth/register')
      .send({
        phone: '09129998877',
        fullName: 'مهاجم فرضی',
        password: 'Password123!',
        role: 'admin',
      })
      .expect(400);

    // ثبت‌نام مشتری با ارقام فارسی موبایل
    const reg = await request(ctx.app)
      .post('/api/auth/register')
      .send({
        phone: '۰۹۱۲۹۹۹۸۸۷۷',
        fullName: 'مریم احمدی',
        password: 'SecurePass123!',
        role: 'customer',
      })
      .expect(201);

    expect(reg.body.user.phone).toBe('09129998877');
    expect(reg.body.user.role).toBe('customer');

    // رمز اشتباه باید 401 بدهد و در security_events ثبت شود
    await request(ctx.app)
      .post('/api/auth/login')
      .send({ phone: '09129998877', password: 'WrongPassword!' })
      .expect(401);

    // خروج از نشست توکن را باطل می‌کند
    await request(ctx.app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .expect(200);

    const meAfterLogout = await request(ctx.app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .expect(200);
    expect(meAfterLogout.body.user).toBeNull();
  });

  it('۳. کنترل دسترسی سمت سرور (RBAC)، قفل امدادگر تأییدنشده و حفاظت در برابر IDOR را اعمال می‌کند', async () => {
    const customerToken = await loginAs('09120000021', 'Customer@1405!');
    const unapprovedResponderToken = await loginAs('09120000014', 'Responder@1405!');

    // مشتری نباید به پنل مدیریت یا صف اپراتور دسترسی داشته باشد
    await request(ctx.app)
      .get('/api/admin/reports/overview')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);

    await request(ctx.app)
      .get('/api/requests/staff/queue')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);

    // امدادگر تأییدنشده نباید بتواند آنلاین شود
    const onlineAttempt = await request(ctx.app)
      .post('/api/responders/availability')
      .set('Authorization', `Bearer ${unapprovedResponderToken}`)
      .send({ status: 'online', lat: 36.2688, lng: 50.0041 })
      .expect(403);
    expect(onlineAttempt.body.error.code).toBe('RESPONDER_NOT_APPROVED');
  });

  it('۴. راهبرد جغرافیایی ایران: فقط استان قزوین فعال است؛ سایر استان‌ها مسدودند و فعال‌سازی نیازمند تأیید صریح مدیر کل است', async () => {
    const customerToken = await loginAs('09120000021', 'Customer@1405!');
    const adminToken = await loginAs('09120000001', 'Admin@1405!');

    const vehiclesRes = await request(ctx.app)
      .get('/api/customers/vehicles')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const domesticVehicle = vehiclesRes.body.vehicles.find(
      (v: { category: string }) => v.category === 'domestic'
    );

    const servicesRes = await request(ctx.app).get('/api/catalog/services').expect(200);
    const jumpstart = servicesRes.body.services.find(
      (s: { slug: string }) => s.slug === 'battery-jumpstart'
    );

    // تلاش ثبت درخواست در تهران (وضعیت در حال آماده‌سازی) باید با 422 رد شود
    const tehranAttempt = await request(ctx.app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        vehicleId: domesticVehicle.id,
        serviceId: jumpstart.id,
        originLat: 35.6892,
        originLng: 51.389,
        originAddress: 'تهران، میدان آزادی',
        issueDescription: 'استارت نمی‌خورد',
      })
      .expect(422);
    expect(tehranAttempt.body.error.code).toBe('PROVINCE_NOT_ACTIVE');

    // تلاش ثبت درخواست در کرج/البرز (در انتظار تأیید) نیز باید رد شود
    const karajAttempt = await request(ctx.app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        vehicleId: domesticVehicle.id,
        serviceId: jumpstart.id,
        originLat: 35.84,
        originLng: 50.9391,
        originAddress: 'کرج، عظیمیه',
        issueDescription: 'باتری خوابیده',
      })
      .expect(422);
    expect(karajAttempt.body.error.code).toBe('PROVINCE_NOT_ACTIVE');

    // تلاش مدیر کل برای فعال‌سازی البرز بدون تأیید صریح باید رد شود
    const geoOverview = await request(ctx.app).get('/api/geography/overview').expect(200);
    const alborz = geoOverview.body.provinces.find(
      (p: { slug: string }) => p.slug === 'alborz'
    );

    await request(ctx.app)
      .post(`/api/geography/admin/provinces/${alborz.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'active',
        reason: 'راه‌اندازی آزمایشی البرز',
        explicitAdminConfirmation: false,
      })
      .expect(400);

    // با تأیید صریح مدیر کل، استان فعال و تاریخچه ثبت می‌شود
    await request(ctx.app)
      .post(`/api/geography/admin/provinces/${alborz.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'active',
        reason: 'تکمیل ظرفیت ناوگان و تأیید نهایی هیئت‌مدیره',
        explicitAdminConfirmation: true,
      })
      .expect(200);

    const historyRes = await request(ctx.app)
      .get('/api/geography/admin/history')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(historyRes.body.history.length).toBeGreaterThanOrEqual(1);
  });

  it('۵. جلوگیری از ثبت تکراری درخواست (Idempotency-Key) و جلوگیری اتمیک از پذیرش هم‌زمان یک مأموریت توسط دو امدادگر', async () => {
    const customerToken = await loginAs('09120000021', 'Customer@1405!');
    const responder1Token = await loginAs('09120000011', 'Responder@1405!');
    const responder3Token = await loginAs('09120000013', 'Responder@1405!'); // هر دو مجاز به battery-jumpstart در قزوین هستند!

    const vehiclesRes = await request(ctx.app)
      .get('/api/customers/vehicles')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const domesticVehicle = vehiclesRes.body.vehicles.find(
      (v: { category: string }) => v.category === 'domestic'
    );
    const servicesRes = await request(ctx.app).get('/api/catalog/services').expect(200);
    const jumpstart = servicesRes.body.services.find(
      (s: { slug: string }) => s.slug === 'battery-jumpstart'
    );

    const idemKey = 'client-req-unique-001';
    const firstSubmit = await request(ctx.app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', idemKey)
      .send({
        vehicleId: domesticVehicle.id,
        serviceId: jumpstart.id,
        originLat: 36.285,
        originLng: 50.011,
        originAddress: 'قزوین، بلوار نخبگان، جنب پارک علم و فناوری',
        issueDescription: 'خودرو استارت نمی‌خورد و چراغ پشت آمپر ضعیف است',
      })
      .expect(201);

    // ارسال تکراری با همان کلید نباید رکورد دومی ایجاد کند
    const duplicateSubmit = await request(ctx.app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', idemKey)
      .send({
        vehicleId: domesticVehicle.id,
        serviceId: jumpstart.id,
        originLat: 36.285,
        originLng: 50.011,
        originAddress: 'قزوین، بلوار نخبگان، جنب پارک علم و فناوری',
        issueDescription: 'خودرو استارت نمی‌خورد و چراغ پشت آمپر ضعیف است',
      })
      .expect(200);

    expect(duplicateSubmit.body.deduplicated).toBe(true);
    expect(duplicateSubmit.body.request.id).toBe(firstSubmit.body.request.id);

    const reqId = firstSubmit.body.request.id as number;
    expect(firstSubmit.body.request.status).toBe('Offered');

    // بررسی حریم خصوصی قبل از پذیرش: امدادگر شماره تلفن و نشانی دقیق مشتری را در پیشنهاد نمی‌بیند
    const r1Offers = await request(ctx.app)
      .get('/api/requests/responder/offers')
      .set('Authorization', `Bearer ${responder1Token}`)
      .expect(200);
    expect(r1Offers.body.offers.length).toBe(1);
    expect(r1Offers.body.offers[0].customerPhone).toBeUndefined();

    // پذیرش اول توسط امدادگر ۱ موفق می‌شود
    await request(ctx.app)
      .post(`/api/requests/${reqId}/accept`)
      .set('Authorization', `Bearer ${responder1Token}`)
      .expect(200);

    // تلاش پذیرش هم‌زمان/دوم توسط امدادگر ۳ با خطای 409 مسدود می‌شود
    const secondAccept = await request(ctx.app)
      .post(`/api/requests/${reqId}/accept`)
      .set('Authorization', `Bearer ${responder3Token}`)
      .expect(409);
    expect(['MISSION_ALREADY_ASSIGNED', 'OFFER_NOT_AVAILABLE']).toContain(
      secondAccept.body.error.code
    );
  });

  it('۶. چرخه مأموریت و پرداخت Sandbox را اجرا می‌کند، بازپرداخت را fail-closed می‌سنجد و دادهٔ آزمایشی را از گزارش واقعی جدا می‌کند', async () => {
    const customerToken = await loginAs('09120000021', 'Customer@1405!');
    const evResponderToken = await loginAs('09120000013', 'Responder@1405!');
    const adminToken = await loginAs('09120000001', 'Admin@1405!');

    // ثبت مشتری دوم برای تست ضد IDOR روی فایل و درخواست
    const otherCustReg = await request(ctx.app)
      .post('/api/auth/register')
      .send({
        phone: '09127776655',
        fullName: 'کاربر غیرمرتبط',
        password: 'OtherUser123!',
        role: 'customer',
      })
      .expect(201);
    const otherCustomerToken = otherCustReg.body.token as string;

    const vehiclesRes = await request(ctx.app)
      .get('/api/customers/vehicles')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const evVehicle = vehiclesRes.body.vehicles.find(
      (v: { category: string }) => v.category === 'electric'
    );
    const servicesRes = await request(ctx.app).get('/api/catalog/services').expect(200);
    const evService = servicesRes.body.services.find(
      (s: { slug: string }) => s.slug === 'ev-specialized-service'
    );

    // ثبت درخواست تخصصی خودروی برقی در پونک قزوین با کد تخفیف QAZVIN1405
    const createRes = await request(ctx.app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        vehicleId: evVehicle.id,
        serviceId: evService.id,
        originLat: 36.298,
        originLng: 50.015,
        originAddress: 'قزوین، پونک، بلوار امیرکبیر، کوچه گلستان ۴',
        issueDescription: 'خطای سیستم مدیریت باتری کمکی ۱۲ ولت در خودروی برقی',
        discountCode: 'QAZVIN1405',
      })
      .expect(201);

    const reqId = createRes.body.request.id as number;

    // تست ضد IDOR: مشتری دیگر نمی‌تواند جزئیات درخواست را ببیند
    await request(ctx.app)
      .get(`/api/requests/${reqId}`)
      .set('Authorization', `Bearer ${otherCustomerToken}`)
      .expect(403);

    // بارگذاری تصویر خصوصی روی درخواست و تست حفاظت فایل خصوصی
    const uploadRes = await request(ctx.app)
      .post(`/api/requests/${reqId}/attachments`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        originalName: 'dashboard-error.png',
        mimeType: 'image/png',
        base64Data: Buffer.from('fake-png-binary-content').toString('base64'),
      })
      .expect(201);
    const attachmentId = uploadRes.body.attachment.id as number;

    await request(ctx.app)
      .get(`/api/requests/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${otherCustomerToken}`)
      .expect(403);

    await request(ctx.app)
      .get(`/api/requests/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    // فقط امدادگر دارای گواهینامه EV باید پیشنهاد این خدمت را دریافت کرده باشد
    const evOffers = await request(ctx.app)
      .get('/api/requests/responder/offers')
      .set('Authorization', `Bearer ${evResponderToken}`)
      .expect(200);
    expect(evOffers.body.offers.some((o: { requestId: number }) => o.requestId === reqId)).toBe(
      true
    );

    // خاموش‌کردن عرضهٔ EV نباید مأموریتی را که قبلاً ساخته شده متوقف کند.
    ctx.db.run("UPDATE system_settings SET value_json = 'false' WHERE key = 'allow_ev_services'");

    // پذیرش مأموریت توسط متخصص EV
    await request(ctx.app)
      .post(`/api/requests/${reqId}/accept`)
      .set('Authorization', `Bearer ${evResponderToken}`)
      .expect(200);

    // تلاش برای پرش نامعتبر مستقیم از Accepted به Completed باید با 409 رد شود
    await request(ctx.app)
      .post(`/api/requests/${reqId}/complete`)
      .set('Authorization', `Bearer ${evResponderToken}`)
      .send({
        summary: 'تلاش پرش غیرمجاز',
        actionsTaken: 'تلاش نامعتبر',
        partsUsed: [],
      })
      .expect(409);

    // طی کردن معتبر مراحل: EnRoute -> Arrived -> InProgress -> Completed
    for (const nextStatus of ['EnRoute', 'Arrived', 'InProgress'] as const) {
      await request(ctx.app)
        .post(`/api/requests/${reqId}/responder-status`)
        .set('Authorization', `Bearer ${evResponderToken}`)
        .send({ nextStatus, lat: 36.298, lng: 50.015 })
        .expect(200);
    }

    const completeRes = await request(ctx.app)
      .post(`/api/requests/${reqId}/complete`)
      .set('Authorization', `Bearer ${evResponderToken}`)
      .send({
        summary: 'رفع خطای رله سیستم ۱۲ ولت کمکی و کالیبراسیون دیاگ EV',
        actionsTaken: 'تعویض رله محافظ ۱۲ ولت و پاک‌سازی خطاهای کن‌باس',
        partsUsed: [{ name: 'رله محافظ استاندارد ۱۲ ولت', costToman: 180000 }],
        priceChangeReason: 'افزودن قطعه رله محافظ ۱۲ ولت با اطلاع مشتری',
      })
      .expect(200);

    expect(completeRes.body.request.status).toBe('Completed');
    expect(completeRes.body.request.invoice).toBeTruthy();
    expect(completeRes.body.request.pricing.customerPriceApprovalRequired).toBe(true);

    // تلاش پرداخت پیش از تأیید تغییر قیمت توسط مشتری باید با 409 مسدود شود
    await request(ctx.app)
      .post('/api/payments/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ requestId: reqId })
      .expect(409);

    // تأیید تغییر مبلغ نهایی توسط مشتری
    await request(ctx.app)
      .post(`/api/requests/${reqId}/approve-price`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    // بدهی پس‌پرداخت با هر دو پرچم فعال ثبت می‌شود، اما هرگز به‌عنوان وجه دریافتی گزارش نمی‌شود.
    const debtSetting = ctx.db.get<{ value_json: string }>(
      "SELECT value_json FROM system_settings WHERE key = 'allow_postpay_debt'"
    );
    expect(debtSetting?.value_json).toBe('false');
    const operatorToken = await loginAs('09120000002', 'Operator@1405!');
    ctx.db.run(
      "UPDATE system_settings SET value_json = 'true' WHERE key = 'allow_postpay_debt'"
    );
    const debtCapability = await request(ctx.app)
      .get('/api/payments/staff/capabilities')
      .set('Authorization', `Bearer ${operatorToken}`)
      .expect(200);
    expect(debtCapability.body.postpayDebtEnabled).toBe(true);

    // سفارش پرداخت باز باید جلوی ثبت بدهی را بگیرد تا Callback دیررس، دو وضعیت مالی نسازد.
    const preDebtOrder = await request(ctx.app)
      .post('/api/payments/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ requestId: reqId })
      .expect(201);
    const pendingDebtAttempt = await request(ctx.app)
      .post('/api/payments/staff/approve-debt')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ requestId: reqId, reason: 'تأیید مهلت پرداخت طبق رویه آزمون' })
      .expect(409);
    expect(pendingDebtAttempt.body.error.code).toBe('PAYMENT_ATTEMPT_IN_PROGRESS');
    await request(ctx.app)
      .post('/api/payments/sandbox/simulate')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ authority: preDebtOrder.body.order.authority, outcome: 'fail' })
      .expect(200);
    const failedBeforeDebt = await request(ctx.app)
      .post('/api/payments/callback/verify')
      .send({ authority: preDebtOrder.body.order.authority })
      .expect(200);
    expect(failedBeforeDebt.body.result.paid).toBe(false);

    const debtRes = await request(ctx.app)
      .post('/api/payments/staff/approve-debt')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ requestId: reqId, reason: 'تأیید مهلت پرداخت طبق رویه آزمون' })
      .expect(200);
    expect(debtRes.body.paymentStatus).toBe('approved_debt');
    expect(debtRes.body.paymentReceived).toBe(false);
    expect(debtRes.body.amountToman).toBeGreaterThan(0);
    expect(
      ctx.db.get<{ payment_status: string }>(
        'SELECT payment_status FROM service_requests WHERE id = ?',
        reqId
      )?.payment_status
    ).toBe('approved_debt');
    expect(
      ctx.db.get<{ status: string }>(
        'SELECT status FROM invoices WHERE request_id = ?',
        reqId
      )?.status
    ).toBe('approved_debt');
    expect(
      ctx.db.get<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM payment_intents WHERE request_id = ? AND status = 'verified'`,
        reqId
      )?.cnt
    ).toBe(0);
    await request(ctx.app)
      .post('/api/payments/staff/approve-debt')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ requestId: reqId, reason: 'تلاش تکراری برای ثبت بدهی' })
      .expect(409);

    // ایجاد سفارش پرداخت واقعی/آزمایشی (برچسب Sandbox در آزمون حفظ می‌شود)
    const orderRes = await request(ctx.app)
      .post('/api/payments/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ requestId: reqId })
      .expect(201);
    const authority = orderRes.body.order.authority as string;
    expect(orderRes.body.order.isSandbox).toBe(true);

    // تلاش جعل Callback صرفاً با ارسال پارامتر مرورگر بدون تأیید در سرور بانک باید ناموفق ثبت شود!
    const spoofedCallback = await request(ctx.app)
      .post('/api/payments/callback/verify')
      .send({ authority, status: 'OK' })
      .expect(200);
    expect(spoofedCallback.body.result.paid).toBe(false);

    // ایجاد سفارش جدید پس از شکست قبلی و شبیه‌سازی پرداخت واقعی در سرور Sandbox بانک
    const order2Res = await request(ctx.app)
      .post('/api/payments/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ requestId: reqId })
      .expect(201);
    const validAuthority = order2Res.body.order.authority as string;

    await request(ctx.app)
      .post('/api/payments/sandbox/simulate')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ authority: validAuthority, outcome: 'approve' })
      .expect(200);

    const verify1 = await request(ctx.app)
      .post('/api/payments/callback/verify')
      .send({ authority: validAuthority, status: 'OK' })
      .expect(200);
    expect(verify1.body.result.paid).toBe(true);
    expect(verify1.body.result.alreadyProcessed).toBe(false);
    expect(verify1.body.result.isSandbox).toBe(true);
    const sandboxRequestDetail = await request(ctx.app)
      .get(`/api/requests/${reqId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(sandboxRequestDetail.body.request.paymentIsSandbox).toBe(true);
    expect(sandboxRequestDetail.body.request.paymentStatusLabel).toContain('Sandbox');
    const customerRequestList = await request(ctx.app)
      .get('/api/requests/my')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(
      customerRequestList.body.requests.find((item: { id: number }) => item.id === reqId)
        ?.paymentStatusLabel
    ).toContain('Sandbox');
    const customerPaymentHistory = await request(ctx.app)
      .get('/api/payments/customer/history')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const sandboxInvoice = customerPaymentHistory.body.invoices.find(
      (item: { request_id: number }) => item.request_id === reqId
    );
    expect(sandboxInvoice.payment_is_sandbox).toBe(1);
    expect(
      ctx.db.get<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM notifications
         WHERE request_id = ? AND event_type = 'PAYMENT_SANDBOX_VERIFIED' AND channel = 'sms'`,
        reqId
      )?.cnt
    ).toBe(0);
    expect(
      ctx.db.get<{ title: string }>(
        `SELECT title FROM notifications
         WHERE request_id = ? AND event_type = 'PAYMENT_SANDBOX_VERIFIED' AND channel = 'in_app'`,
        reqId
      )?.title
    ).toContain('شبیه‌سازی‌شده');

    const walletAfter1 = await request(ctx.app)
      .get('/api/payments/responder/wallet')
      .set('Authorization', `Bearer ${evResponderToken}`)
      .expect(200);
    const initialCreditedBalance = walletAfter1.body.balanceToman as number;
    expect(initialCreditedBalance).toBeGreaterThan(0);
    expect(walletAfter1.body.eligibleForSettlementToman).toBe(initialCreditedBalance);

    // ارسال دوباره همان Callback (تست Idempotency) نباید موجودی امدادگر را دوبرابر کند!
    const verify2 = await request(ctx.app)
      .post('/api/payments/callback/verify')
      .send({ authority: validAuthority, status: 'OK' })
      .expect(200);
    expect(verify2.body.result.paid).toBe(true);
    expect(verify2.body.result.alreadyProcessed).toBe(true);

    const walletAfter2 = await request(ctx.app)
      .get('/api/payments/responder/wallet')
      .set('Authorization', `Bearer ${evResponderToken}`)
      .expect(200);
    expect(walletAfter2.body.balanceToman).toBe(initialCreditedBalance);

    // ثبت امتیاز ۵ ستاره توسط مشتری و جلوگیری از ثبت امتیاز تکراری
    await request(ctx.app)
      .post('/api/ratings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        requestId: reqId,
        rating: 5,
        tags: ['سرعت بالا', 'تخصص فنی'],
        comment: 'بسیار حرفه‌ای و دقیق انجام شد.',
      })
      .expect(201);

    await request(ctx.app)
      .post('/api/ratings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ requestId: reqId, rating: 4 })
      .expect(409);

    // درخواست تسویه در Sandbox فقط شبیه‌سازی می‌شود و مرجع بانکی ساختگی تولید/ثبت نمی‌شود.
    const settlementRes = await request(ctx.app)
      .post('/api/payments/responder/settlements')
      .set('Authorization', `Bearer ${evResponderToken}`)
      .send({ amountToman: 100000 })
      .expect(201);
    expect(settlementRes.body.result.simulationOnly).toBe(true);
    expect(settlementRes.body.result.executionMode).toBe('sandbox_simulated');

    const settlementProcess = await request(ctx.app)
      .post(`/api/payments/admin/settlements/${settlementRes.body.result.settlementId}/process`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'approved_paid' })
      .expect(200);
    expect(settlementProcess.body.result.simulationOnly).toBe(true);
    expect(settlementProcess.body.result.payoutExecutedByPlatform).toBe(false);
    expect(settlementProcess.body.result.bankTransferVerifiedByProvider).toBe(false);
    expect(
      ctx.db.get<{ bank_reference_code: string | null; execution_mode: string }>(
        'SELECT bank_reference_code, execution_mode FROM settlements WHERE id = ?',
        settlementRes.body.result.settlementId
      )
    ).toEqual({ bank_reference_code: null, execution_mode: 'sandbox_simulated' });

    // بازپرداخت بدون provider واقعی باید fail-closed باشد و هیچ دادهٔ مالی را تغییر ندهد.
    const paymentStatusBeforeRefund = ctx.db.get<{ payment_status: string }>(
      'SELECT payment_status FROM service_requests WHERE id = ?',
      reqId
    )?.payment_status;
    const invoiceStatusBeforeRefund = ctx.db.get<{ status: string }>(
      'SELECT status FROM invoices WHERE request_id = ?',
      reqId
    )?.status;
    const responderProfile = ctx.db.get<{ id: number }>(
      'SELECT id FROM responder_profiles WHERE user_id = (SELECT id FROM users WHERE phone = ?)',
      '09120000013'
    );
    const walletBeforeRefund = ctx.db.get<{ balance_after_toman: number }>(
      'SELECT balance_after_toman FROM wallet_ledger_entries WHERE responder_id = ? ORDER BY id DESC LIMIT 1',
      responderProfile!.id
    )?.balance_after_toman;
    const refundDenied = await request(ctx.app)
      .post('/api/payments/admin/refunds')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requestId: reqId,
        amountToman: 50000,
        reason: 'درخواست بازپرداخت برای آزمون fail closed',
      })
      .expect(503);
    expect(refundDenied.body.error.code).toBe('REFUND_PROVIDER_UNAVAILABLE');
    expect(
      ctx.db.get<{ payment_status: string }>(
        'SELECT payment_status FROM service_requests WHERE id = ?',
        reqId
      )?.payment_status
    ).toBe(paymentStatusBeforeRefund);
    expect(
      ctx.db.get<{ status: string }>(
        'SELECT status FROM invoices WHERE request_id = ?',
        reqId
      )?.status
    ).toBe(invoiceStatusBeforeRefund);
    expect(
      ctx.db.get<{ balance_after_toman: number }>(
        'SELECT balance_after_toman FROM wallet_ledger_entries WHERE responder_id = ? ORDER BY id DESC LIMIT 1',
        responderProfile!.id
      )?.balance_after_toman
    ).toBe(walletBeforeRefund);
    expect(ctx.db.get<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM refunds')?.cnt).toBe(0);

    // رکورد قدیمی بدون مدرک provider پس از migration در طبقه legacy می‌ماند و از جمع واقعی حذف می‌شود.
    const verifiedIntent = ctx.db.get<{ id: number }>(
      "SELECT id FROM payment_intents WHERE request_id = ? AND status = 'verified' ORDER BY id DESC LIMIT 1",
      reqId
    );
    const adminUser = ctx.db.get<{ id: number }>(
      'SELECT id FROM users WHERE phone = ?',
      '09120000001'
    );
    ctx.db.run(
      `INSERT INTO refunds (
        payment_intent_id, request_id, amount_toman, reason, approved_by_admin_id, status, created_at
      ) VALUES (?, ?, ?, ?, ?, 'completed', ?)`,
      verifiedIntent!.id,
      reqId,
      50000,
      'رکورد تاریخی فاقد مدرک provider',
      adminUser!.id,
      new Date().toISOString()
    );

    const reconRes = await request(ctx.app)
      .get('/api/payments/admin/reconciliation')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(reconRes.body.report.gateway.connectionVerified).toBe(false);
    expect(reconRes.body.report.summary.grossVerifiedToman).toBe(0);
    expect(reconRes.body.report.summary.totalRefundedToman).toBe(0);
    expect(reconRes.body.report.summary.netCollectedToman).toBe(0);
    expect(reconRes.body.report.summary.settlementsPaidToman).toBe(0);
    expect(reconRes.body.report.sandbox.grossPaymentsToman).toBeGreaterThan(0);
    expect(reconRes.body.report.sandbox.verifiedPaymentsCount).toBe(1);
    expect(reconRes.body.report.sandbox.settlementsPaidToman).toBe(100000);
    expect(reconRes.body.report.excludedUnverified.legacyRefundsToman).toBe(50000);
    expect(reconRes.body.report.excludedUnverified.legacyRefundsCount).toBe(1);
  });

  it('۷. ثبت تیکت شکایت، محرمانگی یادداشت داخلی اپراتور و ارجاع پرونده به UnderSupportReview را تضمین می‌کند', async () => {
    const customerToken = await loginAs('09120000021', 'Customer@1405!');
    const operatorToken = await loginAs('09120000002', 'Operator@1405!');

    const vehiclesRes = await request(ctx.app)
      .get('/api/customers/vehicles')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const domesticVehicle = vehiclesRes.body.vehicles.find(
      (v: { category: string }) => v.category === 'domestic'
    );
    const servicesRes = await request(ctx.app).get('/api/catalog/services').expect(200);
    const svc = servicesRes.body.services[0];

    const reqRes = await request(ctx.app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        vehicleId: domesticVehicle.id,
        serviceId: svc.id,
        originLat: 36.2688,
        originLng: 50.0041,
        originAddress: 'قزوین، خیابان خیام جنوبی',
        issueDescription: 'خاموش شدن ناگهانی خودرو',
      })
      .expect(201);
    const reqId = reqRes.body.request.id as number;

    const ticketRes = await request(ctx.app)
      .post('/api/support/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        requestId: reqId,
        category: 'delay',
        subject: 'پیگیری زمان رسیدن واحد امداد',
        message: 'لطفاً وضعیت اعزام را بررسی بفرمایید.',
      })
      .expect(201);
    const ticketId = ticketRes.body.ticket.id as number;

    // اپراتور یادداشت داخلی محرمانه ثبت می‌کند
    await request(ctx.app)
      .post(`/api/support/tickets/${ticketId}/internal-notes`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ note: 'یادداشت داخلی محرمانه اپراتور: تماس تلفنی با سرشیفت قزوین برقرار شد.' })
      .expect(201);

    // بررسی اینکه اپراتور یادداشت داخلی را می‌بیند اما مشتری هرگز آن را در پاسخ API دریافت نمی‌کند!
    const staffView = await request(ctx.app)
      .get(`/api/support/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .expect(200);
    expect(staffView.body.ticket.internalNotes.length).toBe(1);

    const customerView = await request(ctx.app)
      .get(`/api/support/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(customerView.body.ticket.internalNotes).toBeUndefined();

    // ارجاع به مدیر کل و انتقال مأموریت به UnderSupportReview
    await request(ctx.app)
      .post(`/api/support/tickets/${ticketId}/escalate`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        reason: 'نیازمند بررسی ویژه مدیر عملیات قزوین',
        placeRequestUnderReview: true,
      })
      .expect(200);

    const updatedReq = await request(ctx.app)
      .get(`/api/requests/${reqId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(updatedReq.body.request.status).toBe('UnderSupportReview');
  });

  it('۸. تاب‌آوری در برابر خطای سرویس پیامک خارجی، تلاش مجدد کنترل‌شده، پشتیبان‌گیری و بازگردانی Migration را اثبات می‌کند', async () => {
    const customerToken = await loginAs('09120000021', 'Customer@1405!');
    const adminToken = await loginAs('09120000001', 'Admin@1405!');

    // تزریق سرویس پیامک خراب برای تست عدم شکست تراکنش اصلی مأموریت
    const failingSms: SmsProvider = {
      name: 'failing_telecom',
      isSandbox: false,
      async sendSms() {
        throw new Error('ECONNREFUSED: درگاه مخابراتی موقتاً در دسترس نیست');
      },
    };
    ctx.services.notificationsService.setSmsProviderForTesting(failingSms);

    const vehiclesRes = await request(ctx.app)
      .get('/api/customers/vehicles')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const domesticVehicle = vehiclesRes.body.vehicles.find(
      (v: { category: string }) => v.category === 'domestic'
    );
    const servicesRes = await request(ctx.app).get('/api/catalog/services').expect(200);

    // با وجود خرابی کامل پیامک، ثبت درخواست نباید خطا بدهد
    const reqRes = await request(ctx.app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        vehicleId: domesticVehicle.id,
        serviceId: servicesRes.body.services[0].id,
        originLat: 36.2688,
        originLng: 50.0041,
        originAddress: 'قزوین، چهارراه طالقانی',
        issueDescription: 'تست تاب‌آوری در برابر خطای پیامک',
      })
      .expect(201);
    expect(reqRes.body.request.id).toBeGreaterThan(0);

    // بررسی ثبت وضعیت failed در جدول اعلان‌ها
    const outboxRes = await request(ctx.app)
      .get('/api/notifications/admin/outbox')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const failedSms = outboxRes.body.logs.find(
      (l: { channel: string; delivery_status: string }) =>
        l.channel === 'sms' && l.delivery_status === 'failed'
    );
    expect(failedSms).toBeTruthy();

    // بازیابی سرویس پیامک و تست تلاش مجدد کنترل‌شده توسط مدیر
    ctx.services.notificationsService.setSmsProviderForTesting({
      name: 'recovered_provider',
      isSandbox: true,
      async sendSms() {
        return {
          status: 'sandbox_logged',
          providerName: 'recovered_provider',
          providerMessageId: null,
        };
      },
    });

    const retryRes = await request(ctx.app)
      .post(`/api/notifications/admin/${failedSms.id}/retry`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(202);
    expect(retryRes.body.ok).toBe(true);
    expect(retryRes.body.result.ok).toBe(false);
    expect(retryRes.body.result.acceptedByProvider).toBe(false);
    expect(retryRes.body.result.simulationOnly).toBe(true);
    expect(
      ctx.db.get<{ delivery_status: string; provider_message_id: string | null }>(
        'SELECT delivery_status, provider_message_id FROM notifications WHERE id = ?',
        failedSms.id
      )
    ).toEqual({ delivery_status: 'sandbox_logged', provider_message_id: null });

    // پذیرش provider واقعی با شناسه باید از Sandbox متمایز بماند و فقط «پذیرش» ثبت کند.
    ctx.services.notificationsService.setSmsProviderForTesting({
      name: 'test_live_sms_provider',
      isSandbox: false,
      async sendSms() {
        return {
          status: 'provider_accepted',
          providerName: 'test_live_sms_provider',
          providerMessageId: '123456789',
        };
      },
    });
    const adminUser = ctx.db.get<{ id: number }>(
      'SELECT id FROM users WHERE phone = ?',
      '09120000001'
    );
    await ctx.services.notificationsService.notifyUser({
      userId: adminUser!.id,
      eventType: 'SMS_PROVIDER_ACCEPTANCE_TEST',
      title: 'آزمون پذیرش provider',
      body: 'این آزمون تحویل به گوشی را اثبات نمی‌کند.',
      sendSms: true,
      dedupBaseKey: 'sms-provider-acceptance-test',
    });
    expect(
      ctx.db.get<{ delivery_status: string; provider_message_id: string | null }>(
        "SELECT delivery_status, provider_message_id FROM notifications WHERE dedup_key = 'sms:sms-provider-acceptance-test'"
      )
    ).toEqual({ delivery_status: 'sent', provider_message_id: '123456789' });

    // تست پشتیبان‌گیری آنلاین با بررسی سلامت فایل پشتیبان
    const backup = createDatabaseBackup(ctx.db, ctx.config.resolvedBackupDir);
    expect(backup.integrityCheck).toBe('ok');
    expect(fs.existsSync(backup.backupFilePath)).toBe(true);

    // تست چرخه Rollback روی پایگاه داده مجزا
    const migTestCtx = createAppContext({
      configOverrides: {
        APP_ENV: 'test',
        DATABASE_PATH: path.join(tmpDir, 'mig-rollback.db'),
      },
    });
    expect(
      migTestCtx.db.get<{ value_json: string }>(
        "SELECT value_json FROM system_settings WHERE key = 'allow_postpay_debt'"
      )?.value_json
    ).toBe('false');
    const rolled1 = rollbackLastMigration(migTestCtx.db);
    expect(rolled1).toBe('005_mark_unverified_financial_records.down.sql');
    expect(
      migTestCtx.db.all<{ name: string }>('PRAGMA table_info(refunds)').map((row) => row.name)
    ).not.toContain('verification_mode');
    expect(
      migTestCtx.db.all<{ name: string }>('PRAGMA table_info(settlements)').map((row) => row.name)
    ).not.toContain('execution_mode');
    const rolled2 = rollbackLastMigration(migTestCtx.db);
    expect(rolled2).toBe('004_disable_unverified_postpay_debt.down.sql');
    expect(
      migTestCtx.db.get<{ value_json: string }>(
        "SELECT value_json FROM system_settings WHERE key = 'allow_postpay_debt'"
      )?.value_json
    ).toBe('true');
    const rolled3 = rollbackLastMigration(migTestCtx.db);
    expect(rolled3).toBe('003_disable_unverified_launch_defaults.down.sql');
    const rolled4 = rollbackLastMigration(migTestCtx.db);
    expect(rolled4).toBe('002_reference_catalog_qazvin.down.sql');
    const rolled5 = rollbackLastMigration(migTestCtx.db);
    expect(rolled5).toBe('001_initial_schema.down.sql');
    const reapplied = runMigrations(migTestCtx.db);
    expect(reapplied.length).toBe(5);
    migTestCtx.db.close();
  });

  it('۹. قوانین لغو درخواست (رایگان پیش از حرکت و جریمه ایاب‌وذهاب پس از حرکت امدادگر) و آزادسازی ظرفیت امدادگر را اعمال می‌کند', async () => {
    const customerToken = await loginAs('09120000021', 'Customer@1405!');
    const responderToken = await loginAs('09120000011', 'Responder@1405!');

    const vehiclesRes = await request(ctx.app)
      .get('/api/customers/vehicles')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const domesticVehicle = vehiclesRes.body.vehicles.find(
      (v: { category: string }) => v.category === 'domestic'
    );
    const servicesRes = await request(ctx.app).get('/api/catalog/services').expect(200);
    const jumpstart = servicesRes.body.services.find(
      (s: { slug: string }) => s.slug === 'battery-jumpstart'
    );

    // الف) لغو پیش از حرکت امدادگر -> جریمه صفر
    const req1 = await request(ctx.app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        vehicleId: domesticVehicle.id,
        serviceId: jumpstart.id,
        originLat: 36.2688,
        originLng: 50.0041,
        originAddress: 'قزوین، میدان آزادی (سبزه‌میدان)',
        issueDescription: 'باتری ضعیف شده است',
      })
      .expect(201);

    const cancelFree = await request(ctx.app)
      .post(`/api/requests/${req1.body.request.id}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ reason: 'خودرو با کمک همسایه روشن شد' })
      .expect(200);
    expect(cancelFree.body.request.status).toBe('Cancelled');
    expect(cancelFree.body.request.pricing.cancellationFeeToman).toBe(0);

    // ب) لغو پس از حرکت امدادگر (EnRoute) -> ثبت جریمه مصوب ایاب‌وذهاب و آزادسازی امدادگر
    const req2 = await request(ctx.app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        vehicleId: domesticVehicle.id,
        serviceId: jumpstart.id,
        originLat: 36.2688,
        originLng: 50.0041,
        originAddress: 'قزوین، خیابان فردوسی',
        issueDescription: 'نیاز به باتری به باتری فوری',
      })
      .expect(201);
    const req2Id = req2.body.request.id as number;

    await request(ctx.app)
      .post(`/api/requests/${req2Id}/accept`)
      .set('Authorization', `Bearer ${responderToken}`)
      .expect(200);

    await request(ctx.app)
      .post(`/api/requests/${req2Id}/responder-status`)
      .set('Authorization', `Bearer ${responderToken}`)
      .send({ nextStatus: 'EnRoute' })
      .expect(200);

    const cancelWithFee = await request(ctx.app)
      .post(`/api/requests/${req2Id}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ reason: 'انصراف پس از حرکت امدادگر' })
      .expect(200);
    expect(cancelWithFee.body.request.status).toBe('Cancelled');
    expect(cancelWithFee.body.request.pricing.cancellationFeeToman).toBe(
      jumpstart.enrouteCancelFeeToman
    );

    const respAfterCancel = await request(ctx.app)
      .get('/api/responders/me')
      .set('Authorization', `Bearer ${responderToken}`)
      .expect(200);
    expect(respAfterCancel.body.profile.availabilityStatus).toBe('online');
  });

  it('۱۰. در صورت نبود امدادگر آزاد، وعده غیرواقعی نمی‌دهد، درخواست را به صف اپراتور ارجاع می‌دهد و تخصیص دستی را ممکن می‌کند', async () => {
    const customerToken = await loginAs('09120000021', 'Customer@1405!');
    const towResponderToken = await loginAs('09120000012', 'Responder@1405!');
    const operatorToken = await loginAs('09120000002', 'Operator@1405!');

    // آفلاین کردن تنها امدادگر کفی خودروبر
    const towMe = await request(ctx.app)
      .post('/api/responders/availability')
      .set('Authorization', `Bearer ${towResponderToken}`)
      .send({ status: 'offline' })
      .expect(200);
    const towResponderId = towMe.body.profile.id as number;

    const vehiclesRes = await request(ctx.app)
      .get('/api/customers/vehicles')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const domesticVehicle = vehiclesRes.body.vehicles.find(
      (v: { category: string }) => v.category === 'domestic'
    );
    const servicesRes = await request(ctx.app).get('/api/catalog/services').expect(200);
    const flatbedService = servicesRes.body.services.find(
      (s: { slug: string }) => s.slug === 'transport-to-custom-destination'
    );

    const reqRes = await request(ctx.app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        vehicleId: domesticVehicle.id,
        serviceId: flatbedService.id,
        originLat: 36.1892,
        originLng: 50.0642,
        originAddress: 'الوند، بلوار سهروردی',
        destinationLat: 36.2688,
        destinationLng: 50.0041,
        destinationAddress: 'قزوین، تعمیرگاه مرکزی بلوار آیت‌الله خامنه‌ای',
        issueDescription: 'خرابی گیربکس اتوماتیک، نیازمند کفی خودروبر',
      })
      .expect(201);

    // باید صادقانه در Searching بماند، ETA ساختگی نداشته باشد و پرچم ارجاع به اپراتور فعال باشد
    expect(reqRes.body.request.status).toBe('Searching');
    expect(reqRes.body.request.estimatedEtaMinutes).toBeNull();
    expect(reqRes.body.request.operatorEscalationRequired).toBe(true);

    // اپراتور پس از هماهنگی تلفنی، امدادگر تأییدشده را دستی اختصاص می‌دهد
    await request(ctx.app)
      .post(`/api/requests/${reqRes.body.request.id}/staff-assign`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ responderId: towResponderId })
      .expect(200);

    const afterAssign = await request(ctx.app)
      .get(`/api/requests/${reqRes.body.request.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(afterAssign.body.request.status).toBe('Accepted');
    expect(afterAssign.body.request.operatorEscalationRequired).toBe(false);
  });

  it('۱۱. الزامات احراز مالکیت بازگشایی در، الزام مقصد برای یدک‌کش و قفل‌های امنیتی محیط Production را رعایت می‌کند', async () => {
    const customerToken = await loginAs('09120000021', 'Customer@1405!');
    const vehiclesRes = await request(ctx.app)
      .get('/api/customers/vehicles')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const domesticVehicle = vehiclesRes.body.vehicles.find(
      (v: { category: string }) => v.category === 'domestic'
    );
    const servicesRes = await request(ctx.app).get('/api/catalog/services').expect(200);
    const unlockService = servicesRes.body.services.find(
      (s: { slug: string }) => s.slug === 'authorized-door-unlock'
    );
    const towingService = servicesRes.body.services.find(
      (s: { slug: string }) => s.slug === 'towing'
    );

    // باز کردن در خودرو بدون تأیید مالکیت باید با 400 رد شود
    await request(ctx.app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        vehicleId: domesticVehicle.id,
        serviceId: unlockService.id,
        originLat: 36.2688,
        originLng: 50.0041,
        originAddress: 'قزوین، خیابان سپه',
        issueDescription: 'جا ماندن سوئیچ داخل خودرو',
        ownershipConfirmed: false,
      })
      .expect(400);

    // یدک‌کش بدون تعیین مقصد حمل باید رد شود
    await request(ctx.app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        vehicleId: domesticVehicle.id,
        serviceId: towingService.id,
        originLat: 36.2688,
        originLng: 50.0041,
        originAddress: 'قزوین، میدان مینودر',
        issueDescription: 'بریدن پلوس خودرو',
      })
      .expect(400);

    // قفل محیط Production در برابر بارگذاری داده ساختگی و کلید نشست ناامن
    expect(() =>
      seedDevelopmentData(ctx.db, { isProduction: true })
    ).toThrow();

    expect(() =>
      createAppContext({
        configOverrides: {
          APP_ENV: 'production',
          SESSION_SECRET: 'weak',
        },
      })
    ).toThrow();
  });

  it('۱۲. تیکت پشتیبانی، مخفی‌سازی یادداشت محرمانه اپراتور از دید مشتری، ارجاع به مدیر و داشبورد مدیریتی را تضمین می‌کند', async () => {
    const customerToken = await loginAs('09120000021', 'Customer@1405!');
    const operatorToken = await loginAs('09120000002', 'Operator@1405!');
    const adminToken = await loginAs('09120000001', 'Admin@1405!');

    const createTicketRes = await request(ctx.app)
      .post('/api/support/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        category: 'pricing_dispute',
        subject: 'بررسی هزینه قطعه مصرفی',
        message: 'لطفاً فاکتور باتری تعویضی را مجدداً بررسی فرمایید.',
      })
      .expect(201);

    const ticketId = createTicketRes.body.ticket.id as number;

    // اپراتور یادداشت محرمانه داخلی ثبت می‌کند
    const opNoteRes = await request(ctx.app)
      .post(`/api/support/tickets/${ticketId}/internal-notes`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        note: 'استعلام قیمت نمایندگی باتری قزوین انجام شد — نیاز به بررسی مدیر مالی',
      })
      .expect(201);

    expect(opNoteRes.body.ticket.internalNotes).toHaveLength(1);

    // مشتری نباید به هیچ وجه یادداشت محرمانه اپراتور را ببیند
    const custViewRes = await request(ctx.app)
      .get(`/api/support/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    expect(custViewRes.body.ticket.internalNotes).toBeUndefined();

    // مشتری نباید بتواند به مسیر یادداشت داخلی اپراتور ارسال کند (403)
    await request(ctx.app)
      .post(`/api/support/tickets/${ticketId}/internal-notes`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ note: 'تلاش غیرمجاز' })
      .expect(403);

    // اپراتور پرونده را به مدیر ارجاع می‌دهد و مدیر حل‌وفصل می‌کند
    await request(ctx.app)
      .post(`/api/support/tickets/${ticketId}/escalate`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ reason: 'نیاز به مصوبه بازنگری مالی مدیر کل', placeRequestUnderReview: false })
      .expect(200);

    const resolvedRes = await request(ctx.app)
      .post(`/api/support/tickets/${ticketId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ resolutionSummary: 'بررسی انجام و تاییدیه گارانتی باتری برای مشتری صادر شد.' })
      .expect(200);

    expect(resolvedRes.body.ticket.status).toBe('resolved');

    // داشبورد اجرایی و گزارش ممیزی مدیر ارشد
    const dashRes = await request(ctx.app)
      .get('/api/admin/reports/overview')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(dashRes.body.geographyReadiness.length).toBeGreaterThanOrEqual(6);
    const qazvin = dashRes.body.geographyReadiness.find(
      (p: { slug: string }) => p.slug === 'qazvin'
    );
    expect(qazvin.status).toBe('active');

    const auditRes = await request(ctx.app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(auditRes.body.adminAuditLogs.length).toBeGreaterThan(0);
  });

  it('۱۳. استعلام عمومی کد رهگیری بدون نشت اطلاعات شخصی/مکانی و مدیریت تنظیمات و زون‌های ادمین را تضمین می‌کند', async () => {
    const customerToken = await loginAs('09120000021', 'Customer@1405!');
    const operatorToken = await loginAs('09120000002', 'Operator@1405!');
    const adminToken = await loginAs('09120000001', 'Admin@1405!');

    const vehiclesRes = await request(ctx.app)
      .get('/api/customers/vehicles')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const domesticVehicle = vehiclesRes.body.vehicles[0];
    const servicesRes = await request(ctx.app).get('/api/catalog/services').expect(200);

    const created = await request(ctx.app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        vehicleId: domesticVehicle.id,
        serviceId: servicesRes.body.services[0].id,
        originLat: 36.2688,
        originLng: 50.0041,
        originAddress: 'قزوین، خیابان خیام جنوبی، کوچه ۱۲، پلاک ۴',
        issueDescription: 'استارت نخوردن خودرو در پارکینگ',
      })
      .expect(201);

    const trackingCode = created.body.request.trackingCode as string;
    const requestId = created.body.request.id as number;

    // استعلام عمومی بدون توکن فقط خلاصه وضعیت و محدوده را می‌دهد و تلفن/آدرس دقیق/پلاک ندارد
    const publicTrack = await request(ctx.app)
      .get(`/api/requests/track/${trackingCode}`)
      .expect(200);

    expect(publicTrack.body.summary.trackingCode).toBe(trackingCode);
    expect(publicTrack.body.summary.provinceName).toContain('قزوین');
    expect(publicTrack.body.summary.originAddress).toBeUndefined();
    expect(publicTrack.body.summary.customerPhone).toBeUndefined();
    expect(publicTrack.body.summary.originLat).toBeUndefined();

    // اپراتور وضعیت مأموریت را با ثبت یادداشت به UnderSupportReview می‌برد
    const opTrans = await request(ctx.app)
      .post(`/api/requests/${requestId}/staff-transition`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        toStatus: 'UnderSupportReview',
        note: 'بررسی هماهنگی تلفنی مرکز عملیات قزوین',
      })
      .expect(200);
    expect(opTrans.body.request.status).toBe('UnderSupportReview');

    // مدیر ارشد تنظیمات سیستمی را ویرایش می‌کند و لاگ ممیزی ثبت می‌شود
    await request(ctx.app)
      .put('/api/admin/settings/support_hotline')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: '028-33339999' })
      .expect(200);

    const pubInfo = await request(ctx.app)
      .get('/api/system/public-info')
      .expect(200);
    expect(pubInfo.body.supportHotline).toBe('028-33339999');
  });

  it('۱۴. مسیر رویدادهای بلادرنگ (SSE) احراز هویت را الزام می‌کند و فیلتر نقش‌محور رویدادها را رعایت می‌نماید', async () => {
    // بدون احراز هویت باید با 401 مسدود شود
    await request(ctx.app).get('/api/events/stream').expect(401);

    // بررسی تفکیک نقش‌محور در RealtimeBus
    const receivedByCust1: string[] = [];
    const receivedByCust2: string[] = [];
    const receivedByOperator: string[] = [];

    const mockRes = (sink: string[]) =>
      ({
        writableEnded: false,
        write: (chunk: string) => {
          if (chunk.startsWith('event: platform_update')) {
            sink.push(chunk);
          }
          return true;
        },
      }) as unknown as import('express').Response;

    const clean1 = ctx.services.realtimeBus.addClient({
      userId: 101,
      role: 'customer',
      res: mockRes(receivedByCust1),
    });
    const clean2 = ctx.services.realtimeBus.addClient({
      userId: 202,
      role: 'customer',
      res: mockRes(receivedByCust2),
    });
    const cleanOp = ctx.services.realtimeBus.addClient({
      userId: 2,
      role: 'operator',
      res: mockRes(receivedByOperator),
    });

    ctx.services.realtimeBus.publish({
      type: 'RESPONDER_LOCATION_UPDATED',
      requestId: 55,
      customerUserId: 101,
      responderUserId: 11,
      status: 'EnRoute',
    });

    expect(receivedByCust1).toHaveLength(1);
    expect(receivedByCust2).toHaveLength(0); // مشتری دیگر نباید رویداد مکانی مشتری ۱۰۱ را دریافت کند
    expect(receivedByOperator).toHaveLength(1); // اپراتور مرکز پیام رویداد را دریافت می‌کند

    clean1();
    clean2();
    cleanOp();
    expect(ctx.services.realtimeBus.getConnectedCount()).toBe(0);
  });

  it('۱۵. وب‌اپلیکیشن ۲۶ اسلایدی طرح کسب‌وکار تعاملی (site/ و مسیرهای /showcase و /EMSCar) کامل و معتبر سرو می‌شود', async () => {
    expect(fs.existsSync(path.resolve(process.cwd(), 'site/.nojekyll'))).toBe(true);
    expect(
      fs.existsSync(path.resolve(process.cwd(), '.github/workflows/pages.yml'))
    ).toBe(true);

    const htmlRes = await request(ctx.app).get('/showcase/').expect(200);
    expect(htmlRes.headers['content-type']).toMatch(/html/);
    expect(htmlRes.text).toContain('اورژانس خودرو | EMSCar');
    expect(htmlRes.text).toContain('Auto Emergency');
    expect(htmlRes.text).toContain('استان قزوین');
    expect(htmlRes.text).toContain('تومان');
    expect(htmlRes.text).toContain('اسلاید ۱ از ۲۶');
    expect(htmlRes.text).toContain('مشاوره حقوقی قطعی محسوب نمی‌شوند');

    // سازگاری کامل با زیرمسیر مخزن در GitHub Pages (/EMSCar/)
    const ghPathRes = await request(ctx.app).get('/EMSCar/').expect(200);
    expect(ghPathRes.text).toContain('اورژانس خودرو | EMSCar');

    const cssRes = await request(ctx.app).get('/showcase/styles.css').expect(200);
    expect(cssRes.headers['content-type']).toMatch(/css/);

    // بررسی ماژول‌های تفکیک‌شده داده، مدل مالی، نمودارها و کنترلر ارائه
    for (const modPath of [
      '/showcase/app.js',
      '/showcase/data/slides.js',
      '/showcase/data/financial-model.js',
      '/showcase/components/charts.js',
    ]) {
      const modRes = await request(ctx.app).get(modPath).expect(200);
      expect(modRes.headers['content-type']).toMatch(/javascript/);
    }

    // بررسی فونت محلی Vazirmatn و فاوآیکون اختصاصی برند
    const fontRes = await request(ctx.app)
      .get('/showcase/assets/fonts/Vazirmatn-VF.woff2')
      .expect(200);
    expect(Number(fontRes.headers['content-length'])).toBeGreaterThan(50000);

    const iconRes = await request(ctx.app)
      .get('/showcase/assets/favicon.svg')
      .expect(200);
    expect(iconRes.headers['content-type']).toMatch(/svg/);

    // راستی‌آزمایی وجود و سرو صحیح تمامی تصاویر اختصاصی مراحل عملیات
    for (const imgName of [
      'hero-qazvin-dispatch.jpg',
      'step1-mobile-sos.jpg',
      'step2-control-center.jpg',
      'step3-onsite-diagnostics.jpg',
      'step4-flatbed-tow.jpg',
      'step5-ev-specialist.jpg',
      'step6-payment-invoice.jpg',
    ]) {
      const imgRes = await request(ctx.app)
        .get(`/showcase/assets/${imgName}`)
        .expect(200);
      expect(imgRes.headers['content-type']).toMatch(/jpeg/);
    }

    await request(ctx.app).get('/showcase/404.html').expect(200);
  });

  it('۱۶. ساختار داده ۲۶ اسلاید، وضعیت‌های ۵گانه شفافیت داده، ۱۱ ریسک و ۱۳ شاخص KPI کامل است', async () => {
    const slidesMod = await import('../site/data/slides.js');
    expect(slidesMod.SLIDES_META).toHaveLength(26);
    expect(Object.keys(slidesMod.DATA_STATUS_META)).toEqual([
      'verified',
      'estimated',
      'assumption',
      'proposed',
      'unknown',
    ]);
    expect(slidesMod.RISKS_11).toHaveLength(11);
    expect(slidesMod.KPIS_13).toHaveLength(13);

    slidesMod.SLIDES_META.forEach((s, idx) => {
      expect(s.order).toBe(idx + 1);
      expect(typeof s.title).toBe('string');
      expect(s.title.length).toBeGreaterThan(5);
      expect(typeof s.takeaway).toBe('string');
      expect(s.takeaway.length).toBeGreaterThan(15);
      expect(typeof s.source).toBe('string');
      expect(typeof s.notes).toBe('string');
      expect(slidesMod.DATA_STATUS_META[s.dataStatus]).toBeTruthy();
    });
  });

  it('۱۷. موتور مالی تومان/ریال، اقتصاد واحد (LTV مبتنی بر حاشیه سود)، پیش‌بینی ۳ سناریویی و نمودارهای SVG دقیق عمل می‌کنند', async () => {
    const fin = await import('../site/data/financial-model.js');
    const charts = await import('../site/components/charts.js');

    expect(fin.SERVICES_CATALOG_15).toHaveLength(15);

    const quote = fin.calculateOfficialQuote({
      serviceSlug: 'towing',
      zoneMultiplier: 1.15,
      vehicleType: 'suv_heavy',
      dispatchKm: 10,
      towKm: 20,
      isUrgentNight: false,
      partsToman: 200000,
      hasWelcomeDiscount: true,
    });
    expect(quote.totalRial).toBe(quote.totalToman * 10);
    expect(quote.discountToman).toBeLessThanOrEqual(150000);
    // کمیسیون ۱۵٪ صرفاً روی اجرت خالص است نه قطعه مصرفی
    expect(quote.platformCommissionToman).toBe(Math.round(quote.netServiceToman * 0.15));

    const ue = fin.computeUnitEconomics({
      avgOrderServiceToman: 600000,
      commissionRatePct: 15,
      directVariableCostPerOrderToman: 20000,
      monthlyMarketingSpendToman: 14000000,
      monthlyNewCustomers: 100,
      annualOrdersPerCustomer: 2.0,
      avgCustomerRetentionYears: 2.0,
    });
    // LTV باید دقیقاً بر مبنای سود ناخالص سهم پلتفرم محاسبه شود (۷۰ هزار × ۴ = ۲۸۰ هزار تومان)
    expect(ue.grossProfitPerOrder).toBe(70000);
    expect(ue.ltvToman).toBe(280000);
    expect(ue.ltvToCac).toBeCloseTo(2.0, 2);

    const fc = fin.computeThreeScenarios12M({});
    expect(fc.base.months).toHaveLength(12);
    expect(fc.growth.totalOrdersYear1).toBeGreaterThan(fc.conservative.totalOrdersYear1);

    const be = fin.computeBreakEvenAndSensitivity({});
    expect(be.baseline.breakEvenOrders).toBeGreaterThan(0);
    expect(be.levers).toHaveLength(6);
    expect(be.mostSensitiveVariable.length).toBeGreaterThan(3);

    // راستی‌آزمایی تولید SVG معتبر و دسترس‌پذیر در تمام توابع نمودار
    expect(charts.renderForecastTrendSvg(fc.base)).toContain('<svg');
    expect(charts.renderScenarioBarsSvg(fc)).toContain('<svg');
    expect(charts.renderSensitivityTornadoSvg(be)).toContain('<svg');
    expect(charts.renderCompetitorMatrixSvg()).toContain('<svg');
    expect(charts.renderAcquisitionFunnelSvg()).toContain('<svg');
    const slidesMod = await import('../site/data/slides.js');
    expect(charts.renderRiskMatrixSvg(slidesMod.RISKS_11, 'R1')).toContain('<svg');
  });
  it('۱۸. NODE_ENV=production بر APP_ENV توسعه اولویت دارد، seed و Sandbox را می‌بندد و سفارش عمومی را تا فعال‌سازی صریح مسدود می‌کند', async () => {
    const productionOverrides = {
      NODE_ENV: 'production',
      APP_ENV: 'development', // عمداً متناقض: NODE_ENV باید برنده شود.
      DATABASE_PATH: path.join(tmpDir, 'production-guard.db'),
      DATABASE_BACKUP_DIR: path.join(tmpDir, 'production-backups'),
      PRIVATE_STORAGE_DIR: path.join(tmpDir, 'production-private'),
      SESSION_SECRET: `test-only-secret-${'x'.repeat(48)}`,
      PAYMENT_PROVIDER: 'zarinpal',
      ENABLE_SANDBOX_GATEWAY: 'false',
      ZARINPAL_MERCHANT_ID: '00000000-0000-0000-0000-000000000000',
      ZARINPAL_SANDBOX: 'false',
      SMS_PROVIDER: 'kavenegar',
      KAVENEGAR_API_KEY: 'test-only-not-a-real-key',
      SMS_SENDER_NUMBER: 'test-sender-line',
      ENABLE_PUBLIC_OPERATIONS: 'false',
      FEATURE_ENABLE_DEV_SEED: 'true',
    };
    const productionCtx = createAppContext({ configOverrides: productionOverrides });
    productionCtx.attachErrorHandler();

    try {
      expect(productionCtx.config.isProduction).toBe(true);
      expect(productionCtx.config.APP_ENV).toBe('production');
      expect(productionCtx.config.FEATURE_ENABLE_DEV_SEED).toBe(false);
      expect(productionCtx.config.FEATURE_ALLOW_EV_SERVICES).toBe(false);
      expect(productionCtx.config.FEATURE_ALLOW_POSTPAY_DEBT).toBe(false);
      expect(
        productionCtx.db.get<{ count: number }>('SELECT COUNT(*) AS count FROM users')?.count
      ).toBe(0);
      expect(
        productionCtx.db.get<{ is_active: number }>(
          "SELECT is_active FROM discount_codes WHERE code = 'QAZVIN1405'"
        )?.is_active
      ).toBe(0);

      // حتی شماره باقیمانده از مهاجرت قدیمی/rollback نباید به‌عنوان خط واقعی منتشر شود.
      productionCtx.db.run(
        'UPDATE system_settings SET value_json = ? WHERE key = ?',
        JSON.stringify('028-33330000'),
        'support_hotline'
      );
      const publicInfo = await request(productionCtx.app)
        .get('/api/system/public-info')
        .expect(200);
      expect(publicInfo.body.environment).toBe('production');
      expect(publicInfo.body.devQuickLoginEnabled).toBe(false);
      expect(publicInfo.body.publicOperationsEnabled).toBe(false);
      expect(publicInfo.body.supportHotline).toBeNull();
      const productionCatalog = await request(productionCtx.app)
        .get('/api/catalog/services')
        .expect(200);
      expect(
        productionCatalog.body.services.some(
          (service: { slug: string }) => service.slug === 'ev-specialized-service'
        )
      ).toBe(false);

      const blocked = await request(productionCtx.app)
        .post('/api/requests')
        .send({})
        .expect(503);
      expect(blocked.body.error.code).toBe('PUBLIC_OPERATIONS_DISABLED');
      expect(() => seedDevelopmentData(productionCtx.db, { isProduction: true })).toThrow();
    } finally {
      productionCtx.db.close();
    }

    // حتی اگر sandbox به‌صورت صریح انتخاب شده باشد، Production اجازه اجرا نمی‌دهد.
    expect(() =>
      createAppContext({
        configOverrides: { ...productionOverrides, PAYMENT_PROVIDER: 'sandbox' },
      })
    ).toThrow(/Production/);
    expect(() =>
      createAppContext({
        configOverrides: { ...productionOverrides, SMS_PROVIDER: 'sandbox_outbox' },
      })
    ).toThrow(/Production/);
  });

  it('۱۹. پرچم‌های محیطی خدمات EV و بدهی را سمت سرور اعمال می‌کند و تنظیم غیر بولی را رد می‌کند', async () => {
    const featuresOffCtx = createAppContext({
      configOverrides: {
        APP_ENV: 'test',
        DATABASE_PATH: path.join(tmpDir, 'features-off.db'),
        DATABASE_BACKUP_DIR: path.join(tmpDir, 'features-off-backups'),
        PRIVATE_STORAGE_DIR: path.join(tmpDir, 'features-off-private'),
        FEATURE_ALLOW_EV_SERVICES: 'false',
        FEATURE_ALLOW_POSTPAY_DEBT: 'false',
        RATE_LIMIT_MAX_REQUESTS: '500',
        AUTH_RATE_LIMIT_MAX_REQUESTS: '100',
      },
    });
    featuresOffCtx.attachErrorHandler();
    seedDevelopmentData(featuresOffCtx.db, { isProduction: false });

    try {
      // حتی اگر دیتابیس قدیمی یا تنظیم مدیر مقدار true داشته باشد، قفل محیطی برنده است.
      featuresOffCtx.db.run(
        "UPDATE system_settings SET value_json = 'true' WHERE key IN ('allow_ev_services', 'allow_postpay_debt')"
      );
      const adminLogin = await request(featuresOffCtx.app)
        .post('/api/auth/login')
        .send({ phone: '09120000001', password: 'Admin@1405!' })
        .expect(200);
      const operatorLogin = await request(featuresOffCtx.app)
        .post('/api/auth/login')
        .send({ phone: '09120000002', password: 'Operator@1405!' })
        .expect(200);
      const adminToken = adminLogin.body.token as string;
      const operatorToken = operatorLogin.body.token as string;
      const debtCapability = await request(featuresOffCtx.app)
        .get('/api/payments/staff/capabilities')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);
      expect(debtCapability.body.postpayDebtEnabled).toBe(false);

      const catalog = await request(featuresOffCtx.app).get('/api/catalog/services').expect(200);
      expect(
        catalog.body.services.some((service: { slug: string }) => service.slug === 'ev-specialized-service')
      ).toBe(false);
      const evService = featuresOffCtx.db.get<{ id: number }>(
        "SELECT id FROM service_catalog WHERE slug = 'ev-specialized-service'"
      );
      const blockedQuote = await request(featuresOffCtx.app)
        .post('/api/pricing/quote')
        .send({
          serviceId: evService!.id,
          originLat: 36.298,
          originLng: 50.015,
          vehicleCategory: 'electric',
        })
        .expect(503);
      expect(blockedQuote.body.error.code).toBe('EV_SERVICES_DISABLED');
      const customerLogin = await request(featuresOffCtx.app)
        .post('/api/auth/login')
        .send({ phone: '09120000021', password: 'Customer@1405!' })
        .expect(200);
      const customerToken = customerLogin.body.token as string;
      const customerVehicles = await request(featuresOffCtx.app)
        .get('/api/customers/vehicles')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      const electricVehicle = customerVehicles.body.vehicles.find(
        (vehicle: { category: string }) => vehicle.category === 'electric'
      );
      const blockedEvRequest = await request(featuresOffCtx.app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          vehicleId: electricVehicle.id,
          serviceId: evService!.id,
          originLat: 36.298,
          originLng: 50.015,
          originAddress: 'قزوین، محدودهٔ پونک',
          issueDescription: 'تست قفل ثبت درخواست برای خدمت EV',
        })
        .expect(503);
      expect(blockedEvRequest.body.error.code).toBe('EV_SERVICES_DISABLED');

      const settings = await request(featuresOffCtx.app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      for (const key of ['allow_ev_services', 'allow_postpay_debt']) {
        const setting = settings.body.settings.find((row: { key: string }) => row.key === key);
        expect(setting.environmentLocked).toBe(true);
        expect(setting.effectiveValue).toBe(false);
      }

      const enabledEv = await request(featuresOffCtx.app)
        .put('/api/admin/settings/allow_ev_services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: true })
        .expect(403);
      expect(enabledEv.body.error.code).toBe('FEATURE_DISABLED_BY_ENVIRONMENT');
      const malformedFlag = await request(featuresOffCtx.app)
        .put('/api/admin/settings/allow_ev_services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'false' })
        .expect(400);
      expect(malformedFlag.body.error.code).toBe('INVALID_SETTING_VALUE');
      await request(featuresOffCtx.app)
        .put('/api/admin/settings/allow_postpay_debt')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: true })
        .expect(403);
      const blockedDebt = await request(featuresOffCtx.app)
        .post('/api/payments/staff/approve-debt')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ requestId: 999999, reason: 'تست قفل محیطی بدهی' })
        .expect(403);
      expect(blockedDebt.body.error.code).toBe('POSTPAY_DEBT_DISABLED');
    } finally {
      featuresOffCtx.db.close();
    }
  });

  it('۲۰. تسویهٔ زنده فقط با مرجع واقعی و تأیید صریح مدیر ثبت می‌شود و انتقال خودکار/استعلام بانکی ادعا نمی‌شود', async () => {
    const liveCtx = createAppContext({
      configOverrides: {
        APP_ENV: 'test',
        DATABASE_PATH: path.join(tmpDir, 'manual-settlement.db'),
        PRIVATE_STORAGE_DIR: path.join(tmpDir, 'manual-settlement-private'),
        DATABASE_BACKUP_DIR: path.join(tmpDir, 'manual-settlement-backups'),
        RATE_LIMIT_MAX_REQUESTS: '500',
        AUTH_RATE_LIMIT_MAX_REQUESTS: '100',
      },
      customPaymentGateway: {
        name: 'test_live_gateway',
        isSandbox: false,
        async createOrder() {
          return {
            authority: 'TEST-AUTH-0001',
            paymentRedirectUrl: 'https://example.invalid/pay',
            isSandbox: false,
          };
        },
        async verifyOrder() {
          return { verified: false, errorCode: 'TEST_ONLY', errorMessage: 'test provider' };
        },
      },
    });
    liveCtx.attachErrorHandler();
    seedDevelopmentData(liveCtx.db, { isProduction: false });

    try {
      const adminLogin = await request(liveCtx.app)
        .post('/api/auth/login')
        .send({ phone: '09120000001', password: 'Admin@1405!' })
        .expect(200);
      const adminToken = adminLogin.body.token as string;
      const responderLogin = await request(liveCtx.app)
        .post('/api/auth/login')
        .send({ phone: '09120000011', password: 'Responder@1405!' })
        .expect(200);
      const responderToken = responderLogin.body.token as string;
      const responder = liveCtx.db.get<{ id: number }>(
        'SELECT rp.id FROM responder_profiles rp JOIN users u ON u.id = rp.user_id WHERE u.phone = ?',
        '09120000011'
      );
      const now = new Date().toISOString();
      liveCtx.db.run(
        'UPDATE responder_profiles SET sheba_number = ? WHERE id = ?',
        'IR123456789012345678901234',
        responder!.id
      );
      liveCtx.db.run(
        `INSERT INTO wallet_ledger_entries (
          responder_id, entry_type, amount_toman, balance_after_toman, description, created_at
        ) VALUES (?, 'manual_adjustment', 125000, 125000, ?, ?)`,
        responder!.id,
        'تراز قدیمی فاقد سند پرداخت واقعی برای آزمون fail-closed',
        now
      );
      const unverifiedWallet = await request(liveCtx.app)
        .get('/api/payments/responder/wallet')
        .set('Authorization', `Bearer ${responderToken}`)
        .expect(200);
      expect(unverifiedWallet.body.balanceToman).toBe(125000);
      expect(unverifiedWallet.body.eligibleForSettlementToman).toBe(0);
      const blockedUnverifiedPayout = await request(liveCtx.app)
        .post('/api/payments/responder/settlements')
        .set('Authorization', `Bearer ${responderToken}`)
        .send({ amountToman: 50000 })
        .expect(422);
      expect(blockedUnverifiedPayout.body.error.code).toBe('INSUFFICIENT_VERIFIED_WALLET_BALANCE');

      const settlement = liveCtx.db.run(
        `INSERT INTO settlements (
          responder_id, amount_toman, sheba_number, status, execution_mode, created_at
        ) VALUES (?, ?, ?, 'requested', 'manual_external', ?)`,
        responder!.id,
        125000,
        'IR123456789012345678901234',
        now
      );
      liveCtx.db.run(
        `INSERT INTO settlements (
          responder_id, amount_toman, sheba_number, status, created_at
        ) VALUES (?, ?, ?, 'approved_paid', ?)`,
        responder!.id,
        70000,
        'IR123456789012345678901234',
        now
      );

      const missingAttestation = await request(liveCtx.app)
        .post(`/api/payments/admin/settlements/${settlement.lastInsertRowid}/process`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'approved_paid',
          bankReferenceCode: 'TEST-REAL-REF-1001',
          note: 'رسید بانکی واقعی مشاهده شد',
        })
        .expect(409);
      expect(missingAttestation.body.error.code).toBe('EXTERNAL_TRANSFER_CONFIRMATION_REQUIRED');
      expect(
        liveCtx.db.get<{ status: string }>(
          'SELECT status FROM settlements WHERE id = ?',
          settlement.lastInsertRowid
        )?.status
      ).toBe('requested');

      const missingReference = await request(liveCtx.app)
        .post(`/api/payments/admin/settlements/${settlement.lastInsertRowid}/process`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'approved_paid',
          note: 'رسید بانکی واقعی مشاهده شد',
          externalTransferConfirmed: true,
        })
        .expect(400);
      expect(missingReference.body.error.code).toBe('BANK_REF_REQUIRED');

      const accepted = await request(liveCtx.app)
        .post(`/api/payments/admin/settlements/${settlement.lastInsertRowid}/process`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          decision: 'approved_paid',
          bankReferenceCode: 'TEST-REAL-REF-1001',
          note: 'رسید بانکی واقعی مشاهده و تطبیق شد',
          externalTransferConfirmed: true,
        })
        .expect(200);
      expect(accepted.body.result.executionMode).toBe('manual_external');
      expect(accepted.body.result.simulationOnly).toBe(false);
      expect(accepted.body.result.payoutExecutedByPlatform).toBe(false);
      expect(accepted.body.result.bankTransferVerifiedByProvider).toBe(false);

      const report = await request(liveCtx.app)
        .get('/api/payments/admin/reconciliation')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(report.body.report.summary.settlementsPaidToman).toBe(125000);
      expect(report.body.report.sandbox.settlementsPaidToman).toBe(0);
      expect(report.body.report.excludedUnverified.legacySettlementsPaidToman).toBe(70000);

      const gatewayStatus = await request(liveCtx.app)
        .get('/api/payments/gateway-info')
        .expect(200);
      expect(gatewayStatus.body.gateway.connectionVerified).toBe(false);
      expect(gatewayStatus.body.gateway.noticeFa).toContain('اثبات نمی‌کند');
    } finally {
      liveCtx.db.close();
    }
  });

  it('۲۱. پذیرش پیامک کاوه‌نگار را فقط با پاسخ معتبر و شناسه واقعی ثبت می‌کند؛ Sandbox شناسه provider ندارد', async () => {
    const provider = new KavenegarSmsProvider('test-only-key', 'test-sender');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    try {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            return: { status: 200, message: 'تایید شد' },
            entries: [{ messageid: 123456789, status: 1, statustext: 'در صف ارسال' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
      const accepted = await provider.sendSms('09120000000', 'پیام آزمون');
      expect(accepted).toEqual({
        status: 'provider_accepted',
        providerName: 'kavenegar',
        providerMessageId: '123456789',
      });

      const invalidResponses = [
        {
          httpStatus: 200,
          body: { return: { status: 200 }, entries: [{ status: 1 }] },
        },
        {
          httpStatus: 200,
          body: { return: { status: 500 }, entries: [{ messageid: 123, status: 1 }] },
        },
        {
          httpStatus: 200,
          body: { return: { status: 200 }, entries: [{ messageid: 123, status: 11 }] },
        },
        {
          httpStatus: 503,
          body: { return: { status: 200 }, entries: [{ messageid: 123, status: 1 }] },
        },
      ];
      for (const invalid of invalidResponses) {
        fetchMock.mockResolvedValueOnce(
          new Response(JSON.stringify(invalid.body), {
            status: invalid.httpStatus,
            headers: { 'Content-Type': 'application/json' },
          })
        );
        await expect(provider.sendSms('09120000000', 'پیام آزمون')).rejects.toThrow();
      }

      const sandboxResult = await new SandboxOutboxSmsProvider().sendSms(
        '09120000000',
        'پیام شبیه‌سازی'
      );
      expect(sandboxResult).toEqual({
        status: 'sandbox_logged',
        providerName: 'sandbox_outbox',
        providerMessageId: null,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

});
