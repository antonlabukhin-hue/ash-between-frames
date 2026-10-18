// Чистая функция подбора кадра под физическое разрешение экрана.
// 32-битная сетка: мир считается в логических пикселях (тайл 16), а холст — в RS раз
// плотнее. Спрайты и комнаты запекаются с той же плотностью, поэтому на экране вдвое
// больше деталей, а игровая логика не меняется.
//
// Масштаб холста к экрану — целый, если так закрывается ≥ 92 % экрана (мелкая сетка
// почти всегда это позволяет). Иначе — дробный «вписанный» масштаб без пустых полей.

export const RS = 2;
export const TARGET_H = 240;
export const LIMITS = { minH: 180, maxH: 270, minW: 320, maxW: 512 };
const COVER_OK = 0.92;

const even = (v) => v - (v % 2);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function frameSize(devW, devH, rs = RS) {
  let best = null;
  for (let s = 1; s <= 16; s++) {
    const h = even(Math.floor(devH / (s * rs)));
    const w = even(Math.floor(devW / (s * rs)));
    if (h < LIMITS.minH && s > 1) break;
    const fh = clamp(h, LIMITS.minH, LIMITS.maxH);
    const fw = clamp(w, LIMITS.minW, LIMITS.maxW);
    if (fh * rs * s > devH || fw * rs * s > devW) continue;
    const cover = ((fw * rs * s) / devW) * ((fh * rs * s) / devH);
    const score = cover - (Math.abs(fh - TARGET_H) / TARGET_H) * 0.5;
    if (!best || score > best.score) best = { w: fw, h: fh, scale: s, cover, score };
  }
  if (best && best.cover >= COVER_OK) return { w: best.w, h: best.h, rs, scale: best.scale, exact: true };
  // дробный масштаб: высота около цели, ширина — по соотношению сторон экрана
  const h = even(clamp(Math.round(Math.min(TARGET_H, devH / rs)), LIMITS.minH, LIMITS.maxH));
  const w = even(clamp(Math.round((h * devW) / devH), LIMITS.minW, LIMITS.maxW));
  const scale = Math.min(devW / (w * rs), devH / (h * rs));
  return { w, h, rs, scale, exact: false };
}
