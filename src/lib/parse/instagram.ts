import type { Item } from '../types';

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
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

/**
 * Parse the HTML version of saved_posts (Instagram's default export format).
 * Each saved post is a block headed by the creator's username (<h2>), containing the post
 * link and the date it was saved. We split on headings and pair links with dates in order.
 */
export function parseInstagramHtml(html: string): Item[] {
  const body = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');
  const blocks = body.split(/(?=<h2\b)/i);
  const byKey = new Map<string, Item>();
  let order = 0;
  for (const block of blocks) {
    const heading = block.match(/^<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
    const author = heading ? stripTags(heading[1]).replace(/^@/, '') : '';
    const rest = heading ? block.slice(heading[0].length) : block;

    const links: { kind: string; id: string; url: string }[] = [];
    for (const m of rest.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
      const url = decodeEntities(m[1]);
      const parsed = /instagram\.com/i.test(url) ? parsePostUrl(url) : null;
      if (parsed && !links.some((l) => l.id === parsed.id)) links.push({ ...parsed, url });
    }
    if (!links.length) continue;

    const dates: number[] = [];
    for (const m of stripTags(rest).matchAll(new RegExp(LOOSE_RE.source, 'gi'))) {
      const t = parseLooseDate(m[0]);
      if (!Number.isNaN(t)) dates.push(t);
    }

    links.forEach((l, i) => {
      const key = `instagram:${l.id}`;
      if (byKey.has(key)) return;
      byKey.set(key, {
        key,
        source: 'instagram',
        id: l.id,
        kind: l.kind,
        url: l.url,
        author,
        text: '',
        savedAt: dates[i] ?? dates[0] ?? 0,
        order: order++,
      });
    });
  }
  return [...byKey.values()];
}

/**
 * Parse the saved_posts.csv the old app used (post_url, owner_username, saved_date).
 * Row ids are assigned exactly like the old app did (drop empty urls, drop duplicate urls,
 * drop unparseable dates, then number from 1) so old markers can be migrated.
 */
export function parseInstagramCsv(text: string): Item[] {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  const header = rows.shift()?.map((h) => h.trim().toLowerCase()) ?? [];
  const iUrl = header.indexOf('post_url');
  const iUser = header.indexOf('owner_username');
  const iDate = header.indexOf('saved_date');
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
      key,
      source: 'instagram',
      id: parsed.id,
      kind: parsed.kind,
      url: url.trim(),
      author: (iUser >= 0 ? r[iUser] : '')?.trim() ?? '',
      text: '',
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
