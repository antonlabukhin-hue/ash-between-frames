import { describe, it, expect } from 'vitest';
import { rankTargets, nextTarget } from '../../src/player/targeting.js';
import { findInteractable, INTERACT_RANGE, shiftLabel } from '../../src/world/interact.js';

const deg = (d) => (d * Math.PI) / 180;
describe('Выбор цели для Q', () => {
  const bridge = { id: 'мост' };
  const hollow = { id: 'враг' };
  it('враг в конусе прицела важнее близкого моста', () => {
    const list = rankTargets([
      { obj: bridge, type: 'prop', d: 20, off: deg(80) },
      { obj: hollow, type: 'enemy', d: 60, off: deg(10) },
    ]);
    expect(list[0].obj).toBe(hollow);
  });
  it('без врага в конусе — объект, на который смотришь', () => {
    const list = rankTargets([
      { obj: bridge, type: 'prop', d: 50, off: deg(20) },
      { obj: hollow, type: 'enemy', d: 40, off: deg(120) },
    ]);
    expect(list[0].obj).toBe(bridge);
  });
  it('знак под ногами и летящий снаряд — первыми', () => {
    const glyph = { id: 'знак' };
    const note = { id: 'нота' };
    expect(rankTargets([{ obj: hollow, type: 'enemy', d: 10, off: 0 }, { obj: glyph, type: 'prop', d: 30, off: deg(170), pinned: true }])[0].obj).toBe(glyph);
    expect(rankTargets([{ obj: hollow, type: 'enemy', d: 10, off: 0 }, { obj: note, type: 'projectile', d: 40, off: deg(30) }])[0].obj).toBe(note);
  });
  it('повторное Q идёт по кругу', () => {
    const list = rankTargets([
      { obj: hollow, type: 'enemy', d: 30, off: 0 },
      { obj: bridge, type: 'prop', d: 40, off: deg(10) },
    ]);
    expect(nextTarget(list, hollow).obj).toBe(bridge);
    expect(nextTarget(list, bridge).obj).toBe(hollow);
  });
});

describe('Взаимодействие', () => {
  it('радиус 36: естественный подход к указателю срабатывает, издалека — «подойди ближе»', () => {
    const sign = { id: 'указатель' };
    // указатель: точка у основания (x=152, y=93); герой на дороге x=144, y=120
    expect(findInteractable([{ obj: sign, x: 152, y: 93 }], 144, 120).target).toBe(sign);
    const far = findInteractable([{ obj: sign, x: 152, y: 93 }], 144, 140);
    expect(far.target).toBeNull();
    expect(far.near).toBe(sign);
    expect(INTERACT_RANGE).toBeGreaterThanOrEqual(34);
  });
  it('подпись цели сдвига', () => {
    expect(shiftLabel('Пустокожий', 'past')).toBe('в прошлое: Пустокожий');
    expect(shiftLabel('Фонарь', 'present')).toBe('в настоящее: Фонарь');
  });
});

describe('уже сдвинутый объект уступает несдвинутому', () => {
  it('прицел на дальний камень не отменяет ближний, уже сдвинутый', () => {
    const near = { obj: 'A', type: 'prop', d: 30, off: 0.05, shifted: true };
    const far = { obj: 'B', type: 'prop', d: 85, off: 0.05 };
    expect(rankTargets([near, far])[0].obj).toBe('B');
  });
  it('если он единственный — его можно отменить', () => {
    expect(rankTargets([{ obj: 'A', type: 'prop', d: 30, off: 0.05, shifted: true }])[0].obj).toBe('A');
  });
});
