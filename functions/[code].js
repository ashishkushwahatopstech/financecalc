/**
 * Cloudflare Pages Function: GET /[code]
 * Dynamic redirect handler for short URLs.
 */
export async function onRequestGet(context) {
  const { request, env, params, next } = context;
  const { code } = params;

  const staticPages = [
    'url-shortener', 'link-stats', 'admin', 'profile', 'index',
    'age-calculator', 'currency-converter', 'invoice-generator',
    'loan-calculator', 'password-generator', 'qr-generator',
    'roi-calculator', 'salary-calculator', 'tax-calculator',
    'unit-converter', 'updates', 'word-counter'
  ];

  // If the code matches assets, static pages, or sub-folders, pass it to next handler
  if (
    !code || 
    code === 'favicon.ico' || 
    code.includes('.') || 
    code === 'functions' || 
    staticPages.includes(code.toLowerCase())
  ) {
    return next();
  }

  const d1 = env.fincalc_urlshortener;
  const kv = env.URL_REDIRECTS;

  if (!d1 || !kv) {
    // If bindings are missing, return a generic error or fallback
    return new Response('Configuration Error: D1 or KV bindings missing.', { status: 500 });
  }

  try {
    // 1. Look up code in KV (fast path)
    let originalUrl = await kv.get(code);
    let linkRecord = null;

    // 2. Query D1 to fetch expiry, ownership, and monetization details
    linkRecord = await d1.prepare('SELECT original_url, expires_at, monetized FROM links WHERE short_code = ?').bind(code).first();

    if (!linkRecord) {
      // If D1 doesn't have it, show Link Not Found page
      return new Response(notFoundHtml(), {
        status: 404,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Update originalUrl just in case KV was empty/out of sync
    originalUrl = linkRecord.original_url;

    // 3. Check expiration
    if (linkRecord.expires_at && linkRecord.expires_at < Date.now()) {
      // Remove from KV if expired
      await kv.delete(code);
      
      return new Response(expiredHtml(), {
        status: 410,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // 4. Gather visitor analytics details
    const clickedAt = Date.now();
    const country = request.cf?.country || 'Unknown';
    const city = request.cf?.city || 'Unknown';
    
    // Referrer
    const referrer = request.headers.get('Referer') || request.headers.get('referer') || '';
    
    // Source Type
    const urlObj = new URL(request.url);
    const hasQrSrc = urlObj.searchParams.get('src') === 'qr';
    
    let sourceType = 'direct';
    if (hasQrSrc) {
      sourceType = 'qr';
    } else if (referrer) {
      try {
        const refUrl = new URL(referrer);
        const host = urlObj.host;
        if (refUrl.host === host) {
          sourceType = 'internal';
        } else {
          sourceType = 'external';
        }
      } catch (e) {
        sourceType = 'external';
      }
    }

    // Device Type
    const ua = request.headers.get('user-agent') || '';
    let deviceType = 'desktop';
    if (/tablet|ipad|playbook|silk/i.test(ua)) {
      deviceType = 'tablet';
    } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
      deviceType = 'mobile';
    }

    // Record click event in D1
    // Table fields: id, short_code, clicked_at, country, city, referrer, source_type, device_type, user_agent
    try {
      await d1.prepare(
        'INSERT INTO clicks (short_code, clicked_at, country, city, referrer, source_type, device_type, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(code, clickedAt, country, city, referrer || 'direct', sourceType, deviceType, ua).run();
    } catch (clickErr) {
      console.error('Error logging click analytics to D1:', clickErr);
    }

    // 5. Issue HTTP redirect with protocol verification
    try {
      const parsedUrl = new URL(originalUrl);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return new Response(notFoundHtml(), {
          status: 404,
          headers: { 'Content-Type': 'text/html' }
        });
      }
    } catch (e) {
      return new Response(notFoundHtml(), {
        status: 404,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // 6. Check if link is monetized (opt-in ads)
    const isMonetized = linkRecord.monetized === 1;
    if (isMonetized) {
      return new Response(mediatorHtml(originalUrl, code), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    return Response.redirect(originalUrl, 302);

  } catch (err) {
    console.error('Redirect handler error:', err);
    return new Response('System redirect error: ' + err.message, { status: 500 });
  }
}

// Friendly "This link has expired" HTML template
function expiredHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Link Expired – FinCalc Tools</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="/src/index.css" />
</head>
<body class="bg-slate-50 text-slate-900 font-sans min-h-screen flex flex-col justify-center items-center p-4">
  <div class="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-xl text-center">
    <div class="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-amber-100">
      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
    </div>
    <h1 class="text-2xl font-black text-slate-900 tracking-tight mb-2">This Link Has Expired</h1>
    <p class="text-xs text-slate-500 mb-6 leading-relaxed">The creator of this link set an expiration date, and it has passed. This link is no longer active.</p>
    <a href="/" class="inline-flex items-center justify-center px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer">Go to FinCalc Tools</a>
  </div>
</body>
</html>`;
}

// Friendly "Link not found" HTML template
function notFoundHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Link Not Found – FinCalc Tools</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="/src/index.css" />
</head>
<body class="bg-slate-50 text-slate-900 font-sans min-h-screen flex flex-col justify-center items-center p-4">
  <div class="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-xl text-center">
    <div class="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-rose-100">
      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
    </div>
    <h1 class="text-2xl font-black text-slate-900 tracking-tight mb-2">Short Link Not Found</h1>
    <p class="text-xs text-slate-500 mb-6 leading-relaxed">The link you are trying to reach does not exist or has been deleted by its owner.</p>
    <a href="/" class="inline-flex items-center justify-center px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer">Go to FinCalc Tools</a>
  </div>
</body>
</html>`;
}

// Interstitial Ad / Transition Page HTML template
function mediatorHtml(originalUrl, shortCode) {
  // Convert URL to base64 to avoid crawlers or scrapers parsing it from source code
  const base64Url = typeof btoa === 'function' ? btoa(originalUrl) : Buffer.from(originalUrl).toString('base64');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redirecting... – FinCalc Tools</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="/src/index.css" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
    body {
      font-family: 'Outfit', sans-serif;
    }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 min-h-screen flex flex-col justify-between antialiased selection:bg-indigo-500/10 selection:text-indigo-600">

  <!-- Sticky Top Countdown Bar -->
  <div class="sticky top-0 z-50 bg-slate-900 text-white border-b border-slate-800 shadow-md">
    <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
      <div class="flex items-center gap-2.5">
        <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
        <span class="text-xs font-semibold text-slate-300">Link Sponsored by FinCalc Tools</span>
      </div>
      <div class="flex items-center gap-3">
        <span id="countdown-status" class="text-xs font-bold bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl flex items-center gap-2">
          <svg class="w-3.5 h-3.5 text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          <span>Please wait <strong id="timer-sec" class="text-indigo-400 text-sm">5</strong>s...</span>
        </span>
        <span id="scroll-status" class="text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-500 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 13l-7 7-7-7m14-6l-7 7-7-7"></path></svg>
          <span>Scroll to bottom</span>
        </span>
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <main class="flex-grow max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
    <div class="text-center space-y-2.5 py-4">
      <h1 class="text-3xl font-black tracking-tight text-slate-900">Your destination link is almost ready</h1>
      <p class="text-sm text-slate-500 max-w-lg mx-auto">Explore sponsored articles and highlights from our community while the system secures your destination link redirection.</p>
    </div>

    <!-- Advertisements Grid (Dynamic blog posts from aktechstudio.com) -->
    <div class="space-y-4">
      <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-2">Sponsored Articles</h3>
      <div id="articles-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Skeleton Loaders -->
        <div class="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-4 animate-pulse">
          <div class="w-full h-36 bg-slate-100 rounded-2xl"></div>
          <div class="h-4 bg-slate-100 rounded-md w-3/4"></div>
          <div class="h-3 bg-slate-100 rounded-md w-5/6"></div>
          <div class="h-3 bg-slate-100 rounded-md w-2/3"></div>
        </div>
        <div class="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-4 animate-pulse">
          <div class="w-full h-36 bg-slate-100 rounded-2xl"></div>
          <div class="h-4 bg-slate-100 rounded-md w-3/4"></div>
          <div class="h-3 bg-slate-100 rounded-md w-5/6"></div>
          <div class="h-3 bg-slate-100 rounded-md w-2/3"></div>
        </div>
        <div class="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-4 animate-pulse">
          <div class="w-full h-36 bg-slate-100 rounded-2xl"></div>
          <div class="h-4 bg-slate-100 rounded-md w-3/4"></div>
          <div class="h-3 bg-slate-100 rounded-md w-5/6"></div>
          <div class="h-3 bg-slate-100 rounded-md w-2/3"></div>
        </div>
      </div>
    </div>

    <!-- Redirection Action Card -->
    <div class="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-md text-center max-w-xl mx-auto space-y-5">
      <div class="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
      </div>
      <div class="space-y-1">
        <h2 class="text-lg font-bold text-slate-800">Final Redirection Link</h2>
        <p class="text-xs text-slate-400 leading-relaxed">Scroll to the bottom of the page to unlock the proceed button.</p>
      </div>
      <button id="btn-proceed" disabled class="w-full py-4 bg-slate-200 text-slate-400 border border-slate-300 font-bold text-sm rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 opacity-50 cursor-not-allowed">
        <span>Skip & Proceed &rarr;</span>
      </button>
    </div>
  </main>

  <!-- Footer -->
  <footer class="bg-slate-900 text-slate-400 text-xs border-t border-slate-800 mt-16 py-8 px-4 text-center">
    <div class="max-w-7xl mx-auto space-y-2">
      <p>&copy; ${new Date().getFullYear()} FinCalc Tools. All rights reserved. Powered by Firebase Auth & Firestore.</p>
      <p class="text-[10px] text-slate-600 font-medium">You are seeing this page because this link is monetized by its owner.</p>
    </div>
  </footer>

  <script>
    let secondsLeft = 5;
    let hasScrolledToBottom = false;
    let timerFinished = false;

    const timerSec = document.getElementById('timer-sec');
    const countdownStatus = document.getElementById('countdown-status');
    const scrollStatus = document.getElementById('scroll-status');
    const btnProceed = document.getElementById('btn-proceed');

    // 1. Start countdown
    const interval = setInterval(() => {
      secondsLeft--;
      if (secondsLeft <= 0) {
        clearInterval(interval);
        timerSec.textContent = '0';
        timerFinished = true;
        
        countdownStatus.className = 'text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 px-3 py-1.5 rounded-xl flex items-center gap-1.5';
        countdownStatus.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Timer completed</span>';
        
        checkActivation();
      } else {
        timerSec.textContent = secondsLeft;
      }
    }, 1000);

    // 2. Track Scroll to Bottom
    window.addEventListener('scroll', () => {
      // Check if user scrolled to bottom of the page
      if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 60) {
        if (!hasScrolledToBottom) {
          hasScrolledToBottom = true;
          
          scrollStatus.className = 'text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 px-3 py-1.5 rounded-xl flex items-center gap-1.5';
          scrollStatus.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Scrolled to bottom</span>';
          
          checkActivation();
        }
      }
    });

    // Check if both conditions are met
    function checkActivation() {
      if (timerFinished && hasScrolledToBottom) {
        btnProceed.disabled = false;
        btnProceed.className = 'w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2';
        btnProceed.innerHTML = '<span>Skip & Proceed &rarr;</span>';
      }
    }

    // Redirect handler
    btnProceed.addEventListener('click', () => {
      // Decode destination URL from base64 to prevent scraper indexing
      const dest = atob("${base64Url}");
      window.location.href = dest;
    });

    // 3. Fetch public blog posts dynamically from Firestore REST API (aktechstudio.com posts)
    async function loadSponsoredArticles() {
      const container = document.getElementById('articles-container');
      const url = 'https://firestore.googleapis.com/v1/projects/finance-calc-by-ak/databases/(default)/documents/blog_posts';
      
      try {
        const res = await fetch(url);
        if (res.status === 200) {
          const data = await res.json();
          const docs = data.documents || [];
          
          // Filter public published posts
          const posts = docs
            .map(d => {
              const fields = d.fields || {};
              const id = d.name.split('/').pop();
              return {
                id,
                title: fields.title?.stringValue || '',
                body: fields.body?.stringValue || '',
                featuredImage: fields.featuredImage?.stringValue || '',
                published: fields.published?.booleanValue || false,
                status: fields.status?.stringValue || ''
              };
            })
            .filter(p => p.published && p.status === 'public')
            .slice(0, 6); // Take top 6
          
          if (posts.length === 0) {
            container.innerHTML = '<p class="col-span-full text-slate-400 py-6 text-center text-xs">No articles available at this time.</p>';
            return;
          }

          container.innerHTML = posts.map(p => {
            const hasImage = p.featuredImage && (p.featuredImage.startsWith('http://') || p.featuredImage.startsWith('https://'));
            const desc = p.body.substring(0, 100).trim() + '...';
            const slugTitle = p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
            const postUrl = '/blog/' + p.id + '-' + slugTitle;

            let itemHtml = '';
            itemHtml += '<div class="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-shadow">';
            itemHtml += '  <div class="space-y-4">';
            if (hasImage) {
              itemHtml += '    <div class="w-full h-36 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100">';
              itemHtml += '      <img src="' + p.featuredImage + '" alt="' + p.title + '" class="w-full h-full object-cover" onerror="this.parentElement.remove()" />';
              itemHtml += '    </div>';
            }
            itemHtml += '    <h4 class="font-bold text-slate-900 text-sm leading-snug">' + p.title + '</h4>';
            itemHtml += '    <p class="text-[11px] text-slate-400 leading-relaxed">' + desc + '</p>';
            itemHtml += '  </div>';
            itemHtml += '  <div class="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-indigo-600">';
            itemHtml += '    <a href="' + postUrl + '" target="_blank" class="hover:underline flex items-center gap-1">';
            itemHtml += '      <span>Read Article</span>';
            itemHtml += '      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>';
            itemHtml += '    </a>';
            itemHtml += '  </div>';
            itemHtml += '</div>';

            return itemHtml;
          }).join('');

        } else {
          throw new Error('API return status: ' + res.status);
        }
      } catch (err) {
        console.warn('Failed to load articles:', err);
        container.innerHTML = '<p class="col-span-full text-slate-400 py-6 text-center text-xs">Failed to load sponsored updates.</p>';
      }
    }

    loadSponsoredArticles();
  </script>
</body>
</html>`;
}
