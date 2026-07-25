/**
 * Cloudflare Pages Function: GET /functions/api/admin-stats
 * Returns site-wide stats: total links, total clicks, and top 10 links.
 * Restricts access to the hardcoded Admin UID only.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const urlObj = new URL(request.url);
  const uid = urlObj.searchParams.get('uid');

  const ADMIN_UID = 'RUYOUqQWQLOQar6B3iC0KxShiyq1';
  const expectedAdminUid = env.ADMIN_UID || ADMIN_UID;

  if (!uid || uid !== expectedAdminUid) {
    return new Response(JSON.stringify({ error: 'Access denied: Admin privileges required.' }), {
      status: 403,
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
    // Ensure 'active' and 'monetized' columns exist in D1 SQLite schema
    await d1.prepare('ALTER TABLE links ADD COLUMN active INTEGER DEFAULT 1').run().catch(e => {});
    await d1.prepare('ALTER TABLE links ADD COLUMN monetized INTEGER DEFAULT 0').run().catch(e => {});

    // 1. Total links count
    const stmtTotalLinks = d1.prepare('SELECT COUNT(*) AS count FROM links');
    
    // 2. Total clicks count
    const stmtTotalClicks = d1.prepare('SELECT COUNT(*) AS count FROM clicks');

    // 3. Top 10 most-clicked links overall (selecting status flags)
    const stmtTopLinks = d1.prepare(`
      SELECT 
        l.short_code, 
        l.original_url, 
        l.uid, 
        l.created_at, 
        l.monetized,
        l.active,
        COUNT(c.id) AS click_count
      FROM links l
      LEFT JOIN clicks c ON l.short_code = c.short_code
      GROUP BY l.short_code, l.original_url, l.uid, l.created_at, l.monetized, l.active
      ORDER BY click_count DESC
      LIMIT 10
    `);

    // Execute in one batch transaction
    const batchResults = await d1.batch([
      stmtTotalLinks,
      stmtTotalClicks,
      stmtTopLinks
    ]);

    const totalLinks = batchResults[0].results[0]?.count || 0;
    const totalClicks = batchResults[1].results[0]?.count || 0;
    const topLinks = batchResults[2].results || [];

    return new Response(JSON.stringify({
      totalLinks,
      totalClicks,
      topLinks
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (err) {
    console.error("Admin Stats API Error:", err);
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
