import { db, doc, getDoc } from './firebase-config.js';

// Comprehensive dictionary of all site tools to support rich dynamic card rendering on the homepage
const TOOLS_REGISTRY = {
  'loan-calculator.html': {
    name: 'Loan & Mortgage',
    desc: 'Calculate loan payments, view complete amortization schedules, and evaluate interest rates.',
    color: 'emerald',
    actionText: 'Calculate Payments',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>'
  },
  'currency-converter.html': {
    name: 'Currency Converter',
    desc: 'Real-time exchange rates powered by central bank data for USD, EUR, INR, GBP, and more.',
    color: 'teal',
    actionText: 'Convert Live Rates',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>'
  },
  'tax-calculator.html': {
    name: 'Income Tax (US & CA)',
    desc: 'Estimate income taxes across federal, state, and provincial tax brackets for US and Canada.',
    color: 'blue',
    actionText: 'Estimate Income Tax',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 14l2-2 4 4m0-6l-4 4-2-2m-2 4h.01M17 16h.01M9 10h.01M12 10h.01M15 10h.01M9 16h.01M12 16h.01M12 6h.01M9 6h.01M15 6h.01M17 6h.01M17 10h.01"></path></svg>'
  },
  'url-shortener.html': {
    name: 'URL Shortener',
    desc: 'Create fast redirect links, track click geolocations, and export QR codes with full statistics.',
    color: 'purple',
    actionText: 'Shorten & Track URLs',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>'
  },
  'emi-calculator.html': {
    name: 'EMI Calculator',
    desc: 'Calculate monthly payments for auto, home, or personal loans with interest breakdowns.',
    color: 'emerald',
    actionText: 'Calculate EMI',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>'
  },
  'sip-calculator.html': {
    name: 'SIP Calculator',
    desc: 'Estimate future returns of Systematic Investment Plans with compound interest projections.',
    color: 'emerald',
    actionText: 'Estimate returns',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>'
  },
  'gst-calculator.html': {
    name: 'GST Calculator',
    desc: 'Calculate Goods and Services Tax with predefined tax slabs and custom percentage rates.',
    color: 'emerald',
    actionText: 'Calculate GST',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 14l2-2 4 4m0-6l-4 4-2-2m-2 4h.01M17 16h.01M9 10h.01M12 10h.01M15 10h.01M9 16h.01M12 16h.01M12 6h.01M9 6h.01M15 6h.01M17 6h.01M17 10h.01"></path></svg>'
  },
  'ppf-fd-rd-calculator.html': {
    name: 'Savings (PPF/FD/RD)',
    desc: 'Compare PPF, Fixed Deposit, and Recurring Deposit returns side-by-side with charts.',
    color: 'emerald',
    actionText: 'Calculate Savings',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 11v-1m0-1c-1.11 0-2.08-.402-2.599-1M12 14v1m-3-2h6"></path></svg>'
  },
  'salary-calculator.html': {
    name: 'Salary Calculator',
    desc: 'Convert annual salary to hourly, bi-weekly, or monthly wage breakdowns with tax estimates.',
    color: 'indigo',
    actionText: 'Convert Salary',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 11v-1m0-1c-1.11 0-2.08-.402-2.599-1M12 14v1m-3-2h6"></path></svg>'
  },
  'invoice-generator.html': {
    name: 'Invoice Generator',
    desc: 'Create, customize, and print professional PDF invoices with dynamic tax and discounts.',
    color: 'purple',
    actionText: 'Create PDF Invoices',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>'
  },
  'roi-calculator.html': {
    name: 'ROI Calculator',
    desc: 'Calculate return on investment, annualized gain rates, and payback periods on business plans.',
    color: 'emerald',
    actionText: 'Evaluate ROI',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>'
  },
  'pdf-tools.html': {
    name: 'PDF Utilities',
    desc: 'Merge multiple PDF documents, split pages, compress sizes, and sign documents securely.',
    color: 'purple',
    actionText: 'Process PDF Files',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>'
  },
  'image-compressor.html': {
    name: 'Image Compressor',
    desc: 'Compress, resize, and optimize PNG, JPG, and WebP images directly in your browser.',
    color: 'purple',
    actionText: 'Compress Images',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>'
  },
  'resume-builder.html': {
    name: 'Resume Builder',
    desc: 'Build, edit, and format professional job resumes with real-time styling and printing tools.',
    color: 'purple',
    actionText: 'Build Free Resume',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>'
  },
  'json-formatter.html': {
    name: 'JSON Formatter',
    desc: 'Format, validate, beautify, and minify JSON code snippets with nested nodes inspection.',
    color: 'indigo',
    actionText: 'Format JSON Code',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>'
  },
  'base64-converter.html': {
    name: 'Base64 Converter',
    desc: 'Encode plain text or assets to Base64 strings and decode strings back to binary files.',
    color: 'indigo',
    actionText: 'Encode / Decode',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>'
  },
  'uuid-hash-generator.html': {
    name: 'UUID & Hash Gen',
    desc: 'Generate cryptographic hash keys (MD5, SHA-1, SHA-256) and unique random UUID strings.',
    color: 'indigo',
    actionText: 'Generate Hash/UUID',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>'
  },
  'regex-tester.html': {
    name: 'Regex Tester',
    desc: 'Write, debug, and test regular expressions in real-time with full search matches highlighting.',
    color: 'indigo',
    actionText: 'Test Regex Syntax',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>'
  },
  'color-converter.html': {
    name: 'Color Converter',
    desc: 'Convert color values between HEX, RGB, HSL, CMYK formats with a live color picker.',
    color: 'indigo',
    actionText: 'Convert Colors',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path></svg>'
  },
  'markdown-editor.html': {
    name: 'Markdown Editor',
    desc: 'Write Markdown markup code and preview the compiled HTML code output in real-time.',
    color: 'indigo',
    actionText: 'Compile Markdown',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>'
  },
  'qr-generator.html': {
    name: 'QR Code Generator',
    desc: 'Build custom vectors and images code scanners for Wi-Fi configurations, vCards, or redirect links.',
    color: 'purple',
    actionText: 'Generate QR codes',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>'
  },
  'password-generator.html': {
    name: 'Password Generator',
    desc: 'Create secure, highly customized passwords with strength indicators and entropy checks.',
    color: 'purple',
    actionText: 'Generate Password',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 0121 9z"></path></svg>'
  },
  'word-counter.html': {
    name: 'Word Counter',
    desc: 'Analyze content length, reading times, sentences, paragraphs, and characters counters.',
    color: 'teal',
    actionText: 'Count Words',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg>'
  },
  'unit-converter.html': {
    name: 'Unit Converter',
    desc: 'Quickly convert metric and imperial units of length, temperature, weight, speed, and volume.',
    color: 'blue',
    actionText: 'Convert Units',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M3 6l3 18h12l3-18H3zm3 4h12M9 14h6"></path></svg>'
  },
  'age-calculator.html': {
    name: 'Age Calculator',
    desc: 'Calculate exact age down to months and days, and countdown to your next birthday.',
    color: 'amber',
    actionText: 'Calculate Age',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>'
  },
  'youtube-thumbnail-downloader.html': {
    name: 'YouTube Thumbnail Downloader',
    desc: 'Extract and download high-resolution cover thumbnails from any public YouTube video link.',
    color: 'rose',
    actionText: 'Download Thumbnails',
    iconHtml: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M15 10l-6 4V10l6 4zm5.7-4.3c-.7-.7-1.8-1-2.9-1H6.2c-1.1 0-2.2.3-2.9 1a3.8 3.8 0 00-1 2.9v6.8c0 1.1.3 2.2 1 2.9a4.2 4.2 0 002.9 1H17.8c1.1 0 2.2-.3 2.9-1a4 4 0 001-2.9V8.6a4.2 4.2 0 00-1-2.9z"></path></svg>'
  }
};

// Default featured tools fallback if Firestore selection is empty or unavailable
const DEFAULT_FEATURED = [
  'loan-calculator.html',
  'currency-converter.html',
  'tax-calculator.html',
  'url-shortener.html'
];

function renderFeaturedGrid(toolsList) {
  const grid = document.getElementById('featured-grid');
  if (!grid) return;

  if (toolsList.length === 0) {
    grid.innerHTML = '<p class="text-slate-400 py-6 text-center col-span-full">No featured tools selected.</p>';
    return;
  }

  grid.innerHTML = toolsList.map(toolId => {
    const t = TOOLS_REGISTRY[toolId];
    if (!t) return ''; // Skip invalid tools

    // Establish card border and hover states depending on colors
    let hoverBorder = 'hover:border-emerald-400';
    let iconBg = 'bg-emerald-50';
    let iconColor = 'text-emerald-600';
    let btnColor = 'text-emerald-600';

    if (t.color === 'teal') {
      hoverBorder = 'hover:border-teal-400';
      iconBg = 'bg-teal-50';
      iconColor = 'text-teal-600';
      btnColor = 'text-teal-600';
    } else if (t.color === 'blue') {
      hoverBorder = 'hover:border-blue-450';
      iconBg = 'bg-blue-50';
      iconColor = 'text-blue-600';
      btnColor = 'text-blue-600';
    } else if (t.color === 'purple') {
      hoverBorder = 'hover:border-purple-400';
      iconBg = 'bg-purple-50';
      iconColor = 'text-purple-650';
      btnColor = 'text-purple-650';
    } else if (t.color === 'indigo') {
      hoverBorder = 'hover:border-indigo-400';
      iconBg = 'bg-indigo-50';
      iconColor = 'text-indigo-650';
      btnColor = 'text-indigo-655';
    } else if (t.color === 'amber') {
      hoverBorder = 'hover:border-amber-400';
      iconBg = 'bg-amber-50';
      iconColor = 'text-amber-600';
      btnColor = 'text-amber-600';
    } else if (t.color === 'rose') {
      hoverBorder = 'hover:border-rose-400';
      iconBg = 'bg-rose-50';
      iconColor = 'text-rose-600';
      btnColor = 'text-rose-600';
    }

    return `
      <a href="${toolId}" class="tool-card group bg-white rounded-2xl p-5 border border-slate-200/70 shadow-2xs hover:shadow-sm ${hoverBorder} hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between font-sans">
        <div>
          <div class="w-10 h-10 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center mb-4 shrink-0 transition-transform group-hover:scale-105 duration-300">
            ${t.iconHtml}
          </div>
          <h3 class="text-sm font-bold text-slate-900 transition-colors">${t.name}</h3>
          <p class="text-[11px] text-slate-400 mt-2 leading-relaxed font-medium">${t.desc}</p>
        </div>
        <div class="mt-5 pt-3 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold ${btnColor}">
          <span>${t.actionText}</span>
          <svg class="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
        </div>
      </a>
    `;
  }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. Instantly load default list of featured tools to prevent loading flashes
  renderFeaturedGrid(DEFAULT_FEATURED);

  // 2. Fetch the custom settings document in Firestore to reflect real-time selections
  const docRef = doc(db, 'settings', 'featured_tools');
  getDoc(docRef).then((snap) => {
    if (snap.exists()) {
      const data = snap.data();
      const tools = data.tools || [];
      if (tools.length > 0) {
        renderFeaturedGrid(tools);
      }
    }
  }).catch((err) => {
    console.warn("[DynamicHomepage] Firestore load failed, serving default fallbacks:", err.message);
  });
});
