import { describe, it, expect } from 'vitest';
import { ROOMS, CHAPTER1 } from '../../src/scenes/rooms.js';
import { parseRoom } from '../../src/world/room.js';
import { melPhaseFor, realBrother, MEL_HP } from '../../src/enemies/boss.js';
import { addFragment, loseFragments, hasFragment, FRAGMENTS } from '../../src/items/fragments.js';
import { defaultSave } from '../../src/save/save.js';
import { ENEMY_DEFS, createEnemy, enemyMods } from '../../src/enemies/enemies.js';
import { PAST, PRESENT, shiftTimeline } from '../../src/timeline/timeline.js';
import { PROP_KINDS, createProp, propFoot, propWalkRect } from '../../src/world/props.js';

describe('Комнаты главы', () => {
  it('у каждой комнаты есть старт и прямоугольная карта', () => {
    for (const [id, def] of Object.entries(ROOMS)) {
      const room = parseRoom(def);
      expect(room.markers['@'], id).toBeTruthy();
      const widths = new Set(def.map.map((r) => r.length));
      expect(widths.size, id).toBe(1);
    }
  });
  it('выходы ведут в существующие комнаты и стоят на карте', () => {
    for (const [id, def] of Object.entries(ROOMS)) {
      const room = parseRoom(def);
      for (const ex of def.exits || []) {
        expect(ROOMS[ex.to], `${id} → ${ex.to}`).toBeTruthy();
        expect(room.markers[ex.marker]?.length, `${id} маркер ${ex.marker}`).toBeGreaterThan(0);
      }
    }
  });
  it('порядок главы покрывает все сюжетные комнаты', () => {
    expect(CHAPTER1.every((id) => ROOMS[id])).toBe(true);
  });
});

describe('Брат Мел', () => {
  it('фазы по здоровью', () => {
    expect(melPhaseFor(MEL_HP)).toBe(1);
    expect(melPhaseFor(660)).toBe(2);
    expect(melPhaseFor(300)).toBe(3);
  });
  it('реален брат той версии, что у арены', () => {
    expect(realBrother(PAST)).toBe('imprint');
    expect(realBrother(PRESENT)).toBe('scar');
  });
});

describe('Фрагменты', () => {
  it('добавляются один раз, сюжетный не теряется при смерти', () => {
    const s = defaultSave();
    expect(addFragment(s, 'backHeat')).toBe(true);
    expect(addFragment(s, 'backHeat')).toBe(false);
    expect(addFragment(s, 'nope')).toBe(false);
    addFragment(s, 'bellShard');
    loseFragments(s);
    expect(s.fragments).toEqual(['bellShard']);
    expect(hasFragment(s, 'backHeat')).toBe(false);
    expect(Object.keys(FRAGMENTS).length).toBeGreaterThanOrEqual(3);
  });
});

describe('Враги с двумя состояниями', () => {
  it('Пустокожий: Отпечаток медленнее и уязвимее, Шрам сильнее страдает от комбо', () => {
    const s = ENEMY_DEFS.hollow.stats;
    expect(s.past.speed).toBeLessThan(s.present.speed);
    expect(s.past.dmgMul).toBeGreaterThan(s.present.dmgMul);
    expect(s.present.comboMul).toBeGreaterThan(s.past.comboMul);
  });
  it('Звонкая Тень под бронёй, пока не оглушена', () => {
    const e = createEnemy('shadow', 0, 0);
    expect(enemyMods({}, e).shield).toBeGreaterThan(0.5);
    e.exposed = 3;
    expect(enemyMods({}, e).shield).toBe(0);
  });
  it('сдвиг врага меняет таблицу параметров', () => {
    const e = createEnemy('hollow', 0, 0);
    expect(enemyMods({}, e).dmgMul).toBe(1);
    shiftTimeline(e.tl);
    expect(enemyMods({}, e).dmgMul).toBeGreaterThan(1);
  });
});

describe('Объекты окружения', () => {
  it('мост проходим только в прошлом', () => {
    const b = createProp('bridge', 0, 0, { w: 64, h: 48 });
    expect(propWalkRect(b)).toBeNull();
    shiftTimeline(b.tl);
    expect(propWalkRect(b)).toBe(b);
  });
  it('камень памяти твёрдый только в прошлом', () => {
    const st = createProp('memoryStone', 100, 100);
    expect(propFoot(st)).toBeNull();
    shiftTimeline(st.tl);
    expect(propFoot(st)).toMatchObject({ w: PROP_KINDS.memoryStone.foot.w });
  });
  it('пролёт лестницы существует в своей версии', () => {
    const s = createProp('stair', 0, 0, { exists: PRESENT });
    expect(s.tl.phase).toBe(PAST);
    expect(propWalkRect(s)).toBeNull();
    shiftTimeline(s.tl);
    expect(propWalkRect(s)).toBe(s);
  });
});
