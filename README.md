# Mein Tag – dein Tagesüberblick fürs iPad

👉 **App öffnen:** https://ml297lange-cyber.github.io/1st-try/

- 📅 **Termine** aus deinem iCloud-Kalender (über deine Apple-ID)
- ✉️ **Ungelesene E-Mails** (iCloud-Mail)
- 🌤️ **Wetter** mit Stundenvorschau und 4 Tagen
- 🚗❄️ **Frostwarnung** („Auto abdecken!“), Glatteis, Sturm, Regen
- 📖 **Vers des Tages**, mit Knopf zum Öffnen in der Bibel-App (YouVersion)
- ✅ **Aufgaben** und 📝 **Notiz** für den Tag
- ✨ **KI-Assistent**, der alles beantworten und steuern kann
- 🟢 **WhatsApp-Favoriten**: deine wichtigsten Chats mit einem Tipp öffnen, der Assistent kann Nachrichten vorbereiten
- 🔔 **Push-Nachrichten**: morgens Tagesüberblick, abends Frostwarnung, Erinnerungen vom Assistenten

> WhatsApp- und iMessage-Nachrichten kann keine App offiziell mitlesen. Die App öffnet deine Chats aber mit einem Tipp, und der Assistent kann Nachrichten vorformulieren.

---

## 1. Auf den Home-Bildschirm

1. Den Link oben in **Safari** auf dem iPad öffnen.
2. **Teilen** (Quadrat mit Pfeil) → **Zum Home-Bildschirm** → **Hinzufügen**.

## 2. Ort fürs Wetter

Auf dem Startbildschirm auf **„Meinen Standort verwenden“** tippen – oder unter ⚙︎ eine Stadt suchen und aus der Liste antippen.

Falls der Standort blockiert ist: iPad-**Einstellungen → Datenschutz & Sicherheit → Ortungsdienste** einschalten, dann **Safari-Websites → „Beim Verwenden der App“**.

## 3. E-Mail & Kalender verbinden

In der App auf **„E-Mail verbinden“** tippen (Postfach-Feld). Der Assistent dort führt dich durch 3 Schritte:

1. **E-Mail**: Anbieter wählen (z. B. Gmail), auf **„App-Passwort erstellen“** tippen, das Passwort kopieren und mit deiner Adresse einfügen.
   *Gmail:* Das geht nur mit eingeschalteter „Bestätigung in zwei Schritten“ in deinem Google-Konto.
2. **Kalender** (optional): Den Google-Link „Privatadresse im iCal-Format“ einfügen und/oder den iCloud-Kalender einschalten.
3. **Bei GitHub speichern**: **① Code kopieren** → **② GitHub öffnen** → als Name `MEIN_TAG_CONFIG` eintragen, Code einfügen, **Add secret** → **③ Abgleich starten** (Run workflow).

Nach etwa einer Minute erscheinen Mails und Termine, danach aktualisiert sich alles automatisch alle 30 Minuten.
Deine Daten liegen nur verschlüsselt im Netz. Den Schlüssel dafür erstellt die App selbst und speichert ihn auf deinem iPad.

## 4. Push-Nachrichten

1. App **ntfy** aus dem App Store installieren und ein Thema abonnieren, das nur du kennst (z. B. `mein-tag-x7k2q9`).
2. In der App unter ⚙︎ dasselbe Thema eintragen → **Test**.
   Ab jetzt kann dir auch der Assistent Erinnerungen schicken („Erinnere mich um 18 Uhr …“).
3. Für die **automatischen** Nachrichten: Danach den Einrichtungs-Code aus Schritt 3 einmal neu kopieren und bei GitHub unter `MEIN_TAG_CONFIG` ersetzen (Stift ✎). Der Code enthält dann auch dein Push-Thema und deinen Ort.

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
- „Schreib Mama, dass ich später komme“ (öffnet WhatsApp mit fertigem Text)
- „Erklär mir den Vers des Tages“ / „Stell auf dunkel um“ / „Wetter für Berlin“

---

## Technik

| Datei | Zweck |
|---|---|
| `index.html`, `style.css`, `app.js` | Die App |
| `assistant.js`, `vendor/` | KI-Assistent (Anthropic SDK, lokal eingebunden, auch für ältere iPads) |
| `verses.mjs` | Vers des Tages (Text: Lutherbibel 1912 über getBible) |
| `scripts/sync.mjs` | Holt Kalender (iCloud/Google), Mail (IMAP) und Bibelvers, verschlüsselt (AES-GCM) |
| `scripts/lib/config.mjs` | Liest den Einrichtungs-Code `MEIN_TAG_CONFIG` |
| `scripts/notify.mjs` | Push-Nachrichten |
| `.github/workflows/` | Veröffentlichung + Abgleich alle 30 Min., Push-Zeitplan |

Wetter: [Open-Meteo](https://open-meteo.com). Hinweis: GitHub pausiert Zeitpläne, wenn 60 Tage lang nichts im Repository passiert – dann einmal unter **Actions** auf **Enable workflow** tippen.
