import type { AppDatabase } from '../../db/connection.ts';
import { AppError } from '../../middleware/error-handler.ts';
import {
  VEHICLE_CATEGORY_LABELS,
  type VehicleCategory,
} from '../../../shared/constants.ts';

export class CustomersService {
  private readonly db: AppDatabase;

  constructor(db: AppDatabase) {
    this.db = db;
  }

  listVehicles(customerUserId: number) {
    const rows = this.db.all<{
      id: number;
      customer_user_id: number;
      brand: string;
      model: string;
      manufacture_year: number;
      plate_number: string;
      category: VehicleCategory;
      color: string | null;
      notes: string | null;
      created_at: string;
    }>(
      `SELECT * FROM customer_vehicles
       WHERE customer_user_id = ? AND is_active = 1
       ORDER BY id DESC`,
      customerUserId
    );
    return rows.map((r) => ({
      id: r.id,
      brand: r.brand,
      model: r.model,
      manufactureYear: r.manufacture_year,
      plateNumber: r.plate_number,
      category: r.category,
      categoryLabel: VEHICLE_CATEGORY_LABELS[r.category],
      color: r.color,
      notes: r.notes,
      createdAt: r.created_at,
    }));
  }

  getOwnedVehicle(customerUserId: number, vehicleId: number) {
    const row = this.db.get<{
      id: number;
      customer_user_id: number;
      brand: string;
      model: string;
      manufacture_year: number;
      plate_number: string;
      category: VehicleCategory;
      color: string | null;
      notes: string | null;
      is_active: number;
    }>('SELECT * FROM customer_vehicles WHERE id = ?', vehicleId);

    if (!row || row.customer_user_id !== customerUserId || row.is_active !== 1) {
      throw new AppError(
        404,
        'VEHICLE_NOT_FOUND',
        'خودروی انتخاب‌شده یافت نشد یا متعلق به حساب کاربری شما نیست.'
      );
    }
    return {
      id: row.id,
      brand: row.brand,
      model: row.model,
      manufactureYear: row.manufacture_year,
      plateNumber: row.plate_number,
      category: row.category,
      categoryLabel: VEHICLE_CATEGORY_LABELS[row.category],
      color: row.color,
      notes: row.notes,
    };
  }

  addVehicle(params: {
    customerUserId: number;
    brand: string;
    model: string;
    manufactureYear: number;
    plateNumber: string;
    category: VehicleCategory;
    color?: string;
    notes?: string;
  }) {
    const res = this.db.run(
      `INSERT INTO customer_vehicles (
        customer_user_id, brand, model, manufacture_year, plate_number, category, color, notes, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      params.customerUserId,
      params.brand.trim(),
      params.model.trim(),
      params.manufactureYear,
      params.plateNumber.trim(),
      params.category,
      params.color?.trim() || null,
      params.notes?.trim() || null,
      new Date().toISOString()
    );
    return this.getOwnedVehicle(params.customerUserId, res.lastInsertRowid);
  }

  deactivateVehicle(customerUserId: number, vehicleId: number): void {
    this.getOwnedVehicle(customerUserId, vehicleId);
    this.db.run(
      'UPDATE customer_vehicles SET is_active = 0 WHERE id = ? AND customer_user_id = ?',
      vehicleId,
      customerUserId
    );
  }
}
