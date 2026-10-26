import { DATA_STATUS_META, RISKS_11, KPIS_13, SLIDES_META } from './data/slides.js';
import {
  SERVICES_CATALOG_15,
  COST_STRUCTURE_ASSUMPTIONS,
  calculateOfficialQuote,
  computeUnitEconomics,
  computeThreeScenarios12M,
  computeBreakEvenAndSensitivity,
} from './data/financial-model.js';
import {
  faNum,
  faMillion,
  renderForecastTrendSvg,
  renderScenarioBarsSvg,
  renderSensitivityTornadoSvg,
  renderCompetitorMatrixSvg,
  renderAcquisitionFunnelSvg,
  renderRiskMatrixSvg,
} from './components/charts.js';

function faToman(n) {
  return `${faNum(n)} تومان`;
}

// مدیریت ایمن خطای بارگذاری تصاویر احتمالی بدون کرش صفحه
function attachImageFallbacks(root = document) {
  root.querySelectorAll('img[data-fallback]').forEach((img) => {
    img.addEventListener(
      'error',
      () => {
        img.style.display = 'none';
      },
      { once: true }
    );
  });
}

// داده‌های ۷ مرحله سفر کاربر (اسلاید ۷ — سناریوی نمونه بدون داده شخصی واقعی)
const SAMPLE_JOURNEY_7 = [
  {
    step: 1,
    icon: '📱',
    title: '۱. ورود سریع به سامانه',
    state: 'احراز هویت موبایل (پیاده‌سازی‌شده)',
    photo: './assets/step1-mobile-sos.jpg',
    desc: 'کاربر نمونه در حاشیه امن جاده قزوین وارد وب‌اپ موبایل‌محور شده و با شماره تلفن آزمایشی وارد حساب خود می‌شود.',
    guard: 'نرمال‌سازی ارقام فارسی/عربی و صدور نشست امن HttpOnly با هش SHA-256 در سرور.',
  },
  {
    step: 2,
    icon: '🔧',
    title: '۲. انتخاب خودرو و نوع خدمت',
    state: 'کاتالوگ ۱۵ خدمت (پیاده‌سازی‌شده)',
    photo: './assets/step3-onsite-diagnostics.jpg',
    desc: 'کاربر از فهرست خودروهای ثبت‌شده خود (داخلی، وارداتی، شاسی‌بلند یا برقی) و ۱۵ خدمت امدادی، نیاز دقیق را انتخاب می‌کند.',
    guard: 'در صورت انتخاب بازگشایی مجاز در خودرو، تیک تعهد احراز مالکیت و برای یدک‌کش، ثبت مقصد اجباری می‌شود.',
  },
  {
    step: 3,
    icon: '📍',
    title: '۳. ثبت اطلاعات ضروری و موقعیت مکانی',
    state: 'گارد مرزی استان قزوین (پیاده‌سازی‌شده)',
    photo: './assets/step1-mobile-sos.jpg',
    desc: 'نقطه توقف از طریق GPS مرورگر یا پین روی نقشه محدوده قزوین (به همراه نشانی متنی پشتیبان) ثبت می‌گردد.',
    guard: 'متد requireActiveOperationalCoverage مختصات خارج از استان فعال قزوین را با کد HTTP 422 رد می‌کند.',
  },
  {
    step: 4,
    icon: '🧾',
    title: '۴. مشاهده پیش‌فاکتور شفاف و ارسال درخواست',
    state: 'فرمول تومان + Idempotency (پیاده‌سازی‌شده)',
    photo: './assets/hero-qazvin-dispatch.jpg',
    desc: 'پیش از اعزام، ریز هزینه پایه، مسافت، ضریب منطقه/شبانه و تخفیف به «تومان صحیح» نمایش داده و با کلید ضدتکرار ثبت می‌شود.',
    guard: 'ارسال کلید Idempotency-Key مانع ثبت چندباره درخواست در اینترنت ضعیف جاده می‌شود.',
  },
  {
    step: 5,
    icon: '🚐',
    title: '۵. تطبیق هوشمند و تخصیص ارائه‌دهنده',
    state: 'دیسپچ اتمیک BEGIN IMMEDIATE (پیاده‌سازی‌شده)',
    photo: './assets/step2-control-center.jpg',
    desc: 'بهترین امدادگر تأییدشده نزدیک و دارای تجهیزات متناسب پیشنهاد را دریافت و می‌پذیرد؛ مشخصات پلاک ناوگان به کاربر نمایش داده می‌شود.',
    guard: 'شماره تماس مشتری تا پیش از پذیرش مخفی است؛ در نبود امدادگر آزاد، بدون ETA دروغین به اپراتور ارجاع می‌شود.',
  },
  {
    step: 6,
    icon: '⚡',
    title: '۶. انجام خدمت در محل یا حمل ایمن',
    state: 'ردیابی SSE + گیت ۱۰٪ قیمت (پیاده‌سازی‌شده)',
    photo: './assets/step5-ev-specialist.jpg',
    desc: 'کاربر حرکت امدادگر را روی نقشه دنبال می‌کند؛ خدمت فنی یا حمل کفی انجام شده و گزارش پایان کار و قطعات ثبت می‌شود.',
    guard: 'افزایش صورتحساب بیش از ۱۰٪ نسبت به پیش‌فاکتور اولیه، نیازمند تأیید صریح کاربر پیش از پرداخت است.',
  },
  {
    step: 7,
    icon: '⭐',
    title: '۷. پرداخت امن، دریافت فاکتور و ثبت بازخورد',
    state: 'Callback سروری + امتیازدهی (پیاده‌سازی‌شده / درگاه Sandbox)',
    photo: './assets/step6-payment-invoice.jpg',
    desc: 'پرداخت پس از استعلام سمت سرور نهایی شده، فاکتور چاپی صادر می‌گردد و امتیاز ۱ تا ۵ کاربر در رتبه دیسپچ بعدی امدادگر لحاظ می‌شود.',
    guard: 'بلافاصله پس از تکمیل مأموریت، دسترسی امدادگر به شماره تماس و نقطه دقیق کاربر مجدداً سانسور (Redact) می‌شود.',
  },
];

// قالب مشترک هر اسلاید منطبق با الگوی ۵بخشی بخش ۷ پرامپت
function wrapSlide(meta, innerHtml) {
  const st = DATA_STATUS_META[meta.dataStatus] || DATA_STATUS_META.verified;
  return `
    <section id="slide-${meta.order}" data-slide-index="${meta.order - 1}" class="slide-section" aria-label="اسلاید ${faNum(meta.order)}: ${meta.title}">
      <div class="slide-shell">
        <div>
          <div class="slide-header-meta">
            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
              <span class="slide-cat-badge">اسلاید ${faNum(meta.order)} از ۲۶ • ${meta.category}</span>
              <span class="status-pill ${st.badgeClass}">وضعیت داده: ${st.label}</span>
            </div>
            <span class="mono" style="font-size:0.72rem;color:#94A3B8;">#${meta.id}</span>
          </div>
          <h2 class="slide-h1">${meta.title}</h2>
          <p class="slide-lead">${meta.subtitle}</p>
        </div>

        <div class="slide-body">${innerHtml}</div>

        <div>
          <div class="slide-footer-strip">
            <div class="takeaway-box">
              <strong style="color:#22D3EE;">نتیجه مدیریتی:</strong> ${meta.takeaway}
            </div>
            <div class="source-box">
              <strong style="color:#F8FAFC;">منبع / فرض مبنا:</strong> ${meta.source}
            </div>
          </div>
          <aside class="notes-panel" aria-label="یادداشت ارائه‌دهنده اسلاید ${faNum(meta.order)}">
            <strong>🎙 یادداشت ارائه‌دهنده:</strong> ${meta.notes}
          </aside>
        </div>
      </div>
    </section>
  `;
}

// تولید محتوای اختصاصی هر ۲۶ اسلاید
function buildAll26SlidesHtml() {
  const setupTotal = COST_STRUCTURE_ASSUMPTIONS.setupCapexItems.reduce((s, i) => s + i.amountToman, 0);
  const opexTotal = COST_STRUCTURE_ASSUMPTIONS.monthlyOpexItems.reduce((s, i) => s + i.amountToman, 0);

  const bodies = {
    1: `
      <div class="grid-2" style="align-items:center;">
        <div>
          <div style="display:inline-flex;align-items:center;gap:0.5rem;background:rgba(34,211,238,0.1);border:1px solid rgba(34,211,238,0.3);padding:0.35rem 0.8rem;border-radius:999px;font-size:0.78rem;color:#67E8F9;margin-bottom:0.85rem;">
            <span>طرح کسب‌وکار، مدل عملیاتی و نقشه راه توسعه پلتفرم هوشمند خدمات و امداد خودرو در ایران</span>
          </div>
          <p style="font-size:0.92rem;color:#E2E8F0;margin:0 0 1rem;line-height:1.85;">
            ارائه تحلیلی و تعاملی مبتنی بر کدبیس واقعی پروژه <strong>اورژانس خودرو (EMSCar)</strong>؛ طراحی‌شده برای تصمیم‌گیری سرمایه‌گذاران، شرکای عملیاتی ناوگان، شبکه‌های تعمیرگاهی و مدیران اجرایی پیرامون اجرای پایلوت تجاری در <strong>استان قزوین</strong> و توسعه مرحله‌ای در کشور.
          </p>
          <div style="display:flex;flex-wrap:wrap;gap:0.6rem;margin-bottom:1rem;">
            <button type="button" class="btn-cta" data-goto="2">شروع ارائه رسمی ←</button>
            <button type="button" class="btn-secondary" data-goto="15">مشاهده مدل مالی ۳ سناریویی</button>
            <button type="button" class="btn-secondary" id="cover-open-sources">پیوست منابع و مفروضات</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0.55rem;font-size:0.76rem;color:#94A3B8;">
            <div class="card" style="padding:0.65rem;"><strong>تاریخ تهیه ارائه:</strong><br/>آبان ۱۴۰۵ (اکتبر ۲۰۲۶)</div>
            <div class="card" style="padding:0.65rem;"><strong>مرحله فعلی محصول:</strong><br/>هسته نرم‌افزاری پیاده‌سازی‌شده؛ پایلوت در انتظار پیش‌نیازهای تجاری</div>
            <div class="card" style="padding:0.65rem;"><strong>کانون شروع عملیات:</strong><br/>۷ زون فعال استان قزوین</div>
          </div>
        </div>
        <div class="photo-frame" style="position:relative;">
          <img src="./assets/hero-qazvin-dispatch.jpg" data-fallback="1" alt="نمایش مفهومی خدمت امداد خودرو در محورهای جاده‌ای" style="height:300px;" />
          <div style="padding:0.75rem 0.95rem;background:#0E1629;font-size:0.75rem;color:#94A3B8;display:flex;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
            <span>* تصویر نمایشی مفهومی (عدم انتساب به‌عنوان عکس عملیات واقعی شرکت)</span>
            <span id="live-api-pill" class="mono" style="color:#22D3EE;">Static GitHub Pages Ready</span>
          </div>
        </div>
      </div>
    `,

    2: `
      <div class="grid-3">
        <div class="card">
          <span class="status-pill st-verified" style="margin-bottom:0.4rem;">۱. ایده و مسئله محوری</span>
          <h3>پایان دادن به عدم تقارن اطلاعات کنار جاده</h3>
          <p>حذف قیمت‌گذاری توافقی/سلیقه‌ای، سردرگمی ریال و تومان، و ریسک اعزام یدک‌کش فاقد صلاحیت فنی در زمان خرابی اضطراری خودرو.</p>
        </div>
        <div class="card">
          <span class="status-pill st-verified" style="margin-bottom:0.4rem;">۲. راهکار پیاده‌سازی‌شده</span>
          <h3>پلتفرم دیسپچ مکان‌محور و پیش‌فاکتور شفاف</h3>
          <p>محاسبه سیستمی پیش‌فاکتور تومان پیش از ثبت درخواست، تطبیق هوشمند تجهیزات (شامل کفی و گواهی EV)، ردیابی زنده و پرداخت امن سروری.</p>
        </div>
        <div class="card">
          <span class="status-pill st-assumption" style="margin-bottom:0.4rem;">۳. مشتریان و بازار اولیه</span>
          <h3>رانندگان شهری و کریدور آزادراهی قزوین</h3>
          <p>تمرکز فاز اول بر مالکان خودرو در شهر قزوین، الوند، شهر صنعتی البرز، تاکستان، آبیک و محور ترانزیتی قزوین-کرج-زنجان.</p>
        </div>
        <div class="card">
          <span class="status-pill st-verified" style="margin-bottom:0.4rem;">۴. مدل درآمدی اولیه</span>
          <h3>کارمزد تراکنشی شفاف از اجرت خدمت</h3>
          <p>دریافت ۱۵٪ کمیسیون پایه از اجرت خالص خدمات انجام‌شده (قابل پیکربندی در پنل ادمین) بدون اخذ کارمزد مخفی روی قطعات مصرفی.</p>
        </div>
        <div class="card">
          <span class="status-pill st-verified" style="margin-bottom:0.4rem;">۵. وضعیت فعلی پروژه</span>
          <h3>هسته نرم‌افزاری کامل و تست‌شده</h3>
          <p>۱۴ ماژول سطح سرور (پوشش ۱۶ حوزه منطقی)، ۳۵ جدول، کاتالوگ ۱۵ خدمت، رابط‌های ۴ نقش و ۲۱ تست خودکار پاس‌شده در مخزن موجود است؛ این شواهد آمادگی تجاری یا ناوگان واقعی را اثبات نمی‌کنند.</p>
        </div>
        <div class="card">
          <span class="status-pill st-proposed" style="margin-bottom:0.4rem;">۶. مهم‌ترین هدف مرحله بعد</span>
          <h3>اجرای پایلوت ۶ماهه در استان قزوین</h3>
          <p>اخذ مجوزهای بهره‌برداری (اینماد/صنفی)، اتصال کلیدهای تجاری درگاه و پیامک، و جذب ۲۵ تا ۳۵ واحد امدادی احراز صلاحیت‌شده.</p>
        </div>
      </div>
    `,

    3: `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>مشکل شناسایی‌شده</th>
              <th>گروه درگیر</th>
              <th>پیامد اقتصادی و عملیاتی</th>
              <th>شواهد و منطق پشتیبان</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>۱. دشواری یافتن امدادگر قابل اعتماد در لحظه اضطرار</strong></td>
              <td>رانندگان عبوری آزادراه‌ها و خانواده‌ها در شب</td>
              <td>اتلاف زمان در حاشیه پرخطر جاده و تن دادن به یدک‌کش‌های عبوری فاقد هویت ثبت‌شده</td>
              <td>نبود سامانه یکپارچه استعلام پلاک و صلاحیت واحد امدادی برای عموم رانندگان پیش از حضور در صحنه</td>
            </tr>
            <tr>
              <td><strong>۲. ابهام در تعرفه، چانه‌زنی کنار جاده و خطای ریال/تومان</strong></td>
              <td>تمامی مالکان خودروهای شخصی</td>
              <td>دریافت مبالغ توافقی بالاتر از عرف پس از بارگیری خودرو و بروز تنش و نارضایتی</td>
              <td>تعدد تعرفه‌های شفاهی پایه، ورودی شبانه و کیلومتر حمل بدون پیش‌فاکتور کتبی پیش از اعزام</td>
            </tr>
            <tr>
              <td><strong>۳. عدم تناسب تجهیزات ناوگان با فناوری خودروهای جدید</strong></td>
              <td>مالکان خودروهای اتوماتیک، وارداتی، شاسی‌بلند و برقی (EV)</td>
              <td>خسارت سنگین به گیربکس دوکلاچه/اتوماتیک یا سیستم ولتاژ بالای باتری در صورت حمل غیراصولی</td>
              <td>نیاز فنی قطعی خودروهای برقی و تمام‌چرخ‌محرک به کفی هیدرولیک و تکنسین دارای ایمنی ولتاژ بالا</td>
            </tr>
            <tr>
              <td><strong>۴. تأخیر، خطای نشانی در جاده و وعده‌های زمانی غیرواقعی</strong></td>
              <td>رانندگان متوقف در محورهای برون‌شهری و اپراتورها</td>
              <td>نرخ لغو بالا، سوخت هدررفته امدادگر برای یافتن خودرو و سرگردانی طولانی مشتری</td>
              <td>دشواری توصیف تلفنی موقعیت دقیق کیلومتری در بزرگراه‌ها بدون ارسال مختصات GPS</td>
            </tr>
            <tr>
              <td><strong>۵. پراکندگی عرضه و هزینه بالای جذب مشتری برای امدادگران مستقل</strong></td>
              <td>امدادگران مستقل و تعمیرگاه‌های مجاز</td>
              <td>خالی ماندن ظرفیت روزانه ناوگان یا پرداخت سهم سنگین به واسطه‌های تبلیغاتی غیرشفاف</td>
              <td>نبود کانال دیجیتال شفاف که بر اساس نزدیکی مکانی و امتیاز واقعی کیفیت، سفارش ارجاع دهد</td>
            </tr>
          </tbody>
        </table>
      </div>
    `,

    4: `
      <div class="grid-4" style="grid-template-columns:repeat(5,minmax(0,1fr));margin-bottom:0.95rem;">
        <div class="card">
          <div style="color:#22D3EE;font-weight:900;font-size:0.8rem;">گام ۱ ← درخواست کاربر</div>
          <h3 style="margin-top:0.3rem;">انتخاب خدمت و مکان</h3>
          <p>ثبت خودرو، شرح خرابی و نقطه GPS یا نشانی در قزوین.</p>
          <div style="margin-top:0.5rem;"><span class="status-pill st-verified">پیاده‌سازی‌شده</span></div>
        </div>
        <div class="card">
          <div style="color:#22D3EE;font-weight:900;font-size:0.8rem;">گام ۲ ← ثبت و بررسی</div>
          <h3 style="margin-top:0.3rem;">پیش‌فاکتور و گارد مرز</h3>
          <p>بررسی فعال بودن زون قزوین، نمایش تعرفه تومان و ثبت ضدتکرار.</p>
          <div style="margin-top:0.5rem;"><span class="status-pill st-verified">پیاده‌سازی‌شده</span></div>
        </div>
        <div class="card">
          <div style="color:#22D3EE;font-weight:900;font-size:0.8rem;">گام ۳ ← تطبیق هوشمند</div>
          <h3 style="margin-top:0.3rem;">دیسپچ اتمیک ناوگان</h3>
          <p>فیلتر تجهیزات/گواهی EV، امتیازدهی فاصله و پذیرش بدون تداخل.</p>
          <div style="margin-top:0.5rem;"><span class="status-pill st-verified">کد آماده</span> <span class="status-pill st-proposed" style="margin-top:0.25rem;">نیازمند ناوگان</span></div>
        </div>
        <div class="card">
          <div style="color:#22D3EE;font-weight:900;font-size:0.8rem;">گام ۴ ← انجام خدمت</div>
          <h3 style="margin-top:0.3rem;">پایش زنده و گزارش</h3>
          <p>ارسال موقعیت زنده SSE، انجام تعمیر/حمل و ثبت گزارش قطعات.</p>
          <div style="margin-top:0.5rem;"><span class="status-pill st-verified">پیاده‌سازی‌شده</span></div>
        </div>
        <div class="card">
          <div style="color:#22D3EE;font-weight:900;font-size:0.8rem;">گام ۵ ← تأیید و ارزیابی</div>
          <h3 style="margin-top:0.3rem;">پرداخت، فاکتور و امتیاز</h3>
          <p>گیت تأیید افزایش قیمت، پرداخت، تسویه شبا و ثبت امتیاز ۱ تا ۵.</p>
          <div style="margin-top:0.5rem;"><span class="status-pill st-proposed">درگاه در حالت Sandbox</span></div>
        </div>
      </div>
      <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;">
        <div style="font-size:0.82rem;color:#E2E8F0;">
          <strong>تفکیک صادقانه وضعیت راهکار:</strong> موتور نرم‌افزاری هر ۵ مرحله به طور کامل نوشته و تست شده است؛ اما تبدیل حالت آزمایشی (<code class="mono">Sandbox</code>) پیامک و درگاه پرداخت به عملیاتی، مستلزم دریافت مجوزهای تجاری و کلید API واقعی پیش از راه‌اندازی عمومی است.
        </div>
      </div>
    `,

    5: `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>قابلیت موجود در مخزن</th>
              <th>مسئله‌ای که حل می‌کند</th>
              <th>ارزش ملموس برای کاربر / کسب‌وکار</th>
              <th>وضعیت فعلی توسعه</th>
              <th>نیاز تکمیلی برای عملیات واقعی</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>کاتالوگ ۱۵ خدمت و فرمول قیمت تومان</strong></td>
              <td>ابهام قیمت و اشتباه دهگان ریال/تومان</td>
              <td>نمایش پیش‌فاکتور قطعی پیش از اعزام و تبدیل خودکار ریال فقط در مرز درگاه</td>
              <td><span class="status-pill st-verified">کامل و تست‌شده</span></td>
              <td>تطبیق نرخ‌های پایه آزمایشی با تعرفه مصوب صنفی قزوین</td>
            </tr>
            <tr>
              <td><strong>گارد جغرافیایی استان قزوین (۷ زون)</strong></td>
              <td>ثبت سفارش در شهرهای فاقد ناوگان فعال</td>
              <td>مسدودسازی خودکار مناطق غیرفعال (422) و جلوگیری از نارضایتی</td>
              <td><span class="status-pill st-verified">کامل و تست‌شده</span></td>
              <td>ممیزی میدانی مرز دقیق چندضلعی زون‌های آزادراهی</td>
            </tr>
            <tr>
              <td><strong>احراز صلاحیت امدادگر و گواهی EV</strong></td>
              <td>فعالیت افراد تأییدنشده یا فاقد تخصص برقی</td>
              <td>قفل سروری آنلاین‌شدن تا تأیید مدارک و پلاک توسط مدیر ارشد</td>
              <td><span class="status-pill st-verified">کامل و تست‌شده</span></td>
              <td>تدوین پروتکل بازرسی حضوری خودروبرها و مدارک هویتی</td>
            </tr>
            <tr>
              <td><strong>دیسپچ اتمیک و صف پشتیبان اپراتور</strong></td>
              <td>پذیرش هم‌زمان دو امدادگر یا وعده ETA دروغین</td>
              <td>قفل تراکنشی BEGIN IMMEDIATE و ارجاع صادقانه موارد بدون امدادگر به اپراتور</td>
              <td><span class="status-pill st-verified">کامل و تست‌شده</span></td>
              <td>استقرار شیفت انسانی اپراتور مرکز پیام قزوین</td>
            </tr>
            <tr>
              <td><strong>جریان زنده SSE و استعلام کد رهگیری</strong></td>
              <td>بی‌خبری راننده از موقعیت واحد اعزامی</td>
              <td>مشاهده زنده وضعیت بدون نشت اطلاعات شخصی در لینک عمومی رهگیری</td>
              <td><span class="status-pill st-verified">کامل و تست‌شده</span></td>
              <td>تأمین کلید نقشه کاشی برداری تجاری در صورت ترافیک بالا</td>
            </tr>
            <tr>
              <td><strong>پرداخت Sandbox، کیف پول و درخواست تسویه</strong></td>
              <td>تقلب Callback، ادعای واریز/بازپرداخت بدون سند</td>
              <td>Callback با Verify سمت سرور؛ گزارش Sandbox و legacy جداست؛ تسویهٔ زنده دستی و مستند است؛ بازپرداخت واقعی فعلاً مسدود است</td>
              <td><span class="status-pill st-proposed">پرداخت Sandbox؛ بدون انتقال بانکی</span></td>
              <td>آزمون provider واقعی، رویهٔ بانکی و تأیید تجاری؛ کلید به‌تنهایی اتصال را ثابت نمی‌کند</td>
            </tr>
          </tbody>
        </table>
      </div>
    `,

    6: `
      <div class="grid-3">
        <div class="card">
          <span class="status-pill st-verified" style="margin-bottom:0.35rem;">مشتری مستقیم فاز ۱ (B2C)</span>
          <h3>۱. رانندگان شهری و مالکان خودرو در قزوین</h3>
          <p>نیازمند خدمات سریع در محل (باتری، پنچرگیری، دیاگ، سوئیچ) با قیمت شفاف در قزوین، الوند، مهرگان و تاکستان.</p>
        </div>
        <div class="card">
          <span class="status-pill st-verified" style="margin-bottom:0.35rem;">مشتری مستقیم فاز ۱ (B2C)</span>
          <h3>۲. مسافران عبوری کریدور آزادراهی قزوین</h3>
          <p>خانواده‌ها و خودروهای عبوری در محور قزوین-کرج و قزوین-زنجان که هیچ شناخت محلی از یدک‌کش‌های معتبر منطقه ندارند.</p>
        </div>
        <div class="card">
          <span class="status-pill st-proposed" style="margin-bottom:0.35rem;">بخش عرضهٔ هدف پیشنهادی (نه شریکِ تأییدشده)</span>
          <h3>۳. امدادگران مستقل و مالکان خودروبر/کفی</h3>
          <p>فرضیهٔ ارزش پیشنهادی: دریافت درخواست‌های نزدیک و تسویهٔ شفاف؛ نیازمند مصاحبه، توافق واقعی و ارزیابی رویهٔ بانکی است. شریک عملیاتی یا قرارداد تأییدشده‌ای در این متن ادعا نمی‌شود.</p>
        </div>
        <div class="card">
          <span class="status-pill st-proposed" style="margin-bottom:0.35rem;">شریک تجاری پیشنهادی فاز ۲</span>
          <h3>۴. تعمیرگاه‌های تخصصی و نمایندگی‌های مجاز</h3>
          <p>مقصد استاندارد خدمات حمل خودرو (transport-to-repair-shop) و کانال معرفی متقابل مشتریان نیازمند امداد سیار.</p>
        </div>
        <div class="card">
          <span class="status-pill st-proposed" style="margin-bottom:0.35rem;">مشتری سازمانی پیشنهادی فاز ۲ (B2B)</span>
          <h3>۵. شرکت‌ها و کارخانجات شهرک صنعتی البرز</h3>
          <p>قرارداد پوشش امدادی خودروهای مدیران، سرویس‌ها و ناوگان سبک توزیع مستقر در قطب‌های صنعتی استان قزوین.</p>
        </div>
        <div class="card">
          <span class="status-pill st-proposed" style="margin-bottom:0.35rem;">همکار اکوسیستم فاز ۳</span>
          <h3>۶. شرکت‌های بیمه، لیزینگ و تأمین‌کنندگان باتری/قطعه</h3>
          <p>استفاده از فاکتورهای رسمی دیجیتال و گزارش‌های مستند مکانی/تصویری سامانه برای پوشش مکمل خسارت و تأمین قطعه استاندارد.</p>
        </div>
      </div>
    `,

    7: `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem;">
          <span class="status-pill st-assumption">سناریوی نمونه آموزشی — بدون هرگونه داده شخصی یا موقعیت واقعی اشخاص</span>
          <div id="journey-chips" class="chip-group"></div>
        </div>
        <div id="journey-stage" class="grid-2" style="align-items:stretch;"></div>
      </div>
    `,

    8: `
      <div class="grid-2">
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.55rem;">
            <h3>مدل محاسباتی شفاف TAM / SAM / SOM</h3>
            <span class="status-pill st-unknown">آمار رسمی کشوری: نامشخص</span>
          </div>
          <p style="margin-bottom:0.75rem;">
            از آنجا که در مخزن داده رسمی تأییدشده‌ای از تعداد دقیق وقایع امدادی سالانه کشور وجود ندارد، به‌جای درج عدد ساختگی، مدل پارامتریک زیر بر اساس فرمول شفاف ارائه شده است:
          </p>
          <div class="field">
            <label for="mkt-iran-cars"><span>فرض تعداد خودروهای سواری فعال کشور (دستگاه):</span><strong id="lbl-mkt-cars">۱۸٬۰۰۰٬۰۰۰</strong></label>
            <input type="range" id="mkt-iran-cars" min="12000000" max="26000000" step="1000000" value="18000000" />
          </div>
          <div class="field">
            <label for="mkt-incident-rate"><span>فرض نرخ نیاز سالانه هر خودرو به امداد/حمل (بار در سال):</span><strong id="lbl-mkt-inc">۰.۳۵</strong></label>
            <input type="range" id="mkt-incident-rate" min="0.15" max="0.80" step="0.05" value="0.35" />
          </div>
          <div class="field">
            <label for="mkt-qazvin-share"><span>سهم بازار قابل خدمت استان و محور عبوری قزوین از کل (SAM %):</span><strong id="lbl-mkt-qzv">۲.۴٪</strong></label>
            <input type="range" id="mkt-qazvin-share" min="1.0" max="5.0" step="0.2" value="2.4" />
          </div>
          <div class="field">
            <label for="mkt-som-share"><span>سهم هدف قابل دستیابی در پایان سال اول پایلوت از قزوین (SOM %):</span><strong id="lbl-mkt-som">۶.۰٪</strong></label>
            <input type="range" id="mkt-som-share" min="2.0" max="15.0" step="0.5" value="6.0" />
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:0.8rem;">
          <div id="mkt-output" class="card"></div>
          <div class="card">
            <h3>برنامه ۴ مرحله‌ای گردآوری داده واقعی بازار در فاز پایلوت</h3>
            <p>
              ۱) استعلام ترددشمارهای رسمی اداره‌کل راهداری استان قزوین در محورهای قزوین-کرج و قزوین-زنجان؛ ۲) مصاحبه ساخت‌یافته با ۳۰ راننده خودروبر و تعمیرگاه قزوین درباره میانگین تماس روزانه؛ ۳) ثبت نرخ تبدیل واقعی جستجوی محلی در ۳ ماه نخست پایلوت؛ ۴) کالیبراسیون مجدد SOM بر مبنای داده واقعی دیتابیس.
            </p>
          </div>
        </div>
      </div>
    `,

    9: `
      <div class="grid-2" style="align-items:center;">
        <div>${renderCompetitorMatrixSvg()}</div>
        <div class="table-wrap">
          <table style="min-width:520px;">
            <thead>
              <tr>
                <th>معیار ارزیابی کیفی</th>
                <th>امدادهای وابسته به خودروساز</th>
                <th>یدک‌کش‌های تلفنی / سنتی</th>
                <th>پلتفرم‌های آگهی عمومی</th>
                <th>الگوی «اورژانس خودرو»</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><strong>شفافیت پیش‌فاکتور آنلاین</strong></td><td>محدود به ضوابط اشتراک</td><td>توافقی و شفاهی</td><td>ندارد (تماس مستقیم)</td><td>سیستمی به تومان قبل از ثبت</td></tr>
              <tr><td><strong>پوشش چندبرندی + EV</strong></td><td>عمدتاً تک‌برند</td><td>عمومی بدون گواهی EV</td><td>بدون فیلتر تخصصی</td><td>چندبرندی با فیلتر گواهی HV</td></tr>
              <tr><td><strong>اعتبارسنجی و قفل سروری</strong></td><td>سازمانی</td><td>نامشخص برای راننده</td><td>صرفاً درج آگهی</td><td>قفل آنلاین‌شدن تا تأیید مدارک</td></tr>
              <tr><td><strong>ردیابی زنده دیجیتال</strong></td><td>متغیر</td><td>ندارد</td><td>ندارد</td><td>جریان بلادرنگ SSE روی نقشه</td></tr>
              <tr><td><strong>مدل درآمدی</strong></td><td>حق اشتراک سالانه / گارانتی</td><td>سهم تلفنی سنتی</td><td>هزینه نردبان/آگهی</td><td>کمیسیون شفاف از خدمت موفق</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `,

    10: `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>مزیت رقابتی مشخص</th>
              <th>چه تفاوتی ایجاد می‌کند و چرا مهم است؟</th>
              <th>روش اندازه‌گیری عینی</th>
              <th>چگونه رقبا تقلید می‌کنند و چه چیزی آن را پایدار می‌کند؟</th>
              <th>وضعیت</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>۱. پیش‌فاکتور سیستمی تومان + گیت ۱۰٪ تغییر قیمت</strong></td>
              <td>حذف چانه‌زنی کنار جاده و الزام تأیید دیجیتال مشتری در صورت افزایش صورتحساب</td>
              <td>نرخ اختلاف مالی کمتر از ۲٪ در جدول <code class="mono">price_change_logs</code></td>
              <td>فرمول قابل کپی است، اما انضباط مالی شبکه امدادگران پذیرنده این استاندارد به مرور اعتماد برند می‌سازد</td>
              <td><span class="status-pill st-verified">اثبات‌شده در کد</span></td>
            </tr>
            <tr>
              <td><strong>۲. تطبیق اجباری تجهیزات ناوگان و گواهی ولتاژ بالای EV</strong></td>
              <td>جلوگیری از اعزام چرخ‌گیر عادی برای خودروی برقی یا نیازمند کفی هیدرولیک</td>
              <td>صفر شدن خسارت ناشی از حمل نامتناسب در گزارش‌های پشتیبانی</td>
              <td>نیازمند جذب، آموزش و ممیزی واقعی واحدهای تخصصی EV در هر استان است</td>
              <td><span class="status-pill st-verified">قانون فعال دیسپچ</span></td>
            </tr>
            <tr>
              <td><strong>۳. صداقت عملیاتی در ظرفیت و حاکمیت جغرافیایی</strong></td>
              <td>مسدودسازی مناطق غیرفعال و عدم نمایش ETA ساختگی هنگام پر بودن ناوگان</td>
              <td>نرخ لغو ناشی از انتظار کاذب و زمان مداخله اپراتور</td>
              <td>رقبای آگهی‌محور تمایلی به محدودسازی ثبت سفارش ندارند؛ این انضباط نرخ رضایت را بالا می‌برد</td>
              <td><span class="status-pill st-verified">اثبات‌شده در کد</span></td>
            </tr>
            <tr>
              <td><strong>۴. حفاظت پویا از حریم خصوصی مکانی و تلفنی کاربر</strong></td>
              <td>عدم افشای تلفن پیش از پذیرش و سانسور خودکار مجدد اطلاعات پس از اتمام خدمت</td>
              <td>ممیزی خروجی API و صفر بودن شکایت مزاحمت پس از خدمت</td>
              <td>تعبیه‌شده در معماری داده و تست‌های خودکار رگرسیون؛ ایجاد حس امنیت برای خانواده‌ها</td>
              <td><span class="status-pill st-verified">اثبات‌شده در کد</span></td>
            </tr>
            <tr>
              <td><strong>۵. اثر شبکه‌ای متراکم محلی در کریدور صنعتی-ترانزیتی قزوین</strong></td>
              <td>کاهش فاصله اعزام خالی امدادگر و افزایش درآمد ساعتی ناوگان بومی</td>
              <td>میانگین کیلومتر اعزام خالی (Deadhead km) در ۷ زون قزوین</td>
              <td>مزیت فرضیه کسب‌وکار که با رسیدن به تراکم ۲۵+ واحد فعال در قزوین سد ورود محلی می‌سازد</td>
              <td><span class="status-pill st-assumption">فرضیه کسب‌وکار</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    `,

    11: `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>جریان درآمدی</th>
              <th>پرداخت‌کننده</th>
              <th>ارزش دریافتی</th>
              <th>زمان شناسایی درآمد</th>
              <th>هزینه‌های مستقیم وابسته</th>
              <th>وابستگی مقیاس و وضعیت در محصول</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>۱. کارمزد از خدمات انجام‌شده (اصلی)</strong></td>
              <td>کسر شفاف از اجرت خدمت پرداختی مشتری (پیش‌فرض ۱۵٪)</td>
              <td>جذب مشتری، دیسپچ مکان‌محور، تضمین پرداخت و صدور فاکتور</td>
              <td>پس از تکمیل خدمت و تأیید سروری پرداخت</td>
              <td>کارمزد شاپرک/تسویه شبا، پیامک‌های عملیاتی و پشتیبانی</td>
              <td>وابسته به حجم سفارش موفق — <span class="status-pill st-verified">فعال در کد</span></td>
            </tr>
            <tr>
              <td><strong>۲. فوق‌العاده خدمات فوری / شبانه</strong></td>
              <td>مشتری متقاضی خدمت در ساعات ۲۲ تا ۰۶ یا اولویت فوری</td>
              <td>تأمین پایدار کشیک شبانه در محورهای جاده‌ای قزوین</td>
              <td>هم‌زمان با تسویه صورتحساب مأموریت</td>
              <td>سهم تشویقی ۸۵٪ امدادگر کشیک شب و شیفت شب مرکز پیام</td>
              <td>وابسته به حجم تراکنش شبانه — <span class="status-pill st-verified">فعال در فرمول</span></td>
            </tr>
            <tr>
              <td><strong>۳. قرارداد سازمانی و ناوگانی (B2B)</strong></td>
              <td>شرکت‌ها و واحدهای صنعتی (شهرک صنعتی البرز و کاسپین)</td>
              <td>پوشش اولویت‌دار خودروهای سازمانی، داشبورد تجمیعی و فاکتور رسمی</td>
              <td>اشتراک فصلی/سالانه + تسویه دوره‌ای خدمات</td>
              <td>تیم فروش سازمانی و حسابداری قراردادها</td>
              <td>وابسته به تعداد خودروهای تحت پوشش — <span class="status-pill st-proposed">پیشنهادی فاز ۲</span></td>
            </tr>
            <tr>
              <td><strong>۴. کارمزد معرفی شفاف به تعمیرگاه‌های همکار</strong></td>
              <td>تعمیرگاه‌های مجاز منتخب مقصد حمل خودرو</td>
              <td>ارجاع هدفمند خودروهای نیازمند تعمیرات سنگین کارگاهی</td>
              <td>پس از پذیرش خودرو در تعمیرگاه همکار با رضایت مشتری</td>
              <td>ممیزی دوره‌ای کیفیت و نرخ‌نامه تعمیرگاه همکار</td>
              <td>وابسته به حجم خدمات حمل — <span class="status-pill st-proposed">پیشنهادی فاز ۲</span></td>
            </tr>
            <tr>
              <td><strong>۵. اشتراک حرفه‌ای ابزاری ارائه‌دهندگان</strong></td>
              <td>ناوگان‌های بزرگ خودروبری و مراکز خدمات سیار</td>
              <td>ابزار مدیریت ناوگان، گزارش‌های تحلیلی عملکرد و تسویه آنی</td>
              <td>ماهانه (صرفاً پس از تثبیت تقاضای پایلوت)</td>
              <td>توسعه پنل مدیریت پیمانکاران چندخودرویی</td>
              <td>وابسته به تعداد عرضه‌کنندگان — <span class="status-pill st-proposed">پیشنهادی فاز ۳</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    `,

    12: `
      <div class="grid-2">
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
            <h3>شبیه‌ساز رسمی فرمول قیمت‌گذاری</h3>
            <span class="status-pill st-assumption">نرخ پایه کاتالوگ: فرضیه اولیه</span>
          </div>
          <div class="grid-2" style="gap:0.65rem;">
            <div class="field">
              <label for="prc-service">خدمت امدادی (۱۵ خدمت):</label>
              <select id="prc-service"></select>
            </div>
            <div class="field">
              <label for="prc-zone">محدوده در استان قزوین:</label>
              <select id="prc-zone">
                <option value="1.00">شهر قزوین مرکزی (×۱.۰۰)</option>
                <option value="1.05">الوند، شهر صنعتی، تاکستان، آبیک (×۱.۰۵)</option>
                <option value="1.10">بوئین‌زهرا و محور جنوب (×۱.۱۰)</option>
                <option value="1.15">آزادراه قزوین-کرج / قزوین-زنجان (×۱.۱۵)</option>
              </select>
            </div>
          </div>
          <div class="grid-2" style="gap:0.65rem;">
            <div class="field">
              <label for="prc-vehicle">رده خودرو:</label>
              <select id="prc-vehicle">
                <option value="domestic">سواری داخلی (×۱.۰۰)</option>
                <option value="suv_heavy">شاسی‌بلند / وانت (×۱.۲۰)</option>
                <option value="foreign">وارداتی / خارجی (×۱.۲۵)</option>
                <option value="electric">برقی / هیبریدی EV (×۱.۳۵)</option>
              </select>
            </div>
            <div class="field">
              <label for="prc-disp-km">مسافت اعزام امدادگر (km):</label>
              <input type="number" id="prc-disp-km" min="0" max="120" value="8" />
            </div>
          </div>
          <div class="grid-2" style="gap:0.65rem;">
            <div class="field">
              <label for="prc-tow-km">مسافت حمل به مقصد (km):</label>
              <input type="number" id="prc-tow-km" min="0" max="300" value="10" />
            </div>
            <div class="field">
              <label for="prc-parts">قطعات مصرفی واقعی (تومان):</label>
              <input type="number" id="prc-parts" min="0" step="50000" value="0" />
            </div>
          </div>
          <div style="display:flex;gap:1rem;flex-wrap:wrap;font-size:0.78rem;margin-top:0.2rem;">
            <label style="display:flex;align-items:center;gap:0.35rem;cursor:pointer;"><input type="checkbox" id="prc-night" /> شرایط شبانه / فوری (×۱.۲۰)</label>
            <label style="display:flex;align-items:center;gap:0.35rem;cursor:pointer;color:#86EFAC;"><input type="checkbox" id="prc-disc" checked /> کد تخفیف آزمایشی QAZVIN1405</label>
          </div>
        </div>

        <div id="prc-result-card" class="card"></div>
      </div>
    `,

    13: `
      <div class="grid-2">
        <div class="card">
          <h3>پارامترهای قابل تنظیم اقتصاد واحد (فرضیه برنامه‌ریزی)</h3>
          <div class="field">
            <label for="ue-aov"><span>متوسط مبلغ اجرت هر سفارش (بدون قطعه):</span><strong id="lbl-ue-aov">۵۴۰٬۰۰۰ تومان</strong></label>
            <input type="range" id="ue-aov" min="300000" max="1000000" step="20000" value="540000" />
          </div>
          <div class="field">
            <label for="ue-comm"><span>نرخ کارمزد پلتفرم از اجرت خدمت:</span><strong id="lbl-ue-comm">۱۵٪</strong></label>
            <input type="range" id="ue-comm" min="10" max="22" step="1" value="15" />
          </div>
          <div class="field">
            <label for="ue-var"><span>هزینه مستقیم متغیر هر سفارش (پیامک، درگاه، تسویه):</span><strong id="lbl-ue-var">۱۴٬۵۰۰ تومان</strong></label>
            <input type="range" id="ue-var" min="6000" max="35000" step="1500" value="14500" />
          </div>
          <div class="field">
            <label for="ue-mkt"><span>بودجه جذب مشتری ماهانه ÷ مشتریان جدید:</span><strong id="lbl-ue-cac-in">۳۸ م.ت / ۲۴۰ نفر</strong></label>
            <input type="range" id="ue-new-cust" min="100" max="600" step="20" value="240" />
          </div>
          <div class="field">
            <label for="ue-repeat"><span>تعداد سفارش هر مشتری در طول عمر فعالیت (بار):</span><strong id="lbl-ue-rep">۳.۶ سفارش</strong></label>
            <input type="range" id="ue-repeat" min="1.2" max="6.0" step="0.2" value="3.6" />
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:0.75rem;">
          <div id="ue-output" class="card"></div>
          <div class="card" style="font-size:0.77rem;">
            <strong style="color:#22D3EE;">شفافیت فرمول‌های علمی اقتصاد واحد:</strong><br/>
            • <strong>سود ناخالص هر سفارش پلتفرم</strong> = (متوسط اجرت سفارش × نرخ کمیسیون) − هزینه مستقیم متغیر همان سفارش<br/>
            • <strong>هزینه جذب مشتری (CAC)</strong> = کل هزینه بازاریابی جذب دوره ÷ تعداد مشتریان بار اول جذب‌شده<br/>
            • <strong>ارزش طول عمر مشتری (LTV)</strong> = سود ناخالص سهم پلتفرم در هر سفارش × میانگین کل دفعات سفارش در دوره ماندگاری (محاسبه‌شده از حاشیه سود واقعی، نه فروش ناخالص!)
          </div>
        </div>
      </div>
    `,

    14: `
      <div class="grid-2">
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.55rem;">
            <h3>الف) هزینه‌های یک‌باره راه‌اندازی (Setup / CapEx)</h3>
            <span class="status-pill st-assumption">جمع: ${faToman(setupTotal)}</span>
          </div>
          <p style="margin-bottom:0.65rem;">مبنای برآورد: آبان ۱۴۰۵ — معادل ریالی کل راه‌اندازی: <span class="mono">${(setupTotal * 10).toLocaleString('en-US')} Rials</span></p>
          ${COST_STRUCTURE_ASSUMPTIONS.setupCapexItems
            .map(
              (item) => `
              <div class="ledger-row">
                <span><strong>[${item.category}]</strong> ${item.title}</span>
                <span>${faToman(item.amountToman)}</span>
              </div>
            `
            )
            .join('')}
        </div>

        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.55rem;">
            <h3>ب) هزینه‌های جاری ماهانه پایلوت قزوین (OpEx)</h3>
            <span class="status-pill st-assumption">جمع: ${faToman(opexTotal)} / ماه</span>
          </div>
          <p style="margin-bottom:0.65rem;">معادل ریالی جاری ماهانه: <span class="mono">${(opexTotal * 10).toLocaleString('en-US')} Rials</span> (بدون هزینه‌های متغیر تراکنشی)</p>
          ${COST_STRUCTURE_ASSUMPTIONS.monthlyOpexItems
            .map(
              (item) => `
              <div style="margin-bottom:0.55rem;">
                <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:0.2rem;">
                  <span>${item.title}</span>
                  <strong>${faToman(item.amountToman)} (${faNum(item.sharePct)}٪)</strong>
                </div>
                <div style="height:7px;background:#0B1020;border-radius:99px;overflow:hidden;">
                  <div style="width:${item.sharePct}%;height:100%;background:linear-gradient(90deg,#22D3EE,#22C55E);"></div>
                </div>
              </div>
            `
            )
            .join('')}
        </div>
      </div>
    `,

    15: `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.6rem;margin-bottom:0.75rem;">
          <div id="fc-scenario-btns" class="chip-group">
            <button type="button" class="chip-btn" data-sc="conservative">۱. محافظه‌کارانه</button>
            <button type="button" class="chip-btn active" data-sc="base">۲. سناریوی پایه</button>
            <button type="button" class="chip-btn" data-sc="growth">۳. رشد سریع</button>
          </div>
          <span class="status-pill st-assumption">⚠️ سناریوی آزمایشی مبتنی بر مفروضات؛ نه عملکرد واقعی</span>
        </div>

        <div class="grid-2" style="margin-bottom:0.85rem;">
          <div class="card">
            <div class="grid-2" style="gap:0.6rem;margin-bottom:0.4rem;">
              <div class="field" style="margin:0;">
                <label for="fc-aov"><span>فرض متوسط اجرت سفارش:</span><strong id="lbl-fc-aov">۵۴۰٬۰۰۰ ت</strong></label>
                <input type="range" id="fc-aov" min="360000" max="900000" step="20000" value="540000" />
              </div>
              <div class="field" style="margin:0;">
                <label for="fc-fixed"><span>فرض هزینه ثابت ماهانه پایه:</span><strong id="lbl-fc-fixed">۱۹۵ م.ت</strong></label>
                <input type="range" id="fc-fixed" min="120000000" max="320000000" step="15000000" value="195000000" />
              </div>
            </div>
            <div id="fc-trend-chart"></div>
          </div>

          <div class="card">
            <div id="fc-compare-chart"></div>
            <div id="fc-summary-metrics" class="metric-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:0.55rem;"></div>
          </div>
        </div>

        <div id="fc-table-wrap" class="table-wrap"></div>
      </div>
    `,

    16: `
      <div class="grid-2">
        <div class="card">
          <h3>پارامترهای ماه نمونه جهت آزمون نقطه سربه‌سر و حساسیت</h3>
          <div class="field">
            <label for="sens-req"><span>حجم درخواست‌های ماهانه:</span><strong id="lbl-sens-req">۳٬۸۰۰ درخواست</strong></label>
            <input type="range" id="sens-req" min="1500" max="7000" step="250" value="3800" />
          </div>
          <div class="field">
            <label for="sens-cancel"><span>نرخ کل لغو و عدم تبدیل درخواست:</span><strong id="lbl-sens-cancel">۳۲٪</strong></label>
            <input type="range" id="sens-cancel" min="15" max="55" step="2" value="32" />
          </div>
          <div id="sens-kpi-strip" class="metric-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:0.75rem;"></div>
          <p style="margin-top:0.75rem;font-size:0.78rem;">
            فرمول نقطه سربه‌سر ماهانه = <code class="mono">کل هزینه‌های ثابت ماهانه ÷ سود ناخالص سهم پلتفرم از هر سفارش</code>. نتایج تحلیلی مشروط به تحقق مفروضات ورودی هستند.
          </p>
        </div>

        <div class="card">
          <h3>نمودار تورنادو حساسیت سود عملیاتی ماهانه (±۲۰٪ تغییر هر متغیر)</h3>
          <div id="sens-tornado-wrap"></div>
        </div>
      </div>
    `,

    17: `
      <div class="grid-2" style="align-items:center;">
        <div>
          <div class="card" style="margin-bottom:0.8rem;">
            <h3>۵ گام اجرایی ورود کنترل‌شده به بازار</h3>
            <ol style="margin:0.4rem 0 0;padding-right:1.15rem;font-size:0.8rem;color:#CBD5E1;display:grid;gap:0.3rem;">
              <li><strong>انتخاب محدوده آزمون محدود:</strong> شروع انحصاری در ۷ زون استان قزوین (قفل‌شده در گارد سرور).</li>
              <li><strong>جذب عرضه‌کنندگان معتبر اولیه:</strong> عقد قرارداد با ۲۵ تا ۳۵ واحد خودروبر، وانت امداد و متخصص EV در قزوین و الوند.</li>
              <li><strong>اجرای آزمایشی با رضایت آگاهانه:</strong> شروع با گروه محدود مشتریان محلی و شفافیت کامل وضعیت پایلوت.</li>
              <li><strong>اندازه‌گیری و اصلاح:</strong> پایش زمان تخصیص، نرخ لغو و کالیبراسیون ضرایب زون‌ها از روی لاگ دیتابیس.</li>
              <li><strong>توسعه تدریجی مشروط:</strong> فعال‌سازی استان البرز یا زنجان توسط Super Admin تنها پس از ثبات KPIهای قزوین.</li>
            </ol>
          </div>
          <div>${renderAcquisitionFunnelSvg(68)}</div>
        </div>

        <div class="table-wrap">
          <table style="min-width:500px;">
            <thead>
              <tr>
                <th>کانال جذب مشتری</th>
                <th>سطح هزینه</th>
                <th>قابلیت سنجش</th>
                <th>تناسب با نیاز فوری امداد</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><strong>۱. سئو محلی و جستجوی فوری موبایل</strong></td><td>کم تا متوسط</td><td>بسیار دقیق (UTM)</td><td>بسیار بالا (لحظه خرابی در جاده)</td></tr>
              <tr><td><strong>۲. همکاری با تعمیرگاه‌های معتبر قزوین</strong></td><td>کم (مشارکتی)</td><td>کد معرف اختصاصی</td><td>بسیار بالا (ارجاع متقابل حمل)</td></tr>
              <tr><td><strong>۳. قرارداد B2B شهرک صنعتی البرز/کاسپین</strong></td><td>متوسط (فروش حضوری)</td><td>قرارداد مستقیم</td><td>بالا (تقاضای تکرارشونده سازمانی)</td></tr>
              <tr><td><strong>۴. تابلوها و اطلاع‌رسانی مجاز استراحتگاه‌های بین‌راهی</strong></td><td>متوسط</td><td>کد تخفیف منطقه‌ای</td><td>مناسب برای مسافران عبوری آزادراه</td></tr>
              <tr><td><strong>۵. معرفی توسط مشتریان راضی قبلی</strong></td><td>بسیار کم</td><td>کد دعوت سیستمی</td><td>بالا در میان ساکنان بومی استان</td></tr>
              <tr><td><strong>۶. تبلیغات کلیکی هدفمند مکانی</strong></td><td>نسبتاً بالا</td><td>دقیق (CAC لحظه‌ای)</td><td>مناسب صرفاً در ساعات پوشش کامل ناوگان</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `,

    18: `
      <div>
        <div class="grid-3" style="margin-bottom:0.9rem;">
          <div class="card" style="border-top:3px solid #22D3EE;">
            <h3>۱. زمان هدف طراحی (Design Target)</h3>
            <p>هدف داخلی مهندسی و عملیات برای تخصیص ناوگان (مثلاً زیر ۴ دقیقه در شهر قزوین)؛ معیار بهینه‌سازی سیستم است، نه وعده به مشتری.</p>
          </div>
          <div class="card" style="border-top:3px solid #22C55E;">
            <h3>۲. زمان اندازه‌گیری‌شده (Measured Actual)</h3>
            <p>فاصله زمانی واقعی ثبت‌شده بین تایم‌استمپ‌های <code class="mono">request_state_history</code> در دیتابیس جهت گزارش‌گیری صادقانه.</p>
          </div>
          <div class="card" style="border-top:3px solid #F59E0B;">
            <h3>۳. تعهد قراردادی (Contractual SLA)</h3>
            <p>بدون استقرار کامل ناوگان و در شرایط متغیر جوی/ترافیکی، سامانه هیچ تضمین زمانی غیرواقعی نمی‌دهد و در نبود امدادگر به اپراتور ارجاع می‌دهد.</p>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <h3>فرآیندهای کنترلی پیش و حین مأموریت</h3>
            <p>
              • <strong>احراز صلاحیت امدادگر:</strong> بررسی مدارک، پلاک، شبا و گواهی EV پیش از تغییر وضعیت به <code class="mono">approved</code>.<br/>
              • <strong>مدیریت پوشش:</strong> کنترل شعاع و زون فعال قزوین در سرور.<br/>
              • <strong>قوانین شفاف لغو:</strong> لغو رایگان پیش از حرکت امدادگر (<code class="mono">Accepted</code>) و هزینه مصوب ایاب‌وذهاب پس از شروع حرکت (<code class="mono">EnRoute</code>).
            </p>
          </div>
          <div class="card">
            <h3>رسیدگی به شکایات، ارزیابی کیفیت و حریم خصوصی</h3>
            <p>
              • <strong>حل اختلاف:</strong> انتقال پرونده به وضعیت <code class="mono">UnderSupportReview</code> و ثبت یادداشت محرمانه؛ بازپرداخت واقعی در نسخه فعلی مسدود است تا اتصال و آزمون provider انجام شود.<br/>
              • <strong>ثبت رخدادها:</strong> ثبت تغییرناپذیر کلیه تصمیمات در <code class="mono">audit_logs</code> و <code class="mono">security_events</code>.
            </p>
          </div>
        </div>
      </div>
    `,

    19: `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>لایه / جزء سیستم</th>
              <th>معماری فعلی موجود در کدبیس (تأییدشده)</th>
              <th>معماری هدف مقیاس ملی (پیشنهاد توسعه فاز ۴)</th>
              <th>وضعیت عملیاتی</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><strong>رابط کاربری وب و موبایل</strong></td><td>React 18 + Vite 8 + Tailwind 4 واکنش‌گرا و RTL</td><td>افزودن اپلیکیشن بومی امدادگر با کش آفلاین نقاط کور جاده</td><td><span class="status-pill st-verified">فعلی آماده</span></td></tr>
            <tr><td><strong>مدیریت کاربران و دسترسی</strong></td><td>نشست سروری، کوکی HttpOnly، هش scrypt و ۴ نقش RBAC</td><td>ورود دومرحله‌ای پیامکی (OTP) پس از اتصال پنل تجاری</td><td><span class="status-pill st-verified">فعلی آماده</span></td></tr>
            <tr><td><strong>پایگاه‌داده و تراکنش‌ها</strong></td><td>SQLite بومی Node 22 در حالت WAL با ۳۵ جدول و مهاجرت برگشت‌پذیر</td><td>مهاجرت به کلاستر PostgreSQL + افزونه مکانی PostGIS</td><td><span class="status-pill st-verified">تک‌سروره آماده</span></td></tr>
            <tr><td><strong>دیسپچ و موقعیت مکانی</strong></td><td>فرمول Haversine، امتیازدهی چندمعیاره و جریان زنده SSE حافظه</td><td>گذرگاه توزیع‌شده Redis Pub/Sub و مسیریابی ترافیکی جاده‌ای</td><td><span class="status-pill st-verified">پایلوت آماده</span></td></tr>
            <tr><td><strong>درگاه پرداخت و تسویه</strong></td><td>Verify سمت سرور؛ Sandbox شبیه‌سازی؛ تسویه دستیِ نیازمند مرجع واقعی و تأیید مدیر؛ Refund زنده مسدود</td><td>اتصال تجاریِ آزموده‌شده و web-service بانکیِ تأییدشده</td><td><span class="status-pill st-proposed">اتصال زنده/واریز خودکار تأیید نشده</span></td></tr>
            <tr><td><strong>اعلان‌ها و پیامک</strong></td><td>آداپتور کاوه‌نگار + صف Sandbox Outbox با تلاش مجدد خطا</td><td>خط خدماتی اختصاصی پیامک با اولویت بالا</td><td><span class="status-pill st-proposed">نیازمند کلید تجاری</span></td></tr>
            <tr><td><strong>پایش سلامت و ثبت خطا</strong></td><td>مسیر <code class="mono">/api/health</code>، بکاپ <code class="mono">VACUUM INTO</code> و جداول ممیزی</td><td>پایش متمرکز Prometheus / Sentry و بکاپ خودکار خارج از سرور</td><td><span class="status-pill st-proposed">ارتقای عملیاتی</span></td></tr>
          </tbody>
        </table>
      </div>
    `,

    20: `
      <div class="grid-2">
        <div class="card">
          <span class="status-pill st-verified" style="margin-bottom:0.45rem;">الف) کنترل‌های فنی پیاده‌سازی‌شده در کد سرور</span>
          <h3>امنیت اطلاعات، پرداخت و حریم خصوصی مکانی</h3>
          <ul style="margin:0.4rem 0 0;padding-right:1.1rem;font-size:0.8rem;color:#CBD5E1;display:grid;gap:0.32rem;">
            <li>هش گذرواژه‌ها با <code class="mono">scrypt</code> تصادفی و مقایسه زمان‌ثابت + هش <code class="mono">SHA-256</code> توکن نشست‌ها.</li>
            <li>کنترل مالکیت رکوردها در سرور (ضد IDOR) و ذخیره فایل‌های مدرک/خودرو در مسیر خصوصی خارج از وب عمومی.</li>
            <li>مخفی بودن تلفن مشتری پیش از پذیرش و سانسور خودکار مجدد اطلاعات تماس و مکان پس از پایان خدمت.</li>
            <li>عدم اعتماد به پارامتر مرورگر در پرداخت؛ استعلام مستقیم سمت سرور و قفل محیط Production در <code class="mono">env.ts</code>.</li>
          </ul>
        </div>

        <div class="card" style="border-color:rgba(245,158,11,0.45);">
          <span class="status-pill st-assumption" style="margin-bottom:0.45rem;">ب) الزامات حقوقی و صنفی نیازمند بررسی وکیل متخصص</span>
          <h3>پیش‌نیازهای قانونی بهره‌برداری در ایران</h3>
          <ul style="margin:0.4rem 0 0;padding-right:1.1rem;font-size:0.8rem;color:#FEF3C7;display:grid;gap:0.32rem;">
            <li><strong>مجوزهای تجارت الکترونیکی:</strong> اخذ اینماد و درگاه پرداخت رسمی مطابق قانون تجارت الکترونیکی ایران.</li>
            <li><strong>مجوزهای صنفی و راهداری:</strong> بررسی الزامات اتحادیه صنفی مرتبط، پلیس راهور و سازمان راهداری برای فعالیت امداد برون‌شهری قزوین.</li>
            <li><strong>قرارداد و بیمه مسئولیت:</strong> تنظیم قرارداد حقوقی شفاف با امدادگران مستقل، حدود مسئولیت خسارت حین حمل و الزام بیمه‌نامه مسئولیت حرفه‌ای.</li>
            <li><strong>مالیات و علامت تجاری:</strong> تطبیق صورتحساب با سامانه مؤدیان و استعلام ثبت برند پیش از استفاده تجاری از نام‌ها. <em>(موارد فوق مشاوره حقوقی قطعی نیستند)</em>.</li>
          </ul>
        </div>
      </div>
    `,

    21: `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>فاز نقشه راه</th>
              <th>مدت تخمینی</th>
              <th>خروجی کلیدی مورد انتظار</th>
              <th>مسئول و منابع</th>
              <th>شاخص عبور به مرحله بعد (Stage-Gate)</th>
              <th>ریسک اصلی فاز</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>فاز ۱: تکمیل فنی و آماده‌سازی قانونی</strong></td>
              <td>۱ تا ۲ ماه (تخمینی)</td>
              <td>نهایی‌سازی مجوزها/اینماد، اتصال درگاه و پیامک واقعی و استقرار سرور امن</td>
              <td>معمار فنی + مشاور حقوقی</td>
              <td>تراکنش واقعی آزمایشی موفق + تأیید چک‌لیست حقوقی و امنیتی</td>
              <td>طولانی شدن فرآیند اداری دریافت مجوزها</td>
            </tr>
            <tr>
              <td><strong>فاز ۲: اجرای پایلوت محدود در قزوین</strong></td>
              <td>۳ تا ۴ ماه (تخمینی)</td>
              <td>جذب ۲۵ تا ۳۵ واحد امدادی تأییدشده و پوشش عملیاتی ۷ زون استان قزوین</td>
              <td>مدیر عملیات قزوین + تیم پشتیبانی</td>
              <td>نرخ تبدیل بالای ۶۰٪، میانگین رضایت ≥ ۴.۵ و صفر بودن شکایت حل‌نشده</td>
              <td>کمبود ناوگان آن‌کال در شیفت‌های شبانه آزادراه</td>
            </tr>
            <tr>
              <td><strong>فاز ۳: بهینه‌سازی مدل اقتصادی و B2B</strong></td>
              <td>۳ تا ۴ ماه (تخمینی)</td>
              <td>قرارداد با شهرک صنعتی البرز و تعمیرگاه‌های منتخب، بهبود LTV/CAC</td>
              <td>تیم رشد، فروش B2B و محصول</td>
              <td>رسیدن به نقطه سربه‌سر عملیاتی ماهانه در استان قزوین (LTV/CAC ≥ 3)</td>
              <td>افزایش هزینه جذب در کانال‌های تبلیغاتی عمومی</td>
            </tr>
            <tr>
              <td><strong>فاز ۴: توسعه منطقه‌ای کنترل‌شده</strong></td>
              <td>مستمر از ماه ۱۰+ (تخمینی)</td>
              <td>مهاجرت داده به PostgreSQL/PostGIS و فعال‌سازی مرحله‌ای البرز و زنجان</td>
              <td>مدیریت ارشد + تیم زیرساخت و عملیات</td>
              <td>احراز ظرفیت حداقل ناوگان بومی هر استان جدید پیش از مصوبه Super Admin</td>
              <td>پراکندگی عملیاتی پیش از بلوغ تیم پشتیبانی</td>
            </tr>
          </tbody>
        </table>
      </div>
    `,

    22: `
      <div class="grid-2">
        <div class="card">
          <span class="status-pill st-proposed" style="margin-bottom:0.45rem;">الف) نقش‌های هسته ضروری درون‌سازمانی (Core Team)</span>
          <h3>تمرکز بر عملیات، کیفیت ناوگان و پایداری محصول</h3>
          <ul style="margin:0.45rem 0 0;padding-right:1.1rem;font-size:0.81rem;color:#E2E8F0;display:grid;gap:0.4rem;">
            <li><strong>مدیریت محصول و کسب‌وکار:</strong> هدایت پایلوت قزوین، پایش KPIها و توسعه شراکت‌های استراتژیک.</li>
            <li><strong>مهندس ارشد نرم‌افزار و زیرساخت:</strong> نگهداری ۱۴ ماژول سطح سرور و ۱۶ حوزه منطقی، امنیت، پایش و اتصال سرویس‌های بیرونی.</li>
            <li><strong>مسئول عملیات میدانی و ناوگان قزوین:</strong> جذب، بازرسی فنی/مدارک خودروبرها و کنترل کیفیت استاندارد خدمات.</li>
            <li><strong>اپراتورهای مرکز پیام و پشتیبانی:</strong> پوشش شیفت‌های عملیاتی برای مدیریت موارد ارجاعی (<code class="mono">operator_escalation</code>) و حل اختلاف.</li>
          </ul>
        </div>

        <div class="card">
          <span class="status-pill st-proposed" style="margin-bottom:0.45rem;">ب) نقش‌های قابل برون‌سپاری یا پاره‌وقت در فاز پایلوت</span>
          <h3>کنترل هوشمند هزینه ثابت تا زمان اثبات اقتصاد واحد</h3>
          <ul style="margin:0.45rem 0 0;padding-right:1.1rem;font-size:0.81rem;color:#CBD5E1;display:grid;gap:0.4rem;">
            <li><strong>امور حقوقی و قراردادها:</strong> استفاده از مشاور حقوقی تخصصی به‌صورت پروژه‌ای برای قراردادهای ناوگان، B2B و مجوزها.</li>
            <li><strong>حسابداری رسمی و امور مالیاتی:</strong> برون‌سپاری به مؤسسه حسابداری معتبر جهت تطبیق دفترکل سامانه با سامانه مؤدیان.</li>
            <li><strong>تولید محتوا، سئو محلی و اجرای کمپین:</strong> همکاری نتیجه‌محور با متخصص مارکتینگ دیجیتال با نظارت مستقیم مدیر محصول.</li>
          </ul>
          <p style="margin-top:0.65rem;font-size:0.75rem;color:#94A3B8;">
            * تعداد دقیق نفرات شیفت و ارقام حقوق بدون توافق نهایی ساعات پوشش پایلوت قطعی نشده و در مدل هزینه به‌صورت بودجه کلان لحاظ شده است.
          </p>
        </div>
      </div>
    `,

    23: `
      <div class="table-wrap" style="max-height:385px;overflow-y:auto;">
        <table>
          <thead>
            <tr>
              <th>شاخص کلیدی عملکرد (KPI)</th>
              <th>واحد و دوره گزارش</th>
              <th>تعریف دقیق و روش محاسبه سیستمی</th>
              <th>هدف پیشنهادی پایلوت</th>
            </tr>
          </thead>
          <tbody>
            ${KPIS_13.map(
              (k) => `
              <tr>
                <td><strong>${k.name}</strong></td>
                <td>${k.unit} • ${k.period}</td>
                <td class="mono" style="font-size:0.74rem;color:#CBD5E1;">${k.formula}</td>
                <td><span class="status-pill ${DATA_STATUS_META[k.status].badgeClass}">${k.target}</span></td>
              </tr>
            `
            ).join('')}
          </tbody>
        </table>
      </div>
    `,

    24: `
      <div class="grid-2" style="align-items:center;">
        <div class="card" style="text-align:center;">
          <h3>شبکه احتمال و شدت اثر (روی کدهای R1 تا R11 کلیک کنید)</h3>
          <div id="risk-svg-holder"></div>
          <div id="risk-active-detail" style="text-align:right;margin-top:0.6rem;background:#0B1020;border:1px solid rgba(34,211,238,0.35);border-radius:0.65rem;padding:0.7rem;font-size:0.8rem;"></div>
        </div>

        <div class="table-wrap" style="max-height:380px;overflow-y:auto;">
          <table style="min-width:520px;">
            <thead>
              <tr>
                <th>کد</th>
                <th>عنوان ریسک</th>
                <th>احتمال×شدت</th>
                <th>اقدام کاهشی کلیدی</th>
                <th>مسئول</th>
              </tr>
            </thead>
            <tbody id="risk-table-body">
              ${RISKS_11.map(
                (r) => `
                <tr data-risk-row="${r.id}" style="cursor:pointer;">
                  <td><strong class="mono" style="color:#22D3EE;">${r.code}</strong></td>
                  <td><strong>${r.title}</strong></td>
                  <td>${faNum(r.prob)} × ${faNum(r.impact)}</td>
                  <td>${r.mitigation}</td>
                  <td>${r.owner}</td>
                </tr>
              `
              ).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `,

    25: `
      <div class="grid-2">
        <div class="card">
          <span class="status-pill st-proposed" style="margin-bottom:0.45rem;">شفافیت وضعیت جذب منابع</span>
          <h3>منابع مورد نیاز پایلوت و چارچوب باز همکاری</h3>
          <p style="margin-bottom:0.7rem;">
            در مرحله فعلی، <strong>مبلغ قطعی سرمایه‌گذاری و درصد واگذاری سهام از پیش قفل نشده است</strong> و متناسب با نوع مشارکت (نقدی صرف یا شراکت استراتژیک عملیاتی/ناوگانی) تعیین می‌گردد. بر اساس مدل هزینه اسلاید ۱۴، چارچوب مصرف منابع ۶ تا ۱۲ ماه نخست شامل ۴ محور زیر است:
          </p>
          <div class="ledger-row"><span>۱. عملیات شیفت مرکز پیام ۲۴/۷ و استقرار تیم پایلوت قزوین</span><strong>~۴۰٪ منابع</strong></div>
          <div class="ledger-row"><span>۲. جذب ناوگان منتخب، برندینگ محلی و کمپین ورود به بازار قزوین</span><strong>~۳۰٪ منابع</strong></div>
          <div class="ledger-row"><span>۳. اخذ مجوزها، زیرساخت ابری، امنیت و توسعه مستمر فنی</span><strong>~۱۸٪ منابع</strong></div>
          <div class="ledger-row"><span>۴. ذخیره احتیاطی نقدینگی تا عبور از نقطه سربه‌سر</span><strong>~۱۲٪ منابع</strong></div>
        </div>

        <div class="card">
          <h3>الگوهای همکاری تجاری و نقاط عطف قابل ارزیابی (۶ تا ۱۲ ماه)</h3>
          <div style="display:grid;gap:0.5rem;font-size:0.8rem;color:#E2E8F0;">
            <div style="background:#0B1020;padding:0.6rem;border-radius:0.6rem;border:1px solid var(--border-subtle);">
              <strong style="color:#22D3EE;">مسیر ۱ — سرمایه‌گذار خطرپذیر / فرشته:</strong> تأمین بودجه راه‌اندازی و سرمایه در گردش پایلوت قزوین در برابر سهام توافقی مبتنی بر تحقق KPIها.
            </div>
            <div style="background:#0B1020;padding:0.6rem;border-radius:0.6rem;border:1px solid var(--border-subtle);">
              <strong style="color:#22C55E;">مسیر ۲ — شریک عملیاتی ناوگان و تعمیرگاهی در قزوین:</strong> تأمین ناوگان کفی/امداد سیار و فضای عملیاتی در قالب قرارداد مشارکت درآمدی شفاف.
            </div>
            <div style="background:#0B1020;padding:0.6rem;border-radius:0.6rem;border:1px solid var(--border-subtle);">
              <strong style="color:#F59E0B;">نقاط عطف داوری پیشرفت:</strong> (ماه ۲) تکمیل مجوزها و ۱۵ واحد فعال ← (ماه ۶) عبور از ۱٬۰۰۰ سفارش تجمعی با رضایت ≥۴.۵ ← (ماه ۱۰–۱۲) اثبات سربه‌سر عملیاتی قزوین.
            </div>
          </div>
        </div>
      </div>
    `,

    26: `
      <div class="grid-3" style="margin-bottom:1rem;">
        <div class="card" style="border-top:3px solid #EF4444;">
          <h3>۱. مسئله‌ای که حل می‌کنیم</h3>
          <p>حذف بی‌اعتمادی قیمتی، سردرگمی مکانی و ریسک فنی اعزام ناوگان نامتناسب در لحظه پراسترس خرابی خودرو در شهر و جاده.</p>
        </div>
        <div class="card" style="border-top:3px solid #22D3EE;">
          <h3>۲. دارایی و ارزش پیشنهادی EMSCar</h3>
          <p>هسته نرم‌افزاری ۱۴ ماژولی با پوشش ۱۶ حوزه منطقی و ۲۱ تست فعلی؛ پیش‌نیازهای ناوگان، مجوز، تعرفه رسمی و سرویس‌های تجاری هنوز باید فراهم و ارزیابی شوند.</p>
        </div>
        <div class="card" style="border-top:3px solid #22C55E;">
          <h3>۳. قدم عملیاتی بعدی</h3>
          <p>برگزاری جلسه ارزیابی فنی و تجاری، نهایی‌سازی ساختار مشارکت پایلوت قزوین، تکمیل مجوزهای قانونی و جذب اولین حلقه ناوگان منتخب.</p>
        </div>
      </div>

      <div class="card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.8rem;background:#0E1629;border-color:var(--border-accent);">
        <div>
          <strong style="font-size:0.98rem;color:#F8FAFC;">دسترسی مستقیم به مستندات، کد منبع و خروجی جلسه</strong>
          <div style="font-size:0.78rem;color:#94A3B8;">تمامی پیوندهای زیر معتبر و متصل به بخش‌های واقعی همین پروژه هستند.</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
          <a href="https://github.com/rahmaniho/EMSCar" target="_blank" rel="noopener noreferrer" class="btn-cta">مشاهده مخزن و کد محصول (GitHub) ↗</a>
          <button type="button" class="btn-secondary" data-goto="21">بررسی برنامه پایلوت</button>
          <a href="https://github.com/rahmaniho/EMSCar/issues/new" target="_blank" rel="noopener noreferrer" class="btn-secondary">ثبت درخواست جلسه همکاری ↗</a>
          <button type="button" class="btn-secondary" id="end-open-sources">پیوست منابع و مفروضات</button>
          <button type="button" class="btn-secondary" data-goto="1">بازگشت به ابتدای ارائه ↺</button>
        </div>
      </div>
    `,
  };

  return SLIDES_META.map((meta) => wrapSlide(meta, bodies[meta.order] || '')).join('');
}

// ==================== مقداردهی اولیه DOM و کنترلرهای تعاملی ====================
const deckViewport = document.getElementById('deck-viewport');
if (deckViewport) {
  deckViewport.innerHTML = buildAll26SlidesHtml();
  attachImageFallbacks(deckViewport);
}

const slideSections = Array.from(document.querySelectorAll('.slide-section'));
const totalSlides = slideSections.length;
let currentIdx = 0;
let activeScenarioKey = 'base';
let selectedRiskId = 'r1';
let activeJourneyIdx = 0;

const progressFill = document.getElementById('deck-progress-fill');
const counterBtn = document.getElementById('btn-slide-counter');
const prevBtn = document.getElementById('btn-prev-slide');
const nextBtn = document.getElementById('btn-next-slide');
const restartBtn = document.getElementById('btn-restart');
const notesBtn = document.getElementById('btn-toggle-notes');
const zenBtn = document.getElementById('btn-toggle-zen');
const fullscreenBtn = document.getElementById('btn-fullscreen');
const printBtn = document.getElementById('btn-print-pdf');
const overviewBtn = document.getElementById('btn-open-overview');
const shortcutsBtn = document.getElementById('btn-open-shortcuts');
const sourcesBtn = document.getElementById('btn-open-sources');
const toastEl = document.getElementById('deck-toast');

function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove('visible'), 3200);
}

function updateDeckState(pushHash = true) {
  slideSections.forEach((sec, idx) => {
    sec.classList.toggle('active', idx === currentIdx);
  });

  const pct = ((currentIdx + 1) / totalSlides) * 100;
  if (progressFill) progressFill.style.width = `${pct.toFixed(2)}%`;
  if (counterBtn) {
    counterBtn.textContent = `اسلاید ${faNum(currentIdx + 1)} از ${faNum(totalSlides)} ☰`;
  }
  if (prevBtn) prevBtn.disabled = currentIdx === 0;
  if (nextBtn) {
    nextBtn.textContent =
      currentIdx === totalSlides - 1 ? 'پایان (بازگشت به ۱) ↺' : 'اسلاید بعدی ←';
  }

  const ovGrid = document.getElementById('overview-grid');
  if (ovGrid) {
    ovGrid.querySelectorAll('.overview-item').forEach((item, idx) => {
      item.classList.toggle('current', idx === currentIdx);
    });
  }

  if (pushHash && typeof history !== 'undefined' && history.replaceState) {
    history.replaceState(null, '', `#slide-${currentIdx + 1}`);
  }
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function goToSlide(idx) {
  const clamped = Math.max(0, Math.min(totalSlides - 1, idx));
  currentIdx = clamped;
  updateDeckState(true);
}

// ساخت نمای شبکه‌ای فهرست ۲۶ اسلاید (Overview Modal)
const overviewModal = document.getElementById('modal-overview');
const overviewGrid = document.getElementById('overview-grid');
if (overviewGrid) {
  overviewGrid.innerHTML = SLIDES_META.map((m, idx) => {
    const st = DATA_STATUS_META[m.dataStatus];
    return `
      <button type="button" class="overview-item" data-ov-idx="${idx}">
        <div style="display:flex;justify-content:space-between;width:100%;font-size:0.72rem;color:#22D3EE;">
          <strong>اسلاید ${faNum(m.order)} — ${m.category}</strong>
          <span>${st.label.split(' ')[0]}</span>
        </div>
        <div style="font-size:0.82rem;font-weight:800;color:#F8FAFC;">${m.title}</div>
      </button>
    `;
  }).join('');
  overviewGrid.querySelectorAll('.overview-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      overviewModal?.classList.remove('open');
      goToSlide(Number(btn.getAttribute('data-ov-idx') || 0));
    });
  });
}

// مدیریت مودال‌ها
const shortcutsModal = document.getElementById('modal-shortcuts');
const sourcesModal = document.getElementById('modal-sources');

function closeAllModals() {
  overviewModal?.classList.remove('open');
  shortcutsModal?.classList.remove('open');
  sourcesModal?.classList.remove('open');
}

overviewBtn?.addEventListener('click', () => overviewModal?.classList.add('open'));
counterBtn?.addEventListener('click', () => overviewModal?.classList.add('open'));
shortcutsBtn?.addEventListener('click', () => shortcutsModal?.classList.add('open'));
sourcesBtn?.addEventListener('click', () => sourcesModal?.classList.add('open'));
document.getElementById('cover-open-sources')?.addEventListener('click', () => sourcesModal?.classList.add('open'));
document.getElementById('end-open-sources')?.addEventListener('click', () => sourcesModal?.classList.add('open'));

document.querySelectorAll('[data-close-modal]').forEach((btn) => {
  btn.addEventListener('click', closeAllModals);
});
[overviewModal, shortcutsModal, sourcesModal].forEach((m) => {
  m?.addEventListener('click', (e) => {
    if (e.target === m) closeAllModals();
  });
});

// دکمه‌های ناوبری داخلی اسلایدها
document.querySelectorAll('[data-goto]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetOrder = Number(btn.getAttribute('data-goto') || 1);
    goToSlide(targetOrder - 1);
  });
});

prevBtn?.addEventListener('click', () => {
  if (currentIdx > 0) goToSlide(currentIdx - 1);
});
nextBtn?.addEventListener('click', () => {
  if (currentIdx < totalSlides - 1) goToSlide(currentIdx + 1);
  else goToSlide(0);
});
restartBtn?.addEventListener('click', () => goToSlide(0));

notesBtn?.addEventListener('click', () => {
  const on = document.body.classList.toggle('show-notes');
  notesBtn.classList.toggle('active', on);
  showToast(on ? 'یادداشت‌های ارائه‌دهنده نمایش داده شد' : 'یادداشت‌های ارائه‌دهنده پنهان شد');
});

zenBtn?.addEventListener('click', () => {
  const on = document.body.classList.toggle('zen-mode');
  zenBtn.classList.toggle('active', on);
  showToast(on ? 'حالت ارائه تمیز فعال شد (خروج با کلید Z)' : 'نوار ابزار بالای صفحه بازگردانده شد');
});

fullscreenBtn?.addEventListener('click', async () => {
  if (!document.documentElement.requestFullscreen) {
    showToast('مرورگر فعلی شما از Fullscreen API پشتیبانی نمی‌کند؛ از حالت ارائه تمیز (Z) استفاده کنید.');
    return;
  }
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch {
    showToast('امکان ورود به حالت تمام‌صفحه در این محیط محدود شده است.');
  }
});

printBtn?.addEventListener('click', () => {
  window.print();
});

// مدیریت میان‌برهای صفحه‌کلید بدون تداخل با فرم‌ها
window.addEventListener('keydown', (e) => {
  const tag = (e.target && e.target.tagName) || '';
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;

  if (e.key === 'Escape') {
    closeAllModals();
    if (document.body.classList.contains('zen-mode')) {
      document.body.classList.remove('zen-mode');
      zenBtn?.classList.remove('active');
    }
    return;
  }

  // اگر مودالی باز است، کلیدهای اسلاید اجرا نشوند
  if (
    overviewModal?.classList.contains('open') ||
    shortcutsModal?.classList.contains('open') ||
    sourcesModal?.classList.contains('open')
  ) {
    return;
  }

  if (e.key === 'ArrowLeft' || e.key === 'PageDown' || e.key === ' ') {
    if (e.key === ' ' && tag === 'BUTTON') return;
    e.preventDefault();
    if (currentIdx < totalSlides - 1) goToSlide(currentIdx + 1);
  } else if (e.key === 'ArrowRight' || e.key === 'PageUp') {
    e.preventDefault();
    if (currentIdx > 0) goToSlide(currentIdx - 1);
  } else if (e.key === 'Home') {
    e.preventDefault();
    goToSlide(0);
  } else if (e.key === 'End') {
    e.preventDefault();
    goToSlide(totalSlides - 1);
  } else if (e.key === 'n' || e.key === 'N' || e.key === 'د') {
    notesBtn?.click();
  } else if (e.key === 'z' || e.key === 'Z' || e.key === 'ظ') {
    zenBtn?.click();
  } else if (e.key === 'f' || e.key === 'F' || e.key === 'ب') {
    fullscreenBtn?.click();
  } else if (e.key === '?') {
    shortcutsModal?.classList.add('open');
  }
});

// پشتیبانی سوایپ افقی موبایل بدون تداخل با اسکرول جداول و اسلایدرهای فرم
let touchX0 = 0;
let touchY0 = 0;
let blockSwipe = false;

window.addEventListener(
  'touchstart',
  (e) => {
    if (e.touches.length !== 1) return;
    const t = e.target;
    if (t && t.closest && t.closest('input, select, button, .table-wrap, .modal-card')) {
      blockSwipe = true;
      return;
    }
    blockSwipe = false;
    touchX0 = e.touches[0].clientX;
    touchY0 = e.touches[0].clientY;
  },
  { passive: true }
);

window.addEventListener(
  'touchend',
  (e) => {
    if (blockSwipe || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - touchX0;
    const dy = e.changedTouches[0].clientY - touchY0;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.7) {
      if (dx > 0 && currentIdx < totalSlides - 1) goToSlide(currentIdx + 1);
      else if (dx < 0 && currentIdx > 0) goToSlide(currentIdx - 1);
    }
  },
  { passive: true }
);

// همگام‌سازی مستقیم URL در بارگذاری و تغییر Hash
function syncFromUrlHash() {
  const h = window.location.hash || '';
  const m = h.match(/^#slide-(\d+)$/);
  if (m) {
    const num = Number(m[1]);
    if (num >= 1 && num <= totalSlides) {
      currentIdx = num - 1;
    }
  }
  updateDeckState(false);
}
window.addEventListener('hashchange', syncFromUrlHash);
syncFromUrlHash();

// ==================== ویجت‌های تعاملی داخل اسلایدها ====================

// ۱. اسلاید ۷: تعامل ۷ مرحله سفر کاربر
function renderJourneyStep(idx) {
  activeJourneyIdx = idx;
  const chipsWrap = document.getElementById('journey-chips');
  const stageWrap = document.getElementById('journey-stage');
  const item = SAMPLE_JOURNEY_7[idx];
  if (chipsWrap) {
    chipsWrap.innerHTML = SAMPLE_JOURNEY_7.map(
      (s, i) => `<button type="button" class="chip-btn ${i === idx ? 'active' : ''}" data-j="${i}">${s.icon} گام ${faNum(s.step)}</button>`
    ).join('');
    chipsWrap.querySelectorAll('button[data-j]').forEach((b) => {
      b.addEventListener('click', () => renderJourneyStep(Number(b.getAttribute('data-j') || 0)));
    });
  }
  if (stageWrap && item) {
    stageWrap.innerHTML = `
      <div class="photo-frame">
        <img src="${item.photo}" data-fallback="1" alt="${item.title}" />
        <div style="padding:0.75rem 0.9rem;font-size:0.76rem;color:#94A3B8;">
          وضعیت فنی این گام در مخزن: <strong style="color:#22C55E;">${item.state}</strong>
        </div>
      </div>
      <div class="card" style="display:flex;flex-direction:column;justify-content:space-between;">
        <div>
          <h3 style="font-size:1.05rem;color:#22D3EE;">${item.icon} ${item.title}</h3>
          <p style="font-size:0.86rem;color:#E2E8F0;margin-top:0.5rem;line-height:1.8;">${item.desc}</p>
          <div style="margin-top:0.8rem;background:#0B1020;border:1px solid rgba(34,197,94,0.35);border-radius:0.65rem;padding:0.65rem;font-size:0.79rem;color:#86EFAC;">
            <strong>کنترل عملیاتی و حریم خصوصی سرور:</strong><br/>${item.guard}
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:0.8rem;">
          <button type="button" class="ctrl-btn" id="j-prev" ${idx === 0 ? 'disabled' : ''}>→ مرحله قبل</button>
          <button type="button" class="ctrl-btn active" id="j-next">${idx === SAMPLE_JOURNEY_7.length - 1 ? 'مرور مجدد از گام ۱' : 'مرحله بعد ←'}</button>
        </div>
      </div>
    `;
    attachImageFallbacks(stageWrap);
    document.getElementById('j-prev')?.addEventListener('click', () => {
      if (activeJourneyIdx > 0) renderJourneyStep(activeJourneyIdx - 1);
    });
    document.getElementById('j-next')?.addEventListener('click', () => {
      renderJourneyStep((activeJourneyIdx + 1) % SAMPLE_JOURNEY_7.length);
    });
  }
}
renderJourneyStep(0);

// ۲. اسلاید ۸: ماشین‌حساب فرمولیک TAM / SAM / SOM
function updateMarketSizing() {
  const cars = Number(document.getElementById('mkt-iran-cars')?.value || 18000000);
  const inc = Number(document.getElementById('mkt-incident-rate')?.value || 0.35);
  const qzvPct = Number(document.getElementById('mkt-qazvin-share')?.value || 2.4);
  const somPct = Number(document.getElementById('mkt-som-share')?.value || 6.0);

  const avgOrderToman = 540000;
  const tamOrders = Math.round(cars * inc);
  const samOrders = Math.round((tamOrders * qzvPct) / 100);
  const somOrders = Math.round((samOrders * somPct) / 100);

  const tamGmvB = Math.round((tamOrders * avgOrderToman) / 1_000_000_000);
  const samGmvB = Math.round(((samOrders * avgOrderToman) / 1_000_000_000) * 10) / 10;
  const somGmvM = Math.round((somOrders * avgOrderToman) / 1_000_000);
  const somRevM = Math.round(somGmvM * 0.15);

  const setTxt = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  setTxt('lbl-mkt-cars', faNum(cars));
  setTxt('lbl-mkt-inc', inc.toLocaleString('fa-IR'));
  setTxt('lbl-mkt-qzv', `${qzvPct.toLocaleString('fa-IR')}٪`);
  setTxt('lbl-mkt-som', `${somPct.toLocaleString('fa-IR')}٪`);

  const out = document.getElementById('mkt-output');
  if (out) {
    out.innerHTML = `
      <h3>خروجی فرمول بر پایه مفروضات انتخابی (سبد پایه ۵۴۰ هزار تومان)</h3>
      <div class="ledger-row"><span><strong>TAM</strong> (کل بازار بالقوه سالانه ایران):</span><span>${faNum(tamOrders)} رویداد (~${faNum(tamGmvB)} میلیارد تومان GMV)</span></div>
      <div class="ledger-row"><span><strong>SAM</strong> (بازار قابل خدمت استان و محور قزوین):</span><span>${faNum(samOrders)} رویداد (~${samGmvB.toLocaleString('fa-IR')} میلیارد تومان GMV)</span></div>
      <div class="ledger-row" style="color:#67E8F9;"><span><strong>SOM</strong> (سهم هدف سال اول پایلوت قزوین):</span><strong>${faNum(somOrders)} سفارش در سال (~${faNum(Math.round(somOrders / 12))} در ماه)</strong></div>
      <div class="ledger-total">
        <span>درآمد کارمزد پلتفرم در SOM فرضی (۱۵٪):</span>
        <span>${faNum(somRevM)} میلیون تومان / سال</span>
      </div>
    `;
  }
}
['mkt-iran-cars', 'mkt-incident-rate', 'mkt-qazvin-share', 'mkt-som-share'].forEach((id) => {
  document.getElementById(id)?.addEventListener('input', updateMarketSizing);
});
updateMarketSizing();

// ۳. اسلاید ۱۲: ماشین‌حساب رسمی قیمت‌گذاری تومان/ریال
const prcSvcEl = document.getElementById('prc-service');
if (prcSvcEl) {
  SERVICES_CATALOG_15.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.slug;
    opt.textContent = `${s.title} (${faNum(s.base)} ت)`;
    prcSvcEl.appendChild(opt);
  });
}

function updatePricingWidget() {
  const q = calculateOfficialQuote({
    serviceSlug: document.getElementById('prc-service')?.value || 'battery-jumpstart',
    zoneMultiplier: Number(document.getElementById('prc-zone')?.value || 1.0),
    vehicleCategory: document.getElementById('prc-vehicle')?.value || 'domestic',
    dispatchKm: Number(document.getElementById('prc-disp-km')?.value || 0),
    towKm: Number(document.getElementById('prc-tow-km')?.value || 0),
    partsCostToman: Number(document.getElementById('prc-parts')?.value || 0),
    isUrgentOrNight: Boolean(document.getElementById('prc-night')?.checked),
    applyLaunchDiscount: Boolean(document.getElementById('prc-disc')?.checked),
  });

  const out = document.getElementById('prc-result-card');
  if (!out) return;
  out.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.45rem;">
      <h3>ریز محاسبه پیش‌فاکتور / صورتحساب</h3>
      <span class="mono" style="font-size:0.72rem;color:#22D3EE;">_toman → tomanToRial</span>
    </div>
    <div class="ledger-row"><span>نرخ پایه (${q.service.title}):</span><span>${faToman(q.service.base)}</span></div>
    <div class="ledger-row"><span>هزینه اعزام مازاد (${q.billableDispatchKm.toLocaleString('fa-IR')}km):</span><span>${faToman(q.dispatchFeeToman)}</span></div>
    <div class="ledger-row"><span>هزینه حمل خودروبر (${q.effectiveTowKm.toLocaleString('fa-IR')}km):</span><span>${faToman(q.towFeeToman)}</span></div>
    <div class="ledger-row"><span>تعدیل رده خودرو و منطقه قزوین:</span><span>+ ${faToman(q.vehicleAdjustmentToman + q.zoneAdjustmentToman)}</span></div>
    <div class="ledger-row"><span>فوق‌العاده شبانه / فوری:</span><span>+ ${faToman(q.nightSurchargeToman)}</span></div>
    <div class="ledger-row" style="color:#86EFAC;"><span>تخفیف QAZVIN1405 (۱۰٪ تا ۱۵۰ هزار):</span><span>- ${faToman(q.discountToman)}</span></div>
    <div class="ledger-row"><span>قطعات مصرفی (بدون کارمزد پلتفرم):</span><span>${faToman(q.partsCostToman)}</span></div>
    <div class="ledger-row"><span>مالیات بر ارزش افزوده فرضی (۱۰٪):</span><span>${faToman(q.taxToman)}</span></div>
    <div class="ledger-total">
      <span>جمع کل قابل پرداخت مشتری:</span>
      <span>${faToman(q.totalToman)}</span>
    </div>
    <div class="mono" style="font-size:0.73rem;color:#94A3B8;text-align:left;margin-top:0.2rem;">
      Shaparak / Gateway Payload: ${q.totalRial.toLocaleString('en-US')} Rials
    </div>
    <div style="margin-top:0.55rem;font-size:0.77rem;display:flex;justify-content:space-between;color:#CBD5E1;">
      <span>سهم کمیسیون پلتفرم (۱۵٪ اجرت): <strong style="color:#22D3EE;">${faToman(q.platformCommissionToman)}</strong></span>
      <span>سهم خالص امدادگر: <strong style="color:#22C55E;">${faToman(q.responderNetShareToman)}</strong></span>
    </div>
    ${
      q.requiresCustomerReapproval
        ? `<div style="margin-top:0.5rem;padding:0.45rem 0.65rem;border-radius:0.5rem;background:rgba(245,158,11,0.16);border:1px solid #F59E0B;font-size:0.75rem;color:#FDE68A;">
             ⚠️ افزایش ${faNum(q.increasePercent)}٪ نسبت به پیش‌فاکتور اولیه (بالای ۱۰٪): <strong>تأیید مجدد مشتری در اپ الزامی می‌شود.</strong>
           </div>`
        : ''
    }
  `;
}
['prc-service', 'prc-zone', 'prc-vehicle', 'prc-disp-km', 'prc-tow-km', 'prc-parts', 'prc-night', 'prc-disc'].forEach((id) => {
  document.getElementById(id)?.addEventListener('input', updatePricingWidget);
  document.getElementById(id)?.addEventListener('change', updatePricingWidget);
});
updatePricingWidget();

// ۴. اسلاید ۱۳: اقتصاد واحد (Unit Economics)
function updateUnitEconWidget() {
  const aov = Number(document.getElementById('ue-aov')?.value || 540000);
  const comm = Number(document.getElementById('ue-comm')?.value || 15);
  const varCost = Number(document.getElementById('ue-var')?.value || 14500);
  const newCust = Number(document.getElementById('ue-new-cust')?.value || 240);
  const lifetimeOrders = Number(document.getElementById('ue-repeat')?.value || 3.6);

  const ue = computeUnitEconomics({
    avgOrderServiceToman: aov,
    commissionRatePct: comm,
    directVariableCostPerOrderToman: varCost,
    monthlyMarketingSpendToman: 38_000_000,
    monthlyNewCustomers: newCust,
    annualOrdersPerCustomer: lifetimeOrders / 2,
    avgCustomerRetentionYears: 2,
  });

  const setTxt = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  setTxt('lbl-ue-aov', faToman(aov));
  setTxt('lbl-ue-comm', `${faNum(comm)}٪`);
  setTxt('lbl-ue-var', faToman(varCost));
  setTxt('lbl-ue-cac-in', `۳۸ م.ت ÷ ${faNum(newCust)} نفر`);
  setTxt('lbl-ue-rep', `${lifetimeOrders.toLocaleString('fa-IR')} سفارش`);

  const healthy = ue.ltvToCac >= 2.5 && ue.grossProfitPerOrder > 0;
  const out = document.getElementById('ue-output');
  if (out) {
    out.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.55rem;">
        <h3>شاخص‌های محاسبه‌شده اقتصاد واحد</h3>
        <span class="status-pill ${healthy ? 'st-verified' : 'st-unknown'}">${healthy ? 'نسبت LTV/CAC سالم (≥۲.۵)' : 'نیازمند بهینه‌سازی CAC یا تکرار'}</span>
      </div>
      <div class="metric-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));">
        <div class="metric-card"><div class="metric-val">${faToman(ue.platformRevenuePerOrder)}</div><div class="metric-lbl">درآمد ناخالص پلتفرم از هر سفارش</div></div>
        <div class="metric-card"><div class="metric-val" style="color:#22C55E;">${faToman(ue.grossProfitPerOrder)}</div><div class="metric-lbl">سود ناخالص هر سفارش (${ue.grossMarginOfPlatformRevenuePct.toLocaleString('fa-IR')}٪ سهم پلتفرم)</div></div>
        <div class="metric-card"><div class="metric-val" style="color:#F59E0B;">${faToman(ue.cacToman)}</div><div class="metric-lbl">هزینه جذب هر مشتری جدید (CAC)</div></div>
        <div class="metric-card"><div class="metric-val">${faToman(ue.ltvToman)}</div><div class="metric-lbl">ارزش طول عمر حاشیه سود (LTV) — نسبت ${ue.ltvToCac.toLocaleString('fa-IR')}x</div></div>
      </div>
      <div style="margin-top:0.55rem;font-size:0.78rem;color:#94A3B8;">
        تعداد سفارش لازم برای بازگشت هزینه جذب هر مشتری (CAC Payback): <strong style="color:#F8FAFC;">${Number.isFinite(ue.paybackOrders) ? ue.paybackOrders.toLocaleString('fa-IR') : '∞'} سفارش موفق</strong>
      </div>
    `;
  }
}
['ue-aov', 'ue-comm', 'ue-var', 'ue-new-cust', 'ue-repeat'].forEach((id) => {
  document.getElementById(id)?.addEventListener('input', updateUnitEconWidget);
});
updateUnitEconWidget();

// ۵. اسلاید ۱۵: پیش‌بینی مالی ۱۲ماهه در ۳ سناریو
function updateForecastSlide() {
  const aov = Number(document.getElementById('fc-aov')?.value || 540000);
  const fixedCost = Number(document.getElementById('fc-fixed')?.value || 195000000);
  const lblAov = document.getElementById('lbl-fc-aov');
  const lblFixed = document.getElementById('lbl-fc-fixed');
  if (lblAov) lblAov.textContent = `${faNum(aov / 1000)} هزار ت`;
  if (lblFixed) lblFixed.textContent = `${faNum(fixedCost / 1_000_000)} م.ت`;

  const all = computeThreeScenarios12M({
    baseAvgOrderToman: aov,
    baseMonthlyFixedCostToman: fixedCost,
  });
  const active = all[activeScenarioKey] || all.base;

  const trendEl = document.getElementById('fc-trend-chart');
  const compEl = document.getElementById('fc-compare-chart');
  const sumEl = document.getElementById('fc-summary-metrics');
  const tblEl = document.getElementById('fc-table-wrap');

  if (trendEl) trendEl.innerHTML = renderForecastTrendSvg(active);
  if (compEl) compEl.innerHTML = renderScenarioBarsSvg(all);
  if (sumEl) {
    sumEl.innerHTML = `
      <div class="metric-card"><div class="metric-val">${faMillion(active.totalRevenueYear1)}</div><div class="metric-lbl">کل درآمد پلتفرم در ۱۲ ماه (${active.label})</div></div>
      <div class="metric-card"><div class="metric-val" style="color:${active.breakEvenMonth ? '#22C55E' : '#F59E0B'};">${active.breakEvenMonth ? `ماه ${faNum(active.breakEvenMonth)}` : 'پس از ماه ۱۲'}</div><div class="metric-lbl">نقطه سربه‌سر ماهانه | اوج نیاز نقدینگی: ${faMillion(active.peakCashNeedToman)}</div></div>
    `;
  }
  if (tblEl) {
    const pick = [active.months[0], active.months[5], active.months[11]];
    tblEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>دوره (${active.label})</th>
            <th>کاربران فعال</th>
            <th>درخواست‌ها</th>
            <th>سفارش موفق</th>
            <th>درآمد پلتفرم (تومان)</th>
            <th>هزینه متغیر</th>
            <th>هزینه ثابت</th>
            <th>سود/زیان عملیاتی</th>
          </tr>
        </thead>
        <tbody>
          ${pick
            .map(
              (m) => `
              <tr>
                <td><strong>ماه ${faNum(m.month)} پایلوت</strong></td>
                <td>${faNum(m.activeUsers)}</td>
                <td>${faNum(m.requests)}</td>
                <td>${faNum(m.completedOrders)}</td>
                <td>${faToman(m.monthlyRevenueToman)}</td>
                <td>${faToman(m.monthlyVariableCostToman)}</td>
                <td>${faToman(m.monthlyFixedCostToman)}</td>
                <td style="color:${m.operatingProfitToman >= 0 ? '#22C55E' : '#FCA5A5'};font-weight:800;">
                  ${m.operatingProfitToman >= 0 ? '+' : '-'}${faToman(Math.abs(m.operatingProfitToman))}
                </td>
              </tr>
            `
            )
            .join('')}
        </tbody>
      </table>
    `;
  }
}

document.querySelectorAll('#fc-scenario-btns button[data-sc]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#fc-scenario-btns .chip-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeScenarioKey = btn.getAttribute('data-sc') || 'base';
    updateForecastSlide();
  });
});
['fc-aov', 'fc-fixed'].forEach((id) => {
  document.getElementById(id)?.addEventListener('input', updateForecastSlide);
});
updateForecastSlide();

// ۶. اسلاید ۱۶: نقطه سربه‌سر و تورنادو تحلیل حساسیت
function updateSensitivitySlide() {
  const reqs = Number(document.getElementById('sens-req')?.value || 3800);
  const cancelPct = Number(document.getElementById('sens-cancel')?.value || 32);
  const lblR = document.getElementById('lbl-sens-req');
  const lblC = document.getElementById('lbl-sens-cancel');
  if (lblR) lblR.textContent = `${faNum(reqs)} درخواست`;
  if (lblC) lblC.textContent = `${faNum(cancelPct)}٪`;

  const res = computeBreakEvenAndSensitivity({
    monthlyRequests: reqs,
    cancellationAndDropPct: cancelPct,
  });

  const kpiWrap = document.getElementById('sens-kpi-strip');
  const svgWrap = document.getElementById('sens-tornado-wrap');

  if (kpiWrap) {
    const ok = res.baseline.opProfit >= 0;
    kpiWrap.innerHTML = `
      <div class="metric-card"><div class="metric-val">${faNum(res.baseline.breakEvenOrders)} سفارش</div><div class="metric-lbl">نقطه سربه‌سر ماهانه (روزانه ~${faNum(Math.ceil(res.baseline.breakEvenOrders / 30))})</div></div>
      <div class="metric-card"><div class="metric-val" style="color:${ok ? '#22C55E' : '#EF4444'};">${ok ? '+' : '-'}${faMillion(Math.abs(res.baseline.opProfit))}</div><div class="metric-lbl">تراز عملیاتی ماه نمونه (${faNum(res.baseline.orders)} سفارش موفق)</div></div>
      <div class="metric-card" style="grid-column:1 / -1;"><div style="font-size:0.8rem;color:#22D3EE;font-weight:800;">بیشترین حساسیت سودآوری: ${res.mostSensitiveVariable}</div></div>
    `;
  }
  if (svgWrap) {
    svgWrap.innerHTML = renderSensitivityTornadoSvg(res);
  }
}
['sens-req', 'sens-cancel'].forEach((id) => {
  document.getElementById(id)?.addEventListener('input', updateSensitivitySlide);
});
updateSensitivitySlide();

// ۷. اسلاید ۲۴: تعامل ماتریس ریسک
function updateRiskMatrixView(riskId) {
  selectedRiskId = riskId;
  const holder = document.getElementById('risk-svg-holder');
  const detail = document.getElementById('risk-active-detail');
  const r = RISKS_11.find((x) => x.id === riskId) || RISKS_11[0];

  if (holder) {
    holder.innerHTML = renderRiskMatrixSvg(RISKS_11, selectedRiskId);
    holder.querySelectorAll('g[data-risk-id]').forEach((g) => {
      g.addEventListener('click', () =>
        updateRiskMatrixView(g.getAttribute('data-risk-id') || 'r1')
      );
    });
  }
  if (detail && r) {
    detail.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:0.25rem;">
        <strong style="color:#22D3EE;">${r.code} — ${r.title}</strong>
        <span class="status-pill st-assumption">امتیاز ریسک: ${faNum(r.prob * r.impact)} از ۲۵</span>
      </div>
      <div style="color:#CBD5E1;margin-bottom:0.2rem;"><strong>راهکار کنترلی:</strong> ${r.mitigation}</div>
      <div style="color:#94A3B8;font-size:0.75rem;">مسئول پیگیری: <strong>${r.owner}</strong></div>
    `;
  }
}
document.querySelectorAll('#risk-table-body tr[data-risk-row]').forEach((row) => {
  row.addEventListener('click', () =>
    updateRiskMatrixView(row.getAttribute('data-risk-row') || 'r1')
  );
});
updateRiskMatrixView('r1');

// ۸. بررسی غیرمسدودکننده اتصال اختیاری به بک‌اند در صورت اجرا روی سرور اصلی
(async function checkOptionalBackend() {
  if (typeof window === 'undefined' || window.location.hostname.endsWith('github.io')) return;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch('/api/health', { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) {
      const pill = document.getElementById('live-api-pill');
      if (pill) {
        pill.textContent = '● Live Backend Connected (/api/health)';
        pill.style.color = '#22C55E';
      }
    }
  } catch {
    // اجرای مستقل بدون نیاز به Backend
  }
})();
