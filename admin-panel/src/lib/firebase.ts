import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: "AIzaSyAH6bZBc-4FpMcamG-onxIUH4vz2cdseQg",
  authDomain: "universal-leads-test.firebaseapp.com",
  projectId: "universal-leads-test",
  storageBucket: "universal-leads-test.firebasestorage.app",
  messagingSenderId: "939621115448",
  appId: "1:939621115448:web:0b1bcda036a6289214a8cd",
  measurementId: "G-C630Y0YKHX"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Auth Providers
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');
