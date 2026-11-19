import type { Item } from '../types';

/**
 * Copy a string so it no longer points into the (much bigger) text it was cut from.
 * JS engines share memory between a string and pieces sliced from it, so 170k small fields
 * cut from a big export would otherwise keep the whole export alive.
 */
export function own(s: string): string {
  return s === '' ? s : (JSON.parse(JSON.stringify(s)) as string);
}

/**
 * Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF).
 * Fields are sliced out whole rather than built a character at a time, which matters for
 * memory on phones when the file has 170k rows.
 */
export function* csvRows(text: string): Generator<string[]> {
  let row: string[] = [];
  const n = text.length;
  let i = 0;
  while (i <= n) {
    let field: string;
    if (text.charCodeAt(i) === 34 /* " */) {
      // Quoted field: find the closing quote, skipping doubled quotes.
      let j = i + 1;
      let hasEscapes = false;
      for (;;) {
        const q = text.indexOf('"', j);
        if (q < 0) {
          j = n;
          break;
        }
        if (text.charCodeAt(q + 1) === 34) {
          hasEscapes = true;
          j = q + 2;
          continue;
        }
        j = q;
        break;
      }
      field = text.slice(i + 1, j);
      if (hasEscapes) field = field.replace(/""/g, '"');
      i = j + 1;
    } else {
      let j = i;
      while (j < n) {
        const c = text.charCodeAt(j);
        if (c === 44 || c === 10 || c === 13) break;
        j++;
      }
      field = text.slice(i, j);
      i = j;
    }
    row.push(field);
    const c = text.charCodeAt(i);
    if (c === 44 /* , */) {
      i++;
      continue;
    }
    // End of line or end of text.
    if (c === 13 && text.charCodeAt(i + 1) === 10) i++;
    i++;
    if (row.length > 1 || row[0] !== '') yield row;
    row = [];
  }
}

/** All rows at once (small files and tests). */
export function parseCsv(text: string): string[][] {
  return [...csvRows(text)];
}

const IG_POST_RE = /^https?:\/\/(?:www\.)?instagram\.com\/(?:[^/?#]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i;

/** Split an Instagram post url into kind + shortcode. Mirrors the old get_instagram_url. */
export function parsePostUrl(url: string): { kind: string; id: string } | null {
  const clean = url.trim().split('?')[0].split('#')[0];
  const m = clean.match(IG_POST_RE);
  if (m) {
    let kind = m[1].toLowerCase();
    if (kind === 'reels') kind = 'reel';
    return { kind, id: m[2] };
  }
  const parts = clean.replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, '').split('/').filter(Boolean);
  if (parts.length === 1 && /^[A-Za-z0-9_-]+$/.test(parts[0])) return { kind: 'p', id: parts[0] };
  return null;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
// "Apr 01, 2021 8:19 am" — the format the old CSV uses.
const SAVED_RE = /^([A-Za-z]{3})[a-z]*\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})\s*([ap]m)$/i;

export function parseSavedDate(s: string): number {
  const t = s.trim();
  if (!t) return NaN;
  const m = t.match(SAVED_RE);
  if (m) {
    const mon = MONTHS[m[1].toLowerCase()];
    let h = Number(m[4]) % 12;
    if (m[6].toLowerCase() === 'pm') h += 12;
    if (mon === undefined) return NaN;
    return new Date(Number(m[3]), mon, Number(m[2]), h, Number(m[5])).getTime();
  }
  if (/^\d{9,10}$/.test(t)) return Number(t) * 1000;
  if (/^\d{12,13}$/.test(t)) return Number(t);
  return Date.parse(t);
}

// Looser variant for the HTML export: "Apr 01, 2021 8:19 am", "Apr 1, 2021, 8:19 AM", "April 1, 2021 at 8:19 PM".
const LOOSE_RE = /([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s*(\d{4}),?\s*(?:at\s+)?(\d{1,2}):(\d{2})\s*([ap])\.?m\.?/i;

function parseLooseDate(s: string): number {
  const m = s.match(LOOSE_RE);
  if (!m) return NaN;
  const mon = MONTHS[m[1].toLowerCase()];
  if (mon === undefined) return NaN;
  let h = Number(m[4]) % 12;
  if (m[6].toLowerCase() === 'p') h += 12;
  return new Date(Number(m[3]), mon, Number(m[2]), h, Number(m[5])).getTime();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** A link to a post (not a profile), as it appears in an href. */
const POST_HREF_RE = /href\s*=\s*["'](https?:\/\/(?:www\.)?instagram\.com\/(?:[^/"']+\/)?(?:p|reel|reels|tv)\/[A-Za-z0-9_-]+[^"']*)["']/gi;
const USERNAME_RE = />\s*Username\s*<\/td>\s*<td\b[^>]*>([\s\S]*?)<\/td>/i;
const CAPTION_RE = />\s*Caption\s*<\/td>\s*<td\b[^>]*>([\s\S]*?)<\/td>/i;
const H2_RE = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
/** Captions are only for searching and reading; long ones are trimmed to keep storage small. */
const CAPTION_MAX = 600;

/**
 * Streaming reader for the HTML version of saved_posts (Instagram's default export format).
 * The file can be hundreds of MB, so it's fed in chunks and split into one record per post
 * link, keeping memory flat however big the export is.
 *
 * Current exports put everything inside the record: link, caption, hashtags, an "Owner" table
 * with the username, and the saved date at the end. Older exports put the username in an <h2>
 * just before the link instead, so a heading that follows a record's date is carried forward
 * as the next record's author.
 */
export class InstagramHtmlReader {
  private buf = '';
  private started = false;
  private heading = '';
  private byKey = new Map<string, Item>();
  private order = 0;

  push(chunk: string) {
    this.buf += chunk;
    this.drain(false);
  }

  finish(): Item[] {
    this.drain(true);
    return [...this.byKey.values()];
  }

  get count(): number {
    return this.byKey.size;
  }

  private starts(): number[] {
    return Array.from(this.buf.matchAll(POST_HREF_RE), (m) => m.index!);
  }

  private drain(final: boolean) {
    let pos = this.starts();
    if (!this.started) {
      if (!pos.length) return;
      this.heading = lastHeading(this.buf.slice(0, pos[0]));
      this.buf = this.buf.slice(pos[0]);
      pos = pos.map((p) => p - pos[0]);
      this.started = true;
    }
    if (!pos.length) {
      if (final) this.buf = '';
      return;
    }
    // The last record may still be arriving, so keep it unless this is the end.
    const complete = final ? pos.length : pos.length - 1;
    for (let i = 0; i < complete; i++) this.record(this.buf.slice(pos[i], pos[i + 1] ?? this.buf.length));
    this.buf = final ? '' : this.buf.slice(pos[complete]);
  }

  private record(chunk: string) {
    const href = chunk.match(/href\s*=\s*["']([^"']+)["']/i);
    const url = href ? decodeEntities(href[1]) : '';
    const parsed = parsePostUrl(url);

    const text = stripTags(chunk);
    let savedAt = 0;
    let dateText = '';
    for (const m of text.matchAll(new RegExp(LOOSE_RE.source, 'gi'))) {
      const t = parseLooseDate(m[0]);
      if (!Number.isNaN(t)) {
        savedAt = t;
        dateText = m[0];
      }
    }

    const user = chunk.match(USERNAME_RE);
    const author = (user ? stripTags(user[1]) : this.heading).replace(/^@/, '');
    const cap = chunk.match(CAPTION_RE);
    const caption = cap ? stripTags(cap[1]).slice(0, CAPTION_MAX) : '';

    // Old layout: a heading after this record's date names the next record's creator.
    const dateAt = dateText ? chunk.lastIndexOf(dateText) : -1;
    this.heading = dateAt >= 0 ? lastHeading(chunk.slice(dateAt)) : '';

    if (!parsed) return;
    const id = own(parsed.id);
    const key = own(`instagram:${id}`);
    if (this.byKey.has(key)) return;
    this.byKey.set(key, {
      key,
      source: 'instagram',
      id,
      kind: parsed.kind,
      url: own(url),
      author: own(author),
      text: own(caption),
      savedAt,
      order: this.order++,
    });
  }
}

function lastHeading(html: string): string {
  let last = '';
  for (const m of html.matchAll(H2_RE)) last = stripTags(m[1]);
  return last;
}

/** Parse a whole saved_posts.html held in memory (small files and tests). */
export function parseInstagramHtml(html: string): Item[] {
  const r = new InstagramHtmlReader();
  r.push(html);
  return r.finish();
}

/**
 * Parse the saved_posts.csv the old app used (post_url, owner_username, saved_date).
 * Row ids are assigned exactly like the old app did (drop empty urls, drop duplicate urls,
 * drop unparseable dates, then number from 1) so old markers can be migrated.
 */
export function parseInstagramCsv(text: string): Item[] {
  // Rows are read one at a time so a big file never exists twice in memory.
  const rows = csvRows(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  const header = (rows.next().value as string[] | undefined)?.map((h) => h.trim().toLowerCase()) ?? [];
  const iUrl = header.indexOf('post_url');
  const iUser = header.indexOf('owner_username');
  const iDate = header.indexOf('saved_date');
  const iCaption = header.indexOf('caption');
  if (iUrl < 0 || iDate < 0) {
    throw new Error('This CSV needs post_url and saved_date columns.');
  }

  const seenUrls = new Set<string>();
  const byKey = new Map<string, Item>();
  let legacyId = 0;
  let order = 0;
  for (const r of rows) {
    const url = r[iUrl];
    if (!url) continue;
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    const savedAt = parseSavedDate(r[iDate] ?? '');
    if (Number.isNaN(savedAt)) continue;
    legacyId++;
    const parsed = parsePostUrl(url);
    if (!parsed) continue;
    const key = `instagram:${parsed.id}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.legacyIds!.push(legacyId);
      continue;
    }
    byKey.set(key, {
      key: own(key),
      source: 'instagram',
      id: own(parsed.id),
      kind: parsed.kind,
      url: own(url.trim()),
      author: own((iUser >= 0 ? r[iUser] : '')?.trim() ?? ''),
      text: own(iCaption >= 0 ? (r[iCaption] ?? '') : ''),
      savedAt,
      order: order++,
      legacyIds: [legacyId],
    });
  }
  return [...byKey.values()];
}

/**
 * Parse an Instagram "Download your information" JSON file (saved_posts.json).
 * Meta changes this format every so often, so instead of hard-coding one shape we walk
 * the tree and pick up every post url along with the nearest timestamp and username.
 */
export function parseInstagramJson(data: unknown): Item[] {
  const byKey = new Map<string, Item>();
  let order = 0;

  interface Ctx {
    author: string;
    ts: number;
  }

  const visit = (node: unknown, ctx: Ctx) => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child, ctx);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    const next: Ctx = { ...ctx };

    if (typeof obj.title === 'string' && obj.title) next.author = obj.title;
    if (typeof obj.timestamp === 'number') next.ts = obj.timestamp;
    if (typeof obj.label === 'string' && typeof obj.value === 'string' && /user ?name|owner|author/i.test(obj.label)) {
      next.author = obj.value;
    }
    // Labelled-value formats keep siblings in an array, so scan for the author first.
    for (const v of Object.values(obj)) {
      if (!Array.isArray(v)) continue;
      for (const lv of v) {
        if (lv && typeof lv === 'object') {
          const o = lv as Record<string, unknown>;
          if (typeof o.label === 'string' && typeof o.value === 'string' && /user ?name|owner|author/i.test(o.label)) {
            next.author = o.value;
          }
        }
      }
    }

    for (const v of Object.values(obj)) {
      if (typeof v === 'string') {
        const parsed = parsePostUrl(v);
        if (parsed && /instagram\.com/i.test(v)) {
          const key = `instagram:${parsed.id}`;
          if (!byKey.has(key)) {
            const ts = next.ts;
            byKey.set(key, {
              key,
              source: 'instagram',
              id: parsed.id,
              kind: parsed.kind,
              url: v.trim(),
              author: next.author,
              text: '',
              savedAt: ts ? (ts < 1e12 ? ts * 1000 : ts) : 0,
              order: order++,
            });
          }
        }
      }
    }
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object') visit(v, next);
    }
  };

  visit(data, { author: '', ts: 0 });
  return [...byKey.values()];
}
