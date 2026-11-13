// يفحص تجميع «خريطة العوالم» (scripts/lib-worlds.mjs) بمدخلات ثابتة تحاكي ردود Wikidata و TMDB، بلا شبكة.
// node tests/worlds.test.mjs
import { assemble, neededKeys, worldsFor } from '../scripts/lib-worlds.mjs';
const fails = [], check = (n, ok, d = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${n}${ok ? '' : ' — ' + JSON.stringify(d).slice(0, 400)}`); if (!ok) fails.push(n); };

// القائمة: الثلاثية الأولى، Searching، Wild Tales، Seven Samurai، Dune 2021، Psycho
const focus = ['m391', 'm489999', 'm265195', 'm346', 'm438631', 'm539'];
const rel = [
  { tk: 'm391', item: 'Q_FIST', prop: 'ITEM' }, { tk: 'm391', item: 'Q_FIST', prop: 'P179', o: 'Q_DOLLARS', ord: '1' }, { tk: 'm391', item: 'Q_FIST', prop: 'P179', o: 'Q_BBC' },
  { tk: 'm391', item: 'Q_FIST', prop: 'P179', o: 'Q_DISNEY' }, { tk: 'm391', item: 'Q_FIST', prop: 'P144', o: 'Q_YOJ' }, { tk: 'm391', item: 'Q_FIST', prop: 'DIR', o: 'Q_LEONE' },
  { tk: 'm489999', item: 'Q_SEARCH', prop: 'ITEM' }, { tk: 'm489999', item: 'Q_SEARCH', prop: 'P156', o: 'Q_MISSING' }, { tk: 'm489999', item: 'Q_SEARCH', prop: 'DIR', o: 'Q_ANEESH' },
  { tk: 'm265195', item: 'Q_WILD', prop: 'ITEM' }, { tk: 'm265195', item: 'Q_WILD', prop: 'P155', o: 'Q_PROB' }, { tk: 'm265195', item: 'Q_WILD', prop: 'DIR', o: 'Q_SZIF' },
  { tk: 'm346', item: 'Q_7SAM', prop: 'ITEM' }, { tk: 'm346', item: 'Q_7SAM', prop: 'P144i', o: 'Q_MAG7' }, { tk: 'm346', item: 'Q_7SAM', prop: 'P144i', o: 'Q_PORN' },
  { tk: 'm438631', item: 'Q_DUNE21', prop: 'ITEM' }, { tk: 'm438631', item: 'Q_DUNE21', prop: 'P144', o: 'Q_DUNENOVEL' }, { tk: 'm438631', item: 'Q_DUNE21', prop: 'P144', o: 'Q_2012EVENT' },
  { tk: 'm539', item: 'Q_PSYCHO', prop: 'ITEM' }, { tk: 'm539', item: 'Q_PSYCHO', prop: 'P144i', o: 'Q_BATES' }, { tk: 'm539', item: 'Q_PSYCHO', prop: 'P144', o: 'Q_PNOVEL' },
  { tk: 'm539', item: 'Q_PSYCHO', prop: 'P144i', o: 'Q_P98' } ];
const info = {
  Q_DOLLARS: { label: 'Dollars Trilogy', types: ['Q13593818'], wiki: 'https://en.wikipedia.org/wiki/Dollars_Trilogy', prev: [], next: [], dir: [] },
  Q_BBC: { label: "BBC's 100 Greatest Films of the 21st Century", types: ['Q13406463'], prev: [], next: [], dir: [] },
  Q_DISNEY: { label: 'Walt Disney Animation Studios feature film', types: ['Q56884562'], prev: [], next: [], dir: [] },
  Q_YOJ: { label: 'Yojimbo', tm: 11878, types: ['Q11424'], prev: [], next: [], dir: ['Q_KURO'] },
  Q_MISSING: { label: 'Missing', tm: 768362, types: ['Q11424'], prev: ['Q_SEARCH'], next: [], dir: ['Q_MERRICK'] },
  Q_PROB: { label: 'On Probation', tm: 78237, types: ['Q11424'], prev: [], next: ['Q_WILD'], dir: ['Q_SZIF'] },
  Q_MAG7: { label: 'The Magnificent Seven', tm: 966, types: ['Q11424'], prev: [], next: [], dir: [] },
  Q_PORN: { label: 'Seven Samurai: A XXX Parody', tm: 999999, types: ['Q11424'], prev: [], next: [], dir: [] },
  Q_DUNENOVEL: { label: 'Dune', types: ['Q8261'], date: '1965-08-01', wiki: 'https://en.wikipedia.org/wiki/Dune_(novel)', prev: [], next: [], dir: [] },
  Q_2012EVENT: { label: '2012 phenomenon', types: ['Q1190554'], prev: [], next: [], dir: [] },
  Q_BATES: { label: 'Bates Motel', tt: 46786, types: ['Q5398426'], prev: [], next: [], dir: [] },
  Q_PNOVEL: { label: 'Psycho', types: ['Q8261'], date: '1959-01-01', prev: [], next: [], dir: [] }, Q_P98: { label: 'Psycho', tm: 11252, types: ['Q11424'], prev: [], next: [], dir: [] } };
const typeNames = { Q13593818: 'film trilogy', Q13406463: 'Wikimedia list article', Q56884562: 'film series', Q11424: 'film', Q8261: 'novel', Q1190554: 'occurrence', Q5398426: 'television series' };
const mem = [
  { g: 'Q_DOLLARS', prop: 'P179', m: 'Q_FIST', tm: 391, ord: '1', date: '1964-09-12' }, { g: 'Q_DOLLARS', prop: 'P179', m: 'Q_FEW', tm: 938, ord: '2', date: '1965-12-18' },
  { g: 'Q_DOLLARS', prop: 'P179', m: 'Q_GBU', tm: 429, ord: '3', date: '1966-12-23' },
  { g: 'Q_BBC', prop: 'P179', m: 'Q_FIST', tm: 391 }, { g: 'Q_BBC', prop: 'P179', m: 'Q_X1', tm: 1 },
  ...Array.from({ length: 14 }, (_, i) => ({ g: 'Q_DISNEY', prop: 'P179', m: 'Q_D' + i, tm: 5000 + i, date: `19${50 + i}-01-01` })), { g: 'Q_DISNEY', prop: 'P179', m: 'Q_FIST', tm: 391 } ];
const adapt = [{ s: 'Q_PNOVEL', x: 'Q_P98', tm: 11252, date: '1998-12-04' }, { s: 'Q_PNOVEL', x: 'Q_PSYCHO', tm: 539, date: '1960-06-22' }, { s: 'Q_DUNENOVEL', x: 'Q_DUNE84', tm: 841, date: '1984-12-14' }, { s: 'Q_DUNENOVEL', x: 'Q_DUNE21', tm: 438631, date: '2021-09-15' }, { s: 'Q_DUNENOVEL', x: 'Q_DUNEMINI', tt: 1, date: '2000-12-03' }];
const basic = { m938: { title: 'For a Few Dollars More', date: '1965-12-18', votes: 4000 }, m429: { title: 'The Good, the Bad and the Ugly', date: '1966-12-23', votes: 9000 },
  m391: { title: 'A Fistful of Dollars', date: '1964-09-12', votes: 4500 }, m489999: { title: 'Searching', date: '2018-08-24' }, m768362: { title: 'Missing', date: '2023-01-19', votes: 1500 },
  m265195: { title: 'Wild Tales', date: '2014-08-21' }, m78237: { title: 'On Probation', date: '2005-05-12', votes: 50 }, m966: { title: 'The Magnificent Seven', date: '1960-10-12', votes: 2000 },
  m999999: { title: 'Seven Samurai: A XXX Parody', adult: true }, m841: { title: 'Dune', date: '1984-12-14', votes: 3000 }, t1: { title: 'Frank Herbert\'s Dune', date: '2000-12-03', votes: 300, tv: true },
  t46786: { title: 'Bates Motel', date: '2013-03-18', votes: 3500, tv: true }, m11878: { title: 'Yojimbo', date: '1961-04-25', votes: 1500 }, m11252: { title: 'Psycho', date: '1998-12-04', votes: 900 } };
const r = assemble({ focus, rel, info, mem, adapt, typeNames, basic });

check('ثلاثية الدولارات عالم بترتيبها في السلسلة', JSON.stringify(r.worlds.Q_DOLLARS?.order) === '["m391","m938","m429"]' && r.worlds.Q_DOLLARS.kind === 'series' && r.works.m391.worlds[0] === 'Q_DOLLARS', r.worlds.Q_DOLLARS);
check('قائمة «أفضل الأفلام» وفهرس الاستوديو لا يُعدّان عالماً', !r.worlds.Q_BBC && !r.worlds.Q_DISNEY && r.report.excludedGroups.some(g => g.g === 'Q_BBC' && g.why === 'list') && r.report.excludedGroups.some(g => g.g === 'Q_DISNEY' && g.why === 'catalog'), r.report.excludedGroups);
check('Yojimbo يظهر أصلاً لـ A Fistful of Dollars', r.works.m391.rel?.[0]?.k === 'm11878' && r.works.m391.rel[0].r === 'original', r.works.m391);
check('Searching → Missing سلسلة متتالية (مخرجان مختلفان)', JSON.stringify(r.worlds['c:m489999']?.order) === '["m489999","m768362"]' && r.works.m489999.worlds[0] === 'c:m489999', r.worlds);
check('«يليه» بين فيلمين للمخرج نفسه لا يُعدّ تكملة', !r.works.m265195?.worlds?.length && r.report.rejectedFollows.some(x => x.from === 'm265195'), r.report.rejectedFollows);
check('الريميك يظهر، وفيلم البالغين لا يظهر أبداً', r.works.m346.rel.some(x => x.k === 'm966' && x.r === 'derived') && !JSON.stringify(r).includes('m999999'), r.works.m346);
check('اقتباسات أخرى للرواية نفسها، والرواية مصدراً برابطها', r.works.m438631.rel.some(x => x.k === 'm841' && x.r === 'sibling' && x.via === 'Dune') && r.works.m438631.rel.some(x => x.k === 't1') && !r.works.m438631.rel.some(x => x.k === 'm438631')
  && r.works.m438631.src?.[0]?.kind === 'novel' && r.works.m438631.src[0].year === 1965 && r.works.m438631.src.length === 1, r.works.m438631);
check('مسلسل مقتبس عن فيلم في «أعمال مرتبطة» لا في الترتيب', r.works.m539.rel?.[0]?.k === 't46786' && !r.works.m539.worlds.length, r.works.m539);
check('ريميك مقتبس عن الفيلم وعن روايته يُوصف «اقتُبس عنه» لا «اقتباساً آخر»، والرواية مصدراً', r.works.m539.rel.find(x => x.k === 'm11252')?.r === 'derived' && r.works.m539.src?.[0]?.kind === 'novel' && r.works.m539.rel.length === 2, r.works.m539);
check('معلومات الأعمال المذكورة فقط، بلا أعمال القائمة وبلا علامة البالغين', r.info.m938 && r.info.t46786 && !r.info.m391 && !Object.values(r.info).some(x => 'adult' in x), Object.keys(r.info));
// قواعد إضافية: عمل في أربع مجموعات، وامتياز بوسم ناقص داخل سلسلة أكبر، وعضو بلا اسم في TMDB، وتكملة بعنوان مختلف البداية للمخرج نفسه
{ const rel2 = [{ tk: 'm1', item: 'Q1', prop: 'ITEM' }, ...['G_A', 'G_B', 'G_C', 'G_D'].map(g => ({ tk: 'm1', item: 'Q1', prop: 'P179', o: g })), { tk: 'm1', item: 'Q1', prop: 'P8345', o: 'G_BOND' }, { tk: 'm1', item: 'Q1', prop: 'P179', o: 'G_EON' },
    { tk: 'm9', item: 'Q9', prop: 'ITEM' }, { tk: 'm9', item: 'Q9', prop: 'P156', o: 'Q10' }, { tk: 'm9', item: 'Q9', prop: 'DIR', o: 'Q_ISAAC' },
    { tk: 'm1', item: 'Q1', prop: 'P144', o: 'Q_CHAR' }, { tk: 'm1', item: 'Q1', prop: 'P144', o: 'Q_ILIAD' }];
  const info2 = { G_A: { label: 'A', types: ['T_S'] }, G_B: { label: 'B', types: ['T_S'] }, G_C: { label: 'C', types: ['T_S'] }, G_D: { label: 'D', types: ['T_S'] }, G_EON: { label: 'Eon', types: ['T_S'] }, G_BOND: { label: 'Bond franchise', types: ['T_F'] },
    Q9: { label: 'Undisputed III: Redemption', tm: 9, next: ['Q10'], dir: ['Q_ISAAC'], prev: [] }, Q10: { label: 'Boyka: Undisputed IV', tm: 10, prev: ['Q9'], dir: ['Q_ISAAC'], next: [] },
    Q_CHAR: { label: 'Jason Bourne', types: ['T_FC', 'T_FH'] }, Q_ILIAD: { label: 'Iliad', types: ['T_LW', 'T_EP'] } };
  const M = (g, ...ks) => ks.map(k => ({ g, prop: 'P179', m: 'Q' + k.slice(1), tm: +k.slice(1) }));
  const mem2 = [...M('G_A', 'm1', 'm2'), ...M('G_B', 'm1', 'm2', 'm3'), ...M('G_C', 'm1', 'm2', 'm3', 'm4'), ...M('G_D', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6'), ...M('G_EON', 'm1', 'm20', 'm21', 'm22', 'm23'),
    ...M('G_BOND', 'm1', 'm20').map(r => ({ ...r, prop: 'P8345' })), ...M('G_A', 'm404')];
  const basic2 = Object.fromEntries(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm20', 'm21', 'm22', 'm23'].map((k, i) => [k, { title: 'Film ' + k, date: `20${10 + i}-01-01`, votes: 100 }]));
  basic2.m9 = { title: 'Undisputed III: Redemption', date: '2010-04-17', votes: 300 }; basic2.m10 = { title: 'Boyka: Undisputed IV', date: '2016-08-01', votes: 800 };
  basic2.m30 = { title: 'Fan Film', date: '2016-01-01', votes: 1 }; basic2.m31 = { title: 'Announced Sequel', date: null, votes: 0 }; mem2.push(...M('G_A', 'm30', 'm31'));
  const r2 = assemble({ focus: ['m1', 'm9'], rel: rel2, info: info2, mem: mem2, typeNames: { T_S: 'film series', T_F: 'media franchise', T_FC: 'film character', T_FH: 'fictional human', T_LW: 'literary work', T_EP: 'epic poem' }, basic: basic2 });
  check('الشخصية ليست مصدراً، والملحمة مصدر بنوعها', r2.works.m1.src?.length === 1 && r2.works.m1.src[0].label === 'Iliad' && r2.works.m1.src[0].kind === 'epic', r2.works.m1.src);
  check('عمل في أكثر من ثلاث مجموعات: كل عالم مذكور له موجود في الخريطة', r2.works.m1.worlds.length === 3 && r2.works.m1.worlds.every(id => r2.worlds[id]), { works: r2.works.m1, have: Object.keys(r2.worlds) });
  check('امتياز بوسم ناقص داخل سلسلة أكبر لا يُعرض عالماً', !r2.works.m1.worlds.includes('G_BOND') && !r2.worlds.G_BOND, r2.works.m1);
  check('عضو لا اسم له في TMDB لا يظهر، ولا فيلم صدر بلا جمهور تقريباً، والمعلن يظهر', !JSON.stringify(r2.worlds).includes('m404') && r2.worlds.G_A?.order.join() === 'm1,m2,m31', r2.worlds.G_A);
  check('تكملة بعنوان يشترك في كلمة مميزة تُقبل ولو كان المخرج نفسه', r2.worlds['c:m9']?.order.join() === 'm9,m10', { w: r2.worlds, rej: r2.report.rejectedFollows }); }
const need = neededKeys({ focus, rel, info, mem, adapt, typeNames });
check('لا تُجلب أعضاء فهرس الاستوديو ولا قوائم الأفلام من TMDB', !need.some(k => /^m50\d\d$/.test(k)) && need.includes('m938') && need.includes('m841') && !need.includes('m391'), need);

// الجلب كاملاً مع Wikidata و TMDB مُحاكيين: ترتيب الطلبات ومحتواها
const asked = [];
const fakeFetch = async (url, o) => { const q = decodeURIComponent(o.body.slice(6)); asked.push(q.split('\n')[0].slice(0, 40)); const ok = b => ({ ok: true, json: async () => ({ results: { bindings: b } }) });
  const u = v => ({ type: 'uri', value: 'http://www.wikidata.org/entity/' + v }), l = v => ({ type: 'literal', value: String(v) });
  if (o.headers['User-Agent'].indexOf('dc-guide') !== 0) throw new Error('no UA');
  if (q.includes('VALUES ?tid')) return ok([{ tid: l(391), item: u('Q101'), prop: l('ITEM') }, { tid: l(391), item: u('Q101'), prop: l('P179'), o: u('Q370180'), ord: l(1) }]);
  if (q.includes('(MIN(?d) AS ?date) (SAMPLE(?w) AS ?wiki)')) return ok([{ o: u('Q370180'), label: l('Dollars Trilogy'), types: l('Q13593818') }]);
  if (q.includes('?t rdfs:label ?l')) return ok([{ t: u('Q13593818'), l: l('film trilogy') }]);
  if (q.includes('VALUES ?g')) return ok([{ g: u('Q370180'), prop: l('P179'), m: u('Q101'), tm: l(391), ord: l(1) }, { g: u('Q370180'), prop: l('P179'), m: u('Q102'), tm: l(938), ord: l(2) }]);
  return ok([]); };
const tm = async p => { if (p === '/movie/938') return { title: 'For a Few Dollars More', release_date: '1965-12-18', vote_count: 4000, vote_average: 8, poster_path: '/f.jpg', genres: [{ id: 37 }] }; throw new Error('404'); };
const live = await worldsFor(['m391'], { tmdb: tm, opt: { fetchImpl: fakeFetch } });
check('الجلب الكامل لعمل واحد (كما في الدالة) يعيد عالمه بمعلومات أعضائه', JSON.stringify(live.worlds.Q370180?.order) === '["m391","m938"]' && live.info.m938?.poster === '/f.jpg' && asked.length >= 4, { w: live.worlds, asked });

console.log(fails.length ? `\n❌ فشل ${fails.length}` : '\n✅ كل فحوص الخريطة نجحت'); process.exit(fails.length ? 1 : 0);
