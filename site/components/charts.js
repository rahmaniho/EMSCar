// کتابخانه نمودارهای تحلیلی برداری (SVG) بدون وابستگی خارجی، واکنش‌گرا برای موبایل و دسکتاپ

export function faNum(val) {
  return Math.round(Number(val) || 0).toLocaleString('fa-IR');
}

export function faMillion(toman) {
  const m = (Number(toman) || 0) / 1_000_000;
  return `${m.toLocaleString('fa-IR', { maximumFractionDigits: 1 })} م.ت`;
}

/**
 * ۱. نمودار روند ۱۲ماهه درآمد پلتفرم در برابر کل هزینه و نقطه سربه‌سر
 */
export function renderForecastTrendSvg(scenario) {
  const months = scenario.months;
  const maxVal = Math.max(
    ...months.map((m) => Math.max(m.monthlyRevenueToman, m.totalCostToman)),
    100_000_000
  );
  const topScale = Math.ceil(maxVal / 100_000_000) * 100_000_000;

  const w = 680;
  const h = 270;
  const padL = 48;
  const padR = 54;
  const padT = 26;
  const padB = 42;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const xAt = (i) => padL + (i / 11) * plotW;
  const yAt = (v) => padT + plotH - (v / topScale) * plotH;

  const revPts = months.map((m, i) => `${xAt(i).toFixed(1)},${yAt(m.monthlyRevenueToman).toFixed(1)}`).join(' ');
  const costPts = months.map((m, i) => `${xAt(i).toFixed(1)},${yAt(m.totalCostToman).toFixed(1)}`).join(' ');
  const revArea = `${xAt(0).toFixed(1)},${(padT + plotH).toFixed(1)} ${revPts} ${xAt(11).toFixed(1)},${(padT + plotH).toFixed(1)}`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const val = topScale * ratio;
      const y = yAt(val).toFixed(1);
      return `
        <line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="rgba(148,163,184,0.16)" stroke-dasharray="4 4"/>
        <text x="${w - padR + 6}" y="${Number(y) + 4}" fill="#94A3B8" font-size="10" text-anchor="start">${faNum(val / 1_000_000)}م</text>
      `;
    })
    .join('');

  const xLabels = months
    .map((m, i) => {
      const x = xAt(i).toFixed(1);
      const isBe = scenario.breakEvenMonth === m.month;
      return `
        <text x="${x}" y="${h - 14}" fill="${isBe ? '#22C55E' : '#94A3B8'}" font-size="10.5" font-weight="${isBe ? '800' : '500'}" text-anchor="middle">م${faNum(m.month)}</text>
        <circle cx="${x}" cy="${yAt(m.monthlyRevenueToman).toFixed(1)}" r="${isBe ? 5.5 : 3.5}" fill="${isBe ? '#22C55E' : '#22D3EE'}" stroke="#0B1020" stroke-width="1.5"/>
        <circle cx="${x}" cy="${yAt(m.totalCostToman).toFixed(1)}" r="3" fill="#F59E0B"/>
      `;
    })
    .join('');

  const beBadge = scenario.breakEvenMonth
    ? (() => {
        const idx = scenario.breakEvenMonth - 1;
        const bx = xAt(idx);
        const by = yAt(months[idx].monthlyRevenueToman);
        return `
          <line x1="${bx}" y1="${padT}" x2="${bx}" y2="${padT + plotH}" stroke="#22C55E" stroke-width="1.5" stroke-dasharray="3 3"/>
          <rect x="${Math.max(12, Math.min(w - 135, bx - 58))}" y="${Math.max(6, by - 30)}" width="116" height="20" rx="6" fill="#064E3B" stroke="#22C55E"/>
          <text x="${Math.max(70, Math.min(w - 77, bx))}" y="${Math.max(20, by - 16)}" fill="#86EFAC" font-size="10" font-weight="bold" text-anchor="middle">سربه‌سر در ماه ${faNum(scenario.breakEvenMonth)}</text>
        `;
      })()
    : '';

  return `
    <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="نمودار روند ۱۲ماهه درآمد و هزینه سناریوی آزمایشی" style="width:100%;height:auto;direction:ltr;">
      <defs>
        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#22D3EE" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#22D3EE" stop-opacity="0.01"/>
        </linearGradient>
      </defs>
      ${gridLines}
      <polygon points="${revArea}" fill="url(#revGrad)"/>
      <polyline points="${costPts}" fill="none" stroke="#F59E0B" stroke-width="2.5"/>
      <polyline points="${revPts}" fill="none" stroke="#22D3EE" stroke-width="3"/>
      ${beBadge}
      ${xLabels}
      <text x="${padL}" y="15" fill="#22D3EE" font-size="11" font-weight="bold">● درآمد ماهانه پلتفرم (میلیون تومان)</text>
      <text x="${padL + 225}" y="15" fill="#F59E0B" font-size="11" font-weight="bold">● کل هزینه ثابت و متغیر (میلیون تومان)</text>
    </svg>
  `;
}

/**
 * ۲. نمودار مقایسه ۳ سناریوی مالی (محافظه‌کارانه، پایه، رشد سریع)
 */
export function renderScenarioBarsSvg(scenarios) {
  const list = [scenarios.conservative, scenarios.base, scenarios.growth];
  const maxRev = Math.max(...list.map((s) => s.totalRevenueYear1), 1);
  const w = 640;
  const h = 215;

  const bars = list
    .map((s, idx) => {
      const y = 34 + idx * 58;
      const revWidth = Math.max(18, Math.round((s.totalRevenueYear1 / maxRev) * 330));
      const cashWidth = Math.max(14, Math.round((s.peakCashNeedToman / maxRev) * 330));
      const color = idx === 0 ? '#94A3B8' : idx === 1 ? '#22D3EE' : '#22C55E';
      return `
        <text x="625" y="${y + 13}" fill="#F8FAFC" font-size="11.5" font-weight="bold" text-anchor="end">${s.label}</text>
        <rect x="${435 - revWidth}" y="${y}" width="${revWidth}" height="15" rx="4" fill="${color}"/>
        <text x="${428 - revWidth}" y="${y + 12}" fill="${color}" font-size="10.5" font-weight="bold" text-anchor="end">درآمد سال ۱: ${faMillion(s.totalRevenueYear1)}</text>

        <rect x="${435 - cashWidth}" y="${y + 20}" width="${cashWidth}" height="12" rx="4" fill="#F59E0B" opacity="0.85"/>
        <text x="${428 - cashWidth}" y="${y + 30}" fill="#FDE68A" font-size="10" text-anchor="end">اوج نقدینگی مورد نیاز: ${faMillion(s.peakCashNeedToman)}</text>
      `;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="نمودار مقایسه سه سناریوی دوازده‌ماهه" style="width:100%;height:auto;">
      <text x="625" y="16" fill="#94A3B8" font-size="10.5" text-anchor="end">مقایسه کل درآمد سال اول در برابر حداکثر نیاز نقدینگی تجمعی (سناریوی فرضی — واحد: میلیون تومان)</text>
      ${bars}
    </svg>
  `;
}

/**
 * ۳. نمودار نقطه سربه‌سر و تورنادو تحلیل حساسیت ۶ متغیره
 */
export function renderSensitivityTornadoSvg(sensitivity) {
  const { baseline, levers } = sensitivity;
  const maxSwing = Math.max(
    ...levers.map((l) => Math.max(Math.abs(l.deltaDown), Math.abs(l.deltaUp))),
    10_000_000
  );

  const w = 660;
  const h = 248;
  const centerX = 250;
  const halfSpan = 165;

  const rows = levers
    .map((l, idx) => {
      const y = 38 + idx * 33;
      const wNeg = Math.round((Math.abs(Math.min(0, l.deltaDown)) / maxSwing) * halfSpan);
      const wPos = Math.round((Math.max(0, l.deltaUp) / maxSwing) * halfSpan);
      return `
        <text x="648" y="${y + 13}" fill="#E2E8F0" font-size="11" font-weight="${idx === 0 ? '800' : '500'}" text-anchor="end">${idx === 0 ? '★ ' : ''}${l.label}</text>
        <rect x="${centerX - wNeg}" y="${y}" width="${wNeg}" height="16" rx="3" fill="#EF4444" opacity="0.88"/>
        <rect x="${centerX}" y="${y}" width="${wPos}" height="16" rx="3" fill="#22C55E" opacity="0.9"/>
        <text x="${centerX - wNeg - 5}" y="${y + 12}" fill="#FCA5A5" font-size="9.5" text-anchor="end">${faMillion(l.deltaDown)}</text>
        <text x="${centerX + wPos + 5}" y="${y + 12}" fill="#86EFAC" font-size="9.5" text-anchor="start">+${faMillion(l.deltaUp)}</text>
      `;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="نمودار تورنادو تحلیل حساسیت سود عملیاتی ماهانه" style="width:100%;height:auto;">
      <text x="648" y="18" fill="#94A3B8" font-size="10.5" text-anchor="end">تغییر سود عملیاتی ماهانه به ازای ±۲۰٪ نوسان هر متغیر نسبت به حالت پایه (${faMillion(baseline.opProfit)})</text>
      <line x1="${centerX}" y1="28" x2="${centerX}" y2="${h - 10}" stroke="#94A3B8" stroke-width="1.5" stroke-dasharray="3 3"/>
      ${rows}
    </svg>
  `;
}

/**
 * ۴. نمودار ماتریس دوبعدی جایگاه‌یابی رقبا
 */
export function renderCompetitorMatrixSvg() {
  return `
    <svg viewBox="0 0 560 280" role="img" aria-label="ماتریس جایگاه‌یابی کیفی رقبا در بازار امداد خودرو" style="width:100%;height:auto;background:#080D1A;border-radius:12px;border:1px solid rgba(148,163,184,0.18);">
      <!-- محورها -->
      <line x1="60" y1="145" x2="510" y2="145" stroke="rgba(148,163,184,0.3)" stroke-width="1.5"/>
      <line x1="285" y1="28" x2="285" y2="252" stroke="rgba(148,163,184,0.3)" stroke-width="1.5"/>
      <text x="285" y="18" fill="#22D3EE" font-size="11" font-weight="bold" text-anchor="middle">شفافیت دیجیتال قیمت، ردیابی زنده و پرداخت امن ↑</text>
      <text x="285" y="270" fill="#94A3B8" font-size="10.5" text-anchor="middle">↓ فرآیند تلفنی و قیمت‌گذاری توافقی سنتی</text>
      <text x="505" y="136" fill="#22C55E" font-size="10.5" font-weight="bold" text-anchor="end">تخصص فنی، اعتبارسنجی ناوگان و EV ←</text>
      <text x="65" y="136" fill="#94A3B8" font-size="10.5" text-anchor="start">→ عمومی و بدون احراز تخصصی</text>

      <!-- ربع‌ها -->
      <circle cx="155" cy="205" r="10" fill="#EF4444" opacity="0.85"/>
      <text x="155" y="230" fill="#CBD5E1" font-size="11" text-anchor="middle">یدک‌کش‌های عبوری و شماره تلفن‌های دیواری</text>

      <circle cx="170" cy="95" r="10" fill="#F59E0B" opacity="0.85"/>
      <text x="170" y="75" fill="#CBD5E1" font-size="11" text-anchor="middle">پلتفرم‌های درج آگهی عمومی</text>

      <circle cx="395" cy="192" r="11" fill="#38BDF8" opacity="0.85"/>
      <text x="395" y="216" fill="#CBD5E1" font-size="11" text-anchor="middle">امدادهای سنتی وابسته به خودروسازان</text>

      <circle cx="425" cy="68" r="14" fill="#22C55E" stroke="#22D3EE" stroke-width="3"/>
      <text x="425" y="45" fill="#F8FAFC" font-size="12" font-weight="900" text-anchor="middle">جایگاه هدف «اورژانس خودرو»</text>
    </svg>
  `;
}

/**
 * ۵. نمودار قیف جذب و تبدیل مشتری در استراتژی Go-To-Market
 */
export function renderAcquisitionFunnelSvg(conversionPct = 68) {
  const stages = [
    { label: '۱. مواجهه در لحظه نیاز (جستجو، تعمیرگاه همکار، تابلوی محلی قزوین)', pct: 100, color: '#1E293B', stroke: '#38BDF8' },
    { label: '۲. ورود سریع به وب‌اپ موبایل و انتخاب خودرو و خدمت', pct: 84, color: '#172554', stroke: '#22D3EE' },
    { label: '۳. مشاهده پیش‌فاکتور شفاف تومان در زون مجاز قزوین', pct: 76, color: '#0F3D3E', stroke: '#2DD4BF' },
    { label: '۴. ثبت قطعی، تخصیص امدادگر تأییدشده و تکمیل خدمت', pct: conversionPct, color: '#064E3B', stroke: '#22C55E' },
    { label: '۵. ثبت امتیاز، ذخیره خودرو و تبدیل به مشتری تکرارشونده', pct: Math.round(conversionPct * 0.46), color: '#422006', stroke: '#F59E0B' },
  ];

  const rows = stages
    .map((st, idx) => {
      const y = 14 + idx * 44;
      const barW = Math.round((st.pct / 100) * 520);
      const x = (580 - barW) / 2;
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="34" rx="8" fill="${st.color}" stroke="${st.stroke}" stroke-width="1.5"/>
        <text x="290" y="${y + 21}" fill="#F8FAFC" font-size="11" font-weight="700" text-anchor="middle">${st.label} (${faNum(st.pct)}٪ فرضی)</text>
      `;
    })
    .join('');

  return `
    <svg viewBox="0 0 580 236" role="img" aria-label="نمودار قیف تبدیل مشتری در پایلوت قزوین" style="width:100%;height:auto;">
      ${rows}
    </svg>
  `;
}

/**
 * ۶. ماتریس ریسک ۵×۵ (احتمال × شدت اثر) با قابلیت انتخاب ریسک
 */
export function renderRiskMatrixSvg(risks, activeRiskId) {
  const size = 300;
  const pad = 42;
  const cell = (size - pad - 16) / 5;

  let cells = '';
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const prob = 5 - row; // بالا = احتمال ۵
      const impact = col + 1; // راست‌به‌چپ یا چپ‌به‌راست: چپ=۱، راست=۵
      const score = prob * impact;
      const fill =
        score >= 15
          ? 'rgba(239,68,68,0.24)'
          : score >= 8
            ? 'rgba(245,158,11,0.20)'
            : 'rgba(34,197,94,0.16)';
      const x = pad + col * cell;
      const y = 12 + row * cell;
      cells += `<rect x="${x}" y="${y}" width="${cell - 2}" height="${cell - 2}" rx="4" fill="${fill}" stroke="rgba(148,163,184,0.16)"/>`;
    }
  }

  const nodes = risks
    .map((r, i) => {
      const col = Math.min(4, Math.max(0, r.impact - 1));
      const row = Math.min(4, Math.max(0, 5 - r.prob));
      // کمی جابجایی برای جلوگیری از هم‌پوشانی نقاط هم‌امتیاز
      const offset = (i % 3 - 1) * 9;
      const cx = pad + col * cell + cell / 2 + offset;
      const cy = 12 + row * cell + cell / 2 - offset * 0.5;
      const selected = r.id === activeRiskId;
      return `
        <g data-risk-id="${r.id}" style="cursor:pointer;">
          <circle cx="${cx}" cy="${cy}" r="${selected ? 12 : 9.5}" fill="${selected ? '#22D3EE' : '#0B1020'}" stroke="${selected ? '#FFFFFF' : '#F59E0B'}" stroke-width="2"/>
          <text x="${cx}" y="${cy + 3.5}" fill="${selected ? '#0B1020' : '#F8FAFC'}" font-size="9" font-weight="900" text-anchor="middle">${r.code}</text>
        </g>
      `;
    })
    .join('');

  return `
    <svg viewBox="0 0 320 305" role="img" aria-label="ماتریس احتمال و شدت اثر ریسک‌ها" style="width:100%;max-width:340px;height:auto;margin-inline:auto;">
      ${cells}
      ${nodes}
      <text x="172" y="294" fill="#94A3B8" font-size="10.5" font-weight="bold" text-anchor="middle">شدت اثر ریسک (۱ = کم ← ۵ = بحرانی)</text>
      <text x="14" y="150" fill="#94A3B8" font-size="10.5" font-weight="bold" text-anchor="middle" transform="rotate(-90 14 150)">احتمال وقوع (۱ تا ۵)</text>
    </svg>
  `;
}
