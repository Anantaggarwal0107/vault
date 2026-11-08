<script lang="ts">
  import { readFiles } from '../lib/parse/importer';
  import { vault } from '../lib/vault.svelte';
  import { router } from '../lib/router.svelte';
  import { ui } from '../lib/ui.svelte';
  import { fmtNum } from '../lib/text';
  import { migrateAfterImport } from '../lib/sync';
  import Icon from '../components/Icon.svelte';

  let busy = $state(false);
  let status = $state('');
  let error = $state('');
  let notes = $state<string[]>([]);
  let dragging = $state(false);
  let input: HTMLInputElement | undefined = $state();

  async function handle(files: File[]) {
    if (!files.length || busy) return;
    busy = true;
    error = '';
    notes = [];
    try {
      const r = await readFiles(files, (s) => (status = s));
      notes = r.notes;
      const done: string[] = [];
      if (r.instagram?.length) {
        status = 'Saving Instagram posts…';
        await vault.replaceItems('instagram', r.instagram);
        done.push(`${fmtNum(r.instagram.length)} Instagram posts`);
      }
      if (r.x?.length) {
        status = 'Saving X likes…';
        await vault.replaceItems('x', r.x);
        done.push(`${fmtNum(r.x.length)} X likes`);
      }
      if (done.length) {
        vault.setSource(r.instagram?.length ? 'instagram' : 'x');
        ui.toast(`Imported ${done.join(' and ')}.`);
        migrateAfterImport()
          .then((m) => m && ui.toast(m))
          .catch((e) => ui.toast(`Couldn't move old marks from your gist: ${(e as Error).message}`));
        if (!notes.length) router.go('random');
      } else if (!notes.length) {
        error = 'Nothing to import was found in those files.';
      }
    } catch (e) {
      error = `Couldn't read that file: ${(e as Error).message}`;
    } finally {
      busy = false;
      status = '';
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    void handle([...(e.dataTransfer?.files ?? [])]);
  }
</script>

<div class="import">
  <header class="intro">
    <h1>Everything you ever saved, in one drawer.</h1>
    <p class="lede">
      Drop in your Instagram or X export. It's read right here in your browser and kept on this device. Nothing is
      uploaded anywhere.
    </p>
  </header>

  <button
    class="drop"
    class:dragging
    disabled={busy}
    onclick={() => input?.click()}
    ondragover={(e) => {
      e.preventDefault();
      dragging = true;
    }}
    ondragleave={() => (dragging = false)}
    ondrop={onDrop}
  >
    <Icon name="upload" size={30} />
    {#if busy}
      <strong>{status || 'Working…'}</strong>
    {:else}
      <strong>Choose export files</strong>
      <span class="muted small">or drop them here: .zip, saved_posts.json, saved_posts.csv, like.js</span>
    {/if}
  </button>
  <input
    bind:this={input}
    class="sr-only"
    type="file"
    multiple
    accept=".zip,.json,.js,.csv"
    onchange={(e) => {
      void handle([...(e.currentTarget.files ?? [])]);
      e.currentTarget.value = '';
    }}
  />

  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#each notes as n (n)}<p class="note small">{n}</p>{/each}

  {#if vault.hasAnyData}
    <p class="muted small">
      Importing again replaces that source's posts. Your favourites and deleted marks are kept.
    </p>
  {/if}

  <section class="how">
    <h2>Getting your export</h2>
    <div class="steps">
      <article data-source="instagram">
        <h3>Instagram saved posts</h3>
        <ol>
          <li>In Instagram, open Settings, then <em>Accounts Center</em>.</li>
          <li>Go to <em>Your information and permissions</em>, then <em>Download your information</em>.</li>
          <li>Choose <em>Some of your information</em> and tick <em>Saved</em>.</li>
          <li>Set the format to <strong>JSON</strong> and date range to <em>All time</em>.</li>
          <li>Instagram emails you a link, usually within a day. Download the zip and drop it above.</li>
        </ol>
      </article>
      <article data-source="x">
        <h3>X likes</h3>
        <ol>
          <li>On X, open <em>Settings and privacy</em>, then <em>Your account</em>.</li>
          <li>Choose <em>Download an archive of your data</em> and confirm your password.</li>
          <li>X prepares the archive, which can take a day or more.</li>
          <li>Download the zip and drop it above. Only <code>data/like.js</code> is read.</li>
        </ol>
      </article>
    </div>
  </section>
</div>

<style>
  .import {
    display: grid;
    gap: 20px;
    padding-top: 12px;
  }

  .intro {
    display: grid;
    gap: 12px;
  }

  .intro h1 {
    font-size: clamp(2.2rem, 9vw, 3.4rem);
    font-weight: 800;
    letter-spacing: -0.035em;
    max-width: 14ch;
  }

  .lede {
    color: var(--mist);
    font-size: 1.08rem;
    max-width: 52ch;
  }

  .drop {
    display: grid;
    justify-items: center;
    gap: 8px;
    padding: 36px 20px;
    border: 2px dashed var(--seam);
    border-radius: 20px;
    background: var(--dusk);
    color: var(--paper);
    text-align: center;
    cursor: pointer;
    transition: border-color 0.15s, background-color 0.15s;
  }

  .drop strong {
    font-family: var(--display);
    font-size: 1.25rem;
  }

  .drop:hover,
  .drop.dragging {
    border-color: var(--accent);
    background: var(--dusk-2);
  }

  .drop:disabled {
    cursor: progress;
  }

  .error {
    color: #ffb3c0;
  }

  .note {
    color: var(--gold);
  }

  .how {
    display: grid;
    gap: 12px;
    margin-top: 8px;
  }

  .steps {
    display: grid;
    gap: 12px;
  }

  @media (min-width: 720px) {
    .steps {
      grid-template-columns: 1fr 1fr;
    }
  }

  article {
    padding: 16px 18px;
    border-radius: 16px;
    border: 1px solid var(--seam);
    border-top: 3px solid var(--accent);
  }

  ol {
    margin: 10px 0 0;
    padding-left: 20px;
    display: grid;
    gap: 6px;
    color: var(--mist);
    font-size: 0.95rem;
  }

  em,
  strong {
    color: var(--paper);
    font-style: normal;
  }
</style>
