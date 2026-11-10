// يحوّل بيانات النسخة القديمة (ملف واحد) إلى ملفات بيانات مستقلة بمعرّفات ثابتة.
// يُشغَّل مرة واحدة؛ الناتج في data/ هو المصدر المعتمد بعدها.
import fs from 'node:fs';
const L = JSON.parse(fs.readFileSync(new URL('../legacy/extracted-data.json', import.meta.url)));
const out = (f, d) => fs.writeFileSync(new URL('../data/' + f, import.meta.url), JSON.stringify(d, null, 2) + '\n');

// تصحيحات عناوين موثّقة (العنوان القديم كان مفتاح بحث ويكيبيديا لا اسم العمل)
const TITLE_FIX = {
  'Supergirl: Woman of Tomorrow': 'Supergirl',
  'Batman: The Long Halloween (film)': 'Batman: The Long Halloween, Part One',
  'Justice League: Crisis on Infinite Earths': 'Justice League: Crisis on Infinite Earths – Part One',
  'Batman: The Dark Knight Returns (film)': 'Batman: The Dark Knight Returns – Part 1',
  'Batman: Knightfall': 'Batman: Knightfall – Part 1',
  'Superman (1940s cartoons)': 'Superman (Fleischer cartoons)',
};
const clean = t => (TITLE_FIX[t] ?? t.replace(/\s*\((?:\d{4}s? )?(?:film|TV series|serial)\)$/i, '')).trim();
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const KIND = { ML: ['film', 'live'], MA: ['film', 'animation'], SL: ['series', 'live'], SA: ['series', 'animation'] };

// حالة الاعتماد الرسمي للأعمال التي تظهر في عالمين (مع المصدر)
const CANON = {
  'the-suicide-squad-2021': { status: 'canon', note: 'أُنتج ضمن DCEU؛ جيمس غان صرّح (أكتوبر 2026) أنه معتمد في DCU مع استثناء صغير يخص هارلي كوين.', source: 'https://gizmodo.com/james-gunn-reveals-if-the-suicide-squad-is-canon-to-his-dc-universe-2000832570' },
  'peacemaker-2022': { status: 'mostly-canon', note: 'أُنتج ضمن DCEU؛ معتمد في DCU ما عدا ظهور فرقة العدالة في الحلقة الأخيرة.', source: 'https://nerdist.com/article/james-gunn-peacemaker-season-1-dcu-canon-not-justice-league/' },
  'blue-beetle-2023': { status: 'retro-canon', note: 'أُنتج ضمن DCEU؛ غان قال إنه «يتماشى» مع DCU مع احتمال تعديلات بسيطة.', source: 'https://www.slashfilm.com/1952273/james-gunn-confirms-blue-beetle-dcu-canon-retcons' },
};

const works = new Map(), placements = [], legacyMap = {}, counters = {};
L.RAW_WORKS.forEach((r, i) => {
  const [uni, label, rawTitle, year, type, rt, imdb, rtAud, tier, text] = r;
  const legacyId = 'w_' + (i + 1);
  let title = clean(rawTitle), season = null;
  const sm = title.match(/^(.*) - Season (\d+)$/);
  if (sm) { title = sm[1]; season = +sm[2]; }
  let id = slug(title) + '-' + year;
  if (season) id = [...works.values()].find(w => w.title === title && w.kind === 'series')?.id ?? id;
  if (!works.has(id)) {
    const [kind, medium] = KIND[type];
    works.set(id, { id, title, year, kind, medium, ids: { imdb: null, tmdb: null, tvmaze: null }, idsVerified: false,
      legacy: { wikiTitle: rawTitle, rtCritics: rt, imdb, rtAudience: rtAud, tier, ratingsVerified: false } });
  } else if (!season && works.get(id).legacy.wikiTitle !== rawTitle) throw new Error('ID collision: ' + id);
  const w = works.get(id);
  if (w.kind === 'series' && !season && Object.keys(CANON).includes(id)) season = 1;
  const [note, spoiler = ''] = text.split('||').map(s => s.trim());
  counters[uni] = (counters[uni] || 0) + 1;
  const p = { universe: uni, work: id, ...(season ? { season } : {}), position: counters[uni], label, note, ...(spoiler ? { spoiler } : {}) };
  if (uni === 'dcu' && CANON[id] && !(id === 'peacemaker-2022' && season === 2)) p.canon = CANON[id];
  placements.push(p);
  legacyMap[legacyId] = { work: id, ...(season ? { season } : {}) };
});

const universes = L.UNIVERSES.filter(u => u.id !== 'all').map(({ id, num, name, en, serial, mode, color, motif, desc }) =>
  ({ id, section: num, name, nameEn: en, serial, status: mode, color, motif, description: desc }));

const findWork = t => { const c = clean(t).replace(/ - Season \d+$/, ''); return [...works.values()].find(w => w.title === c)?.id ?? null; };
const arrowverse = L.ARROW_CHRONO.map(([stage, title, year, lead, rt, imdb, rtAud, tier, note, steps], i) => ({
  id: 'arrow-step-' + String(i + 1).padStart(2, '0'), stage, title, year, kind: /تقاطع/.test(stage) ? 'crossover' : 'phase', note,
  steps: steps.map(([order, show, what]) => ({ order: order.replace(/^[^؀-ۿ]+/, '').trim(), show, what })),
  legacy: { leadShow: lead, rtCritics: rt, imdb, rtAudience: rtAud, tier, ratingsVerified: false }, verified: false }));
const bridges = L.REBOOT_BRIDGES.map(b => ({ from: findWork(b.fromTitle), to: findWork(b.toTitle), toUniverse: b.toUni,
  label: b.label, description: b.safeDesc, spoiler: b.spoilerDesc }));

out('universes.json', universes); out('works.json', [...works.values()]); out('placements.json', placements);
out('arrowverse-order.json', arrowverse); out('bridges.json', bridges); out('legacy-id-map.json', legacyMap);
console.log(`universes ${universes.length} | works ${works.size} | placements ${placements.length} | arrow steps ${arrowverse.length} | bridges ${bridges.length}`);
