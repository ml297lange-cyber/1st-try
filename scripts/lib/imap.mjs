// Tiny read-only IMAP client: unread count + latest unread headers.
import tls from "node:tls";

export async function fetchUnread({ host, user, pass, limit = 8 }) {
  const socket = tls.connect({ host, port: 993, servername: host });
  socket.setEncoding("utf8");
  socket.setTimeout(30000, () => socket.destroy(new Error("IMAP timeout")));
  let buf = "", n = 0, waiter = null, failure = null;
  socket.on("data", (d) => { buf += d; waiter?.(); });
  socket.on("error", (e) => { failure = e; waiter?.(); });

  const readUntil = (re) => new Promise((resolve, reject) => {
    const check = () => {
      if (failure) return reject(failure);
      if (re.test(buf)) { const out = buf; buf = ""; waiter = null; resolve(out); }
    };
    waiter = check; check();
  });
  const cmd = async (c) => {
    const tag = "a" + (++n);
    socket.write(`${tag} ${c}\r\n`);
    const out = await readUntil(new RegExp(`(^|\\r\\n)${tag} (OK|NO|BAD)[^\\r\\n]*\\r\\n`));
    if (!new RegExp(`(^|\\r\\n)${tag} OK`).test(out)) throw new Error(`IMAP ${c.split(" ")[0]} fehlgeschlagen`);
    return out;
  };
  const q = (s) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

  try {
    await readUntil(/\r\n/);
    await cmd(`LOGIN ${q(user)} ${q(pass)}`);
    await cmd("EXAMINE INBOX"); // read-only: nothing gets marked as read
    const search = await cmd("SEARCH UNSEEN");
    const ids = (search.match(/\* SEARCH([^\r\n]*)/)?.[1] || "").trim().split(/\s+/).filter(Boolean);
    let messages = [];
    const latest = ids.slice(-limit);
    if (latest.length) {
      const out = await cmd(`FETCH ${latest.join(",")} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])`);
      messages = out.split(/\r\n(?=\* \d+ FETCH)|^(?=\* \d+ FETCH)/).filter(b => /^\* \d+ FETCH/.test(b)).map(parseHeaders);
      messages.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    await cmd("LOGOUT").catch(() => {});
    return { unread: ids.length, messages };
  } finally {
    socket.destroy();
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

export function decodeWords(s) {
  return s.replace(/(\?=)\s+(=\?)/g, "$1$2").replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset, enc, data) => {
    const bytes = enc.toUpperCase() === "B"
      ? Buffer.from(data, "base64")
      : Buffer.from(data.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))), "latin1");
    try { return new TextDecoder(charset).decode(bytes); } catch { return bytes.toString("utf8"); }
  });
}
