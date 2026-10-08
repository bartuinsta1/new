// Tasarım önizlemesinin ekran görüntülerini üretir: node docs/design-preview/screenshot.mjs
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const page_url = pathToFileURL(path.join(here, "preview.html")).href;
// Yerel kurulum yoksa global playwright'ı dene (bulut ortamı).
const { chromium } = await import("playwright").catch(() => import("/opt/node22/lib/node_modules/playwright/index.mjs"));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 960 }, deviceScaleFactor: 2 });
for (const screen of ["day", "night", "extras"]) {
  await page.setViewportSize({ width: screen === "extras" ? 1340 : 900, height: 960 });
  await page.goto(`${page_url}?screen=${screen}`);
  await page.waitForSelector("body[data-ready='1']");
  await page.screenshot({ path: path.join(here, `step2-${screen}.png`), fullPage: true });
  console.log(`step2-${screen}.png`);
}
await browser.close();
