/**
 * FinCalc Tools - GST Calculator Engine
 * Calculates Add GST/Remove GST amounts, CGST/SGST splits,
 * and renders breakdown Canvas charts.
 */

export function calculateGST({ amount, gstRate, isAddGST }) {
  const a = parseFloat(amount) || 0;
  const rate = parseFloat(gstRate) || 0;

  if (a <= 0 || rate < 0) {
    return null;
  }

  let netAmount = 0;
  let gstAmount = 0;
  let grossAmount = 0;

  if (isAddGST) {
    netAmount = a;
    gstAmount = a * (rate / 100);
    grossAmount = a + gstAmount;
  } else {
    grossAmount = a;
    netAmount = a / (1 + (rate / 100));
    gstAmount = grossAmount - netAmount;
  }

  const cgst = gstAmount / 2;
  const sgst = gstAmount / 2;

  return {
    netAmount,
    gstAmount,
    grossAmount,
    cgst,
    sgst,
    rate
  };
}

/**
 * Draws Net vs Tax breakdown donut chart on HTML Canvas
 */
export function drawGSTChart(canvasId, net, tax) {
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

  const total = net + tax;
  if (total <= 0) return;

  const netAngle = (net / total) * 2 * Math.PI;
  const taxAngle = (tax / total) * 2 * Math.PI;

  ctx.clearRect(0, 0, width, height);

  // Net Amount Arc (Emerald-500)
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, netAngle);
  ctx.arc(centerX, centerY, innerRadius, netAngle, 0, true);
  ctx.closePath();
  ctx.fillStyle = '#10b981';
  ctx.fill();

  // Tax Arc (Amber-500)
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, netAngle, netAngle + taxAngle);
  ctx.arc(centerX, centerY, innerRadius, netAngle + taxAngle, netAngle, true);
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
  ctx.fillText('Gross Value', centerX, centerY + 10);
}
