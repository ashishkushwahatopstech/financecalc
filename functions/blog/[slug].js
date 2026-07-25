/**
 * Cloudflare Pages Function: GET /blog/[slug]
 * Intercepts pretty blog URLs, fetches updates.html locally, gets the article details
 * from Firestore REST API, and injects custom Open Graph metadata server-side
 * so sharing links on WhatsApp, Twitter, Facebook, etc. displays a rich preview card.
 */

async function fetchPostDetails(postId) {
  // 1. Try blog_posts first
  let url = `https://firestore.googleapis.com/v1/projects/finance-calc-by-ak/databases/(default)/documents/blog_posts/${postId}`;
  try {
    let res = await fetch(url);
    if (res.status === 200) {
      const data = await res.json();
      const fields = data.fields || {};
      return {
        title: fields.title?.stringValue || '',
        body: fields.body?.stringValue || '',
        featuredImage: fields.featuredImage?.stringValue || '',
        published: fields.published?.booleanValue || false,
        status: fields.status?.stringValue || 'public'
      };
    }
  } catch (e) {}

  // 2. Fallback to legacy content collection
  url = `https://firestore.googleapis.com/v1/projects/finance-calc-by-ak/databases/(default)/documents/content/${postId}`;
  try {
    let res = await fetch(url);
    if (res.status === 200) {
      const data = await res.json();
      const fields = data.fields || {};
      return {
        title: fields.title?.stringValue || '',
        body: fields.body?.stringValue || '',
        featuredImage: fields.featuredImage?.stringValue || '',
        published: fields.published?.booleanValue || false,
        status: 'public'
      };
    }
  } catch (e) {}

  return null;
}

function escapeForMeta(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function onRequestGet(context) {
  const { request } = context;
  const urlObj = new URL(request.url);
  const path = urlObj.pathname;
  
  // Extract 6-digit numeric ID from slug: e.g. /blog/123456-title
  const blogMatch = path.match(/\/blog\/(\d{4,6})-.*/);
  const postId = blogMatch ? blogMatch[1] : null;

  // Fetch updates.html template from the site root
  const updatesUrl = new URL('/updates.html', urlObj.origin);
  let html = '';
  let updatesResp = null;

  try {
    updatesResp = await fetch(updatesUrl.toString());
    if (updatesResp.status === 200) {
      html = await updatesResp.text();
    }
  } catch (err) {
    console.error('Serverless pretty routing fetch updates.html error:', err);
  }

  // If we couldn't load the template, fallback to standard next()
  if (!html) {
    return context.next();
  }

  // Inject base href to resolve all relative navigation and asset links from the root directory
  html = html.replace('<head>', '<head><base href="/">');

  // If a valid post ID was extracted, enrich it with database details
  if (postId) {
    const post = await fetchPostDetails(postId);
    if (post && post.published && post.status === 'public') {
      const title = post.title;
      const description = post.body.substring(0, 150).replace(/\s+/g, ' ').trim() + '...';
      const image = post.featuredImage || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=600';
      const canonicalUrl = request.url;

      // Replace Title and Description
      html = html.replace(/<title>.*?<\/title>/g, `<title>${escapeForMeta(title)} – FinCalc Blog</title>`);
      html = html.replace(/<meta name="description" content=".*?" \/>/g, `<meta name="description" content="${escapeForMeta(description)}" />`);
      
      // Replace Open Graph Tags
      html = html.replace(/<meta property="og:title" content=".*?" \/>/g, `<meta property="og:title" content="${escapeForMeta(title)}" />`);
      html = html.replace(/<meta property="og:description" content=".*?" \/>/g, `<meta property="og:description" content="${escapeForMeta(description)}" />`);
      html = html.replace(/<meta property="og:image" content=".*?" \/>/g, `<meta property="og:image" content="${escapeForMeta(image)}" />`);
      html = html.replace(/<meta property="og:url" content=".*?" \/>/g, `<meta property="og:url" content="${escapeForMeta(canonicalUrl)}" />`);
      
      // Replace Twitter Tags
      html = html.replace(/<meta name="twitter:title" content=".*?" \/>/g, `<meta name="twitter:title" content="${escapeForMeta(title)}" />`);
      html = html.replace(/<meta name="twitter:description" content=".*?" \/>/g, `<meta name="twitter:description" content="${escapeForMeta(description)}" />`);
      html = html.replace(/<meta name="twitter:image" content=".*?" \/>/g, `<meta name="twitter:image" content="${escapeForMeta(image)}" />`);
    }
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60' // Cache at Cloudflare Edge for 60 seconds
    }
  });
}
