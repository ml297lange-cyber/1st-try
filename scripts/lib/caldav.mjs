// Minimal CalDAV client for iCloud (works with other CalDAV servers too).
// Returns raw ICS text per calendar; expansion happens with ics.js.

const decodeXml = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#13;/g, "\r").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&amp;/g, "&");

// Matches <x:tag ...>content</x:tag> regardless of namespace prefix.
const tagRe = (tag, flags = "") => new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, flags);
const first = (xml, tag) => { const m = xml.match(tagRe(tag)); return m ? m[1] : null; };
const all = (xml, tag) => [...xml.matchAll(tagRe(tag, "g"))].map(m => m[1]);

export class CalDAV {
  constructor({ user, pass, base = process.env.CALDAV_URL || "https://caldav.icloud.com/" }) {
    this.auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
    this.base = base;
  }

  async request(method, url, body, depth = "0") {
    const res = await fetch(url, {
      method,
      headers: { Authorization: this.auth, Depth: depth, "Content-Type": "application/xml; charset=utf-8" },
      body,
      redirect: "follow",
    });
    if (res.status === 401) throw new Error("Apple-ID oder app-spezifisches Passwort falsch (401)");
    if (!res.ok && res.status !== 207) throw new Error(`CalDAV ${method} ${res.status}`);
    return { xml: await res.text(), url: res.url };
  }

  async calendars() {
    const p1 = await this.request("PROPFIND", this.base,
      `<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>`);
    const principal = first(first(p1.xml, "current-user-principal") || "", "href");
    if (!principal) throw new Error("CalDAV: principal not found");
    const principalUrl = new URL(principal.trim(), p1.url).href;

    const p2 = await this.request("PROPFIND", principalUrl,
      `<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>`);
    const home = first(first(p2.xml, "calendar-home-set") || "", "href");
    if (!home) throw new Error("CalDAV: calendar home not found");
    const homeUrl = new URL(home.trim(), p2.url).href;

    const p3 = await this.request("PROPFIND", homeUrl,
      `<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:a="http://apple.com/ns/ical/">
        <d:prop><d:displayname/><d:resourcetype/><c:supported-calendar-component-set/><a:calendar-color/></d:prop>
      </d:propfind>`, "1");
    return all(p3.xml, "response")
      .filter(r => /<(?:[\w-]+:)?calendar\b/.test(first(r, "resourcetype") || ""))
      .filter(r => { const s = first(r, "supported-calendar-component-set"); return !s || /VEVENT/.test(s); })
      .map(r => ({
        url: new URL(first(r, "href").trim(), p3.url).href,
        name: decodeXml(first(r, "displayname") || "Kalender").trim(),
        color: (first(r, "calendar-color") || "").trim().slice(0, 7) || null,
      }));
  }

  async events(calUrl, from, to) {
    const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const { xml } = await this.request("REPORT", calUrl,
      `<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
        <d:prop><c:calendar-data/></d:prop>
        <c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">
          <c:time-range start="${fmt(from)}" end="${fmt(to)}"/>
        </c:comp-filter></c:comp-filter></c:filter>
      </c:calendar-query>`, "1");
    return all(xml, "calendar-data").map(decodeXml);
  }
}
