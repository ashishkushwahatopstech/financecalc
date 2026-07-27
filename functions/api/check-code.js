/**
 * Cloudflare Pages Function: GET /functions/api/check-code
 * Checks if a custom short code is available (not already taken).
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const urlObj = new URL(request.url);
  const code = urlObj.searchParams.get('code');

  if (!code) {
    return new Response(JSON.stringify({ error: 'Short code parameter is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const d1 = env.fincalc_urlshortener;
  if (!d1) {
    return new Response(JSON.stringify({ error: 'D1 database binding "fincalc_urlshortener" not found.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const cleanCode = code.trim();
    
    // Check format (3-30 characters, alphanumeric and dashes/underscores only)
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(cleanCode)) {
      return new Response(JSON.stringify({ available: false, reason: 'invalid_format' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Query D1
    const existing = await d1.prepare('SELECT 1 FROM links WHERE short_code = ?').bind(cleanCode).first();
    
    return new Response(JSON.stringify({ available: !existing }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (err) {
    console.error("Check Code Error:", err);
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
