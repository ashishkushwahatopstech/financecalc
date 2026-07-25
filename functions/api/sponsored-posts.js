/**
 * Cloudflare Pages Function: GET /api/sponsored-posts
 * Proxies and parses the Blogger RSS/Atom feed to JSON with high-res thumbnails.
 */
export async function onRequestGet(context) {
  try {
    const feedUrl = 'https://www.aktechstudio.com/feeds/posts/default?alt=json';
    
    // Fetch feed from Blogger server-side (bypasses CORS restrictions)
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Cloudflare Pages Worker/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Blogger feed returned status: ${response.status}`);
    }

    const data = await response.json();
    const entries = data.feed?.entry || [];

    const posts = entries.map(entry => {
      const title = entry.title?.$t || '';
      const url = entry.link?.find(l => l.rel === 'alternate')?.href || '';
      
      let image = '';
      if (entry.media$thumbnail?.url) {
        // Upgrade from small cropped thumbnail (=s72-c) to high-res preview image (=s640)
        image = entry.media$thumbnail.url.replace('=s72-c', '=s640');
      }

      // Extract text content and strip HTML tags to form a clean preview snippet
      const content = entry.summary?.$t || entry.content?.$t || '';
      const cleanSnippet = content
        .replace(/<[^>]*>/g, '') // Strip HTML tags
        .replace(/\s+/g, ' ')   // Normalize spaces
        .trim()
        .substring(0, 110) + '...';

      return {
        title,
        url,
        image,
        snippet: cleanSnippet
      };
    }).slice(0, 6); // Serve top 6 posts

    return new Response(JSON.stringify({ posts }), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300' // Cache on Cloudflare edge for 5 minutes to keep it ultra-fast
      }
    });

  } catch (err) {
    console.error("Sponsored posts proxy error:", err);
    return new Response(JSON.stringify({ error: err.message, posts: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}
