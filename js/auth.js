/**
 * FinCalc Tools - Authentication & Global Navigation Script
 * Handles Google Sign-In, User Firestore syncing, Nav Bar dynamic rendering,
 * and Admin Email Check.
 */
import Lenis from 'https://unpkg.com/lenis@1.1.18/dist/lenis.mjs';

import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  onSnapshot
} from './firebase-config.js';

// =========================================================================
// CRITICAL SECURITY / ADMIN CONFIGURATION
// =========================================================================
// Hardcoded Admin Email: Only this exact account gets admin privileges.
// You can edit this email address here if you need to change the admin account.
export const ADMIN_EMAIL = "ashishkushwaha88643@gmail.com";

// Active user reference
let currentUserData = null;
const DEMO_USER_KEY = 'fincalc_demo_user';

// =========================================================================
// GLOBAL NAVIGATION TOOL CATEGORIES
// =========================================================================
export const LOANS_SAVINGS_GROUP = [
  { name: 'Loan & Mortgage', href: 'loan-calculator.html', desc: 'Amortization schedules & costs', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>', color: 'emerald' },
  { name: 'EMI Calculator', href: 'emi-calculator.html', desc: 'Home, car, or personal loans payments', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>', color: 'emerald' },
  { name: 'SIP Calculator', href: 'sip-calculator.html', desc: 'Mutual funds compounding projections', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>', color: 'emerald' },
  { name: 'Savings (PPF/FD/RD)', href: 'ppf-fd-rd-calculator.html', desc: 'Provident & deposit interest milestones', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>', color: 'emerald' },
  { name: 'ROI Calculator', href: 'roi-calculator.html', desc: 'Project investment growth yields', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>', color: 'emerald' }
];

export const TAX_SALARY_GROUP = [
  { name: 'Salary Calculator', href: 'salary-calculator.html', desc: 'Convert gross salary to net paycheck', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>', color: 'indigo' },
  { name: 'Income Tax', href: 'tax-calculator.html', desc: 'US & Canadian progressive brackets margins', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>', color: 'blue' },
  { name: 'Currency Converter', href: 'currency-converter.html', desc: 'Real-time central bank exchange rates', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>', color: 'teal' }
];

export const BUSINESS_DOCS_GROUP = [
  { name: 'Invoice Generator', href: 'invoice-generator.html', desc: 'Create & export professional PDF bills', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>', color: 'purple' },
  { name: 'PDF Utilities', href: 'pdf-tools.html', desc: 'Merge, split, compress, or watermark PDFs', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>', color: 'purple' },
  { name: 'Image Compressor', href: 'image-compressor.html', desc: 'Scale, resize, and compress image file sizes', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>', color: 'indigo' },
  { name: 'Resume Builder', href: 'resume-builder.html', desc: 'Design & print structured PDF resumes', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>', color: 'indigo' }
];

export const DEV_TOOLS_GROUP = [
  { name: 'JSON Formatter', href: 'json-formatter.html', desc: 'Validate, format, & inspect JSON trees', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>', color: 'indigo' },
  { name: 'Base64 Converter', href: 'base64-converter.html', desc: 'Encode raw files & decode strings', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>', color: 'indigo' },
  { name: 'UUID & Hash Gen', href: 'uuid-hash-generator.html', desc: 'Bulk secure UUIDs & md5/sha digests', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>', color: 'indigo' },
  { name: 'Regex Tester', href: 'regex-tester.html', desc: 'Live regex matcher & group debugger', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>', color: 'indigo' },
  { name: 'Color Converter', href: 'color-converter.html', desc: 'HEX, RGB, HSL & CMYK color swatches', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-3"></path>', color: 'indigo' },
  { name: 'Markdown Editor', href: 'markdown-editor.html', desc: 'Markdown ↔ HTML markup compiler', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>', color: 'indigo' }
];

export const PRODUCTIVITY_GROUP = [
  { name: 'URL Shortener', href: 'url-shortener.html', desc: 'Shorten links, track clicks & geos', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>', color: 'purple' },
  { name: 'QR Code Generator', href: 'qr-generator.html', desc: 'Build scan codes for Wi-Fi & vCards', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>', color: 'indigo' },
  { name: 'Password Generator', href: 'password-generator.html', desc: 'Build strong secure credentials keys', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 0121 9z"></path>', color: 'purple' },
  { name: 'Word Counter', href: 'word-counter.html', desc: 'Count letters, lines & reading times', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path>', color: 'teal' },
  { name: 'Unit Converter', href: 'unit-converter.html', desc: 'Convert length, weight & volume units', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M3 6l3 18h12l3-18H3zm3 4h12M9 14h6"></path>', color: 'blue' },
  { name: 'Age Calculator', href: 'age-calculator.html', desc: 'Calculate ages & birthdays countdowns', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>', color: 'amber' }
];

/**
 * Safe JSON stringifier that strips circular references and non-serializable properties
 */
export function safeJsonStringify(data, fallback = '{}') {
  const seen = new WeakSet();
  try {
    return JSON.stringify(data, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (typeof Node !== 'undefined' && (value instanceof Node || value instanceof Element || value instanceof Event)) {
          return undefined;
        }
        if (seen.has(value)) {
          return undefined;
        }
        seen.add(value);
      }
      if (typeof value === 'function') return undefined;
      return value;
    });
  } catch (err) {
    console.warn("safeJsonStringify fallback used:", err);
    return fallback;
  }
}

/**
 * Get current active user (Firebase auth or Demo user)
 */
export function getCurrentUser() {
  if (auth.currentUser) return auth.currentUser;
  
  try {
    const stored = localStorage.getItem(DEMO_USER_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Error reading demo user state:", e);
  }
  return currentUserData;
}

/**
 * Sets a local demo user session for instant preview & test drive
 */
/**
 * Saves user record to persistent local registry
 * @param {Object} userRecord 
 */
export function saveToLocalUserRegistry(userRecord) {
  try {
    const raw = localStorage.getItem('fincalc_global_registered_users');
    let list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];

    const cleanRecord = {
      uid: userRecord.uid || '',
      name: userRecord.name || userRecord.displayName || '',
      email: userRecord.email || '',
      photoURL: userRecord.photoURL || '',
      username: userRecord.username || '',
      role: userRecord.role || 'USER',
      status: userRecord.status || 'Active',
      firstLogin: userRecord.firstLogin || new Date().toISOString(),
      lastLogin: userRecord.lastLogin || new Date().toISOString(),
      lastActive: userRecord.lastActive || new Date().toISOString()
    };

    // Remove duplicates by email or uid
    list = list.filter(u => u && u.email?.toLowerCase() !== cleanRecord.email?.toLowerCase() && u.uid !== cleanRecord.uid);
    list.unshift(cleanRecord);

    localStorage.setItem('fincalc_global_registered_users', safeJsonStringify(list));
    window.dispatchEvent(new CustomEvent('registered-users-updated', { detail: list }));
  } catch (e) {
    console.error("Local registry save error:", e);
  }
}

/**
 * Returns all locally registered users
 */
export function getLocalUserRegistry() {
  try {
    const raw = localStorage.getItem('fincalc_global_registered_users');
    let list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

/**
 * Set and persist a Demo or Custom Registered User
 * @param {Object} demoUserObj 
 */
export async function setDemoUser(demoUserObj) {
  try {
    const cleanUserObj = {
      uid: demoUserObj.uid || 'usr_' + Math.random().toString(36).substring(2, 9),
      displayName: demoUserObj.displayName || demoUserObj.name || 'User',
      email: demoUserObj.email || '',
      photoURL: demoUserObj.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
      role: isAdminEmail(demoUserObj.email) ? 'ADMIN' : (demoUserObj.role || 'USER'),
      username: demoUserObj.username || '',
      preferences: demoUserObj.preferences || { defaultCountry: 'US', defaultCurrency: 'USD' }
    };
    localStorage.setItem(DEMO_USER_KEY, safeJsonStringify(cleanUserObj));
    currentUserData = cleanUserObj;
    
    await syncUserProfile({
      uid: demoUserObj.uid || 'usr_' + Math.random().toString(36).substring(2, 9),
      displayName: demoUserObj.displayName || demoUserObj.name || 'User',
      email: demoUserObj.email || '',
      photoURL: demoUserObj.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
      role: isAdminEmail(demoUserObj.email) ? 'ADMIN' : 'USER',
      preferences: demoUserObj.preferences || { defaultCountry: 'US', defaultCurrency: 'USD' }
    });

    showToast(`Signed in as ${demoUserObj.displayName || demoUserObj.email}`, 'success');
    updateNavbarUI(demoUserObj);
    window.dispatchEvent(new CustomEvent('auth-state-changed', { 
      detail: { user: demoUserObj, isAdmin: isAdminEmail(demoUserObj.email) } 
    }));
    updatePresenceHeartbeat();
  } catch (e) {
    console.error("Error setting demo user:", e);
  }
}

/**
 * Checks if a given email is the authorized Admin Email
 * @param {string|null} email 
 * @returns {boolean}
 */
export function isAdminEmail(email) {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

/**
 * Sync user profile details to Firestore 'users' collection & local registry
 * Document ID = user.uid
 */
export async function syncUserProfile(user) {
  if (!user) return null;

  const email = user.email || '';
  const uid = user.uid || 'usr_' + Math.random().toString(36).substring(2, 9);
  const name = user.displayName || user.name || (email ? email.split('@')[0] : 'FinCalc User');
  const photo = user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150';
  const role = isAdminEmail(email) ? 'ADMIN' : (user.role || 'USER');

  // Check if user record details exist in Firestore
  let existingUsername = user.username || null;
  let existingStatus = 'Active';
  let existingRole = role;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.username) existingUsername = data.username;
      if (data.status) existingStatus = data.status;
      if (data.role) existingRole = data.role;
    }
  } catch (err) {
    console.warn("Firestore user fetch username check error:", err);
  }

  const userRecord = {
    uid,
    name,
    email,
    photoURL: photo,
    username: existingUsername || '',
    firstLogin: user.firstLogin || new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    lastActive: new Date().toISOString(),
    role: existingRole,
    status: existingStatus,
    preferences: user.preferences || { defaultCountry: 'US', defaultCurrency: 'USD' }
  };

  // 1. Save to Local User Registry immediately for guaranteed multi-user persistence
  saveToLocalUserRegistry(userRecord);

  // 2. Save to Firestore DB 'users' collection
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      ...userRecord,
      firstLogin: serverTimestamp(),
      lastLogin: serverTimestamp(),
      lastActive: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn("Firestore user sync error:", err);
  }

  // 3. Prompt for username if missing
  if (!userRecord.username) {
    setTimeout(() => {
      checkAndPromptUsername(userRecord);
    }, 500);
  }

  return userRecord;
}

// =========================================================================
// USERNAME SYSTEM FUNCTIONS & MODAL
// =========================================================================

/**
 * Clean & sanitize username string
 */
export function sanitizeUsername(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, '')
    .substring(0, 20);
}

/**
 * Generate auto-suggested username candidate based on display name or email prefix
 */
export function generateSuggestedUsername(displayName, email) {
  let base = '';
  if (displayName) {
    base = displayName.toLowerCase().replace(/[^a-z0-9_]/g, '');
  }
  if (!base && email) {
    base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
  }
  if (!base) base = 'user';
  
  if (base.length < 3) {
    base = (base + '123').substring(0, 20);
  }
  return base.substring(0, 20);
}

/**
 * Check if a username is valid and available in Firestore
 */
export async function checkUsernameAvailability(username, currentUid = null) {
  const clean = sanitizeUsername(username);
  if (!clean || clean.length < 3 || clean.length > 20) {
    return { valid: false, message: 'Must be 3 to 20 characters (letters, numbers & underscores only).' };
  }
  if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
    return { valid: false, message: 'Only lowercase letters, numbers, and underscores allowed.' };
  }

  try {
    const docRef = doc(db, 'usernames', clean);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      if (currentUid && data.uid === currentUid) {
        return { valid: true, isCurrent: true, message: 'This is your current username.' };
      }
      return { valid: false, message: `Username @${clean} is already taken.` };
    }

    return { valid: true, message: `Username @${clean} is available!` };
  } catch (err) {
    console.warn("Username availability check error:", err);
    return { valid: true, message: `Username @${clean} is available.` };
  }
}

/**
 * Save / Update username using Firestore Batch Write
 */
export async function saveUsernameBatch(uid, newUsername, oldUsername = null) {
  const cleanNew = sanitizeUsername(newUsername);
  if (!cleanNew) throw new Error('Invalid username.');

  try {
    const batch = writeBatch(db);

    if (oldUsername && oldUsername.toLowerCase() !== cleanNew) {
      const oldRef = doc(db, 'usernames', oldUsername.toLowerCase());
      batch.delete(oldRef);
    }

    const newRef = doc(db, 'usernames', cleanNew);
    const userRef = doc(db, 'users', uid);

    batch.set(newRef, {
      uid: uid,
      createdAt: serverTimestamp()
    });

    batch.set(userRef, {
      username: cleanNew
    }, { merge: true });

    await batch.commit();
  } catch (err) {
    console.warn("Firestore batch write username error (falling back to individual setDoc & local sync):", err);
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, { username: cleanNew }, { merge: true });
      const newRef = doc(db, 'usernames', cleanNew);
      await setDoc(newRef, { uid: uid, createdAt: new Date().toISOString() }, { merge: true });
    } catch (e2) {
      console.warn("Firestore individual setDoc fallback error:", e2);
    }
  }

  // Always sync local registry & active session
  try {
    const registry = getLocalUserRegistry();
    const index = registry.findIndex(u => u && u.uid === uid);
    if (index !== -1) {
      registry[index].username = cleanNew;
    } else {
      registry.push({ uid, username: cleanNew });
    }

    const cleanRegistry = registry.map(u => ({
      uid: u.uid || '',
      name: u.name || u.displayName || '',
      email: u.email || '',
      username: u.username || '',
      photoURL: u.photoURL || '',
      role: u.role || 'USER',
      status: u.status || 'Active'
    }));
    localStorage.setItem('fincalc_global_registered_users', safeJsonStringify(cleanRegistry));
  } catch (a) {
    console.warn("Registry storage update error:", a);
  }

  try {
    const sessionUser = getCurrentUser();
    if (sessionUser && sessionUser.uid === uid) {
      sessionUser.username = cleanNew;
      const cleanSessionObj = {
        uid: sessionUser.uid,
        displayName: sessionUser.displayName || sessionUser.name || '',
        email: sessionUser.email || '',
        photoURL: sessionUser.photoURL || '',
        username: cleanNew,
        role: sessionUser.role || 'USER'
      };
      sessionStorage.setItem('fincalc_user_session', safeJsonStringify(cleanSessionObj));
    }
  } catch (e) {
    console.warn("Session storage update error:", e);
  }
}

/**
 * Checks if user has a username, prompts modal if missing
 */
export async function checkAndPromptUsername(user) {
  if (!user || !user.uid) return;

  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists() && snap.data().username) {
      return snap.data().username;
    }
    showUsernameModal({ user });
  } catch (e) {
    console.warn("Check username prompt error:", e);
  }
}

/**
 * Show "Choose Your Username" or "Change Your Username" interactive modal
 */
export function showUsernameModal({ user, currentUsername = '', isChange = false, onComplete = null }) {
  const existingModal = document.getElementById('username-setup-modal');
  if (existingModal) existingModal.remove();

  const suggestedBase = generateSuggestedUsername(user.displayName || user.name, user.email);

  const modal = document.createElement('div');
  modal.id = 'username-setup-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in overflow-y-auto';

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 sm:p-7 relative text-slate-900 animate-scale-up">
      ${isChange ? `<button id="btn-close-username-modal" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-lg p-1">&times;</button>` : ''}
      
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-lg shadow-sm">
          @
        </div>
        <div>
          <h3 class="text-lg font-extrabold text-slate-900">${isChange ? 'Change Your Username' : 'Choose Your Username'}</h3>
          <p class="text-xs text-slate-500">${isChange ? 'Select a new unique author handle for your blog posts.' : 'Set up a unique author handle for your blog posts.'}</p>
        </div>
      </div>
 
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Blog Author Handle</label>
          <div class="relative flex items-center">
            <span class="absolute left-3.5 text-slate-400 font-bold text-sm">@</span>
            <input 
              id="input-username-field" 
              type="text" 
              placeholder="${suggestedBase || 'username'}"
              value="${currentUsername || suggestedBase}" 
              maxlength="20"
              class="w-full pl-8 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all lowercase"
            />
            <div id="username-validation-icon" class="absolute right-3 flex items-center"></div>
          </div>
          <div id="username-status-msg" class="text-[11px] font-semibold mt-1.5 flex items-center gap-1.5 text-slate-500">
            <span>Checking availability...</span>
          </div>
          <p class="text-[10px] text-slate-400 mt-1">Allowed: lowercase letters, numbers, and underscores (3-20 characters).</p>
        </div>
 
        <div class="p-3 bg-emerald-50/80 rounded-xl border border-emerald-100 text-[11px] text-emerald-900">
          <span class="font-bold">Your Blog Author Handle:</span><br/>
          <span class="font-mono font-semibold text-emerald-700" id="username-preview-link">@${currentUsername || suggestedBase}</span>
        </div>
 
        <button 
          id="btn-submit-username" 
          disabled
          class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <span>${isChange ? 'Update Username' : 'Claim Username & Save'}</span>
        </button>
      </div>
    </div>
  `;
 
  document.body.appendChild(modal);
 
  const input = document.getElementById('input-username-field');
  const statusMsg = document.getElementById('username-status-msg');
  const iconBox = document.getElementById('username-validation-icon');
  const previewLink = document.getElementById('username-preview-link');
  const submitBtn = document.getElementById('btn-submit-username');
  const closeBtn = document.getElementById('btn-close-username-modal');
 
  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.remove());
  }
 
  let debounceTimer = null;
  let currentValidUsername = '';
 
  async function validateInput() {
    const rawVal = input.value;
    const sanitized = sanitizeUsername(rawVal);
    input.value = sanitized;
    
    if (previewLink) {
      previewLink.textContent = `@${sanitized || 'username'}`;
    }

    if (!sanitized) {
      statusMsg.className = 'text-[11px] font-semibold mt-1.5 text-amber-600';
      statusMsg.textContent = 'Please enter a username.';
      iconBox.innerHTML = '';
      submitBtn.disabled = true;
      return;
    }

    if (sanitized.length < 3) {
      statusMsg.className = 'text-[11px] font-semibold mt-1.5 text-amber-600';
      statusMsg.textContent = 'Username must be at least 3 characters.';
      iconBox.innerHTML = '<span class="text-amber-500 font-bold text-xs">!</span>';
      submitBtn.disabled = true;
      return;
    }

    statusMsg.className = 'text-[11px] font-semibold mt-1.5 text-slate-500';
    statusMsg.textContent = 'Checking availability...';
    iconBox.innerHTML = '<div class="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>';
    submitBtn.disabled = true;

    try {
      const res = await checkUsernameAvailability(sanitized, user.uid);
      if (res.valid) {
        statusMsg.className = 'text-[11px] font-semibold mt-1.5 text-emerald-600 flex items-center gap-1';
        statusMsg.innerHTML = `<svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg> ${res.message}`;
        iconBox.innerHTML = '<span class="text-emerald-600 font-bold text-base">✓</span>';
        submitBtn.disabled = false;
        currentValidUsername = sanitized;
      } else {
        statusMsg.className = 'text-[11px] font-semibold mt-1.5 text-rose-600 flex items-center gap-1';
        statusMsg.innerHTML = `<svg class="w-3.5 h-3.5 text-rose-600 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg> ${res.message}`;
        iconBox.innerHTML = '<span class="text-rose-500 font-bold text-base">✕</span>';
        submitBtn.disabled = true;
      }
    } catch (e) {
      statusMsg.className = 'text-[11px] font-semibold mt-1.5 text-rose-600';
      statusMsg.textContent = 'Error checking username.';
      submitBtn.disabled = true;
    }
  }

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(validateInput, 250);
  });

  // Initial check
  validateInput();

  submitBtn.addEventListener('click', async () => {
    if (!currentValidUsername) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Saving...`;

    try {
      await saveUsernameBatch(user.uid, currentValidUsername, currentUsername);
      modal.remove();
      showToast(`Username @${currentValidUsername} saved successfully!`, 'success');
      
      window.dispatchEvent(new CustomEvent('username-updated', { detail: { username: currentValidUsername } }));
      if (onComplete) onComplete(currentValidUsername);
    } catch (err) {
      console.error("Save username error:", err);
      showToast(err.message || 'Failed to save username', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>${isChange ? 'Update Username' : 'Claim Username & Save'}</span>`;
    }
  });
}

// Global Presence Heartbeat
let currentSessionId = sessionStorage.getItem('fincalc_session_id');
if (!currentSessionId) {
  currentSessionId = 'sess_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
  sessionStorage.setItem('fincalc_session_id', currentSessionId);
}

export async function updatePresenceHeartbeat() {
  try {
    const user = getCurrentUser();
    const presenceRef = doc(db, 'presence', currentSessionId);
    const pageName = window.location.pathname.split('/').pop() || 'index.html';

    const sessionPayload = {
      sessionId: currentSessionId,
      uid: user ? (user.uid || 'demo') : null,
      email: user ? (user.email || 'Visitor') : 'Guest Visitor',
      name: user ? (user.displayName || user.name || 'Guest') : 'Guest Visitor',
      photoURL: user ? (user.photoURL || '') : '',
      page: pageName,
      lastActive: serverTimestamp(),
      isGuest: !user
    };

    await setDoc(presenceRef, sessionPayload, { merge: true });

    if (user && user.uid && !user.isDemo) {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { lastActive: serverTimestamp() }).catch(() => {});
    }
  } catch (e) {
    // Fail silently on network offline
  }
}

// Send presence heartbeat immediately & every 20 seconds
setInterval(updatePresenceHeartbeat, 20000);
if (document.readyState === 'complete') {
  updatePresenceHeartbeat();
} else {
  window.addEventListener('load', updatePresenceHeartbeat);
}

/**
 * Triggers Google Sign-In Popup
 */
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    localStorage.removeItem(DEMO_USER_KEY);
    showToast(`Welcome back, ${user.displayName || 'User'}!`, 'success');
    await syncUserProfile(user);
    return user;
  } catch (error) {
    console.error("Google Sign-in Error:", error);
    
    // Check for popup close by user
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      showToast('Sign-in popup closed', 'info');
      return;
    }

    // Show domain unauthorized / network fallback helper modal
    showUnauthorizedDomainModal(error.message || 'Firebase domain unauthorized');
  }
}

/**
 * Shows interactive modal for Email Registration, Google Sign-In & Demo Accounts
 */
export function showUnauthorizedDomainModal(errorDetail = '') {
  const existingModal = document.getElementById('firebase-auth-error-modal');
  if (existingModal) existingModal.remove();

  const currentDomain = window.location.hostname;
  const modal = document.createElement('div');
  modal.id = 'firebase-auth-error-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto';
  
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 sm:p-7 relative overflow-hidden text-slate-900 my-8">
      
      <!-- Top Header & Close -->
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold border border-emerald-200">
            <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900">User Account Registration & Sign-In</h3>
            <p class="text-xs text-slate-500">Sign in with Google, or register with any email address.</p>
          </div>
        </div>
        <button id="modal-close-btn" class="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">&times;</button>
      </div>

      <!-- Instant Email Registration Form -->
      <form id="form-register-email" class="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5 space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-800 uppercase tracking-wide">Register / Sign In with Any Email</span>
          <span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">Live Firestore Sync</span>
        </div>

        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Full Name</label>
          <input type="text" id="reg-name" required placeholder="e.g. Alex Rivera" class="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500" />
        </div>

        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-1">Email Address</label>
          <input type="email" id="reg-email" required placeholder="e.g. alex.rivera@gmail.com" class="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500" />
        </div>

        <button type="submit" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path></svg>
          Register & Log In Now
        </button>
      </form>


      <!-- Google Authorized Domain Note -->
      <div class="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Domain: <code class="font-mono text-slate-600 bg-slate-100 px-1 rounded">${currentDomain}</code></span>
        <button id="btn-try-google-again" class="text-indigo-600 font-semibold hover:underline cursor-pointer">Try Google Popup &rarr;</button>
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('modal-close-btn')?.addEventListener('click', () => modal.remove());

  // Email registration form submit handler
  document.getElementById('form-register-email')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();

    if (!email) return;

    modal.remove();
    const uid = 'usr_' + Math.random().toString(36).substring(2, 9);
    await setDemoUser({
      uid,
      displayName: name || email.split('@')[0],
      email,
      photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
      role: isAdminEmail(email) ? 'ADMIN' : 'USER'
    });
  });


  document.getElementById('btn-try-google-again')?.addEventListener('click', async () => {
    modal.remove();
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res && res.user) {
        showToast(`Welcome ${res.user.displayName}`, 'success');
        await syncUserProfile(res.user);
      }
    } catch (err) {
      showUnauthorizedDomainModal(err.message);
    }
  });
}

/**
 * Triggers Sign-Out
 */
export async function logoutUser() {
  try {
    localStorage.removeItem(DEMO_USER_KEY);
    sessionStorage.removeItem('fincalc_user_session');
    currentUserData = null;
    await signOut(auth);
    showToast('Signed out successfully', 'info');
    updateNavbarUI(null);
    window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user: null, isAdmin: false } }));
    
    // If on profile or admin page, redirect to home
    if (window.location.pathname.includes('profile.html') || window.location.pathname.includes('admin.html')) {
      window.location.href = 'index.html';
    }
  } catch (error) {
    console.error("Sign out error:", error);
    localStorage.removeItem(DEMO_USER_KEY);
    sessionStorage.removeItem('fincalc_user_session');
    currentUserData = null;
    updateNavbarUI(null);
    window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user: null, isAdmin: false } }));
  }
}

/**
 * Renders Mobile Homepage Auth Banner before tool lists (on index.html)
 */
function renderMobileHomepageAuth(user) {
  const container = document.getElementById('mobile-homepage-auth-container');
  if (!container) return;

  if (!user) {
    container.innerHTML = `
      <div class="bg-gradient-to-br from-emerald-900 via-slate-900 to-teal-950 text-white rounded-2xl p-5 shadow-lg border border-emerald-700/60 relative overflow-hidden">
        <div class="absolute -right-8 -bottom-8 w-36 h-36 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none"></div>
        <div class="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold uppercase tracking-wider mb-2.5">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Google Account Sync
            </div>
            <h3 class="text-lg font-black text-white tracking-tight leading-snug">Sign in with Google</h3>
            <p class="text-xs text-slate-200 font-medium mt-1 leading-relaxed">Sync saved calculations, custom invoices, and tax settings across all your devices.</p>
          </div>
          <button id="btn-mobile-homepage-login" class="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2.5 px-5 py-3 bg-white hover:bg-emerald-50 text-slate-900 rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer">
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span class="font-bold text-slate-900">Sign in with Google</span>
          </button>
        </div>
      </div>
    `;
    document.getElementById('btn-mobile-homepage-login')?.addEventListener('click', loginWithGoogle);
  } else {
    const isAdmin = isAdminEmail(user.email);
    const userPhoto = user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150';
    const userName = user.displayName || user.name || 'User';

    container.innerHTML = `
      <div class="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 overflow-hidden">
          <div class="p-[2px] rounded-full shrink-0" style="background: conic-gradient(from 315deg, #EA4335 0deg 90deg, #4285F4 90deg 180deg, #34A853 180deg 270deg, #FBBC05 270deg 360deg);">
            <img src="${userPhoto}" alt="${userName}" class="w-10 h-10 rounded-full object-cover border-2 border-white" />
          </div>
          <div class="overflow-hidden">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-slate-900 truncate">Welcome, ${userName}!</span>
              ${isAdmin ? `<span class="bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.5 rounded border border-amber-300 shrink-0">ADMIN</span>` : ''}
            </div>
            <p class="text-[11px] text-slate-500 truncate">${user.email}</p>
          </div>
        </div>
        <a href="profile.html" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors shadow-2xs">
          My Profile
        </a>
      </div>
    `;
  }
}

/**
 * Renders Nav Bar Auth State
 */
function updateNavbarUI(user) {
  const authContainer = document.getElementById('navbar-auth-container');
  
  // Clean up any existing left drawer and backdrop if present
  document.getElementById('user-left-drawer-backdrop')?.remove();
  document.getElementById('user-left-drawer')?.remove();

  // Render Mobile Homepage Auth Banner if present
  renderMobileHomepageAuth(user);

  if (!authContainer) return;

  const isAdmin = user ? isAdminEmail(user.email) : false;
  const userPhoto = user ? (user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150') : '';
  const userName = user ? (user.displayName || user.name || 'User') : 'User';

  const rawPath = window.location.pathname.split('/').pop() || 'index.html';
  const path = rawPath.toLowerCase();
  const isHome = path === '' || path === 'index.html';

  const isPageActive = (href) => {
    return (href === 'index.html' && isHome) || (path === href.toLowerCase());
  };

  const loansSavingsGroup = LOANS_SAVINGS_GROUP;
  const taxSalaryGroup = TAX_SALARY_GROUP;
  const businessDocsGroup = BUSINESS_DOCS_GROUP;
  const devToolsGroup = DEV_TOOLS_GROUP;
  const productivityGroup = PRODUCTIVITY_GROUP;

  const hasActiveLoansSavings = loansSavingsGroup.some(t => isPageActive(t.href));
  const hasActiveTaxSalary = taxSalaryGroup.some(t => isPageActive(t.href));
  const hasActiveBusinessDocs = businessDocsGroup.some(t => isPageActive(t.href));
  const hasActiveDevTools = devToolsGroup.some(t => isPageActive(t.href));
  const hasActiveProductivity = productivityGroup.some(t => isPageActive(t.href));
  
  const isBlogActive = isPageActive('updates.html');
  const blogClass = isBlogActive 
    ? 'bg-rose-100 text-rose-950 border-rose-300 font-extrabold shadow-sm hover:scale-105 active:scale-95 hover:ring-2 hover:ring-rose-250 transition-all duration-300' 
    : 'bg-rose-50/50 text-rose-700 border-rose-200/80 hover:bg-rose-100/80 hover:text-rose-900 hover:border-rose-300 hover:scale-105 active:scale-95 hover:ring-2 hover:ring-rose-150 transition-all duration-300';

  // Render Desktop Mega Menu Navigation Bar dynamically
  const desktopNav = document.querySelector('header nav');
  if (desktopNav) {
    desktopNav.className = "hidden lg:flex items-center gap-4 text-xs font-semibold text-slate-600";
    
    const buildCardGridHtml = (items) => {
      return items.map(t => {
        const active = isPageActive(t.href);
        const cardBg = active ? `bg-${t.color}-50 border-${t.color}-200` : 'hover:bg-slate-50 hover:border-slate-200 border-transparent';
        const iconBg = active ? `bg-${t.color}-100 text-${t.color}-700` : `bg-${t.color}-50 text-${t.color}-600 group-hover/item:bg-${t.color}-100 transition-colors`;
        return `
          <a href="${t.href}" class="flex items-start gap-3 p-2.5 rounded-xl border transition-all duration-200 group/item text-left ${cardBg}">
            <div class="w-8.5 h-8.5 rounded-lg flex items-center justify-center shrink-0 ${iconBg}">
              <svg class="w-4.5 h-4.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">${t.icon}</svg>
            </div>
            <div class="min-w-0">
              <p class="text-xs font-bold text-slate-800 transition-colors truncate">${t.name}</p>
              <p class="text-[10px] text-slate-400 font-semibold leading-relaxed mt-0.5">${t.desc}</p>
            </div>
          </a>
        `;
      }).join('');
    };

    desktopNav.innerHTML = `
      <!-- 1. Loans & Savings Dropdown -->
      <div class="relative group py-2">
        <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold select-none text-xs border ${
          hasActiveLoansSavings 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80 shadow-3xs' 
            : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900 border-transparent'
        }">
          <span>📈 Loans & Savings</span>
          <svg class="w-3.5 h-3.5 text-slate-400 group-hover:rotate-180 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
        <div class="absolute left-0 top-full pt-3 hidden group-hover:block z-50 animate-fade-in w-[540px]">
          <div class="bg-white rounded-2xl shadow-xl border border-slate-200/90 p-4 grid grid-cols-2 gap-2.5">
            ${buildCardGridHtml(loansSavingsGroup)}
          </div>
        </div>
      </div>

      <!-- 2. Tax & Salary Dropdown -->
      <div class="relative group py-2">
        <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold select-none text-xs border ${
          hasActiveTaxSalary 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80 shadow-3xs' 
            : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900 border-transparent'
        }">
          <span>💸 Tax & Salary</span>
          <svg class="w-3.5 h-3.5 text-slate-400 group-hover:rotate-180 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
        <div class="absolute left-[-20px] top-full pt-3 hidden group-hover:block z-50 animate-fade-in w-[320px]">
          <div class="bg-white rounded-2xl shadow-xl border border-slate-200/90 p-4 grid grid-cols-1 gap-2.5">
            ${buildCardGridHtml(taxSalaryGroup)}
          </div>
        </div>
      </div>

      <!-- 3. Business Docs Dropdown -->
      <div class="relative group py-2">
        <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold select-none text-xs border ${
          hasActiveBusinessDocs 
            ? 'bg-indigo-50 text-indigo-800 border-indigo-200/80 shadow-3xs' 
            : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900 border-transparent'
        }">
          <span>💼 Business Docs</span>
          <svg class="w-3.5 h-3.5 text-slate-400 group-hover:rotate-180 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
        <div class="absolute left-[-40px] top-full pt-3 hidden group-hover:block z-50 animate-fade-in w-[320px]">
          <div class="bg-white rounded-2xl shadow-xl border border-slate-200/90 p-4 grid grid-cols-1 gap-2.5">
            ${buildCardGridHtml(businessDocsGroup)}
          </div>
        </div>
      </div>

      <!-- 4. Dev Tools Dropdown -->
      <div class="relative group py-2">
        <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold select-none text-xs border ${
          hasActiveDevTools 
            ? 'bg-indigo-50 text-indigo-800 border-indigo-200/80 shadow-3xs' 
            : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900 border-transparent'
        }">
          <span>🛠️ Dev Tools</span>
          <svg class="w-3.5 h-3.5 text-slate-400 group-hover:rotate-180 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
        <div class="absolute left-[-150px] top-full pt-3 hidden group-hover:block z-50 animate-fade-in w-[540px]">
          <div class="bg-white rounded-2xl shadow-xl border border-slate-200/90 p-4 grid grid-cols-2 gap-2.5">
            ${buildCardGridHtml(devToolsGroup)}
          </div>
        </div>
      </div>

      <!-- 5. Productivity Dropdown -->
      <div class="relative group py-2">
        <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold select-none text-xs border ${
          hasActiveProductivity 
            ? 'bg-indigo-50 text-indigo-800 border-indigo-200/80 shadow-3xs' 
            : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900 border-transparent'
        }">
          <span>⚡ Productivity</span>
          <svg class="w-3.5 h-3.5 text-slate-400 group-hover:rotate-180 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
        <div class="absolute right-0 top-full pt-3 hidden group-hover:block z-50 animate-fade-in w-[540px]">
          <div class="bg-white rounded-2xl shadow-xl border border-slate-200/90 p-4 grid grid-cols-2 gap-2.5">
            ${buildCardGridHtml(productivityGroup)}
          </div>
        </div>
      </div>
      
      <!-- Blog Link -->
      <a href="updates.html" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border cursor-pointer font-bold select-none text-xs ${blogClass}">
        <span>📰 Blog</span>
      </a>

      <!-- Admin Link -->
      ${isAdmin ? `
        <a id="nav-admin-link" href="admin.html" class="flex items-center gap-1 px-3 py-1.5 rounded-xl text-amber-700 hover:text-amber-800 font-bold bg-amber-50 hover:bg-amber-100 transition-colors border border-amber-200">
          <span>Admin</span>
        </a>
      ` : ''}
    `;
  }

  // Helper to render full navigation links inside mobile offcanvas drawer
  const renderDrawerNavLinks = () => {
    const buildGroupHtml = (items) => {
      return items.map(t => {
        const active = isPageActive(t.href);
        return `
          <a href="${t.href}" class="flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
            active 
              ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-200/80 shadow-2xs' 
              : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
          }">
            <div class="flex items-center gap-2.5">
              <svg class="w-4 h-4 shrink-0 ${active ? 'text-indigo-600' : 'text-slate-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">${t.icon}</svg>
              <span>${t.name}</span>
            </div>
            ${active ? '<span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>' : ''}
          </a>
        `;
      }).join('');
    };

    return `
      <div class="space-y-1">
        <!-- Blog (Direct Link above all groups) -->
        <div class="pb-2 border-b border-slate-100 mb-2">
          <a href="updates.html" class="flex items-center justify-between px-3 py-2.5 text-xs font-bold rounded-xl transition-all border ${
            isBlogActive 
              ? 'bg-rose-100 text-rose-950 font-black border-rose-300 shadow-sm' 
              : 'bg-rose-50/50 text-rose-700 border-rose-200/80 hover:bg-rose-100/80 hover:text-rose-900 hover:scale-105 active:scale-95 duration-300'
          }">
            <div class="flex items-center gap-2.5">
              <span class="text-sm">📰</span>
              <span>Blog / Announcements</span>
            </div>
            <svg class="w-3.5 h-3.5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
          </a>
        </div>

        <!-- 1. Productivity -->
        <div class="overflow-hidden">
          <button type="button" class="drawer-group-toggle w-full flex items-center justify-between px-2 py-2.5 text-xs font-bold text-slate-850 hover:bg-slate-100/60 rounded-xl transition-colors cursor-pointer" data-target="drawer-productivity">
            <span class="flex items-center gap-2.5">
              <span class="text-sm">⚡</span> Productivity
            </span>
            <svg class="toggle-arrow w-3.5 h-3.5 text-slate-400 transition-transform duration-200" style="transform: rotate(90deg);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
          </button>
          <div id="drawer-productivity" class="pl-3 pr-1 py-1 space-y-0.5 border-l border-slate-200/80 ml-4">
            ${buildGroupHtml(productivityGroup)}
          </div>
        </div>

        <!-- 2. Loans & Savings -->
        <div class="overflow-hidden">
          <button type="button" class="drawer-group-toggle w-full flex items-center justify-between px-2 py-2.5 text-xs font-bold text-slate-850 hover:bg-slate-100/60 rounded-xl transition-colors cursor-pointer" data-target="drawer-loans-savings">
            <span class="flex items-center gap-2.5">
              <span class="text-sm">📈</span> Loans & Savings
            </span>
            <svg class="toggle-arrow w-3.5 h-3.5 text-slate-400 transition-transform duration-200" style="transform: rotate(90deg);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
          </button>
          <div id="drawer-loans-savings" class="pl-3 pr-1 py-1 space-y-0.5 border-l border-slate-200/80 ml-4">
            ${buildGroupHtml(loansSavingsGroup)}
          </div>
        </div>

        <!-- 3. Business Docs -->
        <div class="overflow-hidden">
          <button type="button" class="drawer-group-toggle w-full flex items-center justify-between px-2 py-2.5 text-xs font-bold text-slate-850 hover:bg-slate-100/60 rounded-xl transition-colors cursor-pointer" data-target="drawer-business-docs">
            <span class="flex items-center gap-2.5">
              <span class="text-sm">💼</span> Business Docs
            </span>
            <svg class="toggle-arrow w-3.5 h-3.5 text-slate-400 transition-transform duration-200" style="transform: rotate(90deg);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
          </button>
          <div id="drawer-business-docs" class="pl-3 pr-1 py-1 space-y-0.5 border-l border-slate-200/80 ml-4">
            ${buildGroupHtml(businessDocsGroup)}
          </div>
        </div>

        <!-- 4. Dev Tools -->
        <div class="overflow-hidden">
          <button type="button" class="drawer-group-toggle w-full flex items-center justify-between px-2 py-2.5 text-xs font-bold text-slate-850 hover:bg-slate-100/60 rounded-xl transition-colors cursor-pointer" data-target="drawer-dev-tools">
            <span class="flex items-center gap-2.5">
              <span class="text-sm">🛠️</span> Dev Tools
            </span>
            <svg class="toggle-arrow w-3.5 h-3.5 text-slate-400 transition-transform duration-200" style="transform: rotate(90deg);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
          </button>
          <div id="drawer-dev-tools" class="pl-3 pr-1 py-1 space-y-0.5 border-l border-slate-200/80 ml-4">
            ${buildGroupHtml(devToolsGroup)}
          </div>
        </div>

        <!-- 5. Tax & Salary -->
        <div class="overflow-hidden">
          <button type="button" class="drawer-group-toggle w-full flex items-center justify-between px-2 py-2.5 text-xs font-bold text-slate-850 hover:bg-slate-100/60 rounded-xl transition-colors cursor-pointer" data-target="drawer-tax-salary">
            <span class="flex items-center gap-2.5">
              <span class="text-sm">💸</span> Tax & Salary
            </span>
            <svg class="toggle-arrow w-3.5 h-3.5 text-slate-400 transition-transform duration-200" style="transform: rotate(90deg);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
          </button>
          <div id="drawer-tax-salary" class="pl-3 pr-1 py-1 space-y-0.5 border-l border-slate-200/80 ml-4">
            ${buildGroupHtml(taxSalaryGroup)}
          </div>
        </div>
      </div>
    `;
  };

  // Render top-right auth container:
  // Desktop (lg+): User profile button or Google sign-in button
  // Mobile (< lg): Toggle navigation button at top right
  authContainer.innerHTML = `
    <!-- Desktop Auth View (lg+) -->
    <div class="hidden lg:flex items-center gap-2">
      ${user ? `
        <div class="relative group inline-block text-left">
          <button id="user-menu-btn" title="${userName} (${user.email})" class="relative p-[2.5px] rounded-full hover:scale-105 active:scale-95 focus:outline-none transition-all cursor-pointer shadow-xs" style="background: conic-gradient(from 315deg, #EA4335 0deg 90deg, #4285F4 90deg 180deg, #34A853 180deg 270deg, #FBBC05 270deg 360deg);">
            <img src="${userPhoto}" alt="${userName}" class="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border-2 border-white shadow-2xs" />
            ${isAdmin ? `<span class="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-500 rounded-full border-2 border-white" title="Admin"></span>` : ''}
          </button>

          <!-- Desktop Hover Profile Dropdown -->
          <div id="user-desktop-dropdown" class="hidden lg:group-hover:block absolute right-0 top-full pt-2 w-64 z-50 animate-fade-in">
            <div class="bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-3">
              <div class="flex items-center gap-3 p-2.5 bg-slate-50/80 rounded-xl mb-2">
                <div class="p-[2px] rounded-full" style="background: conic-gradient(from 315deg, #EA4335 0deg 90deg, #4285F4 90deg 180deg, #34A853 180deg 270deg, #FBBC05 270deg 360deg);">
                  <img src="${userPhoto}" alt="${userName}" class="w-9 h-9 rounded-full object-cover border-2 border-white" />
                </div>
                <div class="overflow-hidden">
                  <p class="text-xs font-bold text-slate-900 truncate flex items-center gap-1">
                    ${userName}
                    ${isAdmin ? `<span class="bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.5 rounded border border-amber-300">ADMIN</span>` : ''}
                  </p>
                  <p class="text-[11px] text-slate-500 truncate">${user.email}</p>
                </div>
              </div>

              <div class="space-y-1">
                <a href="profile.html" class="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-colors">
                  <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                  My Profile & Preferences
                </a>

                <a href="link-stats.html" class="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-colors">
                  <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 00-2 2h-2a2 2 0 00-2-2z"></path></svg>
                  My Short Links & Stats
                </a>

                ${isAdmin ? `
                  <a href="admin.html" class="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors border border-amber-200">
                    <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                    Admin Dashboard
                  </a>
                ` : ''}
              </div>

              <div class="mt-2 pt-2 border-t border-slate-100">
                <button id="btn-logout-dropdown" class="w-full flex items-center justify-center gap-2 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition-colors cursor-pointer border border-rose-200">
                  <svg class="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      ` : `
        <button id="btn-login-nav" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 xl:px-4 xl:py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all transform active:scale-95 cursor-pointer whitespace-nowrap">
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span class="hidden xl:inline">Sign in with Google</span>
          <span class="xl:hidden">Sign In</span>
        </button>
      `}
    </div>

    <!-- Mobile Navigation Toggle Button (< lg) -->
    <button id="btn-mobile-menu-toggle" aria-label="Toggle Menu" class="lg:hidden flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer active:scale-95 text-xs font-bold">
      <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16M4 18h16"></path></svg>
      <span>Menu</span>
    </button>
  `;

  // Create Left/Mobile Slide-In Drawer & Backdrop for Mobile (< lg)
  const backdrop = document.createElement('div');
  backdrop.id = 'user-left-drawer-backdrop';
  backdrop.className = 'fixed inset-0 bg-slate-900/60 z-40 transition-opacity duration-300 hidden opacity-0 lg:hidden';

  const drawer = document.createElement('aside');
  drawer.id = 'user-left-drawer';
  drawer.className = 'fixed top-0 left-0 bottom-0 w-80 max-w-[88vw] bg-white z-50 shadow-2xl transform -translate-x-full transition-transform duration-300 ease-in-out flex flex-col h-full overflow-hidden lg:hidden';

  if (user) {
    drawer.innerHTML = `
      <!-- Header -->
      <div class="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
        <div class="flex items-center gap-3">
          <div class="p-[1.5px] rounded-full" style="background: conic-gradient(from 315deg, #EA4335 0deg 90deg, #4285F4 90deg 180deg, #34A853 180deg 270deg, #FBBC05 270deg 360deg);">
            <img src="${userPhoto}" alt="${userName}" class="w-8 h-8 rounded-full object-cover border-2 border-white" />
          </div>
          <div class="overflow-hidden">
            <p class="text-xs font-bold text-slate-900 truncate leading-tight">${userName}</p>
            <p class="text-[10px] text-slate-500 truncate mt-0.5">${user.email}</p>
          </div>
        </div>
        <button id="close-left-drawer-btn" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      <!-- Scrollable Body -->
      <div class="p-4 space-y-4 flex-1 overflow-y-auto">
        <!-- Shortcuts inside Drawer -->
        <div>
          <p class="px-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">My Shortcuts</p>
          <div class="grid grid-cols-2 gap-2">
            <a href="profile.html" class="flex flex-col items-center justify-center p-3 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-xl transition-all border border-slate-200/80 text-center gap-1.5 cursor-pointer">
              <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              <span class="text-[10px] font-bold">My Profile</span>
            </a>
            <a href="link-stats.html" class="flex flex-col items-center justify-center p-3 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-xl transition-all border border-slate-200/80 text-center gap-1.5 cursor-pointer">
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 00-2 2h-2a2 2 0 00-2-2z"></path></svg>
              <span class="text-[10px] font-bold">My URLs</span>
            </a>
            ${isAdmin ? `
              <a href="admin.html" class="col-span-2 flex items-center justify-center gap-2 p-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl transition-colors border border-amber-200">
                <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                Admin Dashboard
              </a>
            ` : ''}
          </div>
        </div>

        <div class="pt-2 border-t border-slate-100">
          ${renderDrawerNavLinks()}
        </div>
      </div>

      <!-- Sticky Footer -->
      <div class="p-4 border-t border-slate-100 bg-slate-50/80 shrink-0">
        <button id="btn-logout-drawer" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition-colors cursor-pointer border border-rose-200 shadow-2xs">
          <svg class="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
          Sign Out
        </button>
      </div>
    `;
  } else {
    drawer.innerHTML = `
      <!-- Header -->
      <div class="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
        <div class="flex items-center gap-2">
          <span class="text-base font-black tracking-tight text-slate-900">Fin<span class="text-emerald-600">Calc</span></span>
          <span class="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">SUITE</span>
        </div>
        <button id="close-left-drawer-btn" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      <!-- Scrollable Body -->
      <div class="p-4 space-y-4 flex-1 overflow-y-auto">
        <!-- Google Sign-In inside Drawer -->
        <div class="bg-gradient-to-br from-slate-900 to-slate-800 p-4 rounded-2xl text-white text-center shadow-sm">
          <p class="text-xs font-bold mb-1">Account Sign-In</p>
          <p class="text-[11px] text-slate-350 mb-3">Sync calculations & invoices across devices</p>
          <button id="btn-drawer-google-login" class="w-full py-2.5 bg-white text-slate-900 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95 transition-transform">
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Sign in with Google</span>
          </button>
        </div>

        <div class="pt-2 border-t border-slate-100">
          ${renderDrawerNavLinks()}
        </div>
      </div>
    `;
  }

  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);

  // Group toggles inside the drawer
  drawer.querySelectorAll('.drawer-group-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const targetEl = drawer.querySelector(`#${targetId}`);
      const arrow = btn.querySelector('.toggle-arrow');
      if (targetEl.classList.contains('hidden')) {
        targetEl.classList.remove('hidden');
        if (arrow) arrow.style.transform = 'rotate(90deg)';
      } else {
        targetEl.classList.add('hidden');
        if (arrow) arrow.style.transform = 'rotate(0deg)';
      }
    });
  });

  // Toggle Left/Mobile Drawer Functions
  const openMobileDrawer = () => {
    backdrop.classList.remove('hidden');
    setTimeout(() => backdrop.classList.add('opacity-100'), 10);
    drawer.classList.remove('-translate-x-full');
    drawer.classList.add('translate-x-0');
  };

  const closeMobileDrawer = () => {
    drawer.classList.remove('translate-x-0');
    drawer.classList.add('-translate-x-full');
    backdrop.classList.remove('opacity-100');
    setTimeout(() => backdrop.classList.add('hidden'), 300);
  };

  // Event Listeners
  document.getElementById('btn-mobile-menu-toggle')?.addEventListener('click', openMobileDrawer);
  document.getElementById('user-menu-btn')?.addEventListener('click', (e) => {
    if (window.innerWidth < 1024) {
      openMobileDrawer();
    } else {
      window.location.href = 'profile.html';
    }
  });
  document.getElementById('close-left-drawer-btn')?.addEventListener('click', closeMobileDrawer);
  backdrop.addEventListener('click', closeMobileDrawer);

  document.getElementById('btn-login-nav')?.addEventListener('click', loginWithGoogle);
  document.getElementById('btn-logout-dropdown')?.addEventListener('click', () => logoutUser());
  document.getElementById('btn-logout-drawer')?.addEventListener('click', () => {
    closeMobileDrawer();
    logoutUser();
  });
  document.getElementById('btn-logout-account-link')?.addEventListener('click', () => {
    closeMobileDrawer();
    logoutUser();
  });

  document.getElementById('btn-drawer-google-login')?.addEventListener('click', () => {
    closeMobileDrawer();
    loginWithGoogle();
  });


  // Rebuild the desktop navigation links & footer
  rebuildDesktopNavbar(user);
  rebuildGlobalFooter(user);
}

/**
 * Toast Notification Popup
 */
export function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full px-4 pointer-events-none';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-emerald-800 text-white' : type === 'error' ? 'bg-rose-800 text-white' : 'bg-slate-900 text-white';
  
  toast.className = `${bgClass} shadow-xl rounded-xl px-4 py-3 text-xs font-medium flex items-center justify-between pointer-events-auto transition-all transform translate-y-2 opacity-0 duration-300`;
  toast.innerHTML = `
    <span>${message}</span>
    <button class="ml-3 text-slate-300 hover:text-white" onclick="this.parentElement.remove()">&times;</button>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Render initial skeleton state in navbar while checking auth
function renderNavbarSkeleton() {
  const authContainer = document.getElementById('navbar-auth-container');
  if (authContainer && !authContainer.children.length) {
    authContainer.innerHTML = `
      <div class="flex items-center gap-2 animate-pulse">
        <div class="w-24 h-8 bg-slate-200/90 rounded-lg"></div>
        <div class="w-9 h-9 bg-slate-200/90 rounded-full"></div>
      </div>
    `;
  }
}

// Show skeleton immediately on script load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    renderNavbarSkeleton();
    rebuildDesktopNavbar(currentUserData);
    rebuildGlobalFooter(currentUserData);
  });
} else {
  renderNavbarSkeleton();
  rebuildDesktopNavbar(currentUserData);
  rebuildGlobalFooter(currentUserData);
}

// Keep track of active user profile snapshot unsubscribe function
let unsubscribeUserProfileListener = null;

// Global Auth State Observer
onAuthStateChanged(auth, async (user) => {
  if (unsubscribeUserProfileListener) {
    unsubscribeUserProfileListener();
    unsubscribeUserProfileListener = null;
  }

  if (user) {
    currentUserData = user;
    const syncedUser = await syncUserProfile(user);
    updateNavbarUI(syncedUser || user);
    window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user: syncedUser || user, isAdmin: isAdminEmail(user.email) } }));
    
    // Subscribe to Firestore user doc in real time to catch suspensions/role changes instantly
    try {
      const userRef = doc(db, 'users', user.uid);
      unsubscribeUserProfileListener = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const profileData = docSnap.data();
          // Update local caches and current user data reference
          currentUserData = {
            ...user,
            role: profileData.role || 'USER',
            status: profileData.status || 'Active',
            username: profileData.username || ''
          };
          
          // Re-sync local storage registry and session storage
          sessionStorage.setItem('fincalc_user_session', safeJsonStringify(currentUserData));
          
          // Re-enforce global settings with updated status/role
          enforceGlobalSettings();
        }
      });
    } catch (e) {
      console.warn("Real-time profile subscription failed:", e);
      enforceGlobalSettings();
    }
  } else {
    // Check if demo user is active
    const demoUser = getCurrentUser();
    if (demoUser) {
      currentUserData = demoUser;
      updateNavbarUI(demoUser);
      window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user: demoUser, isAdmin: isAdminEmail(demoUser.email) } }));
      enforceGlobalSettings();
    } else {
      currentUserData = null;
      updateNavbarUI(null);
      window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user: null, isAdmin: false } }));
      enforceGlobalSettings();
    }
  }
});

// Global settings cache
let globalSettings = {
  maintenanceMode: false,
  allowGuestCalculations: true,
  enableRateLimiting: true,
  enableInvoicePdf: true,
  fxMargin: 0.0
};

// Start listening to settings in real-time
export function initSettingsListener() {
  try {
    const globalSettingsRef = doc(db, 'settings', 'global');
    onSnapshot(globalSettingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        globalSettings = {
          maintenanceMode: data.maintenanceMode ?? false,
          allowGuestCalculations: data.allowGuestCalculations ?? true,
          enableRateLimiting: data.enableRateLimiting ?? true,
          enableInvoicePdf: data.enableInvoicePdf ?? true,
          fxMargin: parseFloat(data.fxMargin || 0.0),
          announcementEnabled: data.announcementEnabled ?? false,
          announcementText: data.announcementText || '',
          announcementTheme: data.announcementTheme || 'amber',
          announcementLink: data.announcementLink || ''
        };
        // Update local storage fallback as well
        localStorage.setItem('fincalc_global_settings', JSON.stringify(globalSettings));
      } else {
        // Fallback default setting document if it doesn't exist
        globalSettings = {
          maintenanceMode: false,
          allowGuestCalculations: true,
          enableRateLimiting: true,
          enableInvoicePdf: true,
          fxMargin: 0.0
        };
      }
      
      // Save global configuration reference
      window.globalSettings = globalSettings;
      
      // Enforce settings immediately on layout
      enforceGlobalSettings();
    }, (err) => {
      console.warn("Firestore settings listener error (falling back to local cache):", err);
      loadLocalSettingsFallback();
    });
  } catch (err) {
    console.warn("Settings init error:", err);
    loadLocalSettingsFallback();
  }

  // Also listen to SEO settings document
  try {
    const seoRef = doc(db, 'settings', 'seo');
    onSnapshot(seoRef, (docSnap) => {
      if (docSnap.exists()) {
        const seoData = docSnap.data();
        window.seoSettings = seoData;
        enforceSeoMetadata(seoData);
      }
    }, (err) => {
      console.warn("Firestore SEO settings listener error:", err);
    });
  } catch (err) {
    console.warn("SEO listener init error:", err);
  }
}

function loadLocalSettingsFallback() {
  try {
    const cached = localStorage.getItem('fincalc_global_settings');
    if (cached) {
      globalSettings = JSON.parse(cached);
      window.globalSettings = globalSettings;
      enforceGlobalSettings();
    }
  } catch (e) {
    console.error("Failed loading cached settings:", e);
  }
}

export function enforceGlobalSettings() {
  const settings = window.globalSettings || globalSettings;
  
  let user = currentUserData;
  if (!user) {
    try {
      const sessionData = sessionStorage.getItem('fincalc_user_session');
      if (sessionData) {
        user = JSON.parse(sessionData);
      }
    } catch (e) {}
  }
  if (!user) {
    user = getCurrentUser();
  }

  const isAdmin = user ? isAdminEmail(user.email) : false;

  const rawPath = window.location.pathname.split('/').pop() || 'index.html';
  const currentPage = rawPath.toLowerCase();

  // 1. Enforce Maintenance Mode
  const existingMaintenance = document.getElementById('maintenance-overlay');
  if (settings.maintenanceMode && !isAdmin) {
    if (!existingMaintenance) {
      const overlay = document.createElement('div');
      overlay.id = 'maintenance-overlay';
      overlay.className = 'fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 bg-slate-950/98 backdrop-blur-md animate-fade-in text-white text-center';
      overlay.innerHTML = `
        <div class="max-w-md p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-amber-500/10 opacity-50 pointer-events-none"></div>
          <div class="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-6 border border-amber-500/20 animate-pulse">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          </div>
          <h1 class="text-xl sm:text-2xl font-black tracking-tight text-white mb-2">System Under Maintenance</h1>
          <p class="text-xs text-slate-400 leading-relaxed mb-6 font-medium">
            We are upgrading our calculator suite with new algorithms and performance improvements. Standard tools will be back online shortly. Thank you for your patience!
          </p>
          <div class="flex flex-col gap-2">
            <button id="btn-maintenance-admin-login" class="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-extrabold text-xs rounded-xl transition-all shadow-xs cursor-pointer">
              Sign in as Administrator
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      document.getElementById('btn-maintenance-admin-login')?.addEventListener('click', () => {
        loginWithGoogle();
      });
    }
  } else {
    existingMaintenance?.remove();
  }

  // 2. Enforce Suspended/Banned User
  const existingBan = document.getElementById('ban-overlay');
  if (user && user.status === 'Suspended') {
    if (!existingBan) {
      const overlay = document.createElement('div');
      overlay.id = 'ban-overlay';
      overlay.className = 'fixed inset-0 z-[10000] flex flex-col items-center justify-center p-6 bg-slate-950 text-white text-center';
      overlay.innerHTML = `
        <div class="max-w-md p-8 rounded-3xl bg-slate-900/60 border border-red-500/20 shadow-2xl backdrop-blur-xl">
          <div class="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-6 border border-red-500/20">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
          </div>
          <h1 class="text-xl font-black tracking-tight text-white mb-2">Account Suspended</h1>
          <p class="text-xs text-slate-400 leading-relaxed mb-6 font-medium">
            Your account has been suspended by the Administrator due to a policy violation or abnormal activity. If you believe this is an error, please contact support.
          </p>
          <button id="btn-ban-logout" class="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs cursor-pointer">
            Sign Out
          </button>
        </div>
      `;
      document.body.appendChild(overlay);
      
      document.getElementById('btn-ban-logout')?.addEventListener('click', async () => {
        sessionStorage.removeItem('fincalc_user_session');
        await logoutUser();
        window.location.reload();
      });
    }
  } else {
    existingBan?.remove();
  }

  // 3. Enforce Guest Calculations Lock (only standard tools, not homepage, about, contact, updates, profile, admin, stats, links)
  const nonCalculatorPages = [
    'index.html', 'about.html', 'contact.html', 'updates.html', 
    'profile.html', 'admin.html', 'link-stats.html', 'disclaimer.html',
    'terms-of-service.html', 'privacy-policy.html'
  ];
  const isCalculatorPage = !nonCalculatorPages.includes(currentPage);
  const existingLock = document.getElementById('login-lock-overlay');
  
  if (!settings.allowGuestCalculations && !user && isCalculatorPage) {
    if (!existingLock) {
      const overlay = document.createElement('div');
      overlay.id = 'login-lock-overlay';
      overlay.className = 'fixed inset-0 z-[999] flex flex-col items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in text-white text-center';
      overlay.innerHTML = `
        <div class="max-w-md p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-2xl backdrop-blur-xl relative overflow-hidden animate-scale-up">
          <div class="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-indigo-500/10 opacity-50 pointer-events-none"></div>
          <div class="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          </div>
          <h1 class="text-xl font-black tracking-tight text-white mb-2">Registration Required</h1>
          <p class="text-xs text-slate-400 leading-relaxed mb-6 font-medium">
            This professional calculator is reserved for registered users. Create a free account or sign in to save calculations, customize subtotal preferences, and export PDF reports.
          </p>
          <button id="btn-lock-google-login" class="w-full py-2.5 bg-white text-slate-900 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95 transition-transform hover:bg-slate-50">
            <svg class="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Sign in with Google</span>
          </button>
        </div>
      `;
      document.body.appendChild(overlay);

      document.getElementById('btn-lock-google-login')?.addEventListener('click', () => {
        loginWithGoogle();
      });
    }
  } else {
    existingLock?.remove();
  }

  // 4. Enforce PDF Invoice Export Disable
  if (currentPage === 'invoice-generator.html') {
    const btnPdf = document.getElementById('btn-download-pdf');
    const btnPrint = document.getElementById('btn-print-invoice');
    
    if (btnPdf && btnPrint) {
      if (!settings.enableInvoicePdf) {
        btnPdf.classList.add('opacity-50', 'cursor-not-allowed');
        btnPrint.classList.add('opacity-50', 'cursor-not-allowed');
        
        btnPdf.title = 'PDF Generation is disabled by the Administrator.';
        btnPrint.title = 'Printing is disabled by the Administrator.';

        // Prevent print/download events
        btnPdf.onclick = (e) => {
          e.stopImmediatePropagation();
          e.preventDefault();
          showToast('PDF Generation is temporarily disabled by the Administrator.', 'error');
        };
        btnPrint.onclick = (e) => {
          e.stopImmediatePropagation();
          e.preventDefault();
          showToast('Printing is temporarily disabled by the Administrator.', 'error');
        };
      } else {
        // Reset properties
        btnPdf.classList.remove('opacity-50', 'cursor-not-allowed');
        btnPrint.classList.remove('opacity-50', 'cursor-not-allowed');
        btnPdf.removeAttribute('title');
        btnPrint.removeAttribute('title');
        btnPdf.onclick = null;
        btnPrint.onclick = null;
      }
    }
  }

  // 5. Enforce dynamic announcement bar
  renderAnnouncementsBannerDynamic(settings);
}

function enforceSeoMetadata(seoData) {
  const rawPath = window.location.pathname.split('/').pop() || 'index.html';
  const currentPage = rawPath.toLowerCase();
  
  if (seoData && seoData[currentPage]) {
    const config = seoData[currentPage];
    if (config.title) {
      document.title = config.title;
    }
    if (config.description) {
      let descMeta = document.querySelector('meta[name="description"]');
      if (!descMeta) {
        descMeta = document.createElement('meta');
        descMeta.name = 'description';
        document.head.appendChild(descMeta);
      }
      descMeta.setAttribute('content', config.description);
    }
    if (config.keywords) {
      let keywordsMeta = document.querySelector('meta[name="keywords"]');
      if (!keywordsMeta) {
        keywordsMeta = document.createElement('meta');
        keywordsMeta.name = 'keywords';
        document.head.appendChild(keywordsMeta);
      }
      keywordsMeta.setAttribute('content', config.keywords);
    }
  }
}

function renderAnnouncementsBannerDynamic(settings) {
  let existingBanner = document.getElementById('global-broadcast-announcement-banner');

  if (!settings.announcementEnabled || !settings.announcementText) {
    if (existingBanner) existingBanner.remove();
    return;
  }

  if (!existingBanner) {
    existingBanner = document.createElement('div');
    existingBanner.id = 'global-broadcast-announcement-banner';
    document.body.prepend(existingBanner);
  }

  const themeBg = settings.announcementTheme === 'indigo' ? 'bg-indigo-600 text-white' :
                  settings.announcementTheme === 'emerald' ? 'bg-emerald-600 text-white' :
                  settings.announcementTheme === 'rose' ? 'bg-rose-600 text-white' :
                  'bg-amber-500 text-slate-950 font-semibold';

  existingBanner.className = `${themeBg} px-4 py-2 text-xs text-center flex items-center justify-center gap-2 transition-all shadow-sm z-50 relative`;
  existingBanner.innerHTML = `
    <span class="inline-block w-2 h-2 rounded-full bg-current animate-ping animate-pulse-slow"></span>
    <span>${settings.announcementText}</span>
    ${settings.announcementLink ? `<a href="${settings.announcementLink}" class="underline font-bold hover:opacity-80 ml-1">Learn More &rarr;</a>` : ''}
    <button id="btn-dismiss-announcement" class="ml-4 opacity-70 hover:opacity-100 p-0.5" title="Dismiss">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  `;

  document.getElementById('btn-dismiss-announcement')?.addEventListener('click', () => {
    existingBanner.remove();
  });
}

// Start listening immediately
initSettingsListener();

/**
 * Rebuilds the footer dynamically across all pages to match index.html
 */
function rebuildGlobalFooter(user) {
  const footer = document.querySelector('footer');
  if (!footer) return;

  const isAdmin = user ? isAdminEmail(user.email) : false;
  const currentYear = new Date().getFullYear();

  footer.className = "bg-slate-900 text-slate-400 text-xs border-t border-slate-800 mt-16 py-12 px-4 sm:px-6 lg:px-8";
  footer.innerHTML = `
    <div class="max-w-7xl mx-auto">
      <div class="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div class="md:col-span-1">
          <div class="flex items-center gap-2 font-bold text-white text-sm mb-3">
            <div class="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center text-slate-900">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            FinCalc Tools
          </div>
          <p class="text-slate-400 text-xs leading-relaxed">
            Free professional online finance and business calculators for everyday decisions.
          </p>
        </div>

        <div>
          <h4 class="font-bold text-slate-200 mb-3">Calculators</h4>
          <ul class="space-y-2">
            <li><a href="loan-calculator.html" class="hover:text-emerald-400 transition-colors">Loan / Mortgage</a></li>
            <li><a href="currency-converter.html" class="hover:text-emerald-400 transition-colors">Currency Converter</a></li>
            <li><a href="tax-calculator.html" class="hover:text-emerald-400 transition-colors">Tax Calculator</a></li>
          </ul>
        </div>

        <div>
          <h4 class="font-bold text-slate-200 mb-3">Business Tools</h4>
          <ul class="space-y-2">
            <li><a href="salary-calculator.html" class="hover:text-emerald-400 transition-colors">Salary & Paycheck</a></li>
            <li><a href="invoice-generator.html" class="hover:text-emerald-400 transition-colors">Invoice Generator</a></li>
            <li><a href="roi-calculator.html" class="hover:text-emerald-400 transition-colors">ROI Calculator</a></li>
          </ul>
        </div>

        <div>
          <h4 class="font-bold text-slate-200 mb-3">Quick Utilities</h4>
          <ul class="space-y-2">
            <li><a href="qr-generator.html" class="hover:text-indigo-400 transition-colors">QR Code Generator</a></li>
            <li><a href="password-generator.html" class="hover:text-indigo-400 transition-colors">Password Generator</a></li>
            <li><a href="word-counter.html" class="hover:text-indigo-400 transition-colors">Word Counter</a></li>
            <li><a href="unit-converter.html" class="hover:text-indigo-400 transition-colors">Unit Converter</a></li>
            <li><a href="age-calculator.html" class="hover:text-indigo-400 transition-colors">Age Calculator</a></li>
          </ul>
        </div>

        <div>
          <h4 class="font-bold text-slate-200 mb-3">Legal & Info</h4>
          <ul class="space-y-2">
            <li><a href="about.html" class="hover:text-emerald-400 transition-colors">About Us</a></li>
            <li><a href="contact.html" class="hover:text-emerald-400 transition-colors">Contact Us</a></li>
            <li><a href="privacy-policy.html" class="hover:text-emerald-400 transition-colors">Privacy Policy</a></li>
            <li><a href="terms-of-service.html" class="hover:text-emerald-400 transition-colors">Terms of Service</a></li>
            <li><a href="disclaimer.html" class="hover:text-emerald-400 transition-colors">Disclaimer</a></li>
            <li><a href="profile.html" class="hover:text-emerald-400 transition-colors">User Profile</a></li>
            <li class="footer-admin-link ${isAdmin ? '' : 'hidden'}"><a href="admin.html" class="hover:text-emerald-400 transition-colors">Admin Dashboard</a></li>
          </ul>
        </div>
      </div>

      <div class="pt-6 border-t border-slate-800 text-center text-slate-500 text-[11px] leading-relaxed max-w-4xl mx-auto">
        <p class="font-semibold text-slate-400 mb-1">Financial & Legal Disclaimer</p>
        <p>
          These tools provide estimates for informational purposes only and do not constitute financial, legal, or tax advice. Always consult a certified accountant or financial advisor for official tax filings and lending calculations.
        </p>
        <p class="mt-4 text-slate-600">
          &copy; ${currentYear} FinCalc Tools. All rights reserved. Powered by Firebase Auth & Firestore.
        </p>
      </div>
    </div>
  `;
}

/**
 * Dynamically rebuilds the desktop navigation bar to keep it identical across all pages.
 */
function rebuildDesktopNavbar(user) {
  const desktopNav = document.querySelector('header nav.hidden.lg\\:flex') || document.querySelector('header nav');
  if (!desktopNav) return;

  desktopNav.className = "hidden lg:flex items-center gap-4 text-xs font-semibold text-slate-600";

  const rawPath = window.location.pathname.split('/').pop() || 'index.html';
  const path = rawPath.toLowerCase();
  const isHome = path === '' || path === 'index.html';
  const isAdmin = user ? isAdminEmail(user.email) : false;

  const isPageActive = (href) => {
    return (href === 'index.html' && isHome) || (path === href.toLowerCase());
  };

  const loansSavingsGroup = LOANS_SAVINGS_GROUP;
  const taxSalaryGroup = TAX_SALARY_GROUP;
  const businessDocsGroup = BUSINESS_DOCS_GROUP;
  const devToolsGroup = DEV_TOOLS_GROUP;
  const productivityGroup = PRODUCTIVITY_GROUP;

  const hasActiveLoansSavings = loansSavingsGroup.some(t => isPageActive(t.href));
  const hasActiveTaxSalary = taxSalaryGroup.some(t => isPageActive(t.href));
  const hasActiveBusinessDocs = businessDocsGroup.some(t => isPageActive(t.href));
  const hasActiveDevTools = devToolsGroup.some(t => isPageActive(t.href));
  const hasActiveProductivity = productivityGroup.some(t => isPageActive(t.href));

  const isBlogActive = isPageActive('updates.html');
  const blogClass = isBlogActive 
    ? 'bg-rose-100 text-rose-950 border-rose-300 font-extrabold shadow-sm hover:scale-105 active:scale-95 hover:ring-2 hover:ring-rose-250 transition-all duration-300' 
    : 'bg-rose-50/50 text-rose-700 border-rose-200/80 hover:bg-rose-100/80 hover:text-rose-900 hover:border-rose-300 hover:scale-105 active:scale-95 hover:ring-2 hover:ring-rose-150 transition-all duration-300';

  const buildCardGridHtml = (items) => {
    return items.map(t => {
      const active = isPageActive(t.href);
      const cardBg = active ? `bg-${t.color}-50 border-${t.color}-200` : 'hover:bg-slate-50 hover:border-slate-200 border-transparent';
      const iconBg = active ? `bg-${t.color}-100 text-${t.color}-700` : `bg-${t.color}-50 text-${t.color}-600 group-hover/item:bg-${t.color}-100 transition-colors`;
      return `
        <a href="${t.href}" class="flex items-start gap-3 p-2.5 rounded-xl border transition-all duration-200 group/item text-left ${cardBg}">
          <div class="w-8.5 h-8.5 rounded-lg flex items-center justify-center shrink-0 ${iconBg}">
            <svg class="w-4.5 h-4.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">${t.icon}</svg>
          </div>
          <div class="min-w-0">
            <p class="text-xs font-bold text-slate-800 transition-colors truncate">${t.name}</p>
            <p class="text-[10px] text-slate-400 font-semibold leading-relaxed mt-0.5">${t.desc}</p>
          </div>
        </a>
      `;
    }).join('');
  };

  desktopNav.innerHTML = `
    <!-- 1. Loans & Savings Dropdown -->
    <div class="relative group py-2">
      <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold select-none text-xs border ${
        hasActiveLoansSavings 
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80 shadow-3xs' 
          : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900 border-transparent'
      }">
        <span>📈 Loans & Savings</span>
        <svg class="w-3.5 h-3.5 text-slate-400 group-hover:rotate-180 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      <div class="absolute left-0 top-full pt-3 hidden group-hover:block z-50 animate-fade-in w-[540px]">
        <div class="bg-white rounded-2xl shadow-xl border border-slate-200/90 p-4 grid grid-cols-2 gap-2.5">
          ${buildCardGridHtml(loansSavingsGroup)}
        </div>
      </div>
    </div>

    <!-- 2. Tax & Salary Dropdown -->
    <div class="relative group py-2">
      <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold select-none text-xs border ${
        hasActiveTaxSalary 
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80 shadow-3xs' 
          : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900 border-transparent'
      }">
        <span>💸 Tax & Salary</span>
        <svg class="w-3.5 h-3.5 text-slate-400 group-hover:rotate-180 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      <div class="absolute left-[-20px] top-full pt-3 hidden group-hover:block z-50 animate-fade-in w-[320px]">
        <div class="bg-white rounded-2xl shadow-xl border border-slate-200/90 p-4 grid grid-cols-1 gap-2.5">
          ${buildCardGridHtml(taxSalaryGroup)}
        </div>
      </div>
    </div>

    <!-- 3. Business Docs Dropdown -->
    <div class="relative group py-2">
      <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold select-none text-xs border ${
        hasActiveBusinessDocs 
          ? 'bg-indigo-50 text-indigo-800 border-indigo-200/80 shadow-3xs' 
          : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900 border-transparent'
      }">
        <span>💼 Business Docs</span>
        <svg class="w-3.5 h-3.5 text-slate-400 group-hover:rotate-180 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      <div class="absolute left-[-40px] top-full pt-3 hidden group-hover:block z-50 animate-fade-in w-[320px]">
        <div class="bg-white rounded-2xl shadow-xl border border-slate-200/90 p-4 grid grid-cols-1 gap-2.5">
          ${buildCardGridHtml(businessDocsGroup)}
        </div>
      </div>
    </div>

    <!-- 4. Dev Tools Dropdown -->
    <div class="relative group py-2">
      <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold select-none text-xs border ${
        hasActiveDevTools 
          ? 'bg-indigo-50 text-indigo-800 border-indigo-200/80 shadow-3xs' 
          : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900 border-transparent'
      }">
        <span>🛠️ Dev Tools</span>
        <svg class="w-3.5 h-3.5 text-slate-400 group-hover:rotate-180 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      <div class="absolute left-[-150px] top-full pt-3 hidden group-hover:block z-50 animate-fade-in w-[540px]">
        <div class="bg-white rounded-2xl shadow-xl border border-slate-200/90 p-4 grid grid-cols-2 gap-2.5">
          ${buildCardGridHtml(devToolsGroup)}
        </div>
      </div>
    </div>

    <!-- 5. Productivity Dropdown -->
    <div class="relative group py-2">
      <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold select-none text-xs border ${
        hasActiveProductivity 
          ? 'bg-indigo-50 text-indigo-800 border-indigo-200/80 shadow-3xs' 
          : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900 border-transparent'
      }">
        <span>⚡ Productivity</span>
        <svg class="w-3.5 h-3.5 text-slate-400 group-hover:rotate-180 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      <div class="absolute right-0 top-full pt-3 hidden group-hover:block z-50 animate-fade-in w-[540px]">
        <div class="bg-white rounded-2xl shadow-xl border border-slate-200/90 p-4 grid grid-cols-2 gap-2.5">
          ${buildCardGridHtml(productivityGroup)}
        </div>
      </div>
    </div>
    
    <!-- Blog Link -->
    <a href="updates.html" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border cursor-pointer font-bold select-none text-xs ${blogClass}">
      <span>📰 Blog</span>
    </a>

    <!-- Admin Link -->
    ${isAdmin ? `
      <a id="nav-admin-link" href="admin.html" class="flex items-center gap-1 px-3 py-1.5 rounded-xl text-amber-700 hover:text-amber-800 font-bold bg-amber-50 hover:bg-amber-100 transition-colors border border-amber-200">
        <span>Admin</span>
      </a>
    ` : ''}
  `;
}

/**
 * Fetches all saved items in the user's collections (pages, blogs, calculations)
 */
export async function getSavedCollections() {
  const user = getCurrentUser();
  const fallbackKey = user ? `fincalc_saved_${user.uid}` : 'fincalc_saved_anonymous';
  
  // Local storage fetch helper
  const getLocal = () => {
    try {
      const local = localStorage.getItem(fallbackKey);
      return local ? JSON.parse(local) : { pages: [], blogs: [], calculations: [] };
    } catch (e) {
      return { pages: [], blogs: [], calculations: [] };
    }
  };

  // If not logged in with real Google user (or demo user), return local
  if (!user || user.uid.startsWith('usr_')) {
    return getLocal();
  }

  // Real Google Auth User -> load from Firestore
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.savedCollections) {
        // Sync local storage with latest Firestore copy just in case
        localStorage.setItem(fallbackKey, safeJsonStringify(data.savedCollections));
        return data.savedCollections;
      }
    }
  } catch (err) {
    console.error("Firestore getSavedCollections error:", err);
  }

  return getLocal();
}

/**
 * Saves a page, blog, or calculation to the user's collection
 */
export async function saveItemToCollection(type, item) {
  const collections = await getSavedCollections();
  if (!collections[type]) {
    collections[type] = [];
  }

  // Check if already saved
  const exists = collections[type].some(x => x.id === item.id);
  if (exists) {
    return { success: true, alreadySaved: true };
  }

  // Add item with saved timestamp
  item.savedAt = Date.now();
  collections[type].push(item);

  const user = getCurrentUser();
  const fallbackKey = user ? `fincalc_saved_${user.uid}` : 'fincalc_saved_anonymous';

  // Save locally first
  try {
    localStorage.setItem(fallbackKey, safeJsonStringify(collections));
  } catch (e) {
    console.error("Local save error:", e);
  }

  // Sync to Firestore if authenticated Google user
  if (user && !user.uid.startsWith('usr_')) {
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        savedCollections: collections
      });
    } catch (err) {
      console.error("Firestore saveItemToCollection sync error:", err);
    }
  }

  // Dispatch custom event to notify profile page
  window.dispatchEvent(new CustomEvent('saved-collections-updated', { detail: collections }));
  return { success: true, alreadySaved: false };
}

/**
 * Removes an item from the user's collection
 */
export async function removeItemFromCollection(type, itemId) {
  const collections = await getSavedCollections();
  if (!collections[type]) return { success: false };

  collections[type] = collections[type].filter(x => x.id !== itemId);

  const user = getCurrentUser();
  const fallbackKey = user ? `fincalc_saved_${user.uid}` : 'fincalc_saved_anonymous';

  // Update local storage
  try {
    localStorage.setItem(fallbackKey, safeJsonStringify(collections));
  } catch (e) {
    console.error("Local save error:", e);
  }

  // Sync to Firestore if authenticated Google user
  if (user && !user.uid.startsWith('usr_')) {
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        savedCollections: collections
      });
    } catch (err) {
      console.error("Firestore removeItemFromCollection sync error:", err);
    }
  }

  // Dispatch custom event to notify profile page
  window.dispatchEvent(new CustomEvent('saved-collections-updated', { detail: collections }));
  return { success: true };
}

/**
 * Global helper to attach calculation saving to any results panel
 */
export function registerCalculationSaver(btnId, toolName, getCalcDataFn) {
  const btn = document.getElementById(btnId);
  if (!btn) return null;

  const updateBtnState = async (id) => {
    const collections = await getSavedCollections();
    const isSaved = collections.calculations.some(c => c.id === id);
    const svg = btn.querySelector('svg');
    const textSpan = btn.querySelector('.btn-text');
    if (!svg || !textSpan) return;

    if (isSaved) {
      btn.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold transition-all cursor-pointer';
      svg.setAttribute('fill', 'currentColor');
      textSpan.textContent = 'Saved to Profile';
    } else {
      btn.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-750 hover:text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-3xs';
      svg.setAttribute('fill', 'none');
      textSpan.textContent = 'Save Calculation';
    }
  };

  const getCalcId = (data) => {
    const serialized = JSON.stringify(data.inputs);
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      hash = (hash << 5) - hash + serialized.charCodeAt(i);
      hash |= 0;
    }
    return `${toolName.toLowerCase().replace(/\s+/g, '-')}-${Math.abs(hash)}`;
  };

  btn.addEventListener('click', async () => {
    const data = getCalcDataFn();
    if (!data) return;

    const calcId = getCalcId(data);
    const collections = await getSavedCollections();
    const isSaved = collections.calculations.some(c => c.id === calcId);

    if (isSaved) {
      await removeItemFromCollection('calculations', calcId);
      showToast('Removed calculation from profile', 'info');
    } else {
      const namePrompt = prompt("Enter a label for this calculation:", `${toolName} Calculation`);
      if (namePrompt === null) return;
      const labelName = namePrompt.trim() || `${toolName} Calculation`;

      await saveItemToCollection('calculations', {
        id: calcId,
        toolName: toolName,
        name: labelName,
        inputs: data.inputs,
        outputs: data.outputs,
        url: window.location.pathname.split('/').pop() || 'index.html'
      });
      showToast('Calculation saved to profile!', 'success');
    }
    updateBtnState(calcId);
  });

  return {
    updateState: () => {
      const data = getCalcDataFn();
      if (data) {
        updateBtnState(getCalcId(data));
      }
    }
  };
}

// Automatically initialize the global page bookmark button on DOM load
function initPageBookmarkButton() {
  const fullPath = window.location.pathname.toLowerCase();
  const rawPath = fullPath.split('/').pop() || 'index.html';
  
  // Excluded paths (Profile page, admin pages, blog lists, blog post readers)
  const isExcluded = 
    fullPath === '/' ||
    fullPath.endsWith('/index.html') ||
    fullPath.includes('/profile') ||
    fullPath.includes('/admin') ||
    fullPath.includes('/link-stats') ||
    fullPath.includes('/blog/') ||
    fullPath.includes('updates.html') ||
    rawPath === '';

  if (isExcluded) return;

  // Get current page name from document title or H1
  let pageName = document.title.split('–')[0].split('|')[0].trim();
  if (!pageName) pageName = "Tool Page";

  // Create button
  const btn = document.createElement('button');
  btn.id = 'global-save-page-btn';
  btn.className = 'fixed bottom-6 right-6 z-40 p-3.5 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-lg text-slate-655 hover:text-rose-600 hover:scale-110 active:scale-90 transition-all duration-300 flex items-center justify-center group cursor-pointer';
  btn.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)';
  
  btn.innerHTML = `
    <svg class="w-5 h-5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
    <span class="absolute right-full mr-3 px-2.5 py-1 text-[10px] font-bold text-white bg-slate-900 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-sm pointer-events-none uppercase tracking-wider">Bookmark Page</span>
  `;

  document.body.appendChild(btn);

  // Update button state (active or inactive)
  const updateBtnState = async () => {
    const collections = await getSavedCollections();
    const isSaved = collections.pages.some(p => p.id === path);
    const svg = btn.querySelector('svg');
    const span = btn.querySelector('span');

    if (isSaved) {
      btn.className = 'fixed bottom-6 right-6 z-40 p-3.5 rounded-full bg-rose-50 border border-rose-200/80 shadow-lg text-rose-600 hover:scale-110 active:scale-90 transition-all duration-300 flex items-center justify-center group cursor-pointer';
      svg.setAttribute('fill', 'currentColor');
      span.textContent = 'Remove Bookmark';
    } else {
      btn.className = 'fixed bottom-6 right-6 z-40 p-3.5 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-lg text-slate-655 hover:text-rose-600 hover:scale-110 active:scale-90 transition-all duration-300 flex items-center justify-center group cursor-pointer';
      svg.setAttribute('fill', 'none');
      span.textContent = 'Bookmark Page';
    }
  };

  btn.addEventListener('click', async () => {
    const collections = await getSavedCollections();
    const isSaved = collections.pages.some(p => p.id === path);

    if (isSaved) {
      await removeItemFromCollection('pages', path);
      showToast('Removed from bookmarks', 'info');
    } else {
      await saveItemToCollection('pages', { id: path, name: pageName, href: path });
      showToast('Saved to your profile bookmarks!', 'success');
    }
    updateBtnState();
  });

  updateBtnState();
}

// Initialize global smooth scrolling with Lenis (darkroomengineering/lenis)
if (typeof window !== 'undefined') {
  // Only initialize if the page is the top-level viewport (ignore inside iframes)
  if (window.self === window.top) {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      smoothTouch: false
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
  }

  // Dynamically inject green abacus vector SVG favicon site-wide
  window.addEventListener('DOMContentLoaded', () => {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/svg+xml';
    link.href = '/favicon.svg';

    // Apply data-lenis-prevent dynamically to prevent Lenis smooth scroll from hijacking scrollable modals/logs
    document.querySelectorAll('.overflow-y-auto, [class*="overflow-y-auto"]').forEach(el => {
      el.setAttribute('data-lenis-prevent', 'true');
    });

    // Initialize the page bookmark button
    initPageBookmarkButton();
  });
}

