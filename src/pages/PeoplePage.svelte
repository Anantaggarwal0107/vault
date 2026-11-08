<script lang="ts">
  import { vault, creatorCounts, hashtagCounts, mentionCounts, lowerText } from '../lib/vault.svelte';
  import { router } from '../lib/router.svelte';
  import { ui } from '../lib/ui.svelte';
  import { fmtNum } from '../lib/text';
  import type { Item } from '../lib/types';
  import ItemList from '../components/ItemList.svelte';
  import BarChart from '../components/BarChart.svelte';
  import Icon from '../components/Icon.svelte';

  let arg = $derived(router.route.arg);
  let isIG = $derived(vault.source === 'instagram');

  // ── Instagram: creators ──
  let creatorQuery = $state('');
  let creatorLimit = $state(60);
  let creators = $derived(creatorCounts(vault.items.instagram));
  let filteredCreators = $derived.by(() => {
    const q = creatorQuery.trim().toLowerCase();
    return q ? creators.filter(([n]) => n.toLowerCase().includes(q)) : creators;
  });
  let creatorPosts = $derived.by((): Item[] => {
    if (!isIG || !arg) return [];
    return vault.items.instagram.filter((i) => i.author === arg).sort((a, b) => b.savedAt - a.savedAt);
  });
  let creatorRank = $derived(arg ? creators.findIndex(([n]) => n === arg) + 1 : 0);

  function randomCreator() {
    if (!creators.length) return;
    // Weighted like the old app: pick a random post and use its creator.
    const items = vault.items.instagram.filter((i) => i.author);
    router.go('people', items[Math.floor(Math.random() * items.length)].author);
  }

  // ── X: hashtags & mentions ──
  let tab = $state<'tags' | 'mentions'>('tags');
  $effect(() => {
    if (arg.startsWith('@')) tab = 'mentions';
    else if (arg.startsWith('#')) tab = 'tags';
  });
  let topN = $state(30);
  let counts = $derived(tab === 'tags' ? hashtagCounts(vault.items.x) : mentionCounts(vault.items.x));
  let top = $derived(counts.slice(0, topN));
  let prefix = $derived(tab === 'tags' ? '#' : '@');
  let selected = $derived(arg && arg[0] === prefix ? arg.slice(1) : '');
  let tagResults = $derived.by((): Item[] => {
    if (isIG || !selected) return [];
    const needle = (prefix + selected).toLowerCase();
    const lower = lowerText(vault.items.x);
    return vault.items.x.filter((_, i) => lower[i].includes(needle));
  });

  function select(label: string) {
    const name = label.replace(/^[#@]/, '');
    ui.pages[`tag-${prefix}${name}`] = 0;
    router.go('people', selected === name ? '' : prefix + name);
  }
</script>

{#if isIG}
  {#if arg}
    <div class="stack">
      <button class="back btn ghost" onclick={() => router.go('people')}><Icon name="left" size={18} /> All creators</button>
      <header class="creator-head">
        <h1 class="handle">@{arg}</h1>
        <p class="muted">
          {fmtNum(creatorPosts.length)} saved{#if creatorRank}, your number {fmtNum(creatorRank)} most saved creator{/if}
        </p>
        <div class="row">
          <a class="btn" href="https://www.instagram.com/{encodeURIComponent(arg)}/" target="_blank" rel="noopener">
            <Icon name="open" size={18} /> Profile
          </a>
          <button class="btn" onclick={randomCreator}><Icon name="dice" size={18} /> Random creator</button>
        </div>
      </header>
      <ItemList items={creatorPosts} listId="creator-{arg}" empty="No saved posts from @{arg}." />
    </div>
  {:else}
    <div class="stack">
      <div class="title-row">
        <h1>Creators</h1>
        <button class="btn" onclick={randomCreator}><Icon name="dice" size={18} /> Random</button>
      </div>
      <input class="input" type="search" placeholder="Find a creator" bind:value={creatorQuery} aria-label="Find a creator" />
      <p class="muted small num">{fmtNum(filteredCreators.length)} creators, most saved first</p>
      {#if filteredCreators.length === 0}
        <p class="muted">No creators match “{creatorQuery}”.</p>
      {:else}
        <ol class="creators">
          {#each filteredCreators.slice(0, creatorLimit) as [name, n], i (name)}
            <li>
              <button onclick={() => router.go('people', name)}>
                <span class="rank num">{creatorQuery ? '' : i + 1}</span>
                <span class="name">@{name}</span>
                <span class="n num">{fmtNum(n)}</span>
              </button>
            </li>
          {/each}
        </ol>
        {#if filteredCreators.length > creatorLimit}
          <button class="btn ghost block" onclick={() => (creatorLimit += 100)}>Show more creators</button>
        {/if}
      {/if}
    </div>
  {/if}
{:else}
  <div class="stack">
    <h1>Hashtags and mentions</h1>
    <div class="segmented" role="tablist">
      <button role="tab" aria-selected={tab === 'tags'} onclick={() => ((tab = 'tags'), router.go('people'))}>Hashtags</button>
      <button role="tab" aria-selected={tab === 'mentions'} onclick={() => ((tab = 'mentions'), router.go('people'))}>Mentions</button>
    </div>

    {#if counts.length === 0}
      <p class="muted">No {tab === 'tags' ? 'hashtags' : '@mentions'} found in your likes.</p>
    {:else}
      <label class="field">
        Show top {topN}
        <input type="range" min="10" max="100" step="5" bind:value={topN} />
      </label>

      <div class="chips">
        {#each top as [name, n] (name)}
          <button class="chip" aria-pressed={selected === name} onclick={() => select(name)}>
            {prefix}{name} <span class="n">{fmtNum(n)}</span>
          </button>
        {/each}
      </div>

      {#if selected}
        <section class="stack picked">
          <h2>{prefix}{selected}</h2>
          <ItemList items={tagResults} listId="tag-{prefix}{selected}" noun="tweets" />
        </section>
      {/if}

      <BarChart
        title="Top {topN} {tab === 'tags' ? 'hashtags' : 'mentions'}"
        data={top.map(([label, value]) => ({ label: prefix + label, value }))}
        onSelect={select}
        unit="tweets"
      />
    {/if}
  </div>
{/if}

<style>
  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .back {
    justify-self: start;
    padding-left: 6px;
  }

  .creator-head {
    display: grid;
    gap: 8px;
  }

  .handle {
    font-size: clamp(2rem, 9vw, 3.2rem);
    font-weight: 800;
    letter-spacing: -0.04em;
    word-break: break-word;
  }

  .creators {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 1px solid var(--seam);
  }

  .creators button {
    display: grid;
    grid-template-columns: 3.2ch 1fr auto;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 52px;
    padding: 0 10px;
    border: none;
    border-bottom: 1px solid var(--seam);
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .creators button:hover {
    background: var(--dusk);
  }

  .rank {
    color: var(--faint);
    font-size: 0.85rem;
    text-align: right;
  }

  .name {
    font-family: var(--display);
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .n {
    color: var(--mist);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .picked {
    padding-top: 8px;
  }

  input[type='range'] {
    accent-color: var(--accent);
    width: 100%;
  }
</style>
