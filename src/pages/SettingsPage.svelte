<script lang="ts">
  import { vault } from '../lib/vault.svelte';
  import { router } from '../lib/router.svelte';
  import { ui } from '../lib/ui.svelte';
  import { fmtNum } from '../lib/text';
  import { downloadBackup, gistConfig, pullGist, pushGist, restoreFile, setGistConfig } from '../lib/sync';
  import { SOURCES, SOURCE_LABEL, type Source } from '../lib/types';
  import Icon from '../components/Icon.svelte';

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
        syncMsg = 'Uploaded your markers to the gist.';
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
    syncMsg = 'Disconnected. Your markers stay on this device.';
  }
</script>

<div class="stack settings">
  <h1>Settings</h1>

  <section class="panel stack">
    <h2>Your data</h2>
    <p class="muted small">Everything is stored in this browser only. Nothing is uploaded unless you turn on gist sync below.</p>
    {#each SOURCES as s (s)}
      <div class="data-row" data-source={s}>
        <span class="swatch" aria-hidden="true"></span>
        <div class="grow">
          <strong>{SOURCE_LABEL[s]}</strong>
          <p class="muted small num">
            {#if vault.items[s].length}
              {fmtNum(vault.items[s].length)} {s === 'x' ? 'likes' : 'saved posts'}, {fmtNum(vault.count(s, 'fav'))} favourites, {fmtNum(
                vault.count(s, 'del'),
              )} marked deleted
            {:else}
              Not imported yet
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
    <button class="btn" onclick={() => router.go('import')}><Icon name="upload" size={18} /> Import or update an export</button>
  </section>

  <section class="panel stack">
    <h2>Backup your marks</h2>
    <p class="muted small">
      Favourites and deleted marks are saved by post, so they survive re-importing a newer export. Download a backup to move them to
      another device.
    </p>
    <div class="row wrap">
      <button class="btn" onclick={downloadBackup}>Download backup</button>
      <button class="btn" onclick={() => restoreInput?.click()}>Restore from file</button>
    </div>
    <details>
      <summary class="small">Coming from the old Streamlit app?</summary>
      <div class="stack inner">
        <p class="muted small">
          The old apps kept marks in <code>~/.insta_vault_markers.json</code> or <code>~/.twitter_vault_markers.json</code>. Import the same
          export you used there first, then pick which app the file came from and restore it.
        </p>
        <div class="segmented" role="group" aria-label="Old file belongs to">
          {#each SOURCES as s (s)}
            <button aria-pressed={legacySource === s} onclick={() => (legacySource = s)}>{SOURCE_LABEL[s]}</button>
          {/each}
        </div>
      </div>
    </details>
    <input
      bind:this={restoreInput}
      class="sr-only"
      type="file"
      accept=".json"
      onchange={(e) => {
        void restore(e.currentTarget.files?.[0]);
        e.currentTarget.value = '';
      }}
    />
    {#if restoreMsg}<p class="small" role="status">{restoreMsg}</p>{/if}
  </section>

  <section class="panel stack">
    <h2>Sync with a GitHub gist</h2>
    <p class="muted small">
      Optional. Keeps your marks in step across devices, like the old app did. Uses a secret gist and a GitHub token with only the
      <em>gist</em> scope. The token is stored in this browser.
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

  <section class="stack about">
    <h2>Keyboard</h2>
    <p class="muted small">
      On the Random tab: <kbd>R</kbd> or <kbd>Space</kbd> draws, <kbd>F</kbd> favourites, <kbd>D</kbd> marks deleted, <kbd>O</kbd> opens,
      <kbd>P</kbd> toggles the preview, <kbd>I</kbd> shows details.
    </p>
  </section>
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

  .inner {
    gap: 10px;
    margin-top: 10px;
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

  .about {
    padding: 0 4px 24px;
  }
</style>
