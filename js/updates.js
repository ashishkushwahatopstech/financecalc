/**
 * FinCalc Tools - Public Blog Updates Controller
 * Fetches published blog posts and renders responsive cards on updates.html.
 */

import { fetchPublishedBlogPosts, escapeHTML } from './content-manager.js';
import { trackDailyActivity } from './analytics.js';

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
      : 'Recently published';

    const shortBody = post.body.length > 160 ? post.body.substring(0, 160) + '...' : post.body;

    return `
      <article class="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group">
        <div class="space-y-2">
          <div class="flex items-center justify-between text-xs text-slate-400">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">${escapeHTML(post.type || 'Blog Post')}</span>
            <time class="font-medium text-[11px]">${formattedDate}</time>
          </div>
          <h3 class="text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors tracking-tight leading-snug">${escapeHTML(post.title)}</h3>
          <p class="text-xs text-slate-600 leading-relaxed">${escapeHTML(shortBody)}</p>
        </div>

        <button data-post-id="${post.id}" class="btn-read-more self-start inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-800 transition-colors cursor-pointer pt-2 border-t border-slate-100 w-full">
          <span>Read Full Article</span>
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
        </button>
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
  const closeBtn = document.getElementById('close-post-modal-btn');

  const openModal = (post) => {
    if (!modal) return;
    const formattedDate = post.createdAt && post.createdAt.seconds 
      ? new Date(post.createdAt.seconds * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
      : 'Recently published';

    modalTitle.textContent = post.title;
    modalType.textContent = post.type || 'Blog Post';
    modalDate.textContent = `Published on ${formattedDate} by ${post.createdBy || 'Admin'}`;
    modalBody.textContent = post.body;

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

  document.querySelectorAll('.btn-read-more').forEach(btn => {
    btn.addEventListener('click', () => {
      const postId = btn.getAttribute('data-post-id');
      const post = posts.find(p => p.id === postId);
      if (post) openModal(post);
    });
  });

  closeBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

window.addEventListener('DOMContentLoaded', initUpdatesPage);
