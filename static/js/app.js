/* Jelajah Halal — Muslim-friendly travel guide to Malaysia.
   Hash-routed front-end over the FastAPI backend. */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* Listings are written in an enthusiastic marketing voice that opens with emoji.
   Strip the leading run for card summaries; the full text stays in the detail view. */
const LEAD_EMOJI = /^[\p{Extended_Pictographic}\p{Emoji_Component}‍️\s]+/u;
const clean = s => String(s ?? "").replace(LEAD_EMOJI, "").trim();
const trunc = (s, n) => s.length > n ? s.slice(0, n).trim() + "…" : s;

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (!r.ok) throw new Error((await r.text()) || r.status);
  return r.json();
}
let toastT;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2800);
}

const CAT_ICON = {
  "Mosques & Islamic Sites": "🕌", "Places to Visit": "📍", "Shopping Malls": "🛍️",
  "Theme Parks (Outside KL)": "🎢", "For Children": "🧸", "Outdoor Adventures": "🥾",
  "Beaches & Islands": "🏝️", "Night Markets & Entertainment": "🌙", "Day Trips from KL": "🚗",
  "Food & Dining": "🍜", "Local Fruits": "🥭", "Healthcare": "🏥", "Stays": "🏨",
};
const icon = c => CAT_ICON[c] || "📍";

/* ─────────────── saved places (localStorage) ─────────────── */
const FAV_KEY = "jh.favs";
let FAVS = [];
try { FAVS = JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch { FAVS = []; }
const favId = p => `${p.kind}:${p.id}`;
const isFav = p => FAVS.some(f => f.uid === favId(p));
function toggleFav(p) {
  const uid = favId(p), i = FAVS.findIndex(f => f.uid === uid);
  if (i >= 0) { FAVS.splice(i, 1); toast("Removed from saved places"); }
  else { FAVS.push({ uid, kind: p.kind, id: p.id, name: p.name, category: p.category }); toast("Saved · see Plan a Trip"); }
  localStorage.setItem(FAV_KEY, JSON.stringify(FAVS));
  $$(`[data-fav="${uid}"]`).forEach(b => { b.classList.toggle("on", isFav(p)); b.setAttribute("aria-pressed", isFav(p)); });
  if (currentRoute() === "plan") renderFavs();
}

/* ─────────────── place card ─────────────── */
// Placeholder markup is built once via string interpolation, escaped as normal —
// but the <img> itself is created as a real DOM node so its error handler can be
// wired with .onerror = fn (a property assignment) rather than an inline
// onerror="..." HTML attribute, which the CSP's script-src blocks.
function placeholderMedia(category) {
  const d = el("div", "ph", icon(category));
  d.setAttribute("aria-hidden", "true");
  return d;
}
function placeCard(p) {
  const card = el("button", "pcard");
  card.type = "button";
  const where = [p.state, p.distance].filter(Boolean).join(" · ");
  card.innerHTML = `
    <div class="pcard-media">
      ${p.featured ? `<span class="featured-badge">⭐ Featured</span>` : ""}
      <span class="fav-btn ${isFav(p) ? "on" : ""}" data-fav="${favId(p)}" role="button"
            tabindex="0" aria-label="Save ${esc(p.name)}" aria-pressed="${isFav(p)}">★</span>
    </div>
    <div class="pcard-body">
      <div class="kicker"><span class="tag">${icon(p.category)} ${esc(p.category)}</span>
        ${p.subcategory ? `<span class="tag plain">${esc(trunc(p.subcategory, 28))}</span>` : ""}</div>
      <h3>${esc(p.name)}</h3>
      <p class="snippet">${esc(trunc(clean(p.description), 150))}</p>
      ${where ? `<div class="foot">${esc(where)}</div>` : ""}
    </div>`;
  const media = card.querySelector(".pcard-media");
  if (p.thumb) {
    const img = new Image();
    img.src = p.thumb; img.alt = ""; img.loading = "lazy";
    img.onerror = () => img.replaceWith(placeholderMedia(p.category));
    media.prepend(img);
  } else {
    media.prepend(placeholderMedia(p.category));
  }
  card.onclick = e => {
    if (e.target.closest("[data-fav]")) { toggleFav(p); return; }
    openDrawer(p.kind, p.id);
  };
  card.querySelector("[data-fav]").addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); toggleFav(p); }
  });
  return card;
}
const skeletons = (n, host) => { host.innerHTML = ""; for (let i = 0; i < n; i++) host.appendChild(el("div", "skel")); };

/* ─────────────── detail drawer ─────────────── */
let lastFocus = null;
async function openDrawer(kind, id) {
  lastFocus = document.activeElement;
  const bg = $("#drawerBg"), body = $("#drawerBody");
  body.innerHTML = `<div class="drawer-body"><p class="muted">Loading…</p></div>`;
  bg.hidden = false; document.body.style.overflow = "hidden";
  $("#drawer").focus();
  let p;
  try { p = await api(`/api/places/${kind}/${id}`); }
  catch { body.innerHTML = `<div class="drawer-body"><p class="muted">Could not load this place.</p></div>`; return; }

  const meta = [
    ["Category", p.category], ["Type", p.subcategory], ["State", p.state],
    ["Distance", p.distance], ["Travel time", p.travel_time],
  ].filter(([, v]) => v);
  const yt = `https://www.youtube.com/results?search_query=${encodeURIComponent(p.name + " Malaysia")}`;
  const bookingLinks = p.kind === "stay" ? [
    ["Booking.com", `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(p.name + " " + (p.state || "Malaysia"))}`],
    ["Agoda", `https://www.agoda.com/search?city=${encodeURIComponent(p.state || "Malaysia")}&q=${encodeURIComponent(p.name)}`],
    ["Airbnb", `https://www.airbnb.com/s/${encodeURIComponent(p.state || "Malaysia")}/homes?query=${encodeURIComponent(p.name)}`],
  ] : [];

  body.innerHTML = `
    ${p.thumb ? `<img class="drawer-hero" src="${esc(p.thumb)}" alt="">`
              : `<div class="drawer-hero ph">${icon(p.category)}</div>`}
    <div class="drawer-body">
      <span class="tag">${icon(p.category)} ${esc(p.category)}</span>
      ${p.featured ? `<span class="tag" style="background:var(--gold);color:#2e2205">⭐ Featured</span>` : ""}
      <h2 id="drawerTitle">${esc(p.name)}</h2>
      <p class="desc">${esc(p.description)}</p>
      ${meta.length ? `<ul class="meta-list">${meta.map(([k, v]) =>
        `<li><dt>${k}</dt><dd>${esc(v)}</dd></li>`).join("")}</ul>` : ""}
      <div class="drawer-actions">
        ${p.maps_url ? `<a class="btn sm" href="${esc(p.maps_url)}" target="_blank" rel="noopener">📍 Directions</a>` : ""}
        ${p.website ? `<a class="btn ghost sm" href="${esc(p.website)}" target="_blank" rel="noopener">🔗 Official site</a>` : ""}
        ${bookingLinks.map(([label, url]) => `<a class="btn ghost sm" href="${esc(url)}" target="_blank" rel="noopener">🛏️ ${label}</a>`).join("")}
        <a class="btn ghost sm" href="${yt}" target="_blank" rel="noopener">▶️ Videos</a>
        <button class="btn ghost sm" id="dFav" type="button">${isFav(p) ? "★ Saved" : "☆ Save"}</button>
        <button class="btn ghost sm" id="dRev" type="button">Write a review</button>
      </div>
      <h3>Reviews ${p.reviews.length ? `<span class="muted sm">(${p.reviews.length})</span>` : ""}</h3>
      <div class="rev-list">${p.reviews.length
        ? p.reviews.map(r => `<div class="rev">
            <div class="stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</div>
            <div class="who">${esc(r.author)}</div><p>${esc(r.comment)}</p></div>`).join("")
        : `<p class="empty-note">No reviews yet — be the first.</p>`}</div>
    </div>`;

  $("#dFav").onclick = () => { toggleFav(p); $("#dFav").textContent = isFav(p) ? "★ Saved" : "☆ Save"; };
  $("#dRev").onclick = () => openReview(p.name);
}
function closeDrawer() {
  $("#drawerBg").hidden = true; document.body.style.overflow = "";
  lastFocus?.focus();
}

/* ─────────────── router ─────────────── */
const ROUTES = ["home", "explore", "plan", "prayer", "map", "info"];
const parseHash = () => {
  const [path, qs] = (location.hash.replace(/^#\/?/, "") || "home").split("?");
  return { route: ROUTES.includes(path) ? path : "home", params: new URLSearchParams(qs || "") };
};
const currentRoute = () => parseHash().route;

const loaded = {};
function router() {
  const { route, params } = parseHash();
  ROUTES.forEach(r => { $(`#view-${r}`).hidden = r !== route; });
  $$("#navLinks a").forEach(a => a.classList.toggle("active", a.dataset.route === route));
  $("#navLinks").classList.remove("show");
  window.scrollTo({ top: 0, behavior: "instant" });

  if (route === "explore") return renderExplore(params);
  // "plan" mixes one-time wiring (initPlan, cached below) with state that can
  // change on other routes (favourites) — re-render that part on every visit.
  if (route === "plan" && loaded.plan) { renderFavs(); renderPlan(); return; }
  if (loaded[route]) return;
  loaded[route] = true;
  ({ home: initHome, plan: initPlan, prayer: initPrayer, map: initMap, info: initInfo }[route] || (() => {}))();
}

/* ─────────────── home ─────────────── */
async function initHome() {
  try {
    const s = await api("/api/stats");
    $("#heroStats").innerHTML = [
      [s.mosques, "Mosques"], [s.attractions, "Attractions"],
      [s.food, "Halal dishes"], [s.accommodation + s.medical, "Stays & clinics"],
    ].map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join("");
  } catch {}

  try {
    const f = await api("/api/places/filters");
    $("#catGrid").innerHTML = f.categories.map(c => `
      <a class="cat-tile" href="#/explore?category=${encodeURIComponent(c.name)}">
        <div class="ico">${icon(c.name)}</div><b>${esc(c.name)}</b><span>${c.count} place${c.count === 1 ? "" : "s"}</span>
      </a>`).join("");
    $("#stateChips").innerHTML = f.states.map(s => `
      <a class="chip-link" href="#/explore?state=${encodeURIComponent(s.name)}">${esc(s.name)}<span class="n">${s.count}</span></a>`).join("");
  } catch {}

  try {
    const d = await api("/api/places?sort=photo&limit=8");
    const g = $("#featuredGrid"); g.innerHTML = "";
    d.items.forEach(p => g.appendChild(placeCard(p)));
  } catch {}

  try {
    const d = await api("/api/prayer-times?city=Kuala Lumpur");
    $("#homePrayer").innerHTML = Object.entries(d.times)
      .map(([k, v]) => `<div class="pt"><b>${v}</b><span>${k}</span></div>`).join("");
    $("#homePrayerNote").textContent = `${d.city} · ${d.date}`;
  } catch { $("#homePrayerNote").textContent = "Prayer times unavailable."; }

  $("#heroSearchForm").onsubmit = e => {
    e.preventDefault();
    location.hash = "#/explore?q=" + encodeURIComponent($("#heroSearch").value.trim());
  };
}

/* ─────────────── explore ─────────────── */
let filtersReady = false, searchTimer;
const PER_PAGE = 24;

async function renderExplore(params) {
  if (!filtersReady) {
    filtersReady = true;
    try {
      const f = await api("/api/places/filters");
      $("#fCategory").innerHTML = `<option value="">All categories</option>` +
        f.categories.map(c => `<option value="${esc(c.name)}">${esc(c.name)} (${c.count})</option>`).join("");
      $("#fState").innerHTML = `<option value="">All of Malaysia</option>` +
        f.states.map(s => `<option value="${esc(s.name)}">${esc(s.name)} (${s.count})</option>`).join("");
    } catch {}
    const push = () => {
      const q = new URLSearchParams();
      if ($("#fSearch").value.trim()) q.set("q", $("#fSearch").value.trim());
      if ($("#fCategory").value) q.set("category", $("#fCategory").value);
      if ($("#fState").value) q.set("state", $("#fState").value);
      if ($("#fSort").value !== "name") q.set("sort", $("#fSort").value);
      location.hash = "#/explore" + (q.toString() ? "?" + q : "");
    };
    $("#fSearch").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(push, 350); });
    ["#fCategory", "#fState", "#fSort"].forEach(s => $(s).addEventListener("change", push));
    $("#clearFilters").onclick = () => { location.hash = "#/explore"; };
    $("#toggleFilters").onclick = () => $("#filterPanel").classList.toggle("show");
  }

  const q = params.get("q") || "", category = params.get("category") || "";
  const state = params.get("state") || "", sort = params.get("sort") || "name";
  const page = Math.max(1, parseInt(params.get("page") || "1", 10));
  if ($("#fSearch").value !== q) $("#fSearch").value = q;
  $("#fCategory").value = category; $("#fState").value = state; $("#fSort").value = sort;

  const grid = $("#resultGrid");
  skeletons(6, grid);
  $("#pager").innerHTML = "";

  const qs = new URLSearchParams({ sort, limit: PER_PAGE, offset: (page - 1) * PER_PAGE });
  if (q) qs.set("q", q);
  if (category) qs.set("category", category);
  if (state) qs.set("state", state);

  let d;
  try { d = await api("/api/places?" + qs); }
  catch { grid.innerHTML = `<p class="empty-note">Could not load results.</p>`; return; }

  const bits = [category, state].filter(Boolean).join(" · ");
  $("#resultCount").textContent = d.total
    ? `${d.total} place${d.total === 1 ? "" : "s"}${bits ? " in " + bits : ""}${q ? ` matching “${q}”` : ""}`
    : "No matches";

  grid.innerHTML = "";
  if (!d.total) {
    const empty = el("div", "empty-state",
      `<div class="big">🔍</div><p>Nothing matched those filters.</p>`);
    empty.style.gridColumn = "1/-1";
    const clear = el("button", "btn ghost sm", "Clear filters");
    clear.type = "button"; clear.onclick = () => { location.hash = "#/explore"; };
    empty.appendChild(clear);
    grid.appendChild(empty);
    return;
  }
  d.items.forEach(p => grid.appendChild(placeCard(p)));
  renderPager(page, Math.ceil(d.total / PER_PAGE), params);
}

function renderPager(page, pages, params) {
  const nav = $("#pager"); nav.innerHTML = "";
  if (pages < 2) return;
  const go = n => { const p = new URLSearchParams(params); p.set("page", n); location.hash = "#/explore?" + p; };
  const btn = (label, n, opts = {}) => {
    const b = el("button", null, label);
    if (opts.current) b.setAttribute("aria-current", "true");
    if (opts.disabled) b.disabled = true; else b.onclick = () => go(n);
    nav.appendChild(b);
  };
  btn("‹ Prev", page - 1, { disabled: page === 1 });
  const nums = new Set([1, pages, page, page - 1, page + 1]);
  let prev = 0;
  [...nums].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b).forEach(n => {
    if (n - prev > 1) nav.appendChild(el("span", "gap", "…"));
    btn(String(n), n, { current: n === page });
    prev = n;
  });
  btn("Next ›", page + 1, { disabled: page === pages });
}

/* ─────────────── plan ─────────────── */
let PLAN = [];
function renderFavs() {
  const host = $("#favList");
  $("#favCount").textContent = FAVS.length ? `(${FAVS.length})` : "";
  $("#favEmpty").hidden = FAVS.length > 0;
  host.innerHTML = "";
  FAVS.forEach(f => {
    const row = el("div", "row-item",
      `<span>${icon(f.category)} ${esc(f.name)}</span>
       <span><button data-add title="Add to itinerary">＋</button><button data-del title="Remove">✕</button></span>`);
    row.querySelector("[data-add]").onclick = () => {
      if (PLAN.includes(f.name)) return toast("Already in your itinerary");
      PLAN.push(f.name); renderPlan();
    };
    row.querySelector("[data-del]").onclick = () => {
      FAVS = FAVS.filter(x => x.uid !== f.uid);
      localStorage.setItem(FAV_KEY, JSON.stringify(FAVS)); renderFavs();
    };
    host.appendChild(row);
  });
}
function renderPlan() {
  const host = $("#planList");
  $("#planEmpty").hidden = PLAN.length > 0;
  host.innerHTML = "";
  PLAN.forEach((name, i) => {
    const row = el("div", "row-item", `<span>${i + 1}. ${esc(name)}</span><button data-del>✕</button>`);
    row.querySelector("[data-del]").onclick = () => { PLAN.splice(i, 1); renderPlan(); };
    host.appendChild(row);
  });
}
async function loadSavedTrips() {
  const host = $("#savedList");
  try {
    const trips = await api("/api/itineraries");
    if (!trips.length) { host.innerHTML = `<p class="empty-note">No saved itineraries yet.</p>`; return; }
    host.innerHTML = "";
    trips.forEach(t => {
      const item = el("div", "saved-item", `
        <div><b>${esc(t.name)}</b><br><span class="muted sm">${esc(t.items.join(" · "))}</span><br>
        <span class="muted sm">#${t.id} · ${esc(t.created_at)}</span></div>
        <button class="btn ghost sm" data-del>Delete</button>`);
      item.querySelector("[data-del]").onclick = async () => {
        await api("/api/itineraries/" + t.id, { method: "DELETE" }); toast("Deleted"); loadSavedTrips();
      };
      host.appendChild(item);
    });
  } catch { host.innerHTML = `<p class="empty-note">Could not load saved itineraries.</p>`; }
}
function initPlan() {
  wireTabs("#view-plan", tab => { if (tab === "saved") loadSavedTrips(); });
  const draw = async () => {
    const wrap = $("#itinDays"); wrap.innerHTML = `<p class="muted">Loading…</p>`;
    try {
      const days = await api("/api/itineraries/prebuilt?duration=" + encodeURIComponent($("#itinSel").value));
      wrap.innerHTML = days.map(d => `
        <div class="day-card"><span class="daynum">Day ${d.day}</span>
          ${d.items.map(i => `<div class="activity">
            ${i.type ? `<span class="tag">${esc(i.type)}</span>` : ""}
            <div><b>${esc(i.activity)}</b> <span class="loc">— ${esc(i.location)}</span></div>
            ${i.why ? `<p>${esc(i.why)}</p>` : ""}
            ${i.tips ? `<p>💡 ${esc(i.tips)}</p>` : ""}</div>`).join("")}
        </div>`).join("");
    } catch { wrap.innerHTML = `<p class="empty-note">Could not load itineraries.</p>`; }
  };
  $("#itinSel").onchange = draw; draw();
  renderFavs(); renderPlan();
  $("#clearPlan").onclick = () => { PLAN = []; renderPlan(); };
  $("#saveTrip").onclick = async () => {
    if (!PLAN.length) return toast("Add some places first");
    const name = $("#tripName").value.trim() || "My Malaysia trip";
    try {
      const r = await api("/api/itineraries", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, items: PLAN }),
      });
      toast("Itinerary saved · #" + r.id); $("#tripName").value = ""; loadSavedTrips();
    } catch { toast("Could not save itinerary"); }
  };
}

/* ─────────────── prayer ─────────────── */
async function initPrayer() {
  let cities = [];
  try { cities = await api("/api/cities"); } catch { return; }
  const opts = cities.map(c => `<option>${esc(c)}</option>`).join("");
  $("#citySel").innerHTML = opts; $("#qiblaCity").innerHTML = opts;
  $("#citySel").value = "Kuala Lumpur"; $("#qiblaCity").value = "Kuala Lumpur";

  const drawPrayer = async () => {
    const box = $("#prayerTimes"); box.innerHTML = `<p class="muted">Loading…</p>`;
    const url = `/api/prayer-times?city=${encodeURIComponent($("#citySel").value)}` +
                ($("#prayerDate").value ? `&date=${$("#prayerDate").value}` : "");
    try {
      const d = await api(url);
      const now = new Date().toTimeString().slice(0, 5);
      const isToday = d.date === new Date().toISOString().slice(0, 10);
      const next = isToday ? Object.entries(d.times).find(([, v]) => v > now)?.[0] : null;
      box.innerHTML = Object.entries(d.times).map(([k, v]) =>
        `<div class="pt ${k === next ? "next" : ""}"><b>${v}</b><span>${k}</span></div>`).join("");
      $("#ptNote").textContent = `${d.method} · ${d.city} · ${d.date}`;
    } catch { box.innerHTML = `<p class="empty-note">Could not load prayer times.</p>`; }
  };
  const drawQibla = async () => {
    try {
      const d = await api("/api/qibla?city=" + encodeURIComponent($("#qiblaCity").value));
      $("#needle").style.transform = `translateX(-50%) rotate(${d.bearing}deg)`;
      $("#qiblaInfo").textContent = `Qibla from ${d.city}: ${d.bearing}° from North`;
    } catch {}
  };
  $("#citySel").onchange = drawPrayer; $("#prayerDate").onchange = drawPrayer;
  $("#qiblaCity").onchange = drawQibla;
  drawPrayer(); drawQibla();
}

/* ─────────────── map ─────────────── */
let MAP, MARKERS = [];
async function initMap() {
  if (typeof L === "undefined") { $("#map").innerHTML = `<p class="empty-note">Map needs an internet connection.</p>`; return; }
  MAP = L.map("map").setView([4.2, 108.5], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { attribution: "© OpenStreetMap contributors", maxZoom: 18 }).addTo(MAP);

  let all = [];
  try { all = (await api("/api/places?limit=100&offset=0")).items; } catch {}
  // pull the rest in pages so every mapped place shows
  try {
    const total = (await api("/api/places?limit=1")).total;
    for (let off = 100; off < total; off += 100) {
      all = all.concat((await api(`/api/places?limit=100&offset=${off}`)).items);
    }
  } catch {}

  const COLORS = { mosque: "#0a6b4b", attraction: "#0e7c86", food: "#b8862b", medical: "#c0392b", stay: "#6c3fb5" };
  const LABEL = { mosque: "Mosques", attraction: "Attractions", medical: "Healthcare", stay: "Stays" };

  const plot = filter => {
    MARKERS.forEach(m => MAP.removeLayer(m)); MARKERS = [];
    all.forEach(p => {
      if (p.lat == null || p.lng == null) return;
      if (filter !== "All" && LABEL[p.kind] !== filter) return;
      const m = L.circleMarker([p.lat, p.lng], {
        radius: 6, color: COLORS[p.kind] || "#0e7c86", fillColor: COLORS[p.kind] || "#0e7c86",
        fillOpacity: .85, weight: 2,
      }).addTo(MAP).bindPopup(
        `<b>${esc(p.name)}</b><br>${esc(p.category)}${p.state ? " · " + esc(p.state) : ""}`);
      m.on("popupopen", () => {
        const node = m.getPopup().getElement()?.querySelector(".leaflet-popup-content");
        if (node && !node.querySelector("a")) {
          const a = el("a", null, "View details →");
          a.href = "#"; a.onclick = e => { e.preventDefault(); openDrawer(p.kind, p.id); };
          node.appendChild(a);
        }
      });
      MARKERS.push(m);
    });
  };

  const wrap = $("#mapFilter");
  ["All", ...new Set(Object.values(LABEL))].forEach((k, i) => {
    const b = el("button", "chip-link" + (i === 0 ? " active" : ""), k);
    b.onclick = () => { $$("#mapFilter .chip-link").forEach(x => x.classList.remove("active")); b.classList.add("active"); plot(k); };
    wrap.appendChild(b);
  });
  plot("All");
  setTimeout(() => MAP.invalidateSize(), 60);
}

/* ─────────────── travel info ─────────────── */
async function initInfo() {
  wireTabs("#view-info", () => {});

  try {
    const rows = await api("/api/practical");
    const groups = [["Emergency", "🆘 Emergency contacts"], ["Embassies", "🏛️ Embassies & high commissions"], ["General", "ℹ️ Good to know"]];
    const host = $("#practicalAcc"); host.innerHTML = "";
    groups.forEach(([key, label], gi) => {
      const items = rows.filter(r => r.group_name === key);
      if (!items.length) return;
      host.appendChild(el("h3", "acc-group-head", label));
      items.forEach((p, i) => {
        const item = el("div", "acc-item" + (gi === 0 && i === 0 ? " open" : ""), `
          <button class="acc-head" type="button">${esc(p.category)}<span class="tw">+</span></button>
          <div class="acc-body"><p><b>${esc(p.information)}</b>${p.details ? " — " + esc(p.details) : ""}
            ${p.notes ? `<br><span class="muted">${esc(p.notes)}</span>` : ""}</p></div>`);
        item.querySelector(".acc-head").onclick = () => item.classList.toggle("open");
        host.appendChild(item);
      });
    });
  } catch {}

  try {
    const tr = await api("/api/transport");
    $("#transportGrid").innerHTML = tr.map(t => `
      <div class="panel"><h4>🚇 ${esc(t.mode)}</h4>
        <p class="muted sm" style="margin:-6px 0 8px">${esc(t.coverage)}</p>
        <p class="sm">${esc(clean(t.description))}</p>
        ${t.how_it_works ? `<p class="muted sm">💡 ${esc(t.how_it_works)}</p>` : ""}
        ${t.website ? `<a class="sm" href="${esc(t.website)}" target="_blank" rel="noopener">Official site ↗</a>` : ""}
      </div>`).join("");
  } catch {}

  try {
    const apps = await api("/api/apps");
    $("#appsGrid").innerHTML = apps.map(a => `
      <div class="panel"><h4>${esc(a.name)}</h4>
        <span class="tag">${esc(a.category)}</span>
        <p class="sm" style="margin-top:10px">${esc(clean(a.description))}</p>
        ${a.download_link ? `<a class="sm" href="${esc(a.download_link)}" target="_blank" rel="noopener">Get the app ↗</a>` : ""}
      </div>`).join("");
  } catch {}

  try {
    const cs = await api("/api/cartoons");
    $("#cartoonGrid").innerHTML = cs.map(c => `
      <div class="panel"><h4>${esc(c.name)}</h4>
        <p class="sm">${esc(clean(c.description))}</p>
        ${c.link ? `<a class="sm" href="${esc(c.link)}" target="_blank" rel="noopener">▶️ Watch ↗</a>` : ""}
      </div>`).join("");
  } catch {}

  try {
    const yts = await api("/api/youtubers");
    $("#youtuberGrid").innerHTML = yts.map(y => `
      <div class="panel"><h4>${esc(y.name)}</h4>
        <p class="sm">${esc(y.description)}</p>
        ${y.link ? `<a class="sm" href="${esc(y.link)}" target="_blank" rel="noopener">▶️ Visit channel ↗</a>` : ""}
      </div>`).join("");
  } catch {}

  $("#enqForm").onsubmit = async e => {
    e.preventDefault();
    const note = $("#enqNote"); note.textContent = "Sending…"; note.className = "form-note";
    try {
      const r = await api("/api/enquiries", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: $("#enqName").value.trim(), email: $("#enqEmail").value.trim(),
          subject: $("#enqSubject").value.trim(), message: $("#enqMessage").value.trim(),
        }),
      });
      note.textContent = `✅ ${r.message} (Ref #${r.id})`; note.className = "form-note ok"; e.target.reset();
    } catch { note.textContent = "⚠ Please check your details and try again."; note.className = "form-note err"; }
  };
}

function wireTabs(scope, onSwitch) {
  const root = $(scope);
  $$(".tab", root).forEach(tab => {
    tab.onclick = () => {
      $$(".tab", root).forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      $$(".tab-panel", root).forEach(p => p.classList.add("hidden"));
      $(`#tab-${tab.dataset.tab}`, root).classList.remove("hidden");
      onSwitch(tab.dataset.tab);
    };
  });
}

/* ─────────────── reviews ─────────────── */
let stars = 0;
const setStars = n => { stars = n; $$("#starsInput span").forEach((s, i) => s.classList.toggle("on", i < n)); };
function openReview(place) {
  $("#revPlace").value = place;
  $("#revModalTitle").textContent = "Review: " + place;
  setStars(0); $("#revAuthor").value = ""; $("#revComment").value = "";
  $("#reviewModal").hidden = false;
}

/* ─────────────── chrome ─────────────── */
function initChrome() {
  const saved = localStorage.getItem("theme")
    || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", saved);
  $("#themeBtn").textContent = saved === "dark" ? "☀️" : "🌙";
  $("#themeBtn").onclick = () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    $("#themeBtn").textContent = next === "dark" ? "☀️" : "🌙";
  };

  const LANG = {
    en: "Mosques, halal food and family attractions across all 14 states — with prayer times, Qibla direction and ready-made itineraries.",
    ms: "Masjid, makanan halal dan tarikan keluarga di seluruh 14 negeri — dengan waktu solat, arah kiblat dan itinerari siap sedia.",
    ar: "المساجد والطعام الحلال ومعالم العائلة في جميع الولايات الـ14 — مع أوقات الصلاة واتجاه القبلة وبرامج سفر جاهزة.",
    zh: "覆盖马来西亚全部14个州的清真寺、清真美食与亲子景点——含祷告时间、朝拜方向与现成行程。",
  };
  $("#langSel").onchange = e => {
    $("#heroTag").textContent = LANG[e.target.value] || LANG.en;
    document.documentElement.dir = e.target.value === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = e.target.value;
  };

  $("#hamburger").onclick = () => {
    const open = $("#navLinks").classList.toggle("show");
    $("#hamburger").setAttribute("aria-expanded", open);
  };

  $("#drawerClose").onclick = closeDrawer;
  $("#drawerBg").onclick = e => { if (e.target === $("#drawerBg")) closeDrawer(); };
  $("#revCancel").onclick = () => { $("#reviewModal").hidden = true; };
  $("#reviewModal").onclick = e => { if (e.target === $("#reviewModal")) $("#reviewModal").hidden = true; };
  $$("#starsInput span").forEach((s, i) => {
    s.onclick = () => setStars(i + 1);
    s.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setStars(i + 1); } };
  });
  $("#revSubmit").onclick = async () => {
    const payload = {
      place: $("#revPlace").value, author: $("#revAuthor").value.trim(),
      rating: stars, comment: $("#revComment").value.trim(),
    };
    if (!payload.author || !payload.comment || !payload.rating) return toast("Add a name, rating and comment");
    try {
      await api("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      $("#reviewModal").hidden = true; toast("Thanks — review posted");
    } catch { toast("Could not post review"); }
  };

  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!$("#reviewModal").hidden) $("#reviewModal").hidden = true;
    else if (!$("#drawerBg").hidden) closeDrawer();
  });

  api("/api/stats")
    .then(() => $("#apiBadge").classList.remove("off"))
    .catch(() => $("#apiBadge").classList.add("off"));
}

/* ─────────────── trip-planning chatbot ───────────────
   A guided decision tree, not a free-text LLM — every recommendation it makes
   comes straight from /api/itinerary/generate, which only ever picks real rows
   out of the database. That keeps it honest: it can't invent a place. */
const CHAT_DURATIONS = ["1 Day", "3 Days", "1 Week", "2 Weeks", "3 Weeks", "1 Month"];
const CHAT_PARTIES = [
  ["couple", "💑 A couple"], ["solo", "🧍 Solo traveller"], ["friends", "👥 Group of friends"],
  ["family_young", "👨‍👩‍👧 Family with young kids"], ["family_teens", "🧑‍🎓 Family with teenagers"],
  ["family_elderly", "👴 Family with elderly parents"],
];
const CHAT_INTERESTS = [
  ["mosques", "🕌 Mosques"], ["food", "🍜 Food"], ["nature", "🌿 Nature"],
  ["shopping", "🛍️ Shopping"], ["theme_parks", "🎢 Theme parks"], ["beaches", "🏝️ Beaches"],
  ["heritage", "📍 Heritage"], ["kids", "🧸 Kids' activities"], ["nightlife", "🌙 Night markets"],
];
let chatState, chatOpened = false;
function chatReset() { chatState = { duration: null, party: null, pax: 2, interests: [] }; }
chatReset();

function chatLog() { return $("#chatLog"); }
function scrollChat() { requestAnimationFrame(() => { chatLog().scrollTop = chatLog().scrollHeight; }); }
function botMsg(html) {
  const m = el("div", "msg bot", `<div class="bubble">${html}</div>`);
  chatLog().appendChild(m); scrollChat(); return m;
}
function userMsg(text) {
  chatLog().appendChild(el("div", "msg user", `<div class="bubble">${esc(text)}</div>`));
  scrollChat();
}
async function botTyping(ms = 500) {
  const t = el("div", "msg bot", `<div class="chat-typing"><span></span><span></span><span></span></div>`);
  chatLog().appendChild(t); scrollChat();
  await new Promise(r => setTimeout(r, ms));
  t.remove();
}
// Renders a set of choice buttons under the last bot message; resolves with the
// picked value(s) once the user (or, for multi-select, the Continue button) confirms.
function askChoice(container, options, { multi = false, allowNone = false, doneLabel = "Continue" } = {}) {
  return new Promise(resolve => {
    const wrap = el("div", "msg-choices");
    const picked = new Set();
    const finish = () => {
      wrap.querySelectorAll("button").forEach(b => b.disabled = true);
      resolve(multi ? [...picked] : picked.values().next().value);
    };
    options.forEach(([val, label]) => {
      const b = el("button", null, label);
      b.type = "button";
      b.onclick = () => {
        if (multi) {
          b.classList.toggle("chosen"); picked.has(val) ? picked.delete(val) : picked.add(val);
        } else {
          userMsg(label); wrap.remove(); finish();
        }
      };
      wrap.appendChild(b);
    });
    if (multi) {
      const done = el("button", "chosen", doneLabel);
      done.type = "button";
      done.onclick = () => {
        userMsg(picked.size ? options.filter(([v]) => picked.has(v)).map(([, l]) => l).join(", ") : "Skip");
        wrap.remove(); finish();
      };
      wrap.appendChild(done);
    }
    container.appendChild(wrap); scrollChat();
  });
}
function askText(placeholder) {
  return new Promise(resolve => {
    const row = $("#chatInputRow"), input = $("#chatText");
    row.classList.remove("hidden"); input.value = ""; input.placeholder = placeholder; input.focus();
    const submit = () => {
      const v = input.value.trim();
      if (!v) return;
      row.classList.add("hidden"); $("#chatSend").onclick = null;
      userMsg(v); resolve(v);
    };
    $("#chatSend").onclick = submit;
    input.onkeydown = e => { if (e.key === "Enter") submit(); };
  });
}

function chatItineraryCard(day) {
  const stops = day.places.map(p =>
    `<div class="stop"><a href="#" data-open="${p.kind}:${p.id}">${esc(p.name)}</a></div>`).join("");
  const food = day.food ? `<div class="stop">🍽️ <a href="#" data-open="${day.food.kind}:${day.food.id}">${esc(day.food.name)}</a></div>` : "";
  return `<div class="chat-day"><span class="tag">Day ${day.day} · ${esc(day.theme)}</span>${stops}${food}</div>`;
}
function wireOpenLinks(root) {
  $$("[data-open]", root).forEach(a => a.onclick = e => {
    e.preventDefault();
    const [kind, id] = a.dataset.open.split(":");
    openDrawer(kind, +id);
  });
}

async function runChat() {
  chatReset(); chatLog().innerHTML = "";
  await botTyping(350);
  botMsg("Hi! 👋 I'll put together a Malaysia itinerary using real places from this guide. First — how long is your trip?");
  chatState.duration = await askChoice(chatLog().lastElementChild,
    CHAT_DURATIONS.map(d => [d, d]));

  await botTyping();
  botMsg("Got it. Who's travelling?");
  chatState.party = await askChoice(chatLog().lastElementChild, CHAT_PARTIES);

  await botTyping();
  botMsg("How many people in total?");
  const pax = await askText("e.g. 4");
  chatState.pax = Math.max(1, Math.min(30, parseInt(pax, 10) || 2));

  await botTyping();
  botMsg("Any particular interests? Pick as many as you like, or just continue.");
  chatState.interests = await askChoice(chatLog().lastElementChild, CHAT_INTERESTS,
    { multi: true, doneLabel: "Build my itinerary" });

  await botTyping(700);
  let data;
  try {
    data = await api("/api/itinerary/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chatState),
    });
  } catch {
    botMsg("Sorry, I couldn't build that itinerary — please try again.");
    return;
  }
  const partyLabel = CHAT_PARTIES.find(([v]) => v === chatState.party)?.[1] || "you";
  const m = botMsg(`Here's a <b>${esc(data.duration)}</b> plan for ${esc(partyLabel.replace(/^\S+\s/, ""))}
    (${data.pax} ${data.pax === 1 ? "person" : "people"}):`);
  const days = el("div", null, data.itinerary.map(chatItineraryCard).join(""));
  m.querySelector(".bubble").after(days);
  wireOpenLinks(days);
  if (data.notes?.length) {
    m.querySelector(".bubble").insertAdjacentHTML("beforeend",
      `<div class="chat-note">${data.notes.map(n => "💡 " + esc(n)).join("<br>")}</div>`);
  }
  scrollChat();

  await botTyping(400);
  const tail = botMsg("Want to save every stop to your itinerary, or plan a different trip?");
  const choice = await askChoice(chatLog().lastElementChild, [
    ["save", "💾 Save to my itinerary"], ["again", "🔁 Plan another trip"],
  ]);
  if (choice === "save") {
    const names = data.itinerary.flatMap(d => [...d.places.map(p => p.name), d.food?.name].filter(Boolean));
    let added = 0;
    names.forEach(n => { if (!PLAN.includes(n)) { PLAN.push(n); added++; } });
    renderPlan();
    await botTyping(300);
    botMsg(`Added ${added} stop${added === 1 ? "" : "s"} to <b>Plan a Trip → My itinerary</b>. 🎉`);
  } else if (choice === "again") {
    await botTyping(300);
    runChat();
  }
}

function chatOpenPanel() {
  $("#chatPanel").hidden = false;
  $("#chatLauncher").setAttribute("aria-expanded", "true");
  if (!chatOpened) { chatOpened = true; runChat(); }
}
function chatClosePanel() {
  $("#chatPanel").hidden = true;
  $("#chatLauncher").setAttribute("aria-expanded", "false");
}
function initChat() {
  $("#chatLauncher").onclick = chatOpenPanel;
  $("#chatClose").onclick = chatClosePanel;
}

/* ─────────────── PWA install + offline ─────────────── */
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault(); deferredInstall = e;
  $("#installBtn")?.removeAttribute("hidden");
});
function initInstall() {
  const btn = $("#installBtn");
  if (!btn) return;
  btn.onclick = async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    btn.setAttribute("hidden", "");
  };
  window.addEventListener("appinstalled", () => btn.setAttribute("hidden", ""));
}
function initOffline() {
  const badge = $("#offlineBadge");
  const update = () => badge?.toggleAttribute("hidden", navigator.onLine);
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/static/sw.js").catch(() => {});
  });
}

window.addEventListener("hashchange", router);
document.addEventListener("DOMContentLoaded", () => {
  initChrome(); initChat(); initInstall(); initOffline(); router();
});
