/**
 * Cloudflare Pages Function: POST /functions/shorten
 * Creates a short link, saves it to D1 and KV.
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const { originalUrl, customCode, expiresAt, uid, monetized } = await request.json();

    if (!originalUrl) {
      return new Response(JSON.stringify({ error: 'Original URL is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Basic URL validation
    try {
      const parsedUrl = new URL(originalUrl);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('Only HTTP and HTTPS protocols are allowed.');
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid URL format. Make sure to include http:// or https://' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const d1 = env.fincalc_urlshortener;
    const kv = env.URL_REDIRECTS;

    if (!d1) {
      return new Response(JSON.stringify({ error: 'D1 database binding "fincalc_urlshortener" not found.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!kv) {
      return new Response(JSON.stringify({ error: 'KV namespace binding "URL_REDIRECTS" not found.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let shortCode = '';
    let isCustomCode = 0;

    if (customCode && customCode.trim() !== '') {
      const cleanCustom = customCode.trim().replace(/[^a-zA-Z0-9_-]/g, '');
      if (cleanCustom.length < 3 || cleanCustom.length > 30) {
        return new Response(JSON.stringify({ error: 'Custom code must be between 3 and 30 characters (letters, numbers, underscores, and hyphens).' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check D1 for uniqueness
      const existing = await d1.prepare('SELECT 1 FROM links WHERE short_code = ?').bind(cleanCustom).first();
      if (existing) {
        return new Response(JSON.stringify({ error: 'Custom code is already taken. Please try another one.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      shortCode = cleanCustom;
      isCustomCode = 1;
    } else {
      // Generate a random 6-character alphanumeric code
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let attempts = 0;
      while (attempts < 10) {
        let code = '';
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const existing = await d1.prepare('SELECT 1 FROM links WHERE short_code = ?').bind(code).first();
        if (!existing) {
          shortCode = code;
          break;
        }
        attempts++;
      }

      if (!shortCode) {
        return new Response(JSON.stringify({ error: 'Failed to generate a unique short code. Please try again.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const createdAt = Date.now();
    const expiresVal = expiresAt ? new Date(expiresAt).getTime() : null;

    // Ensure 'monetized' column exists in D1 SQLite schema
    await d1.prepare('ALTER TABLE links ADD COLUMN monetized INTEGER DEFAULT 0').run().catch(e => {
      // Ignore error if column already exists
    });

    // Insert new row into D1 "links" table
    // Table fields: id, short_code, original_url, uid, created_at, expires_at, is_custom_code, monetized
    await d1.prepare(
      'INSERT INTO links (short_code, original_url, uid, created_at, expires_at, is_custom_code, monetized) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(shortCode, originalUrl, uid || null, createdAt, expiresVal, isCustomCode, monetized ? 1 : 0).run();

    // Write shortCode -> originalUrl into KV namespace (URL_REDIRECTS)
    if (expiresVal) {
      const expirationSeconds = Math.floor(expiresVal / 1000);
      const nowSeconds = Math.floor(Date.now() / 1000);
      // KV expiration must be at least 60 seconds in the future
      if (expirationSeconds > nowSeconds + 60) {
        await kv.put(shortCode, originalUrl, { expiration: expirationSeconds });
      } else {
        await kv.put(shortCode, originalUrl);
      }
    } else {
      await kv.put(shortCode, originalUrl);
    }

    const origin = new URL(request.url).origin;
    const shortUrl = `${origin}/${shortCode}`;

    return new Response(JSON.stringify({ shortCode, shortUrl, originalUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error("Shorten API Error:", err);
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
