/**
 * FinCalc Tools - Content Management Engine
 * Handles Admin Announcements & Blog Posts CRUD, Public Announcement Banner, and Updates Page.
 */

import { 
  db, 
  doc, 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp 
} from './firebase-config.js';
import { getCurrentUser } from './auth.js';

/**
 * Escapes HTML characters to prevent XSS attacks
 * @param {string} str 
 * @returns {string}
 */
export function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ==========================================================================
   LOCAL CONTENT CACHE & FALLBACKS
   ========================================================================== */

function getLocalContentCache() {
  try {
    const raw = localStorage.getItem('fincalc_local_content_cache');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function setLocalContentCache(items) {
  try {
    localStorage.setItem('fincalc_local_content_cache', JSON.stringify(items));
  } catch (e) {}
}

function saveToLocalContentCache(newItem) {
  const items = getLocalContentCache();
  const index = items.findIndex(i => i.id === newItem.id);
  if (index >= 0) {
    items[index] = { ...items[index], ...newItem };
  } else {
    items.unshift(newItem);
  }
  setLocalContentCache(items);
}

function removeFromLocalContentCache(id) {
  const items = getLocalContentCache().filter(i => i.id !== id);
  setLocalContentCache(items);
}

/* ==========================================================================
   PUBLIC ANNOUNCEMENT BANNER
   ========================================================================== */

/**
 * Checks for published Announcement Banners and displays top dismissible banner
 */
export async function initPublicAnnouncementBanner() {
  let banners = [];

  try {
    const q = query(
      collection(db, 'content'),
      where('type', '==', 'Announcement Banner'),
      where('published', '==', true)
    );

    const snapshot = await getDocs(q);
    snapshot.forEach(docSnap => {
      banners.push({ id: docSnap.id, ...docSnap.data() });
    });
  } catch (err) {
    console.warn('[ContentManager] Banner query note:', err.message);
  }

  // Merge local cache banners
  const localBanners = getLocalContentCache().filter(i => i.type === 'Announcement Banner' && i.published);
  const bannerMap = new Map();
  localBanners.forEach(b => bannerMap.set(b.id, b));
  banners.forEach(b => bannerMap.set(b.id, b));

  const allBanners = Array.from(bannerMap.values());
  if (allBanners.length === 0) return;

  allBanners.sort((a, b) => {
    const timeA = a.createdAt ? (a.createdAt.seconds || (typeof a.createdAt === 'number' ? a.createdAt : 0)) : 0;
    const timeB = b.createdAt ? (b.createdAt.seconds || (typeof b.createdAt === 'number' ? b.createdAt : 0)) : 0;
    return timeB - timeA;
  });

  const activeBanner = allBanners[0];
  if (!activeBanner) return;

  // Check localStorage dismissal
  const dismissedId = localStorage.getItem('fincalc_dismissed_banner_id');
  if (dismissedId === activeBanner.id) return;

  renderAnnouncementBanner(activeBanner);
}

function renderAnnouncementBanner(banner) {
  let existing = document.getElementById('public-announcement-banner');
  if (existing) existing.remove();

  const bannerEl = document.createElement('div');
  bannerEl.id = 'public-announcement-banner';
  bannerEl.className = 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white text-xs py-2.5 px-4 sticky top-0 z-50 shadow-md flex items-center justify-between gap-3 animate-fade-in';

  bannerEl.innerHTML = `
    <div class="max-w-7xl mx-auto flex items-center justify-center gap-2 text-center flex-grow">
      <span class="font-bold uppercase bg-amber-950/40 text-amber-200 text-[10px] px-2 py-0.5 rounded-full border border-amber-300/30 shrink-0">Announcement</span>
      <span class="font-bold tracking-tight">${escapeHTML(banner.title)}:</span>
      <span class="font-normal text-amber-100">${escapeHTML(banner.body)}</span>
    </div>
    <button id="btn-close-announcement-banner" class="p-1 text-amber-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer shrink-0" title="Dismiss announcement">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
    </button>
  `;

  document.body.prepend(bannerEl);

  document.getElementById('btn-close-announcement-banner')?.addEventListener('click', () => {
    localStorage.setItem('fincalc_dismissed_banner_id', banner.id);
    bannerEl.remove();
  });
}

/* ==========================================================================
   PUBLIC UPDATES / BLOG PAGE
   ========================================================================== */

/**
 * Fetches published blog posts for updates.html
 */
export async function fetchPublishedBlogPosts() {
  let posts = [];

  try {
    const q = query(
      collection(db, 'content'),
      where('type', '==', 'Blog Post'),
      where('published', '==', true)
    );

    const snapshot = await getDocs(q);
    snapshot.forEach(docSnap => {
      posts.push({ id: docSnap.id, ...docSnap.data() });
    });
  } catch (err) {
    console.warn('[ContentManager] Blog posts query note:', err.message);
  }

  // Merge with local cached blog posts
  const localPosts = getLocalContentCache().filter(i => i.type === 'Blog Post' && i.published);
  const postsMap = new Map();
  localPosts.forEach(p => postsMap.set(p.id, p));
  posts.forEach(p => postsMap.set(p.id, p));

  const allPosts = Array.from(postsMap.values());
  allPosts.sort((a, b) => {
    const timeA = a.createdAt ? (a.createdAt.seconds || (typeof a.createdAt === 'number' ? a.createdAt : 0)) : 0;
    const timeB = b.createdAt ? (b.createdAt.seconds || (typeof b.createdAt === 'number' ? b.createdAt : 0)) : 0;
    return timeB - timeA;
  });

  return allPosts;
}

/* ==========================================================================
   ADMIN CONTENT MANAGEMENT (CRUD)
   ========================================================================== */

/**
 * Creates new Content item in Firestore (Announcement or Blog Post)
 */
export async function createContentItem({ title, body, type, published }) {
  const user = getCurrentUser();
  const createdBy = user?.email || 'ashishkushwaha88643@gmail.com';

  const newDoc = {
    title: title.trim(),
    body: body.trim(),
    type: type, // "Announcement Banner" or "Blog Post"
    published: Boolean(published),
    createdAt: serverTimestamp(),
    createdBy: createdBy
  };

  let createdItem = null;

  try {
    const docRef = await addDoc(collection(db, 'content'), newDoc);
    createdItem = { 
      id: docRef.id, 
      ...newDoc, 
      createdAt: { seconds: Math.floor(Date.now() / 1000) } 
    };
  } catch (err) {
    console.warn('[ContentManager] Firestore create note:', err.message);
    const fallbackId = 'content_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    createdItem = {
      id: fallbackId,
      title: title.trim(),
      body: body.trim(),
      type: type,
      published: Boolean(published),
      createdAt: { seconds: Math.floor(Date.now() / 1000) },
      createdBy: createdBy
    };
  }

  saveToLocalContentCache(createdItem);
  return createdItem;
}

/**
 * Updates existing Content item in Firestore
 */
export async function updateContentItem(id, { title, body, type, published }) {
  const updateData = {
    title: title.trim(),
    body: body.trim(),
    type: type,
    published: Boolean(published)
  };

  try {
    const docRef = doc(db, 'content', id);
    await updateDoc(docRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('[ContentManager] Update content note:', err.message);
  }

  saveToLocalContentCache({ 
    id, 
    ...updateData, 
    createdAt: { seconds: Math.floor(Date.now() / 1000) } 
  });
}

/**
 * Deletes Content item from Firestore
 */
export async function deleteContentItem(id) {
  try {
    const docRef = doc(db, 'content', id);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('[ContentManager] Delete content note:', err.message);
  }

  removeFromLocalContentCache(id);
}

/**
 * Fetches all Content items for Admin Dashboard
 */
export async function fetchAllContentItems() {
  let firestoreItems = [];

  try {
    const snapshot = await getDocs(collection(db, 'content'));
    snapshot.forEach(docSnap => {
      firestoreItems.push({ id: docSnap.id, ...docSnap.data() });
    });
  } catch (err) {
    console.warn('[ContentManager] Content query note:', err.message);
  }

  const localItems = getLocalContentCache();
  const mergedMap = new Map();

  localItems.forEach(item => mergedMap.set(item.id, item));
  firestoreItems.forEach(item => mergedMap.set(item.id, item));

  const items = Array.from(mergedMap.values());
  items.sort((a, b) => {
    const timeA = a.createdAt ? (a.createdAt.seconds || (typeof a.createdAt === 'number' ? a.createdAt : 0)) : 0;
    const timeB = b.createdAt ? (b.createdAt.seconds || (typeof b.createdAt === 'number' ? b.createdAt : 0)) : 0;
    return timeB - timeA;
  });

  return items;
}

// Auto-initialize announcement banner on DOM load
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initPublicAnnouncementBanner();
  });
}

