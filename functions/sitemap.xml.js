/**
 * Cloudflare Pages Function: GET /sitemap.xml
 * Dynamically constructs and serves the sitemap XML feed including all static tool routes
 * and real-time published blog posts queried from the Firestore REST API.
 */

function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export async function onRequestGet(context) {
  const staticPages = [
    { loc: 'https://tool.aktechstudio.com/', changefreq: 'daily', priority: '1.0' },
    { loc: 'https://tool.aktechstudio.com/url-shortener.html', changefreq: 'weekly', priority: '0.9' },
    { loc: 'https://tool.aktechstudio.com/loan-calculator.html', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://tool.aktechstudio.com/currency-converter.html', changefreq: 'daily', priority: '0.8' },
    { loc: 'https://tool.aktechstudio.com/tax-calculator.html', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://tool.aktechstudio.com/salary-calculator.html', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://tool.aktechstudio.com/invoice-generator.html', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://tool.aktechstudio.com/roi-calculator.html', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://tool.aktechstudio.com/qr-generator.html', changefreq: 'monthly', priority: '0.7' },
    { loc: 'https://tool.aktechstudio.com/password-generator.html', changefreq: 'monthly', priority: '0.7' },
    { loc: 'https://tool.aktechstudio.com/word-counter.html', changefreq: 'monthly', priority: '0.7' },
    { loc: 'https://tool.aktechstudio.com/unit-converter.html', changefreq: 'monthly', priority: '0.7' },
    { loc: 'https://tool.aktechstudio.com/age-calculator.html', changefreq: 'monthly', priority: '0.7' },
    { loc: 'https://tool.aktechstudio.com/emi-calculator.html', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://tool.aktechstudio.com/gst-calculator.html', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://tool.aktechstudio.com/sip-calculator.html', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://tool.aktechstudio.com/ppf-fd-rd-calculator.html', changefreq: 'monthly', priority: '0.8' },
    { loc: 'https://tool.aktechstudio.com/image-compressor.html', changefreq: 'monthly', priority: '0.7' },
    { loc: 'https://tool.aktechstudio.com/pdf-tools.html', changefreq: 'monthly', priority: '0.7' },
    { loc: 'https://tool.aktechstudio.com/youtube-thumbnail-downloader.html', changefreq: 'monthly', priority: '0.7' },
    { loc: 'https://tool.aktechstudio.com/json-formatter.html', changefreq: 'monthly', priority: '0.7' },
    { loc: 'https://tool.aktechstudio.com/base64-converter.html', changefreq: 'monthly', priority: '0.7' },
    { loc: 'https://tool.aktechstudio.com/uuid-hash-generator.html', changefreq: 'monthly', priority: '0.7' },
    { loc: 'https://tool.aktechstudio.com/regex-tester.html', changefreq: 'monthly', priority: '0.7' },
    { loc: 'https://tool.aktechstudio.com/color-converter.html', changefreq: 'monthly', priority: '0.7' },
    { loc: 'https://tool.aktechstudio.com/markdown-editor.html', changefreq: 'monthly', priority: '0.7' },
    { loc: 'https://tool.aktechstudio.com/resume-builder.html', changefreq: 'monthly', priority: '0.7' },
    { loc: 'https://tool.aktechstudio.com/link-stats.html', changefreq: 'monthly', priority: '0.5' },
    { loc: 'https://tool.aktechstudio.com/updates.html', changefreq: 'monthly', priority: '0.6' },
    { loc: 'https://tool.aktechstudio.com/about.html', changefreq: 'monthly', priority: '0.5' },
    { loc: 'https://tool.aktechstudio.com/contact.html', changefreq: 'monthly', priority: '0.5' },
    { loc: 'https://tool.aktechstudio.com/privacy-policy.html', changefreq: 'monthly', priority: '0.4' },
    { loc: 'https://tool.aktechstudio.com/terms-of-service.html', changefreq: 'monthly', priority: '0.4' },
    { loc: 'https://tool.aktechstudio.com/disclaimer.html', changefreq: 'monthly', priority: '0.4' }
  ];

  const todayStr = new Date().toISOString().split('T')[0];
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // 1. Append static pages
  for (const page of staticPages) {
    xml += '  <url>\n';
    xml += `    <loc>${page.loc}</loc>\n`;
    xml += `    <lastmod>${todayStr}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += '  </url>\n';
  }

  // 2. Query published blog posts from Firestore REST API
  const queryUrl = `https://firestore.googleapis.com/v1/projects/finance-calc-by-ak/databases/(default)/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'blog_posts' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: 'status' },
                op: 'EQUAL',
                value: { stringValue: 'public' }
              }
            },
            {
              fieldFilter: {
                field: { fieldPath: 'published' },
                op: 'EQUAL',
                value: { booleanValue: true }
              }
            }
          ]
        }
      }
    }
  };

  try {
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (res.status === 200) {
      const results = await res.json();
      for (const item of results) {
        if (item.document) {
          const doc = item.document;
          const fields = doc.fields || {};
          const docId = doc.name.split('/').pop();
          const title = fields.title?.stringValue || '';
          
          if (docId && title) {
            const postSlug = slugify(title);
            const postUrl = `https://tool.aktechstudio.com/blog/${docId}-${postSlug}`;
            const rawUpdateTime = doc.updateTime || new Date().toISOString();
            const lastmod = rawUpdateTime.split('T')[0];

            xml += '  <url>\n';
            xml += `    <loc>${postUrl}</loc>\n`;
            xml += `    <lastmod>${lastmod}</lastmod>\n`;
            xml += '    <changefreq>weekly</changefreq>\n';
            xml += '    <priority>0.7</priority>\n';
            xml += '  </url>\n';
          }
        }
      }
    }
  } catch (err) {
    console.error('Error fetching blog posts for dynamic sitemap:', err);
  }

  xml += '</urlset>\n';

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600' // Cache at Edge for 1 hour
    }
  });
}
