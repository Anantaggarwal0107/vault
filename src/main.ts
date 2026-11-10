import { mount } from 'svelte';
// Must load first: it reads Google's sign-in reply from the URL before the router does.
import { drive } from './lib/drive.svelte';
import '@fontsource-variable/bricolage-grotesque/wdth.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './app.css';
import App from './App.svelte';

// If Google Drive sync is on but its sign-in has expired, renew it before showing anything,
// so the quick hop to Google never interrupts someone mid-use.
if (!drive.renewIfNeeded()) {
  mount(App, { target: document.getElementById('app')! });
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
