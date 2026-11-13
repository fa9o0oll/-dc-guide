// يفحص «محرّك ترتيب الأحداث» (scripts/lib-chrono.mjs) بجمل حقيقية من مقدمات Wikipedia، بلا شبكة.
// node tests/chrono.test.mjs
import { parseSentence, resolvePhrase, chronoOrder, sentences, kwSignals, gatherEvidence } from '../scripts/lib-chrono.mjs';
const fails = [], check = (n, ok, d = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${n}${ok ? '' : ' — ' + JSON.stringify(d).slice(0, 500)}`); if (!ok) fails.push(n); };
const M = (k, title, date) => ({ k, title, date, year: +date.slice(0, 4) });
const W = s => ({ sents: sentences(s), wiki: 'https://en.wikipedia.org/wiki/X' });
const titles = (r, ms) => r.order.map(k => ms.find(m => m.k === k).title);

// ربط العبارات
const SW = [M('m11', 'Star Wars', '1977-05-25'), M('m1891', 'The Empire Strikes Back', '1980-05-20'), M('m330459', 'Rogue One: A Star Wars Story', '2016-12-14'), M('m348350', 'Solo: A Star Wars Story', '2018-05-23')];
check('«the first Star Wars film (1977)» هو Star Wars', resolvePhrase('the first Star Wars film (1977).', SW, 'm348350').join() === 'm11');
const KM = [M('m207703', 'Kingsman: The Secret Service', '2014-12-13'), M('m343668', 'Kingsman: The Golden Circle', '2017-09-20'), M('m476669', "The King's Man", '2021-12-22')];
check('عنوانان بنقطتين و«and» بينهما', resolvePhrase('Kingsman: The Secret Service (2014) and Kingsman: The Golden Circle (2017).', KM, 'm476669').join() === 'm207703,m343668');
const XM = [M('m36657', 'X-Men', '2000-07-13'), M('m36658', 'X2', '2003-04-24'), M('m49538', 'X-Men: First Class', '2011-05-24')];
check('الهدف وحده دون الجملة الوصفية بعده', resolvePhrase('X-Men (2000), the fifth installment in the X-Men film series, and the first film in the X-Men prequel quadrilogy.', XM, 'm49538').join() === 'm36657');
const AN = [M('m250546', 'Annabelle', '2014-10-02'), M('m396422', 'Annabelle: Creation', '2017-08-03'), M('m521029', 'Annabelle Comes Home', '2019-06-26')];
check('«2014\'s Annabelle»', resolvePhrase("2014's Annabelle and the fourth installment in The Conjuring Universe franchise.", AN, 'm396422').join() === 'm250546');
check('جملة «A sequel, X, was released» لا تُعدّ دليلاً', parseSentence('A sequel, Annabelle Comes Home, was released on June 26, 2019.').length === 0);
check('«set to be released» ليس زمن القصة', !parseSentence('A sequel, Sunrise on the Reaping, is set to be released on November 20, 2026.').some(x => x.t === 'year'));
check('حقبة بالاسم: الحرب العالمية الأولى', parseSentence('It focuses on several events during World War I and the birth of the Kingsman organisation.')[0]?.y === 1914);
check('كلمات TMDB: prequel والحقبة', (k => k.prequel && k.year === 1980)(kwSignals(['prequel', '1980s', 'robot'])));

// Predator: Prey جزء سابق لـ Predator (1987) وزمنه 1719
const PR = [M('m106', 'Predator', '1987-06-12'), M('m169', 'Predator 2', '1990-11-21'), M('m34851', 'Predators', '2010-07-07'), M('m346910', 'The Predator', '2018-09-05'), M('m766507', 'Prey', '2022-08-05'), M('m1242898', 'Predator: Badlands', '2025-11-05')];
let r = chronoOrder(PR, { m766507: { ...W('It is the fifth installment in the Predator franchise and a prequel to Predator (1987), set in the Northern Great Plains in 1719.'), kw: ['prequel', '18th century'] },
  m169: W('Predator 2 is a 1990 American science fiction action film. It is a sequel to Predator (1987).') });
check('Prey أولاً بدليل من Wikipedia وTMDB وزمنه 1719، والباقي بترتيب صدوره', r.order[0] === 'm766507' && r.order.slice(1).join() === 'm106,m169,m34851,m346910,m1242898'
  && r.moved.m766507?.w === 'prequel' && r.moved.m766507.ref.join() === 'm106' && r.moved.m766507.y === 1719 && r.moved.m766507.src.includes('wikipedia') && r.moved.m766507.src.includes('tmdb') && Object.keys(r.moved).length === 1, r);

// The First Purge: «prequel to The Purge film series»
const PU = [M('m158015', 'The Purge', '2013-05-31'), M('m238636', 'The Purge: Anarchy', '2014-07-17'), M('m316727', 'The Purge: Election Year', '2016-06-29'), M('m442249', 'The First Purge', '2018-07-04'), M('m602223', 'The Forever Purge', '2021-06-30')];
r = chronoOrder(PU, { m442249: W('The First Purge is a 2018 American dystopian action horror film serving as a prequel to The Purge film series and the fourth installment overall.') });
check('The First Purge قبل السلسلة كلها', r.order.join() === 'm442249,m158015,m238636,m316727,m602223' && r.moved.m442249.ref.length === 4, r);

// Saw X بين الأول والثاني
const SA = [M('m176', 'Saw', '2004-10-01'), M('m215', 'Saw II', '2005-10-28'), M('m214', 'Saw III', '2006-10-26'), M('m951491', 'Saw X', '2023-09-27')];
r = chronoOrder(SA, { m951491: W('It is the tenth installment in the Saw film series, following Spiral (2021). Set between the events of Saw (2004) and Saw II (2005), the film follows John Kramer.') });
check('Saw X بين Saw وSaw II', titles(r, SA).join() === 'Saw,Saw X,Saw II,Saw III' && r.moved.m951491?.w === 'between', r);

// Star Wars: Solo قبل Star Wars بعشر سنوات، وRogue One قبله بأسبوع
r = chronoOrder(SW, { m330459: W('Produced by Lucasfilm, it is the first Star Wars anthology film and a prequel to Star Wars (1977). Set a week before the events of Star Wars, the film follows rebels.'),
  m348350: W('It is the second Star Wars anthology film, following Rogue One (2016). The film is set ten years prior to the events of the first Star Wars film (1977).') });
check('Solo ثم Rogue One ثم Star Wars بالمسافة الزمنية', titles(r, SW).join() === 'Solo: A Star Wars Story,Rogue One: A Star Wars Story,Star Wars,The Empire Strikes Back', r);

// Fantastic Beasts: الأول جزء سابق لأفلام Harry Potter، وتكملتاه تبقيان قبلها
const HP = [M('m671', "Harry Potter and the Philosopher's Stone", '2001-11-16'), M('m672', 'Harry Potter and the Chamber of Secrets', '2002-11-13'), M('m259316', 'Fantastic Beasts and Where to Find Them', '2016-11-16'),
  M('m338952', 'Fantastic Beasts: The Crimes of Grindelwald', '2018-11-14'), M('m338953', 'Fantastic Beasts: The Secrets of Dumbledore', '2022-04-06')];
r = chronoOrder(HP, { m259316: W('It is the first instalment in the Fantastic Beasts film series and the ninth overall in the Wizarding World franchise, serving as a spin-off of and prequel to the Harry Potter film series.'),
  m338952: W('It is the sequel to Fantastic Beasts and Where to Find Them (2016).'), m338953: W('It is the sequel to Fantastic Beasts: The Crimes of Grindelwald (2018).') });
check('Fantastic Beasts الثلاثة قبل Harry Potter، والثاني بدليل أنه تكملة لجزء سابق', r.order.join() === 'm259316,m338952,m338953,m671,m672' && r.moved.m338952?.via === 'm259316', r);

// Fear Street: ثلاثة أزمنة مكتوبة
const FS = [M('m591273', 'Fear Street: 1994', '2021-07-02'), M('m591274', 'Fear Street: 1978', '2021-07-09'), M('m591275', 'Fear Street: 1666', '2021-07-16')];
r = chronoOrder(FS, { m591273: W('Set in 1994, the film follows a group of teenagers.'), m591274: W('Set in 1978 at Camp Nightwing, the film follows two sisters.'), m591275: W('The film is set in 1666 and 1994.') });
check('Fear Street بأزمنتها: 1666 ثم 1978 ثم 1994', titles(r, FS).join() === 'Fear Street: 1666,Fear Street: 1978,Fear Street: 1994' && r.moved.m591275.w === 'year', r);

// Bumblebee: موسوم prequel في TMDB وزمنه 1987، فيسبق أفلام باي، وتكملته Rise of the Beasts (1994) بعده وقبلها
const TF = [M('m1858', 'Transformers', '2007-06-27'), M('m8373', 'Transformers: Revenge of the Fallen', '2009-06-19'), M('m424783', 'Bumblebee', '2018-12-15'), M('m667538', 'Transformers: Rise of the Beasts', '2023-06-06')];
r = chronoOrder(TF, { m424783: { ...W('Set in 1987, the film follows Bumblebee being sent to Earth.'), kw: ['prequel', '1980s'] }, m667538: W('Set in 1994, the film is a sequel to Bumblebee (2018).') });
check('Bumblebee ثم Rise of the Beasts ثم أفلام باي', titles(r, TF).join() === 'Bumblebee,Transformers: Rise of the Beasts,Transformers,Transformers: Revenge of the Fallen', r);

// Insidious: الثالث جزء سابق، والرابع تكملته وقبل الأول أيضاً، والخامس تكملة للثاني
const IN = [M('m49018', 'Insidious', '2011-03-31'), M('m91586', 'Insidious: Chapter 2', '2013-09-12'), M('m280092', 'Insidious: Chapter 3', '2015-06-04'), M('m406563', 'Insidious: The Last Key', '2018-01-03'), M('m614479', 'Insidious: The Red Door', '2023-07-05')];
r = chronoOrder(IN, { m280092: W('The film is a prequel to Insidious (2011) and the third installment in the Insidious franchise.'), m406563: W('It is a sequel to Insidious: Chapter 3 (2015).'), m614479: W('It is a sequel to Insidious: Chapter 2 (2013).') });
check('Insidious: الثالث والرابع ثم الأول والثاني والخامس', titles(r, IN).join() === 'Insidious: Chapter 3,Insidious: The Last Key,Insidious,Insidious: Chapter 2,Insidious: The Red Door', r);

// Mufasa: «prequel and sequel to The Lion King (2019)»
const LK = [M('m8587', 'The Lion King', '1994-06-15'), M('m420818', 'The Lion King', '2019-07-12'), M('m762509', 'Mufasa: The Lion King', '2024-12-18')];
r = chronoOrder(LK, { m762509: W('The photorealistically animated film serves as a prequel and sequel to The Lion King (2019), which itself is a remake of the 1994 animated film.') });
check('Mufasa قبل The Lion King (2019) تحديداً، بالسنة لا بالعنوان وحده', r.order.indexOf('m762509') < r.order.indexOf('m420818') && r.moved.m762509?.ref.join() === 'm420818', r);

// ما لا يجوز أن يتحرك
const TW = [M('m664', 'Twister', '1996-05-10'), M('m718821', 'Twisters', '2024-07-10')];
r = chronoOrder(TW, { m718821: W('A standalone sequel to Twister (1996), the ensemble cast includes Daisy Edgar-Jones.') });
check('التكملة المستقلة تبقى بعد الأصل', r.order.join() === 'm664,m718821' && !Object.keys(r.moved).length, r);
const GL = [M('m98', 'Gladiator', '2000-05-01'), M('m558449', 'Gladiator II', '2024-11-05')];
r = chronoOrder(GL, { m558449: W('Set in 211 AD, sixteen years after the events of Gladiator (2000), the film follows Lucius.') });
check('زمن تاريخي لتكملة بلا وسم prequel لا يقدّمها على أصلها', r.order.join() === 'm98,m558449' && !Object.keys(r.moved).length, r);
const BO = [M('m646', 'Dr. No', '1962-10-07'), M('m657', 'From Russia with Love', '1963-10-10'), M('m658', 'Goldfinger', '1964-09-20')];
r = chronoOrder(BO, {});
check('بلا أدلة: ترتيب الصدور كما هو', r.order.join() === 'm646,m657,m658' && !Object.keys(r.moved).length);
r = chronoOrder(TW, { m664: W('It is a prequel to Twisters (2024).'), m718821: W('It is a prequel to Twister (1996).') });
check('دليلان متناقضان: يعود الترتيب إلى الصدور', r.order.join() === 'm664,m718821');

// الجلب: Wikidata ثم Wikipedia ثم TMDB، مع ذاكرة سابقة
const asked = [];
const fakeFetch = async (url, o) => { asked.push(String(url).slice(0, 40));
  if (String(url).includes('wikidata')) return { ok: true, json: async () => ({ results: { bindings: [{ tid: { type: 'literal', value: '766507' }, item: { type: 'uri', value: 'http://www.wikidata.org/entity/Q1' }, wiki: { type: 'uri', value: 'https://en.wikipedia.org/wiki/Prey_(2022_film)' }, py: { type: 'literal', value: '1719' }, pl: { type: 'literal', value: '1719' } }] } }) };
  if (String(url).includes('en.wikipedia.org/w/api.php')) { if (o.headers['User-Agent'].indexOf('dc-guide') !== 0) throw new Error('UA');
    return { ok: true, json: async () => ({ query: { normalized: [{ from: 'Prey_(2022_film)', to: 'Prey (2022 film)' }], pages: [{ title: 'Prey (2022 film)', extract: 'Prey is a 2022 American film. It is the fifth installment in the Predator franchise and a prequel to Predator (1987), set in the Northern Great Plains in 1719.' }] } }) }; }
  throw new Error('unexpected ' + url); };
const ev = await gatherEvidence(['m766507', 'm106'], { tmdb: async p => { if (p === '/movie/766507/keywords') return { keywords: [{ name: 'Prequel' }, { name: 'comanche' }] }; return { keywords: [] }; },
  cache: { m106: { sents: [], kw: [] } }, opt: { fetchImpl: fakeFetch }, fetchImpl: fakeFetch });
check('الأدلة: جملة Wikipedia وكلمة TMDB وزمن Wikidata، والمحفوظ لا يُجلب ثانية', ev.m766507?.sents?.[0]?.includes('prequel to Predator (1987)') && ev.m766507.kw?.join() === 'prequel' && ev.m766507.period === 1719 && ev.m106 && asked.length === 2, { ev, asked });

// تعذّر Wikipedia لعمل وTMDB لآخر: يُعلَّم الناقص فلا يُحفظ ولا يُدّعى أنه فُحص، وما وصل كاملاً بلا علامة
const badFetch = async url => { if (String(url).includes('wikidata')) return { ok: true, json: async () => ({ results: { bindings: [{ tid: { type: 'literal', value: '1' }, item: { type: 'uri', value: 'http://www.wikidata.org/entity/Q9' }, wiki: { type: 'uri', value: 'https://en.wikipedia.org/wiki/A' } }] } }) };
  return { ok: false, status: 403, json: async () => ({}) }; };
const ev2 = await gatherEvidence(['m1', 'm2', 'm3'], { tmdb: async p => { if (p.includes('/3/')) throw new Error('down'); return { keywords: [] }; }, opt: { fetchImpl: badFetch, tries: 1 }, fetchImpl: badFetch });
check('مصدر متعذّر يُعلَّم (miss) والكامل بلا علامة', ev2.m1?.miss?.join() === 'wikipedia' && !ev2.m2?.miss && ev2.m3?.miss?.join() === 'tmdb', ev2);
const ev3 = await gatherEvidence(['m1'], { tmdb: async () => ({ keywords: [] }), opt: { fetchImpl: async () => { throw new Error('offline'); }, tries: 1 }, fetchImpl: async () => { throw new Error('offline'); } });
check('Wikidata متعذّر: Wikidata وWikipedia ناقصان', ev3.m1?.miss?.join() === 'wikidata,wikipedia', ev3);

console.log(fails.length ? `\n❌ فشل ${fails.length}` : '\n✅ كل فحوص محرّك الأحداث نجحت'); process.exit(fails.length ? 1 : 0);
