// Runs in GitHub Actions every 30 minutes.
// Fetches calendar (Apple ID via CalDAV and/or ICS links) and mail (IMAP), encrypts the result
// with DATA_KEY and writes it into the website folder. Also writes the verse of the day.
//   node scripts/sync.mjs <output-folder>
import fs from "node:fs";
import path from "node:path";
import { collectEvents } from "./lib/events.mjs";
import { fetchUnread } from "./lib/imap.mjs";
import { encryptJson } from "./lib/crypto.mjs";
import { verseForDate, fetchVerseText } from "../verses.mjs";
import { loadConfig } from "./lib/config.mjs";

const out = process.argv[2] || "_site";
fs.mkdirSync(out, { recursive: true });
const env = loadConfig();

// --- verse of the day (public, not encrypted) ---
try {
  const v = verseForDate();
  v.text = await fetchVerseText(v, console.log);
  fs.writeFileSync(path.join(out, "verse.json"), JSON.stringify({ date: new Date().toDateString(), ...v }));
  console.log("Verse:", v.ref);
} catch (e) {
  console.log("Verse skipped:", e.message);
}

// --- private data (encrypted) ---
if (!env.DATA_KEY) {
  console.log("DATA_KEY not set – skipping calendar/mail.");
  process.exit(0);
}
const data = { generatedAt: new Date().toISOString(), events: [], calendars: [], mail: null, errors: [] };

try {
  const { events, calendars, errors } = await collectEvents(env, 8);
  data.events = events;
  data.calendars = calendars;
  data.errors.push(...errors);
  console.log(`Calendar: ${calendars.length} calendars, ${events.length} events`);
} catch (e) {
  data.errors.push("Kalender: " + e.message);
  console.log("Calendar failed:", e.message);
}

const appleMail = /@(icloud|me|mac)\.com$/i.test(env.APPLE_ID || "");
const imap = env.IMAP_HOST
  ? { host: env.IMAP_HOST, user: env.IMAP_USER, pass: env.IMAP_PASS }
  : appleMail && env.APPLE_APP_PASSWORD
    ? { host: "imap.mail.me.com", user: env.APPLE_ID, pass: env.APPLE_APP_PASSWORD }
    : null;
if (imap) {
  try {
    data.mail = await fetchUnread(imap);
    console.log(`Mail: ${data.mail.unread} unread`);
  } catch (e) {
    data.errors.push("E-Mail: " + e.message);
    console.log("Mail failed:", e.message);
  }
}

fs.writeFileSync(path.join(out, "data.enc.json"), JSON.stringify(await encryptJson(data, env.DATA_KEY)));
console.log("Encrypted data written.");
