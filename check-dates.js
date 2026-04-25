const admin = require("firebase-admin");

// Initialize Firebase Admin (assuming default credentials or emulator)
// To keep it simple, I'll log what's in Firestore for registrations.
const serviceAccount = require("./firebase-service-account.json"); // Assuming there's some way to access DB, wait, the project uses the Firebase client.
