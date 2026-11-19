<script lang="ts">
  import { ui } from '../lib/ui.svelte';
  import { vault } from '../lib/vault.svelte';
  import { buildCopy, copyFileName, download, fmtMB } from '../lib/compact';
  import Icon from './Icon.svelte';

  /** `offer`: the one-off suggestion after importing a big export. Otherwise the Settings version. */
  let { offer = false }: { offer?: boolean } = $props();

  let busy = $state(false);
  let status = $state('');
  let saved = $state<{ name: string; size: number } | null>(null);
  let error = $state('');

  let show = $derived(!offer || ui.offerCopy > 0);
  let hasPosts = $derived(vault.items.instagram.length + vault.items.x.length > 0 && !vault.isDemo);

  async function save() {
    busy = true;
    error = '';
    try {
      const blob = await buildCopy((s) => (status = s));
      const name = copyFileName();
      download(blob, name);
      saved = { name, size: blob.size };
    } catch (e) {
      error = `Couldn't make the copy: ${(e as Error).message}`;
    } finally {
      busy = false;
      status = '';
    }
  }
</script>

{#if show && hasPosts}
  <section class="copy" class:panel={!offer} class:offer aria-label="Save a copy of everything">
    <div class="text">
      {#if offer}
        <strong>Save a smaller copy for your other devices</strong>
        <p class="muted small">
          The file you chose was {fmtMB(ui.offerCopy)}. Vault can save everything (your posts, captions and favourites) in a much smaller
          file. Open it in Vault on your phone or another computer with <b>Add or update posts</b>.
        </p>
      {:else}
        <h2>Move to another device</h2>
        <p class="muted small">
          Save one small file with your saved posts, liked tweets and favourites. On the other device, open Vault and choose it with
          <b>Add or update posts</b>. It's also a handy backup.
        </p>
      {/if}
    </div>

    {#if saved}
      <p class="done small" role="status">
        Saved <b>{saved.name}</b> ({fmtMB(saved.size)}) to your downloads. Send it to your other device and open it in Vault.
      </p>
    {/if}
    {#if error}<p class="error small" role="alert">{error}</p>{/if}

    <div class="row wrap">
      <button class="btn" class:primary={offer} disabled={busy} onclick={save}>
        <Icon name="upload" size={18} />
        {busy ? status || 'Working…' : saved ? 'Save again' : 'Save a copy of everything'}
      </button>
      {#if offer}<button class="btn ghost" onclick={() => (ui.offerCopy = 0)}>{saved ? 'Done' : 'Not now'}</button>{/if}
    </div>
  </section>
{/if}

<style>
  .copy {
    display: grid;
    gap: 12px;
  }

  .offer {
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid color-mix(in srgb, var(--gold) 45%, var(--seam));
    background: var(--dusk);
  }

  .text {
    display: grid;
    gap: 4px;
  }

  b {
    color: var(--paper);
  }

  .done {
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--dusk-2);
  }

  .error {
    color: #ffb3c0;
  }

  .wrap {
    flex-wrap: wrap;
  }
</style>
