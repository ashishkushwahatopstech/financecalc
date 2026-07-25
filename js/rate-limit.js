/**
 * FinCalc Tools - Safety & Rate Limiting Engine
 * Prevents form submission spam by tracking submission counts per UID or browser fingerprint in Firestore.
 */

import { db, doc, getDoc, setDoc, serverTimestamp } from './firebase-config.js';
import { getCurrentUser } from './auth.js';

/**
 * Retrieves persistent browser fingerprint for non-logged in users
 * @returns {string}
 */
export function getBrowserFingerprint() {
  let fp = localStorage.getItem('fincalc_browser_fp');
  if (!fp) {
    fp = 'fp_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    localStorage.setItem('fincalc_browser_fp', fp);
  }
  return fp;
}

/**
 * Checks and updates rate limit for form submissions.
 * Limit: Max 5 submissions per 10-minute window (600,000ms).
 * 
 * @returns {Promise<{ allowed: boolean, message?: string }>}
 */
export async function checkAndRecordRateLimit() {
  const activeUser = getCurrentUser();
  const identifier = (activeUser && activeUser.uid) ? activeUser.uid : getBrowserFingerprint();

  const rateLimitRef = doc(db, 'rateLimits', identifier);
  const tenMinutesMs = 10 * 60 * 1000;
  const now = Date.now();

  try {
    const docSnap = await getDoc(rateLimitRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const lastSubmissionMs = data.lastSubmission ? (data.lastSubmission.seconds ? data.lastSubmission.seconds * 1000 : data.lastSubmission) : 0;
      const count = data.submissionCount || 0;

      if (now - lastSubmissionMs < tenMinutesMs) {
        if (count >= 5) {
          return {
            allowed: false,
            message: "You're submitting too quickly. Please wait a few minutes and try again."
          };
        } else {
          // Increment count within 10 min window
          await setDoc(rateLimitRef, {
            submissionCount: count + 1,
            lastSubmission: serverTimestamp(),
            identifier: identifier
          }, { merge: true });
          return { allowed: true };
        }
      }
    }

    // First submission or outside 10 min window -> reset count to 1
    await setDoc(rateLimitRef, {
      submissionCount: 1,
      lastSubmission: serverTimestamp(),
      identifier: identifier
    }, { merge: true });

    return { allowed: true };
  } catch (err) {
    console.warn('[RateLimit] Rate check error fallback:', err.message);
    // Graceful fallback if offline
    return { allowed: true };
  }
}
