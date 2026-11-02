// Reads the settings for the GitHub Actions scripts.
// Preferred: one secret MEIN_TAG_CONFIG (the "Einrichtungs-Code" the app generates).
// Individual secrets/variables (APPLE_ID, DATA_KEY, …) still work and take precedence.
export function loadConfig(env = process.env) {
  let c = {};
  if (env.MEIN_TAG_CONFIG) {
    try { c = JSON.parse(env.MEIN_TAG_CONFIG); }
    catch { console.log("MEIN_TAG_CONFIG is not valid JSON – please copy the setup code again."); }
  }
  const pick = (name, fallback) => (env[name] != null && env[name] !== "" ? env[name] : fallback);
  const mailHost = pick("IMAP_HOST", c.mail?.host);
  let mailPass = pick("IMAP_PASS", c.mail?.pass);
  if (mailPass && /gmail\.com$/i.test(mailHost || "")) mailPass = mailPass.replace(/\s+/g, ""); // Google shows app passwords with spaces
  return {
    DATA_KEY: c.dataKey || env.DATA_KEY, // the setup code wins, so app and server always use the same key
    APPLE_ID: pick("APPLE_ID", c.apple?.user),
    APPLE_APP_PASSWORD: pick("APPLE_APP_PASSWORD", c.apple?.pass),
    ICS_URLS: [env.ICS_URLS, ...(c.ics || [])].filter(Boolean).join("\n"),
    IMAP_HOST: mailHost,
    IMAP_USER: pick("IMAP_USER", c.mail?.user),
    IMAP_PASS: mailPass,
    NTFY_TOPIC: pick("NTFY_TOPIC", c.ntfy),
    LAT: pick("LAT", c.lat),
    LON: pick("LON", c.lon),
    CITY: pick("CITY", c.city),
    FROST_LIMIT: pick("FROST_LIMIT", c.frost),
  };
}
