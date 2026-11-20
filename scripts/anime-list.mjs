// يحدّث data/anime/list.json من ملف تصدير MyAnimeList: أرقام الأعمال بترتيب القائمة هناك، ومعها اسم العمل ونوعه وعدد حلقاته كما في الملف.
// لا يُكتب في المستودع شيء من السجل الشخصي (الحالة والحلقات والتقييم والتواريخ): ذاك يستورده صاحبه في صفحته ويبقى في متصفحه ومزامنته.
// التشغيل: node scripts/anime-list.mjs <animelist.xml | animelist.xml.gz>
import fs from 'node:fs'; import zlib from 'node:zlib';
import { parseMal } from '../site/anime-mal.js';
const src = process.argv[2]; if (!src) { console.error('usage: node scripts/anime-list.mjs <animelist.xml[.gz]>'); process.exit(1); }
const buf = fs.readFileSync(src), xml = (buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf).toString('utf8'), mal = parseMal(xml);
const out = new URL('../data/anime/list.json', import.meta.url), prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : [];
const seen = new Set(mal.entries.map(e => e.id)), list = [...mal.entries.map(e => ({ mal: e.id, title: e.title, type: e.type, eps: e.eps })), ...prev.filter(p => !seen.has(p.mal))];
fs.writeFileSync(out, '[\n' + list.map(x => JSON.stringify(x)).join(',\n') + '\n]\n');
const d = mal.declared, t = mal.totals, match = ['all', 'watching', 'completed', 'hold', 'dropped', 'plan'].every(k => d[k] === t[k]);
console.log(JSON.stringify({ entries: list.length, fromFile: mal.entries.length, keptFromBefore: list.length - mal.entries.length, skipped: mal.skipped.length, totalsMatchFile: match }));
if (!match) { console.error('العدّ يخالف ما يعلنه الملف عن نفسه', d, t); process.exit(1); }
