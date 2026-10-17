// Сборка карт кодом: так комнаты не «съезжают» из-за опечатки в строке.
import { mulberry32 } from '../core/math.js';

export const T = (t) => t * 16 + 8; // центр тайла
export const TOP = (t) => t * 16; // край тайла

export function grid(w, h, ch = '#') {
  return Array.from({ length: h }, () => Array(w).fill(ch));
}

export function fill(m, x, y, w, h, ch) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (m[j] && m[j][i] !== undefined) m[j][i] = ch;
}

export function put(m, x, y, ch) {
  if (m[y] && m[y][x] !== undefined) m[y][x] = ch;
}

// Заменить часть символов from на to случайно.
export function scatter(m, seed, x, y, w, h, from, to, chance) {
  const rnd = mulberry32(seed);
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) if (m[j]?.[i] === from && rnd() < chance) m[j][i] = to;
  }
}

export function ellipse(m, cx, cy, rx, ry, ch) {
  for (let j = 0; j < m.length; j++) {
    for (let i = 0; i < m[0].length; i++) {
      const dx = (i - cx) / rx;
      const dy = (j - cy) / ry;
      if (dx * dx + dy * dy <= 1) m[j][i] = ch;
    }
  }
}

export const rows = (m) => m.map((r) => r.join(''));
