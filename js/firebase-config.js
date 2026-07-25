/**
 * FinCalc Tools - Firebase Initialization
 * Uses the exact Firebase project configuration provided.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-analytics.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  collection, 
  getDocs, 
  onSnapshot,
  serverTimestamp,
  query,
  where,
  limit,
  orderBy,
  writeBatch,
  runTransaction,
  increment,
  addDoc
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDNwO_UCfAoGr-39IOOO3orQCytk2yEP74",
  authDomain: "finance-calc-by-ak.firebaseapp.com",
  projectId: "finance-calc-by-ak",
  storageBucket: "finance-calc-by-ak.firebasestorage.app",
  messagingSenderId: "121351876737",
  appId: "1:121351876737:web:0eec81f9e5c01609cc1d80",
  measurementId: "G-QDQFM43PKC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let analytics;
try {
  analytics = getAnalytics(app);
} catch (e) {
  console.log("Analytics initialized in supported browser environment");
}

const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { 
  app, 
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
  collection,
  getDocs,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  limit,
  orderBy,
  deleteDoc,
  writeBatch,
  runTransaction,
  increment,
  addDoc
};
