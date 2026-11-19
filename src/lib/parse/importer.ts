import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';
import type { Item, Source } from '../types';
import { InstagramHtmlReader, parseInstagramCsv, parseInstagramJson } from './instagram';
import { likesToItems, parseLikeJs } from './x';

export interface ImportResult {
  instagram: Item[] | null;
  x: Item[] | null;
  notes: string[];
}

const LIKE_FILE_RE = /(^|\/)like(?:-part(\d+))?\.js$/i;
const IG_SAVED_RE = /(^|\/)saved_posts(?:_\d+)?\.(json|html?|csv)$/i;

function likePart(name: string): number {
  const m = name.match(/like-part(\d+)/i);
  return m ? Number(m[1]) : 0;
}

/** Feed a byte stream through the HTML reader chunk by chunk, reporting progress. */
async function readHtmlStream(
  bytes: ReadableStream<Uint8Array>,
  total: number,
  onStatus?: (msg: string) => void,
): Promise<Item[]> {
  const reader = new InstagramHtmlReader();
  let seen = 0;
  let lastReport = 0;
  const counted = bytes.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctrl) {
        seen += chunk.byteLength;
        ctrl.enqueue(chunk);
      },
    }),
  );
  const text = counted.pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>).getReader();
  for (;;) {
    const { value, done } = await text.read();
    if (done) break;
    reader.push(value);
    if (onStatus && seen - lastReport > 4_000_000) {
      lastReport = seen;
      const pct = total ? ` (${Math.min(99, Math.round((seen / total) * 100))}%)` : '';
      onStatus(`Reading your saved posts… ${reader.count.toLocaleString()} so far${pct}`);
    }
  }
  return reader.finish();
}

type Kind = 'zip' | 'like' | 'ig-html' | 'ig-json' | 'ig-csv' | 'unknown';

/**
 * Work out what a file is from its contents, not its name. Phones rename downloads
 * ("like(1).js", "like.js.txt", no extension at all), so names can't be trusted.
 */
async function sniff(file: File): Promise<Kind> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (head[0] === 0x50 && head[1] === 0x4b) return 'zip';
  const text = (await file.slice(0, 4096).text()).replace(/^﻿/, '').trimStart();
  if (/^window\.YTD\.like\.part\d+/.test(text)) return 'like';
  if (/^</.test(text)) return 'ig-html';
  if (/^[[{]/.test(text)) return 'ig-json';
  if (/^"?post_url"?\s*,/i.test(text)) return 'ig-csv';
  return 'unknown';
}

/**
 * Read any mix of: Instagram export zip / saved_posts.html / .json / .csv,
 * X archive zip / like.js. Everything happens in the browser; nothing is uploaded.
 */
export async function readFiles(files: File[], onStatus?: (msg: string) => void): Promise<ImportResult> {
  const igParts: Item[][] = [];
  const likeFiles: { part: number; text: string }[] = [];
  const notes: string[] = [];

  for (const file of files) {
    onStatus?.(`Reading ${file.name}…`);
    const kind = await sniff(file);
    if (kind === 'zip') {
      const reader = new ZipReader(new BlobReader(file));
      try {
        const entries = await reader.getEntries();
        let found = 0;
        for (const entry of entries) {
          if (entry.directory || !('getData' in entry) || !entry.getData) continue;
          if (LIKE_FILE_RE.test(entry.filename)) {
            likeFiles.push({ part: likePart(entry.filename), text: await entry.getData(new TextWriter()) });
            found++;
          } else if (IG_SAVED_RE.test(entry.filename)) {
            if (/\.html?$/i.test(entry.filename)) {
              // HTML exports can be hundreds of MB: stream them instead of loading them whole.
              const pipe = new TransformStream<Uint8Array, Uint8Array>();
              const writing = entry.getData(pipe.writable);
              const items = await readHtmlStream(pipe.readable, entry.uncompressedSize, onStatus);
              await writing;
              igParts.push(items);
            } else if (/\.csv$/i.test(entry.filename)) {
              igParts.push(parseInstagramCsv(await entry.getData(new TextWriter())));
            } else {
              igParts.push(parseInstagramJson(JSON.parse(await entry.getData(new TextWriter()))));
            }
            found++;
          }
        }
        if (!found) {
          notes.push(
            `${file.name} doesn't have any saved posts or likes in it. For Instagram, make sure "Saved" was ticked when you asked for your download. For X, choose the archive zip from X's email.`,
          );
        }
      } finally {
        await reader.close();
      }
    } else if (kind === 'like') {
      likeFiles.push({ part: likePart(file.name), text: await file.text() });
    } else if (kind === 'ig-html') {
      igParts.push(await readHtmlStream(file.stream(), file.size, onStatus));
    } else if (kind === 'ig-json') {
      igParts.push(parseInstagramJson(JSON.parse(await file.text())));
    } else if (kind === 'ig-csv') {
      igParts.push(parseInstagramCsv(await file.text()));
    } else {
      notes.push(`Vault can't read ${file.name}. Choose the zip file Instagram or X emailed you.`);
    }
  }

  let instagram: Item[] | null = null;
  if (igParts.length) {
    const byKey = new Map<string, Item>();
    for (const part of igParts) for (const it of part) if (!byKey.has(it.key)) byKey.set(it.key, it);
    instagram = [...byKey.values()];
    if (!instagram.length) {
      notes.push("That Instagram file doesn't list any saved posts. Check that \"Saved\" was ticked when you asked for your download.");
    }
  }

  let x: Item[] | null = null;
  if (likeFiles.length) {
    likeFiles.sort((a, b) => a.part - b.part);
    x = likesToItems(likeFiles.flatMap((f) => parseLikeJs(f.text)));
  }

  return { instagram, x, notes };
}

export function countBySource(r: ImportResult): Partial<Record<Source, number>> {
  const out: Partial<Record<Source, number>> = {};
  if (r.instagram) out.instagram = r.instagram.length;
  if (r.x) out.x = r.x.length;
  return out;
}
