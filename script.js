/* =================================================================
   SinyalAI — script.js
   Yapı: 1) Splash ekranı  2) Örnek veri  3) Render fonksiyonları
         4) Firebase'e geçişe hazır veri katmanı  5) Başlatma
   ================================================================= */

/* -----------------------------------------------------------------
   1) SPLASH SCREEN
   sessionStorage kullanılarak aynı oturum içinde tekrar gösterilmez.
   ----------------------------------------------------------------- */
(function initSplashScreen() {
  const SPLASH_SESSION_KEY = "sinyalai_splash_seen";

  const splashEl = document.getElementById("splash-screen");
  const mainSiteEl = document.getElementById("main-site");
  const enterBtn = document.getElementById("enter-site-btn");

  const alreadySeen = sessionStorage.getItem(SPLASH_SESSION_KEY) === "true";

  if (alreadySeen) {
    // Bu oturumda splash zaten görüldü: doğrudan ana siteyi göster.
    splashEl.remove();
    mainSiteEl.hidden = false;
    return;
  }

  enterBtn.addEventListener("click", () => {
    sessionStorage.setItem(SPLASH_SESSION_KEY, "true");

    splashEl.classList.add("is-leaving");
    mainSiteEl.hidden = false;

    // CSS geçişi bitince splash'i DOM'dan tamamen kaldır.
    splashEl.addEventListener(
      "transitionend",
      () => splashEl.remove(),
      { once: true }
    );
  });
})();

/* -----------------------------------------------------------------
   2) ÖRNEK VERİ (Geçici)
   Bu dizi ileride Firebase Firestore'daki "news" koleksiyonundan
   getDocs() ile çekilecek verinin yerini şimdilik tutuyor.
   Alan adları Firestore doküman yapısıyla birebir eşleşecek şekilde
   seçildi: id, category, title, summary, imageUrl, link, publishedAt
   ----------------------------------------------------------------- */
const SAMPLE_NEWS = [
  {
    id: "n1",
    category: "Yapay Zeka",
    title: "Yeni nesil dil modelleri akıl yürütmede sıçrama yaptı",
    summary:
      "Araştırmacılar, çok adımlı akıl yürütme görevlerinde önceki nesle göre belirgin bir doğruluk artışı bildirdi. Değerlendirme setleri ve sonuçlar detaylandırıldı.",
    imageUrl: "",
    link: "#",
    publishedAt: "2026-07-18",
  },
  {
    id: "n2",
    category: "Araçlar",
    title: "Geliştiriciler için açık kaynaklı yeni bir ajan çerçevesi",
    summary:
      "Çoklu araç çağrısını ve durum yönetimini basitleştiren kütüphane, ilk haftasında geniş ilgi gördü ve topluluk katkılarıyla hızla büyüyor.",
    imageUrl: "",
    link: "#",
    publishedAt: "2026-07-17",
  },
  {
    id: "n3",
    category: "Araştırma",
    title: "Küçük modellerde verimlilik: eğitim maliyeti nasıl düşürülüyor?",
    summary:
      "Yeni bir eğitim tekniği, model boyutunu büyütmeden performans artışı sağlıyor. Enerji tüketimi ve donanım gereksinimleri karşılaştırıldı.",
    imageUrl: "",
    link: "#",
    publishedAt: "2026-07-16",
  },
  {
    id: "n4",
    category: "Endüstri",
    title: "Üretim hatlarında görüntü tabanlı kalite kontrol yaygınlaşıyor",
    summary:
      "Fabrikalar, hatalı ürün tespitinde insan gözünden daha tutarlı sonuçlar veren görüntü işleme sistemlerine geçiş yapıyor.",
    imageUrl: "",
    link: "#",
    publishedAt: "2026-07-15",
  },
  {
    id: "n5",
    category: "Yapay Zeka",
    title: "Çok modlu sistemler ses, görüntü ve metni tek akışta işliyor",
    summary:
      "Yeni mimariler, farklı veri türlerini ayrı ayrı işlemek yerine ortak bir temsile dönüştürerek gecikmeyi azaltıyor.",
    imageUrl: "",
    link: "#",
    publishedAt: "2026-07-14",
  },
  {
    id: "n6",
    category: "Araçlar",
    title: "Kod inceleme sürecini hızlandıran yeni bir eklenti yayında",
    summary:
      "Eklenti, olası hataları ve güvenlik açıklarını inceleme aşamasından önce işaretleyerek geliştirme döngüsünü kısaltıyor.",
    imageUrl: "",
    link: "#",
    publishedAt: "2026-07-13",
  },
];

/* -----------------------------------------------------------------
   3) RENDER FONKSİYONLARI
   Kartlar HTML'e elle yazılmaz; bu fonksiyonlar veri dizisini alıp
   DOM'a basar. Veri kaynağı örnek dizi de olsa, Firestore de olsa
   aynı fonksiyonlar kullanılır.
   ----------------------------------------------------------------- */

/**
 * Tek bir haber öğesinden kart (article) elementi üretir.
 * @param {Object} newsItem
 * @returns {HTMLElement}
 */
function createNewsCard(newsItem) {
  const { category, title, summary, imageUrl, link } = newsItem;

  const card = document.createElement("article");
  card.className = "card";

  // Görsel alanı
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

  // İçerik alanı
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

  const linkEl = document.createElement("a");
  linkEl.className = "card__link";
  linkEl.href = link || "#";
  linkEl.innerHTML = `Devamını Oku <span class="card__link-arrow">→</span>`;

  body.append(tag, titleEl, summaryEl, linkEl);
  card.append(imageWrap, body);

  return card;
}

/**
 * Haber dizisini #news-grid içine basar.
 * Firestore'dan gelecek veri de bu fonksiyona verilecek şekilde tasarlandı.
 * @param {Array<Object>} newsArray
 */
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
   4) FIREBASE FIRESTORE'A GEÇİŞE HAZIR VERİ KATMANI
   Şu an örnek diziyi döndürüyor. Firestore bağlanınca aşağıdaki
   yorum satırındaki blok ile fonksiyonun gövdesi değiştirilecek;
   renderNewsGrid() ve createNewsCard() hiç değişmeden çalışmaya
   devam edecek.
   ----------------------------------------------------------------- */

/**
 * Haber verisini getirir. Şimdilik örnek diziyi Promise olarak sarar,
 * böylece ileride async Firestore çağrısına geçiş sorunsuz olur.
 * @returns {Promise<Array<Object>>}
 */
async function fetchNews() {
  // --- ŞİMDİKİ DURUM (örnek veri) -------------------------------
  return Promise.resolve(SAMPLE_NEWS);

  /* --- FIREBASE FIRESTORE'A GEÇİLDİĞİNDE (örnek) -----------------
  import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
  import { db } from "./firebase-config.js";

  const newsQuery = query(
    collection(db, "news"),
    orderBy("publishedAt", "desc"),
    limit(30)
  );

  const snapshot = await getDocs(newsQuery);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  ------------------------------------------------------------------ */
}

/* -----------------------------------------------------------------
   5) BAŞLATMA
   ----------------------------------------------------------------- */
async function initNewsFeed() {
  try {
    const news = await fetchNews();
    renderNewsGrid(news);
  } catch (error) {
    console.error("Haberler yüklenirken bir hata oluştu:", error);
    renderNewsGrid([]);
  }
}

document.addEventListener("DOMContentLoaded", initNewsFeed);
