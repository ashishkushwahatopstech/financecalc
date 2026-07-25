/**
 * FinCalc Tools - ROI & Investment Calculator Engine
 * Calculates compound interest with periodic contributions and renders high-DPI Canvas charts.
 */

export function calculateRoi({
  initialInvestment,
  monthlyContribution = 0,
  annualReturnRate,
  investmentTermYears,
  compoundFrequency = '12' // 12 = Monthly, 1 = Annually
}) {
  const p = Math.max(0, parseFloat(initialInvestment) || 0);
  const pmt = Math.max(0, parseFloat(monthlyContribution) || 0);
  const r = Math.max(0, parseFloat(annualReturnRate) || 0) / 100;
  const years = Math.max(1, parseInt(investmentTermYears) || 1);
  const n = parseInt(compoundFrequency) || 12;

  let totalBalance = p;
  let totalInvested = p;
  const yearlySchedule = [];

  const periodicRate = r / n;

  for (let y = 1; y <= years; y++) {
    for (let period = 1; period <= n; period++) {
      // Add monthly contribution if compounding monthly, or aggregate monthly contributions
      const contributionPerPeriod = (pmt * 12) / n;
      totalBalance += contributionPerPeriod;
      totalInvested += contributionPerPeriod;
      
      const interestEarned = totalBalance * periodicRate;
      totalBalance += interestEarned;
    }

    const totalInterestToDate = totalBalance - totalInvested;

    yearlySchedule.push({
      year: y,
      totalInvested: totalInvested,
      totalInterest: totalInterestToDate,
      endBalance: totalBalance
    });
  }

  const totalInterestEarned = totalBalance - totalInvested;
  const roiPercentage = totalInvested > 0 ? (totalInterestEarned / totalInvested) * 100 : 0;

  return {
    finalBalance: totalBalance,
    totalInvested: totalInvested,
    totalInterestEarned: totalInterestEarned,
    roiPercentagePct: roiPercentage.toFixed(2),
    years: years,
    yearlySchedule: yearlySchedule
  };
}

/**
 * Draws Growth Chart on Canvas
 */
export function drawRoiChart(canvasId, yearlySchedule) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !yearlySchedule || yearlySchedule.length === 0) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;

  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 40;

  const graphWidth = width - paddingLeft - paddingRight;
  const graphHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(...yearlySchedule.map(s => s.endBalance)) * 1.1;

  ctx.clearRect(0, 0, width, height);

  // Axes lines
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;

  // Gridlines
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const yVal = (graphHeight / gridSteps) * i;
    const yPos = paddingTop + yVal;

    ctx.beginPath();
    ctx.moveTo(paddingLeft, yPos);
    ctx.lineTo(width - paddingRight, yPos);
    ctx.stroke();

    const valLabel = Math.round(maxVal - (maxVal / gridSteps) * i);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`$${(valLabel / 1000).toFixed(0)}k`, paddingLeft - 8, yPos + 3);
  }

  const numPoints = yearlySchedule.length;
  const stepX = graphWidth / Math.max(1, numPoints - 1);

  // Draw Stacked Area - Interest Portion (Emerald gradient)
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop + graphHeight);

  yearlySchedule.forEach((pt, idx) => {
    const x = paddingLeft + idx * stepX;
    const y = paddingTop + graphHeight - (pt.endBalance / maxVal) * graphHeight;
    ctx.lineTo(x, y);
  });

  ctx.lineTo(paddingLeft + (numPoints - 1) * stepX, paddingTop + graphHeight);
  ctx.closePath();

  const interestGrad = ctx.createLinearGradient(0, paddingTop, 0, height - paddingBottom);
  interestGrad.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
  interestGrad.addColorStop(1, 'rgba(16, 185, 129, 0.05)');
  ctx.fillStyle = interestGrad;
  ctx.fill();

  // Draw Stacked Area - Principal Invested (Slate Blue)
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop + graphHeight);

  yearlySchedule.forEach((pt, idx) => {
    const x = paddingLeft + idx * stepX;
    const y = paddingTop + graphHeight - (pt.totalInvested / maxVal) * graphHeight;
    ctx.lineTo(x, y);
  });

  ctx.lineTo(paddingLeft + (numPoints - 1) * stepX, paddingTop + graphHeight);
  ctx.closePath();

  const principalGrad = ctx.createLinearGradient(0, paddingTop, 0, height - paddingBottom);
  principalGrad.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
  principalGrad.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
  ctx.fillStyle = principalGrad;
  ctx.fill();

  // Draw Line - End Balance
  ctx.beginPath();
  yearlySchedule.forEach((pt, idx) => {
    const x = paddingLeft + idx * stepX;
    const y = paddingTop + graphHeight - (pt.endBalance / maxVal) * graphHeight;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#059669';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Draw X Axis Year Labels
  ctx.fillStyle = '#64748b';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  yearlySchedule.forEach((pt, idx) => {
    if (numPoints > 10 && idx % 2 !== 0 && idx !== numPoints - 1) return; // skip alternate for dense
    const x = paddingLeft + idx * stepX;
    ctx.fillText(`Yr ${pt.year}`, x, height - paddingBottom + 16);
  });
}
