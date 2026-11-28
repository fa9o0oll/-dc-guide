// المزامنة المجدولة لربط الحسابات (E84): كل نصف ساعة، والموقع مغلق: ما عدّلته في MyAnimeList يصل SIMKL والعكس، ويصل الموقع حين يُفتح.
// ويومياتك في Letterboxd تُقرأ معها (E86)، وحلقات المسلسلات تتزامن مع Trakt (E87). لكلٍّ وقته، فلا تتجاوز الدالة مهلتها ولا مدة القفل.
// المنطق في scripts/lib-accounts.mjs، والقفل يمنع تداخلها مع مزامنة تطلبها الصفحة في اللحظة نفسها.
import { blobStore, syncAnime, syncFilms, syncSeries } from '../../scripts/lib-accounts.mjs';

export default async () => { const S = await blobStore(); if (!await S.lock()) return;
  const end = Date.now() + 23000, jobs = [() => syncAnime(S, { pull: true, budget: 60, deadline: Date.now() + 11000 }), () => syncFilms(S, { pull: true }), () => syncSeries(S, { pull: true, deadline: end })];
  try { for (const job of jobs) { if (Date.now() > end) break; try { await job(); } catch {} } }   // خطأ في إحداها لا يوقف البقية
  finally { await S.unlock(); } };
export const config = { schedule: '*/30 * * * *' };
