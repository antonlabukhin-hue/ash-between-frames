// Первая локация «Колокольные Ворота» в стиле Enhanced 16-bit.
// Здесь: палитра локации, запекание Площади без центра (пол, фасады, крыши, парапет),
// параллакс неба и объекты с двумя состояниями. См. docs/LEVEL_01_ART_AND_LAYOUT.md.
import { createPainter } from './painter.js';
import { hash2, mulberry32 } from '../core/math.js';
import { px, line, ring, disc } from './sprites.js';
import { PAST } from '../timeline/timeline.js';
import { PROP_KINDS } from '../world/props.js';
import { inIslands } from '../world/memory.js';

// ── палитра локации ─────────────────────────────────────────────────────
export const L = {
  ink: '#07080f', night: '#0b0d1a', navy: '#141a2c', navy2: '#1c2440',
  // камень стен — холодный синий
  wall0: '#1b2130', wall1: '#2a3346', wall2: '#36415a', wall3: '#4a5874', wall4: '#6b7a96',
  // пол площади — серо-фиолетовый
  fl0: '#1a1820', fl1: '#26232f', fl2: '#302c3a', fl3: '#3a3646', fl4: '#47425a', fl5: '#5a5470', mortar: '#131118',
  plaster0: '#2b2a3c', plaster1: '#38364c', plaster2: '#46435c',
  roof0: '#1f1626', roof1: '#2e1f2f', roof2: '#3e2a3a', roof3: '#523848',
  wood0: '#2e2018', wood1: '#4a3424', wood2: '#6e4e34',
  bronze0: '#4a3418', bronze1: '#7a5a20', bronze2: '#b08a3a', bronze3: '#e6c06a', bronze4: '#fff0b0',
  // прошлое
  amber0: '#7a4a18', amber1: '#b8721f', amber2: '#e0a040', amber3: '#ffd27a', cream: '#ece4cf', live: '#3a8a80', liveHi: '#7fd6c8',
  // настоящее
  sc0: '#2a1830', sc1: '#4a0c1e', sc2: '#86163a', sc3: '#c8284a', sc4: '#ff5a7a',
  water0: '#16384a', water1: '#235a72', water2: '#3d8aa0', water3: '#9ee4f0',
  moss: '#2e3a2a', moss2: '#43553a',
};

// ── геометрия площади (тайлы 16) ────────────────────────────────────────
export const SQ = {
  w: 30, h: 23, sky: 3, // ряды неба (прозрачные в холсте комнаты)
  roofY: 48, facadeY: 60, floorY: 96,
  center: [15 * 16, 13 * 16 + 4], // центр круговой мостовой (постамент)
  ringR: 98,
  archX0: 14 * 16, archX1: 16 * 16,
  alley: [12, 13], // ряды прохода в переулок справа (закрыт обломками)
};

// Дома северной стороны: [x0, x1, тип]
const HOUSES = [
  [32, 112, 'shop'],
  [112, 208, 'tall'],
  [208, 272, 'arch'],
  [272, 368, 'round'],
  [368, 448, 'ruin'],
];

// ── запекание ───────────────────────────────────────────────────────────
export function paintSquare(ctx, room) {
  const W = room.pxW;
  const H = room.pxH;
  const p = createPainter(W, H);
  room.windows = [];
  paintFloor(p, room);
  paintFacades(p, room);
  paintSides(p, room);
  paintParapet(p, room);
  paintWallShadows(p, room);
  ctx.putImageData(p.img, 0, 0);
}

function stoneTone(id, ring) {
  const r = hash2(id, ring, 91);
  return r < 0.18 ? L.fl2 : r < 0.86 ? L.fl3 : L.fl4;
}

function paintFloor(p, room) {
  const [cx, cy] = SQ.center;
  const x0 = 32;
  const x1 = room.pxW - 32;
  const y0 = SQ.floorY;
  const y1 = room.pxH - 16;
  // заранее — лужи и трещины
  const rnd = mulberry32(7);
  const puddles = [];
  for (let i = 0; i < 5; i++) puddles.push({ x: x0 + 20 + rnd() * (x1 - x0 - 40), y: y0 + 20 + rnd() * (y1 - y0 - 40), rx: 8 + rnd() * 10, ry: 3 + rnd() * 3 });
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const dx = x - cx;
      const dy = (y - cy) * 1.32; // 3/4: круг на земле — эллипс
      const r = Math.hypot(dx, dy);
      let c;
      if (r < SQ.ringR) {
        // круговая мостовая кольцами
        const ringW = 9;
        const ring = Math.floor(r / ringW);
        const local = r - ring * ringW;
        const mid = (ring + 0.5) * ringW;
        const n = Math.max(6, Math.floor((Math.PI * 2 * mid) / 13));
        const a = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2);
        const sv = a * n + (ring % 2) * 0.5;
        const seg = Math.floor(sv);
        const segLocal = (sv - seg) * ((Math.PI * 2 * mid) / n);
        if (local < 1 || segLocal < 1) c = (seg + ring) % 3 === 0 ? L.mortar : L.fl1;
        else {
          c = stoneTone(seg + ring * 97, ring);
          if (local < 2) c = dy > 0 ? L.fl2 : L.fl4; // фаска к центру
        }
      } else if (r < SQ.ringR + 8) {
        // бордюр
        const a = Math.atan2(dy, dx) * SQ.ringR;
        const seg = Math.floor(a / 12);
        c = Math.abs((a % 12) + 12) % 12 < 1 ? L.mortar : (r - SQ.ringR < 2 ? L.fl5 : hash2(seg, 3, 5) > 0.5 ? L.fl4 : '#524c66');
        if (r - SQ.ringR > 6.5) c = L.fl1;
      } else {
        // прямоугольные плиты рядами со сдвигом
        const RH = 12;
        const CW = 26;
        const row = Math.floor((y - y0) / RH);
        const ly = (y - y0) % RH;
        const off = (row % 2) * 13 + Math.floor(hash2(row, 1, 2) * 8);
        const sx = x + off;
        const col = Math.floor(sx / CW);
        const lx = sx - col * CW;
        const len = CW - 1 - Math.floor(hash2(col, row, 4) * 3);
        if (ly === 0 || lx === 0 || lx >= len) c = (lx + ly) % 4 === 0 ? L.mortar : L.fl1;
        else {
          c = stoneTone(col * 31 + row, row);
          if (ly === 1) c = c === L.fl2 ? L.fl3 : L.fl4; // свет сверху
          else if (ly === RH - 1) c = L.fl2;
          if (hash2(x, y, 41) < 0.05) c = L.fl2; // крап
        }
      }
      // крупные пятна износа с дизерингом по краю
      const wear = hash2(Math.floor(x / 24), Math.floor(y / 20), 33);
      if (c !== L.mortar && wear > 0.82 && ((x + y) & 1) === 0) c = shadeDown(c);
      // мох в швах у краёв
      if (c === L.mortar && hash2(x, y, 9) < 0.08 && (y > y1 - 40 || x < x0 + 30 || x > x1 - 30)) c = L.moss;
      p.set(x, y, c);
    }
  }
  // лужи с отражением неба
  for (const q of puddles) {
    for (let j = -q.ry; j <= q.ry; j++) {
      const w = Math.floor(q.rx * Math.sqrt(1 - (j * j) / (q.ry * q.ry)));
      for (let i = -w; i <= w; i++) {
        const edge = Math.abs(i) >= w - 1 || Math.abs(j) >= q.ry - 0.5;
        p.set(q.x + i, q.y + j, edge ? L.navy2 : j < 0 ? L.wall1 : L.navy);
      }
      if (j === 0) for (let i = -w + 3; i < w - 6; i += 5) p.set(q.x + i, q.y, L.wall3);
    }
  }
  // трещины
  for (let k = 0; k < 9; k++) {
    let x = x0 + rnd() * (x1 - x0);
    let y = y0 + rnd() * (y1 - y0);
    if (Math.hypot(x - cx, (y - cy) * 1.32) < 24) continue;
    for (let s = 0; s < 14; s++) {
      p.set(x, y, L.fl0);
      x += Math.round(rnd() * 2 - 1);
      y += rnd() > 0.5 ? 1 : 0;
      if (rnd() > 0.7) x += rnd() > 0.5 ? 1 : -1;
    }
  }
}

function shadeDown(c) {
  const order = [L.fl1, L.fl2, L.fl3, L.fl4, L.fl5];
  const i = order.indexOf(c);
  return i > 0 ? order[i - 1] : c;
}

// ── фасады ───────────────────────────────────────────────────────────────
function paintRoof(p, x0, x1, broken) {
  const y0 = SQ.roofY;
  const y1 = SQ.facadeY;
  for (let y = 0; y < SQ.roofY; y++) for (let x = x0; x < x1; x++) p.set(x, y, '#000000', 0);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const row = Math.floor((y - y0) / 3);
      const off = (row % 2) * 3;
      const lx = (x - x0 + off) % 6;
      let c = row % 2 ? L.roof2 : L.roof1;
      if (lx === 0) c = L.roof0;
      if ((y - y0) % 3 === 2) c = L.roof0;
      if (y === y0) c = L.roof3;
      p.set(x, y, c);
    }
  }
  // конёк и дымоход
  for (let x = x0; x < x1; x++) p.set(x, y0 - 1, L.roof0);
  const ch = x0 + Math.floor((x1 - x0) * 0.7);
  p.rect(ch, y0 - 9, 6, 9, L.wall1);
  p.rect(ch - 1, y0 - 10, 8, 2, L.wall3);
  if (broken) {
    // пролом с малиновым краем
    const bx = x0 + 14;
    for (let j = 0; j < 9; j++) {
      const w = 22 - j * 2;
      for (let i = 0; i < w; i++) p.set(bx + i + j, y0 + j, j === 0 || i === 0 || i === w - 1 ? L.sc2 : L.ink);
    }
  }
  // карниз
  for (let x = x0; x < x1; x++) {
    p.set(x, y1 - 1, L.wall4);
    p.set(x, y1, L.wall0);
  }
}

function paintPlaster(p, x0, x1, y0, y1, tone) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const r = hash2(x, y, 17);
      let c = tone[1];
      if (r > 0.93) c = tone[2];
      else if (r < 0.08) c = tone[0];
      p.set(x, y, c);
    }
  }
  // цоколь из камня
  for (let y = y1 - 8; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const row = Math.floor((y - (y1 - 8)) / 4);
      const lx = (x - x0 + row * 5) % 10;
      let c = L.wall2;
      if (lx === 0 || (y - (y1 - 8)) % 4 === 0) c = L.wall0;
      else if ((y - (y1 - 8)) % 4 === 1) c = L.wall3;
      p.set(x, y, c);
    }
  }
  // угловые столбы
  for (let y = y0; y < y1; y++) {
    p.set(x0, y, L.wall0);
    p.set(x0 + 1, y, L.wall3);
    p.set(x1 - 1, y, L.wall0);
  }
}

function windowFrame(p, room, x, y, w, h, kind = 'win') {
  p.rect(x - 1, y - 1, w + 2, h + 2, L.wood0);
  p.rect(x, y, w, h, L.ink);
  // подоконник
  p.rect(x - 2, y + h + 1, w + 4, 1, L.wall4);
  p.rect(x - 2, y + h + 2, w + 4, 1, L.wall0);
  room.windows.push({ x, y, w, h, kind });
}

function paintFacades(p, room) {
  const fy = SQ.facadeY;
  const by = SQ.floorY;
  for (const [x0, x1, type] of HOUSES) {
    if (type === 'arch') {
      paintArch(p, room, x0, x1);
      continue;
    }
    paintRoof(p, x0, x1, type === 'ruin');
    const tone = type === 'tall' ? [L.plaster0, '#3a3348', L.plaster2] : type === 'round' ? [L.wall1, L.plaster1, L.plaster2] : [L.plaster0, L.plaster1, L.plaster2];
    paintPlaster(p, x0, x1, fy + 1, by, tone);
    if (type === 'shop') {
      // лавка «Хлеб и воск»: большая витрина, дверь, полосатый навес
      windowFrame(p, room, x0 + 10, fy + 13, 26, 13, 'shop');
      p.rect(x0 + 44, fy + 10, 12, 26, L.wood1);
      p.rect(x0 + 45, fy + 11, 10, 25, L.wood0);
      p.set(x0 + 53, fy + 23, L.bronze3);
      p.set(x0 + 53, fy + 24, L.bronze2);
      for (let x = x0 + 6; x < x0 + 60; x++) {
        const stripe = Math.floor((x - x0) / 4) % 2;
        p.set(x, fy + 7, stripe ? L.cream : L.amber1);
        p.set(x, fy + 8, stripe ? '#bfb6a0' : L.amber0);
        if ((x - x0) % 4 === 0) p.set(x, fy + 9, L.amber0);
      }
      windowFrame(p, room, x0 + 64, fy + 6, 8, 10);
      room.shopSign = { x: x0 + 40, y: fy + 4 };
    } else if (type === 'tall') {
      windowFrame(p, room, x0 + 12, fy + 6, 8, 10);
      windowFrame(p, room, x0 + 44, fy + 6, 8, 10);
      windowFrame(p, room, x0 + 76, fy + 6, 8, 10);
      // дверь с аркой
      p.rect(x0 + 26, fy + 16, 12, 20, L.wood1);
      p.rect(x0 + 27, fy + 14, 10, 2, L.wood1);
      p.rect(x0 + 28, fy + 17, 8, 19, L.wood0);
      p.rect(x0 + 31, fy + 17, 1, 19, L.wood1);
      windowFrame(p, room, x0 + 58, fy + 18, 10, 9);
    } else if (type === 'round') {
      // круглое окно-роза
      const cx = x0 + 48;
      const cy = fy + 14;
      for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) {
        const d = Math.hypot(i, j);
        if (d <= 8) p.set(cx + i, cy + j, d > 6.6 ? L.wall3 : L.ink);
      }
      room.windows.push({ x: cx - 6, y: cy - 6, w: 12, h: 12, kind: 'rose' });
      windowFrame(p, room, x0 + 14, fy + 18, 8, 10);
      windowFrame(p, room, x0 + 74, fy + 18, 8, 10);
    } else if (type === 'ruin') {
      windowFrame(p, room, x0 + 10, fy + 8, 8, 10);
      windowFrame(p, room, x0 + 56, fy + 8, 8, 10);
      // стена разрезана вертикальным провалом
      for (let y = fy; y < by - 4; y++) {
        const w = 3 + Math.floor(hash2(y, 2, 2) * 2);
        for (let i = 0; i < w; i++) p.set(x0 + 36 + i + (y % 5 === 0 ? 1 : 0), y, i === 0 || i === w - 1 ? L.sc1 : L.ink);
      }
      p.rect(x0 + 24, fy + 22, 10, 14, L.wood0);
    }
  }
}

function paintArch(p, room, x0, x1) {
  const fy = SQ.facadeY;
  const by = SQ.floorY;
  const ox0 = SQ.archX0;
  const ox1 = SQ.archX1;
  for (let y = 0; y < SQ.roofY - 12; y++) for (let x = x0; x < x1; x++) p.set(x, y, '#000000', 0);
  // каменная арка-ворота: кладка, проём с лестницей наверх
  for (let y = SQ.roofY - 12; y < by; y++) {
    for (let x = x0; x < x1; x++) {
      const row = Math.floor(y / 6);
      const lx = (x + (row % 2) * 6) % 12;
      let c = L.wall2;
      if (lx === 0 || y % 6 === 0) c = L.wall0;
      else if (y % 6 === 1) c = L.wall3;
      p.set(x, y, c);
    }
  }
  // зубцы наверху
  for (let x = x0; x < x1; x += 8) p.rect(x, SQ.roofY - 16, 5, 4, L.wall3);
  // проём: полукруглый верх
  const mx = (ox0 + ox1) / 2;
  const rr = (ox1 - ox0) / 2;
  for (let y = fy - 8; y < by; y++) {
    for (let x = ox0; x < ox1; x++) {
      const top = y < fy + 6 ? Math.hypot(x - mx + 0.5, y - (fy + 6)) < rr : true;
      if (!top) continue;
      // ступени уходят вверх, в темноту
      const step = Math.floor((by - y) / 5);
      const shade = Math.max(0, 3 - Math.floor(step / 2));
      const cols = [L.ink, L.wall0, L.wall1, L.wall2];
      p.set(x, y, (by - y) % 5 === 0 ? L.ink : cols[shade]);
    }
  }
  // замковый камень и герб (обломан)
  p.rect(mx - 3, fy - 12, 6, 6, L.wall4);
  p.rect(mx - 2, fy - 11, 4, 4, L.bronze1);
  p.set(mx + 1, fy - 11, L.sc3);
  // колонны по краям проёма
  for (const cx of [ox0 - 3, ox1]) {
    p.rect(cx, fy - 6, 3, by - fy + 6, L.wall3);
    p.rect(cx, fy - 6, 1, by - fy + 6, L.wall4);
  }
}

// Боковые дома видны сверху: крыши с водостоком, тень на мостовую.
function paintSides(p, room) {
  const W = room.pxW;
  const H = room.pxH;
  for (let y = SQ.roofY; y < H; y++) {
    for (const [x0, x1, edgeRight] of [[0, 32, true], [W - 32, W, false]]) {
      for (let x = x0; x < x1; x++) {
        const lx = edgeRight ? x - x0 : x1 - 1 - x;
        const row = Math.floor(y / 4);
        let c = (row + Math.floor(lx / 5)) % 2 ? L.roof1 : L.roof2;
        if (y % 4 === 3) c = L.roof0;
        if (lx >= 29) c = lx === 31 ? L.wall0 : L.wall3; // водосток
        p.set(x, y, c);
      }
    }
  }
  // проход в переулок справа — тёмный, завален ящиками
  const [r0, r1] = SQ.alley;
  for (let y = r0 * 16; y < (r1 + 1) * 16; y++) {
    for (let x = W - 32; x < W; x++) p.set(x, y, (x + y) % 7 === 0 ? L.navy : L.ink);
  }
  for (const [bx, by] of [[W - 30, r0 * 16 + 4], [W - 22, r0 * 16 + 12], [W - 28, r0 * 16 + 20]]) {
    p.rect(bx, by, 12, 9, L.wood1);
    p.rect(bx, by, 12, 1, L.wood2);
    p.line(bx, by, bx + 11, by + 8, L.wood0);
  }
  // южная граница вдоль крыш
  for (let y = SQ.roofY; y < SQ.floorY; y++) {
    p.set(31, y, L.wall0);
    p.set(W - 32, y, L.wall0);
  }
}

function paintParapet(p, room) {
  const W = room.pxW;
  const y0 = room.pxH - 16;
  for (let y = y0; y < room.pxH; y++) {
    for (let x = 0; x < W; x++) {
      if (x >= 15 * 16 && x < 17 * 16) continue; // вход с юга
      const lx = x % 16;
      let c = L.wall2;
      if (y === y0) c = L.wall4;
      else if (y === y0 + 1) c = L.wall3;
      else if (lx === 0) c = L.wall0;
      else if (y > y0 + 9) c = L.wall1;
      p.set(x, y, c);
    }
  }
}

// Ступенчатые тени от домов на мостовую (3 шага).
function paintWallShadows(p, room) {
  const W = room.pxW;
  for (let x = 32; x < W - 32; x++) {
    for (let j = 0; j < 7; j++) p.shade(x, SQ.floorY + j, j < 2 ? 0.55 : j < 4 ? 0.7 : 0.85);
  }
  for (let y = SQ.floorY; y < room.pxH - 16; y++) {
    for (let j = 0; j < 4; j++) {
      p.shade(32 + j, y, j < 2 ? 0.6 : 0.8);
      if (y < SQ.alley[0] * 16 || y >= (SQ.alley[1] + 1) * 16) p.shade(W - 33 - j, y, j < 2 ? 0.75 : 0.9);
    }
  }
}

// ── параллакс неба ──────────────────────────────────────────────────────
let skyLayers = null;
function buildSky() {
  const mk = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  // 1: небо полосами с дизерингом, луна, звёзды
  const sky = mk(512, 64);
  const s = sky.getContext('2d');
  const bands = ['#07080f', '#0b0d1a', '#11152a', '#181e38', '#202848', '#2a2f52'];
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 512; x++) {
      const f = (y / 64) * (bands.length - 1);
      const i = Math.floor(f);
      const dith = ((x + y) & 1) === 0 ? 0.25 : 0.75;
      s.fillStyle = f - i > dith ? bands[Math.min(bands.length - 1, i + 1)] : bands[i];
      s.fillRect(x, y, 1, 1);
    }
  }
  for (let i = 0; i < 40; i++) {
    s.fillStyle = hash2(i, 2, 1) > 0.8 ? '#ece4cf' : '#7e8193';
    s.fillRect(Math.floor(hash2(i, 1, 1) * 512), Math.floor(hash2(i, 3, 1) * 40), 1, 1);
  }
  for (let j = -11; j <= 11; j++) {
    const w = Math.floor(Math.sqrt(121 - j * j));
    for (let i = -w; i <= w; i++) {
      s.fillStyle = hash2(i >> 2, j >> 2, 5) > 0.75 ? '#bfc2cc' : '#e4e6ec';
      s.fillRect(400 + i, 22 + j, 1, 1);
    }
  }
  // 2: дальний город — силуэты крыш и шпилей
  const city = mk(512, 40);
  const c = city.getContext('2d');
  const rnd = mulberry32(5);
  let x = 0;
  while (x < 512) {
    const w = 10 + Math.floor(rnd() * 22);
    const h = 8 + Math.floor(rnd() * 18);
    c.fillStyle = '#141a2c';
    c.fillRect(x, 40 - h, w, h);
    if (rnd() > 0.6) {
      for (let k = 0; k < 6; k++) c.fillRect(x + w / 2 - 3 + k / 2, 40 - h - k * 2, 6 - k, 2);
    }
    if (rnd() > 0.5) {
      c.fillStyle = rnd() > 0.5 ? '#7a4a18' : '#2a3150';
      c.fillRect(x + 3 + Math.floor(rnd() * (w - 6)), 40 - h + 4, 2, 2);
    }
    x += w + Math.floor(rnd() * 3);
  }
  skyLayers = { sky, city };
}

// Висящая колокольня на чёрных нитях — один раз в кадре, на слое 2.
function drawTower(ctx, x, y, t) {
  const bob = Math.round(Math.sin(t * 0.7));
  for (const tx of [-10, 0, 12]) {
    ctx.fillStyle = '#050508';
    ctx.fillRect(x + tx, -40, 1, y + bob + 40 - 10);
  }
  ctx.fillStyle = '#1a2036';
  ctx.fillRect(x - 12, y - 30 + bob, 24, 30);
  ctx.fillStyle = '#232a44';
  ctx.fillRect(x - 12, y - 30 + bob, 3, 30);
  for (let k = 0; k < 8; k++) {
    ctx.fillStyle = '#1a2036';
    ctx.fillRect(x - 8 + k, y - 38 - k * 2 + bob, 16 - k * 2, 2);
  }
  ctx.fillStyle = '#0b0d1a';
  ctx.fillRect(x - 6, y - 24 + bob, 12, 14);
  ctx.fillStyle = '#7a5a20';
  ctx.fillRect(x - 4, y - 21 + bob, 8, 8);
  ctx.fillStyle = '#b08a3a';
  ctx.fillRect(x - 5, y - 14 + bob, 10, 2);
  // рваный низ острова
  ctx.fillStyle = '#141a2c';
  for (let k = 0; k < 8; k++) ctx.fillRect(x - 12 + k * 3, y + bob, 3, 2 + ((k * 7) % 5));
}

export function drawSquareParallax(g, ctx, cx, cy, q) {
  if (cy >= SQ.sky * 16 + 4) return; // небо не видно
  if (!skyLayers) buildSky();
  const top = -cy;
  const { sky, city } = skyLayers;
  const W = ctx.canvas.width;
  // слой 1 — небо (статичное на Low)
  const sx = q.parallax > 1 ? Math.floor(cx * 0.15) % 512 : 0;
  for (let x = -sx; x < W; x += 512) ctx.drawImage(sky, x, top);
  if (q.parallax >= 2) {
    const cxo = Math.floor(cx * 0.3) % 512;
    for (let x = -cxo; x < W; x += 512) ctx.drawImage(city, x, top + 22);
    drawTower(ctx, Math.round(250 - cx * 0.3), top + 34, g.time);
  }
  if (q.parallax >= 3) {
    // ближние парящие обломки
    for (let i = 0; i < 5; i++) {
      const bx = ((i * 97 - cx * 0.5) % (W + 40) + W + 40) % (W + 40) - 20;
      const by = top + 12 + ((i * 13) % 26) + Math.round(Math.sin(g.time * 0.8 + i));
      ctx.fillStyle = '#1c2236';
      ctx.fillRect(bx, by, 6 + (i % 3) * 3, 3);
      ctx.fillRect(bx + 1, by + 3, 4 + (i % 2) * 2, 2);
      ctx.fillStyle = i % 2 ? '#86163a' : '#2a3150';
      ctx.fillRect(bx + 2, by + 5, 2, 1);
    }
  }
}

// ── «свет возвращает прошлое» ────────────────────────────────────────────
// Декор в радиусе зажжённого фонаря или ожившей статуи показывает прошлую форму.
export function pastAt(g, x, y) {
  if (g.memIslands) return inIslands(g.memIslands, x, y);
  for (const pr of g.props) {
    if (pr.tl.phase !== PAST) continue;
    if (pr.kind === 'lantern16' && Math.hypot(pr.x - x, (pr.y - y) * 1.2) < 84) return true;
    if (pr.kind === 'statue16' && Math.hypot(pr.x - x, (pr.y - y) * 1.2) < 120) return true;
  }
  return false;
}

// ── объекты локации (рисуются один раз в атлас) ─────────────────────────
export function drawFountain(ctx, p, g) {
  const past = p.tl.phase === PAST;
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const t = g.time;
  const f = Math.floor(t * 8) % 4;
  // тень
  ctx.fillStyle = 'rgba(3,4,10,0.45)';
  ctx.fillRect(x - 24, y - 2, 48, 4);
  // наружная стенка (передняя грань) и верх бортика — эллипс
  const rx = 23;
  const ry = 9;
  const cy = y - 12;
  const missing = (i, j) => !past && i < -8 && i > -20 && j > 0; // в Шраме кусок бортика улетел
  for (let j = -ry; j <= ry; j++) {
    const w = Math.floor(rx * Math.sqrt(1 - (j * j) / (ry * ry)));
    for (let i = -w; i <= w; i++) {
      if (missing(i, j)) continue;
      const edge = Math.abs(i) >= w - 2 || Math.abs(j) >= ry - 1;
      px(ctx, x + i, cy + j, 1, 1, edge ? (j < 0 ? L.wall4 : L.wall3) : L.wall2);
    }
  }
  // передняя грань чаши
  for (let i = -rx; i <= rx; i++) {
    if (missing(i, 1)) continue;
    const top = cy + Math.floor(ry * Math.sqrt(1 - (i * i) / (rx * rx)));
    for (let k = 1; k <= 7; k++) px(ctx, x + i, top + k, 1, 1, k === 1 ? L.wall1 : (i + 40) % 7 === 0 ? L.wall0 : k > 5 ? L.wall0 : L.wall1);
  }
  // вода или сухое дно
  const irx = 18;
  const iry = 6;
  for (let j = -iry; j <= iry; j++) {
    const w = Math.floor(irx * Math.sqrt(1 - (j * j) / (iry * iry)));
    for (let i = -w; i <= w; i++) {
      if (missing(i, j + 2)) continue;
      let c;
      if (past) {
        const rip = (Math.abs(Math.round(Math.hypot(i, j * 3)) - f * 3) % 12) === 0;
        c = rip ? L.water2 : j < -3 ? L.water0 : L.water1;
        if (i > 4 && i < 12 && j === -1) c = L.amber2; // янтарный отблеск
      } else {
        c = (i * 3 + j * 7) % 11 === 0 ? L.sc1 : j < -2 ? L.ink : '#14121c';
      }
      px(ctx, x + i, cy + j + 1, 1, 1, c);
    }
  }
  if (!past) {
    // чаша расколота пустотой посередине
    for (let yy = cy - ry - 1; yy <= cy + ry + 8; yy++) {
      const w = 2 + ((yy * 7) % 3 === 0 ? 1 : 0);
      px(ctx, x - w + 1, yy, w * 2, 1, '#05060c');
      px(ctx, x - w, yy, 1, 1, L.sc3);
      px(ctx, x + w + 1, yy, 1, 1, yy % 2 ? L.sc2 : L.sc3);
    }
    // трещины по дну и дрожащий обломок бортика над провалом
    line(ctx, x - 6, cy, x + 4, cy + 4, L.sc2);
    line(ctx, x + 4, cy + 4, x + 10, cy + 2, L.sc2);
    const jerk = f === 2 ? 0 : f === 3 ? -1 : -2;
    const fy = cy - 8 + jerk;
    px(ctx, x - 19, fy, 11, 3, L.wall3);
    px(ctx, x - 19, fy, 11, 1, L.wall4);
    px(ctx, x - 18, fy + 3, 9, 3, L.wall1);
    px(ctx, x - 17, fy + 6, 2, 1, L.sc3);
    px(ctx, x - 12, fy + 7, 1, 1, L.sc4);
  }
  // центральная колонна
  const colH = past ? 16 : 9;
  px(ctx, x - 3, cy - colH + 2, 6, colH, L.wall3);
  px(ctx, x - 3, cy - colH + 2, 1, colH, L.wall4);
  px(ctx, x + 2, cy - colH + 2, 1, colH, L.wall1);
  if (past) {
    // чаша наверху и струи
    px(ctx, x - 6, cy - 16, 12, 3, L.wall4);
    px(ctx, x - 5, cy - 13, 10, 1, L.wall2);
    px(ctx, x - 4, cy - 17, 8, 1, L.water3);
    for (const s of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        const ddx = s * (5 + k * 1.6);
        const ddy = -15 + k * k * 0.55;
        if ((k + f) % 2 === 0) px(ctx, x + ddx, cy + ddy, 1, 2, k < 2 ? L.water3 : L.water2);
      }
    }
    px(ctx, x - 1, cy - 20 - (f % 2), 2, 3, L.water3);
  } else {
    // сломанная колонна, чаша парит рывками
    px(ctx, x - 3, cy - 8, 2, 1, L.ink);
    const jerk = f === 1 ? 0 : -1;
    px(ctx, x - 6, cy - 22 + jerk, 12, 3, L.wall3);
    px(ctx, x - 6, cy - 22 + jerk, 12, 1, L.wall4);
    px(ctx, x - 1, cy - 19 + jerk, 2, 1, L.sc3);
  }
}

export function drawStatue16(ctx, p, g) {
  const past = p.tl.phase === PAST;
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const f = Math.floor(g.time * 2) % 4;
  ctx.fillStyle = 'rgba(3,4,10,0.45)';
  ctx.fillRect(x - 16, y - 2, 32, 4);
  // ступень и постамент
  px(ctx, x - 15, y - 4, 30, 4, L.wall1);
  px(ctx, x - 15, y - 4, 30, 1, L.wall3);
  px(ctx, x - 12, y - 18, 24, 14, L.wall2);
  px(ctx, x - 12, y - 18, 2, 14, L.wall3);
  px(ctx, x + 10, y - 18, 2, 14, L.wall1);
  px(ctx, x - 13, y - 21, 26, 4, L.wall3);
  px(ctx, x - 13, y - 21, 26, 1, L.wall4);
  // латунная табличка
  px(ctx, x - 5, y - 13, 10, 4, L.bronze1);
  px(ctx, x - 4, y - 12, 8, 1, past ? L.bronze3 : L.bronze0);
  const top = y - 21;
  if (past) {
    // Латунный Мальчик ожил: машет рукой
    const c = L.bronze2;
    const lo = L.bronze1;
    const hi = L.bronze3;
    px(ctx, x - 3, top - 9, 2, 9, lo);
    px(ctx, x + 1, top - 9, 2, 9, lo);
    px(ctx, x - 4, top - 2, 3, 2, L.bronze0);
    px(ctx, x + 1, top - 2, 3, 2, L.bronze0);
    px(ctx, x - 4, top - 13, 8, 4, L.bronze0);
    px(ctx, x - 5, top - 22, 10, 10, c);
    px(ctx, x - 5, top - 22, 1, 10, hi);
    px(ctx, x - 1, top - 22, 1, 10, lo);
    px(ctx, x + 1, top - 19, 1, 1, hi);
    px(ctx, x + 1, top - 16, 1, 1, hi);
    px(ctx, x - 5, top - 22, 10, 1, L.cream);
    // руки: левая вдоль тела, правая машет (2 кадра)
    px(ctx, x - 7, top - 21, 2, 8, lo);
    const wave = f % 2 ? -2 : 0;
    px(ctx, x + 5, top - 26 + wave, 2, 6, lo);
    px(ctx, x + 5, top - 21, 2, 2, lo);
    px(ctx, x + 5, top - 28 + wave, 3, 2, hi);
    // голова с кепкой
    px(ctx, x - 4, top - 31, 8, 9, c);
    px(ctx, x - 4, top - 31, 1, 9, hi);
    px(ctx, x - 2, top - 27, 1, 2, L.ink);
    px(ctx, x + 1, top - 27, 1, 2, L.ink);
    px(ctx, x - 1, top - 24, 3, 1, L.bronze0);
    px(ctx, x - 5, top - 34, 10, 4, L.bronze0);
    px(ctx, x + 3, top - 31, 4, 1, L.bronze0);
    // ключ завода
    px(ctx, x - 9, top - 18, 4, 1, hi);
    px(ctx, x - 9, top - 20, 1, 5, hi);
  } else {
    // в Шраме постамент пуст: на камне — малиновый контур того, кто здесь стоял
    const on = f !== 2;
    const pts = [
      [-3, -1], [-3, -5], [-3, -9], [2, -1], [2, -5], [2, -9], [-5, -12], [-5, -16], [-5, -20], [4, -12], [4, -16], [4, -20],
      [-7, -14], [-7, -18], [6, -24], [6, -20], [-4, -24], [-4, -28], [3, -28], [-1, -32], [2, -32], [-5, -34], [4, -34],
    ];
    for (const [dx, dy] of pts) px(ctx, x + dx, top + dy, 1, 1, on ? L.sc3 : L.sc2);
    if (on) px(ctx, x - 1, top - 20, 2, 2, L.sc4);
    // обломки на постаменте
    px(ctx, x - 9, top - 2, 4, 2, L.bronze1);
    px(ctx, x + 6, top - 2, 3, 2, L.bronze0);
    px(ctx, x - 2, top - 1, 3, 1, L.wall3);
  }
}

export function drawLantern16(ctx, p, g) {
  const past = p.tl.phase === PAST;
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const f = Math.floor(g.time * 10) % 4;
  ctx.fillStyle = 'rgba(3,4,10,0.45)';
  ctx.fillRect(x - 5, y - 1, 10, 3);
  // ступенчатое основание и столб с кольцами
  px(ctx, x - 4, y - 3, 8, 3, L.ink);
  px(ctx, x - 3, y - 5, 6, 2, L.navy);
  px(ctx, x - 1, y - 34, 2, 30, L.navy);
  px(ctx, x - 1, y - 34, 1, 30, L.wall1);
  for (const ry of [y - 14, y - 26]) px(ctx, x - 2, ry, 4, 2, L.wall1);
  // фонарь
  const bend = past ? 0 : 1;
  const ly = y - 46;
  px(ctx, x - 5 + bend, ly - 3, 10, 2, L.navy);
  px(ctx, x - 3 + bend, ly - 5, 6, 2, L.navy);
  px(ctx, x + bend, ly - 7, 1, 2, L.wall3);
  px(ctx, x - 5 + bend, ly - 1, 10, 13, L.ink);
  if (past) {
    px(ctx, x - 4, ly, 8, 11, L.amber2);
    px(ctx, x - 3, ly + 1, 6, 9, L.amber3);
    const fl = [0, 1, 0, -1][f];
    px(ctx, x - 1 + fl, ly + 3, 2, 5, L.cream);
    px(ctx, x, ly + 2 - Math.abs(fl), 1, 2, '#ffffff');
    px(ctx, x - 1, ly - 1, 1, 13, L.ink);
    px(ctx, x + 1, ly - 1, 1, 13, L.ink);
  } else {
    // стёкла выбиты, внутри разряды с пропуском кадров
    px(ctx, x - 4 + bend, ly, 3, 11, L.navy2);
    px(ctx, x + 1 + bend, ly + 4, 3, 7, L.navy2);
    if (f !== 2) {
      line(ctx, x - 3 + bend, ly + 2, x + 2 + bend, ly + 6 + (f % 2), L.liveHi);
      px(ctx, x + bend, ly + 8, 1, 1, L.sc4);
    }
    px(ctx, x + 2 + bend, ly + 1, 2, 2, L.ink);
  }
  px(ctx, x - 5 + bend, ly + 11, 10, 2, L.navy);
}

export function drawCarpet(ctx, p, g) {
  const past = p.state ?? pastAt(g, p.x + p.w / 2, p.y + p.h / 2);
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const w = p.w;
  const h = p.h;
  if (past) {
    px(ctx, x, y, w, h, L.amber1);
    px(ctx, x + 2, y + 2, w - 4, h - 4, L.amber0);
    px(ctx, x + 3, y + 3, w - 6, h - 6, '#1f4a52');
    for (let i = 6; i < w - 6; i += 8) {
      px(ctx, x + i, y + h / 2 - 1, 3, 3, L.live);
      px(ctx, x + i + 1, y + h / 2 - 2, 1, 5, L.amber3);
    }
    for (let i = 0; i < w; i += 2) {
      px(ctx, x + i, y - 1, 1, 1, L.cream);
      px(ctx, x + i, y + h, 1, 1, L.cream);
    }
  } else {
    // от ковра остались тёмные рваные полосы
    for (let i = 0; i < w; i += 1) {
      if (hash2(i, p.id, 3) < 0.3) continue;
      const len = Math.floor(h * (0.4 + hash2(p.id, i, 4) * 0.6));
      px(ctx, x + i, y + (h - len) / 2, 1, len, i % 4 === 0 ? L.sc0 : '#1e1622');
    }
    px(ctx, x + 6, y + h / 2, 2, 1, L.sc2);
  }
}

export function drawShopSign(ctx, p, g) {
  const past = p.state ?? pastAt(g, p.x, p.y + 40);
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  // кронштейн
  px(ctx, x - 1, y - 2, 14, 2, L.navy);
  px(ctx, x - 1, y - 4, 2, 4, L.navy);
  if (past) {
    line(ctx, x + 2, y, x + 2, y + 4, L.wall3);
    line(ctx, x + 11, y, x + 11, y + 4, L.wall3);
    px(ctx, x - 1, y + 4, 16, 10, L.wood1);
    px(ctx, x - 1, y + 4, 16, 1, L.wood2);
    // буханка и свеча
    px(ctx, x + 1, y + 8, 7, 4, L.amber1);
    px(ctx, x + 2, y + 7, 5, 1, L.amber2);
    px(ctx, x + 3, y + 8, 1, 1, L.amber3);
    px(ctx, x + 10, y + 7, 2, 5, L.cream);
    px(ctx, x + 10, y + 5, 2, 2, L.amber3);
  } else {
    // висит на одной цепи, половины знака нет
    line(ctx, x + 2, y, x + 2, y + 4, L.wall1);
    for (let i = 0; i < 16; i++) px(ctx, x - 1 + i, y + 4 + Math.floor(i / 3), 1, 9, i < 2 ? L.wood2 : L.wood0);
    px(ctx, x + 1, y + 9, 4, 3, L.amber0);
    for (let i = 0; i < 4; i++) px(ctx, x + 8 + i * 2, y + 9 + i, 1, 1, L.sc2);
  }
}

// Житель прошлого: тёплый силуэт с ободком света и короткой анимацией (машет, кивает, несёт корзину).
export function drawVillager(ctx, x, y, o = {}) {
  x = Math.round(x);
  y = Math.round(y);
  const t = o.t || 0;
  const f = Math.floor(t * 3) % 4;
  const v = o.v ?? 0;
  const body = '#5a3a1e';
  const rim = L.amber3;
  const mid = L.amber1;
  ctx.fillStyle = 'rgba(3,4,10,0.35)';
  ctx.fillRect(x - 5, y - 1, 10, 2);
  // ноги
  px(ctx, x - 3, y - 6, 2, 6, body);
  px(ctx, x + 1, y - 6, 2, 6, body);
  // тело: платье (v=1) или куртка
  if (v === 1) {
    for (let j = 0; j < 12; j++) px(ctx, x - 3 - Math.floor(j / 4), y - 17 + j, 6 + Math.floor(j / 4) * 2, 1, body);
  } else px(ctx, x - 4, y - 17, 8, 11, body);
  px(ctx, x - 4, y - 17, 1, 11, rim);
  px(ctx, x + 3, y - 15, 1, 8, mid);
  // голова
  const nod = v === 2 && f === 2 ? 1 : 0;
  px(ctx, x - 3, y - 23 + nod, 6, 6, body);
  px(ctx, x - 3, y - 23 + nod, 1, 5, rim);
  if (v === 0) px(ctx, x - 4, y - 24, 8, 2, mid); // шляпа
  if (v === 1) px(ctx, x - 4, y - 22, 1, 6, mid); // волосы
  // руки
  if (v === 0) {
    const up = f % 2 ? -3 : 0; // машет
    px(ctx, x + 4, y - 22 + up, 2, 6, body);
    px(ctx, x + 4, y - 23 + up, 2, 1, rim);
  } else if (v === 3) {
    px(ctx, x - 7, y - 12, 5, 4, L.wood2); // корзина
    px(ctx, x - 7, y - 13, 5, 1, L.amber2);
  } else px(ctx, x + 4, y - 16, 2, 7, body);
  // искра памяти
  if (f === 1) px(ctx, x + 2, y - 26, 1, 1, L.cream);
}

// Силуэт в Шраме: стоит спиной к игроку и не двигается.
export function drawStillOne(ctx, x, y) {
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = 'rgba(3,4,10,0.4)';
  ctx.fillRect(x - 5, y - 1, 10, 2);
  px(ctx, x - 3, y - 7, 2, 7, '#100e16');
  px(ctx, x + 1, y - 7, 2, 7, '#100e16');
  px(ctx, x - 5, y - 18, 10, 12, '#16131e');
  px(ctx, x - 5, y - 18, 10, 1, '#221d2c');
  px(ctx, x - 3, y - 24, 6, 6, '#16131e');
  px(ctx, x - 6, y - 17, 1, 10, L.sc1);
  px(ctx, x + 5, y - 15, 1, 6, L.sc1);
}

// Гирлянды флажков: прошлое — цветные флажки, настоящее — рваные чёрные полосы.
export function drawGarland(ctx, x0, x1, y, past, f) {
  const span = x1 - x0;
  const sag = past ? 6 : 10;
  const cols = [L.amber2, L.live, L.cream, '#5374a8'];
  let lastY = null;
  for (let x = 0; x <= span; x++) {
    const k = x / span;
    const yy = Math.round(y + Math.sin(k * Math.PI) * sag + (past ? Math.sin(f + x * 0.2) * 0.4 : 0));
    if (lastY === null || yy !== lastY || x % 4 === 0) px(ctx, x0 + x, yy, 1, 1, past ? L.wood2 : '#0e0c12');
    lastY = yy;
    if (x % 9 === 4) {
      if (past) {
        const c = cols[Math.floor(x / 9) % cols.length];
        px(ctx, x0 + x - 2, yy + 1, 5, 2, c);
        px(ctx, x0 + x - 1, yy + 3, 3, 2, c);
        px(ctx, x0 + x, yy + 5 + (f % 2), 1, 1, c);
      } else if (hash2(x, y, 7) > 0.35) {
        const len = 3 + Math.floor(hash2(y, x, 8) * 6);
        px(ctx, x0 + x, yy + 1, 1, len, '#0e0c12');
        if (f === 2 && hash2(x, 1, 1) > 0.7) px(ctx, x0 + x + 1, yy + len, 1, 1, L.sc2);
      }
    }
  }
}

// ── регистрация объектов локации ─────────────────────────────────────────
const C = (w, h, ax, ay, fps = 0, frames = 1, extra = {}) => ({ w, h, ax, ay, fps, frames, ...extra });
Object.assign(PROP_KINDS, {
  fountain: {
    name: 'Фонтан',
    timeline: { hold: 12, cost: 1, switchTime: 0.6 },
    foot: { w: 44, h: 12 },
    solid: { past: true, present: true },
    light: { past: 34, present: 0 },
    draw: drawFountain,
    cache: C(52, 46, 26, 42, 8, 4),
  },
  statue16: {
    name: 'Латунный Мальчик',
    timeline: { hold: Infinity, cost: 0, switchTime: 0.6 },
    foot: { w: 28, h: 8 },
    solid: { past: true, present: true },
    light: { past: 40, present: 0 },
    draw: drawStatue16,
    cache: C(36, 62, 18, 59, 2, 4),
  },
  lantern16: {
    name: 'Фонарь',
    timeline: { hold: Infinity, cost: 1, switchTime: 0.6 },
    foot: { w: 6, h: 4 },
    solid: { past: true, present: true },
    light: { past: 72, present: 14 },
    reveal: { past: 72, present: 0 },
    pulse: { past: 0, present: 38 },
    draw: drawLantern16,
    cache: C(16, 60, 8, 57, 10, 4),
  },
  carpet: { flat: true, draw: drawCarpet, cache: C(34, 20, 1, 2, 0, 1, { state: (p, g) => pastAt(g, p.x + p.w / 2, p.y + p.h / 2), inst: (p) => `${p.w}x${p.h}|${p.id % 5}` }) },
  shopSign: { draw: drawShopSign, cache: C(20, 22, 2, 5, 0, 1, { state: (p, g) => pastAt(g, p.x, p.y + 40) }) },
});

export { ring, disc };
