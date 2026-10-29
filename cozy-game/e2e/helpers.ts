import { chromium, devices, firefox, webkit, type Browser, type BrowserContextOptions, type Page } from 'playwright';

export const BASE = 'http://127.0.0.1:4180';
export const BROWSER = (process.env.E2E_BROWSER ?? 'chromium') as 'chromium' | 'webkit' | 'firefox';

let browser: Browser | null = null;
export async function getBrowser() {
  if (!browser) browser = await { chromium, webkit, firefox }[BROWSER].launch();
  return browser;
}
export async function closeBrowser() {
  await browser?.close();
  browser = null;
}

export interface Opened {
  page: Page;
  errors: string[];
  close: () => Promise<void>;
}

/** Yeni, temiz bir telefon sekmesi açar ve konsol hatalarını toplar. */
export async function open(opts: { path?: string; state?: unknown; ctx?: BrowserContextOptions; init?: string } = {}): Promise<Opened> {
  const b = await getBrowser();
  const iphone = { ...devices['iPhone 13'] };
  if (BROWSER === 'firefox') delete (iphone as { isMobile?: boolean }).isMobile;
  const context = await b.newContext({ ...iphone, locale: 'tr-TR', ...opts.ctx });
  if (opts.init) await context.addInitScript(opts.init);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  if (opts.state !== undefined) await seed(page, opts.state);
  await page.goto(`${BASE}/${opts.path ?? '?test=1'}`);
  await page.waitForFunction(() => !!(window as unknown as { __mh?: unknown }).__mh);
  return { page, errors, close: () => context.close() };
}

/** Oyun dışı bir sayfada (aynı köken) kayıt yazar; oyun açıkken yazılırsa üzerine kaydedilirdi. */
export async function seed(page: Page, state: unknown) {
  await page.goto(`${BASE}/privacy.html`);
  await page.evaluate((s) => localStorage.setItem('mirnav-hani-v1', JSON.stringify(s)), state);
}

export const mh = <T>(page: Page, fn: string) => page.evaluate(`(() => { const g = window.__mh; return ${fn}; })()`) as Promise<T>;

export async function tapCanvas(page: Page, pos: { x: number; y: number }) {
  const box = (await page.locator('#scene').boundingBox())!;
  await page.mouse.click(box.x + pos.x, box.y + pos.y);
}

export async function closeSheet(page: Page) {
  if (await page.locator('#sheet-wrap').isVisible()) {
    const c = page.locator('[data-close]').first();
    if (await c.count()) await c.click();
    else await page.locator('#sheet-close').click();
  }
  await page.locator('#sheet-wrap').waitFor({ state: 'hidden' });
}

export const fish = (page: Page) => mh<number>(page, 'Math.floor(g.state.fish)');

/** Testlerde ortak, kalabalık bir han. */
export function richState(extra: Record<string, unknown> = {}) {
  const today = new Date();
  const g = (room: string, slot: number, seat: number, breed: string, pref: string, i: number) =>
    ({ uid: 200 + i, breed, name: 'Test', pref, stay: 3000, remaining: 3000, room, slot, seat });
  return {
    v: 1, fish: 5000, hearts: 210, totalFish: 0, queue: [], messes: [], album: { tekir: 1 }, nextId: 500,
    catTimer: 999, messTimer: 999, lastSeen: Date.now(), lastDaily: `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`,
    cleaned: 0, served: 3, tutorial: 9, upgrades: {}, wallpapers: [], owned: [], txns: [],
    settings: { music: false, sfx: false, lang: 'tr' },
    rooms: {
      salon: { furniture: ['tree', 'fireplace', 'windowbed', 'sofa', 'lamp', 'radiator'] },
      mutfak: { furniture: ['box', 'cocoa', 'basket', 'plant', 'igloo', null] },
    },
    guests: [
      g('salon', 0, 0, 'calico', 'oyun', 0), g('salon', 0, 1, 'siyam', 'oyun', 1), g('salon', 1, 0, 'sarman', 'sicak', 2),
      g('salon', 1, 1, 'pamuk', 'sicak', 3), g('salon', 2, 0, 'kara', 'manzara', 4), g('salon', 3, 0, 'mainecoon', 'sessiz', 5),
      g('salon', 3, 1, 'tekir', 'sessiz', 6), g('salon', 5, 0, 'scottish', 'sicak', 7),
    ],
    ...extra,
  };
}
