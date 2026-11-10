import { isIOS } from './links';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'vault.installDismissed';

/**
 * "Add to Home Screen" help. Android/desktop Chrome give us a real install prompt;
 * iPhone doesn't, so there we show the two taps it takes in Safari.
 */
class Install {
  private deferred: BeforeInstallPromptEvent | null = null;
  canPrompt = $state(false);
  installed = $state(
    matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true,
  );
  dismissed = $state(localStorage.getItem(DISMISS_KEY) === '1');

  constructor() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferred = e as BeforeInstallPromptEvent;
      this.canPrompt = true;
    });
    window.addEventListener('appinstalled', () => {
      this.installed = true;
      this.canPrompt = false;
    });
  }

  /** iPhone/iPad Safari: no prompt API, but adding to the Home Screen is still possible. */
  get iosManual(): boolean {
    return isIOS && !this.installed;
  }

  get available(): boolean {
    return !this.installed && (this.canPrompt || this.iosManual);
  }

  async prompt() {
    if (!this.deferred) return;
    await this.deferred.prompt();
    const { outcome } = await this.deferred.userChoice;
    if (outcome === 'accepted') this.installed = true;
    this.deferred = null;
    this.canPrompt = false;
  }

  dismiss() {
    this.dismissed = true;
    localStorage.setItem(DISMISS_KEY, '1');
  }
}

export const install = new Install();
