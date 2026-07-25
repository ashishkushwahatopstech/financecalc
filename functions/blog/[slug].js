/**
 * Cloudflare Pages Function: GET /blog/[slug]
 * Intercepts pretty blog URLs, fetches updates.html locally, and returns it.
 * Client-side updates.js parses the URL pathname to launch the deep-linked article.
 */
export async function onRequestGet(context) {
  const { request } = context;
  const urlObj = new URL(request.url);
  
  // Fetch updates.html template from the site root
  const updatesUrl = new URL('/updates.html', urlObj.origin);
  
  try {
    const updatesResp = await fetch(updatesUrl.toString());
    if (updatesResp.status === 200) {
      return new Response(updatesResp.body, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          // Preserve caching headers from the template
          'Cache-Control': updatesResp.headers.get('Cache-Control') || 'no-cache'
        }
      });
    }
  } catch (err) {
    console.error('Serverless pretty routing fetch error:', err);
  }

  // Fallback to next()
  return context.next();
}
