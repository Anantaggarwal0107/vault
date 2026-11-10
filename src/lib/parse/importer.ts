import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';
import type { Item, Source } from '../types';
import { parseInstagramCsv, parseInstagramHtml, parseInstagramJson } from './instagram';
import { likesToItems, parseLikeJs } from './x';

export interface ImportResult {
  instagram: Item[] | null;
  x: Item[] | null;
  notes: string[];
}

const LIKE_FILE_RE = /(^|\/)like(?:-part(\d+))?\.js$/i;
const IG_SAVED_RE = /(^|\/)saved_posts(?:_\d+)?\.(json|html?)$/i;

function likePart(name: string): number {
  const m = name.match(/like-part(\d+)/i);
  return m ? Number(m[1]) : 0;
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
            const text = await entry.getData(new TextWriter());
            igParts.push(/\.html?$/i.test(entry.filename) ? parseInstagramHtml(text) : parseInstagramJson(JSON.parse(text)));
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
      igParts.push(parseInstagramHtml(await file.text()));
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
