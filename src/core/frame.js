// Чистая функция подбора кадра под физическое разрешение экрана.
// 32-битная сетка: мир считается в логических пикселях (тайл 16), а холст — в RS раз
// плотнее. Спрайты и комнаты запекаются с той же плотностью, поэтому на экране вдвое
// больше деталей, а игровая логика не меняется.
//
// Масштаб холста к экрану — целый, если так закрывается ≥ 92 % экрана и высота мира
// близка к цели (±30). Иначе — дробный «вписанный» масштаб без пустых полей: герой и
// враги должны быть крупными и читаемыми (около 1/8 высоты кадра).

// Плотность сетки: 4 — «64 бита» (по умолчанию, вдвое больше пикселей на ту же фигуру).
// ?rs=2 — прежние «32 бита», ?rs=3 — середина; выбор запоминается.
function pickRS() {
  try {
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('rs') : null;
    if (q && ['2', '3', '4'].includes(q)) {
      localStorage.setItem('abf-rs', q);
      return +q;
    }
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem('abf-rs') : null;
    return v && ['2', '3', '4'].includes(v) ? +v : 4;
  } catch {
    return 4;
  }
}
export const RS = pickRS();
export const TARGET_H = 216;
const NEAR = 30;
export const LIMITS = { minH: 180, maxH: 270, minW: 320, maxW: 512 };
const COVER_OK = 0.92;

const even = (v) => v - (v % 2);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// zoom > 1 — камера ближе: мира в кадре меньше, герои крупнее (мирные сцены).
export function frameSize(devW, devH, rs = RS, zoom = 1) {
  const target = even(Math.round(TARGET_H / zoom));
  const L = zoom === 1 ? LIMITS : { minH: Math.round(LIMITS.minH / zoom), maxH: Math.round(LIMITS.maxH / zoom), minW: Math.round(LIMITS.minW / zoom), maxW: Math.round(LIMITS.maxW / zoom) };
  let best = null;
  for (let s = 1; s <= 16; s++) {
    const h = even(Math.floor(devH / (s * rs)));
    const w = even(Math.floor(devW / (s * rs)));
    if (h < L.minH && s > 1) break;
    const fh = clamp(h, L.minH, L.maxH);
    const fw = clamp(w, L.minW, L.maxW);
    if (fh * rs * s > devH || fw * rs * s > devW) continue;
    const cover = ((fw * rs * s) / devW) * ((fh * rs * s) / devH);
    const score = cover - (Math.abs(fh - target) / target) * 0.5;
    if (!best || score > best.score) best = { w: fw, h: fh, scale: s, cover, score };
  }
  if (best && best.cover >= COVER_OK && Math.abs(best.h - target) <= NEAR / zoom) return { w: best.w, h: best.h, rs, scale: best.scale, exact: true };
  // дробный масштаб: высота около цели, ширина — по соотношению сторон экрана
  const h = even(clamp(Math.round(Math.min(target, devH / rs)), L.minH, L.maxH));
  const w = even(clamp(Math.round((h * devW) / devH), L.minW, L.maxW));
  const scale = Math.min(devW / (w * rs), devH / (h * rs));
  return { w, h, rs, scale, exact: false };
}
