<script lang="ts">
  import { vault } from '../lib/vault.svelte';
  import { router } from '../lib/router.svelte';
  import { ui } from '../lib/ui.svelte';
  import { fmtNum } from '../lib/text';
  import { favouritesFileName, markersDoc, restoreFile } from '../lib/sync';
  import { download } from '../lib/compact';
  import { SOURCES, SOURCE_LABEL, type Source } from '../lib/types';
  import Icon from '../components/Icon.svelte';
  import InstallCard from '../components/InstallCard.svelte';
  import SyncCard from '../components/SyncCard.svelte';
  import CopyCard from '../components/CopyCard.svelte';

  let confirmDelete = $state<Source | null>(null);
  let restoreInput: HTMLInputElement | undefined = $state();
  let legacySource = $state<Source>('instagram');
  let restoreMsg = $state('');

  async function removeSource(s: Source) {
    await vault.deleteSource(s);
    confirmDelete = null;
    ui.toast(`Removed your ${SOURCE_LABEL[s]} data from this device.`);
    if (!vault.hasAnyData) router.go('import');
  }

  async function restore(file: File | undefined) {
    if (!file) return;
    try {
      restoreMsg = await restoreFile(file, legacySource);
    } catch (e) {
      restoreMsg = (e as Error).message;
    }
  }

  function saveFavourites() {
    download(new Blob([JSON.stringify(markersDoc())], { type: 'application/json' }), favouritesFileName());
  }
</script>

<div class="stack settings">
  <h1>Settings</h1>

  <InstallCard always />

  <SyncCard />

  <section class="panel stack">
    <h2>Your posts</h2>
    <p class="muted small">Everything is kept on this device only. Nothing is uploaded.</p>
    {#each SOURCES as s (s)}
      <div class="data-row" data-source={s}>
        <span class="swatch" aria-hidden="true"></span>
        <div class="grow">
          <strong>{SOURCE_LABEL[s]}</strong>
          <p class="muted small num">
            {#if vault.items[s].length}
              {fmtNum(vault.items[s].length)} {s === 'x' ? 'liked tweets' : 'saved posts'}, {fmtNum(vault.count(s, 'fav'))} favourites{#if vault.isDemo}
                (sample){/if}
            {:else}
              Not added yet
            {/if}
          </p>
        </div>
        {#if vault.items[s].length}
          {#if confirmDelete === s}
            <button class="btn danger" onclick={() => removeSource(s)}>Remove</button>
            <button class="btn ghost" onclick={() => (confirmDelete = null)}>Cancel</button>
          {:else}
            <button class="btn ghost" onclick={() => (confirmDelete = s)}>Remove…</button>
          {/if}
        {/if}
      </div>
    {/each}
    <button class="btn" onclick={() => router.go('import')}><Icon name="upload" size={18} /> Add or update posts</button>
  </section>


  <CopyCard />

  <details class="advanced">
    <summary><h2>Advanced</h2></summary>
    <div class="stack">
      <section class="panel stack">
        <h3>Favourites only</h3>
        <p class="muted small">
          Save or restore just your favourites and gone posts, without the posts themselves. Restoring merges with what's here: for each
          post, the newest change wins.
        </p>
        <div class="row wrap">
          <button class="btn" onclick={saveFavourites}>Save favourites file</button>
          <button class="btn" onclick={() => restoreInput?.click()}>Restore favourites file</button>
        </div>
      </section>

      <section class="panel stack">
        <h3>Move favourites from the old Streamlit app</h3>
        <p class="muted small">
          The old apps kept them by row number, in <code>~/.insta_vault_markers.json</code>, <code>~/.twitter_vault_markers.json</code> or a
          GitHub gist. First add the same <code>saved_posts.csv</code> or <code>like.js</code> the old app used, pick which app the file came
          from, then choose the file.
        </p>
        <div class="segmented" role="group" aria-label="Old file belongs to">
          {#each SOURCES as s (s)}
            <button aria-pressed={legacySource === s} onclick={() => (legacySource = s)}>{SOURCE_LABEL[s]}</button>
          {/each}
        </div>
        <button class="btn" onclick={() => restoreInput?.click()}>Choose old file</button>
      </section>

      {#if restoreMsg}<p class="small" role="status">{restoreMsg}</p>{/if}

      <section class="stack about">
        <h3>Privacy</h3>
        <p class="muted small">Your posts never leave your device. <a href="./privacy.html" target="_blank" rel="noopener">Read the privacy policy</a>.</p>
        <h3>Keyboard shortcuts</h3>
        <p class="muted small">
          On the Random tab: <kbd>R</kbd> or <kbd>Space</kbd> draws, <kbd>F</kbd> favourites, <kbd>D</kbd> marks as gone, <kbd>O</kbd> opens,
          <kbd>P</kbd> shows the preview, <kbd>I</kbd> shows details.
        </p>
      </section>
    </div>
  </details>

  <input
    bind:this={restoreInput}
    class="sr-only"
    type="file"
    onchange={(e) => {
      void restore(e.currentTarget.files?.[0]);
      e.currentTarget.value = '';
    }}
  />
</div>

<style>
  .data-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 10px 0;
    border-top: 1px solid var(--seam);
  }

  .swatch {
    width: 10px;
    height: 36px;
    border-radius: 5px;
    background: var(--accent);
  }

  .grow {
    flex: 1;
    min-width: 160px;
  }

  .wrap {
    flex-wrap: wrap;
  }

  details summary {
    cursor: pointer;
    color: var(--mist);
  }


  code {
    font-size: 0.85em;
    padding: 1px 5px;
    border-radius: 5px;
    background: var(--dusk-2);
    word-break: break-all;
  }

  kbd {
    display: inline-block;
    min-width: 1.6em;
    padding: 0 4px;
    border: 1px solid var(--seam);
    border-bottom-width: 2px;
    border-radius: 5px;
    text-align: center;
    font-family: var(--body);
    font-size: 0.8rem;
    color: var(--paper);
  }

  .advanced summary {
    cursor: pointer;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
  }

  .advanced summary::-webkit-details-marker {
    display: none;
  }

  .advanced summary::after {
    content: '';
    width: 9px;
    height: 9px;
    border-right: 2px solid var(--mist);
    border-bottom: 2px solid var(--mist);
    transform: rotate(45deg) translateY(-3px);
    transition: transform 0.15s;
  }

  .advanced[open] summary::after {
    transform: rotate(-135deg) translateY(-3px);
  }

  .advanced > .stack {
    margin-top: 12px;
  }

  .about {
    padding: 0 4px 24px;
  }
</style>
