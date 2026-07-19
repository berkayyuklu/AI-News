/* =================================================================
   firebase-config.js
   Firebase Console > Proje Ayarları > "Web uygulaması ekle" bölümünden
   aldığın bilgileri aşağıya yapıştır. Bu dosya index.html, admin.html,
   script.js, auth.js ve admin.js tarafından ortak kullanılır.
   ================================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ⬇️ BURAYI KENDİ FIREBASE PROJE BİLGİLERİNLE DEĞİŞTİR ⬇️
const firebaseConfig = {
  apiKey: "AIzaSyBXgrb2RuOvgOwQdIUa2awmweyZ_Z3wPhI",
  authDomain: "ainews-3b4cf.firebaseapp.com",
  projectId: "ainews-3b4cf",
  storageBucket: "ainews-3b4cf.firebasestorage.app",
  messagingSenderId: "136986808706",
  appId: "1:136986808706:web:da911d1f3aa4ea6f613f9b",
  measurementId: "G-1MY3D3C9LJ"
};
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
