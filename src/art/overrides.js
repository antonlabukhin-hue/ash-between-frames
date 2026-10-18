// Ручные PNG-спрайты поверх кодовых. Если в public/sprites/manifest.json есть кадр —
// он заменяет процедурный; если нет — работает процедурный (fallback).
// Ключи кадров — смысловые и короткие, чтобы художнику было что рисовать:
//   hero/<down|up|side>/walk<0-5>, hero/<dir>/swing<1-3>_<0-4>,
//   <враг>/<past|present>/f<n>, mel/<w|imprint|scar>/f<0-15>, prop/<вид>/<фаза>/f<n>.

// Ключ ручного кадра героя: прицел, плащ, заряды браслета не различаются —
// художник рисует позу целиком, отражение влево делает движок.
export function heroOverrideKey(o, q) {
  if (q.swing >= 0) return `hero/${o.dir}/swing${o.swingStep || 1}_${q.swing}`;
  return `hero/${o.dir}/walk${q.walk}`;
}

export const enemyOverrideKey = (kind, phase, frame) => `${kind}/${phase}/${frame}`;
export const propOverrideKey = (kind, phase, frame) => `prop/${kind}/${phase}/f${frame}`;

// manifest: { version, sheets: [{ image, outline?, frames: { key: [x, y, w, h, ax, ay] } }] }
export function parseManifest(json) {
  const out = new Map();
  if (!json || !Array.isArray(json.sheets)) return out;
  for (const sh of json.sheets) {
    if (!sh || typeof sh.image !== 'string' || !sh.frames) continue;
    for (const [key, f] of Object.entries(sh.frames)) {
      if (!Array.isArray(f) || f.length < 6 || f.some((v) => typeof v !== 'number')) continue;
      const [x, y, w, h, ax, ay] = f;
      if (w <= 0 || h <= 0) continue;
      out.set(key, { image: sh.image, x, y, w, h, ax, ay, outline: !!sh.outline });
    }
  }
  return out;
}

// Загрузка: манифест и картинки; по готовности — onReady (сбросить атлас).
export function createOverrides() {
  const st = { frames: new Map(), images: new Map(), ready: false };
  st.get = (key) => {
    const f = st.frames.get(key);
    if (!f) return null;
    const img = st.images.get(f.image);
    return img && img.complete && img.naturalWidth ? { ...f, img } : null;
  };
  st.load = async (base, onReady) => {
    let json;
    try {
      const res = await fetch(`${base}sprites/manifest.json`, { cache: 'no-cache' });
      if (!res.ok) return false;
      json = await res.json();
    } catch {
      return false;
    }
    st.frames = parseManifest(json);
    const names = new Set([...st.frames.values()].map((f) => f.image));
    await Promise.all(
      [...names].map(
        (n) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = img.onerror = () => resolve();
            img.src = `${base}sprites/${n}`;
            st.images.set(n, img);
          }),
      ),
    );
    st.ready = true;
    onReady?.();
    return true;
  };
  return st;
}
