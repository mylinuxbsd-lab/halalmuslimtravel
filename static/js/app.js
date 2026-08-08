/* Jelajah Halal - Frontend (talks to the FastAPI backend) */
const API = "";
const $ = (s, r = document) => r.querySelector(s);
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const trunc = (str, n) => !str ? "" : (str.length > n ? str.slice(0, n).trim() + "…" : str);

async function api(path, opts) {
  const r = await fetch(API + path, opts);
  if (!r.ok) { throw new Error(await r.text() || r.status); }
  return r.json();
}
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2600); }

function initChrome() {
  const saved = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  $("#themeBtn").textContent = saved === "dark" ? "☀️" : "🌙";
  $("#themeBtn").onclick = () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    $("#themeBtn").textContent = next === "dark" ? "☀️" : "🌙";
  };
  const LANG = {
    en: { tag: "Your Muslim-friendly gateway to Malaysia", ph: "Search mosques, food, attractions…" },
    ms: { tag: "Gerbang mesra Muslim anda ke Malaysia", ph: "Cari masjid, makanan, tarikan…" },
    ar: { tag: "بوابتك الملائمة للمسلمين إلى ماليزيا", ph: "ابحث…" },
    zh: { tag: "您的马来西亚穆斯林友好门户", ph: "搜索…" }
  };
  $("#langSel").onchange = e => {
    const L = LANG[e.target.value] || LANG.en;
    $("#heroTag").textContent = L.tag; $("#globalSearch").placeholder = L.ph;
    document.documentElement.dir = e.target.value === "ar" ? "rtl" : "ltr";
  };
  $("#hamburger").onclick = () => $("#navLinks").classList.toggle("show");
  document.querySelectorAll("#navLinks a").forEach(a => a.onclick = () => $("#navLinks").classList.remove("show"));
}

async function checkHealth() {
  try { const s = await api("/api/stats");
    $("#apiBadge").textContent = "API ● live"; $("#apiBadge").classList.remove("off");
    $("#statMosques").textContent = s.mosques + "+"; $("#statAttr").textContent = s.attractions + "+";
    $("#statMed").textContent = s.medical + "+";
  } catch { $("#apiBadge").textContent = "API ○ offline"; $("#apiBadge").classList.add("off"); }
}

function linkRow(mapsUrl, photoUrl, mapsLabel, photoLabel, videoName) {
  const links = [];
  if (mapsUrl) links.push(`<a class="map-link" target="_blank" href="${mapsUrl}">📍 ${mapsLabel}</a>`);
  if (photoUrl) links.push(`<a class="map-link" target="_blank" href="${photoUrl}">🔗 ${photoLabel}</a>`);
  if (videoName) links.push(`<a class="map-link" target="_blank" href="https://www.youtube.com/results?search_query=${encodeURIComponent(videoName + " Malaysia")}">▶️ Watch</a>`);
  return links.length ? `<div class="tag-row">${links.join("")}</div>` : "";
}
const cardImg = (thumb, name) => thumb ? `<img class="card-img" src="${thumb}" alt="${name}" loading="lazy" onerror="this.remove()">` : "";

async function loadMosques() {
  const g = $("#mosqueGrid");
  try {
    const rows = await api("/api/mosques"); g.innerHTML = "";
    rows.forEach(m => g.appendChild(el("div", "card", `
      ${cardImg(m.photo_thumb, m.name)}
      <div class="tag-row"><span class="chip">🕌 ${m.state}</span></div>
      <h3>${m.name}</h3><p class="desc">${trunc(m.description, 220)}</p>
      <p class="dist">${m.distance}${m.travel_time ? " · " + m.travel_time : ""}</p>
      ${linkRow(m.maps_url, m.photo_url, "Directions", "Official Site", m.name)}
      <div><button class="rev-btn" data-place="${m.name}">⭐ Review</button></div>`)));
    wireReviewButtons();
  } catch { g.innerHTML = '<p class="loading">Could not load mosques.</p>'; }
}

async function loadFood() {
  try {
    const dishes = await api("/api/food");
    const fg = $("#foodGrid"); fg.innerHTML = "";
    dishes.forEach(f => fg.appendChild(el("div", "card", `
      ${cardImg(f.photo_thumb, f.name)}
      <div class="tag-row"><span class="chip">✅ Halal</span></div>
      <h3>${f.name}</h3><p class="desc">${trunc(f.description, 220)}</p>
      ${linkRow(null, f.photo_url, "", "Learn More", f.name)}`)));
  } catch { $("#foodGrid").innerHTML = '<p class="loading">Could not load food.</p>'; }
}

async function loadCartoons() {
  try {
    const rows = await api("/api/cartoons");
    const cg = $("#cartoonGrid"); cg.innerHTML = "";
    rows.forEach(c => cg.appendChild(el("div", "card", `
      <h3>${c.name}</h3><p class="desc">${trunc(c.description, 220)}</p>
      ${linkRow(null, c.link, "", "▶️ Watch")}`)));
  } catch { $("#cartoonGrid").innerHTML = ""; }
}

async function loadAttractions() {
  const pills = $("#attrPills"); pills.innerHTML = "";
  let categories = ["All"];
  try { categories = categories.concat(await api("/api/attractions/categories")); } catch {}
  categories.forEach((gn, i) => {
    const p = el("div", "pill" + (i === 0 ? " active" : ""), gn);
    p.onclick = () => { document.querySelectorAll("#attrPills .pill").forEach(x => x.classList.remove("active")); p.classList.add("active"); draw(gn); };
    pills.appendChild(p);
  });
  async function draw(category) {
    const g = $("#attrGrid"); g.innerHTML = '<p class="loading">Loading…</p>';
    const rows = await api("/api/attractions?category=" + encodeURIComponent(category));
    g.innerHTML = "";
    rows.forEach(a => g.appendChild(el("div", "card", `
      ${cardImg(a.photo_thumb, a.name)}
      <div class="tag-row"><span class="chip">${a.category}</span>${a.state ? `<span class="chip">📍 ${a.state}</span>` : ""}</div>
      <h3>${a.name}</h3><p class="desc">${trunc(a.description, 200)}</p>
      <p class="dist">${a.distance}${a.travel_time ? " · " + a.travel_time : ""}</p>
      ${linkRow(a.maps_url, a.photo_url, "Directions", "More Info", a.name)}
      <div><button class="rev-btn" data-place="${a.name}">⭐ Review</button></div>`)));
    wireReviewButtons();
  }
  draw("All");
}

async function loadMisc() {
  try {
    const med = await api("/api/medical"); const mg = $("#medGrid"); mg.innerHTML = "";
    med.forEach(m => mg.appendChild(el("div", "card", `
      <div class="tag-row">${(m.specialties || "").split(",").slice(0, 3).map(s => `<span class="chip">${s.trim()}</span>`).join("")}</div>
      <h3>${m.name}</h3><p class="desc">${trunc(m.description, 200)}</p>
      <p class="dist">${m.distance || ""}${m.travel_time ? " · " + m.travel_time : ""}</p>
      ${linkRow(m.maps_url, m.website, "Directions", "Website")}`)));

    const stays = await api("/api/accommodation"); const hg = $("#hotelGrid"); hg.innerHTML = "";
    stays.forEach(h => hg.appendChild(el("div", "card", `
      <div class="tag-row"><span class="chip">${h.category}</span></div>
      <h3>${h.name}</h3><p class="desc">${trunc(h.description, 200)}</p>
      <p class="dist">${h.distance}</p>
      ${linkRow(h.maps_url, h.website, "Directions", "Website")}`)));

    const tr = await api("/api/transport"); const tg = $("#transportGrid"); tg.innerHTML = "";
    tr.forEach(t => tg.appendChild(el("div", "card", `
      <h3>🚇 ${t.mode}</h3><p class="meta">${t.coverage}</p>
      <p class="desc">${trunc(t.description, 180)}</p>
      <p class="desc" style="font-size:.82rem;color:var(--muted)">💡 ${trunc(t.how_it_works, 160)}</p>
      ${linkRow(null, t.website, "", "Website")}`)));

    const apps = await api("/api/apps"); const ag = $("#appsGrid"); ag.innerHTML = "";
    const grouped = {};
    apps.forEach(a => { (grouped[a.category] = grouped[a.category] || []).push(a); });
    Object.entries(grouped).forEach(([cat, list]) => ag.appendChild(el("div", "card", `
      <h3>📱 ${cat}</h3>
      ${list.map(a => `<div style="margin-bottom:10px">
        <b>${a.name}</b>${a.download_link ? ` — <a class="map-link" target="_blank" href="${a.download_link}">Get it</a>` : ""}
        <p class="meta" style="margin:2px 0 0">${trunc(a.description, 130)}</p></div>`).join("")}`)));
  } catch (e) { console.error(e); }
}

async function loadTools() {
  const cities = await api("/api/cities");
  const cs = $("#citySel"), qs = $("#qiblaCity");
  cs.innerHTML = qs.innerHTML = cities.map(c => `<option>${c}</option>`).join("");
  async function drawPrayer() {
    const box = $("#prayerTimes"); box.innerHTML = '<p class="loading">Loading…</p>';
    const d = await api("/api/prayer-times?city=" + encodeURIComponent(cs.value));
    box.innerHTML = "";
    Object.entries(d.times).forEach(([k, v]) => box.appendChild(el("div", "pt", `<b>${v}</b><span>${k}</span>`)));
    $("#ptNote").textContent = `${d.method} · ${d.city} · ${d.date}`;
  }
  async function drawQibla() {
    const d = await api("/api/qibla?city=" + encodeURIComponent(qs.value));
    $("#needle").style.transform = `translateX(-50%) rotate(${d.bearing}deg)`;
    $("#qiblaInfo").textContent = `Qibla from ${d.city}: ${d.bearing}° from North`;
  }
  cs.onchange = drawPrayer; qs.onchange = drawQibla; drawPrayer(); drawQibla();
}

let MAP, MARKERS = [];
async function loadMap() {
  if (typeof L === "undefined") { $("#map").innerHTML = '<p class="loading">Map tiles need an internet connection.</p>'; return; }
  MAP = L.map("map").setView([3.1578, 101.7117], 10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 18 }).addTo(MAP);
  L.marker([3.1578, 101.7117]).addTo(MAP).bindPopup("<b>KLCC</b>");
  const [mosques, attr, med, stays] = await Promise.all([
    api("/api/mosques"), api("/api/attractions"), api("/api/medical"), api("/api/accommodation")]);
  const sets = {
    Mosques: { color: "#0a6b4b", data: mosques }, Attractions: { color: "#0e7c86", data: attr },
    Medical: { color: "#c0392b", data: med }, Accommodation: { color: "#6c3fb5", data: stays }
  };
  function plot(filter) {
    MARKERS.forEach(m => MAP.removeLayer(m)); MARKERS = [];
    Object.entries(sets).forEach(([k, s]) => {
      if (filter !== "All" && filter !== k) return;
      s.data.forEach(d => {
        if (d.lat == null || d.lng == null) return;
        const mk = L.circleMarker([d.lat, d.lng], { radius: 7, color: s.color, fillColor: s.color, fillOpacity: .8 })
          .addTo(MAP).bindPopup(`<b>${d.name}</b><br>${k} · ${d.distance || d.state || ""}`);
        MARKERS.push(mk);
      });
    });
  }
  const wrap = $("#mapFilter"); wrap.innerHTML = "";
  ["All", ...Object.keys(sets)].forEach((k, i) => {
    const p = el("div", "pill" + (i === 0 ? " active" : ""), k);
    p.onclick = () => { document.querySelectorAll("#mapFilter .pill").forEach(x => x.classList.remove("active")); p.classList.add("active"); plot(k); };
    wrap.appendChild(p);
  });
  plot("All");
}

async function loadItineraries() {
  const sel = $("#itinSel");
  async function draw() {
    const wrap = $("#itinDays"); wrap.innerHTML = '<p class="loading">Loading…</p>';
    const days = await api("/api/itineraries/prebuilt?duration=" + encodeURIComponent(sel.value));
    wrap.innerHTML = "";
    days.forEach(d => wrap.appendChild(el("div", "day-card", `
      <span class="daynum">Day ${d.day}</span>
      ${d.items.map(it => `
        <div class="activity-item">
          ${it.type ? `<span class="chip">${it.type}</span>` : ""}
          <p style="margin:6px 0 2px"><b>${it.activity}</b><span class="meta"> — ${it.location}</span></p>
          ${it.why ? `<p class="meta">${it.why}</p>` : ""}
          ${it.tips ? `<p class="meta">💡 ${it.tips}</p>` : ""}
        </div>`).join("")}`)));
  }
  sel.onchange = draw; draw();
}

async function loadBuilder() {
  const pool = $("#pool"), plan = $("#plan");
  const [mosques, attr] = await Promise.all([api("/api/mosques"), api("/api/attractions")]);
  const options = [...mosques.map(m => m.name), ...attr.map(a => a.name)];
  pool.querySelectorAll(".drag-item").forEach(n => n.remove());
  options.forEach(name => {
    const d = el("div", "drag-item", `<span>${name}</span><span>⠿</span>`);
    d.draggable = true; d.dataset.name = name;
    d.ondragstart = e => e.dataTransfer.setData("text/plain", name);
    d.onclick = () => addToPlan(name);
    pool.appendChild(d);
  });
  const emptyNote = el("p", "empty-note", "Drag or tap spots to add them →");
  plan.appendChild(emptyNote);
  plan.ondragover = e => { e.preventDefault(); plan.classList.add("drop-hover"); };
  plan.ondragleave = () => plan.classList.remove("drop-hover");
  plan.ondrop = e => { e.preventDefault(); plan.classList.remove("drop-hover"); addToPlan(e.dataTransfer.getData("text/plain")); };
  function addToPlan(name) {
    if (!name) return;
    if ([...plan.querySelectorAll(".drag-item")].some(x => x.dataset.name === name)) return;
    emptyNote.classList.add("hidden");
    const item = el("div", "drag-item", `<span></span><span class="remove">✕</span>`);
    item.dataset.name = name;
    item.querySelector(".remove").onclick = () => { item.remove(); renumber(); };
    plan.appendChild(item); renumber();
  }
  function renumber() {
    const items = plan.querySelectorAll(".drag-item");
    items.forEach((it, i) => it.querySelector("span").textContent = `${i + 1}. ${it.dataset.name}`);
    if (items.length === 0) emptyNote.classList.remove("hidden");
  }
  $("#clearPlan").onclick = e => { e.preventDefault(); plan.querySelectorAll(".drag-item").forEach(x => x.remove()); emptyNote.classList.remove("hidden"); };
  $("#saveTrip").onclick = async () => {
    const items = [...plan.querySelectorAll(".drag-item")].map(x => x.dataset.name);
    if (!items.length) { toast("Add some spots first."); return; }
    const name = $("#tripName").value.trim() || "My Malaysia Trip";
    try {
      const r = await api("/api/itineraries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, items }) });
      toast("Saved! Trip #" + r.id); $("#tripName").value = ""; loadSavedTrips();
    } catch { toast("Save failed."); }
  };
  loadSavedTrips();
}

async function loadSavedTrips() {
  const wrap = $("#savedList");
  try {
    const trips = await api("/api/itineraries");
    if (!trips.length) { wrap.innerHTML = '<p class="empty-note">No saved trips yet — build one above and hit Save.</p>'; return; }
    wrap.innerHTML = "";
    trips.forEach(t => {
      const item = el("div", "saved-item", `
        <div><b>${t.name}</b> <span class="names">— ${t.items.join(", ")}</span><br>
        <span class="names">#${t.id} · ${t.created_at}</span></div>
        <button class="btn ghost sm" data-del="${t.id}">Delete</button>`);
      item.querySelector("[data-del]").onclick = async () => { await api("/api/itineraries/" + t.id, { method: "DELETE" }); toast("Deleted #" + t.id); loadSavedTrips(); };
      wrap.appendChild(item);
    });
  } catch { wrap.innerHTML = '<p class="empty-note">Could not load saved trips.</p>'; }
}

async function loadPractical() {
  const wrap = $("#practicalAcc"); wrap.innerHTML = "";
  const rows = await api("/api/practical");
  const groups = [
    ["Emergency", "🆘 Emergency Contacts"],
    ["Embassies", "🏛️ Embassies & High Commissions"],
    ["General", "ℹ️ General Info"],
  ];
  groups.forEach(([key, label], gi) => {
    const items = rows.filter(r => r.group_name === key);
    if (!items.length) return;
    wrap.appendChild(el("h3", "practical-group-head", label));
    items.forEach((p, i) => {
      const item = el("div", "acc-item" + (gi === 0 && i === 0 ? " open" : ""),
        `<div class="acc-head">${p.category}<span class="tw">+</span></div>
         <div class="acc-body"><p><b>${p.information}</b>${p.details ? ` — ${p.details}` : ""}${p.notes ? `<br><span class="meta">${p.notes}</span>` : ""}</p></div>`);
      item.querySelector(".acc-head").onclick = () => item.classList.toggle("open");
      wrap.appendChild(item);
    });
  });
}

async function loadReviews() {
  const wrap = $("#reviewGrid"); wrap.innerHTML = '<p class="loading">Loading…</p>';
  const rows = await api("/api/reviews"); wrap.innerHTML = "";
  rows.forEach(r => wrap.appendChild(el("div", "review", `
    <div class="place">${r.place}</div>
    <div class="stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</div>
    <div class="who">${r.author}</div><p>${r.comment}</p>`)));
}
function wireReviewButtons() { document.querySelectorAll(".rev-btn").forEach(b => b.onclick = () => openReviewModal(b.dataset.place)); }
function openReviewModal(place) {
  $("#revPlace").value = place; $("#revModalTitle").textContent = "Review: " + place;
  setStars(0); $("#revAuthor").value = ""; $("#revComment").value = ""; $("#reviewModal").classList.add("show");
}
let currentStars = 0;
function setStars(n) { currentStars = n; document.querySelectorAll("#starsInput span").forEach((s, i) => s.classList.toggle("on", i < n)); }
function initReviewModal() {
  document.querySelectorAll("#starsInput span").forEach((s, i) => s.onclick = () => setStars(i + 1));
  $("#revCancel").onclick = () => $("#reviewModal").classList.remove("show");
  $("#revSubmit").onclick = async () => {
    const payload = { place: $("#revPlace").value, author: $("#revAuthor").value.trim(), rating: currentStars, comment: $("#revComment").value.trim() };
    if (!payload.author || !payload.comment || !payload.rating) { toast("Fill all fields & pick a rating."); return; }
    try { await api("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      $("#reviewModal").classList.remove("show"); toast("Review posted!"); loadReviews();
    } catch { toast("Could not post review."); }
  };
}

function initEnquiry() {
  $("#enqForm").onsubmit = async e => {
    e.preventDefault();
    const note = $("#enqNote"); note.textContent = "Sending…"; note.className = "form-note";
    const payload = { name: $("#enqName").value.trim(), email: $("#enqEmail").value.trim(), subject: $("#enqSubject").value.trim(), message: $("#enqMessage").value.trim() };
    try {
      const r = await api("/api/enquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      note.textContent = "✅ " + r.message + " (Ref #" + r.id + ")"; note.className = "form-note ok"; e.target.reset();
    } catch { note.textContent = "⚠ Please check your inputs and try again."; note.className = "form-note err"; }
  };
}

function initSearch() {
  const input = $("#globalSearch"), box = $("#searchResults");
  let timer;
  const run = async () => {
    const q = input.value.trim();
    if (q.length < 2) { box.classList.remove("show"); return; }
    try {
      const d = await api("/api/search?q=" + encodeURIComponent(q));
      if (!d.results.length) { box.innerHTML = '<div class="sr-item">No matches</div>'; box.classList.add("show"); return; }
      box.innerHTML = d.results.slice(0, 8).map(r =>
        `<div class="sr-item" data-name="${r.name}"><span class="k">${r.type}</span>${r.name} <span style="color:#999">— ${r.detail}</span></div>`).join("");
      box.classList.add("show");
      box.querySelectorAll(".sr-item").forEach(it => it.onclick = () => {
        input.value = it.dataset.name || ""; box.classList.remove("show");
        const t = d.results.find(x => x.name === it.dataset.name)?.type;
        const map = { mosque: "mosques", dish: "food", attraction: "attractions", hospital: "medical", stay: "hotels" };
        (document.getElementById(map[t] || "mosques") || {}).scrollIntoView?.({ behavior: "smooth" });
      });
    } catch { box.classList.remove("show"); }
  };
  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 220); });
  $("#searchBtn").onclick = run;
  document.addEventListener("click", e => { if (!e.target.closest(".search-box")) box.classList.remove("show"); });
}

document.addEventListener("DOMContentLoaded", () => {
  initChrome(); initSearch(); initEnquiry(); initReviewModal(); checkHealth();
  loadMosques(); loadFood(); loadAttractions(); loadCartoons(); loadMisc();
  loadTools(); loadItineraries(); loadBuilder(); loadPractical(); loadReviews();
  setTimeout(loadMap, 300);
});
