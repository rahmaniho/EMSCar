import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function createErrorHandler(options: { isProduction: boolean }) {
  return function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
  ): void {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        ok: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      });
      return;
    }

    if (err instanceof ZodError) {
      res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'اطلاعات ورودی معتبر نیست. لطفاً فیلدهای فرم را بررسی کنید.',
          details: err.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
      return;
    }

    if (!options.isProduction) {
      console.error('[Unhandled Server Error]', err);
    }

    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'خطای داخلی سرور رخ داد. عملیات ثبت و پیگیری شد.',
      },
    });
  };
}
