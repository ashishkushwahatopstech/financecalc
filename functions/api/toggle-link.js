/**
 * Cloudflare Pages Function: POST /functions/api/toggle-link
 * Allows admins and standard owners to toggle redirection (active/inactive) and monetization (enabled/disabled) on shortened URLs.
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const { shortCode, active, monetized, demonetizedByAdmin, uid, token } = await request.json();

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
    await d1.prepare('ALTER TABLE links ADD COLUMN demonetized_by_admin INTEGER DEFAULT 0').run().catch(e => {});

    // 1. Check if requester is Admin
    const ADMIN_UID = 'RUYOUqQWQLOQar6B3iC0KxShiyq1';
    const expectedAdminUid = env.ADMIN_UID || ADMIN_UID;
    let isAdmin = (uid && uid === expectedAdminUid);
    let isValidUser = false;

    if (token) {
      try {
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/finance-calc-by-ak/databases/(default)/documents/users/${uid}`;
        const firestoreRes = await fetch(firestoreUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (firestoreRes.ok) {
          isValidUser = true;
          const docData = await firestoreRes.json();
          const email = docData.fields?.email?.stringValue || '';
          const role = docData.fields?.role?.stringValue || '';
          if (email.trim().toLowerCase() === 'ashishkushwaha88643@gmail.com' || role === 'ADMIN') {
            isAdmin = true;
          }
        }
      } catch (e) {
        console.error("Firestore token verification error:", e);
      }
    }

    // 2. Fetch the target link details from SQLite
    const link = await d1.prepare('SELECT uid, demonetized_by_admin FROM links WHERE short_code = ?').bind(shortCode).first();
    if (!link) {
      return new Response(JSON.stringify({ error: 'Shortened link not found.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Authorization check
    let authorized = isAdmin || (isValidUser && link.uid === uid);
    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Access denied: You are not authorized to update this link.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Update operations
    if (active !== undefined) {
      await d1.prepare('UPDATE links SET active = ? WHERE short_code = ?').bind(active, shortCode).run();
    }

    if (monetized !== undefined) {
      if (isAdmin) {
        // Admin overrides: set both monetized and demonetized_by_admin explicitly
        const dAdmin = (demonetizedByAdmin !== undefined) ? demonetizedByAdmin : ((monetized === 0) ? 1 : 0);
        await d1.prepare('UPDATE links SET monetized = ?, demonetized_by_admin = ? WHERE short_code = ?')
          .bind(monetized, dAdmin, shortCode).run();
      } else {
        // Standard user toggle
        if (monetized === 1 && link.demonetized_by_admin === 1) {
          return new Response(JSON.stringify({ error: 'Direct monetization is blocked by administrator. Please submit a request.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        await d1.prepare('UPDATE links SET monetized = ? WHERE short_code = ?').bind(monetized, shortCode).run();
      }
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
