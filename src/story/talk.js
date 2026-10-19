// Разговор с меню тем (вместо реплик, которые каждый раз начинаются заново). Первая встреча —
// приветствие, дальше — короткое «снова ты». Темы можно перечитывать; новые отмечены точкой.
// Показать воспоминание можно всегда, сколько угодно раз. Модуль чистый: строит пункты меню.

export const PRESENT = '__present';
export const BYE = '__bye';

// topics: [{ id, text }], уже доступные; seen: { id: true }; memories — сколько воспоминаний в дневнике.
export function talkMenu(topics, seen = {}, memories = 0) {
  const out = topics.map((t) => ({ id: t.id, text: seen[t.id] ? t.text : `• ${t.text}`, sub: seen[t.id] ? 'уже спрашивал' : undefined }));
  out.push({ id: PRESENT, text: 'Показать воспоминание', sub: memories ? `в дневнике: ${memories}` : 'дневник пуст', disabled: !memories });
  out.push({ id: BYE, text: 'Уйти' });
  return out;
}
