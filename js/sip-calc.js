/**
 * FinCalc Tools - SIP Calculator Engine
 * Calculates Systematic Investment Plan (SIP) maturity values,
 * accumulated gains, year-by-year projections, and draws donut charts.
 */

export function calculateSIP({ monthlyInvestment, annualRate, tenureYears }) {
  const p = parseFloat(monthlyInvestment) || 0;
  const rate = parseFloat(annualRate) || 0;
  const years = parseFloat(tenureYears) || 0;

  if (p <= 0 || rate <= 0 || years <= 0) {
    return null;
  }

  const monthlyRate = rate / 100 / 12;
  const totalMonths = Math.round(years * 12);

  if (totalMonths <= 0) {
    return null;
  }

  // SIP formula (payments at the beginning of each month)
  const maturityValue = p * ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate) * (1 + monthlyRate);
  const totalInvested = p * totalMonths;
  const totalGains = maturityValue - totalInvested;

  // Generate Year-by-Year projection schedule
  const schedule = [];
  let accumulatedInvested = 0;
  
  for (let y = 1; y <= Math.ceil(years); y++) {
    const monthsForYear = y === Math.ceil(years) ? (totalMonths - (y - 1) * 12) : 12;
    const currentMonths = (y - 1) * 12 + monthsForYear;
    
    const yearMaturity = p * ((Math.pow(1 + monthlyRate, currentMonths) - 1) / monthlyRate) * (1 + monthlyRate);
    const yearInvested = p * currentMonths;
    const yearGains = yearMaturity - yearInvested;

    schedule.push({
      year: y,
      totalInvested: yearInvested,
      maturityValue: yearMaturity,
      totalGains: yearGains
    });
  }

  return {
    maturityValue,
    totalInvested,
    totalGains,
    totalMonths,
    schedule
  };
}

/**
 * Draws Invested vs Gains breakdown donut chart on HTML Canvas
 */
export function drawSIPChart(canvasId, invested, gains) {
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

  // Gains Arc (Indigo-500)
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, investedAngle, investedAngle + gainsAngle);
  ctx.arc(centerX, centerY, innerRadius, investedAngle + gainsAngle, investedAngle, true);
  ctx.closePath();
  ctx.fillStyle = '#6366f1';
  ctx.fill();

  // Inner text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.fillText(Math.round(total).toLocaleString(), centerX, centerY - 8);

  ctx.fillStyle = '#64748b';
  ctx.font = '11px Inter, sans-serif';
  ctx.fillText('Total Value', centerX, centerY + 10);
}
