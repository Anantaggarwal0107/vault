import { vault } from './vault.svelte';
import { mergeStates, sameState, type MarkState } from './merge';
import { DEMO_PREFIX } from './demo';

/**
 * Google Drive sync for favourites and gone marks.
 *
 * Uses the hidden app-data folder (drive.appdata): Vault can only see the one file it creates,
 * never the rest of someone's Drive, and Google treats the scope as non-sensitive.
 *
 * Sign-in uses Google's redirect flow rather than a popup, because popups are unreliable in
 * installed home-screen apps. Tokens last an hour; when one has expired, the app quietly
 * re-checks with Google (prompt=none) the next time it's opened, never in the middle of use.
 */

const CLIENT_ID = ((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '').trim();
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata email';
const FILE_NAME = 'vault_markers.json';
const API = 'https://www.googleapis.com';

const K = {
  token: 'vault.drive.token',
  account: 'vault.drive.account',
  fileId: 'vault.drive.fileId',
  lastSync: 'vault.drive.lastSync',
  silentAt: 'vault.drive.silentAt',
  needsSignIn: 'vault.drive.needsSignIn',
};
const RETURN_KEY = 'vault.drive.return';
/** Don't retry a failed quiet sign-in more often than this. */
const SILENT_RETRY_MS = 10 * 60 * 1000;

interface Token {
  value: string;
  exp: number;
}

interface ReturnInfo {
  state: string;
  hash: string;
  mode: 'connect' | 'silent';
}

class NeedsToken extends Error {}

function readJSON<T>(store: Storage, key: string): T | null {
  try {
    return JSON.parse(store.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function redirectUri(): string {
  return location.origin + location.pathname;
}

function isDemoKey(key: string): boolean {
  return key.includes(`:${DEMO_PREFIX}`);
}

/** This device's marks, minus the sample posts. */
function localState(): MarkState {
  return {
    markers: [...vault.markers.values()].filter((m) => !isDemoKey(m.key)),
    removed: [...vault.removed.entries()].filter(([k]) => !isDemoKey(k)),
  };
}

class Drive {
  readonly available = CLIENT_ID !== '';

  /** Signed-in Google account; email may be empty right after connecting. */
  account = $state<{ email: string } | null>(readJSON(localStorage, K.account));
  status = $state<'idle' | 'syncing' | 'ok' | 'error' | 'signin'>(localStorage.getItem(K.needsSignIn) ? 'signin' : 'idle');
  message = $state('');
  lastSync = $state(Number(localStorage.getItem(K.lastSync)) || 0);

  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private again = false;
  private started = false;

  get connected(): boolean {
    return this.account !== null;
  }

  private token(): string | null {
    const t = readJSON<Token>(localStorage, K.token);
    return t && t.exp > Date.now() + 60_000 ? t.value : null;
  }

  // ── sign-in ─────────────────────────────────────────

  /** Send the user to Google. `silent` only works if they've already said yes once. */
  signIn(mode: 'connect' | 'silent' = 'connect') {
    if (!this.available) return;
    const state = crypto.randomUUID();
    sessionStorage.setItem(RETURN_KEY, JSON.stringify({ state, hash: location.hash, mode } satisfies ReturnInfo));
    const p = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri(),
      response_type: 'token',
      scope: SCOPE,
      include_granted_scopes: 'true',
      state,
      prompt: mode === 'silent' ? 'none' : 'select_account',
    });
    if (this.account?.email) p.set('login_hint', this.account.email);
    if (mode === 'silent') localStorage.setItem(K.silentAt, String(Date.now()));
    location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${p}`);
  }

  /**
   * Pick up Google's answer from the URL after a sign-in redirect. Runs when this module
   * loads, before the router reads the URL, and puts back the page the user was on.
   */
  consumeRedirect() {
    const h = location.hash;
    if (!/[#&](access_token|error)=/.test(h)) return;
    const params = new URLSearchParams(h.slice(1));
    const ret = readJSON<ReturnInfo>(sessionStorage, RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    history.replaceState(null, '', location.pathname + location.search + (ret?.hash || '#/random'));
    if (!ret || params.get('state') !== ret.state) return;

    const error = params.get('error');
    if (error) {
      if (ret.mode === 'silent') {
        // Google wants the person to choose their account again.
        localStorage.setItem(K.needsSignIn, '1');
        this.status = 'signin';
      } else {
        this.message = error === 'access_denied' ? 'Google sign-in was cancelled.' : `Google sign-in didn't finish (${error}).`;
      }
      return;
    }

    const value = params.get('access_token');
    if (!value) return;
    const exp = Date.now() + Number(params.get('expires_in') || 3600) * 1000;
    localStorage.setItem(K.token, JSON.stringify({ value, exp } satisfies Token));
    localStorage.removeItem(K.needsSignIn);
    this.status = 'idle';
    if (!this.account) this.setAccount({ email: '' });
  }

  /**
   * Call before the app starts. If Drive is connected but the hour-long token has run out,
   * go and get a fresh one quietly. Returns true when the page is navigating away.
   */
  renewIfNeeded(): boolean {
    if (!this.available || !this.connected || this.token() || this.status === 'signin' || !navigator.onLine) return false;
    if (Date.now() - (Number(localStorage.getItem(K.silentAt)) || 0) < SILENT_RETRY_MS) return false;
    this.signIn('silent');
    return true;
  }

  async disconnect() {
    const t = this.token();
    if (t) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t)}`, { method: 'POST' }).catch(() => {});
    }
    for (const k of Object.values(K)) localStorage.removeItem(k);
    this.account = null;
    this.status = 'idle';
    this.message = 'Disconnected. Your favourites stay on this device.';
  }

  private setAccount(a: { email: string }) {
    this.account = a;
    localStorage.setItem(K.account, JSON.stringify(a));
  }

  // ── Drive file ──────────────────────────────────────

  private async api(url: string, init: RequestInit = {}): Promise<Response> {
    const t = this.token();
    if (!t) throw new NeedsToken();
    const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${t}` } });
    if (res.status === 401) {
      localStorage.removeItem(K.token);
      throw new NeedsToken();
    }
    if (!res.ok) throw new Error(`Google Drive answered ${res.status}.`);
    return res;
  }

  private async fileId(): Promise<string | null> {
    const cached = localStorage.getItem(K.fileId);
    if (cached) return cached;
    const q = new URLSearchParams({ spaces: 'appDataFolder', q: `name='${FILE_NAME}'`, fields: 'files(id)' });
    const res = await this.api(`${API}/drive/v3/files?${q}`);
    const id: string | undefined = (await res.json()).files?.[0]?.id;
    if (id) localStorage.setItem(K.fileId, id);
    return id ?? null;
  }

  private async read(): Promise<MarkState | null> {
    const id = await this.fileId();
    if (!id) return null;
    try {
      const doc = await (await this.api(`${API}/drive/v3/files/${id}?alt=media`)).json();
      return { markers: Array.isArray(doc.markers) ? doc.markers : [], removed: Array.isArray(doc.removed) ? doc.removed : [] };
    } catch (e) {
      // The file was deleted from Drive; forget the id and start a new one.
      if ((e as Error).message.includes('404')) {
        localStorage.removeItem(K.fileId);
        return null;
      }
      throw e;
    }
  }

  private async write(state: MarkState) {
    const body = JSON.stringify({ app: 'vault', version: 2, updatedAt: Date.now(), ...state });
    const id = await this.fileId();
    if (id) {
      await this.api(`${API}/upload/drive/v3/files/${id}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      return;
    }
    const boundary = `vault${crypto.randomUUID()}`;
    const meta = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' });
    const multipart =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
    const res = await this.api(`${API}/upload/drive/v3/files?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipart,
    });
    localStorage.setItem(K.fileId, (await res.json()).id);
  }

  // ── sync ────────────────────────────────────────────

  /** Merge this device with the Drive copy, then save the result in both places. */
  async sync(): Promise<void> {
    if (!this.connected) return;
    if (!this.token()) {
      // Picked up next time the app opens (or when the person taps Sync now).
      return;
    }
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    this.status = 'syncing';
    try {
      if (!this.account?.email) {
        const info = await (await this.api(`${API}/oauth2/v3/userinfo`)).json();
        this.setAccount({ email: info.email ?? '' });
      }
      const remote = await this.read();
      const local = localState();
      const merged = remote ? mergeStates(local, remote) : local;
      if (!sameState(merged, local)) await vault.applySynced(merged.markers, merged.removed);
      if (!remote || !sameState(merged, remote)) await this.write(merged);
      this.lastSync = Date.now();
      localStorage.setItem(K.lastSync, String(this.lastSync));
      this.status = 'ok';
      this.message = '';
    } catch (e) {
      if (e instanceof NeedsToken) {
        this.status = 'idle';
      } else {
        this.status = 'error';
        this.message = `Couldn't sync with Google Drive: ${(e as Error).message}`;
      }
    } finally {
      this.running = false;
      if (this.again) {
        this.again = false;
        void this.sync();
      }
    }
  }

  /** "Sync now" button: sync, or get a fresh sign-in first if the token ran out. */
  syncNow() {
    if (this.token()) void this.sync();
    else this.signIn(this.status === 'signin' ? 'connect' : 'silent');
  }

  /** Start syncing after the vault has loaded: once now, then shortly after every change. */
  start() {
    if (this.started || !this.available) return;
    this.started = true;
    vault.onChange(() => {
      if (!this.connected) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.sync(), 1500);
    });
    void this.sync();
  }
}

export const drive = new Drive();
drive.consumeRedirect();
