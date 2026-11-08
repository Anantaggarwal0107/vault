import type { Item } from '../types';
import { tweetTime } from '../text';

interface LikeRecord {
  like?: { tweetId?: string; fullText?: string; expandedUrl?: string };
}

/** Parse one like.js / like-partN.js file from an X archive. */
export function parseLikeJs(text: string): LikeRecord[] {
  const body = text
    .trim()
    .replace(/^window\.YTD\.like\.part\d+\s*=\s*/, '')
    .replace(/;$/, '');
  const data = JSON.parse(body);
  if (!Array.isArray(data)) throw new Error('This like.js file has an unexpected format.');
  return data as LikeRecord[];
}

/**
 * Turn like records into items. Pass parts in order (part0 first).
 * Row ids match the old app, which numbered part0 records from 1.
 */
export function likesToItems(records: LikeRecord[]): Item[] {
  const byKey = new Map<string, Item>();
  records.forEach((rec, i) => {
    const like = rec.like;
    if (!like?.tweetId) return;
    const key = `x:${like.tweetId}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.legacyIds!.push(i + 1);
      return;
    }
    byKey.set(key, {
      key,
      source: 'x',
      id: like.tweetId,
      kind: 'tweet',
      url: like.expandedUrl || `https://x.com/i/web/status/${like.tweetId}`,
      author: '',
      text: like.fullText ?? '',
      savedAt: tweetTime(like.tweetId),
      order: i,
      legacyIds: [i + 1],
    });
  });
  return [...byKey.values()];
}
