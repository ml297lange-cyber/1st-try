// Collects upcoming events from iCloud (CalDAV) and optional ICS links,
// expands recurring events and returns plain JSON-friendly occurrences.
import "./ics.js";
import { CalDAV } from "./caldav.mjs";

const COLORS = ["#3b82f6", "#22c55e", "#ec4899", "#f97316", "#8b5cf6", "#06b6d4"];
const ICS = globalThis.ICS;
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export async function collectEvents(env, days = 8) {
  const from = new Date(); from.setHours(0, 0, 0, 0);
  const to = new Date(from); to.setDate(to.getDate() + days);
  const sources = []; // { name, color, texts: [] }
  const errors = [];

  if (env.APPLE_ID && env.APPLE_APP_PASSWORD) {
    const dav = new CalDAV({ user: env.APPLE_ID, pass: env.APPLE_APP_PASSWORD });
    const cals = await dav.calendars();
    await Promise.all(cals.map(async (c, i) => {
      try {
        sources.push({ name: c.name, color: c.color || COLORS[i % COLORS.length], texts: await dav.events(c.url, from, to) });
      } catch (e) { errors.push(`Kalender „${c.name}“: ${e.message}`); }
    }));
  }

  const links = (env.ICS_URLS || "").split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  for (const [i, url] of links.entries()) {
    try {
      const res = await fetch(url.replace(/^webcal:/i, "https:"));
      if (!res.ok) throw new Error("HTTP " + res.status);
      const name = /google\.com/.test(url) ? "Google Kalender" : `Kalender ${i + 1}`;
      sources.push({ name, color: COLORS[(i + 3) % COLORS.length], texts: [await res.text()] });
    } catch (e) { errors.push(`Kalender-Link ${i + 1}: ${e.message}`); }
  }

  const parsed = [];
  for (const s of sources) {
    for (const t of s.texts) {
      const p = ICS.parse(t);
      parsed.push({ ...p, color: s.color, calName: s.name });
    }
  }
  const events = ICS.eventsBetween(parsed, from, to).map(e => ({
    title: e.title || "(ohne Titel)",
    location: e.location || "",
    calendar: e.calName,
    color: e.color,
    allDay: !!e.allDay,
    // all-day events as local dates (no time zone shift), timed events as ISO timestamps
    start: e.allDay ? ymd(e.start) : e.start.toISOString(),
    end: e.allDay ? ymd(e.end) : e.end.toISOString(),
  }));
  return { events, calendars: sources.map(s => ({ name: s.name, color: s.color })), errors };
}
