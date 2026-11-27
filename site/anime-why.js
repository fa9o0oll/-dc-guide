// لماذا لا يظهر تصنيف في مزاج «اقتراح الليلة» (E85): الشريط تصنيفاتُ ما في «سأشاهده» مما تبدؤه الآن، فإن بحثت عن تصنيف فيه
// أعمال تنتظرك ولا يصلح منها بداية قيل لك عددها وسببها، بدل «لا عمل» يوهم أنها غير موجودة (سأل عنها صاحب الموقع وصديقه).
// works: أعمال التصنيف في «سأشاهده» مما يظهر الآن. why(a): سبب ألا يصلح العمل بداية الآن، أو لا شيء إن صلح
export const WHY = { before: 'قبله جزء لم تكمله', soon: 'لم يُعرض بعد', info: 'تكتمل معلوماته مع البناء القادم' };
export function moodNote(name, works, why, nWorks) {
  if (!works.length) return `لا عمل من «${name}» في «سأشاهده»`;
  const rs = [...new Set(works.map(why).filter(Boolean))].map(r => WHY[r]).filter(Boolean);
  const one = works.length === 1, them = one ? 'منه' : works.length === 2 ? 'منهما' : 'منها';
  return `في «سأشاهده» ${nWorks(works.length)} من «${name}»، ولا يصلح ${them} بداية الآن${rs.length ? `: ${one ? rs[0] : rs.map(r => r.replace('قبله', 'قبل بعضها').replace('لم يُعرض', 'بعضها لم يُعرض').replace('تكتمل معلوماته', 'بعضها تكتمل معلوماته')).join('، و')}` : ''}.`; }
