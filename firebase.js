import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCyArj4yRlEl-yibkc0VEmL_4UJpRHHQSc",
  authDomain: "liga-goiana-base.firebaseapp.com",
  projectId: "liga-goiana-base",
  storageBucket: "liga-goiana-base.firebasestorage.app",
  messagingSenderId: "952863591183",
  appId: "1:952863591183:web:4eea34f494ba2dd754cc7a"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
