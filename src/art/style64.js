// Стиль персонажей: «64 бита» (вариант C, src/art/chars64.js и npcs64.js) или прежние 32-битные кадры.
// Пока на согласовании — включается флагом ?npc=64 (запоминается); ?npc=32 — вернуть прежние.
function pick() {
  try {
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('npc') : null;
    if (q === '64' || q === '32') {
      localStorage.setItem('abf-npc', q);
      return q === '64';
    }
    return typeof localStorage !== 'undefined' && localStorage.getItem('abf-npc') === '64';
  } catch {
    return false;
  }
}
export const ART64 = pick();
