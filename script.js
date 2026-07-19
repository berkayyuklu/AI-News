/* =================================================================
   SinyalAI — script.js (ana site)
   Bölümler:
   1) Splash ekranı        4) Haber grid render
   2) Firebase / Auth UI    5) Haber detay modalı (beğeni + yorumlar)
   3) Ziyaretçi & tıklama   6) Başlatma
      izleme
   ================================================================= */

import { db } from "./firebase-config.js";
import {
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle,
  logout,
  watchAuthState,
  isUserAdmin,
  translateAuthError,
} from "./auth.js";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* -----------------------------------------------------------------
   0) ÖRNEK VERİ — Firestore boşsa / erişilemezse geçici olarak gösterilir.
   ----------------------------------------------------------------- */
const SAMPLE_NEWS = [
  {
    id: "n1",
    category: "Yapay Zeka",
    title: "Yeni nesil dil modelleri akıl yürütmede sıçrama yaptı",
    summary: "Araştırmacılar, çok adımlı akıl yürütme görevlerinde belirgin bir doğruluk artışı bildirdi.",
    content: "Araştırmacılar, çok adımlı akıl yürütme görevlerinde önceki nesle göre belirgin bir doğruluk artışı bildirdi. Değerlendirme setleri ve sonuçlar makalede detaylandırıldı; özellikle matematik ve kod üretimi kategorilerinde fark daha belirgin.",
    imageUrl: "",
    likeCount: 0,
    clickCount: 0,
    commentCount: 0,
  },
  {
    id: "n2",
    category: "Araçlar",
    title: "Geliştiriciler için açık kaynaklı yeni bir ajan çerçevesi",
    summary: "Çoklu araç çağrısını basitleştiren kütüphane ilk haftasında geniş ilgi gördü.",
    content: "Çoklu araç çağrısını ve durum yönetimini basitleştiren kütüphane, ilk haftasında geniş ilgi gördü ve topluluk katkılarıyla hızla büyüyor. Belgeleri ve örnek şablonları GitHub üzerinden erişilebilir durumda.",
    imageUrl: "",
    likeCount: 0,
    clickCount: 0,
    commentCount: 0,
  },
  {
    id: "n3",
    category: "Araştırma",
    title: "Küçük modellerde verimlilik: eğitim maliyeti nasıl düşürülüyor?",
    summary: "Yeni bir eğitim tekniği, model boyutunu büyütmeden performans artışı sağlıyor.",
    content: "Yeni bir eğitim tekniği, model boyutunu büyütmeden performans artışı sağlıyor. Enerji tüketimi ve donanım gereksinimleri önceki yönteme kıyasla karşılaştırıldı; sonuçlar %30'a varan verimlilik artışına işaret ediyor.",
    imageUrl: "",
    likeCount: 0,
    clickCount: 0,
    commentCount: 0,
  },
];

/* -----------------------------------------------------------------
   1) SPLASH SCREEN
   ----------------------------------------------------------------- */
(function initSplashScreen() {
  const SPLASH_SESSION_KEY = "sinyalai_splash_seen";
  const splashEl = document.getElementById("splash-screen");
  const mainSiteEl = document.getElementById("main-site");
  const enterBtn = document.getElementById("enter-site-btn");

  if (sessionStorage.getItem(SPLASH_SESSION_KEY) === "true") {
    splashEl.remove();
    mainSiteEl.hidden = false;
    return;
  }

  enterBtn.addEventListener("click", () => {
    sessionStorage.setItem(SPLASH_SESSION_KEY, "true");
    splashEl.classList.add("is-leaving");
    mainSiteEl.hidden = false;
    splashEl.addEventListener("transitionend", () => splashEl.remove(), { once: true });
  });
})();

/* -----------------------------------------------------------------
   YARDIMCI: modal aç/kapat
   ----------------------------------------------------------------- */
function openModal(id) {
  document.getElementById(id).hidden = false;
  document.body.classList.add("modal-open");
}
function closeModal(id) {
  document.getElementById(id).hidden = true;
  document.body.classList.remove("modal-open");
}
document.querySelectorAll("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
});
document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});
document.querySelectorAll("[data-open-auth]").forEach((btn) => {
  btn.addEventListener("click", () => openModal("auth-modal"));
});

/* -----------------------------------------------------------------
   2) AUTH UI (giriş / kayıt / google / oturum durumu)
   ----------------------------------------------------------------- */
let currentUser = null;
let currentUserIsAdmin = false;

const openAuthBtn = document.getElementById("open-auth-btn");
const userMenu = document.getElementById("user-menu");
const userMenuTrigger = document.getElementById("user-menu-trigger");
const userMenuDropdown = document.getElementById("user-menu-dropdown");
const userMenuAvatar = document.getElementById("user-menu-avatar");
const userMenuName = document.getElementById("user-menu-name");
const adminLink = document.getElementById("admin-link");
const logoutBtn = document.getElementById("logout-btn");

openAuthBtn.addEventListener("click", () => openModal("auth-modal"));

userMenuTrigger.addEventListener("click", () => {
  userMenuDropdown.hidden = !userMenuDropdown.hidden;
});
document.addEventListener("click", (e) => {
  if (!userMenu.contains(e.target)) userMenuDropdown.hidden = true;
});

logoutBtn.addEventListener("click", async () => {
  await logout();
  userMenuDropdown.hidden = true;
});

// Giriş / Kayıt sekmeleri
const authTabs = document.querySelectorAll("[data-auth-tab]");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

authTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    authTabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const target = tab.dataset.authTab;
    loginForm.hidden = target !== "login";
    registerForm.hidden = target !== "register";
  });
});

function showFormError(form, message) {
  const errorEl = form.querySelector("[data-form-error]");
  errorEl.textContent = message;
  errorEl.hidden = false;
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const { email, password } = Object.fromEntries(new FormData(loginForm));
  try {
    await loginWithEmail(email, password);
    closeModal("auth-modal");
    loginForm.reset();
  } catch (error) {
    showFormError(loginForm, translateAuthError(error));
  }
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const { name, email, password } = Object.fromEntries(new FormData(registerForm));
  try {
    await registerWithEmail(name, email, password);
    closeModal("auth-modal");
    registerForm.reset();
  } catch (error) {
    showFormError(registerForm, translateAuthError(error));
  }
});

document.getElementById("google-auth-btn").addEventListener("click", async () => {
  try {
    await loginWithGoogle();
    closeModal("auth-modal");
  } catch (error) {
    console.error(error);
  }
});

watchAuthState(async (user) => {
  currentUser = user;
  currentUserIsAdmin = user ? await isUserAdmin(user.uid) : false;

  if (user) {
    openAuthBtn.hidden = true;
    userMenu.hidden = false;
    userMenuAvatar.src = user.photoURL || defaultAvatar(user.displayName || user.email);
    userMenuName.textContent = user.displayName || user.email.split("@")[0];
    adminLink.hidden = !currentUserIsAdmin;
  } else {
    openAuthBtn.hidden = false;
    userMenu.hidden = true;
    adminLink.hidden = true;
  }

  updateArticleModalAuthState();
});

function defaultAvatar(seed) {
  const initial = (seed || "?").trim().charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="20" fill="%2322d3ee"/><text x="50%" y="55%" font-family="Inter" font-size="18" fill="%230f172a" text-anchor="middle">${initial}</text></svg>`;
  return `data:image/svg+xml,${svg}`;
}

/* -----------------------------------------------------------------
   3) ZİYARETÇİ & TIKLAMA İZLEME
   Anonim visitorId localStorage'da tutulur; her sayfa açılışında
   "pageViews" koleksiyonuna bir kayıt düşülür. Admin panelindeki
   analiz bu koleksiyonu okuyarak tekil ziyaretçi / günlük trafik
   hesaplar.
   ----------------------------------------------------------------- */
function getVisitorId() {
  const KEY = "sinyalai_visitor_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

async function logPageView() {
  try {
    await addDoc(collection(db, "pageViews"), {
      visitorId: getVisitorId(),
      path: "home",
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn("Ziyaret kaydı oluşturulamadı (Firebase yapılandırmasını kontrol et):", error.message);
  }
}

async function trackNewsClick(newsId) {
  try {
    await updateDoc(doc(db, "news", newsId), { clickCount: increment(1) });
  } catch (error) {
    console.warn("Tıklama sayılamadı:", error.message);
  }
}

/* -----------------------------------------------------------------
   4) HABER GRID RENDER
   ----------------------------------------------------------------- */
async function fetchNews() {
  try {
    const newsQuery = query(collection(db, "news"), orderBy("createdAt", "desc"), limit(30));
    const snapshot = await getDocs(newsQuery);
    if (snapshot.empty) return SAMPLE_NEWS;
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.warn("Firestore'dan haber çekilemedi, örnek veri gösteriliyor:", error.message);
    return SAMPLE_NEWS;
  }
}

function createNewsCard(newsItem) {
  const { id, category, title, summary, imageUrl, likeCount = 0, commentCount = 0 } = newsItem;

  const card = document.createElement("article");
  card.className = "card";

  const imageWrap = document.createElement("div");
  imageWrap.className = "card__image";
  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = title;
    img.loading = "lazy";
    imageWrap.appendChild(img);
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = "card__image-placeholder";
    placeholder.textContent = "GÖRSEL";
    imageWrap.appendChild(placeholder);
  }

  const body = document.createElement("div");
  body.className = "card__body";

  const tag = document.createElement("span");
  tag.className = "card__tag";
  tag.textContent = category;

  const titleEl = document.createElement("h3");
  titleEl.className = "card__title";
  titleEl.textContent = title;

  const summaryEl = document.createElement("p");
  summaryEl.className = "card__summary";
  summaryEl.textContent = summary;

  const metaEl = document.createElement("div");
  metaEl.className = "card__meta";
  metaEl.innerHTML = `<span>♥ ${likeCount}</span><span>💬 ${commentCount}</span>`;

  const linkEl = document.createElement("button");
  linkEl.className = "card__link";
  linkEl.type = "button";
  linkEl.innerHTML = `Devamını Oku <span class="card__link-arrow">→</span>`;
  linkEl.addEventListener("click", () => openArticle(newsItem));

  body.append(tag, titleEl, summaryEl, metaEl, linkEl);
  card.append(imageWrap, body);
  card.addEventListener("click", (e) => {
    if (e.target === linkEl || linkEl.contains(e.target)) return;
    openArticle(newsItem);
  });

  return card;
}

function renderNewsGrid(newsArray) {
  const grid = document.getElementById("news-grid");
  const emptyState = document.getElementById("news-empty");
  grid.innerHTML = "";

  if (!newsArray || newsArray.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  const fragment = document.createDocumentFragment();
  newsArray.forEach((item) => fragment.appendChild(createNewsCard(item)));
  grid.appendChild(fragment);
}

/* -----------------------------------------------------------------
   5) HABER DETAY MODALI — beğeni + yorumlar
   ----------------------------------------------------------------- */
let activeNews = null;
let activeNewsUserLiked = false;

const likeBtn = document.getElementById("like-btn");
const likeCountEl = document.getElementById("like-count");
const commentForm = document.getElementById("comment-form");
const commentInput = document.getElementById("comment-input");
const commentsList = document.getElementById("comments-list");
const commentCountEl = document.getElementById("comment-count");
const commentLoginHint = document.getElementById("comment-login-hint");
const commentTemplate = document.getElementById("comment-template");

async function openArticle(newsItem) {
  activeNews = newsItem;

  document.getElementById("article-tag").textContent = newsItem.category;
  document.getElementById("article-modal-title").textContent = newsItem.title;
  document.getElementById("article-date").textContent = formatDate(newsItem.createdAt);
  document.getElementById("article-content").textContent = newsItem.content || newsItem.summary;

  const imageWrap = document.getElementById("article-image");
  imageWrap.innerHTML = "";
  if (newsItem.imageUrl) {
    const img = document.createElement("img");
    img.src = newsItem.imageUrl;
    img.alt = newsItem.title;
    imageWrap.appendChild(img);
  } else {
    imageWrap.remove();
  }

  likeCountEl.textContent = newsItem.likeCount || 0;
  updateArticleModalAuthState();

  openModal("article-modal");

  // Gerçek Firestore dokümanları için tıklama sayacı ve yorumlar
  if (!String(newsItem.id).startsWith("n")) {
    trackNewsClick(newsItem.id);
  }
  await Promise.all([checkIfLiked(newsItem.id), loadComments(newsItem.id)]);
}

function updateArticleModalAuthState() {
  const loggedIn = !!currentUser;
  commentForm.hidden = !loggedIn;
  commentLoginHint.hidden = loggedIn;
  likeBtn.disabled = !loggedIn;
}

async function checkIfLiked(newsId) {
  activeNewsUserLiked = false;
  likeBtn.classList.remove("is-liked");
  if (!currentUser) return;
  try {
    const likeRef = doc(db, "newsLikes", `${newsId}_${currentUser.uid}`);
    const snap = await getDoc(likeRef);
    activeNewsUserLiked = snap.exists();
    likeBtn.classList.toggle("is-liked", activeNewsUserLiked);
  } catch (error) {
    console.warn("Beğeni durumu okunamadı:", error.message);
  }
}

likeBtn.addEventListener("click", async () => {
  if (!currentUser || !activeNews) return;
  const newsId = activeNews.id;
  const likeRef = doc(db, "newsLikes", `${newsId}_${currentUser.uid}`);
  const newsRef = doc(db, "news", newsId);

  try {
    if (activeNewsUserLiked) {
      await deleteDoc(likeRef);
      await updateDoc(newsRef, { likeCount: increment(-1) });
      likeCountEl.textContent = Math.max(0, Number(likeCountEl.textContent) - 1);
    } else {
      await setDoc(likeRef, { newsId, uid: currentUser.uid, createdAt: serverTimestamp() });
      await updateDoc(newsRef, { likeCount: increment(1) });
      likeCountEl.textContent = Number(likeCountEl.textContent) + 1;
    }
    activeNewsUserLiked = !activeNewsUserLiked;
    likeBtn.classList.toggle("is-liked", activeNewsUserLiked);
  } catch (error) {
    console.warn("Beğeni işlenemedi (örnek veri Firestore'da olmayabilir):", error.message);
  }
});

/* --- Yorumlar --- */
async function loadComments(newsId) {
  commentsList.innerHTML = "";
  let comments = [];
  try {
    const q = query(collection(db, "comments"), where("newsId", "==", newsId), orderBy("createdAt", "asc"));
    const snapshot = await getDocs(q);
    comments = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.warn("Yorumlar yüklenemedi:", error.message);
  }

  commentCountEl.textContent = `${comments.length} yorum`;

  const topLevel = comments.filter((c) => !c.parentId);
  const repliesByParent = comments.reduce((acc, c) => {
    if (c.parentId) {
      acc[c.parentId] = acc[c.parentId] || [];
      acc[c.parentId].push(c);
    }
    return acc;
  }, {});

  topLevel.forEach((comment) => {
    commentsList.appendChild(renderComment(comment, repliesByParent[comment.id] || []));
  });
}

function renderComment(comment, replies) {
  const node = commentTemplate.content.cloneNode(true);
  const el = node.querySelector(".comment");

  el.dataset.commentId = comment.id;
  if (comment.authorRole === "admin") el.classList.add("comment--admin");

  el.querySelector(".comment__avatar").src = comment.authorPhotoURL || defaultAvatar(comment.authorName);
  el.querySelector(".comment__author").textContent = comment.authorName + (comment.authorRole === "admin" ? " · Admin" : "");
  el.querySelector(".comment__date").textContent = formatDate(comment.createdAt);
  el.querySelector(".comment__text").textContent = comment.text;
  el.querySelector(".comment__like-count").textContent = comment.likeCount || 0;

  const likeButton = el.querySelector(".comment__like-btn");
  likeButton.addEventListener("click", () => toggleCommentLike(comment.id, likeButton));

  const replyButton = el.querySelector(".comment__reply-btn");
  const replyForm = el.querySelector(".comment__reply-form");
  replyButton.addEventListener("click", () => {
    if (!currentUser) { openModal("auth-modal"); return; }
    replyForm.hidden = !replyForm.hidden;
  });
  replyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const textarea = replyForm.querySelector("textarea");
    await submitComment(textarea.value, comment.id);
    textarea.value = "";
    replyForm.hidden = true;
  });

  const repliesWrap = el.querySelector(".comment__replies");
  replies.forEach((reply) => repliesWrap.appendChild(renderComment(reply, [])));

  return node;
}

async function toggleCommentLike(commentId, buttonEl) {
  if (!currentUser) { openModal("auth-modal"); return; }
  const likeRef = doc(db, "commentLikes", `${commentId}_${currentUser.uid}`);
  const commentRef = doc(db, "comments", commentId);
  const countEl = buttonEl.querySelector(".comment__like-count");

  try {
    const existing = await getDoc(likeRef);
    if (existing.exists()) {
      await deleteDoc(likeRef);
      await updateDoc(commentRef, { likeCount: increment(-1) });
      countEl.textContent = Math.max(0, Number(countEl.textContent) - 1);
      buttonEl.classList.remove("is-liked");
    } else {
      await setDoc(likeRef, { commentId, uid: currentUser.uid, createdAt: serverTimestamp() });
      await updateDoc(commentRef, { likeCount: increment(1) });
      countEl.textContent = Number(countEl.textContent) + 1;
      buttonEl.classList.add("is-liked");
    }
  } catch (error) {
    console.warn("Yorum beğenisi işlenemedi:", error.message);
  }
}

async function submitComment(text, parentId = null) {
  if (!currentUser || !activeNews || !text.trim()) return;
  try {
    await addDoc(collection(db, "comments"), {
      newsId: activeNews.id,
      parentId,
      text: text.trim(),
      authorUid: currentUser.uid,
      authorName: currentUser.displayName || currentUser.email.split("@")[0],
      authorPhotoURL: currentUser.photoURL || "",
      authorRole: currentUserIsAdmin ? "admin" : "user",
      likeCount: 0,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "news", activeNews.id), { commentCount: increment(1) });
    await loadComments(activeNews.id);
  } catch (error) {
    console.warn("Yorum gönderilemedi (örnek veri Firestore'da olmayabilir):", error.message);
  }
}

commentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await submitComment(commentInput.value);
  commentInput.value = "";
});

function formatDate(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

/* -----------------------------------------------------------------
   6) BAŞLATMA
   ----------------------------------------------------------------- */
async function initNewsFeed() {
  const news = await fetchNews();
  renderNewsGrid(news);
}

document.addEventListener("DOMContentLoaded", () => {
  initNewsFeed();
  logPageView();
});
