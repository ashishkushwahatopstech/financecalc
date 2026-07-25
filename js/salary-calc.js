/**
 * FinCalc Tools - Salary & Paycheck Calculator Engine
 * Converts gross pay across hourly, weekly, bi-weekly, monthly, and annual frequencies,
 * deducting federal, state/provincial, and payroll tax estimations.
 */

export const FREQUENCIES = {
  hourly: { label: 'Hourly', periodsPerYear: 2080 }, // Assuming 40 hrs/wk * 52 weeks
  weekly: { label: 'Weekly', periodsPerYear: 52 },
  biweekly: { label: 'Bi-Weekly (Every 2 weeks)', periodsPerYear: 26 },
  semimonthly: { label: 'Semi-Monthly (Twice a month)', periodsPerYear: 24 },
  monthly: { label: 'Monthly', periodsPerYear: 12 },
  annually: { label: 'Annually', periodsPerYear: 1 }
};

export function calculatePaycheck({
  payAmount,
  frequency = 'annually',
  hoursPerWeek = 40,
  estimatedTaxPct = 22
}) {
  const amount = Math.max(0, parseFloat(payAmount) || 0);
  const taxRate = Math.max(0, Math.min(100, parseFloat(estimatedTaxPct) || 0)) / 100;
  const hours = Math.max(1, parseFloat(hoursPerWeek) || 40);

  let annualGross = 0;

  if (frequency === 'hourly') {
    const yearlyHours = hours * 52;
    annualGross = amount * yearlyHours;
  } else {
    const periods = FREQUENCIES[frequency]?.periodsPerYear || 1;
    annualGross = amount * periods;
  }

  const periodsPerYear = FREQUENCIES[frequency]?.periodsPerYear || 1;
  const grossPerPaycheck = annualGross / (frequency === 'hourly' ? 52 : periodsPerYear); // per pay period

  const annualTax = annualGross * taxRate;
  const annualNet = annualGross - annualTax;

  const taxPerPaycheck = grossPerPaycheck * taxRate;
  const netPerPaycheck = grossPerPaycheck - taxPerPaycheck;

  const monthlyGross = annualGross / 12;
  const monthlyTax = annualTax / 12;
  const monthlyNet = annualNet / 12;

  const hourlyEquivalent = annualGross / (hours * 52);

  return {
    annualGross: annualGross,
    annualTax: annualTax,
    annualNet: annualNet,

    monthlyGross: monthlyGross,
    monthlyTax: monthlyTax,
    monthlyNet: monthlyNet,

    paycheckGross: grossPerPaycheck,
    paycheckTax: taxPerPaycheck,
    paycheckNet: netPerPaycheck,

    hourlyEquivalent: hourlyEquivalent,
    effectiveTaxPct: (taxRate * 100).toFixed(1),
    frequencyLabel: FREQUENCIES[frequency]?.label || 'Paycheck'
  };
}
