// Verse of the day: a fixed list of well-known passages, one per day (rotates through the year).
// [book number 1–66, USFM code (for YouVersion links), German book name, chapter, first verse, last verse]
export const VERSES = [
  [19, "PSA", "Psalm", 23, 1, 3], [43, "JHN", "Johannes", 3, 16, 16], [24, "JER", "Jeremia", 29, 11, 11],
  [50, "PHP", "Philipper", 4, 13, 13], [45, "ROM", "Römer", 8, 28, 28], [20, "PRO", "Sprüche", 3, 5, 6],
  [23, "ISA", "Jesaja", 41, 10, 10], [40, "MAT", "Matthäus", 11, 28, 28], [6, "JOS", "Josua", 1, 9, 9],
  [19, "PSA", "Psalm", 46, 2, 2], [46, "1CO", "1. Korinther", 13, 4, 7], [50, "PHP", "Philipper", 4, 6, 7],
  [23, "ISA", "Jesaja", 40, 31, 31], [19, "PSA", "Psalm", 121, 1, 2], [45, "ROM", "Römer", 12, 2, 2],
  [48, "GAL", "Galater", 5, 22, 23], [58, "HEB", "Hebräer", 11, 1, 1], [40, "MAT", "Matthäus", 6, 33, 33],
  [43, "JHN", "Johannes", 14, 6, 6], [19, "PSA", "Psalm", 37, 5, 5], [55, "2TI", "2. Timotheus", 1, 7, 7],
  [60, "1PE", "1. Petrus", 5, 7, 7], [19, "PSA", "Psalm", 118, 24, 24], [49, "EPH", "Epheser", 2, 8, 9],
  [43, "JHN", "Johannes", 16, 33, 33], [45, "ROM", "Römer", 15, 13, 13], [19, "PSA", "Psalm", 27, 1, 1],
  [33, "MIC", "Micha", 6, 8, 8], [40, "MAT", "Matthäus", 5, 14, 16], [62, "1JN", "1. Johannes", 4, 18, 18],
  [19, "PSA", "Psalm", 139, 14, 14], [5, "DEU", "5. Mose", 31, 6, 6], [43, "JHN", "Johannes", 8, 12, 12],
  [21, "ECC", "Prediger", 3, 1, 1], [19, "PSA", "Psalm", 34, 9, 9], [45, "ROM", "Römer", 8, 38, 39],
  [47, "2CO", "2. Korinther", 5, 17, 17], [59, "JAS", "Jakobus", 1, 5, 5], [19, "PSA", "Psalm", 91, 1, 2],
  [23, "ISA", "Jesaja", 43, 1, 1], [40, "MAT", "Matthäus", 7, 7, 7], [51, "COL", "Kolosser", 3, 23, 23],
  [19, "PSA", "Psalm", 103, 2, 2], [43, "JHN", "Johannes", 15, 5, 5], [52, "1TH", "1. Thessalonicher", 5, 16, 18],
  [25, "LAM", "Klagelieder", 3, 22, 23], [19, "PSA", "Psalm", 119, 105, 105], [58, "HEB", "Hebräer", 13, 5, 5],
  [45, "ROM", "Römer", 5, 8, 8], [40, "MAT", "Matthäus", 22, 37, 39], [19, "PSA", "Psalm", 16, 11, 11],
  [23, "ISA", "Jesaja", 26, 3, 3], [43, "JHN", "Johannes", 10, 10, 10], [49, "EPH", "Epheser", 3, 20, 20],
  [19, "PSA", "Psalm", 32, 8, 8], [62, "1JN", "1. Johannes", 1, 9, 9], [20, "PRO", "Sprüche", 16, 3, 3],
  [40, "MAT", "Matthäus", 28, 20, 20], [50, "PHP", "Philipper", 1, 6, 6], [19, "PSA", "Psalm", 55, 23, 23],
  [43, "JHN", "Johannes", 13, 34, 35], [45, "ROM", "Römer", 10, 9, 9], [36, "ZEP", "Zefanja", 3, 17, 17],
  [19, "PSA", "Psalm", 62, 2, 3], [58, "HEB", "Hebräer", 12, 1, 2], [48, "GAL", "Galater", 2, 20, 20],
  [23, "ISA", "Jesaja", 55, 8, 9], [40, "MAT", "Matthäus", 5, 3, 9], [19, "PSA", "Psalm", 100, 4, 5],
  [59, "JAS", "Jakobus", 1, 2, 3], [43, "JHN", "Johannes", 11, 25, 26], [49, "EPH", "Epheser", 6, 10, 11],
  [19, "PSA", "Psalm", 4, 9, 9], [20, "PRO", "Sprüche", 18, 10, 10], [45, "ROM", "Römer", 12, 12, 12],
  [46, "1CO", "1. Korinther", 10, 13, 13], [19, "PSA", "Psalm", 18, 3, 3], [23, "ISA", "Jesaja", 9, 5, 5],
  [42, "LUK", "Lukas", 1, 37, 37], [62, "1JN", "1. Johannes", 4, 16, 16], [19, "PSA", "Psalm", 90, 12, 12],
  [50, "PHP", "Philipper", 4, 8, 8], [43, "JHN", "Johannes", 14, 27, 27], [19, "PSA", "Psalm", 145, 18, 18],
  [41, "MRK", "Markus", 10, 27, 27], [47, "2CO", "2. Korinther", 12, 9, 9], [19, "PSA", "Psalm", 73, 26, 26],
  [44, "ACT", "Apostelgeschichte", 1, 8, 8], [45, "ROM", "Römer", 8, 31, 31], [19, "PSA", "Psalm", 28, 7, 7],
  [23, "ISA", "Jesaja", 40, 8, 8], [40, "MAT", "Matthäus", 6, 34, 34], [66, "REV", "Offenbarung", 21, 4, 4],
  [19, "PSA", "Psalm", 19, 2, 2], [61, "2PE", "2. Petrus", 3, 9, 9], [1, "GEN", "1. Mose", 1, 1, 1],
  [2, "EXO", "2. Mose", 14, 14, 14], [4, "NUM", "4. Mose", 6, 24, 26], [19, "PSA", "Psalm", 8, 4, 5],
];

export function verseForDate(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const day = Math.floor((date - start) / 86400000);
  const [book, usfm, name, chapter, from, to] = VERSES[(day + date.getFullYear()) % VERSES.length];
  const ref = `${name} ${chapter},${from}${to > from ? "–" + to : ""}`;
  const usfmRef = `${usfm}.${chapter}.${from}${to > from ? "-" + to : ""}`;
  return {
    book, chapter, from, to, ref,
    // bible.com links open the YouVersion app when it is installed (version 51 = Luther 1912)
    appUrl: `https://www.bible.com/bible/51/${usfmRef}`,
  };
}

// Fetches the verse text (Luther 1912, public domain). Tries several free Bible APIs in turn.
const SOURCES = [
  (v) => [`https://api.getbible.net/v2/luther1912/${v.book}/${v.chapter}.json`, (j) => j.verses],
  (v) => [`https://bolls.life/get-text/LUT/${v.book}/${v.chapter}/`, (j) => j],
];
export async function fetchVerseText(v, log = () => {}) {
  for (const src of SOURCES) {
    const [url, pick] = src(v);
    try {
      const res = await fetch(url);
      if (!res.ok) { log(`${url} -> HTTP ${res.status}`); continue; }
      const verses = (pick(await res.json()) || []).filter(x => x.verse >= v.from && x.verse <= v.to);
      if (!verses.length) { log(`${url} -> no verses`); continue; }
      return verses.map(x => String(x.text).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()).join(" ");
    } catch (e) { log(`${url} -> ${e.message}`); }
  }
  throw new Error("Bibeltext nicht verfügbar");
}
