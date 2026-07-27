/**
 * Cloudflare Pages Function: GET /api/youtube-tags
 * Retrieves video tags/keywords using the YouTube InnerTube player JSON API endpoint.
 * This completely avoids HTML scraping and bypasses 429 rate limits.
 */

const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache for tags

function getFromCache(id) {
  const entry = cache.get(id);
  if (entry && (Date.now() - entry.timestamp < CACHE_TTL_MS)) {
    return entry.tags;
  }
  cache.delete(id);
  return null;
}

function setToCache(id, tags) {
  cache.set(id, {
    timestamp: Date.now(),
    tags
  });
}

export async function onRequestGet(context) {
  const { request } = context;
  const urlObj = new URL(request.url);
  const id = urlObj.searchParams.get('id');

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing video ID parameter' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  // Validate YouTube Video ID format (11 characters)
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return new Response(JSON.stringify({ error: 'Invalid video ID format' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  // Check in-memory cache
  const cachedTags = getFromCache(id);
  if (cachedTags) {
    return new Response(JSON.stringify({ tags: cachedTags, cached: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }

  // YouTube InnerTube player JSON endpoint (keyless POST)
  const targetUrl = 'https://www.youtube.com/youtubei/v1/player';
  const payload = {
    videoId: id,
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20230621.02.00'
      }
    }
  };

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`InnerTube API returned status: ${res.status}`);
    }

    const data = await res.json();

    const keywords = data.videoDetails && Array.isArray(data.videoDetails.keywords)
      ? data.videoDetails.keywords.map(k => k.trim()).filter(Boolean)
      : [];

    if (keywords.length > 0) {
      setToCache(id, keywords);
      return new Response(JSON.stringify({ tags: keywords, cached: false }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }

    // Check if the video is private, deleted or unavailable
    const playability = data.playabilityStatus || {};
    if (playability.status && playability.status !== 'OK') {
      return new Response(JSON.stringify({ error: playability.reason || 'Video is private, deleted, or unavailable' }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      });
    }

    setToCache(id, []);

    return new Response(JSON.stringify({ tags: [], cached: false }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server proxy error: ' + err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
