<script lang="ts">
  import type { Item } from '../lib/types';
  import { vault } from '../lib/vault.svelte';
  import { ui } from '../lib/ui.svelte';
  import { openUrl } from '../lib/links';
  import { fmtDate, previewText } from '../lib/text';
  import Icon from './Icon.svelte';

  let { item }: { item: Item } = $props();

  let mark = $derived.by(() => {
    void vault.version;
    return vault.markOf(item.key);
  });
  let title = $derived(item.source === 'x' ? previewText(item.text) : `@${item.author || 'unknown'}`);
  let meta = $derived(item.source === 'x' ? fmtDate(item.savedAt) : `Saved ${fmtDate(item.savedAt)}`);
</script>

<li class="row-item" class:is-del={mark === 'del'}>
  <button class="info" onclick={() => (ui.detail = item)} aria-label="Details for {title}">
    <span class="title" class:tweet={item.source === 'x'}>
      {#if mark === 'fav'}<span class="fav-dot" aria-label="Favourite">★</span>{/if}{title}
    </span>
    <span class="meta">{meta}{#if item.kind === 'reel'}<span class="kind">Reel</span>{/if}</span>
  </button>
  <div class="actions">
    <button
      class="icon-btn"
      class:on-fav={mark === 'fav'}
      aria-pressed={mark === 'fav'}
      aria-label={mark === 'fav' ? 'Remove favourite' : 'Favourite'}
      onclick={() => vault.toggle(item, 'fav')}><Icon name="star" filled={mark === 'fav'} /></button>
    <button
      class="icon-btn"
      class:on-del={mark === 'del'}
      aria-pressed={mark === 'del'}
      aria-label={mark === 'del' ? 'Unmark as gone' : 'Mark as gone (post no longer opens)'}
      onclick={() => vault.toggle(item, 'del')}><Icon name="trash" /></button>
    <a class="btn primary open" href={openUrl(item)} target="_blank" rel="noopener">Open</a>
  </div>
</li>

<style>
  .row-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 6px 6px 4px;
    border-bottom: 1px solid var(--seam);
    min-height: 64px;
  }

  .row-item.is-del .title {
    color: var(--faint);
    text-decoration: line-through;
    text-decoration-color: color-mix(in srgb, var(--faint) 60%, transparent);
  }

  .info {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 2px;
    padding: 8px 10px;
    border: none;
    border-radius: var(--r-row);
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .info:hover {
    background: var(--dusk);
  }

  .title {
    font-family: var(--display);
    font-weight: 700;
    font-size: 1.02rem;
    letter-spacing: -0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .title.tweet {
    font-family: var(--body);
    font-weight: 400;
    font-size: 0.95rem;
    letter-spacing: 0;
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .fav-dot {
    color: var(--gold);
    margin-right: 6px;
  }

  .meta {
    display: flex;
    gap: 8px;
    font-size: 0.8rem;
    color: var(--mist);
  }

  .kind {
    color: var(--accent);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: none;
  }

  .open {
    min-height: 40px;
    padding: 0 14px;
    margin-left: 4px;
    font-size: 0.9rem;
  }

  @media (max-width: 380px) {
    .open {
      padding: 0 10px;
    }
  }
</style>
