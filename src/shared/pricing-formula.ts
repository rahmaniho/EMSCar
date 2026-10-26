import type { VehicleCategory } from './constants.ts';

export interface PricingFormulaInput {
  basePriceToman: number;
  dispatchDistanceKm: number;
  includedFreeDispatchKm: number;
  perKmDispatchToman: number;
  towDistanceKm: number;
  perKmTowToman: number;
  vehicleCategory: VehicleCategory;
  vehicleMultipliers: Record<VehicleCategory, number>;
  zoneMultiplier: number;
  isUrgentOrNight: boolean;
  urgentNightMultiplier: number;
  partsCostToman: number;
  discountPercent?: number;
  discountFixedToman?: number;
  maxDiscountToman?: number;
  taxRatePercent: number;
}

export interface PriceBreakdown {
  currency: 'TOMAN';
  baseServiceFeeToman: number;
  dispatchDistanceFeeToman: number;
  billableDispatchKm: number;
  towTransportFeeToman: number;
  billableTowKm: number;
  vehicleAdjustmentToman: number;
  vehicleMultiplierApplied: number;
  zoneAdjustmentToman: number;
  zoneMultiplierApplied: number;
  urgentNightSurchargeToman: number;
  urgentNightMultiplierApplied: number;
  serviceSubtotalBeforeDiscountToman: number;
  discountAmountToman: number;
  taxableServiceNetToman: number;
  partsCostToman: number;
  taxRatePercent: number;
  taxAmountToman: number;
  totalToman: number;
  totalRialForGateway: number;
}

/**
 * تبدیل ایمن و صریح تومان به ریال صرفاً در مرز درگاه بانکی شاپرک
 */
export function tomanToRial(amountToman: number): number {
  if (!Number.isFinite(amountToman) || amountToman < 0) {
    throw new Error('مبلغ تومان نامعتبر است');
  }
  return Math.round(amountToman) * 10;
}

/**
 * تبدیل ایمن ریال به تومان
 */
export function rialToToman(amountRial: number): number {
  if (!Number.isFinite(amountRial) || amountRial < 0) {
    throw new Error('مبلغ ریال نامعتبر است');
  }
  return Math.floor(amountRial / 10);
}

/**
 * موتور محاسبه قیمت استاندارد «اورژانس خودرو»
 *
 * فرمول مستند محاسبه (واحد پایه: تومان صحیح):
 * ۱. اجرت پایه خدمت = basePriceToman
 * ۲. هزینه اعزام مازاد = max(0, dispatchDistanceKm - includedFreeDispatchKm) * perKmDispatchToman
 * ۳. هزینه حمل به مقصد = max(0, towDistanceKm) * perKmTowToman
 * ۴. جمع پایه عملیاتی = (۱) + (۲) + (۳)
 * ۵. تعدیل نوع خودرو = جمع پایه عملیاتی * (vehicleMultiplier - 1)
 * ۶. تعدیل محدوده جغرافیایی = (جمع پایه عملیاتی + تعدیل خودرو) * (zoneMultiplier - 1)
 * ۷. فوق‌العاده فوری / شبانه = (جمع تعدیل‌شده) * (urgentNightMultiplier - 1) [در صورت فعال بودن]
 * ۸. جمع ناخالص خدمات = مجموع موارد فوق
 * ۹. تخفیف = min(جمع ناخالص خدمات, سقف تخفیف، تخفیف درصدی + ثابت)
 * ۱۰. خالص خدمات مشمول مالیات = جمع ناخالص خدمات - تخفیف
 * ۱۱. مالیات و عوارض قانونی = round((خالص خدمات + هزینه قطعات) * taxRatePercent / 100)
 * ۱۲. مبلغ کل قابل پرداخت (تومان) = خالص خدمات + هزینه قطعات + مالیات
 */
export function calculateOfficialPrice(input: PricingFormulaInput): PriceBreakdown {
  const baseServiceFeeToman = Math.max(0, Math.round(input.basePriceToman));

  const billableDispatchKm = Math.max(
    0,
    Math.round((input.dispatchDistanceKm - Math.max(0, input.includedFreeDispatchKm)) * 10) / 10
  );
  const dispatchDistanceFeeToman = Math.round(
    billableDispatchKm * Math.max(0, input.perKmDispatchToman)
  );

  const billableTowKm = Math.max(0, Math.round(input.towDistanceKm * 10) / 10);
  const towTransportFeeToman = Math.round(
    billableTowKm * Math.max(0, input.perKmTowToman)
  );

  const rawOperationalSum =
    baseServiceFeeToman + dispatchDistanceFeeToman + towTransportFeeToman;

  const vehicleMultiplierApplied = Math.max(
    0.5,
    input.vehicleMultipliers[input.vehicleCategory] ?? 1.0
  );
  const vehicleAdjustmentToman = Math.round(
    rawOperationalSum * (vehicleMultiplierApplied - 1)
  );

  const afterVehicle = rawOperationalSum + vehicleAdjustmentToman;

  const zoneMultiplierApplied = Math.max(0.5, input.zoneMultiplier || 1.0);
  const zoneAdjustmentToman = Math.round(afterVehicle * (zoneMultiplierApplied - 1));

  const afterZone = afterVehicle + zoneAdjustmentToman;

  const urgentNightMultiplierApplied = input.isUrgentOrNight
    ? Math.max(1.0, input.urgentNightMultiplier || 1.0)
    : 1.0;
  const urgentNightSurchargeToman = Math.round(
    afterZone * (urgentNightMultiplierApplied - 1)
  );

  const serviceSubtotalBeforeDiscountToman = afterZone + urgentNightSurchargeToman;

  const pctDiscount = input.discountPercent
    ? Math.round((serviceSubtotalBeforeDiscountToman * Math.max(0, input.discountPercent)) / 100)
    : 0;
  const fixedDiscount = Math.max(0, Math.round(input.discountFixedToman ?? 0));
  let rawDiscount = pctDiscount + fixedDiscount;
  if (input.maxDiscountToman !== undefined && input.maxDiscountToman >= 0) {
    rawDiscount = Math.min(rawDiscount, Math.round(input.maxDiscountToman));
  }
  const discountAmountToman = Math.min(serviceSubtotalBeforeDiscountToman, rawDiscount);

  const taxableServiceNetToman =
    serviceSubtotalBeforeDiscountToman - discountAmountToman;

  const partsCostToman = Math.max(0, Math.round(input.partsCostToman));
  const taxRatePercent = Math.max(0, input.taxRatePercent);
  const taxAmountToman = Math.round(
    ((taxableServiceNetToman + partsCostToman) * taxRatePercent) / 100
  );

  const totalToman = taxableServiceNetToman + partsCostToman + taxAmountToman;

  return {
    currency: 'TOMAN',
    baseServiceFeeToman,
    dispatchDistanceFeeToman,
    billableDispatchKm,
    towTransportFeeToman,
    billableTowKm,
    vehicleAdjustmentToman,
    vehicleMultiplierApplied,
    zoneAdjustmentToman,
    zoneMultiplierApplied,
    urgentNightSurchargeToman,
    urgentNightMultiplierApplied,
    serviceSubtotalBeforeDiscountToman,
    discountAmountToman,
    taxableServiceNetToman,
    partsCostToman,
    taxRatePercent,
    taxAmountToman,
    totalToman,
    totalRialForGateway: tomanToRial(totalToman),
  };
}
