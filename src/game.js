// Состояние игры, загрузка комнат, обновление мира и сценарные помощники.
import { parseRoom } from './world/room.js';
import { buildRoomCanvas, TILE } from './art/tiles.js';
import { createPlayer, updatePlayer, hurtPlayer, resetPlayerCombat, applyShift } from './player/player.js';
import { updateEnemies, damageEnemy, createEnemy } from './enemies/enemies.js';
import { updateProjectiles } from './combat/projectiles.js';
import { createProp, propFoot, propCenter } from './world/props.js';
import { collectLights, isPit, isWall, solidPropAt } from './world/world.js';
import { updateIslands, inIslands, auraSources, carryPos, dropPos } from './world/memory.js';
import { link, resolveThreads, chainOf } from './timeline/threads.js';
import { stepShade, hitShade } from './player/echo.js';
import { pointInRect } from './world/room.js';
import { updateFx, burst, addText, ringFx, slashFx } from './world/fx.js';
import { tickTimeline, isShifted, PAST } from './timeline/timeline.js';
import { writeSave, freshSave } from './save/save.js';
import { addFragment, hasFragment, loseFragments, FRAGMENTS } from './items/fragments.js';
import { dist, clamp } from './core/math.js';
import { findInteractable, shiftLabel } from './world/interact.js';
import { W, H } from './core/renderer.js';
import { P } from './art/palette.js';
import { ROOMS } from './scenes/rooms.js';
import { createParticlePool, clearParticles, resizePool } from './world/particles.js';
import { PROFILES } from './core/quality.js';
import { MEMORIES, addMemory, hasMemory, memoryList, createScene, stepScene } from './story/memories.js';
import { NODES, LOSS, isFixed, fixedWith, nodePrices, fixNode } from './story/nodes.js';

export function createGame({ input, audio, ui, storage, save }) {
  const g = {
    input, audio, ui, storage, save, flags: save.flags,
    scene: 'title', time: 0, room: null, roomCanvas: null,
    player: null, enemies: [], props: [], projectiles: [], pickups: [], fx: [], texts: [], voidZones: [], drawables: [],
    exits: [], lights: [], scenes: [], barkList: [], cam: { x: 0, y: 0, shakeA: 0, shakeT: 0 },
    cinematic: false, inputLocked: false, paused: false, hitstopT: 0, slowT: 0,
    waiters: [], scriptToken: 0, bossBar: null, interactTarget: null, freeShift: false, glitch: 0.015,
    transitioning: false, frame: 0,
    quality: PROFILES.medium, particles: createParticlePool(PROFILES.medium.particles),
  };

  g.setQuality = (profile) => {
    g.quality = profile;
    g.particles = resizePool(g.particles, profile.particles);
  };

  // ── службы для модулей ──────────────────────────────────────────────
  g.persist = () => writeSave(storage, save);
  g.damageEnemy = (e, amount, o) => damageEnemy(g, e, amount, o);
  g.hurtPlayer = (amount, sx, sy, kind) => hurtPlayer(g, amount, sx, sy, kind);
  g.hasFragment = (id) => hasFragment(save, id);
  g.applyShiftFree = (e) => applyShift(g, { obj: e, x: e.x, y: e.y - 8, type: 'enemy' }, { free: true });
  g.toast = (t, d) => ui.toast(t, d);
  g.hint = (t, d) => ui.hint(t, d);
  g.shake = (a, t) => {
    g.cam.shakeA = Math.max(g.cam.shakeA, a);
    g.cam.shakeT = Math.max(g.cam.shakeT, t);
  };
  g.hitstop = (t) => {
    g.hitstopT = Math.max(g.hitstopT, t);
  };
  g.slowmo = (t) => {
    g.slowT = Math.max(g.slowT, t);
  };
  g.vibrate = (pattern) => {
    if (save.settings.vibration && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch {
        /* нет вибрации */
      }
    }
  };

  // ── воспоминания (docs/TIME_DESIGN.md, П5) ───────────────────────────
  g.remember = (id) => {
    if (!addMemory(save, id)) return false;
    const m = MEMORIES[id];
    ui.card('Воспоминание · в дневнике (Tab)', m.name, m.text, 4.6);
    audio.sfx.shift('past');
    g.persist();
    return true;
  };
  g.hasMemory = (id) => hasMemory(save, id);

  // Сцена прошлого: призраки говорят репликами над головой, пока cond(g) истинно.
  // Досмотрел — воспоминание. Ушёл или прошлое погасло — сцена рассыпается и начнётся снова.
  // lines: [{ at: объект|{x,y}|() => {x,y}, who, text, dur }]
  g.pastScene = ({ memory, cond, lines, onDone }) => {
    if (memory && (hasMemory(save, memory) || save.spentMemories?.includes(memory))) return null;
    const sc = { ...createScene(lines), memory, cond, onDone, tok: g.scriptToken };
    g.scenes.push(sc);
    return sc;
  };
  g.barks = [];
  const anchorOf = (at) => (typeof at === 'function' ? at() : at);
  function updateScenes(dt) {
    for (const sc of g.scenes) {
      if (sc.done || sc.tok !== g.scriptToken) continue;
      const ev = stepScene(sc, !g.cinematic && !g.paused && !!sc.cond(g), dt);
      if (ev === 'line') {
        const l = sc.lines[sc.i];
        g.barks = [{ at: l.at, who: l.who, text: l.text, sc }];
      } else if (ev === 'reset') {
        g.barks = g.barks.filter((b) => b.sc !== sc);
        const p = g.player;
        if (p) addText(g, p.x, p.y - 30, 'сцена рассеялась', P.ash4);
      } else if (ev === 'done') {
        g.barks = g.barks.filter((b) => b.sc !== sc);
        if (sc.memory) g.remember(sc.memory);
        sc.onDone?.(g);
      }
    }
    g.barkList = g.barks.map((b) => ({ ...anchorOf(b.at), who: b.who, text: b.text }));
  }
  g.updateScenes = updateScenes;

  // Предъявить воспоминание: выбор из дневника; reactions[id] — что делает собеседник.
  // Возвращает id показанного или null.
  g.present = async (prompt, reactions = {}, fallback = 'Это ни о чём мне не говорит.', who = '') => {
    const list = memoryList(save);
    if (!list.length) return null;
    const i = await g.choose(prompt, [...list.map((m) => ({ text: m.name, sub: m.place })), { text: 'Ничего не показывать' }]);
    const m = list[i];
    if (!m) return null;
    if (reactions[m.id]) await reactions[m.id](g);
    else await g.say([{ who, text: fallback }]);
    return m.id;
  };

  g.giveFragment = (id) => {
    if (!addFragment(save, id)) return;
    const f = FRAGMENTS[id];
    ui.card('Фрагмент', f.name, f.desc, 3.6);
    audio.sfx.shard();
    g.persist();
  };

  g.spawnPickup = (kind, x, y, data = {}) => {
    const a = Math.random() * Math.PI * 2;
    g.pickups.push({ kind, x, y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 20, t: 0, seed: Math.random() * 10, ...data });
  };

  g.addProp = (kind, x, y, o) => {
    const p = createProp(kind, x, y, o);
    // переносной свет: E — взять; в руках — E (или удар) — поставить
    if (p.def.carry && !p.onInteract) {
      p.prompt ??= `Взять: ${p.def.name.toLowerCase()}`;
      p.onInteract = () => g.pickUp(p);
    }
    g.props.push(p);
    return p;
  };

  // нить причины: cause → effect (docs/TIME_DESIGN.md, П3)
  g.link = (cause, effect, o) => link(cause, effect, o);

  // ── Узлы памяти (П6) ─────────────────────────────────────────────
  // Узел под объектом obj: закрепление навсегда переводит obj в прошлое (и делает несдвигаемым).
  // o: { x, y, w, h } — круг на земле; onFix(g, obj, silent) — последствия; interact — false,
  // если закрепляет сцена (выбор у костра), а не сам круг.
  const fixObject = (obj) => {
    obj.tl.base = PAST;
    obj.tl.phase = PAST;
    obj.tl.left = 0;
    obj.tl.switchable = false;
  };
  g.isFixed = (id) => isFixed(save, id);
  g.memoryNode = (obj, id, o = {}) => {
    const w = o.w ?? 40;
    const h = o.h ?? 18;
    const node = g.addProp('memoryNode', o.x ?? obj.x - w / 2, o.y ?? obj.y - h / 2 - 2, { w, h, prompt: 'Узел памяти', nodeId: id });
    node.fixed = isFixed(save, id);
    if (node.fixed) {
      fixObject(obj);
      o.onFix?.(g, obj, true);
    }
    node.fix = async (memory) => {
      if (!fixNode(save, id, memory)) return false;
      node.fixed = true;
      fixObject(obj);
      g.persist();
      audio.sfx.shift(PAST);
      const [cx, cy] = propCenter(node);
      ringFx(g, cx, cy, 4, 46, P.amberHi, 0.8);
      burst(g, cx, cy - 6, [P.amberHi, P.milk, P.amber], 24, 60);
      g.toast(`«${MEMORIES[memory].name}» отдано. ${NODES[id].name} — навсегда в прошлом.`, 4);
      await o.onFix?.(g, obj, false);
      return true;
    };
    node.onInteract = async () => {
      const def = NODES[id];
      if (node.fixed) {
        await g.say([{ who: '', text: `Узел памяти «${def.name}» закреплён. Отдано: «${MEMORIES[fixedWith(save, id)].name}».` }]);
        return;
      }
      if (o.interact === false) {
        await g.say([{ who: '', text: `Узел памяти «${def.name}». ${o.closedText || 'Руны гаснут: здесь всё уже решено.'}` }]);
        return;
      }
      const prices = nodePrices(save, id);
      const want = def.accepts ? def.accepts.map((m) => `«${MEMORIES[m].name}»`).join(' или ') : 'любое воспоминание';
      if (!prices.length) {
        await g.say([{ who: '', text: `Узел памяти «${def.name}». ${def.gain} Цена — ${want}. В дневнике нет подходящего.` }]);
        return;
      }
      await g.say([{ who: '', text: `Узел памяти «${def.name}». ${def.gain} Цена — ${want}: отданное исчезнет из мира.` }]);
      const opts = prices.map((m) => ({ text: `Отдать «${MEMORIES[m].name}»`, sub: LOSS[m] || 'Это воспоминание исчезнет навсегда.' }));
      opts.push({ text: 'Не сейчас', sub: 'Сдвиг останется временным' });
      const i = await g.choose('Закрепить прошлое навсегда?', opts);
      if (i < prices.length) await node.fix(prices[i]);
    };
    return node;
  };

  // ── Эхо (П4) ─────────────────────────────────────────────────────
  g.hitShade = (n = 1) => {
    const sh = g.echoShade;
    if (!sh || sh.done) return;
    burst(g, sh.x, sh.y - 10, [P.teal, P.tealHi], 6, 40);
    if (hitShade(sh, n)) {
      burst(g, sh.x, sh.y - 10, [P.teal, P.milk], 16, 60);
      addText(g, sh.x, sh.y - 28, 'Эхо рассыпалось', P.teal);
    }
  };
  function updateShade(dt) {
    const sh = g.echoShade;
    if (!sh) return;
    for (const ev of stepShade(sh, dt)) {
      if (ev.type === 'attack') {
        slashFx(g, sh.x, sh.y - 8, ev.aim, 2.2, 20, P.teal, 0.16);
        for (const e of g.enemies) {
          if (e.dead || e.spawn > 0 || dist(e.x, e.y, sh.x, sh.y) > 24) continue;
          const da = Math.atan2(e.y - sh.y, e.x - sh.x) - ev.aim;
          if (Math.abs(Math.atan2(Math.sin(da), Math.cos(da))) > 1.2) continue;
          g.damageEnemy(e, 6, { kx: Math.cos(ev.aim) * 60, ky: Math.sin(ev.aim) * 40 });
        }
      } else if (ev.type === 'shift') {
        const t = ev.target;
        if (t.obj && !t.obj.dead && !t.obj.removed && t.obj.tl?.switchable) {
          // тень не отменяет сдвиг: уже сдвинутое она продлевает, иначе — сдвигает сама
          if (isShifted(t.obj.tl)) t.obj.tl.left = Math.max(t.obj.tl.left, t.obj.tl.hold);
          else applyShift(g, t, { free: true, byShade: true });
          ringFx(g, sh.x, sh.y - 10, 2, 18, P.teal, 0.3);
        }
      }
    }
    if (sh.done) {
      burst(g, sh.x, sh.y - 10, [P.teal, P.ink], 8, 30);
      g.echoShade = null;
    }
  }
  // плиты-противовесы: нажата (фаза «прошлое»), когда на ней стоит Эхо или герой
  function updatePlates() {
    const p = g.player;
    const sh = g.echoShade;
    for (const pl of g.props) {
      if (!pl.def.weight) continue;
      const on = !!((sh && !sh.done && pointInRect(sh.x, sh.y, pl)) || (!pl.echoOnly && p && !p.dead && pointInRect(p.x, p.y, pl)));
      const want = on ? PAST : pl.tl.base;
      if (pl.tl.phase !== want) {
        pl.tl.phase = want;
        pl.tl.left = on ? Infinity : 0;
        audio.sfx.shift(want);
      }
    }
  }

  // ── переносной свет (П2) ──────────────────────────────────────────
  g.pickUp = (o) => {
    const p = g.player;
    if (!p || p.carry) return;
    p.carry = o;
    o.carried = true;
    audio.sfx.pickup?.();
    if (!save.flags.carryHinted) {
      save.flags.carryHinted = true;
      g.hint('С фонарём в руках не ударить. Ореол прошлого идёт с тобой. E — поставить.', 5);
    }
  };
  g.putDown = () => {
    const p = g.player;
    const o = p?.carry;
    if (!o) return;
    const free = (x, y) => !isPit(g, x, y) && !isWall(g, x, y) && !solidPropAt(g, x, y);
    const d = dropPos(p.x, p.y, p.flip);
    o.carried = false;
    if (free(d.x, d.y)) Object.assign(o, d);
    else Object.assign(o, { x: p.x, y: p.y + 1 });
    p.carry = null;
    audio.sfx.drop?.();
  };

  g.spawnEnemy = (kind, x, y, o) => {
    const e = createEnemy(kind, x, y, o);
    g.enemies.push(e);
    return e;
  };

  g.spawnWave = (list) => {
    for (const s of list) {
      const e = g.spawnEnemy(s.kind, s.x, s.y, { spawn: 0.7 + Math.random() * 0.3, ...s.o });
      ringFx(g, s.x, s.y - 6, 2, 16, P.crimson, 0.6);
      void e;
    }
  };

  // ── сценарий ───────────────────────────────────────────────────────
  const live = (tok) => tok === g.scriptToken;
  g.wait = (s) => {
    const tok = g.scriptToken;
    return new Promise((res) => g.waiters.push({ t: s, res, tok }));
  };
  // ожидание, которое можно прервать нажатием; резолвится true, если прервали
  g.waitSkip = (s) => {
    const tok = g.scriptToken;
    g.skipReq = false;
    return new Promise((res) => g.waiters.push({ t: s, res, tok, skip: true }));
  };
  g.waitUntil = (pred) => {
    const tok = g.scriptToken;
    return new Promise((res) => g.waiters.push({ pred, res, tok }));
  };
  g.say = async (lines) => {
    const tok = g.scriptToken;
    g.cinematic = true;
    ui.setPrompt(null);
    await ui.dialogue(lines);
    if (!live(tok)) return new Promise(() => {});
    g.cinematic = false;
  };
  g.choose = async (prompt, options) => {
    const tok = g.scriptToken;
    g.cinematic = true;
    const i = await ui.choice(prompt, options);
    if (!live(tok)) return new Promise(() => {});
    g.cinematic = false;
    return i;
  };
  g.clearedRoom = () => g.enemies.length === 0;
  g.openExits = (silent = false) => {
    let any = false;
    for (const ex of g.exits) {
      if (!ex.open) any = true;
      ex.open = true;
      if (ex.gate) ex.gate.closed = false;
    }
    if (any && !silent) {
      audio.sfx.shift('past');
      ui.toast('Проход открыт');
    }
  };

  // ── герой ─────────────────────────────────────────────────────────
  g.killPlayer = () => {
    const p = g.player;
    if (p.dead) return;
    p.dead = true;
    p.channel = null;
    audio.sfx.death();
    burst(g, p.x, p.y - 10, [P.blue, P.blueHi, P.milk, P.ink, P.amber], 40, 50, { size: 2, life: 1.4, drag: 0.94 });
    save.stats.deaths++;
    loseFragments(save);
    g.persist();
    g.vibrate([60, 40, 120]);
    setTimeout(() => g.onDeath?.(), 1500);
  };

  g.hurtFallen = () => {
    const p = g.player;
    const dmg = g.room.def.fallDamage ?? 10;
    p.hp = Math.max(0, p.hp - dmg);
    addText(g, p.x, p.y - 24, `-${dmg}`, P.crimsonHi);
    audio.sfx.hurt();
    g.room.def.onFall?.(g);
    if (p.hp <= 0) g.killPlayer();
  };

  g.heal = (n) => {
    const p = g.player;
    p.hp = Math.min(p.maxHp, p.hp + n);
    addText(g, p.x, p.y - 26, `+${n}`, P.amberHi);
    audio.sfx.heal();
  };

  // ── комнаты ───────────────────────────────────────────────────────
  g.loadRoom = (id, entry = '@') => {
    const def = ROOMS[id];
    if (!def) throw new Error(`Нет комнаты ${id}`);
    g.scriptToken++;
    g.waiters = [];
    ui.closeAll();
    ui.setBoss(null);
    g.bossBar = null;
    g.boss = null;
    g.bossTargets = null;
    g.freeShift = false;
    g.cinematic = false;
    g.inputLocked = false;
    g.enemies = [];
    g.props = [];
    g.projectiles = [];
    g.pickups = [];
    g.fx = [];
    clearParticles(g.particles);
    g.texts = [];
    g.scenes = [];
    g.islandState = new Map();
    g.memIslands = [];
    g.echoShade = null;
    if (g.player) {
      g.player.carry = null;
      g.player.echoRec = null;
    }
    g.barks = [];
    g.barkList = [];
    g.voidZones = [];
    g.drawables = [];
    g.exits = [];
    g.onPerfectDodge = null;
    g.camFocus = null;
    g.forceMusicPhase = null;
    g.glitch = def.glitch ?? 0.015;
    const room = parseRoom(def);
    g.room = room;
    g.roomCanvas = buildRoomCanvas(room);
    const start = room.markers[entry]?.[0] || room.markers['@']?.[0] || { x: 40, y: 40 };
    if (!g.player || g.player.dead) g.player = createPlayer(start.x, start.y, save);
    else {
      g.player.x = start.x;
      g.player.y = start.y;
      g.player.lastSafe = { x: start.x, y: start.y };
      g.player.history = [];
      g.player.kx = g.player.ky = 0;
      g.player.falling = 0;
      resetPlayerCombat(g.player);
      // между кадрами: немного здоровья и полный браслет
      g.player.hp = Math.min(g.player.maxHp, g.player.hp + Math.round(g.player.maxHp * 0.3));
      g.player.charges.n = g.player.charges.max;
    }
    if (def.facing != null) g.player.aim = def.facing;
    for (const ex of def.exits || []) {
      for (const m of room.markers[ex.marker] || []) {
        const rect = { x: m.tx * TILE, y: m.ty * TILE, w: TILE, h: TILE };
        const exit = { ...ex, rect, open: !ex.gate };
        if (ex.gate) exit.gate = g.addProp('gate', rect.x, rect.y, { w: TILE, h: TILE, closed: true });
        g.exits.push(exit);
      }
    }
    g.holdFade = !!def.holdFade?.(g);
    def.setup?.(g, room);
    if (isFixed(save, 'oven') && g.player && !g.player.dead && g.player.hp < g.player.maxHp) {
      g.player.hp = Math.min(g.player.maxHp, g.player.hp + Math.round(g.player.maxHp * 0.15));
    }
    (save.flags.visited ||= {})[id] = true;
    if (def.checkpoint !== false) {
      save.room = id;
      save.started = true;
    }
    g.persist();
    audio.setMusic(def.music ?? null);
    audio.setMusicPhase('present');
    snapCamera();
    if (def.title) ui.banner(def.title, def.subtitle || '');
    if (def.script) {
      const tok = g.scriptToken;
      def.script(g).catch((err) => {
        if (live(tok)) console.error(err);
      });
    }
  };

  g.transition = async (to, entry) => {
    if (g.transitioning) return;
    g.transitioning = true;
    g.inputLocked = true;
    await ui.fade(true);
    g.loadRoom(to, entry);
    if (!g.holdFade) await ui.fade(false);
    g.inputLocked = false;
    g.transitioning = false;
  };

  g.retryRoom = async () => {
    await ui.fade(true);
    g.player = null;
    g.loadRoom(save.room);
    if (!g.holdFade) await ui.fade(false);
  };

  g.newGame = () => {
    const s = freshSave(save);
    Object.keys(save).forEach((k) => delete save[k]);
    Object.assign(save, s);
    g.flags = save.flags;
    g.player = null;
  };

  // ── взаимодействие ────────────────────────────────────────────────
  function findInteract() {
    const p = g.player;
    const items = [];
    for (const o of g.props) {
      if (!o.onInteract || o.hidden || o.carried) continue;
      if (o.canInteract && !o.canInteract(g)) continue;
      if (o.def.auraOnly && !o.lit) continue;
      const [cx, cy] = o.def.flat ? propCenter(o) : [o.x, o.y - 2];
      items.push({ obj: o, x: cx, y: cy, range: o.interactRange, reach: o.reach });
    }
    return findInteractable(items, p.x, p.y);
  }

  g.tryInteract = () => {
    const o = g.interactTarget;
    if (g.cinematic) return;
    if (!o) {
      if (g.player?.carry) g.putDown();
      return;
    }
    const tok = g.scriptToken;
    Promise.resolve(o.onInteract(g, o)).catch((err) => {
      if (live(tok)) console.error(err);
    });
  };

  // Строка подсказки внизу: взаимодействие и цель сдвига — что именно выбрано и что будет.
  function promptText() {
    const p = g.player;
    if (!p || p.dead || g.cinematic) return null;
    const pad = input.device === 'pad';
    const touch = input.device === 'touch';
    const lines = [];
    const it = g.interactTarget;
    if (it) lines.push(`${pad ? 'B' : touch ? '✋' : 'E'} — ${it.prompt || 'Осмотреть'}`);
    else if (p.carry) lines.push(`${pad ? 'B' : touch ? '✋' : 'E'} — поставить ${p.carry.def.name.toLowerCase()}`);
    else if (g.interactNear) lines.push(`Подойди ближе — ${(g.interactNear.prompt || 'осмотреть').toLowerCase()}`);
    const t = p.shiftTarget;
    if (t) {
      const tl = t.obj.tl;
      const next = isShifted(tl) ? tl.base : tl.phase === PAST ? 'present' : 'past';
      const name = t.obj.name || t.obj.def?.name || (t.type === 'projectile' ? (t.obj.kind === 'ring' ? 'Звуковая волна' : 'Нота') : 'Объект');
      lines.push(`${pad ? 'Y' : touch ? '⧗' : 'Q'} — ${shiftLabel(name, next)}`);
    }
    return lines.length ? lines.join('\n') : null;
  }

  // ── обновление ────────────────────────────────────────────────────
  function snapCamera() {
    const p = g.player;
    const room = g.room;
    g.cam.x = room.pxW <= W ? (room.pxW - W) / 2 : clamp(p.x - W / 2, 0, room.pxW - W);
    g.cam.y = room.pxH <= H ? (room.pxH - H) / 2 : clamp(p.y - 10 - H / 2, 0, room.pxH - H);
  }

  function updateCamera(dt) {
    const p = g.player;
    const room = g.room;
    let tx = p.x + Math.cos(p.aim) * 14 - W / 2;
    let ty = p.y - 10 + Math.sin(p.aim) * 10 - H / 2;
    if (g.camFocus) {
      tx = g.camFocus.x - W / 2;
      ty = g.camFocus.y - H / 2;
    }
    tx = room.pxW <= W ? (room.pxW - W) / 2 : clamp(tx, 0, room.pxW - W);
    ty = room.pxH <= H ? (room.pxH - H) / 2 : clamp(ty, 0, room.pxH - H);
    const k = Math.min(1, dt * 6);
    g.cam.x += (tx - g.cam.x) * k;
    g.cam.y += (ty - g.cam.y) * k;
    if (g.cam.shakeT > 0) g.cam.shakeT -= dt;
    else g.cam.shakeA = 0;
  }

  function updatePickups(dt) {
    const p = g.player;
    for (const pk of g.pickups) {
      pk.t += dt;
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      pk.vx *= Math.pow(0.85, dt * 60);
      pk.vy *= Math.pow(0.85, dt * 60);
      if (!p || p.dead || pk.t < 0.35) continue;
      const d = dist(pk.x, pk.y, p.x, p.y - 4);
      const magnet = pk.kind === 'ash' || pk.kind === 'shard' ? 40 : 0;
      if (d < magnet) {
        pk.x += ((p.x - pk.x) / d) * 150 * dt;
        pk.y += ((p.y - 4 - pk.y) / d) * 150 * dt;
      }
      if (d < 9) {
        pk.taken = true;
        if (pk.kind === 'ash') {
          save.ash++;
          audio.sfx.pickup();
        } else if (pk.kind === 'shard') {
          save.shards++;
          audio.sfx.shard();
          addText(g, p.x, p.y - 26, 'осколок мгновения', P.tealHi);
          g.persist();
        } else if (pk.kind === 'heal') g.heal(pk.amount ?? 40);
        else if (pk.kind === 'fragment') g.giveFragment(pk.id);
        else if (pk.kind === 'scrap') {
          const m = pk.memory ?? 'nameScrap';
          if (m === 'nameScrap') g.flags.nameScrap = true;
          g.remember(m);
        }
        pk.onTake?.(g);
      }
    }
    g.pickups = g.pickups.filter((pk) => !pk.taken);
  }

  function updateProps(dt) {
    const p = g.player;
    if (p?.carry) Object.assign(p.carry, carryPos(p.x, p.y, p.flip));
    updateShade(dt);
    updatePlates();
    // острова памяти: ореолы объектов (PROP_KINDS.aura) и особые источники комнаты
    const extra = g.room.def.memorySources?.(g);
    g.memIslands = updateIslands(g.islandState, extra ? [...auraSources(g.props), ...extra] : auraSources(g.props), dt);
    for (const pr of g.props) {
      // призраки ореола видны только в острове, стёртые надписи — читаются только там
      if (pr.inAura) {
        const own = typeof pr.inAura === 'string' ? g.memIslands.filter((i) => g.props.some((o) => o.id === i.id && o.kind === pr.inAura)) : g.memIslands;
        pr.hidden = !inIslands(own, pr.x, pr.y - 4);
      }
      if (pr.def.auraOnly) {
        const [ix, iy] = propCenter(pr);
        pr.lit = inIslands(g.memIslands, ix, iy);
      }
      if (tickTimeline(pr.tl, dt) === 'reverted') {
        audio.sfx.shift('present');
        const [cx, cy] = propCenter(pr);
        burst(g, cx, cy, [P.crimson, P.ink], 8, 40);
        pr.onRevert?.(g, pr);
      }
      // фонарь в Шраме бьёт током по кругу
      const pulse = !pr.carried && pr.def.pulse?.[pr.tl.phase];
      if (pulse) {
        pr.pulseT = (pr.pulseT ?? Math.random() * 2) - dt;
        if (pr.pulseT <= 0) {
          pr.pulseT = 2.6;
          ringFx(g, pr.x, pr.y - 4, 4, pulse, P.tealHi, 0.3, 0.6);
          let hit = false;
          for (const e of g.enemies) {
            if (e.dead || e.spawn > 0) continue;
            if (dist(e.x, e.y, pr.x, pr.y) < pulse) {
              g.damageEnemy(e, 6, { pure: true, stagger: true });
              e.stun = Math.max(e.stun, 0.4);
              hit = true;
            }
          }
          const pl = g.player;
          if (pl && !pl.dead && pl.invuln <= 0 && dist(pl.x, pl.y, pr.x, pr.y) < pulse) {
            g.hurtPlayer(5, pr.x, pr.y, 'zap');
            hit = true;
          }
          if (hit || dist(g.player.x, g.player.y, pr.x, pr.y) < 140) audio.sfx.zap();
        }
      }
      pr.update?.(g, pr, dt);
    }
    // нити причин: следствия идут за причинами каскадом
    for (const pr of resolveThreads(g.props)) {
      const [ex, ey] = propCenter(pr);
      burst(g, ex, ey - 4, pr.tl.phase === PAST ? [P.amberHi, P.milk] : [P.crimson, P.ink], 8, 34);
      audio.sfx.shift(pr.tl.phase);
      pr.onShift?.(g, pr, pr.tl.phase);
    }
    if (g.props.some((pr) => pr.removed)) g.props = g.props.filter((pr) => !pr.removed);
  }

  function updateVoidZones(dt) {
    for (const z of g.voidZones) {
      if (z.warn > 0) {
        z.warn -= dt;
        if (z.warn <= 0) {
          z.active = true;
          audio.sfx.shift('present');
        }
      } else {
        z.t -= dt;
      }
    }
    g.voidZones = g.voidZones.filter((z) => z.warn > 0 || z.t > 0);
  }

  function updateExits() {
    const p = g.player;
    if (!p || p.dead || g.transitioning) return;
    for (const ex of g.exits) {
      if (!ex.open) continue;
      const r = ex.rect;
      if (p.x > r.x - 2 && p.x < r.x + r.w + 2 && p.y > r.y - 2 && p.y < r.y + r.h + 4) {
        if (ex.onExit) ex.onExit(g);
        else g.transition(ex.to, ex.entry);
        return;
      }
    }
  }

  function updateMusicPhase() {
    const p = g.player;
    let past = false;
    const near = (x, y) => dist(x, y, p.x, p.y) < 110;
    for (const pr of g.props) if (pr.tl.phase === PAST && pr.tl.switchable && near(pr.x, pr.y)) past = true;
    for (const e of g.enemies) if (e.tl.phase === PAST && near(e.x, e.y)) past = true;
    if (g.forceMusicPhase) past = g.forceMusicPhase === PAST;
    audio.setMusicPhase(past ? 'past' : 'present');
  }

  function quietFrame(dt) {
    const p = g.player;
    p.quietFrame = Math.max(0, p.quietFrame - dt);
    if (p.quietFrame > 0 || !g.hasFragment('quietFrame')) return;
    const threat = g.projectiles.some((pr) => pr.kind === 'note' && !isShifted(pr.tl) && dist(pr.x, pr.y, p.x, p.y - 8) < 34);
    if (!threat) return;
    p.quietFrame = 20;
    for (const pr of g.projectiles) if (dist(pr.x, pr.y, p.x, p.y) < 80) pr.frozen = 1;
    ringFx(g, p.x, p.y - 8, 4, 40, P.milk, 0.4);
    addText(g, p.x, p.y - 30, 'тихий кадр', P.milk);
  }

  g.update = (dt) => {
    if (g.scene !== 'play' || !g.room) return;
    if (g.paused) return;
    g.time += dt;
    g.frame++;
    ui.typewriter(dt);
    for (const w of g.waiters) {
      if (w.tok !== g.scriptToken) {
        w.done = true;
        continue;
      }
      if (w.skip && g.skipReq) {
        w.done = true;
        w.res(true);
        continue;
      }
      if (w.t != null) {
        w.t -= dt;
        if (w.t <= 0) w.done = true;
      } else if (w.pred(g)) w.done = true;
      if (w.done) w.res(false);
    }
    g.waiters = g.waiters.filter((w) => !w.done);
    // нажатие во время сцены без диалога — запрос пропуска для g.waitSkip
    g.skipReq = g.cinematic && !ui.mode && input.anyPressed('confirm', 'attack', 'interact', 'rift', 'dodge');

    if (g.hitstopT > 0) {
      g.hitstopT -= dt;
      updateFx(g, dt * 0.2);
      return;
    }
    if (g.slowT > 0) {
      g.slowT -= dt;
      dt *= 0.35;
    }
    // Взгляд Смотрителя (удерживать): мир замедляется и гаснет, видно всё, с чем можно что-то сделать
    g.gaze = !g.cinematic && !ui.mode && !!g.player && !g.player.dead && input.isDown('gaze');
    g.gazeK = clamp((g.gazeK || 0) + (g.gaze ? dt * 6 : -dt * 8), 0, 1);
    dt *= 1 - 0.7 * g.gazeK;
    const p = g.player;
    if (!g.cinematic) {
      updatePlayer(g, p, dt);
      updateEnemies(g, dt);
      updateProjectiles(g, dt);
      updateProps(dt);
      updateVoidZones(dt);
      updatePickups(dt);
      g.boss?.update(g, dt);
      g.room.def.update?.(g, dt);
      quietFrame(dt);
      updateExits();
    } else {
      p.walk = 0;
      p.moving = false;
    }
    updateFx(g, dt);
    updateScenes(dt);
    g.lights = collectLights(g);
    // первая встреча с нитью причин — подсказка
    const st = p?.shiftTarget?.obj;
    if (st && !save.flags.threadHinted && !g.cinematic && chainOf(g.props, st).length) {
      save.flags.threadHinted = true;
      g.hint('Янтарная нить — причина и следствие. Сдвигай причину: следствие пойдёт за ней.', 6);
    }
    // интерактив
    const found = !g.cinematic && p && !p.dead ? findInteract() : { target: null, near: null };
    g.interactTarget = found.target;
    g.interactNear = found.near;
    ui.setPrompt(promptText());
    updateCamera(dt);
    if (p) updateMusicPhase();
  };

  return g;
}

export { propFoot };
