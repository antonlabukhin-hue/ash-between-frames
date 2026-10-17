// Персонажи, нарисованные кодом попиксельно. Координаты — от точки ног (x, y).
// k(color) — подмена цвета: белая вспышка при попадании, призрачность и т.п.
import { P } from './palette.js';

const ident = (c) => c;
export const whiteK = () => '#ffffff';

export function px(ctx, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

export function shadow(ctx, x, y, w = 12, a = 0.45) {
  ctx.fillStyle = `rgba(3,4,10,${a})`;
  const hw = Math.round(w / 2);
  ctx.fillRect(Math.round(x - hw + 2), Math.round(y - 1), hw * 2 - 4, 3);
  ctx.fillRect(Math.round(x - hw), Math.round(y), hw * 2, 1);
}

// Линия попиксельно (меч, нити, цепи).
export function line(ctx, x0, y0, x1, y1, c, w = 1) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  ctx.fillStyle = c;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    ctx.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), w, w);
  }
}

export function disc(ctx, cx, cy, r, c) {
  ctx.fillStyle = c;
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}

export function ring(ctx, cx, cy, r, c, squash = 1, step = 1) {
  ctx.fillStyle = c;
  const n = Math.max(12, Math.floor(r * 6));
  for (let i = 0; i < n; i += step) {
    const a = (i / n) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * squash), 1, 1);
  }
}

// Рваный низ плаща: зубцы колышутся во времени.
function tornHem(ctx, x0, x1, y, t, sway, k, c1, c2) {
  for (let x = x0; x <= x1; x++) {
    const n = Math.sin(x * 2.1 + t * 7) * 1.2 + Math.sin(x * 0.7 - t * 3) * 1.4;
    const len = Math.max(0, Math.round(1.5 + n));
    if (len > 0) px(ctx, x + Math.round(sway * (len / 3)), y, 1, len, k((x & 1) ? c1 : c2));
  }
}

// ── Рен, Последний Смотритель ──────────────────────────────────────────
// o: {dir:'down'|'up'|'side', flip, t, walk, sway, aim, swing, glow, charges, k, sword}
export function drawHero(ctx, x, y, o) {
  const k = o.k || ident;
  const t = o.t || 0;
  x = Math.round(x);
  y = Math.round(y);
  shadow(ctx, x, y, 12);
  const dir = o.dir || 'down';
  const f = o.flip ? -1 : 1;
  const walk = o.walk || 0;
  const step = Math.sin(walk * Math.PI * 2);
  const bob = Math.abs(step) > 0.5 ? -1 : 0;
  const sway = o.sway || 0;

  // меч за спиной/сбоку, если смотрит вверх — рисуем до тела
  const swordBehind = dir === 'up' || (o.aim != null && Math.sin(o.aim) < -0.3);
  if (swordBehind) drawSword(ctx, x, y + bob, o, k);

  // ноги
  const l1 = step > 0.3 ? 1 : 0;
  const l2 = step < -0.3 ? 1 : 0;
  px(ctx, x - 3, y - 6, 2, 5 - l1, k(P.navy));
  px(ctx, x + 1, y - 6, 2, 5 - l2, k(P.navy));
  px(ctx, x - 3, y - 2 - l1, 2, 2, k(P.ink));
  px(ctx, x + 1, y - 2 - l2, 2, 2, k(P.ink));

  const top = y - 17 + bob;
  if (dir === 'side') {
    // плащ сбоку, шлейф отстаёт
    for (let i = 0; i < 12; i++) {
      const w = 6 + Math.floor(i / 3);
      const back = Math.floor(i / 4) + Math.round(Math.abs(sway) * (i / 12) * 2);
      const x0 = f > 0 ? x - 3 - back : x - w + 3 + back;
      px(ctx, x0, top + 2 + i, w, 1, k(i < 2 ? P.blueHi : P.blue));
      px(ctx, f > 0 ? x0 : x0 + w - 1, top + 2 + i, 1, 1, k(P.blueLo));
    }
    tornHem(ctx, x - 5 - 2 * f, x + 3 - 2 * f, top + 14, t, -f * 1.5, k, P.blue, P.blueLo);
    px(ctx, x + f * 1 - 1, top + 4, 3, 7, k(P.ink)); // тело
    px(ctx, x + f * 2 - 1, top + 8, 2, 1, k(P.brass)); // пояс
  } else {
    const back = dir === 'up';
    for (let i = 0; i < 12; i++) {
      const half = 4 + Math.floor(i / 3);
      const off = Math.round(sway * (i / 11));
      px(ctx, x - half + off, top + 2 + i, half * 2, 1, k(P.blue));
      px(ctx, x - half + off, top + 2 + i, 1, 1, k(P.blueLo));
      px(ctx, x + half - 1 + off, top + 2 + i, 1, 1, k(P.blueLo));
      if (i < 3) px(ctx, x - half + 1 + off, top + 2 + i, half * 2 - 2, 1, k(P.blueHi));
    }
    tornHem(ctx, x - 8 + Math.round(sway), x + 7 + Math.round(sway), top + 14, t, sway, k, P.blue, P.blueLo);
    if (back) {
      // знак на спине — янтарный круг с крестом
      const cx = x;
      const cy = top + 8;
      ring(ctx, cx, cy, 2.6, k(P.amber));
      px(ctx, cx, cy - 4, 1, 9, k(P.amber));
      px(ctx, cx - 4, cy, 9, 1, k(P.amber));
    } else {
      // разрез плаща, тёмная туника, пустая рамка на шее
      px(ctx, x - 2, top + 3, 4, 10, k(P.ink));
      px(ctx, x - 1, top + 3, 2, 10, k(P.navy));
      px(ctx, x - 2, top + 9, 4, 1, k(P.brass));
      px(ctx, x - 1, top + 3, 3, 3, k(P.amber));
      px(ctx, x, top + 4, 1, 1, k(P.void));
    }
  }

  // браслет на правой руке: четыре сегмента — заряды
  const armX = dir === 'side' ? x + f * 3 : dir === 'up' ? x - 5 : x + 4;
  const armY = top + 7;
  px(ctx, armX, armY - 2, 2, 5, k(P.blueLo));
  const segs = 4;
  for (let i = 0; i < segs; i++) {
    const lit = i < (o.charges ?? 3);
    px(ctx, armX + (i & 1), armY + 3 + (i >> 1), 1, 1, k(lit ? (i === 3 ? P.amber : P.teal) : P.ink));
  }

  // голова: капюшон и маска из чёрного стекла
  const hx = x - 4 + (dir === 'side' ? f : 0);
  const hy = top - 6;
  px(ctx, hx + 1, hy, 6, 1, k(P.navy));
  px(ctx, hx, hy + 1, 8, 7, k(P.navy));
  px(ctx, hx + 3, hy - 1, 2, 1, k(P.navy));
  px(ctx, hx, hy + 1, 1, 6, k(P.blueLo));
  px(ctx, hx + 7, hy + 1, 1, 6, k(P.blueLo));
  if (dir === 'down') {
    px(ctx, hx + 2, hy + 2, 4, 5, k(P.void));
    px(ctx, hx + 2, hy + 2, 4, 1, k(P.ash3)); // блик стекла
    px(ctx, hx + 2, hy + 4, 1, 1, k(P.teal));
    px(ctx, hx + 5, hy + 4, 1, 1, k(P.teal));
  } else if (dir === 'side') {
    const mx = f > 0 ? hx + 4 : hx + 1;
    px(ctx, mx, hy + 2, 3, 5, k(P.void));
    px(ctx, mx, hy + 2, 3, 1, k(P.ash3));
    px(ctx, f > 0 ? mx + 2 : mx, hy + 4, 1, 1, k(P.teal));
  } else {
    px(ctx, hx + 2, hy + 2, 4, 4, k(P.slate));
  }

  if (!swordBehind) drawSword(ctx, x, y + bob, o, k);
}

function drawSword(ctx, x, y, o, k) {
  const a = o.aim ?? Math.PI / 2;
  const hand = [x + Math.cos(a) * 5, y - 9 + Math.sin(a) * 3];
  let ang = a;
  if (o.swing != null) {
    // взмах: от -70° до +70° относительно прицела, третий удар — полный оборот
    const span = o.swingStep === 3 ? Math.PI * 1.6 : 2.4;
    const dirS = o.swingStep === 2 ? -1 : 1;
    ang = a + dirS * (-span / 2 + span * Math.min(1, o.swing / 0.16));
  } else if (!o.moving) {
    ang = a + 0.9; // опущен
  }
  const len = 11;
  const ex = hand[0] + Math.cos(ang) * len;
  const ey = hand[1] + Math.sin(ang) * len * 0.8;
  const blade = o.glow ? P.amberHi : P.ash4;
  line(ctx, hand[0], hand[1], ex, ey, k(blade));
  line(ctx, hand[0] + Math.cos(ang) * 3, hand[1] + Math.sin(ang) * 2.4, ex, ey, k(o.glow ? P.amber : P.milk));
  px(ctx, hand[0] - 1, hand[1] - 1, 2, 2, k(P.brass)); // гарда
  if (o.glow) {
    // вспышка на оружии — окно точного удара
    px(ctx, ex - 1, ey - 1, 3, 3, P.amberHi);
    px(ctx, ex, ey - 3, 1, 7, 'rgba(255,210,122,0.7)');
    px(ctx, ex - 3, ey, 7, 1, 'rgba(255,210,122,0.7)');
  }
}

// ── Пустокожий: житель, у которого исчезло имя ──────────────────────────
export function drawHollow(ctx, x, y, o) {
  const k = o.k || ident;
  const past = o.phase === 'past';
  x = Math.round(x);
  y = Math.round(y);
  shadow(ctx, x, y, 12);
  const step = Math.sin((o.walk || 0) * Math.PI * 2);
  const skin = past ? P.skin : P.ash3;
  const cloth = past ? P.amber0 : P.ash1;
  const lean = o.windup ? -1 : 0;
  // ноги
  px(ctx, x - 3, y - 7, 2, 6 - (step > 0.3 ? 1 : 0), k(P.ash0));
  px(ctx, x + 1, y - 7, 2, 6 - (step < -0.3 ? 1 : 0), k(P.ash0));
  // тело в лохмотьях
  const top = y - 19;
  for (let i = 0; i < 12; i++) {
    const half = 3 + (i > 6 ? 1 : 0);
    px(ctx, x - half + lean, top + 4 + i, half * 2, 1, k(cloth));
  }
  for (let i = -4; i <= 3; i += 2) px(ctx, x + i + lean, top + 16 + ((i + 8) % 3), 1, 2, k(cloth));
  // длинные руки
  const reach = o.lunge ? 4 : 0;
  px(ctx, x - 6 + lean - reach, top + 5, 2, 9, k(skin));
  px(ctx, x + 4 + lean + reach, top + 5, 2, 9, k(skin));
  px(ctx, x - 6 + lean - reach, top + 14, 2, 2, k(P.ash4));
  px(ctx, x + 4 + lean + reach, top + 14, 2, 2, k(P.ash4));
  // голова
  px(ctx, x - 3 + lean, top - 2, 6, 7, k(skin));
  px(ctx, x - 2 + lean, top - 3, 4, 1, k(skin));
  if (past) {
    // у Отпечатка ещё есть лицо и шарф
    px(ctx, x - 2 + lean, top + 1, 1, 1, k(P.ink));
    px(ctx, x + 1 + lean, top + 1, 1, 1, k(P.ink));
    px(ctx, x - 1 + lean, top + 3, 2, 1, k(P.amber0));
    px(ctx, x - 3 + lean, top + 4, 7, 2, k(P.amber));
  } else {
    // вместо лица — провал Стирания
    px(ctx, x - 2 + lean, top, 4, 4, k(P.void));
    px(ctx, x - 1 + lean, top + 1, 2, 2, k(o.windup ? P.crimsonHi : P.crimson1));
    const g = Math.floor((o.t || 0) * 12) % 4;
    px(ctx, x + 3 + g - 2, top + 2 + (g & 1), 1, 1, k(P.crimson));
  }
}

// ── Кадровик: существо-кадр плёнки, пропускает каждый третий кадр ─────
export function drawFramer(ctx, x, y, o) {
  const k = o.k || ident;
  const past = o.phase === 'past';
  x = Math.round(x);
  y = Math.round(y);
  shadow(ctx, x, y, 8, 0.35);
  const body = past ? P.brass : P.crimson1;
  const hi = past ? P.brassHi : P.crimson;
  const t = o.t || 0;
  const leg = Math.floor(t * 10) & 1;
  // ножки
  px(ctx, x - 4, y - 3 + leg, 1, 3 - leg, k(P.ink));
  px(ctx, x - 2, y - 3, 1, 3, k(P.ink));
  px(ctx, x + 1, y - 3, 1, 3, k(P.ink));
  px(ctx, x + 3, y - 3 + (1 - leg), 1, 3 - (1 - leg), k(P.ink));
  // кадр с перфорацией
  px(ctx, x - 5, y - 11, 10, 8, k(P.ink));
  px(ctx, x - 4, y - 10, 8, 6, k(body));
  px(ctx, x - 4, y - 10, 8, 1, k(hi));
  for (let i = 0; i < 3; i++) {
    px(ctx, x - 5, y - 10 + i * 2, 1, 1, k(P.milk));
    px(ctx, x + 4, y - 10 + i * 2, 1, 1, k(P.milk));
  }
  // глаз
  px(ctx, x - 1, y - 8, 3, 2, k(P.milk));
  px(ctx, x + (o.look || 0), y - 8, 1, 2, k(P.void));
}

// ── Звонарь ─────────────────────────────────────────────────────────────
export function drawRinger(ctx, x, y, o) {
  const k = o.k || ident;
  const past = o.phase === 'past';
  x = Math.round(x);
  y = Math.round(y);
  shadow(ctx, x, y, 14);
  const robe = past ? P.milk : P.ash2;
  const robeLo = past ? P.ash4 : P.ash1;
  const t = o.t || 0;
  // ряса
  for (let i = 0; i < 16; i++) {
    const half = 3 + Math.floor(i / 3);
    px(ctx, x - half, y - 18 + i, half * 2, 1, k(i % 4 === 3 ? robeLo : robe));
  }
  for (let i = -8; i < 8; i += 2) px(ctx, x + i, y - 2, 1, 1 + ((i + 8) & 2 ? 1 : 0), k(past ? P.amber0 : P.crimson1));
  // капюшон
  px(ctx, x - 4, y - 24, 8, 7, k(robe));
  px(ctx, x - 3, y - 22, 6, 5, k(P.void));
  px(ctx, x - 1, y - 20, 2, 1, k(past ? P.amberHi : P.crimsonHi));
  // колокол в руках
  const ring = o.charge ? Math.sin(t * 40) : 0;
  const bx = x + Math.round(ring);
  px(ctx, bx - 3, y - 12, 6, 1, k(P.brassHi));
  px(ctx, bx - 3, y - 11, 6, 4, k(P.brass));
  px(ctx, bx - 4, y - 7, 8, 1, k(P.brassHi));
  px(ctx, bx, y - 6, 1, 1, k(P.amber0));
  px(ctx, x - 5, y - 13, 2, 3, k(robeLo));
  px(ctx, x + 3, y - 13, 2, 3, k(robeLo));
}

// ── Звонкая Тень: вытянутое существо без лица с кольцом колокольчиков ──
export function drawShadow(ctx, x, y, o) {
  const k = o.k || ident;
  const past = o.phase === 'past';
  const t = o.t || 0;
  x = Math.round(x);
  y = Math.round(y);
  shadow(ctx, x, y, 18, 0.55);
  const body = past ? P.slate : P.ink;
  // шлейф-тело
  for (let i = 0; i < 30; i++) {
    const half = i < 6 ? 3 : 3 + Math.floor((i - 6) / 5);
    const wob = Math.round(Math.sin(t * 4 + i * 0.4) * (i / 20));
    px(ctx, x - half + wob, y - 34 + i, half * 2, 1, k(body));
  }
  for (let i = -7; i < 8; i += 2) px(ctx, x + i, y - 4 + Math.round(Math.sin(t * 6 + i)), 1, 3, k(body));
  // лицо — пустой бледный овал
  px(ctx, x - 2, y - 33, 4, 6, k(past ? P.amberHi : P.milk));
  px(ctx, x - 1, y - 34, 2, 1, k(past ? P.amberHi : P.milk));
  // кольцо колокольчиков
  const n = 6;
  const shield = o.shield;
  for (let i = 0; i < n; i++) {
    const a = t * (past ? 1 : 2.4) + (i / n) * Math.PI * 2;
    const bx = x + Math.cos(a) * 13;
    const by = y - 18 + Math.sin(a) * 5;
    const front = Math.sin(a) > 0;
    if (!front && o.layer === 'front') continue;
    px(ctx, bx - 1, by - 1, 3, 2, k(shield ? P.brassHi : P.ash2));
    px(ctx, bx - 2, by + 1, 5, 1, k(shield ? P.brass : P.ash1));
  }
  if (shield) ring(ctx, x, y - 18, 15, 'rgba(230,192,106,0.35)', 0.45, 2);
}

// ── Брат Мел — звонарь без башни ───────────────────────────────────────
export function drawMel(ctx, x, y, o) {
  const k = o.k || ident;
  const t = o.t || 0;
  const v = o.version; // 'imprint' | 'scar' | undefined (целый)
  x = Math.round(x);
  y = Math.round(y);
  shadow(ctx, x, y, 34, 0.5);
  const hover = Math.round(Math.sin(t * 1.6) * 1.5);
  const yy = y - 4 + hover;
  // ряса: левая половина молочно-золотая, правая — малиновая (если целый)
  for (let i = 0; i < 44; i++) {
    const half = 5 + Math.floor(i / 3);
    for (let s = -half; s < half; s++) {
      const right = s >= 0;
      let c;
      if (v === 'imprint') c = (i + s) % 7 === 0 ? P.ash4 : P.milk;
      else if (v === 'scar') c = (i + s) % 5 === 0 ? P.crimson0 : P.crimson1;
      else c = right ? ((i * 3 + s) % 11 === 0 ? P.void : P.crimson1) : ((i + s) % 9 === 0 ? P.ash4 : P.milk);
      px(ctx, x + s, yy - 52 + i, 1, 1, k(c));
    }
  }
  // рваный подол
  for (let s = -20; s < 20; s++) {
    const len = 2 + Math.round(Math.abs(Math.sin(s * 1.7 + t * 2)) * 4);
    const c = v === 'scar' || (!v && s >= 0) ? P.crimson1 : P.ash4;
    px(ctx, x + s, yy - 8, 1, len, k(c));
  }
  // золотые цепи
  for (let i = 0; i < 6; i++) px(ctx, x - 12 + i * 2, yy - 40 + i * 3, 2, 1, k(P.brassHi));
  // капюшон и пустота лица
  px(ctx, x - 7, yy - 62, 14, 12, k(v === 'scar' ? P.crimson1 : P.milk));
  px(ctx, x - 5, yy - 60, 10, 10, k(P.void));
  px(ctx, x - 2, yy - 65, 4, 3, k(v === 'scar' ? P.crimson1 : P.milk));
  // нимб
  if (v !== 'scar') ring(ctx, x, yy - 57, 11, k(P.amber), 1, 2);
  if (v !== 'imprint') ring(ctx, x + 2, yy - 55, 14, k(P.crimson), 1, 3);
  // руки с колокольчиками на цепях
  const swingL = Math.sin(t * 2) * 3;
  const swingR = Math.sin(t * 2 + 1) * 3;
  line(ctx, x - 14, yy - 38, x - 20 + swingL, yy - 22, k(P.brass));
  line(ctx, x + 14, yy - 38, x + 20 + swingR, yy - 24, k(P.brass));
  drawSmallBell(ctx, x - 20 + swingL, yy - 22, k, false);
  drawSmallBell(ctx, x + 20 + swingR, yy - 24, k, v !== 'imprint');
  if (o.windup) {
    disc(ctx, x, yy - 57, 3, P.crimsonHi);
  }
}

function drawSmallBell(ctx, x, y, k, scar) {
  px(ctx, x - 2, y, 4, 1, k(scar ? P.crimson : P.brassHi));
  px(ctx, x - 3, y + 1, 6, 4, k(scar ? P.crimson1 : P.brass));
  px(ctx, x - 4, y + 5, 8, 1, k(scar ? P.crimson : P.brassHi));
}

// Огромный колокол на чёрной нити.
export function drawGreatBell(ctx, x, y, o) {
  const k = o.k || ident;
  const past = o.phase === 'past';
  const t = o.t || 0;
  const sw = Math.round(Math.sin(t * 1.3) * (o.ringing ? 3 : 1));
  x = Math.round(x) + sw;
  y = Math.round(y);
  line(ctx, x - sw, y - 200, x, y - 34, P.void, 2);
  const body = past ? P.brass : P.ash2;
  const hi = past ? P.brassHi : P.ash3;
  for (let i = 0; i < 30; i++) {
    const half = 6 + Math.floor(Math.pow(i / 30, 1.8) * 12);
    px(ctx, x - half, y - 32 + i, half * 2, 1, k(i % 9 === 4 ? hi : body));
    px(ctx, x - half, y - 32 + i, 2, 1, k(hi));
  }
  px(ctx, x - 20, y - 2, 40, 2, k(hi));
  px(ctx, x - 3, y - 36, 6, 4, k(body));
  // солнце-знак
  ring(ctx, x, y - 16, 4, k(past ? P.amberHi : P.ash1));
  if (!past) {
    for (let i = 0; i < 8; i++) px(ctx, x + 2 + i, y - 22 + ((i * 5) % 14), 1, 2, P.crimson);
  }
  if (o.cracks) for (let i = 0; i < o.cracks; i++) line(ctx, x - 10 + i * 7, y - 28 + i * 3, x - 6 + i * 7, y - 6, P.void);
}

// ── NPC ─────────────────────────────────────────────────────────────────
export function drawTik(ctx, x, y, o = {}) {
  const k = o.k || ident;
  x = Math.round(x);
  y = Math.round(y);
  shadow(ctx, x, y, 10);
  const b = Math.round(Math.sin((o.t || 0) * 3));
  px(ctx, x - 4, y - 9, 8, 8, k(P.wood));
  px(ctx, x - 3, y - 2, 2, 2, k(P.ink));
  px(ctx, x + 1, y - 2, 2, 2, k(P.ink));
  px(ctx, x - 5, y - 16 + b, 10, 8, k(P.brass)); // медная маска
  px(ctx, x - 5, y - 16 + b, 10, 1, k(P.brassHi));
  px(ctx, x - 3, y - 13 + b, 2, 2, k(P.void));
  px(ctx, x + 1, y - 13 + b, 2, 2, k(P.void));
  px(ctx, x - 2, y - 13 + b, 1, 1, k(P.tealHi));
  px(ctx, x - 1, y - 10 + b, 2, 1, k(P.amber0));
}

export function drawMara(ctx, x, y, o = {}) {
  const k = o.k || ident;
  x = Math.round(x);
  y = Math.round(y);
  shadow(ctx, x, y, 12);
  for (let i = 0; i < 14; i++) {
    const half = 3 + Math.floor(i / 4);
    px(ctx, x - half, y - 15 + i, half * 2, 1, k(P.wood));
  }
  px(ctx, x - 3, y - 12, 6, 10, k(P.milk)); // фартук
  px(ctx, x - 3, y - 12, 6, 1, k(P.ash4));
  px(ctx, x - 3, y - 21, 6, 6, k(P.skin));
  px(ctx, x - 4, y - 22, 8, 3, k(P.crimson1)); // платок
  px(ctx, x - 4, y - 19, 1, 3, k(P.crimson1));
  px(ctx, x - 2, y - 18, 1, 1, k(P.ink));
  px(ctx, x + 1, y - 18, 1, 1, k(P.ink));
  px(ctx, x - 1, y - 16, 2, 1, k(P.amber0));
}

export function drawDog(ctx, x, y, o = {}) {
  const k = o.k || ident;
  x = Math.round(x);
  y = Math.round(y);
  shadow(ctx, x, y, 14);
  const wag = Math.round(Math.sin((o.t || 0) * 8));
  const c = o.past ? P.amber1 : P.ash3;
  px(ctx, x - 6, y - 7, 11, 4, k(c));
  px(ctx, x - 6, y - 3, 2, 3, k(c));
  px(ctx, x + 3, y - 3, 2, 3, k(c));
  px(ctx, x + 4, y - 11, 5, 5, k(c));
  px(ctx, x + 8, y - 9, 2, 2, k(P.ink));
  px(ctx, x + 4, y - 12, 2, 2, k(P.ash2));
  px(ctx, x + 6, y - 10, 1, 1, k(P.ink));
  px(ctx, x - 8, y - 9 + wag, 2, 2, k(c));
}

// Силуэт-воспоминание (Арно, Сена, жители): голова, плечи, сканлайны, низ растворяется.
export function drawGhost(ctx, x, y, o = {}) {
  const k = o.k || ident;
  const c = o.color || P.amber;
  const lo = o.color === P.milk ? P.ash3 : o.color === P.amberHi ? P.amber : P.amber1;
  const a = o.alpha ?? 0.75;
  const t = o.t || 0;
  x = Math.round(x);
  y = Math.round(y);
  shadow(ctx, x, y, 10, 0.25);
  ctx.globalAlpha = a;
  // тело: от плеч к подолу
  for (let i = 0; i < 14; i++) {
    const half = o.dress ? 3 + Math.floor(i / 3) : i < 2 ? 3 : 4;
    const yy = y - 15 + i;
    if (i > 10 && (i + Math.floor(t * 8)) % 2) continue; // растворяется
    const line_ = (i + Math.floor(t * 6)) % 4 === 0;
    ctx.globalAlpha = a * (line_ ? 0.45 : 1);
    px(ctx, x - half, yy, half * 2, 1, k(c));
    px(ctx, x - half, yy, 1, 1, k(lo));
    px(ctx, x + half - 1, yy, 1, 1, k(lo));
  }
  ctx.globalAlpha = a;
  // руки
  px(ctx, x - 5, y - 13, 1, 6, k(lo));
  px(ctx, x + 4, y - 13, 1, 6, k(lo));
  // голова
  px(ctx, x - 2, y - 21, 4, 1, k(c));
  px(ctx, x - 3, y - 20, 6, 4, k(c));
  px(ctx, x - 2, y - 16, 4, 1, k(c));
  px(ctx, x - 1, y - 15, 2, 1, k(lo));
  if (o.hat) {
    px(ctx, x - 4, y - 22, 8, 1, k(lo));
    px(ctx, x - 2, y - 24, 4, 2, k(lo));
  }
  if (o.dress) px(ctx, x - 3, y - 21, 1, 6, k(lo)); // волосы
  px(ctx, x - 2, y - 19, 1, 1, k(P.void));
  px(ctx, x + 1, y - 19, 1, 1, k(P.void));
  ctx.globalAlpha = 1;
  // искры памяти
  const f = Math.floor(t * 10) % 9;
  if (f < 2) px(ctx, x - 5 + ((t * 37) % 10), y - 6 - f * 3, 1, 1, P.milk);
}

// Латунный Мальчик: статуя / автоматон / ребёнок.
export function drawBrassBoy(ctx, x, y, o = {}) {
  const k = o.k || ident;
  const past = o.phase === 'past';
  x = Math.round(x);
  y = Math.round(y);
  // постамент
  px(ctx, x - 10, y - 8, 20, 8, k(P.stone2));
  px(ctx, x - 10, y - 8, 20, 1, k(P.stone3));
  px(ctx, x - 11, y - 1, 22, 1, k(P.ink));
  const c = past ? P.brassHi : P.brass;
  const lo = past ? P.brass : P.amber0;
  if (!past) {
    // в настоящем статуя разрушена: только ноги и обломки
    px(ctx, x - 3, y - 16, 2, 8, k(lo));
    px(ctx, x + 1, y - 13, 2, 5, k(lo));
    px(ctx, x - 7, y - 10, 3, 2, k(c));
    px(ctx, x + 5, y - 11, 2, 3, k(c));
    px(ctx, x - 2, y - 18, 4, 2, k(P.crimson1));
    return;
  }
  const b = Math.round(Math.sin((o.t || 0) * 2));
  px(ctx, x - 3, y - 16, 2, 8, k(lo));
  px(ctx, x + 1, y - 16, 2, 8, k(lo));
  px(ctx, x - 4, y - 26 + b, 8, 10, k(c));
  px(ctx, x - 6, y - 25 + b, 2, 7, k(lo));
  px(ctx, x + 4, y - 25 + b, 2, 7, k(lo));
  px(ctx, x - 3, y - 33 + b, 6, 7, k(c));
  px(ctx, x - 2, y - 30 + b, 1, 1, k(P.void));
  px(ctx, x + 1, y - 30 + b, 1, 1, k(P.void));
  px(ctx, x - 4, y - 34 + b, 8, 2, k(lo)); // кепка
  px(ctx, x - 1, y - 21 + b, 2, 2, k(P.void)); // замочная скважина завода
}
