import { chromium } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMG = path.resolve(__dirname, "../../../images");
const BASE = "http://127.0.0.1:3077";
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];
const pages = [
  { route: "/shell", prefix: "h4-phase-d-shell" },
  { route: "/login", prefix: "h8-login" },
  { route: "/shelf-inventory", prefix: "h9-shelf-inventory" },
  { route: "/expiry-alerts-fefo", prefix: "h10-expiry-alerts-fefo" },
  { route: "/auto-reorder-suggestions", prefix: "h11-auto-reorder" },
  { route: "/audit-log", prefix: "h12-audit-log" },
  { route: "/drug-details-cardex?drugId=d-001", prefix: "h13-drug-details" },
  { route: "/dashboard", prefix: "h14-dashboard" },
  { route: "/shell", prefix: "h15-floating-shell" },
];

const browser = await chromium.launch();
for (const p of pages) {
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      locale: "fa-IR",
    });
    const page = await context.newPage();
    await page.goto(`${BASE}${p.route}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForTimeout(800);
    const out = path.join(IMG, `${p.prefix}-${vp.name}.png`);
    await page.screenshot({ path: out, fullPage: false });
    console.log("saved", out);
    await context.close();
  }
}
await browser.close();
console.log("done");
