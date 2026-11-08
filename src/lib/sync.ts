import type { Item, Marker, MarkKind, Source } from './types';
import { vault } from './vault.svelte';

// ── file format ─────────────────────────────────────────

export const MARKERS_FILE = 'vault_markers.json';
const LEGACY_FILES: Record<Source, string> = { instagram: 'insta_vault.json', x: 'twitter_vault.json' };

interface MarkersDoc {
  app: 'vault';
  version: 2;
  updatedAt: number;
  markers: Marker[];
  /** Sources whose old-app gist files have already been migrated. */
  legacyDone?: Source[];
}

const LEGACY_DONE_KEY = 'vault.legacyDone';

function legacyDone(): Source[] {
  try {
    return JSON.parse(localStorage.getItem(LEGACY_DONE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function setLegacyDone(s: Source[]) {
  localStorage.setItem(LEGACY_DONE_KEY, JSON.stringify(s));
}

interface LegacyDoc {
  favourites?: number[];
  probably_deleted?: number[];
}

export function markersDoc(): MarkersDoc {
  return { app: 'vault', version: 2, updatedAt: Date.now(), markers: [...vault.markers.values()], legacyDone: legacyDone() };
}

function isMarkersDoc(d: unknown): d is MarkersDoc {
  return !!d && typeof d === 'object' && (d as MarkersDoc).app === 'vault' && Array.isArray((d as MarkersDoc).markers);
}

function isLegacyDoc(d: unknown): d is LegacyDoc {
  return !!d && typeof d === 'object' && ('favourites' in d || 'probably_deleted' in d);
}

/**
 * Convert markers from the old Streamlit apps. Those keyed posts by row number,
 * so we look rows up via the legacyIds recorded at import time.
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

export function downloadBackup() {
  const blob = new Blob([JSON.stringify(markersDoc(), null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vault-markers-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * Restore a backup (merges into current markers) or migrate an old app's marker file.
 * `legacySource` says which data an old file belongs to.
 */
export async function restoreFile(file: File, legacySource: Source): Promise<string> {
  const data = JSON.parse(await file.text());
  if (isMarkersDoc(data)) {
    await vault.mergeMarkers(data.markers);
    return `Restored ${data.markers.length.toLocaleString()} markers.`;
  }
  if (isLegacyDoc(data)) {
    if (!vault.items[legacySource].length) {
      throw new Error('Import your data for this source first, then restore the old markers.');
    }
    const { markers, missing } = convertLegacy(data, legacySource);
    await vault.mergeMarkers(markers);
    return `Migrated ${markers.length.toLocaleString()} old markers${missing ? `, ${missing} could not be matched` : ''}.`;
  }
  throw new Error('This file is not a Vault markers backup.');
}

// ── GitHub Gist sync (optional, same idea as the old apps) ──

const GIST_KEY = 'vault.gist';
const DIRTY_KEY = 'vault.gist.dirty';

export interface GistConfig {
  gistId: string;
  token: string;
}

export function gistConfig(): GistConfig | null {
  try {
    const c = JSON.parse(localStorage.getItem(GIST_KEY) ?? 'null');
    return c?.gistId && c?.token ? c : null;
  } catch {
    return null;
  }
}

export function setGistConfig(c: GistConfig | null) {
  if (c) localStorage.setItem(GIST_KEY, JSON.stringify(c));
  else localStorage.removeItem(GIST_KEY);
}

async function gistFetch(c: GistConfig, init?: RequestInit) {
  const res = await fetch(`https://api.github.com/gists/${encodeURIComponent(c.gistId)}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${c.token}`,
      Accept: 'application/vnd.github+json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub said ${res.status}${res.status === 404 ? ' (check the gist id and token)' : ''}.`);
  return res.json();
}

export async function pushGist(c = gistConfig()): Promise<void> {
  if (!c) return;
  await gistFetch(c, {
    method: 'PATCH',
    body: JSON.stringify({ files: { [MARKERS_FILE]: { content: JSON.stringify(markersDoc()) } } }),
  });
  localStorage.removeItem(DIRTY_KEY);
}

type GistReader = (name: string) => Promise<unknown>;

async function readGist(c: GistConfig): Promise<GistReader> {
  const gist = await gistFetch(c);
  const files = gist.files ?? {};
  return async (name: string) => {
    const f = files[name];
    if (!f) return null;
    // Large gist files are truncated in the API response; fetch the raw file instead.
    const text = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
    return JSON.parse(text);
  };
}

/**
 * Migrate the old apps' gist files for every source that hasn't been migrated yet and whose
 * data has been imported (from the same files the old apps used, so row ids line up).
 * Sources without data stay pending, so the order of "connect gist" and "import" doesn't matter.
 */
async function migrateLegacy(read: GistReader): Promise<{ moved: number; pending: Source[] }> {
  const done = legacyDone();
  let moved = 0;
  const pending: Source[] = [];
  for (const source of ['instagram', 'x'] as Source[]) {
    if (done.includes(source)) continue;
    const legacy = await read(LEGACY_FILES[source]);
    if (!isLegacyDoc(legacy)) {
      done.push(source);
      continue;
    }
    if (!vault.items[source].some((i) => i.legacyIds?.length)) {
      pending.push(source);
      continue;
    }
    const { markers } = convertLegacy(legacy, source);
    if (markers.length) await vault.mergeMarkers(markers);
    moved += markers.length;
    done.push(source);
  }
  setLegacyDone(done);
  return { moved, pending };
}

function pendingNote(pending: Source[]): string {
  if (!pending.length) return '';
  const names = pending.map((s) => (s === 'x' ? 'like.js' : 'saved_posts.csv')).join(' and ');
  return ` Old marks are waiting to move over: import ${names} (the files the old app used) and they'll be added.`;
}

/** Pull markers from the gist and replace local ones. Old-format files are migrated. */
export async function pullGist(c = gistConfig()): Promise<string> {
  if (!c) return '';
  const read = await readGist(c);
  const doc = await read(MARKERS_FILE);
  let msg: string;
  if (isMarkersDoc(doc)) {
    await vault.setAllMarkers(doc.markers, { notify: false });
    setLegacyDone([...new Set([...legacyDone(), ...(doc.legacyDone ?? [])])]);
    msg = `Synced ${doc.markers.length.toLocaleString()} markers from your gist.`;
  } else {
    msg = 'Gist connected. Your markers were uploaded to it.';
  }
  const { moved, pending } = await migrateLegacy(read);
  if (moved) msg = `Moved ${moved.toLocaleString()} markers from your old apps into the new format.`;
  if (moved || !isMarkersDoc(doc)) await pushGist(c);
  return msg + pendingNote(pending);
}

/** After an import, pick up any old-app marks in the gist that were waiting for this data. */
export async function migrateAfterImport(): Promise<string> {
  const c = gistConfig();
  if (!c || (legacyDone().includes('instagram') && legacyDone().includes('x'))) return '';
  const { moved, pending } = await migrateLegacy(await readGist(c));
  if (moved) await pushGist(c);
  return moved ? `Moved ${moved.toLocaleString()} markers from your old apps.${pendingNote(pending)}` : '';
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Start syncing: pull once (unless there are unpushed local changes), then push on every change. */
export async function startSync(onError: (msg: string) => void): Promise<string> {
  vault.onChange(() => {
    if (!gistConfig()) return;
    localStorage.setItem(DIRTY_KEY, '1');
    clearTimeout(timer);
    timer = setTimeout(() => pushGist().catch((e) => onError(`Sync failed: ${e.message}`)), 1200);
  });
  if (!gistConfig()) return '';
  try {
    if (localStorage.getItem(DIRTY_KEY)) {
      await pushGist();
      return '';
    }
    return await pullGist();
  } catch (e) {
    onError(`Sync failed: ${(e as Error).message}`);
    return '';
  }
}
