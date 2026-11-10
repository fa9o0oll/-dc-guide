// يجمع بيانات الكتالوج المحرَّرة يدوياً في ملف واحد للموقع (بلا شبكة).
import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const rd = f => JSON.parse(fs.readFileSync(new URL('data/' + f, root)));
const works = rd('works.json').map(({ id, title, year, kind, medium }) => ({ id, title, year, kind, medium }));
fs.mkdirSync(new URL('site/data/', root), { recursive: true });
fs.writeFileSync(new URL('site/data/base.json', root), JSON.stringify({ universes: rd('universes.json'), works, placements: rd('placements.json'), bridges: rd('bridges.json'), legacyMap: rd('legacy-id-map.json') }) + '\n');
console.log('base.json:', works.length, 'works');
