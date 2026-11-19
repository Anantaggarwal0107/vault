import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { vault } from './vault.svelte';
import { markersDoc } from './sync';
import type { Item } from './types';
import { isoDay } from './text';

/**
 * "Save a copy of everything": one small zip with the user's posts, liked tweets and
 * favourites, built on the device. Instagram's HTML export can be hundreds of MB; the same
 * posts as CSV inside a zip are a few percent of that, so this is the easy way to move a
 * vault to a phone or a new computer. Vault's importer reads it like any other export.
 */

const CSV_HEADER = 'post_url,owner_username,saved_date,caption\n';
const ROWS_PER_CHUNK = 2000;

function csvField(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Instagram posts as CSV, produced a chunk at a time so it's never all in memory at once. */
function instagramCsv(items: Item[]): ReadableStream<Uint8Array> {
  let i = 0;
  const enc = new TextEncoder();
  return new ReadableStream({
    pull(ctrl) {
      if (i === 0) ctrl.enqueue(enc.encode(CSV_HEADER));
      if (i >= items.length) {
        ctrl.close();
        return;
      }
      let out = '';
      for (const end = Math.min(items.length, i + ROWS_PER_CHUNK); i < end; i++) {
        const it = items[i];
        out += `${csvField(it.url)},${csvField(it.author)},${it.savedAt},${csvField(it.text)}\n`;
      }
      ctrl.enqueue(enc.encode(out));
    },
  });
}

/** Liked tweets in X's own like.js format, so the file also works as a plain X export. */
function likeJs(items: Item[]): ReadableStream<Uint8Array> {
  let i = 0;
  const enc = new TextEncoder();
  return new ReadableStream({
    pull(ctrl) {
      if (i === 0) ctrl.enqueue(enc.encode('window.YTD.like.part0 = ['));
      if (i >= items.length) {
        ctrl.enqueue(enc.encode('\n]\n'));
        ctrl.close();
        return;
      }
      let out = '';
      for (const end = Math.min(items.length, i + ROWS_PER_CHUNK); i < end; i++) {
        const it = items[i];
        const rec = { like: { tweetId: it.id, fullText: it.text, expandedUrl: it.url } };
        out += `${i ? ',' : ''}\n${JSON.stringify(rec)}`;
      }
      ctrl.enqueue(enc.encode(out));
    },
  });
}

export async function buildCopy(onStatus?: (msg: string) => void): Promise<Blob> {
  const zip = new ZipWriter(new BlobWriter('application/zip'), { level: 6 });
  const ig = vault.items.instagram;
  const x = vault.items.x;
  if (ig.length) {
    onStatus?.('Packing your Instagram posts…');
    await zip.add('saved_posts.csv', instagramCsv(ig));
  }
  if (x.length) {
    onStatus?.('Packing your X likes…');
    await zip.add('like.js', likeJs(x));
  }
  onStatus?.('Adding your favourites…');
  await zip.add('vault_markers.json', new TextReader(JSON.stringify(markersDoc())));
  onStatus?.('Finishing…');
  return zip.close();
}

export function copyFileName(): string {
  return `vault-copy-${isoDay(Date.now())}.zip`;
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

export function fmtMB(bytes: number): string {
  const mb = bytes / 1048576;
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}
