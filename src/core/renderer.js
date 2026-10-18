// Кадр с nearest-neighbor и ТОЛЬКО целым масштабом в физических пикселях устройства.
// Подбираем масштаб s так, чтобы высота кадра была около 224 (в пределах 180–248),
// ширина — по соотношению сторон 320…448. Остаток экрана — тёмные поля.
import { frameSize } from './frame.js';

export let W = 384;
export let H = 216;
export const MIN_W = 320;
export const MAX_W = 448;

export function createRenderer(canvas, stage) {
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;
  const r = { canvas, ctx, scale: 1, cssScale: 1, ox: 0, oy: 0, onResize: null };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const f = frameSize(window.innerWidth * dpr, window.innerHeight * dpr);
    const changed = f.w !== W || f.h !== H;
    W = f.w;
    H = f.h;
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    ctx.imageSmoothingEnabled = false;
    r.scale = f.scale;
    r.cssScale = f.scale / dpr;
    stage.style.width = `${(W * f.scale) / dpr}px`;
    stage.style.height = `${(H * f.scale) / dpr}px`;
    stage.style.setProperty('--px', `${r.cssScale}px`);
    const rect = stage.getBoundingClientRect();
    r.ox = rect.left;
    r.oy = rect.top;
    document.body.classList.toggle('portrait', window.innerHeight > window.innerWidth && 'ontouchstart' in window);
    if (changed) r.onResize?.();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();

  r.resize = resize;
  r.toCanvas = (cx, cy) => [(cx - r.ox) / r.cssScale, (cy - r.oy) / r.cssScale];
  return r;
}
