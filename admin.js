/* =================================================================
   admin.js
   Sadece Firestore'daki users/{uid}.role alanı "admin" olan
   kullanıcılar bu sayfanın içeriğini görebilir. Erişim kontrolü
   istemci tarafında yapılır; gerçek güvenlik Firestore Security
   Rules ile sağlanmalıdır (bkz. firestore.rules).
   ================================================================= */

import { db } from "./firebase-config.js";
import { watchAuthState, logout, isUserAdmin } from "./auth.js";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const gate = document.getElementById("admin-gate");
const gateMessage = document.getElementById("admin-gate-message");
const app = document.getElementById("admin-app");

document.getElementById("admin-logout-btn").addEventListener("click", () => logout());

/* -----------------------------------------------------------------
   ERİŞİM KONTROLÜ
   ----------------------------------------------------------------- */
watchAuthState(async (user) => {
  if (!user) {
    gateMessage.textContent = "Bu sayfayı görüntülemek için giriş yapmalısın.";
    return;
  }
  const admin = await isUserAdmin(user.uid);
  if (!admin) {
    gateMessage.textContent = "Bu sayfaya erişim yetkin yok.";
    return;
  }

  gate.hidden = true;
  app.hidden = false;
  initAdminDashboard();
});

/* -----------------------------------------------------------------
   MODAL YARDIMCI
   ----------------------------------------------------------------- */
function openModal(id) { document.getElementById(id).hidden = false; }
function closeModal(id) { document.getElementById(id).hidden = true; }
document.querySelectorAll("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
});

/* -----------------------------------------------------------------
   PANEL BAŞLATMA — tek seferlik yükleme
   ----------------------------------------------------------------- */
let dashboardLoaded = false;

async function initAdminDashboard() {
  if (dashboardLoaded) return;
  dashboardLoaded = true;

  const [newsList, commentsList, pageViews] = await Promise.all([
    fetchAllNews(),
    fetchAllComments(),
    fetchAllPageViews(),
  ]);

  renderStats(newsList, commentsList, pageViews);
  renderClicksChart(newsList);
  renderVisitorsChart(pageViews);
  renderNewsTable(newsList);
}

async function fetchAllNews() {
  const snap = await getDocs(collection(db, "news"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function fetchAllComments() {
  const snap = await getDocs(collection(db, "comments"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function fetchAllPageViews() {
  const snap = await getDocs(collection(db, "pageViews"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* -----------------------------------------------------------------
   İSTATİSTİK KARTLARI
   ----------------------------------------------------------------- */
function renderStats(newsList, commentsList, pageViews) {
  document.getElementById("stat-news").textContent = newsList.length;
  document.getElementById("stat-comments").textContent = commentsList.length;
  document.getElementById("stat-likes").textContent = newsList.reduce((sum, n) => sum + (n.likeCount || 0), 0);
  document.getElementById("stat-clicks").textContent = newsList.reduce((sum, n) => sum + (n.clickCount || 0), 0);

  const uniqueVisitors = new Set(pageViews.map((v) => v.visitorId));
  document.getElementById("stat-visitors").textContent = uniqueVisitors.size;
}

/* -----------------------------------------------------------------
   GRAFİKLER
   ----------------------------------------------------------------- */
const CHART_COLORS = { cyan: "#22d3ee", purple: "#a855f7", grid: "#2d3d54", text: "#94a3b8" };

function renderClicksChart(newsList) {
  const top = [...newsList].sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0)).slice(0, 10);
  const ctx = document.getElementById("clicks-chart");

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: top.map((n) => truncate(n.title, 18)),
      datasets: [{
        label: "Tıklama",
        data: top.map((n) => n.clickCount || 0),
        backgroundColor: CHART_COLORS.cyan,
        borderRadius: 6,
      }],
    },
    options: chartBaseOptions(),
  });
}

function renderVisitorsChart(pageViews) {
  const days = lastNDaysLabels(7);
  const countsByDay = days.map((day) => {
    const visitorsThatDay = new Set(
      pageViews
        .filter((v) => v.createdAt && dayKey(v.createdAt.toDate()) === day.key)
        .map((v) => v.visitorId)
    );
    return visitorsThatDay.size;
  });

  const ctx = document.getElementById("visitors-chart");
  new Chart(ctx, {
    type: "line",
    data: {
      labels: days.map((d) => d.label),
      datasets: [{
        label: "Tekil Ziyaretçi",
        data: countsByDay,
        borderColor: CHART_COLORS.purple,
        backgroundColor: "rgba(168, 85, 247, 0.15)",
        fill: true,
        tension: 0.35,
        pointBackgroundColor: CHART_COLORS.purple,
      }],
    },
    options: chartBaseOptions(),
  });
}

function chartBaseOptions() {
  return {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: CHART_COLORS.text }, grid: { color: CHART_COLORS.grid } },
      y: { ticks: { color: CHART_COLORS.text }, grid: { color: CHART_COLORS.grid }, beginAtZero: true },
    },
  };
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}
function lastNDaysLabels(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({ key: dayKey(d), label: d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }) });
  }
  return out;
}
function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

/* -----------------------------------------------------------------
   HABER YÖNETİMİ — liste, ekle, düzenle, sil
   ----------------------------------------------------------------- */
const tableBody = document.getElementById("news-table-body");
const newsForm = document.getElementById("news-form");
const newsFormTitle = document.getElementById("news-form-title");

document.getElementById("new-news-btn").addEventListener("click", () => {
  newsForm.reset();
  newsForm.elements.id.value = "";
  newsFormTitle.textContent = "Yeni Haber";
  openModal("news-form-modal");
});

function renderNewsTable(newsList) {
  tableBody.innerHTML = "";
  newsList
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .forEach((news) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(news.title)}</td>
        <td><span class="card__tag">${escapeHtml(news.category)}</span></td>
        <td>${news.clickCount || 0}</td>
        <td>${news.likeCount || 0}</td>
        <td>${news.commentCount || 0}</td>
        <td class="admin-table__actions">
          <button class="link-btn" data-edit="${news.id}">Düzenle</button>
          <button class="link-btn link-btn--danger" data-delete="${news.id}">Sil</button>
        </td>
      `;
      tableBody.appendChild(row);
    });

  tableBody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => editNews(btn.dataset.edit, newsList));
  });
  tableBody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteNews(btn.dataset.delete));
  });
}

function editNews(id, newsList) {
  const news = newsList.find((n) => n.id === id);
  if (!news) return;
  newsFormTitle.textContent = "Haberi Düzenle";
  newsForm.elements.id.value = news.id;
  newsForm.elements.title.value = news.title || "";
  newsForm.elements.category.value = news.category || "";
  newsForm.elements.summary.value = news.summary || "";
  newsForm.elements.content.value = news.content || "";
  newsForm.elements.imageUrl.value = news.imageUrl || "";
  openModal("news-form-modal");
}

async function deleteNews(id) {
  if (!confirm("Bu haberi silmek istediğine emin misin? Bu işlem geri alınamaz.")) return;
  await deleteDoc(doc(db, "news", id));
  refreshAfterChange();
}

newsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(newsForm));
  const errorEl = newsForm.querySelector("[data-form-error]");
  errorEl.hidden = true;

  try {
    if (data.id) {
      await updateDoc(doc(db, "news", data.id), {
        title: data.title,
        category: data.category,
        summary: data.summary,
        content: data.content,
        imageUrl: data.imageUrl || "",
        updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(collection(db, "news"), {
        title: data.title,
        category: data.category,
        summary: data.summary,
        content: data.content,
        imageUrl: data.imageUrl || "",
        clickCount: 0,
        likeCount: 0,
        commentCount: 0,
        createdAt: serverTimestamp(),
      });
    }
    closeModal("news-form-modal");
    refreshAfterChange();
  } catch (error) {
    errorEl.textContent = "Kaydedilemedi: " + error.message;
    errorEl.hidden = false;
  }
});

async function refreshAfterChange() {
  dashboardLoaded = false;
  const tableSection = document.getElementById("news-table-body");
  tableSection.innerHTML = "<tr><td colspan='6'>Güncelleniyor…</td></tr>";
  await initAdminDashboard();
}

function escapeHtml(str = "") {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
