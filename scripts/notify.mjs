// Sends push messages via ntfy.sh. Run by GitHub Actions on a schedule.
//   node scripts/notify.mjs morning   -> daily briefing (weather, appointments, frost tonight)
//   node scripts/notify.mjs evening   -> only sends if it freezes tonight ("Auto abdecken!")
// Environment: NTFY_TOPIC, LAT, LON, CITY, FROST_LIMIT (default 0), ICS_URLS (optional, one per line)
import "../ics.js";

const mode = process.argv[2] || "morning";
const { NTFY_TOPIC, LAT, LON, CITY = "", ICS_URLS = "" } = process.env;
const FROST = Number(process.env.FROST_LIMIT ?? 0) || 0;
const DRY = process.env.DRY_RUN === "1";

if (!NTFY_TOPIC || !LAT || !LON) {
  console.error("NTFY_TOPIC, LAT and LON must be set (repository variables/secrets).");
  process.exit(1);
}

async function send(title, body, { tags = "", priority = "default" } = {}) {
  if (DRY) { console.log(`[DRY] ${title}\n${body}`); return; }
  const res = await fetch("https://ntfy.sh/" + encodeURIComponent(NTFY_TOPIC), {
    method: "POST",
    body,
    headers: { Title: encodeHeader(title), Tags: tags, Priority: priority },
  });
  if (!res.ok) throw new Error("ntfy failed: " + res.status);
  console.log("sent:", title);
}
// HTTP headers must be ASCII; ntfy understands RFC 2047 encoded words.
const encodeHeader = (s) => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`;

async function weather() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&hourly=temperature_2m,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_gusts_10m_max` +
    `&timezone=auto&forecast_days=2`;
  const w = await (await fetch(url)).json();
  const [today, tomorrow] = w.daily.time;
  let nightMin = Infinity, nightAt = "";
  w.hourly.time.forEach((ts, i) => {
    const [d, hm] = ts.split("T"), h = +hm.slice(0, 2);
    if ((d === today && h >= 18) || (d === tomorrow && h <= 9)) {
      if (w.hourly.temperature_2m[i] < nightMin) { nightMin = w.hourly.temperature_2m[i]; nightAt = hm; }
    }
  });
  const iceToday = w.hourly.weather_code.some((c, i) => w.hourly.time[i].startsWith(today) && [56, 57, 66, 67].includes(c));
  return { w, nightMin, nightAt, iceToday };
}

async function todaysEvents() {
  const urls = ICS_URLS.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  if (!urls.length) return null;
  const parsed = [];
  for (const u of urls) {
    try {
      const res = await fetch(u.replace(/^webcal:/i, "https:"));
      if (res.ok) parsed.push(globalThis.ICS.parse(await res.text()));
    } catch (e) { console.error("calendar failed:", e.message); }
  }
  const from = new Date(); from.setHours(0, 0, 0, 0);
  const to = new Date(from); to.setDate(to.getDate() + 1);
  return globalThis.ICS.eventsBetween(parsed, from, to);
}

const fmt = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" });

const { w, nightMin, nightAt, iceToday } = await weather();
const frost = nightMin <= FROST;
const frostLine = `🚗❄️ Heute Nacht bis ${nightMin.toFixed(1)} °C (gegen ${nightAt} Uhr) – Auto abdecken!`;

if (mode === "evening") {
  if (frost) await send("Frost heute Nacht", frostLine, { tags: "snowflake,car", priority: "high" });
  else console.log(`No frost tonight (min ${nightMin.toFixed(1)} °C) – nothing sent.`);
} else {
  const d = w.daily, lines = [];
  lines.push(`🌡️ ${CITY ? CITY + ": " : ""}${Math.round(d.temperature_2m_min[0])}–${Math.round(d.temperature_2m_max[0])} °C, Regen ${d.precipitation_probability_max[0] ?? 0} %`);
  if (iceToday) lines.push("🧊 Glatteisgefahr heute!");
  if (d.precipitation_probability_max[0] >= 60) lines.push("☂️ Schirm mitnehmen.");
  if (d.wind_gusts_10m_max[0] >= 65) lines.push(`💨 Sturmböen bis ${Math.round(d.wind_gusts_10m_max[0])} km/h.`);
  if (frost) lines.push(frostLine);
  const events = await todaysEvents();
  if (events) {
    lines.push("");
    if (!events.length) lines.push("📅 Heute keine Termine.");
    else {
      lines.push(`📅 ${events.length} Termin${events.length === 1 ? "" : "e"}:`);
      for (const e of events.slice(0, 8)) lines.push(`• ${e.allDay ? "ganztägig" : fmt.format(e.start)} ${e.title || ""}`);
    }
  }
  await send(`Dein Tag – ${dayFmt.format(new Date())}`, lines.join("\n"), { tags: "sunrise" });
}
