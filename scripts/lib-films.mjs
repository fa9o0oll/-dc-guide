// منطق قائمة الأفلام المشترك بين بناء البيانات (build-films.mjs) ودالة «أضف فيلم» (netlify/functions/add-film.mjs):
// قراءة سطر مكتوب بحرّية، مطابقته في TMDB، وتشكيل بيانات الفيلم بالصيغة التي يقرؤها الموقع.
export const COUNTRY = 'SA';
const AR_DIGITS = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9, '۰': 0, '۱': 1, '۲': 2, '۳': 3, '۴': 4, '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9 };
const isYear = s => /^(18|19|20)\d\d$/.test(s) && +s <= new Date().getFullYear() + 5;

// «the hunt (2012)» أو «2012 the hunt» أو «the hunt ٢٠١٢» → { title, year }. عنوان هو نفسه رقم سنة («2012») يبقى عنواناً.
export function parseLine(raw) {
  let s = String(raw || '').replace(/[٠-٩۰-۹]/g, d => AR_DIGITS[d]).replace(/[()\[\]{}"“”«»]/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/\b(movie|film)\b/gi, ' ').replace(/(^|\s)(فيلم|فلم|سنة|عام)(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
  const t = s.split(' '); let year = null;
  if (t.length > 1 && isYear(t[t.length - 1])) year = +t.pop();
  else if (t.length > 1 && isYear(t[0]) && !t.slice(1).some(x => /^\d+$/.test(x))) year = +t.shift();
  return { title: t.join(' ').replace(/^[\s\-–:،,]+|[\s\-–:،,]+$/g, ''), year };
}

export const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9؀-ۿ]+/g, ' ').replace(/\b(the|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();
const yearOf = c => +(c.release_date || c.first_air_date || '').slice(0, 4) || null;

// يرتّب مرشحي البحث: تطابق العنوان ثم قرب السنة ثم عدد الأصوات. sure = تطابق العنوان مع سنة في حدود ±1 (أو بلا سنة مطلوبة ومرشح واحد واضح).
export function rank(cands, title, year) {
  const want = norm(title);
  const scored = cands.map(c => {
    const names = [c.title, c.original_title, c.name, c.original_name].filter(Boolean).map(norm), y = yearOf(c);
    const exact = names.includes(want), starts = !exact && names.some(n => n.startsWith(want + ' ') || want.startsWith(n + ' '));
    const dy = year && y ? Math.abs(y - year) : null;
    const score = (exact ? 6 : starts ? 3 : 0) + (dy === 0 ? 4 : dy === 1 ? 3 : dy === null ? 0 : -Math.min(dy, 6)) + Math.log10(1 + (c.vote_count || 0)) + (c.popularity ? Math.min(c.popularity, 50) / 100 : 0);
    return { c, score, exact, dy };
  }).sort((a, b) => b.score - a.score);
  const top = scored[0];
  const sure = !!top && top.exact && (year ? top.dy !== null && top.dy <= 1 : (!scored[1] || top.score - scored[1].score > 1.5));
  return { scored, top: top?.c || null, sure };
}

// يبحث عن عمل بالعنوان والسنة. يجرّب السنة نفسها، ثم بلا سنة (لأن تاريخ TMDB قد يكون سنة العرض التجاري لا المهرجان).
export async function search(tmdb, kind, title, year) {
  const yk = kind === 'tv' ? 'first_air_date_year' : 'year', seen = new Map();
  const run = async p => { for (const c of (await tmdb('/search/' + kind, { query: title, include_adult: false, ...p }).catch(() => ({}))).results || []) if (!seen.has(c.id)) seen.set(c.id, c); };
  if (year) await run({ [yk]: year });
  if (!year || ![...seen.values()].some(c => [c.title, c.original_title, c.name, c.original_name].filter(Boolean).map(norm).includes(norm(title)))) await run({});
  return rank([...seen.values()], title, year);
}

const pickAr = tr => { const a = (tr?.translations || []).filter(t => t.iso_639_1 === 'ar'), by = c => a.find(t => t.iso_3166_1 === c);
  const t = by('SA') || by('AE') || a[0]; return t ? { title: (t.data.title || t.data.name || '').trim() || null, overview: (t.data.overview || '').trim() || null } : {}; };
const provIds = (list, dict) => (list || []).map(p => { dict[p.provider_id] = { name: p.provider_name, logo: p.logo_path }; return p.provider_id; });

export const detailPath = (kind, id) => `/${kind}/${id}`;
export const detailParams = kind => ({ language: 'en-US', append_to_response: kind === 'tv' ? 'external_ids,watch/providers,content_ratings,aggregate_credits,translations' : 'external_ids,watch/providers,release_dates,credits,translations' });

// يحوّل رد TMDB التفصيلي إلى سجلّ الفيلم في الموقع. providers قاموس مشترك يُملأ بأسماء المنصات وشعاراتها.
export function shape(kind, d, providers = {}) {
  const ar = pickAr(d.translations), wp = d['watch/providers']?.results?.[COUNTRY] || null;
  const date = (kind === 'tv' ? d.first_air_date : d.release_date) || null, title = kind === 'tv' ? d.name : d.title, orig = kind === 'tv' ? d.original_name : d.original_title;
  const us = kind === 'tv' ? (d.content_ratings?.results || []).find(r => r.iso_3166_1 === 'US')?.rating
    : (d.release_dates?.results || []).find(r => r.iso_3166_1 === 'US')?.release_dates.map(x => x.certification).find(Boolean);
  const crew = d.credits?.crew || [], cast = kind === 'tv' ? d.aggregate_credits?.cast || [] : d.credits?.cast || [];
  const o = { id: (kind === 'tv' ? 't' : 'm') + d.id, tmdb: d.id, kind, title, orig: orig && orig !== title ? orig : undefined, titleAr: ar.title && ar.title !== title ? ar.title : undefined,
    year: date ? +date.slice(0, 4) : null, date, status: d.status || null, runtime: kind === 'tv' ? undefined : d.runtime || null,
    genres: (d.genres || []).map(g => g.id), lang: d.original_language || null, countries: (d.production_countries || []).map(c => c.iso_3166_1).slice(0, 3),
    rating: d.vote_count ? Math.round(d.vote_average * 10) / 10 : null, votes: d.vote_count || 0, poster: d.poster_path || null, backdrop: d.backdrop_path || null,
    imdb: (kind === 'tv' ? d.external_ids?.imdb_id : d.imdb_id || d.external_ids?.imdb_id) || null, cert: us || undefined,
    directors: kind === 'tv' ? (d.created_by || []).map(p => p.name).slice(0, 3) : crew.filter(p => p.job === 'Director').map(p => p.name).slice(0, 3),
    cast: cast.slice(0, 5).map(p => p.name), overviewEn: (d.overview || '').trim() || null, overviewAr: ar.overview || undefined,
    col: d.belongs_to_collection?.id || undefined,
    prov: wp ? { link: wp.link || undefined, stream: provIds(wp.flatrate, providers), free: provIds([...(wp.free || []), ...(wp.ads || [])], providers), rent: provIds(wp.rent, providers), buy: provIds(wp.buy, providers) } : null };
  if (kind === 'tv') { o.seasons = d.number_of_seasons || null; o.episodes = d.number_of_episodes || null; o.lastDate = d.last_air_date || null;
    const n = d.next_episode_to_air; if (n?.air_date) o.next = { s: n.season_number, e: n.episode_number, date: n.air_date }; } // الحلقة القادمة لمسلسل يُعرض الآن (لعدّادها)
  return JSON.parse(JSON.stringify(o));
}

// أجزاء السلسلة مرتبة بتاريخ الصدور. الأجزاء التي لم يُعلن تاريخها تأتي آخراً.
export const shapeCollection = c => ({ id: c.id, name: c.name.replace(/\s+Collection$/i, ''), poster: c.poster_path || null, backdrop: c.backdrop_path || null,
  parts: (c.parts || []).map(p => ({ tmdb: p.id, title: p.title, date: p.release_date || null, year: p.release_date ? +p.release_date.slice(0, 4) : null, poster: p.poster_path || null, rating: p.vote_count ? Math.round(p.vote_average * 10) / 10 : null }))
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')) });

// السلاسل المراجَعة يدوياً (data/films/franchises.json): ترتيب مشاهدة يجمع أفلاماً من أكثر من مجموعة، ومسلسلات مرتبطة، وتوصية لكل عمل (watch | optional | skip).
// صيغ الخطوة في المصدر: { m: رقم فيلم } · { t: رقم مسلسل } · { c: رقم مجموعة, title } يُحوَّل إلى m · { f: عنوان, y: سنة } فيلم من القائمة يُحوَّل إلى m · { x: نوع, title, year } لما لا صفحة له في TMDB.
// get = { listed(kind, id), byTitle(title, year), movie(id), tv(id), collection(id) }. ما يتعذر حلّه يُحذف من الترتيب ويُكتب في problems.
export async function processFranchises(raw, get) {
  const items = {}, extras = {}, problems = [];
  for (const [key, fr] of Object.entries(raw)) {
    const order = [];
    // { all: رقم مجموعة, rec | watchFrom, set } يُدرج كل أجزاء المجموعة بترتيب صدورها. watchFrom يعطي «شاهده» لما تقييمه في TMDB يساويه أو يزيد و«اختياري» لما دونه، وما لم يصدر «قادم». set يخصّص جزءاً بعينه.
    const today = new Date().toISOString().slice(0, 10), steps = [];
    for (const st of fr.order || []) { if (!st.all) { steps.push(st); continue; }
      const col = await get.collection(st.all); if (!col) { problems.push(`${key}: المجموعة ${st.all} غير موجودة`); continue; }
      for (const p of col.parts) { const o = st.set?.[p.tmdb] || {};
        steps.push({ m: p.tmdb, rec: o.rec || (!p.date || p.date > today ? 'soon' : st.watchFrom ? (p.rating >= st.watchFrom ? 'watch' : 'optional') : st.rec), ...(o.note ? { note: o.note } : {}) }); } }
    for (const st of steps) { const s = { ...st };
      try {
        if (s.c) { const col = await get.collection(s.c), part = col?.parts.find(p => norm(p.title) === norm(s.title)); if (!part) throw new Error(`«${s.title}» ليس في المجموعة ${s.c}`); s.m = part.tmdb; delete s.c; delete s.title; }
        if (s.f) { const id = get.byTitle(s.f, s.y); if (!id) throw new Error(`«${s.f}» ليس في القائمة`); s.m = id; delete s.f; delete s.y; }
        if (s.m && !get.listed('movie', s.m)) { const d = await get.movie(s.m); if (!d) throw new Error(`فيلم ${s.m} غير موجود`); extras['m' + s.m] = d; }
        if (s.t && !get.listed('tv', s.t)) { const d = await get.tv(s.t); if (!d) throw new Error(`مسلسل ${s.t} غير موجود`); extras['t' + s.t] = d; }
        if (!['watch', 'optional', 'skip', 'soon'].includes(s.rec)) throw new Error('توصية غير معروفة: ' + s.rec);
        order.push(s);
      } catch (e) { problems.push(`${key}: ${e.message}`); }
    }
    if (order.length > 1) items[key] = { ...fr, order }; else problems.push(`${key}: أقل من عملين بعد الحل`);
  }
  return { items, extras, problems };
}
// النوع واللغة والمدة تصف العمل في الترتيب (فيلم رسوم، أنمي، فيلم قصير)
const kindBits = d => JSON.parse(JSON.stringify({ genres: d.genres?.length ? d.genres.map(g => g.id) : undefined, lang: d.original_language || undefined, runtime: d.runtime || undefined }));
export const basicMovie = d => ({ title: d.title, date: d.release_date || null, year: d.release_date ? +d.release_date.slice(0, 4) : null, poster: d.poster_path || null, rating: d.vote_count ? Math.round(d.vote_average * 10) / 10 : null, ...kindBits(d) });
export const basicTv = d => ({ title: d.name, date: d.first_air_date || null, year: d.first_air_date ? +d.first_air_date.slice(0, 4) : null, poster: d.poster_path || null, rating: d.vote_count ? Math.round(d.vote_average * 10) / 10 : null, seasons: d.number_of_seasons || null, tv: true, ...kindBits(d) });
