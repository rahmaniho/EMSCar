// موتور تعاملی ارائه اسلایدی، بیزینس‌پلن و شبیه‌ساز زنده «اورژانس خودرو» (Auto Emergency)
// منطبق ۱۰۰٪ با کدبیس واقعی (migrations/002_reference_catalog_qazvin.up.sql & src/shared/pricing-formula.ts)

const SLIDE_TITLES = [
  '۱. خلاصه اجرایی و گزاره ارزش',
  '۲. مسئله بازار و شکاف اعتماد جاده‌ای',
  '۳. نمایش تصویری گام‌به‌گام نحوه کار (۸ مرحله)',
  '۴. شبیه‌ساز زنده مأموریت و دیسپچ روی نقشه قزوین',
  '۵. راهبرد ورود به بازار: تمرکز فاز اول در استان قزوین',
  '۶. سبد ۱۵ خدمت درآمدزا و مزیت رقابتی خودروهای برقی',
  '۷. مدل درآمدی و ماشین‌حساب زنده تعرفه (تومان/ریال)',
  '۸. اقتصاد واحد (Unit Economics) و شبیه‌ساز مالی بیزینس‌پلن',
  '۹. اکوسیستم ۴ نقش کاربری، امنیت و حریم خصوصی مکانی',
  '۱۰. معماری مهندسی ۱۶ دامنه و ۳۵ جدول تراکنشی',
  '۱۱. نقشه راه اجرایی ۴ فازی توسعه تا مقیاس ملی',
  '۱۲. مدیریت ریسک، شفافیت حقوقی و جمع‌بندی سرمایه‌گذاری',
];

const WALKTHROUGH_STEPS_8 = [
  {
    step: 1,
    state: 'Draft',
    shortTitle: 'توقف ایمن و ثبت مکان',
    title: 'گام اول: توقف ایمن کنار جاده، انتخاب خودرو و ثبت دقیق موقعیت در قزوین',
    photo: './assets/step1-mobile-sos.jpg',
    photoAlt: 'راننده در حاشیه امن بزرگراه در حال ثبت موقعیت مکانی روی موبایل',
    narrative:
      'راننده پس از روشن کردن فلاشر و قرارگیری پشت گاردریل، وارد وب‌اپلیکیشن موبایل‌محور «اورژانس خودرو» می‌شود. خودرو خود (داخلی، وارداتی، شاسی‌بلند یا برقی) و نوع خرابی را انتخاب کرده و موقعیت دقیق را با GPS مرورگر، پین روی نقشه قزوین یا نشانی متنی ثبت می‌کند.',
    phoneRole: 'نمای موبایل مشتری',
    phoneHeader: 'ثبت درخواست اضطراری — گام ۱ از ۳',
    phoneBody: `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:0.65rem;padding:0.55rem;margin-bottom:0.5rem;">
        <strong>📍 موقعیت تشخیص‌داده‌شده:</strong><br/>آزادراه قزوین - کرج، ۳ کیلومتر بعد از خروجی الوند (زون فعال QZV-HWY-EAST)
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:0.65rem;padding:0.55rem;margin-bottom:0.5rem;">
        <strong>🚗 خودرو:</strong> پژو ۲۰۷ اتوماتیک (ایران ۷۹ - قزوین)<br/>
        <strong>🔧 خدمت:</strong> باتری‌به‌باتری اضطراری / تست دینام
      </div>
      <div style="font-size:0.73rem;color:#059669;font-weight:700;">✓ پوشش فعال استان قزوین توسط سرور تأیید شد</div>
    `,
    backendApi: 'POST /api/geography/check-point & POST /api/pricing/estimate',
    backendTables: 'provinces, service_zones, customer_vehicles',
    securityNote:
      'گارد مرزی سرور بررسی می‌کند که نقطه انتخابی حتماً داخل استان فعال قزوین باشد؛ درخواست‌های خارج از پوشش در همین گام با کد HTTP 422 مسدود می‌شوند.',
  },
  {
    step: 2,
    state: 'Submitted',
    shortTitle: 'پیش‌فاکتور شفاف تومان',
    title: 'گام دوم: مشاهده پیش‌فاکتور شفاف به «تومان» و ارسال ضدتکرار درخواست',
    photo: './assets/hero-qazvin-dispatch.jpg',
    photoAlt: 'شفافیت کامل پیش‌فاکتور پیش از اعزام واحد امدادی در محور قزوین',
    narrative:
      'پیش از اعزام هرگونه ناوگان، سامانه ریزِ دقیق تعرفه (نرخ پایه، کیلومتر رایگان، ضریب آزادراه یا شبانه، کد تخفیف QAZVIN1405 و مالیات) را به «تومان صحیح» نمایش می‌دهد تا هیچ چانه‌زنی یا شوک قیمتی در جاده رخ ندهد. سپس درخواست با کلید یکتای Idempotency-Key ثبت قطعی می‌شود.',
    phoneRole: 'نمای موبایل مشتری — پیش‌فاکتور رسمی',
    phoneHeader: 'شفافیت کامل هزینه پیش از اعزام',
    phoneBody: `
      <div style="display:grid;gap:0.3rem;background:#0f172a;color:#f8fafc;border-radius:0.65rem;padding:0.65rem;">
        <div style="display:flex;justify-content:space-between;"><span>نرخ پایه باتری‌به‌باتری:</span><span>۲۸۰٬۰۰۰ تومان</span></div>
        <div style="display:flex;justify-content:space-between;"><span>ضریب آزادراه قزوین (×۱.۱۵):</span><span>+ ۴۲٬۰۰۰ تومان</span></div>
        <div style="display:flex;justify-content:space-between;color:#6ee7b7;"><span>تخفیف QAZVIN1405 (۱۰٪):</span><span>- ۳۲٬۲۰۰ تومان</span></div>
        <div style="display:flex;justify-content:space-between;"><span>مالیات ارزش افزوده (۱۰٪):</span><span>۲۸٬۹۸۰ تومان</span></div>
        <div style="border-top:1px solid #f59e0b;padding-top:0.35rem;display:flex;justify-content:space-between;color:#fbbf24;font-weight:900;">
          <span>برآورد قابل پرداخت:</span><span>۳۱۸٬۷۸۰ تومان</span>
        </div>
      </div>
      <div style="margin-top:0.45rem;font-size:0.72rem;color:#475569;">کلید ضدتکرار شبکه ضعیف جاده: <code class="mono">idem-qzv-9841</code></div>
    `,
    backendApi: 'POST /api/requests (Header: Idempotency-Key)',
    backendTables: 'service_requests, request_state_history, discount_codes',
    securityNote:
      'اگر اینترنت موبایل راننده در جاده قطع و وصل شود و دکمه ارسال ۳ بار فشرده شود، سرور همان رکورد اول را بدون ثبت تکراری برمی‌گرداند.',
  },
  {
    step: 3,
    state: 'Searching → Offered',
    shortTitle: 'دیسپچ هوشمند ناوگان',
    title: 'گام سوم: رتبه‌بندی هوشمند امدادگران تأییدشده قزوین و ارسال پیشنهاد امن',
    photo: './assets/step2-control-center.jpg',
    photoAlt: 'مرکز دیسپچ و پایش هوشمند ناوگان امدادی روی نقشه دیجیتال',
    narrative:
      'موتور دیسپچ در کسری از ثانیه امدادگران فعال استان قزوین را بر اساس ۵ معیار بررسی می‌کند: ۱) تأییدیه مدارک ادمین (approved)، ۲) آنلاین و آزاد بودن، ۳) داشتن تجهیزات الزامی خدمت (وانت کارگاهی، کفی یا گواهی EV)، ۴) کمترین فاصله Haversine و ۵) امتیاز رضایت مشتریان قبلی.',
    phoneRole: 'نمای پنل امدادگر واجد شرایط',
    phoneHeader: '🔔 پیشنهاد مأموریت جدید (کد EMS-1405-108)',
    phoneBody: `
      <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:0.65rem;padding:0.6rem;margin-bottom:0.45rem;">
        <strong>خدمت:</strong> باتری‌به‌باتری اضطراری (پژو ۲۰۷)<br/>
        <strong>محدوده کلی:</strong> آزادراه قزوین-کرج (فاصله: ۴.۲ کیلومتر)
      </div>
      <div style="background:#f1f5f9;border-radius:0.55rem;padding:0.5rem;font-size:0.72rem;color:#334155;">
        🔒 <strong>حفاظت حریم خصوصی:</strong> شماره تماس و نقطه دقیق راننده تا لحظه پذیرش قطعی مأموریت مخفی است.
      </div>
    `,
    backendApi: 'DispatchService.findAndOfferBestResponder() + SSE Push',
    backendTables: 'responder_profiles, responder_services, mission_offers',
    securityNote:
      'امدادگران فاقد تأییدیه مدیر ارشد یا فاقد گواهی ولتاژ بالا (برای خودروهای برقی) در سطح کوئری دیتابیس کاملاً فیلتر می‌شوند.',
  },
  {
    step: 4,
    state: 'Accepted',
    shortTitle: 'پذیرش اتمیک / مرکز پیام',
    title: 'گام چهارم: پذیرش اتمیک بدون تداخل هم‌زمان (یا ارجاع صادقانه به اپراتور)',
    photo: './assets/step2-control-center.jpg',
    photoAlt: 'هماهنگی آنی پذیرش مأموریت و پشتیبانی اپراتور مرکز عملیات قزوین',
    narrative:
      'با پذیرش پیشنهاد توسط امدادگر، قفل تراکنشی BEGIN IMMEDIATE مانع پذیرش هم‌زمان توسط نفر دوم شده، وضعیت امدادگر به busy تغییر می‌یابد و مشخصات کامل خودرو و پلاک واحد امدادی برای مشتری ارسال می‌گردد. اگر هیچ امدادگری آزاد نباشد، سامانه ETA دروغین نشان نمی‌دهد و پرونده مستقیم در میز اپراتور برجسته می‌شود.',
    phoneRole: 'نمای موبایل مشتری — امدادگر تخصیص یافت',
    phoneHeader: '✅ واحد امداد قزوین پذیرفت (ETA واقعی: ۱۱ دقیقه)',
    phoneBody: `
      <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:0.65rem;padding:0.6rem;margin-bottom:0.45rem;">
        <strong>امدادگر تأییدشده:</strong> مهدی رضایی (امتیاز ۴.۹ ★)<br/>
        <strong>ناوگان:</strong> وانت امداد کارگاهی سفید — ایران ۷۹ ج ۴۴۲<br/>
        <strong>کد رهگیری مأموریت:</strong> <span class="mono">EMS-QZV-4092</span>
      </div>
      <div style="font-size:0.73rem;color:#065f46;">لغو درخواست پیش از شروع حرکت امدادگر کاملاً رایگان است.</div>
    `,
    backendApi: 'POST /api/requests/:id/respond-offer (BEGIN IMMEDIATE)',
    backendTables: 'mission_offers, service_requests, notifications',
    securityNote:
      'تست خودکار شماره ۵ با اجرای Promise.all هم‌زمان اثبات می‌کند که از دو امدادگر موازی دقیقاً یکی موفق (200) و دیگری با کد 409 رد می‌شود.',
  },
  {
    step: 5,
    state: 'EnRoute → Arrived',
    shortTitle: 'ردیابی زنده GPS در مسیر',
    title: 'گام پنجم: حرکت امدادگر، پخش زنده موقعیت روی نقشه (SSE) و رسیدن به محل',
    photo: './assets/hero-qazvin-dispatch.jpg',
    photoAlt: 'رسیدن واحد امداد خودرو مجهز به چراغ گردان کهربایی به محل توقف خودرو',
    narrative:
      'به‌محض شروع حرکت (EnRoute)، موقعیت زنده GPS امدادگر از طریق کانال رویداد بلادرنگ (Server-Sent Events) فقط برای همان مشتری و مرکز عملیات قزوین ارسال می‌شود. هنگام رسیدن به محل (Arrived)، پلاک ناوگان تطبیق داده شده و در خدمات حساس (مثل بازگشایی در خودرو) کارت خودرو و هویت مالک احراز می‌گردد.',
    phoneRole: 'نمای نقشه زنده مشتری (SSE Realtime)',
    phoneHeader: '📡 ردیابی زنده واحد امداد در مسیر شما',
    phoneBody: `
      <div style="background:#0f172a;color:#e2e8f0;border-radius:0.65rem;padding:0.6rem;margin-bottom:0.45rem;">
        <div style="display:flex;justify-content:space-between;font-size:0.74rem;color:#34d399;">
          <span>وضعیت: در مسیر محل حادثه (EnRoute)</span>
          <span>فاصله باقی‌مانده: ۱.۴ km</span>
        </div>
        <div style="height:6px;background:#334155;border-radius:99px;margin-top:0.45rem;overflow:hidden;">
          <div style="width:76%;height:100%;background:#10b981;"></div>
        </div>
      </div>
      <div style="font-size:0.72rem;color:#92400e;background:#fffbeb;padding:0.4rem 0.5rem;border-radius:0.5rem;">
        توجه: لغو یک‌طرفه پس از اعزام ناوگان مشمول هزینه مصوب ایاب‌وذهاب است.
      </div>
    `,
    backendApi: 'POST /api/responders/location -> GET /api/events/stream',
    backendTables: 'responder_profiles, request_state_history',
    securityNote:
      'کانال SSE احراز هویت اجباری دارد و مشتری دیگر هرگز رویداد مکانی مأموریت سایر کاربران را دریافت نمی‌کند.',
  },
  {
    step: 6,
    state: 'InProgress',
    shortTitle: 'عملیات فنی / EV / کفی',
    title: 'گام ششم: اجرای استاندارد عملیات فنی در محل، امداد ولتاژ بالا (EV) یا حمل با کفی',
    photo: './assets/step3-onsite-diagnostics.jpg',
    photoAlt: 'تکنسین متخصص در حال عیب‌یابی دیجیتال باتری و موتور خودرو کنار وانت کارگاهی',
    narrative:
      'بسته به نوع خدمت، تکنسین عیب‌یابی دیجیتال و تعمیر در محل را انجام می‌دهد؛ برای خودروهای برقی، متخصص دارای گواهی ایمنی HV با دستکش عایق وارد عمل می‌شود؛ و در صورت نیاز به حمل، خودرو با کفی هیدرولیک استاندارد به تعمیرگاه مجاز یا مقصد انتخابی مشتری منتقل می‌گردد.',
    phoneRole: 'نمای پنل عملیات امدادگر در صحنه',
    phoneHeader: '🔧 عملیات امدادی در جریان (InProgress)',
    phoneBody: `
      <div style="background:#fff;border:1px solid #cbd5e1;border-radius:0.65rem;padding:0.6rem;margin-bottom:0.45rem;">
        <strong>چک‌لیست ایمنی اجراشده:</strong><br/>
        ✓ نصب مخروط‌های شبرنگ ایمنی در حاشیه آزادراه<br/>
        ✓ تست سلامت دینام و باتری با دستگاه دیجیتال<br/>
        ✓ بارگذاری تصویر مستندات فنی در مخزن خصوصی سرور
      </div>
      <div style="font-size:0.72rem;color:#475569;">فایل‌های تصویری در مسیر امن <code class="mono">storage/private/</code> ذخیره می‌شوند.</div>
    `,
    backendApi: 'POST /api/requests/:id/transition (InProgress) & Attachments',
    backendTables: 'service_requests, private_attachments',
    securityNote:
      'در وضعیت InProgress لغو یک‌طرفه توسط مشتری بسته می‌شود تا امنیت مالی و عملیاتی تکنسین در حین انجام کار حفظ شود.',
  },
  {
    step: 7,
    state: 'Completed (Invoice Gate)',
    shortTitle: 'گزارش کار و گیت ۱۰٪ قیمت',
    title: 'گام هفتم: ثبت گزارش فنی پایان کار، قطعات مصرفی و گیت تأیید مجدد تغییر قیمت',
    photo: './assets/step4-flatbed-tow.jpg',
    photoAlt: 'بارگیری ایمن خودرو روی کفی خودروبر هیدرولیک با تجهیزات کامل ایمنی',
    narrative:
      'در پایان عملیات، امدادگر شرح دقیق تعمیرات و بهای قطعات مصرفی (در صورت تعویض قطعه با رضایت مشتری) را ثبت می‌کند. اگر جمع صورتحساب نهایی بیش از ۱۰٪ نسبت به پیش‌فاکتور اولیه افزایش یافته باشد، سامانه پرداخت را قفل کرده و تأیید صریح مشتری را در اپلیکیشن الزامی می‌سازد.',
    phoneRole: 'نمای موبایل مشتری — کنترل و تأیید صورتحساب',
    phoneHeader: '📋 گزارش فنی پایان کار و صورتحساب رسمی',
    phoneBody: `
      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:0.65rem;padding:0.6rem;margin-bottom:0.45rem;">
        <strong>شرح فنی امدادگر:</strong> راه‌اندازی باتری، تست شارژ ۱۴.۲ ولت دینام و تعویض سرباتری فرسوده.<br/>
        <strong>قطعه مصرفی ثبت‌شده:</strong> ۶۵٬۰۰۰ تومان
      </div>
      <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:0.55rem;padding:0.45rem;font-size:0.73rem;color:#065f46;font-weight:700;">
        ⚠️ افزایش بالای ۱۰٪ شناسایی شد ← دکمه «تأیید آگاهانه صورتحساب توسط مشتری» پیش از پرداخت فعال گردید.
      </div>
    `,
    backendApi: 'POST /api/requests/:id/complete & POST /api/requests/:id/approve-price',
    backendTables: 'mission_reports, invoices, price_change_logs',
    securityNote:
      'تمامی تغییرات قیمت نسبت به پیش‌فاکتور اولیه با ذکر علت در جدول ممیزی price_change_logs ماندگار می‌شوند.',
  },
  {
    step: 8,
    state: 'Paid & Settled',
    shortTitle: 'پرداخت، فاکتور و تسویه شبا',
    title: 'گام هشتم: پرداخت تأییدشده سمت سرور، صدور فاکتور رسمی، امتیازدهی و تسویه شبا',
    photo: './assets/step6-payment-invoice.jpg',
    photoAlt: 'رضایت راننده پس از تکمیل تعمیر خودرو و دریافت رسید رسمی دیجیتال در کنار جاده',
    narrative:
      'مبلغ نهایی تومان صرفاً در مرز اتصال به درگاه بانکی به ریال (×۱۰) تبدیل شده و پس از بازگشت مشتری، سرور مستقیماً اصالت تراکنش را از درگاه استعلام می‌کند. سپس سهم ۸۵٪ امدادگر و ۱۵٪ کمیسیون پلتفرم در دفترکل ثبت گشته، دسترسی امدادگر به شماره مشتری مجدداً سانسور (Redact) شده و تسویه شبا انجام می‌گیرد.',
    phoneRole: 'نمای رسید نهایی و کیف پول امدادگر',
    phoneHeader: '🎉 پرداخت موفق و صدور فاکتور رسمی چاپی',
    phoneBody: `
      <div style="background:#0f172a;color:#f8fafc;border-radius:0.65rem;padding:0.6rem;margin-bottom:0.45rem;">
        <div style="color:#34d399;font-weight:800;margin-bottom:0.25rem;">✓ تأیید استعلام سمت سرور (Server-Verified)</div>
        <div>شماره فاکتور: <span class="mono">INV-1405-00841</span></div>
        <div>سهم خالص کیف پول امدادگر: <strong>۳۱۰٬۱۲۰ تومان</strong></div>
        <div>امتیاز ثبت‌شده مشتری: <span style="color:#fbbf24;">★★★★★ (۵ از ۵)</span></div>
      </div>
      <div style="font-size:0.71rem;color:#059669;">🔒 شماره تماس و آدرس دقیق مشتری پس از پایان کار برای امدادگر سانسور شد.</div>
    `,
    backendApi: 'GET /api/payments/callback -> POST /api/ratings -> Settlements',
    backendTables: 'payment_intents, wallet_ledger_entries, mission_reviews, settlements',
    securityNote:
      'هیچ پرداختی صرفاً با پارامتر مرورگر تأیید نمی‌شود و قید WHERE status = pending مانع ثبت مضاعف موجودی در کیف پول می‌گردد.',
  },
];

const SIM_SCENARIOS = {
  qazvin_jumpstart: {
    title: 'سناریو ۱: پژو ۲۰۷ در آزادراه قزوین-کرج (باتری‌به‌باتری — زون فعال)',
    blocked: false,
    originLabel: 'آزادراه قزوین-کرج (آبیک)',
    originCoords: { x: 455, y: 165 },
    responderStart: { x: 355, y: 155 },
    responderName: 'مهدی رضایی — وانت کارگاهی (۴.۹★)',
    vehicleLabel: 'پژو ۲۰۷ داخلی',
    serviceLabel: 'باتری‌به‌باتری اضطراری',
    estimateToman: 318780,
    partsToman: 0,
    finalToman: 318780,
    commissionToman: 43470,
    responderNetToman: 246330,
  },
  alvand_ev: {
    title: 'سناریو ۲: خودروی برقی KMC E50A در الوند (امداد تخصصی ولتاژ بالا HV)',
    blocked: false,
    originLabel: 'شهر صنعتی البرز و الوند',
    originCoords: { x: 388, y: 192 },
    responderStart: { x: 340, y: 155 },
    responderName: 'مهندس سارا محمدی — واحد تخصصی EV دارای گواهی HV (۵.۰★)',
    vehicleLabel: 'KMC E50A برقی (×۱.۳۵)',
    serviceLabel: 'خدمات تخصصی خودروهای برقی (HV)',
    estimateToman: 1012853,
    partsToman: 0,
    finalToman: 1012853,
    commissionToman: 138116,
    responderNetToman: 782659,
  },
  takestan_flatbed: {
    title: 'سناریو ۳: شاسی‌بلند در تاکستان (کفی خودروبر + قطعه و گیت تأیید ۱۰٪)',
    blocked: false,
    originLabel: 'کمربندی تاکستان',
    originCoords: { x: 235, y: 165 },
    responderStart: { x: 335, y: 155 },
    responderName: 'حسین قاسمی — کفی خودروبر هیدرولیک (۴.۸★)',
    vehicleLabel: 'شاسی‌بلند سنگین (×۱.۲۰)',
    serviceLabel: 'حمل با کفی خودروبر (۱۵km حمل)',
    estimateToman: 1762893,
    partsToman: 320000,
    finalToman: 2114893,
    commissionToman: 240395,
    responderNetToman: 1682235,
  },
  alborz_blocked: {
    title: 'سناریو ۴: تلاش ثبت درخواست در کرج / استان البرز (آزمایش گارد مسدودساز سرور)',
    blocked: true,
    originLabel: 'کرج — استان البرز (pending_approval)',
    originCoords: { x: 585, y: 135 },
    responderStart: { x: 340, y: 155 },
    responderName: '— (تخصیص انجام نمی‌شود)',
    vehicleLabel: 'سورن پلاس',
    serviceLabel: 'پنچرگیری سیار',
    estimateToman: 0,
    partsToman: 0,
    finalToman: 0,
    commissionToman: 0,
    responderNetToman: 0,
  },
};

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
      'پوشش کامل محلات پونک، مینودر، خیام، فردوسی، بلوار نخبگان و بازار قدیم قزوین با ضریب پایه ۱.۰۰ و کوتاه‌ترین زمان رسیدن (۸ تا ۱۴ دقیقه).',
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
      'قطب صنعتی استان قزوین با تراکم بالای خودروهای سواری کارکنان و ناوگان خدماتی؛ اولویت استقرار وانت کارگاهی و واحد تخصصی EV.',
  },
  {
    id: 'QZV-HWY-EAST',
    title: 'آزادراه قزوین - کرج (حوزه استحفاظی قزوین)',
    province: 'قزوین (فعال عملیاتی)',
    status: 'active',
    statusLabel: 'فعال عملیاتی (HTTP 200)',
    multiplier: 1.15,
    radiusKm: 30,
    capacity: '۴ واحد بزرگراهی',
    detail:
      'پرترددترین شریان ترانزیتی کشور در ورودی شرقی قزوین تا مرز آبیک؛ ضریب سختی و ایمنی بزرگراهی ۱.۱۵.',
  },
  {
    id: 'QZV-HWY-WEST',
    title: 'آزادراه قزوین - زنجان و تاکستان',
    province: 'قزوین (فعال عملیاتی)',
    status: 'active',
    statusLabel: 'فعال عملیاتی (HTTP 200)',
    multiplier: 1.15,
    radiusKm: 32,
    capacity: '۶ واحد مجموع شهرستان و آزادراه',
    detail:
      'پوشش شهر تاکستان (×۱.۰۵) و محور آزادراهی غرب قزوین (×۱.۱۵) با استقرار کفی خودروبر هیدرولیک و یدک‌کش چرخ‌گیر.',
  },
  {
    id: 'QZV-BUINZAHRA',
    title: 'بوئین‌زهرا و آبیک',
    province: 'قزوین (فعال عملیاتی)',
    status: 'active',
    statusLabel: 'فعال عملیاتی (HTTP 200)',
    multiplier: 1.1,
    radiusKm: 24,
    capacity: '۵ واحد شهرستان‌ها',
    detail:
      'تکمیل حلقه پوشش سراسری شهرستان‌های استان قزوین در محور جنوب و شرق (آبیک ×۱.۰۵ و بوئین‌زهرا ×۱.۱۰).',
  },
  {
    id: 'PROV-NEIGHBORS',
    title: 'البرز، تهران، زنجان، گیلان و همدان',
    province: 'استان‌های فاز توسعه بعدی (غیرفعال)',
    status: 'pending_approval',
    statusLabel: 'مسدود در گارد سرور (HTTP 422)',
    multiplier: 1.0,
    radiusKm: 25,
    capacity: 'در وضعیت preparing / pending_approval / inactive',
    detail:
      'در پایگاه‌داده تعریف شده‌اند تا معماری توسعه ملی آماده باشد، اما تا زمان جذب ناوگان بومی احراز صلاحیت‌شده و ثبت مصوبه صریح مدیر ارشد (Super Admin)، ثبت درخواست واقعی در آن‌ها مسدود است.',
  },
];

const SERVICES_15 = [
  { slug: 'battery-jumpstart', title: 'باتری‌به‌باتری اضطراری', cat: 'battery_electrical', catFa: 'باتری و برق', base: 280000, freeKm: 6, perKm: 15000, towKm: 0, cancelFee: 90000, equip: 'موتور / وانت امداد / واحد EV', badge: 'پرتقاضا' },
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
  { slug: 'transport-to-custom-destination', title: 'حمل خودرو با کفی خودروبر به مقصد انتخابی', cat: 'towing_transport', catFa: 'یدک‌کش و حمل', base: 890000, freeKm: 5, perKm: 22000, towKm: 35000, cancelFee: 220000, equip: 'کفی خودروبر هیدرولیک', badge: 'حاشیه سود بالا' },
  { slug: 'domestic-car-assistance', title: 'امداد جامع خودروهای داخلی', cat: 'specialized_fleet', catFa: 'تخصصی و برقی', base: 380000, freeKm: 6, perKm: 15000, towKm: 0, cancelFee: 100000, equip: 'وانت کارگاهی', badge: 'خودروهای داخلی' },
  { slug: 'foreign-car-assistance', title: 'امداد تخصصی خودروهای خارجی و وارداتی', cat: 'specialized_fleet', catFa: 'تخصصی و برقی', base: 590000, freeKm: 6, perKm: 18000, towKm: 0, cancelFee: 150000, equip: 'وانت کارگاهی / واحد EV', badge: 'وارداتی و شاسی‌بلند' },
  { slug: 'ev-specialized-service', title: 'خدمات تخصصی خودروهای برقی و هیبریدی (HV)', cat: 'specialized_fleet', catFa: 'تخصصی و برقی', base: 720000, freeKm: 6, perKm: 20000, towKm: 0, cancelFee: 160000, equip: 'واحد تخصصی EV / کفی', badge: 'گواهی ایمنی HV الزامی' },
];

const DOMAINS_16 = [
  { num: 1, name: 'Identity & Access', fa: 'هویت و نشست امن', path: 'modules/identity/', tables: 'users, user_sessions', desc: 'هش scrypt با مقایسه زمان‌ثابت، هش SHA-256 توکن نشست و کوکی HttpOnly.' },
  { num: 2, name: 'Customer Vehicles', fa: 'مشتریان و خودروها', path: 'modules/customers/', tables: 'customer_vehicles', desc: 'مدیریت خودروهای داخلی، وارداتی، شاسی‌بلند و برقی با حفاظت کامل ضد IDOR.' },
  { num: 3, name: 'Responder Vetting', fa: 'احراز صلاحیت ناوگان', path: 'modules/responders/', tables: 'responder_profiles, responder_documents, responder_services, responder_zones', desc: 'بارگذاری مدارک، گواهی ایمنی ولتاژ بالا (EV)، شبا و قفل مطلق آنلاین‌شدن پیش از تأیید مدیر.' },
  { num: 4, name: 'Service Catalog', fa: 'کاتالوگ ۱۵ خدمت', path: 'modules/catalog/', tables: 'service_catalog, zone_services, service_audit_logs', desc: 'پیکربندی پویا تعرفه، پیش‌نیاز تجهیزات ناوگان و ثبت لاگ ممیزی تغییرات.' },
  { num: 5, name: 'Geographic Governance', fa: 'حاکمیت جغرافیایی', path: 'modules/geography/', tables: 'provinces, cities, service_zones, geography_status_history', desc: 'فعال بودن انحصاری استان قزوین در فاز اول و پروتکل مصوبه مدیر ارشد برای استان جدید.' },
  { num: 6, name: 'Request Intake', fa: 'ثبت ضدتکرار درخواست', path: 'modules/requests/', tables: 'service_requests, private_attachments', desc: 'پشتیبانی Idempotency-Key، استعلام عمومی ایمن کد رهگیری و ذخیره خصوصی تصاویر.' },
  { num: 7, name: 'Smart Dispatch', fa: 'دیسپچ هوشمند اتمیک', path: 'modules/requests/dispatch.service.ts', tables: 'mission_offers', desc: 'امتیازدهی فاصله/تجهیزات/امتیاز، قفل BEGIN IMMEDIATE ضد پذیرش موازی و ارجاع صادقانه به اپراتور.' },
  { num: 8, name: 'Mission Lifecycle', fa: 'ماشین وضعیت ۱۲حالته', path: 'modules/requests/state-machine.ts', tables: 'request_state_history, mission_reports', desc: 'کنترل سخت‌گیرانه تغییر وضعیت‌ها، تاریخچه اقدام‌کنندگان و گزارش فنی پایان کار.' },
  { num: 9, name: 'Toman Pricing Engine', fa: 'موتور قیمت‌گذاری تومان', path: 'shared/pricing-formula.ts, modules/pricing/', tables: 'pricing_rules, discount_codes, price_change_logs', desc: 'فرمول شفاف تومان صحیح، کد تخفیف QAZVIN1405 و گیت تأیید مشتری برای افزایش بالای ۱۰٪.' },
  { num: 10, name: 'Payments & Refunds', fa: 'پرداخت و بازپرداخت', path: 'modules/payments/', tables: 'payment_intents, refunds', desc: 'آداپتور زرین‌پال و Sandbox شفاف، استعلام سمت سرور Callback و بازپرداخت کامل/جزئی.' },
  { num: 11, name: 'Invoices & Settlements', fa: 'فاکتور، دفترکل و شبا', path: 'modules/payments/payments.service.ts', tables: 'invoices, wallet_ledger_entries, settlements', desc: 'فاکتور رسمی چاپی، تفکیک ۸۵٪/۱۵٪ در دفترکل کیف پول و تسویه شبای ۲۴ رقمی.' },
  { num: 12, name: 'SMS & Realtime SSE', fa: 'پیامک و جریان زنده SSE', path: 'modules/notifications/, modules/events/', tables: 'notifications', desc: 'کاوه‌نگار / Sandbox Outbox با ایزوله‌سازی خطا و جریان زنده احراز هویت‌شده SSE.' },
  { num: 13, name: 'Support & Disputes', fa: 'پشتیبانی و حل اختلاف', path: 'modules/support/', tables: 'support_tickets, ticket_messages, internal_operator_notes', desc: 'تیکت‌های متصل به مأموریت و یادداشت‌های داخلی اپراتور (کاملاً مخفی از دید مشتری).' },
  { num: 14, name: 'Ratings & Quality', fa: 'امتیازدهی و کیفیت', path: 'modules/ratings/', tables: 'mission_reviews', desc: 'ثبت یک‌باره امتیاز ۱ تا ۵ پس از اتمام خدمت و بروزرسانی خودکار رتبه دیسپچ امدادگر.' },
  { num: 15, name: 'KPI & Security Audit', fa: 'گزارش کلان و ممیزی', path: 'modules/audit/, modules/admin/', tables: 'audit_logs, security_events', desc: 'داشبورد KPI، تطبیق مالی (Reconciliation) و ثبت تغییرناپذیر رخدادهای امنیتی.' },
  { num: 16, name: 'System Config & Ops', fa: 'پیکربندی و عملیات DB', path: 'modules/admin/, server/db/', tables: 'system_settings, schema_migrations', desc: 'تنظیمات پویا، قفل امنیتی Production، مهاجرت برگشت‌پذیر و بکاپ آنلاین VACUUM INTO.' },
];

function faNum(n) {
  return Math.round(Number(n) || 0).toLocaleString('fa-IR');
}

function faToman(n) {
  return `${faNum(n)} تومان`;
}

// ==================== ۱. کنترلر اسلایدها، حالت نمایش و لمس موبایل ====================
const slides = Array.from(document.querySelectorAll('.slide'));
const totalSlides = slides.length;
let currentSlide = 0;
let isScrollMode = false;

const progressFill = document.getElementById('progress-fill');
const dockPrevBtn = document.getElementById('dock-prev');
const dockNextBtn = document.getElementById('dock-next');
const dockCounterBtn = document.getElementById('dock-counter');
const dockDots = document.getElementById('dock-dots');
const modeToggleBtn = document.getElementById('btn-toggle-mode');
const fullscreenBtn = document.getElementById('btn-fullscreen');
const printBtn = document.getElementById('btn-print');
const tocOpenBtn = document.getElementById('btn-open-toc');
const tocCloseBtn = document.getElementById('btn-close-toc');
const tocBackdrop = document.getElementById('toc-backdrop');
const tocDrawer = document.getElementById('toc-drawer');
const tocList = document.getElementById('toc-list');

function renderTocAndDots() {
  if (tocList) {
    tocList.innerHTML = SLIDE_TITLES.map(
      (t, idx) => `
      <button type="button" class="toc-item ${idx === currentSlide ? 'current' : ''}" data-slide="${idx}">
        <span class="toc-num">${faNum(idx + 1)}</span>
        <span>${t.replace(/^[۰-۹]+\.\s*/, '')}</span>
      </button>
    `
    ).join('');
    tocList.querySelectorAll('.toc-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = Number(btn.getAttribute('data-slide') || 0);
        closeToc();
        goToSlide(target);
      });
    });
  }

  if (dockDots) {
    dockDots.innerHTML = SLIDE_TITLES.map(
      (t, idx) =>
        `<button type="button" class="dock-dot ${idx === currentSlide ? 'active' : ''}" title="${t}" aria-label="رفتن به اسلاید ${idx + 1}" data-dot="${idx}"></button>`
    ).join('');
    dockDots.querySelectorAll('.dock-dot').forEach((dot) => {
      dot.addEventListener('click', () =>
        goToSlide(Number(dot.getAttribute('data-dot') || 0))
      );
    });
  }
}

function updateSlideUI(scrollTop = true) {
  slides.forEach((el, idx) => {
    el.classList.toggle('active', idx === currentSlide);
  });

  const pct = ((currentSlide + 1) / totalSlides) * 100;
  if (progressFill) progressFill.style.width = `${pct}%`;
  if (dockCounterBtn) {
    dockCounterBtn.textContent = `اسلاید ${faNum(currentSlide + 1)} از ${faNum(totalSlides)} ☰`;
  }
  if (dockPrevBtn) dockPrevBtn.disabled = currentSlide === 0;
  if (dockNextBtn) {
    dockNextBtn.textContent =
      currentSlide === totalSlides - 1 ? 'بازگشت به اسلاید اول ↺' : 'اسلاید بعدی ←';
  }

  renderTocAndDots();

  if (!isScrollMode && scrollTop && typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (typeof history !== 'undefined' && history.replaceState) {
    history.replaceState(null, '', `#slide-${currentSlide + 1}`);
  }
}

function goToSlide(index, scrollTop = true) {
  const normalized = Math.max(0, Math.min(totalSlides - 1, index));
  currentSlide = normalized;
  if (isScrollMode) {
    slides[currentSlide]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    renderTocAndDots();
    return;
  }
  updateSlideUI(scrollTop);
}

function openToc() {
  tocBackdrop?.classList.add('open');
  tocDrawer?.classList.add('open');
}

function closeToc() {
  tocBackdrop?.classList.remove('open');
  tocDrawer?.classList.remove('open');
}

tocOpenBtn?.addEventListener('click', openToc);
dockCounterBtn?.addEventListener('click', openToc);
tocCloseBtn?.addEventListener('click', closeToc);
tocBackdrop?.addEventListener('click', closeToc);

dockPrevBtn?.addEventListener('click', () => {
  if (currentSlide > 0) goToSlide(currentSlide - 1);
});

dockNextBtn?.addEventListener('click', () => {
  if (currentSlide < totalSlides - 1) {
    goToSlide(currentSlide + 1);
  } else {
    goToSlide(0);
  }
});

document.querySelectorAll('[data-goto-slide]').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    const idx = Number(el.getAttribute('data-goto-slide') || 1) - 1;
    goToSlide(idx);
  });
});

modeToggleBtn?.addEventListener('click', () => {
  isScrollMode = !isScrollMode;
  document.body.classList.toggle('mode-scroll', isScrollMode);
  modeToggleBtn.classList.toggle('active-mode', isScrollMode);
  modeToggleBtn.textContent = isScrollMode
    ? 'نمای اسلایدی تعاملی ▣'
    : 'نمای یکپارچه پیمایشی ▤';
  if (!isScrollMode) updateSlideUI(false);
});

fullscreenBtn?.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
});

printBtn?.addEventListener('click', () => {
  window.print();
});

// میانبرهای صفحه‌کلید (راست‌به‌چپ فارسی: فلش چپ = اسلاید بعدی، فلش راست = اسلاید قبلی)
window.addEventListener('keydown', (e) => {
  const tag = (e.target && e.target.tagName) || '';
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
  if (isScrollMode) return;

  if (e.key === 'ArrowLeft' || e.key === 'PageDown') {
    e.preventDefault();
    if (currentSlide < totalSlides - 1) goToSlide(currentSlide + 1);
  } else if (e.key === 'ArrowRight' || e.key === 'PageUp') {
    e.preventDefault();
    if (currentSlide > 0) goToSlide(currentSlide - 1);
  } else if (e.key === 'Home') {
    e.preventDefault();
    goToSlide(0);
  } else if (e.key === 'End') {
    e.preventDefault();
    goToSlide(totalSlides - 1);
  } else if (e.key === 'Escape') {
    closeToc();
  }
});

// ژست لمسی کشیدن انگشت (Swipe) روی موبایل بدون تداخل با اسلایدرها و جداول
let touchStartX = 0;
let touchStartY = 0;
let ignoreSwipe = false;

window.addEventListener(
  'touchstart',
  (e) => {
    if (isScrollMode || e.touches.length !== 1) return;
    const target = e.target;
    if (
      target &&
      target.closest &&
      target.closest('input, select, button, .table-scroll, svg')
    ) {
      ignoreSwipe = true;
      return;
    }
    ignoreSwipe = false;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  },
  { passive: true }
);

window.addEventListener(
  'touchend',
  (e) => {
    if (isScrollMode || ignoreSwipe || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > 68 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      // در چیدمان RTL کشیدن به راست (dx > 0) معمولاً رفتن به اسلاید بعدی و چپ قبلی است؛
      // برای سازگاری شهودی، کشیدن انگشت از چپ به راست = بعدی، از راست به چپ = قبلی:
      if (dx > 0 && currentSlide < totalSlides - 1) {
        goToSlide(currentSlide + 1);
      } else if (dx < 0 && currentSlide > 0) {
        goToSlide(currentSlide - 1);
      }
    }
  },
  { passive: true }
);

// بازیابی اسلاید از Hash آدرس در بارگذاری اولیه
if (typeof window !== 'undefined' && window.location.hash.startsWith('#slide-')) {
  const n = Number(window.location.hash.replace('#slide-', ''));
  if (n >= 1 && n <= totalSlides) currentSlide = n - 1;
}
updateSlideUI(false);

// ==================== ۲. بررسی زنده بودن بک‌اند واقعی (/api/health) ====================
let liveBackendConnected = false;
const liveConnectionBadge = document.getElementById('live-connection-badge');
const liveAppLinksWrap = document.getElementById('live-app-links');

async function probeLiveBackend() {
  if (
    typeof window === 'undefined' ||
    window.location.hostname.endsWith('github.io')
  ) {
    return;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch('/api/health', { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && data.ok) {
        liveBackendConnected = true;
        if (liveConnectionBadge) {
          liveConnectionBadge.className = 'badge badge-ok';
          liveConnectionBadge.textContent =
            '● متصل به هسته زنده سرور و دیتابیس تراکنشی (Live API Active)';
        }
        if (liveAppLinksWrap) {
          liveAppLinksWrap.style.display = 'flex';
        }
      }
    }
  } catch {
    // اجرای مستقل ایستا (مانند GitHub Pages یا pages:preview)
  }
}
void probeLiveBackend();

// ==================== ۳. اسلاید ۳: استوری‌بورد تصویری ۸ مرحله‌ای ====================
const stepTabsEl = document.getElementById('walkthrough-tabs');
const walkStageEl = document.getElementById('walkthrough-stage');
const walkAutoBtn = document.getElementById('btn-walk-autoplay');
let activeWalkStep = 0;
let walkAutoTimer = null;

function renderWalkthrough(idx) {
  activeWalkStep = idx;
  const item = WALKTHROUGH_STEPS_8[idx];
  if (stepTabsEl) {
    stepTabsEl.querySelectorAll('.step-tab-btn').forEach((b, i) => {
      b.classList.toggle('active', i === idx);
    });
  }
  if (!walkStageEl || !item) return;

  walkStageEl.innerHTML = `
    <div class="walk-photo-card">
      <img src="${item.photo}" alt="${item.photoAlt}" loading="lazy" />
      <div class="walk-photo-body">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem;margin-bottom:0.45rem;">
          <span class="badge badge-warn">وضعیت ماشین وضعیت: <span class="mono">${item.state}</span></span>
          <span style="font-size:0.75rem;color:#94a3b8;">مرحله ${faNum(item.step)} از ۸</span>
        </div>
        <h3 style="margin:0 0 0.45rem;font-size:1rem;color:#fff;">${item.title}</h3>
        <p style="margin:0;font-size:0.82rem;color:#cbd5e1;line-height:1.75;">${item.narrative}</p>
      </div>
    </div>

    <div class="phone-mockup">
      <div>
        <div class="phone-notch"></div>
        <div style="display:flex;justify-content:space-between;font-size:0.68rem;color:#94a3b8;margin-bottom:0.45rem;padding-inline:0.25rem;">
          <span>${item.phoneRole}</span>
          <span class="mono">4G • Qazvin</span>
        </div>
        <div class="phone-screen">
          <div style="font-weight:900;font-size:0.8rem;color:#0f172a;margin-bottom:0.55rem;padding-bottom:0.35rem;border-bottom:1px solid #e2e8f0;">
            ${item.phoneHeader}
          </div>
          ${item.phoneBody}
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;gap:0.4rem;margin-top:0.6rem;">
        <button type="button" id="walk-prev-inner" class="btn-ctrl" style="flex:1;justify-content:center;" ${idx === 0 ? 'disabled' : ''}>→ گام قبلی</button>
        <button type="button" id="walk-next-inner" class="btn-ctrl active-mode" style="flex:1;justify-content:center;">${idx === WALKTHROUGH_STEPS_8.length - 1 ? 'شروع مجدد ↺' : 'گام بعدی ←'}</button>
      </div>
    </div>

    <div class="card" style="display:flex;flex-direction:column;justify-content:space-between;background:#f8fafc;">
      <div>
        <div class="badge badge-info" style="margin-bottom:0.55rem;">کالبدشکافی فنی پشت‌صحنه سرور</div>
        <h3>آنچه در هسته «اورژانس خودرو» رخ می‌دهد</h3>
        <div style="margin-top:0.65rem;display:grid;gap:0.55rem;font-size:0.8rem;">
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:0.6rem;padding:0.6rem;">
            <strong style="color:#0f172a;">مسیر API و سرویس:</strong>
            <div class="mono" style="font-size:0.74rem;color:#0369a1;margin-top:0.2rem;">${item.backendApi}</div>
          </div>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:0.6rem;padding:0.6rem;">
            <strong style="color:#0f172a;">جداول درگیر در تراکنش ACID:</strong>
            <div class="mono" style="font-size:0.74rem;color:#059669;margin-top:0.2rem;">${item.backendTables}</div>
          </div>
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:0.6rem;padding:0.6rem;color:#78350f;">
            <strong>کنترل امنیتی و حریم خصوصی:</strong>
            <div style="margin-top:0.2rem;">${item.securityNote}</div>
          </div>
        </div>
      </div>
      <div style="font-size:0.74rem;color:#64748b;margin-top:0.75rem;padding-top:0.55rem;border-top:1px solid #e2e8f0;">
        تمامی مراحل فوق با تست‌های خودکار سرتاسری در <code class="mono">tests/platform.test.ts</code> راستی‌آزمایی شده‌اند.
      </div>
    </div>
  `;

  document.getElementById('walk-prev-inner')?.addEventListener('click', () => {
    if (activeWalkStep > 0) renderWalkthrough(activeWalkStep - 1);
  });
  document.getElementById('walk-next-inner')?.addEventListener('click', () => {
    renderWalkthrough((activeWalkStep + 1) % WALKTHROUGH_STEPS_8.length);
  });
}

if (stepTabsEl) {
  stepTabsEl.innerHTML = WALKTHROUGH_STEPS_8.map(
    (s, i) => `
    <button type="button" class="step-tab-btn ${i === 0 ? 'active' : ''}" data-step="${i}">
      <span class="step-tab-num">گام ${faNum(s.step)}</span>
      <span class="step-tab-lbl">${s.shortTitle}</span>
    </button>
  `
  ).join('');
  stepTabsEl.querySelectorAll('.step-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      stopWalkAuto();
      renderWalkthrough(Number(btn.getAttribute('data-step') || 0));
    });
  });
  renderWalkthrough(0);
}

function stopWalkAuto() {
  if (walkAutoTimer) {
    clearInterval(walkAutoTimer);
    walkAutoTimer = null;
  }
  if (walkAutoBtn) walkAutoBtn.textContent = 'پخش خودکار مراحل ▶';
}

walkAutoBtn?.addEventListener('click', () => {
  if (walkAutoTimer) {
    stopWalkAuto();
    return;
  }
  walkAutoBtn.textContent = 'توقف پخش خودکار ⏸';
  walkAutoTimer = setInterval(() => {
    renderWalkthrough((activeWalkStep + 1) % WALKTHROUGH_STEPS_8.length);
  }, 4200);
});

// ==================== ۴. اسلاید ۴: شبیه‌ساز زنده مأموریت روی نقشه قزوین ====================
const simScenarioSelect = document.getElementById('sim-scenario');
const simNextBtn = document.getElementById('sim-next-btn');
const simResetBtn = document.getElementById('sim-reset-btn');
const simStateBadge = document.getElementById('sim-state-badge');
const simLogEl = document.getElementById('sim-log');
const simOriginCircle = document.getElementById('sim-origin-pin');
const simVanCircle = document.getElementById('sim-responder-van');
const simRouteLine = document.getElementById('sim-route-line');
const simSummaryCard = document.getElementById('sim-summary-card');

let simStage = 0;
let simLogs = [];

function addSimLog(msg, tone = '#e2e8f0') {
  const ts = new Date().toLocaleTimeString('fa-IR', { hour12: false });
  simLogs.unshift(`<div class="sim-log-item" style="color:${tone};"><span class="mono" style="color:#64748b;">[${ts}]</span> ${msg}</div>`);
  if (simLogEl) simLogEl.innerHTML = simLogs.join('');
}

function resetMissionSimulator() {
  simStage = 0;
  simLogs = [];
  const key = (simScenarioSelect && simScenarioSelect.value) || 'qazvin_jumpstart';
  const sc = SIM_SCENARIOS[key] || SIM_SCENARIOS.qazvin_jumpstart;

  if (simOriginCircle) {
    simOriginCircle.setAttribute('cx', String(sc.originCoords.x));
    simOriginCircle.setAttribute('cy', String(sc.originCoords.y));
  }
  if (simVanCircle) {
    simVanCircle.setAttribute('cx', String(sc.responderStart.x));
    simVanCircle.setAttribute('cy', String(sc.responderStart.y));
  }
  if (simRouteLine) {
    simRouteLine.setAttribute('x1', String(sc.responderStart.x));
    simRouteLine.setAttribute('y1', String(sc.responderStart.y));
    simRouteLine.setAttribute('x2', String(sc.originCoords.x));
    simRouteLine.setAttribute('y2', String(sc.originCoords.y));
    simRouteLine.style.opacity = '0.25';
  }
  if (simStateBadge) {
    simStateBadge.className = 'badge badge-warn';
    simStateBadge.textContent = 'وضعیت فعلی: آماده ثبت درخواست (Draft)';
  }
  if (simNextBtn) {
    simNextBtn.disabled = false;
    simNextBtn.textContent = 'اجرای گام ۱: بررسی مرز جغرافیایی و ثبت درخواست ◀';
  }
  if (simSummaryCard) {
    simSummaryCard.innerHTML = `
      <div><strong>مبدأ انتخابی:</strong> ${sc.originLabel}</div>
      <div><strong>خودرو و خدمت:</strong> ${sc.vehicleLabel} — ${sc.serviceLabel}</div>
      <div><strong>پیش‌فاکتور اولیه:</strong> ${sc.blocked ? 'در انتظار بررسی گارد استان' : faToman(sc.estimateToman)}</div>
    `;
  }
  addSimLog(`سناریوی «${sc.title}» بارگذاری شد. دکمه اجرای گام بعدی را بزنید.`, '#fbbf24');
}

function stepMissionSimulator() {
  const key = (simScenarioSelect && simScenarioSelect.value) || 'qazvin_jumpstart';
  const sc = SIM_SCENARIOS[key] || SIM_SCENARIOS.qazvin_jumpstart;
  simStage += 1;

  if (sc.blocked) {
    if (simStateBadge) {
      simStateBadge.className = 'badge badge-err';
      simStateBadge.textContent = 'مسدود شد: 422 PROVINCE_NOT_ACTIVE';
    }
    addSimLog(
      '⛔ گارد سرور (GeographyService): استان البرز در وضعیت pending_approval است. ثبت درخواست واقعی پیش از مصوبه مدیر ارشد رد شد (HTTP 422).',
      '#fda4af'
    );
    if (simNextBtn) {
      simNextBtn.disabled = true;
      simNextBtn.textContent = 'درخواست توسط سرور مسدود شد (تغییر سناریو یا شروع مجدد)';
    }
    return;
  }

  if (simStage === 1) {
    if (simStateBadge) {
      simStateBadge.className = 'badge badge-info';
      simStateBadge.textContent = 'وضعیت: ثبت قطعی و جستجوی ناوگان (Submitted → Searching)';
    }
    addSimLog(
      `✓ پوشش فعال استان قزوین تأیید شد. درخواست با کلید Idempotency-Key ثبت گردید؛ پیش‌فاکتور: ${faToman(sc.estimateToman)}.`,
      '#6ee7b7'
    );
    if (simNextBtn) simNextBtn.textContent = 'اجرای گام ۲: امتیازدهی دیسپچ و پذیرش اتمیک امدادگر ◀';
  } else if (simStage === 2) {
    if (simStateBadge) {
      simStateBadge.className = 'badge badge-info';
      simStateBadge.textContent = 'وضعیت: پذیرش اتمیک توسط امدادگر (Offered → Accepted)';
    }
    if (simRouteLine) simRouteLine.style.opacity = '0.9';
    addSimLog(
      `🔔 پیشنهاد برای «${sc.responderName}» ارسال و با قفل تراکنشی BEGIN IMMEDIATE پذیرفته شد.`,
      '#93c5fd'
    );
    if (simNextBtn) simNextBtn.textContent = 'اجرای گام ۳: حرکت زنده GPS روی نقشه و رسیدن به خودرو ◀';
  } else if (simStage === 3) {
    const midX = Math.round((sc.responderStart.x + sc.originCoords.x) / 2);
    const midY = Math.round((sc.responderStart.y + sc.originCoords.y) / 2);
    if (simVanCircle) {
      simVanCircle.setAttribute('cx', String(midX));
      simVanCircle.setAttribute('cy', String(midY));
    }
    setTimeout(() => {
      if (simVanCircle && simStage >= 3) {
        simVanCircle.setAttribute('cx', String(sc.originCoords.x - 8));
        simVanCircle.setAttribute('cy', String(sc.originCoords.y - 6));
      }
    }, 420);
    if (simStateBadge) {
      simStateBadge.className = 'badge badge-warn';
      simStateBadge.textContent = 'وضعیت: حضور در محل و انجام عملیات (EnRoute → Arrived → InProgress)';
    }
    addSimLog(
      '📡 موقعیت زنده از طریق کانال احراز هویت‌شده SSE استریم شد؛ واحد امدادی در محل حاضر و عملیات فنی آغاز گردید.',
      '#fde68a'
    );
    if (simNextBtn) simNextBtn.textContent = 'اجرای گام ۴: ثبت گزارش فنی، پرداخت سرور و تسویه کیف پول ◀';
  } else if (simStage === 4) {
    if (simStateBadge) {
      simStateBadge.className = 'badge badge-ok';
      simStateBadge.textContent = 'وضعیت: تکمیل مأموریت، پرداخت تأییدشده و تسویه (Completed)';
    }
    if (sc.partsToman > 0) {
      addSimLog(
        `⚠️ قطعه مصرفی (${faToman(sc.partsToman)}) باعث افزایش بالای ۱۰٪ شد؛ گیت «تأیید مجدد مشتری» اجرا و در price_change_logs ثبت شد.`,
        '#fcd34d'
      );
    }
    addSimLog(
      `💳 پرداخت ${faToman(sc.finalToman)} (معادل ${(sc.finalToman * 10).toLocaleString('en-US')} ریال) سمت سرور تأیید شد. سهم خالص امدادگر (${faToman(sc.responderNetToman)}) به کیف پول واریز و اطلاعات تماس مشتری مجدداً سانسور شد.`,
      '#34d399'
    );
    if (simSummaryCard) {
      simSummaryCard.innerHTML = `
        <div style="color:#34d399;font-weight:800;">✓ مأموریت با موفقیت کامل به پایان رسید</div>
        <div><strong>جمع فاکتور پرداخت‌شده:</strong> ${faToman(sc.finalToman)}</div>
        <div><strong>واریزی خالص کیف پول امدادگر:</strong> ${faToman(sc.responderNetToman)} | <strong>کمیسیون پلتفرم:</strong> ${faToman(sc.commissionToman)}</div>
      `;
    }
    if (simNextBtn) {
      simNextBtn.disabled = true;
      simNextBtn.textContent = 'چرخه مأموریت کامل شد ✓ (امکان شروع مجدد یا تغییر سناریو)';
    }
  }
}

simScenarioSelect?.addEventListener('change', resetMissionSimulator);
simResetBtn?.addEventListener('click', resetMissionSimulator);
simNextBtn?.addEventListener('click', stepMissionSimulator);
resetMissionSimulator();

// ==================== ۵. اسلاید ۵: کاوشگر مناطق استان قزوین ====================
const zoneChipsEl = document.getElementById('zone-chips');
const zoneDetailEl = document.getElementById('zone-detail');

function renderZoneCard(z) {
  if (!zoneDetailEl) return;
  const ok = z.status === 'active';
  zoneDetailEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.55rem;">
      <span class="mono" style="font-size:0.76rem;color:#64748b;font-weight:800;">${z.id}</span>
      <span class="badge ${ok ? 'badge-ok' : 'badge-err'}">${z.statusLabel}</span>
    </div>
    <h3>${z.title}</h3>
    <div style="font-size:0.8rem;color:#334155;margin-block:0.45rem;">
      ضریب تعرفه زون: <strong>×${z.multiplier}</strong> | شعاع هندسی: <strong>${faNum(z.radiusKm)} کیلومتر</strong> | ظرفیت ناوگان: <strong>${z.capacity}</strong>
    </div>
    <p>${z.detail}</p>
  `;
}

if (zoneChipsEl) {
  ZONES_AND_PROVINCES.forEach((z, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `chip ${i === 0 ? 'active' : ''}`;
    b.textContent = z.title;
    b.addEventListener('click', () => {
      zoneChipsEl.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      b.classList.add('active');
      renderZoneCard(z);
    });
    zoneChipsEl.appendChild(b);
  });
  renderZoneCard(ZONES_AND_PROVINCES[0]);
}

// ==================== ۶. اسلاید ۶: کاتالوگ قابل فیلتر ۱۵ خدمت ====================
const catalogGridEl = document.getElementById('catalog-grid');
const catalogFilterWrap = document.getElementById('catalog-filters');

function renderCatalogItems(cat = 'all') {
  if (!catalogGridEl) return;
  const list = cat === 'all' ? SERVICES_15 : SERVICES_15.filter((s) => s.cat === cat);
  catalogGridEl.innerHTML = list
    .map(
      (s) => `
      <article class="card" style="display:flex;flex-direction:column;justify-content:space-between;">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:0.35rem;margin-bottom:0.45rem;">
            <span class="badge badge-info">${s.catFa}</span>
            ${s.badge ? `<span class="badge badge-warn">${s.badge}</span>` : ''}
          </div>
          <h3>${s.title}</h3>
          <div style="font-size:0.76rem;color:#475569;margin-top:0.3rem;">ناوگان مجاز: <strong>${s.equip}</strong></div>
        </div>
        <div style="margin-top:0.75rem;padding-top:0.6rem;border-top:1px solid #e2e8f0;font-size:0.78rem;display:grid;gap:0.22rem;">
          <div style="display:flex;justify-content:space-between;"><span>نرخ پایه:</span><strong>${faToman(s.base)}</strong></div>
          <div style="display:flex;justify-content:space-between;color:#64748b;"><span>اعزام مازاد بر ${faNum(s.freeKm)}km:</span><span>${faToman(s.perKm)}/km</span></div>
          ${s.towKm > 0 ? `<div style="display:flex;justify-content:space-between;color:#0284c7;"><span>نرخ حمل خودرو:</span><span>${faToman(s.towKm)}/km</span></div>` : ''}
          <div style="display:flex;justify-content:space-between;color:#be123c;font-size:0.73rem;"><span>هزینه لغو پس از اعزام:</span><span>${faToman(s.cancelFee)}</span></div>
        </div>
      </article>
    `
    )
    .join('');
}

catalogFilterWrap?.querySelectorAll('button[data-cat]').forEach((btn) => {
  btn.addEventListener('click', () => {
    catalogFilterWrap.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    renderCatalogItems(btn.getAttribute('data-cat') || 'all');
  });
});
renderCatalogItems('all');

// ==================== ۷. اسلاید ۷: ماشین‌حساب زنده فرمول رسمی تعرفه ====================
const calcSvc = document.getElementById('calc-service');
const calcZone = document.getElementById('calc-zone');
const calcVeh = document.getElementById('calc-vehicle');
const calcDispKm = document.getElementById('calc-dispatch-km');
const calcTowKm = document.getElementById('calc-tow-km');
const calcParts = document.getElementById('calc-parts');
const calcNight = document.getElementById('calc-night');
const calcDisc = document.getElementById('calc-discount');
const calcOut = document.getElementById('calc-output');

const VEH_MULT = { domestic: 1.0, suv_heavy: 1.2, foreign: 1.25, electric: 1.35 };

function updatePriceCalc() {
  if (!calcSvc || !calcOut) return;
  const svc = SERVICES_15.find((s) => s.slug === calcSvc.value) || SERVICES_15[0];
  const zMult = Number(calcZone?.value || 1.0);
  const vMult = VEH_MULT[calcVeh?.value] || 1.0;
  const dispKm = Math.max(0, Number(calcDispKm?.value || 0));
  const towKm = svc.towKm > 0 ? Math.max(0, Number(calcTowKm?.value || 0)) : 0;
  const parts = Math.max(0, Math.round(Number(calcParts?.value || 0)));
  const night = Boolean(calcNight?.checked);
  const disc = Boolean(calcDisc?.checked);

  const extraKm = Math.max(0, dispKm - svc.freeKm);
  const dispFee = Math.round(extraKm * svc.perKm);
  const towFee = Math.round(towKm * svc.towKm);
  const raw = svc.base + dispFee + towFee;

  const afterVeh = Math.round(raw * vMult);
  const afterZone = Math.round(afterVeh * zMult);
  const gross = night ? Math.round(afterZone * 1.2) : afterZone;

  const discAmt = disc ? Math.min(Math.round(gross * 0.1), 150000) : 0;
  const netService = Math.max(0, gross - discAmt);
  const tax = Math.round((netService + parts) * 0.1);
  const totalToman = netService + parts + tax;
  const totalRial = totalToman * 10;

  const initEst = netService + Math.round(netService * 0.1);
  const pctInc = initEst > 0 ? Math.round(((totalToman - initEst) / initEst) * 100) : 0;
  const commission = Math.round(netService * 0.15);
  const responderShare = netService - commission + parts;

  calcOut.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.6rem;">
      <strong style="color:#fbbf24;font-size:0.9rem;">ریز صورتحساب رسمی (واحد پایه: تومان)</strong>
      <span class="badge badge-ok">منطبق با هسته سرور</span>
    </div>
    <div class="inv-row"><span>نرخ پایه (${svc.title}):</span><span>${faToman(svc.base)}</span></div>
    <div class="inv-row"><span>اعزام مازاد (${faNum(extraKm)}km مازاد بر ${faNum(svc.freeKm)}km رایگان):</span><span>${faToman(dispFee)}</span></div>
    <div class="inv-row"><span>هزینه حمل یدک‌کش/کفی (${faNum(towKm)}km):</span><span>${faToman(towFee)}</span></div>
    <div class="inv-row"><span>تعدیل خودرو (×${vMult}) و زون قزوین (×${zMult}):</span><span>+ ${faToman(afterZone - raw)}</span></div>
    <div class="inv-row"><span>ضریب شبانه / اضطراری (${night ? '×۱.۲۰' : 'غیرفعال'}):</span><span>+ ${faToman(gross - afterZone)}</span></div>
    <div class="inv-row" style="color:#6ee7b7;"><span>تخفیف کمپین QAZVIN1405:</span><span>- ${faToman(discAmt)}</span></div>
    <div class="inv-row"><span>قطعات مصرفی (بدون اخذ کمیسیون پلتفرم):</span><span>${faToman(parts)}</span></div>
    <div class="inv-row"><span>مالیات بر ارزش افزوده (۱۰٪):</span><span>${faToman(tax)}</span></div>
    <div class="inv-total">
      <span>جمع کل پرداختی مشتری:</span>
      <span>${faToman(totalToman)}</span>
    </div>
    <div class="mono" style="font-size:0.74rem;color:#94a3b8;text-align:left;margin-top:0.2rem;">
      Gateway Payload (tomanToRial): ${totalRial.toLocaleString('en-US')} Rials
    </div>
    <div style="margin-top:0.75rem;padding-top:0.65rem;border-top:1px solid #334155;font-size:0.78rem;display:grid;gap:0.25rem;">
      <div style="display:flex;justify-content:space-between;"><span>درآمد کمیسیون پلتفرم (۱۵٪ اجرت):</span><strong style="color:#fbbf24;">${faToman(commission)}</strong></div>
      <div style="display:flex;justify-content:space-between;"><span>واریزی خالص کیف پول امدادگر:</span><strong style="color:#34d399;">${faToman(responderShare)}</strong></div>
      ${
        pctInc > 10
          ? `<div style="margin-top:0.35rem;background:rgba(245,158,11,0.2);border:1px solid #f59e0b;color:#fde68a;padding:0.45rem 0.6rem;border-radius:0.5rem;">
               ⚠️ افزایش ${faNum(pctInc)}٪ نسبت به پیش‌فاکتور اولیه (بالای ۱۰٪): <strong>تأیید مجدد مشتری در اپ پیش از پرداخت الزامی است.</strong>
             </div>`
          : ''
      }
    </div>
  `;
}

if (calcSvc) {
  SERVICES_15.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.slug;
    opt.textContent = `${s.title} (${faNum(s.base)} تومان)`;
    calcSvc.appendChild(opt);
  });
  [calcSvc, calcZone, calcVeh, calcDispKm, calcTowKm, calcParts, calcNight, calcDisc].forEach(
    (el) => {
      el?.addEventListener('input', updatePriceCalc);
      el?.addEventListener('change', updatePriceCalc);
    }
  );
  updatePriceCalc();
}

// ==================== ۸. اسلاید ۸: شبیه‌ساز اقتصاد واحد (Unit Economics) بیزینس‌پلن ====================
const bpMissionsInput = document.getElementById('bp-daily-missions');
const bpAvgBasketInput = document.getElementById('bp-avg-basket');
const bpCommRateInput = document.getElementById('bp-comm-rate');
const bpFixedCostInput = document.getElementById('bp-fixed-cost');
const bpOutputEl = document.getElementById('bp-financial-output');

function updateBusinessPlanModel() {
  if (!bpMissionsInput || !bpOutputEl) return;
  const dailyMissions = Number(bpMissionsInput.value || 65);
  const avgBasketToman = Number(bpAvgBasketInput?.value || 560000);
  const commPct = Number(bpCommRateInput?.value || 15);
  const fixedMonthlyMillion = Number(bpFixedCostInput?.value || 180);

  const lblMissions = document.getElementById('lbl-bp-missions');
  const lblBasket = document.getElementById('lbl-bp-basket');
  const lblComm = document.getElementById('lbl-bp-comm');
  const lblFixed = document.getElementById('lbl-bp-fixed');

  if (lblMissions) lblMissions.textContent = `${faNum(dailyMissions)} مأموریت در روز`;
  if (lblBasket) lblBasket.textContent = faToman(avgBasketToman);
  if (lblComm) lblComm.textContent = `${faNum(commPct)}٪`;
  if (lblFixed) lblFixed.textContent = `${faNum(fixedMonthlyMillion)} میلیون تومان`;

  const monthlyMissions = dailyMissions * 30;
  const monthlyGmv = monthlyMissions * avgBasketToman;
  const annualGmv = monthlyGmv * 12;

  // هزینه متغیر درگاه/پیامک/پشتیبانی به ازای هر مأموریت (فرضی محافظه‌کارانه ۳٬۵۰۰ تومان)
  const variableCostPerMission = 3500;
  const grossCommissionPerMission = Math.round((avgBasketToman * commPct) / 100);
  const contributionPerMission = Math.max(1, grossCommissionPerMission - variableCostPerMission);

  const monthlyGrossRevenue = monthlyMissions * grossCommissionPerMission;
  const monthlyResponderPayout = monthlyGmv - monthlyGrossRevenue;
  const fixedCostToman = fixedMonthlyMillion * 1_000_000;
  const monthlyVariableCost = monthlyMissions * variableCostPerMission;
  const monthlyNetOperating = monthlyGrossRevenue - fixedCostToman - monthlyVariableCost;

  const breakEvenMonthlyMissions = Math.ceil(fixedCostToman / contributionPerMission);
  const breakEvenDaily = Math.ceil(breakEvenMonthlyMissions / 30);
  const isProfitable = monthlyNetOperating >= 0;

  bpOutputEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.75rem;">
      <strong style="color:#fbbf24;font-size:0.95rem;">خروجی مدل مالی ماهانه و سالانه (استان قزوین)</strong>
      <span class="badge ${isProfitable ? 'badge-ok' : 'badge-warn'}">
        ${isProfitable ? 'عبور از نقطه سربه‌سر عملیاتی ✓' : 'در فاز سرمایه‌گذاری اولیه رُشد'}
      </span>
    </div>
    <div class="inv-row"><span>تعداد مأموریت موفق ماهانه:</span><strong>${faNum(monthlyMissions)} مأموریت</strong></div>
    <div class="inv-row"><span>حجم ناخالص تراکنش ماهانه (Monthly GMV):</span><span>${faToman(monthlyGmv)}</span></div>
    <div class="inv-row"><span>حجم ناخالص تراکنش سالانه (Annualized GMV):</span><span>${faToman(annualGmv)}</span></div>
    <div class="inv-row" style="color:#6ee7b7;"><span>درآمد ناخالص کمیسیون پلتفرم (${faNum(commPct)}٪):</span><strong>${faToman(monthlyGrossRevenue)} / ماه</strong></div>
    <div class="inv-row"><span>پرداختی خالص به شبکه امدادگران قزوین:</span><span>${faToman(monthlyResponderPayout)} / ماه</span></div>
    <div class="inv-row"><span>سهم مشارکت هر مأموریت (پس از کسر پیامک/درگاه):</span><span>${faToman(contributionPerMission)}</span></div>
    <div class="inv-row"><span>نقطه سربه‌سر عملیاتی (Break-Even):</span><strong style="color:#fcd34d;">روزانه ${faNum(breakEvenDaily)} مأموریت</strong></div>
    <div class="inv-total" style="color:${isProfitable ? '#34d399' : '#fca5a5'};border-top-color:${isProfitable ? '#10b981' : '#f43f5e'};">
      <span>تراز عملیاتی ماهانه (EBITDA تخمینی):</span>
      <span>${isProfitable ? '+' : '-'} ${faToman(Math.abs(monthlyNetOperating))}</span>
    </div>
    <div style="margin-top:0.65rem;font-size:0.73rem;color:#94a3b8;line-height:1.6;">
      * شفافیت مدل‌سازی: ارقام فوق شبیه‌سازی تعاملی بر پایه پارامترهای انتخابی شما و نرخ کمیسیون پایه کدبیس است و عملکرد مالی تاریخی تضمین‌شده محسوب نمی‌شود.
    </div>
  `;
}

[bpMissionsInput, bpAvgBasketInput, bpCommRateInput, bpFixedCostInput].forEach((el) => {
  el?.addEventListener('input', updateBusinessPlanModel);
});
updateBusinessPlanModel();

// ==================== ۹. اسلاید ۱۰: کاوشگر ۱۶ دامنه معماری ====================
const domGridEl = document.getElementById('domains-grid');
const domSearchEl = document.getElementById('domain-search');

function renderDomainsList(q = '') {
  if (!domGridEl) return;
  const term = q.trim().toLowerCase();
  const items = DOMAINS_16.filter(
    (d) =>
      !term ||
      d.name.toLowerCase().includes(term) ||
      d.fa.includes(term) ||
      d.tables.toLowerCase().includes(term) ||
      d.desc.includes(term)
  );
  domGridEl.innerHTML = items
    .map(
      (d) => `
      <article class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.35rem;">
          <span class="badge badge-warn">دامنه ${faNum(d.num)}</span>
          <span class="mono" style="font-size:0.7rem;color:#64748b;">${d.name}</span>
        </div>
        <h3>${d.fa}</h3>
        <p style="margin-bottom:0.55rem;">${d.desc}</p>
        <div class="mono" style="font-size:0.7rem;color:#0369a1;border-top:1px solid #e2e8f0;padding-top:0.4rem;">
          ${d.tables}
        </div>
      </article>
    `
    )
    .join('');
}

domSearchEl?.addEventListener('input', (e) => renderDomainsList(e.target.value));
renderDomainsList();
