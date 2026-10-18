// Scale2x (EPX): удвоение пиксель-арта со скруглением диагоналей. Старые 16-битные
// кадры и комнаты рисуются в логических пикселях и при запекании в 32-битную сетку
// проходят через Scale2x — лесенки превращаются в ровные наклоны, без размытия и новых цветов.

// src, dst — Uint32Array (RGBA одним словом); dst размером (2w)×(2h).
export function scale2xWords(src, w, h, dst) {
  const W2 = w * 2;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const up = (y > 0 ? y - 1 : y) * w;
    const dn = (y < h - 1 ? y + 1 : y) * w;
    const o0 = y * 2 * W2;
    const o1 = o0 + W2;
    for (let x = 0; x < w; x++) {
      const P = src[row + x];
      const A = src[up + x];
      const D = src[dn + x];
      const C = src[row + (x > 0 ? x - 1 : x)];
      const B = src[row + (x < w - 1 ? x + 1 : x)];
      let e0 = P;
      let e1 = P;
      let e2 = P;
      let e3 = P;
      if (A !== D && C !== B) {
        if (C === A) e0 = A;
        if (A === B) e1 = B;
        if (C === D) e2 = C;
        if (D === B) e3 = D;
      }
      const ox = x * 2;
      dst[o0 + ox] = e0;
      dst[o0 + ox + 1] = e1;
      dst[o1 + ox] = e2;
      dst[o1 + ox + 1] = e3;
    }
  }
  return dst;
}

// Ближайший сосед в целое число раз (для rs ≠ 2).
export function nearestWords(src, w, h, dst, s) {
  const Ws = w * s;
  for (let y = 0; y < h * s; y++) {
    const sr = Math.floor(y / s) * w;
    const o = y * Ws;
    for (let x = 0; x < Ws; x++) dst[o + x] = src[sr + Math.floor(x / s)];
  }
  return dst;
}

const words = (data) => new Uint32Array(data.buffer, data.byteOffset, data.byteLength >> 2);

// ImageData → ImageData в s раз крупнее (Scale2x при s = 2).
export function upscaleImageData(img, s = 2) {
  const out = new ImageData(img.width * s, img.height * s);
  const src = words(img.data);
  const dst = words(out.data);
  if (s === 2) scale2xWords(src, img.width, img.height, dst);
  else nearestWords(src, img.width, img.height, dst, s);
  return out;
}

// Холст → новый холст в s раз крупнее.
export function upscaleCanvas(c, s = 2) {
  const img = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
  const out = document.createElement('canvas');
  out.width = c.width * s;
  out.height = c.height * s;
  out.getContext('2d').putImageData(upscaleImageData(img, s), 0, 0);
  return out;
}
