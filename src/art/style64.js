// Стиль персонажей: «64 бита» (вариант C, src/art/chars64.js и npcs64.js) или прежние 32-битные кадры.
// По умолчанию — «64 бита»; ?npc=32 — вернуть прежние кадры, ?npc=64 — снова новые (запоминается).
function pick() {
  try {
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('npc') : null;
    if (q === '64' || q === '32') {
      localStorage.setItem('abf-npc', q);
      return q === '64';
    }
    return typeof localStorage === 'undefined' || localStorage.getItem('abf-npc') !== '32';
  } catch {
    return true;
  }
}
export const ART64 = pick();
