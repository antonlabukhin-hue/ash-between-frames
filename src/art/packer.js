// Укладка прямоугольников полками (shelf packing). Чистая логика — покрыта тестом.
export function createShelfPacker(width, height, pad = 1) {
  return { width, height, pad, shelves: [], top: 0, used: 0 };
}

export function packRect(pk, w, h) {
  const W = w + pk.pad;
  const H = h + pk.pad;
  if (W > pk.width || H > pk.height) return null;
  // ищем полку подходящей высоты с местом
  let best = null;
  for (const s of pk.shelves) {
    if (s.h >= H && s.h <= H * 1.6 && s.x + W <= pk.width && (!best || s.h < best.h)) best = s;
  }
  if (!best) {
    if (pk.top + H > pk.height) return null;
    best = { y: pk.top, h: H, x: 0 };
    pk.shelves.push(best);
    pk.top += H;
  }
  const r = { x: best.x, y: best.y, w, h };
  best.x += W;
  pk.used += w * h;
  return r;
}

export const packerFill = (pk) => pk.used / (pk.width * pk.height);
