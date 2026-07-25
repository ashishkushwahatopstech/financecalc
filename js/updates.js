/**
 * FinCalc Tools - Public Blog Updates Controller
 * Fetches published blog posts and renders responsive cards on updates.html.
 */

import { fetchPublishedBlogPosts, escapeHTML } from './content-manager.js';
import { trackDailyActivity } from './analytics.js';

// Local Toast Utility
function showToast(message, type = 'success') {
  let wrapper = document.getElementById('toast-wrapper');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.id = 'toast-wrapper';
    wrapper.className = 'fixed bottom-5 right-5 z-50 space-y-2 pointer-events-none';
    document.body.appendChild(wrapper);
  }
  const toast = document.createElement('div');
  toast.className = "flex items-center gap-3 px-4 py-3 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-lg border border-slate-800 animate-slide-in pointer-events-auto";
  const iconHtml = type === 'success'
    ? `<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>`
    : `<svg class="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
  
  toast.innerHTML = `${iconHtml}<span>${escapeHTML(message)}</span>`;
  wrapper.appendChild(toast);
  
  setTimeout(() => {
    toast.className = "flex items-center gap-3 px-4 py-3 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-lg border border-slate-800 animate-fade-out pointer-events-auto";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Helper to slugify titles for URLs
function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

async function initUpdatesPage() {
  const container = document.getElementById('blog-posts-grid');
  const badge = document.getElementById('posts-count-badge');
  if (!container) return;

  trackDailyActivity();

  const posts = await fetchPublishedBlogPosts();

  if (badge) {
    badge.textContent = `${posts.length} ${posts.length === 1 ? 'Article' : 'Articles'}`;
  }

  if (posts.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
        <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center font-bold">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path></svg>
        </div>
        <h3 class="text-base font-bold text-slate-800">No blog posts published yet</h3>
        <p class="text-xs text-slate-500 max-w-sm mx-auto">Check back soon for new articles, product announcements, and financial calculation guides.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = posts.map(post => {
    const formattedDate = post.createdAt && post.createdAt.seconds 
      ? new Date(post.createdAt.seconds * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
      : (post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'Recently published');

    const shortBody = post.body.length > 160 ? post.body.substring(0, 160) + '...' : post.body;
    const hasImage = post.featuredImage && (post.featuredImage.startsWith('http://') || post.featuredImage.startsWith('https://'));
    const shareUrl = `${window.location.origin}/blog/${post.id}-${slugify(post.title)}`;

    return `
      <article class="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group">
        <div class="space-y-3">
          ${hasImage ? `
            <div class="w-full h-40 rounded-2xl overflow-hidden relative bg-slate-50 border border-slate-100">
              <img src="${escapeHTML(post.featuredImage)}" alt="${escapeHTML(post.title)}" class="w-full h-full object-cover transition-transform group-hover:scale-102 duration-300" onerror="this.parentElement.remove()" />
            </div>
          ` : ''}
          <div class="flex items-center justify-between text-xs text-slate-400">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">${escapeHTML(post.type || 'Blog Post')}</span>
            <time class="font-medium text-[11px]">${formattedDate}</time>
          </div>
          <h3 class="text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors tracking-tight leading-snug">${escapeHTML(post.title)}</h3>
          <p class="text-xs text-slate-600 leading-relaxed">${escapeHTML(shortBody)}</p>
        </div>

        <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 w-full">
          <button data-post-id="${post.id}" class="btn-read-more inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-800 transition-colors cursor-pointer w-full text-left">
            <span>Read Full Article</span>
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
          </button>
          
          <button data-share-url="${escapeHTML(shareUrl)}" class="btn-share-card p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl transition-all cursor-pointer border border-slate-200/80 flex items-center justify-center" title="Share Article">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 10.742l5.064-2.532m0 0A3 3 0 1015.347 4.9a3 3 0 00-1.6 3.31M8.684 13.258l5.064 2.532m0 0A3 3 0 1015.347 19.1a3 3 0 00-1.6-3.31"></path></svg>
          </button>
        </div>
      </article>
    `;
  }).join('');

  // Attach modal click listeners
  const modal = document.getElementById('post-detail-modal');
  const modalContent = document.getElementById('post-detail-content');
  const modalTitle = document.getElementById('modal-post-title');
  const modalType = document.getElementById('modal-post-type');
  const modalDate = document.getElementById('modal-post-date');
  const modalBody = document.getElementById('modal-post-body');
  const modalShareButtons = document.getElementById('modal-share-buttons');
  const closeBtn = document.getElementById('close-post-modal-btn');

  const openModal = (post) => {
    if (!modal) return;
    const formattedDate = post.createdAt && post.createdAt.seconds 
      ? new Date(post.createdAt.seconds * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
      : (post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'Recently published');

    modalTitle.textContent = post.title;
    modalType.textContent = post.type || 'Blog Post';
    modalDate.textContent = `Published on ${formattedDate} by ${post.createdBy || 'Member'}`;
    modalBody.textContent = post.body;

    // Handle modal featured image
    let existingImg = document.getElementById('modal-post-featured-image');
    if (existingImg) existingImg.remove();

    if (post.featuredImage && (post.featuredImage.startsWith('http://') || post.featuredImage.startsWith('https://'))) {
      const img = document.createElement('img');
      img.id = 'modal-post-featured-image';
      img.src = post.featuredImage;
      img.alt = post.title;
      img.className = 'w-full h-64 object-cover rounded-2xl border border-slate-200 mb-4 shadow-sm';
      img.onerror = () => img.remove();
      modalBody.parentNode.insertBefore(img, modalBody);
    }

    // Render Social Share Options
    const shareUrl = `${window.location.origin}/blog/${post.id}-${slugify(post.title)}`;
    const shareText = encodeURIComponent(`Check out this article on FinCalc Tools: ${post.title}`);
    const encodedUrl = encodeURIComponent(shareUrl);

    if (modalShareButtons) {
      modalShareButtons.innerHTML = `
        <a href="https://twitter.com/intent/tweet?url=${encodedUrl}&text=${shareText}" target="_blank" class="px-2.5 py-1.5 bg-slate-900 hover:bg-black text-white text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1">
          <svg class="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          <span>Twitter / X</span>
        </a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" class="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1">
          <svg class="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          <span>Facebook</span>
        </a>
        <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}" target="_blank" class="px-2.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1">
          <svg class="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          <span>LinkedIn</span>
        </a>
        <a href="https://api.whatsapp.com/send?text=${shareText}%20${encodedUrl}" target="_blank" class="px-2.5 py-1.5 bg-green-500 hover:bg-green-600 text-white text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1">
          <svg class="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.504-5.714-1.465L0 24zm6.59-2.859c1.62.962 3.377 1.47 5.356 1.472 5.568 0 10.1-4.52 10.104-10.093.002-2.699-1.045-5.236-2.949-7.142-1.904-1.905-4.43-2.955-7.129-2.956-5.572 0-10.104 4.52-10.108 10.095-.001 1.916.501 3.79 1.448 5.405L1.875 22.13l5.772-1.514zM16.518 14c-.288-.144-1.7-.84-1.962-.936-.264-.096-.456-.144-.648.144-.192.288-.744.936-.912 1.128-.168.192-.336.216-.624.072-1.359-.68-2.355-1.197-3.23-2.696-.232-.397.232-.369.664-1.23.072-.144.036-.269-.018-.377-.054-.108-.456-1.104-.624-1.512-.164-.396-.333-.342-.456-.348-.118-.006-.253-.007-.389-.007-.136 0-.356.05-.542.253-.187.203-.712.696-.712 1.696s.728 1.968.829 2.102c.101.134 1.432 2.187 3.47 3.065.485.208.863.332 1.157.426.488.156.932.134 1.283.081.391-.059 1.7-.696 1.94-1.368.24-.672.24-1.248.168-1.368-.072-.12-.264-.216-.552-.36z"/></svg>
          <span>WhatsApp</span>
        </a>
        <button id="btn-modal-copy-link" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
          <span>Copy Link</span>
        </button>
      `;

      // Copy Link listener
      const btnCopy = document.getElementById('btn-modal-copy-link');
      if (btnCopy) {
        btnCopy.onclick = () => {
          navigator.clipboard.writeText(shareUrl).then(() => {
            showToast('Article link copied to clipboard!', 'success');
          });
        };
      }
    }

    modal.classList.remove('hidden');
    setTimeout(() => {
      modal.classList.add('opacity-100');
      modalContent?.classList.remove('scale-95');
      modalContent?.classList.add('scale-100');
    }, 10);
  };

  const closeModal = () => {
    if (!modal) return;
    modal.classList.remove('opacity-100');
    modalContent?.classList.remove('scale-100');
    modalContent?.classList.add('scale-95');
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 200);
  };

  // Add click listeners to card buttons
  document.querySelectorAll('.btn-read-more').forEach(btn => {
    btn.addEventListener('click', () => {
      const postId = btn.getAttribute('data-post-id');
      const post = posts.find(p => p.id === postId);
      if (post) openModal(post);
    });
  });

  // Card Share Button: Native share fallback to copy link
  document.querySelectorAll('.btn-share-card').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const shareUrl = btn.getAttribute('data-share-url');
      const post = posts.find(p => `${window.location.origin}/blog/${p.id}-${slugify(p.title)}` === shareUrl);
      if (!post) return;

      const shareTitle = post.title;

      if (navigator.share) {
        try {
          await navigator.share({
            title: shareTitle,
            text: `Check out this article on FinCalc Tools: ${shareTitle}`,
            url: shareUrl
          });
        } catch (err) {
          console.log('Share canceled or failed:', err);
        }
      } else {
        // Fallback: Copy link
        navigator.clipboard.writeText(shareUrl).then(() => {
          showToast('Article link copied to clipboard!', 'success');
        });
      }
    });
  });

  closeBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Deep linking to open specific article from path "/blog/123456-slug" or query "?post=123456"
  const path = window.location.pathname;
  let postIdParam = null;
  const blogMatch = path.match(/\/blog\/(\d{4,6})-.*/);
  
  if (blogMatch) {
    postIdParam = blogMatch[1];
  } else {
    const urlParams = new URLSearchParams(window.location.search);
    postIdParam = urlParams.get('post');
  }

  if (postIdParam) {
    const post = posts.find(p => String(p.id) === String(postIdParam));
    if (post) {
      setTimeout(() => {
        openModal(post);
      }, 300);
    }
  }
}

window.addEventListener('DOMContentLoaded', initUpdatesPage);
