import type { Item, Marker, MarkKind, Source } from './types';
import { vault } from './vault.svelte';
import { DEMO_PREFIX } from './demo';
import { isoDay } from './text';
import { docState, isMarkersDoc, type MarkersDoc } from './markers-file';
export { MARKERS_FILE } from './markers-file';

// ── file format ─────────────────────────────────────────

/** The old Streamlit apps' format: row numbers from the CSV / like.js they used. */
interface LegacyDoc {
  favourites?: number[];
  probably_deleted?: number[];
}

const isDemoKey = (k: string) => k.includes(`:${DEMO_PREFIX}`);

export function markersDoc(): MarkersDoc {
  // Stars on the sample posts are never backed up or synced.
  return {
    app: 'vault',
    version: 2,
    updatedAt: Date.now(),
    markers: [...vault.markers.values()].filter((m) => !isDemoKey(m.key)),
    removed: [...vault.removed.entries()].filter(([k]) => !isDemoKey(k)),
  };
}

function isLegacyDoc(d: unknown): d is LegacyDoc {
  return !!d && typeof d === 'object' && ('favourites' in d || 'probably_deleted' in d);
}

/**
 * Convert markers from the old Streamlit apps. Those keyed posts by row number,
 * so we look rows up via the legacyIds recorded when the old CSV / like.js was imported.
 */
export function convertLegacy(doc: LegacyDoc, source: Source): { markers: Marker[]; missing: number } {
  const byLegacy = new Map<number, Item>();
  for (const it of vault.items[source]) for (const id of it.legacyIds ?? []) byLegacy.set(id, it);
  const out: Marker[] = [];
  let missing = 0;
  const add = (ids: number[] | undefined, kind: MarkKind) => {
    for (const id of ids ?? []) {
      const it = byLegacy.get(id);
      if (it) out.push({ key: it.key, kind, at: Date.now() });
      else missing++;
    }
  };
  add(doc.favourites, 'fav');
  add(doc.probably_deleted, 'del');
  return { markers: out, missing };
}

// ── backup files ────────────────────────────────────────

export function favouritesFileName(): string {
  return `vault-favourites-${isoDay(Date.now())}.json`;
}

/**
 * Restore a favourites backup (merged with what's here, newest change per post wins)
 * or move favourites from an old Streamlit app file. `legacySource` says which app an
 * old file came from.
 */
export async function restoreFile(file: File, legacySource: Source): Promise<string> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("This isn't a Vault favourites file. To bring in a copy of everything (.zip), use Add or update posts.");
  }
  if (isMarkersDoc(data)) {
    await vault.mergeState(docState(data));
    return `Restored favourites for ${data.markers.length.toLocaleString()} posts.`;
  }
  if (isLegacyDoc(data)) {
    if (!vault.items[legacySource].some((i) => i.legacyIds?.length)) {
      throw new Error(
        'First add the same file the old app used (saved_posts.csv or like.js), then choose the old favourites file again.',
      );
    }
    const { markers, missing } = convertLegacy(data, legacySource);
    await vault.mergeState({ markers, removed: [] });
    return `Moved favourites for ${markers.length.toLocaleString()} posts from the old app${missing ? ` (${missing} could not be matched)` : ''}.`;
  }
  throw new Error("This isn't a Vault favourites file.");
}
