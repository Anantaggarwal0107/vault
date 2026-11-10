<script lang="ts">
  import { ui } from '../lib/ui.svelte';
  import { vault, creatorCountMap } from '../lib/vault.svelte';
  import { router } from '../lib/router.svelte';
  import { openUrl } from '../lib/links';
  import { fmtDate, fmtNum, hashtags, isoDay } from '../lib/text';
  import Icon from './Icon.svelte';
  import Embed from './Embed.svelte';

  let dialog: HTMLDialogElement | undefined = $state();
  let item = $derived(ui.detail);
  let mark = $derived.by(() => {
    void vault.version;
    return item ? vault.markOf(item.key) : undefined;
  });
  let tags = $derived(item?.source === 'x' ? [...new Set(hashtags(item.text))].slice(0, 10) : []);
  let creatorTotal = $derived(item?.author ? (creatorCountMap(vault.items.instagram).get(item.author) ?? 0) : 0);
  let showEmbed = $state(false);

  $effect(() => {
    if (!dialog) return;
    if (item && !dialog.open) {
      showEmbed = ui.showPreview;
      dialog.showModal();
    } else if (!item && dialog.open) dialog.close();
  });

  function close() {
    ui.detail = null;
  }

  /** Jump to the Browse page filtered to the day/week/month this was saved. */
  function timeline(span: 'day' | 'week' | 'month') {
    if (!item?.savedAt) return;
    const d = new Date(item.savedAt);
    let from: Date;
    let to: Date;
    if (span === 'day') {
      from = to = d;
    } else if (span === 'week') {
      const mondayOffset = (d.getDay() + 6) % 7;
      from = new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayOffset);
      to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6);
    } else {
      from = new Date(d.getFullYear(), d.getMonth(), 1);
      to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    }
    const f = ui.filters[item.source];
    f.from = isoDay(from.getTime());
    f.to = isoDay(to.getTime());
    f.query = '';
    ui.pages[`browse-${item.source}`] = 0;
    close();
    router.go('browse');
  }

  function goCreator() {
    if (!item) return;
    const name = item.author;
    close();
    router.go('people', name);
  }

  function goTag(tag: string) {
    close();
    router.go('people', `#${tag}`);
  }
</script>

<dialog bind:this={dialog} onclose={close} onclick={(e) => e.target === dialog && close()} aria-label="Post details">
  {#if item}
    <div class="sheet" data-source={item.source}>
      <header>
        <div class="grab" aria-hidden="true"></div>
        <button class="icon-btn close" aria-label="Close" onclick={close}><Icon name="close" /></button>
      </header>

      {#if item.source === 'instagram'}
        <button class="creator" onclick={goCreator}>
          <span class="handle">@{item.author || 'unknown'}</span>
          <span class="muted small">{fmtNum(creatorTotal)} saved from this creator</span>
        </button>
        <p class="muted">Saved {fmtDate(item.savedAt)}{#if item.kind === 'reel'}<span class="kind">Reel</span>{/if}</p>
      {:else}
        <p class="tweet">{item.text}</p>
        <p class="muted small">Posted {fmtDate(item.savedAt)}<span class="id">ID {item.id}</span></p>
        {#if tags.length}
          <div class="tags">
            {#each tags as t (t)}<button class="chip" onclick={() => goTag(t)}>#{t}</button>{/each}
          </div>
        {/if}
      {/if}

      <a class="btn primary lg block" href={openUrl(item)} target="_blank" rel="noopener">
        <Icon name="open" size={20} /> Open in {item.source === 'x' ? 'X' : 'Instagram'}
      </a>

      <div class="marks">
        <button class="btn" class:fav-on={mark === 'fav'} aria-pressed={mark === 'fav'} onclick={() => vault.toggle(item!, 'fav')}>
          <Icon name="star" size={20} filled={mark === 'fav'} />
          {mark === 'fav' ? 'Favourited' : 'Favourite'}
        </button>
        <button class="btn" class:del-on={mark === 'del'} aria-pressed={mark === 'del'} onclick={() => vault.toggle(item!, 'del')}>
          <Icon name="trash" size={20} />
          {mark === 'del' ? 'Marked as gone' : 'Mark as gone'}
        </button>
      </div>

      {#if item.savedAt}
        <div class="timeline">
          <span class="muted small">See everything {item.source === 'x' ? 'posted' : 'saved'} the same</span>
          <div class="segmented">
            <button onclick={() => timeline('day')}>Day</button>
            <button onclick={() => timeline('week')}>Week</button>
            <button onclick={() => timeline('month')}>Month</button>
          </div>
        </div>
      {/if}

      {#if showEmbed}
        <Embed {item} />
      {:else}
        <button class="btn ghost block" onclick={() => (showEmbed = true)}><Icon name="eye" size={20} /> Show preview</button>
      {/if}
    </div>
  {/if}
</dialog>

<style>
  dialog {
    width: min(560px, 100vw);
    max-width: 100vw;
    max-height: 92vh;
    margin: auto auto 0;
    padding: 0;
    border: 1px solid var(--seam);
    border-bottom: none;
    border-radius: 22px 22px 0 0;
    background: var(--dusk);
    color: var(--paper);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  dialog[open] {
    animation: rise 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  dialog::backdrop {
    background: rgb(10 8 24 / 0.7);
    backdrop-filter: blur(2px);
  }

  @keyframes rise {
    from {
      transform: translateY(40px);
      opacity: 0;
    }
  }

  @media (min-width: 720px) {
    dialog {
      margin: auto;
      border-radius: 22px;
      border-bottom: 1px solid var(--seam);
    }
  }

  .sheet {
    display: grid;
    gap: 14px;
    padding: 8px 20px 28px;
  }

  header {
    position: relative;
    height: 36px;
  }

  .grab {
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: var(--seam);
    margin: 10px auto 0;
  }

  .close {
    position: absolute;
    right: -10px;
    top: 0;
  }

  .creator {
    display: grid;
    gap: 2px;
    padding: 0;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .handle {
    font-family: var(--display);
    font-size: clamp(1.6rem, 7vw, 2.1rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.05;
    word-break: break-word;
    text-decoration: underline;
    text-decoration-color: transparent;
    text-underline-offset: 4px;
    transition: text-decoration-color 0.12s;
  }

  .creator:hover .handle {
    text-decoration-color: var(--accent);
  }

  .tweet {
    font-size: 1.1rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    max-width: 62ch;
  }

  .kind,
  .id {
    margin-left: 12px;
  }

  .kind {
    color: var(--accent);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .marks {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .fav-on {
    background: var(--gold);
    border-color: transparent;
    color: #2a2000;
  }

  .del-on {
    background: #4a3550;
  }

  .timeline {
    display: grid;
    gap: 6px;
  }
</style>
