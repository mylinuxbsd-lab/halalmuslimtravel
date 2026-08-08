/* Jelajah Halal - Frontend (talks to the FastAPI backend) */
const API = "";
const $ = (s, r = document) => r.querySelector(s);
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };

async function api(path, opts) {
  const r = await fetch(API + path, opts);
  if (!r.ok) { throw new Error(await r.text() || r.status); }
  return r.json();
}
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2600); }

function initChrome() {
  const saved = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  $("#themeBtn").textContent = saved === "dark" ? "\u2600\ufe0f" : "\ud83c\udf19";
  $("#themeBtn").onclick = () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    $("#themeBtn").textContent = next === "dark" ? "\u2600\ufe0f" : "\ud83c\udf19";
  };
  const LANG = {
    en: { tag: "Your Muslim-friendly gateway to Malaysia", ph: "Search mosques, food, attractions\u2026" },
    ms: { tag: "Gerbang mesra Muslim anda ke Malaysia", ph: "Cari masjid, makanan, tarikan\u2026" },
    ar: { tag: "\u0628\u0648\u0627\u0628\u062a\u0643 \u0627\u0644\u0645\u0644\u0627\u0626\u0645\u0629 \u0644\u0644\u0645\u0633\u0644\u0645\u064a\u0646 \u0625\u0644\u0649 \u0645\u0627\u0644\u064a\u0632\u064a\u0627", ph: "\u0627\u0628\u062d\u062b\u2026" },
    zh: { tag: "\u60a8\u7684\u9a6c\u6765\u897f\u4e9a\u7a46\u65af\u6797\u53cb\u597d\u95e8\u6237", ph: "\u641c\u7d22\u2026" }
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
    $("#apiBadge").textContent = "API \u25cf live"; $("#apiBadge").classList.remove("off");
    $("#statMosques").textContent = s.mosques + "+"; $("#statAttr").textContent = s.attractions + "+";
  } catch { $("#apiBadge").textContent = "API \u25cb offline"; $("#apiBadge").classList.add("off"); }
}

async function loadMosques() {
  const g = $("#mosqueGrid");
  try {
    const rows = await api("/api/mosques"); g.innerHTML = "";
    rows.forEach(m => g.appendChild(el("div", "card", `
      <div class="tag-row"><span class="chip">\ud83d\udd4c ${m.city}</span></div>
      <h3>${m.name}</h3><p class="desc">${m.note}</p>
      <p class="meta">\ud83d\udd50 ${m.hours}</p><p class="meta">\ud83d\udc55 ${m.dress}</p>
      <p class="dist">${m.distance}</p>
      <a class="map-link" target="_blank" href="${m.maps_url}">\ud83d\udccd Directions</a>
      <div><button class="rev-btn" data-place="${m.name}">\u2b50 Review</button></div>`)));
    wireReviewButtons();
  } catch { g.innerHTML = '<p class="loading">Could not load mosques.</p>'; }
}

async function loadFood() {
  try {
    const d = await api("/api/food");
    const fg = $("#foodGrid"); fg.innerHTML = "";
    d.dishes.forEach(f => fg.appendChild(el("div", "card", `
      <div class="tag-row"><span class="chip">${f.tag}</span><span class="chip">\u2705 Halal</span></div>
      <h3>${f.name}</h3><p class="desc">${f.note}</p><p class="meta">\ud83d\udca1 ${f.tip}</p>`)));
    const mg = $("#marketGrid"); mg.innerHTML = "";
    d.venues.forEach(v => mg.appendChild(el("div", "card", `
      <div class="tag-row"><span class="chip">${v.type}</span></div>
      <h3>${v.name}</h3><p class="dist">${v.distance}</p>
      <a class="map-link" target="_blank" href="${v.maps_url}">\ud83d\udccd Directions</a>`)));
  } catch { $("#foodGrid").innerHTML = '<p class="loading">Could not load food.</p>'; }
}

async function loadAttractions() {
  const groups = ["All", "City & Nature", "Theme Parks", "Family & Kids"];
  const pills = $("#attrPills"); pills.innerHTML = "";
  groups.forEach((gn, i) => {
    const p = el("div", "pill" + (i === 0 ? " active" : ""), gn);
    p.onclick = () => { document.querySelectorAll("#attrPills .pill").forEach(x => x.classList.remove("active")); p.classList.add("active"); draw(gn); };
    pills.appendChild(p);
  });
  async function draw(group) {
    const g = $("#attrGrid"); g.innerHTML = '<p class="loading">Loading\u2026</p>';
    const rows = await api("/api/attractions?group=" + encodeURIComponent(group));
    g.innerHTML = "";
    rows.forEach(a => g.appendChild(el("div", "card", `
      <div class="tag-row"><span class="chip">${a.grp}</span></div>
      <h3>${a.name}</h3><p class="meta">${a.category}</p><p class="dist">${a.distance}</p>
      <a class="map-link" target="_blank" href="${a.maps_url}">\ud83d\udccd Directions</a>
      <div><button class="rev-btn" data-place="${a.name}">\u2b50 Review</button></div>`)));
    wireReviewButtons();
  }
  draw("All");
}

async function loadMisc() {
  try {
    const med = await api("/api/medical"); const mg = $("#medGrid"); mg.innerHTML = "";
    med.forEach(m => mg.appendChild(el("div", "card", `
      <div class="tag-row"><span class="chip">\ud83c\udfe5 JCI-Accredited</span></div>
      <h3>${m.name}</h3><p class="meta">${m.specialty}</p><p class="meta">\ud83e\udd32 ${m.prayer}</p>
      <p class="dist">${m.distance}</p><a class="map-link" target="_blank" href="${m.maps_url}">\ud83d\udccd Directions</a>`)));
    const hotels = await api("/api/hotels"); const hg = $("#hotelGrid"); hg.innerHTML = "";
    hotels.forEach(h => hg.appendChild(el("div", "card", `
      <div class="tag-row">${h.perks.map(p => `<span class="chip">\u2714 ${p}</span>`).join("")}</div>
      <h3>${h.name}</h3><p class="dist">${h.distance}</p>
      <a class="map-link" target="_blank" href="${h.maps_url}">\ud83d\udccd Directions</a>`)));
    const tr = await api("/api/transport"); const tg = $("#transportGrid"); tg.innerHTML = "";
    tr.forEach(t => tg.appendChild(el("div", "card", `<h3>\ud83d\ude87 ${t.mode}</h3><p class="desc">${t.note}</p>`)));
    const apps = await api("/api/apps"); const ag = $("#appsGrid"); ag.innerHTML = "";
    Object.entries(apps).forEach(([cat, names]) => ag.appendChild(el("div", "card",
      `<h3>\ud83d\udcf1 ${cat}</h3><div class="tag-row">${names.map(n => `<span class="chip">${n}</span>`).join(" ")}</div>`)));
  } catch (e) { console.error(e); }
}

async function loadTools() {
  const cities = await api("/api/cities");
  const cs = $("#citySel"), qs = $("#qiblaCity");
  cs.innerHTML = qs.innerHTML = cities.map(c => `<option>${c}</option>`).join("");
  async function drawPrayer() {
    const box = $("#prayerTimes"); box.innerHTML = '<p class="loading">Loading\u2026</p>';
    const d = await api("/api/prayer-times?city=" + encodeURIComponent(cs.value));
    box.innerHTML = "";
    Object.entries(d.times).forEach(([k, v]) => box.appendChild(el("div", "pt", `<b>${v}</b><span>${k}</span>`)));
    $("#ptNote").textContent = `${d.method} \u00b7 ${d.city} \u00b7 ${d.date}`;
  }
  async function drawQibla() {
    const d = await api("/api/qibla?city=" + encodeURIComponent(qs.value));
    $("#needle").style.transform = `translateX(-50%) rotate(${d.bearing}deg)`;
    $("#qiblaInfo").textContent = `Qibla from ${d.city}: ${d.bearing}\u00b0 from North`;
  }
  cs.onchange = drawPrayer; qs.onchange = drawQibla; drawPrayer(); drawQibla();
}

let MAP, MARKERS = [];
async function loadMap() {
  if (typeof L === "undefined") { $("#map").innerHTML = '<p class="loading">Map tiles need an internet connection.</p>'; return; }
  MAP = L.map("map").setView([3.1578, 101.7117], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "\u00a9 OpenStreetMap", maxZoom: 18 }).addTo(MAP);
  L.marker([3.1578, 101.7117]).addTo(MAP).bindPopup("<b>KLCC</b>");
  const [mosques, food, attr, med, hotels] = await Promise.all([
    api("/api/mosques"), api("/api/food"), api("/api/attractions"), api("/api/medical"), api("/api/hotels")]);
  const sets = {
    Mosques: { color: "#0a6b4b", data: mosques }, Food: { color: "#c69a34", data: food.venues },
    Attractions: { color: "#0e7c86", data: attr }, Medical: { color: "#c0392b", data: med }, Hotels: { color: "#6c3fb5", data: hotels }
  };
  function plot(filter) {
    MARKERS.forEach(m => MAP.removeLayer(m)); MARKERS = [];
    Object.entries(sets).forEach(([k, s]) => {
      if (filter !== "All" && filter !== k) return;
      s.data.forEach(d => {
        const mk = L.circleMarker([d.lat, d.lng], { radius: 7, color: s.color, fillColor: s.color, fillOpacity: .8 })
          .addTo(MAP).bindPopup(`<b>${d.name}</b><br>${k} \u00b7 ${d.distance_km} km from KLCC`);
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
    const wrap = $("#itinDays"); wrap.innerHTML = '<p class="loading">Loading\u2026</p>';
    const days = await api("/api/itineraries/prebuilt?days=" + sel.value);
    wrap.innerHTML = "";
    days.forEach(d => wrap.appendChild(el("div", "day-card", `
      <span class="daynum">Day ${d.day}</span><h3>${d.title}</h3>
      <ul>${d.items.map(i => `<li>${i}</li>`).join("")}</ul>`)));
  }
  sel.onchange = draw; draw();
}

async function loadBuilder() {
  const pool = $("#pool"), plan = $("#plan");
  const [mosques, attr, food] = await Promise.all([api("/api/mosques"), api("/api/attractions"), api("/api/food")]);
  const options = [...mosques.map(m => m.name), ...attr.map(a => a.name), ...food.venues.map(v => v.name)];
  pool.querySelectorAll(".drag-item").forEach(n => n.remove());
  options.forEach(name => {
    const d = el("div", "drag-item", `<span>${name}</span><span>\u283f</span>`);
    d.draggable = true; d.dataset.name = name;
    d.ondragstart = e => e.dataTransfer.setData("text/plain", name);
    d.onclick = () => addToPlan(name);
    pool.appendChild(d);
  });
  const emptyNote = el("p", "empty-note", "Drag or tap spots to add them \u2192");
  plan.appendChild(emptyNote);
  plan.ondragover = e => { e.preventDefault(); plan.classList.add("drop-hover"); };
  plan.ondragleave = () => plan.classList.remove("drop-hover");
  plan.ondrop = e => { e.preventDefault(); plan.classList.remove("drop-hover"); addToPlan(e.dataTransfer.getData("text/plain")); };
  function addToPlan(name) {
    if (!name) return;
    if ([...plan.querySelectorAll(".drag-item")].some(x => x.dataset.name === name)) return;
    emptyNote.classList.add("hidden");
    const item = el("div", "drag-item", `<span></span><span class="remove">\u2715</span>`);
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
    if (!trips.length) { wrap.innerHTML = '<p class="empty-note">No saved trips yet \u2014 build one above and hit Save.</p>'; return; }
    wrap.innerHTML = "";
    trips.forEach(t => {
      const item = el("div", "saved-item", `
        <div><b>${t.name}</b> <span class="names">\u2014 ${t.items.join(", ")}</span><br>
        <span class="names">#${t.id} \u00b7 ${t.created_at}</span></div>
        <button class="btn ghost sm" data-del="${t.id}">Delete</button>`);
      item.querySelector("[data-del]").onclick = async () => { await api("/api/itineraries/" + t.id, { method: "DELETE" }); toast("Deleted #" + t.id); loadSavedTrips(); };
      wrap.appendChild(item);
    });
  } catch { wrap.innerHTML = '<p class="empty-note">Could not load saved trips.</p>'; }
}

async function loadPractical() {
  const wrap = $("#practicalAcc"); wrap.innerHTML = "";
  const rows = await api("/api/practical");
  rows.forEach((p, i) => {
    const item = el("div", "acc-item" + (i === 0 ? " open" : ""),
      `<div class="acc-head">${p.title}<span class="tw">+</span></div><div class="acc-body"><p>${p.body}</p></div>`);
    item.querySelector(".acc-head").onclick = () => item.classList.toggle("open");
    wrap.appendChild(item);
  });
}

async function loadReviews() {
  const wrap = $("#reviewGrid"); wrap.innerHTML = '<p class="loading">Loading\u2026</p>';
  const rows = await api("/api/reviews"); wrap.innerHTML = "";
  rows.forEach(r => wrap.appendChild(el("div", "review", `
    <div class="place">${r.place}</div>
    <div class="stars">${"\u2605".repeat(r.rating)}${"\u2606".repeat(5 - r.rating)}</div>
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
    const note = $("#enqNote"); note.textContent = "Sending\u2026"; note.className = "form-note";
    const payload = { name: $("#enqName").value.trim(), email: $("#enqEmail").value.trim(), subject: $("#enqSubject").value.trim(), message: $("#enqMessage").value.trim() };
    try {
      const r = await api("/api/enquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      note.textContent = "\u2705 " + r.message + " (Ref #" + r.id + ")"; note.className = "form-note ok"; e.target.reset();
    } catch { note.textContent = "\u26a0 Please check your inputs and try again."; note.className = "form-note err"; }
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
        `<div class="sr-item" data-name="${r.name}"><span class="k">${r.type}</span>${r.name} <span style="color:#999">\u2014 ${r.detail}</span></div>`).join("");
      box.classList.add("show");
      box.querySelectorAll(".sr-item").forEach(it => it.onclick = () => {
        input.value = it.dataset.name || ""; box.classList.remove("show");
        const t = d.results.find(x => x.name === it.dataset.name)?.type;
        const map = { mosque: "mosques", dish: "food", venue: "food", attraction: "attractions", hospital: "medical", hotel: "hotels" };
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
  loadMosques(); loadFood(); loadAttractions(); loadMisc();
  loadTools(); loadItineraries(); loadBuilder(); loadPractical(); loadReviews();
  setTimeout(loadMap, 300);
});
