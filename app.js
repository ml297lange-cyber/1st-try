// Mein Tag – daily overview PWA
const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const DEFAULTS = { city: "", lat: null, lon: null, frost: 0, ics: [], proxy: "", token: "", ntfy: "" };
let settings = { ...DEFAULTS, ...store.get("settings", {}) };
const CAL_COLORS = ["#2563eb", "#16a34a", "#db2777", "#ea580c", "#7c3aed", "#0891b2"];

const fmtTime = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
const fmtDay = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" });
const fmtShortDay = new Intl.DateTimeFormat("de-DE", { weekday: "short" });

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function startOfDay(d, add = 0) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + add); return x; }

// ---------- Header ----------
function renderHeader() {
  const now = new Date(), h = now.getHours();
  $("#greeting").textContent = h < 11 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend";
  $("#today").textContent = fmtDay.format(now);
}

// ---------- Weather (Open-Meteo, no key needed) ----------
const WMO = {
  0: ["☀️", "Klar"], 1: ["🌤️", "Überwiegend klar"], 2: ["⛅", "Teilweise bewölkt"], 3: ["☁️", "Bewölkt"],
  45: ["🌫️", "Nebel"], 48: ["🌫️", "Reifnebel"], 51: ["🌦️", "Leichter Niesel"], 53: ["🌦️", "Niesel"], 55: ["🌧️", "Starker Niesel"],
  56: ["🧊", "Gefrierender Niesel"], 57: ["🧊", "Gefrierender Niesel"], 61: ["🌧️", "Leichter Regen"], 63: ["🌧️", "Regen"],
  65: ["🌧️", "Starker Regen"], 66: ["🧊", "Gefrierender Regen"], 67: ["🧊", "Gefrierender Regen"], 71: ["🌨️", "Leichter Schnee"],
  73: ["🌨️", "Schnee"], 75: ["❄️", "Starker Schnee"], 77: ["🌨️", "Schneegriesel"], 80: ["🌦️", "Regenschauer"],
  81: ["🌧️", "Regenschauer"], 82: ["⛈️", "Heftige Schauer"], 85: ["🌨️", "Schneeschauer"], 86: ["❄️", "Schneeschauer"],
  95: ["⛈️", "Gewitter"], 96: ["⛈️", "Gewitter mit Hagel"], 99: ["⛈️", "Gewitter mit Hagel"],
};
const wmo = (c) => WMO[c] || ["🌡️", "–"];

async function loadWeather() {
  if (settings.lat == null) {
    $("#weather").innerHTML = `<p class="muted">Bitte in den Einstellungen ⚙︎ einen Ort eintragen.</p>`;
    return null;
  }
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${settings.lat}&longitude=${settings.lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&hourly=temperature_2m,precipitation_probability,weather_code,wind_gusts_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_gusts_10m_max` +
    `&timezone=auto&forecast_days=3`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    store.set("weatherCache", data);
    return data;
  } catch {
    return store.get("weatherCache", null);
  }
}

function analyzeWeather(w, frostLimit) {
  // Tonight = today 18:00 until tomorrow 09:00 (local time of the location)
  const t = w.hourly.time, temps = w.hourly.temperature_2m;
  const today = w.daily.time[0], tomorrow = w.daily.time[1];
  let nightMin = Infinity, nightMinAt = null;
  t.forEach((ts, i) => {
    const [d, hm] = ts.split("T"), h = +hm.slice(0, 2);
    if ((d === today && h >= 18) || (d === tomorrow && h <= 9)) {
      if (temps[i] < nightMin) { nightMin = temps[i]; nightMinAt = hm; }
    }
  });
  const alerts = [];
  if (nightMin <= frostLimit) {
    alerts.push({ level: "danger", emoji: "🚗❄️", text: `Heute Nacht bis ${nightMin.toFixed(1)} °C (gegen ${nightMinAt} Uhr) – Auto abdecken bzw. Scheibe schützen!` });
  } else if (nightMin <= frostLimit + 2) {
    alerts.push({ level: "warn", emoji: "🌡️", text: `Heute Nacht knapp über Frost (${nightMin.toFixed(1)} °C). Evtl. Auto abdecken.` });
  }
  const codesToday = w.hourly.weather_code.filter((_, i) => t[i].startsWith(today));
  if (codesToday.some(c => [56, 57, 66, 67].includes(c))) alerts.push({ level: "danger", emoji: "🧊", text: "Glatteisgefahr durch gefrierenden Regen heute!" });
  if (codesToday.some(c => c >= 71 && c <= 77 || c === 85 || c === 86)) alerts.push({ level: "warn", emoji: "🌨️", text: "Heute ist Schnee angesagt – mehr Zeit einplanen." });
  if (w.daily.wind_gusts_10m_max[0] >= 65) alerts.push({ level: "warn", emoji: "💨", text: `Sturmböen bis ${Math.round(w.daily.wind_gusts_10m_max[0])} km/h heute.` });
  if (w.daily.precipitation_probability_max[0] >= 60) alerts.push({ level: "warn", emoji: "☂️", text: `Regenwahrscheinlichkeit ${w.daily.precipitation_probability_max[0]} % – Schirm mitnehmen.` });
  if (w.daily.temperature_2m_max[0] >= 30) alerts.push({ level: "warn", emoji: "🥵", text: `Heiß heute: bis ${Math.round(w.daily.temperature_2m_max[0])} °C – viel trinken.` });
  return { nightMin, alerts };
}

function renderWeather(w) {
  if (!w) return [];
  const c = w.current, [icon, label] = wmo(c.weather_code);
  const { nightMin, alerts } = analyzeWeather(w, Number(settings.frost));
  const days = w.daily.time.map((d, i) => {
    const [ic] = wmo(w.daily.weather_code[i]);
    const name = i === 0 ? "Heute" : i === 1 ? "Morgen" : fmtShortDay.format(new Date(d + "T12:00"));
    return `<div class="wx-day"><div>${name}</div><div style="font-size:1.4rem">${ic}</div>
      <div>${Math.round(w.daily.temperature_2m_max[i])}° / ${Math.round(w.daily.temperature_2m_min[i])}°</div>
      <div class="muted">💧${w.daily.precipitation_probability_max[i] ?? 0}%</div></div>`;
  }).join("");
  $("#weather").innerHTML = `
    <div class="wx-now">
      <span class="wx-icon">${icon}</span>
      <div><div class="wx-temp">${Math.round(c.temperature_2m)}°</div>
      <div class="muted">${label} · gefühlt ${Math.round(c.apparent_temperature)}°</div></div>
    </div>
    <p class="muted small">${esc(settings.city)} · Tiefstwert heute Nacht: <b>${nightMin.toFixed(1)} °C</b></p>
    <div class="wx-days">${days}</div>`;
  return alerts;
}

// ---------- Calendar ----------
function proxied(url) {
  url = url.trim().replace(/^webcal:\/\//i, "https://");
  if (!settings.proxy) return url;
  return settings.proxy.replace(/\/$/, "") + "/ics?url=" + encodeURIComponent(url);
}

async function loadCalendars() {
  const urls = settings.ics.filter(Boolean);
  if (!urls.length) return null;
  const results = await Promise.all(urls.map(async (u, i) => {
    try {
      const res = await fetch(proxied(u), { headers: settings.token ? { "X-Token": settings.token } : {} });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      store.set("ics_" + i, text);
      return { text, color: CAL_COLORS[i % CAL_COLORS.length] };
    } catch (e) {
      const cached = store.get("ics_" + i, null);
      return { text: cached, color: CAL_COLORS[i % CAL_COLORS.length], error: e.message };
    }
  }));
  return results;
}

function renderEventList(el, events, now, emptyText) {
  if (!events.length) { el.innerHTML = `<p class="muted">${emptyText}</p>`; return; }
  el.innerHTML = events.map(e => {
    const cls = e.end <= now ? "past" : e.start <= now ? "now" : "";
    const time = e.allDay ? "Ganztägig" : `${fmtTime.format(e.start)}–${fmtTime.format(e.end)}`;
    return `<div class="event ${cls}"><div class="event-time">${time}</div>
      <div><div class="event-title"><span class="dot" style="background:${e.color}"></span>${esc(e.title || "(ohne Titel)")}</div>
      ${e.location ? `<div class="event-loc">📍 ${esc(e.location)}</div>` : ""}</div></div>`;
  }).join("");
}

function renderCalendars(results) {
  if (!results) {
    $("#events").innerHTML = `<p class="muted">Noch kein Kalender verbunden. Tippe auf ⚙︎ und füge deinen iCal-Link ein.</p>`;
    $("#events-tomorrow").innerHTML = "";
    return [];
  }
  const alerts = [];
  const parsed = [];
  for (const r of results) {
    if (r.error) alerts.push({ level: "warn", emoji: "📅", text: `Ein Kalender konnte nicht geladen werden (${esc(r.error)}). ${settings.proxy ? "" : "Proxy eingerichtet? Siehe Anleitung."}` });
    if (r.text) parsed.push({ ...ICS.parse(r.text), color: r.color });
  }
  const now = new Date();
  const today = ICS.eventsBetween(parsed, startOfDay(now), startOfDay(now, 1));
  const tomorrow = ICS.eventsBetween(parsed, startOfDay(now, 1), startOfDay(now, 2));
  renderEventList($("#events"), today, now, "Heute keine Termine 🎉");
  renderEventList($("#events-tomorrow"), tomorrow, now, "Keine Termine.");
  const next = today.find(e => !e.allDay && e.start > now);
  if (next) {
    const mins = Math.round((next.start - now) / 60000);
    if (mins <= 60) alerts.push({ level: "ok", emoji: "⏰", text: `In ${mins} Min: ${esc(next.title)}` });
  }
  return alerts;
}

// ---------- Mail (via Worker + IMAP) ----------
async function loadMail() {
  const box = $("#inbox");
  if (!settings.proxy || !settings.token) {
    box.innerHTML = `<p class="muted small">E-Mails werden angezeigt, sobald der Worker mit deinem Mail-Konto eingerichtet ist (siehe Anleitung).
      iMessage/WhatsApp kann eine Web-App nicht auslesen – Apple erlaubt das nicht. Nutze die Schnellzugriffe:</p>`;
    return;
  }
  try {
    const res = await fetch(settings.proxy.replace(/\/$/, "") + "/mail", { headers: { "X-Token": settings.token } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    store.set("mailCache", data);
    renderMail(data);
  } catch (e) {
    const cached = store.get("mailCache", null);
    if (cached) renderMail(cached, true);
    else box.innerHTML = `<p class="muted">E-Mails konnten nicht geladen werden (${esc(e.message)}).</p>`;
  }
}

function renderMail(data, stale) {
  const list = (data.messages || []).slice(0, 6).map(m => `
    <div class="event"><div style="min-width:0">
      <div class="event-title">${esc(m.subject || "(kein Betreff)")}</div>
      <div class="event-loc">${esc(m.from)}</div></div></div>`).join("");
  $("#inbox").innerHTML = `<p><b>${data.unread}</b> ungelesene E-Mail${data.unread === 1 ? "" : "s"}${stale ? " <span class='muted'>(offline)</span>" : ""}</p>${list}`;
}

// ---------- Tasks & note ----------
function todayKey() { const d = new Date(); return d.toISOString().slice(0, 10); }
function renderTasks() {
  const tasks = store.get("tasks", []);
  $("#tasks").innerHTML = tasks.map((t, i) => `
    <li class="${t.done ? "done" : ""}"><input type="checkbox" data-i="${i}" ${t.done ? "checked" : ""}>
    <span>${esc(t.text)}</span><button class="del" data-del="${i}" aria-label="Löschen">✕</button></li>`).join("")
    || `<li class="muted" style="border:0">Keine Aufgaben.</li>`;
}
$("#task-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("#task-input").value.trim();
  if (!text) return;
  const tasks = store.get("tasks", []); tasks.push({ text, done: false }); store.set("tasks", tasks);
  $("#task-input").value = ""; renderTasks();
});
$("#tasks").addEventListener("click", (e) => {
  const tasks = store.get("tasks", []);
  if (e.target.dataset.del != null) tasks.splice(+e.target.dataset.del, 1);
  else if (e.target.dataset.i != null) tasks[+e.target.dataset.i].done = e.target.checked;
  else return;
  store.set("tasks", tasks); renderTasks();
});
function initNote() {
  const notes = store.get("notes", {});
  $("#note").value = notes[todayKey()] || "";
  $("#note").oninput = () => { const n = store.get("notes", {}); n[todayKey()] = $("#note").value; store.set("notes", n); };
}

// ---------- Alerts ----------
function renderAlerts(list) {
  $("#alerts").innerHTML = list.map(a =>
    `<div class="alert ${a.level}"><span class="emoji">${a.emoji}</span><span>${a.text}</span></div>`).join("");
}

// ---------- Settings ----------
function openSettings() {
  $("#s-city").value = settings.city;
  $("#s-coords").textContent = settings.lat != null ? `Koordinaten: ${(+settings.lat).toFixed(3)}, ${(+settings.lon).toFixed(3)}` : "";
  $("#s-frost").value = settings.frost;
  $("#s-ics").value = settings.ics.join("\n");
  $("#s-proxy").value = settings.proxy;
  $("#s-token").value = settings.token;
  $("#s-ntfy").value = settings.ntfy;
  $("#settings").showModal();
}
async function geocode(name) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=de`);
  const j = await r.json();
  if (!j.results?.length) throw new Error("Ort nicht gefunden");
  return j.results[0];
}
$("#open-settings").onclick = openSettings;
$("#refresh").onclick = () => refresh(true);
$("#s-locate").onclick = () => {
  navigator.geolocation.getCurrentPosition(async (p) => {
    settings.lat = p.coords.latitude; settings.lon = p.coords.longitude;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${settings.lat}&lon=${settings.lon}&zoom=10&accept-language=de`);
      const j = await r.json();
      $("#s-city").value = j.address?.city || j.address?.town || j.address?.village || "Mein Standort";
    } catch { $("#s-city").value = "Mein Standort"; }
    $("#s-coords").textContent = `Koordinaten: ${settings.lat.toFixed(3)}, ${settings.lon.toFixed(3)}`;
  }, () => alert("Standort nicht verfügbar. Bitte Ort eintippen."));
};
$("#s-test-push").onclick = async () => {
  const topic = $("#s-ntfy").value.trim();
  if (!topic) return alert("Bitte zuerst ein ntfy-Thema eintragen.");
  try {
    await fetch("https://ntfy.sh/" + encodeURIComponent(topic), {
      method: "POST", body: "Test von „Mein Tag“ – Push-Nachrichten funktionieren! 🎉",
      headers: { Title: "Mein Tag", Tags: "white_check_mark" },
    });
    alert("Gesendet! Kommt die Nachricht in der ntfy-App an?");
  } catch { alert("Senden fehlgeschlagen."); }
};
$("#settings-form").addEventListener("submit", async (e) => {
  if (e.submitter?.value !== "save") return;
  const city = $("#s-city").value.trim();
  if (city && city !== settings.city && city !== "Mein Standort") {
    try {
      const g = await geocode(city);
      settings.lat = g.latitude; settings.lon = g.longitude; settings.city = g.name;
    } catch (err) { alert(err.message); }
  } else settings.city = city;
  settings.frost = Number($("#s-frost").value) || 0;
  settings.ics = $("#s-ics").value.split(/\s*\n\s*/).map(s => s.trim()).filter(Boolean);
  settings.proxy = $("#s-proxy").value.trim();
  settings.token = $("#s-token").value.trim();
  settings.ntfy = $("#s-ntfy").value.trim();
  store.set("settings", settings);
  refresh(true);
});

// ---------- Main ----------
let lastRefresh = 0;
async function refresh(force) {
  if (!force && Date.now() - lastRefresh < 5 * 60000) return;
  lastRefresh = Date.now();
  renderHeader(); renderTasks(); initNote();
  const [w, cals] = await Promise.all([loadWeather(), loadCalendars(), loadMail()]);
  renderAlerts([...renderWeather(w), ...renderCalendars(cals)]);
}

refresh(true);
setInterval(() => refresh(false), 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(false); });

if (!window.navigator.standalone && /iPad|iPhone|Macintosh/.test(navigator.userAgent) && "ontouchend" in document) {
  $("#install-hint").hidden = false;
}
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
