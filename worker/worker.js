// Cloudflare Worker for "Mein Tag".
//  GET /ics?url=...  -> fetches a calendar (iCloud/Google/Outlook) and adds CORS headers
//  GET /mail         -> unread count + latest unread mails via IMAP
// Secrets (set with `wrangler secret put NAME`):
//  APP_TOKEN     – any long random string, also entered in the app settings
//  IMAP_HOST     – e.g. imap.mail.me.com (iCloud) or imap.gmail.com
//  IMAP_USER     – your mail address
//  IMAP_PASS     – an app-specific password (NOT your normal password)
import { connect } from "cloudflare:sockets";

const ALLOWED_ICS_HOSTS = [/\.icloud\.com$/, /^calendar\.google\.com$/, /\.google\.com$/,
  /^outlook\.(live|office365)\.com$/, /\.office\.com$/];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "X-Token",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(req.url);
    if (!env.APP_TOKEN || req.headers.get("X-Token") !== env.APP_TOKEN) return json({ error: "unauthorized" }, 401);

    if (url.pathname === "/ics") {
      let target;
      try { target = new URL(url.searchParams.get("url").replace(/^webcal:/i, "https:")); }
      catch { return json({ error: "bad url" }, 400); }
      if (target.protocol !== "https:" || !ALLOWED_ICS_HOSTS.some(r => r.test(target.hostname)))
        return json({ error: "host not allowed" }, 400);
      const res = await fetch(target, { cf: { cacheTtl: 300 } });
      return new Response(res.body, {
        status: res.status,
        headers: { ...cors, "Content-Type": "text/calendar; charset=utf-8" },
      });
    }

    if (url.pathname === "/mail") {
      if (!env.IMAP_HOST) return json({ error: "mail not configured" }, 501);
      try { return json(await fetchMail(env)); }
      catch (e) { return json({ error: String(e.message || e) }, 502); }
    }
    return json({ error: "not found" }, 404);
  },
};

// ---- tiny IMAP client ----
async function fetchMail(env) {
  const socket = connect({ hostname: env.IMAP_HOST, port: 993 }, { secureTransport: "on" });
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  const enc = new TextEncoder(), dec = new TextDecoder();
  let buf = "", n = 0;

  async function readUntil(re) {
    while (!re.test(buf)) {
      const { value, done } = await reader.read();
      if (done) throw new Error("connection closed");
      buf += dec.decode(value, { stream: true });
    }
    const out = buf; buf = ""; return out;
  }
  async function cmd(c) {
    const tag = "a" + (++n);
    await writer.write(enc.encode(`${tag} ${c}\r\n`));
    const out = await readUntil(new RegExp(`(^|\\r\\n)${tag} (OK|NO|BAD)[^\\r\\n]*\\r\\n`));
    const status = out.match(new RegExp(`(?:^|\\r\\n)${tag} (OK|NO|BAD)`))[1];
    if (status !== "OK") throw new Error(`IMAP ${c.split(" ")[0]} failed`);
    return out;
  }
  const q = (s) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

  try {
    await readUntil(/\r\n/); // greeting
    await cmd(`LOGIN ${q(env.IMAP_USER)} ${q(env.IMAP_PASS)}`);
    await cmd("EXAMINE INBOX"); // read-only, never marks mails as read
    const search = await cmd("SEARCH UNSEEN");
    const ids = (search.match(/\* SEARCH([^\r\n]*)/)?.[1] || "").trim().split(/\s+/).filter(Boolean);
    const latest = ids.slice(-8).reverse();
    let messages = [];
    if (latest.length) {
      const out = await cmd(`FETCH ${latest.join(",")} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])`);
      messages = out.split(/\r\n\* \d+ FETCH|^\* \d+ FETCH/).slice(1).map(parseHeaders);
      messages.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    await cmd("LOGOUT").catch(() => {});
    return { unread: ids.length, messages };
  } finally {
    try { socket.close(); } catch {}
  }
}

function parseHeaders(block) {
  const text = block.replace(/\r\n[ \t]+/g, " ");
  const get = (h) => decodeWords(text.match(new RegExp(`^${h}:\\s*(.*)$`, "im"))?.[1]?.trim() || "");
  let from = get("From");
  const m = from.match(/^"?([^"<]+?)"?\s*<[^>]+>$/);
  if (m) from = m[1];
  return { from, subject: get("Subject"), date: get("Date") };
}

function decodeWords(s) {
  return s.replace(/(\?=)\s+(=\?)/g, "$1$2").replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset, encType, data) => {
    let bytes;
    if (encType.toUpperCase() === "B") bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    else {
      const str = data.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      bytes = Uint8Array.from(str, c => c.charCodeAt(0));
    }
    try { return new TextDecoder(charset).decode(bytes); } catch { return new TextDecoder().decode(bytes); }
  });
}
