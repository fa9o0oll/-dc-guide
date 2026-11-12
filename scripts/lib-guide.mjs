// مسارات كل دليل: المصدر المحرَّر يدوياً، ناتج الموقع، والتقارير المولَّدة. الدليل يُمرَّر كأول معامل (الافتراضي dc).
import fs from 'node:fs';
export const guide = process.argv[2] || 'dc';
export const root = new URL('../', import.meta.url);
export const SRC = new URL(guide === 'dc' ? 'data/' : `data/${guide}/`, root);
export const OUT = new URL(`site/${guide}/data/`, root);
export const GEN = new URL(guide === 'dc' ? 'data/generated/' : `data/generated/${guide}/`, root);
export const has = f => fs.existsSync(new URL(f, SRC));
export const rdSrc = (f, fallback) => has(f) ? JSON.parse(fs.readFileSync(new URL(f, SRC))) : fallback;
export const rdOut = f => JSON.parse(fs.readFileSync(new URL(f, OUT)));
export const wrOut = (f, d) => { fs.mkdirSync(new URL('./', new URL(f, OUT)), { recursive: true }); fs.writeFileSync(new URL(f, OUT), JSON.stringify(d) + '\n'); };
export const wrGen = (f, d) => { fs.mkdirSync(GEN, { recursive: true }); fs.writeFileSync(new URL(f, GEN), JSON.stringify(d, null, 1) + '\n'); };
