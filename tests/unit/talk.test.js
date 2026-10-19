import { describe, it, expect } from 'vitest';
import { talkMenu, PRESENT, BYE } from '../../src/story/talk.js';

describe('меню разговора', () => {
  const topics = [{ id: 'who', text: 'Кто ты?' }, { id: 'way', text: 'Куда идти?' }];
  it('новые темы отмечены, прочитанные — нет, но остаются', () => {
    const m = talkMenu(topics, { who: true }, 2);
    expect(m[0]).toMatchObject({ id: 'who', text: 'Кто ты?', sub: 'уже спрашивал' });
    expect(m[1].text).toBe('• Куда идти?');
  });
  it('показать воспоминание и уйти — всегда в конце; без воспоминаний показ недоступен', () => {
    const m = talkMenu(topics, {}, 0);
    expect(m.slice(-2).map((o) => o.id)).toEqual([PRESENT, BYE]);
    expect(m.at(-2).disabled).toBe(true);
    expect(talkMenu(topics, {}, 3).at(-2).disabled).toBe(false);
  });
});
