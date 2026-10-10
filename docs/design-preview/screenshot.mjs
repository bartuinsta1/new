// Tasarım önizlemesinin ekran görüntülerini üretir: node docs/design-preview/screenshot.mjs
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const page_url = pathToFileURL(path.join(here, "preview.html")).href;
// Yerel kurulum yoksa global playwright'ı dene (bulut ortamı).
const { chromium } = await import("playwright").catch(() => import("/opt/node22/lib/node_modules/playwright/index.mjs"));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 960 }, deviceScaleFactor: 2 });
const widths = { day: 900, night: 900, extras: 1340, map: 1760, onboarding: 1760 };
const stepOf = { map: "step3", onboarding: "step4" };
for (const screen of Object.keys(widths)) {
  await page.setViewportSize({ width: widths[screen], height: 960 });
  await page.goto(`${page_url}?screen=${screen}`);
  await page.waitForSelector("body[data-ready='1']");
  await page.screenshot({ path: path.join(here, `${stepOf[screen] ?? "step2"}-${screen}.png`), fullPage: true });
  console.log(`${stepOf[screen] ?? "step2"}-${screen}.png`);
}
await browser.close();
