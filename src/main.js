// Точка входа: меню, игровой цикл, пауза, настройки, смерть.
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
// текст интерфейса: Alegreya SC (имена, заголовки — капитель с засечками) и Alegreya Sans
// (диалоги, подсказки — читается мелким кеглем); оба с кириллицей
import '@fontsource/alegreya-sc/500.css';
import '@fontsource/alegreya-sc/700.css';
import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import '../css/style.css';
import { createRenderer } from './core/renderer.js';
import { createInput } from './core/input.js';
import { createAudio } from './core/audio.js';
import { createUI } from './ui/overlay.js';
import { createGame } from './game.js';
import { loadSave, hasProgress, parseSave } from './save/save.js';
import { renderWorld } from './render.js';
import { loadRoomArt } from './art/roomart.js';
import { memoryList } from './story/memories.js';
import { questBoard } from './story/quests.js';
import { buildRoomCanvas } from './art/tiles.js';
import { drawTitle } from './scenes/title.js';
import { createTouch } from './mobile/touch.js';
import { ROOMS, CHAPTER1 } from './scenes/rooms.js';
import { setArtVariant, getArtVariant } from './scenes/chapter1.js';
import { drawSpriteSheet } from './scenes/spritesheet.js';
import { resolveProfile, createAutoTuner, tuneStep, PROFILES } from './core/quality.js';
import { createPerf, instrument, recordFrame, summary, setOverlay, showOverlay } from './core/perf.js';
import { frameStats, lightLayerBytes, setCallProbe } from './render.js';
import { atlasStats, atlas, loadSpriteOverrides, exportSheet } from './art/spritecache.js';
import { lightCacheBytes } from './art/lightmask.js';
import { W, H } from './core/renderer.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('screen');
const renderer = createRenderer(canvas, stage);
const input = createInput(renderer);
const audio = createAudio();
const ui = createUI(document.getElementById('ui'), { audio });
const save = loadSave(window.localStorage);
const game = createGame({ input, audio, ui, storage: window.localStorage, save });
const touch = createTouch(document.getElementById('touch'), input, renderer);

const ENV = { cores: navigator.hardwareConcurrency, memory: navigator.deviceMemory, touch: matchMedia('(pointer: coarse)').matches };
const perf = createPerf();
const tuner = createAutoTuner({ limitMs: 14 });

function applySettings() {
  const s = save.settings;
  audio.setVolumes(s.music, s.sfx);
  if (!!s.perfOverlay !== perf.on) toggleOverlay(!!s.perfOverlay);
  game.autoQuality = s.quality === 'auto';
  game.setQuality(resolveProfile(s.quality, ENV));
  touch.applySettings(s);
}
applySettings();

// Звук разрешается только внутри «жеста»: в iOS Safari это touchend и click,
// а не pointerdown/pointerup — слушаем все, в фазе перехвата (раньше, чем кнопки).
const unlock = () => audio.unlock();
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, unlock, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && audio.ready) audio.unlock();
});

// ── меню ─────────────────────────────────────────────────────────────
const LOGO = '<h1>ПЕПЕЛ МЕЖДУ КАДРАМИ</h1><p>мир забывает самого себя</p>';

function titleMenu() {
  game.scene = 'title';
  ui.setBoss(null);
  audio.setMusic('title');
  const cont = hasProgress(save);
  ui.menu({
    cls: 'title',
    dim: false,
    logo: LOGO,
    foot: 'v0.1 · прототип главы 1',
    items: [
      { text: 'Продолжить', disabled: !cont, on: () => startGame(save.room) },
      { text: 'Новая игра', on: () => (cont ? confirmNew() : newGame()) },
      { text: 'Настройки', on: () => settingsMenu(titleMenu) },
      { text: 'Управление', on: () => controlsMenu(titleMenu) },
      { text: 'Об игре', on: aboutMenu },
    ],
  });
}

function confirmNew() {
  ui.menu({
    title: 'Начать заново?',
    extra: note('Прогресс главы, зола и улучшения будут стёрты. Настройки останутся.'),
    items: [
      { text: 'Да, стереть', on: newGame },
      { text: 'Нет', on: titleMenu },
    ],
    back: titleMenu,
  });
}

function newGame() {
  game.newGame();
  startGame('road');
}

async function startGame(roomId) {
  ui.closeMenu();
  audio.unlock();
  await ui.fade(true);
  game.scene = 'play';
  game.paused = false;
  game.player = null;
  game.loadRoom(ROOMS[roomId] ? roomId : 'road');
  if (!game.holdFade) await ui.fade(false);
}

function note(text) {
  const d = document.createElement('div');
  d.className = 'note';
  d.textContent = text;
  return d;
}

function aboutMenu() {
  ui.menu({
    title: 'Пепел между кадрами',
    extra: note(
      'Пиксельная action-RPG. Мир стирается из истории из-за Нулевой Свечи. Рен, Последний Смотритель, умеет ненадолго возвращать вещам и врагам их прошлое — Отпечаток — вместо Шрама, которым они стали. Прототип первой главы «Колокол, который не помнит удара».',
    ),
    items: [{ text: 'Назад', on: titleMenu }],
    back: titleMenu,
  });
}

function controlsMenu(back) {
  const d = document.createElement('div');
  d.innerHTML = `<div class="keys">
    <b>WASD / стрелки</b><span>движение</span>
    <b>ЛКМ / J</b><span>удар (жми снова на вспышке клинка)</span>
    <b>ПКМ / Shift / K</b><span>уклонение</span>
    <b>Q</b><span>сменить состояние цели: Отпечаток ⇄ Шрам</span>
    <b>E</b><span>взаимодействие</span>
    <b>V (удерживать)</b><span>взгляд Смотрителя: всё, с чем можно что-то сделать, и что будет после сдвига</span>
    <b>R</b><span>Эхо: записать до 5 секунд действий</span>
    <b>Пробел</b><span>импульсный разлом (когда шкала полна)</span>
    <b>Esc</b><span>пауза</span>
  </div>
  <div class="note">Геймпад: левый стик — движение, правый — прицел, X — удар, A — уклонение, Y — сдвиг, B — взаимодействие, RB — разлом, L3 — взгляд, R3 — Эхо.<br>Телефон: левый стик, ⚔ удар, ↷ уклонение, ⧗ сдвиг, ✦ разлом, ◉ взгляд (удерживать), ◐ Эхо; тап по экрану — удар в точку, свайп — уклонение.</div>`;
  ui.menu({ title: 'Управление', extra: d, items: [{ text: 'Назад', on: back }], back });
}

function settingsMenu(back) {
  const s = save.settings;
  const box = document.createElement('div');
  const row = (label, inputEl) => {
    const r = document.createElement('label');
    r.className = 'row';
    const sp = document.createElement('span');
    sp.textContent = label;
    r.append(sp, inputEl);
    box.appendChild(r);
  };
  const slider = (key, min, max, step) => {
    const i = document.createElement('input');
    i.type = 'range';
    i.min = min;
    i.max = max;
    i.step = step;
    i.value = s[key];
    i.addEventListener('input', () => {
      s[key] = Number(i.value);
      applySettings();
      game.persist();
    });
    return i;
  };
  const toggle = (key) => {
    const i = document.createElement('input');
    i.type = 'checkbox';
    i.checked = !!s[key];
    i.addEventListener('change', () => {
      s[key] = i.checked;
      applySettings();
      game.persist();
    });
    return i;
  };
  row('Музыка', slider('music', 0, 1, 0.05));
  row('Звуки', slider('sfx', 0, 1, 0.05));
  row('Вибрация', toggle('vibration'));
  row('Тряска экрана', toggle('screenShake'));
  row('Упрощённый бой (автоудар)', toggle('autoAttack'));
  row('Автонаведение', toggle('autoAim'));
  const qsel = document.createElement('select');
  for (const [v, t] of [['auto', 'Авто'], ['low', 'Низкое'], ['medium', 'Среднее'], ['high', 'Высокое']]) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = t;
    qsel.appendChild(o);
  }
  qsel.value = s.quality;
  qsel.addEventListener('change', () => {
    s.quality = qsel.value;
    applySettings();
    game.persist();
  });
  row('Качество графики', qsel);
  row('Режим 30 FPS (экономия батареи)', toggle('fps30'));
  row('Показатели производительности', toggle('perfOverlay'));
  row('Размер кнопок', slider('buttonScale', 0.7, 1.5, 0.05));
  row('Прозрачность стика', slider('stickOpacity', 0.15, 1, 0.05));
  const items = [];
  if (document.fullscreenEnabled) {
    items.push({
      text: document.fullscreenElement ? 'Выйти из полноэкранного' : 'Полный экран',
      on: async () => {
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await document.documentElement.requestFullscreen();
          screen.orientation?.lock?.('landscape').catch(() => {});
        } catch {
          /* браузер не дал */
        }
        settingsMenu(back);
      },
    });
  }
  if (game.scene === 'title') {
    items.push({ text: 'Сохранить прогресс в файл', on: exportSave });
    items.push({ text: 'Загрузить прогресс из файла', on: importSave });
  }
  items.push({ text: 'Готово', on: back });
  ui.menu({ title: 'Настройки', extra: box, items, back });
}

function exportSave() {
  const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pepel-mezhdu-kadrami.save.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  ui.toast('Файл сохранения скачан');
}

function importSave() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,application/json';
  inp.onchange = async () => {
    const f = inp.files?.[0];
    if (!f) return;
    const loaded = parseSave(await f.text());
    Object.keys(save).forEach((k) => delete save[k]);
    Object.assign(save, loaded);
    game.flags = save.flags;
    game.persist();
    applySettings();
    ui.toast(hasProgress(save) ? 'Прогресс загружен' : 'В файле нет прогресса');
    titleMenu();
  };
  inp.click();
}

function pauseMenu() {
  if (game.scene !== 'play' || ui.mode) return;
  game.paused = true;
  const resume = () => {
    ui.closeMenu();
    game.paused = false;
    input.clear();
  };
  ui.menu({
    title: 'Пауза',
    items: [
      { text: 'Продолжить', on: resume },
      { text: 'Настройки', on: () => settingsMenu(pauseMenu2) },
      { text: 'Управление', on: () => controlsMenu(pauseMenu2) },
      { text: 'В главное меню', on: () => quitToTitle() },
    ],
    back: resume,
  });
}
// Карта главы (Tab): пройденные места и текущее.
function mapMenu() {
  if (ui.mode) return;
  game.paused = true;
  const box = document.createElement('div');
  box.className = 'keys';
  const visited = save.flags.visited || {};
  for (const id of CHAPTER1) {
    const def = ROOMS[id];
    const here = game.room?.id === id;
    const b = document.createElement('b');
    b.textContent = here ? '◆' : visited[id] ? '◇' : '·';
    const sp = document.createElement('span');
    sp.textContent = visited[id] || here ? def.title : '???';
    if (here) sp.style.color = 'var(--amber-hi)';
    box.append(b, sp);
  }
  const close = () => {
    ui.closeMenu();
    game.paused = false;
    input.clear();
  };
  // дневник памяти: воспоминания — знание и предмет (их предъявляют в разговорах)
  const wrap = document.createElement('div');
  wrap.append(box);
  const mem = memoryList(save);
  const j = document.createElement('div');
  j.className = 'journal';
  const h = document.createElement('h2');
  h.textContent = mem.length ? `Память · ${mem.length}` : 'Память';
  j.append(h);
  if (!mem.length) {
    const p = document.createElement('p');
    p.className = 'note';
    p.textContent = 'Пока пусто. Досмотри сцену прошлого или найди обрывок — и воспоминание останется здесь.';
    j.append(p);
  }
  for (const m of mem) {
    const d = document.createElement('div');
    d.className = 'm';
    d.innerHTML = `<b></b><small></small><p></p>`;
    d.querySelector('b').textContent = m.name;
    d.querySelector('small').textContent = m.place;
    d.querySelector('p').textContent = m.text;
    j.append(d);
  }
  wrap.append(j);
  // доска воспоминаний: квест — воспоминание, которому не хватает кусочков
  const qs = questBoard(save);
  if (qs.length) {
    const qb = document.createElement('div');
    qb.className = 'journal board';
    const qh = document.createElement('h2');
    qh.textContent = 'Нити воспоминаний';
    qb.append(qh);
    for (const q of qs) {
      const d = document.createElement('div');
      d.className = `q${q.done ? ' done' : ''}${q.lost ? ' lost' : ''}`;
      const t = document.createElement('b');
      t.textContent = `${q.done ? '✓ ' : q.lost ? '✕ ' : ''}${q.name}`;
      d.append(t);
      for (const st of q.steps) {
        const r = document.createElement('div');
        r.className = `st${st.have ? ' have' : ''}`;
        r.textContent = `${st.have ? '✓' : '?'} ${st.label}`;
        if (!st.have && st === q.next) {
          const w = document.createElement('small');
          w.textContent = ` — искать: ${st.where}`;
          r.append(w);
        }
        d.append(r);
      }
      if (q.done && q.result) {
        const p = document.createElement('p');
        p.textContent = q.result;
        d.append(p);
      } else if (q.lost) {
        const p = document.createElement('p');
        p.textContent = 'Нужное воспоминание уже отдано — эту нить не собрать.';
        d.append(p);
      }
      qb.append(d);
    }
    wrap.append(qb);
  }
  ui.menu({ title: 'Глава 1 · Колокол, который не помнит удара', extra: wrap, items: [{ text: 'Закрыть', on: close }], back: close });
}

function pauseMenu2() {
  ui.closeMenu();
  pauseMenu();
}

async function quitToTitle() {
  ui.closeAll();
  await ui.fade(true);
  game.scene = 'title';
  game.room = null;
  game.paused = false;
  game.scriptToken++;
  titleMenu();
  await ui.fade(false);
}

game.onDeath = () => {
  ui.closeAll();
  // отпустить всё зажатое (стик, удар), спрятать сенсорные кнопки до появления меню
  input.clear();
  touch.update(game, false);
  ui.menu({
    title: 'Тебя стёрло',
    extra: note('Сюжет помнит тебя — ты вернёшься к началу комнаты. Временные фрагменты рассыпались.'),
    items: [
      {
        text: 'Вспомнить себя',
        on: () => {
          ui.closeMenu();
          game.retryRoom();
        },
      },
      { text: 'В главное меню', on: () => quitToTitle() },
    ],
  });
};

const pauseBtn = ui.pauseButton(() => pauseMenu());

// ── цикл ─────────────────────────────────────────────────────────────
let last = performance.now();
let acc = 0;
let lastFrameAt = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  // режим 30 FPS: пропускаем каждый второй вызов, логика получает накопленное время
  if (save.settings.fps30 && acc < 1 / 31) return;
  const dt = Math.min(0.05, acc);
  acc = 0;
  const gap = now - lastFrameAt;
  lastFrameAt = now;
  const t0 = performance.now();
  let t1 = t0;
  input.update();
  const consumed = ui.handleInput(input);
  if (!consumed && input.pressed('pause') && game.scene === 'play') pauseMenu();
  if (!consumed && input.pressed('map') && game.scene === 'play' && !game.cinematic) mapMenu();
  renderer.begin();
  if (game.scene === 'sprites') {
    game.time += dt;
    drawSpriteSheet(renderer.ctx, game.time);
  } else if (game.scene === 'title') {
    renderer.setZoom(1);
    ui.typewriter(dt);
    game.time += dt;
    drawTitle(renderer.ctx, game.time);
  } else {
    // мирные сцены — камера ближе (def.zoom комнаты), бой — обычный кадр
    renderer.setZoom(game.room?.def.zoom ?? 1);
    // подсказка прячется на время диалога, выбора, меню и сцены — и возвращается после
    ui.hideHintFor?.(!!ui.mode || game.cinematic || game.paused);
    game.update(dt);
    t1 = performance.now();
    renderWorld(game, renderer.ctx);
  }
  const t2 = performance.now();
  recordFrame(perf, t1 - t0, t2 - t1, gap);
  if (game.autoQuality && game.scene === 'play') {
    const down = tuneStep(tuner, game.quality.id, summary(perf).cpuMs, dt);
    if (down) {
      game.setQuality(PROFILES[down]);
      ui.toast(`Качество снижено: ${PROFILES[down].name}`, 2);
    }
  }
  if (perf.on) {
    const g = game;
    const enemies = g.enemies || [];
    const at = atlasStats();
    showOverlay(perf, now, {
      fpsCap: save.settings.fps30 ? 30 : 60,
      callLimit: { low: 250, medium: 400, high: 650 }[g.quality.id],
      objects: `${frameStats.objects} видно / ${(g.props?.length || 0) + enemies.length + (g.projectiles?.length || 0) + (g.pickups?.length || 0)} всего`,
      particles: g.particles.n,
      particleCap: g.particles.cap,
      lights: frameStats.lights,
      lightLimit: g.quality.lights,
      enemies: enemies.length,
      far: enemies.filter((e) => e.far).length,
      canvasBytes: at.bytes + (g.roomCanvas ? g.roomCanvas.width * g.roomCanvas.height * 4 : 0) + lightLayerBytes() + lightCacheBytes() + W * H * 4 * renderer.rs * renderer.rs,
      atlasFrames: at.frames,
      profile: g.quality.name + (g.autoQuality ? ' (авто)' : ''),
      frame: `${W}×${H} (сетка ×${renderer.rs}) ×${+renderer.scale.toFixed(2)}`,
    });
  }
  const playing = game.scene === 'play' && !ui.mode && !game.cinematic && !game.paused;
  touch.update(game, playing);
  pauseBtn.classList.toggle('hidden', !(game.scene === 'play' && !ui.mode && touch.enabled));
  input.endFrame();
}

function toggleOverlay(on = !perf.on) {
  if (on) {
    instrument(perf, renderer.ctx);
    setCallProbe(() => perf.calls);
  }
  setOverlay(perf, on);
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'F3') {
    e.preventDefault();
    toggleOverlay();
  }
  // F4 — сравнение прежней и новой художественной версии эталонной комнаты
  if (e.code === 'F4' && __DEBUG__ && game.room?.id === 'square') {
    e.preventDefault();
    const next = getArtVariant() === 'current' ? 'target' : 'current';
    setArtVariant(next);
    const { x, y } = game.player;
    game.loadRoom('square');
    game.player.x = x;
    game.player.y = y;
    ui.toast(next === 'current' ? 'Арт: прежняя версия (current)' : 'Арт: целевая версия (target)', 2);
  }
});

titleMenu();
requestAnimationFrame(frame);
// ручные PNG-спрайты (public/sprites), если есть — заменяют кодовые кадры
loadSpriteOverrides(import.meta.env.BASE_URL);
// рисованные слои комнат (public/art/rooms), если есть — заменяют кодовый пол
loadRoomArt(import.meta.env.BASE_URL, () => {
  if (game.room) game.roomCanvas = buildRoomCanvas(game.room);
});
if (save.settings.perfOverlay || new URLSearchParams(location.search).has('debug')) toggleOverlay(true);

if (__DEBUG__) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Поставить комнату для осмотра: без диалогов, с подготовкой сцены.
  const shot = async (id, setup) => {
    game.flags.introSeen = true;
    await startGame(id);
    await sleep(1800);
    ui.closeAll();
    game.cinematic = false;
    setup?.(game);
    await sleep(500);
    return id;
  };
  const skip = async () => {
    for (let i = 0; i < 20 && ui.mode === 'dialogue'; i++) {
      input.tap('confirm');
      await sleep(120);
    }
  };
  window.__abf = { game, save, ui, input, rooms: ROOMS, startGame, shot, skip, sleep, perf, summary: () => summary(perf), frameStats, PROFILES, renderer, atlas, setArtVariant, exportSheet };
  const q = new URLSearchParams(location.search);
  if (q.get('room')) startGame(q.get('room'));
  if (q.has('sprites')) {
    ui.closeAll();
    game.scene = 'sprites';
  }
}
