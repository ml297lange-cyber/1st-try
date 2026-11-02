# Mein Tag – dein Tagesüberblick fürs iPad

Eine Web-App für den iPad-Home-Bildschirm. Sie zeigt dir jeden Tag:

- 📅 **Termine** von heute und morgen (iCloud-, Google- oder Outlook-Kalender)
- 🌤️ **Wetter** mit 3-Tage-Vorschau
- 🚗❄️ **Frostwarnung** („Auto abdecken!“), Glatteis, Sturm, Regen
- ✉️ **E-Mails**: Anzahl ungelesener Mails und die neuesten Betreffzeilen
- ✅ **Aufgaben** und eine **Notiz** für den Tag
- 🔔 **Push-Nachrichten** aufs iPad/iPhone: morgens ein Tages-Briefing, abends eine Frostwarnung

> **Wichtig zu Nachrichten (iMessage/WhatsApp):** Apple erlaubt keiner App und keiner Web-App, deine iMessages oder WhatsApp-Nachrichten auszulesen. Die App hat dafür Schnellzugriff-Buttons, die Nachrichten/WhatsApp direkt öffnen.

---

## Schritt 1 – App online stellen (einmalig, ca. 2 Minuten)

1. Auf GitHub dieses Repository öffnen → **Settings** → **Pages**.
2. Bei **Source** „**GitHub Actions**“ auswählen.
3. Unter **Actions** den Workflow „App veröffentlichen“ einmal starten (**Run workflow**), falls er nicht schon gelaufen ist.
4. Danach ist die App erreichbar unter:
   `https://ml297lange-cyber.github.io/1st-try/`

> GitHub Pages ist kostenlos, wenn das Repository **öffentlich** ist. Deine Kalender-Links, Passwörter usw. landen **nicht** im Repository – sie bleiben nur auf deinem iPad bzw. als geheime Einstellungen bei GitHub/Cloudflare.

## Schritt 2 – Auf den iPad-Home-Bildschirm

1. Die Adresse oben in **Safari** auf dem iPad öffnen.
2. Auf **Teilen** (Quadrat mit Pfeil) tippen → **Zum Home-Bildschirm** → **Hinzufügen**.
3. Fertig – „Mein Tag“ startet jetzt wie eine normale App im Vollbild.

## Schritt 3 – Ort und Wetter

In der App auf ⚙︎ tippen, Stadt eintragen (oder 📍 für den aktuellen Standort) → **Speichern**.
Bei „Frostwarnung ab“ kannst du die Grenze ändern (Standard: 0 °C).

Das funktioniert sofort, ohne weitere Einrichtung.

## Schritt 4 – Push-Nachrichten (Wetter & Tages-Briefing)

Push-Nachrichten kommen über die kostenlose App **ntfy**.

1. **ntfy** aus dem App Store installieren (iPad und/oder iPhone).
2. In ntfy auf **+** tippen und ein Thema abonnieren, das nur du kennst, z. B. `mein-tag-x7k2q9` (der Name ist quasi dein Passwort – denk dir etwas Zufälliges aus).
3. In GitHub → **Settings** → **Secrets and variables** → **Actions**:
   - Reiter **Secrets** → **New repository secret**:
     - `NTFY_TOPIC` = dein Thema (z. B. `mein-tag-x7k2q9`)
     - optional `ICS_URLS` = deine Kalender-Links (einer pro Zeile), damit das Morgen-Briefing deine Termine enthält
   - Reiter **Variables** → **New repository variable**:
     - `LAT` = Breitengrad, z. B. `48.137`
     - `LON` = Längengrad, z. B. `11.575`
     - `CITY` = z. B. `München`
     - optional `FROST_LIMIT` = z. B. `1` (Standard `0`)
   - Die Koordinaten zeigt dir die App in den Einstellungen an, nachdem du deinen Ort gespeichert hast.
4. Testen: **Actions** → „Push-Nachrichten“ → **Run workflow** (Modus `morning`).

Ab dann bekommst du automatisch:
- **ca. 6:00 Uhr**: Tages-Briefing (Wetter, Termine, Warnungen)
- **ca. 18:00 Uhr**: „🚗❄️ Heute Nacht bis −2 °C – Auto abdecken!“ – **nur** wenn es nachts friert

(GitHub-Zeitpläne laufen in UTC und können sich ein paar Minuten verspäten; im Sommer kommen die Nachrichten eine Stunde später.)

In der App kannst du unter ⚙︎ dein ntfy-Thema eintragen und mit „Test-Push senden“ prüfen, ob alles ankommt.

## Schritt 5 – Kalender und E-Mails verbinden

Browser dürfen Kalender und Mails aus Sicherheitsgründen nicht direkt abrufen. Dafür gibt es einen kleinen, kostenlosen **Cloudflare Worker** (im Ordner `worker/`), der als Vermittler dient.

### 5a – Worker einrichten (am Computer, einmalig)

```bash
npm install -g wrangler
cd worker
wrangler login                      # kostenloses Cloudflare-Konto
wrangler secret put APP_TOKEN       # beliebiger langer Zufallscode, z. B. aus einem Passwort-Generator
wrangler deploy                     # zeigt dir die Adresse, z. B. https://mein-tag.DEINNAME.workers.dev
```

### 5b – Kalender

- **iCloud**: Kalender-App → beim Kalender auf ⓘ → **Öffentlicher Kalender** einschalten → **Link teilen** → kopieren.
- **Google**: calendar.google.com → Einstellungen → dein Kalender → **Privatadresse im iCal-Format**.
- **Outlook**: Einstellungen → Kalender → Freigegebene Kalender → **Kalender veröffentlichen** → ICS-Link.

In der App unter ⚙︎ einfügen (einer pro Zeile), dazu die **Proxy-Adresse** (Worker-Adresse) und den **Zugangs-Code** (`APP_TOKEN`).

### 5c – E-Mails (optional)

Du brauchst ein **app-spezifisches Passwort** (nicht dein normales Passwort):
- **iCloud**: appleid.apple.com → Anmeldung und Sicherheit → App-spezifische Passwörter
- **Gmail**: myaccount.google.com → Sicherheit → App-Passwörter (2-Faktor muss an sein)

```bash
cd worker
wrangler secret put IMAP_HOST   # iCloud: imap.mail.me.com   Gmail: imap.gmail.com   Outlook: outlook.office365.com
wrangler secret put IMAP_USER   # deine E-Mail-Adresse
wrangler secret put IMAP_PASS   # das app-spezifische Passwort
wrangler deploy
```

Die App liest Mails nur (markiert nichts als gelesen) und zeigt Absender + Betreff der neuesten ungelesenen Mails.

---

## Was ist was?

| Datei | Zweck |
|---|---|
| `index.html`, `style.css`, `app.js` | Die App selbst |
| `ics.js` | Liest Kalenderdaten (inkl. wiederkehrender Termine) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Damit die App auf dem Home-Bildschirm wie eine echte App läuft, auch offline |
| `scripts/notify.mjs` | Erstellt die Push-Nachrichten |
| `.github/workflows/notify.yml` | Zeitplan für die Push-Nachrichten |
| `.github/workflows/pages.yml` | Veröffentlicht die App |
| `worker/` | Vermittler für Kalender und E-Mails |

Wetterdaten: [Open-Meteo](https://open-meteo.com) (kostenlos, kein Konto nötig).
