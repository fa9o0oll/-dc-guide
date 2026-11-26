// أداة عناية الألعاب (بلا شبكة). طريقة العمل وقواعد الترجمة في docs/GAMES-CARE.md.
//   node scripts/games-care.mjs pending [--limit N] [--full]   ما ينقصه شيء: ترجمة النبذة أو القصة، أو موقعه من أحداث عالمه. المطلوب بزر «ترجمها لي» أولاً.
//                                                             --full يطبع النص الإنجليزي وما يلزم لكتابة الموقع (السلسلة وأجزاؤها، العالم، النوع)
//   node scripts/games-care.mjs show <رقم> [<رقم>…]            النص الإنجليزي وبيانات ألعاب بعينها
//   node scripts/games-care.mjs apply <ملف.json> [<ملف>…]      يدمج دفعة { "<رقم اللعبة>": { "s": نبذة, "t": قصة, "p": { موقعها } } } في ملفي العناية بعد فحصها،
//                                                             ثم يعيد تطبيقها على ملفات الموقع
//   node scripts/games-care.mjs build                         يعيد تطبيق ملفي العناية على ملفات الموقع (site/games/data) كما يفعل البناء
//   node scripts/games-care.mjs check                         يفحص ملفي العناية ويطبع التغطية. يخرج بخطأ إن وُجدت مشكلة
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { applyCare, pendingCare, checkCare, textKey } from './lib-care.mjs';

const F = { tr: 'data/games/translations.json', pl: 'data/games/places.json', games: 'site/games/data/games.json', texts: 'site/games/data/texts.json' };
const rd = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } };
const sorted = o => Object.fromEntries(Object.entries(o).sort((a, b) => +a[0] - +b[0]));
const wr = (f, o) => writeFileSync(f, JSON.stringify(sorted(o), null, 1) + '\n');
const cat = rd(F.games, null); if (!cat) { console.error(`لا ملف قائمة (${F.games}). شغّل البناء أولاً.`); process.exit(1); }
// النص الإنجليزي: من ملف النصوص، أو من ملف القائمة نفسه إن كان بصيغته القديمة (النبذة داخل سجل اللعبة)
const prev = { ...Object.fromEntries(cat.games.filter(g => g.summary || g.story).map(g => [g.id, { s: g.summary || '', t: g.story || '' }])), ...(rd(F.texts, {}).texts || {}) };
const TR = rd(F.tr, {}), PL = rd(F.pl, {}), byId = new Map(cat.games.map(g => [g.id, g]));
const [cmd, ...args] = process.argv.slice(2);

// ما طُلب بزر «ترجمها لي» (فرع requests في المستودع)، إن أمكن قراءته
function requested() { try { execFileSync('git', ['fetch', '-q', 'origin', 'requests'], { stdio: 'ignore', timeout: 30000 }); } catch {}
  try { return (JSON.parse(execFileSync('git', ['show', 'origin/requests:data/games/requests.json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })).ar || []).map(x => +x.igdb).filter(Boolean); } catch { return []; } }
function rebuild() { const { texts, n } = applyCare(cat.games, prev, TR, PL);
  writeFileSync(F.texts, JSON.stringify({ built: cat.built, texts })); writeFileSync(F.games, JSON.stringify(cat));
  console.log(`site: ${cat.games.length} games, ${n.text} with text, ${n.ar} in Arabic${n.old ? ` (${n.old} changed since)` : ''}, ${n.place} with a place`); return texts; }
const info = g => { const x = prev[g.id] || {}, ser = (g.series || []).map(id => cat.series[id]).filter(Boolean);
  return { id: g.id, title: g.title, year: g.year, type: g.type, genres: g.genres, dev: g.dev, universe: g.universe?.en || undefined,
    series: ser.map(s => ({ name: s.name, parts: s.members.map(m => `${m.title} (${m.year ?? '?'})${byId.has(m.id) ? ' *' : ''}`) })), summary: x.s || '', story: x.t || '',
    have: { s: !!TR[g.id]?.s, t: !!TR[g.id]?.t, p: PL[g.id]?.k || null } }; };

if (cmd === 'pending') {
  const req = requested(), rank = id => { const i = req.indexOf(id); return i < 0 ? 1e9 : i; };
  const list = pendingCare(cat.games, prev, TR, PL).sort((a, b) => rank(a.id) - rank(b.id)), lim = +(args[args.indexOf('--limit') + 1] || 0) || list.length;
  console.log(`pending: ${list.length} of ${cat.games.length} games${req.length ? `, ${list.filter(x => req.includes(x.id)).length} asked for with the button` : ''}`);
  for (const x of list.slice(0, lim)) { const g = byId.get(x.id);
    // لعبة +18 (E69): تُترجم كغيرها بأمانة، وعنوان إيداعها برقمها وحده بلا اسمها
    if (args.includes('--full')) console.log(JSON.stringify({ need: x.need, asked: req.includes(x.id) || undefined, adult: x.adult ? '+18: عنوان الإيداع برقمها وحده' : undefined, ...info(g) }));
    else console.log(`${x.id}\t${x.need.join(',')}${req.includes(x.id) ? '\tasked' : ''}${x.adult ? '\t+18' : ''}\t${g.title} (${g.year ?? '?'})`); }
} else if (cmd === 'show') {
  for (const id of args.map(Number)) { const g = byId.get(id); console.log(g ? JSON.stringify(info(g)) : `${id}: ليست في القائمة`); }
} else if (cmd === 'apply') {
  if (!args.length) { console.error('أي ملف؟'); process.exit(1); }
  const nTR = {}, nPL = {}, problems = []; let ns = 0, nt = 0, np = 0;
  for (const f of args) { const batch = rd(f, null); if (!batch) { problems.push(`${f}: ليس JSON صالحاً`); continue; }
    for (const [id, v] of Object.entries(batch)) { const g = byId.get(+id), en = prev[id] || {};
      if (!g) { problems.push(`${f} ${id}: ليست في القائمة`); continue; }
      for (const k of Object.keys(v)) if (!['s', 't', 'p'].includes(k)) problems.push(`${f} ${id}: حقل غير معروف «${k}»`);
      if (v.s != null || v.t != null) { const cur = { ...(TR[id] || {}), ...(nTR[id] || {}) };
        if (v.s != null) { if (!en.s) problems.push(`${f} ${id}: ترجمة نبذة للعبة بلا نبذة إنجليزية`); cur.s = v.s; ns++; }
        if (v.t != null) { if (!en.t) problems.push(`${f} ${id}: ترجمة قصة للعبة بلا قصة إنجليزية`); cur.t = v.t; nt++; }
        // البصمة تُحدَّث حين تكتمل الترجمة لما في النص الإنجليزي الآن
        if ((cur.s || !en.s) && (cur.t || !en.t)) cur.h = textKey(en.s, en.t);
        nTR[id] = cur; }
      if (v.p != null) { nPL[id] = v.p; np++; } } }
  problems.push(...checkCare(nTR, nPL, prev));
  if (problems.length) { console.error(`✗ لم يُدمج شيء. ${problems.length} مشكلة:\n  ` + problems.join('\n  ')); process.exit(1); }
  Object.assign(TR, nTR); Object.assign(PL, nPL); wr(F.tr, TR); wr(F.pl, PL); rebuild();
  console.log(`✓ دُمجت: ${ns} نبذة، ${nt} قصة، ${np} موقع. الباقي: ${pendingCare(cat.games, prev, TR, PL).length} لعبة`);
} else if (cmd === 'build') { rebuild();
} else if (cmd === 'check') {
  const texts = existsSync(F.texts) ? prev : null, bad = checkCare(TR, PL, texts), ids = new Set(cat.games.map(g => String(g.id)));
  const orphan = [...Object.keys(TR), ...Object.keys(PL)].filter(id => !ids.has(id)), pend = pendingCare(cat.games, prev, TR, PL), has = k => pend.filter(x => x.need.includes(k)).length;
  const withS = cat.games.filter(g => prev[g.id]?.s).length, withT = cat.games.filter(g => prev[g.id]?.t).length, usual = cat.games.length;   // ألعاب +18 في العناية كغيرها (E75)
  console.log(`العناية: النبذات ${withS - has('summary')}/${withS}، القصص ${withT - has('story')}/${withT}، المواقع ${usual - has('place')}/${usual}${has('changed') ? `، ${has('changed')} تغيّر نصها الإنجليزي` : ''}${orphan.length ? `، ${new Set(orphan).size} لألعاب خرجت من القائمة (تبقى إن عادت)` : ''}`);
  { const { checkFix } = await import('./lib-stores.mjs'), fix = existsSync('data/games/pc.json') ? JSON.parse(readFileSync('data/games/pc.json', 'utf8')) : {}; bad.push(...checkFix(fix, ids)); console.log(`متاجر الكمبيوتر: ${Object.keys(fix).length} تصحيح باليد (data/games/pc.json)`); }
  if (bad.length) { console.error(`✗ ${bad.length} مشكلة:\n  ` + bad.join('\n  ')); process.exit(1); }
  console.log('✓ ملفا العناية صالحان');
} else { console.error('الأوامر: pending | show | apply | build | check'); process.exit(1); }
