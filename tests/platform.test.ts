import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
import type { SmsProvider } from '../src/server/modules/notifications/sms-provider.ts';

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

  it('۶. چرخه کامل مأموریت، ماشین وضعیت، گزارش پایان خدمت، پرداخت ایمن، ضدتکرار Callback، بازپرداخت و تسویه امدادگر را اجرا می‌کند', async () => {
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

    // ایجاد سفارش پرداخت
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

    const walletAfter1 = await request(ctx.app)
      .get('/api/payments/responder/wallet')
      .set('Authorization', `Bearer ${evResponderToken}`)
      .expect(200);
    const initialCreditedBalance = walletAfter1.body.balanceToman as number;
    expect(initialCreditedBalance).toBeGreaterThan(0);

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

    // درخواست تسویه بخشی از درآمد توسط امدادگر و تأیید توسط مدیر کل
    const settlementRes = await request(ctx.app)
      .post('/api/payments/responder/settlements')
      .set('Authorization', `Bearer ${evResponderToken}`)
      .send({ amountToman: 100000 })
      .expect(201);

    await request(ctx.app)
      .post(`/api/payments/admin/settlements/${settlementRes.body.result.settlementId}/process`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        decision: 'approved_paid',
        bankReferenceCode: 'PAYA-140508049981',
        note: 'واریز از طریق چرخه اول پایا انجام شد',
      })
      .expect(200);

    // بازپرداخت جزئی به مشتری توسط مدیر کل و بررسی گزارش تطبیق مالی
    await request(ctx.app)
      .post('/api/payments/admin/refunds')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requestId: reqId,
        amountToman: 50000,
        reason: 'تخفیف رضایت‌مندی مدیریت پس از بررسی فاکتور قطعه',
      })
      .expect(201);

    const reconRes = await request(ctx.app)
      .get('/api/payments/admin/reconciliation')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(reconRes.body.report.summary.totalRefundedToman).toBe(50000);
    expect(reconRes.body.report.summary.settlementsPaidToman).toBe(100000);
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
          providerMessageId: 'recovered_001',
        };
      },
    });

    const retryRes = await request(ctx.app)
      .post(`/api/notifications/admin/${failedSms.id}/retry`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(retryRes.body.result.ok).toBe(true);

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
    const rolled1 = rollbackLastMigration(migTestCtx.db);
    expect(rolled1).toBe('002_reference_catalog_qazvin.down.sql');
    const rolled2 = rollbackLastMigration(migTestCtx.db);
    expect(rolled2).toBe('001_initial_schema.down.sql');
    const reapplied = runMigrations(migTestCtx.db);
    expect(reapplied.length).toBe(2);
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
});
