
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// For client-side Firebase initialization, we MUST use NEXT_PUBLIC_ prefixed variables.
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

console.log("Firebase Client Init: Attempting to read NEXT_PUBLIC_FIREBASE_API_KEY. Value:", apiKey);
console.log("Firebase Client Init: Attempting to read NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN. Value:", authDomain);
console.log("Firebase Client Init: Attempting to read NEXT_PUBLIC_FIREBASE_PROJECT_ID. Value:", projectId);
console.log("Firebase Client Init: Attempting to read NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET. Value:", storageBucket);
console.log("Firebase Client Init: Attempting to read NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID. Value:", messagingSenderId);
console.log("Firebase Client Init: Attempting to read NEXT_PUBLIC_FIREBASE_APP_ID. Value:", appId);

const firebaseConfig = {
  apiKey: apiKey,
  authDomain: authDomain,
  projectId: projectId,
  storageBucket: storageBucket,
  messagingSenderId: messagingSenderId,
  appId: appId,
};

console.log("Firebase Client Init: Constructed firebaseConfig object (values from process.env):", JSON.stringify(firebaseConfig, null, 2));

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (getApps().length === 0) {
  // Check if essential config values are present and throw an error if not
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    const errorMsg = `CRITICAL Firebase Client Init Error: NEXT_PUBLIC_FIREBASE_API_KEY or NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing.
    Values found during config construction:
    NEXT_PUBLIC_FIREBASE_API_KEY: '${firebaseConfig.apiKey}'
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: '${firebaseConfig.projectId}'
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: '${firebaseConfig.authDomain}'
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: '${firebaseConfig.storageBucket}'
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '${firebaseConfig.messagingSenderId}'
    NEXT_PUBLIC_FIREBASE_APP_ID: '${firebaseConfig.appId}'

    IMMEDIATE ACTION REQUIRED:
    1. **Firebase Studio Users:** Verify your project's environment variable configuration section WITHIN FIREBASE STUDIO. Ensure all NEXT_PUBLIC_ prefixed variables listed above are correctly set with your actual Firebase project credentials. Restart/redeploy your app in Studio after changes.
    2. **Local .env.local Users:** Ensure a .env.local file exists in your project root (not inside /src), contains all NEXT_PUBLIC_ prefixed variables with correct values, and that your development server has been FULLY RESTARTED after any changes.
    3. **Review Server/Build Logs:** Carefully check your server-side console logs (or Firebase Studio build/runtime logs) for the "Firebase Client Init: Attempting to read..." messages. These logs show the exact values (or 'undefined') being read by the application.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Warn if other, less critical (for basic init) values are missing
  if (
    !firebaseConfig.authDomain ||
    !firebaseConfig.storageBucket ||
    !firebaseConfig.messagingSenderId ||
    !firebaseConfig.appId
  ) {
    console.warn(
      "Firebase Client Init Warning: Some non-critical Firebase configuration values (authDomain, storageBucket, messagingSenderId, appId) " +
      "are missing or undefined. This might lead to issues with specific Firebase services. " +
      "Current config being used for these potentially missing values:",
      JSON.stringify({
        authDomain: firebaseConfig.authDomain,
        storageBucket: firebaseConfig.storageBucket,
        messagingSenderId: firebaseConfig.messagingSenderId,
        appId: firebaseConfig.appId,
      }, null, 2)
    );
  }
  
  try {
    app = initializeApp(firebaseConfig);
  } catch (initError) {
    console.error("Firebase Client Init Error: Failed to initialize Firebase App. This usually means some config values are present but potentially invalid (e.g., malformed projectId, authDomain). Error:", initError);
    console.error("Firebase config that caused initialization failure:", JSON.stringify(firebaseConfig, null, 2));
    throw initError; // Re-throw the original initialization error
  }

} else {
  app = getApps()[0];
}

auth = getAuth(app);
db = getFirestore(app);
storage = getStorage(app);

export { app, auth, db, storage };
