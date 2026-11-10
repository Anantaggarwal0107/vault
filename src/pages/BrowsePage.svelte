<script lang="ts">
  import { vault, creatorCounts, creatorCountMap, lowerText, dateBounds } from '../lib/vault.svelte';
  import { ui } from '../lib/ui.svelte';
  import { dayEnd, dayStart, isoDay } from '../lib/text';
  import type { Item, Pool } from '../lib/types';
  import ItemList from '../components/ItemList.svelte';
  import Icon from '../components/Icon.svelte';

  const MARKERS: { id: Pool; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'fav', label: 'Favourites' },
    { id: 'unmarked', label: 'Unsorted' },
    { id: 'del', label: 'Gone' },
  ];

  let source = $derived(vault.source);
  let f = $derived(ui.filters[source]);
  let isIG = $derived(source === 'instagram');
  let bounds = $derived(dateBounds(vault.list));
  let listId = $derived(`browse-${source}`);

  let filtersOpen = $state(false);
  let excludeQuery = $state('');

  let suggestions = $derived.by(() => {
    if (!isIG) return [];
    const q = f.query.trim().toLowerCase();
    if (!q) return [];
    const out: string[] = [];
    for (const [name] of creatorCounts(vault.list)) {
      if (name.toLowerCase().includes(q) && name.toLowerCase() !== q) out.push(name);
      if (out.length >= 10) break;
    }
    return out;
  });

  let excludeSuggestions = $derived.by(() => {
    const q = excludeQuery.trim().toLowerCase();
    if (!q) return [];
    const out: string[] = [];
    for (const [name] of creatorCounts(vault.list)) {
      if (name.toLowerCase().includes(q) && !f.excluded.includes(name)) out.push(name);
      if (out.length >= 8) break;
    }
    return out;
  });

  let results = $derived.by((): Item[] => {
    void vault.version;
    const items = vault.list;
    const lower = lowerText(items);
    const q = f.query.trim().toLowerCase();
    const from = f.from ? dayStart(f.from) : -Infinity;
    const to = f.to ? dayEnd(f.to) : Infinity;
    const hasRange = !!(f.from || f.to);
    const excluded = new Set(f.excluded);
    const out: Item[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (q && !lower[i].includes(q)) continue;
      if (hasRange && (it.savedAt < from || it.savedAt > to)) continue;
      if (excluded.size && excluded.has(it.author)) continue;
      if (f.marker !== 'all' && !vault.inPool(it, f.marker)) continue;
      out.push(it);
    }
    if (f.sort === 'creator' && isIG) {
      const counts = creatorCountMap(items);
      out.sort((a, b) => (counts.get(b.author) ?? 0) - (counts.get(a.author) ?? 0) || b.savedAt - a.savedAt);
    } else if (f.sort === 'oldest') out.sort((a, b) => a.savedAt - b.savedAt);
    else out.sort((a, b) => b.savedAt - a.savedAt);
    return out;
  });

  // Back to page 1 whenever the filters change (not when markers change).
  let lastSig = '';
  $effect(() => {
    const sig = JSON.stringify([source, f.query, f.sort, f.marker, f.from, f.to, f.excluded]);
    if (lastSig && sig !== lastSig) ui.pages[listId] = 0;
    lastSig = sig;
  });

  let activeCount = $derived((f.from || f.to ? 1 : 0) + f.excluded.length);

  function exclude(name: string) {
    if (!f.excluded.includes(name)) f.excluded = [...f.excluded, name];
    excludeQuery = '';
  }
</script>

<div class="browse stack">
  <h1>{isIG ? 'Timeline' : 'Search likes'}</h1>

  <div class="search">
    <Icon name="search" size={18} />
    <input
      class="input"
      type="search"
      placeholder={isIG ? 'Search by username' : 'Keyword, #hashtag or @mention'}
      bind:value={f.query}
      aria-label={isIG ? 'Search by username' : 'Search tweet text'}
      autocomplete="off"
    />
  </div>
  {#if suggestions.length}
    <div class="suggest" aria-label="Matching creators">
      {#each suggestions as s (s)}<button class="chip" onclick={() => (f.query = s)}>@{s}</button>{/each}
    </div>
  {/if}

  <div class="segmented" role="group" aria-label="Show">
    {#each MARKERS as m (m.id)}
      <button aria-pressed={f.marker === m.id} onclick={() => (f.marker = m.id)}>{m.label}</button>
    {/each}
  </div>

  <div class="bar">
    <label class="sort">
      <span class="sr-only">Sort</span>
      <select class="select" bind:value={f.sort}>
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        {#if isIG}<option value="creator">Most saved creator</option>{/if}
      </select>
    </label>
    <button class="btn" aria-expanded={filtersOpen} onclick={() => (filtersOpen = !filtersOpen)}>
      <Icon name="calendar" size={18} /> Filters{#if activeCount}<span class="count num">{activeCount}</span>{/if}
    </button>
  </div>

  {#if filtersOpen || f.from || f.to}
    <div class="panel stack">
      <div class="dates">
        <label class="field">
          {isIG ? 'Saved from' : 'Posted from'}
          <input class="input" type="date" bind:value={f.from} min={bounds ? isoDay(bounds.min) : undefined} max={f.to || undefined} />
        </label>
        <label class="field">
          To
          <input class="input" type="date" bind:value={f.to} min={f.from || undefined} max={bounds ? isoDay(bounds.max) : undefined} />
        </label>
      </div>
      {#if f.from || f.to}
        <button class="btn ghost" onclick={() => ((f.from = ''), (f.to = ''))}>Clear dates</button>
      {/if}

      {#if isIG && filtersOpen}
        <div class="stack exclude">
          <h3>Hide creators</h3>
          <input class="input" type="search" placeholder="Type a username to hide" bind:value={excludeQuery} autocomplete="off" />
          {#if excludeSuggestions.length}
            <div class="suggest">
              {#each excludeSuggestions as s (s)}<button class="chip" onclick={() => exclude(s)}>Hide @{s}</button>{/each}
            </div>
          {/if}
          {#if f.excluded.length}
            <div class="suggest">
              {#each f.excluded as name (name)}
                <button class="chip" aria-pressed="true" onclick={() => (f.excluded = f.excluded.filter((n) => n !== name))}>
                  @{name} <Icon name="close" size={14} />
                </button>
              {/each}
            </div>
          {:else}
            <p class="muted small">No creators hidden.</p>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <ItemList items={results} {listId} noun={isIG ? 'posts' : 'tweets'} empty="Nothing matches these filters. Try clearing the search or dates." />
</div>

<style>
  .search {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-left: 12px;
    border: 1px solid var(--seam);
    border-radius: var(--r-ctl);
    background: var(--dusk);
    color: var(--faint);
  }

  .search:focus-within {
    border-color: var(--accent);
  }

  .search .input {
    border: none;
    background: transparent;
    padding-left: 0;
    min-height: 48px;
  }

  .suggest {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: -6px;
  }

  .bar {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
  }

  .count {
    display: inline-grid;
    place-items: center;
    min-width: 22px;
    height: 22px;
    border-radius: 11px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 0.78rem;
  }

  .dates {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .exclude {
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--seam);
  }

  .exclude .suggest {
    margin-top: 0;
  }
</style>
