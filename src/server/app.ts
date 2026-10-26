import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { loadConfig, type AppConfig } from './config/env.ts';
import { AppDatabase } from './db/connection.ts';
import { runMigrations } from './db/migrator.ts';
import { AuditService } from './modules/audit/audit.service.ts';
import { IdentityService } from './modules/identity/identity.service.ts';
import { GeographyService } from './modules/geography/geography.service.ts';
import { CatalogService } from './modules/catalog/catalog.service.ts';
import { CustomersService } from './modules/customers/customers.service.ts';
import { RespondersService } from './modules/responders/responders.service.ts';
import { PricingService } from './modules/pricing/pricing.service.ts';
import {
  KavenegarSmsProvider,
  SandboxOutboxSmsProvider,
  type SmsProvider,
} from './modules/notifications/sms-provider.ts';
import { NotificationsService } from './modules/notifications/notifications.service.ts';
import { DispatchService } from './modules/requests/dispatch.service.ts';
import { RequestsService } from './modules/requests/requests.service.ts';
import {
  SandboxGatewayProvider,
  ZarinpalGatewayProvider,
  type PaymentGatewayProvider,
} from './modules/payments/gateway-provider.ts';
import { PaymentsService } from './modules/payments/payments.service.ts';
import { SupportService } from './modules/support/support.service.ts';
import { RatingsService } from './modules/ratings/ratings.service.ts';
import { AdminService } from './modules/admin/admin.service.ts';
import { RealtimeBus } from './modules/events/realtime-bus.ts';
import { createSessionMiddleware } from './middleware/auth.ts';
import { createRateLimiter } from './middleware/rate-limit.ts';
import { AppError, createErrorHandler } from './middleware/error-handler.ts';
import { createIdentityRouter } from './modules/identity/identity.routes.ts';
import { createGeographyRouter } from './modules/geography/geography.routes.ts';
import { createCatalogRouter } from './modules/catalog/catalog.routes.ts';
import { createCustomersRouter } from './modules/customers/customers.routes.ts';
import { createRespondersRouter } from './modules/responders/responders.routes.ts';
import { createPricingRouter } from './modules/pricing/pricing.routes.ts';
import { createNotificationsRouter } from './modules/notifications/notifications.routes.ts';
import { createRequestsRouter } from './modules/requests/requests.routes.ts';
import { createPaymentsRouter } from './modules/payments/payments.routes.ts';
import { createSupportRouter } from './modules/support/support.routes.ts';
import { createRatingsRouter } from './modules/ratings/ratings.routes.ts';
import { createAdminRouter } from './modules/admin/admin.routes.ts';
import { createEventsRouter } from './modules/events/events.routes.ts';
import { BRAND_IDENTITY } from '../shared/constants.ts';

export interface CreateAppOptions {
  configOverrides?: Partial<Record<string, string>>;
  customSmsProvider?: SmsProvider;
  customPaymentGateway?: PaymentGatewayProvider;
}

export function createAppContext(options?: CreateAppOptions) {
  const config: AppConfig = loadConfig(options?.configOverrides);
  const db = new AppDatabase(config.resolvedDbPath);
  runMigrations(db);

  const auditService = new AuditService(db, config.ENABLE_SECURITY_AUDIT_LOG);
  const realtimeBus = new RealtimeBus();

  const smsProvider: SmsProvider =
    options?.customSmsProvider ??
    (config.SMS_PROVIDER === 'kavenegar'
      ? new KavenegarSmsProvider(config.KAVENEGAR_API_KEY, config.SMS_SENDER_NUMBER)
      : new SandboxOutboxSmsProvider());

  const paymentGateway: PaymentGatewayProvider =
    options?.customPaymentGateway ??
    (config.PAYMENT_PROVIDER === 'zarinpal'
      ? new ZarinpalGatewayProvider(
          config.ZARINPAL_MERCHANT_ID,
          config.ZARINPAL_SANDBOX
        )
      : new SandboxGatewayProvider());

  const identityService = new IdentityService({
    db,
    audit: auditService,
    sessionTtlHours: config.SESSION_TTL_HOURS,
  });
  const geographyService = new GeographyService({ db, audit: auditService });
  const catalogService = new CatalogService({ db, audit: auditService });
  const customersService = new CustomersService(db);
  const respondersService = new RespondersService({
    db,
    audit: auditService,
    realtimeBus,
  });
  const pricingService = new PricingService({
    db,
    audit: auditService,
    catalog: catalogService,
    geography: geographyService,
  });
  const notificationsService = new NotificationsService({
    db,
    smsProvider,
    realtimeBus,
  });
  const dispatchService = new DispatchService({
    db,
    catalog: catalogService,
    notifications: notificationsService,
    audit: auditService,
  });
  const requestsService = new RequestsService({
    db,
    customers: customersService,
    catalog: catalogService,
    pricing: pricingService,
    dispatch: dispatchService,
    notifications: notificationsService,
    audit: auditService,
    privateStorageDir: config.resolvedPrivateStorageDir,
    maxUploadSizeBytes: config.MAX_UPLOAD_SIZE_BYTES,
  });
  const paymentsService = new PaymentsService({
    db,
    gateway: paymentGateway,
    notifications: notificationsService,
    audit: auditService,
  });
  const supportService = new SupportService({
    db,
    notifications: notificationsService,
    audit: auditService,
  });
  const ratingsService = new RatingsService(db);
  const adminService = new AdminService({
    db,
    audit: auditService,
    responders: respondersService,
    payments: paymentsService,
    geography: geographyService,
  });

  const app = express();
  app.set('trust proxy', 1);

  // هدرهای امنیتی استاندارد با سازگاری کامل پیش‌نمایش زنده (عدم مسدودسازی iframe پیش‌نمایش)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      frameguard: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '8mb' }));

  const globalApiLimiter = createRateLimiter({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
    bucketPrefix: 'api',
    auditService,
  });

  const authLimiter = createRateLimiter({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    maxRequests: config.AUTH_RATE_LIMIT_MAX_REQUESTS,
    bucketPrefix: 'auth',
    auditService,
  });

  app.use('/api', globalApiLimiter);
  app.use(
    createSessionMiddleware({
      db,
      cookieName: config.SESSION_COOKIE_NAME,
    })
  );

  // پایش سلامت سرویس و شفافیت وضعیت سرویس‌های خارجی
  app.get('/api/health', (_req, res) => {
    const dbCheck = db.get<{ ok: number }>('SELECT 1 AS ok');
    res.json({
      ok: dbCheck?.ok === 1,
      service: BRAND_IDENTITY.persianName,
      environment: config.APP_ENV,
      database: dbCheck?.ok === 1 ? 'connected' : 'degraded',
      realtimeClients: realtimeBus.getConnectedCount(),
      integrations: {
        paymentGateway: paymentsService.getGatewayStatus(),
        smsProvider: notificationsService.getProviderInfo(),
        mapProvider: {
          mode: config.MAP_PROVIDER,
          tileUrlConfigured: Boolean(config.MAP_TILE_URL),
        },
      },
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/system/public-info', (_req, res) => {
    const hotlineRow = db.get<{ value_json: string }>(
      `SELECT value_json FROM system_settings WHERE key = 'support_hotline'`
    );
    res.json({
      ok: true,
      brand: BRAND_IDENTITY,
      environment: config.APP_ENV,
      isProduction: config.isProduction,
      devQuickLoginEnabled: !config.isProduction && config.FEATURE_ENABLE_DEV_SEED,
      supportHotline: hotlineRow ? JSON.parse(hotlineRow.value_json) : '028-33330000',
      integrations: {
        paymentGateway: paymentsService.getGatewayStatus(),
        smsProvider: notificationsService.getProviderInfo(),
        mapProvider: config.MAP_PROVIDER,
      },
    });
  });

  app.use(
    '/api/auth',
    createIdentityRouter({ identityService, config, authLimiter })
  );
  app.use(
    '/api/geography',
    createGeographyRouter({ geographyService, auditService })
  );
  app.use(
    '/api/catalog',
    createCatalogRouter({ catalogService, auditService })
  );
  app.use(
    '/api/customers',
    createCustomersRouter({ customersService, auditService })
  );
  app.use(
    '/api/responders',
    createRespondersRouter({ respondersService, auditService })
  );
  app.use(
    '/api/pricing',
    createPricingRouter({ pricingService, auditService })
  );
  app.use(
    '/api/notifications',
    createNotificationsRouter({ notificationsService, auditService })
  );
  app.use(
    '/api/requests',
    createRequestsRouter({ requestsService, dispatchService, auditService })
  );
  app.use(
    '/api/payments',
    createPaymentsRouter({ paymentsService, auditService })
  );
  app.use(
    '/api/support',
    createSupportRouter({ supportService, auditService })
  );
  app.use(
    '/api/ratings',
    createRatingsRouter({ ratingsService, auditService })
  );
  app.use(
    '/api/admin',
    createAdminRouter({ adminService, respondersService, auditService })
  );
  app.use('/api/events', createEventsRouter({ realtimeBus }));

  // محافظت از مسیرهای ناشناخته API
  app.use('/api', (_req, _res, next) => {
    next(new AppError(404, 'API_ROUTE_NOT_FOUND', 'مسیر API درخواستی وجود ندارد.'));
  });

  const attachErrorHandler = () => {
    app.use(createErrorHandler({ isProduction: config.isProduction }));
  };

  return {
    app,
    config,
    db,
    attachErrorHandler,
    services: {
      auditService,
      realtimeBus,
      identityService,
      geographyService,
      catalogService,
      customersService,
      respondersService,
      pricingService,
      notificationsService,
      dispatchService,
      requestsService,
      paymentsService,
      supportService,
      ratingsService,
      adminService,
    },
  };
}
