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
      margin: 0;
      padding: 0;
      overflow: hidden; /* Hide main body scrollbars as we use iframe scroll */
    }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 min-h-screen antialiased selection:bg-indigo-500/10 selection:text-indigo-600">

  <!-- The full screen iframe loading the original post via our header-stripping proxy -->
  <iframe id="ad-frame" src="" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; border: none; z-index: 10;"></iframe>

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
          <span>Scroll down article</span>
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
    const adFrame = document.getElementById('ad-frame');

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

    // 2. Attach Scroll Listener Inside Same-Origin Iframe
    adFrame.addEventListener('load', () => {
      try {
        const frameDoc = adFrame.contentDocument || adFrame.contentWindow.document;
        const frameWin = adFrame.contentWindow;

        // Track scroll events inside the iframe
        const onScroll = () => {
          const scrollTop = frameDoc.documentElement.scrollTop || frameDoc.body.scrollTop;
          const scrollHeight = frameDoc.documentElement.scrollHeight || frameDoc.body.scrollHeight;
          const clientHeight = frameDoc.documentElement.clientHeight || frameDoc.body.clientHeight;

          if (scrollTop + clientHeight >= scrollHeight - 120) {
            if (!hasScrolledToBottom) {
              hasScrolledToBottom = true;
              
              scrollStatus.className = 'font-extrabold text-emerald-500 flex items-center gap-1.5';
              scrollStatus.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Scrolled</span>';
              
              checkActivation();
            }
          }
        };

        frameWin.addEventListener('scroll', onScroll);
        frameDoc.addEventListener('scroll', onScroll);
        
      } catch (err) {
        console.warn("Could not bind scroll directly (same-origin fallback enabled):", err);
        // Fallback for custom browsers: trigger scroll automatically after 3 seconds of load
        setTimeout(() => {
          if (!hasScrolledToBottom) {
            hasScrolledToBottom = true;
            scrollStatus.className = 'font-extrabold text-emerald-500 flex items-center gap-1.5';
            scrollStatus.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Scrolled</span>';
            checkActivation();
          }
        }, 3000);
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
      const dest = atob("${base64Url}");
      window.location.href = dest;
    });

    // 3. Fetch latest sponsored blog posts from our local API proxy, pick 1 randomly, and load in iframe
    async function loadSponsoredArticle() {
      const url = '/api/sponsored-posts';
      
      try {
        const res = await fetch(url);
        if (res.status === 200) {
          const data = await res.json();
          const posts = data.posts || [];
          
          if (posts.length === 0) {
            adFrame.src = 'https://www.aktechstudio.com/';
            return;
          }

          // Pick 1 random post
          const p = posts[Math.floor(Math.random() * posts.length)];
          
          // Load the original post page inside the frame through our header-stripping proxy
          adFrame.src = '/api/proxy?url=' + encodeURIComponent(p.url);

        } else {
          throw new Error('API return status: ' + res.status);
        }
      } catch (err) {
        console.warn('Failed to load sponsored article url:', err);
        adFrame.src = 'https://www.aktechstudio.com/';
      }
    }

    loadSponsoredArticle();
  </script>
</body>
</html>`;
}
