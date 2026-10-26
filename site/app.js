// داده‌های مستند و منطبق با کدبیس واقعی سامانه «اورژانس خودرو» (Auto Emergency)

const ZONES_AND_PROVINCES = [
  {
    id: 'QZV-CENTRAL',
    title: 'قزوین — محدوده شهری مرکزی',
    province: 'قزوین (فعال عملیاتی)',
    status: 'active',
    statusLabel: 'فعال عملیاتی (HTTP 200)',
    multiplier: 1.0,
    radiusKm: 18,
    capacity: '۵ واحد امدادی هدف',
    detail:
      'پوشش کامل محلات پونک، مینودر، خیام، فردوسی، بلوار نخبگان و بازار قدیم قزوین با ضریب پایه ۱.۰۰.',
  },
  {
    id: 'QZV-ALVAND',
    title: 'الوند، زیباشهر و شهر صنعتی البرز',
    province: 'قزوین (فعال عملیاتی)',
    status: 'active',
    statusLabel: 'فعال عملیاتی (HTTP 200)',
    multiplier: 1.05,
    radiusKm: 15,
    capacity: '۴ واحد امدادی هدف',
    detail:
      'پوشش قطب صنعتی البرز، الوند، محمدیه و مهرگان با اولویت اعزام خودروهای کارگاهی سیار و کفی خودروبر.',
  },
  {
    id: 'QZV-HWY-EAST',
    title: 'آزادراه قزوین - کرج (حوزه استحفاظی قزوین)',
    province: 'قزوین (فعال عملیاتی)',
    status: 'active',
    statusLabel: 'فعال عملیاتی (HTTP 200)',
    multiplier: 1.15,
    radiusKm: 30,
    capacity: '۴ واحد امدادی بزرگراهی',
    detail:
      'محور پرتردد آزادراهی شرق استان قزوین تا مرز آبیک؛ ضریب سختی تردد جاده‌ای ۱.۱۵.',
  },
  {
    id: 'QZV-HWY-WEST',
    title: 'آزادراه قزوین - زنجان (حوزه استحفاظی قزوین)',
    province: 'قزوین (فعال عملیاتی)',
    status: 'active',
    statusLabel: 'فعال عملیاتی (HTTP 200)',
    multiplier: 1.15,
    radiusKm: 32,
    capacity: '۳ واحد امدادی بزرگراهی',
    detail:
      'محور ترانزیتی غرب استان قزوین و کمربندی تاکستان؛ مجهز به یدک‌کش چرخ‌گیر و کفی هیدرولیک.',
  },
  {
    id: 'QZV-TAKESTAN',
    title: 'تاکستان، آبیک و بوئین‌زهرا',
    province: 'قزوین (فعال عملیاتی)',
    status: 'active',
    statusLabel: 'فعال عملیاتی (HTTP 200)',
    multiplier: 1.05,
    radiusKm: 22,
    capacity: '۸ واحد مجموع شهرستان‌ها',
    detail:
      'پوشش کامل شهرستان‌های تاکستان (۱.۰۵)، آبیک (۱.۰۵) و بوئین‌زهرا (۱.۱۰) در فاز اول راه‌اندازی.',
  },
  {
    id: 'PROV-ALBORZ',
    title: 'استان البرز (کرج)',
    province: 'البرز (غیرفعال در فاز اول)',
    status: 'pending_approval',
    statusLabel: 'مسدود در گارد سرور (HTTP 422)',
    multiplier: 1.0,
    radiusKm: 20,
    capacity: 'نیازمند حداقل ۴ امدادگر تأییدشده + مصوبه مدیر کل',
    detail:
      'رکورد استان و شهر کرج در دیتابیس تعریف شده اما وضعیت آن pending_approval است؛ هرگونه تلاش برای ثبت درخواست واقعی با خطای 422 PROVINCE_NOT_ACTIVE متوقف می‌شود.',
  },
  {
    id: 'PROV-OTHER',
    title: 'تهران، زنجان، گیلان و همدان',
    province: 'استان‌های نقشه راه توسعه ملی',
    status: 'preparing',
    statusLabel: 'مسدود در گارد سرور (HTTP 422)',
    multiplier: 1.1,
    radiusKm: 25,
    capacity: 'در وضعیت preparing / inactive',
    detail:
      'اثبات عملی قاعده «وجود در دیتابیس ≠ فعال بودن عملیاتی». فعال‌سازی منوط به تعریف زون فعال، جذب ناوگان احراز صلاحیت‌شده و تأیید صریح Super Admin همراه با ثبت در geography_status_history است.',
  },
];

const DOMAINS_16 = [
  {
    num: 1,
    name: 'Identity & Access Management',
    fa: 'مدیریت هویت، نشست و دسترسی',
    path: 'src/server/modules/identity/',
    tables: 'users, user_sessions',
    desc: 'هش رمز عبور با scrypt تصادفی و مقایسه زمان‌ثابت، هش SHA-256 توکن نشست در دیتابیس، کوکی HttpOnly و ابطال آنی نشست‌ها.',
  },
  {
    num: 2,
    name: 'Customer Management',
    fa: 'مدیریت مشتریان و خودروها',
    path: 'src/server/modules/customers/',
    tables: 'customer_vehicles',
    desc: 'پروفایل مشتری، ثبت و مدیریت خودروهای داخلی، خارجی، برقی و شاسی‌بلند با کنترل مالکیت سطح رکورد (ضد IDOR).',
  },
  {
    num: 3,
    name: 'Provider & Responder Management',
    fa: 'مدیریت ناوگان و احراز صلاحیت امدادگران',
    path: 'src/server/modules/responders/',
    tables: 'responder_profiles, responder_documents, responder_services, responder_zones',
    desc: 'بارگذاری مدارک هویتی/فنی و گواهی ایمنی ولتاژ بالا (EV)، اعتبارسنجی شبا و قفل مطلق آنلاین‌شدن پیش از تأیید مدیر ارشد.',
  },
  {
    num: 4,
    name: 'Service Catalog',
    fa: 'کاتالوگ خدمات امدادی قابل پیکربندی',
    path: 'src/server/modules/catalog/',
    tables: 'service_catalog, zone_services, service_audit_logs',
    desc: 'مدیریت ۱۵ خدمت استاندارد، پیش‌نیاز تجهیزات ناوگان، سفارشی‌سازی تعرفه به ازای زون و ثبت تاریخچه ممیزی تغییرات.',
  },
  {
    num: 5,
    name: 'Geographic Coverage',
    fa: 'پوشش جغرافیایی و حاکمیت استان‌ها',
    path: 'src/server/modules/geography/',
    tables: 'provinces, cities, service_zones, geography_status_history',
    desc: 'فعال بودن انحصاری استان قزوین در فاز نخست، بررسی هندسی شعاع و چندضلعی، گزارش آمادگی ناوگان و پروتکل فعال‌سازی استان جدید.',
  },
  {
    num: 6,
    name: 'Request Management',
    fa: 'مدیریت درخواست‌های امدادی',
    path: 'src/server/modules/requests/requests.service.ts',
    tables: 'service_requests, private_attachments',
    desc: 'ثبت پیش‌نویس یا نهایی با کلید ضدتکرار Idempotency-Key، استعلام عمومی ایمن کد رهگیری و ذخیره خصوصی تصاویر خارج از وب.',
  },
  {
    num: 7,
    name: 'Dispatch & Assignment',
    fa: 'دیسپچ هوشمند و تخصیص اتمیک',
    path: 'src/server/modules/requests/dispatch.service.ts',
    tables: 'mission_offers',
    desc: 'امتیازدهی چندمعیاره (فاصله Haversine، تجهیزات، گواهی EV، امتیاز عملکرد)، قفل BEGIN IMMEDIATE ضد پذیرش هم‌زمان و ارجاع صادقانه به اپراتور.',
  },
  {
    num: 8,
    name: 'Mission Lifecycle',
    fa: 'چرخه حیات مأموریت و گزارش فنی',
    path: 'src/server/modules/requests/state-machine.ts',
    tables: 'request_state_history, mission_reports',
    desc: 'ماشین وضعیت ۱۲حالته سخت‌گیرانه، ثبت تاریخچه تغییر وضعیت با نقش اقدام‌کننده و ثبت گزارش عیب‌یابی و قطعات مصرفی.',
  },
  {
    num: 9,
    name: 'Pricing & Quotation',
    fa: 'موتور قیمت‌گذاری و پیش‌فاکتور شفاف',
    path: 'src/shared/pricing-formula.ts, modules/pricing/',
    tables: 'pricing_rules, discount_codes, price_change_logs',
    desc: 'محاسبه بر پایه تومان صحیح، ضرایب خودرو/زون/شبانه، سقف تخفیف، مالیات و الزام تأیید مجدد مشتری در صورت افزایش قیمت بیش از آستانه.',
  },
  {
    num: 10,
    name: 'Payments & Refunds',
    fa: 'پرداخت ایمن، ضدتکرار و بازپرداخت',
    path: 'src/server/modules/payments/',
    tables: 'payment_intents, refunds',
    desc: 'آداپتور زرین‌پال و Sandbox شفاف، استعلام سمت سرور Callback (عدم اعتماد به پارامتر مرورگر)، بازپرداخت کامل/جزئی و بدهی اضطراری.',
  },
  {
    num: 11,
    name: 'Invoices & Settlements',
    fa: 'فاکتور رسمی، دفترکل و تسویه شبا',
    path: 'src/server/modules/payments/payments.service.ts',
    tables: 'invoices, wallet_ledger_entries, settlements',
    desc: 'صدور فاکتور قابل چاپ، تفکیک کمیسیون پلتفرم و سهم خالص امدادگر، دفترکل تغییرناپذیر کیف پول و تسویه پایا/ساتنا به شبا.',
  },
  {
    num: 12,
    name: 'Notifications & Realtime SSE',
    fa: 'اعلان‌ها، پیامک و جریان بلادرنگ SSE',
    path: 'src/server/modules/notifications/, modules/events/',
    tables: 'notifications',
    desc: 'لایه انتزاعی پیامک (کاوه‌نگار / Sandbox Outbox) با کلید ضدتکرار، ایزوله‌سازی خطا، تلاش مجدد کنترل‌شده و کانال بلادرنگ SSE.',
  },
  {
    num: 13,
    name: 'Support & Disputes',
    fa: 'پشتیبانی، شکایات و حل اختلاف',
    path: 'src/server/modules/support/',
    tables: 'support_tickets, ticket_messages, internal_operator_notes',
    desc: 'پرونده‌های شکایت متصل به مأموریت، یادداشت‌های محرمانه داخلی اپراتور (کاملاً مخفی از دید مشتری) و ارجاع به مدیریت.',
  },
  {
    num: 14,
    name: 'Ratings & Reviews',
    fa: 'امتیازدهی و ارزیابی کیفیت ناوگان',
    path: 'src/server/modules/ratings/',
    tables: 'mission_reviews',
    desc: 'ثبت یک‌باره امتیاز ۱ تا ۵ پس از تکمیل مأموریت و بروزرسانی خودکار میانگین امتیاز امدادگر جهت استفاده در الگوریتم دیسپچ.',
  },
  {
    num: 15,
    name: 'Reporting & Audit',
    fa: 'گزارش‌های کلان و لاگ ممیزی/امنیتی',
    path: 'src/server/modules/audit/, modules/admin/',
    tables: 'audit_logs, security_events',
    desc: 'داشبورد KPI اجرایی، گزارش تطبیق مالی (Reconciliation) و ثبت تغییرناپذیر اقدامات مدیریتی و تلاش‌های غیرمجاز امنیتی.',
  },
  {
    num: 16,
    name: 'Administration & Configuration',
    fa: 'پیکربندی کلان و عملیات زیرساخت',
    path: 'src/server/modules/admin/, src/server/db/',
    tables: 'system_settings, schema_migrations',
    desc: 'تنظیمات پویا بدون نیاز به دیپلوی مجدد، قفل امنیتی محیط Production در env.ts، مهاجرت‌های برگشت‌پذیر و بکاپ اتمیک VACUUM INTO.',
  },
];

const MISSION_STATES_12 = [
  {
    code: 'Draft',
    fa: 'پیش‌نویس اولیه',
    next: ['Submitted', 'Cancelled'],
    actors: 'customer',
    cancelRule: 'لغو کاملاً رایگان',
    privacy: 'هنوز برای هیچ امدادگری قابل رویت نیست.',
    desc: 'مشتری خودرو، خدمت و موقعیت مکانی در قزوین را انتخاب و پیش‌فاکتور شفاف تومان را پیش از ارسال نهایی بررسی می‌کند.',
  },
  {
    code: 'Submitted',
    fa: 'ثبت قطعی درخواست',
    next: ['Searching', 'Cancelled', 'UnderSupportReview'],
    actors: 'customer, system, operator',
    cancelRule: 'لغو کاملاً رایگان',
    privacy: 'اعتبارسنجی پوشش فعال قزوین و کلید ضدتکرار Idempotency-Key انجام شده است.',
    desc: 'درخواست در پایگاه‌داده ثبت شده و بلافاصله وارد موتور جستجوی هوشمند ناوگان می‌شود.',
  },
  {
    code: 'Searching',
    fa: 'در حال جستجوی امدادگر',
    next: ['Offered', 'Accepted', 'Cancelled', 'Failed', 'UnderSupportReview'],
    actors: 'system, operator, admin',
    cancelRule: 'لغو کاملاً رایگان',
    privacy: 'در صورت نبود امدادگر آزاد، هیچ ETA دروغین نمایش داده نمی‌شود و پرچم ارجاع به اپراتور فعال می‌گردد.',
    desc: 'الگوریتم دیسپچ امدادگران تأییدشده، آنلاین و دارای تجهیزات متناسب (مثلاً کفی یا گواهی EV) را رتبه‌بندی می‌کند.',
  },
  {
    code: 'Offered',
    fa: 'پیشنهاد ارسال‌شده به امدادگر',
    next: ['Accepted', 'Searching', 'Cancelled', 'Failed', 'UnderSupportReview'],
    actors: 'responder, system, operator',
    cancelRule: 'لغو کاملاً رایگان برای مشتری',
    privacy: 'امدادگر فقط محدوده کلی و مختصات گردشده را می‌بیند؛ تلفن و نشانی دقیق مشتری مخفی است.',
    desc: 'پیشنهاد مأموریت از طریق SSE و پیامک برای بهترین امدادگر ارسال می‌شود؛ در صورت رد پیشنهاد، سیستم خودکار سراغ نفر بعدی می‌رود.',
  },
  {
    code: 'Accepted',
    fa: 'پذیرفته‌شده توسط امدادگر',
    next: ['EnRoute', 'Searching', 'Cancelled', 'UnderSupportReview'],
    actors: 'responder, customer, operator',
    cancelRule: 'لغو رایگان پیش از شروع حرکت (EnRoute)',
    privacy: 'قفل اتمیک BEGIN IMMEDIATE مانع پذیرش هم‌زمان توسط امدادگر دوم می‌شود؛ مشخصات ناوگان برای مشتری نمایش می‌یابد.',
    desc: 'ظرفیت امدادگر به busy تغییر یافته و زمان رسیدن تخمینی (ETA) بر اساس فاصله واقعی محاسبه می‌شود.',
  },
  {
    code: 'EnRoute',
    fa: 'امدادگر در مسیر محل حادثه',
    next: ['Arrived', 'Cancelled', 'UnderSupportReview'],
    actors: 'responder, customer, operator',
    cancelRule: 'لغو توسط مشتری مشمول هزینه ایاب‌وذهاب مصوب خدمت است',
    privacy: 'پخش زنده موقعیت GPS امدادگر از طریق SSE روی نقشه مشتری فعال است.',
    desc: 'امدادگر به سمت موقعیت توقف خودرو در حرکت است و پیامک اطلاع‌رسانی حرکت ارسال می‌گردد.',
  },
  {
    code: 'Arrived',
    fa: 'حضور امدادگر در کنار خودرو',
    next: ['InProgress', 'Cancelled', 'UnderSupportReview'],
    actors: 'responder, customer, operator',
    cancelRule: 'لغو مشمول هزینه ایاب‌وذهاب مصوب است',
    privacy: 'تطبیق پلاک ناوگان و در خدمات بازگشایی در، کنترل کارت خودرو و هویت مالک انجام می‌شود.',
    desc: 'امدادگر به محل رسیده و ایمن‌سازی اولیه صحنه توقف خودرو را انجام می‌دهد.',
  },
  {
    code: 'InProgress',
    fa: 'در حال انجام عملیات امدادی',
    next: ['Completed', 'Failed', 'UnderSupportReview'],
    actors: 'responder, operator, admin',
    cancelRule: 'لغو یک‌طرفه مشتری بسته است؛ صرفاً از مسیر پشتیبانی/اپراتور قابل بررسی است',
    privacy: 'امکان بارگذاری تصاویر مستندات فنی در مخزن خصوصی storage/private فراهم است.',
    desc: 'عملیات فنی در محل یا حمل ایمن خودرو به مقصد منتخب در جریان است.',
  },
  {
    code: 'Completed',
    fa: 'تکمیل مأموریت و صدور فاکتور',
    next: ['UnderSupportReview'],
    actors: 'responder -> customer payment & rating',
    cancelRule: 'مأموریت خاتمه‌یافته؛ امکان ثبت تیکت یا بازپرداخت مدیریتی وجود دارد',
    privacy: 'دسترسی موقعیت زنده قطع شده و تلفن/نشانی دقیق مشتری مجدداً برای امدادگر سانسور (Redact) می‌شود!',
    desc: 'گزارش فنی و قطعات مصرفی ثبت شده، فاکتور رسمی صادر گشته، ظرفیت امدادگر آزاد شده و درگاه پرداخت و امتیازدهی فعال می‌شود.',
  },
  {
    code: 'Cancelled',
    fa: 'لغوشده (با ثبت علت)',
    next: [],
    actors: 'customer, operator, admin',
    cancelRule: 'وضعیت پایانی؛ جریمه لغو بر اساس مرحله ثبت گردیده است',
    privacy: 'حفظ کامل تاریخچه در request_state_history بدون افشای اطلاعات تماس.',
    desc: 'درخواست به درخواست مشتری یا تصمیم مرکز پیام لغو شده و در صورت تخصیص قبلی، ظرفیت امدادگر به online بازگشته است.',
  },
  {
    code: 'Failed',
    fa: 'عدم امکان انجام فنی',
    next: ['Searching', 'UnderSupportReview'],
    actors: 'responder, operator, admin',
    cancelRule: 'امکان جستجوی ناوگان جایگزین (مثلاً کفی خودروبر) توسط اپراتور',
    privacy: 'ثبت مستندات فنی جهت بررسی مرکز پیام.',
    desc: 'زمانی که خودرو به علت آسیب سنگین نیازمند تجهیزات متفاوتی است یا شرایط ایمنی صحنه اجازه ادامه کار نمی‌دهد.',
  },
  {
    code: 'UnderSupportReview',
    fa: 'تحت بررسی پشتیبانی / حل اختلاف',
    next: ['Searching', 'InProgress', 'Completed', 'Cancelled', 'Failed'],
    actors: 'operator, admin',
    cancelRule: 'تحت مدیریت مستقیم مرکز عملیات و مدیر ارشد',
    privacy: 'یادداشت‌های داخلی اپراتور در internal_operator_notes کاملاً محرمانه نگهداری می‌شوند.',
    desc: 'پرونده به دلیل شکایت، اختلاف تعرفه یا نیاز به مداخله مرکز عملیات در وضعیت بررسی ویژه قرار گرفته است.',
  },
];

const SERVICES_15 = [
  { slug: 'battery-jumpstart', title: 'باتری‌به‌باتری اضطراری', cat: 'battery_electrical', catFa: 'باتری و برق', base: 280000, freeKm: 6, perKm: 15000, towKm: 0, cancelFee: 90000, equip: 'موتور / وانت امداد / واحد EV', badge: '' },
  { slug: 'battery-replacement', title: 'تست تخصصی و تعویض باتری در محل', cat: 'battery_electrical', catFa: 'باتری و برق', base: 350000, freeKm: 6, perKm: 15000, towKm: 0, cancelFee: 100000, equip: 'وانت کارگاهی / واحد EV', badge: '' },
  { slug: 'mobile-tire-repair', title: 'پنچرگیری سیار در محل', cat: 'tire_wheel', catFa: 'چرخ و لاستیک', base: 260000, freeKm: 5, perKm: 15000, towKm: 0, cancelFee: 85000, equip: 'موتور / وانت کارگاهی', badge: '' },
  { slug: 'tire-change', title: 'تعویض لاستیک و نصب زاپاس', cat: 'tire_wheel', catFa: 'چرخ و لاستیک', base: 240000, freeKm: 5, perKm: 15000, towKm: 0, cancelFee: 85000, equip: 'موتور / وانت / یدک‌کش', badge: '' },
  { slug: 'emergency-fuel', title: 'سوخت‌رسانی اضطراری ایمن', cat: 'fuel_lock', catFa: 'سوخت و بازگشایی', base: 290000, freeKm: 6, perKm: 16000, towKm: 0, cancelFee: 90000, equip: 'موتور / وانت کارگاهی', badge: '' },
  { slug: 'authorized-door-unlock', title: 'باز کردن در خودرو در شرایط مجاز', cat: 'fuel_lock', catFa: 'سوخت و بازگشایی', base: 390000, freeKm: 5, perKm: 16000, towKm: 0, cancelFee: 110000, equip: 'وانت کارگاهی', badge: 'الزام احراز مالکیت' },
  { slug: 'initial-diagnostics', title: 'عیب‌یابی اولیه و دیاگ سیار', cat: 'diagnostics_repair', catFa: 'عیب‌یابی و تعمیر', base: 420000, freeKm: 6, perKm: 16000, towKm: 0, cancelFee: 110000, equip: 'وانت کارگاهی / واحد EV', badge: '' },
  { slug: 'light-onsite-repair', title: 'تعمیرات سبک مکانیکی و برقی در محل', cat: 'diagnostics_repair', catFa: 'عیب‌یابی و تعمیر', base: 480000, freeKm: 6, perKm: 17000, towKm: 0, cancelFee: 120000, equip: 'وانت کارگاهی', badge: '' },
  { slug: 'onsite-part-replacement', title: 'تعویض قطعات قابل انجام در محل', cat: 'diagnostics_repair', catFa: 'عیب‌یابی و تعمیر', base: 520000, freeKm: 6, perKm: 17000, towKm: 0, cancelFee: 120000, equip: 'وانت کارگاهی', badge: '' },
  { slug: 'towing', title: 'یدک‌کش چرخ‌گیر استاندارد', cat: 'towing_transport', catFa: 'یدک‌کش و حمل', base: 680000, freeKm: 5, perKm: 20000, towKm: 28000, cancelFee: 180000, equip: 'یدک‌کش چرخ‌گیر / کفی', badge: 'الزام مقصد حمل' },
  { slug: 'transport-to-repair-shop', title: 'حمل خودرو به تعمیرگاه مجاز', cat: 'towing_transport', catFa: 'یدک‌کش و حمل', base: 650000, freeKm: 5, perKm: 20000, towKm: 26000, cancelFee: 180000, equip: 'یدک‌کش چرخ‌گیر / کفی', badge: 'الزام مقصد حمل' },
  { slug: 'transport-to-custom-destination', title: 'حمل خودرو با کفی خودروبر به مقصد انتخابی', cat: 'towing_transport', catFa: 'یدک‌کش و حمل', base: 890000, freeKm: 5, perKm: 22000, towKm: 35000, cancelFee: 220000, equip: 'کفی خودروبر هیدرولیک', badge: 'ویژه کفی هیدرولیک' },
  { slug: 'domestic-car-assistance', title: 'امداد جامع خودروهای داخلی', cat: 'specialized_fleet', catFa: 'تخصصی و برقی', base: 380000, freeKm: 6, perKm: 15000, towKm: 0, cancelFee: 100000, equip: 'وانت کارگاهی', badge: 'خودروهای داخلی' },
  { slug: 'foreign-car-assistance', title: 'امداد تخصصی خودروهای خارجی و وارداتی', cat: 'specialized_fleet', catFa: 'تخصصی و برقی', base: 590000, freeKm: 6, perKm: 18000, towKm: 0, cancelFee: 150000, equip: 'وانت کارگاهی / واحد EV', badge: 'وارداتی و شاسی‌بلند' },
  { slug: 'ev-specialized-service', title: 'خدمات تخصصی خودروهای برقی و هیبریدی (HV)', cat: 'specialized_fleet', catFa: 'تخصصی و برقی', base: 720000, freeKm: 6, perKm: 20000, towKm: 0, cancelFee: 160000, equip: 'واحد تخصصی EV / کفی', badge: 'گواهی ایمنی HV الزامی' },
];

function formatFaNumber(n) {
  return Math.round(n).toLocaleString('fa-IR');
}

function formatToman(n) {
  return `${formatFaNumber(n)} تومان`;
}

// ۱. راه‌اندازی منوی موبایل و دکمه بازگشت به سامانه زنده هنگام مشاهده از مسیر /showcase سرور یکپارچه
const heroActions = document.getElementById('hero-actions');
if (
  heroActions &&
  typeof window !== 'undefined' &&
  !window.location.hostname.endsWith('github.io') &&
  window.location.pathname.startsWith('/showcase')
) {
  const liveBtn = document.createElement('a');
  liveBtn.href = '/';
  liveBtn.className = 'btn-secondary';
  liveBtn.style.borderColor = '#10b981';
  liveBtn.style.color = '#6ee7b7';
  liveBtn.textContent = 'ورود به سامانه زنده عملیاتی (Live App) ↗';
  heroActions.appendChild(liveBtn);
}

const mobileNavBtn = document.getElementById('mobile-nav-btn');
const navLinks = document.getElementById('nav-links');
if (mobileNavBtn && navLinks) {
  mobileNavBtn.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => navLinks.classList.remove('open'));
  });
}

// ۲. تعامل نقشه و مناطق جغرافیایی قزوین
const zoneBtnsContainer = document.getElementById('zone-buttons');
const zoneDetailCard = document.getElementById('zone-detail-card');

function renderZoneDetail(item) {
  if (!zoneDetailCard) return;
  const badgeClass =
    item.status === 'active' ? 'badge-active' : 'badge-danger';
  zoneDetailCard.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.75rem;">
      <span class="mono" style="font-size:0.78rem;font-weight:800;color:#64748b;">${item.id}</span>
      <span class="badge ${badgeClass}">${item.statusLabel}</span>
    </div>
    <h3 style="margin:0 0 0.4rem;font-size:1.05rem;">${item.title}</h3>
    <div style="font-size:0.8rem;color:#475569;margin-bottom:0.75rem;">
      استان: <strong>${item.province}</strong> | شعاع پوشش: <strong>${formatFaNumber(item.radiusKm)} کیلومتر</strong> | ضریب تعرفه منطقه: <strong>×${item.multiplier}</strong>
    </div>
    <p style="font-size:0.84rem;color:#1e293b;line-height:1.75;margin-bottom:0.85rem;">${item.detail}</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:0.65rem;padding:0.65rem 0.85rem;font-size:0.78rem;">
      <strong>وضعیت ظرفیت ناوگان:</strong> ${item.capacity}
    </div>
  `;
}

if (zoneBtnsContainer) {
  ZONES_AND_PROVINCES.forEach((z, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip-btn ${idx === 0 ? 'active' : ''}`;
    btn.textContent = z.title;
    btn.addEventListener('click', () => {
      zoneBtnsContainer
        .querySelectorAll('.chip-btn')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderZoneDetail(z);
    });
    zoneBtnsContainer.appendChild(btn);
  });
  renderZoneDetail(ZONES_AND_PROVINCES[0]);
}

// ۳. رندر ۱۶ دامنه معماری با جستجوی زنده
const domainsGrid = document.getElementById('domains-grid');
const domainSearch = document.getElementById('domain-search');

function renderDomains(query = '') {
  if (!domainsGrid) return;
  const q = query.trim().toLowerCase();
  const filtered = DOMAINS_16.filter(
    (d) =>
      !q ||
      d.name.toLowerCase().includes(q) ||
      d.fa.includes(q) ||
      d.tables.toLowerCase().includes(q) ||
      d.desc.includes(q)
  );
  domainsGrid.innerHTML = filtered
    .map(
      (d) => `
      <article class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.45rem;">
          <span class="badge badge-warn">دامنه ${formatFaNumber(d.num)}</span>
          <span class="mono" style="font-size:0.72rem;color:#64748b;">${d.name}</span>
        </div>
        <h3>${d.fa}</h3>
        <p style="margin-bottom:0.7rem;">${d.desc}</p>
        <div style="font-size:0.74rem;border-top:1px solid #f1f5f9;padding-top:0.55rem;color:#475569;">
          <div>مسیر کد: <code class="mono" style="color:#0f172a;">${d.path}</code></div>
          <div style="margin-top:0.2rem;">جداول: <code class="mono" style="color:#0369a1;">${d.tables}</code></div>
        </div>
      </article>
    `
    )
    .join('');
}

if (domainSearch) {
  domainSearch.addEventListener('input', (e) => renderDomains(e.target.value));
}
renderDomains();

// ۴. کاوشگر تعاملی ماشین وضعیت ۱۲حالته
const statesContainer = document.getElementById('state-machine-nodes');
const stateInspector = document.getElementById('state-inspector');

function renderStateInspector(st) {
  if (!stateInspector) return;
  const nextHtml =
    st.next.length > 0
      ? st.next
          .map(
            (n) =>
              `<span class="badge badge-muted mono" style="margin-left:0.35rem;">→ ${n}</span>`
          )
          .join('')
      : '<span class="badge badge-danger">وضعیت پایانی (بدون انتقال بعدی)</span>';

  stateInspector.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.65rem;">
      <div>
        <span class="mono" style="font-weight:900;font-size:1rem;color:#b45309;">${st.code}</span>
        <strong style="font-size:1.05rem;margin-right:0.5rem;">— ${st.fa}</strong>
      </div>
      <span class="badge badge-active">نقش‌های مجاز: ${st.actors}</span>
    </div>
    <p style="font-size:0.88rem;color:#1e293b;margin-bottom:0.9rem;">${st.desc}</p>
    <div class="grid-2" style="gap:0.8rem;margin-bottom:0.85rem;">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:0.7rem;padding:0.75rem;font-size:0.8rem;">
        <strong>قاعده لغو در این مرحله:</strong><br/>${st.cancelRule}
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:0.7rem;padding:0.75rem;font-size:0.8rem;color:#064e3b;">
        <strong>حریم خصوصی مکانی و امنیتی:</strong><br/>${st.privacy}
      </div>
    </div>
    <div style="font-size:0.8rem;">
      <strong>انتقال‌های بعدی مجاز در سرور (assertValidStateTransition):</strong>
      <div style="margin-top:0.4rem;display:flex;flex-wrap:wrap;gap:0.3rem;">${nextHtml}</div>
    </div>
  `;
}

if (statesContainer) {
  MISSION_STATES_12.forEach((st, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `state-btn ${idx === 4 ? 'selected' : ''}`;
    btn.innerHTML = `<span class="state-code mono">${idx + 1}. ${st.code}</span><span class="state-fa">${st.fa}</span>`;
    btn.addEventListener('click', () => {
      statesContainer
        .querySelectorAll('.state-btn')
        .forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      renderStateInspector(st);
    });
    statesContainer.appendChild(btn);
  });
  renderStateInspector(MISSION_STATES_12[4]); // Accepted by default
}

// ۵. ماشین‌حساب زنده فرمول قیمت‌گذاری (منطبق با src/shared/pricing-formula.ts)
const calcService = document.getElementById('calc-service');
const calcZone = document.getElementById('calc-zone');
const calcVehicle = document.getElementById('calc-vehicle');
const calcDispatchKm = document.getElementById('calc-dispatch-km');
const calcTowKm = document.getElementById('calc-tow-km');
const calcParts = document.getElementById('calc-parts');
const calcNight = document.getElementById('calc-night');
const calcDiscount = document.getElementById('calc-discount');
const calcOutput = document.getElementById('calc-output');

const VEHICLE_MULT = {
  domestic: 1.0,
  foreign: 1.25,
  electric: 1.35,
  suv_heavy: 1.2,
};

function runPriceSimulation() {
  if (!calcService || !calcOutput) return;
  const svc =
    SERVICES_15.find((s) => s.slug === calcService.value) || SERVICES_15[0];
  const zoneMult = Number(calcZone.value || 1.0);
  const vehMult = VEHICLE_MULT[calcVehicle.value] || 1.0;
  const dispatchKm = Math.max(0, Number(calcDispatchKm.value || 0));
  const towKm = svc.towKm > 0 ? Math.max(0, Number(calcTowKm.value || 0)) : 0;
  const partsCost = Math.max(0, Math.round(Number(calcParts.value || 0)));
  const isNight = Boolean(calcNight.checked);
  const useDiscount = Boolean(calcDiscount.checked);

  const extraDispatchKm = Math.max(0, dispatchKm - svc.freeKm);
  const dispatchFee = Math.round(extraDispatchKm * svc.perKm);
  const towFee = Math.round(towKm * svc.towKm);
  const rawService = svc.base + dispatchFee + towFee;

  const afterVehicle = Math.round(rawService * vehMult);
  const vehicleAdj = afterVehicle - rawService;

  const afterZone = Math.round(afterVehicle * zoneMult);
  const zoneAdj = afterZone - afterVehicle;

  const afterNight = isNight ? Math.round(afterZone * 1.2) : afterZone;
  const nightAdj = afterNight - afterZone;

  const grossService = afterNight;
  const discountAmount = useDiscount
    ? Math.min(Math.round(grossService * 0.1), 150000)
    : 0;

  const netService = Math.max(0, grossService - discountAmount);
  const taxableBase = netService + partsCost;
  const taxAmount = Math.round(taxableBase * 0.1);
  const totalToman = taxableBase + taxAmount;
  const totalRial = totalToman * 10;

  // محاسبه بدون قطعه جهت بررسی آستانه ۱۰٪ تأیید مجدد مشتری
  const initialEstToman = netService + Math.round(netService * 0.1);
  const pctIncrease =
    initialEstToman > 0
      ? Math.round(((totalToman - initialEstToman) / initialEstToman) * 100)
      : 0;
  const needsApproval = pctIncrease > 10;

  const platformCommission = Math.round(netService * 0.15);
  const responderNet = netService - platformCommission + partsCost;

  calcOutput.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
      <strong style="font-size:0.95rem;color:#fbbf24;">پیش‌نمایش صورتحساب رسمی (واحد پایه: تومان)</strong>
      <span class="badge badge-active">ضد خطای ریال/تومان</span>
    </div>
    <div class="invoice-line"><span>نرخ پایه خدمت (${svc.title}):</span><span>${formatToman(svc.base)}</span></div>
    <div class="invoice-line"><span>هزینه مازاد اعزام (${formatFaNumber(extraDispatchKm)} کیلومتر مازاد بر ${formatFaNumber(svc.freeKm)}km رایگان):</span><span>${formatToman(dispatchFee)}</span></div>
    <div class="invoice-line"><span>هزینه حمل یدک‌کش/کفی (${formatFaNumber(towKm)} کیلومتر):</span><span>${formatToman(towFee)}</span></div>
    <div class="invoice-line"><span>تعدیل رده خودرو (×${vehMult}):</span><span>+ ${formatToman(vehicleAdj)}</span></div>
    <div class="invoice-line"><span>تعدیل منطقه قزوین (×${zoneMult}):</span><span>+ ${formatToman(zoneAdj)}</span></div>
    <div class="invoice-line"><span>ضریب شبانه / اضطراری (${isNight ? '×1.20 فعال' : 'غیرفعال'}):</span><span>+ ${formatToman(nightAdj)}</span></div>
    <div class="invoice-line" style="color:#6ee7b7;"><span>تخفیف کد QAZVIN1405 (۱۰٪ تا سقف ۱۵۰ هزار):</span><span>- ${formatToman(discountAmount)}</span></div>
    <div class="invoice-line"><span>بهای قطعات مصرفی ثبت‌شده در گزارش:</span><span>${formatToman(partsCost)}</span></div>
    <div class="invoice-line"><span>مالیات بر ارزش افزوده (۱۰٪):</span><span>${formatToman(taxAmount)}</span></div>
    <div class="invoice-total">
      <span>جمع کل قابل پرداخت مشتری:</span>
      <span>${formatToman(totalToman)}</span>
    </div>
    <div style="font-size:0.76rem;color:#94a3b8;text-align:left;margin-top:0.25rem;" class="mono">
      Gateway Payload (tomanToRial): ${totalRial.toLocaleString('en-US')} Rials
    </div>
    <div style="margin-top:0.9rem;padding-top:0.75rem;border-top:1px solid #334155;font-size:0.77rem;color:#cbd5e1;display:grid;gap:0.3rem;">
      <div style="display:flex;justify-content:space-between;"><span>سهم خالص کیف پول امدادگر:</span><strong style="color:#34d399;">${formatToman(responderNet)}</strong></div>
      <div style="display:flex;justify-content:space-between;"><span>کمیسیون پلتفرم (۱۵٪ اجرت خدمت):</span><span>${formatToman(platformCommission)}</span></div>
      ${
        needsApproval
          ? `<div style="margin-top:0.4rem;background:rgba(245,158,11,0.18);border:1px solid #f59e0b;color:#fde68a;padding:0.5rem 0.65rem;border-radius:0.55rem;">
               ⚠️ افزایش مبلغ نهایی نسبت به پیش‌فاکتور اولیه (${formatFaNumber(pctIncrease)}٪) بیش از آستانه ۱۰٪ است؛ <strong>تأیید صریح مشتری در اپلیکیشن پیش از پرداخت الزامی می‌شود.</strong>
             </div>`
          : ''
      }
    </div>
  `;
}

if (calcService) {
  SERVICES_15.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.slug;
    opt.textContent = `${s.title} (پایه ${formatFaNumber(s.base)} تومان)`;
    calcService.appendChild(opt);
  });
  [
    calcService,
    calcZone,
    calcVehicle,
    calcDispatchKm,
    calcTowKm,
    calcParts,
    calcNight,
    calcDiscount,
  ].forEach((el) => {
    if (el) el.addEventListener('input', runPriceSimulation);
    if (el) el.addEventListener('change', runPriceSimulation);
  });
  runPriceSimulation();
}

// ۶. رندر کاتالوگ ۱۵ خدمت با فیلتر دسته‌بندی
const catalogContainer = document.getElementById('services-catalog-grid');
const catalogFilters = document.getElementById('catalog-filters');

function renderCatalog(cat = 'all') {
  if (!catalogContainer) return;
  const items =
    cat === 'all' ? SERVICES_15 : SERVICES_15.filter((s) => s.cat === cat);
  catalogContainer.innerHTML = items
    .map(
      (s) => `
      <article class="card" style="display:flex;flex-direction:column;justify-content:space-between;">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem;margin-bottom:0.5rem;">
            <span class="badge badge-muted">${s.catFa}</span>
            ${s.badge ? `<span class="badge badge-warn">${s.badge}</span>` : ''}
          </div>
          <h3>${s.title}</h3>
          <div style="font-size:0.78rem;color:#475569;margin-top:0.4rem;">
            ناوگان مجاز: <strong>${s.equip}</strong>
          </div>
        </div>
        <div style="margin-top:1rem;padding-top:0.75rem;border-top:1px solid #f1f5f9;font-size:0.8rem;display:grid;gap:0.25rem;">
          <div style="display:flex;justify-content:space-between;">
            <span>نرخ پایه مصوب:</span>
            <strong style="color:#0f172a;">${formatToman(s.base)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;color:#64748b;">
            <span>اعزام مازاد بر ${formatFaNumber(s.freeKm)}km:</span>
            <span>${formatToman(s.perKm)} / km</span>
          </div>
          ${
            s.towKm > 0
              ? `<div style="display:flex;justify-content:space-between;color:#0369a1;">
                   <span>نرخ هر کیلومتر حمل:</span>
                   <span>${formatToman(s.towKm)} / km</span>
                 </div>`
              : ''
          }
          <div style="display:flex;justify-content:space-between;color:#be123c;font-size:0.75rem;">
            <span>جریمه لغو پس از اعزام:</span>
            <span>${formatToman(s.cancelFee)}</span>
          </div>
        </div>
      </article>
    `
    )
    .join('');
}

if (catalogFilters) {
  catalogFilters.querySelectorAll('button[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      catalogFilters
        .querySelectorAll('button')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderCatalog(btn.getAttribute('data-cat') || 'all');
    });
  });
}
renderCatalog('all');
