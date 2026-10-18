// Bible structure (66 books, Protestant canon) and reading-plan generator. No verse text is stored here;
// text is fetched from a public-domain translation (KJV or WEB) via bible-api.com and cached locally.

export const BOOKS: [string, number][] = [
  ["Genesis", 50], ["Exodus", 40], ["Leviticus", 27], ["Numbers", 36], ["Deuteronomy", 34], ["Joshua", 24], ["Judges", 21], ["Ruth", 4],
  ["1 Samuel", 31], ["2 Samuel", 24], ["1 Kings", 22], ["2 Kings", 25], ["1 Chronicles", 29], ["2 Chronicles", 36], ["Ezra", 10], ["Nehemiah", 13],
  ["Esther", 10], ["Job", 42], ["Psalms", 150], ["Proverbs", 31], ["Ecclesiastes", 12], ["Song of Solomon", 8], ["Isaiah", 66], ["Jeremiah", 52],
  ["Lamentations", 5], ["Ezekiel", 48], ["Daniel", 12], ["Hosea", 14], ["Joel", 3], ["Amos", 9], ["Obadiah", 1], ["Jonah", 4], ["Micah", 7],
  ["Nahum", 3], ["Habakkuk", 3], ["Zephaniah", 3], ["Haggai", 2], ["Zechariah", 14], ["Malachi", 4],
  ["Matthew", 28], ["Mark", 16], ["Luke", 24], ["John", 21], ["Acts", 28], ["Romans", 16], ["1 Corinthians", 16], ["2 Corinthians", 13],
  ["Galatians", 6], ["Ephesians", 6], ["Philippians", 4], ["Colossians", 4], ["1 Thessalonians", 5], ["2 Thessalonians", 3], ["1 Timothy", 6],
  ["2 Timothy", 4], ["Titus", 3], ["Philemon", 1], ["Hebrews", 13], ["James", 5], ["1 Peter", 5], ["2 Peter", 3], ["1 John", 5], ["2 John", 1],
  ["3 John", 1], ["Jude", 1], ["Revelation", 22],
];
const NT_START = BOOKS.findIndex((b) => b[0] === "Matthew");

type Ch = { book: string; ch: number };
const chapters = (books: [string, number][]): Ch[] => books.flatMap(([book, n]) => Array.from({ length: n }, (_, i) => ({ book, ch: i + 1 })));

/** Group consecutive chapters into a readable label: "John 3–4", "Genesis 50; Exodus 1–2". */
export function label(chs: Ch[]): string {
  const parts: string[] = [];
  let i = 0;
  while (i < chs.length) {
    let j = i;
    while (j + 1 < chs.length && chs[j + 1].book === chs[i].book && chs[j + 1].ch === chs[j].ch + 1) j++;
    parts.push(i === j ? `${chs[i].book} ${chs[i].ch}` : `${chs[i].book} ${chs[i].ch}–${chs[j].ch}`);
    i = j + 1;
  }
  return parts.join("; ");
}

export type Plan = { id: string; name: string; blurb: string; days: Ch[][] };

function split(all: Ch[], days: number): Ch[][] {
  const out: Ch[][] = [];
  for (let d = 0; d < days; d++) out.push(all.slice(Math.round((d * all.length) / days), Math.round(((d + 1) * all.length) / days)));
  return out.filter((x) => x.length);
}

export const PLANS: Record<string, () => Plan> = {
  gospels: () => ({ id: "gospels", name: "The Gospels, 1 chapter a day", blurb: "Matthew, Mark, Luke and John in 89 days. About 5 minutes each morning.", days: chapters(BOOKS.slice(NT_START, NT_START + 4)).map((c) => [c]) }),
  nt: () => ({ id: "nt", name: "New Testament, 1 chapter a day", blurb: "260 chapters, about 5 to 10 minutes each morning.", days: chapters(BOOKS.slice(NT_START)).map((c) => [c]) }),
  wisdom: () => ({ id: "wisdom", name: "Psalms & Proverbs", blurb: "181 days of prayer and practical wisdom. One chapter a day.", days: chapters(BOOKS.filter((b) => b[0] === "Psalms" || b[0] === "Proverbs")).map((c) => [c]) }),
  year: () => ({ id: "year", name: "Whole Bible in a year", blurb: "All 1,189 chapters in 365 readings, about 3 to 4 chapters (15 to 20 minutes) a day.", days: split(chapters(BOOKS), 365) }),
};

export function getPlan(id?: string | null): Plan {
  return (PLANS[id ?? ""] ?? PLANS.gospels)();
}

/** Verse references for "verse of the day" (rotates by day of year). Text is fetched, never typed here. */
export const VERSE_REFS = [
  "Joshua 1:9", "Psalm 23:1-3", "Psalm 46:1", "Psalm 46:10", "Psalm 55:22", "Psalm 90:12", "Psalm 118:24", "Psalm 119:105", "Psalm 121:1-2", "Psalm 139:14",
  "Proverbs 3:5-6", "Proverbs 4:23", "Proverbs 16:3", "Proverbs 16:9", "Proverbs 21:5", "Proverbs 22:7", "Proverbs 27:17", "Ecclesiastes 3:1", "Isaiah 40:31", "Isaiah 41:10",
  "Jeremiah 29:11", "Lamentations 3:22-23", "Micah 6:8", "Matthew 5:14-16", "Matthew 6:33", "Matthew 6:34", "Matthew 7:7", "Matthew 11:28-30", "Mark 11:24", "Luke 6:31",
  "Luke 16:10", "John 14:27", "John 15:5", "John 16:33", "Romans 5:3-4", "Romans 8:28", "Romans 12:2", "Romans 12:12", "1 Corinthians 10:13", "1 Corinthians 13:4-7",
  "1 Corinthians 15:58", "2 Corinthians 4:16-18", "2 Corinthians 5:7", "2 Corinthians 12:9", "Galatians 6:9", "Ephesians 4:32", "Philippians 1:6", "Philippians 4:6-7", "Philippians 4:8", "Philippians 4:11-13",
  "Colossians 3:23", "1 Thessalonians 5:16-18", "2 Timothy 1:7", "Hebrews 11:1", "Hebrews 12:1-2", "James 1:5", "James 1:19", "1 Peter 5:7", "1 John 4:18", "Revelation 21:4",
];

export function verseRefFor(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const doy = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
  return VERSE_REFS[(doy + y) % VERSE_REFS.length];
}
