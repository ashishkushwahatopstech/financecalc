/**
 * FinCalc Tools - User Profile & Personal Blog Manager Controller
 * Handles reading/writing user preferences, username adjustments, and
 * user blog posts CRUD with post limits and featured images.
 */
import { 
  auth, 
  db, 
  onAuthStateChanged, 
  doc, 
  getDoc, 
  updateDoc,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where
} from './firebase-config.js';
import { 
  getCurrentUser, 
  showToast, 
  showUsernameModal, 
  getLocalUserRegistry,
  getSavedCollections,
  removeItemFromCollection
} from './auth.js';

let activeUser = null;
let userBlogPostsCache = [];

// Helper to escape HTML characters
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper to slugify titles for URLs
function slugify(text) {
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

/**
 * Render private account settings info
 */
function renderUserInfo(user) {
  const elAvatar = document.getElementById('profile-avatar');
  const elName = document.getElementById('profile-name');
  const elEmail = document.getElementById('profile-email');
  const elJoined = document.getElementById('profile-joined');
  const elUsernameBadge = document.getElementById('profile-username-badge');

  if (elAvatar) {
    elAvatar.src = user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150';
    elAvatar.classList.remove('animate-pulse', 'bg-slate-200');
  }
  if (elName) elName.textContent = user.displayName || user.name || 'FinCalc User';
  if (elEmail) elEmail.textContent = user.email || '';
  
  const creationDate = user.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'Today';
  if (elJoined) elJoined.textContent = `Member since ${creationDate}${user.isDemo ? ' (Demo Account)' : ''}`;

  const currentUsername = user.username || '';
  if (elUsernameBadge) {
    elUsernameBadge.textContent = currentUsername ? `@${currentUsername}` : '@set_username';
  }
}

/**
 * Load user preferences and post limits from Firestore database
 */
async function loadUserPreferencesAndLimits(uid) {
  const elCountry = document.getElementById('pref-country');
  const elCurrency = document.getElementById('pref-currency');
  const elLimitText = document.getElementById('blog-post-limit-text');

  // Set default preference values
  const localPrefsRaw = localStorage.getItem(`prefs_${uid}`);
  if (localPrefsRaw) {
    try {
      const localPrefs = JSON.parse(localPrefsRaw);
      if (elCountry && localPrefs.defaultCountry) elCountry.value = localPrefs.defaultCountry;
      if (elCurrency && localPrefs.defaultCurrency) elCurrency.value = localPrefs.defaultCurrency;
    } catch (e) {
      console.warn("Local prefs parse error:", e);
    }
  }

  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();
      if (data.username && activeUser) {
        activeUser.username = data.username;
        renderUserInfo(activeUser);
      }
      
      // Update UI limit badge
      const postLimit = data.postLimit || 6;
      if (elLimitText) elLimitText.textContent = postLimit;
      if (activeUser) activeUser.postLimit = postLimit;

      if (data.preferences) {
        if (elCountry && data.preferences.defaultCountry) elCountry.value = data.preferences.defaultCountry;
        if (elCurrency && data.preferences.defaultCurrency) elCurrency.value = data.preferences.defaultCurrency;
      }
    } else {
      if (elLimitText) elLimitText.textContent = 6;
      if (activeUser) activeUser.postLimit = 6;
    }
  } catch (err) {
    console.warn("Error loading Firestore user details:", err);
    if (elLimitText) elLimitText.textContent = 6;
    if (activeUser) activeUser.postLimit = 6;
  }
}

/**
 * Save user preference modifications
 */
function setupPreferenceListeners(uid) {
  const elCountry = document.getElementById('pref-country');
  const elCurrency = document.getElementById('pref-currency');
  const btnSave = document.getElementById('btn-save-prefs');

  async function savePrefs() {
    const countryVal = elCountry ? elCountry.value : 'US';
    const currencyVal = elCurrency ? elCurrency.value : 'USD';

    localStorage.setItem(`prefs_${uid}`, JSON.stringify({ defaultCountry: countryVal, defaultCurrency: currencyVal }));

    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        'preferences.defaultCountry': countryVal,
        'preferences.defaultCurrency': currencyVal
      });
      showToast('Preferences saved successfully!', 'success');
    } catch (err) {
      console.warn("Firestore save error (saved locally):", err);
      showToast('Preferences saved to browser session!', 'success');
    }
  }

  if (btnSave) btnSave.addEventListener('click', savePrefs);
  if (elCountry) elCountry.addEventListener('change', savePrefs);
  if (elCurrency) elCurrency.addEventListener('change', savePrefs);
}

/**
 * Handle username edit triggers
 */
function setupPrivateSettingsListeners(user) {
  const btnChangeHandle = document.getElementById('btn-open-change-username');

  if (btnChangeHandle) {
    btnChangeHandle.onclick = () => {
      showUsernameModal({
        user,
        currentUsername: user.username || '',
        isChange: true,
        onComplete: (newUsername) => {
          user.username = newUsername;
          renderUserInfo(user);
        }
      });
    };
  }
}

/* ==========================================================================
   USER BLOG POSTS MANAGER
   ========================================================================== */

async function loadUserBlogPosts(user) {
  const container = document.getElementById('user-posts-container');
  if (!container) return;

  try {
    const q = query(
      collection(db, 'blog_posts'),
      where('authorUid', '==', user.uid)
    );
    const snapshot = await getDocs(q);
    userBlogPostsCache = [];
    snapshot.forEach(docSnap => {
      userBlogPostsCache.push({ id: docSnap.id, ...docSnap.data() });
    });
  } catch (err) {
    console.warn("Failed to fetch user blog posts, using local cache fallback:", err);
    // Fallback local cache key
    const localRaw = localStorage.getItem(`blog_posts_${user.uid}`);
    userBlogPostsCache = localRaw ? JSON.parse(localRaw) : [];
  }

  renderUserBlogPostsList(container, user);
}

function renderUserBlogPostsList(container, user) {
  if (userBlogPostsCache.length === 0) {
    container.innerHTML = `
      <p class="text-slate-400 py-10 text-center text-xs">
        You haven't written any blog posts yet. Click "New Post" to get started!
      </p>
    `;
    return;
  }

  container.innerHTML = userBlogPostsCache.map(post => {
    const dateStr = post.createdAt && post.createdAt.seconds 
      ? new Date(post.createdAt.seconds * 1000).toLocaleDateString()
      : (post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'Draft');
      
    const isPublic = post.status === 'public';
    const isPublished = post.published;
    const hasImage = post.featuredImage && (post.featuredImage.startsWith('http://') || post.featuredImage.startsWith('https://'));

    const shareUrl = `${window.location.origin}/blog/${post.id}-${slugify(post.title)}`;

    return `
      <div class="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="flex gap-3 items-start overflow-hidden">
          ${hasImage ? `
            <img src="${escapeHTML(post.featuredImage)}" class="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0" onerror="this.remove()" />
          ` : ''}
          <div class="space-y-1 min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="px-2 py-0.5 rounded text-[9px] font-bold ${isPublic ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}">
                ${isPublic ? 'Public' : 'Private'}
              </span>
              <span class="px-2 py-0.5 rounded text-[9px] font-bold ${isPublished ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">
                ${isPublished ? 'Published' : 'Draft'}
              </span>
              <span class="text-slate-400 text-[10px]">${dateStr}</span>
            </div>
            <h4 class="font-bold text-slate-900 text-xs sm:text-sm tracking-tight truncate max-w-sm sm:max-w-md">${escapeHTML(post.title)}</h4>
            <p class="text-slate-500 text-[11px] line-clamp-1 leading-relaxed">${escapeHTML(post.body)}</p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          ${isPublic && isPublished ? `
            <button data-share-url="${escapeHTML(shareUrl)}" class="btn-share-post-link p-2 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-xl transition-colors cursor-pointer border border-slate-200" title="Copy article share link">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 10.742l5.064-2.532m0 0A3 3 0 1015.347 4.9a3 3 0 00-1.6 3.31M8.684 13.258l5.064 2.532m0 0A3 3 0 1015.347 19.1a3 3 0 00-1.6-3.31"></path></svg>
            </button>
          ` : ''}
          <button data-edit-id="${post.id}" class="btn-edit-post px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer text-xs">
            Edit
          </button>
          <button data-delete-id="${post.id}" class="btn-delete-post px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg transition-colors cursor-pointer text-xs">
            Delete
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Register Share Link triggers
  document.querySelectorAll('.btn-share-post-link').forEach(btn => {
    btn.onclick = () => {
      const url = btn.getAttribute('data-share-url');
      navigator.clipboard.writeText(url).then(() => {
        showToast('Blog article URL copied!', 'success');
      });
    };
  });

  // Register Edit trigger
  document.querySelectorAll('.btn-edit-post').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-edit-id');
      const post = userBlogPostsCache.find(p => p.id === id);
      if (post) openBlogModal(user, post);
    };
  });

  // Register Delete trigger
  document.querySelectorAll('.btn-delete-post').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-delete-id');
      if (confirm('Are you sure you want to delete this article?')) {
        try {
          await deleteDoc(doc(db, 'blog_posts', id));
          showToast('Article deleted successfully!', 'success');
        } catch (err) {
          console.warn("Delete document failed, updating local fallback:", err.message);
        }
        
        userBlogPostsCache = userBlogPostsCache.filter(p => p.id !== id);
        localStorage.setItem(`blog_posts_${user.uid}`, JSON.stringify(userBlogPostsCache));
        renderUserBlogPostsList(container, user);
      }
    };
  });
}

function openBlogModal(user, post = null) {
  const modal = document.getElementById('user-blog-post-modal');
  const form = document.getElementById('form-user-blog-post');
  const titleVal = document.getElementById('modal-post-form-title');
  
  if (!modal || !form) return;

  const editId = document.getElementById('blog-post-edit-id');
  const postTitle = document.getElementById('blog-post-title');
  const postImage = document.getElementById('blog-post-image');
  const postBody = document.getElementById('blog-post-body');
  const postStatus = document.getElementById('blog-post-status');
  const postPublished = document.getElementById('blog-post-published');

  if (post) {
    titleVal.innerHTML = `<svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg> Edit Article`;
    editId.value = post.id;
    postTitle.value = post.title;
    postImage.value = post.featuredImage || '';
    postBody.value = post.body;
    postStatus.value = post.status || 'public';
    postPublished.value = post.published ? 'true' : 'false';
  } else {
    titleVal.innerHTML = `<svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg> Write New Article`;
    form.reset();
    editId.value = '';
  }

  modal.classList.remove('hidden');
}

function closeBlogModal() {
  const modal = document.getElementById('user-blog-post-modal');
  if (modal) modal.classList.add('hidden');
}

function setupBlogManagerUI(user) {
  const btnCreate = document.getElementById('btn-create-user-post');
  const btnClose = document.getElementById('btn-close-post-modal');
  const btnCancel = document.getElementById('btn-cancel-post');
  const form = document.getElementById('form-user-blog-post');

  if (btnCreate) {
    btnCreate.onclick = () => {
      const currentLimit = user.postLimit || 6;
      if (userBlogPostsCache.length >= currentLimit) {
        showToast(`Article limit reached! You can write a maximum of ${currentLimit} posts.`, 'error');
        return;
      }
      openBlogModal(user);
    };
  }

  if (btnClose) btnClose.onclick = closeBlogModal;
  if (btnCancel) btnCancel.onclick = closeBlogModal;

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      
      const editId = document.getElementById('blog-post-edit-id').value;
      const title = document.getElementById('blog-post-title').value.trim();
      const image = document.getElementById('blog-post-image').value.trim();
      const body = document.getElementById('blog-post-body').value.trim();
      const status = document.getElementById('blog-post-status').value;
      const published = document.getElementById('blog-post-published').value === 'true';

      const currentLimit = user.postLimit || 6;
      if (!editId && userBlogPostsCache.length >= currentLimit) {
        showToast(`Post limit reached! You can write a maximum of ${currentLimit} posts.`, 'error');
        return;
      }

      // Generate a 6-digit number ID for new posts
      const postId = editId || String(Math.floor(100000 + Math.random() * 900000));

      const newPost = {
        id: postId,
        title,
        featuredImage: image,
        body,
        status,
        published,
        authorUid: user.uid,
        createdBy: user.email,
        authorName: user.displayName || user.name || 'FinCalc User',
        createdAt: editId ? (userBlogPostsCache.find(p => p.id === editId)?.createdAt || Date.now()) : Date.now(),
        updatedAt: Date.now()
      };

      try {
        // Write to Firestore database directly
        await setDoc(doc(db, 'blog_posts', postId), newPost);
        showToast('Article saved to Cloud successfully!', 'success');
      } catch (err) {
        console.warn("Firestore save failed, caching locally:", err.message);
        showToast('Article saved locally in offline session!', 'success');
      }

      // Sync local cache
      const index = userBlogPostsCache.findIndex(p => p.id === postId);
      if (index >= 0) {
        userBlogPostsCache[index] = newPost;
      } else {
        userBlogPostsCache.unshift(newPost);
      }

      localStorage.setItem(`blog_posts_${user.uid}`, JSON.stringify(userBlogPostsCache));
      
      closeBlogModal();
      
      const container = document.getElementById('user-posts-container');
      if (container) renderUserBlogPostsList(container, user);
    };
  }
}

async function setupSavedCollectionsUI(user) {
  const elList = document.getElementById('saved-collection-list');
  const elCount = document.getElementById('saved-collection-count');
  const tabPages = document.getElementById('tab-saved-pages');
  const tabBlogs = document.getElementById('tab-saved-blogs');
  const tabCalcs = document.getElementById('tab-saved-calcs');

  if (!elList) return;

  let currentTab = 'pages'; // 'pages', 'blogs', 'calculations'

  const collections = await getSavedCollections();

  const renderCurrentTab = () => {
    const list = collections[currentTab] || [];
    
    // Set active tab styles
    const activeClass = 'px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/80 cursor-pointer';
    const inactiveClass = 'px-2.5 py-1 rounded-lg bg-slate-50 text-slate-650 hover:bg-slate-100/80 border border-slate-200/50 cursor-pointer';
    
    if (tabPages) tabPages.className = currentTab === 'pages' ? activeClass : inactiveClass;
    if (tabBlogs) tabBlogs.className = currentTab === 'blogs' ? activeClass : inactiveClass;
    if (tabCalcs) tabCalcs.className = currentTab === 'calculations' ? activeClass : inactiveClass;

    if (elCount) {
      elCount.textContent = `${list.length} ${currentTab} saved`;
    }

    if (list.length === 0) {
      elList.innerHTML = `
        <div class="text-center py-6 px-4 border-2 border-dashed border-slate-100 rounded-xl">
          <p class="text-[11px] font-semibold text-slate-400">No saved ${currentTab} yet</p>
        </div>
      `;
      return;
    }

    elList.innerHTML = list.map(item => {
      let icon = '🔖';
      let title = item.name || item.title || 'Untitled';
      let subtitle = '';
      let actionUrl = item.href || item.url || '#';

      if (currentTab === 'pages') {
        icon = '🛠️';
        subtitle = 'Calculator Tool';
      } else if (currentTab === 'blogs') {
        icon = '📰';
        subtitle = 'Blog Post';
      } else if (currentTab === 'calculations') {
        icon = '📊';
        subtitle = item.toolName || 'Calculation';
        if (item.inputs) {
          const inputPairs = Object.entries(item.inputs)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
          subtitle += ` (${inputPairs.length > 50 ? inputPairs.substring(0, 50) + '...' : inputPairs})`;
        }
      }

      return `
        <div class="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/60 rounded-xl border border-slate-200/60 transition-colors gap-3">
          <a href="${actionUrl}" class="flex items-center gap-2.5 min-w-0 flex-1 hover:underline">
            <span class="text-base shrink-0">${icon}</span>
            <div class="min-w-0">
              <p class="text-xs font-bold text-slate-800 truncate">${escapeHTML(title)}</p>
              <p class="text-[9px] text-slate-400 font-semibold truncate leading-none mt-0.5">${escapeHTML(subtitle)}</p>
            </div>
          </a>
          <button data-id="${item.id}" class="btn-remove-saved-item p-1 text-slate-450 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" title="Remove Bookmark">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      `;
    }).join('');

    // Attach remove listener
    elList.querySelectorAll('.btn-remove-saved-item').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        await removeItemFromCollection(currentTab, id);
        collections[currentTab] = collections[currentTab].filter(x => x.id !== id);
        showToast(`Removed from saved collections`, 'info');
        renderCurrentTab();
      });
    });
  };

  if (tabPages) {
    tabPages.addEventListener('click', () => {
      currentTab = 'pages';
      renderCurrentTab();
    });
  }
  if (tabBlogs) {
    tabBlogs.addEventListener('click', () => {
      currentTab = 'blogs';
      renderCurrentTab();
    });
  }
  if (tabCalcs) {
    tabCalcs.addEventListener('click', () => {
      currentTab = 'calculations';
      renderCurrentTab();
    });
  }

  renderCurrentTab();

  window.addEventListener('saved-collections-updated', (e) => {
    const updated = e.detail;
    if (updated) {
      Object.assign(collections, updated);
      renderCurrentTab();
    }
  });
}

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */

function setupProfileUser(user) {
  if (!user) {
    console.warn("Unauthenticated attempt to access private profile page.");
    window.location.href = 'index.html';
    return;
  }

  activeUser = user;
  renderUserInfo(user);
  loadUserPreferencesAndLimits(user.uid).then(() => {
    loadUserBlogPosts(user);
    setupBlogManagerUI(user);
    setupSavedCollectionsUI(user);
  });
  setupPreferenceListeners(user.uid);
  setupPrivateSettingsListeners(user);
}

async function initProfilePage() {
  const currentUser = getCurrentUser();
  if (currentUser) {
    setupProfileUser(currentUser);
  }

  window.addEventListener('auth-state-changed', (e) => {
    const user = e.detail?.user;
    if (user) {
      setupProfileUser(user);
    } else {
      window.location.href = 'index.html';
    }
  });

  window.addEventListener('username-updated', (e) => {
    if (activeUser && e.detail?.username) {
      activeUser.username = e.detail.username;
      renderUserInfo(activeUser);
    }
  });
}

document.addEventListener('DOMContentLoaded', initProfilePage);
