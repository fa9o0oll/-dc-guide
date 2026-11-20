// عناية «أنمياتي»: ما لم تُترجم نبذته بعد، وفحص ما تُرجم. الترجمات في data/anime/translations.json (المفتاح رقم العمل في MyAnimeList، والقيمة النبذة العربية)،
// والنص الإنجليزي من بناء الموقع: site/anime/data/texts/<الرقم % 32>.json. القواعد قواعد docs/GAMES-CARE.md نفسها (قسم «أنمياتي» فيه).
//   node scripts/anime-care.mjs pending [عدد] [--full]   ما ينقصه ترجمة: المطلوب بأرقامه أولاً (--ids 1,2,3، ولو كان من أقرباء السلاسل)، ثم الأشهر في MyAnimeList
//   node scripts/anime-care.mjs heads [عدد]              أرقام الأعمال التي تحمل أكبر السلاسل أسماءها ولم تُترجم (نبذتها «حكاية» السلسلة في نافذتها)
//   node scripts/anime-care.mjs show <رقم>               عمل بعينه بنصه الإنجليزي وترجمته إن وُجدت
//   node scripts/anime-care.mjs check                    يفحص الملف: الصيغة، والطول نسبةً إلى الأصل (35% إلى 190%)، وعلامات الترقيم
import fs from 'node:fs';
const root = new URL('../', import.meta.url), rd = (p, fb) => { try { return JSON.parse(fs.readFileSync(new URL(p, root), 'utf8')); } catch { return fb; } };
const cat = rd('site/anime/data/catalog.json', { anime: [] }), tr = rd('data/anime/translations.json', {}), by = new Map(cat.anime.map(a => [a.id, a]));
const textOf = id => rd(`site/anime/data/texts/${id % 32}.json`, {})[id] || null;
const [cmd, ...args] = process.argv.slice(2), flag = n => { const i = args.indexOf('--' + n); return i < 0 ? null : args[i + 1] ?? true; };
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
  console.log(bad.length ? bad.join('\n') : `✅ ${Object.keys(tr).length} ترجمة سليمة`); process.exit(bad.length ? 1 : 0); }
else console.log('الأوامر: pending [عدد] [--full] [--ids 1,2] | heads [عدد] | show <رقم> | check');
