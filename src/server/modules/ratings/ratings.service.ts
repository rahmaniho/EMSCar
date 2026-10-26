import type { AppDatabase } from '../../db/connection.ts';
import { AppError } from '../../middleware/error-handler.ts';

export class RatingsService {
  private readonly db: AppDatabase;

  constructor(db: AppDatabase) {
    this.db = db;
  }

  submitReview(params: {
    requestId: number;
    customerUserId: number;
    rating: number;
    tags: string[];
    comment?: string;
  }) {
    const reqRow = this.db.get<{
      id: number;
      customer_user_id: number;
      status: string;
      assigned_responder_id: number | null;
    }>(
      'SELECT id, customer_user_id, status, assigned_responder_id FROM service_requests WHERE id = ?',
      params.requestId
    );

    if (!reqRow || reqRow.customer_user_id !== params.customerUserId) {
      throw new AppError(404, 'REQUEST_NOT_FOUND', 'مأموریت یافت نشد.');
    }

    if (reqRow.status !== 'Completed' || !reqRow.assigned_responder_id) {
      throw new AppError(
        409,
        'REVIEW_NOT_ALLOWED',
        'ثبت امتیاز تنها برای مأموریت‌های تکمیل‌شده امکان‌پذیر است.'
      );
    }

    const existing = this.db.get<{ id: number }>(
      'SELECT id FROM mission_reviews WHERE request_id = ?',
      reqRow.id
    );
    if (existing) {
      throw new AppError(
        409,
        'REVIEW_ALREADY_SUBMITTED',
        'امتیاز شما برای این مأموریت قبلاً ثبت شده است.'
      );
    }

    const nowIso = new Date().toISOString();
    const responderId = reqRow.assigned_responder_id;

    return this.db.transaction(() => {
      const res = this.db.run(
        `INSERT INTO mission_reviews (
          request_id, customer_user_id, responder_id, rating, tags_json, comment, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        reqRow.id,
        params.customerUserId,
        responderId,
        params.rating,
        JSON.stringify(params.tags),
        params.comment?.trim() || null,
        nowIso
      );

      const stats = this.db.get<{ avg_rating: number; cnt: number }>(
        `SELECT AVG(rating) AS avg_rating, COUNT(*) AS cnt
         FROM mission_reviews WHERE responder_id = ?`,
        responderId
      );

      this.db.run(
        `UPDATE responder_profiles
         SET rating_avg = ?, rating_count = ?, updated_at = ?
         WHERE id = ?`,
        Math.round(Number(stats?.avg_rating ?? 5) * 100) / 100,
        Number(stats?.cnt ?? 1),
        nowIso,
        responderId
      );

      return {
        reviewId: res.lastInsertRowid,
        newResponderRatingAvg:
          Math.round(Number(stats?.avg_rating ?? 5) * 100) / 100,
      };
    });
  }
}
