/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseCsv, parseInstagramCsv, parseInstagramJson, parsePostUrl, parseSavedDate } from './instagram';
import { likesToItems, parseLikeJs } from './x';
import { hashtags, mentions, previewText, tweetTime } from '../text';

describe('instagram', () => {
  it('parses quoted csv', () => {
    expect(parseCsv('a,b\n"x, y","q""z"\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'q"z'],
    ]);
  });

  it('parses post urls', () => {
    expect(parsePostUrl('https://www.instagram.com/reel/AbC123xYz_9/')).toEqual({ kind: 'reel', id: 'AbC123xYz_9' });
    expect(parsePostUrl('https://instagram.com/p/Qw-Er_Ty12/?igsh=1')).toEqual({ kind: 'p', id: 'Qw-Er_Ty12' });
    expect(parsePostUrl('https://www.instagram.com/someone/reel/ABC123/')).toEqual({ kind: 'reel', id: 'ABC123' });
    expect(parsePostUrl('https://www.instagram.com/tv/XYZ/')).toEqual({ kind: 'tv', id: 'XYZ' });
  });

  it('parses saved dates like the old app', () => {
    expect(new Date(parseSavedDate('Apr 01, 2021 8:19 am')).toString()).toContain('Apr 01 2021 08:19');
    expect(new Date(parseSavedDate('Apr 01, 2022 12:08 pm')).getHours()).toBe(12);
    expect(new Date(parseSavedDate('Apr 01, 2022 12:08 am')).getHours()).toBe(0);
    expect(Number.isNaN(parseSavedDate('garbage'))).toBe(true);
  });

  it('assigns legacy ids like pandas did', () => {
    const csv = [
      'post_url,owner_username,saved_date',
      'https://www.instagram.com/reel/A1/,a,"Apr 01, 2021 8:19 am"',
      ',nobody,"Apr 01, 2021 8:19 am"',
      'https://www.instagram.com/reel/A1/,a,"Apr 02, 2021 8:19 am"',
      'https://www.instagram.com/p/B2/,b,not a date',
      'https://www.instagram.com/p/C3/,c,"Apr 03, 2021 8:19 pm"',
    ].join('\n');
    const items = parseInstagramCsv(csv);
    expect(items.map((i) => [i.id, i.legacyIds])).toEqual([
      ['A1', [1]],
      ['C3', [2]],
    ]);
  });

  it('reads the official saved_posts.json shape', () => {
    const items = parseInstagramJson({
      saved_saved_media: [
        { title: 'alice', string_map_data: { 'Saved on': { href: 'https://www.instagram.com/reel/R1/', timestamp: 1617265140 } } },
        { title: 'bob', string_map_data: { 'Saved on': { href: 'https://www.instagram.com/p/P2/', timestamp: 1617265200 } } },
      ],
    });
    expect(items.map((i) => [i.author, i.id, i.kind, i.savedAt])).toEqual([
      ['alice', 'R1', 'reel', 1617265140000],
      ['bob', 'P2', 'p', 1617265200000],
    ]);
  });
});

describe('x', () => {
  it('parses like.js and decodes tweet dates', () => {
    const js = `window.YTD.like.part0 = [
      { "like": { "tweetId": "2058068408009413104", "fullText": "hi #Tag @Someone https://t.co/x", "expandedUrl": "https://twitter.com/i/web/status/2058068408009413104" } },
      { "like": { "tweetId": "20", "fullText": "old" } }
    ]`;
    const items = likesToItems(parseLikeJs(js));
    expect(items).toHaveLength(2);
    expect(new Date(items[0].savedAt).getUTCFullYear()).toBe(2026);
    expect(items[1].savedAt).toBe(0);
    expect(items.map((i) => i.legacyIds)).toEqual([[1], [2]]);
  });

  it('extracts hashtags, mentions and previews', () => {
    expect(hashtags('a #Foo and #bär')).toEqual(['foo', 'bär']);
    expect(mentions('cc @Bob_1')).toEqual(['bob_1']);
    expect(previewText('https://t.co/abc')).toBe('(media or link only)');
    expect(tweetTime('not a number')).toBe(0);
  });
});

// Checks against your real export when it's present locally. Neither the export nor the
// expected row → url pairs (legacy-ref.local.json) are committed.
const realCsv = resolve(__dirname, '../../../../saved_posts.csv');
const refFile = resolve(__dirname, 'legacy-ref.local.json');
describe.skipIf(!existsSync(realCsv) || !existsSync(refFile))('real saved_posts.csv', () => {
  it('matches the old app row ids', () => {
    const items = parseInstagramCsv(readFileSync(realCsv, 'utf8'));
    const byLegacy = new Map<number, string>();
    for (const it of items) for (const id of it.legacyIds ?? []) byLegacy.set(id, it.url);
    const expected: Record<string, string> = JSON.parse(readFileSync(refFile, 'utf8'));
    expect(byLegacy.size).toBe(Math.max(...Object.keys(expected).map(Number)));
    for (const [id, url] of Object.entries(expected)) expect(byLegacy.get(Number(id))).toBe(url);
  });
});
