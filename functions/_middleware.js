/**
 * Cloudflare Pages Root Middleware: functions/_middleware.js
 * Automatically intercepts all requests to inject security headers and conditional SEO tags.
 */
export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const response = await next();

  // Create a mutable copy of the response
  const newResponse = new Response(response.body, response);

  // Set general security headers (equivalent to what was defined in static _headers)
  newResponse.headers.set('X-Frame-Options', 'DENY');
  newResponse.headers.set('X-Content-Type-Options', 'nosniff');
  newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  newResponse.headers.set('X-XSS-Protection', '1; mode=block');
  newResponse.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  newResponse.headers.set('Permissions-Policy', 'interest-cohort=()');
  newResponse.headers.set(
    'Content-Security-Policy',
    "default-src 'self' https://*.firebaseio.com https://*.googleapis.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://www.gstatic.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://adservice.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://images.unsplash.com https://lh3.googleusercontent.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://securetoken.googleapis.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net; frame-src 'self' https://finance-calc-by-ak.firebaseapp.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://pagead2.googlesyndication.com;"
  );

  // If request hostname ends with .pages.dev, inject X-Robots-Tag: noindex to prevent duplicate content indexing
  if (url.hostname.endsWith('.pages.dev')) {
    newResponse.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  return newResponse;
}
