import type { Item } from './types';

const UA = typeof navigator !== 'undefined' ? navigator.userAgent : '';
export const isAndroid = /android/i.test(UA);
export const isIOS = /iphone|ipad|ipod/i.test(UA);
export const isMobile = isAndroid || isIOS;

function igKind(kind: string): string {
  return kind === 'tv' ? 'p' : kind;
}

/** Web url for an item. */
export function webUrl(item: Item): string {
  if (item.source === 'x') return `https://x.com/i/status/${item.id}`;
  return `https://www.instagram.com/${igKind(item.kind)}/${item.id}/`;
}

/**
 * Url that opens the item in the native app where we can.
 * Android: intent:// for Instagram (opens reels reliably) and twitter:// for X.
 * iOS: twitter:// for X; Instagram universal links open the app by themselves.
 * Desktop: the web url.
 */
export function openUrl(item: Item): string {
  if (item.source === 'instagram') {
    if (isAndroid) {
      return `intent://www.instagram.com/${igKind(item.kind)}/${item.id}/#Intent;package=com.instagram.android;scheme=https;end;`;
    }
    return webUrl(item);
  }
  return isMobile ? `twitter://status?id=${item.id}` : webUrl(item);
}

/** Url for the embeddable preview. */
export function embedUrl(item: Item): string {
  if (item.source === 'x') {
    return `https://platform.twitter.com/embed/Tweet.html?id=${item.id}&theme=dark&dnt=true`;
  }
  return `https://www.instagram.com/${igKind(item.kind)}/${item.id}/embed/captioned/`;
}
