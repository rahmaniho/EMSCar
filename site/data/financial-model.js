// موتور محاسبات مالی، قیمت‌گذاری، اقتصاد واحد، پیش‌بینی ۱۲ماهه ۳ سناریویی و تحلیل حساسیت
// تاریخ مبنای مفروضات برنامه‌ریزی: آبان ۱۴۰۵ (اکتبر ۲۰۲۶) — واحد پایه نمایش: تومان صحیح (۱ تومان = ۱۰ ریال)
// هشدار شفافیت: تمامی ارقام پیش‌بینی مالی «سناریوی آزمایشی و فرضیه برنامه‌ریزی» هستند، نه عملکرد واقعی تاریخی.

export const SERVICES_CATALOG_15 = [
  { slug: 'battery-jumpstart', title: 'باتری‌به‌باتری اضطراری', cat: 'battery_electrical', catFa: 'باتری و برق', base: 280000, freeKm: 6, perKm: 15000, towKm: 0, cancelFee: 90000, equip: 'موتور / وانت امداد / واحد EV', ruleNote: 'پرتقاضاترین خدمت شهری' },
  { slug: 'battery-replacement', title: 'تست تخصصی و تعویض باتری در محل', cat: 'battery_electrical', catFa: 'باتری و برق', base: 350000, freeKm: 6, perKm: 15000, towKm: 0, cancelFee: 100000, equip: 'وانت کارگاهی / واحد EV', ruleNote: 'بهای باتری جداگانه بدون کمیسیون' },
  { slug: 'mobile-tire-repair', title: 'پنچرگیری سیار در محل', cat: 'tire_wheel', catFa: 'چرخ و لاستیک', base: 260000, freeKm: 5, perKm: 15000, towKm: 0, cancelFee: 85000, equip: 'موتور / وانت کارگاهی', ruleNote: 'پوشش سریع شهری و حومه' },
  { slug: 'tire-change', title: 'تعویض لاستیک و نصب زاپاس', cat: 'tire_wheel', catFa: 'چرخ و لاستیک', base: 240000, freeKm: 5, perKm: 15000, towKm: 0, cancelFee: 85000, equip: 'موتور / وانت / یدک‌کش', ruleNote: 'ایمن‌سازی حاشیه راه' },
  { slug: 'emergency-fuel', title: 'سوخت‌رسانی اضطراری ایمن', cat: 'fuel_lock', catFa: 'سوخت و بازگشایی', base: 290000, freeKm: 6, perKm: 16000, towKm: 0, cancelFee: 90000, equip: 'موتور / وانت کارگاهی', ruleNote: 'مخزن استاندارد ایمن' },
  { slug: 'authorized-door-unlock', title: 'باز کردن در خودرو در شرایط مجاز', cat: 'fuel_lock', catFa: 'سوخت و بازگشایی', base: 390000, freeKm: 5, perKm: 16000, towKm: 0, cancelFee: 110000, equip: 'وانت کارگاهی', ruleNote: 'الزام سروری احراز مالکیت خودرو' },
  { slug: 'initial-diagnostics', title: 'عیب‌یابی اولیه و دیاگ سیار', cat: 'diagnostics_repair', catFa: 'عیب‌یابی و تعمیر', base: 420000, freeKm: 6, perKm: 16000, towKm: 0, cancelFee: 110000, equip: 'وانت کارگاهی / واحد EV', ruleNote: 'گزارش کدهای خطای ECU' },
  { slug: 'light-onsite-repair', title: 'تعمیرات سبک مکانیکی و برقی در محل', cat: 'diagnostics_repair', catFa: 'عیب‌یابی و تعمیر', base: 480000, freeKm: 6, perKm: 17000, towKm: 0, cancelFee: 120000, equip: 'وانت کارگاهی', ruleNote: 'جلوگیری از نیاز به حمل بی‌مورد' },
  { slug: 'onsite-part-replacement', title: 'تعویض قطعات قابل انجام در محل', cat: 'diagnostics_repair', catFa: 'عیب‌یابی و تعمیر', base: 520000, freeKm: 6, perKm: 17000, towKm: 0, cancelFee: 120000, equip: 'وانت کارگاهی', ruleNote: 'گیت تأیید مجدد تغییر قیمت بالای ۱۰٪' },
  { slug: 'towing', title: 'یدک‌کش چرخ‌گیر استاندارد', cat: 'towing_transport', catFa: 'یدک‌کش و حمل', base: 680000, freeKm: 5, perKm: 20000, towKm: 28000, cancelFee: 180000, equip: 'یدک‌کش چرخ‌گیر / کفی', ruleNote: 'الزام ثبت مقصد حمل در سرور' },
  { slug: 'transport-to-repair-shop', title: 'حمل خودرو به تعمیرگاه مجاز', cat: 'towing_transport', catFa: 'یدک‌کش و حمل', base: 650000, freeKm: 5, perKm: 20000, towKm: 26000, cancelFee: 180000, equip: 'یدک‌کش چرخ‌گیر / کفی', ruleNote: 'امکان ارجاع به تعمیرگاه همکار' },
  { slug: 'transport-to-custom-destination', title: 'حمل خودرو با کفی خودروبر به مقصد انتخابی', cat: 'towing_transport', catFa: 'یدک‌کش و حمل', base: 890000, freeKm: 5, perKm: 22000, towKm: 35000, cancelFee: 220000, equip: 'کفی خودروبر هیدرولیک', ruleNote: 'ویژه گیربکس اتوماتیک و تصادفی' },
  { slug: 'domestic-car-assistance', title: 'امداد جامع خودروهای داخلی', cat: 'specialized_fleet', catFa: 'تخصصی و برقی', base: 380000, freeKm: 6, perKm: 15000, towKm: 0, cancelFee: 100000, equip: 'وانت کارگاهی', ruleNote: 'پوشش پرتیراژترین خودروهای کشور' },
  { slug: 'foreign-car-assistance', title: 'امداد تخصصی خودروهای خارجی و وارداتی', cat: 'specialized_fleet', catFa: 'تخصصی و برقی', base: 590000, freeKm: 6, perKm: 18000, towKm: 0, cancelFee: 150000, equip: 'وانت کارگاهی / واحد EV', ruleNote: 'ابزار دقیق خودروهای وارداتی' },
  { slug: 'ev-specialized-service', title: 'خدمات تخصصی خودروهای برقی و هیبریدی (HV)', cat: 'specialized_fleet', catFa: 'تخصصی و برقی', base: 720000, freeKm: 6, perKm: 20000, towKm: 0, cancelFee: 160000, equip: 'واحد تخصصی EV / کفی', ruleNote: 'الزام گواهی ایمنی ولتاژ بالا (HV)' },
];

export const VEHICLE_MULTIPLIERS = {
  domestic: 1.0,
  suv_heavy: 1.2,
  foreign: 1.25,
  electric: 1.35,
};

/**
 * فرمول رسمی قیمت‌گذاری منطبق با src/shared/pricing-formula.ts
 */
export function calculateOfficialQuote({
  serviceSlug = 'battery-jumpstart',
  zoneMultiplier = 1.0,
  vehicleCategory = 'domestic',
  dispatchKm = 8,
  towKm = 0,
  partsCostToman = 0,
  isUrgentOrNight = false,
  applyLaunchDiscount = true,
}) {
  const svc =
    SERVICES_CATALOG_15.find((s) => s.slug === serviceSlug) ||
    SERVICES_CATALOG_15[0];
  const vehMult = VEHICLE_MULTIPLIERS[vehicleCategory] || 1.0;

  const billableDispatchKm = Math.max(0, Math.round((dispatchKm - svc.freeKm) * 10) / 10);
  const dispatchFeeToman = Math.round(billableDispatchKm * svc.perKm);
  const effectiveTowKm = svc.towKm > 0 ? Math.max(0, Math.round(towKm * 10) / 10) : 0;
  const towFeeToman = Math.round(effectiveTowKm * svc.towKm);

  const rawSum = svc.base + dispatchFeeToman + towFeeToman;
  const vehicleAdjustmentToman = Math.round(rawSum * (vehMult - 1));
  const afterVehicle = rawSum + vehicleAdjustmentToman;

  const zoneAdjustmentToman = Math.round(afterVehicle * (zoneMultiplier - 1));
  const afterZone = afterVehicle + zoneAdjustmentToman;

  const nightSurchargeToman = isUrgentOrNight ? Math.round(afterZone * 0.2) : 0;
  const grossServiceToman = afterZone + nightSurchargeToman;

  const discountToman = applyLaunchDiscount
    ? Math.min(grossServiceToman, Math.min(Math.round(grossServiceToman * 0.1), 150000))
    : 0;

  const netServiceToman = grossServiceToman - discountToman;
  const cleanParts = Math.max(0, Math.round(partsCostToman));
  const taxToman = Math.round((netServiceToman + cleanParts) * 0.1);
  const totalToman = netServiceToman + cleanParts + taxToman;
  const totalRial = totalToman * 10;

  const initialWithoutParts = netServiceToman + Math.round(netServiceToman * 0.1);
  const increasePercent =
    initialWithoutParts > 0
      ? Math.round(((totalToman - initialWithoutParts) / initialWithoutParts) * 100)
      : 0;

  const platformCommissionToman = Math.round(netServiceToman * 0.15);
  const responderNetShareToman = netServiceToman - platformCommissionToman + cleanParts;

  return {
    service: svc,
    billableDispatchKm,
    dispatchFeeToman,
    effectiveTowKm,
    towFeeToman,
    vehicleAdjustmentToman,
    zoneAdjustmentToman,
    nightSurchargeToman,
    grossServiceToman,
    discountToman,
    netServiceToman,
    partsCostToman: cleanParts,
    taxToman,
    totalToman,
    totalRial,
    increasePercent,
    requiresCustomerReapproval: increasePercent > 10,
    platformCommissionToman,
    responderNetShareToman,
  };
}

/**
 * ساختار هزینه‌های راه‌اندازی (یک‌باره) و جاری ماهانه — فرضیه برنامه‌ریزی پایلوت قزوین (آبان ۱۴۰۵)
 */
export const COST_STRUCTURE_ASSUMPTIONS = {
  referenceDate: 'آبان ۱۴۰۵ (اکتبر ۲۰۲۶)',
  currency: 'تومان (۱ تومان = ۱۰ ریال)',
  setupCapexItems: [
    { title: 'تکمیل استقرار سرور، امنیت، دامنه، SSL و پایش عملیاتی', amountToman: 45_000_000, category: 'فنی و زیرساخت' },
    { title: 'امور ثبتی، مشاوره حقوقی قراردادها، اینماد و مجوزهای اولیه', amountToman: 65_000_000, category: 'حقوقی و مجوزها' },
    { title: 'جذب، ممیزی میدانی، تجهیز برچسب هویتی و آموزش ناوگان پایلوت قزوین', amountToman: 75_000_000, category: 'عملیات و ناوگان' },
    { title: 'کمپین معرفی اولیه محلی در قزوین، شهر صنعتی البرز و محورهای ورودی', amountToman: 95_000_000, category: 'بازاریابی آغازین' },
    { title: 'ذخیره احتیاطی سرمایه در گردش راه‌اندازی (Contingency Reserve)', amountToman: 70_000_000, category: 'ذخیره احتیاطی' },
  ],
  monthlyOpexItems: [
    { title: 'تیم عملیات و اپراتورهای شیفت مرکز پیام و پشتیبانی قزوین', amountToman: 78_000_000, sharePct: 40 },
    { title: 'نگهداری و توسعه مستمر نرم‌افزار، DevOps و امنیت', amountToman: 42_000_000, sharePct: 21.5 },
    { title: 'بازاریابی محلی، سئو، همکاری تعمیرگاهی و جذب مشتری', amountToman: 38_000_000, sharePct: 19.5 },
    { title: 'سرور ابری، پنل پیامک پایه، نقشه، بکاپ و زیرساخت ارتباطی', amountToman: 14_000_000, sharePct: 7.2 },
    { title: 'حسابداری، مشاوره حقوقی/مالیاتی، کنترل کیفیت و ذخیره احتیاطی جاری', amountToman: 23_000_000, sharePct: 11.8 },
  ],
};

/**
 * محاسبه دقیق شاخص‌های اقتصاد واحد (Unit Economics) بر پایه حاشیه سود ناخالص واقعی پلتفرم
 */
export function computeUnitEconomics({
  avgOrderServiceToman = 540_000,
  commissionRatePct = 15,
  directVariableCostPerOrderToman = 14_500, // پیامک‌های چرخه مأموریت + کارمزد بانکی/تسویه + ذخیره خسارت جزئی
  monthlyMarketingSpendToman = 38_000_000,
  monthlyNewCustomers = 240,
  requestToOrderConversionPct = 68,
  annualOrdersPerCustomer = 1.65,
  avgCustomerRetentionYears = 2.2,
}) {
  const platformRevenuePerOrder = Math.round(
    (avgOrderServiceToman * commissionRatePct) / 100
  );
  const grossProfitPerOrder = platformRevenuePerOrder - directVariableCostPerOrderToman;
  const grossMarginOfPlatformRevenuePct =
    platformRevenuePerOrder > 0
      ? Math.round((grossProfitPerOrder / platformRevenuePerOrder) * 1000) / 10
      : 0;

  const cacToman =
    monthlyNewCustomers > 0
      ? Math.round(monthlyMarketingSpendToman / monthlyNewCustomers)
      : 0;

  const lifetimeOrders = Math.round(annualOrdersPerCustomer * avgCustomerRetentionYears * 100) / 100;
  // LTV علمی بر پایه سود ناخالص منتسب به پلتفرم (نه کل فروش ناخالص GMV!)
  const ltvToman = Math.max(0, Math.round(grossProfitPerOrder * lifetimeOrders));
  const ltvToCac = cacToman > 0 ? Math.round((ltvToman / cacToman) * 100) / 100 : 0;
  const paybackOrders =
    grossProfitPerOrder > 0
      ? Math.round((cacToman / grossProfitPerOrder) * 10) / 10
      : Infinity;

  return {
    avgOrderServiceToman,
    commissionRatePct,
    platformRevenuePerOrder,
    directVariableCostPerOrderToman,
    grossProfitPerOrder,
    grossMarginOfPlatformRevenuePct,
    cacToman,
    requestToOrderConversionPct,
    lifetimeOrders,
    ltvToman,
    ltvToCac,
    paybackOrders,
  };
}

/**
 * پیش‌بینی ۱۲ماهه در ۳ سناریو (محافظه‌کارانه، پایه، رشد سریع) — مدل آزمایشی قابل تنظیم
 */
export function computeThreeScenarios12M({
  baseAvgOrderToman = 540_000,
  commissionPct = 15,
  baseMonthlyFixedCostToman = 195_000_000,
  variableCostPerOrderToman = 14_500,
  initialSetupCapexToman = 350_000_000,
} = {}) {
  const configs = {
    conservative: {
      key: 'conservative',
      label: '۱. سناریوی محافظه‌کارانه',
      startRequestsMonth1: 650,
      monthlyGrowthRate: 0.135,
      conversionRate: 0.62,
      fixedCostFactor: 0.92,
    },
    base: {
      key: 'base',
      label: '۲. سناریوی پایه (هدف پایلوت قزوین)',
      startRequestsMonth1: 950,
      monthlyGrowthRate: 0.175,
      conversionRate: 0.68,
      fixedCostFactor: 1.0,
    },
    growth: {
      key: 'growth',
      label: '۳. سناریوی رشد سریع (همراه قراردادهای B2B)',
      startRequestsMonth1: 1350,
      monthlyGrowthRate: 0.215,
      conversionRate: 0.73,
      fixedCostFactor: 1.15,
    },
  };

  const results = {};

  for (const [key, cfg] of Object.entries(configs)) {
    const months = [];
    let cumulativeCash = -initialSetupCapexToman;
    let minCumulativeCash = cumulativeCash;
    let breakEvenMonth = null;

    for (let m = 1; m <= 12; m += 1) {
      const requests = Math.round(
        cfg.startRequestsMonth1 * Math.pow(1 + cfg.monthlyGrowthRate, m - 1)
      );
      const completedOrders = Math.round(requests * cfg.conversionRate);
      const activeUsers = Math.round(requests * 0.86);
      const platformRevPerOrder = Math.round((baseAvgOrderToman * commissionPct) / 100);
      const monthlyRevenueToman = completedOrders * platformRevPerOrder;
      const monthlyVariableCostToman = completedOrders * variableCostPerOrderToman;
      // تعدیل پلکانی ملایم هزینه ثابت با بزرگ شدن عملیات در نیمه دوم سال
      const stepFactor = m > 6 ? 1.12 : 1.0;
      const monthlyFixedCostToman = Math.round(
        baseMonthlyFixedCostToman * cfg.fixedCostFactor * stepFactor
      );
      const operatingProfitToman =
        monthlyRevenueToman - monthlyVariableCostToman - monthlyFixedCostToman;

      cumulativeCash += operatingProfitToman;
      if (cumulativeCash < minCumulativeCash) {
        minCumulativeCash = cumulativeCash;
      }
      if (breakEvenMonth === null && operatingProfitToman >= 0) {
        breakEvenMonth = m;
      }

      months.push({
        month: m,
        activeUsers,
        requests,
        completedOrders,
        avgRevPerOrderToman: platformRevPerOrder,
        monthlyRevenueToman,
        monthlyVariableCostToman,
        monthlyFixedCostToman,
        totalCostToman: monthlyVariableCostToman + monthlyFixedCostToman,
        operatingProfitToman,
        cumulativeCashToman: cumulativeCash,
      });
    }

    const totalOrdersYear1 = months.reduce((s, x) => s + x.completedOrders, 0);
    const totalRevenueYear1 = months.reduce((s, x) => s + x.monthlyRevenueToman, 0);
    const totalOperatingYear1 = months.reduce((s, x) => s + x.operatingProfitToman, 0);

    results[key] = {
      ...cfg,
      months,
      totalOrdersYear1,
      totalRevenueYear1,
      totalOperatingYear1,
      peakCashNeedToman: Math.abs(minCumulativeCash),
      breakEvenMonth,
      month12: months[11],
    };
  }

  return results;
}

/**
 * تحلیل نقطه سربه‌سر و تحلیل حساسیت ۶ متغیره (±۲۰٪ تغییر) در یک ماه نمونه تثبیت‌شده
 */
export function computeBreakEvenAndSensitivity({
  monthlyRequests = 3800,
  cancellationAndDropPct = 32, // نرخ لغو و عدم تبدیل (تبدیل پایه = ۶۸٪)
  avgBasketToman = 540_000,
  commissionPct = 15,
  variableCostPerOrderToman = 14_500,
  fixedOpCostToman = 195_000_000,
  monthlyMarketingCacTotalToman = 38_000_000,
} = {}) {
  function evalProfit(params) {
    const conv = Math.max(0.05, Math.min(0.95, 1 - params.cancelPct / 100));
    const orders = Math.round(params.requests * conv);
    const revPerOrder = Math.round((params.basket * params.comm) / 100);
    const contribPerOrder = revPerOrder - params.varCost;
    const totalFixed = params.fixedOp + params.marketingSpend;
    const opProfit = orders * contribPerOrder - totalFixed;
    const breakEvenOrders =
      contribPerOrder > 0 ? Math.ceil(totalFixed / contribPerOrder) : Infinity;
    return { orders, revPerOrder, contribPerOrder, totalFixed, opProfit, breakEvenOrders };
  }

  const baseParams = {
    requests: monthlyRequests,
    cancelPct: cancellationAndDropPct,
    basket: avgBasketToman,
    comm: commissionPct,
    varCost: variableCostPerOrderToman,
    fixedOp: fixedOpCostToman - monthlyMarketingCacTotalToman,
    marketingSpend: monthlyMarketingCacTotalToman,
  };

  const baseline = evalProfit(baseParams);

  const levers = [
    {
      id: 'commission',
      label: 'نرخ کمیسیون پلتفرم (±۲۰٪ نسبی)',
      low: evalProfit({ ...baseParams, comm: baseParams.comm * 0.8 }).opProfit,
      high: evalProfit({ ...baseParams, comm: baseParams.comm * 1.2 }).opProfit,
    },
    {
      id: 'volume',
      label: 'حجم کل درخواست‌های ماهانه (±۲۰٪)',
      low: evalProfit({ ...baseParams, requests: baseParams.requests * 0.8 }).opProfit,
      high: evalProfit({ ...baseParams, requests: baseParams.requests * 1.2 }).opProfit,
    },
    {
      id: 'basket',
      label: 'متوسط مبلغ اجرت هر سفارش (±۲۰٪)',
      low: evalProfit({ ...baseParams, basket: baseParams.basket * 0.8 }).opProfit,
      high: evalProfit({ ...baseParams, basket: baseParams.basket * 1.2 }).opProfit,
    },
    {
      id: 'fixedOp',
      label: 'هزینه ثابت عملیات و پشتیبانی (±۲۰٪)',
      low: evalProfit({ ...baseParams, fixedOp: baseParams.fixedOp * 1.2 }).opProfit,
      high: evalProfit({ ...baseParams, fixedOp: baseParams.fixedOp * 0.8 }).opProfit,
    },
    {
      id: 'cancel',
      label: 'نرخ لغو و عدم تبدیل درخواست (±۲۰٪)',
      low: evalProfit({ ...baseParams, cancelPct: baseParams.cancelPct * 1.2 }).opProfit,
      high: evalProfit({ ...baseParams, cancelPct: baseParams.cancelPct * 0.8 }).opProfit,
    },
    {
      id: 'cac',
      label: 'بودجه جذب مشتری / CAC (±۲۰٪)',
      low: evalProfit({ ...baseParams, marketingSpend: baseParams.marketingSpend * 1.2 }).opProfit,
      high: evalProfit({ ...baseParams, marketingSpend: baseParams.marketingSpend * 0.8 }).opProfit,
    },
  ].map((item) => ({
    ...item,
    swingToman: Math.abs(item.high - item.low),
    deltaDown: item.low - baseline.opProfit,
    deltaUp: item.high - baseline.opProfit,
  }));

  levers.sort((a, b) => b.swingToman - a.swingToman);

  return {
    baseline,
    levers,
    mostSensitiveVariable: levers[0]?.label || '',
  };
}
