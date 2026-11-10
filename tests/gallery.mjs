// لقطات لافتتاحية كل عالم (للمراجعة البصرية فقط). node tests/gallery.mjs <مجلد> [mobile]
import { createRequire } from 'node:module'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const siteDir = path.resolve(new URL('../site', import.meta.url).pathname), out = process.argv[2], mobile = process.argv[3] === 'mobile';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = http.createServer((q, r) => { const f = path.join(siteDir, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); fs.readFile(f, (e, b) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'text/plain' }), r.end(b))); }).listen(0);
const hues = [8, 28, 205, 262, 150, 340, 45, 190];
const ph = (w, h, seed) => { const a = hues[seed % 8], b = hues[(seed * 3 + 2) % 8]; return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${a} 70% 46%)"/><stop offset=".55" stop-color="hsl(${b} 55% 22%)"/><stop offset="1" stop-color="#05070c"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><path d="M0 ${h} L${w * .2} ${h * .55} L${w * .34} ${h * .7} L${w * .52} ${h * .38} L${w * .7} ${h * .66} L${w * .86} ${h * .5} L${w} ${h * .72} V${h}z" fill="#04060b" opacity=".8"/></svg>`; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 700 } : { width: 1280, height: 640 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.route(/image\.tmdb\.org/, r => { const u = r.request().url(), seed = [...u].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7); return r.fulfill({ contentType: 'image/svg+xml', body: /\/(w300|w1280)\//.test(u) ? ph(640, 360, seed) : ph(342, 513, seed) }); });
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForSelector('.card');
for (const id of (process.argv[4] || 'reeves,dcau,arrow,harley,dcamu,burton,early_st,joker,nolan,reeve,sandman,tomorrow').split(',')) {
  await page.evaluate(i => document.querySelector(`#unibar [data-uni="${i}"]`).click(), id); await page.waitForTimeout(1500);
  await page.evaluate(() => scrollTo(0, document.querySelector('.opener').getBoundingClientRect().top + scrollY - 49));
  await page.waitForTimeout(250); await page.screenshot({ path: `${out}/g-${mobile ? 'm' : 'd'}-${id}.png` });
}
await browser.close(); server.close();
