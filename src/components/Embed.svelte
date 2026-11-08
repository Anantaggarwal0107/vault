<script lang="ts">
  import type { Item } from '../lib/types';
  import { embedUrl } from '../lib/links';

  let { item }: { item: Item } = $props();

  let frame: HTMLIFrameElement | undefined = $state();
  // Keyed by item so switching posts never shows the previous post's state.
  let loadedKey = $state('');
  let measured = $state<{ key: string; h: number }>({ key: '', h: 0 });
  let loaded = $derived(loadedKey === item.key);
  let height = $derived(measured.key === item.key ? measured.h : 0);

  // Instagram (via embed.js) and X post their content height to the parent page.
  $effect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frame || e.source !== frame.contentWindow) return;
      let data = e.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      const h =
        data?.type === 'MEASURE'
          ? data.details?.height
          : data?.['twttr.embed']?.method === 'twttr.private.resize'
            ? data['twttr.embed'].params?.[0]?.height
            : undefined;
      if (typeof h === 'number' && h > 50) measured = { key: item.key, h: Math.ceil(h) };
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  });

  let fallback = $derived(item.source === 'x' ? 420 : 760);
</script>

<div class="embed" class:ready={loaded}>
  {#if !loaded}<div class="placeholder muted small">Loading preview…</div>{/if}
  {#key item.key}
    <iframe
      bind:this={frame}
      src={embedUrl(item)}
      title="Preview of this post"
      style:height="{height || fallback}px"
      onload={() => (loadedKey = item.key)}
      allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
      referrerpolicy="strict-origin-when-cross-origin"
    ></iframe>
  {/key}
</div>

<style>
  .embed {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    background: var(--dusk);
    border: 1px solid var(--seam);
  }

  .embed.ready {
    background: #fff;
  }

  :global([data-source='x']) .embed.ready {
    background: transparent;
    border-color: transparent;
  }

  iframe {
    display: block;
    width: 100%;
    max-height: 80vh;
    border: 0;
    transition: height 0.2s;
    position: relative;
    z-index: 1;
  }

  .placeholder {
    position: absolute;
    z-index: 0;
    inset: 0;
    display: grid;
    place-items: center;
  }
</style>
