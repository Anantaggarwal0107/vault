import type { Marker } from './types';
import type { MarkState } from './merge';

/** Name of the favourites file inside a "copy of everything" zip. */
export const MARKERS_FILE = 'vault_markers.json';

/** Favourites and gone marks as saved in backups and copies. */
export interface MarkersDoc {
  app: 'vault';
  version: 2;
  updatedAt: number;
  markers: Marker[];
  /** Un-starred posts, so restoring a backup doesn't bring back stars you took off. */
  removed?: [string, number][];
}

export function isMarkersDoc(d: unknown): d is MarkersDoc {
  return !!d && typeof d === 'object' && (d as MarkersDoc).app === 'vault' && Array.isArray((d as MarkersDoc).markers);
}

export function docState(d: MarkersDoc): MarkState {
  return { markers: d.markers, removed: Array.isArray(d.removed) ? d.removed : [] };
}
