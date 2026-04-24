declare module 'stealthwright' {
  interface StealthwrightPage {
    goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<void>;
    content(): Promise<string>;
  }

  interface StealthwrightContext {
    newPage(): Promise<StealthwrightPage>;
  }

  interface StealthwrightBrowser {
    defaultBrowserContext(): StealthwrightContext;
    close(): Promise<void>;
  }

  interface StealthwrightBuilder {
    launch(options?: { headless?: boolean }): Promise<StealthwrightBrowser>;
  }

  export function stealthwright(): StealthwrightBuilder;
}
