/**
 * FinCalc Tools - PPF / FD / RD Calculator Engine
 * Calculates Public Provident Fund, Fixed Deposit, and Recurring Deposit returns,
 * year-by-year projections, and draws donut charts.
 */

/**
 * Public Provident Fund (PPF) returns calculation
 * PPF interest compounds annually at the end of each financial year.
 * Frequency: 'monthly' or 'yearly'
 */
export function calculatePPF({ deposit, annualRate, years, frequency = 'yearly' }) {
  const dep = parseFloat(deposit) || 0;
  const rate = parseFloat(annualRate) || 0;
  const t = parseInt(years) || 15;

  if (dep <= 0 || rate <= 0 || t <= 0) return null;

  const r = rate / 100;
  let balance = 0;
  let totalInvested = 0;
  let totalInterest = 0;
  const schedule = [];

  for (let y = 1; y <= t; y++) {
    let yearInvested = 0;
    let yearInterest = 0;

    if (frequency === 'yearly') {
      // Annual deposit at start of year
      yearInvested = dep;
      balance += dep;
      yearInterest = balance * r;
      balance += yearInterest;
    } else {
      // Monthly deposits (12 deposits throughout the year)
      for (let m = 1; m <= 12; m++) {
        yearInvested += dep;
        balance += dep;
        // Simple monthly interest on current balance (compounded at year-end)
        yearInterest += balance * (r / 12);
      }
      balance += yearInterest;
    }

    totalInvested += yearInvested;
    totalInterest += yearInterest;

    schedule.push({
      year: y,
      totalInvested: totalInvested,
      totalInterest: totalInterest,
      maturityValue: balance
    });
  }

  return {
    totalInvested,
    totalInterest,
    maturityValue: balance,
    schedule
  };
}

/**
 * Fixed Deposit (FD) returns calculation
 * Compounding: 'quarterly' (standard), 'monthly', 'half-yearly', 'yearly', 'simple'
 */
export function calculateFD({ principal, annualRate, years, compounding = 'quarterly' }) {
  const p = parseFloat(principal) || 0;
  const rate = parseFloat(annualRate) || 0;
  const t = parseFloat(years) || 1;

  if (p <= 0 || rate <= 0 || t <= 0) return null;

  const r = rate / 100;
  let maturityValue = 0;

  if (compounding === 'simple') {
    maturityValue = p * (1 + r * t);
  } else {
    let n = 4; // default quarterly
    if (compounding === 'monthly') n = 12;
    else if (compounding === 'half-yearly') n = 2;
    else if (compounding === 'yearly') n = 1;

    maturityValue = p * Math.pow(1 + r / n, n * t);
  }

  const totalInvested = p;
  const totalInterest = maturityValue - p;

  // Generate Year-by-Year schedule
  const schedule = [];
  for (let y = 1; y <= Math.ceil(t); y++) {
    const currentYears = y === Math.ceil(t) ? t : y;
    let yearMaturity = 0;

    if (compounding === 'simple') {
      yearMaturity = p * (1 + r * currentYears);
    } else {
      let n = 4;
      if (compounding === 'monthly') n = 12;
      else if (compounding === 'half-yearly') n = 2;
      else if (compounding === 'yearly') n = 1;

      yearMaturity = p * Math.pow(1 + r / n, n * currentYears);
    }

    schedule.push({
      year: y,
      totalInvested: p,
      totalInterest: yearMaturity - p,
      maturityValue: yearMaturity
    });
  }

  return {
    totalInvested,
    totalInterest,
    maturityValue,
    schedule
  };
}

/**
 * Recurring Deposit (RD) returns calculation
 * RD interest is compounded quarterly as per standard Indian banking rules.
 */
export function calculateRD({ monthlyDeposit, annualRate, years }) {
  const p = parseFloat(monthlyDeposit) || 0;
  const rate = parseFloat(annualRate) || 0;
  const t = parseFloat(years) || 1;

  if (p <= 0 || rate <= 0 || t <= 0) return null;

  const r = rate / 100;
  const totalMonths = Math.round(t * 12);
  let balance = 0;
  let totalInvested = 0;
  let accumulatedInterest = 0;

  // Track compounding quarterly (every 3 months)
  let quarterBalance = 0;
  const schedule = [];

  for (let m = 1; m <= totalMonths; m++) {
    totalInvested += p;
    balance += p;
    
    // Calculate simple interest on current balance for the month
    // Standard RD interest calculation compounds quarterly
    quarterBalance += balance * (r / 12);

    if (m % 3 === 0 || m === totalMonths) {
      balance += quarterBalance;
      accumulatedInterest += quarterBalance;
      quarterBalance = 0;
    }

    // Capture yearly milestones for schedule table
    if (m % 12 === 0 || m === totalMonths) {
      schedule.push({
        year: Math.ceil(m / 12),
        totalInvested: totalInvested,
        totalInterest: accumulatedInterest + quarterBalance,
        maturityValue: balance + quarterBalance
      });
    }
  }

  return {
    totalInvested,
    totalInterest: accumulatedInterest,
    maturityValue: balance,
    schedule
  };
}

/**
 * Draws Invested vs Interest breakdown donut chart on HTML Canvas
 */
export function drawSavingsChart(canvasId, invested, gains) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY) - 20;
  const innerRadius = radius * 0.62;

  const total = invested + gains;
  if (total <= 0) return;

  const investedAngle = (invested / total) * 2 * Math.PI;
  const gainsAngle = (gains / total) * 2 * Math.PI;

  ctx.clearRect(0, 0, width, height);

  // Invested Arc (Emerald-500)
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, investedAngle);
  ctx.arc(centerX, centerY, innerRadius, investedAngle, 0, true);
  ctx.closePath();
  ctx.fillStyle = '#10b981';
  ctx.fill();

  // Gains Arc (Amber-500)
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, investedAngle, investedAngle + gainsAngle);
  ctx.arc(centerX, centerY, innerRadius, investedAngle + gainsAngle, investedAngle, true);
  ctx.closePath();
  ctx.fillStyle = '#f59e0b';
  ctx.fill();

  // Inner text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.fillText(Math.round(total).toLocaleString(), centerX, centerY - 8);

  ctx.fillStyle = '#64748b';
  ctx.font = '11px Inter, sans-serif';
  ctx.fillText('Maturity Value', centerX, centerY + 10);
}
