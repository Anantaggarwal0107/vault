<script lang="ts">
  import { vault } from '../lib/vault.svelte';
  import { ui } from '../lib/ui.svelte';
  import { fmtNum } from '../lib/text';
  import type { MarkKind } from '../lib/types';
  import ItemList from '../components/ItemList.svelte';

  let kind = $state<MarkKind>('fav');
  let confirming = $state(false);
  let source = $derived(vault.source);
  let noun = $derived(source === 'x' ? 'tweets' : 'posts');
  let one = $derived(source === 'x' ? 'tweet' : 'post');

  let items = $derived.by(() => {
    void vault.version;
    return vault
      .pool(kind)
      .slice()
      .sort((a, b) => (vault.markers.get(b.key)?.at ?? 0) - (vault.markers.get(a.key)?.at ?? 0));
  });

  async function clearAll() {
    const n = await vault.clear(source, kind);
    confirming = false;
    ui.toast(kind === 'fav' ? `Cleared ${fmtNum(n)} favourites.` : `Cleared ${fmtNum(n)} gone ${noun}.`);
  }

  $effect(() => {
    void kind;
    void source;
    confirming = false;
  });
</script>

<div class="stack">
  <h1>{kind === 'fav' ? 'Favourites' : 'Gone'}</h1>
  <div class="segmented" role="tablist">
    <button role="tab" aria-selected={kind === 'fav'} onclick={() => (kind = 'fav')}>
      Favourites <span class="muted num">{fmtNum(vault.count(source, 'fav'))}</span>
    </button>
    <button role="tab" aria-selected={kind === 'del'} onclick={() => (kind = 'del')}>
      Gone <span class="muted num">{fmtNum(vault.count(source, 'del'))}</span>
    </button>
  </div>

  <p class="muted small">
    {kind === 'fav'
      ? `${noun[0].toUpperCase() + noun.slice(1)} you starred, newest first.`
      : `${noun[0].toUpperCase() + noun.slice(1)} that no longer open. Marking them keeps them out of Random.`}
  </p>

  <ItemList
    {items}
    listId="marked-{source}-{kind}"
    {noun}
    empty={kind === 'fav'
      ? `No favourites yet. Tap the star on any ${one} to keep it here.`
      : `Nothing here yet. If a ${one} won't open any more, tap the bin to move it here.`}
  />

  {#if items.length}
    <div class="danger-zone">
      {#if confirming}
        <div class="panel stack confirm" role="alertdialog" aria-label="Confirm">
          <p>
            {kind === 'fav'
              ? `Remove the star from all ${fmtNum(items.length)} favourites?`
              : `Clear all ${fmtNum(items.length)} gone ${noun}?`}
            The {noun} stay in Vault. This can't be undone.
          </p>
          <div class="row">
            <button class="btn danger" onclick={clearAll}>{kind === 'fav' ? 'Remove all stars' : 'Clear all'}</button>
            <button class="btn ghost" onclick={() => (confirming = false)}>Cancel</button>
          </div>
        </div>
      {:else}
        <button class="btn ghost" onclick={() => (confirming = true)}>
          {kind === 'fav' ? 'Remove all stars…' : `Clear all gone ${noun}…`}
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .danger-zone {
    padding-top: 8px;
  }

  .confirm {
    border-color: #8c3a4f;
  }
</style>
