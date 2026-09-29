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
        <button class="btn primary" id="next" ${state.age === null && !state.adultOnly ? "disabled" : ""}>추천 결과 보기 ✨</button></div>
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
  if (s.match === s.total) return "✓ 고른 조건 모두 일치";
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
      <h2>당신을 위한 추천${state.adultOnly ? `<span class="badge-adult">성인</span>` : ""}</h2>
      <p class="hint">고른 취향에 맞는 작품을 찾았어요.</p>
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
              ${s.reasons.map(r => `<span class="chip hit">✓ ${r}</span>`).join("")}
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
// 각 플랫폼의 공식 인기 순위(data-ranking.js, fetch-ranking.ps1 로 갱신)를 그대로 써요.
// 성인 작품과 완결작은 빼요. "전체"는 네이버와 카카오 순위를 번갈아 섞어요.
// (레진은 로그인 없이 볼 수 있는 작품 규모가 작아서 "전체"에서는 빼고 레진 탭에서만 보여줘요)
const POPULAR_SIZE = 12;
const POPULAR_ALL_PLATFORMS = ["naver", "kakao"];
let popularTab = "all";

const workKey = w => w.platform === "lezhin" ? `lezhin:${w.url.split("/").pop()}` : `${w.platform}:${w.id}`;
const WORK_BY_KEY = new Map(WEBTOONS.map(w => [workKey(w), w]));

// 플랫폼 공식 순위 → 우리 데이터에 있는 연재중 · 비성인 작품 목록
function rankedWorks(platformId) {
  const ids = (window.DATA_RANKING && window.DATA_RANKING[platformId]) || [];
  return ids.map(id => WORK_BY_KEY.get(`${platformId}:${id}`))
    .filter(w => w && w.age !== "RATE_18" && !w.finished);
}

function popularList(tab) {
  if (!window.DATA_RANKING) {
    // 순위 파일이 없으면 인기 점수 순서로 대신 보여줘요
    return WEBTOONS.filter(w => w.age !== "RATE_18" && !w.finished && (tab === "all" || w.platform === tab))
      .sort((a, b) => b.pop - a.pop).slice(0, POPULAR_SIZE);
  }
  if (tab !== "all") return rankedWorks(tab).slice(0, POPULAR_SIZE);
  const lists = POPULAR_ALL_PLATFORMS.filter(id => PLATFORM[id]).map(rankedWorks);
  const mixed = [];
  for (let r = 0; mixed.length < POPULAR_SIZE && lists.some(l => r < l.length); r++) {
    for (const l of lists) if (r < l.length && mixed.length < POPULAR_SIZE) mixed.push(l[r]);
  }
  return mixed;
}

function renderPopular() {
  const box = document.getElementById("popular");
  if (!box) return;
  const top = popularList(popularTab);
  document.querySelectorAll("#popular-tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === popularTab));
  box.innerHTML = top.map((w, i) => `
    <a class="poster" href="${w.url}" target="_blank" rel="noopener" title="${escapeHtml(w.title)}">
      <div class="cover">${coverImg(w)}<span class="num">${i + 1}</span></div>
      <b>${escapeHtml(w.title)}</b>
      <small style="--pf:${PLATFORM[w.platform].color}">${PLATFORM[w.platform].label}</small>
    </a>`).join("");
  const updated = document.getElementById("popular-updated");
  if (updated && window.DATA_RANKING) {
    const d = new Date(window.DATA_RANKING.updatedAt);
    updated.textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} 기준 · 각 플랫폼 공식 인기 순위`;
  }
}

function initPage() {
  // 숫자 채우기
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("stat-total", WEBTOONS.length.toLocaleString());
  set("stat-platforms", PLATFORMS.length);
  set("stat-keywords", KEYWORDS.length);

  // 인기 웹툰 탭
  const tabs = document.getElementById("popular-tabs");
  if (tabs) {
    tabs.innerHTML = `<button data-tab="all">전체</button>` +
      PLATFORMS.map(p => `<button data-tab="${p.id}">${p.label}</button>`).join("");
    tabs.querySelectorAll("button").forEach(b => b.onclick = () => { popularTab = b.dataset.tab; renderPopular(); });
  }
  renderPopular();
  render();
}

initPage();
