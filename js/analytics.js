/**
 * FinCalc Tools - Analytics Tracking Engine
 * Handles tool usage counters (with Firestore increment & debouncing),
 * Daily Active Users (DAU) tracking, and privacy-friendly daily page views.
 */

import { 
  db, 
  doc, 
  setDoc, 
  collection, 
  getDocs, 
  increment, 
  serverTimestamp 
} from './firebase-config.js';
import { getCurrentUser } from './auth.js';

// Debounce timer cache per tool
const debounceTimers = {};

/**
 * Increments tool usage counter in Firestore at analytics/toolUsage/items/{toolName}
 * Debounced to prevent excessive writes on rapid keystrokes/typing.
 * @param {string} toolName 
 */
export function trackToolUsage(toolName) {
  if (!toolName) return;

  if (debounceTimers[toolName]) {
    clearTimeout(debounceTimers[toolName]);
  }

  debounceTimers[toolName] = setTimeout(async () => {
    try {
      const toolRef = doc(db, 'analytics', 'toolUsage', 'items', toolName);
      await setDoc(toolRef, {
        toolName: toolName,
        count: increment(1),
        lastUsed: serverTimestamp()
      }, { merge: true });
      console.log(`[Analytics] Increment recorded for tool: ${toolName}`);
    } catch (err) {
      console.warn(`[Analytics] Tool usage increment deferred:`, err.message);
    }
  }, 1000); // 1s debounce
}

/**
 * Tracks Daily Active User (DAU) or Anonymous Page View on page load.
 * Executed once per day per session using sessionStorage flag.
 */
export async function trackDailyActivity() {
  const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const activeUser = getCurrentUser();

  if (activeUser && activeUser.uid) {
    // Logged in user DAU tracking
    const sessionKey = `dau_logged_${todayStr}`;
    if (!sessionStorage.getItem(sessionKey)) {
      try {
        const dauRef = doc(db, 'analytics', 'dailyActive', todayStr, activeUser.uid);
        await setDoc(dauRef, {
          uid: activeUser.uid,
          email: activeUser.email || 'anonymous',
          lastSeen: serverTimestamp()
        }, { merge: true });
        sessionStorage.setItem(sessionKey, 'true');
        console.log(`[Analytics] DAU recorded for ${todayStr}`);
      } catch (err) {
        console.warn(`[Analytics] DAU tracking note:`, err.message);
      }
    }
  } else {
    // Non-logged-in visitor anonymous daily page view tracking
    const pvSessionKey = `pv_logged_${todayStr}`;
    if (!sessionStorage.getItem(pvSessionKey)) {
      try {
        const pvRef = doc(db, 'analytics', 'dailyPageViews', 'days', todayStr);
        await setDoc(pvRef, {
          date: todayStr,
          count: increment(1),
          lastUpdated: serverTimestamp()
        }, { merge: true });
        sessionStorage.setItem(pvSessionKey, 'true');
        console.log(`[Analytics] Anonymous page view recorded for ${todayStr}`);
      } catch (err) {
        console.warn(`[Analytics] Page view tracking note:`, err.message);
      }
    }
  }
}

/**
 * Fetches tool usage statistics for Admin Panel
 */
export async function fetchToolUsageAnalytics() {
  const defaultTools = [
    'Loan Calculator',
    'Currency Converter',
    'Income Tax Calculator',
    'Salary Calculator',
    'Invoice Generator',
    'ROI Calculator',
    'QR Code Generator',
    'Password Generator',
    'Word Counter',
    'Unit Converter',
    'Age Calculator'
  ];

  const toolsMap = {};
  defaultTools.forEach(t => {
    toolsMap[t] = { toolName: t, count: 0, lastUsed: null };
  });

  try {
    const querySnapshot = await getDocs(collection(db, 'analytics', 'toolUsage', 'items'));
    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const tName = data.toolName || docSnap.id;
      toolsMap[tName] = {
        toolName: tName,
        count: data.count || 0,
        lastUsed: data.lastUsed ? data.lastUsed.toDate() : null
      };
    });
  } catch (err) {
    console.warn('[Analytics] Error reading toolUsage analytics:', err);
  }

  return Object.values(toolsMap).sort((a, b) => b.count - a.count);
}

/**
 * Fetches last 7 days DAU & Page View data for Admin Panel Chart
 */
export async function fetch7DayAnalytics() {
  const dates = [];
  const today = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const dauData = {};
  const pvData = {};

  // Fetch DAU for each of last 7 days
  await Promise.all(dates.map(async (dateStr) => {
    dauData[dateStr] = 0;
    try {
      const snap = await getDocs(collection(db, 'analytics', 'dailyActive', dateStr));
      dauData[dateStr] = snap.size || 0;
    } catch (e) {
      // fallback
    }
  }));

  // Fetch Page Views
  try {
    const pvSnap = await getDocs(collection(db, 'analytics', 'dailyPageViews', 'days'));
    pvSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.date && dates.includes(data.date)) {
        pvData[data.date] = data.count || 0;
      }
    });
  } catch (e) {
    // fallback
  }

  dates.forEach(d => {
    if (pvData[d] === undefined) pvData[d] = 0;
  });

  return { dates, dauData, pvData };
}

// Auto-track activity on script load
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    trackDailyActivity();
  });
  window.addEventListener('auth-state-changed', () => {
    trackDailyActivity();
  });
}
