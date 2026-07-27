/**
 * FinCalc Tools - EMI Calculator Engine
 * Calculates Equated Monthly Installments (EMI), total interest, total cost,
 * amortization schedules, and draws high-DPI Canvas charts.
 */

export function calculateEMI({ principal, annualRate, tenure, tenureType = 'years' }) {
  const p = parseFloat(principal) || 0;
  const rate = parseFloat(annualRate) || 0;
  const t = parseFloat(tenure) || 0;

  if (p <= 0 || rate <= 0 || t <= 0) {
    return null;
  }

  const monthlyRate = rate / 100 / 12;
  const totalMonths = tenureType === 'years' ? Math.round(t * 12) : Math.round(t);

  if (totalMonths <= 0) {
    return null;
  }

  // Calculate Monthly EMI
  let emi = 0;
  if (monthlyRate === 0) {
    emi = p / totalMonths;
  } else {
    emi = p * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
  }

  let balance = p;
  let totalInterest = 0;
  const schedule = [];

  for (let m = 1; m <= totalMonths && balance > 0.01; m++) {
    const interestPayment = balance * monthlyRate;
    let principalPayment = emi - interestPayment;

    if (principalPayment > balance) {
      principalPayment = balance;
    }

    balance -= principalPayment;
    totalInterest += interestPayment;

    schedule.push({
      month: m,
      year: Math.ceil(m / 12),
      payment: principalPayment + interestPayment,
      principalPaid: principalPayment,
      interestPaid: interestPayment,
      totalInterestToDate: totalInterest,
      remainingBalance: Math.max(0, balance)
    });
  }

  const totalCost = p + totalInterest;

  return {
    monthlyPayment: emi,
    totalPrincipal: p,
    totalInterest: totalInterest,
    totalCost: totalCost,
    totalMonths: totalMonths,
    schedule: schedule
  };
}

/**
 * Draws Principal vs Interest breakdown donut chart on HTML Canvas
 */
export function drawEMIChart(canvasId, principal, interest) {
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

  const total = principal + interest;
  if (total <= 0) return;

  const principalAngle = (principal / total) * 2 * Math.PI;
  const interestAngle = (interest / total) * 2 * Math.PI;

  ctx.clearRect(0, 0, width, height);

  // Principal Arc (Emerald)
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, principalAngle);
  ctx.arc(centerX, centerY, innerRadius, principalAngle, 0, true);
  ctx.closePath();
  ctx.fillStyle = '#10b981'; // emerald-500
  ctx.fill();

  // Interest Arc (Amber)
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, principalAngle, principalAngle + interestAngle);
  ctx.arc(centerX, centerY, innerRadius, principalAngle + interestAngle, principalAngle, true);
  ctx.closePath();
  ctx.fillStyle = '#f59e0b'; // amber-500
  ctx.fill();

  // Inner text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px Inter, sans-serif';
  
  // Use generic currency formatting helper (e.g. 100,000 without currency symbol so it is clean for any currency)
  ctx.fillText(Math.round(total).toLocaleString(), centerX, centerY - 8);

  ctx.fillStyle = '#64748b';
  ctx.font = '11px Inter, sans-serif';
  ctx.fillText('Total Cost', centerX, centerY + 10);
}
