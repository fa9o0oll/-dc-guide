// يجمع بيانات الكتالوج المحرَّرة يدوياً في ملف واحد للموقع (بلا شبكة).
import { rdSrc, wrOut } from './lib-guide.mjs';
const works = rdSrc('works.json').map(({ id, title, year, kind, medium, titleJa }) => ({ id, title, year, kind, medium, ...(titleJa ? { titleJa } : {}) }));
wrOut('base.json', { universes: rdSrc('universes.json'), works, placements: rdSrc('placements.json'), bridges: rdSrc('bridges.json', []), legacyMap: rdSrc('legacy-id-map.json', {}), order: rdSrc('order.json', null) });
console.log('base.json:', works.length, 'works');
