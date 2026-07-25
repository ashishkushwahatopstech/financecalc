/**
 * FinCalc Tools - User Profile & Public Handle Controller
 * Handles auth protection, reading/writing user preferences to Firestore,
 * public profile URL routing (/@username), public link copy, and username modifications.
 */
import { 
  auth, 
  db, 
  onAuthStateChanged, 
  doc, 
  getDoc, 
  updateDoc 
} from './firebase-config.js';
import { 
  getCurrentUser, 
  showToast, 
  showUsernameModal, 
  getLocalUserRegistry 
} from './auth.js';

let activeUser = null;

/**
 * Extract requested username from URL path or query params
 * Handles /@username, ?u=username, and #@username
 */
function extractTargetUsernameFromUrl() {
  const pathname = window.location.pathname;
  
  if (pathname.includes('/@')) {
    const raw = pathname.split('/@')[1].split('/')[0].split('?')[0].trim();
    if (raw) return raw.toLowerCase();
  }

  const searchParams = new URLSearchParams(window.location.search);
  const paramU = searchParams.get('u');
  if (paramU) return paramU.trim().toLowerCase();

  const hash = window.location.hash;
  if (hash && hash.startsWith('#@')) {
    return hash.substring(2).trim().toLowerCase();
  }

  return null;
}

/**
 * Renders the public profile view for a given @username
 */
async function loadAndRenderPublicProfile(username) {
  const elPrivateView = document.getElementById('private-settings-view');
  const elPublicView = document.getElementById('public-profile-view');
  const elNotFoundView = document.getElementById('user-not-found-view');

  if (elPrivateView) elPrivateView.classList.add('hidden');
  if (elNotFoundView) elNotFoundView.classList.add('hidden');
  if (elPublicView) elPublicView.classList.remove('hidden');

  let profileData = null;

  try {
    // 1. Fetch username mapping from Firestore DB
    const usernameDocRef = doc(db, 'usernames', username.toLowerCase());
    const usernameSnap = await getDoc(usernameDocRef);

    if (usernameSnap.exists()) {
      const uid = usernameSnap.data().uid;
      const userDocRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        profileData = userSnap.data();
      }
    }
  } catch (err) {
    console.warn("Firestore public profile lookup error:", err);
  }

  // 2. Local fallback if offline or demo user
  if (!profileData) {
    const localUsers = getLocalUserRegistry();
    const match = localUsers.find(u => u.username?.toLowerCase() === username.toLowerCase());
    if (match) profileData = match;
  }

  // 3. User Not Found State
  if (!profileData) {
    if (elPublicView) elPublicView.classList.add('hidden');
    if (elNotFoundView) elNotFoundView.classList.remove('hidden');
    const msg = document.getElementById('not-found-username-msg');
    if (msg) msg.textContent = `The public handle @${username} was not found or may have been changed.`;
    return;
  }

  // 4. Render Public Profile Data
  const elAvatar = document.getElementById('pub-avatar');
  const elName = document.getElementById('pub-name');
  const elUsername = document.getElementById('pub-username');
  const elRoleBadge = document.getElementById('pub-role-badge');
  const elStatus = document.getElementById('pub-status');
  const elJoined = document.getElementById('pub-joined');
  const elShareBtn = document.getElementById('btn-pub-share');
  const elEditBtn = document.getElementById('pub-edit-settings-btn');

  if (elAvatar) elAvatar.src = profileData.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150';
  if (elName) elName.textContent = profileData.name || 'FinCalc User';
  if (elUsername) elUsername.textContent = `@${profileData.username || username}`;
  
  if (elRoleBadge) {
    if (profileData.role === 'ADMIN') {
      elRoleBadge.classList.remove('hidden');
    } else {
      elRoleBadge.classList.add('hidden');
    }
  }

  if (elStatus) elStatus.textContent = profileData.status || 'Active Member';
  if (elJoined) {
    const d = profileData.firstLogin ? new Date(profileData.firstLogin).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }) : '2026';
    elJoined.textContent = d;
  }

  // Share button logic
  if (elShareBtn) {
    elShareBtn.onclick = () => {
      const publicUrl = `${window.location.origin}/@${profileData.username || username}`;
      navigator.clipboard.writeText(publicUrl).then(() => {
        showToast('Public profile link copied to clipboard!', 'success');
      }).catch(() => {
        showToast(`Profile Link: ${publicUrl}`, 'info');
      });
    };
  }

  // Show edit button if currently logged in user owns this profile
  const currentUser = getCurrentUser();
  if (currentUser && profileData.uid && currentUser.uid === profileData.uid) {
    if (elEditBtn) elEditBtn.classList.remove('hidden');
  } else {
    if (elEditBtn) elEditBtn.classList.add('hidden');
  }
}

/**
 * Render private account settings view
 */
function renderUserInfo(user) {
  const elAvatar = document.getElementById('profile-avatar');
  const elName = document.getElementById('profile-name');
  const elEmail = document.getElementById('profile-email');
  const elJoined = document.getElementById('profile-joined');
  const elUsernameBadge = document.getElementById('profile-username-badge');
  const elPublicUrlText = document.getElementById('public-profile-url-text');
  const elViewPublicBtn = document.getElementById('btn-view-public-profile');

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

  const publicLink = `${window.location.origin}/@${currentUsername || 'username'}`;
  if (elPublicUrlText) {
    elPublicUrlText.textContent = `${window.location.host}/@${currentUsername || 'username'}`;
  }
  if (elViewPublicBtn) {
    elViewPublicBtn.href = `/@${currentUsername || ''}`;
  }
}

async function loadUserPreferences(uid) {
  const elCountry = document.getElementById('pref-country');
  const elCurrency = document.getElementById('pref-currency');

  // Load local preferences as fallback
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
      if (data.preferences) {
        if (elCountry && data.preferences.defaultCountry) elCountry.value = data.preferences.defaultCountry;
        if (elCurrency && data.preferences.defaultCurrency) elCurrency.value = data.preferences.defaultCurrency;
      }
    }
  } catch (err) {
    console.warn("Error loading Firestore user details:", err);
  }
}

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

function setupPrivateSettingsListeners(user) {
  const btnCopy = document.getElementById('btn-copy-public-link');
  const btnChangeHandle = document.getElementById('btn-open-change-username');

  if (btnCopy) {
    btnCopy.onclick = () => {
      const handle = user.username || '';
      const fullUrl = `${window.location.origin}/@${handle}`;
      navigator.clipboard.writeText(fullUrl).then(() => {
        showToast('Public profile link copied to clipboard!', 'success');
      }).catch(() => {
        showToast(`Profile link: ${fullUrl}`, 'info');
      });
    };
  }

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

function setupProfileUser(user) {
  if (!user) {
    console.warn("Unauthenticated attempt to access private profile page.");
    window.location.href = 'index.html';
    return;
  }

  activeUser = user;
  renderUserInfo(user);
  loadUserPreferences(user.uid);
  setupPreferenceListeners(user.uid);
  setupPrivateSettingsListeners(user);
}

async function initProfilePage() {
  const targetUsername = extractTargetUsernameFromUrl();

  // Route 1: Public Profile Request (e.g. /@username)
  if (targetUsername) {
    await loadAndRenderPublicProfile(targetUsername);
    return;
  }

  // Route 2: Private Settings Page
  const currentUser = getCurrentUser();
  if (currentUser) {
    setupProfileUser(currentUser);
  }

  window.addEventListener('auth-state-changed', (e) => {
    const user = e.detail?.user;
    if (!extractTargetUsernameFromUrl()) {
      if (user) {
        setupProfileUser(user);
      } else {
        window.location.href = 'index.html';
      }
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
