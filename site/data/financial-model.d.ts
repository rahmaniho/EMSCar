export interface ServiceCatalogItem {
  slug: string;
  title: string;
  cat: string;
  catFa: string;
  base: number;
  freeKm: number;
  perKm: number;
  towKm: number;
  cancelFee: number;
  equip: string;
  ruleNote: string;
}

export const SERVICES_CATALOG_15: ServiceCatalogItem[];
export const VEHICLE_MULTIPLIERS: Record<string, number>;

export function calculateOfficialQuote(input: {
  serviceSlug?: string;
  zoneMultiplier?: number;
  vehicleType?: string;
  dispatchKm?: number;
  towKm?: number;
  isUrgentNight?: boolean;
  partsToman?: number;
  hasWelcomeDiscount?: boolean;
}): {
  discountToman: number;
  netServiceToman: number;
  platformCommissionToman: number;
  totalToman: number;
  totalRial: number;
  [key: string]: unknown;
};

export function computeUnitEconomics(input?: {
  avgOrderServiceToman?: number;
  commissionRatePct?: number;
  directVariableCostPerOrderToman?: number;
  monthlyMarketingSpendToman?: number;
  monthlyNewCustomers?: number;
  annualOrdersPerCustomer?: number;
  avgCustomerRetentionYears?: number;
  requestToOrderConversionPct?: number;
}): {
  grossProfitPerOrder: number;
  ltvToman: number;
  ltvToCac: number;
  cacToman: number;
  [key: string]: number;
};

export interface ScenarioResult {
  key: string;
  label: string;
  months: Array<Record<string, number>>;
  totalOrdersYear1: number;
  totalRevenueYear1: number;
  totalOperatingYear1: number;
  peakCashNeedToman: number;
  breakEvenMonth: number | null;
  month12: Record<string, number>;
}

export function computeThreeScenarios12M(
  input?: Record<string, number>
): Record<'conservative' | 'base' | 'growth', ScenarioResult>;

export function computeBreakEvenAndSensitivity(input?: Record<string, number>): {
  baseline: {
    orders: number;
    revPerOrder: number;
    contribPerOrder: number;
    totalFixed: number;
    opProfit: number;
    breakEvenOrders: number;
  };
  levers: Array<{
    id: string;
    label: string;
    low: number;
    high: number;
    swingToman: number;
    deltaDown: number;
    deltaUp: number;
  }>;
  mostSensitiveVariable: string;
};
