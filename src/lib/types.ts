export type Source = 'instagram' | 'x';

export const SOURCES: Source[] = ['instagram', 'x'];

export const SOURCE_LABEL: Record<Source, string> = {
  instagram: 'Instagram',
  x: 'X',
};

export interface Item {
  /** `${source}:${id}`. Stable across re-imports. */
  key: string;
  source: Source;
  /** Instagram shortcode or tweet id. */
  id: string;
  /** 'reel' | 'p' | 'tv' for Instagram, 'tweet' for X. */
  kind: string;
  url: string;
  /** Instagram username. Empty for X (likes exports don't include the author). */
  author: string;
  /** Tweet text. Empty for Instagram. */
  text: string;
  /**
   * Epoch ms. Instagram: when you saved it. X: when the tweet was posted
   * (decoded from the tweet id). 0 when unknown.
   */
  savedAt: number;
  /** Position in the original export file. */
  order: number;
  /** Row ids the old Streamlit app gave this item, used to migrate old markers. */
  legacyIds?: number[];
}

export type MarkKind = 'fav' | 'del';

export interface Marker {
  key: string;
  kind: MarkKind;
  at: number;
}

export type Pool = 'all' | 'fav' | 'del' | 'unmarked';
