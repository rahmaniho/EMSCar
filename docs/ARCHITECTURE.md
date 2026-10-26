# معماری مهندسی سامانه «اورژانس خودرو»
*(نام پیشنهادی انگلیسی: Auto Emergency — غیرثبت‌شده به‌عنوان علامت تجاری)*

## ۱. الگوی معماری انتخاب‌شده: Modular Monolith یکپارچه
با توجه به ممیزی فاز اول مخزن (که صرفاً شامل یک فایل `README.md` بود) و نیازمندی‌های عملیاتی سامانه امداد خودرو، معماری **Modular Monolith مبتنی بر TypeScript سرتاسری** انتخاب و پیاده‌سازی شد:

- **سرور و API:** Express 4 روی Node.js 22 با تفکیک سخت‌گیرانه لایه مسیرها (`*.routes.ts`)، منطق دامنه (`*.service.ts`) و قوانین مشترک (`src/shared/*`).
- **لایه داده و تراکنش:** موتور تراکنشی ACID مبتنی بر `node:sqlite` (`DatabaseSync`) با فعال‌سازی `PRAGMA journal_mode = WAL`، `PRAGMA foreign_keys = ON`، قفل نوشتن فوری `BEGIN IMMEDIATE` برای جلوگیری از Race Condition و پشتیبانی از تراکنش‌های تودرتو با `SAVEPOINT`.
- **کلاینت وب:** اپلیکیشن واکنش‌گرای فارسی (RTL) و Mobile-First با React 18، React Router 7، Vite 8 و Tailwind CSS 4 که از طریق مسیرهای نسبی `/api/*` روی یک Origin واحد سرویس‌دهی می‌شود.

---

## ۲. پوشش ۱۶ حوزه منطقی در ۱۴ ماژول سطح سرور (Domain Modules)

| ردیف | دامنه | مسیر پیاده‌سازی | مسئولیت‌های کلیدی |
|---|---|---|---|
| ۱ | Identity & Access Management | `src/server/modules/identity/` | ثبت‌نام مشتری/امدادگر، هش رمز عبور با `scrypt` تصادفی، نشست‌های سرور (`user_sessions`)، ابطال آنی نشست |
| ۲ | Customer Management | `src/server/modules/customers/` | پروفایل مشتری، مدیریت خودروها (داخلی، خارجی، برقی، شاسی‌بلند سنگین) با کنترل مالکیت |
| ۳ | Provider & Responder Management | `src/server/modules/responders/` | پرونده امدادگر، بارگذاری مدارک هویتی/فنی/گواهی EV، اعتبارسنجی شبا (`IR` + ۲۴ رقم)، قفل آنلاین‌شدن تا تأیید مدیر |
| ۴ | Service Catalog | `src/server/modules/catalog/` | کاتالوگ ۱۵ خدمت پایه، پیش‌نیاز تجهیزات (`flatbed_tow`, `ev_specialist_unit` و...)، ممیزی تغییرات (`service_audit_logs`) |
| ۵ | Geographic Coverage | `src/server/modules/geography/` | مدیریت استان‌ها، شهرها و زون‌های خدماتی؛ فعال بودن انحصاری **استان قزوین** در راه‌اندازی اولیه؛ پروتکل فعال‌سازی استان جدید |
| ۶ | Request Management | `src/server/modules/requests/requests.service.ts` | ثبت پیش‌نویس و نهایی درخواست، کلید ضدتکرار (`Idempotency-Key`)، پیوست‌های خصوصی، لغو با محاسبه جریمه |
| ۷ | Dispatch & Assignment | `src/server/modules/requests/dispatch.service.ts` | الگوریتم امتیازدهی چندمعیاره، ارسال پیشنهاد (`Offered`)، پذیرش اتمیک ضد تداخل هم‌زمان، ارجاع صادقانه به اپراتور |
| ۸ | Mission Lifecycle | `src/server/modules/requests/state-machine.ts` | ماشین وضعیت ۱۲ حالته با ثبت کامل تاریخچه تغییر وضعیت (`request_state_history`) و گزارش پایان خدمت |
| ۹ | Pricing & Quotation | `src/shared/pricing-formula.ts`, `modules/pricing/` | محاسبه شفاف پیش‌فاکتور و قیمت نهایی بر پایه **تومان صحیح**، سقف تخفیف، مالیات و حد آستانه تأیید مجدد مشتری |
| ۱۰ | Payments & Refunds | `src/server/modules/payments/` | انتزاع درگاه (`Sandbox` شبیه‌سازی + `Zarinpal`) و استعلام سمت سرور Callback؛ Refund واقعی تا اتصال و آزمون provider مسدود است؛ بدهی اضطراری خاموش پیش‌فرض و بدون دریافت وجه |
| ۱۱ | Invoices & Settlements | `src/server/modules/payments/payments.service.ts` | صدور فاکتور و دفترکل کیف پول؛ Sandbox/legacy از جمع‌های مالی اصلی جداست؛ تسویهٔ Sandbox شبیه‌سازی و تسویهٔ زنده فقط ثبت دستی با مرجع/تأیید مدیر است، نه انتقال خودکار بانکی |
| ۱۲ | Notifications | `src/server/modules/notifications/` | لایه انتزاعی پیامک (`SandboxOutbox` + `Kavenegar`) و اعلان درون‌برنامه‌ای با کلید ضدتکرار و تلاش مجدد کنترل‌شده |
| ۱۳ | Support & Disputes | `src/server/modules/support/` | تیکت و شکایت متصل به مأموریت، یادداشت داخلی محرمانه اپراتور (`internal_operator_notes`)، ارجاع به مدیر و وضعیت `UnderSupportReview` |
| ۱۴ | Ratings & Reviews | `src/server/modules/ratings/` | ثبت امتیاز ۱ تا ۵ و بازخورد پس از تکمیل مأموریت (یک‌بار به ازای هر مأموریت) و بروزرسانی میانگین امتیاز امدادگر |
| ۱۵ | Reporting & Audit | `src/server/modules/audit/`, `modules/admin/` | داشبورد KPI عملیاتی و مالی، گزارش تطبیق مالی (Reconciliation)، ثبت تغییرناپذیر `audit_logs` و `security_events` |
| ۱۶ | Administration & Configuration | `src/server/modules/admin/` | مدیریت کاربران و نقش‌ها، تنظیمات سیستمی پویا (`system_settings`) و پایش سلامت سرویس (`/api/health`) |

---

## ۳. حاکمیت جغرافیایی و راه‌اندازی اولیه در استان قزوین

1. **جداسازی «وجود در دیتابیس» از «فعال بودن عملیاتی»:** استان‌های البرز، زنجان، تهران، گیلان و همدان در دیتابیس با وضعیت‌های `preparing`، `pending_approval` و `inactive` نگهداری می‌شوند و تنها **استان قزوین** دارای وضعیت `active` است.
2. **گارد سمت سرور:** متد `requireActiveOperationalCoverage` در زمان محاسبه تعرفه و ثبت درخواست، مختصات مبدأ را در سطح استان، شهر و زون بررسی می‌کند و درخواست‌های خارج از محدوده فعال قزوین را با کد `422` و پیام شفاف فارسی رد می‌کند.
3. **پروتکل فعال‌سازی استان جدید:** تغییر وضعیت استان به `active` منوط به (الف) وجود حداقل یک زون فعال، (ب) تأمین حداقل ظرفیت امدادگران تأییدشده استان، (ج) ارسال پرچم تأیید صریح مدیر ارشد (`explicitAdminConfirmation: true`) و (د) ثبت دلیل ممیزی در `geography_status_history` و `audit_logs` است.
4. **حفظ سوابق تاریخی:** تمام کلیدهای خارجی جغرافیایی با قید `ON DELETE RESTRICT` تعریف شده‌اند تا غیرفعال‌سازی یک شهر یا استان هرگز سوابق تاریخی مأموریت‌ها و فاکتورها را مخدوش نکند.

---

## ۴. ماشین وضعیت چرخه مأموریت (۱۲ وضعیت رسمی)

```text
Draft ──► Submitted ──► Searching ──► Offered ──► Accepted ──► EnRoute ──► Arrived ──► InProgress ──► Completed
  │           │             │            │           │            │           │            │
  └───────────┴─────────────┴────────────┴───────────┴────────────┴───────────┴────────────┼──► Cancelled
                                                                                           ├──► Failed
                                                                                           └──► UnderSupportReview
```

- در صورت رد پیشنهاد توسط امدادگر (`Offered -> Searching`)، موتور دیسپچ به‌صورت خودکار سراغ نفر بعدی می‌رود.
- در صورت نبود هیچ امدادگر واجد شرایط، سامانه **هیچ زمان رسیدن (ETA) ساختگی نمایش نمی‌دهد** و پرونده را با پرچم `operator_escalation_required = 1` در صف زنده اپراتور قرار می‌دهد.

---

## ۵. فرمول رسمی قیمت‌گذاری (واحد ذخیره و نمایش: تومان صحیح)

تمامی ستون‌های مالی پایگاه‌داده دارای پسوند صریح `_toman` (عدد صحیح) هستند و تبدیل به ریال (`amountToman * 10`) منحصراً در لایه مرز درگاه پرداخت بانکی (`tomanToRial`) انجام می‌شود:

1. **هزینه پایه + مسافت اعزام + مسافت حمل:**
   `RawService = BasePrice + max(0, DispatchKm - IncludedFreeKm) * PerKmDispatch + TowKm * PerKmTow`
2. **ضریب رده خودرو** (`domestic`, `foreign`, `electric`, `suv_heavy`)
3. **ضریب منطقه جغرافیایی** (شهری قزوین `1.0`، آزادراه قزوین-زنجان/کرج `1.15`، شهر صنعتی البرز و بوئین‌زهرا `1.05`–`1.10`)
4. **ضریب شبانه / اضطراری** (ساعات ۲۲ تا ۰۶ بامداد به وقت ایران یا درخواست فوری)
5. **کسر تخفیف** (با رعایت سقف ریالی/تومانی کد تخفیف روی اجرت خدمات)
6. **افزودن هزینه قطعات مصرفی واقعی** (ثبت‌شده در گزارش تکمیل مأموریت؛ در صورت عبور افزایش قیمت از آستانه مجاز، نیازمند تأیید صریح مشتری در اپلیکیشن پیش از پرداخت)
7. **مالیات بر ارزش افزوده و جمع کل قابل پرداخت.**
