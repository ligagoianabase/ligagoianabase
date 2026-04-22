import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJ5kD9ywOulWbd-_QBeoc2mmaVfFRBIkM",
  authDomain: "liga-goiana-base-3e446.firebaseapp.com",
  projectId: "liga-goiana-base-3e446",
  storageBucket: "liga-goiana-base-3e446.firebasestorage.app",
  messagingSenderId: "130295368046",
  appId: "1:130295368046:web:94d24f980680849677997f"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
