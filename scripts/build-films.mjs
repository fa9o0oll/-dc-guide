// يبني بيانات «قائمة أفلامي»: يقرأ data/films/list.txt (القائمة المنظَّفة) و data/films/added.json (ما أُضيف بزر «أضف فيلم»)،
// يطابق كل سطر في TMDB، يسحب تفاصيل كل فيلم (بوستر، تقييم، أين يُعرض في السعودية) وأجزاء سلسلته، ويكتب site/films/data/.
// التثبيت اليدوي في data/films/pins.json يتقدم على المطابقة الآلية. ما لا يتطابق بثقة يُكتب في تقرير ولا يُخمَّن بصمت.
import fs from 'node:fs';
import { tmdb, hasKey } from './lib-tmdb.mjs';
import { search, shape, shapeCollection, detailPath, detailParams, COUNTRY } from './lib-films.mjs';
if (!hasKey()) { console.error('missing TMDB_API_KEY'); process.exit(1); }
const root = new URL('../', import.meta.url), SRC = new URL('data/films/', root), OUT = new URL('site/films/data/', root), GEN = new URL('data/generated/films/', root);
const rd = (u, fb) => fs.existsSync(u) ? JSON.parse(fs.readFileSync(u)) : fb;
for (const d of [OUT, GEN]) fs.mkdirSync(d, { recursive: true });

const lines = fs.readFileSync(new URL('list.txt', SRC), 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => {
  const [title, year, type = '', note = ''] = l.split('|').map(x => x.trim()); return { key: `${title} | ${year}${type === 'tv' ? ' | tv' : ''}`, title, year: +year || null, type, note: note.replace(/^؟\s*/, ''), ask: note.startsWith('؟') }; });
const pins = rd(new URL('pins.json', SRC), {}), added = rd(new URL('added.json', SRC), []), removed = new Set(rd(new URL('removed.json', SRC), []));
const prevResolved = rd(new URL('resolved.json', GEN), {}), resolved = {}, report = { guesses: [], missing: [], ask: [], seriesWithoutCollection: [] };

// 1) مطابقة كل سطر: تثبيت يدوي ← مطابقة سابقة واثقة ← بحث
const brief = c => ({ id: c.id, title: c.title || c.name, date: c.release_date || c.first_air_date || null, votes: c.vote_count });
await Promise.all(lines.map(async l => {
  const kind = l.type === 'tv' ? 'tv' : 'movie';
  if (pins[l.key]) return void (resolved[l.key] = { id: pins[l.key], kind, how: 'pin' });
  if (prevResolved[l.key]?.how === 'sure') return void (resolved[l.key] = prevResolved[l.key]);
  const r = await search(tmdb, kind, l.title, l.year);
  if (!r.top) return void report.missing.push(l.key);
  resolved[l.key] = { id: r.top.id, kind, how: r.sure ? 'sure' : 'guess' };
  if (!r.sure) report.guesses.push({ line: l.key, chosen: brief(r.top), others: r.scored.slice(1, 4).map(x => brief(x.c)) });
}));

// 2) تفاصيل الأعمال، ثم السلاسل، ثم بقية أجزاء السلاسل المطلوبة كاملة
const providers = {}, films = new Map(), collections = {};
const load = async (kind, id, meta) => { const fid = (kind === 'tv' ? 't' : 'm') + id; if (films.has(fid)) { Object.assign(films.get(fid), { ...meta, ...films.get(fid) }); return films.get(fid); }
  const slot = {}; films.set(fid, slot);
  try { Object.assign(slot, shape(kind, await tmdb(detailPath(kind, id), detailParams(kind)), providers), meta); } catch (e) { films.delete(fid); report.missing.push(`${kind} ${id}: ${e.message}`); return null; }
  return slot; };
await Promise.all(lines.map(l => resolved[l.key] && load(resolved[l.key].kind, resolved[l.key].id, { src: 'list', ...(l.ask ? { ask: l.note } : {}), ...(resolved[l.key].how === 'guess' ? { unsure: true } : {}) })));
await Promise.all(added.map(a => load(a.kind === 'tv' ? 'tv' : 'movie', a.tmdb, { src: 'added', addedAt: a.at || null })));
const loadCol = async id => { if (collections[id]) return collections[id]; return collections[id] = tmdb('/collection/' + id, { language: 'en-US' }).then(shapeCollection).catch(() => null); };
await Promise.all([...films.values()].filter(f => f.col).map(f => loadCol(f.col)));
for (const id of Object.keys(collections)) { collections[id] = await collections[id]; if (!collections[id]) delete collections[id]; }
for (const l of lines.filter(l => l.type === 'series')) { const f = resolved[l.key] && films.get('m' + resolved[l.key].id), c = f?.col && collections[f.col];
  if (!c) { report.seriesWithoutCollection.push(l.key); continue; }
  await Promise.all(c.parts.map(p => load('movie', p.tmdb, { src: 'list', via: l.key }))); }
for (const l of lines.filter(l => l.ask)) report.ask.push({ line: l.key, note: l.note });

// 3) ترجماتنا العربية للنبذات تتقدم على ترجمة TMDB
const tr = rd(new URL('translations.json', SRC), {});
const list = [...films.values()].filter(f => f.id && !removed.has(f.id));
for (const f of list) if (tr[f.id]) { f.overviewAr = tr[f.id]; f.arSource = 'guide'; }
list.sort((a, b) => a.title.localeCompare(b.title, 'en'));

// 4) الكتابة: films.json للبطاقات، more.json للتفاصيل التي تُحمَّل عند الحاجة
const heavy = ['overviewEn', 'overviewAr', 'cast', 'backdrop', 'countries', 'arSource'];
const light = list.map(f => Object.fromEntries(Object.entries(f).filter(([k]) => !heavy.includes(k))));
const more = Object.fromEntries(list.map(f => [f.id, Object.fromEntries(heavy.filter(k => f[k] !== undefined).map(k => [k, f[k]]))]));
const inList = new Set(list.filter(f => f.kind === 'movie').map(f => f.tmdb));
const usedCols = Object.fromEntries(Object.values(collections).filter(c => c.parts.some(p => inList.has(p.tmdb))).map(c => [c.id, c]));
const write = (u, d) => fs.writeFileSync(u, JSON.stringify(d) + '\n');
write(new URL('films.json', OUT), { generatedAt: new Date().toISOString(), country: COUNTRY, imageBase: 'https://image.tmdb.org/t/p/', films: light });
write(new URL('more.json', OUT), more);
write(new URL('collections.json', OUT), usedCols);
write(new URL('providers.json', OUT), providers);
if (fs.existsSync(new URL('franchises.json', SRC))) fs.copyFileSync(new URL('franchises.json', SRC), new URL('franchises.json', OUT)); else write(new URL('franchises.json', OUT), {});
fs.writeFileSync(new URL('resolved.json', GEN), JSON.stringify(resolved, null, 1) + '\n');
report.counts = { lines: lines.length, films: list.filter(f => f.kind === 'movie').length, tv: list.filter(f => f.kind === 'tv').length, added: list.filter(f => f.src === 'added').length,
  collections: Object.keys(usedCols).length, withProviders: list.filter(f => f.prov && (f.prov.stream.length || f.prov.free.length || f.prov.rent.length || f.prov.buy.length)).length,
  arabicOverviews: list.filter(f => f.overviewAr).length, ourArabic: list.filter(f => f.arSource === 'guide').length, noPoster: list.filter(f => !f.poster).length };
fs.writeFileSync(new URL('report.json', GEN), JSON.stringify(report, null, 1) + '\n');
console.log('FILMS counts ' + JSON.stringify(report.counts));
for (const g of report.guesses) console.log('FILMS guess ' + JSON.stringify(g));
for (const m of report.missing) console.log('FILMS missing ' + m);
for (const m of report.seriesWithoutCollection) console.log('FILMS series-without-collection ' + m);
