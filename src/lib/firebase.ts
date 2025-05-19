
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

console.log("Firebase Client Init: Constructed firebaseConfig object:", JSON.stringify(firebaseConfig, null, 2));

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

    Please ensure these NEXT_PUBLIC_ prefixed environment variables are correctly set and accessible to your Next.js client-side build.
    - If using Firebase Studio, verify its environment variable configuration section.
    - If using a local .env.local file, ensure it's in the project root and the development server has been RESTARTED after any changes.
    - Review your server/build logs for the 'Firebase Client Init: Attempting to read...' messages above to see the exact values being processed.`;
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
      "Current config being used:", JSON.stringify(firebaseConfig, null, 2)
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
