import { db } from './db';
import { DEMO_PREFIX, demoItems, isDemo } from './demo';
import { hashtags, mentions } from './text';
import type { Item, Marker, MarkKind, Pool, Source } from './types';

const SOURCE_KEY = 'vault.source';

function initialSource(): Source {
  const s = localStorage.getItem(SOURCE_KEY);
  return s === 'x' ? 'x' : 'instagram';
}

/**
 * App-wide state. Item arrays are $state.raw (no deep proxies: there can be 150k+ of them).
 * Markers live in a plain Map; `version` is bumped on every change so derived views re-run.
 */
class Vault {
  source = $state<Source>(initialSource());
  items = $state.raw<Record<Source, Item[]>>({ instagram: [], x: [] });
  version = $state(0);
  loaded = $state(false);

  markers = new Map<string, Marker>();
  /** When each mark was taken off, keyed like markers. Lets sync merge devices properly. */
  removed = new Map<string, number>();
  private listeners = new Set<() => void>();

  get list(): Item[] {
    return this.items[this.source];
  }

  get hasAnyData(): boolean {
    return this.items.instagram.length > 0 || this.items.x.length > 0;
  }

  setSource(s: Source) {
    this.source = s;
    localStorage.setItem(SOURCE_KEY, s);
  }

  async load() {
    const [all, markers, removed] = await Promise.all([db.items.toArray(), db.markers.toArray(), db.removed.toArray()]);
    const ig: Item[] = [];
    const x: Item[] = [];
    for (const it of all) (it.source === 'x' ? x : ig).push(it);
    ig.sort((a, b) => a.order - b.order);
    x.sort((a, b) => a.order - b.order);
    this.items = { instagram: ig, x };
    this.markers = new Map(markers.map((m) => [m.key, m]));
    this.removed = new Map(removed.map((r) => [r.key, r.at]));
    if (!ig.length && x.length) this.setSource('x');
    if (ig.length && !x.length) this.setSource('instagram');
    this.loaded = true;
    this.version++;
  }

  async replaceItems(source: Source, items: Item[]) {
    await db.transaction('rw', db.items, async () => {
      await db.items.where('source').equals(source).delete();
      await db.items.bulkPut(items);
    });
    this.items = { ...this.items, [source]: items };
  }

  async deleteSource(source: Source) {
    await db.items.where('source').equals(source).delete();
    this.items = { ...this.items, [source]: [] };
  }

  // ── sample data ──────────────────────────────────────

  /** True while the vault holds the sample posts instead of real ones. */
  get isDemo(): boolean {
    return [this.items.instagram[0], this.items.x[0]].some((i) => i && isDemo(i));
  }

  async loadDemo() {
    const d = demoItems();
    await this.replaceItems('instagram', d.instagram);
    await this.replaceItems('x', d.x);
    this.setSource('instagram');
  }

  /** Remove the sample posts and any stars put on them. */
  async clearDemo() {
    for (const s of ['instagram', 'x'] as Source[]) {
      if (this.items[s][0] && isDemo(this.items[s][0])) await this.deleteSource(s);
    }
    const keys = [...this.markers.keys()].filter((k) => k.includes(`:${DEMO_PREFIX}`));
    for (const k of keys) this.markers.delete(k);
    await db.markers.bulkDelete(keys);
    this.version++;
  }

  // ── markers ──────────────────────────────────────────

  markOf(key: string): MarkKind | undefined {
    return this.markers.get(key)?.kind;
  }

  /** Toggle a marker. Favourite and deleted are mutually exclusive, like before. */
  toggle(item: Item, kind: MarkKind) {
    const current = this.markOf(item.key);
    const at = Date.now();
    if (current === kind) {
      this.markers.delete(item.key);
      this.removed.set(item.key, at);
      void db.markers.delete(item.key);
      void db.removed.put({ key: item.key, at });
    } else {
      const m: Marker = { key: item.key, kind, at };
      this.markers.set(item.key, m);
      this.removed.delete(item.key);
      void db.markers.put(m);
      void db.removed.delete(item.key);
    }
    this.changed();
  }

  async clear(source: Source, kind: MarkKind): Promise<number> {
    const keys = [...this.markers.values()]
      .filter((m) => m.kind === kind && m.key.startsWith(`${source}:`))
      .map((m) => m.key);
    const at = Date.now();
    for (const k of keys) {
      this.markers.delete(k);
      this.removed.set(k, at);
    }
    await db.markers.bulkDelete(keys);
    await db.removed.bulkPut(keys.map((key) => ({ key, at })));
    this.changed();
    return keys.length;
  }

  /** Replace all markers (used by sync pull and backup restore). */
  async setAllMarkers(list: Marker[], { notify = true } = {}) {
    await db.transaction('rw', db.markers, async () => {
      await db.markers.clear();
      await db.markers.bulkPut(list);
    });
    this.markers = new Map(list.map((m) => [m.key, m]));
    this.version++;
    if (notify) this.emit();
  }

  /** Add markers without removing existing ones. */
  async mergeMarkers(list: Marker[]) {
    for (const m of list) {
      this.markers.set(m.key, m);
      this.removed.delete(m.key);
    }
    await db.markers.bulkPut(list);
    await db.removed.bulkDelete(list.map((m) => m.key));
    this.changed();
  }

  /** Replace marks and removals with the result of a sync merge. Doesn't trigger another sync. */
  async applySynced(markers: Marker[], removed: [string, number][]) {
    // Swap the in-memory maps first so a tap during the write lands on the new state.
    this.markers = new Map(markers.map((m) => [m.key, m]));
    this.removed = new Map(removed);
    this.version++;
    await db.transaction('rw', db.markers, db.removed, async () => {
      await db.markers.clear();
      await db.markers.bulkPut(markers);
      await db.removed.clear();
      await db.removed.bulkPut(removed.map(([key, at]) => ({ key, at })));
    });
  }

  count(source: Source, kind: MarkKind): number {
    void this.version;
    let n = 0;
    for (const m of this.markers.values()) if (m.kind === kind && m.key.startsWith(`${source}:`)) n++;
    return n;
  }

  /** Subscribe to marker changes (sync uses this to push). */
  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private changed() {
    this.version++;
    this.emit();
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  // ── queries ──────────────────────────────────────────

  inPool(item: Item, pool: Pool): boolean {
    const m = this.markOf(item.key);
    if (pool === 'all') return true;
    if (pool === 'unmarked') return !m;
    return m === pool;
  }

  pool(pool: Pool): Item[] {
    void this.version;
    if (pool === 'all') return this.list;
    return this.list.filter((it) => this.inPool(it, pool));
  }
}

export const vault = new Vault();

// ── cached indexes (keyed by the items array, so they rebuild after an import) ──

function memo<T>(build: (items: Item[]) => T): (items: Item[]) => T {
  const cache = new WeakMap<Item[], T>();
  return (items) => {
    let v = cache.get(items);
    if (v === undefined) {
      v = build(items);
      cache.set(items, v);
    }
    return v;
  };
}

function countSorted(keys: Iterable<string>): [string, number][] {
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** [username, saved count], most saved first. */
export const creatorCounts = memo((items) => countSorted(items.filter((i) => i.author).map((i) => i.author)));

export const creatorCountMap = memo((items) => new Map(creatorCounts(items)));

export const hashtagCounts = memo((items) => countSorted(items.flatMap((i) => hashtags(i.text))));

export const mentionCounts = memo((items) => countSorted(items.flatMap((i) => mentions(i.text))));

/** Lowercased text per item, for fast substring search. */
export const lowerText = memo((items) => items.map((i) => (i.source === 'x' ? i.text : i.author).toLowerCase()));

export const dateBounds = memo((items) => {
  let min = Infinity;
  let max = -Infinity;
  for (const i of items) {
    if (!i.savedAt) continue;
    if (i.savedAt < min) min = i.savedAt;
    if (i.savedAt > max) max = i.savedAt;
  }
  return min === Infinity ? null : { min, max };
});
