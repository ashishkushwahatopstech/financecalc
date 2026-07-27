/**
 * Cloudflare Pages Function: GET /api/youtube-tags
 * Proxies and parses tags/keywords from a YouTube video page server-side.
 */

const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

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

  const targetUrl = `https://www.youtube.com/watch?v=${id}`;

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch video page. Status: ${res.status}`);
    }

    const body = await res.text();

    // 1. Check meta tags
    let tagsStr = '';
    const matchMeta1 = body.match(/<meta\s+name="keywords"\s+content="([^"]*)"/i);
    if (matchMeta1) {
      tagsStr = matchMeta1[1];
    } else {
      const matchMeta2 = body.match(/<meta\s+content="([^"]*)"\s+name="keywords"/i);
      if (matchMeta2) {
        tagsStr = matchMeta2[1];
      }
    }

    // 2. Fallback to parsing ytInitialPlayerResponse keywords array
    let tags = [];
    if (tagsStr) {
      // Split by comma and clean whitespace
      tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
    } else {
      const playerResponseMatch = body.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
      if (playerResponseMatch) {
        try {
          const rawJson = playerResponseMatch[1];
          const data = JSON.parse(rawJson);
          if (data?.videoDetails?.keywords) {
            tags = data.videoDetails.keywords.map(t => t.trim()).filter(Boolean);
          }
        } catch (e) {
          console.warn('Failed parsing ytInitialPlayerResponse JSON:', e);
        }
      }
    }

    // If still no tags found, check if video is private or unavailable
    if (tags.length === 0) {
      if (body.includes('Video unavailable') || body.includes('This video is private') || body.includes('This video is unavailable')) {
        return new Response(JSON.stringify({ error: 'Video is private, deleted, or unavailable' }), {
          status: 404,
          headers: { 'content-type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ tags: [], message: 'No tags found for this video' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }

    // Cache the resolved tags list
    setToCache(id, tags);

    return new Response(JSON.stringify({ tags, cached: false }), {
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
