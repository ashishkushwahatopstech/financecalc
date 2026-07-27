/**
 * Cloudflare Pages Function: POST /functions/api/toggle-link
 * Allows admins to toggle redirection (active/inactive) and monetization (enabled/disabled) on shortened URLs.
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const { shortCode, active, monetized, uid, token } = await request.json();

    const ADMIN_UID = 'RUYOUqQWQLOQar6B3iC0KxShiyq1';
    const expectedAdminUid = env.ADMIN_UID || ADMIN_UID;
    let authorized = (uid && uid === expectedAdminUid);

    if (!authorized && token) {
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
      return new Response(JSON.stringify({ error: 'Access denied: Admin privileges required.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const d1 = env.fincalc_urlshortener;
    if (!d1) {
      return new Response(JSON.stringify({ error: 'D1 binding not found.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Ensure columns exist in SQLite links table schema
    await d1.prepare('ALTER TABLE links ADD COLUMN active INTEGER DEFAULT 1').run().catch(e => {});
    await d1.prepare('ALTER TABLE links ADD COLUMN monetized INTEGER DEFAULT 0').run().catch(e => {});

    if (active !== undefined) {
      await d1.prepare('UPDATE links SET active = ? WHERE short_code = ?').bind(active, shortCode).run();
    }

    if (monetized !== undefined) {
      await d1.prepare('UPDATE links SET monetized = ? WHERE short_code = ?').bind(monetized, shortCode).run();
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("Toggle Link API Error:", err);
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
