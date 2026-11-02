// Minimal iCalendar (ICS) parser with support for the common recurrence rules.
// Returns event occurrences that overlap a given time range.
(function (global) {
  function unfold(text) {
    return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  }

  function parseDate(value, params) {
    // All-day: 20261102
    if (/^\d{8}$/.test(value) || params.VALUE === "DATE") {
      const y = +value.slice(0, 4), m = +value.slice(4, 6) - 1, d = +value.slice(6, 8);
      return { date: new Date(y, m, d), allDay: true };
    }
    const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
    if (!m) return null;
    const [, y, mo, d, h, mi, s, z] = m;
    if (z) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)), allDay: false };
    if (params.TZID) return { date: zonedToDate(+y, +mo - 1, +d, +h, +mi, +s, params.TZID), allDay: false };
    return { date: new Date(+y, +mo - 1, +d, +h, +mi, +s), allDay: false };
  }

  // Convert a wall-clock time in an IANA time zone to a real Date.
  function zonedToDate(y, mo, d, h, mi, s, tz) {
    const guess = Date.UTC(y, mo, d, h, mi, s);
    try {
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
      const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map(p => [p.type, p.value]));
      const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
      return new Date(guess - (asUtc - guess));
    } catch {
      return new Date(y, mo, d, h, mi, s); // unknown zone: treat as local time
    }
  }

  function parseLine(line) {
    const idx = line.indexOf(":");
    if (idx < 0) return null;
    const left = line.slice(0, idx), value = line.slice(idx + 1);
    const [name, ...rawParams] = left.split(";");
    const params = {};
    for (const p of rawParams) {
      const [k, v] = p.split("=");
      if (k) params[k.toUpperCase()] = (v || "").replace(/^"|"$/g, "");
    }
    return { name: name.toUpperCase(), params, value };
  }

  function unescapeText(s) {
    return s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
  }

  function parse(text) {
    const lines = unfold(text).split("\n");
    const events = [];
    let cur = null, calName = "";
    for (const raw of lines) {
      const line = parseLine(raw);
      if (!line) continue;
      if (line.name === "BEGIN" && line.value === "VEVENT") { cur = { exdates: [] }; continue; }
      if (line.name === "END" && line.value === "VEVENT") { if (cur && cur.start) events.push(cur); cur = null; continue; }
      if (!cur) { if (line.name === "X-WR-CALNAME") calName = unescapeText(line.value); continue; }
      switch (line.name) {
        case "SUMMARY": cur.title = unescapeText(line.value); break;
        case "LOCATION": cur.location = unescapeText(line.value); break;
        case "UID": cur.uid = line.value; break;
        case "STATUS": cur.status = line.value; break;
        case "RECURRENCE-ID": { const r = parseDate(line.value, line.params); if (r) cur.recurrenceId = r.date; break; }
        case "DTSTART": { const r = parseDate(line.value, line.params); if (r) { cur.start = r.date; cur.allDay = r.allDay; } break; }
        case "DTEND": { const r = parseDate(line.value, line.params); if (r) cur.end = r.date; break; }
        case "DURATION": cur.duration = parseDuration(line.value); break;
        case "RRULE": cur.rrule = Object.fromEntries(line.value.split(";").map(p => p.split("="))); break;
        case "EXDATE":
          for (const v of line.value.split(",")) { const r = parseDate(v, line.params); if (r) cur.exdates.push(r.date.getTime()); }
          break;
      }
    }
    for (const e of events) {
      if (!e.end) e.end = new Date(e.start.getTime() + (e.duration || (e.allDay ? 86400000 : 0)));
    }
    return { calName, events };
  }

  function parseDuration(v) {
    const m = v.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
    if (!m) return 0;
    const [, sign, w, d, h, mi, s] = m;
    const ms = ((+w || 0) * 7 * 86400 + (+d || 0) * 86400 + (+h || 0) * 3600 + (+mi || 0) * 60 + (+s || 0)) * 1000;
    return sign === "-" ? -ms : ms;
  }

  const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

  // Expand an event into occurrences overlapping [from, to).
  function occurrences(ev, from, to) {
    const len = ev.end - ev.start;
    if (!ev.rrule) return ev.end > from && ev.start < to ? [{ ...ev }] : [];

    const r = ev.rrule;
    const freq = r.FREQ, interval = +(r.INTERVAL || 1);
    const until = r.UNTIL ? parseDate(r.UNTIL, {}).date : null;
    const count = r.COUNT ? +r.COUNT : Infinity;
    const byDay = r.BYDAY ? r.BYDAY.split(",").map(s => s.replace(/^[+-]?\d+/, "")) : null;
    const out = [];
    let n = 0;
    const start = ev.start;
    const push = (d) => {
      if (until && d > until) return false;
      if (n >= count) return false;
      n++;
      const end = new Date(d.getTime() + len);
      if (end > from && d < to && !ev.exdates.includes(d.getTime())) out.push({ ...ev, start: d, end });
      return d < to;
    };
    const atTime = (base, days) => {
      const d = new Date(base); d.setDate(d.getDate() + days); return d;
    };

    for (let i = 0; i < 5000; i++) {
      if (freq === "DAILY") {
        if (!push(atTime(start, i * interval))) break;
      } else if (freq === "WEEKLY") {
        const weekStart = atTime(start, i * 7 * interval - start.getDay());
        const days = byDay ? byDay.map(c => DAY_CODES.indexOf(c)).filter(x => x >= 0).sort() : [start.getDay()];
        let cont = true;
        for (const dow of days) {
          const d = atTime(weekStart, dow);
          if (d < start) continue;
          if (!push(d)) { cont = false; break; }
        }
        if (!cont) break;
      } else if (freq === "MONTHLY") {
        const d = new Date(start); d.setMonth(start.getMonth() + i * interval);
        if (d.getDate() !== start.getDate()) continue; // e.g. 31st in short months
        if (!push(d)) break;
      } else if (freq === "YEARLY") {
        const d = new Date(start); d.setFullYear(start.getFullYear() + i * interval);
        if (!push(d)) break;
      } else break;
    }
    return out;
  }

  function eventsBetween(parsedList, from, to) {
    const all = [];
    for (const { events, color, calName } of parsedList) {
      // Overrides of single recurring instances (RECURRENCE-ID)
      const overrides = new Map();
      for (const e of events) if (e.recurrenceId) overrides.set(e.uid + "|" + e.recurrenceId.getTime(), e);
      for (const e of events) {
        if (e.recurrenceId || e.status === "CANCELLED") continue;
        for (const o of occurrences(e, from, to)) {
          if (overrides.has(e.uid + "|" + o.start.getTime())) continue;
          all.push({ ...o, color, calName });
        }
      }
      for (const e of overrides.values()) {
        if (e.status !== "CANCELLED" && e.end > from && e.start < to) all.push({ ...e, color, calName });
      }
    }
    return all.sort((a, b) => (b.allDay - a.allDay) || (a.start - b.start));
  }

  global.ICS = { parse, eventsBetween };
})(typeof window !== "undefined" ? window : globalThis);
