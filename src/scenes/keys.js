// Подписи кнопок под текущее устройство — подсказки появляются только перед действием.
const LABELS = {
  kb: { move: 'WASD', attack: 'ЛКМ / J', dodge: 'ПКМ / Shift', shift: 'Q', interact: 'E', rift: 'Пробел', echo: 'R' },
  pad: { move: 'левый стик', attack: 'X', dodge: 'A', shift: 'Y', interact: 'B', rift: 'RB', echo: 'R3' },
  touch: { move: 'левый стик', attack: '⚔', dodge: '↷', shift: '⧗', interact: '✋', rift: '✦', echo: '◐' },
};

export function key(g, action) {
  const d = LABELS[g.input.device] ? g.input.device : 'kb';
  return `<b>${LABELS[d][action]}</b>`;
}
