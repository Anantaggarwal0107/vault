<script lang="ts">
  import { drive } from '../lib/drive.svelte';

  /** `prompt`: a one-off suggestion on the Random page that can be dismissed. */
  let { prompt = false }: { prompt?: boolean } = $props();

  const DISMISS_KEY = 'vault.syncPromptDismissed';
  let dismissed = $state(localStorage.getItem(DISMISS_KEY) === '1');

  let show = $derived(drive.available && (!prompt || (!drive.connected && !dismissed)));

  function ago(ms: number): string {
    const s = Math.round((Date.now() - ms) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function dismiss() {
    dismissed = true;
    localStorage.setItem(DISMISS_KEY, '1');
  }
</script>

{#if show}
  <section class="sync" class:panel={!prompt} class:prompt aria-label="Sync with Google Drive">
    {#if !drive.connected}
      <div class="text">
        <strong>Keep your favourites on all your devices</strong>
        <p class="muted small">
          Sign in with Google and your favourites are backed up and kept the same on every phone and computer you use. They're saved in a
          private Vault folder in your own Google Drive. Vault can't see anything else in your Drive.
        </p>
      </div>
      <div class="row wrap">
        <button class="btn primary" onclick={() => drive.signIn('connect')}>
          <span class="g" aria-hidden="true">G</span> Sign in with Google
        </button>
        {#if prompt}<button class="btn ghost" onclick={dismiss}>Not now</button>{/if}
      </div>
    {:else}
      <div class="text">
        <strong
          >{drive.status === 'signin'
            ? 'Google Drive sync is paused'
            : drive.status === 'error'
              ? "Google Drive sync didn't work"
              : 'Synced with Google Drive'}</strong
        >
        <p class="muted small" role="status">
          {#if drive.status === 'signin'}
            Google needs you to sign in again before your favourites can sync.
          {:else if drive.status === 'syncing'}
            Syncing…
          {:else if drive.status === 'error'}
            {drive.message}
          {:else if drive.lastSync}
            {drive.account?.email ? `${drive.account.email}. ` : ''}Last synced {ago(drive.lastSync)}.
          {:else}
            {drive.account?.email ? `${drive.account.email}. ` : ''}Your favourites will sync the next time Vault opens.
          {/if}
        </p>
      </div>
      <div class="row wrap">
        {#if drive.status === 'signin'}
          <button class="btn primary" onclick={() => drive.signIn('connect')}>Sign in again</button>
        {:else}
          <button class="btn" disabled={drive.status === 'syncing'} onclick={() => drive.syncNow()}>Sync now</button>
        {/if}
        <button class="btn ghost" onclick={() => drive.disconnect()}>Turn off</button>
      </div>
    {/if}
    {#if drive.message && drive.status !== 'error'}<p class="small" role="status">{drive.message}</p>{/if}
  </section>
{/if}

<style>
  .sync {
    display: grid;
    gap: 12px;
  }

  .prompt {
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--seam));
    background: var(--dusk);
  }

  .text {
    display: grid;
    gap: 4px;
  }

  .wrap {
    flex-wrap: wrap;
  }

  /* A plain "G" mark; the real logo needs Google's brand assets. */
  .g {
    display: inline-grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #fff;
    color: #4285f4;
    font-family: var(--body);
    font-weight: 700;
    font-size: 0.85rem;
  }
</style>
