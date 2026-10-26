// Renders the extension icons from the SVGs in this folder. Run with `pnpm icons`.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import puppeteer from 'puppeteer';

const sizes = [
  { size: 16, source: 'icon-small.svg' },
  { size: 32, source: 'icon-small.svg' },
  { size: 48, source: 'icon.svg' },
  { size: 96, source: 'icon.svg' },
  { size: 128, source: 'icon.svg' },
];

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
for (const { size, source } of sizes) {
  const svg = await readFile(join(import.meta.dirname, source), 'utf8');
  await page.setViewport({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({
    path: join(import.meta.dirname, `../public/icon/${size}.png`),
    omitBackground: true,
    clip: { x: 0, y: 0, width: size, height: size },
  });
}
await browser.close();
console.log(`Rendered ${sizes.length} icons into public/icon.`);
