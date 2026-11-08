export type Page = 'random' | 'browse' | 'people' | 'marked' | 'stats' | 'settings' | 'import';

const PAGES: Page[] = ['random', 'browse', 'people', 'marked', 'stats', 'settings', 'import'];

export interface Route {
  page: Page;
  /** Sub-path, e.g. a creator name on the people page. */
  arg: string;
}

function parse(hash: string): Route {
  const [page, ...rest] = hash.replace(/^#\/?/, '').split('/');
  return {
    page: PAGES.includes(page as Page) ? (page as Page) : 'random',
    arg: decodeURIComponent(rest.join('/')),
  };
}

class Router {
  route = $state<Route>(parse(location.hash));

  constructor() {
    window.addEventListener('hashchange', () => {
      this.route = parse(location.hash);
      window.scrollTo({ top: 0 });
    });
  }

  go(page: Page, arg = '') {
    const hash = `#/${page}${arg ? '/' + encodeURIComponent(arg) : ''}`;
    if (location.hash === hash) return;
    location.hash = hash;
  }
}

export const router = new Router();
