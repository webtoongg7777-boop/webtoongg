// 웹툰지지 — 취향 기반 웹툰 추천 (작품 · 장르 · 키워드 정의는 catalog.js)

// 결과는 처음에 PAGE_SIZE 개, "더 보기"를 누를 때마다 MORE_SIZE 개씩 더 보여줘요
const PAGE_SIZE = 5, MORE_SIZE = 10;

const state = {
  step: 0, genres: new Set(), keywords: new Set(), age: null, status: "any", adultOnly: false,
  sort: "match", shown: PAGE_SIZE, platforms: new Set(PLATFORMS.map(p => p.id)),
};

// 선택한 플랫폼의 작품만, 성인 웹툰만 보기를 켜면 18세 이용가 작품만 대상으로 해요
const platformPool = () => WEBTOONS.filter(w => state.platforms.has(w.platform));
const basePool = () => state.adultOnly ? platformPool().filter(w => w.age === "RATE_18") : platformPool();
const app = document.getElementById("app");

const escapeHtml = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function toggle(set, id) { set.has(id) ? set.delete(id) : set.add(id); render(); }
function go(step) {
  state.step = step;
  if (step === 3) state.shown = PAGE_SIZE;
  render();
  document.getElementById("finder").scrollIntoView({ behavior: "smooth", block: "start" });
}

function optionButtons(list, isSelected) {
  return `<div class="options">${list.map(o => `
    <button class="opt ${isSelected(o.id) ? "selected" : ""}" data-id="${o.id}">
      <b>${o.label}</b>${o.desc ? `<small>${o.desc}</small>` : ""}
    </button>`).join("")}</div>`;
}

function bindOptions(container, onClick) {
  container.querySelectorAll(".opt").forEach(btn =>
    btn.addEventListener("click", () => onClick(btn.dataset.id)));
}

function render() {
  document.querySelectorAll("#stepper li").forEach((s, i) => s.classList.toggle("on", i <= state.step));
  if (state.step === 0) renderGenres();
  else if (state.step === 1) renderKeywords();
  else if (state.step === 2) renderConditions();
  else renderResults();
}

function renderGenres() {
  const pool = basePool();
  // 선택한 플랫폼(+성인 모드)에 작품이 있는 장르만, 작품 수와 함께 보여줘요
  const list = GENRES
    .map(g => ({ ...g, count: pool.filter(w => genreMatches(g, w)).length }))
    .filter(g => g.count > 0)
    .map(g => ({ ...g, desc: `${g.desc} · ${g.count.toLocaleString()}개` }));
  for (const id of [...state.genres]) if (!list.some(g => g.id === id)) state.genres.delete(id);
  const adultCount = platformPool().filter(w => w.age === "RATE_18").length;
  const allOn = state.platforms.size === PLATFORMS.length;
  app.innerHTML = `
    <div class="panel">
      <div class="group-title">어디서 볼까요?</div>
      <div class="platforms" id="platforms">
        <button class="pf ${allOn ? "on" : ""}" data-id="all">전체</button>
        ${PLATFORMS.map(p => `
          <button class="pf ${state.platforms.has(p.id) && !allOn ? "on" : ""}" data-id="${p.id}" style="--pf:${p.color}">
            <i></i>${p.label}<small>${WEBTOONS.filter(w => w.platform === p.id).length.toLocaleString()}</small>
          </button>`).join("")}
      </div>
      <button class="adult-toggle ${state.adultOnly ? "on" : ""}" id="adult" aria-pressed="${state.adultOnly}">
        <span class="switch"></span>
        <span><b>성인 웹툰만 보기</b><small>선택한 플랫폼의 18세 이용가 작품 ${adultCount.toLocaleString()}개만 추천해요</small></span>
      </button>
      <div class="group-title">어떤 장르를 좋아하세요? <span style="font-weight:500">(여러 개 선택 가능)</span></div>
      <div id="genres">${optionButtons(list, id => state.genres.has(id))}</div>
      <div class="nav"><span></span>
        <button class="btn primary" id="next" ${state.genres.size ? "" : "disabled"}>다음 →</button></div>
    </div>`;
  bindOptions(app.querySelector("#genres"), id => toggle(state.genres, id));
  app.querySelectorAll("#platforms .pf").forEach(btn => btn.onclick = () => {
    const id = btn.dataset.id;
    if (id === "all") state.platforms = new Set(PLATFORMS.map(p => p.id));
    else if (state.platforms.size === PLATFORMS.length) state.platforms = new Set([id]);   // 전체 상태에서 누르면 그 플랫폼만
    else if (state.platforms.has(id)) { if (state.platforms.size > 1) state.platforms.delete(id); }  // 최소 1개는 선택
    else state.platforms.add(id);
    render();
  });
  app.querySelector("#adult").onclick = () => { state.adultOnly = !state.adultOnly; render(); };
  app.querySelector("#next").onclick = () => go(1);
}

// 1단계에서 고른 장르에 어울리고, 실제로 해당 작품이 있는 키워드만 추려요
function availableKeywords() {
  const picked = GENRES.filter(g => state.genres.has(g.id));
  const pool = basePool().filter(w => picked.some(g => genreMatches(g, w)));
  // BL/GL 은 로맨스 키워드를 그대로 써요
  const kwGenres = new Set(picked.flatMap(g => [g.id, g.keywordsLike].filter(Boolean)));
  return KEYWORDS
    .filter(k => k.genres.some(id => kwGenres.has(id)))
    .map(k => ({ ...k, count: pool.filter(w => k.tags.some(t => w.tags.includes(t))).length }))
    .filter(k => k.count > 0)
    .sort((a, b) => b.count - a.count)
    .map(k => ({ ...k, desc: `작품 ${k.count.toLocaleString()}개` }));
}

function renderKeywords() {
  const list = availableKeywords();
  // 장르를 바꿔서 더 이상 보이지 않는 키워드는 선택 해제
  for (const id of [...state.keywords]) if (!list.some(k => k.id === id)) state.keywords.delete(id);
  const genreNames = GENRES.filter(g => state.genres.has(g.id)).map(g => g.label).join(" · ");
  app.innerHTML = `
    <div class="panel">
      <h2>끌리는 키워드를 골라 주세요</h2>
      <p class="hint">${genreNames}에 어울리는 키워드예요. 많이 고를수록 취향에 가까운 작품이 나와요. 건너뛰어도 괜찮아요.</p>
      ${optionButtons(list, id => state.keywords.has(id))}
      <div class="nav">
        <button class="btn" id="prev">← 이전</button>
        <button class="btn primary" id="next">${state.keywords.size ? "다음 →" : "건너뛰기 →"}</button></div>
    </div>`;
  bindOptions(app, id => toggle(state.keywords, id));
  app.querySelector("#prev").onclick = () => go(0);
  app.querySelector("#next").onclick = () => go(2);
}

function renderConditions() {
  app.innerHTML = `
    <div class="panel">
      <h2>마지막으로 조건을 골라 주세요</h2>
      ${state.adultOnly
        ? `<div class="notice">성인 웹툰만 보는 중이에요. 각 플랫폼에서 보려면 로그인과 성인 인증이 필요해요.</div>`
        : `<p class="hint">연령에 맞지 않는 작품은 결과에서 빠져요.</p>
      <div class="group-title">나이</div>
      <div id="ages">${optionButtons(AGES, id => state.age === Number(id))}</div>`}
      <div class="group-title">연재 상태</div>
      <div id="status">${optionButtons(STATUS, id => state.status === id)}</div>
      <div class="nav">
        <button class="btn" id="prev">← 이전</button>
        <button class="btn primary" id="next" ${state.age === null && !state.adultOnly ? "disabled" : ""}>추천 결과 보기 →</button></div>
    </div>`;
  if (!state.adultOnly) bindOptions(app.querySelector("#ages"), id => { state.age = Number(id); render(); });
  bindOptions(app.querySelector("#status"), id => { state.status = id; render(); });
  app.querySelector("#prev").onclick = () => go(1);
  app.querySelector("#next").onclick = () => go(3);
}

// ───────── 추천 점수 계산 ─────────
function recommend() {
  const pickedGenres = GENRES.filter(g => state.genres.has(g.id));
  const pickedKeywords = KEYWORDS.filter(k => state.keywords.has(k.id));

  // 필수 조건: 연령 · 연재 상태 · 선택한 장르 중 하나 이상
  const candidates = basePool().filter(w =>
    (state.adultOnly || (AGE_ORDER[w.age] ?? 18) <= state.age) &&
    (state.status === "any" || (state.status === "finished") === w.finished) &&
    pickedGenres.some(g => genreMatches(g, w)));

  const total = pickedGenres.length + pickedKeywords.length;
  let list = candidates.map(w => {
    const reasons = [], matchedGenres = [];
    let keywordHits = 0;
    for (const g of pickedGenres) {
      if (genreMatches(g, w)) { reasons.push(g.label); matchedGenres.push(g.id); }
    }
    for (const k of pickedKeywords) {
      if (k.tags.some(t => w.tags.includes(t))) { keywordHits++; reasons.push(k.label); }
    }
    return { w, reasons, keywordHits, matchedGenres, match: reasons.length, total };
  });

  if (state.sort === "popular") {
    // 관심순: 키워드를 골랐다면 키워드가 하나 이상 맞는 작품만, 인기 순서로
    if (pickedKeywords.length) list = list.filter(s => s.keywordHits > 0);
    list.sort((a, b) => b.w.pop - a.w.pop || b.w.favorites - a.w.favorites);
  } else {
    // 추천순: 고른 조건이 많이 일치할수록 위로, 일치 개수가 같으면 인기 순서로
    list.sort((a, b) => b.match - a.match || b.w.pop - a.w.pop || b.w.favorites - a.w.favorites);
  }
  return list;
}

function matchLabel(s) {
  if (s.match === s.total) return "고른 조건 모두 일치";
  return `고른 조건 ${s.total}개 중 ${s.match}개 일치`;
}

function coverImg(w) {
  const alt = escapeHtml(`${w.title} 표지`);
  const fallback = escapeHtml(w.title).replace(/'/g, "");
  return `<img src="${w.thumb}" alt="${alt}" loading="lazy"
    onerror="this.parentNode.innerHTML='<div class=&quot;fallback&quot;>${fallback}</div>'">`;
}

const GENRE_LABEL = Object.fromEntries(GENRES.map(g => [g.id, g.label]));
GENRE_LABEL.DAILY = "일상";
GENRE_LABEL.SENSIBILITY = "감성";

function renderResults() {
  const all = recommend();
  const top = all.slice(0, state.shown);
  const picked = [...GENRES.filter(g => state.genres.has(g.id)).map(g => g.label),
                  ...KEYWORDS.filter(k => state.keywords.has(k.id)).map(k => k.label)];

  app.innerHTML = `
    <div class="panel">
      <h2>추천 결과${state.adultOnly ? `<span class="badge-adult">성인</span>` : ""}</h2>
      <p class="hint">고른 장르와 키워드가 많이 맞는 작품부터 보여 드려요.</p>
      <div class="picked">${picked.map(p => `<span class="chip">${p}</span>`).join("")}</div>
      <div class="sortbar">
        <span class="count">조건에 맞는 작품 <b>${all.length.toLocaleString()}</b>개</span>
        <div class="seg" id="sort">
          <button data-sort="match" class="${state.sort === "match" ? "on" : ""}" title="고른 조건이 많이 맞는 순서, 같으면 인기 순서">추천순</button>
          <button data-sort="popular" class="${state.sort === "popular" ? "on" : ""}" title="인기가 많은 순서">관심순</button>
        </div>
      </div>
      ${top.length ? `<div class="results">${top.map((s, i) => {
        const p = PLATFORM[s.w.platform];
        return `
        ${state.sort === "match" && (i === 0 || top[i - 1].match !== s.match)
          ? `<div class="tier">${matchLabel(s)}</div>` : ""}
        <a class="card" href="${s.w.url}" target="_blank" rel="noopener">
          <div class="rank">${i + 1}</div>
          <div class="thumb">${coverImg(s.w)}</div>
          <div class="info">
            <span class="pf-badge" style="--pf:${p.color}">${p.label}</span>
            <h3>${escapeHtml(s.w.title)}${s.w.age === "RATE_18" ? `<span class="badge-adult">19</span>` : ""}</h3>
            <div class="meta">${escapeHtml(s.w.author)} · ${AGE_LABEL[s.w.age] || ""} · ${s.w.finished ? "완결" : "연재중"} · ${p.metric} ${s.w.favorites.toLocaleString()}</div>
            <p class="synopsis">${escapeHtml(s.w.synopsis)}</p>
            <div class="chips">
              ${s.reasons.map(r => `<span class="chip hit">${r}</span>`).join("")}
              ${s.w.genres.filter(g => !s.reasons.includes(GENRE_LABEL[g])).map(g => `<span class="chip">${GENRE_LABEL[g] || g}</span>`).join("")}
            </div>
            <span class="go">${p.label}에서 보기 →</span>
          </div>
        </a>`; }).join("")}</div>
        ${all.length > top.length
          ? `<button class="btn more" id="more">더 보기 (${top.length} / ${all.length.toLocaleString()})</button>`
          : `<p class="end">조건에 맞는 작품을 모두 보여드렸어요.</p>`}`
      : `<div class="notice">조건에 맞는 작품이 없어요. 나이나 연재 상태 조건을 바꿔 보세요.</div>`}
      <div class="nav">
        <button class="btn" id="prev">← 조건 바꾸기</button>
        <button class="btn primary" id="restart">처음부터 다시</button></div>
    </div>`;
  app.querySelectorAll("#sort button").forEach(b => b.onclick = () => {
    state.sort = b.dataset.sort; state.shown = PAGE_SIZE; render();
  });
  const more = app.querySelector("#more");
  if (more) more.onclick = () => {
    const y = window.scrollY;
    state.shown += MORE_SIZE; render();
    window.scrollTo({ top: y });   // 누른 위치 그대로 이어서 보기
  };
  app.querySelector("#prev").onclick = () => go(2);
  app.querySelector("#restart").onclick = () => {
    state.genres.clear(); state.keywords.clear(); state.age = null; state.status = "any"; go(0);
  };
}

// ───────── 지금 인기 웹툰 ─────────
// 매일 다르게 보이도록 네 가지 보기를 제공해요. 성인 작품과 완결작은 빼요.
//  - 실시간 인기 : 각 플랫폼 공식 인기 순위 (data-ranking.js)
//  - 오늘 연재   : 오늘 요일(한국 시간)에 연재되는 작품의 요일별 인기 순서
//  - 신작        : 최근 시작한 연재작(작품 번호가 큰 순서) 중 인기 있는 작품
//  - 숨은 명작   : 1위권 바로 아래 인기작을 날짜마다 다르게 골라, 장르가 골고루 섞이게
// "전체"는 네이버와 카카오를 번갈아 섞어요. (레진은 규모가 작아서 레진 칸에서만 보여줘요)
const POPULAR_SIZE = 12;
const POPULAR_ALL_PLATFORMS = ["naver", "kakao"];
const POPULAR_MODES = [
  { id: "rank",  label: "실시간 인기" },
  { id: "today", label: "오늘 연재" },
  { id: "new",   label: "신작" },
  { id: "gems",  label: "숨은 명작" },
];
const DAY_LABEL = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };
let popularTab = "all", popularMode = "rank";

const workKey = w => w.platform === "lezhin" ? `lezhin:${w.url.split("/").pop()}` : `${w.platform}:${w.id}`;
const WORK_BY_KEY = new Map(WEBTOONS.map(w => [workKey(w), w]));
const showable = w => w && w.age !== "RATE_18" && !w.finished;

// 한국 시간 기준 오늘 요일(mon~sun)과 날짜
const kstNow = () => new Date(Date.now() + 9 * 3600 * 1000);
const todayKey = () => ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][kstNow().getUTCDay()];
const todayStr = () => kstNow().toISOString().slice(0, 10);

// 날짜가 같으면 같은 결과가 나오는 뒤섞기 (방문자마다 같은 "오늘의 숨은 명작")
function seededShuffle(list, seedText) {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rand = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// 플랫폼 공식 순위 → 우리 데이터에 있는 연재중 · 비성인 작품 목록
function rankedWorks(platformId) {
  const ids = (window.DATA_RANKING && window.DATA_RANKING[platformId]) || [];
  return ids.map(id => WORK_BY_KEY.get(`${platformId}:${id}`)).filter(showable);
}
function todayWorks(platformId) {
  const byDay = window.DATA_RANKING && window.DATA_RANKING.byDay && window.DATA_RANKING.byDay[platformId];
  const ids = (byDay && byDay[todayKey()]) || [];
  return ids.map(id => WORK_BY_KEY.get(`${platformId}:${id}`)).filter(showable);
}
function newWorks(platformId) {
  const list = WEBTOONS.filter(w => w.platform === platformId && showable(w));
  return list.sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 80)   // 가장 최근에 시작한 80개 중
    .sort((a, b) => b.pop - a.pop);                                       // 반응 좋은 순서
}
function gemWorks(platformIds) {
  const top = new Set(platformIds.flatMap(id => rankedWorks(id).slice(0, 30)));
  const pool = WEBTOONS.filter(w => platformIds.includes(w.platform) && showable(w) && !top.has(w) && w.pop >= 0.55 && w.pop <= 0.95);
  // 장르별로 묶은 뒤 장르를 돌아가며 하나씩 뽑아요
  const byGenre = new Map();
  for (const w of seededShuffle(pool, todayStr())) {
    const g = (GENRES.find(g => genreMatches(g, w)) || { id: "ETC" }).id;
    if (!byGenre.has(g)) byGenre.set(g, []);
    byGenre.get(g).push(w);
  }
  const lists = seededShuffle([...byGenre.values()], todayStr() + "g"), picked = [];
  for (let r = 0; picked.length < POPULAR_SIZE && lists.some(l => r < l.length); r++) {
    for (const l of lists) if (r < l.length && picked.length < POPULAR_SIZE) picked.push(l[r]);
  }
  return picked;
}

function interleave(lists) {
  const mixed = [], seen = new Set();
  for (let r = 0; mixed.length < POPULAR_SIZE && lists.some(l => r < l.length); r++) {
    for (const l of lists) if (r < l.length && mixed.length < POPULAR_SIZE && !seen.has(l[r])) { seen.add(l[r]); mixed.push(l[r]); }
  }
  return mixed;
}

function popularList(tab, mode) {
  const platformIds = tab === "all" ? POPULAR_ALL_PLATFORMS.filter(id => PLATFORM[id]) : [tab];
  if (mode === "gems") return gemWorks(platformIds);
  if (!window.DATA_RANKING && mode !== "new") {
    // 순위 파일이 없으면 인기 점수 순서로 대신 보여줘요
    return WEBTOONS.filter(w => showable(w) && platformIds.includes(w.platform)).sort((a, b) => b.pop - a.pop).slice(0, POPULAR_SIZE);
  }
  const fn = mode === "today" ? todayWorks : mode === "new" ? newWorks : rankedWorks;
  return interleave(platformIds.map(fn));
}

// 순위 갱신 시각 (예: "10월 5일 03:12 기준")
function rankingTime() {
  const r = window.DATA_RANKING;
  if (!r) return "";
  const d = new Date(r.updatedAt);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} 기준`;
}

function popularCaption(mode) {
  const time = rankingTime();
  if (mode === "today") return `오늘(${DAY_LABEL[todayKey()]}요일) 연재되는 웹툰을 요일별 인기 순서로 모았어요.`;
  if (mode === "new") return "최근 연재를 시작한 작품 중 반응이 좋은 작품이에요.";
  if (mode === "gems") return "1위권 바로 아래에서 꾸준히 사랑받는 작품을 장르별로 골랐어요. 매일 다른 작품이 나와요.";
  return `${time} · 각 플랫폼 공식 인기 순위`;
}

function renderPopular() {
  const box = document.getElementById("popular");
  if (!box) return;
  const top = popularList(popularTab, popularMode);
  document.querySelectorAll("#popular-tabs [data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === popularTab));
  document.querySelectorAll("#popular-tabs [data-mode]").forEach(b => b.classList.toggle("on", b.dataset.mode === popularMode));
  const numbered = popularMode !== "gems";
  box.innerHTML = top.length ? top.map((w, i) => `
    <a class="poster" href="${w.url}" target="_blank" rel="noopener" title="${escapeHtml(w.title)}">
      <div class="cover">${coverImg(w)}</div>
      <b>${numbered ? `<span class="num">${i + 1}</span>` : ""}${escapeHtml(w.title)}</b>
      <small style="--pf:${PLATFORM[w.platform].color}">${PLATFORM[w.platform].label}</small>
    </a>`).join("")
    : `<p class="end" style="grid-column:1/-1">이 조건에 맞는 작품이 아직 없어요. 다른 탭을 눌러 보세요.</p>`;
  const updated = document.getElementById("popular-updated");
  if (updated) updated.textContent = popularCaption(popularMode);
}

// 첫 화면 "요즘 다들 보는 웹툰": 지금 실시간 15위 안에 있으면서, 쌓인 인기도 전체 상위 5%(pop 0.95 이상)인 대중작
// 자리는 네이버 2 · 카카오 2 · 레진 1, 조건에 맞는 작품이 모자란 플랫폼 자리는 다른 플랫폼 대중작으로 채워요.
// 가벼운 일상 · 개그 컷툰과 성인 · 완결작은 빼요. 보여주는 순위 숫자는 공식 실시간 순위 그대로예요.
const HERO_SLOTS = [["naver", 2], ["kakao", 2], ["lezhin", 1]];
const HERO_TOP = 15, HERO_MIN_POP = 0.95;
function heroPicks() {
  const ranking = window.DATA_RANKING || {};
  const isLight = w => w.genres.every(g => g === "COMIC" || g === "DAILY");
  const pools = HERO_SLOTS.filter(([id]) => PLATFORM[id]).map(([id, n]) => ({
    n,
    list: (ranking[id] || []).slice(0, HERO_TOP)
      .map((workId, i) => ({ w: WORK_BY_KEY.get(`${id}:${workId}`), platformRank: i + 1 }))
      .filter(c => showable(c.w) && !isLight(c.w) && c.w.pop >= HERO_MIN_POP)
      .sort((a, b) => b.w.pop - a.w.pop),
  }));
  const picked = pools.flatMap(p => p.list.slice(0, p.n));
  const size = HERO_SLOTS.reduce((s, [, n]) => s + n, 0);
  const rest = pools.flatMap(p => p.list.slice(p.n)).sort((a, b) => b.w.pop - a.w.pop);
  return [...picked, ...rest.slice(0, size - picked.length)].sort((a, b) => a.platformRank - b.platformRank);   // 실시간 순위가 높은 순서로
}
// 줄거리 첫 문장만 (궁금증이 생길 만큼만 짧게)
function hook(synopsis) {
  const s = String(synopsis || "").replace(/\s+/g, " ").trim();
  const m = s.match(/^.{12,}?[.!?…](?=\s|$)/);
  return m ? m[0] : s;
}

function initPage() {
  // 숫자 채우기
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("stat-total", WEBTOONS.length.toLocaleString());
  set("stat-platforms", PLATFORMS.length);
  set("stat-keywords", KEYWORDS.length);

  // 첫 화면 오른쪽: 요즘 다들 보는 웹툰
  const picks = document.getElementById("hero-picks");
  if (picks) {
    picks.innerHTML = heroPicks().map(({ w, platformRank }) => {
      const p = PLATFORM[w.platform];
      const genre = GENRE_LABEL[w.genres[0]];   // 플랫폼이 정한 대표 장르
      return `
      <li><a href="${w.url}" target="_blank" rel="noopener">
        <div class="hp-cover">${coverImg(w)}</div>
        <div class="hp-info">
          <span class="hp-rank" style="--pf:${p.color}">${p.short} 실시간 ${platformRank}위${genre ? ` · ${genre}` : ""}</span>
          <b>${escapeHtml(w.title)}</b>
          <p>${escapeHtml(hook(w.synopsis))}</p>
        </div>
      </a></li>`;
    }).join("");
    set("hero-board-time", rankingTime());
  }

  // 인기 웹툰 탭: 보기 방식(실시간 인기 · 오늘 연재 · 신작 · 숨은 명작) + 플랫폼
  const tabs = document.getElementById("popular-tabs");
  if (tabs) {
    tabs.innerHTML =
      `<div class="tabs modes">${POPULAR_MODES.map(m => `<button data-mode="${m.id}">${m.label}</button>`).join("")}</div>` +
      `<div class="tabs platforms-mini"><button data-tab="all">전체</button>` +
      PLATFORMS.map(p => `<button data-tab="${p.id}">${p.label}</button>`).join("") + `</div>`;
    tabs.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { popularMode = b.dataset.mode; renderPopular(); });
    tabs.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { popularTab = b.dataset.tab; renderPopular(); });
  }
  renderPopular();
  render();
}

initPage();
