import { describe, expect, it } from 'vitest';
import { mergeStates, sameState, type MarkState } from './merge';

const fav = (key: string, at: number) => ({ key, kind: 'fav' as const, at });
const gone = (key: string, at: number) => ({ key, kind: 'del' as const, at });

describe('mergeStates', () => {
  it('keeps marks made on either device', () => {
    const phone: MarkState = { markers: [fav('a', 1)], removed: [] };
    const laptop: MarkState = { markers: [gone('b', 2)], removed: [] };
    expect(mergeStates(phone, laptop, 10).markers.map((m) => m.key).sort()).toEqual(['a', 'b']);
  });

  it('lets a later un-star win over an earlier star', () => {
    const phone: MarkState = { markers: [fav('a', 1)], removed: [] };
    const laptop: MarkState = { markers: [], removed: [['a', 5]] };
    const m = mergeStates(phone, laptop, 10);
    expect(m.markers).toEqual([]);
    expect(m.removed).toEqual([['a', 5]]);
  });

  it('lets a later star win over an earlier un-star', () => {
    const phone: MarkState = { markers: [fav('a', 9)], removed: [] };
    const laptop: MarkState = { markers: [], removed: [['a', 5]] };
    expect(mergeStates(phone, laptop, 10).markers).toEqual([fav('a', 9)]);
  });

  it('takes the newer kind when both devices marked the same post', () => {
    const m = mergeStates({ markers: [fav('a', 3)], removed: [] }, { markers: [gone('a', 4)], removed: [] }, 10);
    expect(m.markers).toEqual([gone('a', 4)]);
  });

  it('drops very old removals', () => {
    const m = mergeStates({ markers: [], removed: [['a', 0]] }, { markers: [], removed: [] }, 500 * 24 * 3600 * 1000);
    expect(m.removed).toEqual([]);
  });

  it('compares states', () => {
    const s: MarkState = { markers: [fav('a', 1)], removed: [['b', 2]] };
    expect(sameState(s, { markers: [fav('a', 1)], removed: [['b', 2]] })).toBe(true);
    expect(sameState(s, { markers: [gone('a', 1)], removed: [['b', 2]] })).toBe(false);
  });
});
