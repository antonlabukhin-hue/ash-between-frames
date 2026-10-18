// Площадь без центра — художественная версия (docs/ART_TARGET.md).
// Комната печётся дважды: Шрам (present) и Отпечаток (past). На экране — Шрам,
// а в «островах памяти» (свет фонаря, ожившая статуя) сквозь маску проступает Отпечаток.
import { createPainter } from './painter.js';
import { RAMP } from './palette.js';
import { hash2, mulberry32 } from '../core/math.js';

const S = RAMP.stone;
const F = RAMP.floor;
const PA = RAMP.path;
const PL = RAMP.plaster;
const RF = RAMP.roof;
const BZ = RAMP.bronze;
const WD = RAMP.wood;
const CL = RAMP.cloth;
const CC = RAMP.clothCold;
const GL = RAMP.glass;
const VD = RAMP.void;

// ── геометрия ───────────────────────────────────────────────────────────
export const G = {
  floorY: 96,
  center: [240, 222],
  ring: [52, 40],
  fissure: [112, 144], // провал перед аркой (ряды 7–8)
  arch: [224, 256],
  fountain: [100, 240],
  stall: [342, 288, 96, 44], // рынок в правом нижнем углу (x, y, w, h)
  shop: [32, 112],
};

// Дома северной стороны: x0, x1, верх крыши, тип.
const HOUSES = [
  [32, 112, 52, 'shop'],
  [112, 208, 38, 'balcony'],
  [208, 272, 12, 'gate'],
  [272, 352, 24, 'spire'],
  [352, 448, 44, 'ruin'],
];

// ── мелкий пиксельный шрифт для вывесок (3×5) ────────────────────────────
const GLYPH = {
  Х: '101101010101101', Л: '011101101101101', Е: '111100110100111', Б: '111100111101111',
  В: '110101110101110', О: '111101101101111', С: '111100100100111', К: '101110100110101', '·': '000000010000000',
};

function text(p, x, y, str, c, drop = null) {
  let cx = x;
  [...str].forEach((ch, i) => {
    const g = GLYPH[ch];
    if (g && !(drop && drop.includes(i))) for (let k = 0; k < 15; k++) if (g[k] === '1') p.set(cx + (k % 3), y + Math.floor(k / 3), c);
    cx += 4;
  });
}

// ── публичное ───────────────────────────────────────────────────────────
export function bakeSquare(room, past) {
  const p = createPainter(room.pxW, room.pxH);
  ground(p, room, past);
  buildings(p, room, past);
  sides(p, room, past);
  parapet(p, room);
  shadows(p, room);
  lightPools(p, room, past);
  if (past) warmGrade(p);
  return p.img;
}

// Провал: точка в Шраме — пустота?
export function inFissure(x, y) {
  const [y0, y1] = G.fissure;
  if (x < 32 || x >= 448) return false;
  const top = y0 + jag(x, 1);
  const bot = y1 - jag(x, 2);
  return y >= top && y < bot;
}

const jag = (x, s) => Math.floor(hash2(Math.floor(x / 3), s, 77) * 4);

// Отпечаток теплее и чище: сдвиг к охре, меньше синевы.
function warmGrade(p) {
  const d = p.img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    d[i] = Math.min(255, d[i] * 1.16 + 10);
    d[i + 1] = Math.min(255, d[i + 1] * 1.05 + 5);
    d[i + 2] = d[i + 2] * 0.86;
  }
}

// ── пол ─────────────────────────────────────────────────────────────────
function slab(x, y) {
  // спокойные крупные плиты 32×24 со сдвигом рядов
  const row = Math.floor((y - 96) / 24);
  const ly = (y - 96) - row * 24;
  const off = (row % 2) * 16;
  const col = Math.floor((x + off) / 32);
  const lx = x + off - col * 32;
  // мягкий шов: на тон темнее камня, местами пропадает (плиты срослись)
  const r = hash2(col, row, 11);
  if (ly === 0 || lx === 0) return hash2(x >> 2, y >> 2, 3) < 0.25 ? F[3] : F[2];
  let c = r < 0.25 ? F[2] : r < 0.9 ? F[3] : F[4];
  if (ly === 1 && r > 0.5) c = F[4];
  if (ly === 23 || lx === 31) c = F[2];
  if (hash2(x, y, 41) < 0.035) c = F[2];
  return c;
}

function pathStone(x, y) {
  // стёртые светлые плиты пути
  const row = Math.floor(y / 12);
  const ly = y - row * 12;
  const off = (row % 2) * 8;
  const col = Math.floor((x + off) / 16);
  const lx = x + off - col * 16;
  if (ly === 0 || lx === 0) return F[1];
  const r = hash2(col, row, 13);
  let c = r < 0.3 ? PA[1] : PA[2];
  if (ly === 1) c = PA[3];
  if (ly === 11) c = PA[0];
  if (hash2(x, y, 47) < 0.05) c = PA[0];
  return c;
}

function ringStone(x, y) {
  const [cx, cy] = G.center;
  const dx = x - cx;
  const dy = (y - cy) * (G.ring[0] / G.ring[1]);
  const r = Math.hypot(dx, dy);
  const R = G.ring[0];
  if (r >= R + 6) return null;
  if (r >= R) return r - R < 2 ? S[4] : r - R > 4.5 ? F[0] : S[3]; // бордюр
  const ringW = 8;
  const ring = Math.floor(r / ringW);
  const local = r - ring * ringW;
  const mid = (ring + 0.5) * ringW;
  const n = Math.max(6, Math.floor((Math.PI * 2 * mid) / 11));
  const a = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2);
  const sv = a * n + (ring % 2) * 0.5;
  const seg = Math.floor(sv);
  const segLocal = (sv - seg) * ((Math.PI * 2 * mid) / n);
  if (local < 1 || segLocal < 1) return F[1];
  const t = hash2(seg, ring, 19);
  let c = t < 0.25 ? F[3] : t < 0.85 ? F[4] : F[5];
  if (local < 2) c = dy < 0 ? F[5] : F[3];
  return c;
}

function cobble(x, y) {
  const [fx, fy] = G.fountain;
  const d = Math.hypot((x - fx) / 50, (y - fy) / 36);
  if (d > 1) return null;
  const row = Math.floor(y / 5);
  const off = (row % 2) * 3;
  const col = Math.floor((x + off) / 6);
  const lx = x + off - col * 6;
  const ly = y - row * 5;
  if (lx === 0 || ly === 0) return F[1];
  // скруглённые углы булыжника
  if ((lx === 1 || lx === 5) && (ly === 1 || ly === 4)) return F[1];
  const r = hash2(col, row, 23);
  let c = r < 0.3 ? F[2] : r < 0.75 ? F[3] : r < 0.95 ? F[4] : PA[1];
  if (ly === 1 && lx > 1 && lx < 4) c = F[5];
  if (ly === 4) c = F[2];
  return c;
}

function ground(p, room, past) {
  const x0 = 32;
  const x1 = room.pxW - 32;
  const y0 = G.floorY;
  const y1 = room.pxH - 16;
  const [cx] = G.center;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      let c = slab(x, y);
      // путь: вход → постамент → арка
      const wob = Math.round(Math.sin(y / 23) * 3);
      if (Math.abs(x - cx - wob) < 18 + (hash2(Math.floor(y / 12), 1, 5) > 0.6 ? 2 : 0)) c = pathStone(x, y);
      const cb = cobble(x, y);
      if (cb) c = cb;
      const rs = ringStone(x, y);
      if (rs) c = rs;
      // мох и грязь у стен
      if (c === F[0] || c === F[1]) {
        if ((x < x0 + 20 || x > x1 - 20 || y > y1 - 18) && hash2(x, y, 9) < 0.25) c = RAMP.leaf[0];
      }
      p.set(x, y, c);
    }
  }
  // деревянный настил перед лавкой
  for (let y = 96; y < 118; y++) {
    for (let x = 36; x < 108; x++) {
      const row = Math.floor((y - 96) / 4);
      const ly = (y - 96) % 4;
      const seam = (Math.floor(hash2(row, 3, 3) * 40) + 6);
      let c = row % 2 ? WD[2] : WD[1];
      if (ly === 3 || (x - 36) % seam === 0) c = WD[0];
      if (ly === 0) c = WD[3];
      if ((x - 36) % 12 === 2 && ly === 1) c = S[4]; // гвозди
      p.set(x, y, c);
    }
  }
  // рынок справа внизу — в Отпечатке шатёр, в Шраме разломанный остов
  market(p, past);
  // ковры: прошлое — узор, Шрам — тёмные рваные полосы
  for (const [rx, ry, rw, rh] of [[168, 162, 40, 16], [272, 162, 40, 16], [196, 312, 30, 14]]) carpet(p, rx, ry, rw, rh, past);
  // трещины Стирания в правом нижнем секторе (Шрам)
  if (!past) {
    const rnd = mulberry32(31);
    for (let k = 0; k < 7; k++) {
      let x = 300 + rnd() * 140;
      let y = 250 + rnd() * 90;
      for (let s = 0; s < 22; s++) {
        p.set(x, y, VD[1]);
        if (s % 3 === 0) p.set(x + 1, y, VD[4]);
        x += Math.round(rnd() * 2 - 1);
        y += rnd() > 0.4 ? 1 : 0;
      }
    }
  } else {
    // в прошлом — те же места ровные, с бликами чистого камня
    for (let k = 0; k < 6; k++) p.rect(310 + k * 20, 260 + (k % 3) * 22, 6, 1, F[5]);
  }
  // лужи с отражением неба
  for (const [qx, qy, rx, ry] of [[70, 300, 12, 4], [420, 210, 10, 3], [150, 330, 9, 3]]) {
    for (let j = -ry; j <= ry; j++) {
      const w = Math.floor(rx * Math.sqrt(1 - (j * j) / (ry * ry)));
      for (let i = -w; i <= w; i++) p.set(qx + i, qy + j, Math.abs(i) >= w - 1 ? S[1] : j < 0 ? S[2] : '#141a2c');
    }
    p.rect(qx - rx + 4, qy, 4, 1, S[4]);
  }
  // провал перед аркой
  fissure(p, room, past);
}

function carpet(p, x, y, w, h, past) {
  if (past) {
    // тканый ковёр: тёмная кайма, узор зигзагом, бахрома на коротких краях
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let c = '#2a3a44';
        if (j < 2 || j >= h - 2 || i < 2 || i >= w - 2) c = CL[1];
        else if ((i + Math.abs((j % 6) - 3)) % 6 === 0) c = CL[2];
        else if ((i + j) % 9 === 0) c = '#3f5a66';
        p.set(x + i, y + j, c);
      }
    }
    for (let j = 1; j < h; j += 2) {
      p.set(x - 1, y + j, CL[3]);
      p.set(x + w, y + j, CL[3]);
    }
  } else {
    for (let i = 0; i < w; i++) {
      if (hash2(i, x, 3) < 0.35) continue;
      const len = Math.floor(h * (0.3 + hash2(x, i, 4) * 0.6));
      p.rect(x + i, y + Math.floor((h - len) / 2), 1, len, i % 5 === 0 ? VD[2] : '#1a1420');
    }
  }
}

function market(p, past) {
  const [x, y, w, h] = G.stall;
  if (past) {
    // прилавок с тканевым шатром
    p.rect(x + 4, y + 20, w - 8, 16, WD[2]);
    p.rect(x + 4, y + 20, w - 8, 2, WD[3]);
    p.rect(x + 4, y + 34, w - 8, 2, WD[0]);
    for (let i = 0; i < 6; i++) p.rect(x + 10 + i * 13, y + 23, 8, 6, i % 2 ? CL[3] : '#6f9444'); // товар
    for (const px of [x + 4, x + w - 6]) p.rect(px, y + 2, 2, 34, WD[1]);
    for (let i = 0; i < w; i++) {
      const stripe = Math.floor(i / 6) % 2;
      for (let j = 0; j < 7; j++) p.set(x + i, y + j + (i % 12 < 6 ? 0 : 1), j === 6 ? CL[0] : stripe ? CL[4] : CL[2]);
    }
  } else {
    // сломанный остов: стойки, обрывки ткани, опрокинутый ящик
    p.rect(x + 4, y + 8, 2, 28, WD[1]);
    p.rect(x + w - 6, y + 18, 2, 18, WD[0]);
    for (let i = 0; i < 18; i += 3) p.rect(x + 6 + i, y + 8 + (i % 2), 2, 4 + (i % 4), '#1a1420');
    p.rect(x + 30, y + 26, 22, 8, WD[1]);
    p.rect(x + 30, y + 26, 22, 1, WD[2]);
    p.line(x + 30, y + 26, x + 51, y + 33, WD[0]);
  }
}

function fissure(p, room, past) {
  const [y0, y1] = G.fissure;
  for (let x = 32; x < room.pxW - 32; x++) {
    const top = y0 + jag(x, 1);
    const bot = y1 - jag(x, 2);
    if (past) {
      // мостовая цела; по оси — старая решётка водостока
      if (Math.abs(x - 240) < 14) for (let y = top + 10; y < top + 16; y++) p.set(x, y, (x + y) % 3 === 0 ? S[0] : S[2]);
      continue;
    }
    for (let y = top; y < bot; y++) p.clear(x, y);
    // обрыв: каменная стенка под верхним краем, малиновая кайма
    for (let k = 0; k < 6; k++) p.set(x, top + k, k === 0 ? S[3] : k < 3 ? S[1] : S[0]);
    if (hash2(x, 5, 3) > 0.6) p.set(x, top + 6 + Math.floor(hash2(x, 2, 2) * 3), S[0]);
    p.set(x, top - 1, VD[4]);
    p.set(x, bot, VD[4]);
    if (hash2(x, 7, 7) > 0.7) p.set(x, bot + 1, VD[3]);
  }
}

// ── дома ────────────────────────────────────────────────────────────────
function clearSky(p, x0, x1, y1) {
  for (let y = 0; y < y1; y++) for (let x = x0; x < x1; x++) p.clear(x, y);
}

function roofTiles(p, x0, x1, y0, y1, past, broken = null) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (broken && broken(x, y)) continue;
      const row = Math.floor((y - y0) / 3);
      const lx = (x - x0 + (row % 2) * 3) % 6;
      let c = row % 2 ? RF[2] : RF[3];
      if (lx === 0 || (y - y0) % 3 === 2) c = RF[1];
      if (y === y0) c = RF[4];
      if (!past && hash2(x, y, 61) < 0.03) c = RF[0];
      p.set(x, y, c);
    }
  }
  for (let x = x0; x < x1; x++) {
    p.set(x, y1, S[4]); // карниз
    p.set(x, y1 + 1, S[1]);
  }
}

function plaster(p, x0, x1, y0, y1, past) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const r = hash2(x, y, 17);
      let c = PL[1];
      if (r > 0.94) c = PL[2];
      else if (r < 0.05) c = PL[0];
      // подтёки грязи в Шраме
      if (!past && hash2(Math.floor(x / 3), 9, 4) > 0.8 && y > y0 + 6) c = PL[0];
      p.set(x, y, c);
    }
  }
  // каменный цоколь
  for (let y = y1 - 9; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const ly = y - (y1 - 9);
      const lx = (x - x0 + Math.floor(ly / 3) * 5) % 10;
      let c = S[2];
      if (lx === 0 || ly % 3 === 0) c = S[1];
      else if (ly % 3 === 1) c = S[3];
      p.set(x, y, c);
    }
  }
  // контрфорсы на углах
  for (const bx of [x0, x1 - 4]) {
    for (let y = y0; y < y1; y++) {
      p.set(bx, y, S[1]);
      p.set(bx + 1, y, S[3]);
      p.set(bx + 2, y, S[2]);
      p.set(bx + 3, y, S[1]);
    }
  }
}

// Окно: прошлое — тёплый свет, рамы; Шрам — пустой проём, разбитое.
function window_(p, x, y, w, h, past, arched = false) {
  p.rect(x - 1, y - 1, w + 2, h + 2, WD[0]);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (arched && j < 2 && (i === 0 || i === w - 1)) continue;
      let c;
      if (past) c = j < h / 2 ? GL[3] : GL[2];
      else c = hash2(i + x, j + y, 3) > 0.92 ? S[2] : GL[0];
      p.set(x + i, y + j, c);
    }
  }
  if (past) {
    p.rect(x + Math.floor(w / 2), y, 1, h, WD[1]);
    p.rect(x, y + Math.floor(h / 2), w, 1, WD[1]);
    p.set(x + 1, y + 1, GL[4]);
  } else {
    // осколки стекла и сорванная ставня
    p.set(x, y + h - 1, S[3]);
    p.set(x + w - 1, y, S[3]);
    p.rect(x + w + 1, y + 2, 2, h - 1, WD[1]);
  }
  p.rect(x - 2, y + h + 1, w + 4, 1, S[4]);
  p.rect(x - 2, y + h + 2, w + 4, 1, S[1]);
}

function flowerBox(p, x, y, w, past) {
  p.rect(x, y, w, 3, WD[1]);
  p.rect(x, y, w, 1, WD[2]);
  if (past) for (let i = 1; i < w - 1; i += 2) p.set(x + i, y - 1 - (i % 3 === 0 ? 1 : 0), i % 4 === 1 ? CL[3] : '#6f9444');
  else p.set(x + 2, y - 1, '#2a2a22');
}

function buildings(p, room, past) {
  const by = G.floorY;
  for (const [x0, x1, top, type] of HOUSES) {
    if (type === 'gate') {
      gate(p, x0, x1, top, past);
      continue;
    }
    const roofH = type === 'spire' ? 16 : 10;
    const fy = top + roofH;
    clearSky(p, x0, x1, top);
    if (type === 'spire') spire(p, x0, x1, top, past);
    else if (type === 'ruin' && !past) {
      roofTiles(p, x0, x1, top, fy, past, (x, y) => x > x0 + 50 && y - top < (x - x0 - 50) * 0.4);
    } else roofTiles(p, x0, x1, top, fy, past);
    plaster(p, x0, x1, fy + 2, by, past);
    if (type === 'shop') shop(p, x0, x1, fy, by, past);
    if (type === 'balcony') balcony(p, x0, x1, fy, by, past);
    if (type === 'spire') spireFacade(p, x0, x1, fy, by, past);
    if (type === 'ruin') ruin(p, x0, x1, fy, by, past);
    // дымоход
    if (type !== 'spire' && !(type === 'ruin' && !past)) {
      const ch = x0 + Math.floor((x1 - x0) * 0.72);
      p.rect(ch, top - 8, 6, 8, S[2]);
      p.rect(ch - 1, top - 9, 8, 2, S[4]);
    }
  }
}

function shop(p, x0, x1, fy, by, past) {
  // вывеска над навесом
  p.rect(x0 + 10, fy + 4, 46, 9, WD[1]);
  p.rect(x0 + 10, fy + 4, 46, 1, WD[3]);
  p.rect(x0 + 10, fy + 12, 46, 1, WD[0]);
  text(p, x0 + 14, fy + 6, 'ХЛЕБ·ВОСК', past ? BZ[4] : BZ[1], past ? null : [1, 4, 7]);
  // навес
  const ay = fy + 15;
  for (let x = x0 + 6; x < x1 - 6; x++) {
    const stripe = Math.floor((x - x0) / 5) % 2;
    for (let j = 0; j < 5; j++) {
      if (!past && hash2(Math.floor(x / 5), j, 8) > 0.55 && j > 1) continue; // рваный
      p.set(x, ay + j, j === 4 ? CL[0] : stripe ? CL[4] : CL[2]);
    }
    if (past && (x - x0) % 5 === 2) p.set(x, ay + 5, CL[1]);
    if (!past && hash2(x, 2, 2) > 0.85) p.rect(x, ay + 2, 1, 6, stripe ? '#6a645a' : CL[0]);
  }
  // витрина с хлебом и дверь
  window_(p, x0 + 10, ay + 9, 30, 10, past);
  if (past) for (let i = 0; i < 4; i++) p.rect(x0 + 13 + i * 7, ay + 15, 5, 3, CL[2]);
  p.rect(x0 + 46, ay + 7, 14, by - ay - 7, WD[1]);
  p.rect(x0 + 47, ay + 8, 12, by - ay - 8, WD[0]);
  p.set(x0 + 56, ay + 18, BZ[3]);
  window_(p, x0 + 66, fy + 6, 7, 9, past);
  flowerBox(p, x0 + 64, fy + 16, 11, past);
}

function balcony(p, x0, x1, fy, by, past) {
  // верхний этаж: арочные окна и балкон со знаменем
  for (const wx of [x0 + 14, x0 + 44, x0 + 74]) window_(p, wx, fy + 6, 8, 11, past, true);
  const yb = fy + 20;
  p.rect(x0 + 8, yb, x1 - x0 - 16, 2, WD[2]);
  p.rect(x0 + 8, yb + 2, x1 - x0 - 16, 1, WD[0]);
  for (let x = x0 + 9; x < x1 - 8; x += 4) {
    if (!past && hash2(x, 1, 9) > 0.6) continue; // выломанные балясины
    p.rect(x, yb - 6, 1, 6, WD[1]);
  }
  p.rect(x0 + 8, yb - 7, x1 - x0 - 16, 1, past ? WD[3] : WD[1]);
  // знамя под балконом
  const bx = x0 + 40;
  for (let j = 0; j < 18; j++) {
    for (let i = 0; i < 14; i++) {
      if (!past && (j > 6 + (i % 4) * 2 || i % 3 === 1)) continue; // рваные полосы
      p.set(bx + i, yb + 3 + j, past ? (j < 1 ? CC[3] : CC[1]) : '#0e0c12');
    }
  }
  if (past) {
    for (let a = 0; a < 12; a++) p.set(bx + 7 + Math.round(Math.cos(a / 1.9) * 3), yb + 10 + Math.round(Math.sin(a / 1.9) * 3), BZ[3]);
    p.rect(bx + 7, yb + 5, 1, 11, BZ[3]);
  }
  // первый этаж: дверь, окно; водосток справа
  p.rect(x0 + 12, by - 22, 12, 22, WD[1]);
  p.rect(x0 + 13, by - 21, 10, 21, WD[0]);
  window_(p, x0 + 62, by - 20, 10, 9, past);
  for (let y = fy; y < by; y++) {
    p.set(x1 - 7, y, BZ[1]);
    p.set(x1 - 6, y, y % 9 === 0 ? BZ[2] : BZ[0]);
  }
  p.rect(x1 - 9, by - 3, 5, 2, BZ[1]);
}

function gate(p, x0, x1, top, past) {
  const by = G.floorY;
  const [ox0, ox1] = G.arch;
  clearSky(p, x0, x1, top);
  // башня-ворота: каменная кладка
  for (let y = top + 6; y < by; y++) {
    for (let x = x0; x < x1; x++) {
      const row = Math.floor(y / 6);
      const lx = (x + (row % 2) * 6) % 12;
      let c = S[2];
      if (lx === 0 || y % 6 === 0) c = S[1];
      else if (y % 6 === 1) c = S[3];
      if (!past && hash2(Math.floor(x / 4), Math.floor(y / 4), 5) > 0.93) c = S[0];
      p.set(x, y, c);
    }
  }
  // зубцы
  for (let x = x0; x < x1; x += 9) {
    if (!past && x > x0 + 40) continue; // часть зубцов стёрта
    p.rect(x, top, 6, 6, S[3]);
    p.rect(x, top, 6, 1, S[5]);
  }
  // контрфорсы
  for (const bx of [x0, x1 - 6]) {
    for (let y = top + 8; y < by; y++) {
      p.rect(bx, y, 6, 1, S[2]);
      p.set(bx, y, S[4]);
      p.set(bx + 5, y, S[1]);
    }
  }
  // проём со ступенями наверх
  const mx = (ox0 + ox1) / 2;
  const rr = (ox1 - ox0) / 2;
  const oy = 62;
  for (let y = oy - 6; y < by; y++) {
    for (let x = ox0; x < ox1; x++) {
      if (y < oy + 10 && Math.hypot(x - mx + 0.5, y - (oy + 10)) >= rr) continue;
      const step = Math.floor((by - y) / 5);
      const cols = [VD[0], S[0], S[1], S[2]];
      p.set(x, y, (by - y) % 5 === 0 ? VD[0] : cols[Math.max(0, 3 - Math.floor(step / 2))]);
    }
  }
  // арка-обрамление
  for (let a = Math.PI; a <= Math.PI * 2; a += 0.04) {
    for (let k = 0; k < 3; k++) p.set(Math.round(mx + Math.cos(a) * (rr + k)), Math.round(oy + 10 + Math.sin(a) * (rr + k)), k === 1 ? S[4] : S[3]);
  }
  // герб и колокольчики
  const hx = mx;
  const hy = top + 20;
  if (past) {
    p.rect(hx - 7, hy, 14, 14, BZ[2]);
    p.rect(hx - 6, hy + 1, 12, 12, BZ[1]);
    for (let j = 0; j < 4; j++) p.rect(hx - 5 + j, hy + 13 + j, 10 - j * 2, 1, BZ[1]);
    p.rect(hx - 2, hy + 3, 4, 6, BZ[4]); // колокол на гербе
    p.rect(hx - 3, hy + 9, 6, 1, BZ[4]);
    for (const bx of [ox0 + 4, ox1 - 6]) {
      p.rect(bx + 1, oy + 2, 1, 3, S[0]);
      p.rect(bx, oy + 5, 3, 3, BZ[3]);
    }
  } else {
    // герб расколот на плавающие куски, вертикальная линия Стирания
    p.rect(hx - 8, hy - 3, 6, 6, BZ[1]);
    p.rect(hx + 1, hy + 2, 6, 7, BZ[1]);
    p.rect(hx - 4, hy + 12, 7, 4, BZ[0]);
    p.set(hx - 6, hy - 2, BZ[3]);
    for (let y = top + 4; y < oy + 2; y++) p.set(hx + (y % 7 === 0 ? 1 : 0), y, y % 5 === 0 ? VD[5] : VD[0]);
  }
}

function spire(p, x0, x1, top, past) {
  const mid = (x0 + x1) / 2;
  // шпиль; в Шраме верхушка оторвана и висит выше
  for (let j = 0; j < 30; j++) {
    const w = Math.floor((j / 30) * 22) + 2;
    const lift = !past && j < 12 ? -6 : 0;
    if (!past && j >= 12 && j < 14) continue;
    for (let i = -w; i <= w; i++) p.set(mid + i, top - 18 + j + lift, i === -w ? RF[4] : (i + j) % 4 === 0 ? RF[1] : RF[3]);
  }
  roofTiles(p, x0, x1, top + 12, top + 16, past);
}

function spireFacade(p, x0, x1, fy, by, past) {
  const cx = (x0 + x1) / 2;
  const cy = fy + 14;
  for (let j = -9; j <= 9; j++) {
    for (let i = -9; i <= 9; i++) {
      const d = Math.hypot(i, j);
      if (d > 9) continue;
      let c;
      if (d > 7.6) c = S[4];
      else if (past) c = (Math.abs(i) < 1 || Math.abs(j) < 1 || Math.abs(Math.abs(i) - Math.abs(j)) < 1) ? WD[0] : d < 3 ? GL[4] : GL[3];
      else c = hash2(i, j, 4) > 0.85 ? S[2] : GL[0];
      p.set(cx + i, cy + j, c);
    }
  }
  // ниша со свечой
  const nx = x0 + 12;
  const ny = by - 26;
  p.rect(nx, ny, 10, 14, S[0]);
  p.rect(nx + 1, ny - 2, 8, 2, S[0]);
  p.rect(nx - 1, ny + 14, 12, 2, S[4]);
  if (past) {
    p.rect(nx + 4, ny + 8, 2, 6, CL[4]);
    p.rect(nx + 4, ny + 6, 2, 2, GL[3]);
  }
  window_(p, x1 - 24, by - 26, 8, 12, past, true);
}

function ruin(p, x0, x1, fy, by, past) {
  window_(p, x0 + 12, fy + 6, 8, 10, past);
  window_(p, x0 + 40, fy + 6, 8, 10, past);
  flowerBox(p, x0 + 10, fy + 17, 12, past);
  p.rect(x0 + 22, by - 22, 12, 22, WD[1]);
  p.rect(x0 + 23, by - 21, 10, 21, WD[0]);
  if (past) {
    window_(p, x0 + 66, fy + 6, 8, 10, past);
    window_(p, x0 + 66, by - 20, 10, 9, past);
    flowerBox(p, x0 + 64, fy + 17, 12, past);
    return;
  }
  // правая половина выбита: тёмное нутро с малиновой кромкой
  for (let y = fy - 2; y < by - 6; y++) {
    const edge = x0 + 54 + Math.floor(hash2(y, 3, 3) * 5) + Math.floor((by - y) / 6);
    for (let x = edge; x < x1 - 2; x++) p.set(x, y, x === edge ? VD[4] : (x + y) % 9 === 0 ? VD[1] : VD[0]);
  }
  // обломки у подножия
  for (let k = 0; k < 6; k++) p.rect(x0 + 58 + k * 6, by - 6 + (k % 2), 5, 4, k % 2 ? S[3] : S[2]);
}

// ── бока и парапет ──────────────────────────────────────────────────────
function sides(p, room, past) {
  const W = room.pxW;
  const H = room.pxH;
  for (let y = 40; y < H; y++) {
    for (const [x0, x1, right] of [[0, 32, true], [W - 32, W, false]]) {
      for (let x = x0; x < x1; x++) {
        const lx = right ? x - x0 : x1 - 1 - x;
        const row = Math.floor(y / 4);
        let c = (row + Math.floor(lx / 5)) % 2 ? RF[2] : RF[3];
        if (y % 4 === 3) c = RF[1];
        if (lx >= 28) c = lx === 31 ? S[0] : lx === 30 ? S[4] : S[3];
        p.set(x, y, c);
      }
    }
  }
  for (let y = 0; y < 40; y++) for (const x0 of [0, W - 32]) for (let x = x0; x < x0 + 32; x++) p.clear(x, y);
  // слуховые окна и трубы на боковых крышах
  for (const [x, y] of [[8, 160], [10, 280], [W - 22, 300]]) {
    p.rect(x, y, 12, 8, S[1]);
    p.rect(x + 2, y + 2, 8, 5, past ? GL[2] : GL[0]);
  }
  // проход в переулок справа — завален
  for (let y = 192; y < 224; y++) for (let x = W - 32; x < W; x++) p.set(x, y, (x + y) % 7 === 0 ? '#141a2c' : VD[0]);
  for (const [bx, byy] of [[W - 30, 196], [W - 22, 204], [W - 28, 212]]) {
    p.rect(bx, byy, 12, 9, WD[1]);
    p.rect(bx, byy, 12, 1, WD[2]);
    p.line(bx, byy, bx + 11, byy + 8, WD[0]);
  }
}

function parapet(p, room) {
  const W = room.pxW;
  const y0 = room.pxH - 16;
  for (let y = y0; y < room.pxH; y++) {
    for (let x = 0; x < W; x++) {
      if (x >= 232 && x < 248 + 8) continue;
      const lx = x % 16;
      let c = S[2];
      if (y === y0) c = S[5];
      else if (y === y0 + 1) c = S[4];
      else if (lx === 0) c = S[0];
      else if (y > y0 + 9) c = S[1];
      p.set(x, y, c);
    }
  }
  // столбы у входа
  for (const px of [226, 256]) {
    p.rect(px, y0 - 8, 6, 24, S[3]);
    p.rect(px, y0 - 9, 6, 2, S[5]);
    p.rect(px + 5, y0 - 8, 1, 24, S[1]);
  }
}

function shadows(p, room) {
  const W = room.pxW;
  for (let x = 32; x < W - 32; x++) for (let j = 0; j < 8; j++) p.shade(x, G.floorY + j, j < 2 ? 0.5 : j < 5 ? 0.68 : 0.84);
  for (let y = G.floorY; y < room.pxH - 16; y++) {
    for (let j = 0; j < 5; j++) {
      p.shade(32 + j, y, j < 2 ? 0.55 : 0.78);
      if (y < 192 || y >= 224) p.shade(W - 33 - j, y, j < 2 ? 0.72 : 0.88);
    }
  }
}

// Запечённые пятна света: прошлое — янтарь под фонарями и окнами; Шрам — малиновое свечение провала.
function lightPools(p, room, past) {
  const glow = (cx, cy, rx, ry, rgb, a) => {
    for (let ring = 3; ring >= 1; ring--) {
      const k = ring / 3;
      const ax = Math.floor(rx * k);
      const ay = Math.floor(ry * k);
      for (let j = -ay; j <= ay; j++) {
        const w = Math.floor(ax * Math.sqrt(Math.max(0, 1 - (j * j) / (ay * ay))));
        for (let i = -w; i <= w; i++) if (p.alpha(cx + i, cy + j) > 0) p.set(cx + i, cy + j, rgb, Math.round(a * (1.25 - k) * 255) | 0);
      }
    }
  };
  if (past) {
    for (const [lx, ly] of [[164, 156], [316, 156], [356, 262]]) glow(lx, ly + 2, 40, 18, '#b8721f', 0.18);
    glow(G.center[0], G.center[1] + 4, 54, 26, '#e0a040', 0.12);
  } else {
    for (let x = 48; x < room.pxW - 48; x += 40) glow(x, G.fissure[1] + 3, 22, 4, '#86163a', 0.22);
    glow(370, 300, 50, 22, '#4a0c1e', 0.25);
  }
}

// Запекание для комнаты: холст — Шрам, room.pastCanvas — Отпечаток.
export function paintTarget(ctx, room) {
  ctx.putImageData(bakeSquare(room, false), 0, 0);
  const c = document.createElement('canvas');
  c.width = room.pxW;
  c.height = room.pxH;
  c.getContext('2d').putImageData(bakeSquare(room, true), 0, 0);
  room.pastCanvas = c;
}
