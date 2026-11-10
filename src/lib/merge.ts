import type { Marker } from './types';

/** Marks plus removals, as stored on a device or in the cloud copy. */
export interface MarkState {
  markers: Marker[];
  /** [key, when it was un-marked] */
  removed: [string, number][];
}

/** Forget removals after this long; by then every device has had a chance to see them. */
const REMOVED_TTL = 400 * 24 * 3600 * 1000;

/**
 * Merge two devices' marks. For each post the most recent action wins: starring,
 * marking gone, or taking the mark off. Ties go to keeping the mark.
 */
export function mergeStates(a: MarkState, b: MarkState, now = Date.now()): MarkState {
  const latest = new Map<string, { at: number; marker: Marker | null }>();
  const consider = (key: string, at: number, marker: Marker | null) => {
    const cur = latest.get(key);
    if (!cur || at > cur.at || (at === cur.at && marker && !cur.marker)) latest.set(key, { at, marker });
  };
  for (const s of [a, b]) {
    for (const m of s.markers) consider(m.key, m.at, m);
    for (const [key, at] of s.removed) consider(key, at, null);
  }
  const markers: Marker[] = [];
  const removed: [string, number][] = [];
  for (const [key, { at, marker }] of latest) {
    if (marker) markers.push(marker);
    else if (now - at < REMOVED_TTL) removed.push([key, at]);
  }
  return { markers, removed };
}

/** True if two states hold the same marks and removals. */
export function sameState(a: MarkState, b: MarkState): boolean {
  if (a.markers.length !== b.markers.length || a.removed.length !== b.removed.length) return false;
  const am = new Map(a.markers.map((m) => [m.key, `${m.kind}@${m.at}`]));
  for (const m of b.markers) if (am.get(m.key) !== `${m.kind}@${m.at}`) return false;
  const ar = new Map(a.removed);
  for (const [k, at] of b.removed) if (ar.get(k) !== at) return false;
  return true;
}
