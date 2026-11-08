// Unicode-aware \w, matching Python's re behaviour in the old app.
const HASHTAG_RE = /#([\p{L}\p{N}\p{M}_]+)/gu;
const MENTION_RE = /@([\p{L}\p{N}\p{M}_]+)/gu;
const URL_RE = /https?:\/\/\S+/g;

export function hashtags(text: string): string[] {
  return Array.from(text.matchAll(HASHTAG_RE), (m) => m[1].toLowerCase());
}

export function mentions(text: string): string[] {
  return Array.from(text.matchAll(MENTION_RE), (m) => m[1].toLowerCase());
}

export function previewText(text: string): string {
  const cleaned = text.replace(URL_RE, '').trim();
  return cleaned || '(media or link only)';
}

const TWITTER_EPOCH = 1288834974657n;
// Ids below this predate snowflake ids (Nov 2010) and carry no timestamp.
const FIRST_SNOWFLAKE = 29_700_000_000n;

/** Decode the posting time from a tweet id. Returns 0 if it can't. */
export function tweetTime(id: string): number {
  try {
    const n = BigInt(id);
    if (n < FIRST_SNOWFLAKE) return 0;
    return Number((n >> 22n) + TWITTER_EPOCH);
  } catch {
    return 0;
  }
}

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' });

export function fmtDate(ms: number): string {
  return ms ? dateFmt.format(ms) : 'Unknown date';
}

export function fmtMonth(ms: number): string {
  return monthFmt.format(ms);
}

export function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}

/** Local-time yyyy-mm-dd, for <input type="date">. */
export function isoDay(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Start of the local day for a yyyy-mm-dd string. */
export function dayStart(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function dayEnd(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d + 1).getTime() - 1;
}
