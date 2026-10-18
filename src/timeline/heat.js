// Правила сдвига, которые поощряют эксперименты и не дают спамить (docs/TIME_DESIGN.md, П1):
//   • передумал — отмени: если вернуть объект в первые REFUND_WINDOW секунд, заряд возвращается;
//   • перегрев: после LIMIT сдвигов за WINDOW секунд браслет раскалён — следующий сдвиг вдвое дороже.
// Модуль чистый: время передаётся параметром.

export const REFUND_WINDOW = 1.5;

export function createHeat({ window = 4, limit = 3 } = {}) {
  return { window, limit, times: [] };
}

function forget(h, now) {
  h.times = h.times.filter((t) => now - t < h.window);
}

export function isOverheated(h, now) {
  forget(h, now);
  return h.times.length >= h.limit;
}

// Сколько секунд до остывания (0 — не раскалён).
export function heatLeft(h, now) {
  if (!isOverheated(h, now)) return 0;
  return h.window - (now - h.times[h.times.length - h.limit]);
}

// Цена сдвига с учётом перегрева (бесплатное остаётся бесплатным).
export const heatCost = (h, now, cost) => (cost > 0 && isOverheated(h, now) ? cost * 2 : cost);

export function addHeat(h, now) {
  forget(h, now);
  h.times.push(now);
}

// Запомнить оплату сдвига на объекте (для возврата при быстрой отмене).
export function notePaid(tl, cost, now) {
  tl.paid = cost;
  tl.paidAt = now;
}

// Отмена сдвига: сколько зарядов вернуть. Только если отменили быстро — иначе это не «передумал»,
// а бесплатный проход по мосту туда-обратно.
export function cancelRefund(tl, now, window = REFUND_WINDOW) {
  const n = tl.paid && now - (tl.paidAt ?? -Infinity) <= window ? tl.paid : 0;
  tl.paid = 0;
  return n;
}
