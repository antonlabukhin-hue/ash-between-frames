// Холст 384×216 с nearest-neighbor. Масштаб целый, если экран позволяет (≥2),
// иначе дробный, чтобы на телефоне картинка занимала весь экран.
// Ширина кадра подстраивается под соотношение сторон (16:9 … 19.5:9), высота постоянна.
export let W = 384;
export const MIN_W = 384;
export const MAX_W = 468;
export const H = 216;

export function createRenderer(canvas, stage) {
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;
  const r = { canvas, ctx, scale: 1, ox: 0, oy: 0, integer: true };

  function resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const aspect = vw / vh;
    const want = Math.max(MIN_W, Math.min(MAX_W, Math.round((H * aspect) / 2) * 2));
    if (want !== W) {
      W = want;
      canvas.width = W;
      ctx.imageSmoothingEnabled = false;
    }
    let s = Math.min(vw / W, vh / H);
    if (r.integer && s >= 2) s = Math.floor(s);
    r.scale = s;
    stage.style.width = `${Math.round(W * s)}px`;
    stage.style.height = `${Math.round(H * s)}px`;
    stage.style.setProperty('--px', `${s}px`);
    const rect = stage.getBoundingClientRect();
    r.ox = rect.left;
    r.oy = rect.top;
    document.body.classList.toggle('portrait', vh > vw && 'ontouchstart' in window);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();

  r.resize = resize;
  r.toCanvas = (cx, cy) => [(cx - r.ox) / r.scale, (cy - r.oy) / r.scale];
  r.setInteger = (v) => {
    r.integer = v;
    resize();
  };
  return r;
}
