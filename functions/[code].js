/**
 * Cloudflare Pages Function: GET /[code]
 * Dynamic redirect handler for short URLs.
 */
export async function onRequestGet(context) {
  const { request, env, params, next } = context;
  const { code } = params;

  // If the code matches assets or static pages, we shouldn't handle it
  if (!code || code === 'favicon.ico' || code.includes('.') || code === 'functions') {
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

    // 2. Query D1 to fetch expiry and ownership details
    linkRecord = await d1.prepare('SELECT original_url, expires_at FROM links WHERE short_code = ?').bind(code).first();

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

    // 5. Issue HTTP 302 redirect
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
