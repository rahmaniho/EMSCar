import { z } from 'zod';
import crypto from 'node:crypto';
import path from 'node:path';

const booleanFromEnv = (defaultVal: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return defaultVal;
      return v === 'true' || v === '1';
    });

const envSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  NODE_ENV: z.string().default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  PUBLIC_BASE_URL: z.string().default(''),
  ALLOWED_ORIGINS: z.string().default(''),

  DATABASE_PATH: z.string().default('./data/auto_emergency.db'),
  DATABASE_BACKUP_DIR: z.string().default('./backups'),

  SESSION_SECRET: z.string().default(''),
  SESSION_COOKIE_NAME: z.string().default('ae_session'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(72),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(5).default(180),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(3).default(25),

  MAP_PROVIDER: z.enum(['vector_qazvin', 'osm', 'neshan', 'mapir']).default('vector_qazvin'),
  MAP_TILE_URL: z.string().default('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
  NESHAN_API_KEY: z.string().default(''),
  MAPIR_API_KEY: z.string().default(''),

  SMS_PROVIDER: z.enum(['sandbox_outbox', 'kavenegar']).default('sandbox_outbox'),
  KAVENEGAR_API_KEY: z.string().default(''),
  SMS_SENDER_NUMBER: z.string().default(''),

  PAYMENT_PROVIDER: z.enum(['sandbox', 'zarinpal']).default('sandbox'),
  ENABLE_SANDBOX_GATEWAY: booleanFromEnv(true),
  ZARINPAL_MERCHANT_ID: z.string().default(''),
  ZARINPAL_SANDBOX: booleanFromEnv(false),

  PRIVATE_STORAGE_DIR: z.string().default('./storage/private'),
  MAX_UPLOAD_SIZE_BYTES: z.coerce.number().int().min(10240).default(5 * 1024 * 1024),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ENABLE_SECURITY_AUDIT_LOG: booleanFromEnv(true),

  FEATURE_ENABLE_DEV_SEED: booleanFromEnv(true),
  FEATURE_ALLOW_EV_SERVICES: booleanFromEnv(false),
  FEATURE_ALLOW_POSTPAY_DEBT: booleanFromEnv(false),
  // فعال‌سازی ثبت درخواست واقعی در Production فقط پس از آمادگی عملیاتی و تأیید مالک محصول
  ENABLE_PUBLIC_OPERATIONS: booleanFromEnv(false),
});

export type AppConfig = z.infer<typeof envSchema> & {
  isProduction: boolean;
  isTest: boolean;
  resolvedDbPath: string;
  resolvedPrivateStorageDir: string;
  resolvedBackupDir: string;
};

let cachedDevSecret: string | null = null;

export function loadConfig(overrides?: Partial<Record<string, string>>): AppConfig {
  const raw = { ...process.env, ...overrides };
  // NODE_ENV=production همیشه بر APP_ENV متناقض اولویت دارد؛ مانع فعال‌شدن seed آزمایشی در Production.
  if (raw.NODE_ENV === 'production' || raw.APP_ENV === 'production') {
    raw.APP_ENV = 'production';
    raw.NODE_ENV = 'production';
  } else if (raw.VITEST && !raw.APP_ENV) {
    raw.APP_ENV = 'test';
  }

  const parsed = envSchema.parse(raw);
  const isProduction = parsed.APP_ENV === 'production' || parsed.NODE_ENV === 'production';
  const isTest = parsed.APP_ENV === 'test';

  let sessionSecret = parsed.SESSION_SECRET;
  if (isProduction) {
    if (
      !sessionSecret ||
      sessionSecret.length < 32 ||
      sessionSecret.includes('CHANGE_ME')
    ) {
      throw new Error(
        'خطای بحرانی امنیتی: در محیط Production متغیر SESSION_SECRET باید یک رشته تصادفی حداقل ۳۲ کاراکتری معتبر باشد.'
      );
    }
    if (
      parsed.PAYMENT_PROVIDER !== 'zarinpal' ||
      parsed.ENABLE_SANDBOX_GATEWAY ||
      parsed.ZARINPAL_SANDBOX
    ) {
      throw new Error(
        'در محیط Production فقط درگاه زَرین‌پال عملیاتی مجاز است؛ Sandbox باید کاملاً غیرفعال باشد.'
      );
    }
    if (parsed.ZARINPAL_MERCHANT_ID.trim().length < 32) {
      throw new Error('در محیط Production شناسه پذیرنده واقعی ZARINPAL_MERCHANT_ID الزامی است.');
    }
    if (
      parsed.SMS_PROVIDER !== 'kavenegar' ||
      !parsed.KAVENEGAR_API_KEY.trim() ||
      !parsed.SMS_SENDER_NUMBER.trim()
    ) {
      throw new Error(
        'در محیط Production استفاده از صندوق پیامک آزمایشی مجاز نیست؛ کلید کاوه‌نگار و خط خدماتی باید تنظیم شوند.'
      );
    }
  } else if (!sessionSecret || sessionSecret.includes('CHANGE_ME')) {
    if (!cachedDevSecret) {
      cachedDevSecret = crypto.randomBytes(32).toString('hex');
    }
    sessionSecret = cachedDevSecret;
  }

  return {
    ...parsed,
    SESSION_SECRET: sessionSecret,
    FEATURE_ENABLE_DEV_SEED: isProduction ? false : parsed.FEATURE_ENABLE_DEV_SEED,
    isProduction,
    isTest,
    resolvedDbPath:
      parsed.DATABASE_PATH === ':memory:'
        ? ':memory:'
        : path.resolve(process.cwd(), parsed.DATABASE_PATH),
    resolvedPrivateStorageDir: path.resolve(process.cwd(), parsed.PRIVATE_STORAGE_DIR),
    resolvedBackupDir: path.resolve(process.cwd(), parsed.DATABASE_BACKUP_DIR),
  };
}
