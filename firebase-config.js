import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  enableMultiTabIndexedDbPersistence 
} from "firebase/firestore";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCwOFH194Ouqq4xP78S0yYj9IKgdkiqnTg",
  authDomain: "journalme-84dd0.firebaseapp.com",
  projectId: "journalme-84dd0",
  storageBucket: "journalme-84dd0.firebasestorage.app",
  messagingSenderId: "733700744776",
  appId: "1:733700744776:web:eb78d59bceee1aea7c9a7d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const messaging = getMessaging(app);

// Enable Local Caching / Offline Persistence
enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time.
        console.warn("Firestore persistence failed: Multiple tabs open.");
    } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn("Firestore persistence is not supported by this browser.");
    }
});