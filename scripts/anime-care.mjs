// عناية «أنمياتي»: ما لم تُترجم نبذته بعد، وفحص ما تُرجم. الترجمات في data/anime/translations.json (المفتاح رقم العمل في MyAnimeList، والقيمة النبذة العربية)،
// والنص الإنجليزي من بناء الموقع: site/anime/data/texts/<الرقم % 32>.json. القواعد قواعد docs/GAMES-CARE.md نفسها (قسم «أنمياتي» فيه).
//   node scripts/anime-care.mjs pending [عدد] [--full]   ما ينقصه ترجمة: المطلوب بأرقامه أولاً (--ids 1,2,3، ولو كان من أقرباء السلاسل)، ثم الأشهر في MyAnimeList
//   node scripts/anime-care.mjs heads [عدد]              أرقام الأعمال التي تحمل أكبر السلاسل أسماءها ولم تُترجم (نبذتها «حكاية» السلسلة في نافذتها)
//   node scripts/anime-care.mjs show <رقم>               عمل بعينه بنصه الإنجليزي وترجمته إن وُجدت
//   node scripts/anime-care.mjs check                    يفحص الملف: الصيغة، والطول نسبةً إلى الأصل (35% إلى 190%)، وعلامات الترقيم. ويفحص ترجمات الحلقات
// الحلقات: نصها الإنجليزي (العنوان والملخص) من site/anime/data/eps/<رقم العمل>.json، وترجماتها في data/anime/episodes/tv-<رقم المسلسل في TMDB>.json
// بمفتاح «الموسمxالحلقة» في TMDB ومعها بصمة النص الإنجليزي (h): إن تغيّر النص أو تبدّل موضع الحلقة لم تُلصق الترجمة بغير حلقتها.
//   node scripts/anime-care.mjs eps <رقم العمل> [من] [إلى]   حلقات العمل التي لم تُترجم، بنصها الإنجليزي (من الحلقة «من» إلى «إلى»، وإلا أول 12 غير مترجمة)
//   node scripts/anime-care.mjs eps-add <ملف.json>           يدمج { "رقم العمل": { "رقم الحلقة": { "t": "العنوان", "o": "الملخص" } } } في ملفات الترجمة ببصماتها
//                                                        ("t": "=" لعنوان هو اسم عمل آخر يبقى بحروفه اللاتينية، كعناوين Akudama Drive بأسماء أفلام)
//   node scripts/anime-care.mjs eps-left [رقم…]              كم بقي من حلقات كل عمل بلا ترجمة (الأعمال المذكورة، وإلا كل ما له حلقات)
//   node scripts/anime-care.mjs eps-next [أعمال] [حلقات]     الدفعة التالية: الأعمال التي بدأت ترجمة حلقاتها ولم تكتمل، الأقل تقدّماً أولاً، ولكل عمل حلقاته
//                                                        التالية بعد آخر ما تُرجم (الافتراضي 10 أعمال × 3 حلقات)، ومعه الأسماء التي بين «» في نبذته لتوحيدها.
//                                                        سجله الشخصي ليس في المستودع، فما بدأته دفعة سابقة (مما سمّاه أو مما يشاهده) هو الدليل على ما يُكمَل
import fs from 'node:fs';
import crypto from 'node:crypto';
import { epPrint, epKey } from './lib-anime.mjs';
const root = new URL('../', import.meta.url), rd = (p, fb) => { try { return JSON.parse(fs.readFileSync(new URL(p, root), 'utf8')); } catch { return fb; } };
const cat = rd('site/anime/data/catalog.json', { anime: [] }), tr = rd('data/anime/translations.json', {}), by = new Map(cat.anime.map(a => [a.id, a]));
const textOf = id => rd(`site/anime/data/texts/${id % 32}.json`, {})[id] || null;
const [cmd, ...args] = process.argv.slice(2), flag = n => { const i = args.indexOf('--' + n); return i < 0 ? null : args[i + 1] ?? true; };
// ---------- الحلقات
const sha = s => crypto.createHash('sha1').update(s).digest('hex'), epsOf = id => rd(`site/anime/data/eps/${id}.json`, null), trFile = tv => `data/anime/episodes/tv-${tv}.json`, trOf = tv => rd(trFile(tv), {});
const done = (e, T) => { const x = T[epKey(e)]; return !!x && x.h === epPrint(sha, e); };
const hasText = e => !!(e.t || e.ov);
// سطر لكل حلقة، بترتيب الموسم ثم الحلقة
const saveTr = (tv, T) => { const keys = Object.keys(T).sort((a, b) => { const [s1, e1] = a.split('x').map(Number), [s2, e2] = b.split('x').map(Number); return s1 - s2 || e1 - e2; });
  fs.mkdirSync(new URL('data/anime/episodes/', root), { recursive: true }); fs.writeFileSync(new URL(trFile(tv), root), '{\n' + keys.map((k, i) => `${JSON.stringify(k)}: ${JSON.stringify(T[k])}${i < keys.length - 1 ? ',' : ''}`).join('\n') + '\n}\n'); };
const badText = v => /"|  | [،؛؟.!:]/.test(v) ? 'علامة اقتباس لاتينية أو فراغان أو فراغ قبل علامة ترقيم' : !/[\u0600-\u06ff]/.test(v) ? 'بلا حروف عربية' : '';
if (cmd === 'pending') { const n = +(args.find(a => /^\d+$/.test(a)) || 15), full = args.includes('--full'), asked = String(flag('ids') || '').split(',').map(Number).filter(Boolean);
  // المطلوب بأرقامه قد يكون من أقرباء السلاسل (ليس في القائمة): نبذة العمل الذي تحمل السلسلة اسمه تظهر في نافذتها
  const pool = cat.anime.filter(a => !a.pending && !tr[a.id] && textOf(a.id)?.en), todo = pool.filter(a => a.ord != null), first = asked.map(id => pool.find(a => a.id === id)).filter(Boolean);
  const rest = todo.filter(a => !asked.includes(a.id)).sort((a, b) => (b.sv || 0) - (a.sv || 0));
  console.log(JSON.stringify({ translated: Object.keys(tr).length, pending: todo.length, noTextYet: cat.anime.filter(a => a.ord != null && (a.pending || !textOf(a.id)?.en)).length }));
  for (const a of [...first, ...rest].slice(0, n)) console.log(full ? `\n### ${a.id} | ${a.t}${a.en ? ' | ' + a.en : ''}\n${textOf(a.id).en}` : `${a.id}\t${a.t}`); }
else if (cmd === 'heads') { const n = +(args.find(a => /^\d+$/.test(a)) || 40), mine = w => w.ids.filter(id => by.get(id)?.ord != null).length;
  const need = (cat.worlds || []).slice().sort((a, b) => mine(b) - mine(a) || b.ids.length - a.ids.length).map(w => by.get(w.head)).filter(a => a && !tr[a.id] && textOf(a.id)?.en).slice(0, n);
  console.log(need.map(a => a.id).join(',')); for (const a of need) console.error(`${a.id}\t${a.t}`); }
else if (cmd === 'show') { const id = +args[0], a = by.get(id); if (!a) { console.error('لا عمل بهذا الرقم'); process.exit(1); } console.log(`${a.id} | ${a.t}${a.en ? ' | ' + a.en : ''}\n\n${textOf(id)?.en || '(لا نص إنجليزي بعد)'}\n\n${tr[id] || '(لم يُترجم)'}`); }
else if (cmd === 'check') { const bad = [], raw = fs.readFileSync(new URL('data/anime/translations.json', root), 'utf8');
  if (!/^\{\n("\d+": ".*",?\n)*\}\n$/.test(raw)) bad.push('الصيغة: سطر لكل عمل بين { و } بلا إزاحة');
  for (const [id, v] of Object.entries(tr)) { const en = textOf(+id)?.en, r = en ? v.length / en.length : 1;
    if (!by.has(+id)) bad.push(`${id}: ليس في الكتالوج`); if (/"|  | [،؛؟.]/.test(v)) bad.push(`${id}: علامة اقتباس لاتينية أو فراغان أو فراغ قبل علامة ترقيم`);
    if (!/[؀-ۿ]/.test(v)) bad.push(`${id}: بلا حروف عربية`); if (en && (r < .35 || r > 1.9)) bad.push(`${id}: الطول ${Math.round(r * 100)}% من الأصل`); }
  // ترجمات الحلقات: الصيغة، والنص، والطول نسبةً إلى الأصل حين يُعرف (الحلقة قد لا تكون في ملفات الحلقات المبنية هنا بعد)
  let dir = []; try { dir = fs.readdirSync(new URL('data/anime/episodes/', root)).filter(f => /^tv-\d+\.json$/.test(f)); } catch {}
  const en = new Map(); if (dir.length) for (const id of Object.keys(rd('site/anime/data/eps/index.json', {}))) { const j = epsOf(+id); for (const e of j?.eps || []) en.set(`${j.tv}:${epKey(e)}`, e); }
  let eps = 0, stale = 0;
  for (const f of dir) { const tv = +f.slice(3, -5), raw2 = fs.readFileSync(new URL('data/anime/episodes/' + f, root), 'utf8'), T = JSON.parse(raw2);
    if (!/^\{\n("\d+x\d+": \{.*\},?\n)*\}\n$/.test(raw2)) bad.push(`${f}: الصيغة: سطر لكل حلقة`);
    for (const [k, x] of Object.entries(T)) { eps++; const e = en.get(`${tv}:${k}`), w = [x.t || '', x.o || ''].map(v => v && badText(v)).find(Boolean);
      if (!/^[0-9a-f]{10}$/.test(x.h || '') || !(x.t || x.o)) bad.push(`${f} ${k}: بلا بصمة أو بلا نص`); if (w) bad.push(`${f} ${k}: ${w}`);
      if (e && x.h !== epPrint(sha, e)) stale++; else if (e?.ov && x.o) { const r = x.o.length / e.ov.length; if (r < .3 || r > 2.2) bad.push(`${f} ${k}: طول الملخص ${Math.round(r * 100)}% من الأصل`); } } }
  // الملفات المحرَّرة باليد: نبذات العوالم (worlds.json)، وترتيب القصة المُراجَع (orders.json)، وتصحيح مطابقة TMDB (tmdb.json)
  const heads = new Map((cat.worlds || []).map(w => [w.head, w])), about = rd('data/anime/worlds.json', {}), orders = rd('data/anime/orders.json', {}), fix = rd('data/anime/tmdb.json', {});
  for (const [k, v] of Object.entries(about)) { if (!heads.has(+k)) bad.push(`worlds.json ${k}: ليس العمل الذي تحمل سلسلةٌ اسمه`); const w = typeof v === 'string' ? badText(v) : 'ليس نصاً'; if (w) bad.push(`worlds.json ${k}: ${w}`); }
  for (const [k, o] of Object.entries(orders)) { const w = heads.get(+k); if (!w) { bad.push(`orders.json ${k}: ليس العمل الذي تحمل سلسلةٌ اسمه`); continue; }
    const ids = new Set(w.ids), out = (o.order || []).filter(id => !ids.has(id)), miss = o.order ? w.ids.filter(id => !o.order.includes(id)) : [];
    if (out.length) bad.push(`orders.json ${k} (${w.name}): ليست من السلسلة: ${out.join(' ')}`); if (miss.length) bad.push(`orders.json ${k} (${w.name}): لم تُذكر: ${miss.join(' ')}`);
    if (o.order && new Set(o.order).size !== o.order.length) bad.push(`orders.json ${k}: عمل مكرر`); if (o.note != null && (typeof o.note !== 'string' || badText(o.note))) bad.push(`orders.json ${k}: الملاحظة: ${badText(String(o.note))}`); }
  for (const [k, t] of Object.entries(fix)) { if (!by.has(+k)) bad.push(`tmdb.json ${k}: ليس في الكتالوج`); if (t !== null && !((t.k === 'tv' || t.k === 'movie') && Number.isInteger(t.id))) bad.push(`tmdb.json ${k}: الشكل { k: 'tv'|'movie', id, s?, o? } أو null`); }
  const extra = [Object.keys(about).length && `${Object.keys(about).length} نبذة عالم`, Object.keys(orders).length && `${Object.keys(orders).length} ترتيب مُراجَع`, Object.keys(fix).length && `${Object.keys(fix).length} تصحيح مطابقة`].filter(Boolean).join('، و');
  console.log(bad.length ? bad.join('\n') : `✅ ${Object.keys(tr).length} ترجمة سليمة${eps ? `، و${eps} حلقة${stale ? ` (${stale} تغيّر نصها الإنجليزي بعد ترجمتها)` : ''}` : ''}${extra ? '، و' + extra : ''}`); process.exit(bad.length ? 1 : 0); }
else if (cmd === 'eps') { const id = +args[0], j = epsOf(id), a = by.get(id); if (!j) { console.error('لا ملف حلقات لهذا العمل'); process.exit(1); } const T = trOf(j.tv), from = +args[1] || 0, to = +args[2] || 0;
  const todo = j.eps.filter(e => hasText(e) && !done(e, T) && (!from || e.n >= from) && (!to || e.n <= to)), pick = from ? todo : todo.slice(0, 12);
  console.log(JSON.stringify({ id, title: a?.t, tv: j.tv, episodes: j.eps.length, translated: j.eps.filter(e => done(e, T)).length, noText: j.eps.filter(e => !hasText(e)).length, shown: pick.length }));
  for (const e of pick) console.log(`\n## ${e.n} | ${e.t || '(بلا عنوان)'}\n${e.ov || '(بلا ملخص)'}`); }
else if (cmd === 'eps-add') { const add = JSON.parse(fs.readFileSync(args[0], 'utf8')); let n = 0, changed = 0; const bad = [];
  for (const [id, eps] of Object.entries(add)) { const j = epsOf(+id); if (!j) { bad.push(`${id}: لا ملف حلقات`); continue; } const T = trOf(j.tv);
    for (const [num, x] of Object.entries(eps)) { const e = j.eps.find(z => z.n === +num), same = (x.t || '').trim() === '=', t = same ? '' : (x.t || '').trim(), o = (x.o || '').trim();   // "t": "=" عنوان هو اسم عمل (فيلم، أغنية): يبقى بحروفه
      if (!e) { bad.push(`${id} الحلقة ${num}: ليست في ملف الحلقات`); continue; } if (!t && !o) { bad.push(`${id} الحلقة ${num}: فارغة`); continue; }
      if (o && !e.ov) { bad.push(`${id} الحلقة ${num}: ملخص لحلقة لا ملخص لها في المصدر`); continue; } if (t && !e.t) { bad.push(`${id} الحلقة ${num}: عنوان لحلقة لا عنوان لها في المصدر`); continue; }
      if ((e.t && !t && !same) || (e.ov && !o)) { bad.push(`${id} الحلقة ${num}: ينقصها ${e.t && !t && !same ? 'العنوان' : 'الملخص'}`); continue; }
      const w = [t, o].filter(Boolean).map(badText).find(Boolean); if (w) { bad.push(`${id} الحلقة ${num}: ${w}`); continue; }
      const k = epKey(e), v = { ...(t ? { t } : {}), ...(o ? { o } : {}), h: epPrint(sha, e) }; if (!T[k]) n++; else if (JSON.stringify(T[k]) !== JSON.stringify(v)) changed++; T[k] = v; }
    saveTr(j.tv, T); }
  console.log(`حلقات جديدة ${n}، معدَّلة ${changed}${bad.length ? '\n' + bad.join('\n') : ''}`); process.exit(bad.length ? 1 : 0); }
else if (cmd === 'eps-left') { const ids = args.map(Number).filter(Boolean), index = rd('site/anime/data/eps/index.json', {}), rows = [];
  for (const id of ids.length ? ids : Object.keys(index).map(Number)) { const j = epsOf(id); if (!j) continue; const T = trOf(j.tv), text = j.eps.filter(hasText), ok = text.filter(e => done(e, T)).length; rows.push([id, by.get(id)?.t || '', j.eps.length, text.length, ok]); }
  const sum = k => rows.reduce((s, r) => s + r[k], 0); console.log(JSON.stringify({ works: rows.length, episodes: sum(2), withText: sum(3), translated: sum(4) }));
  if (ids.length) for (const r of rows) console.log(`${r[0]}\t${r[1]}\t${r[4]} من ${r[3]} (حلقاته ${r[2]})`); }
else if (cmd === 'eps-next') { const works = +args[0] || 10, each = +args[1] || 3, rows = [];
  for (const id of Object.keys(rd('site/anime/data/eps/index.json', {})).map(Number)) { const j = epsOf(id); if (!j || j.fit === 'loose') continue; const T = trOf(j.tv); if (!Object.keys(T).length) continue;
    const text = j.eps.filter(hasText), ok = text.filter(e => done(e, T)); if (!ok.length || ok.length === text.length) continue;
    const last = ok.at(-1).n, next = text.filter(e => e.n > last && !done(e, T)).slice(0, each); if (next.length) rows.push({ id, j, ok: ok.length, next }); }
  rows.sort((a, b) => a.ok - b.ok || a.id - b.id);
  console.log(JSON.stringify({ started: rows.length, shown: Math.min(works, rows.length), episodes: rows.slice(0, works).reduce((n, r) => n + r.next.length, 0) }));
  for (const r of rows.slice(0, works)) { const names = [...new Set((tr[r.id] || '').match(/«[^»]+»/g) || [])].join(' ');
    console.log(`\n# ${r.id} | ${by.get(r.id)?.t || ''} | تُرجم ${r.ok} من ${r.j.eps.filter(hasText).length}${names ? '\n' + names : ''}`);
    for (const e of r.next) console.log(`${e.n} | ${e.t || '—'} | ${e.ov || '—'}`); } }
else console.log('الأوامر: pending [عدد] [--full] [--ids 1,2] | heads [عدد] | show <رقم> | check | eps <رقم العمل> [من] [إلى] | eps-add <ملف> | eps-left [رقم…] | eps-next [أعمال] [حلقات]');
