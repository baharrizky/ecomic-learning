import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB8N6b0R_xlodysKuVABXPBePqM-g15p8Q",
  authDomain: "ecomic-learning.firebaseapp.com",
  projectId: "ecomic-learning",
  storageBucket: "ecomic-learning.firebasestorage.app",
  messagingSenderId: "591974735194",
  appId: "1:591974735194:web:cb58f42d4fde88cd9ca763",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);