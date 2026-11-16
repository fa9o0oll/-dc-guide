// فحوص عناية الألعاب (scripts/lib-care.mjs): دمج ترجماتنا وموقع كل لعبة من أحداث عالمها في ملفات الموقع، وما ينقص، وصحة ملفي العناية الحقيقيين.
// بلا شبكة ولا متصفح. المترجم (docs/GAMES-CARE.md) يشغّله قبل أن يودع.
import { readFileSync } from 'node:fs';
import { applyCare, pendingCare, checkCare, textKey, KINDS } from '../scripts/lib-care.mjs';
const fails = [], check = (n, ok, d = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${n}${ok ? '' : ' — ' + JSON.stringify(d).slice(0, 700)}`); if (!ok) fails.push(n); };
const rd = (f, d) => { try { return JSON.parse(readFileSync(new URL('../' + f, import.meta.url), 'utf8')); } catch { return d; } };

console.log('== الدمج');
{ const games = [{ id: 1, title: 'A', summary: ' One. ', story: 'Tale.' }, { id: 2, title: 'B', summary: 'Two.' }, { id: 3, title: 'C' }, { id: 4, title: 'D', summary: 'Four.', story: 'Long tale.' }];
  const TR = { 1: { s: 'واحد.', t: 'حكاية.', h: textKey('One.', 'Tale.') }, 4: { s: 'أربعة.', h: '00000000' }, 3: { s: 'بلا أصل' } }, PL = { 1: { k: 'first', line: 'بداية الحكاية.' }, 2: { k: 'none' } };
  const { texts, n } = applyCare(games, {}, TR, PL);
  check('النصوص تخرج من سجل اللعبة إلى خريطة مستقلة: الأصل الإنجليزي (s وt) وترجمتنا (sa وta)', JSON.stringify(texts[1]) === JSON.stringify({ s: 'One.', t: 'Tale.', sa: 'واحد.', ta: 'حكاية.' }) && !('summary' in games[0]) && !('story' in games[0]) && JSON.stringify(texts[2]) === '{"s":"Two."}' && !texts[3], texts);
  check('ترجمة تغيّر أصلها الإنجليزي بعدها تبقى معروضة وتُعلَّم (old)، وقصة بلا ترجمة تبقى بالإنجليزية', texts[4].sa === 'أربعة.' && texts[4].old === 1 && !texts[4].ta && texts[4].t === 'Long tale.', texts[4]);
  check('الموقع من الأحداث يدخل سجل اللعبة، و«none» لا يدخل', games[0].place?.k === 'first' && !games[1].place && n.place === 1 && n.ar === 2 && n.old === 1 && n.text === 3, n);
  const again = applyCare(games, texts, TR, PL);
  check('إعادة التطبيق بلا شبكة (النص من الخريطة السابقة) تعطي النتيجة نفسها', JSON.stringify(again.texts) === JSON.stringify(texts) && games[0].place?.k === 'first');
  const pend = pendingCare(games, texts, TR, PL), need = id => pend.find(x => x.id === id)?.need.join();
  check('ما ينقص: نبذة، قصة، موقع، ونص تغيّر أصله', need(1) === undefined && need(2) === 'summary' && need(3) === 'place' && need(4) === 'story,place' && pendingCare(games, texts, { ...TR, 4: { s: 'أ', t: 'ب', h: '00000000' } }, { ...PL, 4: { k: 'alone', line: 'س' } }).find(x => x.id === 4)?.need.join() === 'changed', pend); }

console.log('== الفحص');
{ const en = { 1: { s: 'A reasonably long English summary about a game and its world.', t: 'x' } }, ok = 'نبذة عربية معقولة الطول عن لعبة وعالمها وما يجري فيها.';
  const bad = (TR, PL = {}) => checkCare(TR, PL, en).join(' | ');
  check('ترجمة سليمة وموقع سليم يمران', !bad({ 1: { s: ok, h: 'abcdef12' } }, { 1: { k: 'sequel', after: 'Game One (2018)', line: 'تكمل أحداث Game One.', when: 'بعد عام', where: 'مدينة', src: [{ name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/X' }] }, 2: { k: 'none' }, 3: { k: 'alone', line: 'قصة مستقلة.', src: 'igdb' } }));
  check('نص غير عربي مرفوض، وكذا ترجمة بقيت فيها جملة إنجليزية كاملة؛ وأسماء الألعاب اللاتينية الكثيرة في نبذة قصيرة مقبولة', /ليس نصاً عربياً/.test(bad({ 1: { s: 'Still English text here.' } })) && /ليس نصاً عربياً/.test(bad({ 1: { s: 'كلمة and the rest of this sentence is left in English' } }))
    && /بقيت بالإنجليزية/.test(bad({ 1: { s: ok + ' The game follows a monster hunter searching for his adopted daughter across a war torn land. ' + ok + ' ' + ok } }))
    && !checkCare({ 1: { s: 'تقدّم Batman: Arkham Origins مدينة غوثام أوسع، وحكاية أصلية تسبق أحداث Batman: Arkham Asylum وBatman: Arkham City بسنوات.' } }, {}, null).length);
  check('ترجمة مبتورة أو أطول من الأصل بكثير مرفوضة، وكذا الفراغات الزائدة وعلامات الاتجاه الخفية', /ناقصة أو زائدة/.test(bad({ 1: { s: 'قصيرة.' } })) && /فراغات زائدة/.test(bad({ 1: { s: ok.replace(' ', '  ') } })) && /علامات اتجاه/.test(bad({ 1: { s: ok + '‏' } })) && /فارغ أو حوله فراغ/.test(bad({ 1: { s: ok + ' ' } })));
  check('حقل غير معروف وبصمة غير صالحة ومفتاح ليس رقماً مرفوضة', /حقل غير معروف/.test(bad({ 1: { s: ok, x: 1 } })) && /بصمة/.test(bad({ 1: { s: ok, h: 'zz' } })) && /ليس رقم لعبة/.test(bad({ abc: { s: ok } })));
  check('موقع: نوع غير معروف، وجملة غير عربية أو طويلة، و«between» بلا طرفيه، ومصدر بلا رابط https، و«none» بحقول: كلها مرفوضة',
    /نوع غير معروف/.test(bad({}, { 1: { k: 'next', line: 'س' } })) && /جملة عربية/.test(bad({}, { 1: { k: 'alone', line: 'standalone' } })) && /أطول من 260/.test(bad({}, { 1: { k: 'alone', line: 'س'.repeat(261) } }))
    && /between يلزمه/.test(bad({}, { 1: { k: 'between', after: 'A', line: 'س' } })) && /src/.test(bad({}, { 1: { k: 'alone', line: 'س', src: [{ name: 'x', url: 'http://x' }] } })) && /none لا يحمل/.test(bad({}, { 1: { k: 'none', line: 'س' } })));
  check('الأنواع أربعة عشر، منها none', KINDS.length === 14 && KINDS.includes('none') && new Set(KINDS).size === 14); }

console.log('== الملفات الحقيقية');
{ const TR = rd('data/games/translations.json', null), PL = rd('data/games/places.json', null), cat = rd('site/games/data/games.json', { games: [] }), texts = rd('site/games/data/texts.json', { texts: null }).texts;
  check('ملفا العناية موجودان وصالحان', !!TR && !!PL && !checkCare(TR, PL, texts).length, TR && PL ? checkCare(TR, PL, texts).slice(0, 6) : 'missing');
  check('كل ترجمة مكتملة لها بصمة أصلها', Object.values(TR || {}).every(t => !t.s || t.h == null || /^[0-9a-f]{8}$/.test(t.h)));
  if (texts) { const games = cat.games || [], pend = pendingCare(games, texts, TR, PL), cnt = k => pend.filter(x => x.need.includes(k)).length;
    console.log(`  · التغطية: ${games.length} لعبة، ينقص ${cnt('summary')} نبذة و${cnt('story')} قصة و${cnt('place')} موقعاً${cnt('changed') ? `، و${cnt('changed')} تغيّر أصلها` : ''}`);
    check('ملف النصوص المنشور يحمل كل ترجمة لها أصل فيه', games.every(g => { const t = TR[g.id], x = texts[g.id]; return !t || !x || ((!t.s || !x.s || x.sa === t.s) && (!t.t || !x.t || x.ta === t.t)); }));
    check('ملف القائمة بلا نصوص طويلة داخله، ومواقع الألعاب فيه كما في ملف العناية', games.every(g => !('summary' in g) && !('story' in g) && JSON.stringify(g.place || null) === JSON.stringify(PL[g.id] && PL[g.id].k !== 'none' ? PL[g.id] : null))); } }

console.log(fails.length ? `\n❌ فشل ${fails.length}` : '\n✅ كل فحوص العناية نجحت');
process.exit(fails.length ? 1 : 0);
