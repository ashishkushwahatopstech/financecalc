/**
 * Cloudflare Pages Function: POST /functions/api/delete-link
 * Deletes a shortened link and its click analytics.
 * Verifies link ownership prior to deletion.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { shortCode, uid } = await request.json();

    if (!shortCode || !uid) {
      return new Response(JSON.stringify({ error: 'Short code and User UID are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const d1 = env.fincalc_urlshortener;
    const kv = env.URL_REDIRECTS;

    if (!d1 || !kv) {
      return new Response(JSON.stringify({ error: 'Database or KV bindings not found.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Verify ownership in D1
    const link = await d1.prepare('SELECT uid FROM links WHERE short_code = ?').bind(shortCode).first();
    if (!link) {
      return new Response(JSON.stringify({ error: 'Short link not found.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (link.uid !== uid) {
      return new Response(JSON.stringify({ error: 'Access denied: You do not own this link.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Delete from D1 links and clicks tables
    const stmtDeleteLink = d1.prepare('DELETE FROM links WHERE short_code = ?').bind(shortCode);
    const stmtDeleteClicks = d1.prepare('DELETE FROM clicks WHERE short_code = ?').bind(shortCode);
    await d1.batch([stmtDeleteLink, stmtDeleteClicks]);

    // 3. Delete from KV redirects
    await kv.delete(shortCode);

    return new Response(JSON.stringify({ success: true, message: 'Link and all click logs deleted successfully.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("Delete Link API Error:", err);
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
