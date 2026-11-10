<script lang="ts">
  import { vault } from '../lib/vault.svelte';
  import { router } from '../lib/router.svelte';
  import { ui } from '../lib/ui.svelte';
  import { fmtNum } from '../lib/text';
  import { downloadBackup, gistConfig, pullGist, pushGist, restoreFile, setGistConfig } from '../lib/sync';
  import { SOURCES, SOURCE_LABEL, type Source } from '../lib/types';
  import Icon from '../components/Icon.svelte';
  import InstallCard from '../components/InstallCard.svelte';
  import SyncCard from '../components/SyncCard.svelte';
  import { drive } from '../lib/drive.svelte';

  let confirmDelete = $state<Source | null>(null);
  let restoreInput: HTMLInputElement | undefined = $state();
  let legacySource = $state<Source>('instagram');
  let restoreMsg = $state('');

  const cfg = gistConfig();
  let gistId = $state(cfg?.gistId ?? '');
  let token = $state(cfg?.token ?? '');
  let connected = $state(!!cfg);
  let syncBusy = $state(false);
  let syncMsg = $state('');

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

  async function sync(action: 'connect' | 'pull' | 'push') {
    syncBusy = true;
    syncMsg = '';
    try {
      if (action === 'connect') {
        const c = { gistId: gistId.trim(), token: token.trim() };
        if (!c.gistId || !c.token) throw new Error('Enter both a gist id and a token.');
        syncMsg = await pullGist(c);
        setGistConfig(c);
        connected = true;
      } else if (action === 'pull') syncMsg = await pullGist();
      else {
        await pushGist();
        syncMsg = 'Uploaded your favourites to the gist.';
      }
    } catch (e) {
      syncMsg = (e as Error).message;
    } finally {
      syncBusy = false;
    }
  }

  function disconnect() {
    setGistConfig(null);
    connected = false;
    token = '';
    syncMsg = 'Disconnected. Your favourites stay on this device.';
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

  <section class="panel stack">
    <h2>Back up your favourites</h2>
    <p class="muted small">
      Your favourites stay put when you add a newer download. {drive.available ? 'Google Drive sync is the easiest way to move them to a new phone, or' : 'To move them to a new phone,'} save
      a backup file here and open it on the other phone.
    </p>
    <div class="row wrap">
      <button class="btn" onclick={downloadBackup}>Save backup file</button>
      <button class="btn" onclick={() => restoreInput?.click()}>Restore from backup</button>
    </div>
    {#if restoreMsg}<p class="small" role="status">{restoreMsg}</p>{/if}
  </section>

  <details class="advanced" open={connected}>
    <summary><h2>Advanced</h2></summary>
    <div class="stack">
      <section class="panel stack">
        <h3>Sync with a GitHub gist</h3>
        {#if drive.connected}<p class="small">Google Drive sync is on, so gist sync is paused.</p>{/if}
        <p class="muted small">
          For people with a GitHub account. Keeps favourites in step across devices using a secret gist and a token with only the
          <em>gist</em> scope. The token is stored on this device.
        </p>
        {#if connected}
          <p class="small">Connected to gist <code>{gistId}</code>. Changes upload automatically.</p>
          <div class="row wrap">
            <button class="btn" disabled={syncBusy} onclick={() => sync('pull')}>Download from gist</button>
            <button class="btn" disabled={syncBusy} onclick={() => sync('push')}>Upload to gist</button>
            <button class="btn ghost" onclick={disconnect}>Disconnect</button>
          </div>
        {:else}
          <label class="field">Gist id<input class="input" bind:value={gistId} autocomplete="off" spellcheck="false" /></label>
          <label class="field"
            >GitHub token<input class="input" type="password" bind:value={token} autocomplete="off" spellcheck="false" /></label
          >
          <button class="btn primary" disabled={syncBusy} onclick={() => sync('connect')}>Connect</button>
        {/if}
        {#if syncMsg}<p class="small" role="status">{syncMsg}</p>{/if}
      </section>

      <section class="panel stack">
        <h3>Move favourites from the old Streamlit app</h3>
        <p class="muted small">
          The old apps kept them in <code>~/.insta_vault_markers.json</code> or <code>~/.twitter_vault_markers.json</code>. First add the
          same files you used there, then pick which app the file came from and choose <em>Restore from backup</em>.
        </p>
        <div class="segmented" role="group" aria-label="Old file belongs to">
          {#each SOURCES as s (s)}
            <button aria-pressed={legacySource === s} onclick={() => (legacySource = s)}>{SOURCE_LABEL[s]}</button>
          {/each}
        </div>
        <button class="btn" onclick={() => restoreInput?.click()}>Choose old file</button>
      </section>

      <section class="stack about">
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
