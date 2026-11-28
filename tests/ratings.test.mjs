// يفحص بناء التقييمات الحية (E93): قراءة ملف IMDb المضغوط، وجواب OMDb، وتوزيع حصته اليومية وحفظ ما وصل.
// node tests/ratings.test.mjs
import zlib from 'node:zlib';
const { imdbRatings, omdbParse, omdbQueue, omdbFill, guideIds, IMDB_URL } = await import('../scripts/build-ratings.mjs');
let fail = 0; const check = (name, ok, info) => { console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : ' — ' + JSON.stringify(info)}`); if (!ok) fail++; };

console.log('\n== IMDb: ملفها الرسمي اليومي');
{ const tsv = 'tconst\taverageRating\tnumVotes\ntt0000001\t5.7\t2100\ntt0468569\t9.0\t3012345\ntt1877830\t7.8\t901234\ntt9999999\t0\t0\n';
  let asked = ''; const fetcher = async u => { asked = u; return new Response(zlib.gzipSync(tsv)); };
  const r = await imdbRatings(new Set(['tt0468569', 'tt1877830', 'tt9999999', 'tt7777777']), fetcher);
  check('يُقرأ من ملفاتها الرسمية مضغوطاً سطراً سطراً، ويُحتفظ بما نطلبه وحده', asked === IMDB_URL && JSON.stringify(r) === JSON.stringify({ tt0468569: [9, 3012345], tt1877830: [7.8, 901234] }), r);
  let threw = false; try { await imdbRatings(new Set(['tt1']), async () => new Response('', { status: 503 })); } catch { threw = true; }
  check('وتعذّر الملف خطأ يُبقي ما كان (لا يُمحى رقم)', threw); }

console.log('\n== OMDb: النقاد');
{ const ok = omdbParse({ Response: 'True', Ratings: [{ Source: 'Internet Movie Database', Value: '9.0/10' }, { Source: 'Rotten Tomatoes', Value: '94%' }, { Source: 'Metacritic', Value: '84/100' }], Metascore: '84' });
  check('Rotten Tomatoes بنسبته وMetacritic من 100', ok.rt === 94 && ok.mc === 84, ok);
  const tv = omdbParse({ Response: 'True', Ratings: [{ Source: 'Internet Movie Database', Value: '8.1/10' }], Metascore: 'N/A' });
  check('ومسلسل بلا نقاد فيهما: لا رقم يُخترع', tv.rt === null && tv.mc === null, tv);
  const ms = omdbParse({ Response: 'True', Ratings: [], Metascore: '71' });
  check('وMetascore وحده يكفي لـMetacritic', ms.mc === 71 && ms.rt === null, ms);
  check('وانتهاء الحصة أو خطأ المفتاح يوقف السؤال', !!omdbParse({ Response: 'False', Error: 'Request limit reached!' }).stop && !!omdbParse({ Response: 'False', Error: 'Invalid API key!' }).stop && !omdbParse({ Response: 'False', Error: 'Incorrect IMDb ID.' }).stop); }

console.log('\n== توزيع الحصة اليومية');
{ const now = Date.parse('2026-11-28T12:00:00Z'), day = 864e5, cache = { day: '2026-11-28', used: 0, items: { tt1: { at: now - 30 * day }, tt2: { at: now - 2 * day }, tt3: { at: now - 5 * day }, tt4: { at: now - 10 * day } } };
  const q = omdbQueue(['tt1', 'tt2', 'tt3', 'tt4', 'tt5'], cache, new Set(['tt3']), now);
  check('ما لم يُسأل عنه أولاً، ثم الأقدم؛ والحديث كل ثلاثة أيام وغيره كل ثلاثة أسابيع', JSON.stringify(q) === JSON.stringify(['tt5', 'tt1', 'tt3']), q);
  const many = Array.from({ length: 1200 }, (_, i) => 'tt' + (1000000 + i)); let calls = 0;
  const fetcher = async () => { calls++; return new Response(JSON.stringify({ Response: 'True', Ratings: [{ Source: 'Rotten Tomatoes', Value: '50%' }] })); };
  const c2 = { day: '2026-11-27', used: 900, items: {} }; let rep = await omdbFill(many, c2, { key: 'k', fetcher, now });
  check('يوم جديد يبدأ عدّه من الصفر، ولا يتجاوز التشغيل الواحد 500 طلب', c2.day === '2026-11-28' && rep.asked === 500 && calls === 500 && c2.used === 500 && Object.keys(c2.items).length === 500, [rep, c2.used]);
  rep = await omdbFill(many, c2, { key: 'k', fetcher, now });
  check('ولا يتجاوز اليوم 950 طلباً مهما تكرر البناء', rep.asked === 450 && c2.used === 950, [rep, c2.used]);
  rep = await omdbFill(many, c2, { key: 'k', fetcher, now }); check('وبعدها لا يُسأل شيء حتى الغد', rep.asked === 0, rep);
  const c3 = { day: '', used: 0, items: {} }; let n3 = 0;
  rep = await omdbFill(['tt1', 'tt2', 'tt3', 'tt4', 'tt5', 'tt6', 'tt7', 'tt8', 'tt9'], c3, { key: 'k', now, fetcher: async () => { n3++; return new Response(JSON.stringify(n3 > 2 ? { Response: 'False', Error: 'Request limit reached!' } : { Response: 'True', Ratings: [] })); } });
  check('وانتهاء الحصة عندهم يوقف السؤال ويُحفظ ما وصل قبله', !!rep.stop && rep.got === 2 && Object.keys(c3.items).length === 2 && n3 <= 8, [rep, n3]); }

console.log('\n== أرقام IMDb في البوابات');
{ const g = guideIds(); check('لكل دليل أرقامه من كتالوجه (DC ومارفل وFate)', g.dc.length > 150 && g.marvel.length > 150 && g.fate.length > 10 && g.dc.every(x => /^tt\d+$/.test(x)), { dc: g.dc.length, marvel: g.marvel.length, fate: g.fate.length, films: g.films.length }); }

console.log(fail ? `\n✗ ${fail} فحص فشل` : '\n✅ كل فحوص التقييمات نجحت'); process.exit(fail ? 1 : 0);
