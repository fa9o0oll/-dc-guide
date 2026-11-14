// فحوص البحث المتسامح (site/find.js): الاسم الناقص، والإملاء الخاطئ، والكتابة بالحروف العربية، و«هل تقصد…؟».
// تشغيل: node tests/find.test.mjs
import { prepare, find, fold } from '../site/find.js';
let fail = 0; const check = (name, ok, info) => { console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : ' — ' + JSON.stringify(info)}`); if (!ok) fail++; };
const items = [
  { id: 245891, names: ['John Wick', 'جون ويك'], y: 2014, v: 90 }, { id: 324552, names: ['John Wick: Chapter 2'], y: 2017, v: 85 },
  { id: 157336, names: ['Interstellar', 'بين النجوم'], y: 2014, v: 95 }, { id: 414906, names: ['The Batman', 'ذا باتمان'], y: 2022, v: 88 },
  { id: 268, names: ['Batman'], y: 1989, v: 80 }, { id: 155, names: ['The Dark Knight', 'فارس الظلام'], y: 2008, v: 96 },
  { id: 278, names: ['The Shawshank Redemption', 'الخلاص من شاوشانك'], y: 1994, v: 96 }, { id: 24428, names: ['The Avengers', 'المنتقمون'], y: 2012, v: 94 },
  { id: 475557, names: ['Joker', 'جوكر'], y: 2019, v: 93 }, { id: 872585, names: ['Oppenheimer'], y: 2023, v: 88 }, { id: 557, names: ['Spider-Man'], y: 2002, v: 85 },
  { id: 27205, names: ['Inception', 'استهلال'], y: 2010, v: 96 }, { id: 1399, names: ['Game of Thrones', 'صراع العروش'], y: 2011, v: 95 },
  { id: 98, names: ['Gladiator', 'المصارع'], y: 2000, v: 90 }, { id: 438631, names: ['Dune', 'كثيب'], y: 2021, v: 89 }, { id: 335984, names: ['Blade Runner 2049'], y: 2017, v: 88 },
  { id: 1396, names: ['Breaking Bad', 'بريكنج باد'], y: 2008, v: 95 }, { id: 550, names: ['Fight Club', 'نادي القتال'], y: 1999, v: 95 }, { id: 1726, names: ['Iron Man', 'الرجل الحديدي'], y: 2008, v: 92 },
  { id: 120, names: ['The Lord of the Rings: The Fellowship of the Ring'], y: 2001, v: 95 }, { id: 13, names: ['Forrest Gump'], y: 1994, v: 95 }, { id: 680, names: ['Pulp Fiction'], y: 1994, v: 95 },
  { id: 603, names: ['The Matrix', 'المصفوفة'], y: 1999, v: 95 }, { id: 37165, names: ['The Truman Show'], y: 1998, v: 90 }, { id: 1124, names: ['The Prestige'], y: 2006, v: 92 },
  { id: 1100, names: ['Top Gun: Maverick'], y: 2022, v: 90 }, { id: 76600, names: ['Avatar: The Way of Water'], y: 2022, v: 88 }, { id: 19995, names: ['Avatar', 'أفاتار'], y: 2009, v: 94 }];
const P = prepare(items), top = q => find(P, q, { limit: 4 });
const first = (q, id, meant) => { const r = top(q), h = r.hits[0]; check(`«${q}» → ${items.find(x => x.id === id).names[0]}${meant === true ? ' (هل تقصد)' : meant === false ? ' (مطابقة مباشرة)' : ''}`,
  h?.id === id && (meant === undefined || !!r.meant === meant), r.hits.map(x => [x.names[0], x.how, x.score])); };

console.log('== التطبيع');
check('الهمزات والتاء المربوطة والألف المقصورة والتشكيل والأرقام العربية', fold('أُوبِنهايمَر إِلى مدرسةٍ ٢٠٢٣') === 'اوبنهايمر الي مدرسه 2023', fold('أُوبِنهايمَر إِلى مدرسةٍ ٢٠٢٣'));
check('علامات الترقيم والأرقام الرومانية والأحرف اللاتينية المنبورة', fold('Amélie — Rocky II: (The Return)') === 'amelie rocky 2 the return', fold('Amélie — Rocky II: (The Return)'));

console.log('== بالحروف العربية (العنوان العربي أو نطق الاسم الإنجليزي)');
first('جون ويك', 245891, false); first('جون ويك ٢', 324552); first('انترستلر', 157336, true); first('باتمان', 414906); first('ذا دارك نايت', 155, true); first('شاوشانك', 278);
first('افنجرز', 24428, true); first('جوكر', 475557, false); first('اوبنهايمر', 872585, true); first('سبايدر مان', 557, true); first('انسبشن', 27205, true); first('صراع العروش', 1399, false);
first('قيم اوف ثرونز', 1399, true); first('بليد رنر', 335984, true); first('بريكنق باد', 1396); first('فايت كلوب', 550, true); first('ايرون مان', 1726, true); first('ماتركس', 603, true); first('افاتار', 19995);
first('فورست قمب', 13, true); first('بالب فكشن', 680, true); first('ترومان شو', 37165, true); first('ذا برستيج', 1124, true); first('توب قن', 1100, true);

console.log('== الإملاء الخاطئ والاسم الناقص');
first('jon wik', 245891, true); first('jhon wick', 245891, true); first('john wi', 245891, false); first('intersteller', 157336, true); first('shawshenk', 278, true);
first('avangers', 24428, true); first('gladiater', 98, true); first('dark nite', 155, true); first('spiderman', 557, true); first('matrx', 603, true); first('forest gump', 13, true);
first('lord of the rings', 120, false); first('fellowship', 120); first('prestige', 1124, false); first('oppenhimer', 872585, true); first('top gun maverik', 1100, true);

console.log('== السنة والأرقام ترجّح');
first('batman 1989', 268); first('batman 2022', 414906); first('avatar 2022', 76600); first('john wick 2', 324552); first('blade runner 2049', 335984, false);

console.log('== لا اقتراح مضلل');
check('كلام لا يشبه اسماً: لا نتيجة', !top('xyzqw').hits.length && !top('ثصقفغ').hits.length, [top('xyzqw').hits, top('ثصقفغ').hits]);
check('حرفان لا يطابقان بالصوت إلا اسماً قصيراً مثلهما (اوبن لا تعني «بين النجوم»)', !top('اوبن').hits.some(h => h.id === 157336), top('اوبن').hits.map(h => h.names[0]));
check('«جون ويك» لا يقترح Joker', !top('جون ويك').hits.some(h => h.id === 475557), top('جون ويك').hits.map(h => h.names[0]));
check('حرف واحد لا يبحث', !top('ب').hits.length);

// الأداء: فهرس بحجم فهرس الأفلام الحقيقي (عشرة آلاف اسم) يُبحث فيه في أجزاء من الثانية
const big = prepare(Array.from({ length: 10000 }, (_, i) => ({ id: i, names: [items[i % items.length].names[0] + ' ' + i.toString(36), 'عنوان ' + i], v: i % 100 })));
const t0 = performance.now(); for (const q of ['جون ويك', 'intersteller', 'dark nite', 'سبايدر مان', 'the']) find(big, q); const ms = (performance.now() - t0) / 5;
check(`البحث في عشرة آلاف اسم سريع بما يكفي للكتابة (${ms.toFixed(1)} مللي ثانية للمرة)`, ms < 60, ms);

console.log(fail ? `\n❌ فشل ${fail}` : '\n✅ كل فحوص البحث المتسامح نجحت');
process.exit(fail ? 1 : 0);
