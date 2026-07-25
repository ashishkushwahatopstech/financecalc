/**
 * Cloudflare Pages Function: GET /api/proxy
 * Proxies HTML pages to strip X-Frame-Options and Content-Security-Policy headers,
 * injecting a <base> tag to resolve all relative assets correctly.
 */
export async function onRequestGet(context) {
  const { request } = context;
  const urlObj = new URL(request.url);
  const targetUrl = urlObj.searchParams.get('url');

  if (!targetUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (!res.ok) {
      throw new Error(`Target returned status: ${res.status}`);
    }

    let body = await res.text();
    
    // Inject base href to resolve all stylesheet and script assets relative to the target origin
    const parsedTarget = new URL(targetUrl);
    const targetOrigin = parsedTarget.origin + '/';
    
    // Try both lower and uppercase tag matching
    if (body.includes('<head>')) {
      body = body.replace('<head>', `<head><base href="${targetOrigin}">`);
    } else if (body.includes('<HEAD>')) {
      body = body.replace('<HEAD>', `<HEAD><base href="${targetOrigin}">`);
    }

    // Strip restricting frame headers
    const headers = new Headers(res.headers);
    headers.delete('x-frame-options');
    headers.delete('content-security-policy');
    headers.set('content-type', 'text/html; charset=utf-8');

    return new Response(body, {
      status: 200,
      headers
    });
  } catch (err) {
    return new Response('Proxy error: ' + err.message, { status: 500 });
  }
}
