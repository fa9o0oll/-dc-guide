// يحدّث data/anime/list.json من ملف تصدير MyAnimeList: أرقام الأعمال بترتيب القائمة هناك، ومعها اسم العمل ونوعه وعدد حلقاته كما في الملف.
// لا يُكتب في المستودع شيء من السجل الشخصي (الحالة والحلقات والتقييم والتواريخ): ذاك يستورده صاحبه في صفحته ويبقى في متصفحه ومزامنته.
// التشغيل: node scripts/anime-list.mjs <animelist.xml | animelist.xml.gz>
//          node scripts/anime-list.mjs --add <رقم MyAnimeList> "<الاسم>" <النوع> <عدد الحلقات>    (عمل ليس في ملف MyAnimeList: في حسابه على SIMKL وحده مثلاً)
import fs from 'node:fs'; import zlib from 'node:zlib';
import { parseMal } from '../site/anime-mal.js';
const out = new URL('../data/anime/list.json', import.meta.url), prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : [];
const write = list => fs.writeFileSync(out, '[\n' + list.map(x => JSON.stringify(x)).join(',\n') + '\n]\n'), up = s => String(s).toUpperCase();
// ما ليس من الملف يأخذ موضعه من ترتيب الأسماء الذي يرتب به MyAnimeList القائمة، فيبقى «ترتيب قائمتي» متصلاً
const place = (list, p) => { const i = list.findIndex(x => up(x.title) > up(p.title)); list.splice(i < 0 ? list.length : i, 0, p); };
const src = process.argv[2]; if (!src) { console.error('usage: node scripts/anime-list.mjs <animelist.xml[.gz]> | --add <mal id> "<title>" <type> <episodes>'); process.exit(1); }
if (src === '--add') { const [id, title, type, eps] = process.argv.slice(3); if (!(+id > 0) || !title) { console.error('usage: --add <mal id> "<title>" <type> <episodes>'); process.exit(1); }
  if (prev.some(p => p.mal === +id)) { console.log(JSON.stringify({ entries: prev.length, already: +id })); process.exit(0); }
  place(prev, { mal: +id, title, type: type || 'TV', eps: +eps || 0 }); write(prev); console.log(JSON.stringify({ entries: prev.length, added: +id })); process.exit(0); }
const buf = fs.readFileSync(src), xml = (buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf).toString('utf8'), mal = parseMal(xml);
// وسم +18 (ad) يضعه زر «أضف أنمي» والفلتر مرفوع (E65): يبقى على العمل ولو جاء بعدها في ملف التصدير
const ad = new Set(prev.filter(p => p.ad).map(p => p.mal));
const seen = new Set(mal.entries.map(e => e.id)), list = mal.entries.map(e => ({ mal: e.id, title: e.title, type: e.type, eps: e.eps, ...(ad.has(e.id) ? { ad: 1 } : {}) })), kept = prev.filter(p => !seen.has(p.mal));
for (const p of kept) place(list, p);
write(list);
const d = mal.declared, t = mal.totals, match = ['all', 'watching', 'completed', 'hold', 'dropped', 'plan'].every(k => d[k] === t[k]);
console.log(JSON.stringify({ entries: list.length, fromFile: mal.entries.length, keptFromBefore: kept.length, skipped: mal.skipped.length, totalsMatchFile: match }));
if (!match) { console.error('العدّ يخالف ما يعلنه الملف عن نفسه', d, t); process.exit(1); }
