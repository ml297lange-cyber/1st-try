# Mein Tag – dein Tagesüberblick fürs iPad

👉 **App öffnen:** https://ml297lange-cyber.github.io/1st-try/

- 📅 **Termine** aus deinem iCloud-Kalender (über deine Apple-ID)
- ✉️ **Ungelesene E-Mails** (iCloud-Mail)
- 🌤️ **Wetter** mit Stundenvorschau und 4 Tagen
- 🚗❄️ **Frostwarnung** („Auto abdecken!“), Glatteis, Sturm, Regen
- 📖 **Vers des Tages**, mit Knopf zum Öffnen in der Bibel-App (YouVersion)
- ✅ **Aufgaben** und 📝 **Notiz** für den Tag
- ✨ **KI-Assistent**, der alles beantworten und steuern kann
- 🔔 **Push-Nachrichten**: morgens Tagesüberblick, abends Frostwarnung, Erinnerungen vom Assistenten

> iMessage und WhatsApp kann keine App auslesen – Apple erlaubt das nicht. Dafür gibt es Knöpfe, die die Apps direkt öffnen.

---

## 1. Auf den Home-Bildschirm

1. Den Link oben in **Safari** auf dem iPad öffnen.
2. **Teilen** (Quadrat mit Pfeil) → **Zum Home-Bildschirm** → **Hinzufügen**.

## 2. Ort fürs Wetter

Auf dem Startbildschirm auf **„Meinen Standort verwenden“** tippen – oder unter ⚙︎ eine Stadt suchen und aus der Liste antippen.

Falls der Standort blockiert ist: iPad-**Einstellungen → Datenschutz & Sicherheit → Ortungsdienste** einschalten, dann **Safari-Websites → „Beim Verwenden der App“**.

## 3. Kalender & Mail mit deiner Apple-ID verbinden

Alles geht auf dem iPad, ohne Computer. GitHub holt deine Termine und Mails alle 30 Minuten ab und **verschlüsselt** sie. Nur deine App kennt den Schlüssel zum Entschlüsseln.

**a) App-spezifisches Passwort erstellen** (dein normales Apple-Passwort wird **nicht** verwendet)
1. https://account.apple.com öffnen und anmelden.
2. **Anmelden & Sicherheit** → **App-spezifische Passwörter** → **+**.
3. Namen eingeben, z. B. „Mein Tag“ → das angezeigte Passwort (`abcd-efgh-ijkl-mnop`) kopieren.

**b) Bei GitHub eintragen**
1. Im Repository: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Diese drei Secrets anlegen:

| Name | Wert |
|---|---|
| `APPLE_ID` | deine Apple-ID, z. B. `name@icloud.com` |
| `APPLE_APP_PASSWORD` | das app-spezifische Passwort aus a) |
| `DATA_KEY` | ein selbst ausgedachter, langer Schlüssel (mind. 20 Zeichen), z. B. `Sonne-Tannenbaum-Kaffee-2026!` |

3. **Actions** → „App & Daten aktualisieren“ → **Run workflow** (oder bis zu 30 Min. warten).

**c) In der App**
⚙︎ → **Daten-Schlüssel** → denselben `DATA_KEY` eintragen. Fertig – Termine und Mails erscheinen.

*Optional:* Weitere Kalender (z. B. Google) als Secret `ICS_URLS` (iCal-Links, einer pro Zeile). Andere Mail-Anbieter über die Secrets `IMAP_HOST`, `IMAP_USER`, `IMAP_PASS`.

## 4. Push-Nachrichten

1. App **ntfy** aus dem App Store installieren und ein Thema abonnieren, das nur du kennst (z. B. `mein-tag-x7k2q9`).
2. In der App unter ⚙︎ dasselbe Thema eintragen → **Test**.
   Ab jetzt kann dir auch der Assistent Erinnerungen schicken („Erinnere mich um 18 Uhr …“).
3. Für die **automatischen** Nachrichten bei GitHub zusätzlich eintragen:
   - Secret `NTFY_TOPIC` = dein Thema
   - Unter **Variables**: `LAT` und `LON` (Koordinaten, stehen in der App unter ⚙︎ beim Ort), `CITY`, optional `FROST_LIMIT`

Dann kommt **gegen 6 Uhr** dein Tagesüberblick und **gegen 18 Uhr** eine Frostwarnung, falls es nachts friert.

## 5. KI-Assistent

1. Auf https://console.anthropic.com ein Konto anlegen, etwas Guthaben aufladen und unter **API Keys** einen Schlüssel erstellen.
2. In der App auf **✨ Assistent** tippen und den Schlüssel einfügen (bleibt nur auf deinem iPad).
3. Unter ⚙︎ kannst du das Modell wählen: Opus 5.5 (am klügsten), Sonnet 5.5 oder Haiku 5.5 (am günstigsten).

Der Assistent kennt deinen Tag und kann z. B.:
- „Was steht heute an?“ / „Muss ich heute Nacht das Auto abdecken?“
- „Setz Brot kaufen auf die Liste“ / „Hak den Zahnarzt ab“
- „Erinnere mich um 17 Uhr an den Anruf“ (Push-Nachricht)
- „Trag mir morgen 10 Uhr Friseur ein“ (Knopf zum Übernehmen in den Kalender)
- „Erklär mir den Vers des Tages“ / „Stell auf dunkel um“ / „Wetter für Berlin“

---

## Technik

| Datei | Zweck |
|---|---|
| `index.html`, `style.css`, `app.js` | Die App |
| `assistant.js`, `vendor/` | KI-Assistent (Anthropic SDK, lokal eingebunden) |
| `verses.mjs` | Vers des Tages (Text: Lutherbibel 1912 über getBible) |
| `scripts/sync.mjs` | Holt Kalender (iCloud CalDAV), Mail (IMAP) und Bibelvers, verschlüsselt (AES-GCM) |
| `scripts/notify.mjs` | Push-Nachrichten |
| `.github/workflows/` | Veröffentlichung + Abgleich alle 30 Min., Push-Zeitplan |

Wetter: [Open-Meteo](https://open-meteo.com). Hinweis: GitHub pausiert Zeitpläne, wenn 60 Tage lang nichts im Repository passiert – dann einmal unter **Actions** auf **Enable workflow** tippen.
