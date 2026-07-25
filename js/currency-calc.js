/**
 * FinCalc Tools - Currency Converter Engine
 * Fetches live exchange rates using the free Frankfurter API (https://api.frankfurter.app)
 */

let rateCache = {};
let lastFetchTime = 0;

export const POPULAR_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', flag: '🇨🇦' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', flag: '🇳🇿' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', flag: '🇭🇰' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'Mex$', flag: '🇲🇽' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', flag: '🇧🇷' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '🇿🇦' }
];

/**
 * Fetch latest rates from Frankfurter API
 * @param {string} baseCurrency 
 */
export async function fetchRates(baseCurrency = 'USD') {
  const now = Date.now();
  if (rateCache[baseCurrency] && (now - lastFetchTime < 10 * 60 * 1000)) {
    return rateCache[baseCurrency];
  }

  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${baseCurrency}`).catch(() => null);
    if (!res || !res.ok) throw new Error("Network request failed or blocked");
    const data = await res.json();
    rateCache[baseCurrency] = data;
    lastFetchTime = now;
    return data;
  } catch (err) {
    console.warn("Frankfurter API error, using static fallback rates:", err);
    // Fallback static conversion matrix if network API is blocked
    return getFallbackRates(baseCurrency);
  }
}

/**
 * Fallback rate dictionary in case of offline / blocked network
 */
function getFallbackRates(base) {
  const usdRates = {
    EUR: 0.92, GBP: 0.78, CAD: 1.38, AUD: 1.52, JPY: 155.2,
    INR: 84.50, CHF: 0.88, CNY: 7.24, NZD: 1.65, SGD: 1.34,
    HKD: 7.82, MXN: 18.20, BRL: 5.60, ZAR: 18.10, USD: 1.0
  };
  
  const baseUsd = usdRates[base] || 1.0;
  const converted = {};
  Object.keys(usdRates).forEach(code => {
    converted[code] = parseFloat((usdRates[code] / baseUsd).toFixed(4));
  });

  return {
    amount: 1,
    base: base,
    date: new Date().toISOString().split('T')[0],
    rates: converted
  };
}

/**
 * Convert Currency Amount
 */
export async function convertCurrency(amount, fromCurr, toCurr) {
  if (fromCurr === toCurr) {
    return {
      convertedAmount: amount,
      rate: 1.0,
      from: fromCurr,
      to: toCurr,
      date: new Date().toISOString().split('T')[0]
    };
  }

  const ratesData = await fetchRates(fromCurr);
  const rate = ratesData.rates[toCurr] || 1.0;
  const converted = amount * rate;

  return {
    convertedAmount: converted,
    rate: rate,
    from: fromCurr,
    to: toCurr,
    date: ratesData.date
  };
}
