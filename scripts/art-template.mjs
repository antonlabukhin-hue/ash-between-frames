// Шаблон комнаты для художника или генератора: node scripts/art-template.mjs <room>
// → art/templates/<room>/
//     reference.png — комната как сейчас (кодовый арт), в плотной сетке: основа для img2img;
//     guide.png     — то же с сеткой тайлов, стенами, пустотами, выходами и объектами;
//     mask.png      — карта проходимости: белое — пол, серое — стены, чёрное — пустота,
//                     прозрачное — небо (эти места на рисунке будут вырезаны);
//     spec.json     — размеры, тайл, выходы и объекты.
// Нужен запущенный dev-сервер (ABF_URL, по умолчанию http://localhost:5310/).
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const room = process.argv[2] || 'road';
const dir = `art/templates/${room}`;
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(process.env.ABF_URL || 'http://localhost:5310/');
await page.waitForFunction(() => window.__abf);
const out = await page.evaluate(async (id) => {
  const A = window.__abf;
  A.game.flags.introSeen = true;
  await A.shot(id);
  const { T, TILE } = await import('/src/art/tiles.js');
  const g = A.game;
  const r = g.room;
  const RS = A.renderer.rs;
  const src = g.roomCanvas;
  const W = r.pxW * RS;
  const H = r.pxH * RS;
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return [c, c.getContext('2d')];
  };
  const [ref, rx] = mk();
  rx.fillStyle = '#05060c';
  rx.fillRect(0, 0, W, H);
  rx.drawImage(src, 0, 0);
  const [guide, gx] = mk();
  gx.drawImage(ref, 0, 0);
  const [mask, mx] = mk();
  const tile = (tx, ty) => r.tiles[ty * r.w + tx];
  const sky = (tx, ty) => tile(tx, ty) === T.WALL && ty < (r.def.skyRows ?? 0);
  for (let ty = 0; ty < r.h; ty++) {
    for (let tx = 0; tx < r.w; tx++) {
      const t = tile(tx, ty);
      const x = tx * TILE * RS;
      const y = ty * TILE * RS;
      const s = TILE * RS;
      if (sky(tx, ty)) continue;
      mx.fillStyle = t === T.VOID ? '#000000' : t === T.WALL ? '#808080' : '#ffffff';
      mx.fillRect(x, y, s, s);
      if (t === T.WALL) gx.fillStyle = 'rgba(255,60,60,0.28)';
      else if (t === T.VOID) gx.fillStyle = 'rgba(0,0,0,0.55)';
      else if (t === T.ROAD) gx.fillStyle = 'rgba(80,140,255,0.12)';
      else gx.fillStyle = 'rgba(0,0,0,0)';
      gx.fillRect(x, y, s, s);
    }
  }
  gx.strokeStyle = 'rgba(255,255,255,0.18)';
  gx.lineWidth = 1;
  for (let x = 0; x <= W; x += TILE * RS) gx.strokeRect(x, 0, 0, H);
  for (let y = 0; y <= H; y += TILE * RS) gx.strokeRect(0, y, W, 0);
  gx.font = `${6 * RS}px sans-serif`;
  const props = [];
  for (const p of g.props) {
    const f = p.def.flat ? { x: p.x, y: p.y, w: p.w, h: p.h } : p.def.foot ? { x: p.x - p.def.foot.w / 2, y: p.y - p.def.foot.h, w: p.def.foot.w, h: p.def.foot.h } : { x: p.x - 4, y: p.y - 4, w: 8, h: 4 };
    props.push({ kind: p.kind, x: Math.round(p.x), y: Math.round(p.y), foot: f });
    gx.strokeStyle = '#ffd27a';
    gx.strokeRect(f.x * RS, f.y * RS, f.w * RS, f.h * RS);
    gx.fillStyle = '#ffd27a';
    gx.fillText(p.kind, f.x * RS, f.y * RS - 2);
  }
  const exits = g.exits.map((e) => ({ to: e.to, ...e.rect }));
  for (const e of exits) {
    gx.fillStyle = 'rgba(80,255,140,0.4)';
    gx.fillRect(e.x * RS, e.y * RS, e.w * RS, e.h * RS);
  }
  return {
    reference: ref.toDataURL('image/png'),
    guide: guide.toDataURL('image/png'),
    mask: mask.toDataURL('image/png'),
    spec: { room: id, title: r.def.title, size: [W, H], world: [r.pxW, r.pxH], rs: RS, tile: TILE * RS, skyRows: r.def.skyRows ?? 0, exits, props },
  };
}, room);
const png = (d) => Buffer.from(d.split(',')[1], 'base64');
writeFileSync(`${dir}/reference.png`, png(out.reference));
writeFileSync(`${dir}/guide.png`, png(out.guide));
writeFileSync(`${dir}/mask.png`, png(out.mask));
writeFileSync(`${dir}/spec.json`, JSON.stringify(out.spec, null, 2));
console.log(`${dir}: ${out.spec.size.join('×')} px, тайл ${out.spec.tile} px, объектов ${out.spec.props.length}`);
await browser.close();
