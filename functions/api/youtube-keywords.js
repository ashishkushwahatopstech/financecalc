/**
 * Cloudflare Pages Function: GET /api/youtube-keywords
 * Fetches real YouTube autocomplete search suggestions for a seed query.
 */

const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache for autocomplete suggestions

function getFromCache(query) {
  const entry = cache.get(query);
  if (entry && (Date.now() - entry.timestamp < CACHE_TTL_MS)) {
    return entry.suggestions;
  }
  cache.delete(query);
  return null;
}

function setToCache(query, suggestions) {
  cache.set(query, {
    timestamp: Date.now(),
    suggestions
  });
}

export async function onRequestGet(context) {
  const { request } = context;
  const urlObj = new URL(request.url);
  const q = urlObj.searchParams.get('q');

  if (!q) {
    return new Response(JSON.stringify({ error: 'Missing seed query parameter q' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const queryClean = q.trim().toLowerCase();

  // Check cache
  const cached = getFromCache(queryClean);
  if (cached) {
    return new Response(JSON.stringify({ suggestions: cached, cached: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }

  // Google Autocomplete search suggestion endpoint for YouTube search engine (ds=yt, client=firefox)
  const targetUrl = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(queryClean)}`;

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`Target suggestion returned status: ${res.status}`);
    }

    const data = await res.json();
    
    // Format: ["seed query", ["suggestion 1", "suggestion 2", ...]]
    const suggestions = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];

    setToCache(queryClean, suggestions);

    return new Response(JSON.stringify({ suggestions, cached: false }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch suggestions: ' + err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
