import type { Item, Pool, Source } from './types';

export interface BrowseFilters {
  query: string;
  sort: 'newest' | 'oldest' | 'creator';
  marker: Pool;
  from: string;
  to: string;
  excluded: string[];
}

function emptyFilters(): BrowseFilters {
  return { query: '', sort: 'newest', marker: 'all', from: '', to: '', excluded: [] };
}

interface Toast {
  id: number;
  text: string;
}

/** Transient UI state that should survive page switches (like st.session_state did). */
class UI {
  detail = $state<Item | null>(null);
  toasts = $state<Toast[]>([]);
  filters = $state<Record<Source, BrowseFilters>>({ instagram: emptyFilters(), x: emptyFilters() });
  /** Page number per list, keyed by list id. */
  pages = $state<Record<string, number>>({});
  perPage = $state<number>(Number(localStorage.getItem('vault.perPage')) || 25);
  randomPick = $state<Record<Source, Item | null>>({ instagram: null, x: null });
  randomPool = $state<Record<Source, Pool>>({ instagram: 'all', x: 'all' });
  showPreview = $state(localStorage.getItem('vault.preview') !== 'off');

  private nextId = 1;

  setPerPage(n: number) {
    this.perPage = n;
    localStorage.setItem('vault.perPage', String(n));
  }

  togglePreview() {
    this.showPreview = !this.showPreview;
    localStorage.setItem('vault.preview', this.showPreview ? 'on' : 'off');
  }

  toast(text: string) {
    const id = this.nextId++;
    this.toasts = [...this.toasts, { id, text }];
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    }, 3200);
  }

  resetFilters(source: Source) {
    this.filters[source] = emptyFilters();
  }
}

export const ui = new UI();
