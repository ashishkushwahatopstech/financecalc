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
  const base64Url = btoa(originalUrl);

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
    /* Dynamic Blogger feed image and article styling inside native container */
    #ad-content img {
      max-width: 100%;
      height: auto;
      border-radius: 1.25rem;
      margin: 1.75rem auto;
      display: block;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
    }
    #ad-content p {
      font-size: 1rem;
      line-height: 1.8;
      color: #334155;
      margin-bottom: 1.5rem;
    }
    #ad-content h2, #ad-content h3 {
      font-weight: 800;
      color: #0f172a;
      margin-top: 2.25rem;
      margin-bottom: 1rem;
      line-height: 1.3;
    }
    #ad-content h2 { font-size: 1.625rem; }
    #ad-content h3 { font-size: 1.375rem; }
    #ad-content a {
      color: #4f46e5;
      font-weight: 700;
      text-decoration: underline;
    }
    #ad-content ul, #ad-content ol {
      padding-left: 1.75rem;
      margin-bottom: 1.5rem;
      color: #334155;
    }
    #ad-content li {
      margin-bottom: 0.5rem;
      list-style-type: disc;
    }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 min-h-screen flex flex-col justify-between antialiased selection:bg-indigo-500/10 selection:text-indigo-600">

  <!-- Main Reading View Container -->
  <main class="max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 pb-32">
    <div id="ad-article" class="space-y-8 bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-xs">
      
      <!-- Header Section -->
      <div class="space-y-4 border-b border-slate-100 pb-6">
        <div class="flex items-center gap-2">
          <span class="text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 border border-indigo-100 text-indigo-600 px-3 py-1 rounded-full">Sponsored Article</span>
          <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">&bull; aktechstudio.com</span>
        </div>
        <h1 id="ad-title" class="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">Loading sponsored article...</h1>
      </div>
      
      <!-- Rich Content Container -->
      <div id="ad-content" class="text-slate-700 leading-relaxed">
        <!-- Skeleton Loader -->
        <div class="space-y-4 animate-pulse">
          <div class="h-6 bg-slate-100 rounded-md w-3/4"></div>
          <div class="h-4 bg-slate-100 rounded-md w-5/6"></div>
          <div class="h-4 bg-slate-100 rounded-md w-2/3"></div>
          <div class="h-4 bg-slate-100 rounded-md w-4/5"></div>
          <div class="h-32 bg-slate-100 rounded-2xl w-full"></div>
        </div>
      </div>
      
    </div>
  </main>

  <!-- Sticky/Floating Skip Widget on Bottom Right (Desktop/Tablet) or Bottom Sticky (Mobile) -->
  <div id="sticky-skip-widget" class="fixed bottom-6 right-6 z-50 bg-white/95 backdrop-blur-md border border-slate-200/90 p-5 rounded-2xl shadow-xl w-80 space-y-4 max-w-[calc(100vw-32px)]">
    <div class="flex items-center justify-between border-b border-slate-100 pb-2">
      <span class="text-xs font-extrabold text-slate-700">Link Redirection Status</span>
      <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
    </div>
    
    <div class="space-y-2">
      <div class="flex items-center justify-between text-xs">
        <span class="text-slate-400 font-semibold">1. Reading Timer:</span>
        <span id="countdown-status" class="font-extrabold text-indigo-600 flex items-center gap-1">
          <span id="timer-sec">5</span>s remaining
        </span>
      </div>
      <div class="flex items-center justify-between text-xs">
        <span class="text-slate-400 font-semibold">2. Scroll Status:</span>
        <span id="scroll-status" class="font-extrabold text-amber-500 flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 13l-7 7-7-7m14-6l-7 7-7-7"></path></svg>
          <span>Scroll down page</span>
        </span>
      </div>
    </div>

    <button id="btn-proceed" disabled class="w-full py-3.5 bg-slate-100 border border-slate-200 text-slate-400 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 opacity-50 cursor-not-allowed">
      <span>Skip & Proceed &rarr;</span>
    </button>
  </div>

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
        timerSec.parentElement.innerHTML = 'Completed';
        timerFinished = true;
        
        countdownStatus.className = 'font-extrabold text-emerald-500 flex items-center gap-1';
        countdownStatus.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Completed</span>';
        
        checkActivation();
      } else {
        timerSec.textContent = secondsLeft;
      }
    }, 1000);

    // 2. Track Scroll to Bottom of parent page (the fully loaded native reading view)
    window.addEventListener('scroll', () => {
      // Check if user scrolled to bottom of the page
      if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 100) {
        if (!hasScrolledToBottom) {
          hasScrolledToBottom = true;
          
          scrollStatus.className = 'font-extrabold text-emerald-500 flex items-center gap-1.5';
          scrollStatus.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Scrolled to bottom</span>';
          
          checkActivation();
        }
      }
    });

    // Check if both conditions are met
    function checkActivation() {
      if (timerFinished && hasScrolledToBottom) {
        btnProceed.disabled = false;
        btnProceed.className = 'w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2';
        btnProceed.innerHTML = '<span>Skip & Proceed &rarr;</span>';
      }
    }

    // Redirect handler
    btnProceed.addEventListener('click', () => {
      // Decode destination URL from base64 to prevent scraper indexing
      const dest = atob("${base64Url}");
      window.location.href = dest;
    });

    // 3. Fetch latest sponsored blog posts from our local API proxy (which pulls from aktechstudio.com feed)
    async function loadSponsoredArticles() {
      const adTitle = document.getElementById('ad-title');
      const adContent = document.getElementById('ad-content');
      const url = '/api/sponsored-posts';
      
      try {
        const res = await fetch(url);
        if (res.status === 200) {
          const data = await res.json();
          const posts = data.posts || [];
          
          if (posts.length === 0) {
            adTitle.textContent = 'No advertisement available';
            adContent.innerHTML = '<p class="text-slate-400 py-8 text-center text-xs">No advertisement available at this time.</p>';
            return;
          }

          // Pick 1 random post
          const p = posts[Math.floor(Math.random() * posts.length)];
          
          // Populate title and full rich content HTML
          adTitle.textContent = p.title;
          adContent.innerHTML = p.content || p.snippet;

        } else {
          throw new Error('API return status: ' + res.status);
        }
      } catch (err) {
        console.warn('Failed to load articles:', err);
        adTitle.textContent = 'Failed to load sponsored content';
        adContent.innerHTML = '<p class="text-slate-400 py-8 text-center text-xs">Failed to load sponsored updates.</p>';
      }
    }

    loadSponsoredArticles();
  </script>
</body>
</html>`;
}
