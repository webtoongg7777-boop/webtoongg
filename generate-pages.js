// 검색엔진용 키워드별 추천 페이지를 만드는 스크립트
// 사용법: node generate-pages.js
//  - recommend/<주소>/index.html  : 장르 · 키워드 · 장르+키워드 · 플랫폼별 추천 페이지
//  - recommend/index.html         : 전체 목록(허브) 페이지
//  - sitemap.xml                  : 모든 페이지 주소
//  - index.html 의 "테마별 추천" 링크 영역
// 데이터(data-*.js)나 catalog.js 를 바꾼 뒤 다시 실행하면 돼요.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname;
const BASE_URL = "https://webtoongg.com";   // 사이트 주소가 바뀌면 여기만 고치면 돼요
const OUT_DIR = path.join(ROOT, "recommend");
const TOP_N = 30;          // 페이지마다 보여줄 작품 수
const MIN_ITEMS = 10;      // 작품이 이보다 적으면 페이지를 만들지 않아요
const COMBO_MIN = 15;      // 장르+키워드 페이지를 만들 최소 작품 수
const COMBO_PER_GENRE = 6; // 장르마다 만들 장르+키워드 페이지 수
const COMBO_MAX = 50;      // 장르+키워드 페이지 최대 개수
const CONTACT_EMAIL = "webtoongg7777@gmail.com";   // 페이지 하단 문의 메일
const now = new Date();
const TODAY = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const ASSET_VERSION = TODAY.replace(/-/g, "");

// ───────── 사이트와 같은 데이터 · 정의 불러오기 ─────────
const ctx = vm.createContext({ window: {} });
for (const f of ["data-naver.js", "data-kakao.js", "data-lezhin.js", "data-ranking.js"]) {
  const file = path.join(ROOT, f);
  if (fs.existsSync(file)) vm.runInContext(fs.readFileSync(file, "utf8"), ctx, { filename: f });
}
const catalogSrc = fs.readFileSync(path.join(ROOT, "catalog.js"), "utf8");
const { PLATFORMS, PLATFORM, WEBTOONS, GENRES, KEYWORDS, AGE_LABEL, genreMatches } = vm.runInContext(
  catalogSrc + "\n;({ PLATFORMS, PLATFORM, WEBTOONS, GENRES, KEYWORDS, AGE_LABEL, genreMatches })", ctx, { filename: "catalog.js" });

// 검색 페이지에는 성인 작품을 넣지 않아요
const POOL = WEBTOONS.filter(w => w.age !== "RATE_18");
const byPop = (a, b) => b.pop - a.pop || b.favorites - a.favorites;

// ───────── 페이지 주소 · 이름 ─────────
const GENRE_SEO = {
  FANTASY: { slug: "fantasy", name: "판타지" }, ACTION: { slug: "action", name: "액션" },
  HISTORICAL: { slug: "martial-arts", name: "무협" }, PURE: { slug: "romance", name: "로맨스" },
  DRAMA: { slug: "drama", name: "드라마" }, THRILL: { slug: "thriller", name: "스릴러·공포" },
  COMIC: { slug: "comedy", name: "일상·개그" }, SPORTS: { slug: "sports", name: "스포츠" },
  BL: { slug: "bl-gl", name: "BL·GL" },
};
const KEYWORD_SLUG = {
  cider: "cider", op: "overpowered", game: "game-system", regress: "regression", fight: "battle",
  modern: "modern-fantasy", medieval: "medieval-fantasy", world: "worldbuilding", martial: "murim",
  period: "historical", sf: "sf", survival: "apocalypse", dark: "dark", schoolA: "school-action",
  crime: "crime-noir", mystery: "mystery", occult: "horror-occult", romcom: "romantic-comedy",
  firstlove: "first-love", real: "realistic-romance", sweet: "sweet-lead", obsess: "obsessive-lead",
  hot: "intense-romance", girl: "girl-crush", triangle: "love-triangle", campus: "campus-romance",
  rofan: "romance-fantasy", contract: "contract-romance", flutter: "youth-romance", growth: "growth",
  healing: "healing", tears: "tearjerker", gag: "comedy-gag", cozy: "cooking-parenting-animals",
  cuttoon: "short-cuttoon", work: "office-money", rival: "sports-rivalry", art: "best-art",
  hotnow: "trending", classic: "classics",
};
const PLATFORM_SEO = {
  naver: { slug: "naver-webtoon" }, kakao: { slug: "kakao-webtoon" }, lezhin: { slug: "lezhin-comics" },
};
const COMMON_KEYWORDS = new Set(["art", "hotnow", "classic"]);   // 모든 장르에 붙는 키워드는 조합 페이지에서 빼요

const keywordMatches = (k, w) => k.tags.some(t => w.tags.includes(t));
const keywordName = k => k.label;

// ───────── 페이지 목록 만들기 ─────────
const pages = [];
function addPage(p) {
  if (p.works.length < MIN_ITEMS) return;
  p.total = p.works.length;
  p.works = p.works.slice(0, TOP_N);
  pages.push(p);
}

for (const g of GENRES) {
  const seo = GENRE_SEO[g.id];
  addPage({
    type: "genre", slug: seo.slug, name: seo.name, genre: g,
    works: POOL.filter(w => genreMatches(g, w)).sort(byPop),
    about: `${g.desc} 이야기를 좋아한다면 이 목록부터 보세요.`,
  });
}

for (const k of KEYWORDS) {
  addPage({
    type: "keyword", slug: KEYWORD_SLUG[k.id] || k.id, name: keywordName(k), keyword: k,
    works: POOL.filter(w => keywordMatches(k, w)).sort(byPop),
    about: `${k.tags.slice(0, 5).join(", ")} 같은 태그가 붙은 작품을 모았어요.`,
  });
}

// 장르 + 키워드 조합: 장르마다 작품이 많은 조합을 COMBO_PER_GENRE 개까지 (한 장르가 독차지하지 않게)
const combos = [];
for (const g of GENRES) {
  const kwGenres = [g.id, g.keywordsLike].filter(Boolean);
  const forGenre = [];
  for (const k of KEYWORDS) {
    if (COMMON_KEYWORDS.has(k.id) || !k.genres.some(id => kwGenres.includes(id))) continue;
    const works = POOL.filter(w => genreMatches(g, w) && keywordMatches(k, w)).sort(byPop);
    if (works.length >= COMBO_MIN) forGenre.push({ g, k, works });
  }
  combos.push(...forGenre.sort((a, b) => b.works.length - a.works.length).slice(0, COMBO_PER_GENRE));
}
combos.slice(0, COMBO_MAX).forEach(({ g, k, works }) => {
  const seo = GENRE_SEO[g.id];
  addPage({
    type: "combo", slug: `${seo.slug}-${KEYWORD_SLUG[k.id] || k.id}`, name: `${seo.name} ${keywordName(k)}`,
    genre: g, keyword: k, works,
    about: `${seo.name} 작품 중에서 ${k.tags.slice(0, 4).join(", ")} 같은 요소가 들어간 작품만 골랐어요.`,
  });
});

// 플랫폼별: 공식 인기 순위가 있으면 그 순서, 없으면 인기 점수 순서 (연재작만)
for (const p of PLATFORMS) {
  const ranking = (ctx.window.DATA_RANKING && ctx.window.DATA_RANKING[p.id]) || [];
  const key = w => p.id === "lezhin" ? w.url.split("/").pop() : String(w.id);
  const ongoing = POOL.filter(w => w.platform === p.id && !w.finished);
  const rankIndex = new Map(ranking.map((id, i) => [String(id), i]));
  const works = ongoing.sort((a, b) => (rankIndex.get(key(a)) ?? 1e9) - (rankIndex.get(key(b)) ?? 1e9) || byPop(a, b));
  addPage({
    type: "platform", slug: PLATFORM_SEO[p.id].slug, name: p.label, platform: p, works,
    about: `${p.label}에서 지금 연재 중인 작품을 ${p.label} 공식 인기 순위 순서로 모았어요.`,
  });
}

addPage({
  type: "special", slug: "finished", name: "완결",
  works: POOL.filter(w => w.finished).sort(byPop),
  about: "끝까지 한 번에 몰아볼 수 있는 완결 웹툰을 모았어요.",
});

// ───────── HTML 도우미 ─────────
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// 메일 주소처럼 스팸 수집을 줄이고 싶은 글자를 HTML 코드(&#..;)로 바꿔요. 화면에는 그대로 보여요.
const htmlCode = s => [...s].map(ch => `&#${ch.codePointAt(0)};`).join("");
const cut = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1).trim() + "…" : s; };
const pageUrl = p => `${BASE_URL}/recommend/${p.slug}/`;
const titleOf = p => p.type === "platform" ? `${p.name} 추천 인기 순위 TOP ${p.works.length}` : `${p.name} 웹툰 추천 TOP ${p.works.length}`;
const GENRE_LABEL = Object.fromEntries(GENRES.map(g => [g.id, g.label]));
Object.assign(GENRE_LABEL, { DAILY: "일상", SENSIBILITY: "감성" });

function head({ title, description, canonical, rel, jsonLd }) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#5b4cf0">
<meta property="og:type" content="website">
<meta property="og:site_name" content="웹툰지지">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="ko_KR">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%235b4cf0'/%3E%3Ctext x='32' y='42' font-family='Arial' font-weight='900' font-size='28' fill='white' text-anchor='middle'%3Egg%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="${rel}style.css?v=${ASSET_VERSION}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<header class="topbar">
  <div class="container">
    <a class="logo" href="${rel}" aria-label="웹툰지지 홈"><span class="logo-mark">gg</span>웹툰지지</a>
    <nav class="topnav" aria-label="주요 메뉴">
      <a href="${rel}#finder">취향 추천</a>
      <a href="${rel}recommend/">테마별 추천</a>
      <a href="${rel}#popular-section">인기 웹툰</a>
    </nav>
  </div>
</header>`;
}

function foot(rel) {
  return `
<footer>
  <div class="container">
    <div>
      <p><b>웹툰지지</b> · 취향으로 찾는 웹툰 추천</p>
      <p>작품 정보와 이미지의 저작권은 각 작가 및 플랫폼(네이버웹툰, 카카오웹툰, 레진코믹스)에 있으며, 권리자 요청 시 즉시 삭제합니다.</p>
      <p>웹툰지지는 각 플랫폼과 제휴 관계가 없는 개인 추천 서비스입니다.</p>
    </div>
    <div>
      <p><a href="${rel}recommend/">테마별 웹툰 추천 전체 보기</a></p>
      <p>문의: <a href="${htmlCode(`mailto:${CONTACT_EMAIL}`)}">${htmlCode(CONTACT_EMAIL)}</a></p>
    </div>
  </div>
</footer>
</body>
</html>
`;
}

function reasonChips(p, w) {
  const chips = [];
  if (p.genre) chips.push(GENRE_SEO[p.genre.id].name);
  if (p.keyword) chips.push(...p.keyword.tags.filter(t => w.tags.includes(t)).slice(0, 3));
  const extra = w.tags.filter(t => !chips.includes(t)).slice(0, Math.max(0, 5 - chips.length));
  return [...chips.map(c => `<span class="chip hit">${esc(c)}</span>`), ...extra.map(t => `<span class="chip">${esc(t)}</span>`)].join("");
}

function relatedPages(p) {
  const same = pages.filter(o => o !== p && (
    (p.genre && o.genre && o.genre.id === p.genre.id) ||
    (p.keyword && o.keyword && o.keyword.id === p.keyword.id)));
  const genres = pages.filter(o => o.type === "genre" && o !== p);
  const list = [...new Set([...same, ...genres])].slice(0, 16);
  return list.map(o => `<a href="../${o.slug}/">${esc(o.name)} 웹툰 추천</a>`).join("");
}

// ───────── 추천 페이지 ─────────
function renderPage(p) {
  const rel = "../../";
  const title = `${titleOf(p)} | 웹툰지지`;
  const top3 = p.works.slice(0, 3).map(w => w.title);
  const platforms = [...new Set(p.works.map(w => PLATFORM[w.platform].label))];
  const description = `${p.name} 웹툰 추천 TOP ${p.works.length}. ${top3.join(", ")} 등 ${platforms.join("·")}에서 인기 있는 ${p.name} 웹툰을 인기 순으로 모았어요.`;
  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "ItemList", name: titleOf(p), url: pageUrl(p),
      numberOfItems: p.works.length,
      itemListElement: p.works.map((w, i) => ({ "@type": "ListItem", position: i + 1, name: w.title, url: w.url })),
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "웹툰지지", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "테마별 웹툰 추천", item: `${BASE_URL}/recommend/` },
        { "@type": "ListItem", position: 3, name: titleOf(p), item: pageUrl(p) },
      ],
    },
  ];

  const items = p.works.map((w, i) => {
    const pf = PLATFORM[w.platform];
    return `
      <li class="card">
        <div class="rank">${i + 1}</div>
        <div class="thumb"><img src="${rel}${esc(w.thumb)}" alt="${esc(w.title)} 표지" width="112" height="112" loading="lazy"></div>
        <div class="info">
          <span class="pf-badge" style="--pf:${pf.color}">${pf.label}</span>
          <h2 class="item-title"><a href="${esc(w.url)}" target="_blank" rel="noopener">${esc(w.title)}</a></h2>
          <div class="meta">${esc(w.author)} · ${AGE_LABEL[w.age] || ""} · ${w.finished ? "완결" : "연재중"} · ${w.genres.map(g => GENRE_LABEL[g] || g).join("·")}</div>
          <p class="synopsis">${esc(cut(w.synopsis, 160))}</p>
          <div class="chips">${reasonChips(p, w)}</div>
          <a class="go" href="${esc(w.url)}" target="_blank" rel="noopener">${pf.label}에서 보기 →</a>
        </div>
      </li>`;
  }).join("");

  return `${head({ title, description, canonical: pageUrl(p), rel, jsonLd })}
<main class="container seo-page">
  <nav class="breadcrumb" aria-label="현재 위치"><a href="${rel}">웹툰지지</a> › <a href="${rel}recommend/">테마별 추천</a> › <span>${esc(p.name)}</span></nav>
  <section class="page-hero">
    <h1>${esc(titleOf(p))}</h1>
    <p>${esc(p.about)} 네이버웹툰·카카오웹툰·레진코믹스에서 조건에 맞는 작품 ${p.total.toLocaleString()}개 중 인기 순으로 ${p.works.length}개를 골랐어요.
    인기 TOP 3: ${top3.map(t => `<b>${esc(t)}</b>`).join(", ")}</p>
    <p class="updated">${TODAY} 기준 · 성인 작품 제외</p>
    <a class="btn primary" href="${rel}#finder">내 취향으로 더 좁혀서 추천받기 →</a>
  </section>
  <ol class="results rank-list">${items}
  </ol>
  <section class="related">
    <h2>함께 보면 좋은 추천</h2>
    <div class="link-chips">${relatedPages(p)}</div>
  </section>
</main>
${foot(rel)}`;
}

// ───────── 허브 페이지 (/recommend/) ─────────
const GROUPS = [
  { type: "genre", title: "장르별 웹툰 추천" },
  { type: "keyword", title: "키워드별 웹툰 추천" },
  { type: "combo", title: "장르 + 키워드 웹툰 추천" },
  { type: "platform", title: "플랫폼별 웹툰 추천" },
  { type: "special", title: "그 밖의 추천" },
];

function linkBlock(prefix) {
  return GROUPS.map(g => {
    const list = pages.filter(p => p.type === g.type);
    if (!list.length) return "";
    return `
    <div class="seo-group">
      <h3>${g.title}</h3>
      <div class="link-chips">${list.map(p => `<a href="${prefix}${p.slug}/">${esc(p.name)}</a>`).join("")}</div>
    </div>`;
  }).join("");
}

function renderHub() {
  const rel = "../";
  const title = "테마별 웹툰 추천 모음 - 장르·키워드·플랫폼별 | 웹툰지지";
  const description = `무협, 판타지, 로맨스, 회귀, 먼치킨 등 ${pages.length}가지 테마별 웹툰 추천 목록. 네이버웹툰·카카오웹툰·레진코믹스 인기작을 테마별로 모았어요.`;
  const jsonLd = {
    "@context": "https://schema.org", "@type": "CollectionPage", name: "테마별 웹툰 추천", url: `${BASE_URL}/recommend/`,
    hasPart: pages.map(p => ({ "@type": "WebPage", name: titleOf(p), url: pageUrl(p) })),
  };
  return `${head({ title, description, canonical: `${BASE_URL}/recommend/`, rel, jsonLd })}
<main class="container seo-page">
  <nav class="breadcrumb" aria-label="현재 위치"><a href="${rel}">웹툰지지</a> › <span>테마별 추천</span></nav>
  <section class="page-hero">
    <h1>테마별 웹툰 추천</h1>
    <p>보고 싶은 장르나 키워드를 골라 보세요. 각 테마마다 네이버웹툰·카카오웹툰·레진코믹스 인기작을 순위대로 모았어요.</p>
    <a class="btn primary" href="${rel}#finder">여러 조건을 섞어서 추천받기 →</a>
  </section>
  ${linkBlock("")}
</main>
${foot(rel)}`;
}

// ───────── 파일 쓰기 ─────────
fs.rmSync(OUT_DIR, { recursive: true, force: true });
for (const p of pages) {
  const dir = path.join(OUT_DIR, p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), renderPage(p));
}
fs.writeFileSync(path.join(OUT_DIR, "index.html"), renderHub());

// sitemap.xml
const urls = [
  { loc: `${BASE_URL}/`, priority: "1.0" },
  { loc: `${BASE_URL}/recommend/`, priority: "0.9" },
  ...pages.map(p => ({ loc: pageUrl(p), priority: p.type === "combo" ? "0.7" : "0.8" })),
];
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${TODAY}</lastmod><changefreq>weekly</changefreq><priority>${u.priority}</priority></url>`).join("\n")}
</urlset>
`);

// rss.xml: 추천 페이지 목록 (네이버 서치어드바이저 RSS 제출용)
const rfc822 = now.toUTCString();
fs.writeFileSync(path.join(ROOT, "rss.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>웹툰지지 - 테마별 웹툰 추천</title>
  <link>${BASE_URL}/</link>
  <description>장르와 키워드로 찾는 네이버웹툰·카카오웹툰·레진코믹스 웹툰 추천</description>
  <language>ko</language>
  <lastBuildDate>${rfc822}</lastBuildDate>
${pages.map(p => `  <item>
    <title>${esc(titleOf(p))}</title>
    <link>${pageUrl(p)}</link>
    <guid>${pageUrl(p)}</guid>
    <description>${esc(`${p.about} 인기 TOP 3: ${p.works.slice(0, 3).map(w => w.title).join(", ")}`)}</description>
    <pubDate>${rfc822}</pubDate>
  </item>`).join("\n")}
</channel>
</rss>
`);

// index.html 의 테마별 추천 링크 영역
const indexFile = path.join(ROOT, "index.html");
const index = fs.readFileSync(indexFile, "utf8");
const START = "<!-- SEO-LINKS:START -->", END = "<!-- SEO-LINKS:END -->";
if (index.includes(START) && index.includes(END)) {
  const before = index.slice(0, index.indexOf(START) + START.length);
  const after = index.slice(index.indexOf(END));
  fs.writeFileSync(indexFile, `${before}${linkBlock("recommend/")}\n    ${after}`);
}

const count = t => pages.filter(p => p.type === t).length;
console.log(`페이지 ${pages.length}개 생성 (장르 ${count("genre")}, 키워드 ${count("keyword")}, 장르+키워드 ${count("combo")}, 플랫폼 ${count("platform")}, 기타 ${count("special")}) + 허브 1개`);
console.log(`sitemap.xml 주소 ${urls.length}개`);
