// Mein Tag – daily overview for the iPad home screen
import { verseForDate, fetchVerseText } from "./verses.mjs";

const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const DEFAULTS = {
  city: "", lat: null, lon: null, frost: 0, dataKey: "", ntfy: "",
  aiKey: "", aiModel: "claude-opus-5-5", theme: "auto",
};
const settings = { ...DEFAULTS, ...store.get("settings", {}) };
const saveSettings = () => store.set("settings", settings);
const state = { weather: null, analysis: null, data: null, dataError: "", verse: null };

const fmtTime = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
const fmtDay = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" });
const fmtWd = new Intl.DateTimeFormat("de-DE", { weekday: "short" });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const startOfDay = (d, add = 0) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + add); return x; };
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

// ---------- Theme & header ----------
function applyTheme() {
  if (settings.theme === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", settings.theme);
  document.querySelectorAll("#s-theme button").forEach(b => b.classList.toggle("on", b.dataset.v === settings.theme));
}
function renderHeader() {
  const now = new Date(), h = now.getHours();
  $("#greeting").textContent = h < 5 ? "Gute Nacht" : h < 11 ? "Guten Morgen" : h < 17 ? "Guten Tag" : h < 22 ? "Guten Abend" : "Gute Nacht";
  $("#today").textContent = fmtDay.format(now);
  $("#clock").textContent = fmtTime.format(now) + " Uhr";
  document.body.dataset.sky = h < 6 || h >= 21 ? "night" : h < 10 ? "morning" : h < 17 ? "day" : "evening";
}

// ---------- Weather (Open-Meteo, free, no key) ----------
const WMO = {
  0: ["☀️", "Klar"], 1: ["🌤️", "Überwiegend klar"], 2: ["⛅", "Teilweise bewölkt"], 3: ["☁️", "Bewölkt"],
  45: ["🌫️", "Nebel"], 48: ["🌫️", "Reifnebel"], 51: ["🌦️", "Leichter Niesel"], 53: ["🌦️", "Niesel"], 55: ["🌧️", "Starker Niesel"],
  56: ["🧊", "Gefrierender Niesel"], 57: ["🧊", "Gefrierender Niesel"], 61: ["🌧️", "Leichter Regen"], 63: ["🌧️", "Regen"],
  65: ["🌧️", "Starker Regen"], 66: ["🧊", "Gefrierender Regen"], 67: ["🧊", "Gefrierender Regen"], 71: ["🌨️", "Leichter Schnee"],
  73: ["🌨️", "Schnee"], 75: ["❄️", "Starker Schnee"], 77: ["🌨️", "Schneegriesel"], 80: ["🌦️", "Regenschauer"],
  81: ["🌧️", "Regenschauer"], 82: ["⛈️", "Heftige Schauer"], 85: ["🌨️", "Schneeschauer"], 86: ["❄️", "Schneeschauer"],
  95: ["⛈️", "Gewitter"], 96: ["⛈️", "Gewitter mit Hagel"], 99: ["⛈️", "Gewitter mit Hagel"],
};
const wmo = (c, night) => { const w = WMO[c] || ["🌡️", "–"]; return night && c <= 1 ? ["🌙", w[1]] : w; };

async function loadWeather() {
  if (settings.lat == null) return null;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${settings.lat}&longitude=${settings.lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,is_day` +
    `&hourly=temperature_2m,precipitation_probability,weather_code,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_gusts_10m_max` +
    `&timezone=auto&forecast_days=4`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    store.set("weatherCache", { at: settings.lat + "," + settings.lon, data });
    return data;
  } catch {
    const c = store.get("weatherCache", null);
    return c && c.at === settings.lat + "," + settings.lon ? c.data : null;
  }
}

function analyzeWeather(w) {
  const limit = Number(settings.frost) || 0;
  const t = w.hourly.time, temps = w.hourly.temperature_2m;
  const [today, tomorrow] = w.daily.time;
  let nightMin = Infinity, nightMinAt = "";
  t.forEach((ts, i) => {
    const [d, hm] = ts.split("T"), h = +hm.slice(0, 2);
    if ((d === today && h >= 18) || (d === tomorrow && h <= 9)) {
      if (temps[i] < nightMin) { nightMin = temps[i]; nightMinAt = hm; }
    }
  });
  const alerts = [];
  if (nightMin <= limit) alerts.push({ level: "danger", emoji: "🚗❄️", text: `Heute Nacht bis ${nightMin.toFixed(1)} °C (gegen ${nightMinAt} Uhr) – Auto abdecken!` });
  else if (nightMin <= limit + 2) alerts.push({ level: "warn", emoji: "🌡️", text: `Nachts knapp über Frost (${nightMin.toFixed(1)} °C) – evtl. Auto abdecken.` });
  const codesToday = w.hourly.weather_code.filter((_, i) => t[i].startsWith(today));
  if (codesToday.some(c => [56, 57, 66, 67].includes(c))) alerts.push({ level: "danger", emoji: "🧊", text: "Glatteisgefahr durch gefrierenden Regen heute!" });
  if (codesToday.some(c => (c >= 71 && c <= 77) || c === 85 || c === 86)) alerts.push({ level: "warn", emoji: "🌨️", text: "Heute ist Schnee angesagt – mehr Zeit einplanen." });
  if (w.daily.wind_gusts_10m_max[0] >= 65) alerts.push({ level: "warn", emoji: "💨", text: `Sturmböen bis ${Math.round(w.daily.wind_gusts_10m_max[0])} km/h heute.` });
  if (w.daily.precipitation_probability_max[0] >= 60) alerts.push({ level: "warn", emoji: "☂️", text: `Regen wahrscheinlich (${w.daily.precipitation_probability_max[0]} %) – Schirm mitnehmen.` });
  if (w.daily.temperature_2m_max[0] >= 30) alerts.push({ level: "warn", emoji: "🥵", text: `Heiß heute: bis ${Math.round(w.daily.temperature_2m_max[0])} °C – viel trinken.` });
  return { nightMin, nightMinAt, alerts };
}

function renderWeather() {
  const w = state.weather;
  $("#weather-place").textContent = settings.city || "";
  if (settings.lat == null) {
    $("#hero-weather").innerHTML = `<button id="hero-locate">📍 Standort für Wetter festlegen</button>`;
    $("#hero-locate").onclick = useMyLocation;
    $("#weather").innerHTML = `<div class="empty"><span class="big">📍</span>Noch kein Ort festgelegt.<br><br>
      <button id="w-locate">Meinen Standort verwenden</button><br><br>
      <a href="#" id="w-search" class="small">oder Stadt suchen</a></div>`;
    $("#w-locate").onclick = useMyLocation;
    $("#w-search").onclick = (e) => { e.preventDefault(); openSheet("settings"); setTimeout(() => $("#s-city").focus(), 300); };
    return;
  }
  if (!w) { $("#weather").innerHTML = `<p class="muted">Wetter konnte nicht geladen werden.</p>`; $("#hero-weather").innerHTML = ""; return; }
  const c = w.current, [icon, label] = wmo(c.weather_code, !c.is_day);
  const a = state.analysis;
  $("#hero-weather").innerHTML = `
    <div class="now"><span class="icon">${icon}</span><span class="temp">${Math.round(c.temperature_2m)}°</span></div>
    <div class="desc">${label} · gefühlt ${Math.round(c.apparent_temperature)}°</div>
    <div class="minmax">H ${Math.round(w.daily.temperature_2m_max[0])}° · T ${Math.round(w.daily.temperature_2m_min[0])}° · Nacht ${a.nightMin.toFixed(1)}°</div>`;

  // next 12 hours
  let startIdx = w.hourly.time.findIndex(t => new Date(t) >= new Date(Date.now() - 3600000));
  if (startIdx < 0) startIdx = 0;
  const hours = w.hourly.time.slice(startIdx, startIdx + 12).map((t, k) => {
    const i = startIdx + k, temp = w.hourly.temperature_2m[i];
    const [ic] = wmo(w.hourly.weather_code[i], !w.hourly.is_day[i]);
    return `<div class="hour ${temp <= (Number(settings.frost) || 0) ? "frost" : ""}">
      <div class="muted">${k === 0 ? "Jetzt" : t.slice(11, 13) + " h"}</div><span class="i">${ic}</span><b>${Math.round(temp)}°</b></div>`;
  }).join("");

  const lo = Math.min(...w.daily.temperature_2m_min), hi = Math.max(...w.daily.temperature_2m_max), span = Math.max(1, hi - lo);
  const days = w.daily.time.map((d, i) => {
    const [ic] = wmo(w.daily.weather_code[i]);
    const name = i === 0 ? "Heute" : i === 1 ? "Morgen" : fmtWd.format(new Date(d + "T12:00"));
    const min = w.daily.temperature_2m_min[i], max = w.daily.temperature_2m_max[i];
    return `<div class="day"><span>${name}</span><span>${ic}</span>
      <div class="range"><span style="left:${(min - lo) / span * 100}%; right:${(hi - max) / span * 100}%"></span></div>
      <span class="small"><span class="muted">${Math.round(min)}°</span> ${Math.round(max)}°</span></div>`;
  }).join("");
  $("#weather").innerHTML = `<div class="hours">${hours}</div><div class="days">${days}</div>`;
}

// ---------- Location ----------
function geolocate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject({ code: 2 });
    navigator.geolocation.getCurrentPosition(p => resolve(p.coords), reject,
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60000 });
  });
}
function geoErrorText(e) {
  if (e && e.code === 1) return "Standortzugriff ist blockiert.\n\nAuf dem iPad: Einstellungen → Datenschutz & Sicherheit → Ortungsdienste → einschalten, dann weiter unten „Safari-Websites“ → „Beim Verwenden der App“.\n\nOder tippe einfach deine Stadt in das Suchfeld.";
  if (e && e.code === 3) return "Der Standort konnte nicht rechtzeitig ermittelt werden. Bitte nochmal versuchen oder die Stadt eintippen.";
  return "Standort nicht verfügbar. Bitte tippe deine Stadt in das Suchfeld.";
}
async function useMyLocation() {
  const btns = ["#s-locate", "#hero-locate", "#w-locate"].map(s => $(s)).filter(Boolean);
  btns.forEach(b => { b.disabled = true; b.dataset.label = b.textContent; b.textContent = "Standort wird ermittelt …"; });
  try {
    const c = await geolocate();
    let city = "Mein Standort";
    try {
      const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${c.latitude}&longitude=${c.longitude}&localityLanguage=de`);
      const j = await r.json();
      city = j.city || j.locality || city;
    } catch {}
    await setLocation({ lat: c.latitude, lon: c.longitude, city });
  } catch (e) {
    alert(geoErrorText(e));
  } finally {
    btns.forEach(b => { b.disabled = false; b.textContent = b.dataset.label; });
  }
}
async function searchPlaces(q) {
  q = q.split(",")[0].trim();
  if (q.length < 2) return [];
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=de&format=json`);
  const j = await r.json();
  return (j.results || []).map(p => ({ lat: p.latitude, lon: p.longitude, city: p.name, region: [p.admin1, p.country].filter(Boolean).join(", ") }));
}
async function setLocation({ lat, lon, city }) {
  Object.assign(settings, { lat: +lat, lon: +lon, city });
  saveSettings();
  renderCurrentLocation();
  state.weather = await loadWeather();
  state.analysis = state.weather ? analyzeWeather(state.weather) : null;
  renderWeather(); renderAlerts();
  return state.weather ? `Ort gesetzt: ${city}` : `Ort gesetzt: ${city} (Wetter gerade nicht erreichbar)`;
}
function renderCurrentLocation() {
  $("#s-current").innerHTML = settings.lat != null
    ? `✅ Aktuell: <b>${esc(settings.city)}</b> <span class="muted">(${(+settings.lat).toFixed(2)}, ${(+settings.lon).toFixed(2)})</span>`
    : `<span class="muted">Noch kein Ort gespeichert.</span>`;
}

// ---------- Calendar & mail (encrypted data from GitHub Actions) ----------
const b64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function decrypt(payload, pass) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(payload.salt), iterations: payload.iter, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(payload.iv) }, key, b64(payload.data));
  return JSON.parse(new TextDecoder().decode(plain));
}
async function loadData() {
  state.dataError = "";
  if (!settings.dataKey) { state.data = null; return; }
  let payload = null;
  try {
    const res = await fetch("data.enc.json?t=" + Date.now(), { cache: "no-store" });
    if (res.status === 404) throw new Error("missing");
    if (!res.ok) throw new Error("HTTP " + res.status);
    payload = await res.json();
    store.set("dataEnc", payload);
  } catch (e) {
    payload = store.get("dataEnc", null);
    if (!payload) {
      state.data = null;
      state.dataError = e.message === "missing"
        ? "Noch keine Kalenderdaten vorhanden. Sind APPLE_ID, APPLE_APP_PASSWORD und DATA_KEY bei GitHub eingetragen? Der erste Abgleich kann ein paar Minuten dauern."
        : "Kalenderdaten nicht erreichbar (offline?).";
      return;
    }
  }
  try {
    const d = await decrypt(payload, settings.dataKey);
    d.events = d.events.map(e => ({
      ...e,
      start: e.allDay ? new Date(e.start + "T00:00") : new Date(e.start),
      end: e.allDay ? new Date(e.end + "T00:00") : new Date(e.end),
    }));
    state.data = d;
  } catch {
    state.data = null;
    state.dataError = "Der Daten-Schlüssel passt nicht. Bitte in den Einstellungen prüfen (muss genau wie DATA_KEY bei GitHub sein).";
  }
}
function eventsOn(dayOffset) {
  if (!state.data) return [];
  const from = startOfDay(new Date(), dayOffset), to = startOfDay(new Date(), dayOffset + 1);
  return state.data.events.filter(e => e.end > from && e.start < to);
}
function renderEventList(el, events, emptyHtml) {
  const now = new Date();
  if (!events.length) { el.innerHTML = emptyHtml; return; }
  el.innerHTML = events.map(e => {
    const cls = e.end <= now ? "past" : !e.allDay && e.start <= now ? "now" : "";
    const time = e.allDay ? `<div class="event-time">ganztägig</div>`
      : `<div class="event-time">${fmtTime.format(e.start)}<small>${fmtTime.format(e.end)}</small></div>`;
    const meta = [e.location && "📍 " + esc(e.location), esc(e.calendar)].filter(Boolean).join(" · ");
    return `<div class="event ${cls}">${time}<div class="event-bar" style="background:${esc(e.color)}"></div>
      <div><div class="event-title">${esc(e.title)}</div><div class="event-meta">${meta}</div></div></div>`;
  }).join("");
}
function renderCalendar() {
  const status = $("#data-status");
  if (!settings.dataKey) {
    $("#event-count").textContent = "";
    $("#events").innerHTML = `<div class="empty"><span class="big">📅</span><b>Kalender verbinden</b><br>
      <span class="small">Google- oder iCloud-Kalender – in 3 kurzen Schritten.</span><br><br>
      <button type="button" class="connect-btn">Kalender & E-Mail verbinden</button></div>`;
    $("#events .connect-btn").onclick = openConnect;
    $("#events-tomorrow").innerHTML = "";
    status.textContent = "";
    return;
  }
  if (!state.data) {
    $("#events").innerHTML = `<div class="empty"><span class="big">⏳</span>${esc(state.dataError)}</div>`;
    $("#events-tomorrow").innerHTML = ""; $("#event-count").textContent = ""; status.textContent = "";
    return;
  }
  const today = eventsOn(0), tomorrow = eventsOn(1);
  $("#event-count").textContent = today.length ? `${today.length} Termin${today.length === 1 ? "" : "e"}` : "frei";
  renderEventList($("#events"), today, `<div class="empty"><span class="big">🎉</span>Heute keine Termine</div>`);
  renderEventList($("#events-tomorrow"), tomorrow, `<p class="muted small">Keine Termine.</p>`);
  const mins = Math.round((Date.now() - new Date(state.data.generatedAt)) / 60000);
  status.textContent = `Abgeglichen vor ${mins < 1 ? "weniger als 1" : mins} Min.` +
    (state.data.errors?.length ? " ⚠️ " + state.data.errors.join(" · ") : "");
}
function renderMail() {
  const box = $("#inbox");
  const mail = state.data?.mail;
  $("#mail-app-link").href = settings.mailProvider === "gmail" ? "googlegmail://" : "message://";
  if (!mail) {
    box.innerHTML = `<div class="empty"><span class="big">📬</span>Sieh hier deine ungelesenen Mails.<br><br>
      <button type="button" class="connect-btn">E-Mail verbinden</button></div>`;
    box.querySelector(".connect-btn").onclick = openConnect;
    return;
  }
  box.innerHTML = `<div class="unread-big">${mail.unread}</div><div class="muted small" style="margin-bottom:6px">ungelesene E-Mail${mail.unread === 1 ? "" : "s"}</div>` +
    mail.messages.slice(0, 4).map(m => `<div class="mail"><div class="mail-subject">${esc(m.subject || "(kein Betreff)")}</div><div class="mail-from">${esc(m.from)}</div></div>`).join("");
}

// ---------- Verse of the day ----------
async function loadVerse() {
  const v = verseForDate();
  const cached = store.get("verse", null);
  if (cached && cached.ref === v.ref && cached.text) { state.verse = cached; return; }
  try {
    const r = await fetch("verse.json?t=" + todayKey(), { cache: "no-store" });
    if (r.ok) { const j = await r.json(); if (j.ref === v.ref && j.text) { state.verse = j; store.set("verse", j); return; } }
  } catch {}
  try { v.text = await fetchVerseText(v); store.set("verse", v); } catch {}
  state.verse = v;
}
function renderVerse() {
  const v = state.verse;
  if (!v) return;
  $("#verse").innerHTML = `${v.text ? `<p class="verse-text">„${esc(v.text)}“</p>` : `<p class="muted">Tippe unten, um den heutigen Vers zu lesen.</p>`}
    <div class="verse-ref">${esc(v.ref)} <span class="muted" style="font-weight:400">· Luther 1912</span></div>
    <div class="chips" style="margin-top:14px">
      <a href="${esc(v.appUrl)}">📖 In Bibel-App öffnen</a>
      <a href="https://www.bible.com/de/verse-of-the-day">✨ YouVersion-Vers des Tages</a>
    </div>`;
}

// ---------- Tasks & note ----------
const getTasks = () => store.get("tasks", []);
const setTasks = (t) => { store.set("tasks", t); renderTasks(); };
function renderTasks() {
  const tasks = getTasks();
  const open = tasks.filter(t => !t.done).length;
  $("#task-count").textContent = tasks.length ? `${open} offen` : "";
  $("#tasks").innerHTML = tasks.map((t, i) => `
    <li class="${t.done ? "done" : ""}"><input type="checkbox" class="check" data-i="${i}" ${t.done ? "checked" : ""} aria-label="Erledigt">
    <span>${esc(t.text)}</span><button class="del" data-del="${i}" aria-label="Löschen">✕</button></li>`).join("")
    || `<li class="muted small">Nichts zu tun – genieß den Tag ☕</li>`;
}
$("#task-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("#task-input").value.trim();
  if (!text) return;
  setTasks([...getTasks(), { text, done: false }]);
  $("#task-input").value = "";
});
$("#tasks").addEventListener("click", (e) => {
  const tasks = getTasks();
  if (e.target.dataset.del != null) tasks.splice(+e.target.dataset.del, 1);
  else if (e.target.dataset.i != null) tasks[+e.target.dataset.i].done = e.target.checked;
  else return;
  setTasks(tasks);
});
const getNote = () => store.get("notes", {})[todayKey()] || "";
function setNote(text) { const n = store.get("notes", {}); n[todayKey()] = text; store.set("notes", n); $("#note").value = text; }
$("#note").addEventListener("input", () => setNote($("#note").value));

// ---------- Alerts ----------
function renderAlerts() {
  const list = [...(state.analysis?.alerts || [])];
  const next = eventsOn(0).find(e => !e.allDay && e.start > new Date());
  if (next) {
    const mins = Math.round((next.start - Date.now()) / 60000);
    if (mins <= 60) list.push({ level: "ok", emoji: "⏰", text: `In ${mins} Min: ${esc(next.title)}` });
  }
  $("#alerts").innerHTML = list.map(a => `<div class="alert ${a.level}"><span class="emoji">${a.emoji}</span><span>${a.text}</span></div>`).join("");
}

// ---------- Push (ntfy) ----------
// at: optional local time "YYYY-MM-DDTHH:MM" for delayed delivery (reminder)
async function sendPush(title, message, at) {
  if (!settings.ntfy) throw new Error("Push-Nachrichten sind noch nicht eingerichtet (ntfy-Thema unter ⚙︎ eintragen).");
  const body = { topic: settings.ntfy, title, message, tags: ["sparkles"] };
  if (at) {
    const when = new Date(at);
    if (isNaN(when)) throw new Error("Ungültige Zeitangabe");
    if (when > Date.now() + 10000) body.delay = String(Math.floor(when / 1000));
  }
  const res = await fetch("https://ntfy.sh/", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) throw new Error("Push fehlgeschlagen (" + res.status + ")");
  return body.delay ? `Erinnerung geplant für ${fmtTime.format(new Date(at))} Uhr.` : "Push-Nachricht gesendet.";
}

// ---------- Sheets ----------
function openSheet(id) {
  document.querySelectorAll(".sheet").forEach(s => s.classList.toggle("open", s.id === id));
  $("#backdrop").classList.add("show");
  if (id === "settings") fillSettings();
}
function closeSheets() {
  document.querySelectorAll(".sheet").forEach(s => s.classList.remove("open"));
  $("#backdrop").classList.remove("show");
}
$("#backdrop").onclick = closeSheets;
document.querySelectorAll("[data-close]").forEach(b => b.onclick = closeSheets);
$("#open-settings").onclick = () => openSheet("settings");

// ---------- Settings ----------
function fillSettings() {
  renderCurrentLocation();
  $("#s-frost").value = settings.frost;
  $("#s-key").value = settings.dataKey;
  $("#s-ntfy").value = settings.ntfy;
  $("#s-ai-key").value = settings.aiKey;
  $("#s-ai-model").value = settings.aiModel;
  $("#s-data-status").textContent = settings.dataKey ? (state.data ? `✅ Verbunden${settings.mailUser ? " (" + settings.mailUser + ")" : ""}` : state.dataError) : "Noch nicht verbunden.";
  applyTheme();
}
$("#s-locate").onclick = useMyLocation;
let searchTimer, lastResults = [];
$("#s-city").addEventListener("input", () => {
  clearTimeout(searchTimer);
  const q = $("#s-city").value;
  searchTimer = setTimeout(async () => {
    try { lastResults = await searchPlaces(q); } catch { lastResults = []; }
    $("#s-results").innerHTML = lastResults.map((p, i) => `<li data-i="${i}"><b>${esc(p.city)}</b> <small>${esc(p.region)}</small></li>`).join("")
      || (q.trim().length >= 2 ? `<li class="muted">Kein Ort gefunden</li>` : "");
  }, 300);
});
$("#s-city").addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  if (!lastResults.length) { try { lastResults = await searchPlaces($("#s-city").value); } catch {} }
  if (lastResults[0]) pickPlace(lastResults[0]);
  else alert("Ort nicht gefunden. Versuch es nur mit dem Stadtnamen, z. B. „Köln“.");
});
$("#s-results").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-i]");
  if (li) pickPlace(lastResults[+li.dataset.i]);
});
function pickPlace(p) {
  $("#s-results").innerHTML = ""; $("#s-city").value = ""; $("#s-city").blur();
  setLocation(p);
}
$("#s-frost").addEventListener("change", () => { settings.frost = Number($("#s-frost").value) || 0; saveSettings(); refresh(true); });
$("#s-key").addEventListener("change", async () => { settings.dataKey = $("#s-key").value.trim(); saveSettings(); await refresh(true); fillSettings(); });
$("#s-ntfy").addEventListener("change", () => { settings.ntfy = $("#s-ntfy").value.trim(); saveSettings(); });
$("#s-ai-key").addEventListener("change", () => { settings.aiKey = $("#s-ai-key").value.trim(); saveSettings(); });
$("#s-ai-model").addEventListener("change", () => { settings.aiModel = $("#s-ai-model").value; saveSettings(); });
$("#s-theme").addEventListener("click", (e) => { if (e.target.dataset.v) { settings.theme = e.target.dataset.v; saveSettings(); applyTheme(); } });
$("#s-test-push").onclick = async () => {
  settings.ntfy = $("#s-ntfy").value.trim(); saveSettings();
  try { await sendPush("Mein Tag", "Test von „Mein Tag“ – Push-Nachrichten funktionieren! 🎉"); alert("Gesendet! Kommt die Nachricht in der ntfy-App an?"); }
  catch (e) { alert(e.message); }
};

// ---------- Toast & error display ----------
let toastTimer;
function toast(msg, ms = 3500) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
window.addEventListener("error", (e) => toast("Fehler: " + (e.message || "unbekannt"), 6000));
window.addEventListener("unhandledrejection", (e) => toast("Fehler: " + (e.reason?.message || e.reason || "unbekannt"), 6000));

// ---------- WhatsApp favourites ----------
const WA_COLORS = ["#25d366", "#128c7e", "#34b7f1", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444", "#0ea5e9"];
const getContacts = () => store.get("waContacts", []);
const setContacts = (c) => { store.set("waContacts", c); renderContacts(); };
function normalizePhone(p) {
  let d = String(p).replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "49" + d.slice(1); // German number without country code
  return d.replace(/\D/g, "");
}
const waLink = (c, text) => `https://wa.me/${c.phone}${text ? "?text=" + encodeURIComponent(text) : ""}`;
function renderContacts() {
  const list = getContacts();
  $("#wa-contacts").innerHTML = list.map((c, i) => {
    const initials = c.name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
    return `<a class="wa-contact" href="${esc(waLink(c))}" target="_blank" rel="noopener">
      <span class="wa-avatar" style="background:${WA_COLORS[i % WA_COLORS.length]}">${esc(initials)}</span>${esc(c.name)}
      <button type="button" class="wa-del" data-del="${i}" aria-label="Entfernen">✕</button></a>`;
  }).join("") + `<a class="wa-contact" href="#" id="wa-add"><span class="wa-avatar" style="background:var(--soft);color:var(--muted)">+</span>Hinzufügen</a>`;
  $("#wa-add").onclick = (e) => { e.preventDefault(); $("#wa-form").hidden = false; $("#wa-name").focus(); };
}
$("#wa-contacts").addEventListener("click", (e) => {
  const del = e.target.closest("[data-del]");
  if (!del) return;
  e.preventDefault();
  const c = getContacts(); c.splice(+del.dataset.del, 1); setContacts(c);
});
$("#wa-edit").onclick = () => $("#whatsapp-card").classList.toggle("editing");
$("#wa-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#wa-name").value.trim(), phone = normalizePhone($("#wa-phone").value);
  if (!name || phone.length < 8) return toast("Bitte Name und Handynummer eingeben.");
  setContacts([...getContacts(), { name, phone }]);
  $("#wa-name").value = ""; $("#wa-phone").value = ""; $("#wa-form").hidden = true;
});

// ---------- Connect wizard (mail & calendar) ----------
const PROVIDERS = {
  gmail: { host: "imap.gmail.com", link: "https://myaccount.google.com/apppasswords", placeholder: "deine.adresse@gmail.com",
    howto: "Google: Auf der Seite einen Namen eingeben (z. B. „Mein Tag“) → Erstellen → das 16-stellige Passwort kopieren und unten einfügen. (Falls die Seite das nicht anbietet: zuerst die „Bestätigung in zwei Schritten“ einschalten.)" },
  icloud: { host: "imap.mail.me.com", link: "https://account.apple.com/account/manage", placeholder: "name@icloud.com",
    howto: "Apple: Anmelden → „Anmelden und Sicherheit“ → „App-spezifische Passwörter“ → + → Namen eingeben → Passwort kopieren und unten einfügen." },
  outlook: { host: "outlook.office365.com", link: "https://account.live.com/proofs/AppPassword", placeholder: "name@outlook.de",
    howto: "Microsoft: „Neues App-Kennwort erstellen“ → Kennwort kopieren und unten einfügen. (Dafür muss die Zwei-Schritt-Überprüfung aktiv sein.)" },
  gmx: { host: "imap.gmx.net", link: "https://www.gmx.net", placeholder: "name@gmx.de",
    howto: "GMX: Im Postfach unter Einstellungen → „POP3/IMAP Abruf“ den Zugriff erlauben. Dann unten dein normales GMX-Passwort eingeben." },
  webde: { host: "imap.web.de", link: "https://web.de", placeholder: "name@web.de",
    howto: "WEB.DE: Im Postfach unter Einstellungen → „POP3/IMAP Abruf“ den Zugriff erlauben. Dann unten dein normales WEB.DE-Passwort eingeben." },
  other: { host: "", link: "", placeholder: "deine@adresse.de", howto: "Trag den IMAP-Server deines Anbieters ein (steht in dessen Hilfe, oft „imap.anbieter.de“)." },
};
function updateProvider() {
  const key = $("#c-provider").value, p = PROVIDERS[key];
  $("#c-mail-fields").hidden = key === "none";
  if (!p) return;
  $("#c-howto").textContent = p.howto;
  $("#c-howto-link").hidden = !p.link;
  $("#c-howto-link").href = p.link || "#";
  $("#c-email").placeholder = p.placeholder;
  $("#c-host").hidden = key !== "other";
  $("#c-pass").placeholder = key === "gmx" || key === "webde" ? "Passwort" : "App-Passwort";
}
function openConnect() {
  $("#c-provider").value = settings.mailProvider || "gmail";
  $("#c-email").value = settings.mailUser || "";
  $("#c-status").textContent = "";
  updateProvider();
  openSheet("connect");
}
function randomKey() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function buildSetupCode() {
  const key = $("#c-provider").value;
  const cfg = { v: 1 };
  if (key !== "none") {
    const user = $("#c-email").value.trim(), pass = $("#c-pass").value.trim();
    const host = key === "other" ? $("#c-host").value.trim() : PROVIDERS[key].host;
    if (!user || !pass) throw new Error("Bitte E-Mail-Adresse und Passwort bei Schritt 1 eintragen.");
    if (!host) throw new Error("Bitte den IMAP-Server eintragen.");
    cfg.mail = { host, user, pass: key === "gmail" ? pass.replace(/\s+/g, "") : pass };
    settings.mailProvider = key; settings.mailUser = user;
  }
  const ics = $("#c-ics").value.trim();
  if (ics) {
    if (!/^(https?|webcal):\/\//i.test(ics)) throw new Error("Der Kalender-Link muss mit https:// beginnen.");
    cfg.ics = [ics];
  }
  if ($("#c-apple-on").checked) {
    let user = $("#c-apple-id").value.trim(), pass = $("#c-apple-pass").value.trim();
    if (!user && key === "icloud") { user = cfg.mail.user; pass = cfg.mail.pass; }
    if (!user || !pass) throw new Error("Bitte Apple-ID und App-Passwort für den iCloud-Kalender eintragen.");
    cfg.apple = { user, pass };
  }
  if (!cfg.mail && !cfg.ics && !cfg.apple) throw new Error("Bitte mindestens E-Mail oder einen Kalender eintragen.");
  // Also include what the automatic push messages need
  if (settings.ntfy) cfg.ntfy = settings.ntfy;
  if (settings.lat != null) Object.assign(cfg, { lat: settings.lat, lon: settings.lon, city: settings.city });
  cfg.frost = Number(settings.frost) || 0;
  if (!settings.dataKey) settings.dataKey = randomKey();
  cfg.dataKey = settings.dataKey;
  saveSettings();
  return JSON.stringify(cfg);
}
async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); return true; }
  catch { return false; }
}
$("#c-provider").addEventListener("change", updateProvider);
$("#c-apple-on").addEventListener("change", () => { $("#c-apple").hidden = !$("#c-apple-on").checked; });
$("#c-copy").onclick = async () => {
  let code;
  try { code = buildSetupCode(); } catch (e) { return toast(e.message, 5000); }
  if (!(await copyText(code, "✓ Code kopiert – jetzt ② GitHub öffnen"))) {
    const ta = $("#c-code"); ta.hidden = false; ta.value = code; ta.focus(); ta.select();
    toast("Bitte den markierten Code kopieren (lange tippen → Kopieren).", 6000);
  }
  $("#c-status").textContent = "";
};
$("#c-copy-name").onclick = () => copyText("MEIN_TAG_CONFIG", "✓ Name kopiert");
$("#c-check").onclick = async () => {
  $("#c-status").textContent = "Prüfe …";
  await loadData();
  renderCalendar(); renderMail(); renderAlerts();
  if (state.data) {
    const errs = state.data.errors?.length ? " ⚠️ " + state.data.errors.join(" · ") : "";
    const mail = state.data.mail ? `${state.data.mail.unread} ungelesene Mails` : "keine Mails";
    $("#c-status").textContent = `✅ Verbunden: ${mail}, ${state.data.events.length} Termine in den nächsten Tagen.${errs}`;
  } else {
    $("#c-status").textContent = "⏳ Noch nicht da. Hast du ③ „Run workflow“ getippt? Das dauert ca. 1 Minute – dann nochmal prüfen.";
  }
};
document.querySelectorAll("[data-open-connect]").forEach(b => b.addEventListener("click", (e) => { e.preventDefault(); openConnect(); }));

// ---------- API for the assistant ----------
export const App = {
  settings, saveSettings,
  context() {
    const fmtEv = (e) => `${e.allDay ? "ganztägig" : fmtTime.format(e.start) + "–" + fmtTime.format(e.end)} ${e.title}${e.location ? " (" + e.location + ")" : ""}`;
    const w = state.weather, a = state.analysis;
    const lines = [
      `Jetzt: ${fmtDay.format(new Date())}, ${fmtTime.format(new Date())} Uhr`,
      `Ort: ${settings.city || "nicht gesetzt"}`,
      w ? `Wetter jetzt: ${Math.round(w.current.temperature_2m)} °C, ${wmo(w.current.weather_code)[1]}. Heute ${Math.round(w.daily.temperature_2m_min[0])}–${Math.round(w.daily.temperature_2m_max[0])} °C, Regen ${w.daily.precipitation_probability_max[0]} %. Tiefstwert heute Nacht ${a.nightMin.toFixed(1)} °C. Morgen ${Math.round(w.daily.temperature_2m_min[1])}–${Math.round(w.daily.temperature_2m_max[1])} °C, ${wmo(w.daily.weather_code[1])[1]}.` : "Wetter: nicht verfügbar",
      `Frostwarnung ab: ${settings.frost} °C`,
      `Warnungen: ${(a?.alerts || []).map(x => x.text).join(" | ") || "keine"}`,
      state.data ? `Termine heute: ${eventsOn(0).map(fmtEv).join("; ") || "keine"}` : "Kalender: nicht verbunden",
      state.data ? `Termine morgen: ${eventsOn(1).map(fmtEv).join("; ") || "keine"}` : "",
      state.data ? `Weitere Termine diese Woche: ${[2, 3, 4, 5, 6].map(d => eventsOn(d).map(e => fmtWd.format(e.start) + " " + fmtEv(e)).join("; ")).filter(Boolean).join("; ") || "keine"}` : "",
      state.data?.mail ? `Ungelesene E-Mails: ${state.data.mail.unread}. Neueste: ${state.data.mail.messages.slice(0, 5).map(m => `"${m.subject}" von ${m.from}`).join("; ")}` : "E-Mail: nicht verbunden",
      `Aufgaben: ${getTasks().map((t, i) => `${i + 1}. [${t.done ? "x" : " "}] ${t.text}`).join("; ") || "keine"}`,
      `Notiz heute: ${getNote() || "(leer)"}`,
      state.verse ? `Vers des Tages: ${state.verse.ref}${state.verse.text ? " – " + state.verse.text : ""}` : "",
      `Push-Nachrichten: ${settings.ntfy ? "eingerichtet" : "nicht eingerichtet"}`,
      `WhatsApp-Kontakte: ${getContacts().map(c => c.name).join(", ") || "keine gespeichert"}`,
    ];
    return lines.filter(Boolean).join("\n");
  },
  verse: () => state.verse,
  contacts: getContacts,
  findContact(name) { const n = name.toLowerCase(); const c = getContacts(); return c.find(x => x.name.toLowerCase() === n) || c.find(x => x.name.toLowerCase().includes(n) || n.includes(x.name.toLowerCase())); },
  waLink,
  addTask(text) { setTasks([...getTasks(), { text, done: false }]); return `Aufgabe hinzugefügt: ${text}`; },
  findTask(q) { const t = getTasks(); const ql = q.toLowerCase(); const i = /^\d+$/.test(q) ? +q - 1 : t.findIndex(x => x.text.toLowerCase().includes(ql)); return i >= 0 && i < t.length ? i : -1; },
  completeTask(q, done = true) { const i = App.findTask(q); if (i < 0) return `Keine Aufgabe gefunden zu „${q}“.`; const t = getTasks(); t[i].done = done; setTasks(t); return `${done ? "Erledigt" : "Wieder offen"}: ${t[i].text}`; },
  deleteTask(q) { const i = App.findTask(q); if (i < 0) return `Keine Aufgabe gefunden zu „${q}“.`; const t = getTasks(); const [x] = t.splice(i, 1); setTasks(t); return `Gelöscht: ${x.text}`; },
  clearDone() { setTasks(getTasks().filter(t => !t.done)); return "Erledigte Aufgaben entfernt."; },
  setNote(text, append) { const v = append && getNote() ? getNote() + "\n" + text : text; setNote(v); return "Notiz gespeichert."; },
  async setLocationByName(name) { const r = await searchPlaces(name); if (!r[0]) return `Ort „${name}“ nicht gefunden.`; return setLocation(r[0]); },
  setFrost(v) { settings.frost = Number(v) || 0; saveSettings(); refresh(true); return `Frostwarnung ab ${settings.frost} °C.`; },
  setTheme(v) { settings.theme = v; saveSettings(); applyTheme(); return `Darstellung: ${v}.`; },
  sendPush: (title, message, at) => sendPush(title, message, at),
  async refresh() { await refresh(true); return "Alles aktualisiert."; },
};

// ---------- Assistant (loaded on demand) ----------
let assistant = null;
$("#open-assistant").onclick = async () => {
  openSheet("assistant");
  if (!assistant) {
    try { assistant = await import("./assistant.js"); assistant.init(App, { openSettings: () => openSheet("settings") }); }
    catch (e) { $("#chat").innerHTML = `<div class="msg err">Assistent konnte nicht geladen werden: ${esc(e.message)}</div>`; }
  }
  assistant?.focus();
};

// ---------- Main ----------
let lastRefresh = 0;
async function refresh(force) {
  if (!force && Date.now() - lastRefresh < 10 * 60000) { renderHeader(); renderCalendar(); renderAlerts(); return; }
  lastRefresh = Date.now();
  $("#refresh").classList.add("spin");
  renderHeader();
  const [w] = await Promise.all([loadWeather(), loadData(), state.verse ? null : loadVerse()]);
  state.weather = w;
  state.analysis = w ? analyzeWeather(w) : null;
  renderWeather(); renderCalendar(); renderMail(); renderVerse(); renderAlerts();
  $("#refresh").classList.remove("spin");
}

applyTheme();
renderHeader(); renderTasks(); renderContacts(); $("#note").value = getNote();
refresh(true);
setInterval(() => refresh(false), 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(false); });
$("#refresh").onclick = () => refresh(true);

if (!navigator.standalone && /iPad|iPhone|Macintosh/.test(navigator.userAgent) && "ontouchend" in document) $("#install-hint").hidden = false;
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
