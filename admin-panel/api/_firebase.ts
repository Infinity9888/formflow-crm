import * as admin from 'firebase-admin';

// Check if app is already initialized to prevent errors in serverless environments
if (!admin.apps.length) {
  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccountJson) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is missing.");
    }
    
    const serviceAccount = JSON.parse(serviceAccountJson);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export const db = admin.firestore();
