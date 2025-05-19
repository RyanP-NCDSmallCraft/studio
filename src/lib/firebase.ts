
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// Explicitly log what is being read from process.env
const publicApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const serverApiKey = process.env.FIREBASE_API_KEY;
const publicProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const serverProjectId = process.env.FIREBASE_PROJECT_ID;

console.log("Firebase Init: Raw NEXT_PUBLIC_FIREBASE_API_KEY:", publicApiKey);
console.log("Firebase Init: Raw FIREBASE_API_KEY (server fallback):", serverApiKey);
console.log("Firebase Init: Raw NEXT_PUBLIC_FIREBASE_PROJECT_ID:", publicProjectId);
console.log("Firebase Init: Raw FIREBASE_PROJECT_ID (server fallback):", serverProjectId);

const apiKey = publicApiKey || serverApiKey;
const projectId = publicProjectId || serverProjectId;

console.log("Firebase Init: Effective API Key to be used:", apiKey);
console.log("Firebase Init: Effective Project ID to be used:", projectId);

// Log other necessary config values
console.log("Firebase Init: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
console.log("Firebase Init: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:", process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
console.log("Firebase Init: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:", process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID);
console.log("Firebase Init: NEXT_PUBLIC_FIREBASE_APP_ID:", process.env.NEXT_PUBLIC_FIREBASE_APP_ID);

const firebaseConfig = {
  apiKey: apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log("Firebase Init: Final constructed firebaseConfig object BEFORE check:", JSON.stringify(firebaseConfig, null, 2));

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (getApps().length === 0) {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error("Firebase Init Error: apiKey or projectId is missing in the constructed firebaseConfig. Values found were: apiKey='", firebaseConfig.apiKey, "', projectId='", firebaseConfig.projectId, "'. Check the server logs above this message for details on what process.env contained.");
    throw new Error(
      "Firebase API Key or Project ID is MISSING. \n" +
      "CRITICAL: CHECK YOUR SERVER-SIDE CONSOLE LOGS. \n" +
      "The logs directly above this error message (search for 'Firebase Init:') show the exact values (or lack thereof) being read from your environment. \n" +
      "Ensure NEXT_PUBLIC_FIREBASE_API_KEY (or FIREBASE_API_KEY) and NEXT_PUBLIC_FIREBASE_PROJECT_ID (or FIREBASE_PROJECT_ID) are correctly set. \n" +
      "If using Firebase Studio, verify its environment variable settings. \n" +
      "If using a .env.local file, ensure it's in the project root and the development server has been RESTARTED after any changes to it."
    );
  }

  if (
    !firebaseConfig.authDomain ||
    !firebaseConfig.storageBucket ||
    !firebaseConfig.messagingSenderId ||
    !firebaseConfig.appId
  ) {
    console.warn(
      "Firebase Init Warning: Some non-critical Firebase configuration values (authDomain, storageBucket, messagingSenderId, appId) " +
      "are missing. This might lead to issues with specific Firebase services. " +
      "Current config being used:", JSON.stringify(firebaseConfig, null, 2)
    );
  }
  
  try {
    app = initializeApp(firebaseConfig);
  } catch (initError) {
    console.error("Firebase Init Error: Failed to initialize Firebase App. This usually means some config values are present but invalid (e.g., malformed projectId, authDomain). Error:", initError);
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

    