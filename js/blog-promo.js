// Self-promotional blog links - NOT Google AdSense units
import { db, doc, getDoc, setDoc } from './firebase-config.js';

const RSS_FEED_URL = 'https://www.aktechstudio.com/feeds/posts/default';
const RSS2JSON_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_FEED_URL)}`;
const CACHE_KEY_POSTS = 'fincalc_blog_posts_cache';
const CACHE_KEY_TIME = 'fincalc_blog_posts_time';
const CACHE_KEY_SETTINGS = 'fincalc_blog_promo_settings';
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Default promotion settings fallback
 */
export const DEFAULT_PROMO_SETTINGS = {
  adCount: 3,
  enabledPages: ['homepage'],
  adsMode: 'self'
};

/**
 * Supported page identifiers
 */
export const PROMO_PAGES = [
  { id: 'homepage', label: 'Homepage (index.html)' },
  { id: 'loan-calculator', label: 'Loan Calculator (loan-calculator.html)' },
  { id: 'currency-converter', label: 'Currency Converter (currency-converter.html)' },
  { id: 'tax-calculator', label: 'Tax Calculator (tax-calculator.html)' },
  { id: 'salary-calculator', label: 'Salary Calculator (salary-calculator.html)' },
  { id: 'invoice-generator', label: 'Invoice Generator (invoice-generator.html)' },
  { id: 'roi-calculator', label: 'ROI Calculator (roi-calculator.html)' },
  { id: 'qr-generator', label: 'QR Code Generator (qr-generator.html)' },
  { id: 'password-generator', label: 'Password Generator (password-generator.html)' },
  { id: 'word-counter', label: 'Word Counter (word-counter.html)' },
  { id: 'unit-converter', label: 'Unit Converter (unit-converter.html)' },
  { id: 'age-calculator', label: 'Age Calculator (age-calculator.html)' }
];

/**
 * Helper to get current page identifier from URL pathname
 */
export function getCurrentPageId() {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('loan-calculator')) return 'loan-calculator';
  if (path.includes('currency-converter')) return 'currency-converter';
  if (path.includes('tax-calculator')) return 'tax-calculator';
  if (path.includes('salary-calculator')) return 'salary-calculator';
  if (path.includes('invoice-generator')) return 'invoice-generator';
  if (path.includes('roi-calculator')) return 'roi-calculator';
  if (path.includes('qr-generator')) return 'qr-generator';
  if (path.includes('password-generator')) return 'password-generator';
  if (path.includes('word-counter')) return 'word-counter';
  if (path.includes('unit-converter')) return 'unit-converter';
  if (path.includes('age-calculator')) return 'age-calculator';
  if (path.includes('profile')) return 'profile';
  if (path.includes('admin')) return 'admin';
  return 'homepage';
}

/**
 * Reads blog promo settings from Firestore settings/blogPromo or localStorage cache
 */
export async function getBlogPromoSettings() {
  try {
    if (db) {
      const docRef = doc(db, 'settings', 'blogPromo');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const settings = {
          adCount: typeof data.adCount === 'number' ? Math.max(1, Math.min(10, data.adCount)) : 3,
          enabledPages: Array.isArray(data.enabledPages) ? data.enabledPages : ['homepage'],
          adsMode: typeof data.adsMode === 'string' ? data.adsMode : 'self'
        };
        localStorage.setItem(CACHE_KEY_SETTINGS, JSON.stringify(settings));
        return settings;
      }
    }
  } catch (err) {
    console.warn("Firestore settings/blogPromo read error, using local fallback:", err);
  }

  // Local storage fallback
  try {
    const raw = localStorage.getItem(CACHE_KEY_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        adCount: typeof parsed.adCount === 'number' ? Math.max(1, Math.min(10, parsed.adCount)) : 3,
        enabledPages: Array.isArray(parsed.enabledPages) ? parsed.enabledPages : ['homepage'],
        adsMode: typeof parsed.adsMode === 'string' ? parsed.adsMode : 'self'
      };
    }
  } catch (e) {
    console.warn("Local promo settings parse error:", e);
  }

  return { ...DEFAULT_PROMO_SETTINGS };
}

/**
 * Saves blog promo settings to Firestore and localStorage
 */
export async function saveBlogPromoSettings(settings) {
  const cleanSettings = {
    adCount: Math.max(1, Math.min(10, Number(settings.adCount) || 3)),
    enabledPages: Array.isArray(settings.enabledPages) ? settings.enabledPages : ['homepage'],
    adsMode: settings.adsMode || 'self',
    updatedAt: new Date().toISOString()
  };

  localStorage.setItem(CACHE_KEY_SETTINGS, JSON.stringify(cleanSettings));

  if (db) {
    try {
      const docRef = doc(db, 'settings', 'blogPromo');
      await setDoc(docRef, cleanSettings, { merge: true });
    } catch (err) {
      console.warn("Error saving settings/blogPromo to Firestore:", err);
    }
  }

  return cleanSettings;
}

/**
 * Optimizes image quality for Blogger/Blogspot and Unsplash URLs
 * Replaces low-resolution Blogger thumbnail paths (e.g., s72-c, s320, w120-h120) with high-res s1600/w800 parameters
 */
export function optimizeImageQuality(url) {
  if (!url) return null;

  let optimized = url.trim();

  // 1. Google / Blogger / Blogspot image high-res transformations
  if (
    optimized.includes('blogspot.com') ||
    optimized.includes('googleusercontent.com') ||
    optimized.includes('bp.blogspot.com')
  ) {
    // Replace low-res folder path segments (/s72-c/, /s72-w72-h72-c/, /s320/, /s200/, /w120-h120-p-k-no-nu/, etc.)
    optimized = optimized.replace(/\/s72-c[^\/]*\//gi, '/s1600/');
    optimized = optimized.replace(/\/s72-w[^\/]*\//gi, '/s1600/');
    optimized = optimized.replace(/\/s[0-9]{2,3}(-[c|w|h|p][^\/]*)?\//gi, '/s1600/');
    optimized = optimized.replace(/\/w[0-9]{2,4}-h[0-9]{2,4}[^\/]*\//gi, '/s1600/');
    
    // Handle query / equals style parameter suffixes (e.g. =s72-c or =w120-h120)
    optimized = optimized.replace(/=s[0-9]{2,4}(-c)?/gi, '=s1600');
    optimized = optimized.replace(/=w[0-9]{2,4}-h[0-9]{2,4}[^&]*/gi, '=w800-h450-c');
  }

  // 2. Unsplash image URL high-res transformations
  if (optimized.includes('images.unsplash.com')) {
    optimized = optimized.replace(/&w=\d+/g, '&w=800');
    optimized = optimized.replace(/&q=\d+/g, '&q=85');
    if (!optimized.includes('w=')) optimized += '&w=800';
    if (!optimized.includes('q=')) optimized += '&q=85';
  }

  return optimized;
}

/**
 * Extract first image src from HTML content string
 */
function extractFirstImgSrc(html) {
  if (!html) return null;
  try {
    const div = document.createElement('div');
    div.innerHTML = html;
    const img = div.querySelector('img');
    if (img && img.src && !img.src.includes('blogger_feed_info') && !img.src.includes('pixel')) {
      return optimizeImageQuality(img.src);
    }
  } catch (e) {
    // Ignore DOM parse errors
  }
  return null;
}

/**
 * Extract clean plain text summary from HTML string
 */
function stripHtmlAndTruncate(html, maxLength = 120) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  const text = (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Fetches blog posts from RSS feed with rss2json fallback and 1-hour localStorage caching
 */
export async function fetchBlogPosts() {
  // Check 1-hour cache first
  try {
    const cachedPosts = localStorage.getItem(CACHE_KEY_POSTS);
    const cachedTime = localStorage.getItem(CACHE_KEY_TIME);
    if (cachedPosts && cachedTime) {
      const elapsed = Date.now() - Number(cachedTime);
      if (elapsed < ONE_HOUR_MS) {
        const posts = JSON.parse(cachedPosts);
        if (Array.isArray(posts) && posts.length > 0) {
          return posts;
        }
      }
    }
  } catch (e) {
    console.warn("Blog posts cache read error:", e);
  }

  let posts = [];

  // Attempt 1: Direct XML fetch and parse
  try {
    const res = await fetch(RSS_FEED_URL, { mode: 'cors' }).catch(() => null);
    if (res && res.ok) {
      const xmlText = await res.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const entries = Array.from(xmlDoc.querySelectorAll('entry, item'));

      if (entries.length > 0) {
        posts = entries.map(entry => {
          const title = entry.querySelector('title')?.textContent || 'Untitled Post';
          
          let link = '';
          const linkEl = entry.querySelector('link[rel="alternate"]') || entry.querySelector('link');
          if (linkEl) {
            link = linkEl.getAttribute('href') || linkEl.textContent || '';
          }

          const content = entry.querySelector('content, summary, description')?.textContent || '';
          const summary = stripHtmlAndTruncate(content, 110);

          let thumbnail = null;
          const mediaThumb = entry.querySelector('thumbnail, media\\:thumbnail');
          if (mediaThumb) {
            thumbnail = mediaThumb.getAttribute('url');
          }
          if (!thumbnail) {
            thumbnail = extractFirstImgSrc(content);
          } else {
            thumbnail = optimizeImageQuality(thumbnail);
          }

          return { title, link, summary, thumbnail: optimizeImageQuality(thumbnail) };
        }).filter(p => p.link);
      }
    }
  } catch (e) {
    console.warn("Direct RSS fetch error/CORS restriction, falling back to rss2json:", e);
  }

  // Attempt 2: Fallback to rss2json API service
  if (posts.length === 0) {
    try {
      const res = await fetch(RSS2JSON_URL).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          posts = data.items.map(item => {
            const title = item.title || 'Untitled Post';
            const link = item.link || item.guid || '';
            const rawContent = item.description || item.content || '';
            const summary = stripHtmlAndTruncate(rawContent, 110);
            
            let thumbnail = item.thumbnail;
            if (!thumbnail || thumbnail.includes('pixel') || thumbnail.includes('blogger_feed_info')) {
              thumbnail = extractFirstImgSrc(rawContent);
            } else {
              thumbnail = optimizeImageQuality(thumbnail);
            }

            return { title, link, summary, thumbnail: optimizeImageQuality(thumbnail) };
          }).filter(p => p.link);
        }
      }
    } catch (e) {
      console.warn("rss2json fallback fetch error:", e);
    }
  }

  // Fallback fallback sample data if RSS endpoints are unreachable
  if (posts.length === 0) {
    posts = [
      {
        title: "Latest Finance & Tech Insights",
        link: "https://www.aktechstudio.com",
        summary: "Discover detailed guides, financial calculators, and technical solutions on AK Tech Studio.",
        thumbnail: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=85&w=800"
      },
      {
        title: "Smart Tax & Investment Planning Tips",
        link: "https://www.aktechstudio.com",
        summary: "Learn step-by-step strategies to optimize your annual savings and investments.",
        thumbnail: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&q=85&w=800"
      },
      {
        title: "Loan Calculators & Interest Rate Demystified",
        link: "https://www.aktechstudio.com",
        summary: "Calculate exact interest rates, EMI breakdowns, and payment schedules easily.",
        thumbnail: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=85&w=800"
      }
    ];
  }

  // Save to cache
  try {
    localStorage.setItem(CACHE_KEY_POSTS, JSON.stringify(posts));
    localStorage.setItem(CACHE_KEY_TIME, String(Date.now()));
  } catch (e) {
    console.warn("Blog posts cache write error:", e);
  }

  return posts;
}

/**
 * Picks random items from an array without mutating
 */
function getRandomSample(arr, count) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, arr.length));
}

/**
 * Default high-quality placeholder image generator
 */
function getFallbackImage(index) {
  const images = [
    'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=85&w=800',
    'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&q=85&w=800',
    'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=85&w=800',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=85&w=800'
  ];
  return images[index % images.length];
}

/**
 * Main function to initialize and render the self-promotional blog ads section
 * Self-promotional blog links - NOT Google AdSense units
 */
export async function renderBlogPromo(containerOrId = 'promo-ads', forcedPageId = null) {
  let container = typeof containerOrId === 'string' ? document.getElementById(containerOrId) : containerOrId;

  // If container doesn't exist, create an auto-injector wrapper near bottom or above footer if on page
  if (!container) {
    const targetParent = document.querySelector('main') || document.body;
    if (!targetParent) return;
    
    container = document.createElement('div');
    container.id = typeof containerOrId === 'string' ? containerOrId : 'promo-ads';
    container.className = 'w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-10';

    // Insert before footer if available
    const footer = document.querySelector('footer');
    if (footer && footer.parentNode) {
      footer.parentNode.insertBefore(container, footer);
    } else {
      targetParent.appendChild(container);
    }
  }

  const pageId = forcedPageId || getCurrentPageId();
  const settings = await getBlogPromoSettings();

  // Check if promo is enabled for this page
  if (!settings.enabledPages || !settings.enabledPages.includes(pageId)) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';

  // Render detailed Skeleton while fetching
  const skelCount = settings.adCount || 3;
  const skelGridColsClass = skelCount === 1 
    ? 'grid-cols-1' 
    : skelCount === 2 
      ? 'grid-cols-1 sm:grid-cols-2' 
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  container.innerHTML = `
    <!-- Self-promotional blog links - NOT Google AdSense units -->
    <div class="bg-gradient-to-b from-slate-50/90 to-slate-100/60 dark:from-slate-900/80 dark:to-slate-950/80 rounded-2xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800/90 shadow-xs relative overflow-hidden my-8">
      
      <!-- Top Label Header Skeleton -->
      <div class="flex flex-wrap items-center justify-between gap-2 mb-5 pb-3 border-b border-slate-200/60 dark:border-slate-800/60 animate-pulse">
        <div class="flex items-center gap-2">
          <div class="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
          <div class="h-4 w-44 bg-slate-200 dark:bg-slate-800 rounded"></div>
        </div>
        <div class="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded"></div>
      </div>

      <!-- Skeleton Cards Grid -->
      <div class="grid ${skelGridColsClass} gap-5">
        ${Array.from({ length: skelCount }).map(() => `
          <div class="flex flex-col bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 overflow-hidden p-0 shadow-xs animate-pulse">
            <!-- Image Skeleton -->
            <div class="h-44 w-full bg-slate-200 dark:bg-slate-700/80"></div>
            <!-- Content Skeleton -->
            <div class="p-4 space-y-3 flex-1 flex flex-col justify-between">
              <div class="space-y-2">
                <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-11/12"></div>
                <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
              </div>
              <div class="space-y-1.5 pt-2">
                <div class="h-3 bg-slate-200/80 dark:bg-slate-700/60 rounded w-full"></div>
                <div class="h-3 bg-slate-200/80 dark:bg-slate-700/60 rounded w-4/5"></div>
              </div>
              <div class="pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded w-4"></div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Fetch blog posts
  const allPosts = await fetchBlogPosts();
  const selectedPosts = getRandomSample(allPosts, settings.adCount);

  if (selectedPosts.length === 0) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  const gridColsClass = selectedPosts.length === 1 
    ? 'grid-cols-1' 
    : selectedPosts.length === 2 
      ? 'grid-cols-1 sm:grid-cols-2' 
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  // Render actual Cards
  container.innerHTML = `
    <!-- Self-promotional blog links - NOT Google AdSense units -->
    <div class="bg-gradient-to-b from-slate-50/90 to-slate-100/60 dark:from-slate-900/80 dark:to-slate-950/80 rounded-2xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800/90 shadow-xs relative overflow-hidden my-8">
      
      <!-- Top Label Header -->
      <div class="flex flex-wrap items-center justify-between gap-2 mb-5 pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80">
            <svg class="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path>
            </svg>
            From Our Blog
          </span>
          <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Recommended Articles & Guides</span>
        </div>
        <a href="https://www.aktechstudio.com" target="_blank" rel="noopener noreferrer" class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1">
          Visit AK Tech Studio
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
        </a>
      </div>

      <!-- Cards Grid -->
      <div class="grid ${gridColsClass} gap-5">
        ${selectedPosts.map((post, idx) => {
          const rawImg = post.thumbnail ? optimizeImageQuality(post.thumbnail) : null;
          const imgSrc = rawImg || getFallbackImage(idx);
          const fallbackSrc = getFallbackImage(idx);
          return `
            <!-- Self-promotional blog link - NOT Google AdSense unit -->
            <a href="${post.link}" target="_blank" rel="noopener noreferrer" 
               class="group flex flex-col bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 overflow-hidden shadow-xs hover:shadow-md hover:border-indigo-500/60 dark:hover:border-indigo-500/60 transition-all duration-200 transform hover:-translate-y-0.5">
              
              <!-- Thumbnail -->
              <div class="relative h-44 w-full overflow-hidden bg-slate-200 dark:bg-slate-700 animate-pulse">
                <img src="${imgSrc}" alt="${post.title.replace(/"/g, '&quot;')}" 
                     loading="lazy"
                     referrerpolicy="no-referrer"
                     onload="this.parentElement.classList.remove('animate-pulse'); this.classList.remove('opacity-0');"
                     onerror="this.onerror=null; this.src='${fallbackSrc}'; this.parentElement.classList.remove('animate-pulse'); this.classList.remove('opacity-0');"
                     class="w-full h-full object-cover object-center group-hover:scale-105 transition-all duration-300 opacity-0">
                <div class="absolute top-2 right-2 bg-slate-900/75 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-md">
                  Article
                </div>
              </div>

              <!-- Content -->
              <div class="p-4 flex flex-col flex-1">
                <h4 class="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-2 transition-colors">
                  ${post.title}
                </h4>
                <p class="text-xs text-slate-600 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed flex-1">
                  ${post.summary || 'Click to read full article on AK Tech Studio.'}
                </p>
                
                <div class="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <span>Read Full Article</span>
                  <svg class="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                  </svg>
                </div>
              </div>
            </a>
          `;
        }).join('')}
      </div>

    </div>
  `;
}

/**
 * Auto initialize blog promo asynchronously on DOMReady
 */
if (typeof window !== 'undefined') {
  const init = () => {
    // Delay non-critical promo render slightly to ensure main tool interactive performance
    setTimeout(() => {
      renderBlogPromo('promo-ads').catch(e => console.warn("Blog promo render error:", e));
    }, 150);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
