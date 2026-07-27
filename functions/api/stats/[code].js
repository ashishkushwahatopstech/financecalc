/**
 * Cloudflare Pages Function: GET /functions/api/stats/[code]
 * Returns aggregated click statistics for a specific short link.
 * Verifies link ownership or Admin status before returning data.
 */
export async function onRequestGet(context) {
  const { request, env, params } = context;
  const { code } = params;
  const urlObj = new URL(request.url);
  const uid = urlObj.searchParams.get('uid');
  const token = urlObj.searchParams.get('token');

  if (!code) {
    return new Response(JSON.stringify({ error: 'Short code is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!uid) {
    return new Response(JSON.stringify({ error: 'User UID is required for verification.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const d1 = env.fincalc_urlshortener;
  if (!d1) {
    return new Response(JSON.stringify({ error: 'D1 database binding not found.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // 1. Fetch link details
    const link = await d1.prepare(
      'SELECT uid, original_url, created_at, expires_at FROM links WHERE short_code = ?'
    ).bind(code).first();

    if (!link) {
      return new Response(JSON.stringify({ error: 'Short link not found.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Authorize: must be owner OR authorized admin
    let authorized = (link.uid === uid);
    
    if (!authorized) {
      // Check Admin UID
      const ADMIN_UID = 'RUYOUqQWQLOQar6B3iC0KxShiyq1';
      const expectedAdminUid = env.ADMIN_UID || ADMIN_UID;
      if (uid === expectedAdminUid) {
        authorized = true;
      }
    }

    if (!authorized && token) {
      // Verify Google ID token for admin email
      try {
        const tokenRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
        if (tokenRes.ok) {
          const tokenInfo = await tokenRes.json();
          if (tokenInfo.email && tokenInfo.email.toLowerCase() === 'ashishkushwaha88643@gmail.com') {
            authorized = true;
          }
        }
      } catch (e) {
        console.error("Token verification error:", e);
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Access denied: You do not own this link.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Perform Batch Query to fetch all stats efficiently
    const stmtClicksOverTime = d1.prepare(`
      SELECT date(clicked_at / 1000, 'unixepoch') AS day, COUNT(*) AS count 
      FROM clicks 
      WHERE short_code = ? 
      GROUP BY day 
      ORDER BY day ASC
    `).bind(code);

    const stmtGeo = d1.prepare(`
      SELECT country, city, COUNT(*) AS count 
      FROM clicks 
      WHERE short_code = ? 
      GROUP BY country, city 
      ORDER BY count DESC 
      LIMIT 20
    `).bind(code);

    const stmtSource = d1.prepare(`
      SELECT source_type, COUNT(*) AS count 
      FROM clicks 
      WHERE short_code = ? 
      GROUP BY source_type
    `).bind(code);

    const stmtReferrer = d1.prepare(`
      SELECT referrer, COUNT(*) AS count 
      FROM clicks 
      WHERE short_code = ? 
      GROUP BY referrer 
      ORDER BY count DESC 
      LIMIT 15
    `).bind(code);

    const stmtDevice = d1.prepare(`
      SELECT device_type, COUNT(*) AS count 
      FROM clicks 
      WHERE short_code = ? 
      GROUP BY device_type
    `).bind(code);

    // Execute in one batch
    const batchResults = await d1.batch([
      stmtClicksOverTime,
      stmtGeo,
      stmtSource,
      stmtReferrer,
      stmtDevice
    ]);

    return new Response(JSON.stringify({
      link: {
        short_code: code,
        original_url: link.original_url,
        created_at: link.created_at,
        expires_at: link.expires_at
      },
      analytics: {
        clicksOverTime: batchResults[0].results,
        geography: batchResults[1].results,
        sources: batchResults[2].results,
        referrers: batchResults[3].results,
        devices: batchResults[4].results
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (err) {
    console.error("Stats API Error:", err);
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
