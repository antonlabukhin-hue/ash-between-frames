// Дары спасённых на Кухне (аудит: «прогрессия через людей, а не безымянные +5 %»). Каждый дар
// связан с временем и меняет приём, а не цифру урона. Кто дарит — зависит от выборов главы.
// Модуль чистый: читает и пишет только save.

export const GIFTS = {
  wick: {
    name: 'Фитиль',
    from: 'Арно',
    desc: '+1 заряд браслета.',
    // Арно на Кухне, если дорога оставила его (или обоих)
    who: (f) => f.camp === 'arno' || f.camp === 'both' || f.camp === 'fixed',
  },
  lens: {
    name: 'Осколок линзы',
    from: 'Сена',
    desc: 'Сдвиг держится на четверть дольше.',
    who: (f) => f.camp === 'sena' || f.camp === 'both' || f.camp === 'fixed',
  },
  steel: {
    name: 'Сухая сталь',
    from: 'Житель-кузнец',
    desc: 'После сдвига врага следующий удар по нему — в полтора раза сильнее.',
    who: (f) => f.bellChoice === 'people' || f.bellChoice === 'split' || f.bellChoice === 'lastRing',
  },
};

export const hasGift = (save, id) => !!save.upgrades?.[id];

// Дары, которые этот персонаж может отдать сейчас.
export function giftsFrom(save, from) {
  const f = save.flags || {};
  return Object.entries(GIFTS)
    .filter(([id, d]) => d.from === from && d.who(f) && !hasGift(save, id))
    .map(([id]) => id);
}

export function takeGift(save, id) {
  if (!GIFTS[id] || hasGift(save, id) || !GIFTS[id].who(save.flags || {})) return false;
  save.upgrades[id] = true;
  return true;
}

// Влияние даров на правила.
export const bonusCharges = (save) => (hasGift(save, 'wick') ? 1 : 0);
export const holdMul = (save) => (hasGift(save, 'lens') ? 1.25 : 1);
export const STEEL_MUL = 1.5;
