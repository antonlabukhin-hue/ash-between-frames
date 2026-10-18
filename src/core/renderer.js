// Кадр с nearest-neighbor. Мир — в логических пикселях W×H, холст — в RS раз плотнее
// (32-битная сетка), базовое преобразование контекста — scale(RS). Холст растягивается
// на экран целым масштабом в физических пикселях, а если так остаются большие поля —
// дробным «вписанным» (src/core/frame.js).
// Размер берётся из visualViewport за вычетом безопасных зон (вырез, полоска «домой»).
import { frameSize, RS } from './frame.js';

export let W = 480;
export let H = 270;
export { RS };
export const MIN_W = 320;
export const MAX_W = 512;

function viewport() {
  const vv = window.visualViewport;
  const cs = getComputedStyle(document.body);
  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  return {
    width: Math.max(1, (vv?.width || window.innerWidth) - padX),
    height: Math.max(1, (vv?.height || window.innerHeight) - padY),
  };
}

export function createRenderer(canvas, stage) {
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;
  const r = { canvas, ctx, rs: RS, scale: 1, cssScale: 1, exact: true, ox: 0, oy: 0, onResize: null, zoom: 1 };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const vp = viewport();
    const f = frameSize(vp.width * dpr, vp.height * dpr, RS, r.zoom);
    const changed = f.w !== W || f.h !== H;
    W = f.w;
    H = f.h;
    if (canvas.width !== W * RS || canvas.height !== H * RS) {
      canvas.width = W * RS;
      canvas.height = H * RS;
    }
    ctx.imageSmoothingEnabled = false;
    r.scale = f.scale;
    r.exact = f.exact;
    // CSS-пикселей на один логический пиксель мира
    r.cssScale = (f.scale * RS) / dpr;
    const cw = W * r.cssScale;
    const chh = H * r.cssScale;
    stage.style.width = `${cw}px`;
    stage.style.height = `${chh}px`;
    // размер HTML-интерфейса — от высоты сцены, а не от логического кадра
    stage.style.setProperty('--px', `${chh / 224}px`);
    // масштаб сенсорных кнопок от ширины сцены (телефон — меньше, планшет — крупнее)
    stage.style.setProperty('--ui-scale', `${Math.max(0.82, Math.min(1.18, cw / 760))}`);
    const rect = stage.getBoundingClientRect();
    r.ox = rect.left;
    r.oy = rect.top;
    const touch = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
    document.body.classList.toggle('portrait', window.innerHeight > window.innerWidth && touch);
    if (changed) r.onResize?.();
  }
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(resize, 220), { passive: true });
  window.visualViewport?.addEventListener('resize', resize, { passive: true });
  resize();

  r.resize = resize;
  // Камера ближе или дальше (def.zoom комнаты); меняет размер мира в кадре
  r.setZoom = (z) => {
    if (z === r.zoom) return;
    r.zoom = z;
    resize();
  };
  // Сбросить преобразование к базовому (логические пиксели мира).
  r.begin = () => ctx.setTransform(RS, 0, 0, RS, 0, 0);
  // Экран → логические координаты кадра (мышь, касания).
  r.toCanvas = (cx, cy) => {
    const rect = stage.getBoundingClientRect();
    return [((cx - rect.left) * W) / rect.width, ((cy - rect.top) * H) / rect.height];
  };
  return r;
}
