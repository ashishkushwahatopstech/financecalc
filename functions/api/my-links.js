/**
 * Cloudflare Pages Function: GET /functions/api/my-links
 * Retrieves links created by a specific user UID along with their total click counts.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const urlObj = new URL(request.url);
  const uid = urlObj.searchParams.get('uid');

  if (!uid) {
    return new Response(JSON.stringify({ error: 'User UID is required.' }), {
      status: 400,
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
    // Ensure columns exist in SQLite links table schema
    await d1.prepare('ALTER TABLE links ADD COLUMN active INTEGER DEFAULT 1').run().catch(e => {});
    await d1.prepare('ALTER TABLE links ADD COLUMN monetized INTEGER DEFAULT 0').run().catch(e => {});
    await d1.prepare('ALTER TABLE links ADD COLUMN demonetized_by_admin INTEGER DEFAULT 0').run().catch(e => {});

    // Query links and aggregate clicks in one query
    const queryStr = `
      SELECT 
        l.id, 
        l.short_code, 
        l.original_url, 
        l.uid, 
        l.created_at, 
        l.expires_at, 
        l.is_custom_code,
        l.monetized,
        l.demonetized_by_admin,
        COUNT(c.id) AS total_clicks
      FROM links l
      LEFT JOIN clicks c ON l.short_code = c.short_code
      WHERE l.uid = ?
      GROUP BY l.id, l.short_code, l.original_url, l.uid, l.created_at, l.expires_at, l.is_custom_code, l.monetized, l.demonetized_by_admin
      ORDER BY l.created_at DESC
    `;
    const { results } = await d1.prepare(queryStr).bind(uid).all();

    return new Response(JSON.stringify({ links: results }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (err) {
    console.error("My Links API Error:", err);
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
