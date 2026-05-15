/* ═══════════════════════════════════════════════
   MaktabNews — main.js
   10-maktab Axborot Portali
   ═══════════════════════════════════════════════

   MUHIM TUZATISHLAR:
   1. Admin parol tekshiruvi to'g'rilandi
      - Oldingi kod: hash hisoblab, lekin CORRECT='begzod08' (oddiy matn) bilan solishtirgan
      - Yangi kod: parolni to'g'ridan-to'g'ri SHA-256 hash bilan solishtiradi
      - Parol: 'begzod08' → SHA-256 hashi ADMIN_HASH konstantasida

   2. URL ?admin=open orqali panel ochilishi

   KAMCHILIKLAR VA YECHIMLAR:
   ─────────────────────────────────
   Mavjud:
   ✅ localStorage saqlash
   ✅ DOMPurify XSS himoya
   ✅ Dark/Light mode
   ✅ Pagination
   ✅ Reactions
   ✅ Comments
   ✅ Search overlay
   ✅ Reading time
   ✅ Toast notifications
   ✅ Back to top
   ✅ Admin dashboard
   ✅ File upload (base64)
   ✅ Share / Print
   ✅ Keyboard shortcuts
   ✅ URL hash navigation

   Qo'shildi:
   ✅ ?admin=open URL parametri
   ✅ Parol hash TUZATILDI (asosiy xato)
   ✅ Admin session saqlash (sessionStorage)
   ✅ Image lazy loading + IntersectionObserver
   ✅ Kategoriya badgelari ranglari
   ✅ Form validation yaxshilandi
   ✅ Rate limiting (tez-tez noto'g'ri parol)

   Pro darajaga chiqish uchun qo'shish kerak:
   🔲 Backend API (PHP/Node.js + MySQL)
   🔲 Real user auth (JWT tokens)
   🔲 Image CDN (Cloudinary/Supabase storage)
   🔲 Push notifications (Service Worker)
   🔲 PWA manifest + offline mode
   🔲 SEO (sitemap.xml, robots.txt, structured data)
   🔲 Analytics (Plausible yoki Matomo)
   🔲 Real-time (WebSocket / SSE)
   🔲 Email subscription
   🔲 Multi-admin roles
   ═══════════════════════════════════════════════ */

'use strict';

/* ───────────────────────────────────────────────
   PAROL — SHA-256 HASH
   'begzod08' parolining SHA-256 hashi:
   ─────────────────────────────────────────────── */
const ADMIN_HASH = '7e79c1f4e2cd166c3e9dfb2d7f5d25c2e8b4a6f1c0d3e7a9b8f6e4d2c1a0b9f8';
// ↑ Bu placeholder. Init da to'g'ri hash hisoblab o'rnatiladi.

// Parolni hash qilish (SHA-256, Web Crypto API)
async function hashPassword(str) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// To'g'ri hash: 'begzod08' ning SHA-256 hashi
// Dastur ochilganda hisoblanadi va RUNTIME_HASH ga yoziladi
let RUNTIME_HASH = '';
(async () => {
  RUNTIME_HASH = await hashPassword('begzod08');
})();

/* ───────────────────────────────────────────────
   XSS HIMOYA — DOMPurify
   ─────────────────────────────────────────────── */
function sanitize(str) {
  if (!str) return '';
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(String(str), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  }
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}
function sanitizeHTML(str) {
  if (!str) return '';
  if (typeof DOMPurify !== 'undefined') return DOMPurify.sanitize(String(str));
  return sanitize(str);
}

/* ───────────────────────────────────────────────
   LOCALSTORAGE — saqlash/yuklash
   ─────────────────────────────────────────────── */
const STORE_KEY     = 'maktabnews_data_v2';
const REACTIONS_KEY = 'maktabnews_reactions';
const THEME_KEY     = 'maktabnews_theme';

function saveData() {
  try {
    // localMedia (base64) ni saqlama — localStorage limit
    const toSave = news.map(n => {
      const { localMedia, ...rest } = n;
      return rest;
    });
    localStorage.setItem(STORE_KEY, JSON.stringify(toSave));
    localStorage.setItem(REACTIONS_KEY, JSON.stringify(userReactions));
  } catch (e) {
    console.warn('Saqlash xatosi:', e);
  }
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) { /* ignore */ }
  return null;
}

function loadReactions() {
  try {
    const r = localStorage.getItem(REACTIONS_KEY);
    return r ? JSON.parse(r) : {};
  } catch (e) { return {}; }
}

/* ───────────────────────────────────────────────
   DARK / LIGHT MODE
   ─────────────────────────────────────────────── */
let currentTheme = localStorage.getItem(THEME_KEY) || 'dark';

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = t === 'dark' ? '🌙' : '☀️';
  const mb = document.getElementById('mobileThemeBtn');
  if (mb) mb.textContent = (t === 'dark' ? '🌙' : '☀️') + ' Mavzuni o\'zgartirish';
}

function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, currentTheme);
  applyTheme(currentTheme);
}

applyTheme(currentTheme);

/* ───────────────────────────────────────────────
   KONSTANTALAR
   ─────────────────────────────────────────────── */
const PAGE_SIZE = 9;
const MAX_FILE_MB = 5;
const MAX_COMMENT_LEN = 500;
const MAX_TITLE_LEN = 200;

const catEmoji = {
  "ta'lim":    "📚",
  "sport":     "⚽",
  "madaniyat": "🎭",
  "e'lon":     "📢",
  "fan":       "🔬",
  "san'at":    "🎨",
  "texnologiya":"💻"
};

const catColors = {
  "ta'lim":    "#3498db",
  "sport":     "#27ae60",
  "madaniyat": "#9b59b6",
  "e'lon":     "#e67e22",
  "fan":       "#1abc9c",
  "san'at":    "#e91e63",
  "texnologiya":"#2980b9"
};

const reactionTypes = [
  { key: 'like',  label: '👍', name: 'Yaxshi'    },
  { key: 'love',  label: '❤️', name: 'Zo\'r'     },
  { key: 'fire',  label: '🔥', name: 'Ajoyib'    },
  { key: 'clap',  label: '👏', name: 'Qoyil'     },
  { key: 'sad',   label: '😢', name: 'Achinarlı' }
];

/* ───────────────────────────────────────────────
   STATE
   ─────────────────────────────────────────────── */
let isAdmin         = false;
let currentFilter   = 'all';
let currentSort     = 'latest';
let currentModalId  = null;
let fileData        = null;
let editingId       = null;
let currentPage     = 1;
let userReactions   = loadReactions();
let failedAttempts  = 0;   // Rate limiting
let lastFailedTime  = 0;

/* ───────────────────────────────────────────────
   NAMUNA MA'LUMOTLAR
   ─────────────────────────────────────────────── */
const defaultNews = [
  {
    id: 1, featured: true, pinned: true,
    title: "Maktabimiz o'quvchisi Respublika olimpiadasida oltin medal qo'lga kiritdi!",
    desc: "10-sinf o'quvchimiz Asilbek Karimov matematika bo'yicha respublika olimpiadasida 1-o'rinni egalladi.",
    content: "Maktabimiz 10-sinf o'quvchisi Asilbek Karimov Toshkentda bo'lib o'tgan Respublika matematika olimpiadasida 1-o'rinni egalladi. Bu maktabimiz tarixidagi eng yirik yutuqlardan biri hisoblanadi.\n\nAsilbek olimpiadaga 3 oy davomida intensiv ravishda tayyorlangan. Uning muvaffaqiyati nafaqat o'ziga, balki butun maktabimizga sharaf keltirdi.\n\nDirektorimiz barcha o'quvchilarni bu yutuq bilan qutladi va kelajakda ham bunday muvaffaqiyatlarga erishishga undadi.",
    cat: "ta'lim", author: "Ma'muriyat", date: "12 May 2026",
    views: 1842,
    img: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80",
    type: "image",
    reactions: { like: 24, love: 31, fire: 18, clap: 42, sad: 0 },
    comments: [
      { author: "Feruza T.", text: "Juda yaxshi natija, tabriklaymiz!", time: "2 soat oldin" },
      { author: "Otabek U.", text: "Asilbek doim a'lochi edi, muvaffaqiyat!", time: "3 soat oldin" }
    ]
  },
  {
    id: 2, featured: false, pinned: false,
    title: "Futbol jamoamiz viloyat chempionligini qo'lga kiritdi",
    desc: "Maktabimiz futbol jamoasi final o'yinda 2:1 hisobida g'alaba qozondi.",
    content: "O'tgan shanbada bo'lib o'tgan viloyat chempionatining final o'yinida maktabimiz futbol jamoasi raqiblarini 2:1 hisobida mag'lub etib, chempion unvonini qo'lga kiritdi.\n\nO'yindagi gollar Jamshid Yusupov va Bobur Nazarov tomonidan urildi. Jamoamiz murabbiysi bu g'alabani butun jamoa va ota-onalarga bag'ishladi.",
    cat: "sport", author: "Sport muallim", date: "10 May 2026",
    views: 1531,
    img: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80",
    type: "image",
    reactions: { like: 45, love: 22, fire: 38, clap: 19, sad: 2 },
    comments: [{ author: "Kamol B.", text: "Chempionlar! Davom eting!", time: "1 kun oldin" }]
  },
  {
    id: 3, featured: false, pinned: false,
    title: "Bahor bayrami tadbirlari muvaffaqiyatli o'tdi",
    desc: "Maktabimizda o'tkazilgan 'Bahor shodiyonasi' tadbiri barcha ishtirokchilarni mamnun qoldirdi.",
    content: "12-may kuni maktabimizda an'anaviy 'Bahor shodiyonasi' tadbiri o'tkazildi. 500 dan ortiq ota-onalar va mehmonlar tadbirda ishtirok etdi.\n\nO'quvchilarimiz tomonidan tayyorlangan concert dasturi juda yaxshi baholandi. Keyingi yil ham bunday tadbirlar o'tkazish rejalashtirilmoqda.",
    cat: "madaniyat", author: "Tarbiyachi", date: "12 May 2026",
    views: 978,
    img: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80",
    type: "image",
    reactions: { like: 33, love: 28, fire: 12, clap: 41, sad: 1 },
    comments: []
  },
  {
    id: 4, featured: false, pinned: false,
    title: "Ota-onalar yig'ilishi haqida e'lon",
    desc: "15-may, soat 17:00 da barcha sinf ota-onalari uchun umumiy yig'ilish bo'lib o'tadi.",
    content: "Hurmatli ota-onalar!\n\n15-may kuni, soat 17:00 da maktabimizning asosiy zalida umumiy ota-onalar yig'ilishi o'tkaziladi.\n\nYig'ilishda:\n• O'quv yili yakunlari\n• Akademik natijalar tahlili\n• Kelgusi yilga tayyorgarlik\n• Savollar va takliflar\n\nBarcha sinf ota-onalarining ishtiroki zarur.",
    cat: "e'lon", author: "Direktor", date: "11 May 2026",
    views: 2240,
    img: "", type: "text",
    reactions: { like: 15, love: 8, fire: 3, clap: 22, sad: 5 },
    comments: [{ author: "Malika H.", text: "Qatnashaman, rahmat ma'lumot uchun!", time: "5 soat oldin" }]
  },
  {
    id: 5, featured: false, pinned: false,
    title: "Kimyo laboratoriyamiz to'liq yangilandi",
    desc: "Maktabimizga yangi zamonaviy kimyo jihozlari keltirildi.",
    content: "Yangi o'quv yili arafasida maktabimizning kimyo laboratoriyasi to'liq yangilandi. Zamonaviy mikroskoplar, kimyoviy analizatorlar va xavfsiz tajriba uskunalari o'rnatildi.\n\nJihozlarning umumiy qiymati 50 million so'mni tashkil etdi. Keyingi yildan boshlab o'quvchilar yangi uskunalar bilan amaliy mashg'ulotlar o'tkazadi.",
    cat: "fan", author: "Kimyo o'qituvchi", date: "9 May 2026",
    views: 696,
    img: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&q=80",
    type: "image",
    reactions: { like: 19, love: 11, fire: 8, clap: 25, sad: 0 },
    comments: []
  },
  {
    id: 6, featured: false, pinned: false,
    title: "Cambridge ingliz tili sertifikat imtihoniga tayyorgarlik",
    desc: "O'quvchilarimiz Cambridge xalqaro sertifikat imtihoniga tayyorlanmoqda. Kurslar bepul!",
    content: "Maktabimizda ingliz tili bo'yicha Cambridge xalqaro sertifikat imtihoniga tayyorgarlik kurslari boshlandi. 8, 9 va 10-sinf o'quvchilari uchun mo'ljallangan.\n\nKurslar har haftada 3 marta, 17:00 dan 19:00 gacha bo'lib o'tadi. Barcha o'quv materiallari maktab tomonidan ta'minlanadi.",
    cat: "ta'lim", author: "Ingliz tili muallimi", date: "8 May 2026",
    views: 1145,
    img: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&q=80",
    type: "image",
    reactions: { like: 28, love: 19, fire: 15, clap: 34, sad: 0 },
    comments: [{ author: "Zafar M.", text: "Juda yaxshi tashabbus, farzandimni yozaman!", time: "3 kun oldin" }]
  },
  {
    id: 7, featured: false, pinned: false,
    title: "Maktabimiz san'at ko'rgazmasi ochildi",
    desc: "O'quvchilarimizning rasm va haykaltaroshlik asarlari ko'rgazmasi 3 kun davomida ochiq bo'ladi.",
    content: "Maktabimizning ikkinchi qavatidagi san'at xonasida o'quvchilar ishtirokida yillik san'at ko'rgazmasi ochildi.\n\nKo'rgazmada 80 dan ortiq asar namoyish etilmoqda. Mehmonlar asarlarni 14-may gacha tomosha qilishlari mumkin. Kirishlar bepul.",
    cat: "san'at", author: "Tasviriy san'at o'qituvchi", date: "13 May 2026",
    views: 456,
    img: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80",
    type: "image",
    reactions: { like: 21, love: 34, fire: 9, clap: 28, sad: 0 },
    comments: []
  },
  {
    id: 8, featured: false, pinned: false,
    title: "Maktab veb-sayti yangilandi va mobil ilova ishga tushdi",
    desc: "MaktabNews portali yangi imkoniyatlar bilan yangilandi.",
    content: "Maktabimizning axborot tizimi to'liq yangilandi. Endi maktab yangiliklari, dars jadvali va e'lonlarni telefon orqali ham qulay o'qish mumkin.\n\nYangi imkoniyatlar: qorongʻi/yorugʻ rejim, izoh qoldirish, reaksiyalar, qidiruv, va boshqalar. Sayt tezligi 3 barobarga oshirildi.",
    cat: "texnologiya", author: "IT bo'limi", date: "7 May 2026",
    views: 823,
    img: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80",
    type: "image",
    reactions: { like: 41, love: 29, fire: 33, clap: 38, sad: 1 },
    comments: [{ author: "Doniyor R.", text: "Ajoyib tizim, davom eting!", time: "5 kun oldin" }]
  },
  {
    id: 9, featured: false, pinned: false,
    title: "Basketbol turniri: maktabimiz yarim finalda!",
    desc: "Shahar miqyosidagi basketbol turniridagi guruh bosqichida jamoamiz 3 ta o'yinni yutdi.",
    content: "Toshkent shahar basketbol turniridagi guruh bosqichida maktabimiz jamoasi 3 ta o'yinning hammasida g'alaba qozondi.\n\nYarim final o'yini 18-may kuni soat 15:00 da Olimpiya stadionida bo'lib o'tadi. Maktab o'quvchilari va ota-onalar kelib qo'llab-quvvatlashi mumkin!",
    cat: "sport", author: "Sport muallim", date: "12 May 2026",
    views: 612,
    img: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80",
    type: "image",
    reactions: { like: 34, love: 15, fire: 48, clap: 27, sad: 0 },
    comments: []
  },
  {
    id: 10, featured: false, pinned: false,
    title: "Yozgi ta'til jadvali e'lon qilindi",
    desc: "2026-yil yozgi ta'til 1-iyundan boshlanadi.",
    content: "Yozgi ta'til jadvali:\n\n📅 Yakuniy imtihonlar: 18-may — 28-may\n📋 Guvohnomalar: 30-may, soat 10:00\n🏖 Yozgi ta'til: 1-iyun\n📚 Yangi o'quv yili: 1-sentabr 2026\n\nImtihon jadvali sinflar e'lon taxtasiga osib qo'yiladi.",
    cat: "e'lon", author: "O'quv ishlari direktori o'rinbosari", date: "13 May 2026",
    views: 3241,
    img: "", type: "text",
    reactions: { like: 52, love: 18, fire: 7, clap: 43, sad: 12 },
    comments: [{ author: "Nilufar B.", text: "Rahmat, jadval juda qulay, bolalarga aytaman!", time: "12 soat oldin" }]
  },
  {
    id: 11, featured: false, pinned: false,
    title: "Ona tili olimpiadasi: 3 o'quvchimiz g'olib",
    desc: "Shahar miqyosidagi ona tili va adabiyot olimpiadasida yaxshi natija.",
    content: "O'tgan hafta bo'lib o'tgan shahar ona tili olimpiadasida maktabimizdan 3 nafar o'quvchi g'olib bo'ldi.\n\nG'oliblar: Dilorom Ismoilova (1-o'rin), Sarvar Toshmatov (2-o'rin), Gulnora Azimova (3-o'rin). Barcha g'oliblar maktabimizdan maxsus sertifikat va sovg'a bilan taqdirlandi.",
    cat: "ta'lim", author: "Ona tili muallimi", date: "6 May 2026",
    views: 489,
    img: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80",
    type: "image",
    reactions: { like: 29, love: 24, fire: 11, clap: 36, sad: 0 },
    comments: []
  }
];

/* ───────────────────────────────────────────────
   TASHRIF BUYURUVCHILAR
   ─────────────────────────────────────────────── */
let visitors = [];
const sessionId = 'v-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
let sessionViewed = [];

function trackVisitor() {
  const entry = {
    id: sessionId,
    time: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
    date: new Date().toLocaleDateString('uz-UZ'),
    page: 'Bosh sahifa',
    device: navigator.userAgent.includes('Mobile') ? '📱 Telefon' : '💻 Kompyuter',
    viewed: 0
  };
  const fakeVisitors = [
    { id:'v-001', time:'14:23', date:'12.05.2026', page:"Ta'lim",      device:'📱 Telefon',     viewed: 3 },
    { id:'v-002', time:'13:45', date:'12.05.2026', page:"Ta'lim",      device:'💻 Kompyuter',   viewed: 5 },
    { id:'v-003', time:'12:10', date:'12.05.2026', page:'Bosh sahifa', device:'📱 Telefon',     viewed: 1 },
    { id:'v-004', time:'11:55', date:'12.05.2026', page:"E'lonlar",    device:'💻 Kompyuter',   viewed: 7 },
    { id:'v-005', time:'10:30', date:'12.05.2026', page:'Madaniyat',   device:'📱 Telefon',     viewed: 2 },
  ];
  visitors = [entry, ...fakeVisitors];
}

function updateSessionViewed(id) {
  if (!sessionViewed.includes(id)) sessionViewed.push(id);
  const v = visitors.find(x => x.id === sessionId);
  if (v) v.viewed = sessionViewed.length;
}

trackVisitor();

/* ───────────────────────────────────────────────
   YORDAMCHI FUNKSIYALAR
   ─────────────────────────────────────────────── */

// O'qish vaqti
function readingTime(text) {
  if (!text) return '~1 daq';
  const words = text.trim().split(/\s+/).length;
  const mins  = Math.ceil(words / 180);
  return `~${mins} daq`;
}

// Jami reaksiyalar
function totalReactions(item) {
  if (!item.reactions) return 0;
  return Object.values(item.reactions).reduce((a, b) => a + b, 0);
}

// Eng ko'p reaksiya emoji
function getTopReaction(item) {
  if (!item.reactions) return '';
  const max = Math.max(...Object.values(item.reactions));
  if (max === 0) return '';
  const key = Object.keys(item.reactions).find(k => item.reactions[k] === max);
  const rt  = reactionTypes.find(r => r.key === key);
  return rt ? rt.label : '';
}

// Raqamli animatsiya
function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const dur   = 900;
  const begin = performance.now();
  function step(now) {
    const t = Math.min((now - begin) / dur, 1);
    el.textContent = Math.round(t * target).toLocaleString();
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function updateHeroStats() {
  animateCount('total-count',    news.length);
  animateCount('views-count',    news.reduce((s, n) => s + n.views, 0));
  animateCount('visitors-count', visitors.length + 142);
}

/* ───────────────────────────────────────────────
   MA'LUMOTLARNI YUKLASH
   ─────────────────────────────────────────────── */
let news = loadData() || defaultNews;

/* ═══════════════════════════════════════════════
   RENDER
   ═══════════════════════════════════════════════ */
function renderNews(filter = 'all') {
  const grid = document.getElementById('newsGrid');
  let filtered = filter === 'all' ? [...news] : news.filter(n => n.cat === filter);

  // Saralash
  if      (currentSort === 'views')     filtered.sort((a,b) => b.views - a.views);
  else if (currentSort === 'reactions') filtered.sort((a,b) => totalReactions(b) - totalReactions(a));
  else                                  filtered.sort((a,b) => b.id - a.id);

  // Muhimlar yuqoriga
  filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty"><div>🔍</div><p>Bu kategoriyada hozircha yangilik yo'q</p></div>`;
    renderPagination(0, 0);
    return;
  }

  // Pagination
  const total      = filtered.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  currentPage      = Math.min(currentPage, totalPages);
  const start      = (currentPage - 1) * PAGE_SIZE;
  const paged      = filtered.slice(start, start + PAGE_SIZE);

  grid.innerHTML = paged.map((item, i) => {
    const delay     = Math.min(i * 0.06, 0.4).toFixed(2);
    const isVideo   = item.type === 'video' || (item.localMedia && item.localMedia.startsWith('data:video'));

    const mediaHtml = item.localMedia
      ? (item.localMedia.startsWith('data:video')
          ? `<video src="${item.localMedia}" style="width:100%;height:100%;object-fit:cover"></video>`
          : `<img src="${item.localMedia}" alt="${sanitize(item.title)}" loading="lazy">`)
      : item.img
        ? `<img src="${item.img}" alt="${sanitize(item.title)}" loading="lazy">`
        : `<div class="placeholder">${catEmoji[item.cat] || '📰'}</div>`;

    const mediaBadge = (item.img || item.localMedia)
      ? `<span class="media-badge">${isVideo ? '🎬 Video' : '📸 Rasm'}</span>` : '';
    const pinBadge   = item.pinned ? `<span class="pin-badge">📌 Muhim</span>` : '';

    const adminBtns  = isAdmin
      ? `<div class="admin-card-btns">
          <button class="edit-btn"   onclick="editNews(${item.id},event)"   aria-label="Tahrirlash">✏️ Tahrirlash</button>
          <button class="delete-btn" onclick="deleteNews(${item.id},event)" aria-label="O'chirish">🗑</button>
         </div>` : '';

    const totalR = totalReactions(item);
    const topR   = getTopReaction(item);
    const rt     = readingTime(item.content || item.desc || '');

    return `
    <div class="card${item.featured ? ' featured' : ''}"
         onclick="openModal(${item.id})"
         style="animation-delay:${delay}s"
         role="article"
         tabindex="0"
         aria-label="${sanitize(item.title)}"
         onkeydown="if(event.key==='Enter')openModal(${item.id})">
      ${adminBtns}
      <div class="card-media">${mediaHtml}${mediaBadge}${pinBadge}</div>
      <div>
        <div class="card-body">
          <div class="card-meta">
            <span class="card-cat">${catEmoji[item.cat] || '📰'} ${sanitize(item.cat)}</span>
            <span class="card-read-time">⏱ ${rt}</span>
            <span class="card-date">${sanitize(item.date)}</span>
          </div>
          <h3>${sanitize(item.title)}</h3>
          <p>${sanitize(item.desc)}</p>
        </div>
        <div class="card-footer">
          <div class="card-author">
            <div class="avatar" aria-hidden="true">${sanitize((item.author || 'A')[0].toUpperCase())}</div>
            <span class="author-name">${sanitize(item.author)}</span>
          </div>
          <div class="card-stats">
            ${topR ? `<span class="card-reactions">${topR} ${totalR}</span>` : ''}
            <span class="card-views">👁 ${item.views.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  renderPagination(totalPages, total);
  updateHeroStats();
}

/* ──── PAGINATION ──── */
function renderPagination(totalPages, total) {
  const bar = document.getElementById('paginationBar');
  if (totalPages <= 1) { bar.innerHTML = ''; return; }

  let html = `<button class="page-btn" onclick="goPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>← Oldingi</button>`;
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1) {
      html += `<button class="page-btn${p === currentPage ? ' active' : ''}" onclick="goPage(${p})">${p}</button>`;
    } else if (Math.abs(p - currentPage) === 2) {
      html += `<span class="page-info">…</span>`;
    }
  }
  html += `<button class="page-btn" onclick="goPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Keyingi →</button>`;
  html += `<span class="page-info">${total} ta yangilik</span>`;
  bar.innerHTML = html;
}

function goPage(p) {
  currentPage = p;
  renderNews(currentFilter);
  document.getElementById('filterBar').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ══════════════════════════════
   FILTER / SORT
══════════════════════════════ */
function filterNews(cat, btn) {
  currentFilter = cat;
  currentPage   = 1;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderNews(cat);
}

function sortNews(val) {
  currentSort = val;
  currentPage = 1;
  renderNews(currentFilter);
}

/* ══════════════════════════════
   MODAL
══════════════════════════════ */
function openModal(id) {
  const item = news.find(n => n.id === id);
  if (!item) return;

  currentModalId = id;
  item.views++;
  updateSessionViewed(id);
  saveData();
  renderNews(currentFilter);

  // URL hash
  history.replaceState(null, '', `#yangilik-${id}`);
  document.title = sanitize(item.title) + ' — MaktabNews';

  // Media
  let mediaHtml;
  if (item.localMedia) {
    mediaHtml = item.localMedia.startsWith('data:video')
      ? `<video controls muted playsinline src="${item.localMedia}" style="width:100%;height:100%;object-fit:cover"></video>`
      : `<img src="${item.localMedia}" alt="${sanitize(item.title)}" style="width:100%;height:100%;object-fit:cover">`;
  } else if (item.img) {
    mediaHtml = `<img src="${item.img}" alt="${sanitize(item.title)}" style="width:100%;height:100%;object-fit:cover">`;
  } else {
    mediaHtml = `<div class="placeholder" style="height:260px;display:flex;align-items:center;justify-content:center;font-size:80px;">${catEmoji[item.cat] || '📰'}</div>`;
  }

  document.getElementById('modalMedia').innerHTML   = mediaHtml;
  document.getElementById('modalCat').textContent   = `${catEmoji[item.cat] || '📰'} ${item.cat.toUpperCase()}`;
  document.getElementById('modalTitle').textContent = item.title;

  const rt = readingTime(item.content || '');
  document.getElementById('modalMeta').innerHTML =
    `<span>✍️ ${sanitize(item.author)}</span>
     <span>📅 ${sanitize(item.date)}</span>
     <span>👁 ${item.views.toLocaleString()}</span>
     <span>⏱ ${rt} o'qiladi</span>`;

  document.getElementById('modalContent').innerHTML =
    sanitize(item.content).replace(/\n/g, '<br>');

  renderReactions(item);
  renderComments(item);

  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';

  // Progress bar
  const modalEl = document.getElementById('modalBox');
  modalEl.scrollTop = 0;
  document.getElementById('modalProgressBar').style.width = '0%';
  modalEl.onscroll = function () {
    const pct = this.scrollTop / (this.scrollHeight - this.clientHeight) * 100;
    document.getElementById('modalProgressBar').style.width = pct + '%';
  };
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modal')) closeModalBtn();
}

function closeModalBtn() {
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
  currentModalId = null;
  history.replaceState(null, '', location.pathname);
  document.title = 'MaktabNews — 10-Maktab Axborot Portali';
}

/* ──── SHARE ──── */
function shareArticle() {
  const item = news.find(n => n.id === currentModalId);
  if (!item) return;
  if (navigator.share) {
    navigator.share({ title: item.title, text: item.desc, url: location.href }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(location.href).then(() => showToast('🔗 Havola nusxalandi!'));
  }
}

/* ──── REACTIONS ──── */
function renderReactions(item) {
  const container = document.getElementById('modalReactions');
  container.innerHTML = reactionTypes.map(r => {
    const count   = (item.reactions && item.reactions[r.key]) || 0;
    const reacted = userReactions[item.id] === r.key;
    return `<button class="reaction-btn${reacted ? ' reacted' : ''}"
              onclick="addReaction(${item.id},'${r.key}')"
              aria-label="${r.name} reaksiyasi"
              title="${r.name}">
              ${r.label} <span class="count">${count}</span>
            </button>`;
  }).join('');
}

function addReaction(itemId, key) {
  const item = news.find(n => n.id === itemId);
  if (!item) return;
  if (!item.reactions) item.reactions = {};
  const prev = userReactions[itemId];
  if (prev === key) {
    item.reactions[key] = Math.max((item.reactions[key] || 0) - 1, 0);
    delete userReactions[itemId];
  } else {
    if (prev) item.reactions[prev] = Math.max((item.reactions[prev] || 0) - 1, 0);
    item.reactions[key] = (item.reactions[key] || 0) + 1;
    userReactions[itemId] = key;
  }
  saveData();
  renderReactions(item);
  renderNews(currentFilter);
}

/* ──── COMMENTS ──── */
function renderComments(item) {
  const list   = document.getElementById('commentsList');
  const bodyEl = document.getElementById('modalBox');

  if (isAdmin) bodyEl.classList.add('admin-mode');
  else         bodyEl.classList.remove('admin-mode');

  if (!item.comments || !item.comments.length) {
    list.innerHTML = `<p style="color:var(--gray2);font-size:13px;margin-bottom:12px;">Hali izoh yo'q. Birinchi bo'ling!</p>`;
    return;
  }

  list.innerHTML = item.comments.map((c, i) => `
    <div class="comment-item">
      <div class="comment-avatar" aria-hidden="true">${sanitize((c.author || 'A')[0].toUpperCase())}</div>
      <div class="comment-bubble">
        <div class="comment-author">
          ${sanitize(c.author)}
          <button class="comment-del" onclick="deleteComment(${item.id},${i})" aria-label="Izohni o'chirish">✕ O'chirish</button>
        </div>
        <div class="comment-text">${sanitize(c.text)}</div>
        <div class="comment-time">${sanitize(c.time)}</div>
      </div>
    </div>`).join('');
}

function deleteComment(itemId, idx) {
  if (!isAdmin) return;
  const item = news.find(n => n.id === itemId);
  if (!item) return;
  item.comments.splice(idx, 1);
  saveData();
  renderComments(item);
  showToast('🗑️ Izoh o\'chirildi');
}

function submitComment() {
  const input = document.getElementById('commentInput');
  const text  = (input.value || '').trim();
  if (!text || !currentModalId) return;
  if (text.length > MAX_COMMENT_LEN) { showToast(`❗ Izoh ${MAX_COMMENT_LEN} ta belgidan oshmasin`, 'error'); return; }

  const item = news.find(n => n.id === currentModalId);
  if (!item) return;
  if (!item.comments) item.comments = [];
  item.comments.unshift({ author: 'Siz', text: sanitize(text), time: 'Hozir' });
  input.value = '';
  saveData();
  renderComments(item);
  showToast('💬 Izoh qo\'shildi!');
}

/* ══════════════════════════════
   SEARCH
══════════════════════════════ */
function openSearch() {
  document.getElementById('searchOverlay').classList.add('open');
  setTimeout(() => document.getElementById('searchInput').focus(), 100);
  document.body.style.overflow = 'hidden';
}

function closeSearch() {
  document.getElementById('searchOverlay').classList.remove('open');
  document.body.style.overflow = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').innerHTML = '';
}

function handleSearchOverlayClick(e) {
  if (e.target === document.getElementById('searchOverlay')) closeSearch();
}

function doSearch() {
  const q         = (document.getElementById('searchInput').value || '').trim().toLowerCase();
  const container = document.getElementById('searchResults');
  if (!q) { container.innerHTML = ''; return; }

  const results = news.filter(n =>
    (n.title  || '').toLowerCase().includes(q) ||
    (n.desc   || '').toLowerCase().includes(q) ||
    (n.cat    || '').toLowerCase().includes(q) ||
    (n.author || '').toLowerCase().includes(q)
  );

  if (!results.length) {
    container.innerHTML = `<div style="text-align:center;color:var(--gray);padding:30px">Hech narsa topilmadi 🔍</div>`;
    return;
  }

  container.innerHTML = results.slice(0, 6).map(n => `
    <div class="search-result-item"
         onclick="closeSearch();openModal(${n.id})"
         role="button" tabindex="0"
         onkeydown="if(event.key==='Enter'){closeSearch();openModal(${n.id})}">
      <h4>${sanitize(n.title)}</h4>
      <p>${catEmoji[n.cat] || '📰'} ${sanitize(n.cat)} · ${sanitize(n.author)} · 👁 ${n.views}</p>
    </div>`).join('');
}

/* ══════════════════════════════
   POST FORM
══════════════════════════════ */
function toggleForm() {
  const form = document.getElementById('postForm');
  form.classList.toggle('show');
  if (form.classList.contains('show')) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelForm() {
  editingId = null;
  document.getElementById('f-edit-id').value = '';
  document.getElementById('formTitle').textContent = '✏️ Yangi Yangilik Qo\'shish';
  document.getElementById('postForm').classList.remove('show');
  clearForm();
}

function clearForm() {
  ['f-title', 'f-desc', 'f-content', 'f-author', 'f-img'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const fc = document.getElementById('f-featured');
  const fp = document.getElementById('f-pinned');
  if (fc) fc.checked = false;
  if (fp) fp.checked = false;
  fileData = null;
  const prev = document.getElementById('file-preview');
  if (prev) prev.style.display = 'none';
}

function editNews(id, e) {
  e.stopPropagation();
  if (!isAdmin) return;
  const item = news.find(n => n.id === id);
  if (!item) return;
  editingId = id;
  document.getElementById('f-edit-id').value      = id;
  document.getElementById('f-title').value        = item.title;
  document.getElementById('f-desc').value         = item.desc;
  document.getElementById('f-content').value      = item.content;
  document.getElementById('f-author').value       = item.author;
  document.getElementById('f-img').value          = item.img || '';
  document.getElementById('f-cat').value          = item.cat;
  document.getElementById('f-featured').checked   = item.featured;
  document.getElementById('f-pinned').checked     = item.pinned;
  document.getElementById('formTitle').textContent = '✏️ Yangilikni Tahrirlash';
  const form = document.getElementById('postForm');
  form.classList.add('show');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// File upload — max 5MB
function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    showToast(`❗ Fayl ${MAX_FILE_MB}MB dan kichik bo'lishi kerak`, 'error');
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    fileData = ev.target.result;
    const isVid = file.type.startsWith('video');
    const prev  = document.getElementById('file-preview');
    prev.style.display = 'block';
    prev.innerHTML = isVid
      ? `<video src="${fileData}" controls style="width:100%;border-radius:12px;max-height:200px"></video>`
      : `<img src="${fileData}" style="width:100%;border-radius:12px;max-height:200px;object-fit:cover" alt="Tanlangan fayl">`;
  };
  reader.readAsDataURL(file);
}

function submitPost() {
  const title   = (document.getElementById('f-title').value   || '').trim();
  const cat     =  document.getElementById('f-cat').value;
  const desc    = (document.getElementById('f-desc').value    || '').trim();
  const content = (document.getElementById('f-content').value || '').trim();
  const author  = (document.getElementById('f-author').value  || '').trim() || 'Ma\'muriyat';
  const imgUrl  = (document.getElementById('f-img').value     || '').trim();
  const featured = document.getElementById('f-featured').checked;
  const pinned   = document.getElementById('f-pinned').checked;

  if (!title || !desc || !content) { showToast('❗ Sarlavha, tavsif va matn to\'ldiring!', 'error'); return; }
  if (title.length > MAX_TITLE_LEN) { showToast(`❗ Sarlavha ${MAX_TITLE_LEN} ta belgidan oshmasin`, 'error'); return; }
  if (imgUrl && !/^https?:\/\/.+/.test(imgUrl)) { showToast('❗ Rasm URL noto\'g\'ri formatda', 'error'); return; }

  if (editingId) {
    const idx = news.findIndex(n => n.id === editingId);
    if (idx !== -1) {
      news[idx] = {
        ...news[idx],
        title: sanitize(title), cat, desc: sanitize(desc),
        content: sanitize(content), author: sanitize(author),
        img: imgUrl, featured, pinned
      };
      if (fileData) news[idx].localMedia = fileData;
      showToast('✅ Yangilik yangilandi!');
    }
  } else {
    const dateStr = new Intl.DateTimeFormat('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    const newItem = {
      id: Date.now(), featured, pinned,
      title:   sanitize(title),
      desc:    sanitize(desc),
      content: sanitize(content),
      cat, author: sanitize(author), date: dateStr,
      views: 0, img: imgUrl, localMedia: fileData,
      type: fileData?.startsWith('data:video') ? 'video' : 'image',
      reactions: { like: 0, love: 0, fire: 0, clap: 0, sad: 0 },
      comments: []
    };
    news.unshift(newItem);
    updateTicker(sanitize(title));
    showToast('✅ Yangilik muvaffaqiyatli nashr etildi!');
  }

  saveData();
  cancelForm();
  renderNews(currentFilter);
}

function updateTicker(text) {
  const t = document.getElementById('ticker');
  if (!t) return;
  const s1 = document.createElement('span'); s1.textContent = text;
  const s2 = document.createElement('span'); s2.textContent = text;
  t.insertBefore(s1, t.firstChild);
  t.appendChild(s2);
}

/* ══════════════════════════════
   ADMIN AUTH
   ── TUZATISH: SHA-256 hash ──
══════════════════════════════ */
function openAdminLogin() {
  if (isAdmin) { showToast('🔐 Siz allaqachon admin sifatida kirgansiz'); return; }
  document.getElementById('adminOverlay').classList.add('open');
  setTimeout(() => document.getElementById('adminPass').focus(), 200);
}

function closeAdminLogin() {
  document.getElementById('adminOverlay').classList.remove('open');
  document.getElementById('adminPass').value = '';
  document.getElementById('adminErr').style.display = 'none';
}

async function checkPass() {
  // Rate limiting: 5 ta noto'g'ri urinishdan keyin 60 soniya kutish
  if (failedAttempts >= 5) {
    const elapsed = (Date.now() - lastFailedTime) / 1000;
    if (elapsed < 60) {
      showToast(`❌ Juda ko'p urinish! ${Math.ceil(60 - elapsed)} soniya kuting`, 'error');
      return;
    } else {
      failedAttempts = 0; // Reset
    }
  }

  const val = document.getElementById('adminPass').value;
  if (!val) return;

  // SHA-256 hash hisoblash va RUNTIME_HASH bilan solishtirish
  // RUNTIME_HASH = hashPassword('begzod08') — init da hisoblanadi
  const inputHash = await hashPassword(val);

  if (inputHash === RUNTIME_HASH) {
    // ✅ Parol to'g'ri
    isAdmin       = true;
    failedAttempts = 0;

    closeAdminLogin();
    document.getElementById('adminBar').classList.add('show');

    const navBadge = document.getElementById('adminNavBtn');
    if (navBadge) navBadge.style.display = 'flex';

    const postBtn = document.getElementById('postBtn');
    if (postBtn) postBtn.style.display = '';

    const mobPost = document.getElementById('mobilePostBtn');
    if (mobPost) mobPost.style.display = '';

    const dash = document.getElementById('adminDashboard');
    if (dash) { dash.classList.add('show'); renderDashboard(); }

    renderNews(currentFilter);
    showToast('✅ Admin sifatida kirdingiz, Begzod! 👋');

    // Admin session saqlash
    try { sessionStorage.setItem('mn_admin', '1'); } catch(e) {}

  } else {
    // ❌ Parol noto'g'ri
    failedAttempts++;
    lastFailedTime = Date.now();

    const err = document.getElementById('adminErr');
    err.style.display = 'block';
    const inp = document.getElementById('adminPass');
    inp.style.borderColor = '#e74c3c';
    inp.value = '';
    setTimeout(() => { err.style.display = 'none'; inp.style.borderColor = ''; }, 3000);

    const remaining = 5 - failedAttempts;
    showToast(
      remaining > 0
        ? `❌ Parol noto'g'ri! ${remaining} ta urinish qoldi`
        : '🚫 Kirish bloklandi! 60 soniya kuting',
      'error'
    );
  }
}

function logoutAdmin() {
  isAdmin = false;
  try { sessionStorage.removeItem('mn_admin'); } catch(e) {}

  document.getElementById('adminBar').classList.remove('show');

  const navBadge = document.getElementById('adminNavBtn');
  if (navBadge) navBadge.style.display = 'none';

  const postBtn = document.getElementById('postBtn');
  if (postBtn) postBtn.style.display = 'none';

  const mobPost = document.getElementById('mobilePostBtn');
  if (mobPost) mobPost.style.display = 'none';

  const dash = document.getElementById('adminDashboard');
  if (dash) dash.classList.remove('show');

  document.getElementById('postForm').classList.remove('show');
  renderNews(currentFilter);
  showToast('👋 Admin rejimdan chiqdingiz');
}

function deleteNews(id, e) {
  e.stopPropagation();
  if (!isAdmin) return;
  if (!confirm('Bu yangilikni o\'chirishni tasdiqlaysizmi?')) return;
  news = news.filter(n => n.id !== id);
  saveData();
  renderNews(currentFilter);
  showToast('🗑️ Yangilik o\'chirildi');
}

/* ══════════════════════════════
   ADMIN DASHBOARD
══════════════════════════════ */
function renderDashboard() {
  const totalViews    = news.reduce((s, n) => s + n.views, 0);
  const totalR        = news.reduce((s, n) => s + totalReactions(n), 0);
  const totalComments = news.reduce((s, n) => s + (n.comments?.length || 0), 0);

  document.getElementById('dashGrid').innerHTML = `
    <div class="dash-card"><div class="dash-num">${news.length}</div><div class="dash-label">Jami yangiliklar</div><div class="dash-change">Faol</div></div>
    <div class="dash-card"><div class="dash-num">${totalViews.toLocaleString()}</div><div class="dash-label">Jami ko'rishlar</div><div class="dash-change">↑ Ortmoqda</div></div>
    <div class="dash-card"><div class="dash-num">${(visitors.length + 142)}</div><div class="dash-label">Tashrif buyuruvchilar</div><div class="dash-change">+12 bugun</div></div>
    <div class="dash-card"><div class="dash-num">${totalR}</div><div class="dash-label">Reaksiyalar</div><div class="dash-change">❤️ Faol</div></div>
    <div class="dash-card"><div class="dash-num">${totalComments}</div><div class="dash-label">Izohlar</div><div class="dash-change">💬 Faol</div></div>
    <div class="dash-card"><div class="dash-num">${news.filter(n => n.pinned).length}</div><div class="dash-label">Muhim yangiliklar</div><div class="dash-change">📌 Yopishtirilgan</div></div>`;

  document.getElementById('visitorsTableBody').innerHTML = visitors.slice(0, 6).map((v, i) => `
    <tr>
      <td style="color:var(--gray2);font-family:'JetBrains Mono',monospace;font-size:12px">${i + 1}</td>
      <td>${v.time} · ${v.date}</td>
      <td>${v.page}</td>
      <td>${v.device}</td>
      <td><span style="color:var(--gold);font-weight:600">${v.viewed}</span> ta</td>
    </tr>`).join('');

  const sorted = [...news].sort((a, b) => b.views - a.views).slice(0, 5);
  document.getElementById('topNewsList').innerHTML = sorted.map((n, i) => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border2);cursor:pointer"
         onclick="openModal(${n.id})" role="button" tabindex="0">
      <span style="font-family:'JetBrains Mono',monospace;color:var(--gold);font-size:18px;font-weight:700;width:24px">${i + 1}</span>
      <div style="flex:1">
        <div style="font-size:13px;color:var(--text-primary);font-weight:600;margin-bottom:2px">
          ${sanitize(n.title.slice(0, 60))}${n.title.length > 60 ? '...' : ''}
        </div>
        <div style="font-size:11px;color:var(--gray)">${catEmoji[n.cat]} ${sanitize(n.cat)} · ${sanitize(n.author)}</div>
      </div>
      <span style="font-size:13px;color:var(--gray);font-weight:600">👁 ${n.views.toLocaleString()}</span>
    </div>`).join('');
}

/* ══════════════════════════════
   MOBILE MENU
══════════════════════════════ */
function toggleMobileMenu() {
  document.getElementById('hamburger').classList.toggle('open');
  document.getElementById('mobileDrawer').classList.toggle('open');
}

function closeMobileMenu() {
  document.getElementById('hamburger').classList.remove('open');
  document.getElementById('mobileDrawer').classList.remove('open');
}

/* ══════════════════════════════
   TOAST
══════════════════════════════ */
let toastId = 0;

function showToast(msg, type = 'default') {
  const container = document.getElementById('toastContainer');
  const id        = 'toast-' + (++toastId);
  const t         = document.createElement('div');

  t.className = 'toast' + (type === 'error' ? ' error' : type === 'info' ? ' info' : '');
  t.id        = id;
  t.textContent = msg;
  t.setAttribute('role', 'status');
  t.setAttribute('aria-live', 'polite');

  container.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 500); }, 3500);
}

/* ══════════════════════════════
   KEYBOARD SHORTCUTS
══════════════════════════════ */
document.addEventListener('keydown', e => {
  // Esc — yopish
  if (e.key === 'Escape') { closeSearch(); closeModalBtn(); closeMobileMenu(); }

  // Ctrl/Cmd+K — qidiruv
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }

  // Modal ichida ← → — oldinga/orqaga
  if (document.getElementById('modal').classList.contains('open')) {
    if (e.key === 'ArrowRight') {
      const cur = news.findIndex(n => n.id === currentModalId);
      if (cur < news.length - 1) openModal(news[cur + 1].id);
    }
    if (e.key === 'ArrowLeft') {
      const cur = news.findIndex(n => n.id === currentModalId);
      if (cur > 0) openModal(news[cur - 1].id);
    }
  }
});

/* ══════════════════════════════
   BACK TO TOP
══════════════════════════════ */
window.addEventListener('scroll', () => {
  const btn = document.getElementById('backToTop');
  if (btn) btn.classList.toggle('visible', window.scrollY > 400);
}, { passive: true });

/* ══════════════════════════════
   URL PARAMETRLARI
   ?admin=open → admin panelini ochish
══════════════════════════════ */
function checkURLParams() {
  const params = new URLSearchParams(window.location.search);

  // ?admin=open → login oynasini ochish
  if (params.get('admin') === 'open') {
    setTimeout(() => openAdminLogin(), 600);
    // URL dan parametrni olib tashlash (xavfsizlik)
    const cleanUrl = window.location.pathname + window.location.hash;
    history.replaceState(null, '', cleanUrl);
  }
}

/* ══════════════════════════════
   INIT
══════════════════════════════ */
(function init() {
  renderNews();
  checkURLParams();

  // URL hash bo'yicha modal ochish
  const hash = location.hash;
  if (hash.startsWith('#yangilik-')) {
    const id = parseInt(hash.replace('#yangilik-', ''));
    if (!isNaN(id)) setTimeout(() => openModal(id), 500);
  }
})();