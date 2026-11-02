// Small personal assistant (Claude) that can read the day overview and control the app via tools.
import Anthropic from "./vendor/anthropic-sdk-0.135.0.mjs";

const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let App, hooks;
let history = store.get("chatApi", []); // exact API messages (append-only)
let log = store.get("chatUi", []);      // what is shown in the chat
let busy = false;

const SYSTEM = `Du bist der persönliche Assistent in der iPad-App „Mein Tag“. Du sprichst Deutsch, duzt den Nutzer und antwortest kurz und freundlich (meist 1–3 Sätze, auf dem iPad gut lesbar, kein Markdown außer einfachen Aufzählungen).

Du kennst den aktuellen Stand des Tages (Termine, Wetter, Frost, E-Mails, Aufgaben, Notiz, Bibelvers) aus dem Block <aktueller_stand>. Beantworte Fragen dazu direkt daraus.

Du kannst die App mit Werkzeugen steuern: Aufgaben anlegen/abhaken/löschen, die Tagesnotiz schreiben, den Ort fürs Wetter ändern, die Frostgrenze ändern, die Darstellung (hell/dunkel) ändern, Daten aktualisieren, Push-Nachrichten senden (auch zeitversetzt als Erinnerung) und Knöpfe anzeigen, die andere Apps öffnen (Mail, Nachrichten, WhatsApp, Kalender, Bibel-App). Für neue Kalendertermine erstellst du mit create_calendar_event einen Knopf, über den der Nutzer den Termin in seinen Kalender übernimmt.

Wenn der Nutzer etwas erledigt haben möchte, benutze die passenden Werkzeuge, statt nur zu beschreiben, was er tun könnte. Bestätige danach kurz, was du getan hast.
Grenzen: iMessage- und WhatsApp-Nachrichten kannst du weder lesen noch senden (Apple erlaubt das nicht); biete stattdessen einen Knopf zum Öffnen der App an. E-Mails kannst du nur als Überblick (Absender/Betreff) sehen, nicht beantworten.`;

const str = (description) => ({ type: "string", description });
const TOOLS = [
  { name: "add_task", description: "Fügt eine Aufgabe zur Aufgabenliste hinzu.", input_schema: { type: "object", properties: { text: str("Text der Aufgabe") }, required: ["text"] } },
  { name: "complete_task", description: "Hakt eine Aufgabe ab (oder öffnet sie wieder).", input_schema: { type: "object", properties: { task: str("Nummer oder Teil des Aufgabentexts"), done: { type: "boolean", description: "true = erledigt (Standard), false = wieder offen" } }, required: ["task"] } },
  { name: "delete_task", description: "Löscht eine Aufgabe.", input_schema: { type: "object", properties: { task: str("Nummer oder Teil des Aufgabentexts") }, required: ["task"] } },
  { name: "clear_done_tasks", description: "Entfernt alle erledigten Aufgaben.", input_schema: { type: "object", properties: {} } },
  { name: "set_note", description: "Schreibt die Tagesnotiz (ersetzen oder anhängen).", input_schema: { type: "object", properties: { text: str("Text"), append: { type: "boolean", description: "true = an bestehende Notiz anhängen" } }, required: ["text"] } },
  { name: "set_location", description: "Ändert den Ort für das Wetter.", input_schema: { type: "object", properties: { city: str("Stadtname, z. B. 'Köln'") }, required: ["city"] } },
  { name: "set_frost_limit", description: "Ändert die Temperatur (°C), ab der die Frostwarnung ('Auto abdecken') kommt.", input_schema: { type: "object", properties: { celsius: { type: "number" } }, required: ["celsius"] } },
  { name: "set_theme", description: "Ändert die Darstellung der App.", input_schema: { type: "object", properties: { mode: { type: "string", enum: ["auto", "light", "dark"] } }, required: ["mode"] } },
  { name: "refresh_data", description: "Lädt Wetter, Kalender und E-Mails neu.", input_schema: { type: "object", properties: {} } },
  { name: "send_push", description: "Sendet eine Push-Nachricht aufs Handy/iPad (ntfy). Mit 'at' wird sie zu einem späteren Zeitpunkt zugestellt (Erinnerung, max. 3 Tage im Voraus).", input_schema: { type: "object", properties: { title: str("Kurzer Titel"), message: str("Nachrichtentext"), at: str("Optional: Zustellzeit als lokale Zeit 'YYYY-MM-DDTHH:MM'") }, required: ["title", "message"] } },
  { name: "show_app_button", description: "Zeigt im Chat einen Knopf, der eine App oder Seite öffnet.", input_schema: { type: "object", properties: { target: { type: "string", enum: ["mail", "messages", "whatsapp", "calendar", "bible_verse", "youversion_votd", "settings"] }, label: str("Optionaler Knopftext") }, required: ["target"] } },
  { name: "create_calendar_event", description: "Erstellt einen Kalendertermin als Knopf; der Nutzer tippt darauf und übernimmt ihn in seinen iPad-Kalender.", input_schema: { type: "object", properties: { title: str("Titel"), start: str("Beginn, lokale Zeit 'YYYY-MM-DDTHH:MM' (ganztägig: 'YYYY-MM-DD')"), end: str("Ende, gleiches Format (optional)"), location: str("Ort (optional)") }, required: ["title", "start"] } },
];

const LINKS = {
  mail: ["message://", "✉️ Mail öffnen"],
  messages: ["sms:", "💬 Nachrichten öffnen"],
  whatsapp: ["whatsapp://", "🟢 WhatsApp öffnen"],
  calendar: ["calshow://", "📅 Kalender öffnen"],
  youversion_votd: ["https://www.bible.com/de/verse-of-the-day", "✨ YouVersion: Vers des Tages"],
};

function icsFor({ title, start, end, location }) {
  const allDay = /^\d{4}-\d{2}-\d{2}$/.test(start);
  const toIcs = (s) => s.replace(/[-:]/g, "").slice(0, allDay ? 8 : 13) + (allDay ? "" : "00");
  let endVal = end;
  if (!endVal) {
    const d = new Date(allDay ? start + "T00:00" : start);
    if (allDay) d.setDate(d.getDate() + 1); else d.setHours(d.getHours() + 1);
    const p = (n) => String(n).padStart(2, "0");
    endVal = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` + (allDay ? "" : `T${p(d.getHours())}:${p(d.getMinutes())}`);
  }
  const t = (s) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mein Tag//DE", "BEGIN:VEVENT",
    `UID:${Date.now()}@mein-tag`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    allDay ? `DTSTART;VALUE=DATE:${toIcs(start)}` : `DTSTART:${toIcs(start)}`,
    allDay ? `DTEND;VALUE=DATE:${toIcs(endVal)}` : `DTEND:${toIcs(endVal)}`,
    `SUMMARY:${t(title)}`, location ? `LOCATION:${t(location)}` : null, "END:VEVENT", "END:VCALENDAR"]
    .filter(Boolean).join("\r\n");
}

async function runTool(name, input) {
  switch (name) {
    case "add_task": return App.addTask(input.text);
    case "complete_task": return App.completeTask(String(input.task), input.done !== false);
    case "delete_task": return App.deleteTask(String(input.task));
    case "clear_done_tasks": return App.clearDone();
    case "set_note": return App.setNote(input.text, !!input.append);
    case "set_location": return App.setLocationByName(input.city);
    case "set_frost_limit": return App.setFrost(input.celsius);
    case "set_theme": return App.setTheme(input.mode);
    case "refresh_data": return App.refresh();
    case "send_push": return App.sendPush(input.title, input.message, input.at);
    case "show_app_button": {
      if (input.target === "settings") { addLog({ type: "chips", chips: [{ action: "settings", label: input.label || "⚙︎ Einstellungen öffnen" }] }); return "Knopf angezeigt."; }
      if (input.target === "bible_verse") { const v = App.verse(); addLog({ type: "chips", chips: [{ href: v.appUrl, label: input.label || `📖 ${v.ref} in der Bibel-App` }] }); return "Knopf angezeigt."; }
      const [href, label] = LINKS[input.target];
      addLog({ type: "chips", chips: [{ href, label: input.label || label }] });
      return "Knopf angezeigt.";
    }
    case "create_calendar_event": {
      addLog({ type: "chips", chips: [{ ics: icsFor(input), label: `📅 „${input.title}“ zum Kalender hinzufügen` }] });
      return "Knopf zum Hinzufügen angezeigt. Der Nutzer muss noch darauf tippen.";
    }
    default: throw new Error("Unbekanntes Werkzeug");
  }
}

// ---------- UI ----------
function addLog(entry) { log.push(entry); store.set("chatUi", log.slice(-200)); render(); }
function render() {
  const chat = $("#chat");
  if (!App.settings.aiKey) {
    chat.innerHTML = `<div class="msg bot">Hallo! 👋 Ich bin dein Assistent. Ich kann dir sagen, was heute ansteht, Aufgaben anlegen, Erinnerungen per Push schicken und vieles mehr.

Dafür brauche ich einen API-Schlüssel von Anthropic (console.anthropic.com → API Keys). Der Schlüssel bleibt nur auf diesem iPad gespeichert.</div>
      <div class="row"><input id="ai-key-inline" type="password" placeholder="sk-ant-…"><button id="ai-key-save">OK</button></div>`;
    $("#ai-key-save").onclick = () => {
      const k = $("#ai-key-inline").value.trim();
      if (!k) return;
      App.settings.aiKey = k; App.saveSettings(); render();
    };
    return;
  }
  const items = log.map(e => {
    if (e.type === "user") return `<div class="msg user">${esc(e.text)}</div>`;
    if (e.type === "bot") return `<div class="msg bot">${esc(e.text)}</div>`;
    if (e.type === "tool") return `<div class="msg tool">⚙︎ ${esc(e.text)}</div>`;
    if (e.type === "err") return `<div class="msg err">${esc(e.text)}</div>`;
    if (e.type === "chips") return `<div class="chips">${e.chips.map((c, i) =>
      c.href ? `<a href="${esc(c.href)}" target="_blank" rel="noopener">${esc(c.label)}</a>`
        : `<button type="button" data-chip='${esc(JSON.stringify(c))}'>${esc(c.label)}</button>`).join("")}</div>`;
    return "";
  });
  if (!log.length) {
    items.push(`<div class="msg bot">Hallo! Wie kann ich helfen? 😊</div>`, `<div class="chips">${[
      "Was steht heute an?", "Muss ich heute Nacht mein Auto abdecken?", "Erinnere mich in 1 Stunde ans Trinken",
      "Setz ‚Brot kaufen‘ auf meine Liste", "Erklär mir den Vers des Tages",
    ].map(s => `<button type="button" data-suggest="${esc(s)}">${esc(s)}</button>`).join("")}</div>`);
  }
  if (busy) items.push(`<div class="msg bot typing"><span></span><span></span><span></span></div>`);
  chat.innerHTML = items.join("");
  const body = chat.parentElement; body.scrollTop = body.scrollHeight;
}

function onChatClick(e) {
  const s = e.target.closest("[data-suggest]");
  if (s) return send(s.dataset.suggest);
  const c = e.target.closest("[data-chip]");
  if (!c) return;
  const chip = JSON.parse(c.dataset.chip);
  if (chip.action === "settings") hooks.openSettings();
  if (chip.ics) {
    const url = URL.createObjectURL(new Blob([chip.ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url; a.download = "termin.ics"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

// ---------- Agent loop ----------
function errorText(e) {
  if (e instanceof Anthropic.AuthenticationError) return "Der API-Schlüssel ist ungültig. Bitte unter ⚙︎ prüfen.";
  if (e instanceof Anthropic.PermissionDeniedError) return "Der API-Schlüssel hat keinen Zugriff auf dieses Modell.";
  if (e instanceof Anthropic.RateLimitError) return "Gerade zu viele Anfragen – bitte kurz warten.";
  if (e instanceof Anthropic.APIConnectionError) return "Keine Verbindung zum Assistenten. Bist du online?";
  if (e instanceof Anthropic.APIError) return `Fehler vom Assistenten (${e.status ?? "?"}): ${e.message}`;
  return "Fehler: " + (e.message || e);
}

async function send(text) {
  text = text.trim();
  if (!text || busy) return;
  addLog({ type: "user", text });
  // If the last turn ended with tool results (e.g. after an error), add the text to that turn.
  const last = history[history.length - 1];
  if (last && last.role === "user") last.content = [...last.content, { type: "text", text }];
  else history.push({ role: "user", content: [{ type: "text", text }] });
  busy = true; render();

  const client = new Anthropic({ apiKey: App.settings.aiKey, dangerouslyAllowBrowser: true });
  const model = App.settings.aiModel || "claude-opus-5-5";
  try {
    for (let step = 0; step < 10; step++) {
      const params = {
        model, max_tokens: 16000, tools: TOOLS, messages: history,
        system: `${SYSTEM}\n\n<aktueller_stand>\n${App.context()}\n</aktueller_stand>`,
        output_config: { effort: "low" },
      };
      if (model !== "claude-haiku-5-5") {
        // If a request is declined by a safety classifier, let the API retry it on a suitable model.
        params.betas = ["server-side-fallback-2026-07-01"];
        params.fallbacks = "default";
      }
      const res = await client.beta.messages.create(params);
      if (res.stop_reason === "refusal") {
        if (history[history.length - 1]?.role === "user" && step === 0) history.pop();
        addLog({ type: "err", text: "Dazu kann ich leider nichts sagen." });
        break;
      }
      history.push({ role: "assistant", content: res.content });
      for (const b of res.content) if (b.type === "text" && b.text.trim()) addLog({ type: "bot", text: b.text.trim() });
      if (res.stop_reason === "pause_turn") continue;
      if (res.stop_reason !== "tool_use") break;

      const results = [];
      for (const b of res.content.filter(b => b.type === "tool_use")) {
        try {
          const out = await runTool(b.name, b.input || {});
          addLog({ type: "tool", text: out });
          results.push({ type: "tool_result", tool_use_id: b.id, content: String(out) });
        } catch (e) {
          results.push({ type: "tool_result", tool_use_id: b.id, content: "Fehler: " + e.message, is_error: true });
        }
      }
      history.push({ role: "user", content: results });
    }
  } catch (e) {
    // Drop an unanswered user turn so the next message starts cleanly.
    const lastMsg = history[history.length - 1];
    if (lastMsg?.role === "user" && lastMsg.content.every(c => c.type === "text")) history.pop();
    addLog({ type: "err", text: errorText(e) });
  } finally {
    busy = false;
    store.set("chatApi", history);
    render();
  }
}

// ---------- Voice input (if the browser supports it) ----------
function setupMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  const mic = $("#mic");
  mic.hidden = false;
  let rec = null;
  mic.onclick = () => {
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = "de-DE"; rec.interimResults = true;
    rec.onresult = (e) => { $("#chat-input").value = [...e.results].map(r => r[0].transcript).join(""); };
    rec.onend = () => { mic.classList.remove("on"); rec = null; const v = $("#chat-input").value; if (v.trim()) { $("#chat-input").value = ""; send(v); } };
    rec.onerror = () => { mic.classList.remove("on"); };
    mic.classList.add("on");
    rec.start();
  };
}

export function init(app, h) {
  App = app; hooks = h;
  $("#chat").addEventListener("click", onChatClick);
  $("#composer").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("#chat-input").value; $("#chat-input").value = "";
    send(v);
  });
  $("#chat-new").onclick = () => { history = []; log = []; store.set("chatApi", []); store.set("chatUi", []); render(); };
  setupMic();
  render();
}
export function focus() { render(); }
