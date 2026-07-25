/**
 * FinCalc Tools - US & Canada Income Tax Calculator Engine
 * Calculates progressive federal tax brackets, state/provincial estimates,
 * social payroll taxes (FICA / CPP + EI), effective and marginal tax rates.
 */

export const US_STATES = [
  { code: 'NO_STATE', name: 'No State Tax (TX, FL, WA, NV, TN, etc.)', rate: 0.0 },
  { code: 'CA', name: 'California (Estimated ~8%)', rate: 0.08 },
  { code: 'NY', name: 'New York (Estimated ~6.5%)', rate: 0.065 },
  { code: 'IL', name: 'Illinois (Flat 4.95%)', rate: 0.0495 },
  { code: 'PA', name: 'Pennsylvania (Flat 3.07%)', rate: 0.0307 },
  { code: 'NJ', name: 'New Jersey (Estimated ~6.0%)', rate: 0.06 },
  { code: 'MA', name: 'Massachusetts (Flat 5.0%)', rate: 0.05 },
  { code: 'OTHER', name: 'Other State (Avg ~5.0%)', rate: 0.05 }
];

export const CA_PROVINCES = [
  { code: 'ON', name: 'Ontario (Est. ~9%)', rate: 0.09 },
  { code: 'QC', name: 'Quebec (Est. ~14%)', rate: 0.14 },
  { code: 'BC', name: 'British Columbia (Est. ~7.7%)', rate: 0.077 },
  { code: 'AB', name: 'Alberta (Est. ~10%)', rate: 0.10 },
  { code: 'MB', name: 'Manitoba (Est. ~10.8%)', rate: 0.108 },
  { code: 'NS', name: 'Nova Scotia (Est. ~11.5%)', rate: 0.115 }
];

// US Federal Brackets 2025/2026
const US_BRACKETS = {
  single: [
    { min: 0, max: 11925, rate: 0.10 },
    { min: 11925, max: 48475, rate: 0.12 },
    { min: 48475, max: 103350, rate: 0.22 },
    { min: 103350, max: 197300, rate: 0.24 },
    { min: 197300, max: 250525, rate: 0.32 },
    { min: 250525, max: 626350, rate: 0.35 },
    { min: 626350, max: Infinity, rate: 0.37 }
  ],
  married: [
    { min: 0, max: 23850, rate: 0.10 },
    { min: 23850, max: 96950, rate: 0.12 },
    { min: 96950, max: 206700, rate: 0.22 },
    { min: 206700, max: 394600, rate: 0.24 },
    { min: 394600, max: 501050, rate: 0.32 },
    { min: 501050, max: 751600, rate: 0.35 },
    { min: 751600, max: Infinity, rate: 0.37 }
  ],
  head: [
    { min: 0, max: 17000, rate: 0.10 },
    { min: 17000, max: 64850, rate: 0.12 },
    { min: 64850, max: 103350, rate: 0.22 },
    { min: 103350, max: 197300, rate: 0.24 },
    { min: 197300, max: 250500, rate: 0.32 },
    { min: 250500, max: 626350, rate: 0.35 },
    { min: 626350, max: Infinity, rate: 0.37 }
  ]
};

const US_STANDARD_DEDUCTION = {
  single: 14600,
  married: 29200,
  head: 21900
};

// Canada Federal Brackets 2025/2026
const CA_BRACKETS = [
  { min: 0, max: 55867, rate: 0.15 },
  { min: 55867, max: 111733, rate: 0.205 },
  { min: 111733, max: 173205, rate: 0.26 },
  { min: 173205, max: 246752, rate: 0.29 },
  { min: 246752, max: Infinity, rate: 0.33 }
];
const CA_BASIC_PERSONAL_AMOUNT = 15705;

/**
 * Calculate US Tax
 */
export function calculateUsTax({ grossIncome, filingStatus = 'single', stateCode = 'NO_STATE', customDeduction = 0 }) {
  const income = Math.max(0, parseFloat(grossIncome) || 0);
  const stdDeduction = US_STANDARD_DEDUCTION[filingStatus] || 14600;
  const userDeduction = parseFloat(customDeduction) || 0;
  const totalDeduction = Math.max(stdDeduction, userDeduction);

  const taxableIncome = Math.max(0, income - totalDeduction);
  const brackets = US_BRACKETS[filingStatus] || US_BRACKETS.single;

  let federalTax = 0;
  let marginalRate = 0;
  const bracketBreakdown = [];

  for (const b of brackets) {
    if (taxableIncome > b.min) {
      const taxableChunk = Math.min(taxableIncome, b.max) - b.min;
      const taxForChunk = taxableChunk * b.rate;
      federalTax += taxForChunk;
      marginalRate = b.rate;
      bracketBreakdown.push({
        ratePct: (b.rate * 100).toFixed(1) + '%',
        min: b.min,
        max: b.max === Infinity ? 'Over ' + b.min : b.max,
        taxableChunk: taxableChunk,
        taxAmount: taxForChunk
      });
    }
  }

  // State Tax Estimate
  const selectedState = US_STATES.find(s => s.code === stateCode) || US_STATES[0];
  const stateTax = taxableIncome * selectedState.rate;

  // FICA (Social Security 6.2% up to $168,600 + Medicare 1.45%)
  const socialSecurity = Math.min(income, 168600) * 0.062;
  const medicare = income * 0.0145;
  const ficaTax = socialSecurity + medicare;

  const totalTax = federalTax + stateTax + ficaTax;
  const netIncome = income - totalTax;
  const effectiveRate = income > 0 ? (totalTax / income) * 100 : 0;

  return {
    country: 'US',
    grossIncome: income,
    standardDeduction: totalDeduction,
    taxableIncome: taxableIncome,
    federalTax: federalTax,
    stateTax: stateTax,
    payrollTax: ficaTax, // FICA
    totalTax: totalTax,
    netIncome: netIncome,
    effectiveRatePct: effectiveRate.toFixed(2),
    marginalRatePct: (marginalRate * 100).toFixed(1),
    bracketBreakdown: bracketBreakdown
  };
}

/**
 * Calculate Canada Tax
 */
export function calculateCanadaTax({ grossIncome, provinceCode = 'ON', customDeduction = 0 }) {
  const income = Math.max(0, parseFloat(grossIncome) || 0);
  const basicPersonal = CA_BASIC_PERSONAL_AMOUNT;
  const userDeduction = parseFloat(customDeduction) || 0;
  const totalDeduction = basicPersonal + userDeduction;

  const taxableIncome = Math.max(0, income - totalDeduction);

  let federalTax = 0;
  let marginalRate = 0;
  const bracketBreakdown = [];

  for (const b of CA_BRACKETS) {
    if (taxableIncome > b.min) {
      const taxableChunk = Math.min(taxableIncome, b.max) - b.min;
      const taxForChunk = taxableChunk * b.rate;
      federalTax += taxForChunk;
      marginalRate = b.rate;
      bracketBreakdown.push({
        ratePct: (b.rate * 100).toFixed(1) + '%',
        min: b.min,
        max: b.max === Infinity ? 'Over ' + b.min : b.max,
        taxableChunk: taxableChunk,
        taxAmount: taxForChunk
      });
    }
  }

  // Provincial Estimate
  const selectedProvince = CA_PROVINCES.find(p => p.code === provinceCode) || CA_PROVINCES[0];
  const provincialTax = taxableIncome * selectedProvince.rate;

  // CPP (5.95%) + EI (1.66%) Estimate
  const cppTax = Math.min(income, 68500) * 0.0595;
  const eiTax = Math.min(income, 63200) * 0.0166;
  const payrollTax = cppTax + eiTax;

  const totalTax = federalTax + provincialTax + payrollTax;
  const netIncome = income - totalTax;
  const effectiveRate = income > 0 ? (totalTax / income) * 100 : 0;

  return {
    country: 'CA',
    grossIncome: income,
    standardDeduction: totalDeduction,
    taxableIncome: taxableIncome,
    federalTax: federalTax,
    stateTax: provincialTax, // Provincial
    payrollTax: payrollTax, // CPP + EI
    totalTax: totalTax,
    netIncome: netIncome,
    effectiveRatePct: effectiveRate.toFixed(2),
    marginalRatePct: (marginalRate * 100).toFixed(1),
    bracketBreakdown: bracketBreakdown
  };
}
