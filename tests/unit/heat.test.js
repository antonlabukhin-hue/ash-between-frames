import { describe, it, expect } from 'vitest';
import { createHeat, isOverheated, heatCost, addHeat, heatLeft, notePaid, cancelRefund, REFUND_WINDOW } from '../../src/timeline/heat.js';

describe('Перегрев браслета', () => {
  it('три сдвига за 4 секунды раскаляют браслет — следующий вдвое дороже', () => {
    const h = createHeat();
    addHeat(h, 0);
    addHeat(h, 1);
    expect(isOverheated(h, 1.5)).toBe(false);
    expect(heatCost(h, 1.5, 1)).toBe(1);
    addHeat(h, 2);
    expect(isOverheated(h, 2.1)).toBe(true);
    expect(heatCost(h, 2.1, 1)).toBe(2);
    expect(heatCost(h, 2.1, 0)).toBe(0); // бесплатное остаётся бесплатным
    expect(heatLeft(h, 2.1)).toBeCloseTo(1.9, 5);
  });
  it('остывает, когда старые сдвиги выходят из окна', () => {
    const h = createHeat();
    [0, 1, 2].forEach((t) => addHeat(h, t));
    expect(isOverheated(h, 3.9)).toBe(true);
    expect(isOverheated(h, 4.1)).toBe(false);
    expect(heatLeft(h, 4.1)).toBe(0);
  });
});

describe('Отмена сдвига', () => {
  it('быстрая отмена возвращает оплату, поздняя — нет', () => {
    const tl = {};
    notePaid(tl, 1, 10);
    expect(cancelRefund(tl, 10 + REFUND_WINDOW - 0.1)).toBe(1);
    expect(cancelRefund(tl, 10.5)).toBe(0); // уже возвращено
    notePaid(tl, 2, 20);
    expect(cancelRefund(tl, 20 + REFUND_WINDOW + 0.5)).toBe(0);
  });
  it('без оплаты возвращать нечего', () => {
    expect(cancelRefund({}, 5)).toBe(0);
  });
});
