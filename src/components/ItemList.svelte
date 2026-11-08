<script lang="ts">
  import type { Item } from '../lib/types';
  import { ui } from '../lib/ui.svelte';
  import { fmtNum } from '../lib/text';
  import ItemRow from './ItemRow.svelte';
  import Icon from './Icon.svelte';

  let {
    items,
    listId,
    noun = 'posts',
    empty = 'Nothing matches these filters.',
  }: { items: Item[]; listId: string; noun?: string; empty?: string } = $props();

  const PER_PAGE = [10, 25, 50, 100];

  let perPage = $derived(ui.perPage);
  let totalPages = $derived(Math.max(1, Math.ceil(items.length / perPage)));
  let page = $derived(Math.min(ui.pages[listId] ?? 0, totalPages - 1));
  let slice = $derived(items.slice(page * perPage, (page + 1) * perPage));
  let top: HTMLElement | undefined = $state();

  function go(p: number, scroll = false) {
    ui.pages[listId] = Math.max(0, Math.min(totalPages - 1, p));
    if (scroll) top?.scrollIntoView({ block: 'start' });
  }

  function jump(e: Event) {
    const v = Number((e.currentTarget as HTMLInputElement).value);
    if (v >= 1 && v <= totalPages) go(v - 1);
  }
</script>

{#snippet pager(scroll: boolean)}
  <nav class="pager" aria-label="Pages">
    <button class="icon-btn" disabled={page === 0} aria-label="Previous page" onclick={() => go(page - 1, scroll)}
      ><Icon name="left" /></button>
    <label class="where">
      <span class="sr-only">Page</span>
      <input
        class="input page-input num"
        type="number"
        min="1"
        max={totalPages}
        value={page + 1}
        onchange={jump}
      />
      <span class="muted">of {fmtNum(totalPages)}</span>
    </label>
    <button
      class="icon-btn"
      disabled={page >= totalPages - 1}
      aria-label="Next page"
      onclick={() => go(page + 1, scroll)}><Icon name="right" /></button>
  </nav>
{/snippet}

<section class="list" bind:this={top}>
  {#if items.length === 0}
    <p class="empty muted">{empty}</p>
  {:else}
    <div class="head">
      <span class="count num">{fmtNum(items.length)} {noun}</span>
      <label class="per">
        <span class="sr-only">Per page</span>
        <select class="select" value={perPage} onchange={(e) => ui.setPerPage(Number(e.currentTarget.value))}>
          {#each PER_PAGE as n (n)}<option value={n}>{n} per page</option>{/each}
        </select>
      </label>
    </div>
    {#if totalPages > 1}{@render pager(false)}{/if}
    <ul>
      {#each slice as item (item.key)}
        <ItemRow {item} />
      {/each}
    </ul>
    {#if totalPages > 1}{@render pager(true)}{/if}
  {/if}
</section>

<style>
  .list {
    scroll-margin-top: 80px;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 1px solid var(--seam);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }

  .count {
    font-weight: 700;
  }

  .per .select {
    min-height: 38px;
    width: auto;
    font-size: 0.9rem;
  }

  .pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: 8px 0;
  }

  .where {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.95rem;
  }

  .page-input {
    width: 84px;
    min-height: 40px;
    text-align: center;
    padding: 0 6px;
  }

  .empty {
    padding: 32px 0;
    text-align: center;
  }
</style>
