/* =================================================================
   auth.js
   index.html (script.js üzerinden) ve admin.html (admin.js üzerinden)
   tarafından ortak kullanılan kimlik doğrulama katmanı.
   ================================================================= */

import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const googleProvider = new GoogleAuthProvider();

/**
 * users/{uid} dokümanı yoksa oluşturur. Varsa rolüne dokunmaz
 * (böylece bir kullanıcıyı admin yaptıktan sonra tekrar giriş
 * yaptığında rolü "user"a geri dönmez).
 */
async function ensureUserDocument(user, extra = {}) {
  const userRef = doc(db, "users", user.uid);
  const existing = await getDoc(userRef);

  if (!existing.exists()) {
    await setDoc(userRef, {
      name: user.displayName || extra.name || "İsimsiz Kullanıcı",
      email: user.email,
      photoURL: user.photoURL || "",
      role: "user", // Admin yetkisi Firestore konsolundan elle "admin" yapılır.
      createdAt: serverTimestamp(),
    });
  }
}

export async function registerWithEmail(name, email, password) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: name });
  await ensureUserDocument(credential.user, { name });
  return credential.user;
}

export async function loginWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function loginWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  await ensureUserDocument(credential.user);
  return credential.user;
}

export function logout() {
  return signOut(auth);
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

/** users/{uid} dokümanını döndürür (role, name, photoURL vb.) */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function isUserAdmin(uid) {
  const profile = await getUserProfile(uid);
  return profile?.role === "admin";
}

/** Türkçe okunur hata mesajları için basit çeviri. */
export function translateAuthError(error) {
  const code = error?.code || "";
  const map = {
    "auth/invalid-email": "Geçersiz e-posta adresi.",
    "auth/user-not-found": "Bu e-posta ile kayıtlı kullanıcı bulunamadı.",
    "auth/wrong-password": "Şifre hatalı.",
    "auth/invalid-credential": "E-posta veya şifre hatalı.",
    "auth/email-already-in-use": "Bu e-posta zaten kayıtlı.",
    "auth/weak-password": "Şifre en az 6 karakter olmalı.",
    "auth/popup-closed-by-user": "Google girişi penceresi kapatıldı.",
  };
  return map[code] || "Bir hata oluştu. Lütfen tekrar deneyin.";
}
