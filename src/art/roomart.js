// Рисованные слои комнат (гибридный конвейер, docs/ART_PIPELINE.md).
// Художник или генератор рисует фон по шаблону комнаты (scripts/art-template.mjs),
// после согласования он попадает в public/art/rooms/ и описывается в manifest.json:
//
//   { "version": 1, "rooms": { "road": {
//       "floor": { "present": "road/floor-present.png", "past": "road/floor-past.png" },
//       "over":  { "present": "road/over-present.png" } } } }
//
// floor — всё под персонажами (пол, стены, низкий декор), прозрачные места — пустота и небо;
// over — то, что поверх персонажей (кроны, передний план). Картинка — в плотной сетке:
// ширина = комната·16·RS. Если слоя нет — работает кодовый маляр комнаты.

export const roomArt = { rooms: {}, images: new Map(), ready: false };

export function parseRoomArt(json) {
  const out = {};
  const rooms = json && typeof json === 'object' ? json.rooms : null;
  if (!rooms || typeof rooms !== 'object') return out;
  for (const [id, layers] of Object.entries(rooms)) {
    if (!layers || typeof layers !== 'object') continue;
    for (const layer of ['floor', 'over']) {
      const ph = layers[layer];
      if (!ph || typeof ph !== 'object') continue;
      for (const phase of ['present', 'past']) {
        if (typeof ph[phase] === 'string' && /\.(png|webp)$/i.test(ph[phase])) ((out[id] ||= {})[layer] ||= {})[phase] = ph[phase];
      }
    }
  }
  return out;
}

export async function loadRoomArt(base, onReady) {
  let json;
  try {
    const res = await fetch(`${base}art/rooms/manifest.json`, { cache: 'no-cache' });
    if (!res.ok) return false;
    json = await res.json();
  } catch {
    return false;
  }
  roomArt.rooms = parseRoomArt(json);
  const files = new Set();
  for (const layers of Object.values(roomArt.rooms)) for (const ph of Object.values(layers)) for (const f of Object.values(ph)) files.add(f);
  await Promise.all(
    [...files].map(
      (f) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = img.onerror = () => resolve();
          img.src = `${base}art/rooms/${f}`;
          roomArt.images.set(f, img);
        }),
    ),
  );
  roomArt.ready = true;
  onReady?.();
  return true;
}

// Готовая картинка слоя или null (тогда — кодовый маляр).
export function artFor(roomId, layer, phase = 'present') {
  const f = roomArt.rooms[roomId]?.[layer]?.[phase];
  const img = f && roomArt.images.get(f);
  return img && img.complete && img.naturalWidth ? img : null;
}

// Слой поверх персонажей (мировые координаты, контекст уже сдвинут камерой).
export function drawArtOver(g, ctx, cx, cy, W, H) {
  const img = artFor(g.room.id, 'over', 'present');
  if (!img) return;
  const k = img.naturalWidth / g.room.pxW;
  const sx = Math.max(0, cx);
  const sy = Math.max(0, cy);
  const sw = Math.min(g.room.pxW - sx, W);
  const sh = Math.min(g.room.pxH - sy, H);
  if (sw > 0 && sh > 0) ctx.drawImage(img, sx * k, sy * k, sw * k, sh * k, sx, sy, sw, sh);
}
